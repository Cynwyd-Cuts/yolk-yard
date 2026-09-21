import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('free','paid')), created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS browsers(id TEXT PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','denied','revoked')), person TEXT REFERENCES people(id), created INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_browser ON browsers(person) WHERE status='approved';
      CREATE TABLE IF NOT EXISTS codes(id TEXT PRIMARY KEY, secret TEXT UNIQUE NOT NULL, person TEXT REFERENCES people(id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('free','paid')), expires INTEGER NOT NULL, used INTEGER, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS admins(secret TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, action TEXT NOT NULL, target TEXT NOT NULL, created INTEGER NOT NULL);`);
  }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  one(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  log(action, target) { this.run('INSERT INTO audit(action,target,created) VALUES(?,?,?)', action, target, Date.now()); }
  browser(secret) { return secret ? this.one('SELECT b.*, p.kind FROM browsers b LEFT JOIN people p ON b.person=p.id WHERE secret=?', hash(secret)) : null; }
  request(name, note) {
    const secret = token(), id = randomUUID();
    this.run("INSERT INTO browsers VALUES(?,?,?,?,'pending',NULL,?)", id, hash(secret), name, note, Date.now());
    return {secret, id};
  }
  approve(id, kind, person = null) {
    return this.transaction(() => this.activate(id, kind, person));
  }
  activate(id, kind, person, name) {
    const browser = this.one('SELECT * FROM browsers WHERE id=?', id);
    if (!browser || browser.status !== 'pending') throw new Error('Only a pending browser can be approved.');
    person ||= randomUUID();
    if (!this.one('SELECT id FROM people WHERE id=?', person)) {
      this.run('INSERT INTO people VALUES(?,?,?,?)', person, name || browser.name, kind, Date.now());
    }
    this.run("UPDATE browsers SET status='revoked' WHERE person=? AND status='approved'", person);
    this.run("UPDATE browsers SET person=?, status='approved' WHERE id=?", person, id);
    // Any other outstanding replacement codes are invalidated by an approval.
    this.run('UPDATE codes SET used=? WHERE person=? AND used IS NULL', Date.now(), person);
    this.log('approve', id);
    return person;
  }
  makeCode(name, kind, person = null) {
    const secret = randomBytes(20).toString('hex').toUpperCase(), id = randomUUID();
    if (person && !this.one('SELECT id FROM people WHERE id=?', person)) throw new Error('Player not found.');
    this.run('INSERT INTO codes VALUES(?,?,?,?,?,?,NULL,?)', id, hash(secret), person, name, kind, Date.now() + 7*86400000, Date.now());
    this.log('create-code', id);
    return {id, code: secret.match(/.{1,5}/g).join('-')};
  }
  redeem(id, code) {
    return this.transaction(() => {
      const row = this.one('SELECT * FROM codes WHERE secret=? AND used IS NULL AND expires>?', hash(code.replace(/[-\s]/g, '').toUpperCase()), Date.now());
      if (!row) throw new Error('This activation code is invalid, expired, or already used.');
      const person = this.activate(id, row.kind, row.person, row.name);
      this.run('UPDATE codes SET used=? WHERE id=?', Date.now(), row.id);
      this.log('redeem', row.id);
      return person;
    });
  }
  dashboard() {
    return {
      requests: this.all("SELECT id,name,note,status,created FROM browsers WHERE status='pending' ORDER BY created DESC LIMIT 500"),
      people: this.all("SELECT p.*,b.id AS browser,b.status FROM people p LEFT JOIN browsers b ON b.person=p.id AND b.status='approved' ORDER BY p.created DESC LIMIT 1000"),
      codes: this.all('SELECT id,name,kind,person,expires,used FROM codes ORDER BY created DESC LIMIT 100'),
      audit: this.all('SELECT * FROM audit ORDER BY id DESC LIMIT 50'),
    };
  }
  close() { this.db.close(); }
}
