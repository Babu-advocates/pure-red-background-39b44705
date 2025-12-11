-- Make date column nullable to allow nil dates
ALTER TABLE public.deeds ALTER COLUMN date DROP NOT NULL;