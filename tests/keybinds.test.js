import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBindings, bindingDown, validBinding, assignBinding } from '../src/keybinds.js';
test('defaults, remaps, unbound slots and invalid stored bindings', () => {
 const defaults = normalizeBindings();
 assert.ok(bindingDown(defaults, new Set(['ArrowUp']), 'forward'));
 const custom = normalizeBindings({...defaults, forward:['KeyI',null], fire:[null,null]});
 assert.ok(bindingDown(custom,new Set(['KeyI']),'forward'));
 assert.ok(!bindingDown(custom,new Set(['KeyW']),'forward'));
 assert.ok(!bindingDown(custom,new Set(['Mouse0']),'fire'));
 assert.deepEqual(normalizeBindings(custom),custom);
 assert.equal(validBinding('Escape'),false);
 assert.equal(validBinding('<script>'),false);
 assert.equal(normalizeBindings({forward:['KeyI','KeyI']}).forward[1],null);
});
test('reassignment clears the previous owner without swapping unrelated slots',()=>{
 const old=normalizeBindings();const {bindings,removed}=assignBinding(old,'jump',1,'KeyW');
 assert.deepEqual(bindings.forward,[null,'ArrowUp']);assert.deepEqual(bindings.jump,['Space','KeyW']);assert.deepEqual(removed,['Move forward']);assert.equal(old.forward[0],'KeyW');
 const moved=assignBinding(bindings,'jump',0,'KeyW').bindings;assert.deepEqual(moved.jump,['KeyW',null]);assert.deepEqual(normalizeBindings(moved),moved);
 assert.deepEqual(assignBinding(moved,'jump',0,null).bindings.jump,[null,null]);
});
test('scroll pulses support discrete actions but cannot become held movement or aim',()=>{
 assert.ok(assignBinding(normalizeBindings(),'reload',0,'WheelDown').bindings.reload.includes('WheelDown'));
 for(const action of ['forward','aim','sprint','scores'])assert.ok(assignBinding(normalizeBindings(),action,0,'WheelDown').error);
 assert.ok(assignBinding(normalizeBindings(),'jump',0,'Escape').error);
});
