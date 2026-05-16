// ─── Application Constants ─────────────────────────────────────

export const MAX_GOALS_PER_EMPLOYEE = 8;
export const MIN_WEIGHTAGE = 10;
export const TOTAL_WEIGHTAGE = 100;

export const ESCALATION_WARNING_DAYS = 5;
export const ESCALATION_MANAGER_DAYS = 10;
export const ESCALATION_SKIP_DAYS = 15;

export const THRUST_AREAS = [
  'Revenue Growth',
  'Cost Optimisation',
  'Customer Experience',
  'People & Culture',
  'Operational Excellence',
  'Innovation',
] as const;

export type ThrustArea = (typeof THRUST_AREAS)[number];

export const UOM_LABELS: Record<string, string> = {
  min: 'Minimise',
  max: 'Maximise',
  timeline: 'Timeline',
  zero: 'Zero Incidents',
};

export const UOM_TYPES = ['min', 'max', 'timeline', 'zero'] as const;
export type UomType = (typeof UOM_TYPES)[number];

export const CYCLE_PHASES = ['q1', 'q2', 'q3', 'q4'] as const;
export type CyclePhase = (typeof CYCLE_PHASES)[number];

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-500/15 text-neutral-400',
  submitted: 'bg-blue-500/15 text-blue-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  locked: 'bg-purple-500/15 text-purple-400',
  returned: 'bg-red-500/15 text-red-400',
  not_started: 'bg-neutral-500/15 text-neutral-400',
  on_track: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
};

export const BRAND = {
  gold: '#fdb913',
  goldHover: '#e5a710',
  goldLight: 'rgba(253, 185, 19, 0.1)',
} as const;
