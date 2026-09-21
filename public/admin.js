const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, latestCode='';
const api=(path,body)=>window.YolkClient.api('/api/admin/'+path,body);
const personOptions=()=>'<option value="">New player</option>'+data.people.map(p=>`<option value="${esc(p.id)}">Replace browser: ${esc(p.name)}</option>`).join('');
async function refresh(){
 try{data=await api('dashboard');$('#login').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false;
 $('#requests').innerHTML=data.requests.map(r=>`<div class="row"><strong>${esc(r.name)}</strong><p>${esc(r.note)}</p><p class="small request-id">${esc(r.id)}</p><div class="actions"><select aria-label="Access type" id="kind-${r.id}"><option value="free">Free</option><option value="paid">Paid</option></select><select aria-label="New player or replacement" id="person-${r.id}">${personOptions()}</select><button data-approve="${r.id}">Approve</button><button data-deny="${r.id}">Decline</button></div></div>`).join('')||'<p>No pending requests.</p>';
 $('#people').innerHTML=data.people.map(p=>`<div class="row"><strong>${esc(p.name)} <span class="pill">${p.kind.toUpperCase()}</span></strong><p class="small">${p.browser?'Browser approved':'No approved browser'} · ${data.online.includes(p.id)?'Online':'Offline'}</p><div class="actions"><button data-kind="${p.id}" data-value="${p.kind==='paid'?'free':'paid'}">Mark ${p.kind==='paid'?'free':'paid'}</button>${p.browser?`<button data-revoke="${p.id}">Revoke access</button>`:''}</div></div>`).join('')||'<p>No approved players yet.</p>';
 const selection=$('#invite-person').value;$('#invite-person').innerHTML=personOptions();$('#invite-person').value=selection;
 $('#codes').innerHTML=data.codes.map(c=>`<div class="row"><strong>${esc(c.name)} · ${c.kind}</strong><p class="small">${c.used?'Used or cancelled':c.expires<Date.now()?'Expired':'Available until '+new Date(c.expires).toLocaleString()}${c.person?' · Replacement browser':''}</p>${!c.used&&c.expires>Date.now()?`<button data-cancel="${c.id}">Cancel code</button>`:''}</div>`).join('')||'<p>No codes created yet.</p>';
 $('#audit').innerHTML=data.audit.map(a=>`<p class="small">${new Date(a.created).toLocaleString()} · ${esc(a.action)} · ${esc(a.target)}</p>`).join('');
 }catch(e){if(e.status===401){$('#login').hidden=false;$('#dashboard').hidden=true;$('#logout').hidden=true;}else throw e;}
}
async function run(fn){try{$('#message').textContent='';await fn();}catch(e){$('#message').textContent=e.message;}}
$('#login-form').onsubmit=e=>{e.preventDefault();run(async()=>{await api('login',{secret:$('#secret').value});$('#secret').value='';await refresh();});};
$('#code-form').onsubmit=e=>{e.preventDefault();run(async()=>{const result=await api('code',{name:$('#invite-name').value,kind:$('#invite-kind').value,person:$('#invite-person').value});latestCode=result.code;$('#code-output').textContent=latestCode;$('#copy-code').hidden=false;await refresh();});};
$('#copy-code').onclick=()=>run(async()=>{await navigator.clipboard.writeText(latestCode);$('#message').textContent='Code copied.';});
$('#refresh').onclick=()=>run(refresh);
$('#logout').onclick=()=>run(async()=>{await api('logout',{});location.reload();});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;run(async()=>{
 let changed=false;
 if(b.dataset.approve){const id=b.dataset.approve, person=$('#person-'+id).value;if(person&&!confirm('Replace this player’s approved browser? Their old browser will lose access immediately.'))return;await api('approve',{id,person,kind:$('#kind-'+id).value});changed=true;}
 if(b.dataset.deny){await api('deny',{id:b.dataset.deny});changed=true;}
 if(b.dataset.revoke&&confirm('Revoke access and disconnect this player now? Outstanding replacement codes will also be cancelled.')){await api('revoke',{id:b.dataset.revoke});changed=true;}
 if(b.dataset.kind){await api('kind',{id:b.dataset.kind,kind:b.dataset.value});changed=true;}
 if(b.dataset.cancel){await api('cancel-code',{id:b.dataset.cancel});changed=true;}
 if(changed)await refresh();
 });});
run(refresh);
