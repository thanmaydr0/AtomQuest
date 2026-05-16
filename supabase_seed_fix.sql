-- Fix seed users: delete old entries and re-create with proper identity records
-- Run this in Supabase SQL Editor

-- Clean up old seed data (if any)
DELETE FROM auth.identities WHERE user_id IN (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);
DELETE FROM public.users WHERE user_id IN (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);
DELETE FROM auth.users WHERE id IN (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

-- 1. Admin User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'admin@atomquest.local',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin User"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'admin@atomquest.local'),
  'email',
  now(), now(), now()
);

INSERT INTO public.users (user_id, email, name, role, department)
VALUES ('22222222-2222-2222-2222-222222222222', 'admin@atomquest.local', 'Admin User', 'admin', 'IT')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Manager User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'manager@atomquest.local',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Manager User"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333', 'email', 'manager@atomquest.local'),
  'email',
  now(), now(), now()
);

INSERT INTO public.users (user_id, email, name, role, department)
VALUES ('33333333-3333-3333-3333-333333333333', 'manager@atomquest.local', 'Manager User', 'manager', 'Sales')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Employee User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'employee@atomquest.local',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Employee User"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '44444444-4444-4444-4444-444444444444',
  '44444444-4444-4444-4444-444444444444',
  jsonb_build_object('sub', '44444444-4444-4444-4444-444444444444', 'email', 'employee@atomquest.local'),
  'email',
  now(), now(), now()
);

INSERT INTO public.users (user_id, email, name, role, manager_id, department)
VALUES ('44444444-4444-4444-4444-444444444444', 'employee@atomquest.local', 'Employee User', 'employee', '33333333-3333-3333-3333-333333333333', 'Sales')
ON CONFLICT (user_id) DO NOTHING;
