import type { Store } from './store';
import type { Fact } from './types';
/** Small reviewed repair pack. These are measured properties, not phrase permutations. */
export function installFoundations(store:Store){
  // Reviewed contracts override permissive legacy migration schemas while
  // retaining literal values that have not yet been safely decomposed.
  store.addSchema({id:'capital',aliases:['capital','capital city'],domain:['country','polity','concept'],range:['entity','text'],objectTypes:['place','concept'],inverse:'capital_of',functional:true,temporal:'changing',world:'open'});
  store.addSchema({id:'country',aliases:['country','located in country'],domain:['place','person','organization','object','concept'],range:['entity','text'],objectTypes:['country','concept'],inverse:'contains_country_member',temporal:'changing',world:'open'});
  store.addSchema({id:'birthplace',aliases:['birthplace','place of birth','born in'],domain:['person','concept'],range:['entity','text'],objectTypes:['place','country','concept'],functional:true,temporal:'stable',world:'open'});
  store.addSchema({id:'inventor',aliases:['inventor','invented by'],domain:['object','technology','concept'],range:['entity','text'],objectTypes:['person','organization','concept'],inverse:'invented',temporal:'stable',world:'open'});
  store.addSchema({id:'invented',aliases:['invented','inventions'],domain:['person','organization'],range:['entity'],objectTypes:['object','technology'],inverse:'inventor',world:'open'});
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
  // The older seed stores this as a prose attribution. This reviewed edge is
  // what permits role-safe inverse questions without extracting a name from prose.
  if(store.entity('technology-telephone')&&store.entity('person-alexander-bell'))store.addFact({id:'dv14:telephone:inventor:bell',subject:'technology-telephone',relation:'inventor',object:{kind:'entity',id:'person-alexander-bell'},source:{id:'alphaine:reviewed-identity-edge',location:'modules/dv12/foundations.ts#telephone-inventor',method:'reviewed normalization of existing curated attribution',review:'reviewed',license:'alphaine-project-data',snapshot:'2026-09-15'}});
}
