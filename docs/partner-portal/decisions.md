# Partner portal decisions and permissions

Decision owner: product owner (the user). Recorded October 25, 2026. Confirmed entries below came from explicit answers in this implementation conversation; pending entries are not implementation defaults.

## Confirmed decisions

### D01 — Public versus private data

Approved café listings remain public after downgrade. Café codes, partner reports, inventory, operational recipes, and review drafts remain private. A subscription restriction does not by itself remove an approved listing from public discovery.

Public discovery across chains is therefore intentional. Cross-partner isolation applies to private operational data and mutation rights, rather than making already-public directory information secret.

### D02 — Partner role model

Use Owner, Chain Manager, and Café Manager. All roles remain subject to active membership, current café eligibility, and subscription entitlements. A role alone never grants Paid access.

| Capability | Owner | Chain Manager | Café Manager |
| --- | --- | --- | --- |
| Café operations and review submissions | All accessible chain cafés | All accessible chain cafés | Assigned, accessible cafés |
| Reward reports | All accessible chain cafés | All accessible chain cafés | Assigned, accessible cafés |
| Café inventory, Paid only | All accessible chain cafés | All accessible chain cafés | Assigned, accessible cafés |
| Shared chain recipes, Paid only | Read/write | Read/write | Read-only |
| Subscription, upgrade, downgrade café selection | Yes | No | No |
| Partner team management | Yes | No | No |
| Approve/reject a café request as a partner | No | No | No |
| Obtain internal staff privileges through partner roles | No | No | No |

Initial provisioning and membership cardinality are confirmed in D07. Chain catalog editing versus café inventory operations still needs a specific permission decision before inventory setup is exposed.

### D03 — Review and publication

- Creation, business-field edits, archival, and reactivation all require Coffee Sphut approval.
- At most one pending request per café. Draft behavior must not mutate live values.
- Whole-request approval or rejection; partial publication is outside this baseline.
- Internal Coffee Sphut editors and admins may review. Partner roles cannot approve.
- A rejected request retains its reason/history; a revised submission must use the current approved baseline.
- Optimistic revision checking and transactional approval prevent stale overwrites.

A dual-role partner/staff user cannot approve their own submission. Another authorized Coffee Sphut editor or admin must review it (confirmed in D16a).

### D04 — Free café slots

Consume a slot only when café activation is approved. Drafts and pending requests do not reserve a slot. Approval must recheck entitlement and availability inside the transaction; a request can reach review while there is room and still fail activation if another approval consumes the last slot.

Archival does not release a slot until approved. Reactivation consumes a slot when approved. Generic `is_active` edits must follow these transitions rather than bypass them.

### D05 — Downgrade and retained records

Restriction is separate from archival. Owners select up to three accessible cafés for Free; excess café records may remain publicly listed while private partner access is restricted. Inventory and recipes remain stored and inaccessible on Free. Existing chains above three require explicit café selection or authoritative Paid activation before onboarding.

Track the total internal/live café count separately from the Free-accessible active count. A restricted retained record is not implicitly archived. This records the user's clarification of the PRD's unresolved excess-active-café interpretation; the public/private boundary in D01 still applies.

The effective date, fallback selection, payment grace, and restoration details remain pending. Do not choose arbitrary cafés automatically or interpret a client checkout screen as Paid activation.

### D06 — P0 environment

Inspect the separately identified Dev project read-only. Project metadata identifies `mnlgxujbjbuuslaccjtx` as Dev and `tcxenxliwzykhxzhlien` as production. The existing local checkout named `dev` has an environment URL and CLI link pointing to production, so P0 uses an explicit Dev project reference and does not reuse that link.

P0 did not apply migrations, change hosted Auth settings, invite users, seed data, or alter public policies. See [environment evidence](dev-readiness.md).

### D07 — Controlled provisioning and invitations

Coffee Sphut staff provision the first Owner. Owners invite and revoke managers. Each partner user has one active chain membership for the first release; a separate internal staff role is allowed and does not widen partner permissions. Invitation acceptance must use the preassigned chain, role, and café scope rather than accept these from the recipient.

Changing or transferring Owner status between people still requires a defined staff/owner-transfer process; the manager invitation flow does not implicitly grant that ability.

### D08 — Ownership and system fields

Use staff-managed café chain-transfer requests. Ordinary partner edits cannot reassign `chain_id` to another tenant. IDs, timestamps, PostGIS/search generated values remain system-controlled; every editable café business field stays covered by review. Transfers must consider historic attribution, pending requests, target-chain slots, assignments, and inventory rather than simply update the foreign key.

### D09 — Reward reporting baseline

Count each unique completed redeemed reward once and attribute it to the café where redemption actually occurs. Begin verified café-level coverage when that capture is deployed; disclose older unattributed records instead of guessing from the earning café. Configure the reporting timezone per chain using a validated IANA timezone; store event instants consistently and convert date-filter bounds server-side.

Do not add a new reversal workflow or invented reward-type taxonomy. Existing issued/voided/failed records are not completed redemptions. If an authoritative source later supplies a reversal, it must remove the event from completed totals under an explicit reconciliation contract. Confirm other writers/deployed clients before claiming source coverage is complete.

### D10 — Archival and history

Use `is_active = false` for archived cafés. After archival approval, remove the café from public discovery and preserve its details and report history for otherwise authorized partner users. Archived cafés do not consume an active slot. Subscription restrictions continue to block access even to archived records; archival cannot bypass a lock or restore inventory access on Free.

Legacy `is_active = null` values must be flagged for review before migration; do not silently treat them as active or archived. The presentation of a previously saved public café link (unavailable message versus another inactive view) can be decided with the public client rollout, without exposing archived private history.

### D16a — Independent staff review

Someone who is both a partner user and internal Coffee Sphut staff must use another authorized staff reviewer for their own submission. Internal admin status does not bypass this rule. Enforce reviewer identity against the immutable submission's submitter in the same transaction as approval, as well as at the server entry point.

## Remaining decisions

| ID | Decision and proposed direction | Blocks |
| --- | --- | --- |
| D11 | Define downgrade/cancellation effective date, fallback if an Owner has not selected cafés, grace after payment failure, and re-upgrade restoration. | Any live Paid subscription transition |
| D12 | Monthly price, payment provider, tax, cancellation/refund handling, or an explicitly approved manual activation process. | Production Paid activation and billing UI |
| D13 | Catalog structure, café-manager catalog permissions, valid units/conversions, negative stock, physical counts, recipe yield, and retention of historical recipes. | Inventory/recipe writes; recipe deductions remain excluded |
| D14 | Expected partners/cafés/report events/stock movements, peak concurrency, latency/error-rate targets, availability, retention, backup RPO and restore RTO. No numbers selected yet. | Performance/recovery acceptance and general release |
| D15 | Confirm deployed mobile versions, other reward writers/Edge Functions/integrations, and the owner of coordinated mobile/API rollout. | Removing legacy public access and claiming complete attribution |
| D16b | Ownership transfer between people, last-Owner protection, and invitation expiry/revocation behavior. Self-review is already prohibited by D16a. | Team edge cases; does not block independent reviewer checks |

Inventory/billing/recovery questions are deferred to their implementation gates; they are not reasons to stop repository inspection or safe additive preparation.
