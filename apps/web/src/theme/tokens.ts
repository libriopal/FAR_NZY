// ─────────────────────────────────────────────────────
// FARKLE FRENZY + FAR_NZY — ThemeRegistry v2
// Organic Vegas 1.0 base + FAR_NZY expansion tokens.
// Single source of truth for palette, shader uniforms, timing,
// currency identity, reality duality, visual tiers, and UI sub-themes.
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
  // Acid lime — corpus-canonical #1 frequency color (#C8D400 ×48); BIOLOGICAL energy / primary CTA
  acidLime:      '#c8d400',
  acidLimeGlow:  'rgba(200,212,0,0.45)',

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
  bioEase:     'cubic-bezier(0.25, 0.46, 0.45, 0.94)',  // fluid, slow — Bio UI
  vaultEase:   'cubic-bezier(0.4, 0, 0.6, 1)',           // snappy, mechanical — Vault UI
  crystalEase: 'cubic-bezier(0.34, 1.56, 0.64, 1)',      // resonant spring — Crystal UI
} as const;

// ── Reality Duality Law ────────────────────────────────────────────────────────
// Magenta = physical reality (human, organic, warm, gothic, bound)
// Cyan    = virtual reality  (AI, digital, crystalline, open, electric)
// Every state-change color must choose one axis.
export const REALITY = {
  physical: {
    color:      '#ff00cc', // OV.magenta
    glow:       'rgba(255,0,204,0.45)',
    emissive:   '#4a0030',
    label:      'Physical',
  },
  virtual: {
    color:      '#00e5ff', // OV.cyan
    glow:       'rgba(0,229,255,0.45)',
    emissive:   '#003a4a',
    label:      'Virtual',
  },
  infrastructure: {
    color:      '#c9a84c', // OV.gold — the mesh between both worlds
    glow:       'rgba(201,168,76,0.55)',
    emissive:   '#3a2a00',
    label:      'Mesh',
  },
} as const;

// ── Visual Tier System ─────────────────────────────────────────────────────────
// Level-progressive palette state. Exact level thresholds are a design gate.
// Use these as R3F uniform targets interpolated by level number.
export const TIER = {
  1: {
    name:              'The Signal',
    mood:              'Welcoming hacker lofi. Calm. Electric but controlled.',
    boardBg:           '#0a1628', // cool dark navy
    ambientColor:      '#8aaabb',
    bloomThreshold:    0.80,
    bloomIntensity:    0.9,
    vignetteOpacity:   0.35,
    scanlineOpacity:   0.07,
    glitch:            false,
    horrorIntensity:   0,
  },
  2: {
    name:              'The Static',
    mood:              'The signal is degrading. Something is watching.',
    boardBg:           '#0e1220',
    ambientColor:      '#7a9aab',
    bloomThreshold:    0.70,
    bloomIntensity:    1.1,
    vignetteOpacity:   0.45,
    scanlineOpacity:   0.12,
    glitch:            true,
    horrorIntensity:   0.15,
  },
  3: {
    name:              'The Infection',
    mood:              'The flesh of the machine. Reality is warm and wet.',
    boardBg:           '#120808',
    ambientColor:      '#996655',
    bloomThreshold:    0.65,
    bloomIntensity:    1.4,
    vignetteOpacity:   0.65,
    scanlineOpacity:   0.18,
    glitch:            true,
    horrorIntensity:   0.55,
  },
  4: {
    name:              'The Fracture',
    mood:              'The laptop is the nightmare. Poetry and terror.',
    boardBg:           '#1a0a0a',
    ambientColor:      '#aa4422',
    bloomThreshold:    0.55,
    bloomIntensity:    1.8,
    vignetteOpacity:   0.80,
    scanlineOpacity:   0.25,
    glitch:            true,
    horrorIntensity:   1.0,
  },
} as const;

