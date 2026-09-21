import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {matchOptions} from '../src/match-options.js';
import {MAPS} from '../src/maps.js';
test('round rules bound invalid values and use mode-specific defaults',()=>{
 assert.equal(matchOptions({mode:'capture'}).scoreLimit,3);
 assert.equal(matchOptions({minutes:Infinity}).minutes,5);
 const o=matchOptions({minutes:900,scoreLimit:-2,bots:3.7,difficulty:99});
 assert.deepEqual([o.minutes,o.scoreLimit,o.bots,o.difficulty],[60,1,4,3]);
});
test('configured score targets end all four modes, not the old hardcoded target',()=>{
 for(const mode of ['ffa','teams','capture','control']){
  const s=new Simulation({mode,scoreLimit:7,minutes:2,bots:0});s.addPlayer('host',{name:'Host'});s.startRound();
  if(mode==='ffa')s.players.get('host').kills=6;else s.scores[0]=6;
  s.tick(.01);assert.equal(s.phase,'playing');
  if(mode==='ffa')s.players.get('host').kills=7;else s.scores[0]=7;
  s.tick(.01);assert.equal(s.phase,'results');
 }
});
test('time limit and rematch reconfiguration preserve people and replace old bots',()=>{
 const s=new Simulation({minutes:1,bots:3});s.addPlayer('host',{name:'Host'});s.addPlayer('guest',{name:'Guest'});s.startRound();
 assert.equal(s.remaining,60);assert.equal(s.players.size,5);
 assert.equal(s.configure({minutes:30}),false);
 s.remaining=.01;s.tick(.02);assert.equal(s.phase,'results');
 const round=s.round;
 assert.equal(s.configure({map:MAPS[1].id,mode:'capture',minutes:12,scoreLimit:5,bots:1,difficulty:3}),true);
 assert.equal(s.players.size,2);s.startRound();
 assert.equal(s.round,round+1);assert.equal(s.remaining,720);assert.equal(s.players.size,3);
 assert.equal(s.players.get('guest').name,'Guest');assert.equal(s.map.id,MAPS[1].id);
 assert.equal(s.snapshot().options.scoreLimit,5);
});
