-- Drop existing view and recreate with reporter_name
DROP VIEW IF EXISTS public.damage_reports_public;

CREATE VIEW public.damage_reports_public
WITH (security_invoker=on) AS
SELECT 
  id,
  damage_description,
  damage_type,
  location,
  status,
  created_at,
  updated_at,
  photo_url,
  reporter_name
FROM public.damage_reports;