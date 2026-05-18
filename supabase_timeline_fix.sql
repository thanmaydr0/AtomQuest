-- Run this script in the Supabase SQL Editor to fix the Activity Timeline
-- It updates the audit_logs trigger to capture ALL goal changes (creation, submission, approval, etc)
-- previously it was only capturing 'locked' events, which caused the timeline to be empty.

CREATE OR REPLACE FUNCTION public.log_goal_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, changed_by, old_data, new_data)
        VALUES (
            'goals',
            NEW.goal_id,
            'INSERT',
            auth.uid(),
            NULL,
            row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if status or weightage actually changed, to avoid spam
        IF OLD.status IS DISTINCT FROM NEW.status OR OLD.weightage IS DISTINCT FROM NEW.weightage THEN
            INSERT INTO public.audit_logs (table_name, record_id, operation, changed_by, old_data, new_data)
            VALUES (
                'goals',
                NEW.goal_id,
                'UPDATE',
                auth.uid(),
                row_to_json(OLD)::jsonb,
                row_to_json(NEW)::jsonb
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS goals_audit_trigger ON public.goals;

CREATE TRIGGER goals_audit_trigger
    AFTER INSERT OR UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION public.log_goal_changes();
