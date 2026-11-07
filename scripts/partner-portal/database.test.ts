import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { db } from "./database";
import { CAFE_AMENITIES } from "../../lib/partner/amenities";
const A = "20000000-0000-4000-8000-000000000001",
  B = "20000000-0000-4000-8000-000000000002";
const uid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function actor(c: Client, n: number) {
  await c.query("RESET ROLE");
  await c.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: uid(n), role: "authenticated" }),
  ]);
  await c.query("SET LOCAL ROLE authenticated");
}
async function command(
  c: Client,
  action: string,
  input: Record<string, unknown>,
  chain = A,
) {
  const data = { chain_id: chain, request_id: randomUUID(), ...input };
  return (
    await c.query("select public.partner_command($1,$2) as result", [
      action,
      JSON.stringify(data),
    ])
  ).rows[0].result;
}
async function snapshot(c: Client, section: string, input = {}) {
  return (
    await c.query("select public.partner_snapshot($1,$2) as result", [
      section,
      JSON.stringify(input),
    ])
  ).rows[0].result;
}
async function transaction(fn: (c: Client) => Promise<void>) {
  const c = await db();
  try {
    await c.query("BEGIN");
    await fn(c);
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }
}
// Expected database errors abort only a savepoint, allowing follow-up assertions.
async function denied(c: Client, fn: () => Promise<unknown>, pattern?: RegExp) {
  await c.query("SAVEPOINT negative_case");
  try {
    if (pattern) await assert.rejects(fn, pattern);
    else await assert.rejects(fn);
  } finally {
    await c.query("ROLLBACK TO SAVEPOINT negative_case");
  }
}

test("database RLS isolates tenants/assigned cafes and prohibits direct writes", () =>
  transaction(async (c) => {
    await actor(c, 2);
    assert.equal(
      (await c.query("select * from public.partner_items")).rows.every(
        (x) => Number(x.cafe_id) === 101,
      ),
      true,
    );
    await denied(c, () => snapshot(c, "cafe", { id: 102 }), /access denied/);
    await denied(
      c,
      () =>
        command(
          c,
          "item",
          {
            cafe_id: 201,
            name: "attack",
            code: "X",
            type: "ingredient",
            unit: "g",
          },
          B,
        ),
      /access denied/,
    );
    await denied(
      c,
      () => c.query("update public.partner_items set balance=999"),
      /permission denied/,
    );
    await denied(
      c,
      () => c.query("delete from public.partner_movements"),
      /permission denied/,
    );
    await c.query("RESET ROLE");
    await c.query(
      "update public.partner_memberships set revoked_at=now() where user_id=$1",
      [uid(2)],
    );
    await actor(c, 2);
    await denied(c, () => snapshot(c, "overview"), /No active partner/);
  }));

test("partner café requests restrict editable amenities and preserve existing ratings", () =>
  transaction(async (c) => {
    await c.query(
      `UPDATE public."Cafe" SET rating=4.5, amenities=ARRAY['wifi', 'legacy'] WHERE id=102`,
    );
    await actor(c, 1);
    const { cafe } = await snapshot(c, "cafe", { id: 102 });
    const target = { cafe_id: 102, baseline: cafe.partner_revision };
    await denied(
      c,
      () => command(c, "save_change", { ...target, payload: { rating: 5 } }),
      /cannot propose café rating changes/,
    );
    for (const amenities of [["custom_amenity"], "wifi", [null]]) {
      await denied(
        c,
        () => command(c, "submit_change", { ...target, payload: { amenities } }),
        /available café amenities/,
      );
    }
    const draft = await command(c, "save_change", {
      ...target,
      payload: { amenities: CAFE_AMENITIES.map(({ id }) => id) },
    });
    await denied(
      c,
      () =>
        command(c, "submit_change", {
          ...target,
          id: draft.id,
          payload: { amenities: ["custom_amenity"] },
        }),
      /available café amenities/,
    );
    const unrelatedEdit = await command(c, "submit_change", {
      ...target,
      payload: { description: "New description" },
    });
    await actor(c, 4);
    await command(c, "review", { id: unrelatedEdit.id, decision: "approve" });
    await actor(c, 1);
    const updated = (await snapshot(c, "cafe", { id: 102 })).cafe;
    assert.deepEqual(updated.amenities, ["wifi", "legacy"]);
    assert.equal(updated.rating, 4.5);
  }));

