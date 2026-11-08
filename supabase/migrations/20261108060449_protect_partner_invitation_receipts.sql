BEGIN;

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

COMMIT;
