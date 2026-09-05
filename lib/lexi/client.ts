import type { LexiReply } from './types';
import type { ClientState } from '../../worker/dv12-handler';
import {backendEndpoint} from './backend';
import {responseJson} from './transport';
export type ClientPrepared={reply:LexiReply;state:ClientState;revision:number;ticket:number};
export class BrowserSession{
  private state:ClientState={revision:0,nextTurn:1,memories:[],topics:[],answerEntities:[]};
  private generation=0;
  async prepareAsync(input:string,options:{signal?:AbortSignal}={}):Promise<ClientPrepared>{
    const ticket=++this.generation,revision=this.state.revision;
    const endpoint=backendEndpoint();
    const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000);
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:12,input,state:this.state}),signal});
    if(!response.ok)throw new Error('Lexi’s service is unavailable ('+response.status+'). Your session was not changed.');
    const data=await responseJson(response,signal) as {version?:number;reply?:LexiReply;state?:ClientState};
    const failed=data.reply?.trace.executionStatus==='error'||data.reply?.trace.executionStatus==='canceled'||data.reply?.trace.executionStatus==='insufficient'&&data.reply?.trace.failureCode?.includes('BUDGET')&&data.state?.revision===revision;
    if(data.version!==12||typeof data.reply?.text!=='string'||!data.reply.trace||!data.state||data.state.revision!==revision+(failed?0:1))throw new Error('Invalid response from Lexi’s service.');
    if(!Array.isArray(data.state.memories)||data.state.memories.length>128||!Array.isArray(data.state.topics)||data.state.topics.length>12||!Array.isArray(data.state.answerEntities)||data.state.answerEntities.length>100||!Array.isArray(data.reply.trace.matchedTerms)||!Array.isArray(data.reply.trace.matchedExampleIds))throw new Error('Invalid response schema from Lexi’s service.');
    if(ticket!==this.generation||signal.aborted)throw new DOMException('Canceled','AbortError');
    return {reply:data.reply,state:data.state,revision,ticket};
  }
  commit(p:ClientPrepared,signal?:AbortSignal){
    if(signal?.aborted||p.ticket!==this.generation)throw new DOMException('Canceled','AbortError');
    if(p.revision!==this.state.revision)throw new Error('Session changed before the response was accepted.');
    if(!['error','canceled'].includes(p.reply.trace.executionStatus??''))this.state=structuredClone(p.state);
    return p.reply;
  }
  async respondAsync(input:string,options:{signal?:AbortSignal}={}){const p=await this.prepareAsync(input,options);return this.commit(p,options.signal);}
  snapshot(){return structuredClone(this.state);}
}
export function createLexiSession(){return new BrowserSession();}
