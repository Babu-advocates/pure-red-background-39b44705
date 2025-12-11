-- Add draft_id column to approval_requests table
ALTER TABLE public.approval_requests 
ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE;

-- Make template_id nullable since not all requests are for templates
ALTER TABLE public.approval_requests 
ALTER COLUMN template_id DROP NOT NULL;

-- Update the comment to reflect the new structure
COMMENT ON COLUMN public.approval_requests.draft_id IS 'ID of the draft for draft deletion requests';
COMMENT ON COLUMN public.approval_requests.request_type IS 'Type of request: delete (template), download (template), delete_draft';

-- Add a check constraint to ensure either template_id or draft_id is set
ALTER TABLE public.approval_requests
ADD CONSTRAINT approval_requests_id_check 
CHECK (
  (template_id IS NOT NULL AND draft_id IS NULL) OR 
  (template_id IS NULL AND draft_id IS NOT NULL)
);