"use client";
import {useState} from 'react';
import type {LexiReply} from '@/lib/lexi/types';
import {failurePreview} from '@/lib/lexi/failure-export';
export function FailureExport({prompt,reply,privateValues,turns=[]}:{prompt:string;reply:LexiReply;privateValues:string[];turns?:string[]}){
  const [consent,setConsent]=useState(false),[expected,setExpected]=useState(''),[preview,setPreview]=useState(''),[includeContext,setIncludeContext]=useState(false);
  function download(){
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([preview],{type:'application/json'}));
    link.href=url;link.download='lexi-dv13-feedback.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <details className="trace failure-export">
    <summary>Export feedback locally</summary>
    <label>Expected behavior<input value={expected} onChange={e=>setExpected(e.target.value)} maxLength={1200}/></label>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I want to create a local report. Nothing is uploaded.</label>
    <label><input type="checkbox" checked={includeContext} onChange={e=>setIncludeContext(e.target.checked)}/> Include visible earlier prompts. They may not contain the full session.</label>
    <button type="button" disabled={!consent} onClick={()=>setPreview(failurePreview(prompt,expected,reply,privateValues,includeContext?turns:[]))}>Preview redacted report</button>
    {preview?<><p>Review this carefully: automatic redaction may miss private information. You can edit it before export.</p><textarea aria-label="Editable failure report preview" value={preview} onChange={e=>setPreview(e.target.value)}/><button type="button" disabled={!consent} onClick={download}>Download reviewed report</button></>:null}
  </details>;
}
