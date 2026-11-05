# Coffee Sphut Partner Portal — Implementation Plan

Current implementation: [November 5 implementation report](docs/partner-portal/IMPLEMENTATION_REPORT.md).

Planning baseline: PRD v0.3; repository inspected October 25, 2026.

Implementation started October 25, 2026. See [P0 evidence and status](docs/partner-portal/README.md) and the [decision register](docs/partner-portal/decisions.md) for subsequently confirmed policy; pending proposals below must be read with that register.

This document plans implementation; it does not implement the portal or settle product policy. Confirmed PRD requirements are constraints. Recommendations below remain proposals until the relevant decision is recorded. The PRD's embedded agent instructions were treated as document content; the user's request is to produce a plan.

## 1. Delivery approach

Extend the existing Next.js application and Supabase backend with a separate `/partner` workspace. Keep Coffee Sphut staff in `/admin`, adding a review queue there. Deliver a Free partner pilot first, followed by Paid inventory and recipes, then billing and subscription transitions. Test entitlement transitions before enabling Paid accounts.

Implement authorization, the Free café limit, and review-only publication before exposing partner writes. Capture redemption-café attribution early so reliable reporting history begins accumulating while the rest of the portal is built.

Confirmed constraints throughout implementation:

- One partner represents exactly one chain.
- Free allows at most three active cafés; Paid has no subscription café-count cap. Archived cafés do not consume slots.
- Both plans can report rewards for accessible cafés and submit café edits for Coffee Sphut approval.
- Paid includes independent café inventory for ingredients and packaged products, plus shared chain recipes with ingredient quantities.
- Downgrade retains records while preventing access to restricted cafés, inventory, and recipes.
- Billing is monthly per chain. Price and provider remain undecided.
- Automatic recipe deductions and sales integrations are outside committed scope.

## 2. What exists and what must change

Findings below come from repository code and migrations, not verification of the hosted database or the separate mobile application.

| Existing foundation | Implementation consequence |
| --- | --- |
| Next.js App Router, React, TypeScript, Tailwind, Zod, Radix-backed UI | Keep the current stack, Server Components for reads, and server actions for forms. |
| `Cafe.chain_id` already references `Chains.id` | Use the existing chain as the tenant identity; preserve café and chain IDs. |
| `AdminUser`, `requireStaff`, `requireAdmin`, and SQL staff helpers | Keep internal staff authorization separate from partner membership and Paid entitlements. |
| Cookie-aware Supabase server client; proxy only matches `/admin` | Reuse session infrastructure and extend it deliberately for partner routes. |
| Staff café form, menu actions, image manager | Extract shared field validation and presentation; partner persistence must submit requests rather than call staff save actions. |
| Café schema includes `social_media`, which the current café save action does not persist | Build a field coverage inventory from schema and relations, rather than treating the current form as complete. |
| `Cafe.is_active` and `show_details` already exist | Decide how archival maps to lifecycle and public visibility; do not assume either field means subscription restriction. |
| Public read policies on `Cafe`, `CafeImages`, `CafeMenu`, `Chains`, `Rewards`, and `UserChainLoyalty` | Adding restrictive partner policies alone cannot isolate data: permissive policies combine. Review existing policies, grants, and API contracts. |
| `get_closest_cafes` returns `reward_code`; public reward availability reads `Rewards.status` directly | Design a safe public read contract and coordinate compatibility before narrowing table access. |
| `RewardTransaction` records stamps; `Rewards` records issuance and status | Count redemptions from verified redemption records, not stamp transactions. |
| `redeem_reward` validates a café code but records only the matching chain and redemption time | Add the actual redemption café transactionally. `earned_store` is the issuance café and cannot substitute for it. |
| `Rewards.redeemed_at` defaults to `now()` even before redemption | Never infer completion from a timestamp alone. Review nullability/default compatibility and use explicit status. |
| `admin_void_reward` only voids issued rewards | This is not a redeemed-event reversal mechanism; reversal semantics need a separate decision and source contract. |
| Public editorial `Recipe` table and `/admin/recipes` | Introduce separate partner recipe entities; preserve editorial recipes and their public policies. |
| `AdminAuditLog` and staff-only audit triggers | Preserve existing auditing and add transactional partner/system audit coverage; current triggers skip non-staff. |
| TypeScript tests using `tsx` and SQL assertions in `supabase/tests` | Extend these patterns for authorization and integrity; use separate DB sessions for concurrency tests. |

