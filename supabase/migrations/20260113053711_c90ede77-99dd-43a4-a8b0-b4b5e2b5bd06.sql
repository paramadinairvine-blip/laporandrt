-- Add RLS policy for admins to delete reports
CREATE POLICY "Admins can delete reports"
ON public.damage_reports
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));