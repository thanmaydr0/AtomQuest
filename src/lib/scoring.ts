import type { GoalCycle } from '@/types';

export interface ScoreInput {
  uom_type: 'min' | 'max' | 'timeline' | 'zero';
  target_value: number | null;
  actual_achievement: number | null;
  deadline_date: string | null;
  completion_date: string | null;
  cycle_start_date: string;
}

/**
 * Compute a goal score (0–200) based on UoM type and actual vs target.
 * Returns null for invalid / insufficient input.
 */
export function computeScore(input: ScoreInput): number | null {
  const { uom_type, target_value, actual_achievement, deadline_date, completion_date } = input;

  switch (uom_type) {
    case 'min': {
      if (target_value == null || target_value === 0 || actual_achievement == null) return null;
      const score = (target_value / actual_achievement) * 100;
      return Math.min(Math.round(score * 100) / 100, 200);
    }

    case 'max': {
      if (target_value == null || target_value === 0 || actual_achievement == null) return null;
      const score = (actual_achievement / target_value) * 100;
      return Math.min(Math.round(score * 100) / 100, 200);
    }

    case 'timeline': {
      if (!completion_date || !deadline_date) return null;
      return new Date(completion_date) <= new Date(deadline_date) ? 100 : 0;
    }

    case 'zero': {
      if (actual_achievement == null) return null;
      return actual_achievement === 0 ? 100 : 0;
    }

    default:
      return null;
  }
}

/**
 * Returns true if today falls within the cycle's check-in window.
 */
export function isCheckinWindowOpen(cycle: GoalCycle, today: Date = new Date()): boolean {
  if (!cycle.checkin_window_start || !cycle.checkin_window_end) return false;
  const start = new Date(cycle.checkin_window_start);
  const end = new Date(cycle.checkin_window_end);
  // Normalise to date-only comparison
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return t >= s && t <= e;
}

/**
 * Returns a human-readable label for the active phase.
 */
export function getActivePhaseLabel(cycle: GoalCycle): string {
  const labels: Record<string, string> = {
    goal_setting: 'Goal Setting',
    q1: 'Q1 Check-in',
    q2: 'Q2 Check-in',
    q3: 'Q3 Check-in',
    q4: 'Q4 Check-in',
  };
  return labels[cycle.phase] ?? cycle.phase;
}

/**
 * Returns a color class based on score value.
 */
export function scoreColor(score: number | null): string {
  if (score == null) return 'text-neutral-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function scoreBgColor(score: number | null): string {
  if (score == null) return 'bg-neutral-800 text-neutral-500';
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
  return 'bg-red-500/15 text-red-400 border border-red-500/20';
}
