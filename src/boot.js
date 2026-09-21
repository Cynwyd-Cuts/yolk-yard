import {session} from './session.js';
try {
 const access=await window.YolkClient.api('/api/access');
 if(access.status!=='approved')location.replace(window.YolkClient.page('access.html')+location.search);
 else {
   await session.open();
   try { if (!localStorage.getItem('yolk-profile')) localStorage.setItem('yolk-profile', JSON.stringify({name:access.name})); } catch {}
   await import('./main.js');
 }
} catch(e) {session.block(e.message||'The game service is unavailable.');}
