import type { Store } from './store';
import type { Fact } from './types';
/** Small reviewed repair pack. These are measured properties, not phrase permutations. */
export function installFoundations(store:Store){
  store.addSchema({id:'diameter',aliases:['diameter','size'],domain:['celestial-body'],range:['number'],dimension:'length',functional:true,world:'open'});
  const source:Fact['source']={id:'NASA-JPL:planetary-physical-parameters',location:'https://ssd.jpl.nasa.gov/planets/phys_par.html',method:'diameter = 2 × tabulated mean radius; uncertainty scaled by 2',review:'source-attested',license:'factual numerical data; NASA/JPL attribution',snapshot:'2026-09-04'};
  const radii: Array<[string,number,number]>=[
    ['mercury',2439.4,.1],['venus',6051.8,1],['earth',6371.0084,.0001],['mars',3389.5,.2],
    ['jupiter',69911,6],['saturn',58232,6],['uranus',25362,7],['neptune',24622,19],
  ];
  for(const [name,radius,uncertainty] of radii)store.addFact({id:'dv12:jpl:'+name+':mean-diameter',subject:'space-'+name,relation:'diameter',object:{kind:'number',value:2*radius,unit:'km',uncertainty:2*uncertainty},scope:'mean diameter; major Solar System planet',source});
  const finance=store.resolve('bank')[0];if(finance)store.addEntity({...finance,domain:'finance'});
  store.addEntity({id:'dv12:river-bank',name:'river bank',aliases:['bank','riverbank'],type:'place',domain:'geography'});
  store.addFact({id:'dv12:river-bank:definition',subject:'dv12:river-bank',relation:'definition',object:{kind:'text',value:'the land alongside a river'},source:{id:'alphaine:lexical-distinction',location:'modules/dv12/foundations.ts',method:'explicit distinction of river edge and financial institution',review:'seed',license:'alphaine-project-data'}});
}
