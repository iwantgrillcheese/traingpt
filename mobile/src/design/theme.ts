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
  cream: '#fffaf2',
  topography: '#d8bda0',
  success: '#166534',
  successSoft: '#ecfdf3',
  danger: '#be123c',
  warning: '#854d0e',
  warningSoft: '#fff7ed',
  orange: '#f97316',
  blue: '#2563eb',
  blueSoft: '#eff6ff',
  purple: '#7c3aed',
  purpleSoft: '#f5f3ff',
  red: '#ef4444',
  redSoft: '#fef2f2',
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
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5,
  },
  floating: {
    shadowColor: '#18181b',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
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
  editorial: {
    fontSize: 42,
    lineHeight: 43,
    fontWeight: '900' as const,
    letterSpacing: -2.1,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
} as const;

export const sportColors = {
  Swim: '#2563eb',
  Bike: '#f97316',
  Run: '#22c55e',
  Brick: '#7c3aed',
  Strength: '#6366f1',
  Rest: '#a1a1aa',
  Session: '#09090b',
} as const;
