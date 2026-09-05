import { lexiKnowledgeGraph } from '../knowledge-graph/graph';
import { relations } from './schema';
import { canonical } from './numbers';
import { installFoundations } from './foundations';
import { validDate } from './temporal';
import type { Atom, Entity, Fact, Relation, Value, Rule, LanguageFrame, DialogueFrame } from './types';

export const normalize = (s: string) => s.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
export const valueKey = (v: Value): string => v.kind === 'list' ? `${v.ordered ? 'list' : 'set'}:${v.values.map(valueKey).join('|')}` : JSON.stringify(v);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
}
function validateValue(v: Value, hasEntity: (id: string) => boolean, depth = 0): void {
  if (!v || depth > 8) throw new Error('INVALID_VALUE_DEPTH');
  switch (v.kind) {
    case 'entity': if (!hasEntity(v.id)) throw new Error(`MISSING_ENTITY:${v.id}`); break;
    case 'number': if (!Number.isFinite(v.value) || v.uncertainty !== undefined && (!Number.isFinite(v.uncertainty) || v.uncertainty < 0)) throw new Error('INVALID_NUMBER'); if (v.unit) canonical(v.value, v.unit); break;
    case 'text': if (typeof v.value !== 'string' || v.value.length > 12000) throw new Error('INVALID_TEXT'); break;
    case 'boolean': if (typeof v.value !== 'boolean') throw new Error('INVALID_BOOLEAN'); break;
    case 'list': if (!Array.isArray(v.values) || v.values.length > 1000 || typeof v.ordered !== 'boolean') throw new Error('INVALID_LIST'); v.values.forEach(x => validateValue(x, hasEntity, depth + 1)); break;
    default: throw new Error('INVALID_VALUE_KIND');
  }
}
/** Immutable base + disposable request overlay; no browser-global package accumulation. */
export class Store {
  private entities = new Map<string, Entity>();
  private aliases = new Map<string, Set<string>>();
  private facts = new Map<string, Fact>();
  private subject = new Map<string, Set<string>>();
  private predicate = new Map<string, Set<string>>();
  private object = new Map<string, Set<string>>();
  private subjectPredicate = new Map<string, Set<string>>();
  private schemas = new Map<string, Relation>();
  private rules=new Map<string,Rule>();
  private languageFrames=new Map<string,LanguageFrame>();
  private dialogueFrames=new Map<string,DialogueFrame>();
  private bytes = 0;
  constructor(readonly base?: Store, readonly maxBytes = 12 * 1024 * 1024) { if (!base) relations().forEach(r => this.addSchema(r)); }
  addSchema(r: Relation) { if (!r.id || !r.world || !r.range.length) throw new Error('INVALID_SCHEMA'); this.schemas.set(r.id, freeze(structuredClone({...r,aliases:r.aliases.map(normalize)}))); }
  schema(id: string): Relation | undefined { return this.schemas.get(id) ?? this.base?.schema(id); }
  allSchemas(): Relation[] { return [...new Map([...(this.base?.allSchemas() ?? []), ...this.schemas.values()].map(r => [r.id, r])).values()]; }
  addRule(rule:Rule){
    if(!rule.id||!rule.premises.length||rule.premises.length>4||!this.schema(rule.conclusion.relation))throw new Error('INVALID_RULE');
    const bindings=new Set(rule.premises.flatMap(p=>[p.subject,p.object]).flatMap(t=>t.kind==='variable'?[t.name]:[]));
    for(const t of [rule.conclusion.subject,rule.conclusion.object])if(t.kind==='variable'&&!bindings.has(t.name))throw new Error('UNBOUND_RULE_CONCLUSION');
    if(rule.premises.some(p=>!this.schema(p.relation)||p.negative||p.optional))throw new Error('UNSUPPORTED_RULE_PREMISE');
    if(!rule.source?.id||!rule.source.location||!rule.source.license||!rule.source.review||!rule.source.method)throw new Error('MISSING_RULE_PROVENANCE');
    if(this.rules.has(rule.id))throw new Error('DUPLICATE_RULE');
    this.reserve(JSON.stringify(rule).length*2);this.rules.set(rule.id,freeze(structuredClone(rule)));
  }
  rulesFor(relation:string):Rule[]{return [...(this.base?.rulesFor(relation)??[]),...[...this.rules.values()].filter(r=>r.conclusion.relation===relation)];}
  addLanguageFrame(frame:LanguageFrame){
    if(!frame.id||!this.schema(frame.relation)||frame.template.length>256||(frame.template.match(/\{subject\}/g)?.length??0)!==1||/[{}]/.test(frame.template.replace('{subject}','')))throw new Error('INVALID_LANGUAGE_FRAME');
    this.languageFrames.set(frame.id,freeze({...frame}));
  }
  frames():LanguageFrame[]{return [...(this.base?.frames()??[]),...this.languageFrames.values()];}
  addDialogueFrame(frame:DialogueFrame){if(frame.utterance.length>160||!['proof','repeat','shorter','simpler','more'].includes(frame.action))throw new Error('INVALID_DIALOGUE_FRAME');this.dialogueFrames.set(normalize(frame.utterance),freeze({...frame}));}
  dialogueFrame(input:string):DialogueFrame|undefined{return this.dialogueFrames.get(normalize(input))??this.base?.dialogueFrame(input);}
  addEntity(e: Entity) {
    if (!e.id || !e.name || !Array.isArray(e.aliases) || !e.type) throw new Error('INVALID_ENTITY');
    const previous = this.entity(e.id);
    if (previous && (previous.name !== e.name || previous.type !== e.type)) throw new Error(`ENTITY_CONFLICT:${e.id}`);
    const next = freeze(structuredClone({ ...e, aliases: [...new Set([...(previous?.aliases ?? []), ...e.aliases])] }));
    this.reserve(JSON.stringify(next).length * 2); this.entities.set(e.id, next);
    for (const a of [e.name, ...next.aliases]) { const key = normalize(a).replace(/^(?:the|an?|some) /, ''); const ids = this.aliases.get(key) ?? new Set(); ids.add(e.id); this.aliases.set(key, ids); }
  }
  requestBytes():number{return this.bytes+(this.base?.base?this.base.requestBytes():0);}
  private reserve(bytes: number) { if (this.requestBytes() + bytes > this.maxBytes) throw new Error('STORE_MEMORY_BUDGET'); this.bytes += bytes; }
  entity(id: string): Entity | undefined { return this.entities.get(id) ?? this.base?.entity(id); }
  allEntities(): Entity[] { return [...new Map([...(this.base?.allEntities() ?? []), ...this.entities.values()].map(e => [e.id,e])).values()]; }
  resolve(text: string): Entity[] {
    const clean = normalize(text).replace(/^(?:the|an?|some) /, '').replace(/[?.!]+$/, '');
    const ids = new Set([...(this.aliases.get(clean) ?? []), ...(this.base?.resolve(clean).map(e => e.id) ?? [])]);
    // Inflection is accepted only if the resulting lemma is an indexed word.
    if (!ids.size && /s$/.test(clean) && !/(?:ss|us|is)$/.test(clean)) {
      for (const candidate of [clean.slice(0,-1), clean.endsWith('ies') ? `${clean.slice(0,-3)}y` : '']) if (candidate) { const known = this.aliases.get(candidate); known?.forEach(id => ids.add(id)); this.base?.resolve(candidate).forEach(e => ids.add(e.id)); }
    }
    if (!ids.size) { const irregular: Record<string,string> = { people:'human', humans:'human', mice:'mouse', children:'child', men:'man', women:'woman' }; if (irregular[clean]) return this.resolve(irregular[clean]); }
    return [...ids].map(id => this.entity(id)!).filter(Boolean).sort((a,b) => a.id.localeCompare(b.id));
  }
  addFact(f: Fact) {
    if (!f.id || this.fact(f.id)) throw new Error(`DUPLICATE_FACT:${f.id}`);
    if (!this.entity(f.subject)) throw new Error(`MISSING_SUBJECT:${f.subject}`);
    const schema = this.schema(f.relation);
    if (!schema || !schema.range.includes(f.object.kind)) throw new Error(`RELATION_TYPE:${f.relation}`);
    if (schema.domain.length && !schema.domain.includes(this.entity(f.subject)!.type)) throw new Error('SUBJECT_DOMAIN');
    validateValue(f.object, id => !!this.entity(id));
    if(f.object.kind==='entity'&&schema.objectTypes?.length&&!schema.objectTypes.includes(this.entity(f.object.id)!.type))throw new Error('OBJECT_DOMAIN');
    if (!f.source?.id || !f.source.location || !f.source.method || !f.source.license || !f.source.review) throw new Error('MISSING_PROVENANCE');
    for (const date of [f.from, f.to, f.source.snapshot]) if (date && !validDate(date)) throw new Error('INVALID_DATE');
    if (f.from && f.to && f.from > f.to) throw new Error('INVALID_INTERVAL');
    const stored = freeze(structuredClone(f)); this.reserve(JSON.stringify(stored).length * 2); this.facts.set(f.id, stored);
    const add = (map: Map<string,Set<string>>, key: string) => { const ids = map.get(key) ?? new Set(); ids.add(f.id); map.set(key,ids); };
    add(this.subject, f.subject); add(this.predicate, f.relation); add(this.object, valueKey(f.object)); add(this.subjectPredicate, `${f.subject}\0${f.relation}`);
  }
  fact(id: string): Fact | undefined { return this.facts.get(id) ?? this.base?.fact(id); }
  find(subject?: string, relation?: string, object?: Value): Fact[] {
    const ids = subject && relation ? this.subjectPredicate.get(`${subject}\0${relation}`) : subject ? this.subject.get(subject) : relation ? this.predicate.get(relation) : object ? this.object.get(valueKey(object)) : this.facts.keys();
    return [...(this.base?.find(subject,relation,object) ?? []), ...[...(ids ?? [])].map(id => this.facts.get(id)!).filter(f => (!relation || f.relation === relation) && (!object || valueKey(f.object) === valueKey(object)))];
  }
  loadedFactIds():string[]{return [...(this.base?.loadedFactIds()??[]),...this.facts.keys()];}
  stats(): {overlayBytes:number; facts:number; entities:number} { return { overlayBytes: this.bytes, facts: this.facts.size + (this.base?.stats().facts ?? 0), entities: this.allEntities().length }; }
  compatible(f: Fact, atom: Atom, now: string) {
    if (f.source.disputed) return false;
    if (atom.scope && normalize(f.scope ?? '') !== normalize(atom.scope)) return false;
    if (f.condition) return false; // Opaque legacy conditions cannot be silently assumed true.
    const from = atom.from ?? now, to = atom.to ?? from;
    if((atom.from||atom.to)&&!f.from&&!f.to&&this.schema(f.relation)?.temporal!=='stable')return false;
    if(this.schema(f.relation)?.temporal==='changing'&&(!f.from||!f.to))return false;
    if (f.from && f.from > from || f.to && f.to < to) return false;
    return true;
  }
}
let seedStore: Store | undefined;
export function coreStore(): Store {
  if (seedStore) return seedStore;
  const store = new Store(undefined, 20 * 1024 * 1024);
  for (const e of lexiKnowledgeGraph.allEntities()) store.addEntity({ id:e.id, name:e.name, aliases:e.aliases, type:e.kind });
  const edges = new Set(['capital','country','continent','is_a','part_of','has_part','location','creator','author','requires']);
  for (const p of lexiKnowledgeGraph.allPropositions()) {
    const kind:Value['kind']=p.object.kind==='list'?'list':p.object.kind;
    const existing=store.schema(p.predicate);
    if(!existing)store.addSchema({id:p.predicate,aliases:[p.predicate.replaceAll('_',' ')],domain:[],range:[kind,'text'],world:'open'});
    else if(!existing.range.includes(kind))store.addSchema({...existing,range:[...existing.range,kind]});
  }
  for (const p of lexiKnowledgeGraph.allPropositions()) {
    const v = p.object;
    let object: Value = v.kind === 'entity' ? { kind:'entity', id:v.entityId } : v.kind === 'list' ? { kind:'list', values:v.values.map(value => ({ kind:'text', value })), ordered:false } : { ...v };
    if (edges.has(p.predicate) && object.kind === 'text') { const matches = store.resolve(object.value); if (matches.length === 1) object = { kind:'entity', id:matches[0].id }; }
    if (!store.schema(p.predicate)) store.addSchema({ id:p.predicate, aliases:[p.predicate.replaceAll('_',' ')], domain:[], range:[object.kind], world:'open' });
    const source: Fact['source'] = { id:p.source, location:`modules/knowledge-graph:${p.id}`, method:'DV12 checked legacy migration', review:p.source === 'derived' ? 'derived' : 'seed', license:'alphaine-project-data', snapshot:'2026-07-31' };
    const f: Fact = { id:`core:${p.id}`, subject:p.subjectId, relation:p.predicate, object, scope:p.qualifiers?.scope, condition:p.qualifiers?.condition, source };
    // Time prose remains a condition until it can be represented without guessing.
    if (p.qualifiers?.time) f.condition = [f.condition, `time: ${p.qualifiers.time}`].filter(Boolean).join('; ');
    const mapped=({invented_by:'inventor',created_by:'creator',written_by:'author',discovered_by:'discoverer',nationality:'citizenship'} as Record<string,string>)[p.predicate];
    if(mapped){
      if(object.kind==='text'){const resolved=store.resolve(object.value);if(resolved.length===1)object={kind:'entity',id:resolved[0].id};}
      store.addFact({...f,id:f.id+':normalized',relation:mapped,object,premises:[f.id]});
    }
    try { store.addFact(f); } catch (error) { if (!(error instanceof Error) || !error.message.startsWith('UNKNOWN_UNIT')) throw error; store.addFact({ ...f, object:{kind:'text',value:v.kind === 'number' ? `${v.value} ${v.unit}` : ''}, condition:'unrecognized measurement unit' }); }
  }
  installFoundations(store);
  seedStore = store; return store;
}
