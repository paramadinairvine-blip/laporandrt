-- Fix race condition in make_first_user_admin trigger
-- Instead of counting profiles, check if an admin role already exists
-- Use ON CONFLICT DO NOTHING to prevent duplicate admin assignments

CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if an admin role already exists (not counting profiles)
    -- This prevents race conditions where two simultaneous signups 
    -- could both see zero profiles
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;