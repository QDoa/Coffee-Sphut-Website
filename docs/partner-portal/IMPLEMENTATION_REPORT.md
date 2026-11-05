# Partner portal implementation and validation report

Date: November 5, 2026. Branch: `codex/partner-portal`.

## Outcome

A working partner portal core is implemented and tested with a disposable local Postgres database and browser preview. It includes tenant/café authorization, reviewed café changes, reward reporting, inventory, shared recipes, manager invitations, explicit staff-recorded plan activation, and reviewed managed image uploads.

**The entire production release plan is not complete.** Payment-provider billing, coordinated mobile rollout, hosted authentication delivery checks, and production operational acceptance still require work. This report distinguishes implemented behavior from those remaining gates; no hosted project was migrated or deployed during this run.

## Try the implementation

The local preview opens without sign-in:

- Partner workspace: <http://127.0.0.1:3100/partner/overview>
- Independent test staff reviewer: <http://127.0.0.1:3100/partner/preview-review>

The preview uses synthetic North Star Coffee data, separate partner identities, café-specific inventory, recipes and reward events. Browser tests may leave synthetic requests and movements in that workspace.

If the preview is stopped, start Docker Desktop, then run:

```sh
pnpm install --frozen-lockfile
pnpm partner:local
pnpm partner:preview
```

This machine already has the isolated `coffee-partner-test`, `coffee-partner-rest`, and `coffee-partner-storage` containers. The stack script retains existing synthetic data; it does not reset an existing database. Ports 3100, 55431, 55432, 55434, and 55435 bind to loopback only. Stop the preview with Ctrl+C; stop its containers with `docker stop coffee-partner-storage coffee-partner-rest coffee-partner-test` when no longer needed.

## Authentication during unattended testing

Sign-in is bypassed only when `PARTNER_LOCAL_PREVIEW=1`, the API URL is exactly the dedicated loopback proxy, the application host is loopback, the process is not production, and it is not running on Vercel. The preview supplies synthetic signed identities to the actual PostgREST/database functions; it does not disable database RLS. The test reviewer uses a different synthetic identity from the submitting Owner.

Hosted authentication, existing admin checks and Storage deletion permissions remain enabled. Production portal routes require `PARTNER_PORTAL_ENABLED=1` as a deliberate rollout gate. The gate does not replace authentication or database authorization. Fixture credentials/JWTs are local-only test values; generated environment files and reports are ignored by Git.

## Implementation by work package

| Plan area                    | Implemented                                                                                                                                                                                                                                                                                                                                              | Remaining before production release                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0: policy and preparation   | Confirmed decision register, exhaustive field inventory, consumer inventory, read-only audit tooling, target/environment evidence, rollout runbook                                                                                                                                                                                                       | Refresh the October 25 hosted findings; confirm current deployed mobile versions/external writers and workload/recovery targets                                                                             |
| P1: partner foundation       | Private partner account, membership, assignment, invitation and audit tables; one active chain per user; RLS; protected RPCs; password sign-in/recovery/callback; Owner/Chain Manager/Café Manager scope; immediate revocation                                                                                                                           | Hosted Auth redirect/SMTP verification; new managers currently use an existing Coffee Sphut account (registration remains in the mobile app); Owner identity transfer remains staff-managed                 |
| P2: cafés and approvals      | Full business-field form, private café code, named draft links/resume/rejection/resubmission, independent whole-request review, optimistic revisions, archive/reactivate and Free-slot locks; private managed cover/gallery uploads, authorized previews, persisted publication intent with retry, admin cleanup and shared/draft/pending URL protection | Agree automatic staging retention and cleanup scheduling; hosted Storage smoke test. Café chain transfers remain staff-managed and need a reconciled support procedure                                      |
| P3: reward reporting         | Actual redemption café captured by existing redemption RPC, unique completed reward rows, accessible-café/date filters, chain timezone, event pagination, refresh/coverage information, explicit error versus zero; minimal public availability RPC                                                                                                      | Historic redemption café cannot be reconstructed from earning café; verify other writers. No invented reward taxonomy or reversal workflow                                                                  |
| P4: inventory                | Independent café items/balances, ingredients/products, opening stock/receipts/consumption/wastage/counts/corrections, append-only movements, thresholds, deactivation, concurrency-safe balance changes and retries                                                                                                                                      | Product validation of the provisional units and stock policies; supplier/transfer/sales integrations remain outside scope. UI history currently shows the latest 100 movements                              |
| P5: chain recipes            | Shared ingredient definitions and recipes, positive quantities/yield, unit/tenant checks, create/revise/deactivate, café-manager read-only access, no stock deduction on recipe edits                                                                                                                                                                    | Confirm long-term chain catalog design; no automatic recipe deduction or unit conversion is implemented                                                                                                     |
| P6: subscriptions            | Owner plan display, contact upgrade action, explicit admin activation record, audited/idempotent plan changes, chosen Free cafés, retained-but-locked data, restoration on Paid reactivation                                                                                                                                                             | Monthly price/provider/tax handling and checkout, webhooks/reconciliation against a provider, scheduled cancellation and payment-failure grace; these were unresolved and no commercial policy was invented |
| P7: verification and rollout | Domain tests, real DB/RLS tests, multi-session races, browser workflows, responsive screenshots, clean migration replay, local backup/restore drill, advisor check and production compilation                                                                                                                                                            | Production pilot, realistic-volume performance tests, agreed SLO/RPO/RTO and retention, alerting/operational ownership, final launch approval                                                               |