test("Free cannot access Paid data through reads, commands or forged plan activation", () =>
  transaction(async (c) => {
    await actor(c, 3);
    assert.equal(
      (await c.query("select * from public.partner_items")).rowCount,
      0,
    );
    await denied(c, () => snapshot(c, "inventory"), /Upgrade/);
    await denied(c, () => snapshot(c, "recipes"), /Upgrade/);
    await denied(
      c,
      () => command(c, "activate_plan", { plan: "paid", reason: "forged" }, B),
      /Admin/,
    );
    await denied(
      c,
      () =>
        command(
          c,
          "item",
          { cafe_id: 201, name: "X", code: "X", type: "ingredient", unit: "g" },
          B,
        ),
      /Paid/,
    );
  }));

test("draft, approval and stale revision handling preserve live fields", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const live = (await snapshot(c, "cafe", { id: 101 })).cafe;
    const payload = {
      name: "Reviewed name",
      social_media: { Instagram: "https://example.test" },
      gallery: ["https://example.test/photo.jpg"],
      menu: [
        {
          name: "Latte",
          price: 500,
          currency: "CAD",
          description: "Milk coffee",
        },
      ],
    };
    const draft = await command(c, "save_change", {
      cafe_id: 101,
      baseline: live.partner_revision,
      payload,
    });
    assert.equal((await snapshot(c, "cafe", { id: 101 })).cafe.name, live.name);
    await command(c, "submit_change", {
      id: draft.id,
      cafe_id: 101,
      baseline: live.partner_revision,
      payload,
    });
    await denied(
      c,
      () => command(c, "review", { id: draft.id, decision: "approve" }),
      /Staff/,
    );
    await actor(c, 4);
    await command(c, "review", { id: draft.id, decision: "approve" });
    await actor(c, 1);
    const approved = await snapshot(c, "cafe", { id: 101 });
    assert.equal(approved.cafe.name, "Reviewed name");
    assert.equal(approved.menu[0].name, "Latte");
    assert.equal(approved.gallery.length, 1);
    const stale = await command(c, "submit_change", {
      cafe_id: 101,
      baseline: approved.cafe.partner_revision,
      payload: { name: "Stale" },
    });
    await c.query("RESET ROLE");
    await c.query('update public."Cafe" set name=$1 where id=101', [
      "Staff new version",
    ]);
    await actor(c, 4);
    await denied(
      c,
      () => command(c, "review", { id: stale.id, decision: "approve" }),
      /Conflict/,
    );
  }));

test("self-review denied to a dual-role admin; rejection requires reason", () =>
  transaction(async (c) => {
    await c.query(
      "insert into public.\"AdminUser\"(user_id,role) values($1,'admin')",
      [uid(1)],
    );
    await actor(c, 1);
    const baseline = (await snapshot(c, "cafe", { id: 101 })).cafe
      .partner_revision;
    const ch = await command(c, "submit_change", {
      cafe_id: 101,
      baseline,
      payload: { name: "Change" },
    });
    await denied(
      c,
      () => command(c, "review", { id: ch.id, decision: "approve" }),
      /Another staff/,
    );
    await actor(c, 4);
    await denied(
      c,
      () => command(c, "review", { id: ch.id, decision: "reject", reason: "" }),
      /reason/,
    );
    await command(c, "review", {
      id: ch.id,
      decision: "reject",
      reason: "Please verify the address",
    });
    await actor(c, 1);
    assert.equal(
      (await snapshot(c, "cafes")).changes[0].reason,
      "Please verify the address",
    );
  }));

