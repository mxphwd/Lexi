/** DV12-compatible wire and execution contracts used by the active DV14 engine. */
import type { SemanticClause } from './semantic-ir';
import type { ConfidenceFeatures } from './confidence';
export type Status = 'supported' | 'contradicted' | 'conflict' | 'unknown' | 'insufficient' | 'ambiguous' | 'partial' | 'canceled' | 'error';
export type Value =
  | { kind: 'entity'; id: string }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number; unit?: string; uncertainty?: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'list'; values: Value[]; ordered: boolean };
export type Entity = { id: string; name: string; aliases: string[]; type: string; domain?: string };
export type Source = { id: string; location: string; method: string; review: 'seed' | 'source-attested' | 'reviewed' | 'derived' | 'user'; license: string; snapshot?: string; disputed?: boolean; confidence?:number; createdAt?:string; disputeStatus?:string };
export type ConditionExpression =
  | {kind:'proposition';atom:Atom}
  | {kind:'comparison';filter:Filter}
  | {kind:'and'|'or';conditions:ConditionExpression[]}
  | {kind:'not';condition:ConditionExpression};
export type Fact = { id: string; subject: string; relation: string; object: Value; negative?: boolean; scope?: string; condition?: string|ConditionExpression; from?: string; to?: string; source: Source; sources?:Source[]; premises?: string[]; supersedes?:string[]; supersededBy?:string[] };
export type Relation = { id: string; aliases: string[]; domain: string[]; range: Value['kind'][]; objectTypes?:string[]; temporal?:'stable'|'changing'; inverse?: string; symmetric?: boolean; transitive?: boolean; inherited?: boolean; functional?: boolean; dimension?: string; frame?: string; world: 'open' | 'closed' };
export type Term = Value | { kind: 'variable'; name: string } | { kind: 'mention'; text: string; role: 'subject' | 'object'; candidates: string[] };
export type Atom = { subject: Term; relation: string; object: Term; negative?: boolean; optional?: boolean; scope?: string; from?: string; to?: string };
export type Rule={id:string;premises:Atom[];conclusion:Atom;source:Source};
export type LanguageFrame={id:string;template:string;relation:string;inverse?:boolean};
export type DialogueFrame={utterance:string;action:'proof'|'repeat'|'shorter'|'simpler'|'more'};
export type EventRole='agent'|'patient'|'theme'|'recipient'|'source'|'destination'|'location'|'instrument'|'cause'|'manner';
export type EventRecord={id:string;type:string;roles:Partial<Record<EventRole,Value[]>>;from?:string;to?:string;condition?:ConditionExpression;source:Source};
export type ProcedureRecord={id:string;name:string;aliases:string[];prerequisites:string[];materials:string[];steps:Array<{id:string;action:string;condition?:ConditionExpression;hazards?:string[];completion?:string}>;applicability:string[];source:Source};
export type CompletenessCertificate={id:string;dataset:string;predicate:string;restriction:string;snapshot:string;sourceBoundary:string;source:Source};
export type Filter = { left: Term; op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'member'; right: Term };
export type Select = { kind: 'query'; atoms: Atom[]; filters: Filter[]; answer: string; shape: 'value' | 'list' | 'boolean' | 'explanation' | 'procedure'; order?: { variable: string; direction: 1 | -1 }; offset?: number; limit?: number; aggregate?: { op: 'count' | 'sum' | 'mean' | 'min' | 'max'; variable: string }; quantifier?: { kind: 'all' | 'any' | 'none' | 'most' | 'exact' | 'minimum' | 'maximum'; count?: number }; universeComplete?: boolean; completenessCertificate?:string };
export type Plan = Select
  | {kind:'inventory';steps:Array<{op:'set'|'gain'|'loss'|'transfer';owner:string;item:string;value:number;to?:string}>;owner:string;owners?:string[];item:string}
  | { kind:'logic'; premises:Array<{subject:string;relation:'subset'|'disjoint';object:string}>; conclusion:{subject:string;relation:'subset'|'disjoint';object:string} }
  | { kind: 'calculate'; expression: string }
  | { kind: 'convert'; value: number; from: string; to: string }
  | { kind: 'compare'; subjects: Term[]; relation: string; preference?:'greater'|'lesser'; mode: 'qualitative' | 'difference' | 'ratio' | 'percentage' | 'attributes' }
  | { kind: 'memory'; action: 'set' | 'add' | 'recall' | 'delete' | 'clear'; field?: string; value?: string }
  | { kind: 'social'; act: 'greeting' | 'thanks' | 'farewell' | 'identity' | 'age' | 'help' | 'concern' | 'apology' | 'permission' }
  | { kind: 'followup'; action: 'proof' | 'repeat' | 'shorter' | 'simpler' | 'more' }
  | { kind: 'lexical'; term: string; domain?: string; senseId?:string }
  | { kind: 'unknown'; reason: string; slot?: string; category?: string };
