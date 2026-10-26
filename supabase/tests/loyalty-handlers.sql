-- Run against a disposable database after applying the migrations:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/loyalty-handlers.sql
-- Plain PostgreSQL assertions; all fixtures and helpers are rolled back.
BEGIN;
SET LOCAL row_security = on;

CREATE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Loyalty regression: %', message;
  END IF;
END;
$$;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_chain uuid := gen_random_uuid();
  v_other_chain uuid := gen_random_uuid();
  v_cafe bigint;
  v_sibling_cafe bigint;
  v_other_cafe bigint;
  v_reward uuid;
  v_card public."UserChainLoyalty"%ROWTYPE;
  v_count bigint;
  v_invalid_threshold integer;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_user), (v_other_user);
  INSERT INTO public."Chains" (id, name, loyalty_threshold)
  VALUES (v_chain, 'Loyalty regression chain', 3),
         (v_other_chain, 'Loyalty regression other chain', 5);
  INSERT INTO public."Cafe" (name, chain_id)
  VALUES ('Loyalty regression cafe', v_chain) RETURNING id INTO v_cafe;
  INSERT INTO public."Cafe" (name, chain_id)
  VALUES ('Loyalty regression sibling', v_chain) RETURNING id INTO v_sibling_cafe;
  INSERT INTO public."Cafe" (name, chain_id, loyalty_threshold_override)
  VALUES ('Loyalty regression override', v_other_chain, 1) RETURNING id INTO v_other_cafe;

  -- Exercise the existing public stamp-insertion policy and SECURITY DEFINER.
  SET LOCAL ROLE anon;
  INSERT INTO public."RewardTransaction" (user_id, store_id) VALUES (v_user, v_cafe);
  RESET ROLE;
  SELECT * INTO STRICT v_card FROM public."UserChainLoyalty"
  WHERE user_id = v_user AND chain_id = v_chain;
  PERFORM pg_temp.assert_true(v_card.punch_count = 1 AND v_card.reward_count = 0,
    'first visit creates a card and awards one stamp under RLS');
  PERFORM pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public."Rewards" WHERE user_id = v_user),
    'no reward before threshold');

  INSERT INTO public."RewardTransaction" (user_id, store_id)
  VALUES (v_user, v_sibling_cafe), (v_user, v_cafe);
  SELECT * INTO STRICT v_card FROM public."UserChainLoyalty"
  WHERE user_id = v_user AND chain_id = v_chain;
  SELECT id INTO STRICT v_reward FROM public."Rewards"
  WHERE user_id = v_user AND chain_id = v_chain AND status = 'issued' AND earned_store = v_cafe;
  PERFORM pg_temp.assert_true(v_card.punch_count = 0 AND v_card.reward_count = 1,
    'cafes share chain stamps and reset at threshold');
  PERFORM pg_temp.assert_true(v_card.updated_at = now() AND v_card.last_reset_at = now(),
    'earning a reward updates timestamps');

  -- Metadata edits and repeated updates must never consume another reward.
  UPDATE public."Rewards" SET issued_at = issued_at WHERE id = v_reward;
  PERFORM pg_temp.assert_true((SELECT reward_count = 1 FROM public."UserChainLoyalty" WHERE id = v_card.id),
    'issued-to-issued update leaves balance unchanged');
  SET LOCAL ROLE authenticated;
  UPDATE public."Rewards" SET status = 'redeemed' WHERE id = v_reward;
  RESET ROLE;
  PERFORM pg_temp.assert_true((SELECT reward_count = 0 FROM public."UserChainLoyalty" WHERE id = v_card.id),
    'redemption consumes one credit under RLS');
  UPDATE public."UserChainLoyalty" SET reward_count = 2 WHERE id = v_card.id;
  UPDATE public."Rewards" SET status = 'redeemed' WHERE id = v_reward;
  UPDATE public."Rewards" SET status = 'voided' WHERE id = v_reward;
  PERFORM pg_temp.assert_true((SELECT reward_count = 2 FROM public."UserChainLoyalty" WHERE id = v_card.id),
    'repeated redemption and redeemed-to-voided updates do not debit again');

  INSERT INTO public."RewardTransaction" (user_id, store_id)
  SELECT v_user, v_cafe FROM generate_series(1, 4);
  SELECT * INTO STRICT v_card FROM public."UserChainLoyalty" WHERE id = v_card.id;
  PERFORM pg_temp.assert_true(v_card.punch_count = 1 AND v_card.reward_count = 3,
    'a later cycle adds one reward and carries the next stamp');
  SELECT id INTO STRICT v_reward FROM public."Rewards"
  WHERE user_id = v_user AND chain_id = v_chain AND status = 'issued';
  INSERT INTO public."AdminUser" (user_id, role) VALUES (v_user, 'admin');
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_void_reward(v_reward, 'Loyalty regression void');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_temp.assert_true((SELECT reward_count = 2 FROM public."UserChainLoyalty" WHERE id = v_card.id),
    'admin voiding an issued reward consumes one credit');
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM public."AdminAuditLog"
    WHERE action = 'reward.void' AND record_id = v_reward::text AND reason = 'Loyalty regression void'),
    'admin reward voiding retains its audit trail');

  INSERT INTO public."RewardTransaction" (user_id, store_id) VALUES (v_user, v_other_cafe);
  PERFORM pg_temp.assert_true((SELECT punch_count = 0 AND reward_count = 1
    FROM public."UserChainLoyalty" WHERE user_id = v_user AND chain_id = v_other_chain),
    'cafe threshold override takes precedence, including threshold one');
  PERFORM pg_temp.assert_true((SELECT punch_count = 1 AND reward_count = 2
    FROM public."UserChainLoyalty" WHERE id = v_card.id), 'other chain balance is isolated');

  INSERT INTO public."UserChainLoyalty" (user_id, chain_id, punch_count, reward_count)
  VALUES (v_other_user, v_chain, NULL, NULL);
  INSERT INTO public."RewardTransaction" (user_id, store_id) VALUES (v_other_user, v_cafe);
  PERFORM pg_temp.assert_true((SELECT punch_count = 1 AND reward_count = 0
    FROM public."UserChainLoyalty" WHERE user_id = v_other_user AND chain_id = v_chain),
    'legacy null counters recover and users remain isolated');
  UPDATE public."UserChainLoyalty" SET punch_count = 2, reward_count = NULL
  WHERE user_id = v_other_user AND chain_id = v_chain;
  INSERT INTO public."RewardTransaction" (user_id, store_id) VALUES (v_other_user, v_cafe);
  PERFORM pg_temp.assert_true((SELECT punch_count = 0 AND reward_count = 1
    FROM public."UserChainLoyalty" WHERE user_id = v_other_user AND chain_id = v_chain),
    'null reward balance recovers when issuing a reward');

  FOR v_invalid_threshold IN SELECT unnest(ARRAY[0, -1]) LOOP
    UPDATE public."Cafe" SET loyalty_threshold_override = v_invalid_threshold WHERE id = v_cafe;
    SELECT count(*) INTO v_count FROM public."RewardTransaction" WHERE user_id = v_user;
    BEGIN
      INSERT INTO public."RewardTransaction" (user_id, store_id) VALUES (v_user, v_cafe);
      RAISE EXCEPTION 'Loyalty regression: invalid threshold was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    PERFORM pg_temp.assert_true((SELECT count(*) = v_count FROM public."RewardTransaction" WHERE user_id = v_user),
      'invalid threshold rolls back the transaction');
  END LOOP;
  UPDATE public."Cafe" SET loyalty_threshold_override = NULL WHERE id = v_cafe;

  BEGIN
    INSERT INTO public."UserChainLoyalty" (user_id, chain_id) VALUES (v_user, v_chain);
    RAISE EXCEPTION 'Loyalty regression: duplicate loyalty card was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Old data may contain an issued reward with a null/zero balance or no card.
  UPDATE public."UserChainLoyalty" SET reward_count = NULL
  WHERE user_id = v_user AND chain_id = v_other_chain;
  UPDATE public."Rewards" SET status = 'redeemed'
  WHERE user_id = v_user AND chain_id = v_other_chain AND status = 'issued';
  PERFORM pg_temp.assert_true((SELECT reward_count = 0 FROM public."UserChainLoyalty"
    WHERE user_id = v_user AND chain_id = v_other_chain), 'redemption normalizes null balances');
  INSERT INTO public."Rewards" (user_id, chain_id, earned_store)
  VALUES (v_user, v_other_chain, v_other_cafe) RETURNING id INTO v_reward;
  UPDATE public."Rewards" SET status = 'voided' WHERE id = v_reward;
  PERFORM pg_temp.assert_true((SELECT reward_count = 0 FROM public."UserChainLoyalty"
    WHERE user_id = v_user AND chain_id = v_other_chain), 'voiding never creates a negative balance');
  DELETE FROM public."UserChainLoyalty" WHERE user_id = v_user AND chain_id = v_other_chain;
  INSERT INTO public."Rewards" (user_id, chain_id, earned_store)
  VALUES (v_user, v_other_chain, v_other_cafe) RETURNING id INTO v_reward;
  UPDATE public."Rewards" SET status = 'redeemed' WHERE id = v_reward;
  PERFORM pg_temp.assert_true((SELECT status = 'redeemed' FROM public."Rewards" WHERE id = v_reward),
    'a legacy reward without a card can still be redeemed');

  PERFORM pg_temp.assert_true(NOT has_function_privilege('anon', 'public.handle_new_transaction_chain()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.handle_reward_redeemed()', 'EXECUTE'),
    'trigger functions are not directly executable by client roles');
