import type { Store } from './store';
import { validDate } from './temporal';
import type { Atom, Plan, Term } from './types';

const operations = new Set(['query','logic','inventory','calculate','convert','compare','memory','social','followup','lexical','unknown']);
const exact = (value: object, fields: readonly string[], code: string) => { if (Object.keys(value).some((key) => !fields.includes(key))) throw new Error(code); };

function term(value: Term, store?: Store, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) throw new Error('INVALID_TERM');
  if (value.kind === 'variable') { exact(value, ['kind','name'], 'UNKNOWN_VARIABLE_FIELD'); if (!/^[a-z][a-z0-9_]*$/i.test(value.name)) throw new Error('INVALID_VARIABLE'); }
  else if (value.kind === 'mention') { exact(value, ['kind','text','role','candidates'], 'UNKNOWN_MENTION_FIELD'); if (!value.text || value.text.length > 512 || !['subject','object'].includes(value.role) || !Array.isArray(value.candidates) || value.candidates.length > 64) throw new Error('INVALID_MENTION'); }
  else if (value.kind === 'entity') { exact(value, ['kind','id'], 'UNKNOWN_ENTITY_FIELD'); if (!value.id || value.id.length > 256 || store && !store.entity(value.id)) throw new Error('INVALID_ENTITY_TERM'); }
  else if (value.kind === 'number') { exact(value, ['kind','value','unit','uncertainty'], 'UNKNOWN_NUMBER_FIELD'); if (!Number.isFinite(value.value) || value.uncertainty !== undefined && (!Number.isFinite(value.uncertainty) || value.uncertainty < 0)) throw new Error('INVALID_NUMBER'); }
  else if (value.kind === 'text') { exact(value, ['kind','value'], 'UNKNOWN_TEXT_FIELD'); if (typeof value.value !== 'string' || value.value.length > 12000) throw new Error('INVALID_TEXT'); }
  else if (value.kind === 'boolean') { exact(value, ['kind','value'], 'UNKNOWN_BOOLEAN_FIELD'); if (typeof value.value !== 'boolean') throw new Error('INVALID_BOOLEAN'); }
  else if (value.kind === 'list') { exact(value, ['kind','values','ordered'], 'UNKNOWN_LIST_FIELD'); if (!Array.isArray(value.values) || value.values.length > 1000 || typeof value.ordered !== 'boolean') throw new Error('TERM_LIST_BUDGET'); value.values.forEach((item) => term(item, store, depth + 1)); }
  else throw new Error('UNSUPPORTED_TERM');
}

function atom(value: Atom, store?: Store) {
  exact(value, ['subject','relation','object','negative','optional','scope','from','to'], 'UNKNOWN_ATOM_FIELD');
  term(value.subject, store); term(value.object, store);
  if (!value.relation || value.relation.length > 256 || store && !store.schema(value.relation)) throw new Error('INVALID_RELATION');
  for (const date of [value.from,value.to]) if (date && !validDate(date)) throw new Error('INVALID_TEMPORAL_DATE');
  if (value.from && value.to && value.from > value.to) throw new Error('INVALID_TEMPORAL_RANGE');
}

