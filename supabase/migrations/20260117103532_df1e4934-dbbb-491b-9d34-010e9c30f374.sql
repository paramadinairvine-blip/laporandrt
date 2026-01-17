-- Create a public view that hides reporter_name for privacy
CREATE VIEW public.damage_reports_public
WITH (security_invoker = on) AS
SELECT 
    id,
    damage_description,
    damage_type,
    location,
    photo_url,
    status,
    created_at,
    updated_at
FROM public.damage_reports;

-- Drop the permissive public SELECT policy on base table
DROP POLICY IF EXISTS "Public can view all reports" ON public.damage_reports;

-- Add a policy that only allows admins to SELECT from the base table directly
CREATE POLICY "Only admins can view full reports"
ON public.damage_reports
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.damage_reports_public TO anon;
GRANT SELECT ON public.damage_reports_public TO authenticated;