END;
$$;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_chain uuid := gen_random_uuid();
  v_other_chain uuid := gen_random_uuid();
  v_code text := gen_random_uuid()::text;
  v_sibling_code text := gen_random_uuid()::text;
  v_other_code text := gen_random_uuid()::text;
  v_cafe bigint;
  v_transaction uuid;
  v_reward uuid;
  v_returned_reward uuid;
  v_invalid_code text;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_user);
  INSERT INTO public."Chains" (id, name, loyalty_threshold)
  VALUES (v_chain, 'QR action regression', 2), (v_other_chain, 'Other QR chain', 2);
  INSERT INTO public."Cafe" (name, chain_id, reward_code)
  VALUES ('QR action cafe', v_chain, v_code) RETURNING id INTO v_cafe;
  INSERT INTO public."Cafe" (name, chain_id, reward_code)
  VALUES ('QR sibling', v_chain, v_sibling_code), ('QR other', v_other_chain, v_other_code);

  SET LOCAL ROLE anon;
  v_transaction := public.add_reward_stamp(v_user, ' ' || v_code || ' ');
  RESET ROLE;
  PERFORM pg_temp.assert_true(EXISTS (SELECT 1 FROM public."RewardTransaction"
    WHERE id = v_transaction AND user_id = v_user AND store_id = v_cafe),
    'anonymous stamp RPC confirms the actual transaction');
  PERFORM pg_temp.assert_true((SELECT punch_count = 1 AND reward_count = 0
    FROM public."UserChainLoyalty" WHERE user_id = v_user AND chain_id = v_chain),
    'anonymous stamp RPC fires handle_new_transaction_chain');

  SET LOCAL ROLE anon;
  PERFORM public.add_reward_stamp(v_user, v_code);
  RESET ROLE;
  SELECT id INTO STRICT v_reward FROM public."Rewards" WHERE user_id = v_user AND status = 'issued';
  -- Prove the original direct anonymous update cannot trigger redemption.
  SET LOCAL ROLE anon;
  UPDATE public."Rewards" SET status = 'redeemed' WHERE id = v_reward;
  RESET ROLE;
  PERFORM pg_temp.assert_true((SELECT status = 'issued' FROM public."Rewards" WHERE id = v_reward),
    'original anonymous direct update is blocked by RLS');

  FOR v_invalid_code IN SELECT unnest(ARRAY[NULL, '', ' ', gen_random_uuid()::text]) LOOP
    BEGIN
      SET LOCAL ROLE anon;
      PERFORM public.add_reward_stamp(v_user, v_invalid_code);
      RAISE EXCEPTION 'Loyalty regression: stamp accepted an invalid cafe code';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    BEGIN
      SET LOCAL ROLE anon;
      PERFORM public.redeem_reward(v_reward, v_invalid_code);
      RAISE EXCEPTION 'Loyalty regression: redemption accepted an invalid cafe code';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
  END LOOP;
  RESET ROLE;
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.redeem_reward(v_reward, v_other_code);
    RAISE EXCEPTION 'Loyalty regression: another chain redeemed the reward';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  RESET ROLE;
  PERFORM pg_temp.assert_true((SELECT count(*) = 2 FROM public."RewardTransaction" WHERE user_id = v_user),
    'invalid stamp requests do not create transactions');
  PERFORM pg_temp.assert_true((SELECT reward_count = 1 FROM public."UserChainLoyalty"
    WHERE user_id = v_user AND chain_id = v_chain), 'invalid redemption leaves credits unchanged');

  -- Any café in the same chain can redeem; the public page needs no user session.
  SET LOCAL ROLE anon;
  v_returned_reward := public.redeem_reward(v_reward, ' ' || v_sibling_code || ' ');
  RESET ROLE;
  PERFORM pg_temp.assert_true(v_returned_reward = v_reward,
    'anonymous redemption confirms the requested reward');
  PERFORM pg_temp.assert_true((SELECT status = 'redeemed' AND redeemed_at = now()
    FROM public."Rewards" WHERE id = v_reward), 'redemption records status and time');
  PERFORM pg_temp.assert_true((SELECT reward_count = 0 FROM public."UserChainLoyalty"
    WHERE user_id = v_user AND chain_id = v_chain), 'anonymous redemption fires handle_reward_redeemed');
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.redeem_reward(v_reward, v_code);
    RAISE EXCEPTION 'Loyalty regression: repeated redemption reported success';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  RESET ROLE;
  PERFORM pg_temp.assert_true((SELECT reward_count = 0 FROM public."UserChainLoyalty"
    WHERE user_id = v_user AND chain_id = v_chain), 'redemption retry never double-debits');
END;
$$;

ROLLBACK;
