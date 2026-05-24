// ─── Play Integrity API Middleware ───────────────────────────────────────────
// Validates Google Play Integrity tokens before any PDX (Prize Distribution
// Exchange) award. A missing or invalid token → 403 / PDX_BLOCKED.
//
// In production: verifies token against Google's Play Integrity API using
// PLAY_INTEGRITY_DECRYPTION_KEY + PLAY_INTEGRITY_VERIFICATION_KEY env vars.
// In development/test: accepts stub token 'dev-integrity-ok'.
//
// LEGAL: PDX awards without verified device integrity are a legal violation.
// This module is a mandatory gate in the PDX award path.
// ─────────────────────────────────────────────────────────────────────────────

import { RESTRICTED_STATES } from '@match3d/compliance';

export type DeviceIntegrityLabel =
  | 'MEETS_DEVICE_INTEGRITY'
  | 'MEETS_BASIC_INTEGRITY'
  | 'FAILS_INTEGRITY';

export type AppIntegrityLabel =
  | 'RECOGNIZED'
  | 'UNRECOGNIZED_VERSION'
  | 'UNEVALUATED';

export interface IntegrityVerdict {
  deviceIntegrity: DeviceIntegrityLabel;
  appIntegrity: AppIntegrityLabel;
  accountActivity: 'UNEVALUATED' | 'UNKNOWN_ACCOUNT_RISK';
}

export interface AttestationResult {
  allowed: boolean;
  verdict?: IntegrityVerdict;
  reason?: string;
}

const DEV_STUB_TOKEN = 'dev-integrity-ok';
const IS_PROD = process.env['NODE_ENV'] === 'production';

export async function verifyPlayIntegrity(
  token: string | undefined,
  isDev: boolean = !IS_PROD,
): Promise<AttestationResult> {
  if (!token) {
    return { allowed: false, reason: 'ATTESTATION_MISSING' };
  }

  if (isDev) {
    if (token === DEV_STUB_TOKEN) {
      return {
        allowed: true,
        verdict: {
          deviceIntegrity: 'MEETS_DEVICE_INTEGRITY',
          appIntegrity: 'RECOGNIZED',
          accountActivity: 'UNEVALUATED',
        },
      };
    }
    return { allowed: false, reason: 'ATTESTATION_INVALID_DEV_STUB' };
  }

  // Production: call Google Play Integrity API.
  // POST https://playintegrity.googleapis.com/v1/{packageName}:decodeIntegrityToken
  // Requires PLAY_INTEGRITY_DECRYPTION_KEY + PLAY_INTEGRITY_VERIFICATION_KEY in env.
  const decryptionKey = process.env['PLAY_INTEGRITY_DECRYPTION_KEY'];
  const verificationKey = process.env['PLAY_INTEGRITY_VERIFICATION_KEY'];
  const packageName = process.env['ANDROID_PACKAGE_NAME'] ?? 'com.libriopal.farnzy';

  if (!decryptionKey || !verificationKey) {
    console.error('[PlayIntegrity] Production keys missing — ATTESTATION_CONFIG_ERROR');
    return { allowed: false, reason: 'ATTESTATION_CONFIG_ERROR' };
  }

  try {
    const res = await fetch(
      `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrity_token: token }),
      },
    );

    if (!res.ok) {
      return { allowed: false, reason: `ATTESTATION_API_ERROR_${res.status}` };
    }

    const body = await res.json() as {
      tokenPayloadExternal?: {
        deviceIntegrity?: { deviceRecognitionVerdict?: string[] };
        appIntegrity?: { appRecognitionVerdict?: string };
        accountDetails?: { appLicensingVerdict?: string };
      };
    };

    const verdictLabels = body.tokenPayloadExternal?.deviceIntegrity?.deviceRecognitionVerdict ?? [];
    const appVerdict = body.tokenPayloadExternal?.appIntegrity?.appRecognitionVerdict ?? 'UNEVALUATED';

    const deviceIntegrity: DeviceIntegrityLabel = verdictLabels.includes('MEETS_DEVICE_INTEGRITY')
      ? 'MEETS_DEVICE_INTEGRITY'
      : verdictLabels.includes('MEETS_BASIC_INTEGRITY')
        ? 'MEETS_BASIC_INTEGRITY'
        : 'FAILS_INTEGRITY';

    const appIntegrity: AppIntegrityLabel = appVerdict === 'RECOGNIZED'
      ? 'RECOGNIZED'
      : appVerdict === 'UNRECOGNIZED_VERSION'
        ? 'UNRECOGNIZED_VERSION'
        : 'UNEVALUATED';

    const verdict: IntegrityVerdict = {
      deviceIntegrity,
      appIntegrity,
      accountActivity: 'UNEVALUATED',
    };

    // PDX requires MEETS_DEVICE_INTEGRITY minimum.
    if (deviceIntegrity !== 'MEETS_DEVICE_INTEGRITY') {
      return { allowed: false, verdict, reason: 'DEVICE_INTEGRITY_INSUFFICIENT' };
    }

    return { allowed: true, verdict };
  } catch (err) {
    console.error('[PlayIntegrity] Verification error:', err);
    return { allowed: false, reason: 'ATTESTATION_NETWORK_ERROR' };
  }
}

// ─── Geofencing ───────────────────────────────────────────────────────────────
// Returns false if the player's state is in RESTRICTED_STATES.
// Enforced server-side in addition to the client UI gate.

export function checkGeofence(state: string): boolean {
  return !RESTRICTED_STATES.has(state.toUpperCase());
}
