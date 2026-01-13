-- Add RLS policy for public to view all reports
CREATE POLICY "Public can view all reports"
ON public.damage_reports
FOR SELECT
USING (true);