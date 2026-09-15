/** Evaluation-only stage diagnostics. Never imported by the runtime. */
import type {Execution} from '../dv12/types';

export type StageOutcome={fullParse:boolean;typedPlan:boolean;entityBound:boolean;retrievalComplete:boolean|null;executionSucceeded:boolean;realizationVerified:boolean;status:string;failureStage:string;failureCode?:string};
export function stageOutcome(execution:Execution):StageOutcome{
  const clauses=execution.request.clauses,results=execution.results;
  const fullParse=clauses.length>0&&clauses.every(clause=>clause.semantic?.meaningfulCoverage===1&&!clause.semantic.unconsumed.length);
  const typedPlan=results.every(result=>result.selectedPlan.kind!=='unknown');
  const entityBound=results.every(result=>result.selectedPlan.kind!=='query'||result.selectedPlan.atoms.every(atom=>atom.subject.kind!=='mention'&&atom.object.kind!=='mention'));
  const retrievalComplete=execution.coverage?execution.coverage.complete:null;
  const executionSucceeded=results.every(result=>['supported','contradicted'].includes(result.status));
  const realizationVerified=results.every(result=>!result.claims.length||result.claims.every(claim=>claim.verified));
  const failureStage=!fullParse?'parsing':!typedPlan?'planning':!entityBound?'entity-linking':retrievalComplete===false?'retrieval':!executionSucceeded?'execution':!realizationVerified?'realization':'none';
  return {fullParse,typedPlan,entityBound,retrievalComplete,executionSucceeded,realizationVerified,status:execution.status,failureStage,failureCode:results.find(result=>!['supported','contradicted'].includes(result.status))?.code};
}
export function summarizeStages(rows:StageOutcome[]){
  const rate=(key:keyof Pick<StageOutcome,'fullParse'|'typedPlan'|'entityBound'|'executionSucceeded'|'realizationVerified'>)=>rows.length?rows.filter(row=>row[key]).length/rows.length:null;
  return {samples:rows.length,fullParse:rate('fullParse'),typedPlan:rate('typedPlan'),entityBound:rate('entityBound'),retrievalComplete:rows.filter(row=>row.retrievalComplete!==null).length?rows.filter(row=>row.retrievalComplete).length/rows.filter(row=>row.retrievalComplete!==null).length:null,executionSucceeded:rate('executionSucceeded'),realizationVerified:rate('realizationVerified'),failures:Object.fromEntries([...new Set(rows.map(row=>row.failureStage))].map(stage=>[stage,rows.filter(row=>row.failureStage===stage).length]))};
}
