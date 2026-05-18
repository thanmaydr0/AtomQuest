-- ==========================================
-- Analytics Server-Side Aggregation Functions
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Admin KPIs for a given cycle
CREATE OR REPLACE FUNCTION public.get_admin_kpis(p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_goals',     (SELECT count(*) FROM public.goals WHERE cycle_id = p_cycle_id),
    'approved_locked', (SELECT count(*) FROM public.goals WHERE cycle_id = p_cycle_id AND status IN ('approved','locked')),
    'avg_score',       COALESCE(
      (SELECT round(avg(ci.computed_score))
       FROM public.check_ins ci
       JOIN public.goals g ON g.goal_id = ci.goal_id
       WHERE g.cycle_id = p_cycle_id AND ci.computed_score IS NOT NULL), 0),
    'employee_count',  (SELECT count(*) FROM public.users WHERE role = 'employee'),
    'manager_count',   (SELECT count(*) FROM public.users WHERE role = 'manager')
  );
$$;

-- 2. Quarter-over-Quarter trends
CREATE OR REPLACE FUNCTION public.get_qoq_trends(p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  WITH phases AS (
    SELECT unnest(ARRAY['q1','q2','q3','q4']) AS phase
  ),
  approved_goals AS (
    SELECT goal_id FROM public.goals
    WHERE cycle_id = p_cycle_id AND status IN ('approved','locked')
  ),
  phase_data AS (
    SELECT
      p.phase,
      COALESCE(round(avg(ci.computed_score)), 0) AS avg_score,
      count(ci.check_in_id)::int AS goal_count,
      CASE
        WHEN (SELECT count(*) FROM approved_goals) = 0 THEN 0
        ELSE round(
          count(DISTINCT CASE WHEN ag.goal_id IS NOT NULL THEN ci.goal_id END)::numeric
          / GREATEST((SELECT count(*) FROM approved_goals), 1) * 100
        )
      END AS completion_pct
    FROM phases p
    LEFT JOIN public.check_ins ci
      ON ci.phase = p.phase
      AND ci.goal_id IN (SELECT goal_id FROM public.goals WHERE cycle_id = p_cycle_id)
    LEFT JOIN approved_goals ag ON ag.goal_id = ci.goal_id
    GROUP BY p.phase
  )
  SELECT json_agg(
    json_build_object(
      'phase', upper(phase),
      'avgScore', avg_score,
      'goalCount', goal_count,
      'completionPct', completion_pct
    ) ORDER BY phase
  )
  FROM phase_data;
$$;

-- 3. Employee completion heatmap
CREATE OR REPLACE FUNCTION public.get_completion_heatmap(p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  WITH employees AS (
    SELECT user_id, name, department FROM public.users WHERE role = 'employee'
  ),
  emp_approved AS (
    SELECT g.owner_id, g.goal_id
    FROM public.goals g
    WHERE g.cycle_id = p_cycle_id AND g.status IN ('approved','locked')
  ),
  emp_stats AS (
    SELECT
      e.name,
      e.department,
      CASE
        WHEN count(ea.goal_id) * 4 = 0 THEN 0
        ELSE round(
          count(ci.check_in_id)::numeric / (count(DISTINCT ea.goal_id) * 4) * 100
        )
      END AS pct
    FROM employees e
    LEFT JOIN emp_approved ea ON ea.owner_id = e.user_id
    LEFT JOIN public.check_ins ci ON ci.goal_id = ea.goal_id
    GROUP BY e.user_id, e.name, e.department
  )
  SELECT COALESCE(json_agg(
    json_build_object('name', name, 'department', department, 'pct', pct)
    ORDER BY pct DESC
  ), '[]'::json)
  FROM emp_stats;
$$;

-- 4. Goal distribution (thrust area, UoM, status)
CREATE OR REPLACE FUNCTION public.get_goal_distribution(p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'thrust', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.value DESC)
      FROM (SELECT thrust_area AS name, count(*)::int AS value FROM public.goals WHERE cycle_id = p_cycle_id GROUP BY thrust_area) t
    ), '[]'::json),
    'uom', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (SELECT upper(uom_type) AS name, count(*)::int AS value FROM public.goals WHERE cycle_id = p_cycle_id GROUP BY uom_type) t
    ), '[]'::json),
    'status', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (SELECT status AS name, count(*)::int AS value FROM public.goals WHERE cycle_id = p_cycle_id GROUP BY status) t
    ), '[]'::json)
  );
$$;

-- 5. Manager effectiveness for a given cycle and phase
CREATE OR REPLACE FUNCTION public.get_manager_effectiveness(p_cycle_id UUID, p_phase TEXT)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  WITH managers AS (
    SELECT user_id, name FROM public.users WHERE role = 'manager'
  ),
  reports AS (
    SELECT user_id, manager_id FROM public.users WHERE role = 'employee'
  ),
  mgr_data AS (
    SELECT
      m.name,
      count(DISTINCT r.user_id)::int AS team,
      count(ci.check_in_id)::int AS checkins_done,
      CASE
        WHEN count(DISTINCT ag.goal_id) = 0 THEN 0
        ELSE round(count(ci.check_in_id)::numeric / GREATEST(count(DISTINCT ag.goal_id), 1) * 100)
      END AS pct,
      COALESCE(round(avg(ci.computed_score)), 0) AS avg_score
    FROM managers m
    LEFT JOIN reports r ON r.manager_id = m.user_id
    LEFT JOIN public.goals ag
      ON ag.owner_id = r.user_id
      AND ag.cycle_id = p_cycle_id
      AND ag.status IN ('approved','locked')
    LEFT JOIN public.check_ins ci
      ON ci.goal_id = ag.goal_id
      AND ci.phase = p_phase
    GROUP BY m.user_id, m.name
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'name', name, 'team', team,
      'checkinsDone', checkins_done,
      'pct', pct, 'avgScore', avg_score
    ) ORDER BY pct DESC
  ), '[]'::json)
  FROM mgr_data;
