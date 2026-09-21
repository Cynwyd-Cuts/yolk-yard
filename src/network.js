import {VERSION,safeProfile} from './data.js';
import {session} from './session.js';
export const cleanCode=s=>String(s||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,8);
export const formatCode=s=>s.slice(0,4)+'-'+s.slice(4);
export class Network {
  constructor(callbacks={}) {
    this.callbacks=callbacks;this.ready=false;this.closed=false;this.latency=0;this.visibility='private';
    this.receive=msg=>{
      if(this.closed)return;
      if(msg.type==='welcome' && msg.requestId===this.requestId){
        this.id=msg.id;this.code=msg.code;this.isHost=msg.isHost;this.visibility=msg.visibility;this.ready=true;
        this.resolve?.(this.id);this.resolve=null;this.reject=null;clearTimeout(this.timer);
        // The caller sets its local player ID before the first snapshot is processed.
        setTimeout(()=>{if(!this.closed)this.callbacks.onState?.(msg.state);},0);
      }
      if(msg.type==='state'&&this.ready&&msg.code===this.code){this.visibility=msg.visibility;this.callbacks.onState?.(msg.state);}
      if(msg.type==='pong')this.latency=Math.max(0,Math.round(performance.now()-msg.time));
      if(msg.type==='reject'&&msg.requestId===this.requestId){this.reject?.(new Error(msg.reason));clearTimeout(this.timer);}
      if(msg.type==='closed'&&msg.code===this.code)this.callbacks.onError?.(msg.reason);
      if(msg.type==='error')this.callbacks.onStatus?.(msg.reason);
    };
    session.listeners.add(this.receive);
    this.heartbeat=setInterval(()=>this.send({type:'ping',time:performance.now()}),2000);
  }
  async connect(message){
    await session.open();
    if(this.closed)throw new Error('Connection cancelled.');
    return new Promise((resolve,reject)=>{
      this.resolve=resolve;this.reject=reject;
      this.timer=setTimeout(()=>reject(new Error('The room service did not respond.')),12000);
      this.requestId=crypto.randomUUID();
      this.send({...message,version:VERSION,requestId:this.requestId});
    });
  }
  async host(options,profile,visibility='private') {await this.connect({type:'host',options,profile:safeProfile(profile),visibility});return this.code;}
  join(code,profile){return this.connect({type:'join',code:cleanCode(code),profile:safeProfile(profile)});}
  send(msg){if(!this.closed)session.send(msg);}
  input(input){this.send({type:'input',input});}
  profile(profile){this.send({type:'profile',profile});}
  start(){this.send({type:'start'});}
  setVisibility(visibility){this.send({type:'visibility',visibility});}
  kick(id){this.send({type:'kick',id});}
  destroy(){
    if(this.closed)return;
    this.send({type:'leave'});this.closed=true;this.ready=false;
    this.reject?.(new Error('Connection cancelled.'));
    clearTimeout(this.timer);clearInterval(this.heartbeat);session.listeners.delete(this.receive);
  }
}
