ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_from_name text,
  ADD COLUMN IF NOT EXISTS email_from_email text,
  ADD COLUMN IF NOT EXISTS resend_secret_name text,
  ADD COLUMN IF NOT EXISTS public_base_url text;