-- Partner portal schema and backfills, in dependency order.
-- The coordinated mobile privacy cutoff lives in supabase/rollout.

BEGIN;

-- Partner portal
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.partner_accounts (
 chain_id uuid PRIMARY KEY REFERENCES public."Chains"(id),
 plan text NOT NULL DEFAULT 'free' CHECK(plan IN ('free','paid')),
 timezone text NOT NULL DEFAULT 'UTC', selection_required boolean NOT NULL DEFAULT false,
 reward_coverage_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.partner_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 user_id uuid NOT NULL REFERENCES auth.users(id), role text NOT NULL CHECK(role IN ('owner','chain_manager','cafe_manager')),
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,chain_id)
);
CREATE UNIQUE INDEX partner_one_active_chain ON public.partner_memberships(user_id) WHERE revoked_at IS NULL;
CREATE INDEX partner_membership_chain ON public.partner_memberships(chain_id,user_id);
ALTER TABLE public."Cafe" ADD CONSTRAINT cafe_id_chain_unique UNIQUE(id,chain_id);
ALTER TABLE public."Cafe" ADD COLUMN partner_revision bigint NOT NULL DEFAULT 1;
CREATE TABLE public.partner_cafe_access (
 cafe_id bigint PRIMARY KEY, chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 restricted boolean NOT NULL DEFAULT false,
 FOREIGN KEY(cafe_id,chain_id) REFERENCES public."Cafe"(id,chain_id)
);
CREATE TABLE public.partner_assignments (
 membership_id uuid NOT NULL, chain_id uuid NOT NULL, cafe_id bigint NOT NULL,
 PRIMARY KEY(membership_id,cafe_id),
 FOREIGN KEY(membership_id,chain_id) REFERENCES public.partner_memberships(id,chain_id),
 FOREIGN KEY(cafe_id,chain_id) REFERENCES public."Cafe"(id,chain_id)
);
CREATE TABLE public.partner_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 email text NOT NULL, role text NOT NULL CHECK(role IN ('chain_manager','cafe_manager')),
 cafe_ids bigint[] NOT NULL DEFAULT '{}', token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', accepted_at timestamptz, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.partner_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 cafe_id bigint, baseline bigint, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected')),
 submitter uuid NOT NULL REFERENCES auth.users(id), reviewer uuid REFERENCES auth.users(id), reason text,
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 FOREIGN KEY(cafe_id,chain_id) REFERENCES public."Cafe"(id,chain_id)
);
CREATE UNIQUE INDEX partner_one_pending ON public.partner_changes(cafe_id) WHERE status='pending';
CREATE INDEX partner_review_queue ON public.partner_changes(status,created_at DESC);
CREATE TABLE public.partner_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 cafe_id bigint NOT NULL, name text NOT NULL CHECK(length(btrim(name))>0), code text NOT NULL,
 type text NOT NULL CHECK(type IN ('ingredient','product')), unit text NOT NULL CHECK(unit IN ('g','ml','each')),
 balance numeric(18,6) NOT NULL DEFAULT 0 CHECK(balance>=0), threshold numeric(18,6) NOT NULL DEFAULT 0 CHECK(threshold>=0),
 active boolean NOT NULL DEFAULT true, UNIQUE(cafe_id,code), UNIQUE(id,chain_id),
 FOREIGN KEY(cafe_id,chain_id) REFERENCES public."Cafe"(id,chain_id)
);
CREATE INDEX partner_access_chain ON public.partner_cafe_access(chain_id,cafe_id);
CREATE INDEX partner_invite_chain ON public.partner_invitations(chain_id,created_at);
CREATE INDEX partner_changes_chain ON public.partner_changes(chain_id,created_at DESC);
CREATE INDEX partner_item_scope ON public.partner_items(chain_id,cafe_id);
CREATE TABLE public.partner_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL, item_id uuid NOT NULL,
 cafe_id bigint NOT NULL, quantity numeric(18,6) NOT NULL, resulting_balance numeric(18,6) NOT NULL CHECK(resulting_balance>=0),
 type text NOT NULL CHECK(type IN ('opening','receipt','consumption','wastage','count','correction')),
 actor uuid NOT NULL REFERENCES auth.users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(item_id,chain_id) REFERENCES public.partner_items(id,chain_id), FOREIGN KEY(cafe_id,chain_id) REFERENCES public."Cafe"(id,chain_id)
);
CREATE INDEX partner_movement_item ON public.partner_movements(item_id,created_at DESC);
CREATE INDEX partner_movement_history ON public.partner_movements(cafe_id,created_at DESC,id);
CREATE TABLE public.partner_recipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 name text NOT NULL CHECK(length(btrim(name))>0), yield numeric(18,6) NOT NULL CHECK(yield>0),
 ingredients jsonb NOT NULL CHECK(jsonb_typeof(ingredients)='array'), active boolean NOT NULL DEFAULT true,
 revision bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_recipe_chain ON public.partner_recipes(chain_id);
CREATE TABLE public.partner_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 actor uuid REFERENCES auth.users(id), action text NOT NULL, target text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SEQUENCE public.partner_audit_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.partner_audit_id_seq TO service_role;
CREATE INDEX partner_audit_chain ON public.partner_audit(chain_id,created_at DESC);
CREATE TABLE public.partner_operations (
 actor uuid NOT NULL, request_id uuid NOT NULL, action text NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor,request_id)
);
ALTER TABLE public."Rewards" ADD COLUMN redeemed_cafe_id bigint REFERENCES public."Cafe"(id);
-- Attribution is captured in the existing authoritative redemption operation.
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id uuid,p_cafe_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public."Cafe"; rid uuid;
BEGIN
 SELECT * INTO c FROM public."Cafe" WHERE reward_code=btrim(p_cafe_code) AND is_active IS TRUE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cafe code' USING ERRCODE='22023'; END IF;
 UPDATE public."Rewards" SET status='redeemed',redeemed_at=now(),redeemed_cafe_id=c.id
 WHERE id=p_reward_id AND chain_id=c.chain_id AND status='issued' RETURNING id INTO rid;
 IF rid IS NULL THEN RAISE EXCEPTION 'Reward is unavailable at this cafe' USING ERRCODE='22023'; END IF;
 RETURN rid;
END $$;

CREATE FUNCTION public.partner_role(p_chain uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.partner_memberships WHERE chain_id=p_chain AND user_id=(SELECT auth.uid()) AND revoked_at IS NULL
$$;
CREATE FUNCTION public.partner_can_cafe(p_cafe bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.partner_cafe_access a JOIN public.partner_accounts p USING(chain_id)
 JOIN public.partner_memberships m ON m.chain_id=a.chain_id AND m.user_id=(SELECT auth.uid()) AND m.revoked_at IS NULL
 JOIN public."Cafe" c ON c.id=a.cafe_id
 WHERE a.cafe_id=p_cafe AND NOT a.restricted AND NOT p.selection_required AND c.is_active IS NOT NULL
 AND (m.role IN ('owner','chain_manager') OR EXISTS(SELECT 1 FROM public.partner_assignments s WHERE s.membership_id=m.id AND s.cafe_id=p_cafe)))
$$;
CREATE FUNCTION public.partner_paid(p_chain uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.partner_accounts WHERE chain_id=p_chain AND plan='paid' AND public.partner_role(p_chain) IS NOT NULL)
$$;
-- Explicit grants: all writes go through transactional commands, never direct REST.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['partner_accounts','partner_memberships','partner_cafe_access','partner_assignments','partner_invitations','partner_changes','partner_items','partner_movements','partner_recipes','partner_audit','partner_operations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE POLICY partner_account_read ON public.partner_accounts FOR SELECT TO authenticated USING(public.partner_role(chain_id) IS NOT NULL OR public.is_staff());
CREATE POLICY partner_member_read ON public.partner_memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR public.partner_role(chain_id)='owner' OR public.is_admin());
CREATE POLICY partner_access_read ON public.partner_cafe_access FOR SELECT TO authenticated USING(public.partner_can_cafe(cafe_id));
CREATE POLICY partner_assignment_read ON public.partner_assignments FOR SELECT TO authenticated USING(public.partner_role(chain_id)='owner');
CREATE POLICY partner_invitation_read ON public.partner_invitations FOR SELECT TO authenticated USING(public.partner_role(chain_id)='owner');
CREATE POLICY partner_change_read ON public.partner_changes FOR SELECT TO authenticated USING(public.is_staff() OR (public.partner_role(chain_id) IS NOT NULL AND (public.partner_can_cafe(cafe_id) OR (cafe_id IS NULL AND public.partner_role(chain_id) IN ('owner','chain_manager')))));
CREATE POLICY partner_item_read ON public.partner_items FOR SELECT TO authenticated USING(public.partner_paid(chain_id) AND public.partner_can_cafe(cafe_id));
CREATE POLICY partner_movement_read ON public.partner_movements FOR SELECT TO authenticated USING(public.partner_paid(chain_id) AND public.partner_can_cafe(cafe_id));
CREATE POLICY partner_recipe_read ON public.partner_recipes FOR SELECT TO authenticated USING(public.partner_paid(chain_id));
CREATE POLICY partner_audit_read ON public.partner_audit FOR SELECT TO authenticated USING(public.partner_role(chain_id)='owner' OR public.is_admin());

CREATE FUNCTION public.partner_cafe_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; active_count int;
BEGIN
 IF TG_TABLE_NAME='Cafe' THEN
  IF TG_OP='DELETE' THEN
   IF EXISTS(SELECT 1 FROM public.partner_cafe_access WHERE cafe_id=OLD.id) THEN RAISE EXCEPTION 'Archive partner cafes instead of deleting retained records'; END IF;
   RETURN OLD;
  END IF;
  SELECT chain_id INTO cid FROM public.partner_accounts WHERE chain_id=NEW.chain_id FOR UPDATE;
  IF TG_OP='UPDATE' THEN
   NEW.partner_revision=OLD.partner_revision+1;
   IF OLD.chain_id<>NEW.chain_id AND (cid IS NOT NULL OR EXISTS(SELECT 1 FROM public.partner_cafe_access WHERE cafe_id=OLD.id)) THEN RAISE EXCEPTION 'Partner cafe transfers require a reconciled staff transfer'; END IF;
  END IF;
  IF cid IS NOT NULL AND NEW.is_active IS TRUE AND (TG_OP='INSERT' OR OLD.is_active IS DISTINCT FROM TRUE) THEN
   SELECT count(*) INTO active_count FROM public."Cafe" c LEFT JOIN public.partner_cafe_access a ON a.cafe_id=c.id
   WHERE c.chain_id=cid AND c.is_active IS TRUE AND NOT coalesce(a.restricted,false) AND c.id<>NEW.id;
   IF (SELECT plan='free' FROM public.partner_accounts WHERE chain_id=cid) AND active_count>=3 THEN RAISE EXCEPTION 'Free allows three active cafes. Upgrade or archive a cafe first.'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 UPDATE public."Cafe" SET partner_revision=partner_revision WHERE id=coalesce(NEW.cafe_id,OLD.cafe_id);
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER partner_cafe_version BEFORE INSERT OR UPDATE OR DELETE ON public."Cafe" FOR EACH ROW EXECUTE FUNCTION public.partner_cafe_version();
CREATE FUNCTION public.partner_attach_cafe() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.partner_cafe_access(cafe_id,chain_id) SELECT NEW.id,NEW.chain_id FROM public.partner_accounts WHERE chain_id=NEW.chain_id ON CONFLICT(cafe_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER partner_attach_cafe AFTER INSERT ON public."Cafe" FOR EACH ROW EXECUTE FUNCTION public.partner_attach_cafe();
CREATE TRIGGER partner_gallery_version AFTER INSERT OR UPDATE OR DELETE ON public."CafeImages" FOR EACH ROW EXECUTE FUNCTION public.partner_cafe_version();
CREATE TRIGGER partner_menu_version AFTER INSERT OR UPDATE OR DELETE ON public."CafeMenu" FOR EACH ROW EXECUTE FUNCTION public.partner_cafe_version();

CREATE FUNCTION public.partner_validate_cafe(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text; x jsonb;
BEGIN
 IF jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Invalid cafe fields'; END IF;
 FOR k IN SELECT jsonb_object_keys(p) LOOP
 IF k<>ALL(ARRAY['name','image_url','address','time_open','longitude','latitude','link','description','phone_number','email','social_media','amenities','rating','is_active','loyalty_threshold_override','reward_code','show_details','postcode','gallery','menu']) THEN RAISE EXCEPTION 'Unsupported or system-owned field: %',k; END IF;
 END LOOP;
 IF p ? 'name' AND nullif(btrim(p->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Cafe name is required'; END IF;
 IF (p ? 'latitude')<>(p ? 'longitude') OR ((p->>'latitude') IS NULL)<>((p->>'longitude') IS NULL) THEN RAISE EXCEPTION 'Provide both coordinates'; END IF;
 IF (p->>'latitude')::float8 NOT BETWEEN -90 AND 90 OR (p->>'longitude')::float8 NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 IF (p->>'rating')::float8 NOT BETWEEN 0 AND 5 THEN RAISE EXCEPTION 'Rating must be between 0 and 5'; END IF;
 IF (p->>'loyalty_threshold_override')::int<=0 THEN RAISE EXCEPTION 'Threshold must be positive'; END IF;
 IF p ? 'is_active' AND jsonb_typeof(p->'is_active')<>'boolean' THEN RAISE EXCEPTION 'Choose active or archived'; END IF;
 IF p ? 'gallery' AND (jsonb_typeof(p->'gallery')<>'array' OR jsonb_array_length(p->'gallery')>50) THEN RAISE EXCEPTION 'Invalid gallery'; END IF;
 IF p ? 'menu' THEN
  IF jsonb_typeof(p->'menu')<>'array' OR jsonb_array_length(p->'menu')>500 THEN RAISE EXCEPTION 'Invalid menu'; END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(p->'menu') LOOP
   IF nullif(btrim(x->>'name'),'') IS NULL OR (x->>'price')::bigint<0 OR coalesce(x->>'currency','')!~'^[A-Z]{3}$' THEN RAISE EXCEPTION 'Menu requires name, nonnegative minor-unit price and currency'; END IF;
  END LOOP;
 END IF;
END $$;

CREATE FUNCTION public.partner_command(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<cmd>>
DECLARE uid uuid=auth.uid(); cid uuid; role_name text; req uuid=(p_input->>'request_id')::uuid; oldop public.partner_operations;
 acc public.partner_accounts; ch public.partner_changes; c public."Cafe"; it public.partner_items; inv public.partner_invitations;
 payload jsonb; elem jsonb; output jsonb='{}'; target text; token text; n numeric; delta numeric; item_id uuid; ids bigint[]; member public.partner_memberships;
BEGIN
 IF uid IS NULL OR req IS NULL THEN RAISE EXCEPTION 'Authenticated user and request ID required' USING ERRCODE='42501'; END IF;
 -- Serialize retries before checking state that the first successful request changed.
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||req::text,0));
 SELECT * INTO oldop FROM public.partner_operations WHERE actor=uid AND request_id=req;
 IF FOUND THEN
  IF oldop.action<>p_action OR oldop.input<>p_input THEN RAISE EXCEPTION 'Request ID was reused with different data'; END IF;
  -- A retry must satisfy CURRENT access; retained receipts are not a read bypass.
  IF p_action IN ('review','activate_plan','provision') THEN
   IF NOT public.is_staff() OR (p_action<>'review' AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Current staff access required' USING ERRCODE='42501'; END IF;
  ELSE
   cid=nullif(p_input->>'chain_id','')::uuid;
   IF p_action='accept_invite' THEN SELECT chain_id INTO cid FROM public.partner_memberships WHERE user_id=uid AND revoked_at IS NULL; END IF;
   IF public.partner_role(cid) IS NULL THEN RAISE EXCEPTION 'Current partner access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('item','movement','recipe') AND NOT public.partner_paid(cid) THEN RAISE EXCEPTION 'Current Paid access required' USING ERRCODE='42501'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL AND NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Current cafe access required' USING ERRCODE='42501'; END IF;
   IF p_action='movement' AND NOT EXISTS(SELECT 1 FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND public.partner_can_cafe(cafe_id)) THEN RAISE EXCEPTION 'Current item access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('invite','revoke_member','revoke_invite','select_cafes','settings') AND public.partner_role(cid)<>'owner' THEN RAISE EXCEPTION 'Current Owner access required'; END IF;
  END IF;
  RETURN oldop.result;
 END IF;
 IF p_action='accept_invite' THEN
  SELECT * INTO inv FROM public.partner_invitations WHERE token_hash=encode(extensions.digest(p_input->>'token','sha256'),'hex') FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at<=now() OR inv.email<>(SELECT lower(email) FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Invitation unavailable for this account'; END IF;
  cid=inv.chain_id;
 ELSE cid=nullif(p_input->>'chain_id','')::uuid; END IF;
 IF p_action='provision' THEN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_input->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Chain name required'; END IF;
  IF cid IS NULL THEN INSERT INTO public."Chains"(name) VALUES(p_input->>'name') RETURNING id INTO cid; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(p_input->>'owner_id')::uuid) THEN RAISE EXCEPTION 'Owner must have an existing verified account'; END IF;
  INSERT INTO public.partner_accounts(chain_id) VALUES(cid);
  INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,(p_input->>'owner_id')::uuid,'owner');
  INSERT INTO public.partner_cafe_access(cafe_id,chain_id) SELECT id,cid FROM public."Cafe" WHERE chain_id=cid;
  UPDATE public.partner_accounts SET selection_required=(SELECT count(*)>3 FROM public."Cafe" WHERE chain_id=cid AND is_active IS TRUE) WHERE chain_id=cid;
  output=jsonb_build_object('chain_id',cid);
 ELSE
  SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partner unavailable'; END IF;
  role_name=public.partner_role(cid);
  IF p_action NOT IN ('review','activate_plan','accept_invite') AND role_name IS NULL THEN RAISE EXCEPTION 'Partner access denied' USING ERRCODE='42501'; END IF;
  CASE p_action
  WHEN 'accept_invite' THEN
   INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,uid,inv.role) RETURNING * INTO member;
   INSERT INTO public.partner_assignments(membership_id,chain_id,cafe_id) SELECT member.id,cid,unnest(inv.cafe_ids);
   UPDATE public.partner_invitations SET accepted_at=now() WHERE id=inv.id;
  WHEN 'save_change','submit_change' THEN
   IF acc.selection_required THEN RAISE EXCEPTION 'Owner must select accessible cafes first'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL THEN
    IF NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
    SELECT * INTO c FROM public."Cafe" WHERE id=(p_input->>'cafe_id')::bigint;
   ELSIF role_name='cafe_manager' THEN RAISE EXCEPTION 'Chain manager required to create cafes'; END IF;
   payload=p_input->'payload'; PERFORM public.partner_validate_cafe(payload);
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_changes(chain_id,cafe_id,baseline,payload,status,submitter)
    VALUES(cid,c.id,(p_input->>'baseline')::bigint,payload,CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END,uid) RETURNING * INTO ch;
   ELSE
    SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
    IF NOT FOUND OR ch.status<>'draft' OR ch.submitter<>uid OR ch.cafe_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Draft unavailable'; END IF;
    UPDATE public.partner_changes SET payload=cmd.payload,baseline=(p_input->>'baseline')::bigint,status=CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END WHERE id=ch.id RETURNING * INTO ch;
   END IF;
   output=jsonb_build_object('id',ch.id);
  WHEN 'review' THEN
   IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff reviewer required' USING ERRCODE='42501'; END IF;
   SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR ch.status<>'pending' OR ch.submitter=uid THEN RAISE EXCEPTION 'Another staff reviewer must review a pending request'; END IF;
   IF p_input->>'decision'='reject' THEN
    IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
    UPDATE public.partner_changes SET status='rejected',reviewer=uid,reason=p_input->>'reason',reviewed_at=now() WHERE id=ch.id;
   ELSIF p_input->>'decision'='approve' THEN
    payload=ch.payload; PERFORM public.partner_validate_cafe(payload);
    IF ch.cafe_id IS NOT NULL THEN
     SELECT * INTO c FROM public."Cafe" WHERE id=ch.cafe_id AND chain_id=cid FOR UPDATE;
     IF c.partner_revision IS DISTINCT FROM ch.baseline THEN RAISE EXCEPTION 'Conflict: approved cafe changed. Resubmit against the current revision.'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.partner_cafe_access WHERE cafe_id=c.id AND NOT restricted) OR acc.selection_required THEN RAISE EXCEPTION 'Cafe is subscription restricted'; END IF;
    ELSE c.chain_id=cid; c.is_active=true; c.show_details=false; END IF;
    c=jsonb_populate_record(c,payload-'gallery'-'menu');
    IF ch.cafe_id IS NULL THEN
     INSERT INTO public."Cafe"(chain_id,name,address,postcode,description,image_url,latitude,longitude,time_open,phone_number,email,link,social_media,amenities,rating,is_active,show_details,loyalty_threshold_override,reward_code)
     VALUES(cid,c.name,c.address,c.postcode,c.description,c.image_url,c.latitude,c.longitude,c.time_open,c.phone_number,c.email,c.link,c.social_media,c.amenities,c.rating,c.is_active,c.show_details,c.loyalty_threshold_override,nullif(btrim(c.reward_code),'')) RETURNING * INTO c;
     INSERT INTO public.partner_cafe_access(cafe_id,chain_id) VALUES(c.id,cid) ON CONFLICT(cafe_id) DO NOTHING;
    ELSE
     UPDATE public."Cafe" SET name=c.name,address=c.address,postcode=c.postcode,description=c.description,image_url=c.image_url,latitude=c.latitude,longitude=c.longitude,time_open=c.time_open,phone_number=c.phone_number,email=c.email,link=c.link,social_media=c.social_media,amenities=c.amenities,rating=c.rating,is_active=c.is_active,show_details=c.show_details,loyalty_threshold_override=c.loyalty_threshold_override,reward_code=nullif(btrim(c.reward_code),'') WHERE id=c.id;
    END IF;
    IF payload ? 'gallery' THEN INSERT INTO public."CafeImages"(cafe_id,images_url) VALUES(c.id,ARRAY(SELECT jsonb_array_elements_text(payload->'gallery'))) ON CONFLICT(cafe_id) DO UPDATE SET images_url=excluded.images_url; END IF;
    IF payload ? 'menu' THEN
     DELETE FROM public."CafeMenu" WHERE cafe_id=c.id;
     FOR elem IN SELECT * FROM jsonb_array_elements(payload->'menu') LOOP
      INSERT INTO public."CafeMenu"(cafe_id,name,price,currency,description) VALUES(c.id,elem->>'name',(elem->>'price')::bigint,elem->>'currency',elem->>'description');
     END LOOP;
    END IF;
    UPDATE public.partner_changes SET status='approved',cafe_id=c.id,reviewer=uid,reviewed_at=now() WHERE id=ch.id;
   ELSE RAISE EXCEPTION 'Invalid review decision'; END IF;
  WHEN 'item' THEN
   IF acc.plan<>'paid' OR NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Paid cafe access required' USING ERRCODE='42501'; END IF;
   IF coalesce((p_input->>'threshold')::numeric,0)::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite stock threshold required'; END IF;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_items(chain_id,cafe_id,name,code,type,unit,threshold) VALUES(cid,(p_input->>'cafe_id')::bigint,p_input->>'name',p_input->>'code',p_input->>'type',p_input->>'unit',coalesce((p_input->>'threshold')::numeric,0)) RETURNING id INTO item_id;
   ELSE
    UPDATE public.partner_items SET active=(p_input->>'active')::boolean WHERE id=(p_input->>'id')::uuid AND cafe_id=(p_input->>'cafe_id')::bigint AND chain_id=cid RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id);
  WHEN 'movement' THEN
   SELECT * INTO it FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR NOT it.active OR acc.plan<>'paid' OR NOT public.partner_can_cafe(it.cafe_id) THEN RAISE EXCEPTION 'Paid item access required' USING ERRCODE='42501'; END IF;
   IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Movement reason required'; END IF;
   n=(p_input->>'quantity')::numeric;
   IF n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR n<0 OR scale(n)>6 THEN RAISE EXCEPTION 'Use a nonnegative quantity with at most six decimals'; END IF;
   IF n=0 AND p_input->>'type'<>'count' THEN RAISE EXCEPTION 'Movement quantity must be positive'; END IF;
   CASE p_input->>'type'
    WHEN 'count' THEN delta=n-it.balance;
    WHEN 'receipt','opening' THEN delta=n;
    WHEN 'consumption','wastage' THEN delta=-n;
    WHEN 'correction' THEN IF p_input->>'direction'='subtract' THEN delta=-n; ELSE delta=n; END IF;
    ELSE RAISE EXCEPTION 'Invalid movement type';
   END CASE;
   IF it.balance+delta<0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
   UPDATE public.partner_items SET balance=balance+delta WHERE id=it.id RETURNING balance INTO n;
   INSERT INTO public.partner_movements(chain_id,item_id,cafe_id,quantity,resulting_balance,type,actor,reason) VALUES(cid,it.id,it.cafe_id,delta,n,p_input->>'type',uid,p_input->>'reason');
   output=jsonb_build_object('balance',n);
  WHEN 'recipe' THEN
   IF (p_input->>'yield') IS NULL OR (p_input->>'yield')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite positive recipe yield required'; END IF;
   IF acc.plan<>'paid' OR role_name NOT IN ('owner','chain_manager') THEN RAISE EXCEPTION 'Paid chain manager required' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(p_input->'ingredients') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'ingredients')<1 THEN RAISE EXCEPTION 'Recipe requires ingredients'; END IF;
   FOR elem IN SELECT * FROM jsonb_array_elements(p_input->'ingredients') LOOP
    SELECT * INTO it FROM public.partner_items WHERE id=(elem->>'item_id')::uuid AND chain_id=cid AND type='ingredient';
    IF NOT FOUND OR (elem->>'quantity')::numeric<=0 OR (elem->>'quantity') IS NULL OR (elem->>'quantity')::numeric::text IN ('NaN','Infinity','-Infinity') OR (elem->>'unit') IS DISTINCT FROM it.unit THEN RAISE EXCEPTION 'Invalid ingredient, quantity or unit'; END IF;
   END LOOP;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_recipes(chain_id,name,yield,ingredients) VALUES(cid,p_input->>'name',(p_input->>'yield')::numeric,p_input->'ingredients') RETURNING id INTO item_id;
   ELSE
    UPDATE public.partner_recipes SET name=p_input->>'name',yield=(p_input->>'yield')::numeric,ingredients=p_input->'ingredients',active=coalesce((p_input->>'active')::boolean,true),revision=revision+1,updated_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND revision=(p_input->>'revision')::bigint RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Recipe changed or unavailable; reload before saving'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id,'revision',(SELECT revision FROM public.partner_recipes WHERE id=item_id));
  WHEN 'invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT public.partner_can_cafe(i)) THEN RAISE EXCEPTION 'Invitation cafe scope denied'; END IF;
   token=gen_random_uuid()::text||gen_random_uuid()::text;
   INSERT INTO public.partner_invitations(chain_id,email,role,cafe_ids,token_hash) VALUES(cid,lower(btrim(p_input->>'email')),p_input->>'role',ids,encode(extensions.digest(token,'sha256'),'hex'));
   output=jsonb_build_object('token',token);
  WHEN 'revoke_member' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_memberships SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND role<>'owner';
   IF NOT FOUND THEN RAISE EXCEPTION 'Manager unavailable; Owner transfer requires staff'; END IF;
  WHEN 'revoke_invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_invitations SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND accepted_at IS NULL;
  WHEN 'settings' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_input->>'timezone') THEN RAISE EXCEPTION 'Invalid IANA timezone'; END IF;
   UPDATE public.partner_accounts SET timezone=p_input->>'timezone' WHERE chain_id=cid;
  WHEN 'select_cafes','activate_plan' THEN
   IF p_action='activate_plan' THEN
    IF NOT public.is_admin() OR nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Admin and activation record/reason required' USING ERRCODE='42501'; END IF;
    IF p_input->>'plan' NOT IN ('free','paid') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
    UPDATE public.partner_accounts SET plan=p_input->>'plan' WHERE chain_id=cid RETURNING * INTO acc;
   ELSIF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT EXISTS(SELECT 1 FROM public."Cafe" WHERE id=i AND chain_id=cid)) THEN RAISE EXCEPTION 'Cafe selection outside chain'; END IF;
   IF acc.plan='free' AND (SELECT count(*) FROM public."Cafe" WHERE id=ANY(ids) AND is_active IS TRUE)>3 THEN RAISE EXCEPTION 'Select at most three active cafes'; END IF;
   IF acc.plan='paid' THEN UPDATE public.partner_cafe_access SET restricted=false WHERE chain_id=cid;
   ELSE UPDATE public.partner_cafe_access SET restricted=NOT(cafe_id=ANY(ids)) WHERE chain_id=cid; END IF;
   UPDATE public.partner_accounts SET selection_required=false WHERE chain_id=cid;
  ELSE RAISE EXCEPTION 'Unknown partner action';
  END CASE;
 END IF;
 INSERT INTO public.partner_audit(chain_id,actor,action,target,details) VALUES(cid,uid,p_action,coalesce(p_input->>'id',output->>'id'),p_input-ARRAY['request_id','token','payload']);
 INSERT INTO public.partner_operations(actor,request_id,action,input,result) VALUES(uid,req,p_action,p_input,output);
 RETURN output;
