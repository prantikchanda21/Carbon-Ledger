export const theme = {
  base: '#020617',
  surface: 'rgba(15, 23, 42, 0.72)',
  surfaceStrong: 'rgba(15, 23, 42, 0.92)',
  border: 'rgba(148, 163, 184, 0.14)',
  accents: { cyan: '#22d3ee', emerald: '#34d399', amber: '#fbbf24', rose: '#fb7185' },
  radius: { sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '1.5rem' },
  elevation: {
    panel: '0 16px 50px -24px rgba(0,0,0,0.9)',
    hero: '0 28px 90px -34px rgba(6,182,212,0.26)',
  },
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const;

export type ThemeAccent = keyof typeof theme.accents;
