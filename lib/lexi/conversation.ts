import type { LexiReply } from './types';
export type ConversationTurn = {id:number;prompt:string;reply:LexiReply};
/** Session-local UI history; never persisted or submitted as trusted facts. */
export function appendTurn(turns: ConversationTurn[], turn: ConversationTurn): ConversationTurn[] {
  return [...turns.filter(item => item.id !== turn.id), turn].slice(-32);
}