test("stock ledger: 20 receipt minus 3 consumed then count 15; retries and insufficient stock", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const item = await command(c, "item", {
      cafe_id: 101,
      name: "Test units",
      code: "TEST",
      type: "product",
      unit: "each",
    });
    const payload = {
      chain_id: A,
      request_id: randomUUID(),
      item_id: item.id,
      type: "receipt",
      quantity: "20",
      reason: "Delivery",
    };
    await command(c, "movement", payload);
    await command(c, "movement", payload);
    await denied(
      c,
      () => command(c, "movement", { ...payload, quantity: "21" }),
      /reused/,
    );
    assert.equal(
      (
        await command(c, "movement", {
          item_id: item.id,
          type: "consumption",
          quantity: "3",
          reason: "Sale",
        })
      ).balance,
      17,
    );
    assert.equal(
      (
        await command(c, "movement", {
          item_id: item.id,
          type: "count",
          quantity: "15",
          reason: "Physical count",
        })
      ).balance,
      15,
    );
    const rows = (
      await c.query(
        "select quantity,resulting_balance from public.partner_movements where item_id=$1 order by created_at,id",
        [item.id],
      )
    ).rows;
    assert.equal(rows.length, 3);
    assert.ok(rows.some((x) => Number(x.quantity) === -2));
    await denied(
      c,
      () =>
        command(c, "movement", {
          item_id: item.id,
          type: "consumption",
          quantity: "16",
          reason: "Too much",
        }),
      /Insufficient/,
    );
    assert.equal(
      (
        await c.query("select balance from public.partner_items where id=$1", [
          item.id,
        ])
      ).rows[0].balance,
      "15.000000",
    );
  }));

test("inventory thresholds respect café access and preserve stock and history", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const initialBalance = (
      await c.query(
        "select balance from public.partner_items where id='40000000-0000-4000-8000-000000000001'",
      )
    ).rows[0].balance;
    const item = await command(c, "item", {
      cafe_id: 102,
      name: "House espresso beans",
      code: "BEANS2",
      type: "ingredient",
      unit: "g",
    });
    await command(c, "movement", {
      item_id: item.id,
      type: "receipt",
      quantity: "100",
      reason: "Other cafe receipt",
    });
    assert.equal(
      (
        await c.query(
          "select balance from public.partner_items where id='40000000-0000-4000-8000-000000000001'",
        )
      ).rows[0].balance,
      initialBalance,
    );
    const target = { id: item.id, cafe_id: 102 };
    await actor(c, 2);
    await denied(
      c,
      () => command(c, "item", { ...target, threshold: "125.5" }),
      /Paid cafe access required/,
    );
    await actor(c, 1);
    for (const threshold of ["-1", "NaN", "0.0000001"]) {
      await denied(
        c,
        () => command(c, "item", { ...target, threshold }),
        /Finite stock threshold|nonnegative low-stock threshold/,
      );
    }
    await command(c, "item", { ...target, threshold: "125.5" });
    async function stock() {
      const result = await c.query(
        "select balance, threshold, active from public.partner_items where id=$1",
        [item.id],
      );
      return result.rows[0];
    }
    assert.deepEqual(await stock(), {
      balance: "100.000000",
      threshold: "125.500000",
      active: true,
    });
    await command(c, "item", { ...target, active: false });
    await command(c, "item", { ...target, threshold: "0" });
    assert.deepEqual(await stock(), {
      balance: "100.000000",
      threshold: "0.000000",
      active: false,
    });
    assert.equal(
      (
        await c.query(
          "select * from public.partner_movements where item_id=$1",
          [item.id],
        )
      ).rows.length,
      1,
    );
  }));

test("recipes enforce ownership, units, role, quantities, and do not deduct stock", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const initialBalance = (
      await c.query(
        "select balance from public.partner_items where id='40000000-0000-4000-8000-000000000001'",
      )
    ).rows[0].balance;
    const ingredients = [
      {
        item_id: "40000000-0000-4000-8000-000000000001",
        quantity: 18,
        unit: "g",
      },
    ];
    await command(c, "recipe", {
      name: "Test espresso",
      yield: 1,
      ingredients,
    });
    assert.equal(
      (
        await c.query(
          "select balance from public.partner_items where id='40000000-0000-4000-8000-000000000001'",
        )
      ).rows[0].balance,
      initialBalance,
    );
    await denied(
      c,
      () =>
        command(c, "recipe", {
          name: "Bad",
          yield: 1,
          ingredients: [{ ...ingredients[0], quantity: 0 }],
        }),
      /Invalid/,
    );
    await denied(
      c,
      () =>
        command(c, "recipe", {
          name: "Bad",
          yield: 1,
          ingredients: [{ ...ingredients[0], unit: "ml" }],
        }),
      /Invalid/,
    );
    await denied(
      c,
      () =>
        command(c, "recipe", {
          name: "Bad",
          yield: 1,
          ingredients: [{ ...ingredients[0], item_id: randomUUID() }],
        }),
      /Invalid/,
    );
    await actor(c, 2);
    assert.ok((await snapshot(c, "recipes")).recipes.length);
    await denied(
      c,
      () => command(c, "recipe", { name: "Bad", yield: 1, ingredients }),
      /manager/,
    );
  }));

