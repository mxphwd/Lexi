import { normalize } from '../dv12/store';
import type { DataPackCatalog } from './types';

const stop = new Set(['what','which','who','where','when','why','how','is','are','was','were','be','the','a','an','of','in','on','at','to','for','from','with','and','or','but','please','tell','give','show','me','my','your','its']);

export function dataPackPhrases(text: string): string[] {
  const words = normalize(text)
    .replace(/(?:'s|’s)\b/gu, '')
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const phrases: string[] = [];
  for (let width = Math.min(6, words.length); width >= 1; width -= 1) for (let index = 0; index + width <= words.length; index += 1) {
    const phrase = words.slice(index, index + width).join(' ');
    if (width === 1 && stop.has(phrase)) continue;
    phrases.push(phrase);
    if (phrases.length >= 48) return [...new Set(phrases)];
  }
  return [...new Set(phrases)];
}

export function rankDataPacks(
  catalog: DataPackCatalog,
  aliasMatches: Map<string, Set<string>>,
  entityMatches: Set<string>,
  relationMatches: Set<string>,
  loaded: ReadonlySet<string>,
): string[] {
  const score = new Map<string, number>();
  const add = (id: string, value: number) => score.set(id, (score.get(id) ?? 0) + value);
  const subjectMatches = new Set<string>();
  for (const matches of aliasMatches.values()) for (const id of matches) add(id, 8);
  for (const matches of aliasMatches.values()) for (const id of matches) subjectMatches.add(id);
  for (const id of entityMatches) { subjectMatches.add(id); add(id, 14); }
  for (const id of relationMatches) add(id, 5);
  // A pack containing both the mentioned entity and requested relation is far
  // more useful than a pack that merely shares a generic relation alias.
  for (const id of subjectMatches) if (relationMatches.has(id)) add(id, 40);
  return [...score]
    .filter(([id]) => !loaded.has(id) && !!catalog.packs[id])
    .sort(([a,sa],[b,sb]) => sb - sa || catalog.packs[a].propositions - catalog.packs[b].propositions || a.localeCompare(b))
    .map(([id]) => id);
}
