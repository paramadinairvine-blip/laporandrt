-- Create a trigger function to make the first user an admin
CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
BEGIN
    -- Count existing users (excluding the one being inserted)
    SELECT COUNT(*) INTO user_count FROM public.profiles WHERE id != NEW.id;
    
    -- If this is the first user, make them an admin
    IF user_count = 0 THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to run after profile creation
DROP TRIGGER IF EXISTS on_first_user_created ON public.profiles;
CREATE TRIGGER on_first_user_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.make_first_user_admin();