## Key implementation details

- Normal partner operations use session-aware Supabase clients. Private operations are exposed through `partner_snapshot` and `partner_command`, which derive the actor from `auth.uid()` and check fresh membership, tenant, café, role and plan state.
- Direct writes to new private tables are not granted to API roles. RLS separately protects reads, including café assignments and Paid-only tables. New functions use a fixed empty search path and explicit execution grants.
- A consistent account lock serializes café activation and plan/stock mutations. A request retry cannot expose an old balance after downgrade/revocation; current access is rechecked before returning a cached result.
- Approved café values remain live while a draft/request is pending. Existing staff changes and gallery/menu changes advance the café revision. Stale approvals and self-review fail without publishing partial changes.
- Stock counts calculate a delta against the locked current balance. Movements cannot be overwritten/deleted through partner APIs. Corrections are additional movements; recipe edits do not recalculate history.
- Shared recipe ingredient definitions expose the name/unit needed for chain recipes, without exposing other cafés' stock balances.
- Free café selection is separate from archival. A subscription lock does not unpublish a previously approved public café listing. Archival removes public discovery after staff approval and retains authorized private history.

## Managed image workflow completed in this follow-up

Partners can upload JPEG, PNG or WebP cover/gallery files up to 5 MB each. The server checks file signatures and size; Storage enforces bucket limits, current membership/café scope and immutable object paths. Upload metadata is checked before the file becomes selectable. Drafts retain selected upload IDs across saves and resubmission.

Private images render through an authenticated, uncached application route. There are no reusable signed preview links or browser service-role keys. Staff see the proposed cover and gallery before approval. Self-review remains blocked. Clicking approval records the independent reviewer's publication intent before copying any bytes into the public bucket. If a copy or final database approval fails, approved café references stay unchanged. A retry verifies already copied bytes and finishes the same deterministic paths; the final café/menu/gallery update retains existing revision and Free-slot checks.

An administrator can claim an unused upload for cleanup from the staff screen. Draft, pending and live references—including encoded URL aliases and shared references—are checked, and fresh references cannot attach to a claimed upload. Physical deletion uses only the authenticated Storage API. Failed cleanup stores its error and can be retried; metadata receipts remain available. Legacy admin cleanup now also protects partner references and registered assets. Staff provisioning, activation and cleanup controls are visible only to admins; server checks still enforce each action.

Publication retries and cleanup are staff-triggered. No background deletion schedule or automatic expiry was invented. An interrupted publication can leave already reviewed copies in the public bucket while the café request remains pending; retry approval or reject it and explicitly clean up detached files. See [MEDIA_WORKFLOW.md](MEDIA_WORKFLOW.md) for the operator procedure and remaining hosted acceptance checks.

## Provisional development choices

These choices make the local implementation concrete; they do not settle the remaining business decisions:

- Inventory base units: grams, millilitres, and each; no automatic conversions; six decimal places; no negative stock; counts/corrections require reasons.
- Ingredient definitions currently reference chain-owned café inventory items. Recipes are shared across the chain, while balances stay local to each café.
- Manager invitation links expire after seven days, are bound to the invited account email, and can be revoked. Owners cannot remove/replace the Owner through the manager flow.
- Staff-recorded plan changes are immediate and require an approval/reference reason. Free access requires an explicit café selection; there is no automatic fallback, payment grace or scheduled cancellation.
- Plan pricing remains unconfigured. No customer was billed and no checkout success screen can grant Paid access.

## Public API and mobile rollout

The website now uses `public_cafes_v2`, `get_closest_cafes_v2`, and `reward_available`. These interfaces omit private café codes and filter archived cafés from discovery.

The legacy mobile source reads raw café codes as a loyalty-availability flag and performs direct café/gallery lookups. A prepared [mobile reader patch](mobile-v2-readers.patch) switches those reads to the v2 interfaces and `has_reward`; `git apply --check` succeeded against the available mobile checkout. The mobile repository was not modified or released.

