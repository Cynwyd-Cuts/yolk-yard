import test from 'node:test';
import assert from 'node:assert/strict';
import {HostHeartbeat} from '../src/host-heartbeat.js';

test('heartbeat replies keep a room connected while snapshots are delayed',()=>{
 const h=new HostHeartbeat(0);
 for(let now=2000;now<=60000;now+=2000){h.contact(now-100);assert.equal(h.expired(now),false);}
});

test('a silent host gets a probe grace period and then expires',()=>{
 const h=new HostHeartbeat(0);
 for(let now=2000;now<16000;now+=2000)assert.equal(h.expired(now),false);
 assert.equal(h.expired(16000),true);
 h.contact(16001);assert.equal(h.expired(18000),false);
});

test('a guest resuming after its own long pause first gives the host time to reply',()=>{
 const h=new HostHeartbeat(0);
 assert.equal(h.expired(30000),false);
 assert.equal(h.expired(32000),false);
 h.contact(32001);
 for(let now=34000;now<=42000;now+=2000)assert.equal(h.expired(now),false);
});
