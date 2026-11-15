-- Optional Lagoon & Bean showcase data for the isolated local preview.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = '10000000-0000-4000-8000-000000000001' AND email = 'owner@example.test'
  ) OR NOT EXISTS (
    SELECT 1 FROM public."Cafe"
    WHERE id = 101 AND chain_id = '20000000-0000-4000-8000-000000000001'
      AND reward_code = 'local-only-101'
  ) THEN
    RAISE EXCEPTION 'The synthetic Lagoon & Bean preview is required.';
  END IF;
END;
$$;

INSERT INTO auth.users(id,email)
VALUES ('10000000-0000-4000-8000-000000000006','operations@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.partner_memberships(id,chain_id,user_id,role)
VALUES ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000006','chain_manager')
ON CONFLICT DO NOTHING;

-- Add stock scenarios with a balanced ledger. Existing items and movements are preserved.
WITH items(cafe_id,code,name,kind,unit,threshold) AS (
  VALUES (101,'DEMO-LIDS','Takeaway lids','product','each',30),
         (102,'DEMO-SLEEVES','Paper cup sleeves','product','each',15),
         (102,'DEMO-DECAF','Decaf espresso beans','ingredient','g',300)
), feed(code,days_ago,kind,quantity,reason) AS (
  VALUES ('DEMO-LIDS',14,'opening',140,'Opening count'),
         ('DEMO-LIDS',8,'consumption',-60,'Takeaway service'),
         ('DEMO-LIDS',5,'receipt',30,'Packaging delivery'),
         ('DEMO-LIDS',1,'consumption',-92,'Takeaway service'),
         ('DEMO-SLEEVES',12,'opening',90,'Opening count'),
         ('DEMO-SLEEVES',6,'consumption',-35,'Takeaway service'),
         ('DEMO-SLEEVES',1,'consumption',-55,'Takeaway service'),
         ('DEMO-DECAF',15,'opening',1000,'Opening count'),
         ('DEMO-DECAF',10,'consumption',-320,'Espresso service'),
         ('DEMO-DECAF',4,'consumption',-300,'Espresso service'),
         ('DEMO-DECAF',1,'wastage',-40,'Grinder calibration')
), inserted AS (
  INSERT INTO public.partner_items(chain_id,cafe_id,code,name,type,unit,balance,threshold)
  SELECT '20000000-0000-4000-8000-000000000001',i.cafe_id,i.code,i.name,i.kind,i.unit,sum(f.quantity),i.threshold
  FROM items i JOIN feed f USING (code)
  GROUP BY i.cafe_id,i.code,i.name,i.kind,i.unit,i.threshold
  ON CONFLICT (cafe_id,code) DO NOTHING
  RETURNING id,chain_id,cafe_id,code
)
INSERT INTO public.partner_movements(chain_id,cafe_id,item_id,type,quantity,resulting_balance,actor,reason,created_at)
SELECT i.chain_id,i.cafe_id,i.id,f.kind,f.quantity,
  sum(f.quantity) OVER (PARTITION BY i.id ORDER BY f.days_ago DESC),
  '10000000-0000-4000-8000-000000000001','Demo · '||f.reason,now()-f.days_ago*interval '1 day'
FROM inserted i JOIN feed f USING (code);

-- Fill recent completed days with up to two redemptions per day and 15 per week.
-- Fixed time slots make re-running the seed safe while references are random UUIDs.
WITH account AS (
  SELECT chain_id, timezone, (now() AT TIME ZONE timezone)::date AS today
  FROM public.partner_accounts WHERE chain_id='20000000-0000-4000-8000-000000000001'
), candidates AS (
  SELECT a.chain_id, c.id AS cafe_id, date_trunc('week', day.local_date) AS week_start,
    (day.local_date + time '08:00' + (slot * 223 + ((day.local_date - date '2020-01-01') * 43 % 145)) * interval '1 minute')
      AT TIME ZONE a.timezone AS redeemed_at,
    a.timezone
  FROM account a
  CROSS JOIN generate_series(1,7) days_ago
  CROSS JOIN generate_series(0,1) slot
  CROSS JOIN LATERAL (SELECT a.today - days_ago AS local_date) day
  JOIN public."Cafe" c ON c.chain_id=a.chain_id AND c.is_active IS TRUE
    AND c.id=101 + (extract(isodow FROM day.local_date)::int + slot) % 2
), available AS (
  SELECT c.*, row_number() OVER (PARTITION BY c.week_start ORDER BY c.redeemed_at DESC) AS slot_rank
  FROM candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM public."Rewards" r
    WHERE r.chain_id=c.chain_id AND r.redeemed_cafe_id=c.cafe_id AND r.redeemed_at=c.redeemed_at
  )
)
INSERT INTO public."Rewards"(id,user_id,chain_id,earned_store,status,redeemed_cafe_id,redeemed_at,issued_at)
SELECT gen_random_uuid(),'10000000-0000-4000-8000-000000000001',c.chain_id,c.cafe_id,
  'redeemed',c.cafe_id,c.redeemed_at,c.redeemed_at-interval '3 days'
FROM available c
WHERE c.slot_rank <= 15 - (
  SELECT count(*) FROM public."Rewards" r
  WHERE r.chain_id=c.chain_id AND r.status='redeemed'
    AND r.redeemed_at >= c.week_start AT TIME ZONE c.timezone
    AND r.redeemed_at < (c.week_start + interval '1 week') AT TIME ZONE c.timezone
);

-- Use the real command paths for a saved draft and a review notification.
-- The existing Lekki request stays available for the approval walkthrough.
DO $$
DECLARE
  chain constant uuid := '20000000-0000-4000-8000-000000000001';
  owner_id constant uuid := '10000000-0000-4000-8000-000000000001';
  reviewer_id constant uuid := '10000000-0000-4000-8000-000000000004';
  submitted_id uuid;
  baseline bigint;
BEGIN
  SELECT partner_revision INTO STRICT baseline FROM public."Cafe" WHERE id=101 AND chain_id=chain;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  IF NOT EXISTS (
    SELECT 1 FROM public.partner_operations
    WHERE actor=owner_id AND request_id='66000000-0000-4000-8000-000000000001'
  ) THEN
    PERFORM public.partner_command('save_change',jsonb_build_object(
      'chain_id',chain,'cafe_id',101,'baseline',baseline,
      'request_id','66000000-0000-4000-8000-000000000001',
      'payload',jsonb_build_object('name','Lagoon & Bean • Victoria Island',
        'description','A neighbourhood espresso bar with rotating single-origin coffees and pastries.')
    ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.partner_operations
    WHERE actor=owner_id AND request_id='66000000-0000-4000-8000-000000000002'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.partner_changes WHERE chain_id=chain AND cafe_id=101 AND status='pending'
  ) THEN
    submitted_id := (public.partner_command('submit_change',jsonb_build_object(
      'chain_id',chain,'cafe_id',101,'baseline',baseline,
      'request_id','66000000-0000-4000-8000-000000000002',
      'payload',jsonb_build_object('name','Lagoon & Bean • Victoria Island',
        'description','Ask our baristas about the new seasonal espresso menu.')
    ))->>'id')::uuid;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated')::text,true);
    PERFORM public.partner_command('review',jsonb_build_object(
      'chain_id',chain,'id',submitted_id,'decision','reject',
      'reason','Please confirm the seasonal menu before publishing this description.',
      'request_id','66000000-0000-4000-8000-000000000003'
    ));
  END IF;
END;
$$;

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT public.partner_sync_demo_pos('20000000-0000-4000-8000-000000000001') AS new_demo_orders;

COMMIT;