END $$;

CREATE FUNCTION public.partner_snapshot(p_section text DEFAULT 'overview',p_input jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; r text; acc public.partner_accounts; result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_section='staff' THEN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('actor',auth.uid(),'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',c.name)),'[]') FROM public.partner_accounts a JOIN public."Chains" c ON c.id=a.chain_id),
   'changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT ch.*,c.name AS cafe_name,to_jsonb(c) AS current_values FROM public.partner_changes ch LEFT JOIN public."Cafe" c ON c.id=ch.cafe_id WHERE status='pending' ORDER BY ch.created_at LIMIT 100) x));
 END IF;
 SELECT chain_id,role INTO cid,r FROM public.partner_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL;
 IF cid IS NULL THEN RAISE EXCEPTION 'No active partner membership' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid;
 result=jsonb_build_object('actor',auth.uid(),'chain_id',cid,'role',r,'plan',acc.plan,'timezone',acc.timezone,'selection_required',acc.selection_required,'coverage_at',acc.reward_coverage_at,'name',(SELECT name FROM public."Chains" WHERE id=cid));
 IF p_section='selection' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required'; END IF;
  RETURN result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]') FROM public."Cafe" WHERE chain_id=cid));
 END IF;
 result=result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(to_jsonb(c)-ARRAY['reward_code','fts_vectors','location']),'[]') FROM public."Cafe" c WHERE public.partner_can_cafe(c.id)));
 IF p_section='cafes' THEN
  RETURN result||jsonb_build_object('changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_changes WHERE chain_id=cid AND (public.partner_can_cafe(cafe_id) OR (cafe_id IS NULL AND r IN ('owner','chain_manager'))) ORDER BY created_at DESC LIMIT 100) x));
 ELSIF p_section='cafe' THEN
  IF NOT public.partner_can_cafe((p_input->>'id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('cafe',(SELECT to_jsonb(c)-ARRAY['fts_vectors','location'] FROM public."Cafe" c WHERE id=(p_input->>'id')::bigint),'gallery',(SELECT coalesce(to_jsonb(images_url),'[]') FROM public."CafeImages" WHERE cafe_id=(p_input->>'id')::bigint),'menu',(SELECT coalesce(jsonb_agg(m),'[]') FROM public."CafeMenu" m WHERE cafe_id=(p_input->>'id')::bigint));
 ELSIF p_section='rewards' THEN
  start_at=coalesce((p_input->>'from')::date,(now() AT TIME ZONE acc.timezone)::date-30)::timestamp AT TIME ZONE acc.timezone;
  end_at=(coalesce((p_input->>'to')::date,(now() AT TIME ZONE acc.timezone)::date)+1)::timestamp AT TIME ZONE acc.timezone;
  IF end_at<=start_at THEN RAISE EXCEPTION 'Invalid date range'; END IF;
  SELECT jsonb_build_object('total',count(*),'events',coalesce(jsonb_agg(x) FILTER(WHERE rn>coalesce((p_input->>'offset')::int,0) AND rn<=coalesce((p_input->>'offset')::int,0)+50),'[]')) INTO result
  FROM (SELECT rw.id,rw.redeemed_cafe_id AS cafe_id,c.name AS cafe_name,rw.redeemed_at AS occurred_at,rw.status,row_number() OVER(ORDER BY rw.redeemed_at DESC,rw.id) AS rn
   FROM public."Rewards" rw JOIN public."Cafe" c ON c.id=rw.redeemed_cafe_id WHERE rw.chain_id=cid AND rw.status='redeemed' AND rw.redeemed_at>=start_at AND rw.redeemed_at<end_at AND public.partner_can_cafe(c.id) AND (p_input->>'cafe_id' IS NULL OR c.id=(p_input->>'cafe_id')::bigint)) x;
  RETURN (SELECT jsonb_build_object('actor',auth.uid(),'chain_id',cid,'name',(SELECT name FROM public."Chains" WHERE id=cid),'role',r,'plan',acc.plan,'timezone',acc.timezone,'coverage_at',acc.reward_coverage_at,'refreshed_at',now(),'cafes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') FROM public."Cafe" WHERE public.partner_can_cafe(id))))||result;
 ELSIF p_section IN ('inventory','recipes') THEN
  IF acc.plan<>'paid' THEN RAISE EXCEPTION 'Upgrade to Paid to access inventory and recipes' USING ERRCODE='42501'; END IF;
  IF p_section='inventory' THEN RETURN result||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(i),'[]') FROM public.partner_items i WHERE chain_id=cid AND public.partner_can_cafe(cafe_id)),'movements',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_movements WHERE chain_id=cid AND public.partner_can_cafe(cafe_id) ORDER BY created_at DESC,id LIMIT 100) x)); END IF;
  -- Shared recipes expose ingredient definitions, never other cafes' balances.
  RETURN result||jsonb_build_object('recipes',(SELECT coalesce(jsonb_agg(x),'[]') FROM public.partner_recipes x WHERE chain_id=cid),'ingredients',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit)),'[]') FROM public.partner_items WHERE chain_id=cid AND type='ingredient' AND active));
 ELSIF p_section='team' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('members',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT m.id,m.user_id,m.role,m.revoked_at,u.email FROM public.partner_memberships m JOIN auth.users u ON u.id=m.user_id WHERE chain_id=cid) x),'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'token_hash'),'[]') FROM public.partner_invitations i WHERE chain_id=cid));
 END IF;
 RETURN result;
END $$;

-- Additive replacement for public clients; legacy endpoints remain until coordinated rollout.
CREATE FUNCTION public.public_cafes_v2(p_search text DEFAULT '',p_ids bigint[] DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT id,id AS cafe_id,name,address,postcode,description,image_url,latitude,longitude,time_open,link,phone_number,email,social_media,amenities,rating,show_details,chain_id,(SELECT images_url FROM public."CafeImages" WHERE cafe_id=public."Cafe".id) AS images_url,(SELECT coalesce(jsonb_agg(m),'[]') FROM public."CafeMenu" m WHERE cafe_id=public."Cafe".id) AS menu,(reward_code IS NOT NULL AND reward_code<>'') AS has_reward FROM public."Cafe" WHERE is_active IS TRUE AND (p_ids IS NULL OR id=ANY(p_ids)) AND (p_search='' OR name ILIKE '%'||left(p_search,100)||'%' OR address ILIKE '%'||left(p_search,100)||'%') ORDER BY name,id LIMIT 200) x
$$;
CREATE FUNCTION public.get_closest_cafes_v2(user_lat double precision,user_long double precision,search_term text DEFAULT '',max_results integer DEFAULT 100,has_reward boolean DEFAULT false,amenity_ids text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x),'[]') FROM (
 SELECT v.id,v.name,v.address,v.image_url,v.description,v.phone_number,v.email,v.social_media,v.amenities,v.rating,v.time_open,v.link,v.show_details,v.latitude,v.longitude,v.distance_meters,v.images_url,(v.reward_code IS NOT NULL AND v.reward_code<>'') AS has_reward
 FROM public.get_closest_cafes(user_lat,user_long,search_term,least(greatest(max_results,1),200),has_reward,amenity_ids) v JOIN public."Cafe" c ON c.id=v.id WHERE c.is_active IS TRUE ORDER BY v.distance_meters,v.id
 ) x
$$;
CREATE FUNCTION public.reward_available(p_reward uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public."Rewards" WHERE id=p_reward AND status='issued') $$;
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'partner_%' OR p.proname IN ('public_cafes_v2','get_closest_cafes_v2','reward_available')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.partner_role(uuid),public.partner_can_cafe(bigint),public.partner_paid(uuid),public.partner_command(text,jsonb),public.partner_snapshot(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_cafes_v2(text,bigint[]),public.reward_available(uuid),public.get_closest_cafes_v2(double precision,double precision,text,integer,boolean,text[]) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid,text) TO anon,authenticated,service_role;

-- Partner managed images
-- Private, immutable uploads. Only an independent staff review publishes bytes.
CREATE TABLE public.partner_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
 cafe_id bigint REFERENCES public."Cafe"(id),
 uploader uuid NOT NULL REFERENCES auth.users(id),
 mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
 size bigint NOT NULL CHECK (size BETWEEN 1 AND 5242880),
 path text NOT NULL UNIQUE,
 public_path text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','ready','deleting','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 cleanup_error text
);
ALTER TABLE public.partner_changes ADD COLUMN media jsonb NOT NULL DEFAULT '{"cover":null,"gallery":[]}';
CREATE TABLE public.partner_media_publications (
 change_id uuid PRIMARY KEY REFERENCES public.partner_changes(id),
 reviewer uuid NOT NULL REFERENCES auth.users(id),
 prepared_payload jsonb NOT NULL,
 prepared_media jsonb NOT NULL,
 prepared_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
CREATE INDEX partner_media_chain_idx ON public.partner_media(chain_id,cafe_id);
CREATE INDEX partner_media_cafe_idx ON public.partner_media(cafe_id);
CREATE INDEX partner_media_uploader_idx ON public.partner_media(uploader);
CREATE INDEX partner_media_reviewer_idx ON public.partner_media_publications(reviewer);
ALTER TABLE public.partner_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_media_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_media,public.partner_media_publications FROM anon,authenticated;
GRANT SELECT ON public.partner_media,public.partner_media_publications TO authenticated;
GRANT ALL ON public.partner_media,public.partner_media_publications TO service_role;

CREATE FUNCTION public.partner_media_scope(cid uuid, cafe bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.partner_role(cid) IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.partner_accounts WHERE chain_id=cid AND selection_required)
 AND CASE WHEN cafe IS NULL THEN public.partner_role(cid) IN ('owner','chain_manager')
 ELSE EXISTS(SELECT 1 FROM public."Cafe" WHERE id=cafe AND chain_id=cid) AND public.partner_can_cafe(cafe) END
$$;
CREATE FUNCTION public.partner_media_read(asset uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.partner_media m WHERE m.id=asset AND m.state='ready' AND
 (public.is_staff() OR (public.partner_media_scope(m.chain_id,m.cafe_id) AND
 (m.uploader=auth.uid() OR EXISTS(SELECT 1 FROM public.partner_changes c WHERE c.chain_id=m.chain_id
 AND (c.cafe_id IS NULL OR public.partner_can_cafe(c.cafe_id))
 AND (c.media->>'cover'=m.id::text OR c.media->'gallery' ? m.id::text))))))
$$;
CREATE POLICY partner_media_select ON public.partner_media FOR SELECT TO authenticated
 USING (public.is_staff() OR public.partner_media_read(id) OR (state='reserved' AND uploader=(select auth.uid()) AND public.partner_media_scope(chain_id,cafe_id)));
CREATE POLICY partner_media_publications_select ON public.partner_media_publications FOR SELECT TO authenticated
 USING (public.is_staff());
-- Begin partner draft storage setup
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('partner-drafts','partner-drafts',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY partner_draft_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='partner-drafts' AND (public.is_admin() OR EXISTS(SELECT 1 FROM public.partner_media m WHERE m.path=name AND public.partner_media_read(m.id))));
CREATE POLICY partner_draft_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='partner-drafts' AND EXISTS(SELECT 1 FROM public.partner_media m WHERE m.path=name
 AND m.uploader=auth.uid() AND m.state='reserved' AND public.partner_media_scope(m.chain_id,m.cafe_id)));
-- No partner UPDATE/DELETE: reviewed bytes cannot be replaced. Keep public-media admin-only deletion.
CREATE POLICY partner_draft_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='partner-drafts' AND public.is_admin());
-- End partner draft storage setup

CREATE FUNCTION public.partner_media_reserve(p_chain uuid,p_cafe bigint,p_mime text,p_size bigint) RETURNS public.partner_media
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.partner_media; ext text;
BEGIN
 PERFORM 1 FROM public.partner_accounts WHERE chain_id=p_chain FOR UPDATE;
 IF NOT public.partner_media_scope(p_chain,p_cafe) THEN RAISE EXCEPTION 'Current cafe access required' USING ERRCODE='42501'; END IF;
 -- Bound abandoned uploads per actor without inventing an automatic retention policy.
 IF (SELECT count(*) FROM public.partner_media WHERE uploader=auth.uid() AND state='reserved')>=50 THEN
 RAISE EXCEPTION 'Too many unfinished uploads. Ask staff to clean up abandoned uploads.'; END IF;
 ext=CASE p_mime WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
 m.id=gen_random_uuid();
 INSERT INTO public.partner_media(id,chain_id,cafe_id,uploader,mime,size,path,public_path)
 VALUES(m.id,p_chain,p_cafe,auth.uid(),p_mime,p_size,p_chain::text||'/'||m.id::text||'.'||ext,'cafes/partner/'||p_chain::text||'/'||m.id::text||'.'||ext) RETURNING * INTO m;
 RETURN m;
END $$;
CREATE FUNCTION public.partner_media_ready(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.partner_media;
BEGIN
 SELECT * INTO m FROM public.partner_media WHERE id=p_id;
 PERFORM 1 FROM public.partner_accounts WHERE chain_id=m.chain_id FOR UPDATE;
 SELECT * INTO m FROM public.partner_media WHERE id=p_id FOR UPDATE;
 IF m.uploader IS DISTINCT FROM auth.uid() OR NOT public.partner_media_scope(m.chain_id,m.cafe_id) OR m.state NOT IN ('reserved','ready') THEN RAISE EXCEPTION 'Upload unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE bucket_id='partner-drafts' AND name=m.path
 AND (to_jsonb(o)->'metadata'->>'size')::bigint=m.size AND to_jsonb(o)->'metadata'->>'mimetype'=m.mime) THEN RAISE EXCEPTION 'Upload has not completed or file metadata differs'; END IF;
 UPDATE public.partner_media SET state='ready' WHERE id=p_id;
END $$;

CREATE FUNCTION public.partner_media_prepare(p_change uuid) RETURNS SETOF public.partner_media
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ch public.partner_changes;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'Staff reviewer required' USING ERRCODE='42501'; END IF;
 SELECT * INTO ch FROM public.partner_changes WHERE id=p_change;
 PERFORM 1 FROM public.partner_accounts WHERE chain_id=ch.chain_id FOR UPDATE;
 SELECT * INTO ch FROM public.partner_changes WHERE id=p_change FOR UPDATE;
 IF ch.status='approved' AND ch.reviewer=auth.uid() THEN RETURN; END IF;
 IF ch.id IS NULL OR ch.status<>'pending' OR ch.submitter=auth.uid() THEN RAISE EXCEPTION 'Another staff reviewer must review a pending request'; END IF;
 IF ch.cafe_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."Cafe" c JOIN public.partner_cafe_access a ON a.cafe_id=c.id
 WHERE c.id=ch.cafe_id AND c.partner_revision=ch.baseline AND NOT a.restricted) THEN RAISE EXCEPTION 'Conflict or restricted cafe. Resubmit against the current revision.'; END IF;
 IF EXISTS(SELECT 1 FROM public.partner_accounts WHERE chain_id=ch.chain_id AND selection_required) THEN RAISE EXCEPTION 'Cafe selection required'; END IF;
 INSERT INTO public.partner_media_publications(change_id,reviewer,prepared_payload,prepared_media)
 VALUES(ch.id,auth.uid(),ch.payload,ch.media) ON CONFLICT(change_id) DO UPDATE SET reviewer=excluded.reviewer,prepared_payload=excluded.prepared_payload,prepared_media=excluded.prepared_media,prepared_at=now();
 INSERT INTO public.partner_audit(chain_id,actor,action,details) VALUES(ch.chain_id,auth.uid(),'prepare_media_publication',jsonb_build_object('id',ch.id,'media',ch.media));
 RETURN QUERY SELECT m.* FROM public.partner_media m WHERE m.id::text=ch.media->>'cover' OR ch.media->'gallery' ? m.id::text;
END $$;