`supabase/rollout/partner-private-boundary.sql` is a **separate, coordinated release step**, tested locally. It narrows direct café/gallery/menu reads, customer reward/card reads, and direct reward mutations. Apply it only after supported mobile versions use the new interfaces. Until that cutoff is applied, the pre-existing legacy public exposure remains; the additive portal migration alone does not establish the complete public/private contract.

## Verification evidence

- 76 domain/action/audit/helper tests passed, including the new preview guards and café-field round trips, plus the existing reward, image and deep-link regressions.
- 18 core Postgres integration tests and 3 post-cutoff privacy tests passed, including real RLS roles, cross-tenant/assignment denial, revocation, Free feature denial, reviewed publication, rejection/stale/self-review checks, receipt/consume/count integrity, immutable history, recipe ownership/units, downgrade preservation and re-upgrade, invitation binding, and actual redemption-café reporting.
- Multi-session tests passed for the final Free slot, competing consumption with insufficient combined stock, and a stock write waiting behind a downgrade.
- 8 browser tests passed: every portal screen, pending-to-approved café publication, receipt feedback/history, interactive recipe creation, named draft resume/submit, private upload and reviewer preview/publication, authenticated administrator cleanup, and responsive inventory/image-editor layouts at 320, 390, 897 and 1280 pixels. Screenshots and browser traces are under ignored `.partner-portal/`.
- 6 additional integration tests passed against real local Supabase Storage v1.80.2 and PostgREST v14.5: tenant/café scope, revocation, immutable/private files, injected partial-copy failure and idempotent retry, stale final approval rollback, draft/live reference protection, cleanup retries and encoded URL aliases.
- All repository migrations, including `20261105151503_partner_managed_images.sql`, were replayed from scratch into `partner_replay`. The existing `supabase/tests/loyalty-handlers.sql` assertions passed there.
- The earlier core-validation `pg_dump` was restored into a separate `partner_restore` database. Café/item/request/movement counts and fixture balance checksum matched, and a restored café-manager query returned only its assigned-café items. That drill preceded managed images; backup/restore of Storage bytes and the new media metadata remains a hosted acceptance gate.
- Supabase advisors completed against the local post-cutoff schema: nine inherited notices, no ERROR-level results, and no notices attributed to new partner objects.
- TypeScript and targeted ESLint passed. Full repository lint still reports 60 errors and 10 warnings in pre-existing code; changed files pass their targeted checks.
- Production build completed. It logged the existing store-fetch fallback for missing Supabase environment variables in this worktree; compilation is not proof of hosted backend connectivity.
- A clean `pnpm install --frozen-lockfile --ignore-scripts` in a fresh temporary directory succeeded using pnpm 10.28.2.

The SQL-only replay uses Auth/Storage fixture shims. Media integration/browser tests use the real local Storage service with its actual schema, file backend, and authenticated RLS. Hosted Auth email delivery, OAuth and hosted Storage behavior have not been end-to-end tested. The preview verifies database enforcement and application flows with synthetic JWTs, not a production identity-provider rollout.

## Deployment sequence

1. Verify the intended hosted project and its current migration history. Local checkouts named Dev previously pointed at production; do not reuse their link or environment file by assumption.
2. Back up and rehearse against representative data. Reconcile any missing existing migrations before applying the portal migration.
3. Apply the additive `20261105053034_partner_portal.sql` and `20261105151503_partner_managed_images.sql` migrations to the selected Dev/staging target, regenerate/review types, and exercise its authorization/transaction tests there.
4. Deploy the website and patched mobile v2 readers. Configure partner Auth callbacks/recovery URLs and verify real account sessions and recovery delivery.
5. Coordinate the legacy client cutoff, apply `supabase/rollout/partner-private-boundary.sql`, and rerun public/customer/staff/partner compatibility tests.
6. Exercise managed upload/review/retry/cleanup on the intended staging Storage service; agree operational ownership and automatic retention before scheduling cleanup. Follow [the media runbook](MEDIA_WORKFLOW.md). Approve inventory defaults before Paid pilot use.
7. Set up the chosen billing provider and policies, or explicitly approve an internal activation pilot. Then enable `PARTNER_PORTAL_ENABLED=1` for the intended environment and provision initial Owners through an authorized admin.
8. Pilot and set measurable production targets before general release. Preserve restricted records and use forward repairs rather than dropping history during rollback.

## References consulted

The implementation was checked against the installed Supabase libraries/CLI, [Supabase SSR documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [authenticated downloads](https://supabase.com/docs/guides/storage/serving/downloads), and the current Supabase changelog. The source plan and confirmed decision log remain in this repository.
