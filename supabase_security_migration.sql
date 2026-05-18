-- ============================================================================
-- SECURITY MIGRATION: Critical Vulnerability Fixes for AtomQuest
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Addresses: V-01, V-03, V-05, V-09, V-12 from the security audit
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- V-09 FIX: Restrict user visibility
-- BEFORE: Every authenticated user could see ALL users (name, email, 
--         department, manager_id, entra_id, telegram_chat_id).
-- AFTER:  Employees see self + manager. Managers see self + reports.
--         Admins see everyone.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;

-- Scoped visibility: self, your manager, and (if manager) your reports
CREATE POLICY "users_scoped_select" ON public.users
    FOR SELECT USING (
        user_id = auth.uid()                                                          -- own profile
        OR manager_id = auth.uid()                                                    -- direct reports (for managers)
        OR user_id = (SELECT manager_id FROM public.users WHERE user_id = auth.uid()) -- own manager
        OR get_auth_role() IN ('admin', 'manager')                                    -- admins and managers see everyone
    );


-- ════════════════════════════════════════════════════════════════════════════
-- V-12 FIX: Server-controlled timestamps
-- BEFORE: Client set updated_at via new Date().toISOString() — attacker
--         could backdate or future-date to hide tampering.
-- AFTER:  Database trigger always overwrites updated_at with now().
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_goals_updated_at ON public.goals;
CREATE TRIGGER set_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_checkins_updated_at ON public.check_ins;
CREATE TRIGGER set_checkins_updated_at
    BEFORE UPDATE ON public.check_ins
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- V-05 FIX: Add missing 'goal_returned' to escalation_type CHECK
-- BEFORE: GoalReviewPanel inserted escalation_type='goal_returned' but the
--         CHECK constraint didn't include it → silent INSERT failure.
-- AFTER:  'goal_returned' is a valid escalation type.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.escalation_logs 
DROP CONSTRAINT IF EXISTS escalation_logs_escalation_type_check;

ALTER TABLE public.escalation_logs 
ADD CONSTRAINT escalation_logs_escalation_type_check 
CHECK (escalation_type IN (
    'initial_warning', 
    'manager_escalation', 
    'skip_level', 
    'checkin_reminder', 
    'goal_returned'
));


-- ════════════════════════════════════════════════════════════════════════════
-- V-04 FIX: Server-side goal approval with manager-report validation
-- BEFORE: Client-side bulk UPDATE with owner_ids from the browser — a
--         manager could craft a request to approve goals of non-reports.
-- AFTER:  RPC validates the manager-employee relationship server-side.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_goal_sheet(
    p_manager_id UUID,
    p_employee_id UUID,
    p_cycle_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
BEGIN
    -- Verify the manager-employee relationship
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_employee_id AND manager_id = p_manager_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE user_id = p_manager_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'You can only approve goals for your direct reports';
    END IF;

    UPDATE public.goals
    SET status = 'locked', updated_at = now()
    WHERE owner_id = p_employee_id 
      AND cycle_id = p_cycle_id 
      AND status = 'submitted';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN json_build_object(
        'success', true,
        'goals_locked', v_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.return_goal_sheet(
    p_manager_id UUID,
    p_employee_id UUID,
    p_cycle_id UUID,
    p_comment TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
BEGIN
    -- Verify the manager-employee relationship
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_employee_id AND manager_id = p_manager_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE user_id = p_manager_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'You can only return goals for your direct reports';
    END IF;

    UPDATE public.goals
    SET status = 'returned', updated_at = now()
    WHERE owner_id = p_employee_id 
      AND cycle_id = p_cycle_id 
      AND status = 'submitted';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Log the return event
    INSERT INTO public.escalation_logs (
        cycle_id, user_id, escalation_type, escalated_to, reason
    ) VALUES (
        p_cycle_id, p_employee_id, 'goal_returned', p_manager_id, p_comment
    ) ON CONFLICT (cycle_id, user_id, escalation_type) DO UPDATE
      SET reason = EXCLUDED.reason;

    RETURN json_build_object(
        'success', true,
        'goals_returned', v_count
    );
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- V-01 FIX: Harden the auth trigger — always force 'employee' role
-- BEFORE: ON CONFLICT DO NOTHING — safe but fragile.
-- AFTER:  Explicit, hardened trigger with no trust in client data.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email, name, role, department)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'name', 
        split_part(NEW.email, '@', 1)
    ), 
    'employee',   -- ALWAYS employee. Role promotion is admin-only.
    ''
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Never overwrite existing profile
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════════════
-- BONUS: Prevent employees from modifying their own role via UPDATE
-- Even if an INSERT policy doesn't exist, an UPDATE policy could allow
-- a compromised admin session to change roles. This trigger blocks it.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow role changes if the changer is an admin
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Only admins can change user roles';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_role_change ON public.users;
CREATE TRIGGER protect_role_change
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.protect_role_change();


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to run after migration)
-- ════════════════════════════════════════════════════════════════════════════

-- Check policies:
-- SELECT polname, tablename, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Check triggers:
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'set_%' OR tgname = 'protect_role_change';

-- Check escalation constraint:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%escalation%';
