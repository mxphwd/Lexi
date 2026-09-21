import type { Entity, Fact, Relation } from '../dv12/types';

export type DataPackTier = 'basic' | 'advanced';

export type DataPackManifest = {
  id: string;
  version: '15.0.0';
  tier: DataPackTier;
  category: string;
  runtime: { major: 12; schema: 2 };
  sourceSnapshot: string;
  propositionCount: number;
  entityCount: number;
  relationCount: number;
};

export type DataPack = {
  manifest: DataPackManifest;
  relations: Relation[];
  entities: Entity[];
  facts: Fact[];
};

export type AssetDescriptor = {
  path: string;
  sha256: string;
  sizeBytes: number;
  decodedSha256: string;
  decodedSizeBytes: number;
};

export type DataPackDescriptor = AssetDescriptor & {
  id: string;
  tier: DataPackTier;
  category: string;
  propositions: number;
  entities: number;
  relations: string[];
};

export type DataPackCatalog = {
  version: 15;
  build: string;
  generatedAt: string;
  counts: {
    basicPacks: 550;
    advancedPacks: number;
    packs: number;
    propositions: number;
    entities: number;
    relations: number;
  };
  budgets: { maxPacksPerRequest: number; maxDecodedBytesPerRequest: number; maxPropositionsPerRequest: number };
  packs: Record<string, DataPackDescriptor>;
  indexes: {
    alias: { strategy: 'sha256-prefix'; entries: number; shards: Record<string, AssetDescriptor> };
    entity: { strategy: 'sha256-prefix'; entries: number; shards: Record<string, AssetDescriptor> };
    relation: AssetDescriptor;
  };
};

