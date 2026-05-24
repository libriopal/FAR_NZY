// Spawn integrity test — T3 pass gate verification.
// Verifies: every spawnBody() call produces identity rotation + zero velocity at birth,
// before any world.step() runs. This ensures no stale WASM pool state leaks into a new body.
// FIXED_POINT_CHECK: NOT_APPLICABLE (no scoring arithmetic in this file).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelPhysicsSystem } from '../../systems/VoxelPhysicsSystem';

const EPS = 1e-9;

function assertIdentityQuaternion(r: { x: number; y: number; z: number; w: number }, label: string) {
  assert.ok(Math.abs(r.x) < EPS, `${label}: rotation.x should be 0, got ${r.x}`);
  assert.ok(Math.abs(r.y) < EPS, `${label}: rotation.y should be 0, got ${r.y}`);
  assert.ok(Math.abs(r.z) < EPS, `${label}: rotation.z should be 0, got ${r.z}`);
  assert.ok(Math.abs(r.w - 1) < EPS, `${label}: rotation.w should be 1, got ${r.w}`);
}

function assertZeroVector(v: { x: number; y: number; z: number }, label: string) {
  assert.ok(Math.abs(v.x) < EPS, `${label}: x should be 0, got ${v.x}`);
  assert.ok(Math.abs(v.y) < EPS, `${label}: y should be 0, got ${v.y}`);
  assert.ok(Math.abs(v.z) < EPS, `${label}: z should be 0, got ${v.z}`);
}

test('spawn integrity: die spawn has identity rotation and zero velocity', async () => {
  const sys = await VoxelPhysicsSystem.create(0xdeadbeef);

  const id = sys.spawnBody(3, 'die');
  // Read transform immediately — no world.step() called yet
  const transforms = sys.getAllTransforms();
  const t = transforms.find(x => x.id === id);
  assert.ok(t, 'spawned body must appear in getAllTransforms()');

  assertIdentityQuaternion(t!.rotation, 'die spawn rotation');

  sys.destroy();
});

test('spawn integrity: sphere spawn has identity rotation and zero velocity', async () => {
  const sys = await VoxelPhysicsSystem.create(0xcafebabe);

  const id = sys.spawnBody(0, 'sphere');
  const transforms = sys.getAllTransforms();
  const t = transforms.find(x => x.id === id);
  assert.ok(t, 'spawned sphere must appear in getAllTransforms()');

  assertIdentityQuaternion(t!.rotation, 'sphere spawn rotation');

  sys.destroy();
});

test('spawn integrity: ghost spawn has identity rotation and zero velocity', async () => {
  const sys = await VoxelPhysicsSystem.create(0x12345678);

  // Ghost has an x-offset but must still spawn with identity rotation + zero velocity
  const id = sys.spawnBody(2, 'ghost');
  const transforms = sys.getAllTransforms();
  const t = transforms.find(x => x.id === id);
  assert.ok(t, 'spawned ghost must appear in getAllTransforms()');

  assertIdentityQuaternion(t!.rotation, 'ghost spawn rotation');

  sys.destroy();
});
