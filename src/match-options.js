import {mode} from './data.js';
import {getMap} from './maps.js';
const integer=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
export function matchOptions(options={}) {
 const m=mode(options.mode);
 return {map:getMap(options.map).id,mode:m.id,bots:integer(options.bots,0,0,7),difficulty:integer(options.difficulty,2,1,3),minutes:integer(options.minutes,5,1,60),scoreLimit:integer(options.scoreLimit,m.limit,1,1000)};
}
export const targetLabel=id=>id==='capture'?'Captures to win':id==='control'?'Points to win':'Eliminations to win';
