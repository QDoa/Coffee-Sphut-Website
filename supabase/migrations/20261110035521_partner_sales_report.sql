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

NOTIFY pgrst, 'reload schema';
