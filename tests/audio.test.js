import test from 'node:test';
import assert from 'node:assert/strict';
import {Sound,SOUND_CUES,SHOT_PALETTE} from '../src/audio.js';
const finite=(...values)=>values.forEach(v=>assert.ok(Number.isFinite(v)));
class Parameter{value=0;setValueAtTime(...v){finite(...v);}setTargetAtTime(...v){finite(...v);}linearRampToValueAtTime(...v){finite(...v);}exponentialRampToValueAtTime(...v){finite(...v);assert.ok(v[0]>0);}}
class AudioNode{gain=new Parameter();frequency=new Parameter();pan=new Parameter();Q=new Parameter();connect(n){return n;}disconnect(){}start(t=0){finite(t);}stop(t=0){finite(t);} }
class Context{currentTime=0;sampleRate=1000;destination=new AudioNode();resume(){return Promise.resolve();}createGain(){return new AudioNode();}createDynamicsCompressor(){return new AudioNode();}createBufferSource(){return new AudioNode();}createOscillator(){return new AudioNode();}createStereoPanner(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}}
test('every authored cue and eleven weapon palettes schedule finite audio envelopes and release voices',()=>{
 globalThis.window={AudioContext:Context};const s=new Sound();s.unlock();assert.ok(Object.keys(SOUND_CUES).length>=70);assert.equal(Object.keys(SHOT_PALETTE).length,11);
 for(const cue of Object.keys(SOUND_CUES)){s.clock++;s.cue(cue);assert.ok(s.voices.size>0,cue);for(const voice of [...s.voices])voice.onended();assert.equal(s.voices.size,0);}
 for(const gun of Object.keys(SHOT_PALETTE)){s.shot(gun);assert.ok(s.voices.size>0);for(const v of [...s.voices])v.onended();}
 s.setVolumes({volume:0});s.cue('chest-open');assert.equal(s.voices.size,0);
});
test('audio bounds concurrent voices, spatial gain, continuous loops and category muting',()=>{
 globalThis.window={AudioContext:Context};const s=new Sound();s.unlock();s.listener={x:0,z:0,yaw:0};assert.ok(s.spatial({x:100,z:0}).gain<s.spatial({x:1,z:0}).gain);assert.ok(s.spatial({x:-10,z:0}).pan<0);
 for(let i=0;i<100;i++)s.tone(500);assert.equal(s.voices.size,56);for(const v of [...s.voices])v.onended();s.setVolumes({effectsVolume:0});s.cue('weapon-empty');assert.equal(s.voices.size,0);
 s.loop('wind',1);assert.equal(s.loops.size,1);s.stopWorld();assert.equal(s.loops.size,0);s.setVolumes({volume:0});assert.equal(s.volume,0);
});