-- Decode once, like the application's cleanup scanner, before comparing a
-- generated object path. Query strings and encoded UUID characters are aliases.
CREATE FUNCTION public.partner_media_url(p_url text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE raw text=split_part(split_part(p_url,'?',1),'#',1); output bytea=''::bytea; i int=1; ch text;
BEGIN
 IF length(raw)>8192 THEN RAISE EXCEPTION 'Image URL is too long'; END IF;
 WHILE i<=length(raw) LOOP
  ch=substr(raw,i,1);
  IF ch='%' AND substr(raw,i+1,2)~'^[a-fA-F0-9]{2}$' THEN output=output||decode(substr(raw,i+1,2),'hex'); i=i+3;
  ELSE output=output||convert_to(ch,'UTF8'); i=i+1; END IF;
 END LOOP;
 RETURN convert_from(output,'UTF8');
EXCEPTION WHEN character_not_in_repertoire OR untranslatable_character THEN RETURN raw;
END $$;
REVOKE ALL ON FUNCTION public.partner_media_url(text) FROM PUBLIC,anon,authenticated;

-- Keep the original command's permission, conflict, slot and idempotency checks.
ALTER FUNCTION public.partner_command(text,jsonb) RENAME TO partner_command_core;
REVOKE ALL ON FUNCTION public.partner_command_core(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.partner_command(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE output jsonb; manifest jsonb=coalesce(p_input->'media','{"cover":null,"gallery":[]}'::jsonb); asset text;
 ch public.partner_changes; m public.partner_media; job public.partner_media_publications; combined jsonb; origin text;
BEGIN
 IF auth.uid() IS NULL OR p_input->>'request_id' IS NULL THEN RAISE EXCEPTION 'Authenticated request required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||(p_input->>'request_id')::uuid::text,0));
 IF EXISTS(SELECT 1 FROM public.partner_operations WHERE actor=auth.uid() AND request_id=(p_input->>'request_id')::uuid) THEN
 RETURN public.partner_command_core(p_action,p_input); END IF;
 PERFORM 1 FROM public.partner_accounts WHERE chain_id=nullif(p_input->>'chain_id','')::uuid FOR UPDATE;
 IF p_action IN ('save_change','submit_change') THEN
  IF jsonb_typeof(manifest)<>'object' OR (manifest-'cover'-'gallery')<>'{}' OR jsonb_typeof(manifest->'gallery') IS DISTINCT FROM 'array'
  OR jsonb_array_length(manifest->'gallery')>50 OR jsonb_typeof(manifest->'cover') NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid uploaded image selection'; END IF;
  IF jsonb_array_length(coalesce(p_input->'payload'->'gallery','[]'))+jsonb_array_length(manifest->'gallery')>50 THEN RAISE EXCEPTION 'Gallery is limited to 50 images'; END IF;
  -- A URL can refer to a previously published upload as well. Serialize those
  -- references with cleanup claims, including copies shared by another cafe.
  FOR m IN SELECT pm.* FROM public.partner_media pm WHERE EXISTS(
   SELECT 1 FROM (SELECT p_input->'payload'->>'image_url' AS url UNION ALL SELECT jsonb_array_elements_text(p_input->'payload'->'gallery')) u
   WHERE public.partner_media_url(u.url) LIKE '%/storage/v1/object/public/media/'||pm.public_path) ORDER BY pm.id FOR UPDATE LOOP
   IF m.state<>'ready' THEN RAISE EXCEPTION 'A selected image is being removed. Choose another image.'; END IF;
  END LOOP;
  FOR asset IN SELECT jsonb_array_elements_text(manifest->'gallery') UNION SELECT manifest->>'cover' LOOP
   IF asset IS NULL THEN CONTINUE; END IF;
   SELECT * INTO m FROM public.partner_media WHERE id=asset::uuid FOR UPDATE;
   IF m.id IS NULL OR m.chain_id IS DISTINCT FROM (p_input->>'chain_id')::uuid OR m.cafe_id IS DISTINCT FROM nullif(p_input->>'cafe_id','')::bigint
   OR m.state<>'ready' OR NOT public.partner_media_read(m.id) THEN RAISE EXCEPTION 'Uploaded image unavailable for this cafe'; END IF;
  END LOOP;
  output=public.partner_command_core(p_action,p_input);
  UPDATE public.partner_changes SET media=manifest WHERE id=(output->>'id')::uuid;
  RETURN output;
 ELSIF p_action='review' AND p_input->>'decision'='approve' THEN
  SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid FOR UPDATE;
  IF ch.media->>'cover' IS NOT NULL OR jsonb_array_length(ch.media->'gallery')>0 THEN
   SELECT * INTO job FROM public.partner_media_publications WHERE change_id=ch.id;
   IF job.reviewer IS DISTINCT FROM auth.uid() OR job.prepared_payload IS DISTINCT FROM ch.payload OR job.prepared_media IS DISTINCT FROM ch.media THEN RAISE EXCEPTION 'Prepare reviewed images before approval'; END IF;
   origin=p_input->>'media_origin';
   IF origin IS NULL OR origin!~'^https?://[a-zA-Z0-9.:-]+$' THEN RAISE EXCEPTION 'Invalid media origin'; END IF;
   combined=ch.payload;
   FOR asset IN SELECT jsonb_array_elements_text(ch.media->'gallery') UNION SELECT ch.media->>'cover' LOOP
    IF asset IS NULL THEN CONTINUE; END IF;
    SELECT * INTO m FROM public.partner_media WHERE id=asset::uuid AND state='ready' FOR UPDATE;
    IF m.id IS NULL OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='media' AND name=m.public_path) THEN RAISE EXCEPTION 'Image publication incomplete. Retry approval.'; END IF;
   END LOOP;
   IF ch.media->>'cover' IS NOT NULL THEN
    SELECT * INTO m FROM public.partner_media WHERE id=(ch.media->>'cover')::uuid;
    combined=jsonb_set(combined,'{image_url}',to_jsonb(origin||'/storage/v1/object/public/media/'||m.public_path));
   END IF;
   combined=jsonb_set(combined,'{gallery}',coalesce(combined->'gallery','[]')||coalesce((SELECT jsonb_agg(origin||'/storage/v1/object/public/media/'||pm.public_path ORDER BY x.ord)
   FROM jsonb_array_elements_text(ch.media->'gallery') WITH ORDINALITY x(id,ord) JOIN public.partner_media pm ON pm.id=x.id::uuid),'[]'));
   UPDATE public.partner_changes SET payload=combined WHERE id=ch.id;
   output=public.partner_command_core(p_action,p_input);
   UPDATE public.partner_media_publications SET completed_at=now() WHERE change_id=ch.id;
   RETURN output;
  END IF;
 END IF;
 RETURN public.partner_command_core(p_action,p_input);
END $$;

-- Legacy admin cleanup must keep draft URLs and all registered assets. The media
-- cleanup command explicitly claims an unreferenced asset before deleting bytes.
CREATE FUNCTION public.partner_protected_image_paths() RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'Staff required'; END IF;
 RETURN ARRAY(SELECT public_path FROM public.partner_media WHERE state NOT IN ('deleting','deleted')) ||
 ARRAY(SELECT url FROM public.partner_changes c CROSS JOIN LATERAL
 (SELECT c.payload->>'image_url' AS url UNION ALL SELECT jsonb_array_elements_text(c.payload->'gallery')) x WHERE c.status IN ('draft','pending') AND url IS NOT NULL);
END $$;
CREATE FUNCTION public.partner_media_cleanup(p_id uuid,p_result text DEFAULT NULL) RETURNS public.partner_media
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.partner_media;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 SELECT * INTO m FROM public.partner_media WHERE id=p_id;
 PERFORM 1 FROM public.partner_accounts WHERE chain_id=m.chain_id FOR UPDATE;
 SELECT * INTO m FROM public.partner_media WHERE id=p_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Upload unavailable'; END IF;
 IF p_result IS NOT NULL THEN
  IF m.state<>'deleting' THEN RAISE EXCEPTION 'Claim cleanup first'; END IF;
  UPDATE public.partner_media SET state=CASE WHEN p_result='deleted' THEN 'deleted' ELSE 'deleting' END,cleanup_error=CASE WHEN p_result='deleted' THEN NULL ELSE left(p_result,500) END WHERE id=p_id RETURNING * INTO m;
  RETURN m;
 END IF;
 IF EXISTS(SELECT 1 FROM public.partner_changes c WHERE c.status IN ('draft','pending') AND
 (c.media->>'cover'=m.id::text OR c.media->'gallery' ? m.id::text)) THEN RAISE EXCEPTION 'Image is referenced by a draft or pending request'; END IF;
 IF EXISTS(SELECT 1 FROM public.partner_changes c CROSS JOIN LATERAL
 (SELECT c.payload->>'image_url' AS url UNION ALL SELECT jsonb_array_elements_text(c.payload->'gallery')) u
 WHERE c.status IN ('draft','pending') AND public.partner_media_url(u.url) LIKE '%/storage/v1/object/public/media/'||m.public_path)
 THEN RAISE EXCEPTION 'Image URL is referenced by a draft or pending request'; END IF;
 IF EXISTS(SELECT 1 FROM public."Cafe" c WHERE public.partner_media_url(c.image_url) LIKE '%/storage/v1/object/public/media/'||m.public_path)
 OR EXISTS(SELECT 1 FROM public."CafeImages" c CROSS JOIN LATERAL unnest(c.images_url) u(url) WHERE public.partner_media_url(u.url) LIKE '%/storage/v1/object/public/media/'||m.public_path)
 THEN RAISE EXCEPTION 'Image is referenced by a live cafe'; END IF;
 UPDATE public.partner_media SET state='deleting',cleanup_error=NULL WHERE id=p_id RETURNING * INTO m;
 RETURN m;
END $$;

REVOKE ALL ON FUNCTION public.partner_media_scope(uuid,bigint),public.partner_media_read(uuid),public.partner_media_reserve(uuid,bigint,text,bigint),public.partner_media_ready(uuid),public.partner_media_prepare(uuid),public.partner_command(text,jsonb),public.partner_protected_image_paths(),public.partner_media_cleanup(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.partner_media_scope(uuid,bigint),public.partner_media_read(uuid),public.partner_media_reserve(uuid,bigint,text,bigint),public.partner_media_ready(uuid),public.partner_media_prepare(uuid),public.partner_command(text,jsonb),public.partner_protected_image_paths(),public.partner_media_cleanup(uuid,text) TO authenticated;

-- Partner dashboard insights
-- Aggregate the complete authorized history, independent of the UI's activity page limit.
CREATE FUNCTION public.partner_insights() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; acc public.partner_accounts; weeks jsonb; rates jsonb='[]';
BEGIN
 SELECT chain_id INTO cid FROM public.partner_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL;
 IF auth.uid() IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Current partner access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid;
 WITH bins AS (SELECT generate_series(date_trunc('week',now() AT TIME ZONE acc.timezone)-interval '7 weeks',date_trunc('week',now() AT TIME ZONE acc.timezone),interval '1 week') AS start),
 counts AS (SELECT date_trunc('week',r.redeemed_at AT TIME ZONE acc.timezone) AS start,count(*) AS total
 FROM public."Rewards" r WHERE r.chain_id=cid AND r.status='redeemed' AND r.redeemed_at>=acc.reward_coverage_at AND r.redeemed_at<=now()
 AND r.redeemed_at>=(date_trunc('week',now() AT TIME ZONE acc.timezone)-interval '7 weeks') AT TIME ZONE acc.timezone
 AND public.partner_can_cafe(r.redeemed_cafe_id) GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('week',b.start::date,'covered',b.start+interval '1 week'>acc.reward_coverage_at AT TIME ZONE acc.timezone,'total',coalesce(c.total,0),'partial',b.start=date_trunc('week',now() AT TIME ZONE acc.timezone) OR b.start<acc.reward_coverage_at AT TIME ZONE acc.timezone) ORDER BY b.start)
 INTO weeks FROM bins b LEFT JOIN counts c USING(start);
 IF acc.plan='paid' THEN
 WITH history AS (SELECT i.id,i.balance,least(28::numeric,extract(epoch FROM now()-min(m.created_at))/86400) AS days,
 coalesce(sum(-m.quantity) FILTER(WHERE m.type IN ('consumption','wastage') AND m.quantity<0 AND m.created_at>=now()-interval '28 days'),0) AS used
 FROM public.partner_items i LEFT JOIN public.partner_movements m ON m.item_id=i.id AND m.created_at<=now()
 WHERE i.chain_id=cid AND public.partner_can_cafe(i.cafe_id) GROUP BY i.id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('item_id',id,'observed_days',coalesce(days,0),'used',used,'daily_usage',CASE WHEN days>=1 THEN used/days END,'days_left',CASE WHEN days>=1 AND used>0 THEN balance/(used/days) END)),'[]') INTO rates FROM history;
 END IF;
 RETURN jsonb_build_object('weekly_rewards',weeks,'stock_rates',rates,'timezone',acc.timezone,'refreshed_at',now());
END $$;
REVOKE ALL ON FUNCTION public.partner_insights() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.partner_insights() TO authenticated;

-- Partner cafe field options
CREATE FUNCTION public.partner_validate_cafe_selections() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Pending requests already in review retain their original payload.
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.payload ? 'rating' THEN
    RAISE EXCEPTION 'Partners cannot propose café rating changes' USING ERRCODE = '22023';
  END IF;

  -- Keep these IDs aligned with the mobile amenity catalog and partner form.
  IF NEW.payload ? 'amenities' AND (
    jsonb_typeof(NEW.payload->'amenities') IS DISTINCT FROM 'array'
    OR NOT (
      (NEW.payload->'amenities') <@
      '["wifi", "sitting_area", "work_station", "delivery_service", "disability_access"]'::jsonb
    )
  ) THEN
    RAISE EXCEPTION 'Choose from the available café amenities' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_validate_cafe_selections() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER partner_cafe_selection_rules
BEFORE INSERT OR UPDATE OF payload ON public.partner_changes
FOR EACH ROW
EXECUTE FUNCTION public.partner_validate_cafe_selections();

-- Partner edit stock threshold
-- Extend the item command with independent threshold and status updates.
-- The managed media wrapper continues to delegate to this private function.
CREATE OR REPLACE FUNCTION public.partner_command_core(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<cmd>>
DECLARE uid uuid=auth.uid(); cid uuid; role_name text; req uuid=(p_input->>'request_id')::uuid; oldop public.partner_operations;
 acc public.partner_accounts; ch public.partner_changes; c public."Cafe"; it public.partner_items; inv public.partner_invitations;
 payload jsonb; elem jsonb; output jsonb='{}'; target text; token text; n numeric; delta numeric; item_id uuid; ids bigint[]; member public.partner_memberships;
BEGIN
 IF uid IS NULL OR req IS NULL THEN RAISE EXCEPTION 'Authenticated user and request ID required' USING ERRCODE='42501'; END IF;
 -- Serialize retries before checking state that the first successful request changed.
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||req::text,0));
 SELECT * INTO oldop FROM public.partner_operations WHERE actor=uid AND request_id=req;
 IF FOUND THEN
  IF oldop.action<>p_action OR oldop.input<>p_input THEN RAISE EXCEPTION 'Request ID was reused with different data'; END IF;
  -- A retry must satisfy CURRENT access; retained receipts are not a read bypass.
  IF p_action IN ('review','activate_plan','provision') THEN
   IF NOT public.is_staff() OR (p_action<>'review' AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Current staff access required' USING ERRCODE='42501'; END IF;
  ELSE
   cid=nullif(p_input->>'chain_id','')::uuid;
   IF p_action='accept_invite' THEN SELECT chain_id INTO cid FROM public.partner_memberships WHERE user_id=uid AND revoked_at IS NULL; END IF;
   IF public.partner_role(cid) IS NULL THEN RAISE EXCEPTION 'Current partner access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('item','movement','recipe') AND NOT public.partner_paid(cid) THEN RAISE EXCEPTION 'Current Paid access required' USING ERRCODE='42501'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL AND NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Current cafe access required' USING ERRCODE='42501'; END IF;
   IF p_action='movement' AND NOT EXISTS(SELECT 1 FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND public.partner_can_cafe(cafe_id)) THEN RAISE EXCEPTION 'Current item access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('invite','revoke_member','revoke_invite','select_cafes','settings') AND public.partner_role(cid)<>'owner' THEN RAISE EXCEPTION 'Current Owner access required'; END IF;
  END IF;
  RETURN oldop.result;
 END IF;
 IF p_action='accept_invite' THEN
  SELECT * INTO inv FROM public.partner_invitations WHERE token_hash=encode(extensions.digest(p_input->>'token','sha256'),'hex') FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at<=now() OR inv.email<>(SELECT lower(email) FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Invitation unavailable for this account'; END IF;
  cid=inv.chain_id;
 ELSE cid=nullif(p_input->>'chain_id','')::uuid; END IF;
 IF p_action='provision' THEN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_input->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Chain name required'; END IF;
  IF cid IS NULL THEN INSERT INTO public."Chains"(name) VALUES(p_input->>'name') RETURNING id INTO cid; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(p_input->>'owner_id')::uuid) THEN RAISE EXCEPTION 'Owner must have an existing verified account'; END IF;
  INSERT INTO public.partner_accounts(chain_id) VALUES(cid);
  INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,(p_input->>'owner_id')::uuid,'owner');
  INSERT INTO public.partner_cafe_access(cafe_id,chain_id) SELECT id,cid FROM public."Cafe" WHERE chain_id=cid;
  UPDATE public.partner_accounts SET selection_required=(SELECT count(*)>3 FROM public."Cafe" WHERE chain_id=cid AND is_active IS TRUE) WHERE chain_id=cid;
  output=jsonb_build_object('chain_id',cid);
 ELSE
  SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partner unavailable'; END IF;
  role_name=public.partner_role(cid);
  IF p_action NOT IN ('review','activate_plan','accept_invite') AND role_name IS NULL THEN RAISE EXCEPTION 'Partner access denied' USING ERRCODE='42501'; END IF;
  CASE p_action
  WHEN 'accept_invite' THEN
   INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,uid,inv.role) RETURNING * INTO member;
   INSERT INTO public.partner_assignments(membership_id,chain_id,cafe_id) SELECT member.id,cid,unnest(inv.cafe_ids);
   UPDATE public.partner_invitations SET accepted_at=now() WHERE id=inv.id;
  WHEN 'save_change','submit_change' THEN
   IF acc.selection_required THEN RAISE EXCEPTION 'Owner must select accessible cafes first'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL THEN
    IF NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
    SELECT * INTO c FROM public."Cafe" WHERE id=(p_input->>'cafe_id')::bigint;
   ELSIF role_name='cafe_manager' THEN RAISE EXCEPTION 'Chain manager required to create cafes'; END IF;
   payload=p_input->'payload'; PERFORM public.partner_validate_cafe(payload);
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_changes(chain_id,cafe_id,baseline,payload,status,submitter)
    VALUES(cid,c.id,(p_input->>'baseline')::bigint,payload,CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END,uid) RETURNING * INTO ch;
   ELSE
    SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
    IF NOT FOUND OR ch.status<>'draft' OR ch.submitter<>uid OR ch.cafe_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Draft unavailable'; END IF;
    UPDATE public.partner_changes SET payload=cmd.payload,baseline=(p_input->>'baseline')::bigint,status=CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END WHERE id=ch.id RETURNING * INTO ch;
   END IF;
   output=jsonb_build_object('id',ch.id);
  WHEN 'review' THEN
   IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff reviewer required' USING ERRCODE='42501'; END IF;
   SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR ch.status<>'pending' OR ch.submitter=uid THEN RAISE EXCEPTION 'Another staff reviewer must review a pending request'; END IF;
   IF p_input->>'decision'='reject' THEN
    IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
    UPDATE public.partner_changes SET status='rejected',reviewer=uid,reason=p_input->>'reason',reviewed_at=now() WHERE id=ch.id;
   ELSIF p_input->>'decision'='approve' THEN
    payload=ch.payload; PERFORM public.partner_validate_cafe(payload);
    IF ch.cafe_id IS NOT NULL THEN
     SELECT * INTO c FROM public."Cafe" WHERE id=ch.cafe_id AND chain_id=cid FOR UPDATE;
     IF c.partner_revision IS DISTINCT FROM ch.baseline THEN RAISE EXCEPTION 'Conflict: approved cafe changed. Resubmit against the current revision.'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.partner_cafe_access WHERE cafe_id=c.id AND NOT restricted) OR acc.selection_required THEN RAISE EXCEPTION 'Cafe is subscription restricted'; END IF;
    ELSE c.chain_id=cid; c.is_active=true; c.show_details=false; END IF;
    c=jsonb_populate_record(c,payload-'gallery'-'menu');
    IF ch.cafe_id IS NULL THEN
     INSERT INTO public."Cafe"(chain_id,name,address,postcode,description,image_url,latitude,longitude,time_open,phone_number,email,link,social_media,amenities,rating,is_active,show_details,loyalty_threshold_override,reward_code)
     VALUES(cid,c.name,c.address,c.postcode,c.description,c.image_url,c.latitude,c.longitude,c.time_open,c.phone_number,c.email,c.link,c.social_media,c.amenities,c.rating,c.is_active,c.show_details,c.loyalty_threshold_override,nullif(btrim(c.reward_code),'')) RETURNING * INTO c;
     INSERT INTO public.partner_cafe_access(cafe_id,chain_id) VALUES(c.id,cid) ON CONFLICT(cafe_id) DO NOTHING;
    ELSE
     UPDATE public."Cafe" SET name=c.name,address=c.address,postcode=c.postcode,description=c.description,image_url=c.image_url,latitude=c.latitude,longitude=c.longitude,time_open=c.time_open,phone_number=c.phone_number,email=c.email,link=c.link,social_media=c.social_media,amenities=c.amenities,rating=c.rating,is_active=c.is_active,show_details=c.show_details,loyalty_threshold_override=c.loyalty_threshold_override,reward_code=nullif(btrim(c.reward_code),'') WHERE id=c.id;
    END IF;
    IF payload ? 'gallery' THEN INSERT INTO public."CafeImages"(cafe_id,images_url) VALUES(c.id,ARRAY(SELECT jsonb_array_elements_text(payload->'gallery'))) ON CONFLICT(cafe_id) DO UPDATE SET images_url=excluded.images_url; END IF;
    IF payload ? 'menu' THEN
     DELETE FROM public."CafeMenu" WHERE cafe_id=c.id;
     FOR elem IN SELECT * FROM jsonb_array_elements(payload->'menu') LOOP
      INSERT INTO public."CafeMenu"(cafe_id,name,price,currency,description) VALUES(c.id,elem->>'name',(elem->>'price')::bigint,elem->>'currency',elem->>'description');
     END LOOP;
    END IF;
    UPDATE public.partner_changes SET status='approved',cafe_id=c.id,reviewer=uid,reviewed_at=now() WHERE id=ch.id;
   ELSE RAISE EXCEPTION 'Invalid review decision'; END IF;
  WHEN 'item' THEN
   IF acc.plan<>'paid' OR NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN
    RAISE EXCEPTION 'Paid cafe access required' USING ERRCODE='42501';
   END IF;
   n=(p_input->>'threshold')::numeric;
   IF n::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Finite stock threshold required';
   END IF;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_items(chain_id,cafe_id,name,code,type,unit,threshold)
    VALUES(cid,(p_input->>'cafe_id')::bigint,p_input->>'name',p_input->>'code',p_input->>'type',p_input->>'unit',coalesce(n,0))
    RETURNING id INTO item_id;
   ELSE
    IF n<0 OR n>=1000000000000 OR n<>trunc(n,6) THEN
     RAISE EXCEPTION 'Use a nonnegative low-stock threshold below one trillion with up to six decimal places';
    END IF;
    IF n IS NULL AND p_input->>'active' IS NULL THEN
     RAISE EXCEPTION 'Provide a low-stock threshold or item status';
    END IF;
    UPDATE public.partner_items
    SET active=coalesce((p_input->>'active')::boolean,active),
        threshold=coalesce(n,threshold)
    WHERE id=(p_input->>'id')::uuid AND cafe_id=(p_input->>'cafe_id')::bigint AND chain_id=cid
    RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id);
  WHEN 'movement' THEN
   SELECT * INTO it FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR NOT it.active OR acc.plan<>'paid' OR NOT public.partner_can_cafe(it.cafe_id) THEN RAISE EXCEPTION 'Paid item access required' USING ERRCODE='42501'; END IF;
   IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Movement reason required'; END IF;
   n=(p_input->>'quantity')::numeric;
   IF n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR n<0 OR scale(n)>6 THEN RAISE EXCEPTION 'Use a nonnegative quantity with at most six decimals'; END IF;
   IF n=0 AND p_input->>'type'<>'count' THEN RAISE EXCEPTION 'Movement quantity must be positive'; END IF;
   CASE p_input->>'type'
    WHEN 'count' THEN delta=n-it.balance;
    WHEN 'receipt','opening' THEN delta=n;
    WHEN 'consumption','wastage' THEN delta=-n;
    WHEN 'correction' THEN IF p_input->>'direction'='subtract' THEN delta=-n; ELSE delta=n; END IF;
    ELSE RAISE EXCEPTION 'Invalid movement type';
   END CASE;
   IF it.balance+delta<0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
   UPDATE public.partner_items SET balance=balance+delta WHERE id=it.id RETURNING balance INTO n;
   INSERT INTO public.partner_movements(chain_id,item_id,cafe_id,quantity,resulting_balance,type,actor,reason) VALUES(cid,it.id,it.cafe_id,delta,n,p_input->>'type',uid,p_input->>'reason');
   output=jsonb_build_object('balance',n);
  WHEN 'recipe' THEN
   IF (p_input->>'yield') IS NULL OR (p_input->>'yield')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite positive recipe yield required'; END IF;
   IF acc.plan<>'paid' OR role_name NOT IN ('owner','chain_manager') THEN RAISE EXCEPTION 'Paid chain manager required' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(p_input->'ingredients') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'ingredients')<1 THEN RAISE EXCEPTION 'Recipe requires ingredients'; END IF;
   FOR elem IN SELECT * FROM jsonb_array_elements(p_input->'ingredients') LOOP
    SELECT * INTO it FROM public.partner_items WHERE id=(elem->>'item_id')::uuid AND chain_id=cid AND type='ingredient';
    IF NOT FOUND OR (elem->>'quantity')::numeric<=0 OR (elem->>'quantity') IS NULL OR (elem->>'quantity')::numeric::text IN ('NaN','Infinity','-Infinity') OR (elem->>'unit') IS DISTINCT FROM it.unit THEN RAISE EXCEPTION 'Invalid ingredient, quantity or unit'; END IF;
   END LOOP;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_recipes(chain_id,name,yield,ingredients) VALUES(cid,p_input->>'name',(p_input->>'yield')::numeric,p_input->'ingredients') RETURNING id INTO item_id;
   ELSE
    UPDATE public.partner_recipes SET name=p_input->>'name',yield=(p_input->>'yield')::numeric,ingredients=p_input->'ingredients',active=coalesce((p_input->>'active')::boolean,true),revision=revision+1,updated_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND revision=(p_input->>'revision')::bigint RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Recipe changed or unavailable; reload before saving'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id,'revision',(SELECT revision FROM public.partner_recipes WHERE id=item_id));
  WHEN 'invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT public.partner_can_cafe(i)) THEN RAISE EXCEPTION 'Invitation cafe scope denied'; END IF;
   token=gen_random_uuid()::text||gen_random_uuid()::text;
   INSERT INTO public.partner_invitations(chain_id,email,role,cafe_ids,token_hash) VALUES(cid,lower(btrim(p_input->>'email')),p_input->>'role',ids,encode(extensions.digest(token,'sha256'),'hex'));
   output=jsonb_build_object('token',token);
  WHEN 'revoke_member' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_memberships SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND role<>'owner';
   IF NOT FOUND THEN RAISE EXCEPTION 'Manager unavailable; Owner transfer requires staff'; END IF;
  WHEN 'revoke_invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_invitations SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND accepted_at IS NULL;
  WHEN 'settings' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_input->>'timezone') THEN RAISE EXCEPTION 'Invalid IANA timezone'; END IF;
   UPDATE public.partner_accounts SET timezone=p_input->>'timezone' WHERE chain_id=cid;
  WHEN 'select_cafes','activate_plan' THEN
   IF p_action='activate_plan' THEN
    IF NOT public.is_admin() OR nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Admin and activation record/reason required' USING ERRCODE='42501'; END IF;
    IF p_input->>'plan' NOT IN ('free','paid') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
    UPDATE public.partner_accounts SET plan=p_input->>'plan' WHERE chain_id=cid RETURNING * INTO acc;
   ELSIF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT EXISTS(SELECT 1 FROM public."Cafe" WHERE id=i AND chain_id=cid)) THEN RAISE EXCEPTION 'Cafe selection outside chain'; END IF;
   IF acc.plan='free' AND (SELECT count(*) FROM public."Cafe" WHERE id=ANY(ids) AND is_active IS TRUE)>3 THEN RAISE EXCEPTION 'Select at most three active cafes'; END IF;
   IF acc.plan='paid' THEN UPDATE public.partner_cafe_access SET restricted=false WHERE chain_id=cid;
   ELSE UPDATE public.partner_cafe_access SET restricted=NOT(cafe_id=ANY(ids)) WHERE chain_id=cid; END IF;
   UPDATE public.partner_accounts SET selection_required=false WHERE chain_id=cid;
  ELSE RAISE EXCEPTION 'Unknown partner action';
  END CASE;
 END IF;
 INSERT INTO public.partner_audit(chain_id,actor,action,target,details) VALUES(cid,uid,p_action,coalesce(p_input->>'id',output->>'id'),p_input-ARRAY['request_id','token','payload']);
 INSERT INTO public.partner_operations(actor,request_id,action,input,result) VALUES(uid,req,p_action,p_input,output);
 RETURN output;
