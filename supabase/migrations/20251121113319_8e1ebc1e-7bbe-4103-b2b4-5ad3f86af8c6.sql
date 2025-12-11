-- Add DELETE policy for deed_templates
CREATE POLICY "allow_public_delete_deed_templates"
  ON public.deed_templates FOR DELETE
  USING (true);