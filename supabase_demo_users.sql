-- Add Demo Users for Hackathon Judge Flow
-- Run this in the Supabase SQL Editor

-- Clean up any existing demo users first
DELETE FROM auth.identities WHERE user_id IN (
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
);
DELETE FROM public.users WHERE user_id IN (
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
);
DELETE FROM auth.users WHERE id IN (
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
);

-- 1. Demo Manager User
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'demo-manager@atomquest.app',
  crypt('judge2026', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Demo Manager"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '55555555-5555-5555-5555-555555555555',
  '55555555-5555-5555-5555-555555555555',
  jsonb_build_object('sub', '55555555-5555-5555-5555-555555555555', 'email', 'demo-manager@atomquest.app'),
  'email',
  now(), now(), now()
);

INSERT INTO public.users (user_id, email, name, role, department)
VALUES ('55555555-5555-5555-5555-555555555555', 'demo-manager@atomquest.app', 'Demo Manager', 'manager', 'Hackathon')
ON CONFLICT (user_id) DO NOTHING;


-- 2. Demo Employee User (for Judge Tour)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '00000000-0000-0000-0000-000000000000',
  'demo-employee@atomquest.com',
  crypt('judge2026', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Demo Employee"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '66666666-6666-6666-6666-666666666666',
  '66666666-6666-6666-6666-666666666666',
  jsonb_build_object('sub', '66666666-6666-6666-6666-666666666666', 'email', 'demo-employee@atomquest.com'),
  'email',
  now(), now(), now()
);

-- Note: manager_id points to the demo manager created above
INSERT INTO public.users (user_id, email, name, role, manager_id, department)
VALUES ('66666666-6666-6666-6666-666666666666', 'demo-employee@atomquest.com', 'Demo Employee', 'employee', '55555555-5555-5555-5555-555555555555', 'Hackathon')
ON CONFLICT (user_id) DO NOTHING;
