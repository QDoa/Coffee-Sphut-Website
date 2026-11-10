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
