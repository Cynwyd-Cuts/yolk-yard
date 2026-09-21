import { DatabaseSync } from 'node:sqlite';
import { StoreCore } from './store-core.js';
export { token, hash } from './store-core.js';
export class Store extends StoreCore {
  constructor(path) {
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    super(db);
  }
}
