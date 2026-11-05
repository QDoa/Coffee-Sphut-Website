import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "./database";
async function session(
  role: string,
  user: string | null,
  run: (c: Awaited<ReturnType<typeof db>>) => Promise<void>,
) {
  const c = await db("postgres");
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, role }),
    ]);
    await c.query(
      `SET LOCAL ROLE ${role === "anon" ? "anon" : "authenticated"}`,
    );
    await run(c);
  } finally {
    await c.query("rollback");
    await c.end();
  }
}
test("post-cutoff anonymous discovery works through v2 while raw secret-bearing tables are inaccessible", () =>
  session("anon", null, async (c) => {
    const data = (await c.query("select public.public_cafes_v2() as d")).rows[0]
      .d;
    assert.ok(data.length > 0);
    assert.ok(
      data.every((x: Record<string, unknown>) => !("reward_code" in x)),
    );
    await assert.rejects(
      c.query('select reward_code from public."Cafe"'),
      /permission denied/,
    );
  }));
test("post-cutoff a different customer cannot enumerate another customer rewards or balances", () =>
  session(
    "authenticated",
    "10000000-0000-4000-8000-000000000003",
    async (c) => {
      assert.equal(
        (await c.query('select * from public."Rewards"')).rowCount,
        0,
      );
      assert.equal(
        (await c.query('select * from public."UserChainLoyalty"')).rowCount,
        0,
      );
      assert.equal((await c.query('select * from public."Cafe"')).rowCount, 0);
      assert.equal(
        (await c.query("update public.\"Rewards\" set status='redeemed'"))
          .rowCount,
        0,
      );
    },
  ));
test("post-cutoff customer-owned rewards and narrow QR availability remain available", () =>
  session(
    "authenticated",
    "10000000-0000-4000-8000-000000000001",
    async (c) => {
      const rows = (await c.query('select * from public."Rewards"')).rows;
      assert.ok(rows.length >= 4);
      assert.ok(
        rows.every((x) => x.user_id === "10000000-0000-4000-8000-000000000001"),
      );
      assert.equal(
        (
          await c.query("select public.reward_available($1) as available", [
            rows[0].id,
          ])
        ).rows[0].available,
        false,
      );
    },
  ));
