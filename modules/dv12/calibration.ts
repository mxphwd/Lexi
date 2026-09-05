/** Empirical calibration is unavailable until independent held-out labels exist.
 * This module does not manufacture training rows or infer correctness from coverage. */
export type Judgment={id:string;group:string;score:number;correct:boolean};
export type Profile={version:12;group:string;datasetSha256:string;independence:'held-out-human-judged';samples:number;bins:Array<{min:number;max:number;probability:number;samples:number}>};
export function fitCalibration(rows:Judgment[],group:string,datasetSha256:string):Profile{
  if(!/^[a-f0-9]{64}$/.test(datasetSha256))throw new Error('CALIBRATION_HASH_REQUIRED');
  const selected=rows.filter(r=>r.group===group).sort((a,b)=>a.score-b.score);
  if(selected.length<50||new Set(selected.map(r=>r.id)).size!==selected.length)throw new Error('CALIBRATION_SAMPLE_REQUIREMENT');
  if(selected.some(r=>!Number.isFinite(r.score)||r.score<0||r.score>1||typeof r.correct!=='boolean'))throw new Error('CALIBRATION_SCHEMA');
  const blocks:Array<{min:number;max:number;count:number;correct:number}>=[];
  for(const row of selected){
    blocks.push({min:row.score,max:row.score,count:1,correct:Number(row.correct)});
    while(blocks.length>1){
      const b=blocks.at(-1)!,a=blocks.at(-2)!;
      if(a.max!==b.min&&a.correct/a.count<=b.correct/b.count)break;
      blocks.splice(-2,2,{min:a.min,max:b.max,count:a.count+b.count,correct:a.correct+b.correct});
    }
  }
  return {version:12,group,datasetSha256,independence:'held-out-human-judged',samples:selected.length,bins:blocks.map(b=>({min:b.min,max:b.max,probability:b.correct/b.count,samples:b.count}))};
}
export function calibratedProbability(profile:Profile|undefined,group:string,score:number):number|null{
  if(!profile||profile.version!==12||profile.group!==group||profile.samples<50||profile.independence!=='held-out-human-judged')return null;
  if(score<profile.bins[0]?.min||score>profile.bins.at(-1)!.max)return null;
  const bin=profile.bins.find(b=>score<=b.max);return bin?.probability??null;
}
export function reliability(rows:Judgment[]){
  return Array.from({length:10},(_,i)=>{
    const selected=rows.filter(r=>r.score>=i/10&&(r.score<(i+1)/10||i===9&&r.score===1));
    return {from:i/10,to:(i+1)/10,samples:selected.length,observedCorrectness:selected.length?selected.filter(r=>r.correct).length/selected.length:null};
  });
}
