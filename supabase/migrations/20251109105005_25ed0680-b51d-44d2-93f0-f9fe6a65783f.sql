-- Create admin_login table
CREATE TABLE IF NOT EXISTS public.admin_login (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on admin_login table
ALTER TABLE public.admin_login ENABLE ROW LEVEL SECURITY;

-- Allow read access to admin_login (for authentication check)
CREATE POLICY "Allow read access to admin_login"
  ON public.admin_login
  FOR SELECT
  USING (true);

-- Insert the admin credentials
INSERT INTO public.admin_login (username, password)
VALUES ('babuadvocate_admin', 'admin123')
ON CONFLICT (username) DO UPDATE SET password = 'admin123';

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS admin_login_username_idx ON public.admin_login(username);