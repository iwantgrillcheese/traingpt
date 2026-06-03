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

  // Core semantic palette. Keep greens intentionally narrow so readiness,
  // points, and completion states feel like one premium system.
  success: '#1f6b4f',
  successSoft: '#eaf4ef',
  successMuted: '#f4faf6',

  danger: '#be123c',
  dangerSoft: '#fff1f2',
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
  // Use two visual radii across the app: cards and pills. The legacy aliases
  // intentionally map back to those two values to avoid a noisy UI system.
  card: 24,
  pill: 999,
  sm: 24,
  md: 24,
  lg: 24,
  xl: 24,
  xxl: 24,
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
    shadowOpacity: 0.1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#18181b',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

export const typography = {
  kicker: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  editorial: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -1.6,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
} as const;

export const sportColors = {
  Swim: '#2563eb',
  Bike: '#f97316',
  Run: colors.success,
  Brick: '#7c3aed',
  Strength: '#6366f1',
  Rest: '#a1a1aa',
  Session: colors.ink,
} as const;
