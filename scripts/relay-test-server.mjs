import {DatabaseSync} from 'node:sqlite';
import {WebSocketServer} from 'ws';
import {readFileSync} from 'node:fs';
import {RelaySession} from '../server/service/src/relay.js';
export async function startRelay(port=9002){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../server/relay-schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return stmt.run(...args);},_run(){return stmt.run(...args);}};}};},async batch(statements){sqlite.exec('BEGIN');try{const rows=statements.map(s=>s._run());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const server=new WebSocketServer({port,host:'127.0.0.1'}),sessions=new Set();
 server.on('connection',ws=>{const session=new RelaySession(db,ws);sessions.add(session);ws.on('message',(data,binary)=>session.receive(binary?data:data.toString()));ws.on('close',()=>session.close().catch(()=>{}));ws.on('error',()=>session.close().catch(()=>{}));session.poll();});
 await new Promise(resolve=>server.on('listening',resolve));
 return {server,db,sqlite,sessions,async close(){await Promise.all([...sessions].map(s=>s.close()));await new Promise(resolve=>server.close(resolve));sqlite.close();}};
}
