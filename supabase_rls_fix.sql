-- Run this in Supabase SQL Editor to fix the RLS policy for goal submission

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Employees can update their own draft/returned goals" ON public.goals;

-- Re-create with proper USING + WITH CHECK
-- USING: which rows the employee can try to update (their own draft/returned goals)
-- WITH CHECK: what the new row values can be (including submitted status)
CREATE POLICY "Employees can update their own draft/returned goals" ON public.goals
    FOR UPDATE
    USING (owner_id = auth.uid() AND status IN ('draft', 'returned'))
    WITH CHECK (owner_id = auth.uid() AND status IN ('draft', 'returned', 'submitted'));

-- Also allow employees to delete their own draft goals
DROP POLICY IF EXISTS "Employees can delete their own draft goals" ON public.goals;
CREATE POLICY "Employees can delete their own draft goals" ON public.goals
    FOR DELETE USING (owner_id = auth.uid() AND status = 'draft');

-- Fix: allow authenticated users to insert escalation logs (for the return flow)
DROP POLICY IF EXISTS "Authenticated users can insert escalation logs" ON public.escalation_logs;
CREATE POLICY "Authenticated users can insert escalation logs" ON public.escalation_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
