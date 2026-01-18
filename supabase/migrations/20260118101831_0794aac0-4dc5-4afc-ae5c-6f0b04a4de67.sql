-- Allow admins to view profiles of other admins
CREATE POLICY "Admins can view admin profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'admin'
  )
);