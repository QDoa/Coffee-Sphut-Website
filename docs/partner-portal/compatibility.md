# Public/private contract and consumer inventory

Source inspection: website commit `41947ee` and the available mobile checkout at `94b1008`, October 25, 2026. The mobile checkout has pre-existing local changes; it was read without modification. These sources do not prove which versions are deployed or that external integrations do not exist.

## Current consumers and writers

Mobile paths below are relative to the separate `Coffee-Sphut-mobile` repository.

| Consumer | Current interface and behavior | Compatibility requirement |
| --- | --- | --- |
| Website initial discovery, `app/stores/server.tsx` | Anonymous `Cafe` read: id, name, address, image_url, latitude, longitude. Shared cache for 300 seconds with `cafes` tag. No active filter. | Move to the approved public projection, apply agreed lifecycle visibility, invalidate only after approved publication. |
| Website nearby/search | `get_closest_cafes` RPC; returned shape includes `reward_code`. Current RPC does not filter `is_active`. | Add a safe versioned interface; do not silently change the existing return type beneath clients. |
| Mobile nearby/search, `lib/services/location_service.dart:getCafes` | Same RPC with reward/amenity filters. Parses hours/socials/gallery; calculates `hasReward` from whether `reward_code` is nonempty. | Replace raw code with `has_reward: boolean`, preserve supported fields/filter semantics. |
| Mobile saved café details, `location_service.dart:getCafesByIds` | Direct `Cafe` projection includes raw `reward_code`; separate `CafeImages` read. | Provide an authorized safe public by-ID interface as well as nearby search; changing only the search RPC leaves code exposure. |
| Mobile loyalty cards, `lib/services/reward_service.dart:getRewards` | Reads `UserChainLoyalty` filtered by current user; then `Chains` and `Rewards(id, chain_id)` filtered by user/chain. | Enforce customer-own rows on server; client `.eq(user_id)` is not authorization. Keep minimal public chain metadata available. |
| Mobile reward buttons, `lib/screens/reward/reward_screen.dart` | Opens website `/vendor_reward` and `/redeem_reward` with user/reward context. The inspected service contains reads, not direct stamp/redemption writes. | Keep link contracts and validate inputs on the server. Names/query labels do not authorize actions. |
| Website stamp action, `app/vendor_reward/server.tsx` | Anonymous `add_reward_stamp(user_id, cafe_code)` RPC. | Keep validated café-code operation available; do not replace it with anonymous direct table writes. |
| Website redemption availability, `app/redeem_reward/server.tsx:rewardAvailable` | Anonymous `Rewards.status` lookup by reward ID. | Before removing public reward SELECT, add a narrow availability interface that returns only the necessary state. |
| Website redemption action, `app/redeem_reward/server.tsx:redeemRewardRequest` | Anonymous `redeem_reward(reward_id, cafe_code)`. RPC verifies chain and issued state but currently loses resolved café identity. | Capture actual redemption café in the same transaction; preserve signature/return compatibility or coordinate a versioned caller update. |
| Loyalty triggers | Stamp insert issues `Rewards` at threshold; issued → redeemed/voided consumes a credit. `RewardTransaction` is a stamp log. | Do not count stamps as completed redemptions. Preserve concurrency and credit handling regressions. |
| Staff user/reward actions | Staff reads and `admin_*` RPCs; void action only accepts an issued reward. | Preserve staff permissions and auditing. Voiding issued rewards does not describe reversal of completed redemptions. |
| Staff café/menu/image actions | Staff-authenticated writes; café, gallery, and menu persistence currently separate. | Partners submit reviewed aggregates through separate actions; existing admin actions are not partner entry points. |
| Storage | Public `media` bucket, staff insert/update, admin delete; café upload manager uses managed `cafes/` paths. | Preserve approved public imagery. Drafts require private staging. Keep admin-only authenticated deletion and reference-safe cleanup. |
| Editorial content | Existing public/published `Recipe`, posts, events and related staff pages | Partner operational recipes use separate tables and policies. |

