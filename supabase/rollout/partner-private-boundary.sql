-- Release gate: deploy the website and mobile v2 readers FIRST. This deliberately
-- disables legacy direct directory reads and unrestricted customer reward access.
-- Test locally before applying to the explicitly verified hosted project.
BEGIN;
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Cafe";
DROP POLICY IF EXISTS "Staff read cafe base" ON public."Cafe";
CREATE POLICY "Staff read cafe base" ON public."Cafe" FOR SELECT TO authenticated USING(public.is_staff());
REVOKE SELECT ON public."Cafe" FROM anon;
DROP POLICY IF EXISTS "Enable read access for all users" ON public."CafeImages";
DROP POLICY IF EXISTS "Staff read gallery base" ON public."CafeImages";
CREATE POLICY "Staff read gallery base" ON public."CafeImages" FOR SELECT TO authenticated USING(public.is_staff());
REVOKE SELECT ON public."CafeImages" FROM anon;
DROP POLICY IF EXISTS "Enable read access for all users" ON public."CafeMenu";
DROP POLICY IF EXISTS "Staff read menu base" ON public."CafeMenu";
CREATE POLICY "Staff read menu base" ON public."CafeMenu" FOR SELECT TO authenticated USING(public.is_staff());
REVOKE SELECT ON public."CafeMenu" FROM anon;
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Rewards";
DROP POLICY IF EXISTS "Customers read own rewards" ON public."Rewards";
CREATE POLICY "Customers read own rewards" ON public."Rewards" FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS "Enable update access for all users" ON public."Rewards";
DROP POLICY IF EXISTS "Enable read access for all users" ON public."UserChainLoyalty";
DROP POLICY IF EXISTS "Customers read own loyalty" ON public."UserChainLoyalty";
CREATE POLICY "Customers read own loyalty" ON public."UserChainLoyalty" FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public."RewardTransaction";
NOTIFY pgrst,'reload schema';
COMMIT;
