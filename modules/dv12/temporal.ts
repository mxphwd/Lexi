export function validDate(s:string):boolean{
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
}
function point(s:string,end=false){return /^\d{4}$/.test(s)?s+(end?'-12-31':'-01-01'):s;}
function previousDay(value:string){const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);}
function nextDay(value:string){const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
function ordinalCentury(value:string){
  const n=Number(value.replace(/(?:st|nd|rd|th)$/i,''));
  if(!Number.isSafeInteger(n)||n<1||n>99)throw new Error('INVALID_TEMPORAL_CENTURY');
  return {from:String((n-1)*100+1).padStart(4,'0')+'-01-01',to:String(n*100).padStart(4,'0')+'-12-31'};
}
export function temporalSuffix(input:string,now=new Date().toISOString().slice(0,10)){
  let m:RegExpMatchArray|null;
  if((m=input.match(/\s+(?:between|from) (\d{4}(?:-\d{2}-\d{2})?) (?:and|to|through) (\d{4}(?:-\d{2}-\d{2})?)[.!?]*$/i))){
    const from=point(m[1]),to=point(m[2],true);if(!validDate(from)||!validDate(to)||from>to)throw new Error('INVALID_TEMPORAL_RANGE');
    return {text:input.slice(0,m.index),from,to,kind:'closed' as const};
  }
  if((m=input.match(/\s+(?:in|on|during|as of) (\d{4}(?:-\d{2}-\d{2})?)[.!?]*$/i))){
    const from=point(m[1]),to=point(m[1],true);if(!validDate(from)||!validDate(to))throw new Error('INVALID_TEMPORAL_DATE');
    return {text:input.slice(0,m.index),from,to,kind:'point' as const};
  }
  if((m=input.match(/\s+(?:as of )?(today|yesterday|tomorrow)[.!?]*$/i))){
    const date=new Date(now);date.setUTCDate(date.getUTCDate()+({today:0,yesterday:-1,tomorrow:1}[m[1].toLowerCase()]??0));
    return {text:input.slice(0,m.index),from:date.toISOString().slice(0,10),to:date.toISOString().slice(0,10),kind:'relative' as const};
  }
  if((m=input.match(/\s+(?:in|during) (?:the )?(\d{1,2}(?:st|nd|rd|th)) century[.!?]*$/i))){
    const interval=ordinalCentury(m[1]);return {text:input.slice(0,m.index),...interval,kind:'century' as const};
  }
  if((m=input.match(/\s+(before|after|since|until) (\d{4}(?:-\d{2}-\d{2})?)[.!?]*$/i))){
    const boundaryStart=point(m[2]),boundaryEnd=point(m[2],true);if(!validDate(boundaryStart)||!validDate(boundaryEnd))throw new Error('INVALID_TEMPORAL_DATE');
    if(/^(?:after|since)$/i.test(m[1]))return {text:input.slice(0,m.index),from:m[1].toLowerCase()==='after'?nextDay(boundaryEnd):boundaryStart,to:now,kind:'after' as const};
    return {text:input.slice(0,m.index),from:'0001-01-01',to:m[1].toLowerCase()==='before'?previousDay(boundaryStart):boundaryEnd,kind:'before' as const};
  }
}