END $$;

-- Partner recipe stock preview
CREATE FUNCTION public.partner_recipe_stock(p_recipe_id uuid, p_cafe_id bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipe public.partner_recipes;
BEGIN
  IF auth.uid() IS NULL OR NOT public.partner_can_cafe(p_cafe_id) THEN
    RAISE EXCEPTION 'Café access required' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO recipe
  FROM public.partner_recipes r
  JOIN public."Cafe" c ON c.id = p_cafe_id AND c.chain_id = r.chain_id
  WHERE r.id = p_recipe_id AND public.partner_paid(r.chain_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paid recipe access required' USING ERRCODE = '42501';
  END IF;

  -- Source rows supply ingredient identity. Only return balances at the checked café.
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'ingredient_id', ingredient.id,
      'stock_item_id', stock.id,
      'available', stock.balance
    )), '[]'::jsonb)
    FROM (
      SELECT DISTINCT (entry->>'item_id')::uuid AS id
      FROM jsonb_array_elements(recipe.ingredients) AS entry
    ) ingredient
    LEFT JOIN public.partner_items source
      ON source.id = ingredient.id AND source.chain_id = recipe.chain_id
      AND source.type = 'ingredient'
    LEFT JOIN public.partner_items stock
      ON stock.cafe_id = p_cafe_id AND stock.chain_id = recipe.chain_id
      AND stock.code = source.code AND stock.unit = source.unit
      AND stock.type = 'ingredient' AND stock.active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_recipe_stock(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_recipe_stock(uuid, bigint) TO authenticated;

-- Partner discard change
CREATE SCHEMA partner_internal;
REVOKE ALL ON SCHEMA partner_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA partner_internal TO authenticated;

CREATE FUNCTION partner_internal.discard_cafe_change(p_change uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  change_chain uuid;
  change_request public.partner_changes;
  member_role text;
BEGIN
  IF actor_id IS NULL OR p_status IS NULL OR p_status NOT IN ('draft', 'pending') THEN
    RETURN false;
  END IF;

  -- Use the same account-before-request lock order as review and draft saves.
  SELECT account.chain_id INTO change_chain
  FROM public.partner_accounts account
  JOIN public.partner_changes change ON change.chain_id = account.chain_id
  WHERE change.id = p_change AND change.submitter = actor_id
  FOR UPDATE OF account;

  member_role := public.partner_role(change_chain);
  IF member_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO change_request
  FROM public.partner_changes
  WHERE id = p_change AND submitter = actor_id AND status = p_status
    AND (public.partner_can_cafe(cafe_id)
      OR (cafe_id IS NULL AND member_role IN ('owner', 'chain_manager')))
    AND (p_status = 'draft'
      OR (cafe_id IS NOT NULL AND payload->'is_active' = 'false'::jsonb))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- An approval attempt can have prepared images before completing review.
  -- Drop that preparation with the request. Storage cleanup keeps its own
  -- reference checks and authenticated Storage API workflow.
  DELETE FROM public.partner_media_publications WHERE change_id = p_change;
  DELETE FROM public.partner_changes WHERE id = p_change;

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (change_chain, actor_id,
    CASE WHEN p_status = 'draft' THEN 'discard_draft' ELSE 'withdraw_removal' END,
    p_change::text, jsonb_build_object('cafe_id', change_request.cafe_id));

  RETURN true;
END;
$$;

CREATE FUNCTION public.partner_discard_cafe_change(p_change uuid, p_status text)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.discard_cafe_change(p_change, p_status);
$$;

REVOKE ALL ON FUNCTION partner_internal.discard_cafe_change(uuid, text),
  public.partner_discard_cafe_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.discard_cafe_change(uuid, text),
  public.partner_discard_cafe_change(uuid, text) TO authenticated;

-- Partner edit manager access
CREATE OR REPLACE FUNCTION public.partner_team_assignments(p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(membership_id, cafe_ids), '{}'::jsonb)
  FROM (
    SELECT membership_id, array_agg(cafe_id ORDER BY cafe_id) AS cafe_ids
    FROM public.partner_assignments
    WHERE chain_id = p_chain AND public.partner_role(p_chain) = 'owner'
    GROUP BY membership_id
  ) AS assignments;
$$;

CREATE OR REPLACE FUNCTION partner_internal.edit_manager_access(
  p_member uuid,
  p_expected_role text,
  p_expected_cafe_ids bigint[],
  p_role text,
  p_cafe_ids bigint[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  member_chain uuid;
  saved_role text;
  current_ids bigint[];
  expected_ids bigint[];
  new_ids bigint[];
BEGIN
  SELECT chain_id INTO member_chain FROM public.partner_memberships WHERE id = p_member;
  IF actor_id IS NULL OR public.partner_role(member_chain) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the workspace Owner can edit manager access.' USING ERRCODE = '42501';
  END IF;

  -- Serialize with revocation, plan changes, and other partner commands.
  PERFORM 1 FROM public.partner_accounts WHERE chain_id = member_chain FOR UPDATE;
  IF public.partner_role(member_chain) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the workspace Owner can edit manager access.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO saved_role FROM public.partner_memberships
  WHERE id = p_member AND chain_id = member_chain AND revoked_at IS NULL
    AND role IN ('chain_manager', 'cafe_manager')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This manager is no longer available to edit.';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('chain_manager', 'cafe_manager') THEN
    RAISE EXCEPTION 'Choose Chain Manager or Café Manager.';
  END IF;

  SELECT coalesce(array_agg(cafe_id ORDER BY cafe_id), '{}'::bigint[]) INTO current_ids
  FROM public.partner_assignments WHERE membership_id = p_member;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(p_expected_cafe_ids) AS t(id) ORDER BY id)
  INTO expected_ids;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(p_cafe_ids) AS t(id) ORDER BY id)
  INTO new_ids;

  -- An identical retry has already reached the requested state.
  IF saved_role = p_role AND current_ids = new_ids THEN
    RETURN;
  END IF;
  IF saved_role IS DISTINCT FROM p_expected_role OR current_ids <> expected_ids THEN
    RAISE EXCEPTION 'This manager’s access changed. Refresh Team before trying again.';
  END IF;
  IF p_role = 'chain_manager' AND cardinality(new_ids) <> 0 THEN
    RAISE EXCEPTION 'Chain Managers already have access to all available cafés.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(new_ids) AS t(id)
    WHERE id IS NULL OR (NOT (id = ANY(current_ids)) AND NOT public.partner_can_cafe(id))
  ) THEN
    RAISE EXCEPTION 'A selected café is unavailable. Refresh and choose from your workspace cafés.';
  END IF;
  IF p_role = 'cafe_manager' AND NOT EXISTS (
    SELECT 1 FROM unnest(new_ids) AS t(id) WHERE public.partner_can_cafe(id)
  ) THEN
    RAISE EXCEPTION 'Assign at least one available café to a Café Manager.';
  END IF;

  UPDATE public.partner_memberships SET role = p_role WHERE id = p_member;
  DELETE FROM public.partner_assignments
  WHERE membership_id = p_member AND NOT (cafe_id = ANY(new_ids));
  INSERT INTO public.partner_assignments(membership_id, chain_id, cafe_id)
  SELECT p_member, member_chain, id FROM unnest(new_ids) AS t(id)
  WHERE NOT (id = ANY(current_ids));

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (member_chain, actor_id, 'edit_manager_access', p_member::text,
    jsonb_build_object('previous_role', saved_role, 'previous_cafe_ids', current_ids,
      'role', p_role, 'cafe_ids', new_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_edit_manager_access(
  p_member uuid,
  p_expected_role text,
  p_expected_cafe_ids bigint[],
  p_role text,
  p_cafe_ids bigint[]
)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.edit_manager_access(
    p_member, p_expected_role, p_expected_cafe_ids, p_role, p_cafe_ids
  );
$$;

REVOKE ALL ON FUNCTION public.partner_team_assignments(uuid),
  public.partner_edit_manager_access(uuid, text, bigint[], text, bigint[]),
  partner_internal.edit_manager_access(uuid, text, bigint[], text, bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_team_assignments(uuid),
  public.partner_edit_manager_access(uuid, text, bigint[], text, bigint[]),
  partner_internal.edit_manager_access(uuid, text, bigint[], text, bigint[]) TO authenticated;

-- Partner pilot safety fixes
-- Keep all command entry points behind the confirmation check.
ALTER FUNCTION public.partner_command(text, jsonb) SET SCHEMA partner_internal;
REVOKE ALL ON FUNCTION partner_internal.partner_command(text, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION partner_internal.confirmed_partner_command(p_action text, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated request required' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'activate_plan' AND p_input->>'plan' = 'free'
    AND coalesce(p_input->'cafe_ids', '[]'::jsonb) = '[]'::jsonb
    AND p_input->'confirm_empty_free' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Choose cafés or confirm that this Free plan keeps no café access.';
  END IF;

  RETURN partner_internal.partner_command(p_action, p_input);
END;
$$;

CREATE FUNCTION public.partner_command(p_action text, p_input jsonb)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.confirmed_partner_command(p_action, p_input);
$$;

CREATE FUNCTION public.partner_plan_cafes(p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'address', c.address, 'active', c.is_active
  ) ORDER BY c.name, c.id), '[]'::jsonb)
  FROM public."Cafe" c
  JOIN public.partner_accounts a ON a.chain_id = c.chain_id
  WHERE c.chain_id = p_chain AND c.is_active IS NOT NULL AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION partner_internal.confirmed_partner_command(text, jsonb),
  public.partner_command(text, jsonb), public.partner_plan_cafes(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.confirmed_partner_command(text, jsonb),
  public.partner_command(text, jsonb), public.partner_plan_cafes(uuid)
  TO authenticated;

-- Apply eligibility to the candidates before nearest-neighbor ordering and LIMIT.
-- Keep the existing v2 fields and leave the legacy discovery function intact.
CREATE OR REPLACE FUNCTION public.get_closest_cafes_v2(
  user_lat double precision, user_long double precision,
  search_term text DEFAULT '', max_results integer DEFAULT 100,
  has_reward boolean DEFAULT false, amenity_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH input AS (
    SELECT extensions.st_point(user_long, user_lat)::extensions.geography AS origin,
      to_tsquery('english', nullif(array_to_string(
        ARRAY(
          SELECT lexeme || ':*'
          FROM unnest(regexp_split_to_array(
            regexp_replace(btrim(search_term), '[^[:alnum:]]+', ' ', 'g'), ' '
          )) AS lexeme
          WHERE lexeme <> ''
        ), ' & '
      ), '')) AS terms
  )
  SELECT coalesce(jsonb_agg(candidate ORDER BY candidate.distance_meters, candidate.id), '[]'::jsonb)
  FROM (
    SELECT c.id, c.name, c.address, c.image_url, c.description, c.phone_number,
      c.email, c.social_media, c.amenities, c.rating, c.time_open, c.link, c.show_details,
      extensions.st_y(c.location::extensions.geometry) AS latitude,
      extensions.st_x(c.location::extensions.geometry) AS longitude,
      extensions.st_distance(c.location, input.origin) AS distance_meters,
      gallery.images_url,
      (c.reward_code IS NOT NULL AND c.reward_code <> '') AS has_reward
    FROM public."Cafe" c
    LEFT JOIN public."CafeImages" gallery ON gallery.cafe_id = c.id
    CROSS JOIN input
    WHERE c.is_active IS TRUE
      AND (coalesce(btrim(search_term), '') = '' OR c.fts_vectors @@ input.terms)
      AND (NOT has_reward OR (c.reward_code IS NOT NULL AND c.reward_code <> ''))
      AND (amenity_ids = '{}' OR c.amenities @> amenity_ids)
    ORDER BY c.location OPERATOR(extensions.<->) input.origin
    LIMIT least(greatest(max_results, 1), 200)
  ) AS candidate;
$$;

-- Partner request queues
-- Resolve a request independently of the queue and apply the same partner scope.
CREATE FUNCTION public.partner_cafe_request(p_id uuid, p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT to_jsonb(ch)
  FROM public.partner_changes ch
  WHERE ch.id = p_id AND ch.chain_id = p_chain
    AND public.partner_role(p_chain) IS NOT NULL
    AND (public.partner_can_cafe(ch.cafe_id)
      OR (ch.cafe_id IS NULL AND public.partner_role(p_chain) IN ('owner', 'chain_manager')));
$$;

CREATE OR REPLACE FUNCTION partner_internal.request_queue(
  p_staff boolean, p_search text, p_filter text, p_page integer
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  member_chain uuid;
  member_role text;
  staff_queue boolean := coalesce(p_staff, false);
  needle text := lower(left(btrim(coalesce(p_search, '')), 150));
  page_size constant integer := 20;
  result jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF staff_queue THEN
    IF NOT public.is_staff() THEN
      RAISE EXCEPTION 'Staff required' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT chain_id, role INTO member_chain, member_role
    FROM public.partner_memberships
    WHERE user_id = actor_id AND revoked_at IS NULL;
    IF member_chain IS NULL THEN
      RAISE EXCEPTION 'No active partner membership' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH accessible_cafes AS MATERIALIZED (
    SELECT cafe_id
    FROM public.partner_cafe_access
    WHERE chain_id = member_chain AND public.partner_can_cafe(cafe_id)
  ),
  scoped AS MATERIALIZED (
    SELECT ch.id, ch.cafe_id, ch.created_at, ch.status,
      CASE
        WHEN ch.cafe_id IS NULL THEN 'new'
        WHEN ch.payload->'is_active' = 'false'::jsonb AND c.is_active IS TRUE THEN 'removal'
        WHEN ch.payload->'is_active' = 'true'::jsonb AND c.is_active IS FALSE THEN 'reactivation'
        ELSE 'edit'
      END AS kind,
      (needle = ''
        OR strpos(lower(coalesce(c.name, '')), needle) > 0
        OR strpos(lower(coalesce(ch.payload->>'name', '')), needle) > 0
        OR strpos(ch.id::text, needle) > 0
        OR (staff_queue AND strpos(lower(coalesce(chain.name, '')), needle) > 0)) AS matches_search
    FROM public.partner_changes ch
    LEFT JOIN public."Cafe" c ON c.id = ch.cafe_id
    LEFT JOIN public."Chains" chain ON chain.id = ch.chain_id
    WHERE (staff_queue AND ch.status = 'pending')
      OR (NOT staff_queue AND ch.chain_id = member_chain
        AND (ch.cafe_id IN (SELECT cafe_id FROM accessible_cafes)
          OR (ch.cafe_id IS NULL AND member_role IN ('owner', 'chain_manager'))))
  ),
  matches AS MATERIALIZED (
    SELECT id, created_at, kind
    FROM scoped
    WHERE matches_search AND (coalesce(p_filter, 'all') = 'all'
      OR p_filter = CASE WHEN staff_queue THEN kind ELSE status END)
  ),
  totals AS (
    SELECT count(*) AS total,
      least(greatest(coalesce(p_page, 1), 1), greatest(1, (count(*) + page_size - 1) / page_size)) AS page
    FROM matches
  ),
  page_rows AS (
    SELECT * FROM matches
    ORDER BY CASE WHEN staff_queue THEN created_at END ASC,
             CASE WHEN NOT staff_queue THEN created_at END DESC, id
    LIMIT page_size OFFSET (SELECT (page - 1) * page_size FROM totals)
  )
  SELECT jsonb_build_object(
    'actor', actor_id,
    'request_total', totals.total,
    'request_page', totals.page,
    'request_page_size', page_size,
    'pending_request_count', CASE WHEN staff_queue THEN 0 ELSE (
      SELECT count(*) FROM scoped WHERE status = 'pending'
    ) END,
    'changes', coalesce((
      SELECT jsonb_agg(
        to_jsonb(ch) || CASE WHEN staff_queue THEN jsonb_build_object(
          'cafe_name', c.name, 'current_values', to_jsonb(c), 'kind', page_rows.kind
        ) ELSE '{}'::jsonb END
        ORDER BY CASE WHEN staff_queue THEN page_rows.created_at END ASC,
                 CASE WHEN NOT staff_queue THEN page_rows.created_at END DESC, page_rows.id
      )
      FROM page_rows
      JOIN public.partner_changes ch ON ch.id = page_rows.id
      LEFT JOIN public."Cafe" c ON staff_queue AND c.id = ch.cafe_id
    ), '[]'::jsonb),
    'pending_requests', CASE WHEN staff_queue THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'cafe_id', cafe_id))
      FROM scoped WHERE status = 'pending' AND cafe_id IS NOT NULL
    ), '[]'::jsonb) END,
    'accounts', CASE WHEN NOT staff_queue THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('name', c.name))
      FROM public.partner_accounts a JOIN public."Chains" c ON c.id = a.chain_id
    ), '[]'::jsonb) END
  ) INTO result FROM totals;

  RETURN result;
END;
$$;

CREATE FUNCTION public.partner_request_queue(
  p_staff boolean, p_search text, p_filter text, p_page integer
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.request_queue(p_staff, p_search, p_filter, p_page);
$$;

REVOKE ALL ON FUNCTION public.partner_cafe_request(uuid, uuid),
  partner_internal.request_queue(boolean, text, text, integer),
  public.partner_request_queue(boolean, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_cafe_request(uuid, uuid),
  partner_internal.request_queue(boolean, text, text, integer),
  public.partner_request_queue(boolean, text, text, integer) TO authenticated;

-- Align partner reward reporting
-- Match the dashboard tracking boundary while retaining the reward report and snapshot contracts.
CREATE OR REPLACE FUNCTION public.partner_snapshot(p_section text DEFAULT 'overview',p_input jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; r text; acc public.partner_accounts; result jsonb; start_at timestamptz; end_at timestamptz;
 local_today date; report_from date; report_to date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_section='staff' THEN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('actor',auth.uid(),'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',c.name)),'[]') FROM public.partner_accounts a JOIN public."Chains" c ON c.id=a.chain_id),
   'changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT ch.*,c.name AS cafe_name,to_jsonb(c) AS current_values FROM public.partner_changes ch LEFT JOIN public."Cafe" c ON c.id=ch.cafe_id WHERE status='pending' ORDER BY ch.created_at LIMIT 100) x));
 END IF;
 SELECT chain_id,role INTO cid,r FROM public.partner_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL;
 IF cid IS NULL THEN RAISE EXCEPTION 'No active partner membership' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid;
 result=jsonb_build_object('actor',auth.uid(),'chain_id',cid,'role',r,'plan',acc.plan,'timezone',acc.timezone,'selection_required',acc.selection_required,'coverage_at',acc.reward_coverage_at,'name',(SELECT name FROM public."Chains" WHERE id=cid));
 IF p_section='selection' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required'; END IF;
  RETURN result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]') FROM public."Cafe" WHERE chain_id=cid));
 END IF;
 result=result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(to_jsonb(c)-ARRAY['reward_code','fts_vectors','location']),'[]') FROM public."Cafe" c WHERE public.partner_can_cafe(c.id)));
 IF p_section='cafes' THEN
  RETURN result||jsonb_build_object('changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_changes WHERE chain_id=cid AND (public.partner_can_cafe(cafe_id) OR (cafe_id IS NULL AND r IN ('owner','chain_manager'))) ORDER BY created_at DESC LIMIT 100) x));
 ELSIF p_section='cafe' THEN
  IF NOT public.partner_can_cafe((p_input->>'id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('cafe',(SELECT to_jsonb(c)-ARRAY['fts_vectors','location'] FROM public."Cafe" c WHERE id=(p_input->>'id')::bigint),'gallery',(SELECT coalesce(to_jsonb(images_url),'[]') FROM public."CafeImages" WHERE cafe_id=(p_input->>'id')::bigint),'menu',(SELECT coalesce(jsonb_agg(m),'[]') FROM public."CafeMenu" m WHERE cafe_id=(p_input->>'id')::bigint));
 ELSIF p_section='rewards' THEN
  local_today := (now() AT TIME ZONE acc.timezone)::date;
  result := result || jsonb_build_object('refreshed_at', now());
  BEGIN
   report_from := coalesce(nullif(p_input->>'from', '')::date,
    CASE WHEN p_input->>'range' = 'week' THEN date_trunc('week', local_today::timestamp)::date
         ELSE local_today - 29 END);
   report_to := coalesce(nullif(p_input->>'to', '')::date, local_today);
   IF NOT isfinite(report_from) OR NOT isfinite(report_to) THEN
    RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
   END IF;
   start_at := report_from::timestamp AT TIME ZONE acc.timezone;
   end_at := (report_to + 1)::timestamp AT TIME ZONE acc.timezone;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
   RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
  END;
  IF report_to < report_from THEN
   RETURN result || jsonb_build_object('reward_error', 'Choose an end date on or after the start date.');
  END IF;

  RETURN result || jsonb_build_object('reward_from', report_from, 'reward_to', report_to) || (
   SELECT jsonb_build_object('total', count(*), 'events', coalesce(
    jsonb_agg(x ORDER BY rn) FILTER (
     WHERE rn > coalesce((p_input->>'offset')::int, 0)
       AND rn <= coalesce((p_input->>'offset')::int, 0)::bigint + 50
    ), '[]'::jsonb))
   FROM (
    SELECT rw.id, rw.redeemed_cafe_id AS cafe_id, c.name AS cafe_name,
     rw.redeemed_at AS occurred_at, rw.status,
     row_number() OVER (ORDER BY rw.redeemed_at DESC, rw.id) AS rn
    FROM public."Rewards" rw
    JOIN public."Cafe" c ON c.id = rw.redeemed_cafe_id
    WHERE rw.chain_id = cid AND rw.status = 'redeemed'
      AND rw.redeemed_at >= greatest(start_at, acc.reward_coverage_at)
      AND rw.redeemed_at < end_at AND rw.redeemed_at <= now()
      AND public.partner_can_cafe(c.id)
      AND (p_input->>'cafe_id' IS NULL OR c.id = (p_input->>'cafe_id')::bigint)
   ) x
  );
 ELSIF p_section IN ('inventory','recipes') THEN
  IF acc.plan<>'paid' THEN RAISE EXCEPTION 'Upgrade to Paid to access inventory and recipes' USING ERRCODE='42501'; END IF;
  IF p_section='inventory' THEN RETURN result||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(i),'[]') FROM public.partner_items i WHERE chain_id=cid AND public.partner_can_cafe(cafe_id)),'movements',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_movements WHERE chain_id=cid AND public.partner_can_cafe(cafe_id) ORDER BY created_at DESC,id LIMIT 100) x)); END IF;
  -- Shared recipes expose ingredient definitions, never other cafes' balances.
  RETURN result||jsonb_build_object('recipes',(SELECT coalesce(jsonb_agg(x),'[]') FROM public.partner_recipes x WHERE chain_id=cid),'ingredients',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit)),'[]') FROM public.partner_items WHERE chain_id=cid AND type='ingredient' AND active));
 ELSIF p_section='team' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('members',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT m.id,m.user_id,m.role,m.revoked_at,u.email FROM public.partner_memberships m JOIN auth.users u ON u.id=m.user_id WHERE chain_id=cid) x),'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'token_hash'),'[]') FROM public.partner_invitations i WHERE chain_id=cid));
 END IF;
 RETURN result;
