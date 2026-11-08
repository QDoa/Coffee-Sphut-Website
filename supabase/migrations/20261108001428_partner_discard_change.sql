CREATE SCHEMA partner_internal;
REVOKE ALL ON SCHEMA partner_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA partner_internal TO authenticated;

CREATE FUNCTION partner_internal.discard_cafe_change(p_change uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  change_chain uuid;
  change_request public.partner_changes;
  member_role text;
BEGIN
  IF actor_id IS NULL OR p_status IS NULL OR p_status NOT IN ('draft', 'pending') THEN
    RETURN false;
  END IF;

  -- Use the same account-before-request lock order as review and draft saves.
  SELECT account.chain_id INTO change_chain
  FROM public.partner_accounts account
  JOIN public.partner_changes change ON change.chain_id = account.chain_id
  WHERE change.id = p_change AND change.submitter = actor_id
  FOR UPDATE OF account;

  member_role := public.partner_role(change_chain);
  IF member_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO change_request
  FROM public.partner_changes
  WHERE id = p_change AND submitter = actor_id AND status = p_status
    AND (public.partner_can_cafe(cafe_id)
      OR (cafe_id IS NULL AND member_role IN ('owner', 'chain_manager')))
    AND (p_status = 'draft'
      OR (cafe_id IS NOT NULL AND payload->'is_active' = 'false'::jsonb))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- An approval attempt can have prepared images before completing review.
  -- Drop that preparation with the request. Storage cleanup keeps its own
  -- reference checks and authenticated Storage API workflow.
  DELETE FROM public.partner_media_publications WHERE change_id = p_change;
  DELETE FROM public.partner_changes WHERE id = p_change;

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (change_chain, actor_id,
    CASE WHEN p_status = 'draft' THEN 'discard_draft' ELSE 'withdraw_removal' END,
    p_change::text, jsonb_build_object('cafe_id', change_request.cafe_id));

  RETURN true;
END;
$$;

CREATE FUNCTION public.partner_discard_cafe_change(p_change uuid, p_status text)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.discard_cafe_change(p_change, p_status);
$$;

REVOKE ALL ON FUNCTION partner_internal.discard_cafe_change(uuid, text),
  public.partner_discard_cafe_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION partner_internal.discard_cafe_change(uuid, text),
  public.partner_discard_cafe_change(uuid, text) TO authenticated;
