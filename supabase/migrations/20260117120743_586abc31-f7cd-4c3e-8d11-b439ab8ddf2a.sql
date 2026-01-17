-- Add a permissive policy that requires authentication for SELECT on profiles
-- This explicitly blocks anonymous users from querying the profiles table
CREATE POLICY "Require authentication to view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);