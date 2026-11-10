-- Loaded only by the loopback demo stack. No provider credentials are involved.
CREATE FUNCTION public.partner_demo_pos_status(p_chain uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH locations AS (
    SELECT c.id, c.name
    FROM public."Cafe" c
    WHERE p_chain = '20000000-0000-4000-8000-000000000001'
      AND c.chain_id = p_chain AND c.id IN (101, 102) AND c.is_active IS TRUE
      AND public.partner_can_cafe(c.id)
  )
  SELECT jsonb_build_object(
    'locations', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM locations l), '[]'::jsonb),
    'synced_at', (SELECT max(c.synced_at) FROM public.partner_sales_order_coverage c JOIN locations l ON c.cafe_id = l.id
      WHERE c.chain_id = p_chain)
  );
$$;

CREATE FUNCTION partner_internal.sync_demo_pos(p_chain uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  through_date date := (now() AT TIME ZONE 'Africa/Lagos')::date - 1;
  new_orders integer;
BEGIN
  IF p_chain IS DISTINCT FROM '20000000-0000-4000-8000-000000000001'::uuid
    OR coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager')
  THEN
    RAISE EXCEPTION 'Owner or Chain Manager access to the demo workspace is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.partner_accounts WHERE chain_id = p_chain FOR UPDATE;
  IF NOT FOUND OR coalesce(public.partner_role(p_chain), '') NOT IN ('owner', 'chain_manager')
    OR NOT EXISTS (
      SELECT 1 FROM public."Cafe" c WHERE c.chain_id = p_chain AND c.id IN (101, 102)
        AND c.is_active IS TRUE AND public.partner_can_cafe(c.id)
    )
  THEN
    RAISE EXCEPTION 'An active demo café is required to sync sales.' USING ERRCODE = '42501';
  END IF;

  WITH locations AS MATERIALIZED (
    SELECT c.id FROM public."Cafe" c
    WHERE c.chain_id = p_chain AND c.id IN (101, 102) AND c.is_active IS TRUE AND public.partner_can_cafe(c.id)
  ), days AS MATERIALIZED (
    SELECT l.id AS cafe_id, through_date - d AS sale_date
    FROM locations l CROSS JOIN generate_series(0, 28) d
  ), recipes AS (
    SELECT id, row_number() OVER (ORDER BY name <> 'House latte', name, id) AS position
    FROM public.partner_recipes WHERE chain_id = p_chain AND active
    ORDER BY position LIMIT 5
  ), menu AS (
    SELECT array_agg(id ORDER BY position) AS recipe_ids FROM recipes
  ), feed AS MATERIALIZED (
    SELECT d.cafe_id, d.sale_date, orders.source, orders.channel, concat(d.cafe_id, ':', d.sale_date, ':', n) AS external_id,
      CASE orders.channel WHEN 'mobile' THEN 2600 ELSE 2100 END + (n % 9) * 150 AS gross,
      CASE WHEN n % 8 = 0 THEN 150 ELSE 0 END AS discount,
      n % 31 = 0 AS refunded,
      CASE WHEN d.cafe_id = 102 AND item.position <= 2 THEN 3 - item.position ELSE item.position END AS position
    FROM days d
    CROSS JOIN LATERAL (
      VALUES
        ('demo_pos', 'pos', CASE WHEN d.cafe_id = 101 THEN 96 ELSE 77 END
          + ((extract(day FROM d.sale_date)::integer * 13 + d.cafe_id) % 23)),
        ('demo_mobile', 'mobile', CASE WHEN d.cafe_id = 101 THEN 8 ELSE 14 END
          + ((extract(day FROM d.sale_date)::integer * 7 + d.cafe_id) % 9))
    ) orders(source, channel, daily_count)
    CROSS JOIN LATERAL generate_series(1, orders.daily_count) n
    CROSS JOIN LATERAL (
      SELECT CASE WHEN n % 12 < 4 THEN 1 WHEN n % 12 < 7 THEN 2 WHEN n % 12 < 9 THEN 3
        WHEN n % 12 = 9 THEN 4 WHEN n % 12 = 10 THEN 5 END AS position
    ) item
  ), inserted AS (
    INSERT INTO public.partner_sales_orders(chain_id,cafe_id,source,source_order_id,channel,sale_date,currency,gross_sales,discounts,refunds,tax)
    SELECT p_chain, f.cafe_id, f.source, f.external_id, f.channel, f.sale_date, 'NGN', f.gross, f.discount,
      CASE WHEN f.refunded THEN f.gross - f.discount ELSE 0 END,
      CASE WHEN f.refunded THEN 0 ELSE round((f.gross - f.discount) * 0.075, 2) END
    FROM feed f
    ON CONFLICT (chain_id, source, source_order_id) DO NOTHING
    RETURNING id, cafe_id, source, source_order_id
  ), mapped AS (
    INSERT INTO public.partner_sales_order_recipes(order_id,chain_id,cafe_id,recipe_id,servings_sold)
    SELECT i.id, p_chain, i.cafe_id, m.recipe_ids[least(f.position, cardinality(m.recipe_ids))], 1
    FROM inserted i JOIN feed f ON (f.source, f.external_id) = (i.source, i.source_order_id)
    CROSS JOIN menu m
    WHERE NOT f.refunded AND f.position IS NOT NULL AND cardinality(m.recipe_ids) > 0
  ), covered AS (
    INSERT INTO public.partner_sales_order_coverage(chain_id,cafe_id,sale_date)
    SELECT p_chain, cafe_id, sale_date FROM days
    ON CONFLICT (chain_id, sale_date, cafe_id) DO UPDATE SET synced_at = excluded.synced_at
  )
  SELECT count(*) INTO new_orders FROM inserted;
  RETURN new_orders;
END;
$$;

CREATE FUNCTION public.partner_sync_demo_pos(p_chain uuid)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.sync_demo_pos(p_chain);
$$;

REVOKE ALL ON FUNCTION public.partner_demo_pos_status(uuid), public.partner_sync_demo_pos(uuid),
  partner_internal.sync_demo_pos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_demo_pos_status(uuid), public.partner_sync_demo_pos(uuid),
  partner_internal.sync_demo_pos(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
