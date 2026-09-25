import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('browser security policy permits the configured gameplay WebSocket',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const config=readFileSync(new URL('../public/network-config.js',import.meta.url),'utf8');
 const context={window:{}};vm.runInNewContext(config,context);
 const origin=new URL(context.window.YOLK_NETWORK.relay).origin;
 const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 const allowed=policy.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src ')).split(/\s+/);
 assert.ok(allowed.includes(origin),'connect-src must explicitly allow '+origin);
});
