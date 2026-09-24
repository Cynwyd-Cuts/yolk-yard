import {CONTROLS,normalizeBindings,assignBinding,bindingLabel} from './keybinds.js';
export class KeybindEditor {
 constructor(root,bindings,onApply){this.root=root;this.saved=normalizeBindings(bindings);this.draft=normalizeBindings(bindings);this.onApply=onApply;this.capture=null;this.query='';this.message='Choose a slot, then press a key, mouse button or scroll direction. Esc cancels capture. Delete clears. An occupied input moves to its new action.';this.render();}
 get dirty(){return JSON.stringify(this.saved)!==JSON.stringify(this.draft);}
 render(){
  const focus=this.root.ownerDocument.activeElement;
  const selector=focus?.dataset.bind?`[data-bind="${focus.dataset.bind}"][data-bind-slot="${focus.dataset.bindSlot}"]`:null;
  this.root.innerHTML=`<label class="binding-search">Find an action<input type="search" data-bind-search placeholder="Movement, inventory, building…"></label><p role="status" class="small binding-status"></p><div class="keybind-row binding-columns"><span>Action</span><span>Primary</span><span>Secondary</span><span>Clear</span></div><div class="binding-rows">${CONTROLS.map(([id,label])=>`<div class="keybind-row" data-bind-row="${id}"><span>${label}</span>${this.draft[id].map((code,slot)=>`<button type="button" data-bind="${id}" data-bind-slot="${slot}" class="${this.capture?.action===id&&this.capture.slot===slot?'listening':''}" aria-label="${label}, ${slot?'secondary':'primary'}: ${bindingLabel(code)}">${this.capture?.action===id&&this.capture.slot===slot?'Press input…':bindingLabel(code)}</button>`).join('')}<button type="button" data-bind-clear="${id}" aria-label="Clear both ${label} bindings">×</button></div>`).join('')}</div><div class="binding-footer"><span class="small">${this.dirty?'Unsaved keybind changes':'Keybinds saved'} · Esc always opens the menu</span><div><button type="button" data-bind-command="reset">Reset defaults</button><button type="button" data-bind-command="discard" ${this.dirty?'':'disabled'}>Discard</button><button type="button" class="primary" data-bind-command="apply" ${this.dirty?'':'disabled'}>Apply</button></div></div>`;
  this.root.querySelector('.binding-status').textContent=this.message;
  this.root.querySelector('[data-bind-search]').value=this.query;this.filter(this.query);
  if(selector)this.root.querySelector(selector)?.focus({preventScroll:true});
 }
 filter(value){this.query=value;for(const row of this.root.querySelectorAll('[data-bind-row]'))row.hidden=!row.textContent.toLowerCase().includes(value.toLowerCase());}
 click(target){
  const bind=target.closest('[data-bind]'),clear=target.closest('[data-bind-clear]'),command=target.closest('[data-bind-command]')?.dataset.bindCommand;
  if(bind){this.capture={action:bind.dataset.bind,slot:Number(bind.dataset.bindSlot)};this.message='Listening… Esc cancels. Delete or Backspace clears this slot.';}
  else if(clear){this.capture=null;this.draft[clear.dataset.bindClear]=[null,null];this.message='Both slots cleared. Apply to save.';}
  else if(command==='reset'){this.capture=null;if(this.resetPending){this.draft=normalizeBindings();this.resetPending=false;this.message='Defaults restored in the draft. Apply to save.';}else{this.resetPending=true;this.message='Press Reset defaults again to reset every action. Discard keeps your saved controls.';}}
  else if(command==='apply'){this.capture=null;this.saved=normalizeBindings(this.draft);this.onApply(normalizeBindings(this.saved));this.message='Keybinds applied.';}
  else if(command==='discard'){this.capture=null;this.draft=normalizeBindings(this.saved);this.message='Changes discarded.';}
  else return;
  if(command!=='reset')this.resetPending=false;
  this.render();
 }
 input(code){
  if(!this.capture)return false;
  if(code==='Escape'){this.capture=null;this.message='Binding unchanged.';this.render();return true;}
  const {action,slot}=this.capture;
  const result=assignBinding(this.draft,action,slot,['Delete','Backspace'].includes(code)?null:code);
  if(result.error){this.message='Unsupported input. Esc is reserved for the menu; scroll cannot hold movement, aim, sprint or scores.';this.render();return true;}
  this.draft=result.bindings;this.capture=null;this.message=result.removed.length?`${bindingLabel(code)} moved from ${result.removed.join(', ')}. Apply to save.`:'Binding updated. Apply to save.';this.render();return true;
 }
}
