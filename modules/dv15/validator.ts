import { canonicalIdentity } from '../dv12/identity';
import { Store, normalize } from '../dv12/store';
import type { Entity, Fact, Relation } from '../dv12/types';
import type { DataPack, DataPackTier } from './types';

const tiers = new Set<DataPackTier>(['basic', 'advanced']);
const idPattern = /^alphaine\.lexi\.dv15\.(?:basic|advanced)\.[a-z0-9-]+\.\d{3}$/;

function exact(value: object, fields: readonly string[], code: string) {
  if (Object.keys(value).some((key) => !fields.includes(key))) throw new Error(code);
}

function validateRelation(relation: Relation) {
  exact(relation, ['id','aliases','domain','range','objectTypes','temporal','inverse','symmetric','transitive','inherited','functional','dimension','frame','world'], 'DV15_UNKNOWN_RELATION_FIELD');
  if (!relation.id || !relation.aliases.length || relation.aliases.some((alias) => !alias || alias !== normalize(alias)) || !relation.range.length || relation.range.some((kind) => kind !== 'entity') || !['open','closed'].includes(relation.world)) throw new Error('DV15_INVALID_RELATION');
}

function validateEntity(entity: Entity) {
  exact(entity, ['id','name','aliases','type','domain'], 'DV15_UNKNOWN_ENTITY_FIELD');
  if (!entity.id || !entity.name || !entity.type || entity.name.length > 512 || entity.aliases.length > 32 || entity.aliases.some((alias) => !alias || alias.length > 512)) throw new Error('DV15_INVALID_ENTITY');
}

function validateFact(fact: Fact) {
  exact(fact, ['id','subject','relation','object','negative','scope','condition','from','to','source','sources','premises','supersedes','supersededBy'], 'DV15_UNKNOWN_FACT_FIELD');
  if (!fact.id || !fact.subject || !fact.relation || fact.object.kind !== 'entity' || !fact.source?.id || !fact.source.location || !fact.source.method || !fact.source.license || fact.source.review !== 'source-attested') throw new Error('DV15_INVALID_FACT');
  if (fact.sources && (!fact.sources.length || fact.sources.some((source) => !source.id || !source.location || !source.license))) throw new Error('DV15_INVALID_PROVENANCE');
}

export function validateDataPack(value: unknown): DataPack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('DV15_INVALID_PACK');
  const pack = value as DataPack;
  exact(pack, ['manifest','relations','entities','facts'], 'DV15_UNKNOWN_PACK_FIELD');
  if (!pack.manifest || !Array.isArray(pack.relations) || !Array.isArray(pack.entities) || !Array.isArray(pack.facts)) throw new Error('DV15_INVALID_PACK');
  exact(pack.manifest, ['id','version','tier','category','runtime','sourceSnapshot','propositionCount','entityCount','relationCount'], 'DV15_UNKNOWN_MANIFEST_FIELD');
  const manifest = pack.manifest;
  if (!idPattern.test(manifest.id) || manifest.version !== '15.0.0' || !tiers.has(manifest.tier) || !/^[a-z0-9-]+$/.test(manifest.category) || manifest.runtime?.major !== 12 || manifest.runtime.schema !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.sourceSnapshot)) throw new Error('DV15_INVALID_MANIFEST');
  if (pack.facts.length < 100 || pack.facts.length > 256 || pack.entities.length > 1024 || pack.relations.length > 64 || manifest.propositionCount !== pack.facts.length || manifest.entityCount !== pack.entities.length || manifest.relationCount !== pack.relations.length) throw new Error('DV15_COUNT_MISMATCH');
  const relations = new Set<string>(), entities = new Set<string>(), facts = new Set<string>();
  for (const relation of pack.relations) { validateRelation(relation); if (relations.has(relation.id)) throw new Error('DV15_DUPLICATE_RELATION'); relations.add(relation.id); }
  for (const entity of pack.entities) { validateEntity(entity); if (entities.has(entity.id)) throw new Error('DV15_DUPLICATE_ENTITY'); entities.add(entity.id); }
  for (const fact of pack.facts) {
    validateFact(fact);
    if (facts.has(fact.id)) throw new Error('DV15_DUPLICATE_FACT'); facts.add(fact.id);
    if (!entities.has(fact.subject) || fact.object.kind !== 'entity' || !entities.has(fact.object.id) || !relations.has(fact.relation)) throw new Error('DV15_REFERENTIAL_INTEGRITY');
  }
  return pack;
}

/** Install a validated pack as a request-local overlay. External identities are
 * canonicalized only when DV14 has an explicit reviewed mapping. */
export function installDataPacks(base: Store, values: unknown[]): Store {
  const packs = values.map(validateDataPack);
  const overlay = new Store(base);
  for (const pack of packs) {
    for (const relation of pack.relations) {
      const previous = overlay.schema(relation.id);
      if (!previous) overlay.addSchema(relation);
      else if (previous.world !== relation.world || relation.range.some((kind) => !previous.range.includes(kind))) throw new Error('DV15_RELATION_CONFLICT');
    }
    for (const entity of pack.entities) {
      const id = canonicalIdentity(entity.id, overlay);
      if (id !== entity.id && overlay.entity(id)) continue;
      const previous = overlay.entity(id);
      if (!previous) overlay.addEntity({ ...entity, id });
      else if (previous.name === entity.name && previous.type === entity.type) overlay.addEntity({ ...entity, id, aliases: [...new Set([...previous.aliases, ...entity.aliases])] });
    }
  }
  for (const pack of packs) for (const fact of pack.facts) {
    const subject = canonicalIdentity(fact.subject, overlay);
    const object = fact.object.kind === 'entity' ? { kind: 'entity' as const, id: canonicalIdentity(fact.object.id, overlay) } : fact.object;
    if (!overlay.fact(fact.id)) overlay.addFact({ ...fact, subject, object });
  }
  return overlay;
}

