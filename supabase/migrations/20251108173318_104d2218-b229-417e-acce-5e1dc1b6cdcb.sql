-- Fix deeds table RLS policies for public access
-- Drop all existing policies completely
DROP POLICY IF EXISTS "Anyone can create deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can view deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can update deeds" ON public.deeds;
DROP POLICY IF EXISTS "Anyone can delete deeds" ON public.deeds;
DROP POLICY IF EXISTS "allow_public_select" ON public.deeds;
DROP POLICY IF EXISTS "allow_public_insert" ON public.deeds;
DROP POLICY IF EXISTS "allow_public_update" ON public.deeds;
DROP POLICY IF EXISTS "allow_public_delete" ON public.deeds;
DROP POLICY IF EXISTS "public_select_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_insert_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_update_deeds" ON public.deeds;
DROP POLICY IF EXISTS "public_delete_deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can create their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can view their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can update their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Users can delete their own deeds" ON public.deeds;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.deeds;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.deeds;

-- Create new policies with public access (no authentication required)
CREATE POLICY "allow_all_select"
ON public.deeds
FOR SELECT
USING (true);

CREATE POLICY "allow_all_insert"
ON public.deeds
FOR INSERT
WITH CHECK (true);

CREATE POLICY "allow_all_update"
ON public.deeds
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_all_delete"
ON public.deeds
FOR DELETE
USING (true);