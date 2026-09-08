import type { LexiReply } from './types';
import {LEXI_BUILD} from './version';
/** Explicitly local. Redact values before serialization so quotes remain valid JSON. */
export function failurePreview(prompt:string,expected:string,reply:LexiReply,privateValues:string[]=[],turns:string[]=[]){
  const redact=(value:string)=>{
    let text=value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]').replace(/(?:\+?\d[\d ()-]{8,}\d)/g,'[phone or identifier]');
    for(const secret of privateValues.filter(s=>s.length>1).sort((a,b)=>b.length-a.length)){
      const escaped=[...secret].map(c=>'\\^$.*+?()[]{}|'.includes(c)?'\\'+c:c).join('');
      text=text.replace(new RegExp(escaped,'giu'),'[personal value]');
    }
    return text;
  };
  const walk=(value:unknown):unknown=>typeof value==='string'?redact(value):Array.isArray(value)?value.map(walk):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v)])):value;
  return JSON.stringify(walk({version:13,build:LEXI_BUILD,prompt,turns,expected,observedOutput:reply.text,trace:reply.trace,classification:'unreviewed',provenance:{kind:'local-opt-in-export',capturedAt:new Date().toISOString(),consent:'local-download-only',context:'Only explicitly included visible prompts; review for missing context before evaluation.'}}),null,2);
}