END $$;

-- Protect partner invitation receipts
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
REVOKE SELECT ON vault.decrypted_secrets FROM PUBLIC, anon, authenticated;

-- Keep the encryption key separate from retry records and encrypted by Vault.
SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'coffee_sphut_partner_invitation_receipts_v1',
  'Encryption key for partner invitation retry responses'
);

CREATE FUNCTION partner_internal.invitation_receipt_key()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  key text;
BEGIN
  SELECT decrypted_secret INTO STRICT key FROM vault.decrypted_secrets
  WHERE name = 'coffee_sphut_partner_invitation_receipts_v1';
  RETURN key;
END;
$$;

CREATE FUNCTION partner_internal.invitation_receipt_input(p_input jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN p_input ? 'token' THEN jsonb_set(p_input, '{token}',
    jsonb_build_object('sha256', encode(extensions.digest((p_input->'token')::text, 'sha256'), 'hex')))
    ELSE p_input END;
$$;

REVOKE ALL ON FUNCTION partner_internal.invitation_receipt_key(),
  partner_internal.invitation_receipt_input(jsonb) FROM PUBLIC, anon, authenticated;

-- Backfill in the same transaction as the command change.
LOCK TABLE public.partner_operations IN ACCESS EXCLUSIVE MODE;

UPDATE public.partner_operations
SET input = partner_internal.invitation_receipt_input(input)
WHERE input ? 'token';

UPDATE public.partner_operations
SET result = (result - 'token') || jsonb_build_object(
  'token_ciphertext', encode(extensions.pgp_sym_encrypt(
    result->>'token', partner_internal.invitation_receipt_key(), 'cipher-algo=aes256'
  ), 'hex')
)
WHERE action = 'invite' AND result ? 'token';

ALTER TABLE public.partner_operations ADD CONSTRAINT partner_operations_protected_token
CHECK (NOT (result ? 'token') AND (
  NOT (input ? 'token') OR (
    jsonb_typeof(input->'token') = 'object'
    AND coalesce(input->'token'->>'sha256', '') ~ '^[0-9a-f]{64}$'
    AND input->'token' = jsonb_build_object('sha256', input->'token'->>'sha256')
  )
));

-- Preserve the existing command checks, changing only how its receipts store tokens.
CREATE OR REPLACE FUNCTION public.partner_command_core(p_action text,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<cmd>>
DECLARE uid uuid=auth.uid(); cid uuid; role_name text; req uuid=(p_input->>'request_id')::uuid; oldop public.partner_operations;
 receipt_input jsonb; receipt_result jsonb;
 acc public.partner_accounts; ch public.partner_changes; c public."Cafe"; it public.partner_items; inv public.partner_invitations;
 payload jsonb; elem jsonb; output jsonb='{}'; target text; token text; n numeric; delta numeric; item_id uuid; ids bigint[]; member public.partner_memberships;
BEGIN
 IF uid IS NULL OR req IS NULL THEN RAISE EXCEPTION 'Authenticated user and request ID required' USING ERRCODE='42501'; END IF;
 receipt_input := partner_internal.invitation_receipt_input(p_input);
 -- Serialize retries before checking state that the first successful request changed.
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||req::text,0));
 SELECT * INTO oldop FROM public.partner_operations WHERE actor=uid AND request_id=req;
 IF FOUND THEN
  IF oldop.action<>p_action OR oldop.input<>receipt_input THEN RAISE EXCEPTION 'Request ID was reused with different data'; END IF;
  -- A retry must satisfy CURRENT access; retained receipts are not a read bypass.
  IF p_action IN ('review','activate_plan','provision') THEN
   IF NOT public.is_staff() OR (p_action<>'review' AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Current staff access required' USING ERRCODE='42501'; END IF;
  ELSE
   cid=nullif(p_input->>'chain_id','')::uuid;
   IF p_action='accept_invite' THEN SELECT chain_id INTO cid FROM public.partner_memberships WHERE user_id=uid AND revoked_at IS NULL; END IF;
   IF public.partner_role(cid) IS NULL THEN RAISE EXCEPTION 'Current partner access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('item','movement','recipe') AND NOT public.partner_paid(cid) THEN RAISE EXCEPTION 'Current Paid access required' USING ERRCODE='42501'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL AND NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Current cafe access required' USING ERRCODE='42501'; END IF;
   IF p_action='movement' AND NOT EXISTS(SELECT 1 FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND public.partner_can_cafe(cafe_id)) THEN RAISE EXCEPTION 'Current item access required' USING ERRCODE='42501'; END IF;
   IF p_action IN ('invite','revoke_member','revoke_invite','select_cafes','settings') AND public.partner_role(cid)<>'owner' THEN RAISE EXCEPTION 'Current Owner access required'; END IF;
  END IF;
  IF p_action = 'invite' THEN
   token := extensions.pgp_sym_decrypt(
    decode(oldop.result->>'token_ciphertext', 'hex'),
    partner_internal.invitation_receipt_key()
   );
   RETURN (oldop.result - 'token_ciphertext') || jsonb_build_object('token', token);
  END IF;
  RETURN oldop.result;
 END IF;
 IF p_action='accept_invite' THEN
  SELECT * INTO inv FROM public.partner_invitations WHERE token_hash=encode(extensions.digest(p_input->>'token','sha256'),'hex') FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at<=now() OR inv.email<>(SELECT lower(email) FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Invitation unavailable for this account'; END IF;
  cid=inv.chain_id;
 ELSE cid=nullif(p_input->>'chain_id','')::uuid; END IF;
 IF p_action='provision' THEN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_input->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Chain name required'; END IF;
  IF cid IS NULL THEN INSERT INTO public."Chains"(name) VALUES(p_input->>'name') RETURNING id INTO cid; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(p_input->>'owner_id')::uuid) THEN RAISE EXCEPTION 'Owner must have an existing verified account'; END IF;
  INSERT INTO public.partner_accounts(chain_id) VALUES(cid);
  INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,(p_input->>'owner_id')::uuid,'owner');
  INSERT INTO public.partner_cafe_access(cafe_id,chain_id) SELECT id,cid FROM public."Cafe" WHERE chain_id=cid;
  UPDATE public.partner_accounts SET selection_required=(SELECT count(*)>3 FROM public."Cafe" WHERE chain_id=cid AND is_active IS TRUE) WHERE chain_id=cid;
  output=jsonb_build_object('chain_id',cid);
 ELSE
  SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partner unavailable'; END IF;
  role_name=public.partner_role(cid);
  IF p_action NOT IN ('review','activate_plan','accept_invite') AND role_name IS NULL THEN RAISE EXCEPTION 'Partner access denied' USING ERRCODE='42501'; END IF;
  CASE p_action
  WHEN 'accept_invite' THEN
   INSERT INTO public.partner_memberships(chain_id,user_id,role) VALUES(cid,uid,inv.role) RETURNING * INTO member;
   INSERT INTO public.partner_assignments(membership_id,chain_id,cafe_id) SELECT member.id,cid,unnest(inv.cafe_ids);
   UPDATE public.partner_invitations SET accepted_at=now() WHERE id=inv.id;
  WHEN 'save_change','submit_change' THEN
   IF acc.selection_required THEN RAISE EXCEPTION 'Owner must select accessible cafes first'; END IF;
   IF p_input->>'cafe_id' IS NOT NULL THEN
    IF NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
    SELECT * INTO c FROM public."Cafe" WHERE id=(p_input->>'cafe_id')::bigint;
   ELSIF role_name='cafe_manager' THEN RAISE EXCEPTION 'Chain manager required to create cafes'; END IF;
   payload=p_input->'payload'; PERFORM public.partner_validate_cafe(payload);
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_changes(chain_id,cafe_id,baseline,payload,status,submitter)
    VALUES(cid,c.id,(p_input->>'baseline')::bigint,payload,CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END,uid) RETURNING * INTO ch;
   ELSE
    SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
    IF NOT FOUND OR ch.status<>'draft' OR ch.submitter<>uid OR ch.cafe_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Draft unavailable'; END IF;
    UPDATE public.partner_changes SET payload=cmd.payload,baseline=(p_input->>'baseline')::bigint,status=CASE WHEN p_action='submit_change' THEN 'pending' ELSE 'draft' END WHERE id=ch.id RETURNING * INTO ch;
   END IF;
   output=jsonb_build_object('id',ch.id);
  WHEN 'review' THEN
   IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff reviewer required' USING ERRCODE='42501'; END IF;
   SELECT * INTO ch FROM public.partner_changes WHERE id=(p_input->>'id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR ch.status<>'pending' OR ch.submitter=uid THEN RAISE EXCEPTION 'Another staff reviewer must review a pending request'; END IF;
   IF p_input->>'decision'='reject' THEN
    IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
    UPDATE public.partner_changes SET status='rejected',reviewer=uid,reason=p_input->>'reason',reviewed_at=now() WHERE id=ch.id;
   ELSIF p_input->>'decision'='approve' THEN
    payload=ch.payload; PERFORM public.partner_validate_cafe(payload);
    IF ch.cafe_id IS NOT NULL THEN
     SELECT * INTO c FROM public."Cafe" WHERE id=ch.cafe_id AND chain_id=cid FOR UPDATE;
     IF c.partner_revision IS DISTINCT FROM ch.baseline THEN RAISE EXCEPTION 'Conflict: approved cafe changed. Resubmit against the current revision.'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.partner_cafe_access WHERE cafe_id=c.id AND NOT restricted) OR acc.selection_required THEN RAISE EXCEPTION 'Cafe is subscription restricted'; END IF;
    ELSE c.chain_id=cid; c.is_active=true; c.show_details=false; END IF;
    c=jsonb_populate_record(c,payload-'gallery'-'menu');
    IF ch.cafe_id IS NULL THEN
     INSERT INTO public."Cafe"(chain_id,name,address,postcode,description,image_url,latitude,longitude,time_open,phone_number,email,link,social_media,amenities,rating,is_active,show_details,loyalty_threshold_override,reward_code)
     VALUES(cid,c.name,c.address,c.postcode,c.description,c.image_url,c.latitude,c.longitude,c.time_open,c.phone_number,c.email,c.link,c.social_media,c.amenities,c.rating,c.is_active,c.show_details,c.loyalty_threshold_override,nullif(btrim(c.reward_code),'')) RETURNING * INTO c;
     INSERT INTO public.partner_cafe_access(cafe_id,chain_id) VALUES(c.id,cid) ON CONFLICT(cafe_id) DO NOTHING;
    ELSE
     UPDATE public."Cafe" SET name=c.name,address=c.address,postcode=c.postcode,description=c.description,image_url=c.image_url,latitude=c.latitude,longitude=c.longitude,time_open=c.time_open,phone_number=c.phone_number,email=c.email,link=c.link,social_media=c.social_media,amenities=c.amenities,rating=c.rating,is_active=c.is_active,show_details=c.show_details,loyalty_threshold_override=c.loyalty_threshold_override,reward_code=nullif(btrim(c.reward_code),'') WHERE id=c.id;
    END IF;
    IF payload ? 'gallery' THEN INSERT INTO public."CafeImages"(cafe_id,images_url) VALUES(c.id,ARRAY(SELECT jsonb_array_elements_text(payload->'gallery'))) ON CONFLICT(cafe_id) DO UPDATE SET images_url=excluded.images_url; END IF;
    IF payload ? 'menu' THEN
     DELETE FROM public."CafeMenu" WHERE cafe_id=c.id;
     FOR elem IN SELECT * FROM jsonb_array_elements(payload->'menu') LOOP
      INSERT INTO public."CafeMenu"(cafe_id,name,price,currency,description) VALUES(c.id,elem->>'name',(elem->>'price')::bigint,elem->>'currency',elem->>'description');
     END LOOP;
    END IF;
    UPDATE public.partner_changes SET status='approved',cafe_id=c.id,reviewer=uid,reviewed_at=now() WHERE id=ch.id;
   ELSE RAISE EXCEPTION 'Invalid review decision'; END IF;
  WHEN 'item' THEN
   IF acc.plan<>'paid' OR NOT public.partner_can_cafe((p_input->>'cafe_id')::bigint) THEN
    RAISE EXCEPTION 'Paid cafe access required' USING ERRCODE='42501';
   END IF;
   n=(p_input->>'threshold')::numeric;
   IF n::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Finite stock threshold required';
   END IF;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_items(chain_id,cafe_id,name,code,type,unit,threshold)
    VALUES(cid,(p_input->>'cafe_id')::bigint,p_input->>'name',p_input->>'code',p_input->>'type',p_input->>'unit',coalesce(n,0))
    RETURNING id INTO item_id;
   ELSE
    IF n<0 OR n>=1000000000000 OR n<>trunc(n,6) THEN
     RAISE EXCEPTION 'Use a nonnegative low-stock threshold below one trillion with up to six decimal places';
    END IF;
    IF n IS NULL AND p_input->>'active' IS NULL THEN
     RAISE EXCEPTION 'Provide a low-stock threshold or item status';
    END IF;
    UPDATE public.partner_items
    SET active=coalesce((p_input->>'active')::boolean,active),
        threshold=coalesce(n,threshold)
    WHERE id=(p_input->>'id')::uuid AND cafe_id=(p_input->>'cafe_id')::bigint AND chain_id=cid
    RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id);
  WHEN 'movement' THEN
   SELECT * INTO it FROM public.partner_items WHERE id=(p_input->>'item_id')::uuid AND chain_id=cid FOR UPDATE;
   IF NOT FOUND OR NOT it.active OR acc.plan<>'paid' OR NOT public.partner_can_cafe(it.cafe_id) THEN RAISE EXCEPTION 'Paid item access required' USING ERRCODE='42501'; END IF;
   IF nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Movement reason required'; END IF;
   n=(p_input->>'quantity')::numeric;
   IF n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR n<0 OR scale(n)>6 THEN RAISE EXCEPTION 'Use a nonnegative quantity with at most six decimals'; END IF;
   IF n=0 AND p_input->>'type'<>'count' THEN RAISE EXCEPTION 'Movement quantity must be positive'; END IF;
   CASE p_input->>'type'
    WHEN 'count' THEN delta=n-it.balance;
    WHEN 'receipt','opening' THEN delta=n;
    WHEN 'consumption','wastage' THEN delta=-n;
    WHEN 'correction' THEN IF p_input->>'direction'='subtract' THEN delta=-n; ELSE delta=n; END IF;
    ELSE RAISE EXCEPTION 'Invalid movement type';
   END CASE;
   IF it.balance+delta<0 THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
   UPDATE public.partner_items SET balance=balance+delta WHERE id=it.id RETURNING balance INTO n;
   INSERT INTO public.partner_movements(chain_id,item_id,cafe_id,quantity,resulting_balance,type,actor,reason) VALUES(cid,it.id,it.cafe_id,delta,n,p_input->>'type',uid,p_input->>'reason');
   output=jsonb_build_object('balance',n);
  WHEN 'recipe' THEN
   IF (p_input->>'yield') IS NULL OR (p_input->>'yield')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite positive recipe yield required'; END IF;
   IF acc.plan<>'paid' OR role_name NOT IN ('owner','chain_manager') THEN RAISE EXCEPTION 'Paid chain manager required' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(p_input->'ingredients') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'ingredients')<1 THEN RAISE EXCEPTION 'Recipe requires ingredients'; END IF;
   FOR elem IN SELECT * FROM jsonb_array_elements(p_input->'ingredients') LOOP
    SELECT * INTO it FROM public.partner_items WHERE id=(elem->>'item_id')::uuid AND chain_id=cid AND type='ingredient';
    IF NOT FOUND OR (elem->>'quantity')::numeric<=0 OR (elem->>'quantity') IS NULL OR (elem->>'quantity')::numeric::text IN ('NaN','Infinity','-Infinity') OR (elem->>'unit') IS DISTINCT FROM it.unit THEN RAISE EXCEPTION 'Invalid ingredient, quantity or unit'; END IF;
   END LOOP;
   IF p_input->>'id' IS NULL THEN
    INSERT INTO public.partner_recipes(chain_id,name,yield,ingredients) VALUES(cid,p_input->>'name',(p_input->>'yield')::numeric,p_input->'ingredients') RETURNING id INTO item_id;
   ELSE
    UPDATE public.partner_recipes SET name=p_input->>'name',yield=(p_input->>'yield')::numeric,ingredients=p_input->'ingredients',active=coalesce((p_input->>'active')::boolean,true),revision=revision+1,updated_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND revision=(p_input->>'revision')::bigint RETURNING id INTO item_id;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Recipe changed or unavailable; reload before saving'; END IF;
   END IF;
   output=jsonb_build_object('id',item_id,'revision',(SELECT revision FROM public.partner_recipes WHERE id=item_id));
  WHEN 'invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT public.partner_can_cafe(i)) THEN RAISE EXCEPTION 'Invitation cafe scope denied'; END IF;
   token=gen_random_uuid()::text||gen_random_uuid()::text;
   INSERT INTO public.partner_invitations(chain_id,email,role,cafe_ids,token_hash) VALUES(cid,lower(btrim(p_input->>'email')),p_input->>'role',ids,encode(extensions.digest(token,'sha256'),'hex'));
   output=jsonb_build_object('token',token);
  WHEN 'revoke_member' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_memberships SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND role<>'owner';
   IF NOT FOUND THEN RAISE EXCEPTION 'Manager unavailable; Owner transfer requires staff'; END IF;
  WHEN 'revoke_invite' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   UPDATE public.partner_invitations SET revoked_at=now() WHERE id=(p_input->>'id')::uuid AND chain_id=cid AND accepted_at IS NULL;
  WHEN 'settings' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_input->>'timezone') THEN RAISE EXCEPTION 'Invalid IANA timezone'; END IF;
   UPDATE public.partner_accounts SET timezone=p_input->>'timezone' WHERE chain_id=cid;
  WHEN 'select_cafes','activate_plan' THEN
   IF p_action='activate_plan' THEN
    IF NOT public.is_admin() OR nullif(btrim(p_input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Admin and activation record/reason required' USING ERRCODE='42501'; END IF;
    IF p_input->>'plan' NOT IN ('free','paid') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
    UPDATE public.partner_accounts SET plan=p_input->>'plan' WHERE chain_id=cid RETURNING * INTO acc;
   ELSIF role_name<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
   ids=ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_input->'cafe_ids','[]'))::bigint);
   IF EXISTS(SELECT 1 FROM unnest(ids) i WHERE NOT EXISTS(SELECT 1 FROM public."Cafe" WHERE id=i AND chain_id=cid)) THEN RAISE EXCEPTION 'Cafe selection outside chain'; END IF;
   IF acc.plan='free' AND (SELECT count(*) FROM public."Cafe" WHERE id=ANY(ids) AND is_active IS TRUE)>3 THEN RAISE EXCEPTION 'Select at most three active cafes'; END IF;
   IF acc.plan='paid' THEN UPDATE public.partner_cafe_access SET restricted=false WHERE chain_id=cid;
   ELSE UPDATE public.partner_cafe_access SET restricted=NOT(cafe_id=ANY(ids)) WHERE chain_id=cid; END IF;
   UPDATE public.partner_accounts SET selection_required=false WHERE chain_id=cid;
  ELSE RAISE EXCEPTION 'Unknown partner action';
  END CASE;
 END IF;
 INSERT INTO public.partner_audit(chain_id,actor,action,target,details) VALUES(cid,uid,p_action,coalesce(p_input->>'id',output->>'id'),p_input-ARRAY['request_id','token','payload']);
 receipt_result := output;
 IF p_action = 'invite' THEN
  receipt_result := (output - 'token') || jsonb_build_object(
   'token_ciphertext', encode(extensions.pgp_sym_encrypt(
    token, partner_internal.invitation_receipt_key(), 'cipher-algo=aes256'
   ), 'hex')
  );
 END IF;
 INSERT INTO public.partner_operations(actor,request_id,action,input,result)
 VALUES(uid,req,p_action,receipt_input,receipt_result);
 RETURN output;
