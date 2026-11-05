import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "./database";
test("insights aggregate complete history and enforce current tenant, assignment and Paid scope", async () => {
  const c = await db();
  try {
    await c.query("begin");
    await c.query(
      "update public.partner_items set balance=4000 where id='40000000-0000-4000-8000-000000000002'",
    );
    await c.query(
      "update public.partner_accounts set reward_coverage_at=now()-interval '8 weeks'",
    );
    await c.query(
      "update public.partner_movements set created_at=now()-interval '28 days' where item_id='40000000-0000-4000-8000-000000000002'",
    );
    await c.query(
      `insert into public.partner_movements(chain_id,item_id,cafe_id,quantity,resulting_balance,type,actor,reason,created_at) values('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',101,-2800,4000,'consumption','10000000-0000-4000-8000-000000000001','Test history',now()-interval '1 day')`,
    );
    const run = async (n: number) => {
      await c.query("reset role");
      await c.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({
          sub: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
          role: "authenticated",
        }),
      ]);
      await c.query("set local role authenticated");
      return (await c.query("select public.partner_insights() d")).rows[0].d;
    };
    const owner = await run(1);
    assert.equal(owner.weekly_rewards.length, 8);
    const milk = owner.stock_rates.find((r: { item_id: string }) =>
      r.item_id.endsWith("2"),
    );
    assert.equal(Number(milk.daily_usage), 100);
    assert.equal(Number(milk.days_left), 40);
    const manager = await run(2);
    assert.ok(
      manager.stock_rates.every(
        (r: { item_id: string }) => !r.item_id.endsWith("3"),
      ),
    );
    assert.equal((await run(3)).stock_rates.length, 0);
    await c.query("reset role");
    await c.query(
      "update public.partner_memberships set revoked_at=now() where user_id='10000000-0000-4000-8000-000000000001'",
    );
    await assert.rejects(() => run(1), /Current partner access/);
  } finally {
    await c.query("rollback");
    await c.end();
  }
});
