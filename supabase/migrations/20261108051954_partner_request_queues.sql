-- Resolve a request independently of the queue and apply the same partner scope.
CREATE FUNCTION public.partner_cafe_request(p_id uuid, p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT to_jsonb(ch)
  FROM public.partner_changes ch
  WHERE ch.id = p_id AND ch.chain_id = p_chain
    AND public.partner_role(p_chain) IS NOT NULL
    AND (public.partner_can_cafe(ch.cafe_id)
      OR (ch.cafe_id IS NULL AND public.partner_role(p_chain) IN ('owner', 'chain_manager')));
$$;

CREATE OR REPLACE FUNCTION partner_internal.request_queue(
  p_staff boolean, p_search text, p_filter text, p_page integer
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  member_chain uuid;
  member_role text;
  staff_queue boolean := coalesce(p_staff, false);
  needle text := lower(left(btrim(coalesce(p_search, '')), 150));
  page_size constant integer := 20;
  result jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF staff_queue THEN
    IF NOT public.is_staff() THEN
      RAISE EXCEPTION 'Staff required' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT chain_id, role INTO member_chain, member_role
    FROM public.partner_memberships
    WHERE user_id = actor_id AND revoked_at IS NULL;
    IF member_chain IS NULL THEN
      RAISE EXCEPTION 'No active partner membership' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH accessible_cafes AS MATERIALIZED (
    SELECT cafe_id
    FROM public.partner_cafe_access
    WHERE chain_id = member_chain AND public.partner_can_cafe(cafe_id)
  ),
  scoped AS MATERIALIZED (
    SELECT ch.id, ch.cafe_id, ch.created_at, ch.status,
      CASE
        WHEN ch.cafe_id IS NULL THEN 'new'
        WHEN ch.payload->'is_active' = 'false'::jsonb AND c.is_active IS TRUE THEN 'removal'
        WHEN ch.payload->'is_active' = 'true'::jsonb AND c.is_active IS FALSE THEN 'reactivation'
        ELSE 'edit'
      END AS kind,
      (needle = ''
        OR strpos(lower(coalesce(c.name, '')), needle) > 0
        OR strpos(lower(coalesce(ch.payload->>'name', '')), needle) > 0
        OR strpos(ch.id::text, needle) > 0
        OR (staff_queue AND strpos(lower(coalesce(chain.name, '')), needle) > 0)) AS matches_search
    FROM public.partner_changes ch
    LEFT JOIN public."Cafe" c ON c.id = ch.cafe_id
    LEFT JOIN public."Chains" chain ON chain.id = ch.chain_id
    WHERE (staff_queue AND ch.status = 'pending')
      OR (NOT staff_queue AND ch.chain_id = member_chain
        AND (ch.cafe_id IN (SELECT cafe_id FROM accessible_cafes)
          OR (ch.cafe_id IS NULL AND member_role IN ('owner', 'chain_manager'))))
  ),
  matches AS MATERIALIZED (
    SELECT id, created_at, kind
    FROM scoped
    WHERE matches_search AND (coalesce(p_filter, 'all') = 'all'
      OR p_filter = CASE WHEN staff_queue THEN kind ELSE status END)
  ),
  totals AS (
    SELECT count(*) AS total,
      least(greatest(coalesce(p_page, 1), 1), greatest(1, (count(*) + page_size - 1) / page_size)) AS page
    FROM matches
  ),
  page_rows AS (
    SELECT * FROM matches
    ORDER BY CASE WHEN staff_queue THEN created_at END ASC,
             CASE WHEN NOT staff_queue THEN created_at END DESC, id
    LIMIT page_size OFFSET (SELECT (page - 1) * page_size FROM totals)
  )
  SELECT jsonb_build_object(
    'actor', actor_id,
    'request_total', totals.total,
    'request_page', totals.page,
    'request_page_size', page_size,
    'pending_request_count', CASE WHEN staff_queue THEN 0 ELSE (
      SELECT count(*) FROM scoped WHERE status = 'pending'
    ) END,
    'changes', coalesce((
      SELECT jsonb_agg(
        to_jsonb(ch) || CASE WHEN staff_queue THEN jsonb_build_object(
          'cafe_name', c.name, 'current_values', to_jsonb(c), 'kind', page_rows.kind
        ) ELSE '{}'::jsonb END
        ORDER BY CASE WHEN staff_queue THEN page_rows.created_at END ASC,
                 CASE WHEN NOT staff_queue THEN page_rows.created_at END DESC, page_rows.id
      )
      FROM page_rows
      JOIN public.partner_changes ch ON ch.id = page_rows.id
      LEFT JOIN public."Cafe" c ON staff_queue AND c.id = ch.cafe_id
    ), '[]'::jsonb),
    'pending_requests', CASE WHEN staff_queue THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'cafe_id', cafe_id))
      FROM scoped WHERE status = 'pending' AND cafe_id IS NOT NULL
    ), '[]'::jsonb) END,
    'accounts', CASE WHEN NOT staff_queue THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('name', c.name))
      FROM public.partner_accounts a JOIN public."Chains" c ON c.id = a.chain_id
    ), '[]'::jsonb) END
  ) INTO result FROM totals;

  RETURN result;
END;
$$;

CREATE FUNCTION public.partner_request_queue(
  p_staff boolean, p_search text, p_filter text, p_page integer
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.request_queue(p_staff, p_search, p_filter, p_page);
$$;

REVOKE ALL ON FUNCTION public.partner_cafe_request(uuid, uuid),
  partner_internal.request_queue(boolean, text, text, integer),
  public.partner_request_queue(boolean, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_cafe_request(uuid, uuid),
  partner_internal.request_queue(boolean, text, text, integer),
  public.partner_request_queue(boolean, text, text, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
