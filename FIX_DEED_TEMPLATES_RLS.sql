-- Fix RLS policies for deed_templates so Admin page can save
-- Run this in Cloud -> Database -> SQL Editor

-- Enable RLS (if not already enabled)
ALTER TABLE public.deed_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing deed_templates policies that may conflict
DROP POLICY IF EXISTS "public_select_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "public_insert_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "public_update_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "public_delete_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "allow_public_select_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "allow_public_insert_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "allow_public_update_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "allow_public_delete_deed_templates" ON public.deed_templates;

-- Open policies (adjust later to your auth model)
CREATE POLICY "allow_public_select_deed_templates"
  ON public.deed_templates FOR SELECT
  USING (true);

CREATE POLICY "allow_public_insert_deed_templates"
  ON public.deed_templates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_public_update_deed_templates"
  ON public.deed_templates FOR UPDATE
  USING (true) WITH CHECK (true);

-- Allow delete
CREATE POLICY "allow_public_delete_deed_templates"
  ON public.deed_templates FOR DELETE
  USING (true);
