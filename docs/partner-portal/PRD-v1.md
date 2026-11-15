# Coffee Sphut Partner Portal PRD — v1

Version: 0.4
Status: Draft for review (co-founder sign-off pending on decisions 6 and 10)
Date: 2026-11-14
Supersedes: v0.3 (`Coffee_Sphut_Partner_Portal_PRD.md` at tag `partner-portal-v0-reference`)
Audience: Product, design, engineering, the Nigeria team, and coding agents

## 1. Purpose

v0.3 described the full partner portal: subscriptions, inventory, recipes, sales reports and downgrade rules. The branch built from it (`codex/partner-portal`, ~18.7k lines, 13 `partner_*` tables) is now frozen as a reference and will not be merged.

This version cuts the portal down to what v1 needs and settles the policy questions v0.3 left open. It is the brief for Phase 1 (design), Phase 2 (schema) and Phase 3 (rebuild from `main`).

**v1 goal:** café owners can get in easily, keep their café accurate, and see their stamp card working.

Rule for this document: anything not listed in section 4.1 or 4.2 is out of v1. Proposals still awaiting a decision are labelled.

## 2. What changed from v0.3

| Area | v0.3 | v0.4 (v1) |
| --- | --- | --- |
| Billing and plans | Free and Paid tiers, monthly billing | Deferred. No plans, prices or upgrade screens in v1 |
| Café limit | 3 active cafés on Free, enforced | Limit recorded (decision 6) but not enforced in v1 |
| Inventory and recipes | Paid feature | Behind a per-partner flag, founding partners only |
| Getting access | Not specified | "Claim this café" request, verified by the team, then an owner invitation |
| Editable fields | All café fields | The fields owners actually maintain (section 4.1, V1-03). Other fields stay admin-only |
| Reward reporting | Proposed baseline | Exact definitions for stamps, redemptions and unique customers (section 6) |
| Sales reports, order channels | Excluded pending decisions | Out of v1 |

The confirmed v0.3 rules that still hold: a partner is a chain; café edits need Coffee Sphut approval; partners never see another partner's data; history is preserved.

## 3. Users and roles

| Role | Can do | Cannot do |
| --- | --- | --- |
| Owner | Everything for every café in the partner (chain): edit profiles, see reports, export CSV, invite and remove managers | Approve their own edits |
| Manager | For assigned cafés only: edit profiles, see reports, export CSV | Manage the team; see unassigned cafés |
| Coffee Sphut reviewer | Approve or reject claims and edits in the admin queue; toggle partner features | Act as a partner |

- A partner can have several owners. The last owner can't be removed or downgraded.
- Partners sign in with the same accounts as app users. Access comes from partner membership, never from a flag on the user.
- Reviewers use the existing admin login (`AdminUser`) and every decision is written to `AdminAuditLog`.

## 4. Scope

### 4.1 In v1

**V1-01 Sign-in, invitations and password reset**
Email and password, plus "Email me a sign-in link" for owners who won't remember passwords. Invitations are single-use links valid for 7 days; only a hash of the token is stored. Signed-in users without a partner membership see "You don't have access to a café yet — Claim your café", not an error. Branded emails through custom SMTP.
Acceptance: sign-in works both ways on a phone over slow 3G; invite → accept → overview in under 2 minutes; expired, used and wrong-email invites each show a clear message; repeated wrong passwords are rate-limited.

**V1-02 Claim this café**
Entry from the app's café screen, the website café page and the WhatsApp/email invitation (`/partner/claim?cafe=<id>&src=app|web|whatsapp`), or a search over active cafés. Form: name, role, email, phone (+234), optional note, captcha. The request is checked against the email and phone on file (decision 4). Approval creates the partner if needed and sends an owner invitation.
Acceptance: matching email → verification → approval → invitation → owner signed in, end to end; an unmatched claim appears flagged "call the café"; a second claim on the same café is blocked; at most 5 claims per IP per hour.

