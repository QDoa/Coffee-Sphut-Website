> Reference only, superseded by the v1 rebuild. Do not merge.

# Coffee Sphut Partner Portal PRD

Version: 0.3
Status: Initial implementation brief
Audience: Product, design, engineering, and Codex

## 1. Purpose

Build a portal where Coffee Sphut partners manage cafe information, view reward usage by cafe, and access inventory tools according to their subscription. This document consolidates the product decisions made so far. Confirmed requirements are authoritative; proposals and open decisions are explicitly labeled.

## 2. Confirmed product rules

- A partner is a chain. Each partner account represents exactly one chain.
- Free partners may have at most **3 active cafes**.
- Paid partners may have unlimited active cafes.
- Archived cafes do not count toward the active cafe limit.
- Both tiers can view reward usage per accessible cafe.
- Partners can edit all cafe fields, but changes require Coffee Sphut approval.
- Paid subscriptions are billed monthly per partner/chain. Price is not yet decided.
- Paid includes inventory management for each cafe, covering ingredients and packaged products.
- Each chain has a shared recipe list. Recipes specify ingredients and the quantity of each ingredient used.
- After downgrade, excess cafe records and inventory remain stored, but partner users cannot access restricted data.

## 3. Tier matrix

| Capability | Free | Paid |
| --- | --- | --- |
| Active cafes | Up to 3 | Unlimited |
| Reward usage per accessible cafe | Included | Included |
| Submit cafe edits | Included | Included |
| Coffee Sphut approval of edits | Required | Required |
| Cafe inventory | No access | Included |
| Ingredients and packaged products | No access | Included |
| Chain recipe list | No access | Included |
| Billing | Free | Monthly, price TBD |

Working interpretation for downgrade: up to three cafes remain accessible; excess cafes become inaccessible; all inventory and recipes become inaccessible on Free. Confirm the cafe selection mechanism before implementing downgrade.

## 4. Goals

1. Enable partners to keep cafe information accurate through an approval workflow.
2. Make reward usage visible and attributable to individual cafes.
3. Support growth through Paid subscriptions.
4. Maintain independent cafe stock records with reusable chain recipes.
5. Preserve historical records when cafes are archived or subscriptions change.

## 5. Proposed users and permissions

| Role | Proposed permissions |
| --- | --- |
| Partner owner | Manage subscription, staff, chain, and authorized cafes |
| Chain manager | Manage authorized cafes, reports, inventory, and recipes |
| Cafe manager | Manage assigned cafes and their permitted operational data |
| Coffee Sphut reviewer | Review, approve, or reject cafe changes |

Role names and detailed permissions are proposals. Server authorization must combine role, partner ownership, cafe assignment, and subscription eligibility. Internal Coffee Sphut permissions must remain separate from partner entitlements.

## 6. Functional requirements and acceptance criteria

### FR01 Access control

Provide secure sign-in, account recovery, and a controlled method of granting and revoking access. Enforce isolation between partners and assigned cafes on every request.

Acceptance criteria:
- A user from Partner A cannot read or modify Partner B's data by changing an identifier.
- A cafe-restricted user cannot access an unassigned cafe.
- Free users cannot retrieve or mutate inventory or recipe data through direct API requests.
- Revoked permissions are enforced on subsequent protected requests.

### FR02 Cafe directory and lifecycle

Provide cafe listing, search, creation, editing, archival, and reactivation. Preserve stable cafe identifiers and historical associations.

Acceptance criteria:
- A Free partner with two active cafes can add a third.
- Adding or reactivating a fourth active cafe is blocked on Free with an upgrade explanation.
- Concurrent requests cannot exceed the three-cafe limit.
- Archived cafes stop counting toward the limit and retain their records.
- Paid has no subscription-based cafe-count cap; lists may use pagination.

Open decision: whether creation, archival, and reactivation also require Coffee Sphut approval. If creation requires approval, define when the cafe begins consuming a slot.

### FR03 Cafe editing and approval

Allow edits to all cafe fields through a review submission. Partners cannot bypass Coffee Sphut approval. Field coverage must follow the actual cafe schema; do not arbitrarily limit editing to a small subset of fields.

