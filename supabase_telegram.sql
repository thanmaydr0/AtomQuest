-- Add telegram_chat_id to public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT UNIQUE;

-- Create an index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON public.users(telegram_chat_id);
