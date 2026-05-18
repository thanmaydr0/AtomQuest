-- Fix the roles for the newly created judge accounts
-- The handle_new_user trigger automatically forces 'employee' role on creation.
-- This script disables the role protection trigger temporarily to fix them.

ALTER TABLE public.users DISABLE TRIGGER protect_role_change;

UPDATE public.users 
SET role = 'manager' 
WHERE email = 'judge-manager@atomquest.com';

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'judge-admin@atomquest.com';

ALTER TABLE public.users ENABLE TRIGGER protect_role_change;
