> Reference only, superseded by the v1 rebuild. Do not merge.

# Partner portal implementation

Current status (November 5, 2026): see the [implementation and validation report](IMPLEMENTATION_REPORT.md) for the working portal, test results, preview instructions and remaining production gates. The P0/P1 notes below are historical preparation evidence.

Managed image uploads, private previews, retryable staff publication and administrator cleanup are implemented. See the [media operation and recovery runbook](MEDIA_WORKFLOW.md).

Status: P0 repository/Dev inspection complete; first P1 permission rules implemented. Compatibility, deployment and later feature gates remain open. Updated October 25, 2026 (America/Regina).

The [implementation plan](../../PARTNER_PORTAL_IMPLEMENTATION_PLAN.md) remains the delivery outline. This folder records implementation evidence and decisions rather than silently turning PRD proposals into policy.

## Deliverables

| Deliverable | Status | Evidence |
| --- | --- | --- |
| First-release policy register | Initial decisions confirmed; remaining decisions identified | [Decisions and permissions](decisions.md) |
| Complete café field coverage | Generated and checked against repository database types | [Field inventory](cafe-field-coverage.md) |
| Web/mobile consumers and reward writers | Local sources inspected; deployed-client versions and external writers still need verification | [Compatibility contract](compatibility.md) |
| Dev schema, grants, policies, functions, triggers, migrations, and data shape | Captured in a read-only transaction on the separately identified Dev project | [Dev readiness](dev-readiness.md) |
| Type regeneration and schema comparison | Dev types generated separately; application types intentionally preserved because Dev is behind | [Dev readiness](dev-readiness.md) |
| Repeatable inspection and migration/rollback procedure | Audit SQL, validator, and runbook added | [Runbook](migration-runbook.md) |
| Performance, availability, retention, recovery targets | Not agreed | [Open decisions](decisions.md#remaining-decisions) |

## Tooling

- `supabase/audits/partner-portal-p0.sql`: operator-only, read-only transaction; schema metadata and aggregate checks, no customer records or café code values.
- `scripts/partner-portal/p0-audit.ts`: validate an audit and compare applied versus repository migration versions. Returns a nonzero exit code for an environment mismatch; this does not apply migrations.
- `scripts/partner-portal/p0-audit.test.ts`: rejects incomplete/non-read-only/RLS-filtered evidence and verifies migration/RPC mismatch detection.
- `scripts/partner-portal/cafe-field-coverage.ts`: exhaustive schema-typed inventory and deterministic Markdown generator. Updating generated café types forces the inventory to account for new fields during type-checking.
- `.partner-portal/`: ignored local snapshots. Do not commit raw audit results, environment files, credentials, or unreviewed schema dumps.

Commands from the repository root:

```sh
pnpm exec tsx scripts/partner-portal/cafe-field-coverage.ts --check
pnpm exec tsx --test scripts/partner-portal/p0-audit.test.ts
pnpm exec eslint scripts/partner-portal/*.ts
pnpm exec tsc --noEmit --incremental false
```

Validation on October 25: frozen-lockfile install with pnpm 10.28.2 succeeded; field inventory generation/check, TypeScript checking, and targeted ESLint passed. All 31 tests passed across the P0 validator and existing reward/image suites. The SQL audit ran successfully on Dev; the readiness checker intentionally reported failure because of the four unapplied baseline migrations and missing RPCs. Local migration replay/concurrency tests were not run because Docker was not running. No Next.js runtime code changed, so a production build was not needed for this P0 tooling change.

## What can proceed next

1. Connect the confirmed membership and permission rules to fresh server/database records and RLS. Archival mapping/history and independent staff review are now confirmed too.
2. Prepare additive public-interface and partner-foundation changes against a disposable database, following the confirmed permissions. Keep existing public clients working until their replacements are verified.
3. Reconcile the four existing pending migrations on Dev as a separate deployment step with the runbook and loyalty regression checks. P0 inspection did not apply them.
4. Coordinate the mobile change from café codes to a loyalty-availability boolean before removing the legacy public code exposure.

P0 release gates remain open: empty Dev data is not evidence that populated production is clean, the mobile source checkout is not proof of the deployed build, and measurable release targets remain unset. No partner route, new entitlement, or hosted policy change has been activated.

## P1 permission foundation

`lib/partner/permissions.ts` implements the confirmed role/scope/plan rules as pure functions: active actor membership, same-chain context, assigned-café scope, explicit subscription locks, confirmed Paid activation, and the Owner-only team/billing permissions. Café managers have read-only shared chain recipes. Archived details and reports remain accessible under the same authorization rules; null lifecycle values are denied pending review.

`lib/partner/reviews.ts` rejects self-review even for internal admins and editors. It requires another currently authorized staff actor and the immutable submission's submitter identity.

These are reusable entry-point rules, not the database security boundary. Callers must load context from fresh, authoritative server records; none may come from form fields or long-lived role/plan claims. Future database RLS/functions must independently enforce the same rules, including the transactional reviewer check. Slot allocation, stock writes, invitation delivery, effective subscription transitions, and public client rollout are not enabled by these helpers.

P1 foundation validation: all 43 tests passed across partner permissions/reviews, the P0 validator, and existing reward/image suites. TypeScript, targeted ESLint, field inventory checks, and the production build passed. During static generation the store fetch logged missing Supabase environment variables because this feature worktree has no environment file; the build completed, but this is not a live backend/integration check. No existing production-pointing environment file was copied into the worktree.
