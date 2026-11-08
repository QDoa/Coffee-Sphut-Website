CREATE OR REPLACE FUNCTION public.partner_team_assignments(p_chain uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(membership_id, cafe_ids), '{}'::jsonb)
  FROM (
    SELECT membership_id, array_agg(cafe_id ORDER BY cafe_id) AS cafe_ids
    FROM public.partner_assignments
    WHERE chain_id = p_chain AND public.partner_role(p_chain) = 'owner'
    GROUP BY membership_id
  ) AS assignments;
$$;

CREATE OR REPLACE FUNCTION partner_internal.edit_manager_access(
  p_member uuid,
  p_expected_role text,
  p_expected_cafe_ids bigint[],
  p_role text,
  p_cafe_ids bigint[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  member_chain uuid;
  saved_role text;
  current_ids bigint[];
  expected_ids bigint[];
  new_ids bigint[];
BEGIN
  SELECT chain_id INTO member_chain FROM public.partner_memberships WHERE id = p_member;
  IF actor_id IS NULL OR public.partner_role(member_chain) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the workspace Owner can edit manager access.' USING ERRCODE = '42501';
  END IF;

  -- Serialize with revocation, plan changes, and other partner commands.
  PERFORM 1 FROM public.partner_accounts WHERE chain_id = member_chain FOR UPDATE;
  IF public.partner_role(member_chain) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the workspace Owner can edit manager access.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO saved_role FROM public.partner_memberships
  WHERE id = p_member AND chain_id = member_chain AND revoked_at IS NULL
    AND role IN ('chain_manager', 'cafe_manager')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This manager is no longer available to edit.';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('chain_manager', 'cafe_manager') THEN
    RAISE EXCEPTION 'Choose Chain Manager or Café Manager.';
  END IF;

  SELECT coalesce(array_agg(cafe_id ORDER BY cafe_id), '{}'::bigint[]) INTO current_ids
  FROM public.partner_assignments WHERE membership_id = p_member;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(p_expected_cafe_ids) AS t(id) ORDER BY id)
  INTO expected_ids;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(p_cafe_ids) AS t(id) ORDER BY id)
  INTO new_ids;

  -- An identical retry has already reached the requested state.
  IF saved_role = p_role AND current_ids = new_ids THEN
    RETURN;
  END IF;
  IF saved_role IS DISTINCT FROM p_expected_role OR current_ids <> expected_ids THEN
    RAISE EXCEPTION 'This manager’s access changed. Refresh Team before trying again.';
  END IF;
  IF p_role = 'chain_manager' AND cardinality(new_ids) <> 0 THEN
    RAISE EXCEPTION 'Chain Managers already have access to all available cafés.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(new_ids) AS t(id)
    WHERE id IS NULL OR (NOT (id = ANY(current_ids)) AND NOT public.partner_can_cafe(id))
  ) THEN
    RAISE EXCEPTION 'A selected café is unavailable. Refresh and choose from your workspace cafés.';
  END IF;
  IF p_role = 'cafe_manager' AND NOT EXISTS (
    SELECT 1 FROM unnest(new_ids) AS t(id) WHERE public.partner_can_cafe(id)
  ) THEN
    RAISE EXCEPTION 'Assign at least one available café to a Café Manager.';
  END IF;

  UPDATE public.partner_memberships SET role = p_role WHERE id = p_member;
  DELETE FROM public.partner_assignments
  WHERE membership_id = p_member AND NOT (cafe_id = ANY(new_ids));
  INSERT INTO public.partner_assignments(membership_id, chain_id, cafe_id)
  SELECT p_member, member_chain, id FROM unnest(new_ids) AS t(id)
  WHERE NOT (id = ANY(current_ids));

  INSERT INTO public.partner_audit(chain_id, actor, action, target, details)
  VALUES (member_chain, actor_id, 'edit_manager_access', p_member::text,
    jsonb_build_object('previous_role', saved_role, 'previous_cafe_ids', current_ids,
      'role', p_role, 'cafe_ids', new_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_edit_manager_access(
  p_member uuid,
  p_expected_role text,
  p_expected_cafe_ids bigint[],
  p_role text,
  p_cafe_ids bigint[]
)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT partner_internal.edit_manager_access(
    p_member, p_expected_role, p_expected_cafe_ids, p_role, p_cafe_ids
  );
$$;

REVOKE ALL ON FUNCTION public.partner_team_assignments(uuid),
  public.partner_edit_manager_access(uuid, text, bigint[], text, bigint[]),
  partner_internal.edit_manager_access(uuid, text, bigint[], text, bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_team_assignments(uuid),
  public.partner_edit_manager_access(uuid, text, bigint[], text, bigint[]),
  partner_internal.edit_manager_access(uuid, text, bigint[], text, bigint[]) TO authenticated;
