/** Evaluation-only: not imported by the client, Worker, or execution engine. */
import { canonical, numericCompare } from '../dv12/numbers';
import type { Result, Value } from '../dv12/types';
export type Outcome='correct-answer'|'correct-abstention'|'incorrect-answer'|'unsupported-abstention'|'clarification'|'partial-answer'|'evaluator-error';
export type Case={id:string;category:string;prompt:string;answerable:boolean;turns?:string[];expected:{values?:Value[];ordered?:boolean;text?:string[];clarification?:string[];relation?:string;subject?:string;tolerance?:number};provenance:{kind:'audit-regression'|'development-diagnostic'|'independent-blind'|'real-failure';author:string;capturedAt:string}};
export type Grade={outcome:Outcome;reason:string;adjudication:boolean};
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
function equivalent(a:Value,b:Value,tolerance=1e-7):boolean{
  if(a.kind==='number'&&b.kind==='number'){
    try{return Math.abs(numericCompare(a,b))<=tolerance*(b.unit?Math.abs(canonical(1,b.unit).value-canonical(0,b.unit).value):1);}catch{return false;}
  }
  if(a.kind==='text'&&b.kind==='text')return norm(a.value)===norm(b.value);
  return JSON.stringify(a)===JSON.stringify(b);
}
export function gradeCanonicalText(answer:string,canonicalAnswer:string,relation?:string):'equal'|'different'|'adjudicate'{
  const a=norm(answer),e=norm(canonicalAnswer);
  if(/\b(?:or|unsure|maybe|perhaps)\b/.test(a))return 'different';
  if(a===e||a==='the answer is '+e)return 'equal';
  if(a.startsWith('not ')&&a.includes('; the answer is '))return a.split('; the answer is ')[1]===e?'equal':'different';
  if(relation==='capital'&&/^[a-z ]+$/.test(e)){
    if(new RegExp('^'+e+' is (?:the )?capital(?: of [a-z ]+)?$').test(a))return 'equal';
    if(new RegExp('^(?:the capital of [a-z ]+ is |[a-z ]+ has the capital )'+e+'$').test(a))return 'equal';
  }
  if(a.includes(e))return /\b(?:not|never|isn't|is not)\b/.test(a)?'different':'adjudicate';
  return 'different';
}
export function grade(c:Case,results:Result[]):Grade{
  const g=(outcome:Outcome,reason:string,adjudication=false):Grade=>({outcome,reason,adjudication});
  if(!results.length||results.some(r=>['error','canceled'].includes(r.status)))return g('evaluator-error','Execution did not deliver a terminal answer.');
  if(results.some(r=>r.status==='ambiguous')){
    const actual=results.flatMap(r=>r.missing??[]);
    if(c.expected.clarification?.every(slot=>actual.includes(slot)))return g('clarification','Requested a labeled missing slot.');
    return g('incorrect-answer','Unjustified clarification.');
  }
  if(results.every(r=>r.status==='unknown'))return g(c.answerable?'unsupported-abstention':'correct-abstention','Knowledge or operation unavailable.');
  if(results.some(r=>['partial','insufficient','unknown'].includes(r.status)))return g('partial-answer','Some requested content or completeness is missing.');
  const plans=results.map(r=>r.selectedPlan);
  if(c.expected.relation&&!plans.some(p=>p.kind==='query'&&p.atoms.some(a=>a.relation===c.expected.relation)))return g('incorrect-answer','Wrong requested relation.');
  if(c.expected.subject&&!plans.some(p=>p.kind==='query'&&p.atoms.some(a=>a.subject.kind==='entity'&&a.subject.id===c.expected.subject)))return g('incorrect-answer','Wrong subject binding.');
  if(c.expected.values){
    const actual=results.flatMap(r=>r.values),wanted=c.expected.values;
    const matches=actual.length===wanted.length&&(c.expected.ordered!==false?wanted.every((v,i)=>equivalent(actual[i],v,c.expected.tolerance)):wanted.every(v=>actual.some(a=>equivalent(a,v,c.expected.tolerance))));
    if(!matches){
      if(actual.length===wanted.length&&actual.every(v=>v.kind==='text')&&wanted.every(v=>v.kind==='text'))return g('evaluator-error','Textual equivalence needs adjudication.',true);
      return g('incorrect-answer','Bound answer values do not match.');
    }
    if(results.some(r=>r.claims.length&&r.claims.map(c=>c.text).join(' ')!==r.text))return g('incorrect-answer','Final text differs from the claim-level realization.');
    if(results.some(r=>/\b(?:or maybe|unsure whether|possibly instead)\b/i.test(r.text)))return g('incorrect-answer','Unresolved alternatives in final answer.');
    return g('correct-answer','Bound answer roles and typed values match.');
  }
  if(c.expected.text){
    const actual=norm(results.map(r=>r.text).join(' '));
    if(c.expected.text.some(t=>norm(t)===actual))return g('correct-answer','Matches an explicitly approved realization.');
    return g('evaluator-error','Unapproved paraphrase needs human adjudication.',true);
  }
  return g('evaluator-error','Missing semantic expected answer.',true);
}
export function summarize(rows:Array<Case&{grade:Grade;milliseconds:number;confidence:number|null}>){
  const outcomes:Record<Outcome,number>={'correct-answer':0,'correct-abstention':0,'incorrect-answer':0,'unsupported-abstention':0,clarification:0,'partial-answer':0,'evaluator-error':0};
  rows.forEach(r=>outcomes[r.grade.outcome]++);
  const answerable=rows.filter(r=>r.answerable),correct=answerable.filter(r=>r.grade.outcome==='correct-answer').length;
  const asserted=outcomes['correct-answer']+outcomes['incorrect-answer'];
  const unresolved=rows.filter(r=>r.grade.adjudication).length;
  const sorted=rows.map(r=>r.milliseconds).sort((a,b)=>a-b),percentile=(p:number)=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??null;
  const confident=rows.filter(r=>r.confidence!==null&&r.confidence>=.8),errors=confident.filter(r=>r.grade.outcome==='incorrect-answer').length;
  return {samples:rows.length,answerable:answerable.length,correctAnswers:correct,answerPossibility:answerable.length?correct/answerable.length:null,outcomes,precision:{denominator:asserted,value:asserted?outcomes['correct-answer']/asserted:null,unresolved,lowerBound:asserted+unresolved?outcomes['correct-answer']/(asserted+unresolved):null,upperBound:asserted+unresolved?(outcomes['correct-answer']+unresolved)/(asserted+unresolved):null},highConfidenceError:{threshold:.8,samples:confident.length,errors,rate:confident.length?errors/confident.length:null},latency:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)}};
}
