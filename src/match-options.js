import {mode} from './data.js';
import {getMap} from './maps.js';
const integer=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
export function matchOptions(options={}) {
 const m=mode(options.mode);
 if(m.id==='royale') return {map:'sunnybreak',mode:'royale',bots:integer(options.bots,15,0,15),difficulty:integer(options.difficulty,2,1,4),minutes:0,scoreLimit:1,capacity:integer(options.capacity,16,2,16),storm:options.storm==='quick'?'quick':'normal',fill:!!options.fill};
 return {map:getMap(options.map==='sunnybreak'?'yard':options.map).id,mode:m.id,bots:integer(options.bots,0,0,7),difficulty:integer(options.difficulty,2,1,4),minutes:integer(options.minutes,5,1,60),scoreLimit:integer(options.scoreLimit,m.limit,1,1000),capacity:8,fill:!!options.fill};
}
export const targetLabel=()=> 'Eliminations to win';
