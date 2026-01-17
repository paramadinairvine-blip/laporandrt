-- Drop the overly permissive policy that allows all authenticated users to see all profiles
DROP POLICY IF EXISTS "Require authentication to view profiles" ON public.profiles;