**V1-03 Café profile editing with approval**
Editable in v1: photos (up to 8), opening hours (including overnight and closed days, same format as the mobile app), amenities (the app's supported list), contact details (phone, email, Instagram, website), description (max 500 characters), and benchmark drink prices in ₦ for 3–5 drink types.
Workflow: draft (autosaved) → submitted / pending → approved or rejected with a reason. Owners can withdraw a pending request and resubmit after a rejection. The live listing (app and website) doesn't change until approval, which applies all fields in one transaction. If a live value changed since editing started, that field is blocked and shown to the reviewer as a conflict.
Acceptance: every field above can be edited and submitted from a phone; nothing goes live before approval; rejection reasons are shown; conflicts are caught (tested); photo upload shows progress and retries on slow 3G.

**V1-04 Admin claim and review queue with decision emails**
Tabs for claims, café edits, and new cafés / removals (see open item O-3). Oldest first, ages colour-coded (under 12 h, 12–24 h, over 24 h), count badge in the admin sidebar, median decision time at the top. Edits show a before/after view. Rejections need a reason. Emails for claim approved (with invitation), claim rejected, edit approved and edit rejected; the decision also appears as a notice on the partner overview.
Acceptance: each type approved and rejected end to end on staging with emails received; two reviewers acting on the same item at once → only one succeeds.

**V1-05 Reward report and CSV export**
Per accessible café: stamps, redemptions and unique customers, filtered by date in Lagos time (this week, last 4 weeks, custom), a weekly chart and a paged event list (50 rows). CSV export uses exactly the on-screen filters. Definitions in section 6.
Acceptance: totals match a hand-written SQL check on staging; the CSV matches the screen exactly; a manager can't get another café's data by editing the URL (tested); a load failure shows an error with retry, never a zero.

**V1-06 Overview**
How many app users saved the café (counts only), the onboarding checklist, and recent review decisions. The checklist steps follow the activation definition in section 8 (profile checked, stamp card live, counter card downloaded and placed, first redemption); final wording comes from the Phase 1 designs.

**V1-07 Team**
Owners invite managers by email and assign them to cafés, resend or revoke invitations, and remove members. Removed members lose access on their next request.

**V1-08 Counter QR card download**
A printable card per café carrying the café's existing stamp code (`Cafe.reward_code`), in the format from the Phase 1 design task. Cafés without a stamp code see how to get one set up by the team (self-serve setup is out of v1).

**V1-09 Portal and feature flags (platform)**
`PARTNER_PORTAL_ENABLED` turns the whole portal on or off (off in production until the pilot; `/partner/*` shows "Coming soon"). Per-partner features (`partners.features`) are checked in navigation, page loaders, server actions and database access rules. Reviewers toggle them in admin, with each change logged.

### 4.2 Behind a flag (founding partners only)

Inventory, stocktake, restock planner and chain recipes, ported from the reference branch only after the v1 core works, and only if founding partners ask for them. Off by default. A partner without the flag gets a 404 from the page and a rejection from the server and database, not just a hidden menu item. The v0.3 inventory and recipe rules (independent café balances, append-only movements, no automatic recipe deductions) still apply when these are switched on.

### 4.3 Out of v1

- Billing, plans, prices, payment providers, upgrade and downgrade flows
- Sales reports and order channel analytics
- Owners setting up or changing their own stamp card
- Café view counts and direction-request counts
- Weekly WhatsApp stats
- Partner-created reward campaigns or rule changes
- Native mobile apps for partners

## 5. Decisions

Each decision lists the recommended default from the Phase 0 policy task. "Adopted" means v1 is designed and built on it unless review changes it; the reviewer and date are filled in at sign-off.

| # | Decision | Options considered | Choice | Why | Status | Decided by / date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Reporting timezone | Viewer's device time; UTC; Africa/Lagos | **Africa/Lagos** (WAT, UTC+1, no daylight saving). All date filters and "this week" use it; weeks start Monday | Every partner café is in Nigeria; one fixed zone keeps the screen, CSV and admin checks identical | Adopted | — |
| 2 | Café edit approval | Some fields self-publish; all need approval | **All edits need approval**, target under 24 hours | Listings are the product's trust; matches the v0.3 rule | Adopted | — |
| 3 | New cafés and removals | Self-serve; approval | **Both need approval.** A new café doesn't count toward any limit until approved; a removal archives the café and keeps its history | Same trust reasoning; protects reward history | Adopted (see O-3) | — |
| 4 | Claim verification | Manual only; email/phone match; document upload | **Email on file matches → verification link to that address; phone on file matches → team confirms by calling that number; no match → team calls the café.** One pending claim per café. Every claim still needs reviewer approval | Uses contact details we already hold; no documents to handle | Adopted | — |
| 5 | Partner = chain | Partner per café; partner per chain | **One partner per `Chains` row.** Single cafés get their own chain. Because owners see every café in the chain, the reviewer confirms the claimant speaks for the whole chain before approving | Matches the v0.3 rule and the existing data | Adopted | — |
| 6 | Free café limit | 3 (v0.3); 5 (earlier task) | **5**, recorded but not enforced or shown in v1 | Billing is hidden in v1, so the number only matters when plans return | **Pending co-founder** | — |
| 7 | Roles | Owner only; owner + manager; finer roles | **Owner** (everything) and **Manager** (assigned cafés; edit and reports; no team or billing). The last owner can't be removed | Covers single cafés and small chains without a permissions screen | Adopted | — |
| 8 | Reward metrics | See section 6 | Stamps = `RewardTransaction` rows; redemptions = `Rewards` with `status = 'redeemed'` at that café | Uses tables the app already writes; needs the Phase 2 fixes in section 6 | Adopted | — |
| 9 | Customer data shown to partners | Names; contact details; counts only | **Counts only.** No customer names, emails or phone numbers anywhere. CSV and event list use a short anonymised reference | Privacy by default; owners don't need identities to see the stamp card working | Adopted | — |
| 10 | Founding partner offer | None; discount; free flagged features | **First 20–25 cafés get flagged features free for 6–12 months**, in exchange for: stamp card live, QR card on the counter, monthly feedback | Gets early cafés activated and gives us a feedback panel | **Pending co-founder** | — |

## 6. Data and reporting definitions

- **Stamp:** one `RewardTransaction` row. Café = `store_id`; time = `created_at`.
- **Redemption:** one `Rewards` row with `status = 'redeemed'` and `redeemed_store` = the café, dated by `redeemed_at`. Never count by `redeemed_at` alone.
- **Unique customers:** distinct `user_id` in the period, shown as a count only.
- **Week:** Monday-start week in Africa/Lagos, e.g. `date_trunc('week', created_at at time zone 'Africa/Lagos')`.
- **Anonymised reference:** a short hash prefix of the user id (for example 6 characters), stable within reports, never reversible in the UI.
- **Saves:** `SavedCafe` rows for the café, counts only.

Phase 2 must fix two data problems before the report can be correct:

1. `redeem_reward` doesn't record which café redeemed. Add `Rewards.redeemed_store` and set it in the function.
2. `Rewards.redeemed_at` defaults to `now()`, so issued rewards look redeemed by date. Change the default to `NULL` and backfill `NULL` for `status = 'issued'`.

Redemptions recorded before the fix have no café. Show them as "Café unknown (before Nov 2026)" in chain totals only.

The mobile app (2.0.3 in users' hands, can't be force-updated) depends on `get_closest_cafes`, `add_reward_stamp`, `redeem_reward`, `reward_available` and direct reads of `Cafe`, `Chains`, `Rewards`, `UserChainLoyalty`, `SavedCafe`, `Bookmark`, `Profile` and `OnboardingQuestion`. v1 changes must keep all of these working.

## 7. Quality rules

- Every server action and query re-checks the user's role, partner, café assignment and feature flags on the server; database access rules are a second layer, not the only one.
- Validate every input with zod. No customer personal data in any partner response, page or export.
- Approvals, claim decisions, team changes and feature toggles are concurrency-safe and audited.
- Mobile first: every v1 flow works on a low-end Android phone over slow mobile data.
- Distinct loading, empty, error, pending-review and "not available" states. Errors never render as zero.
- Each feature ships with unit tests and one Playwright happy-path test. Pull requests stay under about 400 lines, each with a Vercel preview against staging Supabase.

## 8. Success metrics

| Metric | Definition | Target |
| --- | --- | --- |
| Activated cafés | Stamp card live, QR card on the counter, and at least 1 redemption in the last 30 days | Baseline during pilot, then set |
| Weekly partner logins | Distinct partner users signing in per week | Baseline during pilot, then set |
| Approval turnaround | Median time from submission to decision, for claims and edits | Under 24 hours |
| Stamps per activated café per week | Stamps (section 6) ÷ activated cafés, per Lagos week | Baseline during pilot, then set |

## 9. Launch plan

1. Pilot with 3–5 cafés, set up in person by the Nigeria team (portal enabled for pilot partners only).
2. Fix pilot issues.
3. Send the claim invitation to the remaining cafés in batches, watching approval turnaround so the queue stays under 24 hours.

## 10. Traceability: Phase 3 tasks → scope

| Phase 3 task | Scope item |
| --- | --- |
| Set up the clean branch and feature flags | V1-09 |
| Partner sign-in, invite acceptance and password reset | V1-01 |
| "Claim this café" request and admin approval | V1-02, decisions 4 and 5 |
| Café profile editing with approval | V1-03, decision 2 |
| Admin claim and review queue with decision emails | V1-04 |
| Reward report and CSV export | V1-05, decisions 1, 8 and 9 |
| Overview page: saves count and onboarding checklist | V1-06 |
| Team: owner invites managers | V1-07, decision 7 |
| Counter QR card download | V1-08 |
| Port inventory and recipes behind the founding-partner flag | 4.2, decision 10 |

Every Phase 3 task maps to a scope item. One scope item has no partner-side task yet: see O-3.

## 11. Open items

- **O-1** Decisions 6 and 10 need co-founder agreement.
- **O-2** Owner interviews (Nigeria team, at least 3) are not yet summarised. Link the summary here and revisit 4.1 and 4.2 if they change priorities.
- **O-3** Decision 3 and the admin queue's "New cafés / removals" tab have no partner-side Phase 3 task. Either add a small request form to the cafés list in Phase 3, or drop the tab for v1 and handle these by contacting the team.
- **O-4** Email provider for decision emails and invitations (Resend recommended; none is installed today). Needs a sending domain and the custom SMTP setup for Supabase Auth.
- **O-5** The Phase 2 audit should report how many cafés have no email or phone on file; those claims always need a call, which affects pilot staffing.
- **O-6** The hours format must be agreed with the mobile app's overnight-hours fix before V1-03 is built.

## 12. Instructions for implementers and coding agents

Build from `main`, not from the reference branch. Copy code from `partner-portal-v0-reference` only where the reuse list approves it. Treat sections 4.1, 4.2, 5 (adopted rows), 6 and 7 as requirements. Don't build anything in 4.3, don't invent prices or plans, and don't add customer personal data to partner views. If a pending decision or open item blocks a task, surface it and continue with independent work.
