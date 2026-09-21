import {session} from './session.js';
try {
 const response=await fetch('/api/access');
 if(!response.ok)throw new Error('The access service is unavailable.');
 const access=await response.json();
 if(access.status!=='approved')location.replace('/access'+location.search);
 else {
   await session.open();
   try { if (!localStorage.getItem('yolk-profile')) localStorage.setItem('yolk-profile', JSON.stringify({name:access.name})); } catch {}
   await import('./main.js');
 }
} catch(e) {session.block(e.message||'The game service is unavailable.');}
