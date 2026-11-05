# Dev readiness evidence

Inspected October 25, 2026 at approximately 22:17 America/Regina (audit timestamp `2026-10-26T04:17:29Z`). Environment: the separate Supabase project named `info@coffeesphut.com Dev`, reference `mnlgxujbjbuuslaccjtx`, PostgreSQL 17.11.

## Target verification

`supabase projects list` identified separate Dev and production projects. Both checked local website `.env.local` files and the existing `dev` checkout's CLI link point to production (`tcxenxliwzykhxzhlien`), not the Dev project. The active feature worktree has no environment file or project link.

P0 used explicit project selection for Dev and did not relink either checkout, copy credentials, or inspect production database records. A folder or branch called `dev` is not evidence of its backend environment. Before running the app against Dev, configure a reviewed Dev URL/key pair in the intended local environment; never copy the existing file assuming it is Dev.

The available mobile checkout's development, test, and production environment files also resolve to the production host. Only their configured URL hostnames were inspected; key values were not printed or copied. These files do not establish which configuration is in a deployed mobile build.

## Read-only audit

The audit completed with `transaction_read_only = on`, under an inspection role with complete RLS visibility as validated by the audit checker. It inspected public table/column/constraint/index metadata, RLS policies, function signatures/privileges/fingerprints, triggers, grants/default grants, migration versions, storage bucket settings, and aggregate data checks.

Raw metadata and type snapshots remain under ignored `.partner-portal/`; this document contains reviewed findings only. Function bodies, customer records, café names, and café code values were not returned by the audit.

| Check | Result |
| --- | --- |
| Public application tables present | 20 |
| Public application tables have RLS enabled | Yes; permissive policies still require narrowing |
| Migration versions recorded in Dev | 10 |
| Repository migration files | 14 |
| Applied versions absent locally / name mismatches | None |
| Café records / chain records | 0 / 0 |
| Null lifecycle / orphaned chain / blank code / duplicate code groups | 0 / 0 / 0 / 0 |
| Duplicate customer-chain card groups / invalid café threshold | 0 / 0 |
| Completed redeemed rewards | 0 |
| Redemption-café column | Absent |
| Required public RPCs `add_reward_stamp`, `redeem_reward`, `log_staff_login` | Absent |
| Deployed Dev Edge Functions listed by Management API | 0 |

Zero counts are real observations of this Dev project, not a pass for populated data. P0 has not measured existing production active counts, tested fourth-café races, verified old reward attribution, or established workload targets.

The separate Dev Edge Function metadata listing returned no functions. This does not establish that production has no Edge Functions, scheduled jobs, external service-role writers, or older clients. Those sources remain part of the production compatibility gate.

## Existing pending migrations

| Version | Migration | Consequence |
| --- | --- | --- |
| `20261013000000` | `log_staff_login` | Staff login audit RPC unavailable on Dev |
| `20261025000000` | `repair_cafe_id_sequence` | Existing sequence repair not recorded as applied |
| `20261025000100` | `restore_loyalty_handlers` | Latest concurrency/credit fixes not recorded as applied |
| `20261025000200` | `wire_reward_actions` | Website stamp/redemption RPCs unavailable on Dev |

The audit checker correctly exits nonzero for this mismatch. These migrations already existed before P0; no replacement migration or fallback direct write was introduced. Apply and validate them through the deployment procedure before testing current loyalty journeys on Dev. They were not applied during the read-only P0 inspection.

The pre-existing `20261008_add_filter_params_to_get_closest_cafes.sql` uses a shorter version identifier than other files. It matches Dev's recorded version. Keep its identity unchanged; do not rename an applied migration to standardize formatting.

## Generated type comparison

Generated `.partner-portal/dev-database.types.ts` from Dev for `public` and `graphql_public`. Compared it with `types/database.ts`:

- Café, gallery, menu and other table shapes match the checked-in types.
- Dev lacks the pending `log_staff_login` and `redeem_reward` functions.
- Checked-in `add_reward_stamp` is under `graphql_public.Functions`, whereas the migration defines it in `public`. Regenerate against the reconciled target schema rather than copying that misplaced entry forward manually.
- The current generator includes PostgREST version metadata not present in the checked-in file.

Do not overwrite application types with the behind-Dev snapshot. After applying the approved baseline and new migrations in a disposable/Dev database, regenerate and review the public RPC placements before changing the application's type file.

## P0 gate status

Repository inventory and live Dev metadata verification are complete. P0 remains open for unresolved policy details, deployed-client/external-writer verification, coordinated public-interface migration, representative data, and measurable release targets. Dev migration drift must be reconciled before feature integration tests can be meaningful.
