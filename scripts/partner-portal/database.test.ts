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
        () =>
          command(c, "submit_change", { ...target, payload: { amenities } }),
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

test("only the submitter can discard a draft or withdraw a pending café removal", () =>
  transaction(async (c) => {
    const discard = async (id: string, status: string): Promise<boolean> =>
      (
        await c.query("select public.partner_discard_cafe_change($1,$2) as removed", [
          id,
          status,
        ])
      ).rows[0].removed;

    await actor(c, 1);
    const draft = await command(c, "save_change", {
      payload: { name: "Disposable draft" },
    });
    const ordinary = await command(c, "submit_change", {
      payload: { name: "New café under review" },
    });
    const { cafe } = await snapshot(c, "cafe", { id: 101 });
    const target = {
      cafe_id: 101,
      baseline: cafe.partner_revision,
      payload: { is_active: false },
    };
    const removal = await command(c, "submit_change", target);
    await actor(c, 2);
    assert.equal(await discard(removal.id, "pending"), false);
    await actor(c, 4);
    await c.query("select * from public.partner_media_prepare($1)", [removal.id]);
    assert.equal(await discard(removal.id, "pending"), false);
    await actor(c, 1);
    assert.equal(await discard(ordinary.id, "pending"), false);
    assert.equal(await discard(removal.id, "draft"), false);
    assert.equal(await discard(draft.id, "draft"), true);
    assert.equal(await discard(draft.id, "draft"), false);
    assert.equal(await discard(removal.id, "pending"), true);
    assert.equal((await snapshot(c, "cafe", { id: 101 })).cafe.is_active, true);
    assert.equal(
      (await snapshot(c, "cafes")).changes.some(
        (change: { id: string }) => change.id === removal.id || change.id === draft.id,
      ),
      false,
    );

    const replacement = await command(c, "submit_change", target);
    await actor(c, 4);
    await denied(
      c,
      () => command(c, "review", { id: removal.id, decision: "approve" }),
      /pending request/,
    );
    await command(c, "review", { id: replacement.id, decision: "approve" });
    await actor(c, 1);
    assert.equal(await discard(replacement.id, "pending"), false);
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

test("stocktake uses scoped exact balances and saves a batch atomically with safe retries", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const add = (cafe_id: number) => command(c, "item", {
      cafe_id, name: "Stocktake fixture", code: randomUUID(), type: "ingredient", unit: "g",
    });
    const first = (await add(101)).id;
    const second = (await add(101)).id;
    const foreign = (await add(102)).id;
    const opening = (item_id: string, quantity: string) => command(c, "movement", {
      item_id, type: "opening", quantity, reason: "Stocktake test",
    });
    await opening(first, "10");
    await opening(second, "999999999999.999999");
    const request = randomUUID();
    const counts = [
      { item_id: first, expected: "10.000000", quantity: "0" },
      { item_id: second, expected: "999999999999.999999", quantity: "999999999999.999998" },
    ];
    const take = (cafe: number, entries = counts, id = request, chain = A) =>
      c.query("select public.partner_save_stocktake($1,$2,$3,$4,$5) as saved",
        [chain, cafe, id, JSON.stringify(entries), "Closing count"]);
    const ledger = () => c.query(
      "select item_id, quantity, resulting_balance from public.partner_movements where type='count' and item_id=any($1) order by item_id",
      [[first, second]],
    );
    await actor(c, 2);
    const items = (await c.query("select public.partner_stocktake_items($1) as items", [A])).rows[0].items;
    assert.ok(items.every((item: { cafe_id: number }) => item.cafe_id === 101));
    assert.equal(items.find((item: { id: string }) => item.id === second).balance, "999999999999.999999");
    await denied(c, () => take(102, [{ item_id: foreign, expected: "0", quantity: "1" }]), /Paid access/);
    await denied(c, () => take(101, [counts[0], { item_id: foreign, expected: "0", quantity: "1" }]), /became unavailable/);
    await denied(c, () => take(101, [counts[0], counts[0]]), /one valid/);
    await opening(first, "1");
    await denied(c, () => take(101), /balance changed/);
    assert.equal((await ledger()).rowCount, 0);
    assert.equal((await c.query("select balance from public.partner_items where id=$1", [second])).rows[0].balance,
      "999999999999.999999");

    counts[0].expected = "11.000000";
    assert.equal((await take(101)).rows[0].saved, 2);
    assert.equal((await take(101)).rows[0].saved, 2);
    const { rows } = await ledger();
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.item_id === first).resulting_balance, "0.000000");
    assert.equal(rows.find((row) => row.item_id === second).quantity, "-0.000001");
    await denied(c, () => take(101, [{ ...counts[0], quantity: "1" }]), /reused with different data/);
    await denied(c, () => take(101, counts, request, B), /Paid access/);

    await c.query("RESET ROLE");
    await c.query("update public.partner_accounts set plan='free' where chain_id=$1", [A]);
    await actor(c, 2);
    await denied(c, () => take(101), /Paid access/);
    assert.deepEqual((await c.query("select public.partner_stocktake_items($1) as items", [A])).rows[0].items, []);
    await c.query("SET LOCAL ROLE anon");
    await denied(c, () => take(101), /permission denied/);
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

test("recipe stock checks match codes and units at an authorized café", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const beansId = "40000000-0000-4000-8000-000000000001";
    const milkId = "40000000-0000-4000-8000-000000000002";
    const recipe = await command(c, "recipe", {
      name: "Stock check recipe",
      yield: 1,
      ingredients: [
        { item_id: beansId, quantity: 18, unit: "g" },
        { item_id: milkId, quantity: 200, unit: "ml" },
      ],
    });
    const riversideBeans = await command(c, "item", {
      cafe_id: 102,
      name: "Riverside espresso",
      code: "BEANS",
      type: "ingredient",
      unit: "g",
    });
    await command(c, "movement", {
      item_id: riversideBeans.id,
      type: "receipt",
      quantity: "37.5",
      reason: "Stock check fixture",
    });
    await command(c, "item", {
      cafe_id: 102,
      name: "Milk weighed in grams",
      code: "MILK",
      type: "ingredient",
      unit: "g",
    });

    async function checkStock(cafeId: number) {
      const result = await c.query(
        "select public.partner_recipe_stock($1,$2) as stock",
        [recipe.id, cafeId],
      );
      return result.rows[0].stock as {
        ingredient_id: string;
        stock_item_id: string | null;
        available: number | null;
      }[];
    }
    const riverside = await checkStock(102);
    assert.deepEqual(
      riverside.find((row) => row.ingredient_id === beansId),
      {
        ingredient_id: beansId,
        stock_item_id: riversideBeans.id,
        available: 37.5,
      },
    );
    assert.deepEqual(
      riverside.find((row) => row.ingredient_id === milkId),
      {
        ingredient_id: milkId,
        stock_item_id: null,
        available: null,
      },
    );
    await actor(c, 2);
    assert.equal(
      (await checkStock(101)).find((row) => row.ingredient_id === beansId)
        ?.stock_item_id,
      beansId,
    );
    await denied(c, () => checkStock(102), /Café access required/);
    await actor(c, 4);
    await command(c, "activate_plan", {
      plan: "free",
      cafe_ids: [101, 102],
      reason: "Verify stock check after downgrade",
    });
    await actor(c, 1);
    await denied(c, () => checkStock(101), /Paid recipe access required/);
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

test("request lookup and queue results respect current partner and staff scope", () =>
  transaction(async (c) => {
    const drafts = (await c.query(
      `insert into public.partner_changes(chain_id,cafe_id,submitter,payload,status)
       values($1,101,$3,'{"name":"Queue scope assigned"}','draft'),
             ($1,102,$3,'{"name":"Queue scope unassigned"}','draft'),
             ($2,201,$4,'{"name":"Queue scope other tenant"}','draft')
       returning id`,
      [A, B, uid(1), uid(3)],
    )).rows;
    const lookup = async (id: string, chain: string) =>
      (await c.query("select public.partner_cafe_request($1,$2) as result", [id, chain])).rows[0].result;
    const queue = async (staff: boolean, page = 1) =>
      (await c.query("select public.partner_request_queue($1,'Queue scope','all',$2) as result", [staff, page])).rows[0].result;

    await actor(c, 1);
    assert.equal((await lookup(drafts[0].id, A)).id, drafts[0].id);
    assert.equal(await lookup(drafts[2].id, B), null);
    assert.equal((await queue(false, 999)).request_page, 1);
    assert.equal((await queue(false)).request_total, 2);
    await denied(c, () => queue(true), /Staff required/);

    await c.query("RESET ROLE");
    await c.query('insert into public."AdminUser"(user_id,role) values($1,\'editor\')', [uid(2)]);
    await actor(c, 2);
    assert.equal(await lookup(drafts[1].id, A), null);
    assert.equal((await queue(false)).request_total, 1);
    assert.equal((await queue(true)).request_total, 0);
  }));

test("review notifications are scoped to the submitter and have idempotent read receipts", () =>
  transaction(async (c) => {
    const [approved, rejected, pending] = [randomUUID(), randomUUID(), randomUUID()];
    await c.query(
      `insert into public.partner_changes(id,chain_id,cafe_id,submitter,payload,status,reviewer,reviewed_at)
       values($1,$4,101,$5,'{}','approved',$6,now()),
             ($2,$4,null,$5,'{"name":"Rejected café"}','rejected',$6,now()),
             ($3,$4,null,$5,'{"name":"Pending café"}','pending',null,null)`,
      [approved, rejected, pending, A, uid(1), uid(4)],
    );
    const updates = async (page = 1) =>
      (await c.query("select public.partner_review_notifications($1) as result", [page])).rows[0].result;
    const mark = (id: string) => c.query("select public.partner_mark_review_notification_read($1)", [id]);
    await actor(c, 2);
    assert.equal((await updates()).total, 0);
    await denied(c, () => mark(approved), /row-level security/);
    await actor(c, 4);
    assert.equal((await updates()).total, 0);
    await denied(c, () => mark(approved), /row-level security/);

    await actor(c, 1);
    const initial = await updates();
    assert.deepEqual(new Set(initial.updates.map((row: { id: string }) => row.id)), new Set([approved, rejected]));
    assert.equal(initial.unread, 2);
    assert.deepEqual((await updates(0)).updates, []);
    await denied(c, () => mark(pending), /row-level security/);
    await mark(approved);
    await mark(approved);
    assert.equal((await updates()).unread, 1);
    assert.equal((await updates()).updates.find((row: { id: string }) => row.id === approved).read, true);
    await c.query("RESET ROLE");
    await c.query("update public.partner_cafe_access set restricted=true where cafe_id=101");
    await actor(c, 1);
    assert.deepEqual((await updates()).updates.map((row: { id: string }) => row.id), [rejected]);
  }));

test("a staff Free downgrade requires explicit confirmation to remove all café access", () =>
  transaction(async (c) => {
    await actor(c, 4);
    const input = { plan: "free", reason: "Pilot downgrade test" };
    await denied(c, () => command(c, "activate_plan", input), /confirm.*no café access/);
    await denied(
      c,
      () => c.query("select partner_internal.partner_command('activate_plan','{}'::jsonb)"),
      /permission denied/,
    );
    await denied(
      c,
      () => command(c, "activate_plan", { ...input, cafe_ids: [], confirm_empty_free: "true" }),
      /confirm.*no café access/,
    );
    const choices = (await c.query("select public.partner_plan_cafes($1) as result", [A])).rows[0].result;
    assert.ok(choices.some((cafe: { id: number; name: string }) => cafe.id === 101 && cafe.name));

    await actor(c, 1);
    assert.equal((await snapshot(c, "overview")).plan, "paid");
    assert.deepEqual(
      (await c.query("select public.partner_plan_cafes($1) as result", [A])).rows[0].result,
      [],
    );
    await actor(c, 4);
    await command(c, "activate_plan", { ...input, cafe_ids: [], confirm_empty_free: true });
    await actor(c, 1);
    const result = await snapshot(c, "overview");
    assert.equal(result.plan, "free");
    assert.deepEqual(result.cafes, []);
    assert.equal(result.selection_required, false);
  }));

test("invitation acceptance is bound to email, role, cafe scope and single active membership", () =>
  transaction(async (c) => {
    await actor(c, 1);
    const invite = {
      request_id: randomUUID(),
      email: "reviewer@example.test",
      role: "cafe_manager",
      cafe_ids: [101],
    };
    const invitation = await command(c, "invite", invite);
    const retried = await command(c, "invite", invite);
    assert.ok(retried.token === invitation.token);
    await denied(
      c,
      () => command(c, "invite", { ...invite, email: "different@example.test" }),
      /Request ID was reused/,
    );
    await denied(c, () => c.query("select partner_internal.invitation_receipt_key()"), /permission denied/);
    await denied(c, () => c.query("select decrypted_secret from vault.decrypted_secrets"), /permission denied/);
    await actor(c, 3);
    await denied(
      c,
      () => command(c, "accept_invite", { token: invitation.token }),
      /unavailable/,
    );
    await actor(c, 4);
    const acceptance = { request_id: randomUUID(), token: invitation.token };
    await command(c, "accept_invite", acceptance);
    assert.deepEqual(await command(c, "accept_invite", acceptance), {});
    await denied(
      c,
      () => command(c, "accept_invite", { ...acceptance, token: "different" }),
      /Request ID was reused/,
    );
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

    await c.query("RESET ROLE");
    const { rows } = await c.query(
      "select action,input,result from public.partner_operations where request_id=any($1::uuid[])",
      [[invite.request_id, acceptance.request_id]],
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => !JSON.stringify(row).includes(invitation.token)));
    assert.match(rows.find((row) => row.action === "invite")?.result.token_ciphertext, /^[0-9a-f]+$/);
    assert.match(rows.find((row) => row.action === "accept_invite")?.input.token.sha256, /^[0-9a-f]{64}$/);
  }));

test("only Owners can edit a manager in place and concurrent edits preserve current access", () =>
  transaction(async (c) => {
    const member = "30000000-0000-4000-8000-000000000002";
    const owner = "30000000-0000-4000-8000-000000000001";
    const edit = (id: string, priorRole: string, prior: number[], role: string, cafes: number[]) =>
      c.query("select public.partner_edit_manager_access($1,$2,$3,$4,$5)", [
        id, priorRole, prior, role, cafes,
      ]);
    const assignments = async () =>
      (await c.query("select public.partner_team_assignments($1) as result", [A])).rows[0].result;
    const assignRiverside = () => edit(member, "cafe_manager", [101], "cafe_manager", [102]);

    for (const actorId of [2, 3, 4]) {
      await actor(c, actorId);
      await denied(c, assignRiverside, /Only the workspace Owner/);
      assert.deepEqual(await assignments(), {});
    }
    await actor(c, 1);
    assert.deepEqual((await assignments())[member], [101]);
    await denied(c, () => edit(owner, "owner", [], "chain_manager", []), /no longer available/);
    await denied(c, () => edit(member, "cafe_manager", [101], "owner", []), /Choose Chain Manager/);
    await denied(c, () => edit(member, "cafe_manager", [101], "cafe_manager", []), /at least one/);
    await denied(c, () => edit(member, "cafe_manager", [101], "cafe_manager", [201]), /unavailable/);
    await assignRiverside();
    await assignRiverside(); // An identical retry does not write another audit entry.
    await denied(c, () => edit(member, "cafe_manager", [101], "chain_manager", []), /access changed/);
    assert.deepEqual((await assignments())[member], [102]);
    await actor(c, 2);
    await denied(c, () => snapshot(c, "cafe", { id: 101 }), /access denied/);
    assert.equal((await snapshot(c, "cafe", { id: 102 })).cafe.id, 102);

    await c.query("RESET ROLE");
    await c.query("update public.partner_cafe_access set restricted=true where cafe_id=102");
    await actor(c, 1);
    await edit(member, "cafe_manager", [102], "cafe_manager", [101, 102]);
    assert.deepEqual((await assignments())[member], [101, 102]);
    await denied(
      c,
      () => edit(member, "cafe_manager", [101, 102], "cafe_manager", [102]),
      /at least one available café/,
    );
    await edit(member, "cafe_manager", [101, 102], "chain_manager", []);
    assert.equal((await assignments())[member], undefined);
    const { rows } = await c.query(
      "select id, role, revoked_at from public.partner_memberships where id=$1",
      [member],
    );
    assert.deepEqual(rows, [{ id: member, role: "chain_manager", revoked_at: null }]);
    const audit = await c.query(
      "select 1 from public.partner_audit where action='edit_manager_access' and target=$1",
      [member],
    );
    assert.equal(audit.rowCount, 3);
    await command(c, "revoke_member", { id: member });
    await denied(c, () => edit(member, "chain_manager", [], "cafe_manager", [101]), /no longer available/);
  }));

test("reward capture attributes redemption to B even when earned at A; reports use explicit status", () =>
  transaction(async (c) => {
    const id = randomUUID();
    await c.query("update public.partner_accounts set reward_coverage_at=now()-interval '1 minute' where chain_id=$1", [A]);
    await c.query(
      'insert into public."Rewards"(id,user_id,chain_id,earned_store) values($1,$2,$3,101)',
      [id, uid(1), A],
    );
    await actor(c, 1);
    await c.query("select public.redeem_reward($1,$2)", [id, "local-only-102"]);
    const report = await snapshot(c, "rewards", { cafe_id: 102 });
    assert.equal(report.total, 1);
    assert.deepEqual(report.reward_cafe_totals, [{ cafe_id: 102, cafe_name: "North Star • Riverside", total: 1 }]);
    assert.equal(report.reward_trend.length, 30);
    assert.equal(report.reward_trend[0].tracked, false);
    assert.equal(report.reward_trend.at(-1).total, 1);
    assert.equal(report.reward_trend.at(-1).tracked, true);
    const wide = await snapshot(c, "rewards", { from: "2020-01-01", cafe_id: 102, offset: 50 });
    assert.ok(wide.reward_trend.length <= 30);
    assert.deepEqual(wide.reward_cafe_totals, report.reward_cafe_totals);
    assert.equal(wide.reward_trend.reduce((total: number, bucket: { total: number }) => total + bucket.total, 0), 1);
    assert.deepEqual(wide.events, []);
    const exported = await snapshot(c, "rewards", { cafe_id: 102, export: "csv", offset: 50 });
    assert.equal(exported.total, report.total);
    assert.equal(exported.events[0].id, id);
    assert.match(exported.events[0].occurred_local, /^\d{4}-\d{2}-\d{2} /);
    assert.match(exported.events[0].occurred_utc, /Z$/);
    const week = await snapshot(c, "rewards", { range: "week" });
    const insights = (await c.query("select public.partner_insights() as result")).rows[0].result;
    assert.equal(week.total, insights.weekly_rewards.at(-1).total);
    assert.ok(week.reward_from <= week.reward_to);
    assert.match((await snapshot(c, "rewards", { from: "2026-12-02", to: "2026-12-01" })).reward_error, /end date/);
    assert.ok(
      report.events.every((x: { cafe_id: number }) => x.cafe_id === 102),
    );
    await denied(
      c,
      () =>
        c.query("select public.redeem_reward($1,$2)", [id, "local-only-102"]),
      /unavailable/,
    );
    await actor(c, 2);
    assert.deepEqual((await snapshot(c, "rewards", { cafe_id: 102, export: "csv" })).events, []);
    const limited = await snapshot(c, "rewards");
    assert.deepEqual(limited.reward_cafe_totals, []);
    assert.ok(limited.reward_trend.every((bucket: { total: number }) => bucket.total === 0));
  }));

test("oversized reward exports keep the report total and return no partial CSV rows", () =>
  transaction(async (c) => {
    await c.query("update public.partner_accounts set reward_coverage_at=now()-interval '1 minute' where chain_id=$1", [A]);
    await actor(c, 1);
    const initial = await snapshot(c, "rewards", { cafe_id: 102, export: "csv" });
    const limit = initial.reward_export_limit;
    assert.equal(limit, 10_000);
    await c.query("RESET ROLE");
    await c.query(
      `insert into public."Rewards"(id,user_id,chain_id,earned_store,redeemed_cafe_id,status,redeemed_at)
       select gen_random_uuid(),$1,$2,101,102,'redeemed',now()
       from generate_series(1,$3::integer)`,
      [uid(1), A, limit + 1],
    );
    await actor(c, 1);
    const report = await snapshot(c, "rewards", { cafe_id: 102 });
    const exported = await snapshot(c, "rewards", { cafe_id: 102, export: "csv" });
    assert.equal(report.events.length, 50);
    assert.equal(exported.total, initial.total + limit + 1);
    assert.equal(exported.total, report.total);
    assert.deepEqual(exported.events, []);
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

test("nearby search excludes archived cafés before taking the nearest matches", () =>
  transaction(async (c) => {
    const chain = (await c.query("insert into public.\"Chains\"(name) values ('Nearby pilot fixture') returning id")).rows[0].id;
    await c.query(
      `insert into public."Cafe"(chain_id,name,is_active,latitude,longitude,reward_code,amenities)
       values ($1,'Pilotretail archived',false,47.01,-53.01,$2,array['wifi']),
              ($1,'Pilotretail open',true,47.0101,-53.0101,$3,array['wifi']),
              ($1,'Pilotretail other',true,47.0102,-53.0102,null,array['work_station'])`,
      [chain, randomUUID(), randomUUID()],
    );
    await c.query("SET LOCAL ROLE anon");
    const { result } = (await c.query(
      "select public.get_closest_cafes_v2(47.01,-53.01,'Pilotretail',1,true,array['wifi']) as result",
    )).rows[0];
    assert.deepEqual(result.map((cafe: { name: string }) => cafe.name), ["Pilotretail open"]);
    assert.equal(result[0].has_reward, true);
    assert.equal("reward_code" in result[0], false);
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
