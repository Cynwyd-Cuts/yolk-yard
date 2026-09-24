import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
await copyFile('src/worker.js','dist/server/index.js');
await copyFile('src/rooms.js','dist/server/rooms.js');

await copyFile('src/relay.js','dist/server/relay.js');