Proposed workflow: Draft → Pending approval → Approved or Rejected. Approved information remains live until a submission is approved. Reviewers compare existing and proposed values; rejections include a reason; partners may revise and resubmit. Record submitter, reviewer, timestamps, and changes.

Acceptance criteria:
- Every cafe field can be included in an authorized change request.
- Pending changes do not overwrite approved information.
- Approval publishes the reviewed changes; rejection preserves current information.
- Partners can see review status and rejection reasons.
- Only Coffee Sphut reviewers can approve or reject changes.
- Conflicting or outdated submissions cannot silently overwrite newer approved values.

### FR04 Reward reporting

Both tiers provide reward usage reporting per accessible cafe.

Proposed baseline: cafe and date filters, completed redemption counts, breakdown by reward type, paginated event records, reporting timezone, and last refresh time. Proposed record fields: reference, cafe, reward, timestamp, and status. Avoid unnecessary customer personal data.

Proposed metric: count each unique completed redemption event once. Exclude failed, cancelled, and reversed events from completed totals. Attribute events to the redemption cafe.

Acceptance criteria:
- Totals and event records use identical filters and status definitions.
- Duplicate ingestion does not inflate totals; reversals update totals.
- Renaming or archiving a cafe does not erase historical attribution.
- No activity displays zero; a source failure displays an error rather than zero.
- Subscription-restricted cafe data cannot be retrieved through reports or exports.

### FR05 Inventory per cafe

Paid inventory covers ingredients and packaged products. Each cafe maintains independent balances even where item names match.

Proposed baseline: item setup, opening balances, receipts, consumption, wastage, physical count adjustments, movement history, and low-stock indicators. Item fields: name, type, item code, base unit, active status, and optional threshold. Movements include cafe, item, quantity, unit, type, time, actor, and reason where relevant.

Proposed safeguards: one base unit per item, no negative stock, append-only movements with corrective adjustments, and atomic balance updates. These policies require validation.

Acceptance criteria:
- Receiving 20 units then consuming 3 yields 17.
- Counting 15 units then records a minus-2 adjustment and yields 15.
- Cafe A movements never change Cafe B balances.
- Retrying a submission does not duplicate stock movements.
- Concurrent movements result in the correct balance.
- Deactivating an item preserves history.

### FR06 Chain recipes

Each Paid chain has a shared list of recipes. Each recipe specifies ingredients and the quantity of each ingredient used. Recipes are shared across the chain; inventory balances remain cafe-specific.

Proposed fields: recipe name, output quantity or serving yield, active status, ingredient references, quantities, and units. Proposed actions: create, view, edit, and deactivate. Map recipe ingredients to the applicable cafe inventory item before supporting deductions.

Example: one serving of latte uses 18 g of coffee beans and 200 ml of milk. These quantities are illustrative, not prescribed recipes.

Acceptance criteria:
- A recipe supports multiple ingredients with quantities and units.
- Ingredient quantities must be positive and units must be valid.
- Authorized users across the chain can access shared recipes on Paid.
- Editing a recipe does not recalculate past stock movements.
- Recipe and ingredient records cannot cross partner boundaries.
- Free users cannot access recipes.

Open decision: what triggers recipe-based stock deductions—sales, production entries, or a manual action. The recipe list is required; automatic deduction is not yet approved. If deductions are added, define yield scaling, unit conversions, insufficient-stock behavior, and historical recipe version handling first.

### FR07 Monthly subscription and access transitions

Display plan, active cafe count, benefits, and upgrade actions. Do not invent a price. Paid activation must use an authoritative subscription or approved activation record, not a client success screen alone.

On downgrade, retain excess cafes and inventory without allowing partner access to restricted data. Apply restrictions to screens, APIs, searches, reports, exports, and summaries that could reveal locked data.

Proposed behavior: owners select up to three accessible cafes before downgrade; upgrading restores access to preserved records. Inventory becomes inaccessible on Free, including read-only views.

