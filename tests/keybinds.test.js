import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBindings, bindingDown, validBinding } from '../src/keybinds.js';
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