END $$;

-- Partner cafe review notifications
CREATE INDEX partner_review_notifications_submitter
  ON public.partner_changes (submitter, reviewed_at DESC, id)
  WHERE status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL;

-- Use the review itself as the notification so retries cannot create duplicates.
CREATE VIEW public.partner_review_updates WITH (security_invoker = true) AS
SELECT ch.id, ch.cafe_id, ch.payload->>'name' AS name, ch.status, ch.reason, ch.reviewed_at
FROM public.partner_changes ch
WHERE ch.submitter = (SELECT auth.uid())
  AND ch.status IN ('approved', 'rejected') AND ch.reviewed_at IS NOT NULL
  AND public.partner_role(ch.chain_id) IS NOT NULL
  AND (public.partner_can_cafe(ch.cafe_id)
    OR (ch.cafe_id IS NULL AND public.partner_role(ch.chain_id) IN ('owner', 'chain_manager')));

CREATE TABLE public.partner_review_notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_id uuid NOT NULL REFERENCES public.partner_changes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, change_id)
);
ALTER TABLE public.partner_review_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE INDEX partner_review_notification_reads_change
  ON public.partner_review_notification_reads (change_id);
REVOKE ALL ON public.partner_review_updates, public.partner_review_notification_reads
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_review_updates, public.partner_review_notification_reads TO authenticated;
GRANT INSERT ON public.partner_review_notification_reads TO authenticated;

CREATE POLICY partner_review_receipt_read ON public.partner_review_notification_reads
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.partner_review_updates u WHERE u.id = change_id));

CREATE POLICY partner_review_receipt_insert ON public.partner_review_notification_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.partner_review_updates u WHERE u.id = change_id));

CREATE FUNCTION public.partner_review_notifications(p_page integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH updates AS MATERIALIZED (
    SELECT u.*, r.change_id IS NOT NULL AS read
    FROM public.partner_review_updates u
    LEFT JOIN public.partner_review_notification_reads r
      ON r.change_id = u.id AND r.user_id = (SELECT auth.uid())
  ), totals AS (
    SELECT count(*) AS total, count(*) FILTER (WHERE NOT read) AS unread,
      least(greatest(coalesce(p_page, 1), 1), greatest(1, (count(*) + 19) / 20)) AS page
    FROM updates
  )
  SELECT jsonb_build_object('unread', unread, 'total', total, 'page', page, 'updates',
    coalesce((
      SELECT jsonb_agg(page_rows ORDER BY reviewed_at DESC, id)
      FROM (
        SELECT * FROM updates ORDER BY reviewed_at DESC, id
        LIMIT CASE WHEN p_page = 0 THEN 0 ELSE 20 END OFFSET (page - 1) * 20
      ) page_rows
    ), '[]'::jsonb))
  FROM totals;
$$;

CREATE FUNCTION public.partner_mark_review_notification_read(p_change uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  INSERT INTO public.partner_review_notification_reads(user_id, change_id)
  VALUES ((SELECT auth.uid()), p_change)
  ON CONFLICT DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.partner_review_notifications(integer),
  public.partner_mark_review_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_review_notifications(integer),
  public.partner_mark_review_notification_read(uuid) TO authenticated;

-- Partner reward reconciliation export
-- Use one authorized set of redemptions for both the report and its CSV export.
CREATE OR REPLACE FUNCTION public.partner_snapshot(p_section text DEFAULT 'overview',p_input jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; r text; acc public.partner_accounts; result jsonb; start_at timestamptz; end_at timestamptz;
 local_today date; report_from date; report_to date;
 export_csv boolean := coalesce(p_input->>'export' = 'csv', false);
 export_limit constant integer := 10000;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_section='staff' THEN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('actor',auth.uid(),'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',c.name)),'[]') FROM public.partner_accounts a JOIN public."Chains" c ON c.id=a.chain_id),
   'changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT ch.*,c.name AS cafe_name,to_jsonb(c) AS current_values FROM public.partner_changes ch LEFT JOIN public."Cafe" c ON c.id=ch.cafe_id WHERE status='pending' ORDER BY ch.created_at LIMIT 100) x));
 END IF;
 SELECT chain_id,role INTO cid,r FROM public.partner_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL;
 IF cid IS NULL THEN RAISE EXCEPTION 'No active partner membership' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid;
 result=jsonb_build_object('actor',auth.uid(),'chain_id',cid,'role',r,'plan',acc.plan,'timezone',acc.timezone,'selection_required',acc.selection_required,'coverage_at',acc.reward_coverage_at,'name',(SELECT name FROM public."Chains" WHERE id=cid));
 IF p_section='selection' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required'; END IF;
  RETURN result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]') FROM public."Cafe" WHERE chain_id=cid));
 END IF;
 result=result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(to_jsonb(c)-ARRAY['reward_code','fts_vectors','location']),'[]') FROM public."Cafe" c WHERE public.partner_can_cafe(c.id)));
 IF p_section='cafes' THEN
  RETURN result||jsonb_build_object('changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_changes WHERE chain_id=cid AND (public.partner_can_cafe(cafe_id) OR (cafe_id IS NULL AND r IN ('owner','chain_manager'))) ORDER BY created_at DESC LIMIT 100) x));
 ELSIF p_section='cafe' THEN
  IF NOT public.partner_can_cafe((p_input->>'id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('cafe',(SELECT to_jsonb(c)-ARRAY['fts_vectors','location'] FROM public."Cafe" c WHERE id=(p_input->>'id')::bigint),'gallery',(SELECT coalesce(to_jsonb(images_url),'[]') FROM public."CafeImages" WHERE cafe_id=(p_input->>'id')::bigint),'menu',(SELECT coalesce(jsonb_agg(m),'[]') FROM public."CafeMenu" m WHERE cafe_id=(p_input->>'id')::bigint));
 ELSIF p_section='rewards' THEN
  local_today := (now() AT TIME ZONE acc.timezone)::date;
  result := result || jsonb_build_object('refreshed_at', now());
  BEGIN
   report_from := coalesce(nullif(p_input->>'from', '')::date,
    CASE WHEN p_input->>'range' = 'week' THEN date_trunc('week', local_today::timestamp)::date
         ELSE local_today - 29 END);
   report_to := coalesce(nullif(p_input->>'to', '')::date, local_today);
   IF NOT isfinite(report_from) OR NOT isfinite(report_to) THEN
    RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
   END IF;
   start_at := report_from::timestamp AT TIME ZONE acc.timezone;
   end_at := (report_to + 1)::timestamp AT TIME ZONE acc.timezone;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
   RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
  END;
  IF report_to < report_from THEN
   RETURN result || jsonb_build_object('reward_error', 'Choose an end date on or after the start date.');
  END IF;

  RETURN result || jsonb_build_object(
   'reward_from', report_from, 'reward_to', report_to, 'reward_export_limit', export_limit
  ) || (
   WITH matches AS MATERIALIZED (
    SELECT rw.id, rw.redeemed_cafe_id AS cafe_id, c.name AS cafe_name,
     rw.redeemed_at AS occurred_at, rw.status,
     row_number() OVER (ORDER BY rw.redeemed_at DESC, rw.id) AS rn,
     CASE WHEN export_csv THEN
      to_char(rw.redeemed_at AT TIME ZONE acc.timezone, 'YYYY-MM-DD HH24:MI:SS.US')
     END AS occurred_local,
     CASE WHEN export_csv THEN
      to_char(rw.redeemed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
     END AS occurred_utc
    FROM public."Rewards" rw
    JOIN public."Cafe" c ON c.id = rw.redeemed_cafe_id
    WHERE rw.chain_id = cid AND rw.status = 'redeemed'
      AND rw.redeemed_at >= greatest(start_at, acc.reward_coverage_at)
      AND rw.redeemed_at < end_at AND rw.redeemed_at <= now()
      AND public.partner_can_cafe(c.id)
      AND (p_input->>'cafe_id' IS NULL OR c.id = (p_input->>'cafe_id')::bigint)
   ), totals AS (SELECT count(*) AS total FROM matches)
   SELECT jsonb_build_object('total', totals.total, 'events', coalesce((
    SELECT jsonb_agg(
     CASE WHEN export_csv THEN to_jsonb(m) ELSE to_jsonb(m) - 'occurred_local' - 'occurred_utc' END
     ORDER BY m.rn
    ) FROM matches m
    WHERE CASE WHEN export_csv THEN totals.total <= export_limit
     ELSE m.rn > coalesce((p_input->>'offset')::int, 0)
      AND m.rn <= coalesce((p_input->>'offset')::int, 0)::bigint + 50
    END
   ), '[]'::jsonb)) FROM totals
  );
 ELSIF p_section IN ('inventory','recipes') THEN
  IF acc.plan<>'paid' THEN RAISE EXCEPTION 'Upgrade to Paid to access inventory and recipes' USING ERRCODE='42501'; END IF;
  IF p_section='inventory' THEN RETURN result||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(i),'[]') FROM public.partner_items i WHERE chain_id=cid AND public.partner_can_cafe(cafe_id)),'movements',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_movements WHERE chain_id=cid AND public.partner_can_cafe(cafe_id) ORDER BY created_at DESC,id LIMIT 100) x)); END IF;
  -- Shared recipes expose ingredient definitions, never other cafes' balances.
  RETURN result||jsonb_build_object('recipes',(SELECT coalesce(jsonb_agg(x),'[]') FROM public.partner_recipes x WHERE chain_id=cid),'ingredients',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit)),'[]') FROM public.partner_items WHERE chain_id=cid AND type='ingredient' AND active));
 ELSIF p_section='team' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('members',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT m.id,m.user_id,m.role,m.revoked_at,u.email FROM public.partner_memberships m JOIN auth.users u ON u.id=m.user_id WHERE chain_id=cid) x),'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'token_hash'),'[]') FROM public.partner_invitations i WHERE chain_id=cid));
 END IF;
 RETURN result;
END $$;

-- Partner stocktake
CREATE FUNCTION partner_internal.save_stocktake(
  p_chain uuid, p_cafe bigint, p_request uuid, p_counts jsonb, p_reason text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  reason text := coalesce(nullif(btrim(p_reason), ''), 'Stocktake');
  saved public.partner_operations;
  receipt jsonb := jsonb_build_object('chain_id', p_chain, 'cafe_id', p_cafe, 'counts', p_counts, 'reason', reason);
  item_count integer;
BEGIN
  IF actor_id IS NULL OR p_request IS NULL THEN
    RAISE EXCEPTION 'Authenticated user and request ID required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_counts) IS DISTINCT FROM 'array' OR length(reason) > 200 THEN
    RAISE EXCEPTION 'Provide stock counts and a note of up to 200 characters.' USING ERRCODE = '22023';
  END IF;
  item_count := jsonb_array_length(p_counts);
  IF item_count NOT BETWEEN 1 AND 250 THEN
    RAISE EXCEPTION 'Enter counts for 1 to 250 items.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_counts) AS x(item_id uuid, expected numeric, quantity numeric)
    WHERE item_id IS NULL OR expected IS NULL OR quantity IS NULL
      OR expected NOT BETWEEN 0 AND 999999999999.999999 OR scale(expected) > 6
      OR quantity NOT BETWEEN 0 AND 999999999999.999999 OR scale(quantity) > 6
  ) OR item_count <> (
    SELECT count(DISTINCT item_id) FROM jsonb_to_recordset(p_counts) AS x(item_id uuid)
  ) THEN
    RAISE EXCEPTION 'Provide one valid, nonnegative count per item with up to six decimals.' USING ERRCODE = '22023';
  END IF;

  -- Match the lock order used by individual movements and plan changes.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor_id::text || p_request::text, 0));
  PERFORM 1 FROM public.partner_accounts WHERE chain_id = p_chain FOR UPDATE;
  IF NOT FOUND OR NOT public.partner_paid(p_chain) OR NOT public.partner_can_cafe(p_cafe)
    OR NOT EXISTS (
      SELECT 1 FROM public."Cafe" WHERE id = p_cafe AND chain_id = p_chain AND is_active IS TRUE
    )
  THEN
    RAISE EXCEPTION 'Paid access to this active café is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO saved FROM public.partner_operations WHERE actor = actor_id AND request_id = p_request;
  IF FOUND THEN
    IF saved.action <> 'stocktake' OR saved.input <> receipt THEN
      RAISE EXCEPTION 'Request ID was reused with different data.' USING ERRCODE = '22023';
    END IF;
    RETURN (saved.result->>'count')::integer;
  END IF;

  PERFORM 1 FROM public.partner_items AS i
    JOIN jsonb_to_recordset(p_counts) AS x(item_id uuid) ON x.item_id = i.id
    WHERE i.chain_id = p_chain AND i.cafe_id = p_cafe
    ORDER BY i.id FOR UPDATE OF i;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_counts) AS x(item_id uuid, expected numeric)
    LEFT JOIN public.partner_items AS i
      ON i.id = x.item_id AND i.chain_id = p_chain AND i.cafe_id = p_cafe AND i.active
    WHERE i.balance IS DISTINCT FROM x.expected
  ) THEN
    RAISE EXCEPTION 'A balance changed or an item became unavailable. Review the affected counts and try again.'
      USING ERRCODE = 'PT409';
  END IF;

  WITH counts AS MATERIALIZED (
    SELECT x.item_id, x.quantity, x.quantity - i.balance AS delta
    FROM jsonb_to_recordset(p_counts) AS x(item_id uuid, quantity numeric)
    JOIN public.partner_items AS i ON i.id = x.item_id
  ), updated AS (
    UPDATE public.partner_items AS i SET balance = counts.quantity
    FROM counts WHERE i.id = counts.item_id
    RETURNING i.id, i.balance, counts.delta
  )
  INSERT INTO public.partner_movements(chain_id, cafe_id, item_id, quantity, resulting_balance, type, actor, reason)
  SELECT p_chain, p_cafe, id, delta, balance, 'count', actor_id, reason FROM updated;

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (p_chain, actor_id, 'stocktake', p_cafe::text, jsonb_build_object('count', item_count, 'reason', reason));
  INSERT INTO public.partner_operations(actor, request_id, action, input, result)
  VALUES (actor_id, p_request, 'stocktake', receipt, jsonb_build_object('count', item_count));
  RETURN item_count;
END;
$$;

CREATE FUNCTION public.partner_save_stocktake(
  p_chain uuid, p_cafe bigint, p_request uuid, p_counts jsonb, p_reason text
) RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.save_stocktake(p_chain, p_cafe, p_request, p_counts, p_reason);
$$;

CREATE FUNCTION public.partner_stocktake_items(p_chain uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'cafe_id', i.cafe_id, 'name', i.name, 'code', i.code,
    'unit', i.unit, 'balance', i.balance::text
  ) ORDER BY i.name, i.id), '[]'::jsonb)
  FROM public.partner_items AS i
  WHERE i.chain_id = p_chain AND i.active;
$$;

REVOKE ALL ON FUNCTION partner_internal.save_stocktake(uuid, bigint, uuid, jsonb, text),
  public.partner_save_stocktake(uuid, bigint, uuid, jsonb, text),
  public.partner_stocktake_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.save_stocktake(uuid, bigint, uuid, jsonb, text),
  public.partner_save_stocktake(uuid, bigint, uuid, jsonb, text),
  public.partner_stocktake_items(uuid) TO authenticated;

-- Partner reward activity breakdown
-- Use the same authorized matches for charts, grouped events, and reconciliation exports.
CREATE OR REPLACE FUNCTION public.partner_snapshot(p_section text DEFAULT 'overview',p_input jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; r text; acc public.partner_accounts; result jsonb; start_at timestamptz; end_at timestamptz;
 local_today date; report_from date; report_to date; bucket_days integer; coverage_day date;
 export_csv boolean := coalesce(p_input->>'export' = 'csv', false);
 export_limit constant integer := 10000;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_section='staff' THEN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('actor',auth.uid(),'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('name',c.name)),'[]') FROM public.partner_accounts a JOIN public."Chains" c ON c.id=a.chain_id),
   'changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT ch.*,c.name AS cafe_name,to_jsonb(c) AS current_values FROM public.partner_changes ch LEFT JOIN public."Cafe" c ON c.id=ch.cafe_id WHERE status='pending' ORDER BY ch.created_at LIMIT 100) x));
 END IF;
 SELECT chain_id,role INTO cid,r FROM public.partner_memberships WHERE user_id=auth.uid() AND revoked_at IS NULL;
 IF cid IS NULL THEN RAISE EXCEPTION 'No active partner membership' USING ERRCODE='42501'; END IF;
 SELECT * INTO acc FROM public.partner_accounts WHERE chain_id=cid;
 result=jsonb_build_object('actor',auth.uid(),'chain_id',cid,'role',r,'plan',acc.plan,'timezone',acc.timezone,'selection_required',acc.selection_required,'coverage_at',acc.reward_coverage_at,'name',(SELECT name FROM public."Chains" WHERE id=cid));
 IF p_section='selection' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required'; END IF;
  RETURN result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'is_active',is_active)),'[]') FROM public."Cafe" WHERE chain_id=cid));
 END IF;
 result=result||jsonb_build_object('cafes',(SELECT coalesce(jsonb_agg(to_jsonb(c)-ARRAY['reward_code','fts_vectors','location']),'[]') FROM public."Cafe" c WHERE public.partner_can_cafe(c.id)));
 IF p_section='cafes' THEN
  RETURN result||jsonb_build_object('changes',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_changes WHERE chain_id=cid AND (public.partner_can_cafe(cafe_id) OR (cafe_id IS NULL AND r IN ('owner','chain_manager'))) ORDER BY created_at DESC LIMIT 100) x));
 ELSIF p_section='cafe' THEN
  IF NOT public.partner_can_cafe((p_input->>'id')::bigint) THEN RAISE EXCEPTION 'Cafe access denied' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('cafe',(SELECT to_jsonb(c)-ARRAY['fts_vectors','location'] FROM public."Cafe" c WHERE id=(p_input->>'id')::bigint),'gallery',(SELECT coalesce(to_jsonb(images_url),'[]') FROM public."CafeImages" WHERE cafe_id=(p_input->>'id')::bigint),'menu',(SELECT coalesce(jsonb_agg(m),'[]') FROM public."CafeMenu" m WHERE cafe_id=(p_input->>'id')::bigint));
 ELSIF p_section='rewards' THEN
  local_today := (now() AT TIME ZONE acc.timezone)::date;
  result := result || jsonb_build_object('refreshed_at', now());
  BEGIN
   report_from := coalesce(nullif(p_input->>'from', '')::date,
    CASE WHEN p_input->>'range' = 'week' THEN date_trunc('week', local_today::timestamp)::date
         ELSE local_today - 29 END);
   report_to := coalesce(nullif(p_input->>'to', '')::date, local_today);
   IF NOT isfinite(report_from) OR NOT isfinite(report_to) THEN
    RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
   END IF;
   start_at := report_from::timestamp AT TIME ZONE acc.timezone;
   end_at := (report_to + 1)::timestamp AT TIME ZONE acc.timezone;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
   RETURN result || jsonb_build_object('reward_error', 'Enter valid start and end dates.');
  END;
  IF report_to < report_from THEN
   RETURN result || jsonb_build_object('reward_error', 'Choose an end date on or after the start date.');
  END IF;

  -- Keep a bounded chart even when a custom range spans multiple years.
  bucket_days := greatest(1, ceil((report_to - report_from + 1)::numeric / 30)::integer);
  coverage_day := (acc.reward_coverage_at AT TIME ZONE acc.timezone)::date;
  RETURN result || jsonb_build_object(
   'reward_from', report_from, 'reward_to', report_to, 'reward_export_limit', export_limit
  ) || (
   WITH matches AS MATERIALIZED (
    SELECT rw.id, rw.redeemed_cafe_id AS cafe_id, c.name AS cafe_name,
     rw.redeemed_at AS occurred_at, rw.status,
     row_number() OVER (
      ORDER BY CASE WHEN NOT export_csv THEN c.name END,
       CASE WHEN NOT export_csv THEN c.id END, rw.redeemed_at DESC, rw.id
     ) AS rn,
     CASE WHEN export_csv THEN
      to_char(rw.redeemed_at AT TIME ZONE acc.timezone, 'YYYY-MM-DD HH24:MI:SS.US')
     END AS occurred_local,
     CASE WHEN export_csv THEN
      to_char(rw.redeemed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
     END AS occurred_utc
    FROM public."Rewards" rw
    JOIN public."Cafe" c ON c.id = rw.redeemed_cafe_id
    WHERE rw.chain_id = cid AND rw.status = 'redeemed'
      AND rw.redeemed_at >= greatest(start_at, acc.reward_coverage_at)
      AND rw.redeemed_at < end_at AND rw.redeemed_at <= now()
      AND public.partner_can_cafe(c.id)
      AND (p_input->>'cafe_id' IS NULL OR c.id = (p_input->>'cafe_id')::bigint)
   ), totals AS (SELECT count(*) AS total FROM matches)
   SELECT jsonb_build_object('total', totals.total, 'events', coalesce((
    SELECT jsonb_agg(
     CASE WHEN export_csv THEN to_jsonb(m) ELSE to_jsonb(m) - 'occurred_local' - 'occurred_utc' END
     ORDER BY m.rn
    ) FROM matches m
    WHERE CASE WHEN export_csv THEN totals.total <= export_limit
     ELSE m.rn > coalesce((p_input->>'offset')::int, 0)
      AND m.rn <= coalesce((p_input->>'offset')::int, 0)::bigint + 50
    END
   ), '[]'::jsonb))
   || CASE WHEN export_csv THEN '{}'::jsonb ELSE jsonb_build_object(
    'reward_cafe_totals', coalesce((
     SELECT jsonb_agg(to_jsonb(c) ORDER BY c.total DESC, c.cafe_name, c.cafe_id)
     FROM (SELECT cafe_id, cafe_name, count(*) AS total FROM matches GROUP BY cafe_id, cafe_name) c
    ), '[]'::jsonb),
    'reward_trend', (
     WITH activity AS (
      SELECT ((occurred_at AT TIME ZONE acc.timezone)::date - report_from) / bucket_days * bucket_days AS bucket,
       count(*) AS total
      FROM matches GROUP BY 1
     )
     SELECT jsonb_agg(jsonb_build_object(
      'from', report_from + b.bucket,
      'through', least(report_to, report_from + b.bucket + (bucket_days - 1)),
      'total', coalesce(a.total, 0),
      'tracked', report_from + b.bucket <= local_today
       AND least(report_to, report_from + b.bucket + (bucket_days - 1)) >= coverage_day
     ) ORDER BY b.bucket)
     FROM generate_series(0, report_to - report_from, bucket_days) b(bucket)
     LEFT JOIN activity a USING (bucket)
    )
   ) END FROM totals
  );
 ELSIF p_section IN ('inventory','recipes') THEN
  IF acc.plan<>'paid' THEN RAISE EXCEPTION 'Upgrade to Paid to access inventory and recipes' USING ERRCODE='42501'; END IF;
  IF p_section='inventory' THEN RETURN result||jsonb_build_object('items',(SELECT coalesce(jsonb_agg(i),'[]') FROM public.partner_items i WHERE chain_id=cid AND public.partner_can_cafe(cafe_id)),'movements',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT * FROM public.partner_movements WHERE chain_id=cid AND public.partner_can_cafe(cafe_id) ORDER BY created_at DESC,id LIMIT 100) x)); END IF;
  -- Shared recipes expose ingredient definitions, never other cafes' balances.
  RETURN result||jsonb_build_object('recipes',(SELECT coalesce(jsonb_agg(x),'[]') FROM public.partner_recipes x WHERE chain_id=cid),'ingredients',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit)),'[]') FROM public.partner_items WHERE chain_id=cid AND type='ingredient' AND active));
 ELSIF p_section='team' THEN
  IF r<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  RETURN result||jsonb_build_object('members',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT m.id,m.user_id,m.role,m.revoked_at,u.email FROM public.partner_memberships m JOIN auth.users u ON u.id=m.user_id WHERE chain_id=cid) x),'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'token_hash'),'[]') FROM public.partner_invitations i WHERE chain_id=cid));
 END IF;
 RETURN result;
