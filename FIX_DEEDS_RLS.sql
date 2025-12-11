-- Fix RLS policies for deeds table - Allow public access
-- Run this in Supabase SQL Editor (Cloud tab -> Database -> SQL Editor)

-- First, disable RLS temporarily to clean up
ALTER TABLE public.deeds DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
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

-- Re-enable RLS
ALTER TABLE public.deeds ENABLE ROW LEVEL SECURITY;

-- Create simple public policies (no authentication required)
CREATE POLICY "allow_public_select"
ON public.deeds
FOR SELECT
USING (true);

CREATE POLICY "allow_public_insert"
ON public.deeds
FOR INSERT
WITH CHECK (true);

CREATE POLICY "allow_public_update"
ON public.deeds
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_public_delete"
ON public.deeds
FOR DELETE
USING (true);
