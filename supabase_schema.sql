-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Tables Creation
-- ==========================================

-- 1. users
CREATE TABLE public.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee','manager','admin')) DEFAULT 'employee',
    manager_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    department TEXT NOT NULL DEFAULT '',
    entra_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. goal_cycles
CREATE TABLE public.goal_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_name TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('goal_setting','q1','q2','q3','q4')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    checkin_window_start DATE,
    checkin_window_end DATE,
    status TEXT NOT NULL CHECK (status IN ('active','closed')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. shared_goals_master
CREATE TABLE public.shared_goals_master (
    master_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.users(user_id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    thrust_area TEXT NOT NULL,
    target_value NUMERIC,
    uom_type TEXT NOT NULL CHECK (uom_type IN ('min','max','timeline','zero')),
    cycle_id UUID NOT NULL REFERENCES public.goal_cycles(cycle_id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. goals
CREATE TABLE public.goals (
    goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(user_id),
    cycle_id UUID NOT NULL REFERENCES public.goal_cycles(cycle_id),
    thrust_area TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    uom_type TEXT NOT NULL CHECK (uom_type IN ('min','max','timeline','zero')),
    target_value NUMERIC,
    deadline_date DATE,
    weightage INTEGER NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','locked','returned')),
    master_goal_id UUID REFERENCES public.shared_goals_master(master_id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. check_ins
CREATE TABLE public.check_ins (
    check_in_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES public.goals(goal_id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES public.goal_cycles(cycle_id),
    phase TEXT NOT NULL,
    actual_achievement NUMERIC,
    completion_date DATE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','on_track','completed')),
    manager_comment TEXT,
    computed_score NUMERIC,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. audit_logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    changed_by UUID REFERENCES public.users(user_id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    old_data JSONB,
    new_data JSONB
);

-- 7. escalation_logs
CREATE TABLE public.escalation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(user_id),
    goal_id UUID REFERENCES public.goals(goal_id),
    escalation_type TEXT NOT NULL,
    escalated_to UUID REFERENCES public.users(user_id),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ==========================================
-- A) Row-Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_goals_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role from public.users table
CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;


-- Policies for goals
CREATE POLICY "Employees can select their own goals" ON public.goals
    FOR SELECT USING (owner_id = auth.uid() OR get_auth_role() = 'admin');

CREATE POLICY "Employees can insert their own goals" ON public.goals
    FOR INSERT WITH CHECK (owner_id = auth.uid() AND status IN ('draft', 'returned'));

CREATE POLICY "Employees can update their own draft/returned goals" ON public.goals
    FOR UPDATE USING (owner_id = auth.uid() AND status IN ('draft','returned'));

CREATE POLICY "Managers can select their reports' goals" ON public.goals
    FOR SELECT USING (
        owner_id IN (SELECT user_id FROM public.users WHERE manager_id = auth.uid())
    );

CREATE POLICY "Managers can update their reports' goals" ON public.goals
    FOR UPDATE USING (
        owner_id IN (SELECT user_id FROM public.users WHERE manager_id = auth.uid())
    );

CREATE POLICY "Admins have full access to goals" ON public.goals
    FOR ALL USING (get_auth_role() = 'admin');


-- Policies for check_ins
CREATE POLICY "Employees can select their own check_ins" ON public.check_ins
    FOR SELECT USING (
        goal_id IN (SELECT goal_id FROM public.goals WHERE owner_id = auth.uid())
    );

CREATE POLICY "Employees can insert their own check_ins" ON public.check_ins
    FOR INSERT WITH CHECK (
        goal_id IN (SELECT goal_id FROM public.goals WHERE owner_id = auth.uid())
    );

CREATE POLICY "Employees can update their own check_ins" ON public.check_ins
    FOR UPDATE USING (
        goal_id IN (SELECT goal_id FROM public.goals WHERE owner_id = auth.uid())
    );

CREATE POLICY "Managers can select their reports' check_ins" ON public.check_ins
    FOR SELECT USING (
        goal_id IN (SELECT goal_id FROM public.goals WHERE owner_id IN (SELECT user_id FROM public.users WHERE manager_id = auth.uid()))
    );

CREATE POLICY "Managers can update their reports' check_ins (manager_comment)" ON public.check_ins
    FOR UPDATE USING (
        goal_id IN (SELECT goal_id FROM public.goals WHERE owner_id IN (SELECT user_id FROM public.users WHERE manager_id = auth.uid()))
    );

CREATE POLICY "Admins have full access to check_ins" ON public.check_ins
    FOR ALL USING (get_auth_role() = 'admin');


-- Policies for audit_logs, escalation_logs, shared_goals_master, goal_cycles
CREATE POLICY "All authenticated users can view audit logs" ON public.audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage audit logs" ON public.audit_logs
    FOR ALL USING (get_auth_role() = 'admin');

CREATE POLICY "All authenticated users can view escalation logs" ON public.escalation_logs
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage escalation logs" ON public.escalation_logs
    FOR ALL USING (get_auth_role() = 'admin');

CREATE POLICY "All authenticated users can view shared goals master" ON public.shared_goals_master
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage shared goals master" ON public.shared_goals_master
    FOR ALL USING (get_auth_role() = 'admin');

CREATE POLICY "All authenticated users can view goal cycles" ON public.goal_cycles
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage goal cycles" ON public.goal_cycles
    FOR ALL USING (get_auth_role() = 'admin');

-- Policies for users
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (get_auth_role() = 'admin');


-- ==========================================
-- B) Trigger for audit logging
-- ==========================================
CREATE OR REPLACE FUNCTION public.log_goal_changes() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'locked' THEN
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER goals_audit_trigger
    AFTER UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION public.log_goal_changes();


-- ==========================================
-- C) Trigger for shared goal sync
-- ==========================================
CREATE OR REPLACE FUNCTION public.sync_shared_checkin() RETURNS TRIGGER AS $$
DECLARE
    m_id UUID;
BEGIN
    -- Get the master_goal_id for the goal associated with this check-in
    SELECT master_goal_id INTO m_id FROM public.goals WHERE goal_id = NEW.goal_id;
    
    IF m_id IS NOT NULL THEN
        -- Prevent infinite recursion
        IF pg_trigger_depth() > 1 THEN
            RETURN NEW;
        END IF;
        
        -- Update other check-ins linked to goals with the same master_goal_id in the same cycle and phase
        UPDATE public.check_ins c
        SET actual_achievement = NEW.actual_achievement,
            completion_date = NEW.completion_date,
            updated_at = now()
        FROM public.goals g
        WHERE c.goal_id = g.goal_id
          AND g.master_goal_id = m_id
          AND c.cycle_id = NEW.cycle_id
          AND c.phase = NEW.phase
          AND c.check_in_id != NEW.check_in_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER shared_checkin_sync_trigger
    AFTER INSERT OR UPDATE ON public.check_ins
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_shared_checkin();


-- ==========================================
-- D) Seed data
-- ==========================================

-- Seed Goal Cycle
INSERT INTO public.goal_cycles (cycle_id, cycle_name, phase, start_date, end_date, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'FY 2026',
    'goal_setting',
    '2026-04-01',
    '2027-03-31',
    'active'
) ON CONFLICT DO NOTHING;

-- Seed Users in auth.users and public.users
-- Important: Using specific UUIDs to properly link auth.users and public.users

-- 1. Admin User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'admin@atomquest.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    '',
    '',
    '',
    ''
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (user_id, email, name, role, department)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'admin@atomquest.local',
    'Admin User',
    'admin',
    'IT'
) ON CONFLICT DO NOTHING;


-- 2. Manager User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'manager@atomquest.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    '',
    '',
    '',
    ''
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (user_id, email, name, role, department)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'manager@atomquest.local',
    'Manager User',
    'manager',
    'Sales'
) ON CONFLICT DO NOTHING;


-- 3. Employee User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'employee@atomquest.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    '',
    '',
    '',
    ''
) ON CONFLICT DO NOTHING;

INSERT INTO public.users (user_id, email, name, role, manager_id, department)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'employee@atomquest.local',
    'Employee User',
    'employee',
    '33333333-3333-3333-3333-333333333333',
    'Sales'
) ON CONFLICT DO NOTHING;
