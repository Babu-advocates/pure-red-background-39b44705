-- CRITICAL: Run this in Supabase SQL Editor to fix deed visibility
-- This makes deeds accessible without login

-- Step 1: Make user_id nullable (allow anonymous users)
ALTER TABLE public.deeds ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Drop ALL existing RLS policies on deeds
DROP POLICY IF EXISTS "public_select_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_insert_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_update_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_delete_deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can create deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can view deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can update deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can delete deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can create their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can view their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can update their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can delete their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.deeds;

-- Step 3: Create wide-open public policies
CREATE POLICY "allow_all_select" ON public.deeds
  FOR SELECT TO public USING (true);

CREATE POLICY "allow_all_insert" ON public.deeds
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "allow_all_update" ON public.deeds
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete" ON public.deeds
  FOR DELETE TO public USING (true);

-- Step 4: Ensure RLS is enabled
ALTER TABLE public.deeds ENABLE ROW LEVEL SECURITY;

-- Step 5: Enable realtime (if not already enabled)
ALTER TABLE public.deeds REPLICA IDENTITY FULL;

-- Optional: Set existing user_id values to NULL for testing
-- UPDATE public.deeds SET user_id = NULL WHERE user_id IS NOT NULL;
