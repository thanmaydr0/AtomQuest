-- Run this in the Supabase SQL Editor to add API-level protection for business rules

-- 1. Ensure maximum 8 goals per user per cycle
CREATE OR REPLACE FUNCTION public.check_max_goals() RETURNS TRIGGER AS $$
DECLARE
    goal_count INT;
BEGIN
    SELECT count(*) INTO goal_count
    FROM public.goals
    WHERE owner_id = NEW.owner_id AND cycle_id = NEW.cycle_id;

    IF goal_count >= 8 THEN
        RAISE EXCEPTION 'Maximum 8 goals reached for this cycle';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_goals ON public.goals;
CREATE TRIGGER enforce_max_goals
    BEFORE INSERT ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.check_max_goals();


-- 2. Prevent check-in if goal is not locked (or approved/locked depending on rules, user requested "not locked" -> error)
-- Actually, the user rule is "Goals must be approved before check-ins can be submitted".
-- Wait, the prompt says "if goal is not locked, show 'Goals must be approved before check-ins can be submitted'".
-- The status is 'locked' when approved. Let's check the status is 'locked'.
CREATE OR REPLACE FUNCTION public.check_goal_locked_for_checkin() RETURNS TRIGGER AS $$
DECLARE
    goal_status TEXT;
BEGIN
    SELECT status INTO goal_status FROM public.goals WHERE goal_id = NEW.goal_id;
    IF goal_status != 'locked' THEN
        RAISE EXCEPTION 'Goals must be approved before check-ins can be submitted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_goal_locked_checkin ON public.check_ins;
CREATE TRIGGER enforce_goal_locked_checkin
    BEFORE INSERT ON public.check_ins
    FOR EACH ROW EXECUTE FUNCTION public.check_goal_locked_for_checkin();


-- 3. Prevent check-in outside window
CREATE OR REPLACE FUNCTION public.check_checkin_window() RETURNS TRIGGER AS $$
DECLARE
    cycle_start DATE;
    cycle_end DATE;
BEGIN
    SELECT checkin_window_start, checkin_window_end INTO cycle_start, cycle_end
    FROM public.goal_cycles
    WHERE cycle_id = NEW.cycle_id;

    IF CURRENT_DATE < cycle_start OR CURRENT_DATE > cycle_end THEN
        RAISE EXCEPTION 'Check-in window is currently closed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_checkin_window ON public.check_ins;
CREATE TRIGGER enforce_checkin_window
    BEFORE INSERT ON public.check_ins
    FOR EACH ROW EXECUTE FUNCTION public.check_checkin_window();
