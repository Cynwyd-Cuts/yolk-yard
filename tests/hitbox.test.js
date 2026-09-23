import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Euler } from 'three';
import { eggGeometry } from '../src/view.js';
import { EGG_HIT } from '../src/physics.js';

test('the rendered shell stays within its hitbox through a full waddle, including visual smoothing', () => {
  const geometry = eggGeometry(), vertices = geometry.attributes.position;
  for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
    const rotation = new Euler(Math.cos(phase * 2) * 0.015, 0, Math.sin(phase) * 0.27);
    for (let i = 0; i < vertices.count; i++) {
      const point = new Vector3().fromBufferAttribute(vertices, i);
      point.y -= 0.88;
      point.applyEuler(rotation);
      point.y += 0.88 + (1 - Math.cos(phase * 2)) * 0.014 - EGG_HIT.center;
      const radius = Math.hypot(point.x / EGG_HIT.radius, point.y / EGG_HIT.height, point.z / EGG_HIT.radius);
      assert.ok(radius + 0.04 / EGG_HIT.radius <= 1, `Shell outside hitbox at phase ${phase}, vertex ${i}`);
    }
  }
  geometry.dispose();
});
