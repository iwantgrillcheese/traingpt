export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type WalkthroughMode = 'auto' | 'manual';

export type WalkthroughContext = {
  planId: string;
  userId: string;
  raceType?: string | null;
  raceDate?: string | null; // ISO-ish string
  experience?: string | null;
  maxHours?: number | null;
  restDay?: string | null;

  /**
   * Determines guardrails:
   * - auto: show only for beginners + respects dismissal
   * - manual: user explicitly opened; ignore beginner/dismiss restrictions
   */
  mode?: WalkthroughMode;
};

export type CoachResourceKind = 'budget' | 'safe' | 'convenient';

export type CoachResource = {
  label: string;
  kind: CoachResourceKind;
  href: string;
  note?: string;
};

export type CoachCTA = {
  label: string;
  type: 'open_coaching' | 'go_schedule';
  prompt?: string;
};

export type CoachGuideTag =
  | 'expectations'
  | 'time_goals'
  | 'bike'
  | 'gear'
  | 'fueling'
  | 'stress'
  | 'missed_workouts'
  | 'how_to_use_coach';

export type CoachGuide = {
  id: string;
  title: string;
  body: string;
  tags: CoachGuideTag[];
  priority: number;
  applicableTo?: {
    raceTypes?: string[]; // ex: ["Sprint", "Olympic", "Half Ironman (70.3)"]
    experience?: Array<ExperienceLevel | 'any'>;
  };
  resources?: CoachResource[];
  ctas?: CoachCTA[];
};
