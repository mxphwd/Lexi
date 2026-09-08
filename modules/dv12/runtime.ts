import { evidenceSteps } from '../dv13/evidence';
import type { LexiReply } from '../../lib/lexi/types';
import { execute, result } from './executor';
import { parse, parseClause } from './parser';
import { realize } from './realizer';
import {calibrateResult} from './calibrate-result';
import { coreStore, Store } from './store';
import { checkAbort, emptyState, type Coverage, type Execution, type Options, type Plan, type Result, type State } from './types';

export type ResourceNeed={plan:Plan; text:string; store:Store; signal?:AbortSignal};
export type ResourceAnswer={result?:Result; coverage?:Coverage; store?:Store};
export type ResourceLoader=(need:ResourceNeed)=>Promise<ResourceAnswer>;
export type Prepared={execution:Execution; reply:LexiReply; revision:number};
function failure(plan:Plan,error:unknown):Result {
  const code=error instanceof Error?error.message:'EXECUTION_ERROR';
  const r=result(plan,/BUDGET/.test(code)?'insufficient':'error',code);
  r.text=/BUDGET/.test(code)?'This request exceeds the documented execution budget. Please make it more specific.':'I could not complete this request ('+code+'). Your session was not changed.';
  return r;
}
function runPlan(plan:Plan,store:Store,state:State,options:Options):Result{
  try{return execute(plan,store,state,options);}catch(error){checkAbort(options.signal);return failure(plan,error);}
}
function terminal(results:Result[]):Execution['status'] {
  if(results.some(r=>r.status==='canceled'))return 'canceled';
  if(results.some(r=>r.status==='error'))return 'error';
  const set=new Set(results.map(r=>r.status));return set.size===1?results[0].status:'partial';
}
function topicIds(plan:Plan):string[] {
  if(plan.kind==='compare')return plan.subjects.flatMap(t=>t.kind==='entity'?[t.id]:[]);
  if(plan.kind==='query')return [...new Set(plan.atoms.flatMap(a=>a.subject.kind==='entity'?[a.subject.id]:[]))];
  return [];
}
/** The exact same coroutine drives sync and async; only resource fulfillment differs. */
function* program(input:string,initial:State,store:Store,options:Options,resources:boolean):Generator<ResourceNeed,Execution,ResourceAnswer>{
  const state=structuredClone(initial),started=performance.now(),stages:Execution['stages']=[];
  checkAbort(options.signal);
  let resolvedInput=input;
  let resumedPlan:Plan|undefined;
  const pending=state.pending;
  if(pending?.choices&&pending.plan){
    const n=input.trim().toLowerCase().replace(/[.!?]+$/,'');
    const index=/^(?:option )?\d+$/.test(n)?Number(n.replace('option ',''))-1:({first:0,'the first':0,second:1,'the second':1,third:2,'the third':2,fourth:3,'the fourth':3} as Record<string,number>)[n];
    const choice=pending.choices[index];
    if(choice){
      resumedPlan=structuredClone(pending.plan);resolvedInput=pending.clause;
      if(resumedPlan.kind==='lexical')resumedPlan.senseId=choice.id;
      if(resumedPlan.kind==='query')for(const a of resumedPlan.atoms)for(const key of ['subject','object'] as const)if(a[key].kind==='mention'&&a[key].text===pending.slot)a[key]={kind:'entity',id:choice.id};
    }
  }
  if(state.pending){
    const selected=normalizeClarification(input);
    if(selected)resolvedInput=state.pending.clause.replace(state.pending.slot,state.pending.slot+' in '+selected);
  }
  let request:Execution['request'];
  try {request=parse(resolvedInput,store,state);}
  catch(error){
    const r=failure({kind:'unknown',reason:'Input could not be normalized within the budget'},error);
    return {request:{version:12,original:input,clauses:[]},results:[r],state:structuredClone(initial),status:r.status,stages:[{stage:'normalization',code:r.code??'ERROR',detail:r.text,milliseconds:performance.now()-started}]};
  }
  const results:Result[]=[];
  if(resumedPlan&&request.clauses.length===1)request.clauses[0].alternatives=[{plan:resumedPlan,grammar:'clarification-continuation',score:1}];
  stages.push({stage:'parsing',code:'TYPED_PLAN',detail:request.clauses.length+' clauses',milliseconds:performance.now()-started});
  let coverage:Coverage|undefined;
  const topics:string[]=[];
  for(let i=0;i<request.clauses.length;i++){
    checkAbort(options.signal);
    let clause=request.clauses[i].alternatives[0].plan.kind==='inventory'||resumedPlan?request.clauses[i]:parseClause(request.clauses[i].text,request.clauses[i].start,request.clauses[i].id,store,state);
    let chosen:Result|undefined;
    for(let j=0;j<Math.min(4,clause.alternatives.length);j++){
      const candidate=clause.alternatives[j];
      // A failed factual-property plan cannot fall back to defining the whole question.
      if(j>0&&clause.alternatives[0].plan.kind==='query'&&candidate.plan.kind==='lexical'&&clause.alternatives[0].plan.atoms[0].relation!=='definition')continue;
      let r=runPlan(candidate.plan,store,state,options);
      if(resources&&['unknown','insufficient'].includes(r.status)&&['query','lexical','compare','unknown'].includes(candidate.plan.kind)){
        for(let pass=0;pass<4;pass++){
        const before=store.stats().facts;
        let loaded:ResourceAnswer;
        try {loaded=yield {plan:candidate.plan,text:clause.text,store,signal:options.signal};}
        catch(error){r=failure(candidate.plan,error);break;}
        checkAbort(options.signal);coverage=loaded.coverage??coverage;
        if(loaded.store)store=loaded.store;
        stages.push({stage:'retrieval',code:'RESOURCE_PASS',detail:'pass '+(pass+1)+'; live indexed propositions '+store.stats().facts,milliseconds:performance.now()-started});
        if(loaded.result)r=loaded.result;
        else{
          const reparse=resumedPlan?clause:parseClause(clause.text,clause.start,clause.id,store,state);
          const compatible=loaded.store&&reparse.alternatives[0].score>candidate.score?reparse.alternatives[0]:reparse.alternatives.find(a=>a.grammar===candidate.grammar&&a.plan.kind!=='unknown')??(candidate.plan.kind==='unknown'?reparse.alternatives[0]:undefined);
          r=runPlan(compatible?.plan??candidate.plan,store,state,options);
          clause=reparse;
        }
        if(!['unknown','insufficient'].includes(r.status)||store.stats().facts===before&&!loaded.store)break;
        }
      }
      if(!chosen||['supported','contradicted','insufficient','ambiguous'].includes(r.status))chosen=r;
      if(['supported','contradicted','insufficient','ambiguous','error','canceled'].includes(r.status))break;
    }
    try{
      chosen=realize(chosen??result({kind:'unknown',reason:'No executable plan'}),clause,store);
      chosen=calibrateResult(chosen,clause.alternatives.find(a=>a.plan===chosen?.selectedPlan)?.score??clause.alternatives[0].score);
    }catch(error){chosen=failure(chosen?.selectedPlan??clause.alternatives[0].plan,error);}
    if(chosen.status==='ambiguous'&&chosen.missing?.length===1)state.pending={clause:clause.text,slot:chosen.missing[0],plan:chosen.selectedPlan,choices:chosen.choices};
    else if(['supported','contradicted'].includes(chosen.status))state.pending=undefined;
    checkAbort(options.signal);
    request.clauses[i]=clause;results.push(chosen);
    const ids=topicIds(chosen.selectedPlan);ids.forEach(id=>{if(!topics.includes(id))topics.push(id);});
    if(ids.length)state.topics=ids;
    state.answerEntities=chosen.values.flatMap(v=>v.kind==='entity'?[v.id]:[]);
    if(['error','canceled'].includes(chosen.status)){
      for(const unexecuted of request.clauses.slice(i+1)){
        const r=result(unexecuted.alternatives[0].plan,'error','PREVIOUS_CLAUSE_FAILED');
        r.text='This part was not executed because an earlier part failed.';results.push(r);
      }
      break;
    }
  }
  if(topics.length)state.topics=topics.slice(0,12);
  const status=terminal(results);
  if(!['error','canceled'].includes(status)){
    const clearing=results.some(r=>r.selectedPlan.kind==='memory'&&r.selectedPlan.action==='clear');
    state.revision++;state.nextTurn++;
    if(!clearing){
      state.previous={request:input,results:structuredClone(results)};
      state.history=[...state.history,{turn:initial.nextTurn,input,output:results.map(r=>r.text).join('\n\n')}].slice(-32);
    }
  }
  stages.push({stage:'execution',code:status.toUpperCase(),detail:'Live indexed propositions: '+store.stats().facts+'. No legacy answer substitution; confidence unavailable without held-out calibration.',milliseconds:performance.now()-started});
  return {request,results,state:['error','canceled'].includes(status)?structuredClone(initial):state,status,stages,coverage,liveIndex:{propositions:store.stats().facts,entities:store.stats().entities,requestBytes:store.requestBytes(),loadedShards:coverage?.loadedShards??0}};
}
function normalizeClarification(input:string){
  const n=input.toLowerCase().replace(/[.!?]+$/,'').trim();
  if(/^(?:the )?(?:financial (?:one|meaning)|finance|money)$/.test(n))return 'finance';
  if(/^(?:the )?(?:river (?:one|meaning)|river|geography)$/.test(n))return 'geography';
  return undefined;
}
export function toReply(execution:Execution,store?:Store):LexiReply{
  const facts=execution.results.flatMap(r=>r.facts),proof=execution.results.flatMap(r=>r.proof);
  return {text:execution.results.map(r=>r.text).join('\n\n'),trace:{
    normalizedInput:execution.request.original.toLowerCase(),sentenceMode:'interrogative',interpretedIntent:'dv13:'+execution.results.map(r=>r.selectedPlan.kind).join('+'),
    confidence:execution.results.length===1?execution.results[0].confidence??0:0,confidenceAvailable:execution.results.length===1&&execution.results[0].confidence!==null,runtimeVersion:'DV13',executionStatus:execution.status,
    plans:execution.results.map(r=>r.selectedPlan),
    liveIndex:execution.liveIndex??(store?{propositions:store.stats().facts,entities:store.stats().entities,requestBytes:store.requestBytes(),loadedShards:execution.coverage?.loadedShards??0}:undefined),
    matchedExampleIds:[],matchedTerms:[],selectedStructure:'dv13:proposition-realization',source:'semantic-runtime',
    propositionIds:[...new Set(facts.map(f=>f.id))],subjectIds:[...new Set(facts.map(f=>f.subject))],
    sources:facts.map(f=>({sourceId:f.source.id,sourceLocation:f.source.location,reviewStatus:f.source.review})),
    evidenceSteps:evidenceSteps(execution.results),
    proof:proof.map(p=>p.rule+': '+p.premises.join(', ')+(p.constraints.length?' ['+p.constraints.join('; ')+']':'')),
    clauseCount:execution.results.length,clauseResults:execution.results.map((r,i)=>({clauseId:execution.request.clauses[i]?.id??'request',status:r.status,confidence:r.confidence??0,propositionIds:r.facts.map(f=>f.id)})),
    failureStage:execution.results.some(r=>r.code?.startsWith('ASSET'))?'retrieval':execution.results.some(r=>r.code==='UNRESOLVED_ARGUMENT')?'entity-linking':execution.results.some(r=>r.code==='UNSATISFIED_WORD_RESTRICTION')?'realization':!['supported','contradicted'].includes(execution.status)?'execution':undefined,
    failureCode:execution.results.find(r=>!['supported','contradicted'].includes(r.status))?.code,
    stages:execution.stages.map(s=>({stage:s.stage,status:s.stage==='execution'?!['supported','contradicted'].includes(execution.status)?'partial':'passed':'passed',code:s.code,detail:s.detail,durationMilliseconds:s.milliseconds})),
  }};
}
export class Session {
  private state:State;private generation=0;
  constructor(initial:State=emptyState(),private readonly base=coreStore()){this.state=structuredClone(initial);}
  snapshot(){return structuredClone(this.state);}
  prepare(input:string,options:Options={}):Prepared{
    const store=new Store(this.base),runner=program(input,this.state,store,options,false);
    const step=runner.next();if(!step.done)throw new Error('SYNC_RESOURCE_CONTRACT');
    return {execution:step.value,reply:toReply(step.value,store),revision:this.state.revision};
  }
  async prepareAsync(input:string,loader?:ResourceLoader,options:Options={}):Promise<Prepared>{
    const ticket=++this.generation,revision=this.state.revision,store=new Store(this.base);
    const runner=program(input,this.state,store,options,!!loader);
    let step=runner.next();
    while(!step.done){
      checkAbort(options.signal);
      try{
        const loaded=await loader!(step.value);checkAbort(options.signal);
        if(ticket!==this.generation)throw new Error('SUPERSEDED_REQUEST');
        step=runner.next(loaded);
      }catch(error){checkAbort(options.signal);step=runner.throw(error);}
    }
    if(ticket!==this.generation||revision!==this.state.revision)throw new Error('STALE_TRANSACTION');
    return {execution:step.value,reply:toReply(step.value,store),revision};
  }
  commit(prepared:Prepared,signal?:AbortSignal){
    checkAbort(signal);if(prepared.revision!==this.state.revision)throw new Error('STALE_TRANSACTION');
    if(['error','canceled'].includes(prepared.execution.status))return prepared.reply;
    this.state=structuredClone(prepared.execution.state);return prepared.reply;
  }
  respond(input:string){const p=this.prepare(input);return this.commit(p);}
  async respondAsync(input:string,options:Options&{loader?:ResourceLoader}={}){const p=await this.prepareAsync(input,options.loader,options);return this.commit(p,options.signal);}
}