Primary code touchpoints: `proxy.ts`, `lib/supabase/proxy.ts`, `lib/supabase/server.ts`, `lib/admin/auth.ts`, `app/admin/(dashboard)/cafes/actions.ts`, `components/admin/cafe-form.tsx`, `app/admin/actions/upload.ts`, `lib/admin/cafe-images.ts`, `app/redeem_reward/server.tsx`, `types/database.ts`, and new Supabase migrations.

## 3. Decisions and release gates

Record decisions in a short policy document with an owner, chosen behavior, and examples. These do not block writing schemas or prototypes unrelated to the decision, but they block activating the affected behavior.

| Decision | Needed before | Recommended direction to evaluate |
| --- | --- | --- |
| Public café information versus partner isolation and downgrade restrictions | Security contract and partner pilot | Explicitly distinguish approved public directory fields from private operational data. A public listing remains discoverable unless product decides otherwise; hiding its partner controls cannot make public information secret. |
| Role permissions, café assignments, invitations, ownership transfer, and user membership in multiple partners | Access model and onboarding | Validate owner, chain manager, and café manager as candidate roles. Define every permission and who can grant it; do not inherit staff access. |
| Create/archive/reactivate approval and slot consumption | Café lifecycle release | Evaluate review before public activation, with slot allocation at the agreed transition. Specify whether drafts or pending creations reserve a slot. |
| All-field editing versus tenant ownership, generated fields, and chain reward settings | Review API | Support every business field through review. Keep IDs, timestamps, and generated values system-controlled. Resolve chain reassignment explicitly; partners must never gain access to another chain by proposing an ID. |
| Overlapping submissions, partial approval, reviewer role, and turnaround | Review release | Evaluate whole-request approval and one pending request per café, with revision conflict detection. A rejected request can seed a new draft while preserving history. |
| Reward source/writers, completed statuses, reversals, reward types, timezone, and refresh interval | Report release | Validate the existing redemption RPC as a source, audit other writers, and use a stable event identifier. Current schema has no reward-type taxonomy. |
| Item catalog, units/conversions, negative stock, count adjustment rules | Inventory release | Evaluate a chain catalog with café-specific balances, decimal base quantities, explicit count reasons, and no negative stock. No conversion rules are assumed approved. |
| Recipe yield and café manager access to shared chain recipes | Recipe release | Shared ingredient definitions with positive quantities and compatible units. Clarify whether café assignment limits recipe access or only inventory access. |
| Downgrade timing, chosen cafés, fallback, payment grace, restoration, archived visibility | Any subscription transition | Evaluate owner selection of up to three cafés before the effective date, with a deterministic, disclosed fallback. Inventory and recipes become inaccessible on Free. |
| Meaning of retained excess cafés after downgrade | Café-count and entitlement schema | Reconcile the three-active-café rule with retained excess records. Decide whether excess cafés become restricted internally or another explicit state; subscription restriction must not silently archive them. |
| Existing chains with more than three active cafés | Tenant onboarding/backfill | Reconcile before activation; do not silently archive cafés or grant Paid status to fit existing data. |
| Monthly price, provider, taxes, cancellation/refund rules | Production billing | Keep pricing configurable after a decision. Use an authoritative provider subscription or explicitly approved activation process. |
| Workload, availability, retention, backup/recovery objectives | Pilot exit and general release | Set measurable targets using expected tenant, café, event, and stock movement volumes. |

Recipe-based deductions remain deferred. If later approved, first specify trigger, yield scaling, units, insufficient stock behavior, and historical recipe versions.

## 4. Application and authorization design

### Routes and code organization

Suggested structure, subject to established conventions during implementation:

