import type {Plan,Term} from './types';
const operations=new Set(['query','logic','inventory','calculate','convert','compare','memory','social','followup','lexical','unknown']);
function term(t:Term){
  if(!t||typeof t!=='object')throw new Error('INVALID_TERM');
  if(t.kind==='variable'){if(!/^[a-z][a-z0-9_]*$/i.test(t.name))throw new Error('INVALID_VARIABLE');}
  else if(t.kind==='mention'){if(!t.text||!Array.isArray(t.candidates))throw new Error('INVALID_MENTION');}
  else if(t.kind==='entity'){if(!t.id)throw new Error('INVALID_ENTITY_TERM');}
  else if(t.kind==='number'){if(!Number.isFinite(t.value))throw new Error('INVALID_NUMBER');}
  else if(t.kind==='text'){if(typeof t.value!=='string')throw new Error('INVALID_TEXT');}
  else if(t.kind==='boolean'){if(typeof t.value!=='boolean')throw new Error('INVALID_BOOLEAN');}
  else if(t.kind==='list'){if(t.values.length>1000)throw new Error('TERM_LIST_BUDGET');t.values.forEach(term);}
  else throw new Error('UNSUPPORTED_TERM');
}
export function validatePlan(plan:Plan):void{
  if(!plan||!operations.has(plan.kind))throw new Error('UNSUPPORTED_OPERATION');
  if(plan.kind==='query'){
    const fields=new Set(['kind','atoms','filters','answer','shape','order','offset','limit','aggregate','quantifier','universeComplete']);
    if(Object.keys(plan).some(key=>!fields.has(key)))throw new Error('UNSUPPORTED_QUERY_FIELD');
    if(!Array.isArray(plan.atoms)||!plan.atoms.length||plan.atoms.length>12||!Array.isArray(plan.filters)||plan.filters.length>24)throw new Error('QUERY_PLAN_BUDGET');
    if(!['value','list','boolean','explanation','procedure'].includes(plan.shape)||!plan.answer)throw new Error('INVALID_ANSWER_SHAPE');
    for(const atom of plan.atoms){term(atom.subject);term(atom.object);if(typeof atom.relation!=='string'||!atom.relation)throw new Error('INVALID_RELATION');}
    for(const filter of plan.filters){
      term(filter.left);term(filter.right);
      if(!['eq','ne','lt','lte','gt','gte','contains','member'].includes(filter.op))throw new Error('UNSUPPORTED_FILTER');
    }
    if(plan.aggregate&&!['count','sum','mean','min','max'].includes(plan.aggregate.op))throw new Error('UNSUPPORTED_AGGREGATE');
    if(plan.order&&![1,-1].includes(plan.order.direction))throw new Error('UNSUPPORTED_ORDER');
    for(const n of [plan.limit,plan.offset])if(n!==undefined&&(!Number.isSafeInteger(n)||n<0||n>1000))throw new Error('RESULT_COUNT_BUDGET');
    if(plan.quantifier){
      if(!['all','any','none','most','exact','minimum','maximum'].includes(plan.quantifier.kind))throw new Error('UNSUPPORTED_QUANTIFIER');
      if(['exact','minimum','maximum'].includes(plan.quantifier.kind)&&(!Number.isSafeInteger(plan.quantifier.count)||plan.quantifier.count!<0))throw new Error('INVALID_QUANTIFIER_COUNT');
    }
  }
  if(plan.kind==='compare'&&(plan.subjects.length!==2||!['qualitative','difference','ratio','percentage','attributes'].includes(plan.mode)))throw new Error('INVALID_COMPARISON');
}
