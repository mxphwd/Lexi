import rawProfiles from '../../data/dv12/calibration/profiles.json';
import {calibratedProbability,type Profile} from './calibration';
import type {Result} from './types';
const profiles=rawProfiles as Profile[];
/** Exactly one relation/operation group, never repeated sequential re-binning. */
export function calibrateResult(r:Result,parseScore:number){
  const group=r.selectedPlan.kind==='query'?'query:'+r.selectedPlan.atoms.map(a=>a.relation).join('+'):r.selectedPlan.kind;
  const matching=profiles.filter(p=>p.group===group);
  if(matching.length>1)throw new Error('OVERLAPPING_CALIBRATION_GROUPS');
  const sourceQuality=r.facts.length?Math.min(...r.facts.map(f=>f.source.review==='reviewed'?1:f.source.review==='source-attested'?.85:f.source.review==='user'?.8:.5)):r.proof.length?1:.7;
  const complete=['supported','contradicted'].includes(r.status)?1:.4;
  const evidence=r.facts.some(f=>f.source.disputed)?0:sourceQuality;
  const score=Math.min(parseScore,evidence,complete);
  const p=calibratedProbability(matching[0],group,score);
  r.confidence=p;r.confidenceKind=p===null?'unavailable':'held-out';
  if(p!==null&&p<.6&&['supported','contradicted'].includes(r.status)){
    r.status='insufficient';r.code='CALIBRATED_RISK';r.text='The available interpretation and evidence are not reliable enough for me to assert an answer.';
    r.values=[];r.claims=[];
  }
  return r;
}