Acceptance criteria:
- Confirmed Paid activation unlocks inventory, recipes, and unlimited cafes.
- Pending or failed activation does not unlock Paid features.
- Downgrade preserves records while blocking unauthorized reads and writes.
- Repeated subscription events do not cause inconsistent entitlements.
- Re-upgrading restores preserved data under the proposed restoration policy.

Open decisions: cancellation effective date, payment-failure grace period, selection fallback, and whether locked excess cafes remain active internally or gain a distinct restricted status. Define this without conflating subscription restriction with archival.

## 7. Proposed data model

- Partner/Chain: one entity or strict one-to-one representation; never multiple chains per partner.
- User and RoleAssignment: partner membership, permissions, and cafe scope.
- Cafe: partner reference, approved fields, lifecycle status, access status.
- CafeChangeRequest: proposed values, baseline revision, status, reviewer, and timestamps.
- RewardEvent: stable source identifier, cafe, reward, timestamp, status.
- InventoryItem: cafe association or chain catalog mapping, ingredient/product type, unit, status.
- StockMovement: cafe, item, signed quantity, type, actor, reason, event reference.
- Recipe and RecipeIngredient: chain ownership, yield, ingredient, quantity, and unit.
- Subscription: partner, plan, monthly interval, status, effective dates.
- AuditEvent: actor, action, target, time, and relevant change details.

These entities describe responsibilities, not a required database schema. Catalog structure, authentication provider, billing provider, and technology stack are undecided.

## 8. Quality requirements

- Enforce tenant, cafe, permission, and plan isolation server-side.
- Make limit checks, stock updates, and entitlement changes concurrency-safe.
- Audit approvals, inventory changes, permission changes, and subscriptions.
- Support desktop and mobile web with keyboard-accessible controls.
- Provide distinct loading, empty, error, pending-review, and locked states.
- Preserve historical data and support backup and recovery.
- Agree performance, availability, retention, and recovery targets before release.

## 9. Proposed exclusions

Reward campaign creation and reward-rule editing; customer redemption flows; full point of sale; supplier payments; automated purchasing; stock transfers; demand forecasting; native mobile apps. Sales integrations and recipe-driven automatic depletion remain outside committed scope pending decisions.

## 10. Success measures

Track partner setup completion, monthly reporting adoption, cafe self-service submissions, approval turnaround time, Free-to-Paid conversion, Paid cafe inventory activity, recipe adoption, and reward/stock reconciliation discrepancies. Set numeric targets after establishing baseline volumes.

## 11. Implementation sequence and release checks

Proposed sequence:
1. Validate open policy decisions and inspect the existing application and cafe schema.
2. Implement access isolation, cafes, and approval workflow.
3. Add reward reporting and enforce the three-cafe Free limit.
4. Add Paid entitlements, cafe inventory, and chain recipes.
5. Exercise upgrade/downgrade behavior and run a pilot.

Release checks must cover cross-partner access, fourth-cafe blocking, concurrent create/reactivate requests, pending/rejected/approved edits, reward reconciliation, independent cafe stock, recipe ownership, duplicate submissions, and retained-but-inaccessible downgrade data.

## 12. Open decisions

- Paid price, payment provider, and tax handling.
- Exact role permissions and staff invitation process.
- Approval requirements for creation, archival, and reactivation.
- Approval turnaround, overlapping submissions, and partial versus whole-request approval.
- Reward source, metric statuses, refresh frequency, and timezone.
- Inventory units, conversions, negative-stock policy, and catalog mapping across cafes.
- Recipe yield requirements and deduction trigger, if any.
- Downgrade timing, cafe selection, fallback behavior, and payment failures.
- Archived and restricted data visibility rules and retention periods.
- Measurable workload, performance, availability, and recovery targets.

## 13. Instructions for Codex

Use this PRD as the product brief. Inspect the existing repository and its instructions before changing code. Preserve its architecture and conventions where practical. Treat confirmed requirements as mandatory. Treat proposed details as candidates, not user-approved policy. Do not invent pricing, payment integrations, or automatic recipe deduction behavior. Surface unresolved policy decisions when they affect implementation; continue independent work where possible. Validate authorization and entitlements on the server and use meaningful tests for limits, approval transitions, stock integrity, recipe ownership, and downgrade access.
