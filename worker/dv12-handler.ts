import { Session } from '../modules/dv12/runtime';
import { emptyState, type State } from '../modules/dv12/types';
import { resourceLoader } from './dv12-resources';
import { readBounded, type AssetFetcher } from './dv12-assets';

export type ClientState=Pick<State,'revision'|'nextTurn'|'memories'|'topics'|'answerEntities'> & {previousInput?:string;previousSenseId?:string};
let active=0;
function stateFromClient(value:unknown):State{
  const state=emptyState();if(value===undefined||value===null)return state;
  if(typeof value!=='object')throw new Error('INVALID_SESSION');
  const v=value as Partial<ClientState>;
  if(!Number.isSafeInteger(v.revision)||!Number.isSafeInteger(v.nextTurn)||v.nextTurn!<1||v.revision!<0)throw new Error('INVALID_SESSION_REVISION');
  if(!Array.isArray(v.memories)||v.memories.length>128||!Array.isArray(v.topics)||v.topics.length>12||!Array.isArray(v.answerEntities)||v.answerEntities.length>100)throw new Error('SESSION_BUDGET');
  for(const m of v.memories)if(!m||typeof m.id!=='string'||typeof m.field!=='string'||typeof m.value!=='string'||m.value.length>160||!Number.isSafeInteger(m.turn)||!['name','age','residence','birthplace','origin','likes','dislikes','preference'].includes(m.field))throw new Error('INVALID_MEMORY');
  if([...v.topics,...v.answerEntities].some(x=>typeof x!=='string'||x.length>256))throw new Error('INVALID_TOPIC');
  Object.assign(state,{revision:v.revision,nextTurn:v.nextTurn,memories:v.memories,topics:v.topics,answerEntities:v.answerEntities});
  // Client claims, confidence, facts and proof are NEVER imported.
  return state;
}
export async function handleDv12(request:Request,assets:AssetFetcher):Promise<Response>{
  if(request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  if(Number(request.headers.get('content-length'))>65536)return Response.json({error:'BODY_BUDGET'},{status:413});
  if(active>=2)return Response.json({error:'SERVICE_BUSY'},{status:503,headers:{'retry-after':'2'}});
  active++;
  try{
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
    const body=JSON.parse(new TextDecoder().decode(await readBounded(request.body,65536,signal))) as {version?:number;input?:unknown;state?:unknown};
    if(body.version!==12||typeof body.input!=='string'||!body.input.trim()||body.input.length>12000)throw new Error('INVALID_REQUEST');
    const state=stateFromClient(body.state),loader=resourceLoader(assets,request.url);
    const previous=(body.state as Partial<ClientState>|undefined)?.previousInput;
    if(previous!==undefined){
      if(typeof previous!=='string'||previous.length>12000)throw new Error('INVALID_PREVIOUS_REQUEST');
      if(!/^(?:forget|clear)\b/i.test(previous)){
        const previousSession=new Session(state);
        let prepared=await previousSession.prepareAsync(previous,loader,{signal});
        const sense=(body.state as Partial<ClientState>|undefined)?.previousSenseId;
        if(sense){
          if(typeof sense!=='string'||sense.length>200)throw new Error('INVALID_PREVIOUS_SENSE');
          const index=prepared.execution.results[0]?.choices?.findIndex(c=>c.id===sense)??-1;
          if(index>=0){previousSession.commit(prepared);prepared=await previousSession.prepareAsync(String(index+1),loader,{signal});}
        }
        state.previous={request:previous,results:prepared.execution.results};
        state.pending=prepared.execution.state.pending;
      }
    }
    const session=new Session(state),prepared=await session.prepareAsync(body.input,loader,{signal});
    const next=prepared.execution.state;
    const cleared=prepared.execution.results.some(r=>r.selectedPlan.kind==='memory'&&r.selectedPlan.action==='clear');
    const plan=prepared.execution.results.length===1?prepared.execution.results[0].selectedPlan:undefined;
    let replayInput=prepared.execution.request.original;
    if(plan?.kind==='lexical')replayInput='Define '+plan.term;
    // Resolve the common entity-reference case explicitly before storing replay input.
    if(plan?.kind==='query'&&plan.atoms.length===1&&plan.atoms[0].subject.kind==='entity'&&plan.atoms[0].object.kind==='variable'&&/\b(?:it|there|former|latter|he|she)\b/i.test(body.input)){
      const {coreStore}=await import('../modules/dv12/store');
      const subject=coreStore().entity(plan.atoms[0].subject.id);
      if(subject)replayInput='What is the '+plan.atoms[0].relation.replaceAll('_',' ')+' of '+subject.name+'?';
    }
    const clientState:ClientState={revision:next.revision,nextTurn:next.nextTurn,memories:next.memories,topics:next.topics,answerEntities:next.answerEntities,previousInput:cleared?undefined:replayInput,previousSenseId:plan?.kind==='lexical'?plan.senseId:undefined};
    return Response.json({version:12,reply:prepared.reply,state:clientState,coverage:prepared.execution.coverage},{headers:{'cache-control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'EXECUTION_ERROR';
    const code=/^[A-Z0-9_:.-]+$/.test(message)?message:'EXECUTION_ERROR';
    return Response.json({version:12,error:code},{status:/INVALID|BUDGET/.test(code)?400:request.signal.aborted?499:503,headers:{'cache-control':'no-store'}});
  }finally{active--;}
}
