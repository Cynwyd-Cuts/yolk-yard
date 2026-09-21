class Session {
  constructor(){this.listeners=new Set();this.socket=null;this.ready=null;}
  open(){
    if(this.ready)return this.ready;
    this.ready=new Promise((resolve,reject)=>{
      const url=new URL('/session',location.origin);url.protocol=location.protocol==='https:'?'wss:':'ws:';
      const socket=new WebSocket(url);this.socket=socket;
      let accepted=false;
      const timer=setTimeout(()=>{reject(new Error('The game service did not respond. Please reload.'));socket.close();},12000);
      socket.onmessage=event=>{
        let msg;try{msg=JSON.parse(event.data);}catch{return;}
        if(msg.type==='session-ping'){this.send({type:'session-pong'});return;}
        if(msg.type==='session'){accepted=true;clearTimeout(timer);resolve();}
        if(msg.type==='reject'&&!accepted){clearTimeout(timer);reject(new Error(msg.reason));}
        if(msg.type==='revoked'){location.replace('/access');return;}
        for(const fn of this.listeners)fn(msg);
      };
      socket.onclose=()=>{
        clearTimeout(timer);
        if(!accepted)reject(new Error('Could not open a game session. This browser may need approval.'));
        else this.block('Your game session ended. Reload to reconnect.');
      };
      socket.onerror=()=>{if(!accepted)reject(new Error('Could not connect to the game service.'));};
    });
    return this.ready;
  }
  block(message){
    const shade=document.createElement('div');shade.style.cssText='position:fixed;inset:0;z-index:99999;background:#102622;color:white;display:grid;place-content:center;text-align:center;padding:32px;font:20px system-ui';
    const text=document.createElement('p');text.textContent=message;
    const button=document.createElement('button');button.textContent='Reload game';button.onclick=()=>location.reload();
    shade.append(text,button);document.querySelector('dialog[open]')?.close();document.body.append(shade);
    if(document.pointerLockElement)document.exitPointerLock();
  }
  send(msg){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(msg));}
}
export const session=new Session();
