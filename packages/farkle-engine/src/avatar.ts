// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// FNV-1a avatar derivation from player ID. Pure utility.
// ─────────────────────────────────────────────────────

export interface AvatarConfig {
  hue: number;      // 0-360 HSL hue
  color: string;    // hex color
  initials: string; // 1-2 char display
  shapeIndex: number; // 0-3 → circle/square/hexagon/star
}

const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function deriveAvatar(playerId: string, playerName?: string): AvatarConfig {
  const hash = fnv1a(playerId);
  const hue = hash % 360;
  const color = hslToHex(hue, 70, 55);
  const shapeIndex = (hash >> 8) % 4;

  let initials = '?';
  if (playerName) {
    const parts = playerName.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    } else {
      initials = (playerName.slice(0, 2)).toUpperCase();
    }
  } else {
    initials = playerId.slice(0, 2).toUpperCase();
  }

  return { hue, color, initials, shapeIndex };
}