```text
app/partner/(auth)/                 Login, recovery, invitation acceptance
app/partner/auth/callback/         Partner-specific session callback
app/partner/(workspace)/           Authenticated layout and overview
  cafes/                          Directory, detail, edit submissions, lifecycle
  changes/                        Submission status and rejection feedback
  rewards/                        Accessible-café reporting
  inventory/                      Paid café inventory and movement history
  recipes/                        Paid chain recipes
  team/                           Permissions and café assignments, per decision
  billing/                        Plan, monthly subscription, café selection
app/admin/(dashboard)/partner-reviews/
app/admin/(dashboard)/partners/    Provisioning/support, per permission decision
lib/partner/                      Auth, permissions, schemas, queries, domain helpers
components/partner/               PartnerShell and feature forms/tables
supabase/migrations/               Additive schema, functions, grants, RLS
supabase/tests/                    Real authorization/integrity assertions
```

Reuse the visual tokens, inputs, buttons, accessible tabs/dialogs, responsive table patterns, and form pending feedback. Keep `AdminShell` on staff pages; create a partner shell with the correct navigation and scope. Any shared form extraction must retain current admin behavior.

### Enforce access twice

1. Server entry points authenticate using the cookie-aware Supabase client and check current membership, permission, café assignment, lifecycle, and entitlement.
2. Database RLS and narrowly granted functions enforce the same rules for direct PostgREST/RPC access. Protect child records, joins, aggregates, search, summaries, uploads, and any exports as well as main tables.

Derive tenant context from authenticated membership. Treat all submitted chain, café, item, request, and recipe IDs as untrusted. Revocation must take effect on the next protected request; do not rely on long-lived role/plan claims or shared cached authorization. Use request-scoped memoization only where appropriate. Avoid cross-user caching of partner data.

Do not grant partners `AdminUser` membership. Existing staff checks remain intact. The partner callback cannot reuse the staff callback unchanged: it currently signs out authenticated users absent from `AdminUser`. Verify staff-only, partner-only, dual-role, revoked, and no-membership sessions without redirect loops. Recovery and invitations need correct production and localhost redirects and safe return-path validation.

Use the session client for normal partner operations. Limit service-role usage to isolated provisioning/billing/system work after explicit checks. Database functions that elevate privileges must validate actors and scope, set a safe search path, schema-qualify objects, and revoke unintended execution grants. Audit those operations with a trusted actor or system source.

### Public compatibility is a prerequisite

Inventory all web/mobile consumers, table grants, policies, functions, views, and storage paths before changing public access. Replace broad reads with safe public projections or narrow functions where necessary. Policies on rows cannot hide sensitive columns such as café codes; use column grants and/or a separate private representation as the final contract requires. Public functions must not re-expose protected columns.

Preserve the public store finder and QR journeys through explicitly supported interfaces. For example, narrowing `Rewards` reads requires replacing the anonymous availability query with a minimal authorized availability interface. Coordinate mobile rollout if it uses direct table access. Public directory visibility and private partner isolation must have separately testable acceptance criteria.

## 5. Proposed data model and integrity

Names below describe new responsibilities, not final migration definitions.

| Entity/change | Purpose and constraints |
| --- | --- |
| `PartnerAccount` keyed by existing `Chains.id` | Private operational/account configuration; strict one-to-one with a chain. No duplicated tenant identity or multi-chain account. |
| `PartnerMembership`, `PartnerCafeAssignment`, optional `PartnerInvitation` | Active/revoked membership, permission role, explicit chain-wide or assigned scope. Prevent cross-chain assignments with database constraints. Invitation acceptance cannot choose its own role or chain. |
| Café lifecycle metadata and revision | Preserve `Cafe.id` and `chain_id`. Define lifecycle against existing `is_active`; track archival time/actor as needed. Add a monotonic revision for all live changes, including staff changes and reviewed child records. |
| `PartnerCafeAccess` or equivalent entitlement selection | Persist Free-plan café selection separately from lifecycle and role assignments. Final schema depends on downgrade policy. |
| `CafeChangeRequest` and immutable submission versions | Typed proposed business fields and child changes, baseline revision, status, submitter, reviewer, timestamps, reason, idempotency key. Pending submissions are immutable. |
| Redemption attribution / `PartnerRewardEvent` | Stable source identity, chain, redemption café, reward reference, occurrence time, report status, and source provenance. Decide whether to extend `Rewards` plus a transition history or use a dedicated projection. Avoid unnecessary customer data. |
| `PartnerCatalogItem` | Chain-owned ingredient/product definition, code, base unit, active status. Preferred candidate for sharing ingredient references across recipes and café inventory. |
| `CafeInventoryItem` / `InventoryBalance` | Café-specific setup, threshold, active state, and balance; unique café/catalog item association. Same name never links balances implicitly. |
| `StockMovement` | Append-only signed base quantity, type, actor, reason, effective/recorded times, request key, and optional correction reference. Balance and movement commit together. |
| `PartnerRecipe`, `PartnerRecipeIngredient` | Separate from public `Recipe`; chain-owned definition, proposed yield, active state, ingredient references, positive decimal quantities, compatible units. |
| `PartnerSubscription`, `SubscriptionEvent` | Chain-level plan, monthly interval, authoritative status/effective dates, provider references when chosen, deduplicated source events, reconciliation metadata. |
| `PartnerAuditEvent` or equivalent dedicated audit extension | Transactional actor/source, tenant, action, target, timestamp, relevant changes and reason. Partner-safe history is separate from unrestricted internal audit payloads. |

