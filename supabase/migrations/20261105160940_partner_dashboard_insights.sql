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
NOTIFY pgrst, 'reload schema';
