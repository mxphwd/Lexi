import identityPackage from '../../data/dv14/canonical-identities.json';
import type { Store } from './store';

type Mapping = { externalId: string; canonicalId: string; criterion: string; reviewer: string; confidence: number };

function validate(): ReadonlyMap<string, Mapping> {
  if (identityPackage.version !== 1 || identityPackage.runtime !== 'DV14' || !/^\d{4}-\d{2}-\d{2}$/.test(identityPackage.sourceSnapshot)) throw new Error('IDENTITY_PACKAGE_VERSION');
  const result = new Map<string, Mapping>();
  for (const mapping of identityPackage.mappings) {
    if (!mapping.externalId.startsWith('wd:') || !mapping.canonicalId || !mapping.criterion || !mapping.reviewer || mapping.confidence < 0 || mapping.confidence > 1) throw new Error('INVALID_IDENTITY_MAPPING');
    if (result.has(mapping.externalId)) throw new Error('DUPLICATE_IDENTITY_MAPPING');
    result.set(mapping.externalId, Object.freeze({ ...mapping }));
  }
  return result;
}

export const canonicalIdentities = validate();

export function canonicalIdentity(externalId: string, store: Store): string {
  const mapping = canonicalIdentities.get(externalId);
  return mapping && store.entity(mapping.canonicalId) ? mapping.canonicalId : externalId;
}
