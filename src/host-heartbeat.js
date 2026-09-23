// A slow render or a suspended guest tab is not evidence that its host left.
// Check transport replies independently from the simulation's snapshot cadence.
export class HostHeartbeat {
  constructor(now = 0) { this.lastContact = now; this.lastPoll = now; this.suspectSince = null; }
  contact(now) { this.lastContact = now; this.suspectSince = null; }
  expired(now) {
    const delayed = now - this.lastPoll > 6000;
    this.lastPoll = now;
    if (delayed) { this.contact(now); return false; }
    if (now - this.lastContact <= 10000) { this.suspectSince = null; return false; }
    // Keep the channel open for two additional ping opportunities. Replies may
    // be queued behind a costly frame or a large world checkpoint.
    this.suspectSince ??= now;
    return now - this.suspectSince >= 4000;
  }
}
