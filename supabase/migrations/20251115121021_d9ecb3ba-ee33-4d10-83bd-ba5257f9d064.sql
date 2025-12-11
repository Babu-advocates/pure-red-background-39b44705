-- Fix RLS policies for history_of_title_templates to allow INSERT and UPDATE

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can manage history templates" ON public.history_of_title_templates;

-- Keep the public read policy
-- DROP POLICY IF EXISTS "Public can view history templates" ON public.history_of_title_templates;

-- Add policies to allow public INSERT and UPDATE
CREATE POLICY "allow_public_insert_history_templates"
  ON public.history_of_title_templates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_public_update_history_templates"
  ON public.history_of_title_templates FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_delete_history_templates"
  ON public.history_of_title_templates FOR DELETE
  USING (true);