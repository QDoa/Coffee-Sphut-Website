import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { gunzipSync } from "node:zlib";
import { addRewardTransaction } from "@/app/vendor_reward/server";
import {
  redeemRewardRequest,
  rewardAvailable,
} from "@/app/redeem_reward/server";
import { captureServerEvent } from "@/lib/posthog-server";

const ID = "aa9546aa-c36a-4ef2-bc71-eb660d44f43e";

interface RecordedRequest {
  method: string;
  pathname: string;
  body: unknown;
}

function fixture(t: TestContext, response: unknown = ID, status = 200): RecordedRequest[] {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const previousPostHogKey = process.env.POSTHOG_API_KEY;
  const previousPublicPostHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  process.env.SUPABASE_URL = "https://rewards-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.POSTHOG_API_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
    if (previousPostHogKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previousPostHogKey;
    if (previousPublicPostHogKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = previousPublicPostHogKey;
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

async function parsePostHogBody(request: Request): Promise<Record<string, unknown>> {
  const bytes = Buffer.from(await request.arrayBuffer());
  const raw =
    request.headers.get("content-encoding") === "gzip"
      ? gunzipSync(bytes).toString("utf8")
      : bytes.toString("utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function extractPostHogEvents(
  payload: Record<string, unknown>,
): Array<Record<string, unknown>> {
  if (Array.isArray(payload.batch)) {
    return payload.batch as Array<Record<string, unknown>>;
  }
  if (Array.isArray(payload.events)) {
    return payload.events as Array<Record<string, unknown>>;
  }
  return [];
}

test("stamp action captures stamp_earned in PostHog with the customer user_id", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const previousPostHogKey = process.env.POSTHOG_API_KEY;
  const previousPostHogHost = process.env.POSTHOG_HOST;
  process.env.SUPABASE_URL = "https://rewards-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.POSTHOG_API_KEY = "phc_test_key";
  process.env.POSTHOG_HOST = "https://us.i.posthog.com";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
    if (previousPostHogKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previousPostHogKey;
    if (previousPostHogHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = previousPostHogHost;
  });

  const posthogPayloads: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "us.i.posthog.com") {
      posthogPayloads.push(await parsePostHogBody(request));
      return Response.json({ results: {} }, { status: 200 });
    }
    return Response.json("txn-uuid-123", { status: 200 });
  });

  assert.deepEqual(await addRewardTransaction(cafeForm("secret-code"), ID), {
    data: "txn-uuid-123",
    error: null,
  });

  assert.equal(posthogPayloads.length, 1);
  const event = extractPostHogEvents(posthogPayloads[0])[0];
  assert.equal(event?.event, "stamp_earned");
  assert.equal(event?.distinct_id, ID);
  const props = event?.properties as Record<string, unknown>;
  assert.equal(props.transaction_id, "txn-uuid-123");
  assert.equal(props.source_screen, "vendor_reward");
  assert.equal(props.platform, "web_server");
  assert.equal(props.is_anonymous, false);
  assert.equal(props.cafe_code, undefined);
});

test("redemption action captures reward_redeemed in PostHog for the reward owner", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const previousPostHogKey = process.env.POSTHOG_API_KEY;
  const previousPostHogHost = process.env.POSTHOG_HOST;
  process.env.SUPABASE_URL = "https://rewards-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.POSTHOG_API_KEY = "phc_test_key";
  process.env.POSTHOG_HOST = "https://us.i.posthog.com";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
    if (previousPostHogKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previousPostHogKey;
    if (previousPostHogHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = previousPostHogHost;
  });

  const customerUserId = "11111111-2222-3333-4444-555555555555";
  const chainId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const posthogPayloads: Array<Record<string, unknown>> = [];

  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "us.i.posthog.com") {
      posthogPayloads.push(await parsePostHogBody(request));
      return Response.json({ results: {} }, { status: 200 });
    }
    if (url.pathname === "/rest/v1/Rewards") {
      return Response.json(
        { user_id: customerUserId, chain_id: chainId, earned_store: 42 },
        { status: 200 },
      );
    }
    return Response.json(ID, { status: 200 });
  });

  assert.deepEqual(await redeemRewardRequest(cafeForm("secret-code"), ID), {
    data: ID,
    error: null,
  });

  assert.equal(posthogPayloads.length, 1);
  const event = extractPostHogEvents(posthogPayloads[0])[0];
  assert.equal(event?.event, "reward_redeemed");
  assert.equal(event?.distinct_id, customerUserId);
  const props = event?.properties as Record<string, unknown>;
  assert.equal(props.reward_id, ID);
  assert.equal(props.chain_id, chainId);
  assert.equal(props.earned_cafe_id, 42);
  assert.equal(props.cafe_id, undefined);
  assert.equal(props.source_screen, "redeem_reward");
  assert.equal(props.platform, "web_server");
  assert.equal(props.is_anonymous, false);
});

test("captureServerEvent strips PII and blocked keys and preserves envelope properties", async (t) => {
  const previousPostHogKey = process.env.POSTHOG_API_KEY;
  const previousPostHogHost = process.env.POSTHOG_HOST;
  process.env.POSTHOG_API_KEY = "phc_test_key";
  process.env.POSTHOG_HOST = "https://us.i.posthog.com";
  t.after(() => {
    if (previousPostHogKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previousPostHogKey;
    if (previousPostHogHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = previousPostHogHost;
  });

  const posthogPayloads: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    posthogPayloads.push(await parsePostHogBody(request));
    return Response.json({ results: {} }, { status: 200 });
  });

  await captureServerEvent({
    distinctId: ID,
    event: "stamp_earned",
    properties: {
      transaction_id: "txn-999",
      email: "user@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
      phone: "+1234567890",
      phone_number: "+1234567890",
      cafe_code: "secret-vendor-code",
      platform: "ios",
      is_anonymous: true,
    },
  });

  assert.equal(posthogPayloads.length, 1);
  const event = extractPostHogEvents(posthogPayloads[0])[0];
  const props = event?.properties as Record<string, unknown>;
  assert.equal(props.transaction_id, "txn-999");
  assert.equal(props.email, undefined);
  assert.equal(props.first_name, undefined);
  assert.equal(props.last_name, undefined);
  assert.equal(props.full_name, undefined);
  assert.equal(props.phone, undefined);
  assert.equal(props.phone_number, undefined);
  assert.equal(props.cafe_code, undefined);
  assert.equal(props.platform, "web_server");
  assert.equal(props.is_anonymous, false);
});

test("PostHog ingestion failures do not break stamp or redemption responses", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  const previousPostHogKey = process.env.POSTHOG_API_KEY;
  process.env.SUPABASE_URL = "https://rewards-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.POSTHOG_API_KEY = "phc_test_key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
    if (previousPostHogKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = previousPostHogKey;
  });

  const loggedErrors: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    loggedErrors.push(args);
  });
  let posthogAttempts = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "us.i.posthog.com") {
      posthogAttempts += 1;
      throw new Error("PostHog unreachable");
    }
    if (url.pathname === "/rest/v1/Rewards") {
      return Response.json({ user_id: ID, chain_id: null, earned_store: null }, { status: 200 });
    }
    return Response.json(ID, { status: 200 });
  });

  assert.deepEqual(await addRewardTransaction(cafeForm(), ID), { data: ID, error: null });
  assert.deepEqual(await redeemRewardRequest(cafeForm(), ID), { data: ID, error: null });
  assert.equal(posthogAttempts, 4);
  assert.ok(loggedErrors.some((args) => args[0] === "PostHog server capture failed"));
});
