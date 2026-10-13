-- Phase 1a: AdminUser allow-list table and role helper functions

CREATE TABLE IF NOT EXISTS public."AdminUser" (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "AdminUser_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE public."AdminUser" OWNER TO postgres;

COMMENT ON TABLE public."AdminUser" IS 'Allow-list of staff users authorized to access /admin with role-based permissions';

CREATE OR REPLACE FUNCTION public.staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public."AdminUser"
  WHERE user_id = auth.uid();
$$;

ALTER FUNCTION public.staff_role() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."AdminUser"
    WHERE user_id = auth.uid()
  );
$$;

ALTER FUNCTION public.is_staff() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."AdminUser"
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

ALTER FUNCTION public.is_admin() OWNER TO postgres;

ALTER TABLE public."AdminUser" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own row and admins can view all"
  ON public."AdminUser"
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Admins can insert admin users"
  ON public."AdminUser"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update admin users"
  ON public."AdminUser"
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete admin users"
  ON public."AdminUser"
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT ALL ON FUNCTION public.staff_role() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.is_staff() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT ALL ON TABLE public."AdminUser" TO authenticated, service_role;