$$;

-- 6. Manager team summary (replaces manager Dashboard client-side aggregation)
CREATE OR REPLACE FUNCTION public.get_manager_team_summary(p_manager_id UUID, p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  WITH reports AS (
    SELECT user_id, name, department FROM public.users
    WHERE manager_id = p_manager_id
  ),
  report_goals AS (
    SELECT
      r.user_id, r.name, r.department,
      count(g.goal_id)::int AS goal_count,
      COALESCE(sum(g.weightage), 0)::int AS total_weightage,
      -- derive sheet status: locked > approved > submitted > returned > draft > empty
      CASE
        WHEN count(g.goal_id) = 0 THEN 'empty'
        WHEN bool_or(g.status = 'locked') THEN 'locked'
        WHEN bool_or(g.status = 'approved') THEN 'approved'
        WHEN bool_or(g.status = 'submitted') THEN 'submitted'
        WHEN bool_or(g.status = 'returned') THEN 'returned'
        ELSE 'draft'
      END AS sheet_status
    FROM reports r
    LEFT JOIN public.goals g ON g.owner_id = r.user_id AND g.cycle_id = p_cycle_id
    GROUP BY r.user_id, r.name, r.department
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'user_id', user_id,
      'name', name,
      'department', department,
      'goal_count', goal_count,
      'total_weightage', total_weightage,
      'sheet_status', sheet_status
    )
  ), '[]'::json)
  FROM report_goals;
$$;
-- 7. Event-Driven Workflow Timeline
CREATE OR REPLACE FUNCTION public.get_workflow_timeline(p_user_id UUID, p_cycle_id UUID)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER AS $$
  WITH goals_for_user AS (
    SELECT goal_id, title FROM public.goals WHERE owner_id = p_user_id AND cycle_id = p_cycle_id
  ),
  goal_events AS (
    SELECT
      a.changed_at AS event_time,
      'goal_update' AS event_type,
      CASE
        WHEN a.operation = 'INSERT' THEN 'Goal Created'
        WHEN a.new_data->>'status' = 'submitted' AND (a.old_data->>'status' = 'draft' OR a.old_data->>'status' = 'returned') THEN 'Goal Submitted for Approval'
        WHEN a.new_data->>'status' = 'approved' THEN 'Goal Approved'
        WHEN a.new_data->>'status' = 'locked' THEN 'Goal Locked'
        WHEN a.new_data->>'status' = 'returned' THEN 'Goal Returned'
        ELSE 'Goal Updated'
      END AS title,
      g.title AS description,
      a.changed_by AS actor_id,
      CASE
        WHEN a.operation = 'INSERT' THEN 'Edit3'
        WHEN a.new_data->>'status' = 'submitted' THEN 'Send'
        WHEN a.new_data->>'status' = 'approved' OR a.new_data->>'status' = 'locked' THEN 'CheckCircle'
        WHEN a.new_data->>'status' = 'returned' THEN 'AlertCircle'
        ELSE 'Edit3'
      END AS icon_type
    FROM public.audit_logs a
    JOIN goals_for_user g ON a.record_id = g.goal_id
    WHERE a.table_name = 'goals'
  ),
  checkin_events AS (
    SELECT
      c.submitted_at AS event_time,
      'check_in' AS event_type,
      'Check-in Submitted' AS title,
      'Phase: ' || upper(c.phase) || ' | Score: ' || COALESCE(c.computed_score::text, 'N/A') || '%' AS description,
      p_user_id AS actor_id,
      'Target' AS icon_type
    FROM public.check_ins c
    JOIN goals_for_user g ON c.goal_id = g.goal_id
  ),
  escalation_events AS (
    SELECT
      e.created_at AS event_time,
      'escalation' AS event_type,
      'Escalation Triggered' AS title,
      'Type: ' || upper(e.escalation_type) || (CASE WHEN e.reason IS NOT NULL THEN ' - ' || e.reason ELSE '' END) AS description,
      e.user_id AS actor_id,
      'AlertTriangle' AS icon_type
    FROM public.escalation_logs e
    WHERE e.user_id = p_user_id
  ),
  all_events AS (
    SELECT * FROM goal_events
    UNION ALL
    SELECT * FROM checkin_events
    UNION ALL
    SELECT * FROM escalation_events
  ),
  events_with_actors AS (
    SELECT
      e.event_time, e.event_type, e.title, e.description, e.icon_type, e.actor_id,
      u.name AS actor_name, u.role AS actor_role
    FROM all_events e
    LEFT JOIN public.users u ON u.user_id = e.actor_id
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'event_time', event_time,
      'event_type', event_type,
      'title', title,
      'description', description,
      'icon_type', icon_type,
      'actor_name', actor_name,
      'actor_role', actor_role
    ) ORDER BY event_time DESC
  ), '[]'::json)
  FROM events_with_actors;
$$;
