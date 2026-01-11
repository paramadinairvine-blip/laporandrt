-- Create enum for location options
CREATE TYPE public.location_type AS ENUM ('asrama_kampus_1', 'asrama_kampus_2', 'asrama_kampus_3');

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM ('pending', 'in_progress', 'completed');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table FIRST (before being referenced)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create damage reports table
CREATE TABLE public.damage_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_name TEXT NOT NULL,
    damage_description TEXT NOT NULL,
    location location_type NOT NULL,
    photo_url TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on damage_reports
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert reports (public form)
CREATE POLICY "Anyone can submit damage reports"
ON public.damage_reports
FOR INSERT
WITH CHECK (true);

-- Only authenticated users can view reports
CREATE POLICY "Authenticated users can view reports"
ON public.damage_reports
FOR SELECT
TO authenticated
USING (true);

-- Only admins can update reports
CREATE POLICY "Admins can update reports"
ON public.damage_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
    RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for damage_reports updated_at
CREATE TRIGGER update_damage_reports_updated_at
    BEFORE UPDATE ON public.damage_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for damage photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-photos', 'damage-photos', true);

-- Storage policies for damage photos
CREATE POLICY "Anyone can upload damage photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'damage-photos');

CREATE POLICY "Anyone can view damage photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'damage-photos');