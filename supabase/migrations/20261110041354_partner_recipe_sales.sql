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

NOTIFY pgrst, 'reload schema';
