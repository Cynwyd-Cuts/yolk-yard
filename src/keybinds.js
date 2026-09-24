export const CONTROLS = [
  ['forward', 'Move forward', 'KeyW', 'ArrowUp'],
  ['back', 'Move backward', 'KeyS', 'ArrowDown'],
  ['left', 'Move left', 'KeyA', 'ArrowLeft'],
  ['right', 'Move right', 'KeyD', 'ArrowRight'],
  ['jump', 'Jump', 'Space', null],
  ['fire', 'Fire', 'Mouse0', null],
  ['aim', 'Aim / scope', 'Mouse2', null],
  ['reload', 'Reload', 'KeyR', null],
  ['popper', 'Throw popper', 'KeyE', 'KeyG'],
  ['primary', 'Primary blaster', 'Digit1', null],
  ['sidearm', 'Sidearm', 'Digit2', null],
  ['swap', 'Swap blaster', 'KeyQ', null],
  ['nextSlot', 'Next item', 'WheelDown', null],
  ['previousSlot', 'Previous item', 'WheelUp', null],
  ['scores', 'Scoreboard', 'Tab', null],
  ['sprint','Sprint (Royale)','ShiftLeft',null],
  ['interact','Search / pick up (Royale)','KeyF',null],
  ['map','Island map (Royale)','KeyM',null],
  ['inventory','Inventory (Royale)','KeyI',null],
  ['drop','Drop item (Royale)','KeyX',null],
  ['slot3','Slot 3 (Royale)','Digit3',null],
  ['slot4','Slot 4 (Royale)','Digit4',null],
  ['slot5','Slot 5 (Royale)','Digit5',null],
  ['pickaxe','Pickaxe (Royale)','Digit6',null],
  ['buildToggle','Build mode (Royale)','KeyH',null],
  ['buildWall','Wall (Royale)','KeyZ',null],
  ['buildFloor','Floor (Royale)','KeyC',null],
  ['buildStairs','Stairs (Royale)','KeyV',null],
  ['buildRoof','Roof (Royale)','KeyB',null],
  ['buildRotate','Rotate build (Royale)','KeyN',null],
  ['buildMaterial','Next material (Royale)','Comma',null],
  ['buildEdit','Edit / confirm (Royale)','KeyJ',null],
  ['buildRepair','Repair (Royale)','KeyK',null],
  ['chat', 'Open chat', 'Enter', 'KeyT'],
];
export const validBinding = code => typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Mouse[0-4]|Wheel(Up|Down)|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Enter|CapsLock|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Home|End|PageUp|PageDown|Insert|F([1-9]|1[01]))$/.test(code);
const heldActions=new Set(['forward','back','left','right','aim','sprint','scores']);
export const bindingAllowed=(action,code)=>validBinding(code)&&!(code.startsWith('Wheel')&&heldActions.has(action));
export function assignBinding(bindings,action,slot,code){
 const next=normalizeBindings(bindings),removed=[];
 if(!next[action]||![0,1].includes(slot)||(code!==null&&!bindingAllowed(action,code)))return {bindings:next,removed,error:'This input cannot be used for this action.'};
 if(code)for(const [id,label] of CONTROLS)next[id]=next[id].map((key,i)=>{if(key===code&&(id!==action||i!==slot)){removed.push(label);return null;}return key;});
 next[action][slot]=code;
 return {bindings:next,removed};
}
export function normalizeBindings(saved) {
  const used = new Set();
  const ordered=[...CONTROLS].sort((a,b)=>Number(Array.isArray(saved?.[b[0]]))-Number(Array.isArray(saved?.[a[0]])));
  const result=Object.fromEntries(ordered.map(([id,, ...defaults]) => [id,
    (Array.isArray(saved?.[id]) ? saved[id] : defaults).slice(0, 2).concat(null, null).slice(0, 2).map(code => {
      if (!bindingAllowed(id,code) || used.has(code)) return null;
      used.add(code); return code;
    })]));
  return Object.fromEntries(CONTROLS.map(([id])=>[id,result[id]]));
}
export const bindingDown = (bindings, keys, action) => bindings[action].some(code => code && keys.has(code));
export function bindingLabel(code) {
  if (!code) return 'Unbound';
  return ({WheelUp:'Wheel up',WheelDown:'Wheel down',Mouse0:'Left click',Mouse1:'Middle click',Mouse2:'Right click',Mouse3:'Mouse 4',Mouse4:'Mouse 5',Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',ControlLeft:'Left Ctrl',ControlRight:'Right Ctrl',AltLeft:'Left Alt',AltRight:'Right Alt'})[code] || code.replace(/^Key|^Digit/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}
