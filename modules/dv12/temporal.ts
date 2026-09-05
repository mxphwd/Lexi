export function validDate(s:string):boolean{
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
}
function point(s:string,end=false){return /^\d{4}$/.test(s)?s+(end?'-12-31':'-01-01'):s;}
export function temporalSuffix(input:string,now=new Date().toISOString().slice(0,10)){
  let m:RegExpMatchArray|null;
  if((m=input.match(/\s+(?:between|from) (\d{4}(?:-\d{2}-\d{2})?) (?:and|to|through) (\d{4}(?:-\d{2}-\d{2})?)[.!?]*$/i))){
    const from=point(m[1]),to=point(m[2],true);if(!validDate(from)||!validDate(to)||from>to)throw new Error('INVALID_TEMPORAL_RANGE');
    return {text:input.slice(0,m.index),from,to};
  }
  if((m=input.match(/\s+(?:in|on|as of) (\d{4}(?:-\d{2}-\d{2})?)[.!?]*$/i))){
    const from=point(m[1]),to=point(m[1],true);if(!validDate(from)||!validDate(to))throw new Error('INVALID_TEMPORAL_DATE');
    return {text:input.slice(0,m.index),from,to};
  }
  if((m=input.match(/\s+(today|yesterday|tomorrow)[.!?]*$/i))){
    const date=new Date(now);date.setUTCDate(date.getUTCDate()+({today:0,yesterday:-1,tomorrow:1}[m[1].toLowerCase()]??0));
    return {text:input.slice(0,m.index),from:date.toISOString().slice(0,10),to:date.toISOString().slice(0,10)};
  }
}
