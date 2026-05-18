-- ============================================================================
-- MIGRATION: Outbox Pattern for Asynchronous Notifications
-- ============================================================================

-- 1. Create the outbox table
CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error_log TEXT
);

-- Index for the webhook worker to quickly find pending events
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events(created_at) WHERE status = 'pending';

-- Secure the outbox (only service_role should read/update it, users just insert indirectly)
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
-- No public policies -> totally locked down from client access


-- 2. Update approve_goal_sheet RPC
CREATE OR REPLACE FUNCTION public.approve_goal_sheet(
    p_manager_id UUID,
    p_employee_id UUID,
    p_cycle_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
    v_first_goal_id UUID;
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
      AND status = 'submitted'
    RETURNING goal_id INTO v_first_goal_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        -- Insert notification into outbox
        INSERT INTO public.outbox_events (event_type, payload)
        VALUES (
            'goal_approved',
            jsonb_build_object(
                'ownerId', p_employee_id,
                'cycleId', p_cycle_id,
                'goalId', v_first_goal_id,
                'linkPath', '/dashboard'
            )
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'goals_locked', v_count
    );
END;
$$;


-- 3. Update return_goal_sheet RPC
CREATE OR REPLACE FUNCTION public.return_goal_sheet(
    p_manager_id UUID,
    p_employee_id UUID,
    p_cycle_id UUID,
    p_comment TEXT
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
    v_first_goal_id UUID;
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
      AND status = 'submitted'
    RETURNING goal_id INTO v_first_goal_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        -- Log the return event
        INSERT INTO public.escalation_logs (
            cycle_id, user_id, escalation_type, escalated_to, reason
        ) VALUES (
            p_cycle_id, p_employee_id, 'goal_returned', p_manager_id, p_comment
        ) ON CONFLICT (cycle_id, user_id, escalation_type) DO UPDATE
          SET reason = EXCLUDED.reason;

        -- Insert notification into outbox
        INSERT INTO public.outbox_events (event_type, payload)
        VALUES (
            'goal_returned',
            jsonb_build_object(
                'ownerId', p_employee_id,
                'cycleId', p_cycle_id,
                'goalId', v_first_goal_id,
                'comment', p_comment,
                'linkPath', '/dashboard'
            )
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'goals_returned', v_count
    );
END;
$$;


-- 4. Update submit_goal_sheet RPC
CREATE OR REPLACE FUNCTION public.submit_goal_sheet(
    p_user_id UUID,
    p_cycle_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INT;
    v_first_goal_id UUID;
BEGIN
    UPDATE public.goals
    SET status = 'submitted', updated_at = now()
    WHERE owner_id = p_user_id 
      AND cycle_id = p_cycle_id 
      AND status IN ('draft', 'returned')
    RETURNING goal_id INTO v_first_goal_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        -- Insert notification into outbox
        INSERT INTO public.outbox_events (event_type, payload)
        VALUES (
            'goal_submitted',
            jsonb_build_object(
                'ownerId', p_user_id,
                'cycleId', p_cycle_id,
                'goalId', v_first_goal_id,
                'linkPath', '/manager/approvals'
            )
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'goals_submitted', v_count
    );
END;
$$;


-- 5. Trigger for 'goal_saved' updates
CREATE OR REPLACE FUNCTION public.notify_goal_saved()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if the goal is in draft status and actual content changed
    IF NEW.status = 'draft' AND (
        OLD.title IS DISTINCT FROM NEW.title OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.target_value IS DISTINCT FROM NEW.target_value OR
        OLD.weightage IS DISTINCT FROM NEW.weightage
    ) THEN
        INSERT INTO public.outbox_events (event_type, payload)
        VALUES (
            'goal_saved',
            jsonb_build_object(
                'ownerId', NEW.owner_id,
                'cycleId', NEW.cycle_id,
                'goalId', NEW.goal_id,
                'linkPath', '/manager/approvals'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_goal_saved_outbox ON public.goals;
CREATE TRIGGER trigger_goal_saved_outbox
    AFTER UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.notify_goal_saved();