export function validatePlan(plan: Plan, store?: Store): void {
  if (!plan || !operations.has(plan.kind)) throw new Error('UNSUPPORTED_OPERATION');
  if (plan.kind === 'query') {
    exact(plan, ['kind','atoms','filters','answer','shape','order','offset','limit','aggregate','quantifier','universeComplete','completenessCertificate'], 'UNSUPPORTED_QUERY_FIELD');
    if (!Array.isArray(plan.atoms) || !plan.atoms.length || plan.atoms.length > 24 || !Array.isArray(plan.filters) || plan.filters.length > 48) throw new Error('QUERY_PLAN_BUDGET');
    if (!['value','list','boolean','explanation','procedure'].includes(plan.shape) || !/^[a-z][a-z0-9_]*$/i.test(plan.answer)) throw new Error('INVALID_ANSWER_SHAPE');
    for (const value of plan.atoms) atom(value, store);
    for (const filter of plan.filters) {
      exact(filter, ['left','op','right'], 'UNKNOWN_FILTER_FIELD'); term(filter.left, store); term(filter.right, store);
      if (!['eq','ne','lt','lte','gt','gte','contains','member'].includes(filter.op)) throw new Error('UNSUPPORTED_FILTER');
    }
    if (plan.aggregate) {
      exact(plan.aggregate, ['op','variable'], 'UNKNOWN_AGGREGATE_FIELD');
      if (!['count','sum','mean','min','max'].includes(plan.aggregate.op) || !/^[a-z][a-z0-9_]*$/i.test(plan.aggregate.variable)) throw new Error('UNSUPPORTED_AGGREGATE');
    }
    if (plan.order) { exact(plan.order, ['variable','direction'], 'UNKNOWN_ORDER_FIELD'); if (![1,-1].includes(plan.order.direction)) throw new Error('UNSUPPORTED_ORDER'); }
    for (const n of [plan.limit,plan.offset]) if (n !== undefined && (!Number.isSafeInteger(n) || n < 0 || n > 1000)) throw new Error('RESULT_COUNT_BUDGET');
    if (plan.quantifier) {
      exact(plan.quantifier, ['kind','count'], 'UNKNOWN_QUANTIFIER_FIELD');
      if (!['all','any','none','most','exact','minimum','maximum'].includes(plan.quantifier.kind)) throw new Error('UNSUPPORTED_QUANTIFIER');
      if (['exact','minimum','maximum'].includes(plan.quantifier.kind) && (!Number.isSafeInteger(plan.quantifier.count) || (plan.quantifier.count ?? -1) < 0)) throw new Error('INVALID_QUANTIFIER_COUNT');
      if (plan.atoms.length < 2) throw new Error('QUANTIFIER_REQUIRES_RESTRICTION');
    }
    if(plan.universeComplete){
      const certificate=plan.completenessCertificate&&store?.completeness(plan.completenessCertificate);
      if(!certificate||!plan.atoms.some(atom=>atom.relation===certificate.predicate))throw new Error('COMPLETENESS_CERTIFICATE_REQUIRED');
    }
    const bound = new Set(plan.atoms.flatMap((item) => [item.subject,item.object]).flatMap((item) => item.kind === 'variable' ? [item.name] : []));
    for (const variable of [plan.aggregate?.variable,plan.order?.variable]) if (variable && !bound.has(variable)) throw new Error('UNBOUND_PLAN_VARIABLE');
    if (plan.shape !== 'boolean' && !plan.aggregate && !bound.has(plan.answer)) throw new Error('UNBOUND_ANSWER_VARIABLE');
    return;
  }
  if (plan.kind === 'compare') {
    exact(plan, ['kind','subjects','relation','preference','mode'], 'UNKNOWN_COMPARISON_FIELD');
    if (plan.subjects.length !== 2 || !['qualitative','difference','ratio','percentage','attributes'].includes(plan.mode)) throw new Error('INVALID_COMPARISON');
    plan.subjects.forEach((subject) => term(subject, store));
    if (!plan.relation || store && !store.schema(plan.relation)) throw new Error('INVALID_COMPARISON_RELATION');
    return;
  }
  if (plan.kind === 'calculate') { exact(plan, ['kind','expression'], 'UNKNOWN_CALCULATION_FIELD'); if (!plan.expression || plan.expression.length > 1024) throw new Error('INVALID_CALCULATION'); return; }
  if (plan.kind === 'convert') { exact(plan, ['kind','value','from','to'], 'UNKNOWN_CONVERSION_FIELD'); if (!Number.isFinite(plan.value) || !plan.from || !plan.to) throw new Error('INVALID_CONVERSION'); return; }
  if (plan.kind === 'inventory') { exact(plan, ['kind','steps','owner','owners','item'], 'UNKNOWN_INVENTORY_FIELD'); if (!plan.owner || !plan.item || !Array.isArray(plan.steps) || plan.steps.length > 128 || plan.owners && (!Array.isArray(plan.owners) || !plan.owners.length || plan.owners.length > 32)) throw new Error('INVALID_INVENTORY'); return; }
  if (plan.kind === 'logic') { exact(plan, ['kind','premises','conclusion'], 'UNKNOWN_LOGIC_FIELD'); if (!plan.premises.length || plan.premises.length > 64) throw new Error('INVALID_LOGIC'); return; }
  if (plan.kind === 'memory') { exact(plan, ['kind','action','field','value'], 'UNKNOWN_MEMORY_FIELD'); if (!['set','add','recall','delete','clear'].includes(plan.action)) throw new Error('INVALID_MEMORY_PLAN'); return; }
  if (plan.kind === 'social') { exact(plan, ['kind','act'], 'UNKNOWN_SOCIAL_FIELD'); return; }
  if (plan.kind === 'followup') { exact(plan, ['kind','action'], 'UNKNOWN_FOLLOWUP_FIELD'); return; }
  if (plan.kind === 'lexical') { exact(plan, ['kind','term','domain','senseId'], 'UNKNOWN_LEXICAL_FIELD'); if (!plan.term || plan.term.length > 512) throw new Error('INVALID_LEXICAL_PLAN'); return; }
  exact(plan, ['kind','reason','slot','category'], 'UNKNOWN_UNKNOWN_FIELD');
  if (!plan.reason || plan.reason.length > 1000) throw new Error('INVALID_UNKNOWN_PLAN');
}
