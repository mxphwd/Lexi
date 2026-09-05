"use client";
import {useState} from 'react';
import type {LexiReply} from '@/lib/lexi/types';
import {failurePreview} from '@/lib/lexi/failure-export';
export function FailureExport({prompt,reply,privateValues}:{prompt:string;reply:LexiReply;privateValues:string[]}){
  const [consent,setConsent]=useState(false),[expected,setExpected]=useState(''),[preview,setPreview]=useState('');
  function download(){
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([preview],{type:'application/json'}));
    link.href=url;link.download='lexi-dv12-failure.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <details className="trace failure-export">
    <summary>Export feedback locally</summary>
    <label>Expected behavior<input value={expected} onChange={e=>setExpected(e.target.value)} maxLength={1200}/></label>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I want to create a local report. Nothing is uploaded.</label>
    <button type="button" disabled={!consent} onClick={()=>setPreview(failurePreview(prompt,expected,reply,privateValues))}>Preview redacted report</button>
    {preview?<><p>Review this carefully: automatic redaction may miss private information. You can edit it before export.</p><textarea aria-label="Editable failure report preview" value={preview} onChange={e=>setPreview(e.target.value)}/><button type="button" disabled={!consent} onClick={download}>Download reviewed report</button></>:null}
  </details>;
}