END $$;

-- Partner recipe consumption
CREATE FUNCTION partner_internal.consume_recipe(
  p_chain uuid, p_cafe bigint, p_recipe uuid, p_revision bigint, p_servings numeric, p_request uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  recipe public.partner_recipes;
  saved public.partner_operations;
  receipt jsonb := jsonb_build_object(
    'chain_id', p_chain, 'cafe_id', p_cafe, 'recipe_id', p_recipe, 'revision', p_revision, 'servings', p_servings
  );
  deductions jsonb;
  item_count integer;
BEGIN
  IF actor_id IS NULL OR p_request IS NULL THEN
    RAISE EXCEPTION 'Authenticated user and request ID required' USING ERRCODE = '42501';
  END IF;
  IF p_servings IS NULL OR NOT (p_servings > 0 AND p_servings < 1000000000000) THEN
    RAISE EXCEPTION 'Enter a valid number of servings greater than zero.' USING ERRCODE = '22023';
  END IF;

  -- Share the lock order with inventory movements, recipe edits, and plan changes.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor_id::text || p_request::text, 0));
  PERFORM 1 FROM public.partner_accounts WHERE chain_id = p_chain FOR UPDATE;
  IF NOT FOUND OR NOT public.partner_paid(p_chain) OR NOT public.partner_can_cafe(p_cafe)
    OR NOT EXISTS (
      SELECT 1 FROM public."Cafe" WHERE id = p_cafe AND chain_id = p_chain AND is_active IS TRUE
    )
  THEN
    RAISE EXCEPTION 'Paid access to this active café is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO saved FROM public.partner_operations WHERE actor = actor_id AND request_id = p_request;
  IF FOUND THEN
    IF saved.action <> 'consume_recipe' OR saved.input <> receipt THEN
      RAISE EXCEPTION 'Request ID was reused with different data.' USING ERRCODE = '22023';
    END IF;
    RETURN (saved.result->>'count')::integer;
  END IF;

  SELECT * INTO recipe FROM public.partner_recipes WHERE id = p_recipe AND chain_id = p_chain;
  IF NOT FOUND OR NOT recipe.active OR recipe.revision IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'This recipe changed or is unavailable. Reopen it before recording servings.'
      USING ERRCODE = 'PT409';
  END IF;

  SELECT jsonb_agg(to_jsonb(d)) INTO deductions
  FROM (
    SELECT stock.stock_item_id AS item_id,
      round(sum(line.quantity) * p_servings / recipe.yield, 6) AS quantity
    FROM jsonb_to_recordset(recipe.ingredients) AS line(item_id uuid, quantity numeric)
    LEFT JOIN jsonb_to_recordset(public.partner_recipe_stock(p_recipe, p_cafe))
      AS stock(ingredient_id uuid, stock_item_id uuid) ON stock.ingredient_id = line.item_id
    GROUP BY stock.stock_item_id
  ) d;
  IF deductions IS NULL OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(deductions) AS d(item_id uuid, quantity numeric)
    WHERE d.item_id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more ingredients have no matching stock item at this café.'
      USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(deductions) AS d(quantity numeric)
    WHERE d.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Enter more servings so every deduction is at least 0.000001 in its stock unit.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.partner_items i
    JOIN jsonb_to_recordset(deductions) AS d(item_id uuid) ON d.item_id = i.id
    ORDER BY i.id FOR UPDATE OF i;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(deductions) AS d(item_id uuid, quantity numeric)
    LEFT JOIN public.partner_items i ON i.id = d.item_id
      AND i.chain_id = p_chain AND i.cafe_id = p_cafe AND i.active
    WHERE i.id IS NULL OR d.quantity > i.balance
  ) THEN
    RAISE EXCEPTION 'There is no longer enough matching stock for this batch. Check stock and try again.'
      USING ERRCODE = 'PT409';
  END IF;

  WITH updated AS (
    UPDATE public.partner_items i SET balance = i.balance - d.quantity
    FROM jsonb_to_recordset(deductions) AS d(item_id uuid, quantity numeric)
    WHERE i.id = d.item_id
    RETURNING i.id, i.balance, d.quantity
  )
  INSERT INTO public.partner_movements(chain_id, cafe_id, item_id, quantity, resulting_balance, type, actor, reason)
  SELECT p_chain, p_cafe, id, -quantity, balance, 'consumption', actor_id,
    recipe.name || ' · ' || trim_scale(p_servings)::text || ' servings made'
  FROM updated;
  GET DIAGNOSTICS item_count = ROW_COUNT;

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (p_chain, actor_id, 'consume_recipe', p_recipe::text, receipt);
  INSERT INTO public.partner_operations(actor, request_id, action, input, result)
  VALUES (actor_id, p_request, 'consume_recipe', receipt, jsonb_build_object('count', item_count));
  RETURN item_count;
END;
$$;

CREATE FUNCTION public.partner_consume_recipe(
  p_chain uuid, p_cafe bigint, p_recipe uuid, p_revision bigint, p_servings numeric, p_request uuid
) RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.consume_recipe(p_chain, p_cafe, p_recipe, p_revision, p_servings, p_request);
$$;

REVOKE ALL ON FUNCTION partner_internal.consume_recipe(uuid, bigint, uuid, bigint, numeric, uuid),
  public.partner_consume_recipe(uuid, bigint, uuid, bigint, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.consume_recipe(uuid, bigint, uuid, bigint, numeric, uuid),
  public.partner_consume_recipe(uuid, bigint, uuid, bigint, numeric, uuid) TO authenticated;

-- Partner sales report
CREATE TABLE public.partner_sales_daily (
  chain_id uuid NOT NULL REFERENCES public.partner_accounts(chain_id),
  cafe_id bigint NOT NULL,
  sale_date date NOT NULL CHECK (isfinite(sale_date)),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  gross_sales numeric(12,2) NOT NULL CHECK (gross_sales >= 0 AND gross_sales < 10000000000),
  discounts numeric(12,2) NOT NULL CHECK (discounts >= 0 AND discounts < 10000000000),
  refunds numeric(12,2) NOT NULL CHECK (refunds >= 0 AND refunds < 10000000000),
  tax numeric(12,2) NOT NULL CHECK (abs(tax) < 10000000000),
  orders integer NOT NULL CHECK (orders >= 0),
  PRIMARY KEY (chain_id, cafe_id, sale_date),
  FOREIGN KEY (cafe_id, chain_id) REFERENCES public."Cafe"(id, chain_id)
);
CREATE INDEX partner_sales_daily_period ON public.partner_sales_daily(chain_id, sale_date);
ALTER TABLE public.partner_sales_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_sales_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.partner_sales_daily TO authenticated;
CREATE POLICY partner_sales_daily_read ON public.partner_sales_daily FOR SELECT TO authenticated
  USING (public.partner_role(chain_id) IS NOT NULL AND public.partner_can_cafe(cafe_id));

CREATE FUNCTION partner_internal.import_daily_sales(
  p_chain uuid, p_cafe bigint, p_rows jsonb, p_replace boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  account_timezone text;
  local_today date;
  changed integer;
BEGIN
  IF actor_id IS NULL OR coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager') THEN
    RAISE EXCEPTION 'An Owner or Chain Manager is required to import sales.' USING ERRCODE = '42501';
  END IF;
  SELECT timezone INTO account_timezone FROM public.partner_accounts WHERE chain_id = p_chain FOR UPDATE;
  IF NOT FOUND OR coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager')
    OR NOT public.partner_can_cafe(p_cafe) OR NOT EXISTS (
      SELECT 1 FROM public."Cafe" WHERE id = p_cafe AND chain_id = p_chain AND is_active IS TRUE
    )
  THEN
    RAISE EXCEPTION 'An Owner or Chain Manager must select an active café they manage.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Provide daily sales rows.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION 'Import between 1 and 366 daily rows.' USING ERRCODE = '22023';
  END IF;
  local_today := (now() AT TIME ZONE account_timezone)::date;

  IF jsonb_array_length(p_rows) <> (
    SELECT count(DISTINCT sale_date) FROM jsonb_to_recordset(p_rows) AS row(sale_date date)
  ) THEN
    RAISE EXCEPTION 'Include exactly one row per date.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS row(
      sale_date date, currency text, gross_sales numeric, discounts numeric,
      refunds numeric, tax numeric, orders integer
    )
    WHERE NOT isfinite(sale_date) OR sale_date > local_today
      OR (currency ~ '^[A-Z]{3}$') IS NOT TRUE
      OR (gross_sales >= 0 AND gross_sales < 10000000000 AND scale(gross_sales) <= 2) IS NOT TRUE
      OR (discounts >= 0 AND discounts < 10000000000 AND scale(discounts) <= 2) IS NOT TRUE
      OR (refunds >= 0 AND refunds < 10000000000 AND scale(refunds) <= 2) IS NOT TRUE
      OR (abs(tax) < 10000000000 AND scale(tax) <= 2) IS NOT TRUE
      OR (orders >= 0) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Check the business dates, currency, and amounts in the CSV. Future dates are unavailable.' USING ERRCODE = '22023';
  END IF;

  IF NOT coalesce(p_replace, false) AND EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS row(
      sale_date date, currency text, gross_sales numeric, discounts numeric,
      refunds numeric, tax numeric, orders integer
    )
    JOIN public.partner_sales_daily d ON d.chain_id = p_chain AND d.cafe_id = p_cafe AND d.sale_date = row.sale_date
    WHERE (d.currency, d.gross_sales, d.discounts, d.refunds, d.tax, d.orders)
      IS DISTINCT FROM (row.currency, row.gross_sales, row.discounts, row.refunds, row.tax, row.orders)
  ) THEN
    RAISE EXCEPTION 'This file changes an existing day. Select “Replace existing days” to import corrections.' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.partner_sales_daily AS d(chain_id,cafe_id,sale_date,currency,gross_sales,discounts,refunds,tax,orders)
  SELECT p_chain,p_cafe,row.sale_date,row.currency,row.gross_sales,row.discounts,row.refunds,row.tax,row.orders
  FROM jsonb_to_recordset(p_rows) AS row(
    sale_date date, currency text, gross_sales numeric, discounts numeric,
    refunds numeric, tax numeric, orders integer
  )
  ON CONFLICT (chain_id,cafe_id,sale_date) DO UPDATE SET
    currency=excluded.currency,gross_sales=excluded.gross_sales,discounts=excluded.discounts,
    refunds=excluded.refunds,tax=excluded.tax,orders=excluded.orders
  WHERE (d.currency, d.gross_sales, d.discounts, d.refunds, d.tax, d.orders)
    IS DISTINCT FROM (excluded.currency, excluded.gross_sales, excluded.discounts, excluded.refunds, excluded.tax, excluded.orders);
  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed > 0 THEN
    INSERT INTO public.partner_audit(chain_id,actor,action,target,details)
    VALUES (p_chain,actor_id,'import_daily_sales',p_cafe::text,jsonb_build_object('changed_days',changed,'replace',coalesce(p_replace,false)));
  END IF;
  RETURN changed;
END;
$$;

CREATE FUNCTION public.partner_import_daily_sales(
  p_chain uuid, p_cafe bigint, p_rows jsonb, p_replace boolean DEFAULT false
) RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.import_daily_sales(p_chain,p_cafe,p_rows,p_replace);
$$;

CREATE FUNCTION public.partner_sales_report(
  p_chain uuid, p_cafe bigint DEFAULT NULL, p_from date DEFAULT NULL,
  p_to date DEFAULT NULL, p_currency text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  local_today date;
  report_from date;
  report_to date;
  bucket_days integer;
BEGIN
  SELECT (now() AT TIME ZONE timezone)::date INTO local_today
  FROM public.partner_accounts WHERE chain_id = p_chain AND public.partner_role(p_chain) IS NOT NULL;
  IF NOT FOUND OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Sales report access is required.' USING ERRCODE = '42501';
  END IF;
  report_to := coalesce(p_to,local_today);
  IF NOT isfinite(report_to) OR (p_from IS NOT NULL AND NOT isfinite(p_from)) THEN
    RAISE EXCEPTION 'Enter valid report dates.' USING ERRCODE = '22023';
  END IF;
  IF report_to > local_today THEN
    RAISE EXCEPTION 'Choose an end date no later than today.' USING ERRCODE = '22023';
  END IF;
  report_from := coalesce(p_from,report_to-29);
  IF report_to < report_from OR report_to-report_from >= 366 THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Choose a valid currency.' USING ERRCODE = '22023';
  END IF;
  bucket_days := greatest(1, ceil((report_to-report_from+1)::numeric/30)::integer);

  RETURN (
    WITH scope AS MATERIALIZED (
      SELECT cafe_id,sale_date,currency,gross_sales,discounts,refunds,tax,orders,
        gross_sales-discounts-refunds AS net
      FROM public.partner_sales_daily
      WHERE chain_id=p_chain AND sale_date BETWEEN report_from AND report_to
        AND (p_cafe IS NULL OR cafe_id=p_cafe)
    ), options AS (
      SELECT coalesce(p_currency,min(currency) FILTER (WHERE currency='NGN'),min(currency),'NGN') AS currency,
        coalesce(jsonb_agg(DISTINCT currency ORDER BY currency),'[]') AS currencies
      FROM scope
    ), filtered AS MATERIALIZED (
      SELECT s.* FROM scope s JOIN options o USING (currency)
    ), trend AS (
      SELECT ((sale_date-report_from)/bucket_days)*bucket_days AS bucket,sum(net) AS net
      FROM filtered GROUP BY 1
    )
    SELECT jsonb_build_object(
      'from',report_from,'through',report_to,'currency',o.currency,'currencies',o.currencies,
      'totals',(SELECT jsonb_build_object(
        'gross',coalesce(sum(gross_sales),0),'discounts',coalesce(sum(discounts),0),
        'refunds',coalesce(sum(refunds),0),'tax',coalesce(sum(tax),0),
        'net',coalesce(sum(net),0),'orders',coalesce(sum(orders),0),'rows',count(*)
      ) FROM filtered),
      'cafes',coalesce((
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.net DESC,c.cafe_id)
        FROM (SELECT cafe_id,sum(net) AS net,sum(orders) AS orders,count(*) AS days FROM filtered GROUP BY cafe_id) c
      ),'[]'),
      'trend',(
        SELECT jsonb_agg(jsonb_build_object(
          'from',report_from+b.bucket,'through',least(report_to,report_from+b.bucket+(bucket_days-1)),
          'net',t.net
        ) ORDER BY b.bucket)
        FROM generate_series(0,report_to-report_from,bucket_days) b(bucket) LEFT JOIN trend t USING (bucket)
      )
    ) FROM options o
  );
END;
$$;