test("downgrade retains private data, limits selection and restores access only after staff activation", () =>
  transaction(async (c) => {
    await actor(c, 4);
    await command(c, "activate_plan", {
      plan: "free",
      cafe_ids: [101],
      reason: "Approved downgrade record",
    });
    await actor(c, 1);
    await denied(c, () => snapshot(c, "inventory"), /Upgrade/);
    await denied(c, () => snapshot(c, "cafe", { id: 102 }), /denied/);
    assert.deepEqual(
      (await snapshot(c, "overview")).cafes.map((x: { id: number }) => x.id),
      [101],
    );
    await actor(c, 4);
    await command(c, "activate_plan", {
      plan: "paid",
      reason: "Approved subscription record",
    });
    await actor(c, 1);
    assert.ok((await snapshot(c, "inventory")).items.length >= 3);
    assert.equal((await snapshot(c, "overview")).cafes.length, 3);
  }));

test("invitation acceptance is bound to email, role, cafe scope and single active membership", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const invitation = await command(c, "invite", {
      email: "reviewer@example.test",
      role: "cafe_manager",
      cafe_ids: [101],
    });
    await actor(c, 3);
    await denied(
      c,
      () => command(c, "accept_invite", { token: invitation.token }),
      /unavailable/,
    );
    await actor(c, 4);
    await command(c, "accept_invite", { token: invitation.token });
    const data = await snapshot(c, "overview");
    assert.equal(data.role, "cafe_manager");
    assert.deepEqual(
      data.cafes.map((x: { id: number }) => x.id),
      [101],
    );
    await denied(
      c,
      () => command(c, "accept_invite", { token: invitation.token }),
      /unavailable/,
    );
  }));

test("reward capture attributes redemption to B even when earned at A; reports use explicit status", () =>
  transaction(async (c) => {
    const id = randomUUID();
    await c.query(
      'insert into public."Rewards"(id,user_id,chain_id,earned_store) values($1,$2,$3,101)',
      [id, uid(1), A],
    );
    await actor(c, 1);
    await c.query("select public.redeem_reward($1,$2)", [id, "local-only-102"]);
    const report = await snapshot(c, "rewards", { cafe_id: 102 });
    assert.equal(report.total, 5);
    assert.ok(
      report.events.every((x: { cafe_id: number }) => x.cafe_id === 102),
    );
    await denied(
      c,
      () =>
        c.query("select public.redeem_reward($1,$2)", [id, "local-only-102"]),
      /unavailable/,
    );
  }));

test("public replacement hides archived cafes and secrets; anonymous cannot call operational RPC", () =>
  transaction(async (c) => {
    await c.query("SET LOCAL ROLE anon");
    const data = (await c.query("select public.public_cafes_v2() as data"))
      .rows[0].data;
    assert.ok(
      data.every(
        (x: { id: number; reward_code?: string }) =>
          x.id !== 103 && !("reward_code" in x),
      ),
    );
    await denied(c, () => snapshot(c, "overview"), /permission denied/);
  }));

