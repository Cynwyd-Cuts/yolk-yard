const $=s=>document.querySelector(s);
const api=window.YolkClient.api;
let last='';
async function refresh(){
 try{
 const s=await api('/api/access');
 if(s.status==='approved'){location.replace(window.YolkClient.page('./')+location.search);return;}
 if(last!==s.status){
 last=s.status;
 $('#status').textContent=({new:'Request access to get started.',pending:'Request sent. Waiting for the owner’s approval.',denied:'This request was declined. Contact the owner if this was a mistake.',revoked:'Access for this browser has ended. Contact the owner about a replacement.'})[s.status];
 $('#request').hidden=!['new','denied','revoked'].includes(s.status); $('#pending').hidden=s.status!=='pending';
 $('#activation').hidden=!['new','pending'].includes(s.status); $('#reference').textContent=s.requestId||'';
 }
 }catch{last='';$('#status').textContent='The access service is unavailable. Reconnecting…';}
}
function form(id,action){$(id).addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;$('#message').textContent='';try{await action();await refresh();}catch(err){$('#message').textContent=err.message;}finally{b.disabled=false;}});}
form('#request',()=>api('/api/request',{name:$('#name').value,note:$('#note').value}));
form('#redeem',async()=>{
 if(last==='new'){
   if(!$('#name').value.trim())throw new Error('Enter your name above before activating.');
   await api('/api/request',{name:$('#name').value,note:$('#note').value});
 }
 await api('/api/redeem',{code:$('#code').value});
});
refresh();setInterval(refresh,4000);
