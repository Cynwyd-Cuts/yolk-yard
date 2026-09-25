import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
function room(){const s=new Simulation({mode:'teams',bots:0});for(let i=0;i<4;i++)s.addPlayer('p'+i,{name:'Player '+i});s.startRound();return s;}
test('team selection allows either side until the side leads by two',()=>{for(const choice of [0,1]){const s=room();s.players.get('p1').team=0;s.players.get('p2').team=0;s.players.get('p3').team=1;s.playerAction('p0','team-entry-'+choice);assert.equal(s.players.get('p0').team,choice);assert.equal(s.players.get('p0').spawnRequested,true);}});
test('host rejects an oversized team and enforces shell color after profile changes',()=>{const s=room();for(const id of ['p1','p2','p3'])s.players.get(id).team=0;s.playerAction('p0','team-entry-0');const p=s.players.get('p0');assert.equal(p.team,1);assert.equal(p.color,'#d94949');s.setProfile('p0',{name:p.name,color:'#ffffff',pattern:3});assert.equal(p.color,'#d94949');assert.equal(p.pattern,0);s.spawn(p);assert.equal(p.color,'#d94949');});
test('active players cannot switch teams using entry actions',()=>{const s=room(),p=s.players.get('p0');s.spawn(p);const team=p.team;s.playerAction(p.id,'team-entry-'+(1-team));assert.equal(p.team,team);});
