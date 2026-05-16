-- Fix: Allow authenticated users to insert their own profile (needed for SSO auto-provisioning)
-- Run this in the Supabase SQL Editor

-- Allow any authenticated user to insert their own profile row
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow any authenticated user to update their own profile row
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (user_id = auth.uid());
