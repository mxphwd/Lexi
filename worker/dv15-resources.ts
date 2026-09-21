import { hash, assetJson, type AssetFetcher } from './dv12-assets';
import type { ResourceAnswer, ResourceNeed } from '../modules/dv12/runtime';
import type { Atom, Plan, Term } from '../modules/dv12/types';
import { installDataPacks } from '../modules/dv15/validator';
import { dataPackPhrases, rankDataPacks } from '../modules/dv15/selector';
import type { DataPack, DataPackCatalog } from '../modules/dv15/types';
import { DV15_CATALOG } from './dv15-integrity';

const planAtoms = (plan: Plan): Atom[] => plan.kind === 'query' ? plan.atoms : plan.kind === 'compare' ? plan.subjects.map((subject) => ({ subject, relation: plan.relation, object: { kind:'variable' as const, name:'answer' } })) : [];
const entityIds = (term: Term): string[] => term.kind === 'entity' ? [term.id] : term.kind === 'mention' ? term.candidates : [];
const bucket = async (value: string) => (await hash(new TextEncoder().encode(value))).slice(0,2);

/** Request-local DV15 pack service. No pack or index is retained in browser
 * state, and each new request receives a fresh bounded overlay. */
export function dv15ResourceLoader(assets: AssetFetcher, origin: string) {
  let activeStore: ResourceNeed['store'] | undefined;
  let loaded = new Set<string>();
  let loadedBytes = 0;
  let loadedPropositions = 0;
  return async (need: ResourceNeed): Promise<ResourceAnswer | undefined> => {
    if (activeStore !== need.store) { activeStore = need.store; loaded = new Set(); loadedBytes = 0; loadedPropositions = 0; }
    const catalog = await assetJson<DataPackCatalog>(assets, origin, DV15_CATALOG, need.signal);
    if (catalog.version !== 15 || catalog.counts.basicPacks !== 550 || catalog.counts.advancedPacks < 180 || catalog.counts.advancedPacks > 220) throw new Error('DV15_CATALOG_VERSION');
    const phrases = dataPackPhrases(need.text);
    const aliases = new Map<string, Set<string>>();
    const buckets = new Map<string, string[]>();
    for (const phrase of phrases) {
      const key = await bucket(phrase), values = buckets.get(key) ?? [];
      values.push(phrase); buckets.set(key, values);
    }
    for (const [key, values] of buckets) {
      const descriptor = catalog.indexes.alias.shards[key]; if (!descriptor) continue;
      const index = await assetJson<Record<string,string[]>>(assets, origin, descriptor, need.signal);
      for (const phrase of values) if (index[phrase]?.length) aliases.set(phrase, new Set(index[phrase]));
    }
    const atoms = planAtoms(need.plan), ids = new Set(atoms.flatMap((atom) => [...entityIds(atom.subject), ...entityIds(atom.object)]));
    for (const phrase of phrases) for (const entity of need.store.resolve(phrase)) ids.add(entity.id);
    const entityMatches = new Set<string>();
    const entityBuckets = new Map<string,string[]>();
    for (const id of ids) { const key = await bucket(id), values = entityBuckets.get(key) ?? []; values.push(id); entityBuckets.set(key, values); }
    for (const [key, values] of entityBuckets) {
      const descriptor = catalog.indexes.entity.shards[key]; if (!descriptor) continue;
      const index = await assetJson<Record<string,string[]>>(assets, origin, descriptor, need.signal);
      for (const id of values) for (const pack of index[id] ?? []) entityMatches.add(pack);
    }
    const relationIndex = await assetJson<Record<string,string[]>>(assets, origin, catalog.indexes.relation, need.signal);
    const requestedRelations = new Set([...atoms.map((atom) => atom.relation), ...phrases]);
    const relationMatches = new Set<string>();
    for (const relation of requestedRelations) for (const pack of relationIndex[relation] ?? []) relationMatches.add(pack);
    const candidates = rankDataPacks(catalog, aliases, entityMatches, relationMatches, loaded);
    if (!candidates.length) return undefined;
    const selected: string[] = [];
    let bytes = 0, propositions = 0;
    for (const id of candidates) {
      const descriptor = catalog.packs[id];
      if (selected.length >= catalog.budgets.maxPacksPerRequest || loadedBytes + bytes + descriptor.decodedSizeBytes > catalog.budgets.maxDecodedBytesPerRequest || loadedPropositions + propositions + descriptor.propositions > catalog.budgets.maxPropositionsPerRequest) continue;
      selected.push(id); bytes += descriptor.decodedSizeBytes; propositions += descriptor.propositions;
    }
    if (!selected.length) return { coverage:{candidateShards:candidates.length,loadedShards:loaded.size,excludedShards:candidates.length,complete:false,missing:candidates,loadedIds:[...loaded],candidateBytes:candidates.reduce((sum,id)=>sum+catalog.packs[id].decodedSizeBytes,0),loadedBytes,truncationReason:'dv15-pack-budget'} };
    const packs: DataPack[] = [];
    for (const id of selected) packs.push(await assetJson<DataPack>(assets, origin, catalog.packs[id], need.signal));
    const store = installDataPacks(need.store, packs);
    selected.forEach((id) => loaded.add(id)); loadedBytes += bytes; loadedPropositions += propositions; activeStore = store;
    const missing = candidates.filter((id) => !selected.includes(id));
    return { store, coverage:{candidateShards:candidates.length,loadedShards:loaded.size,excludedShards:missing.length,complete:missing.length===0,missing,loadedIds:[...loaded],candidateBytes:candidates.reduce((sum,id)=>sum+catalog.packs[id].decodedSizeBytes,0),loadedBytes,truncationReason:missing.length?'dv15-pack-budget':undefined} };
  };
}

