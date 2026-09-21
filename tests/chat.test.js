import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateText, safeName, CHAT_LIMIT, FILTER_VERSION } from '../src/moderation.js';
import { ChatRoom, ChatInbox, QUICK_MESSAGES } from '../src/chat.js';
import { safeProfile } from '../src/data.js';
import { cleanListing } from '../src/directory.js';
import { PROFANITY_TERMS } from '../src/profanity-terms.js';

const state={phase:'playing',options:{mode:'teams'},players:[
  {id:'host',name:'Host egg',team:0}, {id:'a',name:'Alpha',team:1},
  {id:'b',name:'Bravo',team:0}, {id:'s',name:'Watcher',team:1,spectating:true},
  {id:'t',name:'Observer',team:0,spectating:true}, {id:'bot',name:'Bot',bot:true,team:0},
]};
const packet=(text,channel='room')=>({version:FILTER_VERSION,text,channel});
const profanity=String.fromCharCode(102,117,99,107);
const slur=String.fromCharCode(110,105,103,103,101,114);

test('every supplied entry and canonical form is blocked in messages and player names',()=>{
  assert.equal(PROFANITY_TERMS.length,3717);
  assert.equal(new Set(PROFANITY_TERMS).size,3717);
  PROFANITY_TERMS.forEach((term,i)=>{
    for(const text of [term,term.toUpperCase(),`Please say ${term} now`]){
      const result=moderateText(text);
      assert.equal(result.ok,false,`imported chat entry ${i}`);
      assert.equal(result.text,'');
    }
    assert.equal(safeName(term),'Egg',`imported name entry ${i}`);
  });
});
test('imported words remain blocked with separators and invisible characters',()=>{
  PROFANITY_TERMS.filter(term=>/^[a-z]{3,18}$/i.test(term)).forEach((term,i)=>{
    for(const text of [term.split('').join('.'),term.split('').join(' '),term.split('').join('\u200b')])
      assert.equal(moderateText(text).ok,false,`disguised imported entry ${i}`);
  });
});

