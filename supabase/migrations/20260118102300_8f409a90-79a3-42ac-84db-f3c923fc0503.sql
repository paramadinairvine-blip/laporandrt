-- Enable realtime for user_roles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;

-- Allow admins to view all admin roles (needed for fetching admin list)
CREATE POLICY "Admins can view admin roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);