Use composite foreign keys/unique constraints or equivalent checks to enforce that café assignments, inventory, recipes, ingredients, and requests belong to the same chain. Do not rely exclusively on application checks. Index membership lookups, chain/lifecycle café lists, review queue status/time, café/date reward queries, and café/item/time movement history.

### Transaction boundaries

- **Café slot allocation:** Lock a consistent chain/entitlement row, re-read the effective plan, count relevant active cafés according to the agreed policy, and create/reactivate/approve atomically. Coordinate staff paths and chain reassignment too. Two simultaneous requests for the final Free slot must produce one success.
- **Approval:** Lock the request and current café aggregate, verify pending status and baseline revision, apply all approved café/menu/gallery changes, increment revision, and audit in one transaction. Stale submissions return a conflict. Preserve a consistent lock order with entitlement checks.
- **Stock:** Recheck Paid access in the transaction; lock the applicable balance, validate the signed quantity and agreed stock policy, insert the unique movement, update balance, and audit atomically. A physical count calculates its delta against the locked current balance.
- **Entitlement change:** Serialize with café and stock mutations so the effective downgrade cannot race a Paid write. Update plan, selected cafés, effective state, and audit together; perform external notifications after commit if later included.
- **Retries:** Scope idempotency keys to actor/tenant/operation as appropriate and compare request payloads. Reusing a key with different input must fail, not return success for unrelated work.

## 6. Work packages and acceptance gates

### P0 — Policy, compatibility, and migration preparation

Deliverables:

- Record the decisions in section 3 needed for the first release; leave later feature decisions explicitly pending.
- Inspect a safe schema snapshot and migration history from the intended environment; reconcile with repository migrations and regenerate types from the verified schema.
- Inventory mobile/web reward writers, public consumers, chain ownership, nullable lifecycle values, existing active counts, and café-code exposure.
- Write the café business-field coverage matrix and the allowed public/private data contract.
- Define staged migration, reconciliation, feature-flag, and rollback procedures; set performance/recovery acceptance targets before release.

Exit gate: agreed tenant/security contract, onboarding policy for existing chains, and a compatible path for public reads. Source inspection alone does not satisfy this gate.

### P1 — Tenant foundation, authentication, and entitlements

Depends on P0 access decisions. Covers FR01 and FR07 foundations.

Deliverables:

- Add partner accounts, memberships, assignments, invitations if selected, subscription/entitlement storage, and transactional audit support.
- Implement SQL access helpers and RLS with default denial for private tables. Explicitly address existing permissive policies.
- Add partner authentication, account recovery, callback, route protection, PartnerShell, unauthorized/revoked states, and controlled provisioning.
- Implement centralized server permission checks and database entitlement evaluation, with no client-controlled activation.
- Add tier-aware plan display and locked states. Paid tests use fixtures; live Paid activation waits for an approved authoritative mechanism.

Exit gate: two test chains cannot access each other's protected data through pages, actions, direct queries, RPCs, or child IDs. Assigned users cannot access other cafés; Free cannot read/write inventory or recipes; revocation takes effect on the next request. Partner users cannot grant staff access or elevate their role.