No direct reward mutation was found in the inspected mobile `lib/` tree. Hosted Edge Functions, older mobile builds, service-role integrations, SQL jobs, and other repositories remain unverified writers. Inspecting only local Next.js actions is insufficient to declare a single authoritative source.

The Dev project has no deployed Edge Functions according to its metadata listing. Production functions/jobs remain uninspected. The available mobile development/test/production configuration files all point to production; their names cannot establish which backend was used for testing or what is currently deployed.

## Exposure inventory from repository and Dev metadata

- `Cafe`, `CafeImages`, `CafeMenu`, and `Chains` permit public SELECT. Adding a more restrictive permissive partner policy would leave public access in place.
- `Rewards` and `UserChainLoyalty` have unrestricted SELECT policies. The former also permits authenticated UPDATE with unconditional checks; `RewardTransaction` permits unconditional INSERT. Remove these bypasses only with a tested replacement for supported public/customer operations.
- Broad table grants and default privileges for API roles exist. New private tables/functions need explicit privileges and RLS; never assume creating a table makes it private.
- `get_closest_cafes` exposes café codes independently of raw table reads. Column restrictions alone do not fix every interface.
- Public bucket URLs remain public even if a page hides them. Use a private bucket for drafts and restricted operational files.

## Approved classification

| Data | Public | Customer | Authorized partner | Internal staff |
| --- | --- | --- | --- | --- |
| Approved directory text, location, contacts, amenities, hours, rating, approved images/menu | Yes, subject to lifecycle visibility and existing display flags | Same public data | Same public data plus authorized review context | Existing staff access |
| Minimal chain name/ID and existing consumer loyalty display metadata | Existing supported public contract | Own loyalty context | Only additional operational settings explicitly authorized | Existing staff access |
| Café loyalty availability | Boolean only in replacement interface | Same | Same public flag | Full operational fields as authorized |
| Café reward code | No | No | Accessible café operational permissions only | Staff operational permissions |
| Customer rewards and stamp-card balances | No unrestricted lists | Own rows only | Minimal reporting projection; no unnecessary customer IDs/data | Existing authorized staff functions |
| Partner reports and review drafts | No | No consumer access | Chain/café/role/entitlement checks | Reviewer/support permissions |
| Inventory and operational recipes | No | No consumer access | Paid; café assignments for inventory; confirmed shared recipe permissions | Explicit internal operational permission, separate from plan |
| Membership, billing, entitlement records | No | No consumer access | Minimum role-specific reads; Owner management | Explicit provisioning/support permission |
| Audit payloads | No | No consumer access | Redacted scoped history if exposed | Internal audit permissions |

This is a data classification, not an instruction to grant every staff editor unrestricted access to new operational tables. Internal inventory/billing support permissions need explicit checks too.

## Replacement interfaces to build after P0

1. Add a safe public nearby/search interface and by-ID lookup that return approved directory fields and `has_reward`; omit actual café codes, partner flags, inventory and drafts. Preserve IDs and valid search/amenity behavior. Decide archival behavior before defining visibility predicates.
2. Migrate website reads and prepare the mobile update for both nearby and saved cafés. Validate offline/cache compatibility. The current mobile `Cafe` model stores a boolean, so existing cached café models do not require a raw code field.
3. Add a minimal reward availability function and keep code-validated stamp/redemption functions; enforce customer-own reward/card reads. Add true café attribution and guard against other write paths bypassing it.
4. Verify deployed-client compatibility, then remove code exposure from legacy RPC/direct table contracts and narrow reward/card grants and policies. If an old mobile version cannot be updated, explicitly choose a compatibility cutoff or temporary residual exposure; do not describe an exposed code as private.
5. Run cross-tenant, direct REST/RPC, public search, customer-own reward, QR, staff, archived-café, and downgrade tests before declaring the privacy contract fulfilled.

Until step 4, legacy exposure remains an implementation gate. P0 does not change existing API behavior or claim to have secured it.
