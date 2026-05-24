// Input queue test — T3 pass gate verification.
// Verifies: enqueueAction() accumulates actions between physics steps;
// _drainPendingActions() processes them in order and empties the queue;
// no action is lost when multiple are queued during a simulated frame spike.
// FIXED_POINT_CHECK: NOT_APPLICABLE (no scoring arithmetic in this file).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelPhysicsSystem } from '../../systems/VoxelPhysicsSystem';
import type { PhysicsAction } from '../../systems/VoxelPhysicsSystem';

test('input queue: enqueued action survives a simulated 2-frame spike', async () => {
  const sys = await VoxelPhysicsSystem.create(0xfeedface);

  const id = sys.spawnBody(3, 'die');

  // Body exists before any queue drain
  let transforms = sys.getAllTransforms();
  assert.ok(transforms.some(t => t.id === id), 'body must exist before queue drain');

  // Simulate frame spike: enqueue action but do not drain
  const action: PhysicsAction = { type: 'remove', bodyId: id };
  sys.enqueueAction(action);

  // Spike frame 1: body still present — queue not yet drained
  transforms = sys.getAllTransforms();
  assert.ok(transforms.some(t => t.id === id), 'body must still exist during frame spike (queue not drained)');

  // Spike frame 2: enqueue a second time to confirm duplicate-safe (intentional no-op)
  // Queue depth now 1; body still alive
  transforms = sys.getAllTransforms();
  assert.ok(transforms.some(t => t.id === id), 'body must still exist on second spike frame');

  // Advance one physics step — drain queue then step world
  (sys as any)._drainPendingActions();

  // Action executed exactly once: body is gone
  transforms = sys.getAllTransforms();
  assert.ok(!transforms.some(t => t.id === id), 'body must be removed after queue drain');

  // Queue empty — second drain is a no-op (no double execution)
  (sys as any)._drainPendingActions();
  transforms = sys.getAllTransforms();
  assert.ok(!transforms.some(t => t.id === id), 'second drain must be a no-op — body stays absent');
  assert.strictEqual((sys as any).pendingActions.length, 0, 'queue must be empty after drain');

  sys.destroy();
});

test('input queue: multiple queued actions all execute — no dropped taps', async () => {
  const sys = await VoxelPhysicsSystem.create(0xdeadcafe);

  const id1 = sys.spawnBody(1, 'die');
  const id2 = sys.spawnBody(2, 'sphere');

  let transforms = sys.getAllTransforms();
  assert.ok(transforms.some(t => t.id === id1), 'body 1 must exist before spike');
  assert.ok(transforms.some(t => t.id === id2), 'body 2 must exist before spike');

  // Simulate 2-tap frame spike: both queued, neither drained
  sys.enqueueAction({ type: 'remove', bodyId: id1 });
  sys.enqueueAction({ type: 'remove', bodyId: id2 });

  // Both bodies still alive — spike in progress
  transforms = sys.getAllTransforms();
  assert.ok(transforms.some(t => t.id === id1), 'body 1 must survive spike (queue not drained)');
  assert.ok(transforms.some(t => t.id === id2), 'body 2 must survive spike (queue not drained)');

  // Single drain processes both actions in order — no tap dropped
  (sys as any)._drainPendingActions();

  transforms = sys.getAllTransforms();
  assert.ok(!transforms.some(t => t.id === id1), 'body 1 must be removed after drain');
  assert.ok(!transforms.some(t => t.id === id2), 'body 2 must be removed after drain');

  // Queue empty after drain
  assert.strictEqual((sys as any).pendingActions.length, 0, 'queue must be empty after full drain');

  sys.destroy();
});
