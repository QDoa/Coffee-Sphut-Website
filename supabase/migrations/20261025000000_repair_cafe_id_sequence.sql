BEGIN;

-- Imported IDs can leave the identity sequence behind existing cafés.
-- Block inserts while reading the maximum and only advance the sequence.
LOCK TABLE public."Cafe" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  cafe_sequence regclass := pg_get_serial_sequence('public."Cafe"', 'id')::regclass;
  maximum_id bigint;
  sequence_value bigint;
BEGIN
  IF cafe_sequence IS NULL THEN
    RAISE EXCEPTION 'Cafe.id has no owned sequence';
  END IF;

  SELECT max(id) INTO maximum_id FROM public."Cafe";
  EXECUTE format('SELECT last_value FROM %s', cafe_sequence)
    INTO sequence_value;

  IF maximum_id IS NOT NULL AND maximum_id >= sequence_value THEN
    PERFORM setval(cafe_sequence, maximum_id, true);
  END IF;
END;
$$;

COMMIT;
