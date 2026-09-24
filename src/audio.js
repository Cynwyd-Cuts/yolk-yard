// Original procedural sound palette. Every sound is generated locally, with no samples/CDN.
import {ITEMS} from './royale-data.js';
const note=(f,d=.12,v=.12,w='sine',to=0,at=0)=>({f,d,v,w,to,at});
const noise=(f,d=.15,v=.15,at=0)=>({noise:true,f,d,v,at});
export const SOUND_CUES={
 'ui-select':[note(660,.05,.05),note(990,.07,.04,'sine',0,.035)],
 'ui-back':[note(440,.07,.055,'sine',280)],
 'ui-error':[note(180,.15,.06,'triangle',90)],
 'queue-found':[note(440),note(554,.15,.1,'sine',0,.1),note(660,.23,.1,'sine',0,.2)],
 'countdown':[note(800,.07,.07)],'round-start':[note(330,.15),note(440,.16,.12,'triangle',0,.13),note(660,.4,.12,'sine',0,.25)],
 'transport-horn':[note(196,.55,.1,'sawtooth',220),note(294,.6,.055,'triangle')],
 'transport-exit':[noise(600,.45,.18),note(320,.23,.07,'sine',100)],
 'glider-deploy':[noise(1200,.35,.2),note(180,.16,.1,'triangle',65),noise(3300,.08,.1,.15)],
 'glider-flap':[noise(800,.28,.05)],'glider-cut':[noise(2400,.12,.08),note(280,.08,.08,'triangle',100)],
 jump:[noise(850,.1,.07),note(180,.1,.055,'sine',350)],
 land:[noise(220,.18,.14),note(90,.13,.1,'triangle',40)],
 'stamina-empty':[noise(420,.28,.065),note(150,.09,.04,'sine',80)],
 'stamina-ready':[note(470,.075,.035),note(680,.1,.035,'sine',0,.1)],
 'weapon-swap':[noise(2100,.07,.055),note(390,.045,.035,'triangle',160)],
 'weapon-empty':[noise(3000,.035,.05),note(850,.025,.03,'square',300)],
 'reload-out':[noise(1300,.11,.085),note(230,.055,.05,'triangle',110)],
 'reload-in':[noise(1700,.09,.11),note(380,.04,.06,'square',90)],
 'reload-bolt':[noise(2700,.1,.085),noise(500,.05,.075,.065)],
 'shell-casing':[note(2100,.07,.015,'sine',1200,.05),noise(4500,.025,.025,.05)],
 'bullet-flyby':[noise(4500,.12,.07),note(1700,.08,.035,'sine',300)],
 'impact-stone':[noise(3100,.075,.09),note(350,.05,.04,'triangle',160)],
 'impact-wood':[noise(800,.1,.07),note(210,.08,.04,'triangle',70)],
 ricochet:[note(2200,.18,.055,'sine',650),noise(4200,.04,.04)],
 'shield-hit':[note(950,.13,.085,'sine',350),noise(3000,.08,.055)],
 'shield-break':[note(1700,.27,.09,'sine',190),noise(4700,.3,.1),note(2300,.12,.04,'sine',900,.06)],
 'health-hit':[noise(350,.09,.08),note(170,.07,.08,'triangle',75)],
 'chest-hum':[note(523,.8,.016),note(784,.8,.009)],
 'chest-search':[note(440,.5,.035),note(554,.5,.02),noise(1500,.2,.035)],
 'pickaxe-swing':[noise(1100,.14,.12)],
 'build-place':[noise(650,.1,.18),note(190,.1,.1,'triangle',80)],
 'harvest-hit':[noise(950,.09,.2),note(230,.07,.08,'triangle',100)],
 'chest-open':[noise(750,.25,.14),note(523,.2,.1),note(659,.22,.1,'sine',0,.12),note(784,.3,.1,'sine',0,.24),note(1046,.5,.08,'sine',0,.36)],
 'ammo-pickup':[noise(2800,.08,.055),note(650,.07,.05,'triangle',950)],
 'item-drop':[noise(500,.09,.065),note(200,.08,.035,'sine',90)],
 'use-cancel':[note(260,.08,.035,'sine',160)],
 'impulse':[note(100,.4,.17,'sine',550),noise(850,.38,.12)],
 launch:[noise(320,.3,.16),note(120,.5,.12,'triangle',700)],
 'supply-incoming':[note(740,.18,.06),note(980,.23,.07,'sine',0,.22),noise(550,.7,.03)],
 'supply-land':[noise(200,.35,.18),note(80,.2,.1,'triangle',40)],
 'storm-reveal':[note(330,.25,.07),note(277,.3,.07,'sine',0,.22),note(220,.5,.07,'sine',0,.44)],
 'storm-closing':[note(240,.32,.1,'triangle',160),note(190,.4,.08,'triangle',120,.32),noise(600,.65,.04)],
 'storm-enter':[noise(900,.5,.12),note(220,.45,.06,'sine',90)],
 'storm-exit':[noise(2000,.23,.05),note(440,.17,.05,'sine',800)],
 'storm-tick':[noise(400,.12,.035),note(110,.1,.035,'sine',80)],
 elimination:[note(740,.15,.08),note(1108,.25,.07,'triangle',0,.11)],
 'shell-down':[noise(1100,.23,.09),note(420,.45,.1,'triangle',65)],
 'spectator-switch':[noise(2400,.09,.025),note(520,.08,.04,'sine',780)],
 'top-ten':[note(440,.12,.055),note(587,.18,.06,'sine',0,.12),note(880,.25,.05,'sine',0,.24)],
 'final-duel':[note(196,.25,.08,'triangle'),note(294,.3,.07,'triangle',0,.2),note(392,.4,.08,'triangle',0,.4)],
 victory:[note(523,.23,.10,'triangle'),note(659,.23,.10,'triangle',0,.2),note(784,.25,.10,'triangle',0,.4),note(1046,.9,.1,'sine',0,.65),note(659,.9,.05,'sine',0,.65)],
 defeat:[note(392,.25,.06),note(330,.25,.06,'sine',0,.23),note(262,.5,.06,'sine',0,.46)],
 'ambient-bird':[note(1800,.11,.02,'sine',2500),note(2100,.16,.018,'sine',1500,.2)],
 'ambient-bell':[note(740,1.6,.025),note(1110,1.3,.009)],
};
for(let i=0;i<5;i++)SOUND_CUES['pickup-'+i]=[note(460+i*100,.1,.08),note(690+i*130,.16,.06,'sine',0,.07),...(i>1?[note(920+i*100,.25,.05,'sine',0,.16)]:[])];
for(const [i,id]of Object.keys(ITEMS).entries()){
 SOUND_CUES['use-'+id]=id==='bandage'?[noise(2200,.5,.08)]:id==='medkit'?[noise(1800,.22,.07),note(660,.1,.04)]:['mini','flask'].includes(id)?[noise(550,.35,.055),note(320+i*40,.25,.05,'sine',550)]:[noise(1200,.12,.055),note(400+i*30,.1,.05)];
 SOUND_CUES['complete-'+id]=id==='impulse'?SOUND_CUES.impulse:id==='launchpad'?SOUND_CUES.launch:[note(550+i*35,.16,.075),note(830+i*35,.2,.06,'sine',0,.11),noise(2100,.16,.045)];
}
export const SHOT_PALETTE={sprinter:[145,1200,.15],scatter:[78,700,.25],needle:[62,2100,.33],zipper:[210,1900,.10],thumper:[52,500,.45],anchor:[100,1100,.19],duet:[185,1800,.14],pip:[240,1800,.12],peeper:[105,2500,.21],doubleyolk:[95,900,.21],comet:[520,2400,.18]};
export class Sound {
 constructor(){this.ctx=null;this.volume=.45;this.effectsVolume=.85;this.ambienceVolume=.5;this.musicVolume=.3;this.enabled=true;this.voices=new Set();this.loops=new Map();this.cooldowns=new Map();this.listener=null;this.clock=0;this.lastAlive=0;this.wasStorm=false;this.wasExhausted=false;this.reloadTimers=[];}
 unlock(){
  if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){this.ctx=new Audio();this.master=this.ctx.createGain();this.compressor=this.ctx.createDynamicsCompressor();this.master.connect(this.compressor).connect(this.ctx.destination);this.master.gain.value=this.volume;const size=this.ctx.sampleRate*2;this.noiseBuffer=this.ctx.createBuffer(1,size,this.ctx.sampleRate);const a=this.noiseBuffer.getChannelData(0);let seed=12345;for(let i=0;i<size;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=seed/2147483648-1;}}}
  this.ctx?.resume().catch(()=>{});
 }
 setVolumes(settings){this.volume=settings.volume??this.volume;this.effectsVolume=settings.effectsVolume??.85;this.ambienceVolume=settings.ambienceVolume??.5;this.musicVolume=settings.musicVolume??.3;if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.03);}
 spatial(position){
  if(!position||!this.listener)return {gain:1,pan:0};
  const dx=position.x-this.listener.x,dz=position.z-this.listener.z,dy=(position.y||0)-(this.listener.y||0),d=Math.hypot(dx,dy,dz),radius=position.radius||65;
  if(d>=radius)return {gain:0,pan:0};
  return {gain:(1-d/radius)**2/(1+(d/22)**1.1),pan:Math.max(-.95,Math.min(.95,(dx*Math.cos(this.listener.yaw)-dz*Math.sin(this.listener.yaw))/Math.max(1,d)))};
 }
 layer(p,position,category='effects',scale=1){
  if(!this.ctx||!this.enabled||this.volume<=0||this.voices.size>=56)return;
  const c=this.ctx,at=c.currentTime+(p.at||0),sp=this.spatial(position),volume=p.v*scale*sp.gain*(category==='music'?this.musicVolume:category==='ambience'?this.ambienceVolume:this.effectsVolume);
  if(volume<.0002)return;
  let source,filter;
  if(p.noise){source=c.createBufferSource();source.buffer=this.noiseBuffer;filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=p.f;filter.Q.value=.7;source.connect(filter);}
  else{source=c.createOscillator();source.type=p.w||'sine';source.frequency.setValueAtTime(p.f,at);if(p.to)source.frequency.exponentialRampToValueAtTime(Math.max(20,p.to),at+p.d);}
  const gain=c.createGain(),pan=c.createStereoPanner();pan.pan.value=sp.pan;
  gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+p.d);
  (filter||source).connect(gain).connect(pan).connect(this.master);this.voices.add(source);
  source.onended=()=>{this.voices.delete(source);source.disconnect();filter?.disconnect();gain.disconnect();pan.disconnect();};
  source.start(at);source.stop(at+p.d+.01);
 }
 cue(id,position=null,scale=1){
  const preset=SOUND_CUES[id];if(!preset)return;
  const category=id==='victory'||id==='defeat'?'music':id.startsWith('ambient')?'ambience':'effects';
  const key=id+(position?Math.round(position.x/5)+':'+Math.round(position.z/5):'');
  if((this.cooldowns.get(key)||0)>this.clock)return;this.cooldowns.set(key,this.clock+.05);
  const radius=id.includes('chest')?16:id.includes('impact')||id.includes('hit')||id==='ricochet'?30:id==='supply-land'?110:id==='ambient-bell'?95:id.includes('glider')?24:id==='land'||id==='jump'?20:45;
  preset.forEach(p=>this.layer(p,position?{...position,radius}:null,category,scale));
 }
 tone(freq,duration=.09,type='sine',volume=.15,end=0){this.layer(note(freq,duration,volume,type,end));}
 shot(id,distance=0,position=null){if(!position&&distance>160)return;if(position)position={...position,radius:id==='thumper'?190:['needle','anchor','peeper'].includes(id)?170:125};const [f,filter,d]=SHOT_PALETTE[id]||SHOT_PALETTE.sprinter;const scale=position?1:1/(1+distance/15);this.layer(note(f,d,.16,id==='comet'?'sine':'triangle',id==='comet'?180:35),position,'effects',scale);this.layer(noise(filter,d*.65,.15),position,'effects',scale);this.layer(note(filter*.65,.045,.025,'square',140),position,'effects',scale);if(distance<15)this.cue('shell-casing',position,.7);}
 death(distance=0,position=null){if(distance>38)return;this.cue('shell-down',position,1/(1+distance/12));}
 hit(){this.layer(note(950,.065,.11,'sine',1400));}
 pop(distance=0,position=null){if(distance>190)return;const source=position?{...position,radius:190}:null,scale=source?1:1/(1+distance/18);this.layer(noise(160,.38,.25),source,'effects',scale);this.layer(note(70,.4,.17,'triangle',25),source,'effects',scale);}
 pickup(){this.cue('pickup-1');}eliminate(){this.cue('elimination');}
 reload(duration=1.2){this.cue('reload-out');for(const p of SOUND_CUES['reload-in'])this.layer({...p,at:Math.max(.1,duration*.68)+(p.at||0)});}
 loop(id,target,{freq=300,volume=.06,noise:useNoise=true}={}){
  if(!this.ctx)return;
  let loop=this.loops.get(id);
  if(!loop&&target>0){const c=this.ctx,source=useNoise?c.createBufferSource():c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain();
   if(useNoise){source.buffer=this.noiseBuffer;source.loop=true;}else{source.type='sine';source.frequency.value=freq;}
   filter.type='lowpass';filter.frequency.value=freq;gain.gain.value=0;source.connect(filter).connect(gain).connect(this.master);source.start();loop={source,filter,gain};this.loops.set(id,loop);
  }
  if(loop){loop.gain.gain.setTargetAtTime(Math.max(0,target)*volume*this.ambienceVolume,this.ctx.currentTime,.3);if(!target){if(!loop.silentAt)loop.silentAt=this.clock;if(this.clock-loop.silentAt>1.5){loop.source.stop();loop.source.disconnect();loop.filter.disconnect();loop.gain.disconnect();this.loops.delete(id);}}else loop.silentAt=0;}
 }
 stopWorld(){for(const loop of this.loops.values()){loop.source.stop();loop.source.disconnect();loop.filter.disconnect();loop.gain.disconnect();}this.loops.clear();this.wasStorm=false;this.lastAlive=0;this.lastStormTick=null;}
 event(e,me,state){
  if(e.type==='round')this.cue('round-start');
  if(e.type==='royale-cue'){
   // Personal inventory cues are local, spatial actions are audible to nearby eggs.
   if(e.player&&e.player!==me?.id&&e.x===undefined)return;
   if(e.cue==='victory')this.cue(state.royale?.winnerId===me?.id?'victory':'defeat');
   else this.cue(e.cue,e.x===undefined?null:e);
  }
  if(e.type==='royale-eliminated'&&e.player===me?.id)this.cue('defeat');
  if(e.type==='impact')this.cue(e.tag?'health-hit':e.y>2?'impact-wood':'impact-stone',e,.55);
  if(e.type==='shot'&&e.player!==me?.id&&me&&e.origin){const dx=me.x-e.origin.x,dz=me.z-e.origin.z;const d=Math.hypot(dx,dz);if(d<30)this.cue('bullet-flyby',e.origin,.4);}
  if(e.type==='bounce')this.cue('ricochet',e,.4);
 }
 update(state,me,dt,playing){
  this.clock+=dt;this.listener=me;
  if(!playing||!state||!me){if(this.loops.size)this.stopWorld();return;}
  const royale=state.royale,ground=me.flight==='ground'||!royale;
  this.loop('island',royale?.18:0,{freq:900,volume:.055});
  this.loop('transport',me.flight==='transport'?1:0,{freq:72,volume:.13,noise:false});
  this.loop('rotor',me.flight==='transport'?(.7+Math.sin(this.clock*20)*.2):0,{freq:220,volume:.08});
  this.loop('wind',me.flight==='dive'?1:me.flight==='glide'?.5:0,{freq:me.flight==='dive'?1700:700,volume:.14});
  const outside=!!royale?.storm?.active&&me.health>0&&Math.hypot(me.x-royale.storm.x,me.z-royale.storm.z)>royale.storm.radius;
  this.loop('storm',outside?1:0,{freq:650,volume:.13});
  const countdown=royale?.storm&&!royale.storm.closing?Math.ceil(royale.storm.seconds):0;
  const countdownKey=royale?.storm?.index+':'+countdown;
  if(countdown>=1&&countdown<=5&&countdownKey!==this.lastStormTick){this.lastStormTick=countdownKey;this.cue('countdown');}
  if(me.flight==='glide'&&this.clock-(this.lastFlap||0)>2.4){this.lastFlap=this.clock;this.cue('glider-flap');}
  if(outside!==this.wasStorm){this.cue(outside?'storm-enter':'storm-exit');this.wasStorm=outside;}
  if(me.exhausted&&!this.wasExhausted)this.cue('stamina-empty');if(!me.exhausted&&this.wasExhausted)this.cue('stamina-ready');this.wasExhausted=!!me.exhausted;
  if(royale){if(this.lastAlive>10&&royale.alive<=10)this.cue('top-ten');if(this.lastAlive>2&&royale.alive===2)this.cue('final-duel');this.lastAlive=royale.alive;}
  if(ground&&royale&&Math.floor(this.clock/9)!==this.lastBird){this.lastBird=Math.floor(this.clock/9);this.cue('ambient-bird',{x:me.x+20,z:me.z-15});}
  if(ground&&royale&&this.clock-(this.lastBell||0)>28&&Math.hypot(me.x,me.z)<70){this.lastBell=this.clock;this.cue('ambient-bell',{x:0,z:-6});}
  if(ground&&royale&&this.clock-(this.lastChestHum||0)>.85){this.lastChestHum=this.clock;const chest=royale.chests?.find(c=>!c.opened&&(!c.landAt||c.landAt<state.time)&&Math.hypot(c.x-me.x,c.z-me.z)<12);if(chest)this.cue('chest-hum',chest);}
  if(this.cooldowns.size>300)this.cooldowns.clear();
 }
}