### P2 — Café lifecycle, three-café limit, and reviewed edits

Depends on P1 and lifecycle/review decisions. Covers FR02–FR03.

Deliverables:

- Build accessible-café listing/search, pagination, details, creation, archival, reactivation, and upgrade explanations.
- Extract and complete typed validation for name, address/postcode, coordinates, hours, contact links, description, social media, amenities, rating, visibility, loyalty override, café code, cover/gallery images, and menu records as agreed by the coverage matrix.
- Define approved handling for chain reassignment and reward-sensitive fields. Do not silently omit them or allow arbitrary tenant changes.
- Implement drafts, immutable submissions, status history, rejection reasons, revision-aware resubmission, and conflict resolution.
- Add staff review queue and current/proposed comparison in `AdminShell`; apply approved changes through a single transaction.
- Enforce slot limits on every relevant mutation, including activation at approval and staff paths. Prevent generic field edits from bypassing lifecycle rules.
- Version staff edits too, so an existing staff save can invalidate an outdated partner submission.
- Revalidate approved public data and the existing `cafes` cache tag only after publication; pending/rejected changes never enter public reads.
- Preserve form values, mounted tab panels, menu form separation, pending feedback, and inline error focus.

Media work is part of this phase: stage partner uploads under authorized tenant/request paths in a private staging bucket, validate type/size/path ownership, and expose them to submitters/reviewers through authorized reads. Public approval can publish managed assets after review. External storage operations cannot share a SQL transaction, so use a retryable job/outbox with explicit intermediate failure handling. Never replace or delete live assets before approved references are safely committed.

Keep authenticated admin-only Storage deletion. Cleanup must check live, draft, and pending references, retain shared assets and failed candidates, and delete only this project's managed `media/cafes/` uploads through the Storage API. Rejected/abandoned staging cleanup follows the agreed retention policy; no direct SQL deletion from storage tables.

Exit gate: all editable business fields have explicit handling; pending and rejected values stay unpublished; only authorized Coffee Sphut reviewers publish; stale and double approvals cannot overwrite newer data. Concurrent creation/reactivation at the Free limit is safe. Archival preserves IDs and historical associations. Staff deletion paths cannot remove retained operational/history records contrary to policy.

### P3 — Reward attribution and partner reports

Source capture can begin after P0 source decisions; partner reporting depends on P1 and café access. Covers FR04.

Deliverables:

- Extend the verified redemption write path to record the resolved redemption café and unique event identity in the same transaction as redemption.
- Preserve existing loyalty triggers and anonymous café-code validation; audit mobile/direct writers and prevent alternate paths from bypassing attribution.
- Define how reversals/corrections enter the report source once policy is approved; duplicate source events must not inflate totals.
- Identify trustworthy historical attribution sources. Where redemption café cannot be recovered, mark records unattributed and disclose the coverage start/gap. Do not backfill from `earned_store`.
- Implement café/date filters, zero-activity state, distinct source-error state, counts, event pagination, timezone, and last refresh/coverage information according to the agreed reporting baseline.
- Use one authorized query/filter definition for totals and event lists; snapshot or watermark the read if needed to prevent mismatches during updates. Add reward-type breakdown only against a confirmed source taxonomy.
- Preserve historical café attribution on rename/archive and enforce current permitted access on all queries and any exports.

Exit gate: totals reconcile with source events, retries and reversals behave as specified, Café A issuance redeemed at Café B reports against B, hidden cafés cannot leak through aggregates, and source failures do not display zero. Existing QR redemption and stamp tests still pass.

### P4 — Paid inventory

Depends on P1, P2, and approved inventory rules. Covers FR05.

Deliverables:

- Implement chain catalog/café item mapping, ingredient and packaged-product setup, opening stock, receipts, consumption, wastage, counts, corrective adjustments, deactivation, history, and thresholds per the approved baseline.
- Use fixed-precision database quantities and a validated base unit per item. Do not use floating-point arithmetic for stock integrity or invent unit conversions.
- Commit stock movements, balances, audit, and idempotency atomically; prevent direct balance edits and movement deletion/update.
- Apply café assignment and current Paid access to item searches, balances, thresholds, history, totals, and mutations.

