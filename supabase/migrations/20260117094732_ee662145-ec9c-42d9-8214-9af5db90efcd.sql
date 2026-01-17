-- Create enum for damage type
CREATE TYPE public.damage_type AS ENUM ('rehab', 'listrik', 'air', 'taman', 'lainnya');

-- Add damage_type column to damage_reports table
ALTER TABLE public.damage_reports
ADD COLUMN damage_type public.damage_type NOT NULL DEFAULT 'lainnya';