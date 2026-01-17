-- Drop existing view
DROP VIEW IF EXISTS public.damage_reports_public;

-- Recreate view with security_invoker=false so it bypasses RLS on the base table
CREATE VIEW public.damage_reports_public
WITH (security_invoker=false) AS
SELECT 
    id,
    damage_description,
    damage_type,
    location,
    status,
    created_at,
    updated_at,
    photo_url
FROM public.damage_reports;

-- Grant SELECT access to anon and authenticated roles
GRANT SELECT ON public.damage_reports_public TO anon;
GRANT SELECT ON public.damage_reports_public TO authenticated;