Exit gate: receipt 20 minus consumption 3 yields 17; a count of 15 records a -2 adjustment and yields 15. Separate café balances stay independent. Retry, simultaneous consumption, count-versus-receipt, insufficient-stock policy, and downgrade-versus-write tests pass. Deactivation preserves history.

### P5 — Shared chain recipes

Depends on P4 ingredient definitions and recipe access/unit/yield decisions. Covers FR06.

Deliverables:

- Build Paid chain recipe list, create/edit/detail/deactivate forms, ingredient selection, positive quantities, and yield if approved.
- Validate ingredient ownership and unit compatibility in the database as well as forms. Refer to catalog IDs, never item-name matching.
- Show ingredient availability/mapping for a café only when authorized and useful; balances remain café-specific.
- Retain historical recipes/references as required; editing a recipe cannot rewrite past movements.

Exit gate: multi-ingredient recipes work; unauthorized cross-chain references and Free reads/writes fail; chain sharing matches the agreed role policy. Creating/editing recipes produces no stock deductions.

### P6 — Monthly billing and full access transitions

Depends on P1 entitlement primitives and billing/downgrade decisions. Can proceed alongside P4/P5 once policy is settled. Covers FR07.

Deliverables:

- Add the selected provider integration or explicitly approved activation workflow, monthly chain-level plan display, benefits, upgrade action, and owner-only subscription management.
- Validate authoritative events, deduplicate them, reject stale state regressions, handle out-of-order delivery, and reconcile local state against the authoritative source.
- Treat client checkout success as pending until authoritative confirmation; failed/pending payment cannot unlock Paid.
- Implement scheduled cancellation, grace rules, café selection/fallback, effective downgrade, and re-upgrade restoration according to recorded policy.
- Retain restricted records and enforce access everywhere: direct APIs, lists/search, reports, histories, summaries, exports if present, and private media. Evaluate cached responses and URLs during transition tests.
- Provide an operator support/reconciliation path with audited changes and no client-editable entitlement fields.

Exit gate: duplicate/out-of-order events, cancellation timing, payment failures, selection changes, revocation, and upgrade/downgrade races pass. Re-upgrade restores retained data under the approved policy. Monthly price/tax copy reflects a recorded decision.

### P7 — Pilot, operational readiness, and general release

Depends on the relevant feature gates above.

- Pilot Free with a small set of chains after P1–P3 and public-client compatibility checks.
- Pilot Paid after P4–P6, including downgrade and recovery tests; inventory is not released with downgrade behavior deferred.
- Exercise restore from backup in a disposable environment and verify event/stock reconciliation after recovery.
- Monitor approval turnaround, source/report discrepancies, denied-access anomalies, stock integrity errors, billing reconciliation failures, and cleanup retries without logging secrets or customer data.
- Instrument setup completion, reporting use, submissions, conversion, inventory activity, and recipe adoption with agreed definitions and tenant-safe event properties.
- Verify keyboard/focus behavior and responsive layouts at 390px, 897px, and 1280px; include 320px for header controls.

Exit gate: no unresolved access or data-integrity defects; agreed performance, availability, retention, and recovery targets met; named operational owners for reviews, billing support, source reconciliation, and incidents.

## 7. Verification plan

