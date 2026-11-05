# Partner portal inspection and deployment runbook

P0 supplies inspection and rollout preparation. Commands below are separate stages, not a script to run unattended. Do not infer backend identity from a worktree/branch name. The known local `dev` checkout is configured for production; see [Dev readiness](dev-readiness.md).

## 1. Repeat the P0 read-only inspection

From this repository, inspect `supabase projects list --output json` and verify the intended project reference. The observed Dev reference is `mnlgxujbjbuuslaccjtx`. Do not use an implicit project link.

With Supabase CLI 2.117.0, `db query` requires `--linked` together with the explicit `--project-ref` override; this does not relink the checkout. Later CLI versions may differ: inspect installed help before using these commands.

```sh
mkdir -p .partner-portal
supabase db query --linked --project-ref mnlgxujbjbuuslaccjtx --file supabase/audits/partner-portal-p0.sql --output json > .partner-portal/dev-audit.raw.json
pnpm exec tsx scripts/partner-portal/p0-audit.ts .partner-portal/dev-audit.raw.json
supabase gen types typescript --project-id mnlgxujbjbuuslaccjtx --schema public,graphql_public > .partner-portal/dev-database.types.ts
diff -u types/database.ts .partner-portal/dev-database.types.ts
```

`diff` exits 1 for differences; the audit checker exits 1 for migration/function/RLS mismatches. Inspect those findings, rather than treating a generated file as evidence the environment is ready. The checker is necessary evidence, not a complete security proof: enabled RLS can still have public permissive policies.

The SQL audit is a read-only repeatable-read transaction with statement and lock timeouts; it ends with rollback. It requires the baseline application tables and Supabase migration history. It must run as an authorized operator with complete data visibility; the validator rejects counts from an RLS-restricted role. Never call `nextval`, repair sequences, or change grants as part of an inspection.

Review aggregate findings before publishing them. Raw reports can contain private schema details and tenant IDs even though customer records and café code values are excluded. Keep snapshots ignored and limit access to operator machines. Do not commit environment files or tokens. P0 deliberately excludes function bodies; inspect known source definitions separately if fingerprints or installed versions need investigation.

## 2. Prepare a disposable database

1. Start a disposable local Supabase environment or a dedicated disposable test project; identify it separately from Dev/production. Docker was not running during P0, so local replay was not performed.
2. Replay the repository baseline/migrations and check fixture/seed setup; `supabase/config.toml` names `seed.sql`, which is not currently tracked. Configure an explicit test seed policy before a fresh reset; do not reset a hosted target to investigate this.
3. Run the existing loyalty tests before new portal migrations. Use SQL fixtures rolled back after assertions and separate sessions for concurrency tests.
4. Test pending/new migrations against populated synthetic fixtures: multiple chains, more than three cafés, null lifecycle flags, shared assets, different assignments, and historic rewards. Empty Dev alone is insufficient.

Existing regression commands:

```sh
pnpm exec tsx --test lib/rewards.test.ts lib/admin/cafe-images.test.ts scripts/partner-portal/p0-audit.test.ts
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/loyalty-handlers.sql
```

`LOCAL_DATABASE_URL` must identify the disposable database. Never paste connection strings into committed scripts. The SQL suite requires operator privileges and rolls back rows, but identity sequences may advance.

## 3. Reconcile the existing Dev migration baseline

This is a deployment step, not part of read-only P0. Review the four pending migrations and the target identity immediately before applying them. Use a minimal target configuration or an explicit verified connection so the existing production CLI link cannot redirect the deployment.

- Back up as appropriate to the target and verify migration history, duplicate customer-chain cards, code uniqueness, sequence ownership, and current active counts.
- Review an application plan/dry run against the explicit Dev target using installed CLI capabilities. Do not push hosted Auth configuration as a side effect.
- Apply existing migrations in repository order before adding portal migrations. Do not repair migration history to pretend an unapplied migration has run.
- Rerun the audit and generate a fresh type snapshot. Required RPCs must exist in `public` with intended execution privileges, and expected triggers must be enabled.
- Run loyalty regression and QR integration checks against disposable/test data. Preserve real authentication and Storage RLS during permission checks.

Do not rewrite the shorter existing `20261008` migration version; it is already applied with that identifier.

## 4. Add portal changes in stages

1. Add backward-compatible public discovery/by-ID and reward availability interfaces and verified redemption-café capture. Record a coverage start timestamp; never fabricate legacy redemption cafés from issuance cafés.
2. Validate and release replacement web/mobile clients for nearby search, saved café lookup, customer rewards, and QR operations. Agree legacy version cutoff before removing exposure.
3. Add partner account/membership/assignment/entitlement tables, explicit grants/RLS, transactional audit support, and concurrency-safe functions. Avoid implicit API-role default privileges.
4. Add reviewed café aggregate/lifecycle paths. Extend revision tracking to internal staff writes so they invalidate stale partner submissions. Apply the Free slot check at approved activation.
5. Add private staged-media storage and retryable publication/cleanup handling. Database associations and filesystem/storage writes cannot be one SQL transaction.
6. Generate application types from the reconciled database and review the diff; regenerate field coverage and run type-checks. Keep partner operational recipes separate from public editorial recipes.
7. Enable internal reviewers first, then limited Free access. Enable Paid inventory/recipes only after authoritative activation and complete downgrade/re-upgrade access tests pass.

## 5. Flags and reconciliation

Use server-controlled rollout flags for partner sign-in, submissions/review, reports, inventory/recipes, and subscription activation. Default new feature flags off until their gate passes. A flag controls rollout; database authorization still protects direct requests and existing records. Decide the exact flag mechanism when P1 is implemented; P0 does not introduce inert configuration variables.

After each stage, reconcile:

- Migration identity/signature/privilege/trigger state against the intended release.
- Total cafés versus active/archived/restricted and partner-accessible counts.
- Unique completed events versus report totals and attribution coverage.
- Stock movement sums versus locked balances; corrective adjustments and duplicate-request handling.
- Authoritative subscriptions versus effective local entitlements/selected cafés.
- Audit completeness and failed staged-media publication/cleanup candidates.

## 6. Rollback and recovery

Disable affected new writes or activation through server controls while keeping authorization enforced. Preserve café IDs, requests, stock history, recipes, events, and entitlement records. Prefer a reviewed forward fix over a destructive schema rollback.

Before deployment, verify compatibility with the previous application release. If removing legacy public access breaks an old mobile client, use the coordinated client cutoff/forward-recovery plan; do not restore secret exposure as an automatic rollback. Never delete retained data to restore Free limits.

Record incident and recovery owners, backup retention, acceptable data-loss window (RPO), restore time (RTO), and a successful restore/reconciliation drill before Paid general release. Numeric targets remain product/operations decisions, not defaults invented by this runbook.
