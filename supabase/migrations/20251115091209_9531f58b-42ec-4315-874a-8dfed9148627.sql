-- Enable RLS (safe if already enabled)
ALTER TABLE public.deed_templates ENABLE ROW LEVEL SECURITY;

-- Ensure deed_type is unique so upsert(onConflict: 'deed_type') works
CREATE UNIQUE INDEX IF NOT EXISTS idx_deed_templates_deed_type_unique
ON public.deed_templates (deed_type);

-- Loosen RLS for now so the Admin page (unauthenticated) can save
-- Drop our helper policies if they already exist, then recreate
DROP POLICY IF EXISTS "allow_public_insert_deed_templates" ON public.deed_templates;
DROP POLICY IF EXISTS "allow_public_update_deed_templates" ON public.deed_templates;

CREATE POLICY "allow_public_insert_deed_templates"
  ON public.deed_templates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_public_update_deed_templates"
  ON public.deed_templates FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Keep existing admin-only policy and public SELECT policy as-is
-- Add trigger to maintain updated_at automatically
DROP TRIGGER IF EXISTS trg_deed_templates_updated_at ON public.deed_templates;
CREATE TRIGGER trg_deed_templates_updated_at
BEFORE UPDATE ON public.deed_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();