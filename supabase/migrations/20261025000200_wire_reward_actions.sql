BEGIN;

-- Public QR-code forms do not carry an authenticated Supabase session. Validate
-- the café code inside the database instead of relying on a client-side lookup
-- followed by a table update that anonymous RLS will reject.
CREATE OR REPLACE FUNCTION public.add_reward_stamp(p_user_id uuid, p_cafe_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id bigint;
  v_transaction_id uuid;
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(p_cafe_code), '') IS NULL THEN
    RAISE EXCEPTION 'A customer and cafe code are required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_store_id
  FROM public."Cafe"
  WHERE reward_code = btrim(p_cafe_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid cafe code' USING ERRCODE = '22023';
  END IF;

  -- Fires on_reward_transaction_created_chain -> handle_new_transaction_chain.
  INSERT INTO public."RewardTransaction" (user_id, store_id)
  VALUES (p_user_id, v_store_id)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id uuid, p_cafe_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chain_id uuid;
  v_reward_id uuid;
BEGIN
  IF p_reward_id IS NULL OR NULLIF(btrim(p_cafe_code), '') IS NULL THEN
    RAISE EXCEPTION 'A reward and cafe code are required' USING ERRCODE = '22023';
  END IF;

  SELECT chain_id INTO v_chain_id
  FROM public."Cafe"
  WHERE reward_code = btrim(p_cafe_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid cafe code' USING ERRCODE = '22023';
  END IF;

  -- Fires on_reward_redemeed -> handle_reward_redeemed. The conditional UPDATE
  -- also prevents simultaneous/repeated requests from consuming two credits.
  UPDATE public."Rewards"
  SET status = 'redeemed', redeemed_at = now()
  WHERE id = p_reward_id AND chain_id = v_chain_id AND status = 'issued'
  RETURNING id INTO v_reward_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward is unavailable at this cafe' USING ERRCODE = '22023';
  END IF;

  RETURN v_reward_id;
END;
$$;

ALTER FUNCTION public.add_reward_stamp(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.redeem_reward(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.add_reward_stamp(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_reward_stamp(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
