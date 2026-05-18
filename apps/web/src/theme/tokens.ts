// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Organic Vegas 1.0 ThemeRegistry
// Single source of truth for palette, shader uniforms, and timing.
// All CSS vars in bio-architect.css mirror these values.
// ─────────────────────────────────────────────────────

export const OV = {
  // ── Core void palette ──────────────────────────────
  void:          '#050008',
  neural:        '#0d0018',
  neuralMid:     '#160028',
  bone:          '#e8d5a3',
  boneDim:       'rgba(232,213,163,0.35)',

  // ── Gold filigree ──────────────────────────────────
  gold:          '#c9a84c',
  goldBright:    '#f0c860',
  goldGlow:      'rgba(201,168,76,0.55)',
  goldDim:       'rgba(201,168,76,0.22)',

  // ── Neon channels ─────────────────────────────────
  cyan:          '#00e5ff',
  cyanBright:    '#80f9ff',
  cyanGlow:      'rgba(0,229,255,0.45)',
  magenta:       '#ff00cc',
  magentaBright: '#ff80e8',
  magentaGlow:   'rgba(255,0,204,0.45)',
  amberHot:      '#ff7200',

  // ── Specimen die — obsidian body ───────────────────
  obsidian:      '#0a080e',
  obsidianMid:   '#12101a',
  obsidianEdge:  '#1e1c28',

  // ── Neon pip colors by face (1-6) ──────────────────
  pipColor: {
    1: '#ff2244',
    2: '#ff7700',
    3: '#ffe000',
    4: '#00ff66',
    5: '#00aaff',
    6: '#cc44ff',
  } as Record<number, string>,

  // ── Ice Stone specimen ─────────────────────────────
  iceBase:   '#0d1a26',
  iceMid:    '#1e3a52',
  iceSSS:    '#7ad8f8',
  iceRim:    '#c0f0ff',

  // ── Dark Granite specimen ──────────────────────────
  stoneBase:  '#0f0c09',
  stoneMid:   '#1e1810',
  stoneGrain: '#060503',

  // ── Bio-Bomb specimen ──────────────────────────────
  bombBase:       '#080508',
  bombVein:       '#ff0030',
  bombVeinBright: '#ff6080',

  // ── Lock chain ────────────────────────────────────
  lockBase:  '#14121c',
  lockChain: '#8a8090',
  lockShackle: '#b0a8b8',

  // ── Shader uniform vec3 helpers ───────────────────
  // Use with `new THREE.Color().setRGB(...OV.uniform.cyan)`
  uniform: {
    cyan:    [0.000, 0.898, 1.000] as [number,number,number],
    magenta: [1.000, 0.000, 0.800] as [number,number,number],
    gold:    [0.788, 0.659, 0.298] as [number,number,number],
    void:    [0.020, 0.000, 0.031] as [number,number,number],
    obsidian:[0.039, 0.031, 0.055] as [number,number,number],
    iceSSS:  [0.478, 0.847, 0.973] as [number,number,number],
    bombVein:[1.000, 0.000, 0.188] as [number,number,number],
  },

  // ── Timing ────────────────────────────────────────
  dissolveMs:  400,
  springEase:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
  fastEase:    'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