test("concurrent approvals serialize the last Free slot", async () => {
  const c = await db();
  const chain = randomUUID(),
    owner = randomUUID(),
    ch1 = randomUUID(),
    ch2 = randomUUID();
  try {
    await c.query("insert into auth.users(id,email) values($1,$2)", [
      owner,
      `${owner}@example.test`,
    ]);
    await c.query(
      "insert into public.\"Chains\"(id,name) values($1,'Concurrency')",
      [chain],
    );
    await c.query(
      "insert into public.\"Cafe\"(chain_id,name) values($1,'one'),($1,'two')",
      [chain],
    );
    await c.query("insert into public.partner_accounts(chain_id) values($1)", [
      chain,
    ]);
    await c.query(
      "insert into public.partner_memberships(chain_id,user_id,role) values($1,$2,'owner')",
      [chain, owner],
    );
    await c.query(
      'insert into public.partner_cafe_access(cafe_id,chain_id) select id,chain_id from public."Cafe" where chain_id=$1',
      [chain],
    );
    for (const id of [ch1, ch2])
      await c.query(
        "insert into public.partner_changes(id,chain_id,payload,status,submitter) values($1,$2,$3,'pending',$4)",
        [id, chain, { name: id }, owner],
      );
    const approve = async (id: string) => {
      const connection = await db();
      try {
        await connection.query("BEGIN");
        await actor(connection, 4);
        const out = await command(
          connection,
          "review",
          { id, decision: "approve" },
          chain,
        );
        await connection.query("COMMIT");
        return out;
      } catch (e) {
        await connection.query("ROLLBACK");
        throw e;
      } finally {
        await connection.end();
      }
    };
    const results = await Promise.allSettled([approve(ch1), approve(ch2)]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      (
        await c.query(
          'select count(*)::int as n from public."Cafe" where chain_id=$1 and is_active',
          [chain],
        )
      ).rows[0].n,
      3,
    );
  } finally {
    for (const table of [
      "partner_audit",
      "partner_changes",
      "partner_assignments",
      "partner_cafe_access",
      "partner_memberships",
    ])
      await c.query(`delete from public.${table} where chain_id=$1`, [chain]);
    await c.query('delete from public."Cafe" where chain_id=$1', [chain]);
    await c.query("delete from public.partner_accounts where chain_id=$1", [
      chain,
    ]);
    await c.query('delete from public."Chains" where id=$1', [chain]);
    await c.query("delete from auth.users where id=$1", [owner]);
    await c.end();
  }
});

test("replaying a successful stock request cannot reveal retained balances after downgrade or revocation", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const input = {
      request_id: randomUUID(),
      item_id: "40000000-0000-4000-8000-000000000001",
      type: "receipt",
      quantity: "5",
      reason: "Replay access test",
    };
    await command(c, "movement", input);
    await actor(c, 4);
    await command(c, "activate_plan", {
      plan: "free",
      cafe_ids: [101],
      reason: "Downgrade",
    });
    await actor(c, 1);
    await denied(c, () => command(c, "movement", input), /Current Paid/);
    await c.query("RESET ROLE");
    await c.query(
      "update public.partner_memberships set revoked_at=now() where user_id=$1",
      [uid(1)],
    );
    await actor(c, 1);
    await denied(c, () => command(c, "movement", input), /Current partner/);
  }));

test("recipe missing units and nonfinite yields are rejected", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const ingredient = {
      item_id: "40000000-0000-4000-8000-000000000001",
      quantity: 18,
    };
    await denied(
      c,
      () =>
        command(c, "recipe", {
          name: "No units",
          yield: 1,
          ingredients: [ingredient],
        }),
      /Invalid/,
    );
    await denied(
      c,
      () =>
        command(c, "recipe", {
          name: "NaN yield",
          yield: "NaN",
          ingredients: [{ ...ingredient, unit: "g" }],
        }),
      /Finite/,
    );
  }));

