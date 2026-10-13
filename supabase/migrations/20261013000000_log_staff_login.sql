-- Records a successful staff sign-in in AdminAuditLog.
--
-- AdminAuditLog is not writable by client roles, so this SECURITY DEFINER
-- function inserts on the caller's behalf. Actor identity, email and role are
-- derived server-side from auth.uid(), so a caller can only log their own
-- sign-in, and only if they are on the AdminUser allow-list.

CREATE OR REPLACE FUNCTION public.log_staff_login(p_method text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('password', 'google') THEN
    RAISE EXCEPTION 'Invalid login method: %', p_method USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_role
  FROM public."AdminUser"
  WHERE user_id = v_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a staff member' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public."AdminAuditLog" (
    actor_id, actor_email, actor_role, action, table_name, record_id, new_data
  )
  VALUES (
    v_user_id,
    v_email,
    v_role,
    'auth.login',
    'auth.users',
    v_user_id::text,
    jsonb_build_object('method', p_method)
  );
END;
$$;

ALTER FUNCTION public.log_staff_login(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.log_staff_login(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_staff_login(text) TO authenticated, service_role;
