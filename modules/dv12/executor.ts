import { calculate, convert, numericCompare } from './numbers';
import { solveLogic } from './logic';
import { solveInventory } from './word-problems';
import {validatePlan} from './validate-plan';
import { normalize, Store, valueKey } from './store';
import { checkAbort, entity, type Atom, type Fact, type Filter, type Options, type Plan, type Result, type Row, type Select, type State, type Term, type Value } from './types';

export function result(plan:Plan,status:Result['status']='unknown',code?:string):Result {
  return {selectedPlan:plan,status,code,values:[],facts:[],proof:[],text:'',claims:[],confidence:null,confidenceKind:'unavailable'};
}
export function valueText(v:Value,store:Store):string {
  if(v.kind==='entity')return store.entity(v.id)?.name??v.id;
  if(v.kind==='list')return join(v.values.map(x=>valueText(x,store)));
  if(v.kind==='number')return Number(v.value.toPrecision(12)).toLocaleString('en-US',{maximumFractionDigits:10})+(v.uncertainty?' ± '+Number(v.uncertainty.toPrecision(4)):'')+(v.unit?' '+v.unit:'');
  return String(v.value);
}
export function join(values:string[]):string { return values.length<3?values.join(' and '):values.slice(0,-1).join(', ')+', and '+values.at(-1); }
export function equal(a:Value,b:Value):boolean {
  if(a.kind==='number'&&b.kind==='number')return Math.abs(numericCompare(a,b))<=1e-9;
  if(a.kind==='text'&&b.kind==='text')return normalize(a.value)===normalize(b.value);
  return valueKey(a)===valueKey(b);
}
function bound(t:Term,row:Row):Value|undefined { return t.kind==='variable'?row.bindings[t.name]:t.kind==='mention'?undefined:t; }
function bind(t:Term,value:Value,row:Row):boolean {
  if(t.kind==='mention')return false;
  if(t.kind==='variable'){const existing=row.bindings[t.name];if(existing)return equal(existing,value);row.bindings[t.name]=value;return true;}
  return equal(t,value);
}
function checkFilter(f:Filter,row:Row):boolean {
  const a=bound(f.left,row),b=bound(f.right,row);if(!a||!b)return false;
  if(f.op==='eq')return equal(a,b);if(f.op==='ne')return !equal(a,b);
  if(f.op==='member')return b.kind==='list'&&b.values.some(x=>equal(a,x));
  if(f.op==='contains')return a.kind==='text'&&b.kind==='text'&&normalize(a.value).includes(normalize(b.value));
  if(a.kind!=='number'||b.kind!=='number')throw new Error('FILTER_REQUIRES_NUMBERS');
  const d=numericCompare(a,b);return f.op==='gt'?d>0:f.op==='gte'?d>=0:f.op==='lt'?d<0:d<=0;
}
class Budget {
  activeRules=new Set<string>();
  private started=performance.now();private visited=0;
  constructor(private options:Options){}
  allowsDepth(depth:number){return depth<=(this.options.maxDepth??8);}
  tick(){checkAbort(this.options.signal);if(++this.visited>(this.options.maxRows??12000)||performance.now()-this.started>(this.options.maxMilliseconds??1500))throw new Error('REASONING_BUDGET');}
}
function evidence(store:Store,atom:Atom,subject:string|undefined,now:string,budget:Budget,depth=0,path:string[]=[]):Fact[] {
  budget.tick();if(!budget.allowsDepth(depth))throw new Error('PROOF_DEPTH_BUDGET');if(subject&&path.includes(subject))return [];
  const direct=store.find(subject,atom.relation).filter(f=>store.compatible(f,atom,now));
  const schema=store.schema(atom.relation);
  const derived:Fact[]=[];
  for(const rule of store.rulesFor(atom.relation)){
    if(budget.activeRules.has(rule.id))continue;
    const seed:Row={bindings:{},facts:[],proof:[]};
    if(subject&&!bind(rule.conclusion.subject,entity(subject),seed))continue;
    budget.activeRules.add(rule.id);
    try{
      let rows=[seed];
      for(const premise of rule.premises)rows=applyAtom(rows,premise,store,now,budget);
      for(const row of rows){
        const s=bound(rule.conclusion.subject,row),o=bound(rule.conclusion.object,row);
        if(s?.kind!=='entity'||!o)continue;
        const premises=[...new Set(row.facts.flatMap(f=>f.premises??[f.id]))];
        const id='rule:'+rule.id+':'+JSON.stringify([s,o,premises]);
        if(id.length>4096)throw new Error('PROOF_ID_BUDGET');
        derived.push({id,subject:s.id,relation:atom.relation,object:o,negative:rule.conclusion.negative,source:rule.source,premises});
      }
    }finally{budget.activeRules.delete(rule.id);}
  }
  for(const inverse of store.allSchemas().filter(r=>r.inverse===atom.relation||r.id===atom.relation&&r.symmetric)){
    for(const f of store.find(undefined,inverse.id,subject?entity(subject):undefined)){
      budget.tick();if(f.object.kind!=='entity'||!store.compatible(f,atom,now))continue;
      derived.push({...f,id:'inverse:'+f.id,subject:f.object.id,relation:atom.relation,object:entity(f.subject),premises:[f.id]});
    }
  }
  if(subject&&schema?.inverse){
    for(const f of store.find(undefined,schema.inverse,entity(subject)))if(store.compatible(f,atom,now))derived.push({...f,id:'inverse:'+f.id,subject,relation:atom.relation,object:entity(f.subject),premises:[f.id]});
  }
  // Specific evidence, including false and negative evidence, overrides inherited defaults.
  if(subject && !direct.length && schema?.inherited){
    for(const parent of store.find(subject,'is_a').concat(store.find(subject,'subclass_of'))){
      if(parent.negative||parent.object.kind!=='entity'||!store.compatible(parent,{...atom,scope:undefined},now))continue;
      for(const f of evidence(store,atom,parent.object.id,now,budget,depth+1,[...path,subject])){
        derived.push({...f,id:'inherit:'+subject+':'+f.id,subject,premises:[parent.id,...(f.premises??[f.id])]});
      }
    }
  }
  if(subject && ['is_a','subclass_of','part_of'].includes(atom.relation)){
    for(const first of direct){
      if(first.negative||first.object.kind!=='entity')continue;
      for(const f of evidence(store,atom,first.object.id,now,budget,depth+1,[...path,subject])){
        if(f.negative)continue;
        derived.push({...f,id:'transitive:'+subject+':'+f.id,subject,premises:[first.id,...(f.premises??[f.id])]});
      }
    }
  }
  return [...direct,...derived];
}
function candidates(store:Store,atom:Atom,row:Row,now:string,budget:Budget):Fact[]{
  const subject=bound(atom.subject,row);
  if(subject&&subject.kind!=='entity')return [];
  return evidence(store,atom,subject?.id,now,budget);
}
function applyAtom(rows:Row[],atom:Atom,store:Store,now:string,budget:Budget):Row[]{
  const out:Row[]=[];
  for(const row of rows){
    let matched=false;
    for(const f of candidates(store,atom,row,now,budget)){
      budget.tick();if(Boolean(f.negative)!==Boolean(atom.negative))continue;
      const next:Row={bindings:{...row.bindings},facts:[...row.facts,f],proof:[...row.proof]};
      if(!bind(atom.subject,entity(f.subject),next)||!bind(atom.object,f.object,next))continue;
      next.proof.push({id:'proof:'+f.id,rule:f.premises?'derived':'direct',premises:f.premises??[f.id],bindings:{...next.bindings},constraints:[atom.scope?'scope='+atom.scope:'',atom.from?'from='+atom.from:'',atom.to?'to='+atom.to:'',atom.negative?'negative':'positive'].filter(Boolean)});
      out.push(next);matched=true;
    }
    if(!matched&&atom.optional)out.push(row);
  }
  return out;
}
function collect(r:Result,rows:Row[],store:Store){
  r.facts=[...new Map(rows.flatMap(x=>x.facts).map(f=>[f.id,f])).values()];
  const seen=new Set(r.facts.map(f=>f.id));
  for(let i=0;i<r.facts.length;i++){
    if(i>12000)throw new Error('PROOF_EVIDENCE_BUDGET');
    for(const id of r.facts[i].premises??[]){
      const premise=store.fact(id);
      if(premise&&!seen.has(id)){seen.add(id);r.facts.push(premise);}
    }
  }
  r.proof=[...new Map(rows.flatMap(x=>x.proof).map(p=>[p.id,p])).values()];
}
/** Expose only bound intermediate arguments, not arbitrary question n-grams. */
export function retrievalFrontier(plan:Plan,store:Store):Atom[]{
  if(plan.kind!=='query')return [];
  const now=new Date().toISOString().slice(0,10),budget=new Budget({maxRows:4000,maxMilliseconds:200}),out:Atom[]=[];
  let rows:Row[]=[{bindings:{},facts:[],proof:[]}];
  for(const atom of plan.atoms){
    for(const row of rows.slice(0,64))out.push({...atom,subject:bound(atom.subject,row)??atom.subject,object:bound(atom.object,row)??atom.object});
    if(atom.subject.kind==='mention'||atom.object.kind==='mention')break;
    rows=applyAtom(rows,atom,store,now,budget);
    if(!rows.length)break;
  }
  return out;
}
function queryResult(plan:Select,store:Store,options:Options):Result {
  const r=result(plan),now=options.now??new Date().toISOString().slice(0,10),budget=new Budget(options);
  const unresolved=plan.atoms.flatMap(a=>[a.subject,a.object]).filter(t=>t.kind==='mention');
  if(unresolved.length){
    const ambiguous=unresolved.find(t=>t.candidates.length>1);
    r.status=ambiguous?'ambiguous':'unknown';r.missing=ambiguous?[ambiguous.text]:unresolved.map(t=>t.text);r.code='UNRESOLVED_ARGUMENT';
    if(ambiguous)r.choices=ambiguous.candidates.slice(0,4).map(id=>({id,label:(store.entity(id)?.name??id)+' ('+(store.entity(id)?.domain??store.entity(id)?.type??'meaning')+')'}));
    return r;
  }
  let rows:Row[]=[{bindings:{},facts:[],proof:[]}];
  if(plan.quantifier){
    const restriction=plan.atoms.slice(0,-1),target=plan.atoms.at(-1)!;
    for(const atom of restriction)rows=applyAtom(rows,atom,store,now,budget);
    rows=[...new Map(rows.map(row=>[JSON.stringify(row.bindings),row])).values()];
    let yes=0,no=0,unknown=0;const proofs:Row[]=[];
    for(const row of rows){
      const matched=applyAtom([row],target,store,now,budget);
      if(matched.length){yes++;proofs.push(...matched);}
      else {
        const facts=candidates(store,target,row,now,budget),expected=bound(target.object,row);
        const contra=facts.filter(f=>expected&&(f.negative&&equal(f.object,expected)||store.schema(target.relation)?.functional&&!equal(f.object,expected)||f.object.kind==='boolean'&&expected.kind==='boolean'&&f.object.value!==expected.value));
        if(contra.length){no++;proofs.push({...row,facts:[...row.facts,...contra],proof:contra.map(f=>({id:'counterexample:'+f.id,rule:'counterexample',premises:[f.id],bindings:row.bindings,constraints:[]}))});}else unknown++;
      }
    }
    const complete=!!plan.universeComplete,kind=plan.quantifier.kind,n=plan.quantifier.count??0;
    let verdict:boolean|undefined;
    if(kind==='all')verdict=no?false:complete&&!unknown?true:undefined;
    if(kind==='any')verdict=yes?true:complete&&!unknown?false:undefined;
    if(kind==='none')verdict=yes?false:complete&&!unknown?true:undefined;
    if(kind==='minimum')verdict=yes>=n?true:complete&&yes+unknown<n?false:undefined;
    if(kind==='maximum')verdict=yes>n?false:complete&&!unknown?true:undefined;
    if(kind==='exact')verdict=yes>n?false:complete&&!unknown?yes===n:undefined;
    if(kind==='most'&&complete&&!unknown)verdict=yes>rows.length/2;
    collect(r,proofs,store);r.coverage={matched:yes,unknown,complete};
    if(verdict!==undefined){r.status=verdict?'supported':'contradicted';r.values=[{kind:'boolean',value:verdict}];}else r.code='OPEN_UNIVERSE';
    return r;
  }
  for(const atom of plan.atoms)rows=applyAtom(rows,atom,store,now,budget);
  rows=rows.filter(row=>plan.filters.every(f=>checkFilter(f,row)));
  if(rows.some(row=>row.facts.some(f=>store.find(f.subject,f.relation,f.object).some(other=>!!other.negative!==!!f.negative&&store.compatible(other,{subject:entity(f.subject),relation:f.relation,object:f.object,scope:f.scope,from:f.from,to:f.to},now))))){
    collect(r,rows,store);r.status='ambiguous';r.code='CONFLICTING_FACTS';return r;
  }
  if(plan.shape==='boolean'){
    if(rows.length){collect(r,rows,store);r.status='supported';r.values=[{kind:'boolean',value:true}];return r;}
    if(plan.atoms.length===1){
      const a=plan.atoms[0],expected=bound(a.object,{bindings:{},facts:[],proof:[]});
      const all=candidates(store,a,{bindings:{},facts:[],proof:[]},now,budget);
      const contrary=all.filter(f=>expected&&(!!f.negative!==!!a.negative&&equal(f.object,expected)||!f.negative&&store.schema(a.relation)?.functional&&!equal(f.object,expected)||f.object.kind==='boolean'&&expected.kind==='boolean'&&f.object.value!==expected.value));
      if(contrary.length){r.status='contradicted';r.values=[{kind:'boolean',value:false}];r.facts=contrary;r.proof=contrary.map(f=>({id:'contradiction:'+f.id,rule:'explicit-or-functional-contradiction',premises:[f.id],bindings:{},constraints:[]}));}
    }
    return r;
  }
  if(!rows.length){r.code='NO_COMPATIBLE_EVIDENCE';return r;}
  // Functional conflicts are evaluated in the same scope, not hidden by choosing a first row.
  if(plan.atoms.length===1&&store.schema(plan.atoms[0].relation)?.functional&&plan.atoms[0].subject.kind==='entity'){
    const values=new Set(rows.map(row=>valueKey(row.bindings[plan.answer]??row.facts.at(-1)!.object)));
    if(values.size>1){collect(r,rows,store);r.status='ambiguous';r.code='CONFLICTING_FACTS';return r;}
  }
  collect(r,rows,store); // All premises survive aggregation and pagination.
  if(plan.aggregate){
    // Distinct count is distinct over the selected variable; sum/mean retain equal
    // measurements on different subjects while removing duplicate join paths.
    const uniqueInputs=[...new Map(rows.map(row=>[JSON.stringify(row.bindings),row])).values()];
    const measured=uniqueInputs.flatMap(row=>row.bindings[plan.aggregate!.variable]?[row.bindings[plan.aggregate!.variable]]:[]);
    const values=plan.aggregate.op==='count'?[...new Map(measured.map(v=>[valueKey(v),v])).values()]:measured;
    let answer:number;
    if(plan.aggregate.op==='count')answer=values.length;
    else {
      if(!values.length||values.some(v=>v.kind!=='number'))throw new Error('AGGREGATE_REQUIRES_NUMBERS');
      const numbers=values as Array<Extract<Value,{kind:'number'}>>,first=numbers[0];
      const ns=numbers.map(v=>v.unit&&first.unit?convert(v.value,v.unit,first.unit):numericCompare(v,{value:0,unit:first.unit}));
      answer=plan.aggregate.op==='sum'?ns.reduce((a,b)=>a+b,0):plan.aggregate.op==='mean'?ns.reduce((a,b)=>a+b,0)/ns.length:plan.aggregate.op==='min'?Math.min(...ns):Math.max(...ns);
    }
    r.values=[{kind:'number',value:answer,unit:plan.aggregate.op==='count'?undefined:(values[0] as Extract<Value,{kind:'number'}>)?.unit}];r.status=plan.universeComplete?'supported':'insufficient';r.code=plan.universeComplete?undefined:'RECORDED_SUBSET_ONLY';return r;
  }
  if(plan.order){
    const {variable,direction}=plan.order;
    rows.sort((a,b)=>{const x=a.bindings[variable],y=b.bindings[variable];if(x?.kind!=='number'||y?.kind!=='number')throw new Error('ORDER_REQUIRES_MEASUREMENT');return numericCompare(x,y)*direction;});
  }
  const uniqueRows=[...new Map(rows.map(row=>[valueKey(row.bindings[plan.answer]??row.facts.at(-1)!.object),row])).values()];
  const selected=uniqueRows.slice(plan.offset??0,(plan.offset??0)+(plan.limit??100));
  r.values=selected.map(row=>row.bindings[plan.answer]??row.facts.at(-1)!.object);
  r.status=plan.limit&&r.values.length<plan.limit?'insufficient':'supported';
  if(plan.order&&!plan.universeComplete){r.status='insufficient';r.code='RECORDED_SUBSET_ONLY';}
  r.coverage={matched:uniqueRows.length,unknown:0,complete:!!plan.universeComplete};
  return r;
}
export function execute(plan:Plan,store:Store,state:State,options:Options={}):Result {
  checkAbort(options.signal);
  validatePlan(plan);
  if(plan.kind==='query')return queryResult(plan,store,options);
  const r=result(plan);
  if(plan.kind==='inventory'){
    const solved=solveInventory(plan);r.proof=solved.proof;
    if(solved.value===undefined){r.status='ambiguous';r.missing=[solved.missing!];return r;}
    r.status='supported';r.values=[{kind:'number',value:solved.value}];r.text=plan.owner+' has '+solved.value+' '+plan.item+'.';return r;
  }
  if(plan.kind==='logic'){
    const solved=solveLogic(plan);r.proof=solved.proof;
    r.status='supported'; // This is an answer about entailment, not a claim that the opposite is true.
    r.text=solved.entailed?'Yes.':'That does not follow from the premise.';
    r.values=[{kind:'boolean',value:solved.entailed}];
    r.code=solved.entailed?undefined:'NOT_ENTAILED';
    return r;
  }
  if(plan.kind==='calculate'){
    const answer=calculate(plan.expression);r.status='supported';r.values=[{kind:'number',value:answer.value}];
    r.proof=answer.steps.map((step,i)=>({id:'calculation:'+i,rule:'arithmetic',premises:[],bindings:{},constraints:[step]}));return r;
  }
  if(plan.kind==='convert'){
    const value=convert(plan.value,plan.from,plan.to);r.status='supported';r.values=[{kind:'number',value,unit:plan.to}];
    r.proof=[{id:'conversion',rule:'dimension-checked-conversion',premises:[],bindings:{input:{kind:'number',value:plan.value,unit:plan.from},output:r.values[0]},constraints:['compatible dimensions']}];return r;
  }
  if(plan.kind==='compare'){
    const values=plan.subjects.map(subject=>queryResult({kind:'query',atoms:[{subject,relation:plan.relation,object:{kind:'variable',name:'answer'}}],answer:'answer',shape:'value',filters:[]},store,options));
    r.facts=values.flatMap(x=>x.facts);r.proof=values.flatMap(x=>x.proof);
    if(plan.mode==='attributes'){
      if(values.some(v=>v.status!=='supported'||!v.values.length))return r;
      r.status='supported';
      r.values=values.map(v=>({kind:'list',values:v.values,ordered:false}));
      r.text=plan.subjects.map((t,i)=>(t.kind==='entity'?store.entity(t.id)?.name:t.kind==='mention'?t.text:'Subject')+' ('+plan.relation.replaceAll('_',' ')+'): '+join(values[i].values.map(v=>valueText(v,store)))+'.').join(' ');
      return r;
    }
    if(values.length!==2||values.some(x=>x.status!=='supported'||x.values[0]?.kind!=='number'))return r;
    const a=values[0].values[0] as Extract<Value,{kind:'number'}>,b=values[1].values[0] as Extract<Value,{kind:'number'}>;
    const d=numericCompare(a,b), bv=a.unit&&b.unit?convert(b.value,b.unit,a.unit):b.value;
    const ua=a.uncertainty??0,ub=b.unit&&a.unit?Math.abs(convert(b.uncertainty??0,b.unit,a.unit)-convert(0,b.unit,a.unit)):b.uncertainty??0;
    if(plan.mode==='qualitative'&&Math.abs(a.value-bv)<=ua+ub&&(ua+ub)>0){r.status='insufficient';r.code='OVERLAPPING_MEASUREMENTS';r.text='The recorded uncertainty ranges overlap, so I cannot establish which is greater.';return r;}
    r.status='supported';
    const sign=plan.preference==='lesser'?-1:1;
    r.values=plan.mode==='qualitative'?[{kind:'text',value:d===0?'equal':d*sign>0?'first':'second'}]:[{kind:'number',value:plan.mode==='difference'?(a.value-bv)*sign:plan.mode==='ratio'?a.value/bv:(a.value-bv)*sign/bv*100,unit:plan.mode==='difference'?a.unit:undefined}];
    if(plan.mode==='difference'&&r.values[0].kind==='number'&&ua+ub>0)r.values[0].uncertainty=ua+ub;
    if(r.values.some(v=>v.kind==='number'&&!Number.isFinite(v.value)))throw new Error('UNDEFINED_COMPARISON');
    return r;
  }
  if(plan.kind==='memory'){
    if(plan.action==='clear'){state.memories=[];state.topics=[];state.answerEntities=[];state.previous=undefined;state.pending=undefined;state.history=[];r.text='I have cleared this session’s remembered information.';}
    else if(plan.action==='delete'){state.memories=state.memories.filter(m=>m.field!==plan.field);r.text='I have forgotten your '+plan.field+'.';}
    else if(plan.action==='recall'){
      const memories=state.memories.filter(m=>m.field===plan.field);
      if(!memories.length){r.text='You have not told me your '+plan.field+' in this session.';return r;}
      r.values=memories.map(m=>({kind:'text',value:m.value}));
      r.proof=memories.map(m=>({id:m.id,rule:'explicit-session-memory',premises:[m.id],bindings:{value:{kind:'text',value:m.value}},constraints:['source turn '+m.turn]}));
      r.text=({'name':'Your name is ','residence':'You live in ','origin':'You are from ','birthplace':'You were born in ','age':'Your age is ','likes':'You like ','dislikes':'You dislike ','preference':'Your stated preference is '}[plan.field??'name']??'You told me: ')+join(memories.map(m=>m.value))+'.';
    }else{
      if(!plan.field||!plan.value||plan.value.length>160||/\b(?:and I|but I|what is|where is)\b/i.test(plan.value))return {...r,code:'MEMORY_CAPTURE_BOUNDARY'};
      if(plan.action==='set')state.memories=state.memories.filter(m=>m.field!==plan.field);
      if(!state.memories.some(m=>m.field===plan.field&&normalize(m.value)===normalize(plan.value!)))state.memories.push({id:'memory:'+state.nextTurn+':'+state.memories.length,field:plan.field,value:plan.value,turn:state.nextTurn});
      if(state.memories.length>128)throw new Error('MEMORY_BUDGET');
      r.text='I’ll remember your '+plan.field+' as '+plan.value+' for this session.';
    }
    r.status='supported';return r;
  }
  if(plan.kind==='social'){
    r.status='supported';r.text={greeting:'Hello. What would you like to explore?',thanks:'You’re welcome.',farewell:'Goodbye.',identity:'I’m Lexi, Alphaine’s deterministic language model. I use explicit language rules and recorded knowledge, not generative AI.',age:'I don’t have a human age. This is the DV6 development version.',help:'I can look up recorded facts and definitions, calculate, compare supported quantities, and remember what you tell me during this session.',concern:'I’m sorry you’re having a difficult time. Would you like to tell me what is on your mind?',apology:'That’s all right. We can continue.',permission:'Of course. What would you like to ask?'}[plan.act];return r;
  }
  if(plan.kind==='followup'){
    const prev=state.previous;if(!prev)return {...r,code:'NO_PREVIOUS_RESULT'};
    r.facts=prev.results.flatMap(x=>x.facts);r.proof=prev.results.flatMap(x=>x.proof);
    r.values=prev.results.flatMap(x=>x.values);
    if(plan.action==='proof')r.text=r.facts.length?'My answer used '+join([...new Set(r.facts.map(f=>f.source.location))])+'.':r.proof.length?r.proof.map(p=>p.constraints.join('; ')).join('\n'):'The previous response did not make a sourced factual claim.';
    else if(plan.action==='more'){
      const previous=prev.results[0]?.selectedPlan;
      if(previous?.kind==='query'&&previous.shape==='list'){
        const next={...previous,offset:(previous.offset??0)+prev.results[0].values.length};
        const additional=queryResult(next,store,options);
        if(additional.values.length)return additional;
      }
      return {...r,code:'NO_ADDITIONAL_PROVEN_RESULTS',text:'I don’t have additional proven results for that request.'};
    }
    else r.text=prev.results.map(x=>plan.action==='shorter'?x.text.split(/(?<=[.!?])\s/)[0]:x.text).join('\n');
    r.status=prev.results.every(x=>['supported','contradicted'].includes(x.status))?'supported':'partial';return r;
  }
  if(plan.kind==='unknown'){r.text=plan.reason;r.missing=plan.slot?[plan.slot]:undefined;return r;}
  return {...r,code:'LEXICAL_RESOURCE_REQUIRED'};
}
