BEGIN;
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
NOTIFY pgrst,'reload schema';
COMMIT;
