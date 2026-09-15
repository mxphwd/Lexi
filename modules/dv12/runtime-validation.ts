import type { ImportedKnowledgePackage } from './types';
import type { LexiReply } from '../../lib/lexi/types';
import type { ClientState } from '../../worker/dv12-handler';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max = 12000): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function exact(value: Record<string, unknown>, fields: readonly string[], code: string) {
  if (Object.keys(value).some((key) => !fields.includes(key))) throw new Error(code);
}

export function validateHttpRequest(value: unknown): { version: 12; input: string; state?: unknown } {
  if (!object(value)) throw new Error('INVALID_REQUEST');
  exact(value, ['version', 'input', 'state'], 'UNKNOWN_REQUEST_FIELD');
  if (value.version !== 12 || !string(value.input, 12000) || !value.input.trim()) throw new Error('INVALID_REQUEST');
  return { version: 12, input: value.input, state: value.state };
}

export function validateImportedKnowledgePackage(value: unknown): ImportedKnowledgePackage {
  if (!object(value)) throw new Error('INVALID_PACKAGE');
  exact(value, ['manifest', 'entities', 'propositions', 'schemas', 'senses', 'relationAliases', 'ruleBindings'], 'UNKNOWN_PACKAGE_FIELD');
  if (!object(value.manifest) || !Array.isArray(value.entities) || !Array.isArray(value.propositions)) throw new Error('INVALID_PACKAGE');
  exact(value.manifest, ['schemaVersion', 'packageId', 'version', 'minimumRuntime', 'contentHash', 'generatedAt', 'dependencies', 'counts', 'capabilities'], 'UNKNOWN_PACKAGE_MANIFEST_FIELD');
  if (value.manifest.schemaVersion !== 1 || !string(value.manifest.minimumRuntime, 32) || !Array.isArray(value.manifest.dependencies) || value.entities.length > 100000 || value.propositions.length > 100000) throw new Error('INVALID_PACKAGE_MANIFEST');
  for (const dependency of value.manifest.dependencies) {
    if (!object(dependency)) throw new Error('INVALID_PACKAGE_DEPENDENCY');
    exact(dependency, ['packageId', 'versionRange'], 'UNKNOWN_PACKAGE_DEPENDENCY_FIELD');
    if (!string(dependency.packageId, 256) || !string(dependency.versionRange, 64)) throw new Error('INVALID_PACKAGE_DEPENDENCY');
  }
  const entityIds = new Set<string>();
  for (const entity of value.entities) {
    if (!object(entity)) throw new Error('INVALID_PACKAGE_ENTITY');
    exact(entity, ['id', 'canonicalName', 'aliases', 'kind', 'senseIds'], 'UNKNOWN_PACKAGE_ENTITY_FIELD');
    if (!string(entity.id, 256) || !string(entity.canonicalName, 512) || !string(entity.kind, 128) || !Array.isArray(entity.aliases) || entity.aliases.length > 256 || entity.aliases.some((alias) => !string(alias, 512))) throw new Error('INVALID_PACKAGE_ENTITY');
    if (entityIds.has(entity.id)) throw new Error('DUPLICATE_PACKAGE_ENTITY'); entityIds.add(entity.id);
  }
  const propositionIds = new Set<string>();
  for (const proposition of value.propositions) {
    if (!object(proposition)) throw new Error('INVALID_PACKAGE_PROPOSITION');
    exact(proposition, ['id', 'subjectId', 'relation', 'object', 'qualifiers', 'polarity', 'provenance'], 'UNKNOWN_PACKAGE_PROPOSITION_FIELD');
    if (!string(proposition.id, 512) || !string(proposition.subjectId, 256) || !string(proposition.relation, 256) || !['positive', 'negative'].includes(String(proposition.polarity)) || !object(proposition.object) || proposition.object.kind !== 'entity' || !string(proposition.object.entityId, 256) || !Array.isArray(proposition.provenance) || !proposition.provenance.length || proposition.provenance.length > 64) throw new Error('INVALID_PACKAGE_PROPOSITION');
    if (propositionIds.has(proposition.id)) throw new Error('DUPLICATE_PACKAGE_PROPOSITION'); propositionIds.add(proposition.id);
    for (const source of proposition.provenance) {
      if (!object(source)) throw new Error('INVALID_PACKAGE_PROVENANCE');
      exact(source, ['sourceId','sourceLocation','extractionMethod','reviewStatus','confidence','createdAt','license','disputeStatus'], 'UNKNOWN_PACKAGE_PROVENANCE_FIELD');
      if (!string(source.sourceId, 512) || !string(source.sourceLocation, 2048) || !string(source.extractionMethod, 512) || !string(source.reviewStatus, 128) || !finite(source.confidence) || source.confidence < 0 || source.confidence > 1 || !string(source.createdAt, 64) || !string(source.disputeStatus, 128)) throw new Error('INVALID_PACKAGE_PROVENANCE');
    }
  }
  return value as unknown as ImportedKnowledgePackage;
}

export function validateHttpResponse(value: unknown): {version:12;reply:LexiReply;state:ClientState;coverage?:unknown} {
  if(!object(value))throw new Error('INVALID_RESPONSE');
  exact(value,['version','reply','state','coverage'],'UNKNOWN_RESPONSE_FIELD');
  if(value.version!==12||!object(value.reply)||!object(value.state))throw new Error('INVALID_RESPONSE');
  exact(value.reply,['text','trace'],'UNKNOWN_REPLY_FIELD');
  if(typeof value.reply.text!=='string'||value.reply.text.length>100000||!object(value.reply.trace))throw new Error('INVALID_REPLY');
  const trace=value.reply.trace;
  if(typeof trace.normalizedInput!=='string'||typeof trace.interpretedIntent!=='string'||typeof trace.selectedStructure!=='string'||!Array.isArray(trace.matchedExampleIds)||!Array.isArray(trace.matchedTerms)||!['supported','contradicted','conflict','unknown','insufficient','ambiguous','partial','canceled','error'].includes(String(trace.executionStatus)))throw new Error('INVALID_REPLY_TRACE');
  const state=value.state;
  for(const key of ['revision','nextTurn'])if(!Number.isSafeInteger(state[key]))throw new Error('INVALID_RESPONSE_STATE');
  for(const key of ['memories','topics','answerEntities'])if(!Array.isArray(state[key]))throw new Error('INVALID_RESPONSE_STATE');
  if((state.memories as unknown[]).length>128||(state.topics as unknown[]).length>12||(state.answerEntities as unknown[]).length>100)throw new Error('RESPONSE_STATE_BUDGET');
  return value as unknown as {version:12;reply:LexiReply;state:ClientState;coverage?:unknown};
}
