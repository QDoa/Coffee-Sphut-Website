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

NOTIFY pgrst, 'reload schema';
