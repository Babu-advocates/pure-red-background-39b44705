-- Create main_login table for admin authentication
CREATE TABLE IF NOT EXISTS public.main_login (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.main_login ENABLE ROW LEVEL SECURITY;

-- Allow read access for authentication purposes
CREATE POLICY "Allow read access to main_login"
  ON public.main_login
  FOR SELECT
  USING (true);

-- Insert the main admin credentials
INSERT INTO public.main_login (username, password)
VALUES ('babuadvocate', 'docs123');