REVOKE ALL ON FUNCTION partner_internal.import_daily_sales(uuid,bigint,jsonb,boolean),
  public.partner_import_daily_sales(uuid,bigint,jsonb,boolean),
  public.partner_sales_report(uuid,bigint,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.import_daily_sales(uuid,bigint,jsonb,boolean),
  public.partner_import_daily_sales(uuid,bigint,jsonb,boolean),
  public.partner_sales_report(uuid,bigint,date,date,text) TO authenticated;

-- Partner recipe sales
ALTER TABLE public.partner_recipes ADD UNIQUE (id, chain_id);

CREATE TABLE public.partner_recipe_sales_daily (
  chain_id uuid NOT NULL,
  cafe_id bigint NOT NULL,
  sale_date date NOT NULL CHECK (isfinite(sale_date)),
  recipe_id uuid NOT NULL,
  servings_sold integer NOT NULL CHECK (servings_sold >= 0),
  PRIMARY KEY (chain_id, sale_date, cafe_id, recipe_id),
  FOREIGN KEY (cafe_id, chain_id) REFERENCES public."Cafe"(id, chain_id),
  FOREIGN KEY (recipe_id, chain_id) REFERENCES public.partner_recipes(id, chain_id)
);
ALTER TABLE public.partner_recipe_sales_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_recipe_sales_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_recipe_sales_daily TO authenticated;
CREATE POLICY partner_recipe_sales_read ON public.partner_recipe_sales_daily FOR SELECT TO authenticated
  USING (public.partner_paid(chain_id) AND public.partner_can_cafe(cafe_id));

CREATE FUNCTION partner_internal.import_recipe_sales(
  p_chain uuid, p_cafe bigint, p_rows jsonb, p_replace boolean
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  account_timezone text;
  resolved jsonb;
  bad_recipe text;
  changed integer;
BEGIN
  IF coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager') THEN
    RAISE EXCEPTION 'An Owner or Chain Manager is required to import recipe sales.' USING ERRCODE = '42501';
  END IF;
  SELECT timezone INTO account_timezone FROM public.partner_accounts WHERE chain_id = p_chain FOR UPDATE;
  IF NOT FOUND OR NOT public.partner_paid(p_chain)
    OR coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager')
    OR NOT public.partner_can_cafe(p_cafe) OR NOT EXISTS (
      SELECT 1 FROM public."Cafe" WHERE id = p_cafe AND chain_id = p_chain AND is_active IS TRUE
    )
  THEN
    RAISE EXCEPTION 'Paid access to an active café you manage is required.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Provide recipe sales rows.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 2000 OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS row(sale_date date, recipe text, servings_sold integer)
    WHERE sale_date IS NULL OR NOT isfinite(sale_date) OR sale_date > (now() AT TIME ZONE account_timezone)::date
      OR (length(btrim(recipe)) BETWEEN 1 AND 200) IS NOT TRUE OR (servings_sold >= 0) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Provide 1 to 2,000 rows with valid business dates, recipes, and whole-number servings sold.' USING ERRCODE = '22023';
  END IF;

  WITH refs AS (
    SELECT DISTINCT lower(btrim(recipe)) AS label
    FROM jsonb_to_recordset(p_rows) AS row(recipe text)
  ), matches AS (
    SELECT ref.label, min(r.id::text) AS recipe_id, count(r.id) AS match_count
    FROM refs ref LEFT JOIN public.partner_recipes r ON r.chain_id = p_chain
      AND (lower(btrim(r.name)) = ref.label OR r.id::text = ref.label)
    GROUP BY ref.label
  )
  SELECT jsonb_agg(jsonb_build_object('sale_date', row.sale_date, 'recipe_id', m.recipe_id, 'servings_sold', row.servings_sold)),
    min(row.recipe) FILTER (WHERE m.match_count <> 1)
  INTO resolved, bad_recipe
  FROM jsonb_to_recordset(p_rows) AS row(sale_date date, recipe text, servings_sold integer)
  JOIN matches m ON m.label = lower(btrim(row.recipe));

  IF bad_recipe IS NOT NULL THEN
    RAISE EXCEPTION 'Could not match “%” to one chain recipe. Use its exact name or recipe ID.', bad_recipe USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(resolved) <> (
    SELECT count(DISTINCT (sale_date, recipe_id)) FROM jsonb_to_recordset(resolved) AS row(sale_date date, recipe_id uuid)
  ) THEN
    RAISE EXCEPTION 'Include only one row per recipe and business date.' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(p_replace, false) AND EXISTS (
    SELECT 1 FROM jsonb_to_recordset(resolved) AS row(sale_date date, recipe_id uuid, servings_sold integer)
    JOIN public.partner_recipe_sales_daily d ON d.chain_id = p_chain AND d.cafe_id = p_cafe
      AND d.sale_date = row.sale_date AND d.recipe_id = row.recipe_id
    WHERE d.servings_sold <> row.servings_sold
  ) THEN
    RAISE EXCEPTION 'This file changes existing recipe sales. Select “Replace existing recipe sales” to import corrections.' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.partner_recipe_sales_daily AS d(chain_id, cafe_id, sale_date, recipe_id, servings_sold)
  SELECT p_chain, p_cafe, row.sale_date, row.recipe_id, row.servings_sold
  FROM jsonb_to_recordset(resolved) AS row(sale_date date, recipe_id uuid, servings_sold integer)
  ON CONFLICT (chain_id, sale_date, cafe_id, recipe_id) DO UPDATE SET servings_sold = excluded.servings_sold
  WHERE d.servings_sold <> excluded.servings_sold;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed > 0 THEN
    INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
    VALUES (p_chain, auth.uid(), 'import_recipe_sales', p_cafe::text, jsonb_build_object('changed_rows', changed));
  END IF;
  RETURN changed;
END;
$$;

CREATE FUNCTION public.partner_import_recipe_sales(
  p_chain uuid, p_cafe bigint, p_rows jsonb, p_replace boolean DEFAULT false
) RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.import_recipe_sales(p_chain, p_cafe, p_rows, p_replace);
$$;

CREATE FUNCTION public.partner_recipe_sales_report(p_chain uuid, p_from date, p_to date, p_cafe bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.partner_paid(p_chain) OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Paid café access is required for recipe sales.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
    OR p_to < p_from OR p_to - p_from >= 366
  THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH by_cafe AS (
      SELECT s.recipe_id, s.cafe_id, sum(s.servings_sold) AS servings_sold
      FROM public.partner_recipe_sales_daily s
      WHERE s.chain_id = p_chain AND s.sale_date BETWEEN p_from AND p_to AND (p_cafe IS NULL OR s.cafe_id = p_cafe)
      GROUP BY s.recipe_id, s.cafe_id
    )
    SELECT coalesce(jsonb_agg(to_jsonb(ranked) ORDER BY servings_sold DESC, name, recipe_id), '[]'::jsonb)
    FROM (
      SELECT r.id AS recipe_id, r.name, sum(s.servings_sold) AS servings_sold,
        jsonb_agg(jsonb_build_object('cafe_id', s.cafe_id, 'servings_sold', s.servings_sold) ORDER BY s.cafe_id) AS cafes
      FROM by_cafe s
      JOIN public.partner_recipes r ON r.id = s.recipe_id AND r.chain_id = p_chain
      GROUP BY r.id, r.name
      HAVING sum(s.servings_sold) > 0
      ORDER BY servings_sold DESC, r.name, r.id
      LIMIT 10
    ) ranked
  );
END;
$$;

REVOKE ALL ON FUNCTION partner_internal.import_recipe_sales(uuid,bigint,jsonb,boolean),
  public.partner_import_recipe_sales(uuid,bigint,jsonb,boolean),
  public.partner_recipe_sales_report(uuid,date,date,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.import_recipe_sales(uuid,bigint,jsonb,boolean),
  public.partner_import_recipe_sales(uuid,bigint,jsonb,boolean),
  public.partner_recipe_sales_report(uuid,date,date,bigint) TO authenticated;

-- Partner sales order sources
-- This ledger contains recognized sales. Checkout and order fulfillment stay with
-- the source system. Channel records where the customer placed the order.
CREATE TABLE public.partner_sales_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id uuid NOT NULL,
  cafe_id bigint NOT NULL,
  source text NOT NULL CHECK (length(btrim(source)) > 0),
  source_order_id text NOT NULL CHECK (length(btrim(source_order_id)) > 0),
  channel text NOT NULL CHECK (channel IN ('pos', 'mobile')),
  sale_date date NOT NULL CHECK (isfinite(sale_date)),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  gross_sales numeric(12,2) NOT NULL CHECK (gross_sales >= 0 AND gross_sales < 10000000000),
  discounts numeric(12,2) NOT NULL CHECK (discounts >= 0 AND discounts < 10000000000),
  refunds numeric(12,2) NOT NULL CHECK (refunds >= 0 AND refunds < 10000000000),
  tax numeric(12,2) NOT NULL CHECK (abs(tax) < 10000000000),
  UNIQUE (chain_id, source, source_order_id),
  UNIQUE (id, chain_id, cafe_id),
  FOREIGN KEY (cafe_id, chain_id) REFERENCES public."Cafe"(id, chain_id)
);
CREATE INDEX partner_sales_orders_period ON public.partner_sales_orders(chain_id, sale_date, cafe_id);

CREATE TABLE public.partner_sales_order_recipes (
  order_id bigint NOT NULL,
  chain_id uuid NOT NULL,
  cafe_id bigint NOT NULL,
  recipe_id uuid NOT NULL,
  servings_sold integer NOT NULL CHECK (servings_sold > 0),
  PRIMARY KEY (order_id, recipe_id),
  FOREIGN KEY (order_id, chain_id, cafe_id) REFERENCES public.partner_sales_orders(id, chain_id, cafe_id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id, chain_id) REFERENCES public.partner_recipes(id, chain_id)
);

-- A café date is marked covered only after its complete order history is reconciled.
-- Keep CSV history for all other days, even when individual orders are available.
CREATE TABLE public.partner_sales_order_coverage (
  chain_id uuid NOT NULL,
  cafe_id bigint NOT NULL,
  sale_date date NOT NULL CHECK (isfinite(sale_date)),
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, sale_date, cafe_id),
  FOREIGN KEY (cafe_id, chain_id) REFERENCES public."Cafe"(id, chain_id)
);

ALTER TABLE public.partner_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sales_order_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sales_order_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_sales_orders, public.partner_sales_order_recipes,
  public.partner_sales_order_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_sales_orders, public.partner_sales_order_recipes,
  public.partner_sales_order_coverage TO authenticated;
CREATE POLICY partner_sales_orders_read ON public.partner_sales_orders FOR SELECT TO authenticated
  USING (public.partner_role(chain_id) IS NOT NULL AND public.partner_can_cafe(cafe_id));
CREATE POLICY partner_sales_order_coverage_read ON public.partner_sales_order_coverage FOR SELECT TO authenticated
  USING (public.partner_role(chain_id) IS NOT NULL AND public.partner_can_cafe(cafe_id));
CREATE POLICY partner_sales_order_recipes_read ON public.partner_sales_order_recipes FOR SELECT TO authenticated
  USING (public.partner_paid(chain_id) AND public.partner_can_cafe(cafe_id));

CREATE VIEW public.partner_effective_sales_daily WITH (security_invoker = true) AS
SELECT d.chain_id, d.cafe_id, d.sale_date, d.currency, d.gross_sales, d.discounts, d.refunds, d.tax, d.orders::bigint,
  NULL::text AS channel
FROM public.partner_sales_daily d
WHERE NOT EXISTS (
  SELECT 1 FROM public.partner_sales_order_coverage c
  WHERE (c.chain_id, c.sale_date, c.cafe_id) = (d.chain_id, d.sale_date, d.cafe_id)
)
UNION ALL
SELECT o.chain_id, o.cafe_id, o.sale_date, o.currency,
  sum(o.gross_sales), sum(o.discounts), sum(o.refunds), sum(o.tax), count(*), o.channel
FROM public.partner_sales_orders o
JOIN public.partner_sales_order_coverage c USING (chain_id, cafe_id, sale_date)
GROUP BY o.chain_id, o.cafe_id, o.sale_date, o.currency, o.channel;

CREATE VIEW public.partner_effective_recipe_sales_daily WITH (security_invoker = true) AS
SELECT d.chain_id, d.cafe_id, d.sale_date, d.recipe_id, d.servings_sold::bigint
FROM public.partner_recipe_sales_daily d
WHERE NOT EXISTS (
  SELECT 1 FROM public.partner_sales_order_coverage c
  WHERE (c.chain_id, c.sale_date, c.cafe_id) = (d.chain_id, d.sale_date, d.cafe_id)
)
UNION ALL
SELECT o.chain_id, o.cafe_id, o.sale_date, r.recipe_id, sum(r.servings_sold)
FROM public.partner_sales_orders o
JOIN public.partner_sales_order_coverage c USING (chain_id, cafe_id, sale_date)
JOIN public.partner_sales_order_recipes r ON (r.order_id, r.chain_id, r.cafe_id) = (o.id, o.chain_id, o.cafe_id)
GROUP BY o.chain_id, o.cafe_id, o.sale_date, r.recipe_id;

REVOKE ALL ON public.partner_effective_sales_daily, public.partner_effective_recipe_sales_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_effective_sales_daily, public.partner_effective_recipe_sales_daily TO authenticated;

CREATE FUNCTION partner_internal.protect_synced_sales_days()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.partner_sales_order_coverage c
    WHERE (c.chain_id, c.sale_date, c.cafe_id) = (new.chain_id, new.sale_date, new.cafe_id)
  ) THEN
    RAISE EXCEPTION 'This café date is synced from orders. Upload a CSV for a date outside order coverage.' USING ERRCODE = 'PT409';
  END IF;
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION partner_internal.protect_synced_sales_days() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER partner_sales_prefer_synced_orders
  BEFORE INSERT OR UPDATE ON public.partner_sales_daily
  FOR EACH ROW EXECUTE FUNCTION partner_internal.protect_synced_sales_days();
CREATE TRIGGER partner_recipe_sales_prefer_synced_orders
  BEFORE INSERT OR UPDATE ON public.partner_recipe_sales_daily
  FOR EACH ROW EXECUTE FUNCTION partner_internal.protect_synced_sales_days();

CREATE OR REPLACE FUNCTION public.partner_sales_report(
  p_chain uuid, p_cafe bigint DEFAULT NULL, p_from date DEFAULT NULL,
  p_to date DEFAULT NULL, p_currency text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  local_today date;
  report_from date;
  report_to date;
  bucket_days integer;
BEGIN
  SELECT (now() AT TIME ZONE timezone)::date INTO local_today
  FROM public.partner_accounts WHERE chain_id = p_chain AND public.partner_role(p_chain) IS NOT NULL;
  IF NOT FOUND OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Sales report access is required.' USING ERRCODE = '42501';
  END IF;
  report_to := coalesce(p_to,local_today);
  IF NOT isfinite(report_to) OR (p_from IS NOT NULL AND NOT isfinite(p_from)) THEN
    RAISE EXCEPTION 'Enter valid report dates.' USING ERRCODE = '22023';
  END IF;
  IF report_to > local_today THEN
    RAISE EXCEPTION 'Choose an end date no later than today.' USING ERRCODE = '22023';
  END IF;
  report_from := coalesce(p_from,report_to-29);
  IF report_to < report_from OR report_to-report_from >= 366 THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Choose a valid currency.' USING ERRCODE = '22023';
  END IF;
  bucket_days := greatest(1, ceil((report_to-report_from+1)::numeric/30)::integer);

  RETURN (
    WITH scope AS MATERIALIZED (
      SELECT cafe_id,sale_date,currency,gross_sales,discounts,refunds,tax,orders,channel,
        gross_sales-discounts-refunds AS net
      FROM public.partner_effective_sales_daily
      WHERE chain_id=p_chain AND sale_date BETWEEN report_from AND report_to
        AND (p_cafe IS NULL OR cafe_id=p_cafe)
    ), options AS (
      SELECT coalesce(p_currency,min(currency) FILTER (WHERE currency='NGN'),min(currency),'NGN') AS currency,
        coalesce(jsonb_agg(DISTINCT currency ORDER BY currency),'[]') AS currencies
      FROM scope
    ), filtered AS MATERIALIZED (
      SELECT s.* FROM scope s JOIN options o USING (currency)
    ), trend AS (
      SELECT ((sale_date-report_from)/bucket_days)*bucket_days AS bucket,sum(net) AS net
      FROM filtered GROUP BY 1
    )
    SELECT jsonb_build_object(
      'from',report_from,'through',report_to,'currency',o.currency,'currencies',o.currencies,
      'totals',(SELECT jsonb_build_object(
        'gross',coalesce(sum(gross_sales),0),'discounts',coalesce(sum(discounts),0),
        'refunds',coalesce(sum(refunds),0),'tax',coalesce(sum(tax),0),
        'net',coalesce(sum(net),0),'orders',coalesce(sum(orders),0),'rows',count(DISTINCT (cafe_id,sale_date))
      ) FROM filtered),
      'cafes',coalesce((
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.net DESC,c.cafe_id)
        FROM (SELECT cafe_id,sum(net) AS net,sum(orders) AS orders,count(DISTINCT sale_date) AS days FROM filtered GROUP BY cafe_id) c
      ),'[]'),
      'channels',coalesce((
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.cafe_id,c.channel)
        FROM (
          SELECT cafe_id,channel,sum(net) AS net,sum(orders) AS orders
          FROM filtered WHERE channel IS NOT NULL GROUP BY cafe_id,channel
        ) c
      ),'[]'),
      'trend',(
        SELECT jsonb_agg(jsonb_build_object(
          'from',report_from+b.bucket,'through',least(report_to,report_from+b.bucket+(bucket_days-1)),
          'net',t.net
        ) ORDER BY b.bucket)
        FROM generate_series(0,report_to-report_from,bucket_days) b(bucket) LEFT JOIN trend t USING (bucket)
      )
    ) FROM options o
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_recipe_sales_report(p_chain uuid, p_from date, p_to date, p_cafe bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.partner_paid(p_chain) OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Paid café access is required for recipe sales.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
    OR p_to < p_from OR p_to - p_from >= 366
  THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH by_cafe AS (
      SELECT s.recipe_id, s.cafe_id, sum(s.servings_sold) AS servings_sold
      FROM public.partner_effective_recipe_sales_daily s
      WHERE s.chain_id = p_chain AND s.sale_date BETWEEN p_from AND p_to AND (p_cafe IS NULL OR s.cafe_id = p_cafe)
      GROUP BY s.recipe_id, s.cafe_id
    )
    SELECT coalesce(jsonb_agg(to_jsonb(ranked) ORDER BY servings_sold DESC, name, recipe_id), '[]'::jsonb)
    FROM (
      SELECT r.id AS recipe_id, r.name, sum(s.servings_sold) AS servings_sold,
        jsonb_agg(jsonb_build_object('cafe_id', s.cafe_id, 'servings_sold', s.servings_sold) ORDER BY s.cafe_id) AS cafes
      FROM by_cafe s
      JOIN public.partner_recipes r ON r.id = s.recipe_id AND r.chain_id = p_chain
      GROUP BY r.id, r.name
      HAVING sum(s.servings_sold) > 0
      ORDER BY servings_sold DESC, r.name, r.id
      LIMIT 10
    ) ranked
  );
END;
$$;

-- Partner sales channel filter
-- Keep CSV history in All and use attributed orders for the channel filters.
CREATE OR REPLACE VIEW public.partner_effective_recipe_sales_daily WITH (security_invoker = true) AS
SELECT d.chain_id, d.cafe_id, d.sale_date, d.recipe_id, d.servings_sold::bigint, NULL::text AS channel
FROM public.partner_recipe_sales_daily d
WHERE NOT EXISTS (
  SELECT 1 FROM public.partner_sales_order_coverage c
  WHERE (c.chain_id, c.sale_date, c.cafe_id) = (d.chain_id, d.sale_date, d.cafe_id)
)
UNION ALL
SELECT o.chain_id, o.cafe_id, o.sale_date, r.recipe_id, sum(r.servings_sold), o.channel
FROM public.partner_sales_orders o
JOIN public.partner_sales_order_coverage c USING (chain_id, cafe_id, sale_date)
JOIN public.partner_sales_order_recipes r ON (r.order_id, r.chain_id, r.cafe_id) = (o.id, o.chain_id, o.cafe_id)
GROUP BY o.chain_id, o.cafe_id, o.sale_date, r.recipe_id, o.channel;

DROP FUNCTION public.partner_sales_report(uuid,bigint,date,date,text);
DROP FUNCTION public.partner_recipe_sales_report(uuid,date,date,bigint);

CREATE FUNCTION public.partner_sales_report(
  p_chain uuid, p_cafe bigint DEFAULT NULL, p_from date DEFAULT NULL,
  p_to date DEFAULT NULL, p_currency text DEFAULT NULL, p_channel text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  local_today date;
  report_from date;
  report_to date;
  bucket_days integer;
BEGIN
  SELECT (now() AT TIME ZONE timezone)::date INTO local_today
  FROM public.partner_accounts WHERE chain_id = p_chain AND public.partner_role(p_chain) IS NOT NULL;
  IF NOT FOUND OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Sales report access is required.' USING ERRCODE = '42501';
  END IF;
  report_to := coalesce(p_to,local_today);
  IF NOT isfinite(report_to) OR (p_from IS NOT NULL AND NOT isfinite(p_from)) THEN
    RAISE EXCEPTION 'Enter valid report dates.' USING ERRCODE = '22023';
  END IF;
  IF report_to > local_today THEN
    RAISE EXCEPTION 'Choose an end date no later than today.' USING ERRCODE = '22023';
  END IF;
  report_from := coalesce(p_from,report_to-29);
  IF report_to < report_from OR report_to-report_from >= 366 THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Choose a valid currency.' USING ERRCODE = '22023';
  END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('pos', 'mobile') THEN
    RAISE EXCEPTION 'Choose a valid sales channel.' USING ERRCODE = '22023';
  END IF;
  bucket_days := greatest(1, ceil((report_to-report_from+1)::numeric/30)::integer);

  RETURN (
    WITH scope AS MATERIALIZED (
      SELECT cafe_id,sale_date,currency,gross_sales,discounts,refunds,tax,orders,channel,
        gross_sales-discounts-refunds AS net
      FROM public.partner_effective_sales_daily
      WHERE chain_id=p_chain AND sale_date BETWEEN report_from AND report_to
        AND (p_cafe IS NULL OR cafe_id=p_cafe)
    ), options AS (
      SELECT coalesce(
          p_currency,
          min(currency) FILTER (WHERE currency = 'NGN' AND (p_channel IS NULL OR channel = p_channel)),
          min(currency) FILTER (WHERE p_channel IS NULL OR channel = p_channel),
          min(currency) FILTER (WHERE currency = 'NGN'), min(currency), 'NGN'
        ) AS currency,
        coalesce(jsonb_agg(DISTINCT currency ORDER BY currency),'[]') AS currencies
      FROM scope
    ), currency_scope AS MATERIALIZED (
      SELECT s.* FROM scope s JOIN options o USING (currency)
    ), filtered AS MATERIALIZED (
      SELECT * FROM currency_scope WHERE p_channel IS NULL OR channel = p_channel
    ), trend AS (
      SELECT ((sale_date-report_from)/bucket_days)*bucket_days AS bucket,sum(net) AS net
      FROM filtered GROUP BY 1
    )
    SELECT jsonb_build_object(
      'from',report_from,'through',report_to,'currency',o.currency,'currencies',o.currencies,
      'totals',(SELECT jsonb_build_object(
        'gross',coalesce(sum(gross_sales),0),'discounts',coalesce(sum(discounts),0),
        'refunds',coalesce(sum(refunds),0),'tax',coalesce(sum(tax),0),
        'net',coalesce(sum(net),0),'orders',coalesce(sum(orders),0),'rows',count(DISTINCT (cafe_id,sale_date))
      ) FROM filtered),
      'cafes',coalesce((
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.net DESC,c.cafe_id)
        FROM (SELECT cafe_id,sum(net) AS net,sum(orders) AS orders,count(DISTINCT sale_date) AS days FROM filtered GROUP BY cafe_id) c
      ),'[]'),
      'channels',coalesce((
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.cafe_id,c.channel)
        FROM (
          SELECT cafe_id,channel,sum(net) AS net,sum(orders) AS orders
          FROM currency_scope WHERE channel IS NOT NULL GROUP BY cafe_id,channel
        ) c
      ),'[]'),
      'trend',(
        SELECT jsonb_agg(jsonb_build_object(
          'from',report_from+b.bucket,'through',least(report_to,report_from+b.bucket+(bucket_days-1)),
          'net',t.net
        ) ORDER BY b.bucket)
        FROM generate_series(0,report_to-report_from,bucket_days) b(bucket) LEFT JOIN trend t USING (bucket)
      )
    ) FROM options o
  );
END;
$$;

CREATE FUNCTION public.partner_recipe_sales_report(p_chain uuid, p_from date, p_to date, p_cafe bigint DEFAULT NULL, p_channel text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.partner_paid(p_chain) OR (p_cafe IS NOT NULL AND NOT public.partner_can_cafe(p_cafe)) THEN
    RAISE EXCEPTION 'Paid café access is required for recipe sales.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
    OR p_to < p_from OR p_to - p_from >= 366
  THEN
    RAISE EXCEPTION 'Choose a date range of 1 to 366 days.' USING ERRCODE = '22023';
  END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('pos', 'mobile') THEN
    RAISE EXCEPTION 'Choose a valid sales channel.' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH by_cafe AS (
      SELECT s.recipe_id, s.cafe_id, sum(s.servings_sold) AS servings_sold
      FROM public.partner_effective_recipe_sales_daily s
      WHERE s.chain_id = p_chain AND s.sale_date BETWEEN p_from AND p_to AND (p_cafe IS NULL OR s.cafe_id = p_cafe)
        AND (p_channel IS NULL OR s.channel = p_channel)
      GROUP BY s.recipe_id, s.cafe_id
    )
    SELECT coalesce(jsonb_agg(to_jsonb(ranked) ORDER BY servings_sold DESC, name, recipe_id), '[]'::jsonb)
    FROM (
      SELECT r.id AS recipe_id, r.name, sum(s.servings_sold) AS servings_sold,
        jsonb_agg(jsonb_build_object('cafe_id', s.cafe_id, 'servings_sold', s.servings_sold) ORDER BY s.cafe_id) AS cafes
      FROM by_cafe s
      JOIN public.partner_recipes r ON r.id = s.recipe_id AND r.chain_id = p_chain
      GROUP BY r.id, r.name
      HAVING sum(s.servings_sold) > 0
      ORDER BY servings_sold DESC, r.name, r.id
      LIMIT 10
    ) ranked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_sales_report(uuid,bigint,date,date,text,text),
  public.partner_recipe_sales_report(uuid,date,date,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_sales_report(uuid,bigint,date,date,text,text),
  public.partner_recipe_sales_report(uuid,date,date,bigint,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
