# Loyalty database handlers

`20261025000100_restore_loyalty_handlers.sql` installs the current definitions of
both reward trigger functions, including on databases that already applied the
baseline migration:

- `handle_new_transaction_chain`: each `RewardTransaction` insert adds one stamp
  to the user's chain card. A café's threshold override takes precedence over
  the chain threshold. Reaching the threshold resets stamps and issues one
  `Rewards` row and reward credit.
- `handle_reward_redeemed`: an `issued` reward becoming `redeemed` or `voided`
  consumes one credit. Repeated status updates do not consume another credit,
  and legacy null/zero balances cannot become negative.

The migration replaces and enables the existing triggers in place, preserving
the legacy `on_reward_redemeed` spelling. The functions use `SECURITY DEFINER`
with an empty search path and schema-qualified tables.

`20261025000200_wire_reward_actions.sql` connects the public QR forms through
two café-code-validated RPCs:

- Stamp form → `add_reward_stamp(user_id, cafe_code)` → insert into
  `RewardTransaction` → `handle_new_transaction_chain()`.
- Redemption form → `redeem_reward(reward_id, cafe_code)` → update the matching
  issued `Rewards` row → `handle_reward_redeemed()`.

The `handle_*` functions return `trigger` and are called by PostgreSQL, rather
than directly through the Supabase RPC API. Both new RPCs support anonymous
callers because public QR forms do not carry a Supabase user session. They
validate the café code inside the database; redemption also verifies the chain
and issued status, records the redemption time, and rejects duplicate requests.
The existing table RLS policies remain in place. Previously the redemption page
attempted an anonymous table update, which its authenticated-only update policy
blocked before the trigger could run.

Apply both migrations, in order, to the database configured for the Dev
deployment before deploying the updated server actions. Creating migration
files or deploying Next.js does not apply Supabase migrations. The actions now
require an operation ID from their RPC before reporting success and surface
database errors instead of falling back to direct writes.

Server actions return user-facing messages for invalid café codes, unavailable
rewards, invalid links, missing RPCs, and database configuration failures. The
forms preserve these messages; an infrastructure error no longer tells the
customer that their café code is wrong. Database error codes and messages are
logged on the server for diagnosis.

The unique `(user_id, chain_id)` index, conflict-safe card creation, and row lock
serialize stamps for a card, including simultaneous first visits. Before
deploying on a populated database, check for existing duplicate cards:

```sql
SELECT user_id, chain_id, count(*) AS card_count
FROM public."UserChainLoyalty"
GROUP BY user_id, chain_id
HAVING count(*) > 1;
```

If duplicates exist, reconcile their balances before applying the migration.
Index creation fails atomically rather than choosing or discarding a balance.
Effective loyalty thresholds must be positive; invalid thresholds reject the
stamp insert and roll back its effects.

## Regression checks

Apply the migrations to a disposable local Supabase database, then run:

```sh
pnpm exec tsx --test lib/rewards.test.ts
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/loyalty-handlers.sql
```

These are plain PostgreSQL assertions, not a pgTAP suite. Run as the local
database owner so fixtures and client-role checks can be created. Fixtures and
helpers are rolled back; PostgreSQL identity sequences can still advance.
Checks cover threshold issuance, shared chain progress, café overrides,
user/chain isolation, null counters, redemption retries, admin voiding and its
audit trail, invalid-threshold rollback, duplicate-card rejection, and trigger
execution through the existing `anon`/`authenticated` table policies. The RPC
checks reproduce the blocked direct anonymous redemption and confirm that the
anonymous stamp and redemption RPCs reach their respective trigger handlers.
They also cover wrong/blank café codes, cross-chain redemption, and retries.
Separate database sessions are needed to exercise concurrent writes under
contention. The TypeScript tests exercise the real server actions and Supabase
client with mocked HTTP responses, including database failures and missing RPCs.
