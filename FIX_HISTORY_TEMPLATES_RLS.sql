-- Fix RLS policies for history_of_title_templates so Admin page can save
-- Run this in Cloud -> Database -> SQL Editor

-- Enable RLS (if not already enabled)
ALTER TABLE public.history_of_title_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing history_of_title_templates policies that may conflict
DROP POLICY IF EXISTS "public_select_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "public_insert_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "public_update_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "public_delete_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "allow_public_select_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "allow_public_insert_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "allow_public_update_history_templates" ON public.history_of_title_templates;
DROP POLICY IF EXISTS "allow_public_delete_history_templates" ON public.history_of_title_templates;

-- Open policies (adjust later to your auth model)
CREATE POLICY "allow_public_select_history_templates"
  ON public.history_of_title_templates FOR SELECT
  USING (true);

CREATE POLICY "allow_public_insert_history_templates"
  ON public.history_of_title_templates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_public_update_history_templates"
  ON public.history_of_title_templates FOR UPDATE
  USING (true) WITH CHECK (true);

-- Optional: allow delete if needed
CREATE POLICY "allow_public_delete_history_templates"
  ON public.history_of_title_templates FOR DELETE
  USING (true);
