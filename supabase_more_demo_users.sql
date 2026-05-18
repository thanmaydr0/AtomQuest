-- ============================================================================
-- Add Additional Demo Users for Judges
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- 1. Judge Employee (Reports to Judge Manager: 99999999-9999-9999-9999-999999999999)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000000',
  'judge-employee@atomquest.com',
  crypt('judge2026', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Judge Employee"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '88888888-8888-8888-8888-888888888888',
  '88888888-8888-8888-8888-888888888888',
  jsonb_build_object('sub', '88888888-8888-8888-8888-888888888888', 'email', 'judge-employee@atomquest.com'),
  'email',
  now(), now(), now()
) ON CONFLICT DO NOTHING;
UPDATE auth.identities SET identity_data = jsonb_build_object('sub', '88888888-8888-8888-8888-888888888888', 'email', 'judge-employee@atomquest.com') WHERE user_id = '88888888-8888-8888-8888-888888888888';

INSERT INTO public.users (user_id, email, name, role, manager_id, department)
VALUES ('88888888-8888-8888-8888-888888888888', 'judge-employee@atomquest.com', 'Judge Employee', 'employee', '99999999-9999-9999-9999-999999999999', 'Hackathon')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, manager_id = EXCLUDED.manager_id;


-- 2. Judge Manager
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '00000000-0000-0000-0000-000000000000',
  'judge-manager@atomquest.com',
  crypt('judge2026', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Judge Manager"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999999',
  jsonb_build_object('sub', '99999999-9999-9999-9999-999999999999', 'email', 'judge-manager@atomquest.com'),
  'email',
  now(), now(), now()
) ON CONFLICT DO NOTHING;
UPDATE auth.identities SET identity_data = jsonb_build_object('sub', '99999999-9999-9999-9999-999999999999', 'email', 'judge-manager@atomquest.com') WHERE user_id = '99999999-9999-9999-9999-999999999999';

INSERT INTO public.users (user_id, email, name, role, department)
VALUES ('99999999-9999-9999-9999-999999999999', 'judge-manager@atomquest.com', 'Judge Manager', 'manager', 'Hackathon')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;


-- 3. Judge Admin
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'judge-admin@atomquest.com',
  crypt('judge2026', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Judge Admin"}',
  now(), now(),
  'authenticated', 'authenticated',
  '', '', '', ''
) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  jsonb_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'judge-admin@atomquest.com'),
  'email',
  now(), now(), now()
) ON CONFLICT DO NOTHING;
UPDATE auth.identities SET identity_data = jsonb_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'judge-admin@atomquest.com') WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

INSERT INTO public.users (user_id, email, name, role, department)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'judge-admin@atomquest.com', 'Judge Admin', 'admin', 'Hackathon')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
