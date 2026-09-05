import type { Relation } from './types';
/** Schemas belong to a store instance. Source predicate identity is never discarded. */
export function relations(): Relation[] {
  const text = ['definition','cause','effect','purpose','mechanism','importance','example','habitat','diet','color','material','symbol','formula','origin','birthplace','residence','headquarters','citizenship','language','official_language','spoken_language','location','country','continent','capital','creator','author','inventor','discoverer','works','component','part_of','has_part','requires','steps','size','average_distance','orbit_period','rotation_period','boiling_point','melting_point','atomic_number','leg_count','lifespan','is_a','instance_of','subclass_of','related_to','ability'];
  text.push('mass','diameter','discoverer_or_inventor');
  return text.map(id => ({ id, aliases: [id.replaceAll('_',' ')], domain: [], range: (['mass','diameter'].includes(id)?['number']:['definition','cause','mechanism','purpose','importance'].includes(id) ? ['text'] : ['text','entity','number','boolean','list']) as Relation['range'], world: 'open',
    inverse: ({ capital:'capital_of', part_of:'has_part', has_part:'part_of', creator:'created', author:'authored', location:'contains', country:'contains_country_member', requires:'required_by' } as Record<string,string>)[id],
    symmetric: id === 'related_to', transitive: ['subclass_of','part_of'].includes(id), inherited: ['ability','leg_count','habitat','diet','is_a'].includes(id),
    functional: ['capital','leg_count','atomic_number','symbol','formula','birthplace'].includes(id),
  }));
}
export const sourceMappings: Record<string, { relation: string; reverse?: boolean }> = {
  P36:{ relation:'capital' }, P1376:{ relation:'capital', reverse:true }, P31:{ relation:'instance_of' }, P279:{ relation:'subclass_of' },
  P37:{ relation:'official_language' }, P1412:{ relation:'spoken_language' }, P19:{ relation:'birthplace' }, P20:{ relation:'deathplace' },
  P551:{ relation:'residence' }, P27:{ relation:'citizenship' }, P159:{ relation:'headquarters' }, P17:{ relation:'country' }, P131:{ relation:'administrative_area' }, P276:{ relation:'location' },
  // P61 explicitly combines discovery/invention; never narrow it without reviewed evidence.
  P61:{ relation:'discoverer_or_inventor' }, P170:{ relation:'creator' }, P50:{ relation:'author' }, P127:{ relation:'owner' }, P361:{ relation:'part_of' }, P527:{ relation:'has_part' },
  P509:{relation:'cause_of_death'},P1196:{relation:'manner_of_death'},P828:{relation:'caused_by'},
};
