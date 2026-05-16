export type Role = 'employee' | 'manager' | 'admin';
export type GoalStatus = 'draft' | 'submitted' | 'approved' | 'locked' | 'returned';
export type UoMType = 'min' | 'max' | 'timeline' | 'zero';
export type CheckinStatus = 'not_started' | 'on_track' | 'completed';
export type CycleStatus = 'active' | 'closed';

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  manager_id: string | null;
  department: string;
  entra_id: string | null;
}

export interface GoalCycle {
  cycle_id: string;
  cycle_name: string;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  checkin_window_start: string | null;
  checkin_window_end: string | null;
  phase: 'goal_setting' | 'q1' | 'q2' | 'q3' | 'q4';
}

export interface Goal {
  goal_id: string;
  owner_id: string;
  cycle_id: string;
  thrust_area: string;
  title: string;
  description: string;
  uom_type: UoMType;
  target_value: number | null;
  deadline_date: string | null;
  weightage: number;
  status: GoalStatus;
  master_goal_id: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface SharedGoalMaster {
  master_id: string;
  creator_id: string;
  title: string;
  description: string;
  target_value: number | null;
  uom_type: UoMType;
  cycle_id: string;
  thrust_area: string;
  created_at: string;
}

export interface CheckIn {
  check_in_id: string;
  goal_id: string;
  cycle_id: string;
  phase: string;
  actual_achievement: number | null;
  completion_date: string | null;
  status: CheckinStatus;
  manager_comment: string | null;
  computed_score: number | null;
  submitted_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_by: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export type EscalationType = 'initial_warning' | 'manager_escalation' | 'skip_level' | 'checkin_reminder';

export interface EscalationLog {
  id: string;
  cycle_id: string;
  user_id: string;
  escalation_type: EscalationType;
  escalated_to: string | null;
  reason: string;
  created_at: string;
  notified_at: string | null;
  resolved_at: string | null;
}

