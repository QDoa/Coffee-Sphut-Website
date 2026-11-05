-- P0 inspection only: not a migration. Run as an operator against the explicitly
-- selected project. No names, customer IDs, cafe codes, or function bodies are
-- returned. Keep the full report local; publish only reviewed aggregate findings.
-- Requires the existing Coffee Sphut baseline and Supabase migration history.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH
  tables AS (
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
           c.relkind::text AS relation_kind, c.reloptions AS options
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm'))
       OR (n.nspname = 'storage' AND c.relname IN ('objects', 'buckets'))
  ),
  columns AS (
    SELECT table_schema, table_name, ordinal_position, column_name, data_type,
           udt_schema, udt_name, is_nullable, column_default, is_identity,
           is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_schema = 'public'
  ),
  constraints AS (
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           k.conname AS name, k.contype::text AS type, k.convalidated AS validated,
           pg_catalog.pg_get_constraintdef(k.oid) AS definition
    FROM pg_catalog.pg_constraint k
    JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  ),
  policies AS (
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
       OR (schemaname = 'storage' AND tablename IN ('objects', 'buckets'))
  ),
  functions AS (
    SELECT n.nspname AS schema_name, p.proname AS name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
           pg_catalog.pg_get_function_result(p.oid) AS result,
           p.prosecdef AS security_definer, p.proconfig AS settings,
           md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_fingerprint,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'role', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                            ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
               'privilege', a.privilege_type
             ) ORDER BY a.grantee, a.privilege_type)
             FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
           ), '[]'::jsonb) AS privileges
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend d
        WHERE d.classid = 'pg_catalog.pg_proc'::regclass
          AND d.objid = p.oid AND d.deptype = 'e'
      )
  ),
  triggers AS (
    SELECT c.relname AS table_name, t.tgname AS name,
           t.tgenabled::text AS enabled,
           pg_catalog.pg_get_triggerdef(t.oid) AS definition
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  ),
  grants AS (
    SELECT grantee, table_schema, table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema IN ('public', 'storage')
      AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ),
  default_grants AS (
    SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner,
           COALESCE(n.nspname, '*') AS schema_name,
           d.defaclobjtype::text AS object_type,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
           a.privilege_type
    FROM pg_catalog.pg_default_acl d
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
    WHERE n.nspname = 'public' OR d.defaclnamespace = 0
  ),
  chain_counts AS (
    SELECT ch.id AS chain_id, count(c.id) AS cafes,
           count(c.id) FILTER (WHERE c.is_active IS TRUE) AS active_cafes,
           count(c.id) FILTER (WHERE c.is_active IS FALSE) AS inactive_cafes,
           count(c.id) FILTER (WHERE c.is_active IS NULL) AS unknown_lifecycle_cafes
    FROM public."Chains" ch
    LEFT JOIN public."Cafe" c ON c.chain_id = ch.id
    GROUP BY ch.id
  ),
  duplicate_codes AS (
    SELECT count(*) AS occurrences
    FROM public."Cafe"
    WHERE NULLIF(btrim(reward_code), '') IS NOT NULL
    GROUP BY reward_code HAVING count(*) > 1
  ),
  duplicate_cards AS (
    SELECT count(*) AS occurrences
    FROM public."UserChainLoyalty"
    GROUP BY user_id, chain_id HAVING count(*) > 1
  ),
  reward_statuses AS (
    SELECT status, count(*) AS events, min(issued_at) AS earliest_issued_at,
           max(issued_at) AS latest_issued_at
    FROM public."Rewards" GROUP BY status
  ),
  inventory AS (
    SELECT jsonb_build_object(
      'cafes', (SELECT count(*) FROM public."Cafe"),
      'chains', (SELECT count(*) FROM chain_counts),
      'chains_over_three_active', (SELECT count(*) FROM chain_counts WHERE active_cafes > 3),
      'cafes_with_null_lifecycle', (SELECT count(*) FROM public."Cafe" WHERE is_active IS NULL),
      'cafes_without_matching_chain', (SELECT count(*) FROM public."Cafe" c LEFT JOIN public."Chains" ch ON ch.id = c.chain_id WHERE ch.id IS NULL),
      'cafes_with_blank_code', (SELECT count(*) FROM public."Cafe" WHERE reward_code IS NOT NULL AND btrim(reward_code) = ''),
      'duplicate_cafe_code_groups', (SELECT count(*) FROM duplicate_codes),
      'duplicate_loyalty_card_groups', (SELECT count(*) FROM duplicate_cards),
      'cafes_with_invalid_threshold', (SELECT count(*) FROM public."Cafe" c JOIN public."Chains" ch ON ch.id = c.chain_id WHERE COALESCE(c.loyalty_threshold_override, ch.loyalty_threshold) <= 0),
      'redeemed_rewards', (SELECT count(*) FROM public."Rewards" WHERE status = 'redeemed'),
      'issued_with_redemption_timestamp', (SELECT count(*) FROM public."Rewards" WHERE status = 'issued' AND redeemed_at IS NOT NULL),
      'has_redemption_cafe_column', EXISTS (SELECT 1 FROM columns WHERE table_name = 'Rewards' AND column_name IN ('redeemed_store', 'redeemed_cafe_id')),
      'max_cafe_id', (SELECT max(id) FROM public."Cafe"),
      'cafe_sequence', pg_catalog.pg_get_serial_sequence('public."Cafe"', 'id')
    ) AS data
  )
SELECT jsonb_build_object(
  'report_version', 1,
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'inspection_role', (SELECT jsonb_build_object('name', r.rolname, 'superuser', r.rolsuper, 'bypass_rls', r.rolbypassrls) FROM pg_catalog.pg_roles r WHERE r.rolname = current_user),
  'tables', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema_name, t.table_name) FROM tables t), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_schema, c.table_name, c.ordinal_position) FROM columns c), '[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name, c.name) FROM constraints c), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename, i.indexname) FROM pg_catalog.pg_indexes i WHERE i.schemaname = 'public'), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname, p.tablename, p.policyname) FROM policies p), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name, f.arguments) FROM functions f), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_name, t.name) FROM triggers t), '[]'::jsonb),
  'table_grants', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_schema, g.table_name, g.grantee, g.privilege_type) FROM grants g), '[]'::jsonb),
  'default_grants', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.schema_name, g.object_type, g.grantee, g.privilege_type) FROM default_grants g), '[]'::jsonb),
  'migrations', COALESCE((SELECT jsonb_agg(jsonb_build_object('version', m.version, 'name', m.name) ORDER BY m.version) FROM supabase_migrations.schema_migrations m), '[]'::jsonb),
  'storage_buckets', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'public', b.public, 'file_size_limit', b.file_size_limit, 'allowed_mime_types', b.allowed_mime_types) ORDER BY b.id) FROM storage.buckets b), '[]'::jsonb),
  'cafe_sequences', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sequencename) FROM pg_catalog.pg_sequences s WHERE s.schemaname = 'public' AND quote_ident(s.schemaname) || '.' || quote_ident(s.sequencename) = pg_catalog.pg_get_serial_sequence('public."Cafe"', 'id')), '[]'::jsonb),
  'chain_cafe_counts', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.chain_id) FROM chain_counts c), '[]'::jsonb),
  'reward_status_counts', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.status) FROM reward_statuses r), '[]'::jsonb),
  'data_checks', (SELECT data FROM inventory)
) AS partner_portal_p0;

ROLLBACK;