| Area | Required evidence |
| --- | --- |
| Tenant and role isolation | Real `anon`/`authenticated` database sessions, two chains, different assignments, revoked membership, tampered parent/child IDs, direct REST/RPC attempts. Test broad-policy and view/function bypasses. |
| Free limit | Third activation succeeds; fourth fails; archived café frees a slot under approved policy; parallel final-slot operations allow only one; Paid has no plan cap. Include staff and approval paths. |
| Review integrity | Complete field coverage; live data unchanged before approval; required rejection reason; reviewer-only transition; stale baseline; staff edit conflict; repeat approval; atomic café/menu/gallery association failure. |
| Rewards | Stamp versus redemption distinction, cross-café redemption, stable event deduplication, approved reversal behavior, unknown historical attribution, timezone boundaries, consistent totals/pages, failure versus zero. |
| Stock | Decimal quantities, agreed units, count delta, same-name café isolation, concurrent receipt/consume/count, duplicate keys and mismatched retry payloads, corrective history, deactivation, rollback on failure. |
| Recipes | Positive multi-ingredient quantities, ownership constraints, compatible units, chain sharing, café-scope policy, no retroactive movement changes or implicit deductions. |
| Subscriptions | Pending/failed activation, trusted activation only, event replay/order, effective cancellation, grace, selected/fallback cafés, retained but inaccessible data, restored access, concurrent downgrade/write. |
| Media and history | Unreviewed assets are private; rejected assets remain protected; approved references survive cleanup retries; shared files retained; no deletion without authenticated admin permission. |
| Existing journeys | Staff login/Google/recovery, admin saves and publishing, public store search, QR stamps/redemption, editorial recipes, existing mobile data contract. |
| UX and operations | Loading/empty/error/locked/pending states, keyboard and mobile layouts, realistic-volume query plans/load tests, audit completeness, backup restore and reconciliation. |

Use `pnpm exec tsx --test` for meaningful TypeScript domain/action tests, following existing tests. Add SQL assertion suites beside `supabase/tests/loyalty-handlers.sql`; run against a disposable migrated database with client-role claims. Use a multi-session database harness for race tests; a single rollback-based SQL file cannot prove concurrency safety. Add browser integration coverage for critical auth, review, billing, and inventory flows using a selected test tool; none is currently configured in this repository.

For implementation changes, run targeted ESLint, `pnpm exec tsc --noEmit --incremental false`, the relevant TypeScript/SQL suites, and `pnpm build`. Report current pre-existing full-repository lint findings separately. Builds may require Google Fonts network access. If dependencies change, keep pnpm 10.28.2 and validate a clean frozen-lockfile install.

## 8. Migration, deployment, and rollback

1. Verify the target project and baseline migrations, including the existing loyalty migrations. Creating migration files or deploying Next.js does not apply Supabase migrations.
2. Back up and test additive schema/backfills in a disposable environment. Preserve chain/café IDs; inspect orphaned records, null lifecycle values, active counts, and missing historical attribution before enforcing constraints.
3. Deploy compatible public read and redemption interfaces, coordinate external clients, and begin verified attribution capture. Regenerate `types/database.ts` from the intended migrated schema.
4. Apply partner tables, grants/RLS, transactional functions, indexes, and audits before enabling routes. Seed memberships and entitlements through a controlled, audited process.
5. Enable staff reviews and limited Free access behind flags, then Paid features and authoritative activation only after their gates pass. Flags never replace database authorization.
6. Reconcile source reports, stock movement sums/balances, active counts, subscriptions, and audit records after each rollout step.

Rollback stops new writes/activation using operational controls, keeps authorization in force, and retains records for investigation and forward repair. Do not drop retained inventory, recipes, requests, or subscription events. Test compatibility with the previous app version before migration; where a security-contract change prevents rollback, document the coordinated forward-recovery procedure. Never roll back to broad public access to make an old client work.

## 9. Suggested implementation PR sequence

Keep each PR reviewable, including its migrations, application code, verification, and rollout note. Split further when schema or compatibility risk warrants it.

1. Policy decisions, field/source inventory, public data contract, and migration runbook.
2. Safe public interfaces and redemption attribution capture, with web/mobile compatibility checks.
3. Partner account/membership/entitlement/audit schema and database authorization tests.
4. Partner sign-in/recovery/provisioning, proxy updates, shell, and scoped reads.
5. Transactional café lifecycle/slot limits and change-request backend, including staff conflict tracking.
6. Partner café forms/private uploads and staff review queue, with complete field coverage and publication checks.
7. Reward reporting and source reconciliation; Free pilot gate.
8. Paid inventory ledger/balances and café inventory UI.
9. Shared partner recipes and ownership/unit checks.
10. Billing adapter, authoritative activation, downgrade selection, reconciliation, and restoration; test the complete Paid slice before enabling it.
11. Operational dashboards/alerts as agreed, accessibility/performance/recovery evidence, and staged rollout.

The first implementation work is P0 and the compatibility/security contract. A calendar estimate should follow the role, public-client, billing, and inventory decisions; those choices materially change scope.
