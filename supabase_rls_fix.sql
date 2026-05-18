-- ============================================================================
-- BUG FIX: Infinite Recursion in RLS Policy
-- ============================================================================
-- The previous 'users_scoped_select' policy contained a subquery on the 
-- public.users table, which caused an infinite recursion error during login.
-- This script replaces the subquery with a SECURITY DEFINER function to 
-- safely fetch the manager ID without triggering the RLS policy again.

-- 1. Create a safe function to get the current user's manager ID
CREATE OR REPLACE FUNCTION public.get_user_manager_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT manager_id FROM public.users WHERE user_id = auth.uid();
$$;

-- 2. Drop the broken policy
DROP POLICY IF EXISTS "users_scoped_select" ON public.users;

-- 3. Create the fixed policy using the safe functions
CREATE POLICY "users_scoped_select" ON public.users
    FOR SELECT USING (
        user_id = auth.uid()                           -- own profile
        OR manager_id = auth.uid()                     -- direct reports (for managers)
        OR user_id = public.get_user_manager_id()      -- own manager (using safe function)
        OR public.get_auth_role() IN ('admin', 'manager')     -- admins and managers see everyone
    );
