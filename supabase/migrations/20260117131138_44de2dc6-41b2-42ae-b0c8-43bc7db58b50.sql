-- Defense in depth: Explicitly revoke SELECT from anonymous/public roles on profiles table
-- This adds an extra layer of protection beyond RLS policies
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM public;

-- Ensure only authenticated role can access (with RLS still enforcing row-level restrictions)
GRANT SELECT ON public.profiles TO authenticated;