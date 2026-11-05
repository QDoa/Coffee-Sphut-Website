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
