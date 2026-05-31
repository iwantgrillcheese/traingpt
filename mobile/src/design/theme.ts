export const colors = {
  background: '#fbfaf8',
  surface: '#ffffff',
  surfaceMuted: '#f4f1ec',
  ink: '#09090b',
  inkSoft: '#3f3f46',
  muted: '#71717a',
  faint: '#a1a1aa',
  border: '#e7e3dc',
  borderStrong: '#d6d3cd',
  brand: '#09090b',
  brandSoft: '#efeae2',
  success: '#166534',
  danger: '#be123c',
  warning: '#854d0e',
} as const;

export const radius = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
  xxl: 36,
} as const;

export const spacing = {
  pageX: 20,
  pageTop: 72,
  pageBottom: 124,
} as const;

export const shadow = {
  card: {
    shadowColor: '#18181b',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  hero: {
    shadowColor: '#18181b',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
} as const;

export const typography = {
  kicker: {
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 40,
    lineHeight: 40,
    fontWeight: '900' as const,
    letterSpacing: -1.9,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
} as const;
