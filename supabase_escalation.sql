-- ============================================================================
-- ESCALATION ENGINE FIX — Drop old table and recreate properly
-- Run this INSTEAD of supabase_escalation.sql if you got the cycle_id error
-- ============================================================================

-- Drop old table (and its policies) so we can recreate with correct schema
DROP TABLE IF EXISTS public.escalation_logs CASCADE;

-- 1. Create escalation_logs table (with notified_at and resolved_at)
-- ============================================================================
CREATE TABLE public.escalation_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id      UUID NOT NULL REFERENCES public.goal_cycles(cycle_id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    escalation_type TEXT NOT NULL CHECK (escalation_type IN (
        'initial_warning',
        'manager_escalation',
        'skip_level',
        'checkin_reminder'
    )),
    escalated_to  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    reason        TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT now(),
    notified_at   TIMESTAMPTZ DEFAULT NULL,
    resolved_at   TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for common queries
CREATE INDEX idx_escalation_logs_cycle   ON public.escalation_logs(cycle_id);
CREATE INDEX idx_escalation_logs_user    ON public.escalation_logs(user_id);
CREATE INDEX idx_escalation_logs_type    ON public.escalation_logs(escalation_type);
CREATE INDEX idx_escalation_logs_pending ON public.escalation_logs(notified_at) WHERE notified_at IS NULL;

-- RLS
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all escalations" ON public.escalation_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update escalations" ON public.escalation_logs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert escalations" ON public.escalation_logs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Also allow authenticated users to insert (for the manager return flow)
CREATE POLICY "Authenticated users can insert escalation logs" ON public.escalation_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ============================================================================
-- 2. Stored function: check_goal_escalations()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_goal_escalations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cycle RECORD;
    v_emp   RECORD;
    v_days  INT;
    v_mgr_mgr_id UUID;
BEGIN
    SELECT * INTO v_cycle
    FROM public.goal_cycles
    WHERE status = 'active'
    LIMIT 1;

    IF v_cycle IS NULL THEN
        RETURN;
    END IF;

    -- GOAL SETTING ESCALATIONS
    FOR v_emp IN
        SELECT DISTINCT u.user_id, u.manager_id
        FROM public.users u
        JOIN public.goals g ON g.owner_id = u.user_id AND g.cycle_id = v_cycle.cycle_id
        WHERE u.role = 'employee'
          AND g.status IN ('draft', 'returned')
    LOOP
        v_days := (CURRENT_DATE - v_cycle.start_date);

        IF v_days >= 15 THEN
            SELECT mgr.manager_id INTO v_mgr_mgr_id
            FROM public.users mgr WHERE mgr.user_id = v_emp.manager_id;

            INSERT INTO public.escalation_logs (cycle_id, user_id, escalation_type, escalated_to, reason)
            SELECT v_cycle.cycle_id, v_emp.user_id, 'skip_level',
                   COALESCE(v_mgr_mgr_id, v_emp.manager_id),
                   'Goal sheet not submitted after 15+ days'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.escalation_logs
                WHERE cycle_id = v_cycle.cycle_id AND user_id = v_emp.user_id AND escalation_type = 'skip_level'
            );
        END IF;

        IF v_days >= 10 THEN
            INSERT INTO public.escalation_logs (cycle_id, user_id, escalation_type, escalated_to, reason)
            SELECT v_cycle.cycle_id, v_emp.user_id, 'manager_escalation',
                   v_emp.manager_id,
                   'Goal sheet not submitted after 10+ days'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.escalation_logs
                WHERE cycle_id = v_cycle.cycle_id AND user_id = v_emp.user_id AND escalation_type = 'manager_escalation'
            );
        END IF;

        IF v_days >= 5 THEN
            INSERT INTO public.escalation_logs (cycle_id, user_id, escalation_type, escalated_to, reason)
            SELECT v_cycle.cycle_id, v_emp.user_id, 'initial_warning',
                   v_emp.user_id,
                   'Goal sheet not submitted after 5+ days'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.escalation_logs
                WHERE cycle_id = v_cycle.cycle_id AND user_id = v_emp.user_id AND escalation_type = 'initial_warning'
            );
        END IF;
    END LOOP;

    -- CHECK-IN REMINDERS
    IF v_cycle.checkin_window_start IS NOT NULL
       AND v_cycle.checkin_window_end IS NOT NULL
       AND CURRENT_DATE BETWEEN v_cycle.checkin_window_start AND v_cycle.checkin_window_end
       AND (CURRENT_DATE - v_cycle.checkin_window_start) >= 3
    THEN
        FOR v_emp IN
            SELECT DISTINCT u.user_id, u.manager_id
            FROM public.users u
            JOIN public.goals g ON g.owner_id = u.user_id
                AND g.cycle_id = v_cycle.cycle_id
                AND g.status IN ('locked', 'approved')
            WHERE u.role = 'employee'
              AND NOT EXISTS (
                  SELECT 1 FROM public.check_ins ci
                  WHERE ci.goal_id = g.goal_id
                    AND ci.cycle_id = v_cycle.cycle_id
                    AND ci.phase = v_cycle.phase
              )
        LOOP
            INSERT INTO public.escalation_logs (cycle_id, user_id, escalation_type, escalated_to, reason)
            SELECT v_cycle.cycle_id, v_emp.user_id, 'checkin_reminder',
                   v_emp.user_id,
                   'Check-in not submitted 3+ days into window for phase ' || v_cycle.phase
            WHERE NOT EXISTS (
                SELECT 1 FROM public.escalation_logs
                WHERE cycle_id = v_cycle.cycle_id AND user_id = v_emp.user_id AND escalation_type = 'checkin_reminder'
            );
        END LOOP;
    END IF;
END;
$$;


-- ============================================================================
-- 3. Schedule with pg_cron (enable pg_cron extension first!)
-- ============================================================================
-- Uncomment the line below after enabling pg_cron in Database > Extensions
-- SELECT cron.schedule('daily-escalation-check', '0 0 * * *', 'SELECT public.check_goal_escalations()');
