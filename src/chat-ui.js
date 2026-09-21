import { ChatInbox, QUICK_MESSAGES, REPORT_REASONS } from './chat.js';
import { CHAT_LIMIT, safeName, SAFETY_MESSAGES } from './moderation.js';

const el = (tag, text, className) => {
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  if(className)node.className=className;
  return node;
};
export class ChatPanel {
  constructor(root, callbacks) {
    this.callbacks=callbacks; this.inbox=new ChatInbox(); this.opened=false;
    this.unread=0; this.nextSend=0; this.lastRoster=''; this.reported=new Set();
    this.toggle=el('button','Chat','chat-toggle'); this.toggle.id='chat-toggle'; this.toggle.hidden=true;
    this.toggle.setAttribute('aria-label','Open chat'); this.toggle.setAttribute('aria-controls','chat-panel');
    this.peek=el('div',undefined,'chat-peek'); this.peek.hidden=true;
    this.panel=el('dialog'); this.panel.id='chat-panel'; this.panel.setAttribute('aria-labelledby','chat-title');
    this.panel.innerHTML=`<header class="chat-head"><div><span class="chat-eyebrow">THE YARD • LIVE</span><h2 id="chat-title">Match chat</h2></div><button type="button" class="chat-close" aria-label="Close chat">×</button></header>
      <div class="chat-toolbar"><label>Channel<select id="chat-channel" aria-label="Chat channel"><option value="room">Room</option><option value="team">Team</option></select></label><span class="chat-shield">◈ Filter always on</span></div>
      <p class="chat-audience" id="chat-audience"></p>
      <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Chat messages" tabindex="0"></div>
      <p class="chat-status" role="status"></p>
      <form class="chat-compose"><label class="chat-sr" for="chat-input">Message</label><input id="chat-input" maxlength="${CHAT_LIMIT}" placeholder="Keep it friendly. Keep details private." autocomplete="off" spellcheck="true" enterkeyhint="send" aria-describedby="chat-count chat-privacy"><button class="chat-send" type="submit">Send ↗</button></form>
      <div class="chat-input-meta"><span id="chat-privacy">Messages are filtered before sharing.</span><span id="chat-count">0/${CHAT_LIMIT}</span></div>
      <details class="chat-quick"><summary>Quick messages</summary><div class="chat-quick-grid"></div></details>
      <details class="chat-safety"><summary>Players & safety</summary><label class="chat-preference">Show chat<select id="chat-preference" aria-label="Chat preference"><option value="all">Filtered messages</option><option value="quick">Quick messages only</option><option value="off">Off</option></select></label><div class="chat-players"></div><div class="chat-host-controls"></div><p class="chat-fine">Mute hides a player for you for this room. Reports go to the room host. Leaving clears chat history.</p></details>`;
    root.append(this.toggle,this.peek,this.panel);
    this.input=this.panel.querySelector('#chat-input'); this.log=this.panel.querySelector('.chat-log');
    this.status=this.panel.querySelector('.chat-status'); this.channel=this.panel.querySelector('#chat-channel');
    this.preference=this.panel.querySelector('#chat-preference');
    this.toggle.onclick=()=>this.open();
    this.panel.querySelector('.chat-close').onclick=()=>this.close();
    this.panel.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.panel.addEventListener('close',()=>{if(this.opened&&!this.panel.open)this.finishClose();});
    this.panel.querySelector('form').onsubmit=e=>{e.preventDefault();this.send();};
    this.panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault();e.stopPropagation();});
    this.input.oninput=()=>{this.panel.querySelector('#chat-count').textContent=`${this.input.value.length}/${CHAT_LIMIT}`;};
    this.channel.onchange=()=>this.update();
    this.preference.onchange=()=>{
      this.callbacks.setPreference(this.preference.value); this.inbox.rows=[]; this.peek.replaceChildren();this.peek.hidden=true;
      this.renderLog();this.update();
    };
    for(const [id,text] of Object.entries(QUICK_MESSAGES)) {
      const button=el('button',text);button.type='button';button.dataset.quick=id;
      button.onclick=()=>this.send(id);this.panel.querySelector('.chat-quick-grid').append(button);
    }
    this.renderLog();
  }
  context() {return this.callbacks.context();}
  open() {
    const ctx=this.context(); if(!ctx.connected)return;
    this.opened=true;this.unread=0;this.toggle.textContent='Chat';this.peek.hidden=true;
    this.callbacks.open();this.update();
    if(this.panel.open)this.panel.close();
    this.panel.showModal();
    this.renderLog();this.log.scrollTop=this.log.scrollHeight;
    if(!this.input.disabled)this.input.focus();else this.panel.querySelector('.chat-close').focus();
  }
  close() {if(!this.opened)return;this.panel.close();this.finishClose();}
  finishClose() {if(!this.opened)return;this.opened=false;this.callbacks.close();}
  reset() {
    this.close();this.inbox=new ChatInbox();this.unread=0;this.nextSend=0;this.lastRoster='';this.reported.clear();
    this.input.value='';this.input.oninput();this.status.textContent='';this.renderLog();this.toggle.hidden=true;this.peek.hidden=true;clearTimeout(this.peekTimer);
  }
  feedback(result) {
    if(result?.ok)return;
    const seconds=Math.min(120,Number(result?.retryAfter)||0);
    this.status.textContent=(SAFETY_MESSAGES[result?.reason]||'Message could not be sent.')+(seconds?` Try again in ${seconds}s.`:'');
    if(seconds)this.nextSend=Math.max(this.nextSend,Date.now()+seconds*1000);
  }
  send(quick) {
    const ctx=this.context();
    if(ctx.preference==='off'||(ctx.preference==='quick'&&!quick))return;
    if(Date.now()<this.nextSend){this.feedback({reason:'slow',retryAfter:Math.ceil((this.nextSend-Date.now())/1000)});return;}
    const result=this.callbacks.send({channel:this.channel.value,text:this.input.value,...(quick?{quick}:{})});
    if(result?.ok){
      this.nextSend=Date.now()+1100; this.status.textContent='';
      this.input.value='';this.input.oninput();if(!quick)this.input.focus();
    } else this.feedback(result);
  }
  receive(message) {
    const ctx=this.context();
    const row=this.inbox.accept(message,ctx.state,ctx.localId,ctx.preference);
    if(!row)return;
    this.renderLog();
    if(!this.opened && row.sender!==ctx.localId){
      this.unread=Math.min(99,this.unread+1);this.toggle.textContent=`Chat · ${this.unread}`;
      this.peek.replaceChildren(...this.inbox.rows.slice(-3).map(r=>this.messageNode(r)));
      this.peek.hidden=false;clearTimeout(this.peekTimer);this.peekTimer=setTimeout(()=>{this.peek.hidden=true;},7000);
    }
  }
  messageNode(row) {
    const node=el('div',undefined,'chat-message');node.dataset.chatId=String(row.id);
    const head=el('div',undefined,'chat-message-head');head.append(el('b',safeName(row.name)),el('span',row.channel==='team'?'TEAM':row.channel==='spectators'?'SPECTATORS':'ROOM'));
    node.append(head,el('p',row.text));return node;
  }
  renderLog() {
    const atBottom=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<50;
    const wanted=new Set(this.inbox.rows.map(row=>String(row.id)));
    for(const node of [...this.log.children])if(!wanted.has(node.dataset.chatId))node.remove();
    const existing=new Set([...this.log.children].map(node=>node.dataset.chatId));
    for(const row of this.inbox.rows)if(!existing.has(String(row.id)))this.log.append(this.messageNode(row));
    if(!this.inbox.rows.length)this.log.append(el('p','A fresh conversation. Say hello or use a quick message.','chat-empty'));
    if(atBottom)this.log.scrollTop=this.log.scrollHeight;
  }
  update() {
    const ctx=this.context();this.toggle.hidden=!ctx.connected;
    if(!ctx.connected){this.peek.hidden=true;return;}
    const me=ctx.state?.players.find(p=>p.id===ctx.localId);
    const spectator=me?.spectating&&ctx.state?.phase==='playing';
    const teams=['teams','capture','control'].includes(ctx.state?.options.mode)&&!me?.spectating;
    this.channel.options[1].hidden=!teams;this.channel.options[1].disabled=!teams;
    if(!teams)this.channel.value='room';
    this.channel.options[0].textContent=spectator?'Spectators':'Room';
    this.panel.querySelector('#chat-audience').textContent=spectator?'Only spectators can see your messages.':this.channel.value==='team'?'Only your teammates can see these messages.':'Everyone in this room can see these messages.';
    this.preference.value=ctx.preference;
    const disabled=ctx.preference==='off'||ctx.enabled===false||ctx.roomMuted?.includes(ctx.localId);
    this.input.disabled=disabled||ctx.preference==='quick';this.panel.querySelector('.chat-send').disabled=this.input.disabled;
    for(const button of this.panel.querySelectorAll('[data-quick]'))button.disabled=disabled;
    if(ctx.preference==='quick')this.panel.querySelector('.chat-quick').open=true;
    if(ctx.preference==='off')this.status.textContent='Chat is off. Change Show chat in Players & safety to turn it on.';
    else if(ctx.enabled===false)this.status.textContent=SAFETY_MESSAGES.disabled;
    else if(ctx.roomMuted?.includes(ctx.localId))this.status.textContent=SAFETY_MESSAGES.muted;
    else if([SAFETY_MESSAGES.disabled,SAFETY_MESSAGES.muted].includes(this.status.textContent)||this.status.textContent.startsWith('Chat is off.'))this.status.textContent='';
    const key=JSON.stringify([ctx.state?.players.map(p=>[p.id,p.name,p.bot]),[...this.inbox.muted],ctx.roomMuted,ctx.enabled,ctx.host]);
    if(key!==this.lastRoster){this.lastRoster=key;this.renderPlayers(ctx);}
  }
  renderPlayers(ctx) {
    const list=this.panel.querySelector('.chat-players');list.replaceChildren();
    for(const p of ctx.state?.players||[]) {
      if(p.bot||p.id===ctx.localId)continue;
      const row=el('div',undefined,'chat-player');row.append(el('b',safeName(p.name)));
      const buttons=el('div',undefined,'chat-player-actions');
      const muted=this.inbox.muted.has(p.id),mute=el('button',muted?'Unmute':'Mute');mute.type='button';mute.dataset.mute=p.id;
      mute.onclick=()=>{this.inbox.mute(p.id,!muted);this.peek.replaceChildren();this.peek.hidden=true;this.renderLog();this.update();};buttons.append(mute);
      const report=el('button',this.reported.has(p.id)?'Reported':'Report');report.type='button';report.disabled=this.reported.has(p.id);report.dataset.report=p.id;
      report.onclick=()=>{
        const form=el('div',undefined,'chat-report');const select=el('select');select.setAttribute('aria-label','Report reason');
        for(const [reason,label] of Object.entries(REPORT_REASONS)){const option=el('option',label);option.value=reason;select.append(option);}
        const send=el('button','Mute & notify host');send.type='button';send.onclick=()=>{
          this.inbox.mute(p.id);this.reported.add(p.id);this.callbacks.report(p.id,select.value);this.lastRoster='';this.peek.hidden=true;this.renderLog();this.update();this.status.textContent='Player muted. The room host was notified.';
        };
        form.append(select,send);row.querySelector('.chat-report')?.remove();row.append(form);
      };buttons.append(report);
      if(ctx.host){
        const silenced=ctx.roomMuted.includes(p.id),silence=el('button',silenced?'Allow chat':'Silence');silence.type='button';silence.dataset.silence=p.id;
        silence.onclick=()=>{this.callbacks.silence(p.id,!silenced);this.update();};
        const remove=el('button','Remove');remove.type='button';remove.dataset.remove=p.id;remove.onclick=()=>this.callbacks.remove(p.id);
        buttons.append(silence,remove);
      }
      row.append(buttons);list.append(row);
    }
    if(!list.children.length)list.append(el('p','Other players will appear here.','chat-fine'));
    const host=this.panel.querySelector('.chat-host-controls');host.replaceChildren();
    if(ctx.host){const button=el('button',ctx.enabled?'Pause room chat':'Enable room chat');button.type='button';button.dataset.roomChat='';button.onclick=()=>{this.callbacks.enable(!ctx.enabled);this.update();};host.append(button);}
  }
}
