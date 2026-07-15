// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Thin client for the D2 Stage-1 evidence endpoints (§12/§13/§38).
// Fire-and-forget: never throws into the caller, never blocks the UI.
// ─────────────────────────────────────────────────────

// The evidence REST API is served by the same process as the WS game server,
// so by default we derive its HTTP origin from VITE_WS_URL (ws:// -> http://,
// wss:// -> https://) rather than requiring a second env var. Set VITE_API_URL
// explicitly only if the evidence API is ever split onto a different host.
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3001';
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  WS_URL.replace(/^ws/, 'http');

async function postEvidence(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API_URL}/api/evidence/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    /* non-critical — evidence capture never blocks play */
  }
}

/** §31 discovery-notes capture — raw human words, optional, non-blocking. */
export function submitDiscoveryNote(params: {
  player_id: string;
  text: string;
  session_id?: string;
  event_type?: 'discovery_claim' | 'theory_created' | 'hypothesis_recorded' | 'question_created';
}): void {
  void postEvidence('discovery', params);
}

/** §38 session retrospective — single optional end-of-session free-text prompt. */
export function submitSessionRetrospective(params: {
  player_id: string;
  text: string;
  session_id?: string;
}): void {
  void postEvidence('retrospective', params);
}