export type Alternative = { plan: Plan; grammar: string; score: number };
export type Clause = { id: string; text: string; start: number; end: number; alternatives: Alternative[]; semantic?: SemanticClause; style: { excludedWords: string[]; sentences?: number; bullets?: boolean } };
export type Request = { version: 12; original: string; clauses: Clause[]; fastPath?: 'inert-terminal-punctuation' };
export type Proof = { id: string; rule: string; premises: string[]; bindings: Record<string, Value>; constraints: string[] };
export type Row = { bindings: Record<string, Value>; facts: Fact[]; proof: Proof[] };
export type AnswerClaim = { text: string; factIds: string[]; proofIds: string[]; verified?: boolean; answerRole?: 'value'|'verdict'|'qualification'|'provenance'|'procedure-step'; subjectIds?: string[]; relations?: string[]; polarity?: 'positive'|'negative'|'mixed'; qualifiers?: string[]; sourceLimitations?: string[] };
export type Result = { choices?:Choice[]; status: Status; values: Value[]; facts: Fact[]; proof: Proof[]; text: string; code?: string; missing?: string[]; confidence: number | null; confidenceKind: 'unavailable' | 'held-out'; confidenceFeatures?: ConfidenceFeatures; coverage?: { matched: number; unknown: number; conflict?: number; complete: boolean }; selectedPlan: Plan; claims: AnswerClaim[] };
export type Memory = { id: string; field: string; value: string; turn: number };
export type Choice={id:string;label:string};
export type DiscourseState={mentions:Array<{entityId:string;role:'subject'|'object'|'answer';turn:number;focus:number}>;activePlan?:Plan;activePropositionIds:string[];comparisonSet:string[];unresolvedSlots:string[];listCursor?:{plan:Select;offset:number};goals:Array<{id:string;kind:string;status:'open'|'resolved'|'abandoned';turn:number}>};
export type State = { version: 12; revision: number; nextTurn: number; memories: Memory[]; topics: string[]; answerEntities: string[]; discourse:DiscourseState; pending?: { clause: string; slot: string; choices?:Choice[]; plan?:Plan }; previous?: { request: string; results: Result[] }; history: Array<{ turn: number; input: string; output: string }> };
export type Coverage = { candidateShards: number; loadedShards: number; excludedShards: number; complete: boolean; missing: string[]; loadedIds: string[]; candidateBytes?: number; loadedBytes?: number; unresolvedFrontiers?: string[]; missingIndexes?: string[]; truncationReason?: string };
export type Execution = { request: Request; results: Result[]; state: State; status: Status; stages: Array<{ stage: string; code: string; detail: string; milliseconds: number }>; coverage?: Coverage; liveIndex?:{propositions:number;entities:number;requestBytes:number;loadedShards:number} };
export type Options = { signal?: AbortSignal; now?: string; maxRows?: number; maxDepth?: number; maxMilliseconds?: number };
/** Minimal source-package contract consumed by the active DV12/DV13 loader. */
export type ImportedKnowledgePackage = {
  manifest: {
    schemaVersion: 1;
    minimumRuntime: string;
    dependencies: Array<{ packageId: string; versionRange: string }>;
  };
  entities: Array<{ id: string; canonicalName: string; aliases: string[]; kind: string }>;
  propositions: Array<{
    id: string;
    subjectId: string;
    relation: string;
    object: { kind: 'entity'; entityId: string };
    polarity: 'positive' | 'negative';
    provenance: Array<{
      sourceId: string;
      sourceLocation: string;
      extractionMethod: string;
      reviewStatus: string;
      confidence: number;
      createdAt: string;
      license?: string;
      disputeStatus: string;
    }>;
  }>;
};
export const variable = (name: string): Term => ({ kind: 'variable', name });
export const entity = (id: string): Value => ({ kind: 'entity', id });
export const literal = (value: string): Value => ({ kind: 'text', value });
export function emptyState(): State { return { version: 12, revision: 0, nextTurn: 1, memories: [], topics: [], answerEntities: [], discourse:{mentions:[],activePropositionIds:[],comparisonSet:[],unresolvedSlots:[],goals:[]}, history: [] }; }
export function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError'); }
