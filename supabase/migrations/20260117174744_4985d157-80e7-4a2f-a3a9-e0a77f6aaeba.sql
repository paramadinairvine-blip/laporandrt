-- Fix privacy issue: Remove reporter_name from public view
-- This prevents public exposure of reporter identities

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
  photo_url
  -- reporter_name intentionally excluded for privacy protection
FROM public.damage_reports;

-- Re-grant access to the view
GRANT SELECT ON public.damage_reports_public TO anon;
GRANT SELECT ON public.damage_reports_public TO authenticated;