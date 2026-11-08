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

NOTIFY pgrst, 'reload schema';
