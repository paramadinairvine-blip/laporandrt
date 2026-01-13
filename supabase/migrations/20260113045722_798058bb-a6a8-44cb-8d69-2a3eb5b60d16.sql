-- Drop the current overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.damage_reports;

-- Create new policy: Only admins can view all reports
CREATE POLICY "Admins can view all reports" 
ON public.damage_reports 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));