test("concurrent stock consumption produces one success at insufficient combined balance", async () => {
  const c = await db();
  const item = randomUUID();
  try {
    await c.query(
      "insert into public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance) values($1::uuid,$2,101,'Concurrent stock',$1::text,'product','each',10)",
      [item, A],
    );
    const consume = async () => {
      const connection = await db();
      try {
        await connection.query("BEGIN");
        await actor(connection, 1);
        await command(connection, "movement", {
          item_id: item,
          type: "consumption",
          quantity: "7",
          reason: "Concurrent consume",
        });
        await connection.query("COMMIT");
      } catch (e) {
        await connection.query("ROLLBACK");
        throw e;
      } finally {
        await connection.end();
      }
    };
    const outcomes = await Promise.allSettled([consume(), consume()]);
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      (
        await c.query("select balance from public.partner_items where id=$1", [
          item,
        ])
      ).rows[0].balance,
      "3.000000",
    );
    await c.query("delete from public.partner_movements where item_id=$1", [
      item,
    ]);
    await c.query("delete from public.partner_items where id=$1", [item]);
  } finally {
    await c.end();
  }
});

test("a stock write waiting on downgrade rechecks the effective plan after the lock", async () => {
  const operator = await db(),
    downgrade = await db(),
    writer = await db();
  const item = randomUUID();
  const free = "20000000-0000-4000-8000-000000000003";
  try {
    await operator.query(
      "update public.partner_accounts set plan='paid' where chain_id=$1",
      [free],
    );
    await operator.query(
      "insert into public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance) values($1::uuid,$2,301,'Race fixture',$1::text,'product','each',10)",
      [item, free],
    );
    await downgrade.query("BEGIN");
    await actor(downgrade, 4);
    await command(
      downgrade,
      "activate_plan",
      { plan: "free", cafe_ids: [301], reason: "Race downgrade" },
      free,
    );
    await writer.query("BEGIN");
    await actor(writer, 5);
    const pending = command(
      writer,
      "movement",
      {
        item_id: item,
        type: "receipt",
        quantity: "1",
        reason: "Must be denied after downgrade",
      },
      free,
    );
    // Attach a rejection handler before yielding; the command must wait on the account lock.
    const outcome = pending.then(
      () => ({ ok: true, error: "" }),
      (e) => ({ ok: false, error: String(e.message) }),
    );
    await downgrade.query("select pg_sleep(0.05)");
    await downgrade.query("COMMIT");
    const result = await outcome;
    assert.equal(result.ok, false);
    assert.match(result.error, /Paid/);
    await writer.query("ROLLBACK");
    assert.equal(
      (
        await operator.query(
          "select balance from public.partner_items where id=$1",
          [item],
        )
      ).rows[0].balance,
      "10.000000",
    );
  } finally {
    await writer.query("ROLLBACK");
    await downgrade.query("ROLLBACK");
    await operator.query(
      "update public.partner_accounts set plan='free' where chain_id=$1",
      [free],
    );
    await operator.query("delete from public.partner_items where id=$1", [
      item,
    ]);
    await Promise.all([operator.end(), downgrade.end(), writer.end()]);
  }
});

test("internal staff-created partner cafes are attached to the same access and retention rules", () =>
  transaction(async (c) => {
    await actor(c, 4);
    const added = (
      await c.query(
        "insert into public.\"Cafe\"(chain_id,name) values($1,'Staff-created') returning id",
        [A],
      )
    ).rows[0];
    await actor(c, 1);
    const visible = (await snapshot(c, "overview")).cafes;
    assert.ok(
      visible.some((x: { id: number }) => String(x.id) === String(added.id)),
    );
    await actor(c, 4);
    await denied(
      c,
      () => c.query('delete from public."Cafe" where id=$1', [added.id]),
      /Archive partner/,
    );
  }));

test("staff provision a new chain Owner without granting an internal staff role", () =>
  transaction(async (c) => {
    const owner = randomUUID();
    await c.query("insert into auth.users(id,email) values($1,$2)", [
      owner,
      `${owner}@example.test`,
    ]);
    await actor(c, 4);
    const result = await command(c, "provision", {
      chain_id: "",
      name: "New partner",
      owner_id: owner,
    });
    assert.ok(result.chain_id);
    await c.query("RESET ROLE");
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: owner, role: "authenticated" }),
    ]);
    await c.query("SET LOCAL ROLE authenticated");
    const info = await snapshot(c, "overview");
    assert.equal(info.name, "New partner");
    assert.equal(info.role, "owner");
    assert.equal(
      (
        await c.query('select * from public."AdminUser" where user_id=$1', [
          owner,
        ])
      ).rowCount,
      0,
    );
  }));
