import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPlayIntegrity, checkGeofence } from '../playIntegrity.js';

// ── checkGeofence ─────────────────────────────────────────────────────────────

test('checkGeofence: WA is blocked (restricted state)', () => {
  assert.strictEqual(checkGeofence('WA'), false);
  assert.strictEqual(checkGeofence('wa'), false);
});

test('checkGeofence: CA is allowed', () => {
  assert.strictEqual(checkGeofence('CA'), true);
});

test('checkGeofence: TX is allowed', () => {
  assert.strictEqual(checkGeofence('TX'), true);
});

// ── verifyPlayIntegrity (dev mode) ───────────────────────────────────────────

test('verifyPlayIntegrity: dev stub token is accepted in isDev=true', async () => {
  const result = await verifyPlayIntegrity('dev-integrity-ok', true);
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.verdict?.deviceIntegrity, 'MEETS_DEVICE_INTEGRITY');
});

test('verifyPlayIntegrity: missing token → ATTESTATION_MISSING', async () => {
  const result = await verifyPlayIntegrity(undefined, true);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'ATTESTATION_MISSING');
});

test('verifyPlayIntegrity: wrong token in dev → ATTESTATION_INVALID_DEV_STUB', async () => {
  const result = await verifyPlayIntegrity('wrong-token', true);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'ATTESTATION_INVALID_DEV_STUB');
});
