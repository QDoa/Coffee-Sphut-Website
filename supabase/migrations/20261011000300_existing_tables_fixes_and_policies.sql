-- Phase 1c: Fixes and staff RLS policies on existing tables

-- 1. Keep Cafe.location (PostGIS geography) and Cafe.latitude / Cafe.longitude in sync
CREATE OR REPLACE FUNCTION public.sync_cafe_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location := extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
    ELSIF NEW.location IS NOT NULL THEN
      NEW.latitude := extensions.ST_Y(NEW.location::extensions.geometry);
      NEW.longitude := extensions.ST_X(NEW.location::extensions.geometry);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
      IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
      ELSE
        NEW.location := NULL;
      END IF;
    ELSIF NEW.location IS DISTINCT FROM OLD.location AND NEW.location IS NOT NULL THEN
      NEW.latitude := extensions.ST_Y(NEW.location::extensions.geometry);
      NEW.longitude := extensions.ST_X(NEW.location::extensions.geometry);
    ELSIF NEW.location IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location := extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_cafe_location() OWNER TO postgres;

CREATE OR REPLACE TRIGGER sync_cafe_location_trigger
  BEFORE INSERT OR UPDATE ON public."Cafe"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cafe_location();

-- Backfill any existing Cafe rows where location and latitude/longitude are out of sync
UPDATE public."Cafe"
SET location = extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

UPDATE public."Cafe"
SET latitude = extensions.ST_Y(location::extensions.geometry),
    longitude = extensions.ST_X(location::extensions.geometry)
WHERE location IS NOT NULL
  AND (latitude IS NULL OR longitude IS NULL);

-- 2. Normalize empty reward_code strings to NULL and enforce uniqueness on non-empty reward codes
UPDATE public."Cafe"
SET reward_code = NULL
WHERE reward_code IS NOT NULL AND btrim(reward_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS cafe_reward_code_unique_idx
  ON public."Cafe" (reward_code)
  WHERE reward_code IS NOT NULL AND btrim(reward_code) <> '';

-- 3. Enable public read access on CafeMenu (previously had RLS enabled with no SELECT policy)
CREATE POLICY "Enable read access for all users"
  ON public."CafeMenu"
  FOR SELECT
  USING (true);

-- 4. Staff RLS policies on Cafe, CafeImages, CafeMenu, Chains (editors can insert/update; admins can delete)
CREATE POLICY "Staff can insert Cafe"
  ON public."Cafe" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Cafe"
  ON public."Cafe" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Cafe"
  ON public."Cafe" FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Staff can insert CafeImages"
  ON public."CafeImages" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update CafeImages"
  ON public."CafeImages" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete CafeImages"
  ON public."CafeImages" FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Staff can insert CafeMenu"
  ON public."CafeMenu" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update CafeMenu"
  ON public."CafeMenu" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete CafeMenu"
  ON public."CafeMenu" FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Staff can insert Chains"
  ON public."Chains" FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update Chains"
  ON public."Chains" FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins can delete Chains"
  ON public."Chains" FOR DELETE TO authenticated USING (public.is_admin());

-- 5. Admin read policies on user-data tables (mutations go through admin_* RPCs in 1f)
CREATE POLICY "Admins can view all Profile rows"
  ON public."Profile" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can view all Bookmark rows"
  ON public."Bookmark" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can view all SavedCafe rows"
  ON public."SavedCafe" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can view all RewardTransaction rows"
  ON public."RewardTransaction" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can view all Rewards rows"
  ON public."Rewards" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can view all UserChainLoyalty rows"
  ON public."UserChainLoyalty" FOR SELECT TO authenticated USING (public.is_admin());

-- 6. Admin read and delete policies on Waitlist
CREATE POLICY "Admins can view Waitlist"
  ON public."Waitlist" FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete Waitlist"
  ON public."Waitlist" FOR DELETE TO authenticated USING (public.is_admin());

GRANT ALL ON FUNCTION public.sync_cafe_location() TO anon, authenticated, service_role;
