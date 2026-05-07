export const BIO_TOKENS = {
  glass: {
    bg:         'rgba(255, 255, 255, 0.06)',
    bgHeavy:    'rgba(255, 255, 255, 0.11)',
    border:     'rgba(255, 255, 255, 0.14)',
  },
  marble: {
    950: '#1c1917',
    900: '#292524',
    800: '#44403c',
    500: '#78716c',
    200: '#e7e5e4',
  },
  glow: {
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#f59e0b',
  },
  vine: {
    dark: '#15803d',
    mid:  '#16a34a',
  },
  blueprint:     '#3b82f6',
  blueprintGlow: 'rgba(59, 130, 246, 0.35)',
  danger:        '#ef4444',
  safe:          '#22c55e',
} as const;

export type BioVariant = 'architect' | 'gardener' | 'blueprint';
export const VARIANTS: BioVariant[] = ['architect', 'gardener', 'blueprint'];

export const VARIANT_LABELS: Record<BioVariant, string> = {
  architect: 'Architect',
  gardener:  'Gardener',
  blueprint: 'Blueprint',
};

export const VARIANT_ACCENT: Record<BioVariant, string> = {
  architect: '#f59e0b',
  gardener:  '#4ade80',
  blueprint: '#3b82f6',
};
