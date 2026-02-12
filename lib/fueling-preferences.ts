export type FuelingPreferences = {
  enabled: boolean;
  bodyWeightKg: string;
  bodyFatPct: string;
  sweatRateLPerHour: string;
};

export const FUELING_PREFERENCES_STORAGE_KEY = 'traingpt:fueling-preferences';

export const DEFAULT_FUELING_PREFERENCES: FuelingPreferences = {
  enabled: false,
  bodyWeightKg: '',
  bodyFatPct: '',
  sweatRateLPerHour: '',
};

export function loadFuelingPreferences(): FuelingPreferences {
  if (typeof window === 'undefined') return DEFAULT_FUELING_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(FUELING_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_FUELING_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<FuelingPreferences>;

    return {
      enabled: parsed.enabled === true,
      bodyWeightKg: typeof parsed.bodyWeightKg === 'string' ? parsed.bodyWeightKg : '',
      bodyFatPct: typeof parsed.bodyFatPct === 'string' ? parsed.bodyFatPct : '',
      sweatRateLPerHour:
        typeof parsed.sweatRateLPerHour === 'string' ? parsed.sweatRateLPerHour : '',
    };
  } catch {
    return DEFAULT_FUELING_PREFERENCES;
  }
}

export function saveFuelingPreferences(preferences: FuelingPreferences) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(FUELING_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}
