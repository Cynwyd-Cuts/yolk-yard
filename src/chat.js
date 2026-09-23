import { CHAT_LIMIT, FILTER_VERSION, foldText, moderateText, safeName } from './moderation.js';

export const QUICK_MESSAGES = Object.freeze({
  hello:'Hello, eggs!', gg:'Good game!', nice:'Nice shot!', thanks:'Thanks!',
  ready:'Ready!', help:'Need backup!', regroup:'Regroup here!', defend:'Defend the objective!',
  ammo:'Need ammo!', go:'Let’s go!', wait:'Wait for the team!', sorry:'Sorry!',
});
export const REPORT_REASONS = Object.freeze({ language:'Inappropriate language', privacy:'Personal information', behavior:'Harassment or spam' });
const fail = (reason, retryAfter = 0) => ({ok:false, reason, retryAfter:Math.max(0, Math.ceil(retryAfter / 1000))});
const playersOf = state => Array.isArray(state?.players) ? state.players : [];
const teamMode = state => state?.options?.mode==='teams';
export function chatChannel(player, requested, state) {
  if (player?.spectating && state?.phase === 'playing') return 'spectators';
  if (requested === 'team') return teamMode(state) && !player?.spectating ? 'team' : null;
  return requested === 'room' ? 'room' : null;
}
export function audienceFor(sender, channel, state) {
  return playersOf(state).filter(p => !p.bot && (channel === 'spectators' ? p.spectating :
    channel === 'team' ? !p.spectating && p.team === sender.team : true)).map(p => p.id);
}
export function chatPayload(payload) {
  if (!payload || typeof payload !== 'object' || payload.version !== FILTER_VERSION ||
      !['room','team'].includes(payload.channel)) return null;
  if (typeof payload.quick === 'string' && Object.hasOwn(QUICK_MESSAGES, payload.quick))
    return {version:FILTER_VERSION, channel:payload.channel, quick:payload.quick, text:QUICK_MESSAGES[payload.quick]};
  if (payload.quick != null || typeof payload.text !== 'string' || payload.text.length > CHAT_LIMIT) return null;
  return {version:FILTER_VERSION, channel:payload.channel, text:payload.text};
}

// Host-owned, bounded and room-scoped. Identity, team and recipients come from
// the admitted roster, never from client-supplied message fields.
export class ChatRoom {
  constructor() { this.sequence=0; this.members=new Map(); this.muted=new Set(); this.enabled=true; this.reports=new Set(); }
  remove(id) { this.members.delete(id); /* room silences survive same-peer reconnects */ }
  submit(id, payload, state, now = Date.now()) {
    const sender=playersOf(state).find(p=>p.id===id && !p.bot);
    if (!sender) return fail('disconnected');
    if (!this.enabled) return fail('disabled');
    if (this.muted.has(id)) return fail('muted');
    let member=this.members.get(id);
    if (!member) {
      if (this.members.size>=32) this.members.delete(this.members.keys().next().value);
      member={attempts:[], strikes:[], recent:[], until:0}; this.members.set(id,member);
    }
    if (now<member.until) return fail('cooldown',member.until-now);
    member.attempts=member.attempts.filter(t=>now-t<10000);
    const last=member.attempts.at(-1);
    if ((last!==undefined && now-last<1000) || member.attempts.length>=5) return fail('slow',last!==undefined?Math.max(1000-(now-last),member.attempts.length>=5?10000-(now-member.attempts[0]):0):1000);
    member.attempts.push(now);
    member.recent=member.recent.filter(m=>now-m.time<20000).slice(-4);
    const parsed=chatPayload(payload);
    const channel=chatChannel(sender,parsed?.channel,state);
    if (!channel) return fail('channel');
    const result=parsed && moderateText(parsed.text,{previous:parsed.quick?[]:member.recent.filter(m=>!m.quick).map(m=>m.text)});
    if (!result?.ok) {
      member.strikes=member.strikes.filter(t=>now-t<60000); member.strikes.push(now);
      if (member.strikes.length>=4) member.until=now+30000;
      return fail(member.until>now?'cooldown':result?.reason||'format',member.until-now);
    }
    const fingerprint=foldText(result.text).replace(/[^a-z0-9]/g,'');
    if (member.recent.some(m=>m.fingerprint===fingerprint)) return fail('duplicate');
    member.recent.push({text:result.text,quick:parsed.quick,time:now,fingerprint});
    return {ok:true, recipients:audienceFor(sender,channel,state), message:{version:FILTER_VERSION,id:++this.sequence,sender:id,name:safeName(sender.name),channel,text:result.text,quick:parsed.quick||null}};
  }
  report(reporter, target, reason, state) {
    const players=playersOf(state);
    const key=reporter+'|'+target;
    if (reporter===target || !Object.hasOwn(REPORT_REASONS,reason) || this.reports.has(key) || this.reports.size>=128 ||
        !players.some(p=>p.id===reporter&&!p.bot) || !players.some(p=>p.id===target&&!p.bot)) return null;
    this.reports.add(key);
    return {reporter:safeName(players.find(p=>p.id===reporter).name),target:safeName(players.find(p=>p.id===target).name),reason:REPORT_REASONS[reason]};
  }
}

// Recipient-side validation is independent of the host filter, including when
// an altered host sends text directly. Only sanitized messages enter history.
export class ChatInbox {
  constructor() { this.rows=[]; this.muted=new Set(); this.lastId=0; this.recent=new Map(); }
  accept(message, state, localId, preference='all', now=Date.now()) {
    if (preference==='off' || !message || message.version!==FILTER_VERSION ||
        !Number.isSafeInteger(message.id) || message.id<=this.lastId || typeof message.sender!=='string' ||
        !['room','team','spectators'].includes(message.channel)) return null;
    const sender=playersOf(state).find(p=>p.id===message.sender&&!p.bot);
    if (!sender || this.muted.has(sender.id) || !audienceFor(sender,message.channel,state).includes(localId)) return null;
    if (message.channel==='team' && (!teamMode(state)||sender.spectating)) return null;
    if (state?.phase==='playing' && sender.spectating && message.channel!=='spectators') return null;
    if (message.channel==='spectators' && !sender.spectating) return null;
    const quick=typeof message.quick==='string' && Object.hasOwn(QUICK_MESSAGES,message.quick) ? message.quick : null;
    if ((message.quick!=null&&!quick) || (preference==='quick'&&!quick)) return null;
    const recent=(this.recent.get(sender.id)||[]).filter(m=>now-m.time<20000).slice(-4);
    if (recent.at(-1) && now-recent.at(-1).time<700) return null;
    const result=moderateText(quick?QUICK_MESSAGES[quick]:message.text,{previous:quick?[]:recent.filter(m=>!m.quick).map(m=>m.text)});
    if (!result.ok) return null;
    this.lastId=message.id;
    recent.push({text:result.text,quick,time:now});
    if (this.recent.size>=32 && !this.recent.has(sender.id)) this.recent.delete(this.recent.keys().next().value);
    this.recent.set(sender.id,recent);
    const row={id:message.id,sender:sender.id,name:safeName(sender.name),channel:message.channel,text:result.text,quick};
    this.rows.push(row); if(this.rows.length>60)this.rows.shift();
    return row;
  }
  mute(id, muted=true) {
    if(muted) {this.muted.add(id); this.rows=this.rows.filter(r=>r.sender!==id);} else this.muted.delete(id);
  }
}
