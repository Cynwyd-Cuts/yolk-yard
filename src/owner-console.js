// A discoverability gesture, never an authorization mechanism. Only the relay knows the owner code.
const gesture=['KeyY','KeyO','KeyL','KeyK','KeyA','KeyR','KeyD'];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>{
  const endpoint=globalThis.window?.YOLK_NETWORK?.relay;
  if(!endpoint)return null;
  try{const url=new URL(endpoint);if(!['wss:','ws:'].includes(url.protocol))return null;url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/owner';url.search='';url.hash='';return url.href.replace(/\/$/,'');}catch{return null;}
};
export class OwnerConsole {
  constructor({modal,screen,dialog,wallet,onWalletChange}){this.wallet=wallet;this.onWalletChange=onWalletChange;this.addingEggs=false;this.modal=modal;this.screen=screen;this.dialog=dialog;this.token=null;this.expires=0;this.progress=0;this.last=0;this.taps=0;this.lastTap=0;
    this.dialog.addEventListener('submit',e=>{if(e.target.id==='owner-eggs-form'){e.preventDefault();void this.addEggs(e.target);}});
    document.addEventListener('keydown',e=>this.key(e));
    document.addEventListener('click',e=>{
      if(this.screen()!=='menu'||this.dialog.open||!e.target.closest('.topbar .brand'))return;
      const now=Date.now();this.taps=now-this.lastTap<1200?this.taps+1:1;this.lastTap=now;
      if(this.taps===7){this.taps=0;this.open();}
    });
  }
  key(event){
    if(this.screen()!=='menu'||this.dialog.open||event.repeat||event.target.matches('input,textarea,select,[contenteditable]')){this.progress=0;return;}
    const now=Date.now();if(now-this.last>3500)this.progress=0;this.last=now;
    this.progress=event.code===gesture[this.progress]?this.progress+1:event.code===gesture[0]?1:0;
    if(this.progress===gesture.length){this.progress=0;event.preventDefault();this.open();}
  }
  open(){this.modal('Owner access',`<p class="hint">Enter your private numeric access code. It is checked by the game server, never stored in this browser.</p><form id="owner-form"><label for="owner-code">ACCESS CODE</label><input id="owner-code" class="field" type="password" inputmode="numeric" pattern="[0-9]{12,32}" minlength="12" maxlength="32" autocomplete="off" required><button class="primary" type="submit">UNLOCK</button></form><p id="owner-error" role="alert"></p>`, 'owner');this.dialog.querySelector('#owner-code')?.focus();}
  async request(path,options={}){
    const url=api();if(!url)throw Error('Game server unavailable');
    // text/plain avoids a cross-origin preflight. The relay still parses JSON and
    // validates the origin, code, and short-lived token on every request.
    let response;
    try{response=await fetch(url+path,{...options,headers:{...(options.body?{'Content-Type':'text/plain;charset=UTF-8'}:{})},cache:'no-store'});}
    catch{throw Error('Could not reach the game server. Check your connection and try again.');}
    if(!response.ok){let message='Owner service unavailable';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
    return response.json();
  }
  async unlock(code){try{const result=await this.request('/login',{method:'POST',body:JSON.stringify({code})});this.token=result.token;this.expires=result.expires;await this.refresh();}catch(e){const status=this.dialog.querySelector('#owner-error');if(status)status.textContent=e.message;}}
  async refresh(){
    try{
      if(!this.token||this.expires<Date.now()){this.token=null;this.open();return;}
      const data=await this.request('/summary',{method:'POST',body:JSON.stringify({token:this.token})});
      const row=(s,past)=>`<tr><td>${escape(s.id?.slice(0,8))}</td><td>${escape(s.mode)}</td><td>${new Date(s.started).toLocaleString()}</td><td>${past?new Date(s.ended).toLocaleString():'Online'}</td><td>${Math.max(0,Math.round(((past?s.ended:data.at)-s.started)/60000))}m</td></tr>`;
      const table=(entries,past)=>`<div class="owner-table-scroll"><table class="controls-table"><thead><tr><th>Session</th><th>Area</th><th>Started</th><th>Ended</th><th>Length</th></tr></thead><tbody>${entries.length?entries.map(s=>row(s,past)).join(''):'<tr><td colspan="5">None yet</td></tr>'}</tbody></table></div>`;
      this.modal('Owner overview',`<div class="owner-metrics"><div><b>${data.online}</b><span>ACTIVE VISITORS</span></div><div><b>${data.visits}</b><span>TOTAL VISITS</span></div><div><b>${data.relayConnections}</b><span>GAME CONNECTIONS</span></div><div><b>${data.activeRooms.length}</b><span>ACTIVE ROOMS</span></div></div><p class="hint">Anonymous visits only; no IP addresses or chat. ${data.historyPersistent?'Session history is stored on the server.':'History resets if the relay restarts until persistent storage is configured.'}</p><div class="owner-toolbar"><button class="secondary" data-action="owner-refresh">REFRESH</button><button class="plain" data-action="owner-logout">LOCK</button></div><h3>Egg wallet</h3><p class="hint">Adds eggs to your current browser profile. Purchases and balance do not sync across devices.</p><p>Balance: <strong id="owner-egg-balance">${this.wallet.value.balance.toLocaleString()}</strong> eggs</p><form id="owner-eggs-form"><label for="owner-egg-amount">EGGS TO ADD</label><input id="owner-egg-amount" class="field" type="number" min="1" max="1000000" step="1" value="1000" required><button class="primary" type="submit">ADD EGGS</button></form><p id="owner-egg-status" role="status" aria-live="polite"></p><h3>Live rooms</h3><div class="owner-table-scroll"><table class="controls-table"><thead><tr><th>Mode</th><th>Players</th><th>Capacity</th><th>Phase</th></tr></thead><tbody>${data.activeRooms.length?data.activeRooms.map(r=>`<tr><td>${escape(r.mode)}</td><td>${Number(r.players)||0}</td><td>${Number(r.capacity)||0}</td><td>${escape(r.phase)}</td></tr>`).join(''):'<tr><td colspan="4">No live rooms</td></tr>'}</tbody></table></div><h3>Active sessions</h3>${table(data.active,false)}<h3>Past sessions (latest 100)</h3>${table(data.past,true)}`, 'owner-dashboard');
    }catch(e){this.token=null;this.open();const status=this.dialog.querySelector('#owner-error');if(status)status.textContent=e.message;}
  }
  async addEggs(form){
    if(this.addingEggs)return;
    const status=this.dialog.querySelector('#owner-egg-status'),button=form.querySelector('button');
    const amount=Number(form.querySelector('#owner-egg-amount').value);
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000){status.textContent='Enter a whole number from 1 to 1,000,000.';return;}
    this.addingEggs=true;button.disabled=true;status.textContent='Checking owner access…';
    const token=this.token;
    try{
      if(!token||this.expires<=Date.now())throw Error('Owner access expired. Lock and unlock the panel again.');
      await this.request('/summary',{method:'POST',body:JSON.stringify({token})});
      if(this.token!==token||this.expires<=Date.now()||!form.isConnected)throw Error('Owner panel closed or access expired. No eggs were added.');
      await this.wallet.change(wallet=>{
        if(wallet.balance+amount>1e9)throw Error('That amount would exceed the wallet limit.');
        return {...wallet,balance:wallet.balance+amount};
      });
      const balance=this.dialog.querySelector('#owner-egg-balance');
      if(balance)balance.textContent=this.wallet.value.balance.toLocaleString();
      status.textContent=amount.toLocaleString()+' eggs added.';
      this.onWalletChange?.();
    }catch(error){status.textContent=error.message;}
    finally{this.addingEggs=false;button.disabled=false;}
  }
  logout(){void this.request('/logout',{method:'POST',body:JSON.stringify({token:this.token})}).catch(()=>{});this.token=null;this.expires=0;this.dialog.close();}
}

export function startAnonymousVisits(mode){
  const url=api();if(!url)return()=>{};
  let id;try{id=sessionStorage.getItem('yolk-visit-id');if(!id||!/^[a-f0-9-]{36}$/.test(id)){id=crypto.randomUUID();sessionStorage.setItem('yolk-visit-id',id);}}catch{id=crypto.randomUUID();}
  const send=event=>{
    const body=JSON.stringify({id,event,mode:mode()});
    if(event==='end'&&navigator.sendBeacon){navigator.sendBeacon(url+'/activity',new Blob([body],{type:'text/plain'}));return;}
    void fetch(url+'/activity',{method:'POST',headers:{'Content-Type':'text/plain'},body,keepalive:true}).catch(()=>{});
  };
  send('pulse');const timer=setInterval(()=>send('pulse'),30000);window.addEventListener('pagehide',()=>send('end'));
  return()=>clearInterval(timer);
}