test('friendly conversation, quick messages and ordinary substrings remain usable',()=>{
  const samples=[...Object.values(QUICK_MESSAGES),'Host egg','Guest egg','Blue team wins','Classical','assassin','grapes','Need 30 ammo','I am at the tower','Push left','Shells are awesome'];
  samples.forEach((s,i)=>assert.equal(moderateText(s).ok,true,`friendly case ${i}`));
});
test('privacy policy catches formatted and disguised contact details, disclosures and entities',()=>{
  const samples=['user@example.com','user at example dot com','user (at) example (dot) com','example.com','https://example.org','@example','(202) 555-0149','２１２５５５０１９９','2 0 2 5 5 5 0 1 4 9','two zero two five five five zero one four nine',
  '123 Test Street','42 Main Rd','my name is Example','John Smith','john smith','JohnSmith','Philadelphia','my school is Example','I live near the park','I am from a city','I am sixteen','I’m 16','How old are you?','Where do you live?','my discord is example','my password is example','4111 1111 1111 1111','123-45-6789','40.1234, -75.1234'];
  samples.forEach((s,i)=>assert.equal(moderateText(s).ok,false,`privacy case ${i}`));
});
test('language policy rejects disguised prohibited language without echoing the input',()=>{
  const samples=[profanity,profanity.toUpperCase(),profanity.split('').join('.'),profanity.split('').join(' '),profanity.replace('u','*'),profanity.replace('u','ü'),profanity.replace('u','u\u200b'),profanity.replace('u','uuuu'),profanity.replace('u','υ'),slur,slur.replace('i','1'),'d4mn','stfu','idiot'];
  samples.forEach((s,i)=>{const r=moderateText(s);assert.equal(r.ok,false,`language case ${i}`);assert.equal(r.text,'');});
});
test('names use the same policy at profile and directory boundaries; invalid input fails closed',()=>{
  for(const value of [null,{},'','<b>egg</b>','x'.repeat(300),profanity,'John Smith','user@example.com']){
    assert.equal(safeName(value),'Egg');assert.equal(safeProfile({name:value}).name,'Egg');
  }
  assert.equal(safeProfile(null).name,'Egg');
  assert.equal(safeName('Golden Egg'),'Golden Egg');
  const listing=cleanListing({code:'ABCDEFGH',host:profanity,map:'yard',mode:'ffa',players:1,phase:'lobby'});
  assert.equal(listing.host,'Egg');
  for(const value of [null,{},['hello'],'x'.repeat(CHAT_LIMIT+1),'###','<script>','%66%75','漢字'])assert.equal(moderateText(value).ok,false);
});
test('host binds sender identity, routes teams privately, and isolates spectators',()=>{
  const room=new ChatRoom();
  const team=room.submit('host',{...packet('Defend here','team'),sender:'a',name:'Fake'},state,1000);
  assert.equal(team.ok,true);assert.equal(team.message.sender,'host');assert.equal(team.message.name,'Host egg');
  assert.deepEqual(team.recipients,['host','b']);
  const spectate=room.submit('s',packet('Nice round'),state,1000);
  assert.equal(spectate.message.channel,'spectators');assert.deepEqual(spectate.recipients,['s','t']);
  assert.equal(room.submit('absent',packet('Hello'),state,1000).ok,false);
  assert.equal(room.submit('bot',packet('Hello'),state,1000).ok,false);
  assert.equal(room.submit('a',packet('Hello','team'),{...state,options:{mode:'ffa'}},1000).ok,false);
});
test('host rejects raw prohibited payloads, fabricated quick IDs and outdated protocol versions',()=>{
  for(const text of [profanity,slur,'pistol','words','user@example.com'])assert.equal(new ChatRoom().submit('a',packet(text),state,1000).ok,false);
  for(const payload of [null,{},packet('x'.repeat(CHAT_LIMIT+1)),{...packet('Hi'),version:0},{...packet('Hi'),quick:'invalid'}])assert.equal(new ChatRoom().submit('a',payload,state,1000).ok,false);
  const quick=new ChatRoom().submit('a',{...packet(profanity),quick:'gg'},state,1000);
  assert.equal(quick.message.text,QUICK_MESSAGES.gg);
});
test('spam, duplicate messages, cooldowns and room controls are enforced by the host',()=>{
  const room=new ChatRoom();
  assert.equal(room.submit('a',packet('Hello eggs'),state,1000).ok,true);
  assert.equal(room.submit('a',packet('Hello again'),state,1100).reason,'slow');
  assert.equal(room.submit('a',packet('Hello eggs'),state,2500).reason,'duplicate');
  room.muted.add('a');assert.equal(room.submit('a',packet('Ready'),state,20000).reason,'muted');
  room.muted.delete('a');room.enabled=false;assert.equal(room.submit('a',packet('Ready'),state,20000).reason,'disabled');
  const hostile=new ChatRoom();
  for(let i=0;i<4;i++)assert.equal(hostile.submit('a',packet(profanity),state,1000+i*2000).ok,false);
  assert.equal(hostile.submit('a',packet('Ready'),state,12000).reason,'cooldown');
  assert.equal(hostile.submit('a',packet('Ready'),state,40000).ok,true);
});
test('split-message privacy attempts are rejected without retaining the blocked continuation',()=>{
  const room=new ChatRoom();
  assert.equal(room.submit('a',packet('202'),state,1000).ok,true);
  const blocked=room.submit('a',packet('555'),state,3000);
  assert.equal(blocked.ok,false);assert.equal(blocked.reason,'context');
  assert.deepEqual(room.members.get('a').recent.map(m=>m.text),['202']);
});
test('recipient rejects hostile hosts, replayed packets, forged identities and channel leaks',()=>{
  const inbox=new ChatInbox();
  const msg={version:FILTER_VERSION,id:1,sender:'a',name:'Fake',channel:'room',text:'Well played',quick:null};
  assert.equal(inbox.accept(msg,state,'host','all',1000).name,'Alpha');
  assert.equal(inbox.accept(msg,state,'host','all',3000),null);
  assert.equal(inbox.accept({...msg,id:2,text:profanity},state,'host','all',3000),null);
  assert.equal(inbox.accept({...msg,id:3,sender:'absent'},state,'host','all',5000),null);
  assert.equal(inbox.accept({...msg,id:4,channel:'team'},state,'host','all',7000),null);
  assert.equal(inbox.accept({...msg,id:5,sender:'s'},state,'host','all',9000),null);
  assert.equal(inbox.accept({...msg,id:99999,text:profanity},state,'host','all',11000),null);
  assert.equal(inbox.accept({...msg,id:99999,text:'pistol'},state,'host','all',11000),null);
  assert.ok(inbox.accept({...msg,id:6,text:'Thanks!'},state,'host','all',13000));
  assert.equal(inbox.rows.length,2);
});
test('mute, quick-only, off, and bounded history apply at receipt',()=>{
  const inbox=new ChatInbox();const msg={version:FILTER_VERSION,sender:'a',channel:'room',text:'Nice round'};
  assert.equal(inbox.accept({...msg,id:1},state,'host','off',1000),null);
  assert.equal(inbox.accept({...msg,id:2},state,'host','quick',3000),null);
  assert.equal(inbox.accept({...msg,id:3,quick:'gg'},state,'host','quick',5000).text,QUICK_MESSAGES.gg);
  inbox.mute('a');assert.equal(inbox.rows.length,0);
  assert.equal(inbox.accept({...msg,id:4,quick:'gg'},state,'host','all',7000),null);
  inbox.mute('a',false);
  for(let i=5;i<100;i++)inbox.accept({...msg,id:i,quick:'gg'},state,'host','all',i*2000);
  assert.equal(inbox.rows.length,60);
});
test('reports have fixed reasons, verified participants and duplicate limits',()=>{
  const room=new ChatRoom();
  assert.ok(room.report('a','host','behavior',state));
  assert.equal(room.report('a','host','privacy',state),null);
  assert.equal(room.report('a','a','behavior',state),null);
  assert.equal(room.report('absent','host','behavior',state),null);
  assert.equal(room.report('a','b','made-up',state),null);
});
