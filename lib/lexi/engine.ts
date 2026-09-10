/** Authoritative DV13 API, using the compatible DV12 execution contract. */
import { Session } from '../../modules/dv12/runtime';
import type { Options } from '../../modules/dv12/types';
import type { ResourceLoader } from '../../modules/dv12/runtime';
export { Session as LexiSession } from '../../modules/dv12/runtime';
export function createLexiSession(){return new Session();}
export function respond(input:string){return new Session().respond(input);}
export function respondAsync(input:string,options:Options&{loader?:ResourceLoader}={}){return new Session().respondAsync(input,options);}
