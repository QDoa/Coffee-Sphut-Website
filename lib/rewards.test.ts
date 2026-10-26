import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { addRewardTransaction } from "@/app/vendor_reward/server";
import {
  redeemRewardRequest,
  rewardAvailable,
} from "@/app/redeem_reward/server";

const ID = "aa9546aa-c36a-4ef2-bc71-eb660d44f43e";

interface RecordedRequest {
  method: string;
  pathname: string;
  body: unknown;
}

function fixture(t: TestContext, response: unknown = ID, status = 200): RecordedRequest[] {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://rewards-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  });

  const requests: RecordedRequest[] = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      method: request.method,
      pathname: new URL(request.url).pathname,
      body: request.method === "POST" ? await request.json() : null,
    });
    return Response.json(response, { status });
  });
  return requests;
}

function cafeForm(code = " cafe-code "): FormData {
  const form = new FormData();
  form.set("cafeCode", code);
  return form;
}

test("stamp action calls the database stamp RPC and confirms its transaction", async (t) => {
  const requests = fixture(t);
  assert.deepEqual(await addRewardTransaction(cafeForm(), ID), { data: ID, error: null });
  assert.deepEqual(requests, [{
    method: "POST",
    pathname: "/rest/v1/rpc/add_reward_stamp",
    body: { p_user_id: ID, p_cafe_code: "cafe-code" },
  }]);
});

test("redemption action calls the database redemption RPC", async (t) => {
  const requests = fixture(t);
  assert.deepEqual(await redeemRewardRequest(cafeForm(), ID), { data: ID, error: null });
  assert.deepEqual(requests, [{
    method: "POST",
    pathname: "/rest/v1/rpc/redeem_reward",
    body: { p_reward_id: ID, p_cafe_code: "cafe-code" },
  }]);
});

test("neither action reports success without a database confirmation", async (t) => {
  fixture(t, null);
  for (const action of [addRewardTransaction, redeemRewardRequest]) {
    const result = await action(cafeForm(), ID);
    assert.equal(result.data, null);
    assert.match(result.error ?? "", /did not confirm/);
  }
});

test("both actions surface a failed database operation", async (t) => {
  fixture(t, { message: "Invalid cafe code", code: "22023" }, 400);
  for (const action of [addRewardTransaction, redeemRewardRequest]) {
    assert.deepEqual(await action(cafeForm(), ID), {
      data: null,
      error: "That café code wasn’t recognised. Please check it with the café team.",
    });
  }
});

test("missing migrations do not silently fall back to an unprotected table write", async (t) => {
  const requests = fixture(t, { message: "Function was not found", code: "PGRST202" }, 404);
  for (const action of [addRewardTransaction, redeemRewardRequest]) {
    assert.equal((await action(cafeForm(), ID)).error,
      "Rewards are temporarily unavailable. Please contact Coffee Sphut support.");
  }
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.pathname.startsWith("/rest/v1/rpc/")));
});

test("incomplete QR links and missing cafe codes do not make database requests", async (t) => {
  const requests = fixture(t);
  for (const action of [addRewardTransaction, redeemRewardRequest]) {
    assert.ok((await action(cafeForm(), "")).error);
    assert.ok((await action(cafeForm(" "), ID)).error);
    assert.ok((await action(new FormData(), ID)).error);
  }
  assert.equal(await rewardAvailable(""), false);
  assert.equal(requests.length, 0);
});

test("availability accepts an issued reward", async (t) => {
  fixture(t, { status: "issued" });
  assert.equal(await rewardAvailable(ID), true);
});

test("availability rejects a consumed reward", async (t) => {
  fixture(t, { status: "redeemed" });
  assert.equal(await rewardAvailable(ID), false);
});

test("availability distinguishes a database failure from an unavailable reward", async (t) => {
  fixture(t, { message: "Permission denied", code: "42501" }, 403);
  await assert.rejects(rewardAvailable(ID), /Unable to check/);
});

test("invalid API keys report service unavailability rather than an incorrect cafe code", async (t) => {
  fixture(t, { message: "Invalid API key" }, 401);
  for (const action of [addRewardTransaction, redeemRewardRequest]) {
    const result = await action(cafeForm(), ID);
    assert.equal(result.data, null);
    assert.equal(result.error, "Rewards are temporarily unavailable. Please contact Coffee Sphut support.");
  }
});

test("redemption explains when a reward is already consumed or belongs to another chain", async (t) => {
  fixture(t, { message: "Reward is unavailable at this cafe", code: "22023" }, 400);
  const result = await redeemRewardRequest(cafeForm(), ID);
  assert.equal(result.data, null);
  assert.match(result.error ?? "", /already have been redeemed or belong to a different café chain/);
});

test("a zero cafe threshold reports a configuration problem rather than an incorrect code", async (t) => {
  fixture(t, { message: "Cafe 31 must have a positive loyalty threshold", code: "22023" }, 400);
  assert.equal((await addRewardTransaction(cafeForm(), ID)).error,
    "This café’s rewards aren’t configured yet. Please ask the café team for help.");
});
