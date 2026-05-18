-- ============================================================================
-- DEMO DATA CLEANUP SCRIPT
-- Run this in the Supabase SQL Editor to wipe the demo accounts clean
-- ============================================================================

DO $$ 
DECLARE
    manager_id UUID := '55555555-5555-5555-5555-555555555555';
    employee_id UUID := '66666666-6666-6666-6666-666666666666';
    admin_id UUID := '77777777-7777-7777-7777-777777777777';
BEGIN
    -- 1. Delete all check-ins belonging to the demo users' goals
    DELETE FROM public.check_ins
    WHERE goal_id IN (
        SELECT goal_id FROM public.goals 
        WHERE owner_id IN (manager_id, employee_id, admin_id)
    );

    -- 2. Delete all goals belonging to the demo users
    DELETE FROM public.goals 
    WHERE owner_id IN (manager_id, employee_id, admin_id);

    -- 3. Delete any escalation logs related to the demo users
    DELETE FROM public.escalation_logs
    WHERE user_id IN (manager_id, employee_id, admin_id)
       OR escalated_to IN (manager_id, employee_id, admin_id);

    -- 4. Delete any audit logs tracking changes by or for the demo users
    DELETE FROM public.audit_logs
    WHERE changed_by IN (manager_id, employee_id, admin_id)
       OR record_id::text IN (manager_id::text, employee_id::text, admin_id::text);

    -- 5. Delete any outbox notifications for the demo users
    DELETE FROM public.outbox_events
    WHERE payload->>'ownerId' IN (manager_id::text, employee_id::text, admin_id::text);

END $$;
