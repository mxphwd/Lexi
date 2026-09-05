import type { LexiReply } from './types';
/** Explicitly local. Never persists or uploads a conversation automatically. */
export function failurePreview(prompt:string,expected:string,reply:LexiReply,privateValues:string[]=[]){
  const redact=(value:string)=>{
    let text=value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]').replace(/(?:\+?\d[\d ()-]{8,}\d)/g,'[phone or identifier]');
    for(const secret of privateValues.filter(s=>s.length>1).sort((a,b)=>b.length-a.length)){
      const escaped=[...secret].map(c=>'\\^$.*+?()[]{}|'.includes(c)?'\\'+c:c).join('');
      text=text.replace(new RegExp(escaped,'giu'),'[personal value]');
    }
    return text;
  };
  return redact(JSON.stringify({version:12,prompt,expected,observedOutput:reply.text,trace:reply.trace,classification:'unreviewed',provenance:{kind:'local-opt-in-export',capturedAt:new Date().toISOString()}},null,2));
}
