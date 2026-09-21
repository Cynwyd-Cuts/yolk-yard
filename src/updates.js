// Pure update policy, shared by browser integration and deterministic tests.
export class UpdateWatcher {
  constructor({ build, isInMatch, fetchVersion, refresh }) {
    Object.assign(this, { build, isInMatch, fetchVersion, refresh });
    this.pending = null;
    this.checking = false;
    this.refreshing = false;
  }
  apply() {
    if (!this.pending || this.isInMatch() || this.refreshing) return false;
    this.refreshing = true;
    this.refresh(this.pending);
    return true;
  }
  async check() {
    if (this.checking || this.refreshing) return;
    this.checking = true;
    try {
      const version = await this.fetchVersion();
      if (typeof version?.build === "string" && version.build && version.build !== this.build)
        this.pending = version.build;
      else if (version?.build === this.build) this.pending = null;
      this.apply();
    } catch { /* Offline or an incomplete deploy must not interrupt play. */ }
    finally { this.checking = false; }
  }
}
