BEGIN;

-- Keep the handlers explicit in a forward migration for existing databases.
-- Do not silently merge duplicate cards: their balances need manual review if
-- this index reports a uniqueness violation during deployment.
CREATE UNIQUE INDEX IF NOT EXISTS user_chain_loyalty_user_chain_unique_idx
  ON public."UserChainLoyalty" (user_id, chain_id);

CREATE OR REPLACE FUNCTION public.handle_new_transaction_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chain_id uuid;
  v_threshold integer;
  v_card public."UserChainLoyalty"%ROWTYPE;
BEGIN
  SELECT cafe.chain_id,
         COALESCE(cafe.loyalty_threshold_override, chain.loyalty_threshold)
  INTO v_chain_id, v_threshold
  FROM public."Cafe" AS cafe
  JOIN public."Chains" AS chain ON chain.id = cafe.chain_id
  WHERE cafe.id = NEW.store_id;

  IF v_chain_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_threshold IS NULL OR v_threshold <= 0 THEN
    RAISE EXCEPTION 'Cafe % must have a positive loyalty threshold', NEW.store_id
      USING ERRCODE = '22023';
  END IF;

  -- The unique index and ON CONFLICT also serialize simultaneous first visits.
  INSERT INTO public."UserChainLoyalty" (user_id, chain_id, punch_count, reward_count)
  VALUES (NEW.user_id, v_chain_id, 0, 0)
  ON CONFLICT (user_id, chain_id) DO NOTHING;

  SELECT * INTO STRICT v_card
  FROM public."UserChainLoyalty"
  WHERE user_id = NEW.user_id AND chain_id = v_chain_id
  FOR UPDATE;

  v_card.punch_count := COALESCE(v_card.punch_count, 0) + 1;
  v_card.reward_count := COALESCE(v_card.reward_count, 0);

  IF v_card.punch_count >= v_threshold THEN
    v_card.punch_count := 0;
    v_card.reward_count := v_card.reward_count + 1;
    v_card.last_reset_at := now();

    INSERT INTO public."Rewards" (user_id, chain_id, earned_store, status)
    VALUES (NEW.user_id, v_chain_id, NEW.store_id, 'issued');
  END IF;

  UPDATE public."UserChainLoyalty"
  SET punch_count = v_card.punch_count,
      reward_count = v_card.reward_count,
      last_reset_at = v_card.last_reset_at,
      updated_at = now()
  WHERE id = v_card.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_reward_redeemed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Metadata edits and repeated redemption requests must not debit twice.
  -- Preserve admin reward voiding, which uses this same trigger.
  IF OLD.status = 'issued' AND NEW.status IN ('redeemed', 'voided') THEN
    UPDATE public."UserChainLoyalty"
    SET reward_count = GREATEST(COALESCE(reward_count, 0) - 1, 0),
        updated_at = now()
    WHERE user_id = OLD.user_id AND chain_id = OLD.chain_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_transaction_chain() OWNER TO postgres;
ALTER FUNCTION public.handle_reward_redeemed() OWNER TO postgres;

-- Trigger functions are invoked by table writes, not direct client RPC calls.
REVOKE ALL ON FUNCTION public.handle_new_transaction_chain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_reward_redeemed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_transaction_chain() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_reward_redeemed() TO service_role;

CREATE OR REPLACE TRIGGER on_reward_transaction_created_chain
  AFTER INSERT ON public."RewardTransaction"
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_transaction_chain();

-- Retain the legacy trigger name (including its spelling) to replace it in place.
CREATE OR REPLACE TRIGGER on_reward_redemeed
  AFTER UPDATE ON public."Rewards"
  FOR EACH ROW EXECUTE FUNCTION public.handle_reward_redeemed();

ALTER TABLE public."RewardTransaction" ENABLE TRIGGER on_reward_transaction_created_chain;
ALTER TABLE public."Rewards" ENABLE TRIGGER on_reward_redemeed;

COMMIT;
