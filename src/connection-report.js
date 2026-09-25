import {FrameStats} from './frame-stats.js';
// Only fixed status labels are retained. Never record peer IDs, ICE candidates,
// addresses, credentials, names, room codes, or raw exception messages.
const stages = ['service', 'directory', 'host'];
export class ConnectionReport {
  constructor() { this.performance=new FrameStats(); this.rows = Object.fromEntries(stages.map(key => [key, {status:'Not checked', detail:'No check yet.'}])); }
  set(stage, status, detail) {
    if (!stages.includes(stage)) return;
    this.rows[stage] = {status, detail, at:new Date().toISOString()};
  }
  text(build) {
    return ['Yolk Yard connection report', 'Build: ' + build,
      ...stages.map(key => {const r=this.rows[key];return key + ': ' + r.status + ' — ' + r.detail + (r.at ? ' ['+r.at+']' : '');}),
      this.performance.text(),
      'These results cannot prove a school firewall is the cause.',
      'No room codes, names, IP addresses or credentials are included.'].join('\n');
  }
}
export const connectionReport = new ConnectionReport();
const knownErrors = new Set(['peer-unavailable','network','server-error','socket-error','socket-closed','unavailable-id','browser-incompatible','webrtc','ssl-unavailable','invalid-id','invalid-key','negotiation-failed','connection-closed']);
export function errorCode(error) { return knownErrors.has(error?.type) ? error.type : 'unknown-error'; }
export function watchConnection(conn, report = connectionReport) {
  let attached = false;
  const attach = () => {
    const pc = conn.peerConnection;
    if (!pc || attached) return;
    attached = true;
    const update = () => {
      if (['Failed','Passed','Rejected'].includes(report.rows.host.status)) return;
      const ice = ['new','checking','connected','completed','disconnected','failed','closed'].includes(pc.iceConnectionState) ? pc.iceConnectionState : 'unknown';
      report.set('host', ice === 'failed' ? 'Failed' : 'Checking', 'ICE: ' + ice + '. Waiting for the game handshake.');
    };
    pc.addEventListener('iceconnectionstatechange', update);
    pc.addEventListener('icecandidateerror', event => {
      if (report.rows.host.status !== 'Checking') return;
      const code = Number.isInteger(event.errorCode) ? event.errorCode : 0;
      report.set('host','Checking','ICE server error ' + code + '; connection may still succeed.');
    });
    update();
  };
  attach();
  conn.on('iceStateChanged', attach);
  conn.on('open', () => { attach(); report.set('host','Checking','Data channel opened; waiting for host acceptance.'); });
}