// ── FAR_NZY Currency Identity ─────────────────────────────────────────────────
// Three currencies with distinct visual personalities.
// Never display legacy names: GC, SC, GoldCoin, SweepCoin.
export const CURRENCY = {
  fd: {
    color:          '#00e5cc', // toxic cyan — BIOLOGICAL pillar
    emissive:       '#1a7a4a',
    glowColor:      'rgba(0,229,204,0.45)',
    particleColor:  '#8bc34a',
    labelSingular:  'FarqlDust',
    labelPlural:    'FarqlDust',   // uncountable noun
    symbol:         'FD',
    legacy:         'GC',
    tier:           'common',
    icon:           'spore-dust',
    pillar:         'BIOLOGICAL',
  },
  pdx: {
    color:          '#7b00ff', // ultraviolet — CRYSTALLINE pillar
    emissive:       '#4a0080',
    glowColor:      'rgba(123,0,255,0.45)',
    particleColor:  '#bf80ff',
    labelSingular:  'PrimeDie',
    labelPlural:    'PrimeDice',
    symbol:         'PDX',
    legacy:         'SC',
    tier:           'premium',
    icon:           'prime-die',
    pillar:         'CRYSTALLINE',
  },
  sdx: {
    color:          '#050008', // near-black — VOIDSHARD base
    emissive:       '#3d007a',
    glowColor:      '#7b00ff', // UV fresnel edge
    lightningColor: '#bf80ff', // internal lightning
    particleColor:  '#000000', // negative-space dark particles
    labelSingular:  'Voidshard',
    labelPlural:    'Voidshards',
    symbol:         'SDX',
    tier:           'scarce',
    icon:           'voidshard',
    pillar:         'CRYSTALLINE',
    cryptographic:  true,
    nftBacked:      true,
  },
} as const;

// ── FAR_NZY UI Sub-themes ─────────────────────────────────────────────────────
export const UI_THEME = {
  // Bio UI — BIOLOGICAL screens (BioGarden, FD economy)
  bio: {
    borderRadius:   '24px',
    border:         '1px solid rgba(0,229,204,0.3)',
    background:     'rgba(10,15,10,0.85)',
    colorLabel:     '#8bc34a',
    colorBody:      '#e8f5e9',
    transitionMs:   400,
    ease:           'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  // Vault UI — INDUSTRIAL screens (economy, settings, compliance)
  vault: {
    borderRadius:   '2px',
    border:         '1px solid #ffb300',
    background:     'rgba(17,17,17,0.95)',
    colorLabel:     '#ffb300',
    colorBody:      '#8a8a8a',
    transitionMs:   150,
    ease:           'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  // Crystal UI — CRYSTALLINE screens (PDX/SDX staking, shop)
  crystal: {
    borderRadius:   '0px',
    clipPath:       'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
    border:         '1px solid rgba(123,0,255,0.5)',
    background:     'rgba(26,0,51,0.9)',
    colorLabel:     '#bf80ff',
    colorBody:      '#e1bee7',
    transitionMs:   250,
    ease:           'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────
// Matches design_tokens.json fontStacks.
export const TYPE = {
  fontDisplay:  '"Cinzel", "Cormorant Garamond", Georgia, serif',
  fontBody:     '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
  fontCode:     '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  scale: {
    display:      { size: 40, lineHeight: 1.04, weight: 700 },
    sectionTitle: { size: 22, lineHeight: 1.12, weight: 650 },
    body:         { size: 16, lineHeight: 1.45, weight: 450 },
    caption:      { size: 12, lineHeight: 1.32, weight: 500 },
    hudNumeric:   { size: 24, lineHeight: 1.00, weight: 700 },
  },
} as const;

// ── Spacing (4px unit, matches design_tokens.json) ────────────────────────────
export const SPACE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

// ── FAR_NZY Pillar Palettes ───────────────────────────────────────────────────
export const PILLAR = {
  BIOLOGICAL: {
    primary:    '#1a7a4a', // emerald green
    accent:     '#00e5cc', // toxic cyan
    highlight:  '#8bc34a', // neon moss
    surface:    '#0a0f0a', // dark forest black
    glow:       'rgba(0,229,204,0.35)',
  },
  INDUSTRIAL: {
    primary:    '#ffb300', // amber
    accent:     '#ff6d00', // reactor orange
    highlight:  '#b7410e', // rust
    surface:    '#111111', // matte black
    secondary:  '#8a8a8a', // cold gray
  },
  CRYSTALLINE: {
    primary:    '#7b00ff', // ultraviolet
    accent:     '#bf80ff', // cosmic violet
    highlight:  '#c2185b', // deep magenta
    surface:    '#1a0033', // near-black purple
    deep:       '#4a0080', // cosmic violet dark
  },
} as const;
