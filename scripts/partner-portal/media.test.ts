import assert from "node:assert/strict";
import { test, before } from "node:test";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { db } from "./database";
import {
  uploadManagedImage,
  publishReviewedMedia,
} from "../../lib/partner/media";
import { removeUnusedCafeUploads } from "../../lib/admin/cafe-images";
import type { Database, Json } from "../../types/database";
const A = "20000000-0000-4000-8000-000000000001",
  B = "20000000-0000-4000-8000-000000000002";
const uid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = "http://127.0.0.1:55434";
function client(n?: number, failCopy?: () => boolean) {
  const secret = "coffee-partner-local-jwt-secret-at-least-32-characters";
  const head = [
    { alg: "HS256", typ: "JWT" },
    {
      role: n ? "authenticated" : "anon",
      sub: n ? uid(n) : undefined,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
    .join(".");
  const token =
    head + "." + createHmac("sha256", secret).update(head).digest("base64url");
  return createClient<Database>(base, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: async (input, init) => {
        const request = new Request(input, init);
        if (
          request.method === "POST" &&
          new URL(request.url).pathname.startsWith(
            "/storage/v1/object/media/",
          ) &&
          failCopy?.()
        )
          return Response.json(
            { message: "Injected copy failure", statusCode: "503" },
            { status: 503 },
          );
        return fetch(request);
      },
    },
  });
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1kAAAAASUVORK5CYII=",
  "base64",
);
const file = () => new File([png], "cafe.png", { type: "image/png" });
before(async () => {
  const c = await db();
  try {
    await c.query(
      `insert into public."Cafe"(id,chain_id,name,is_active,show_details) values(90101,$1,'Media integration cafe',true,false) on conflict(id) do nothing`,
      [A],
    );
    await c.query(
      "update public.partner_changes set status='rejected',reason='Reset synthetic media test' where cafe_id=90101 and status='pending'",
    );
  } finally {
    await c.end();
  }
});
async function command(
  n: number,
  action: string,
  input: Record<string, unknown>,
  request_id = randomUUID(),
) {
  const result = await client(n).rpc("partner_command", {
    p_action: action,
    p_input: { chain_id: A, request_id, ...input } as Json,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as { id: string };
}
async function asset(id: string) {
  const c = await db();
  try {
    return (
      await c.query("select * from public.partner_media where id=$1", [id])
    ).rows[0];
  } finally {
    await c.end();
  }
}
async function snapshot() {
  const s = await client(1).rpc("partner_snapshot", {
    p_section: "cafe",
    p_input: { id: 90101 },
  });
  if (s.error) throw new Error(s.error.message);
  return (
    s.data as unknown as {
      cafe: { partner_revision: number; image_url: string; address: string };
    }
  ).cafe;
}

test("real Storage keeps uploads private, immutable and scoped to current cafe access", async () => {
  const owner = client(1);
  const id = await uploadManagedImage(owner, A, 90101, file());
  const m = await asset(id);
  assert.equal(
    (await fetch(`${base}/storage/v1/object/public/partner-drafts/${m.path}`))
      .ok,
    false,
  );
  assert.ok(
    (await owner.from("partner_media").update({ state: "ready" }).eq("id", id))
      .error,
  );
  assert.ok(
    (
      await owner.rpc("partner_command_core", {
        p_action: "save_change",
        p_input: {
          chain_id: A,
          request_id: randomUUID(),
          payload: { name: "Bypass" },
        },
      })
    ).error,
  );
  assert.equal(
    (await owner.storage.from("partner-drafts").download(m.path)).error,
    null,
  );
  assert.ok(
    (await client().storage.from("partner-drafts").download(m.path)).error,
  );
  assert.ok(
    (await client(3).storage.from("partner-drafts").download(m.path)).error,
  );
  assert.ok(
    (
      await owner.storage
        .from("partner-drafts")
        .upload(m.path, png, { contentType: "image/png", upsert: true })
    ).error,
  );
  assert.ok(
    (await owner.storage.from("partner-drafts").remove([m.path])).error ||
      (await owner.storage.from("partner-drafts").exists(m.path)).data,
  );
  await assert.rejects(
    () => uploadManagedImage(client(2), A, 90102, file()),
    /access/,
  );
  await assert.rejects(
    () => uploadManagedImage(client(1), B, 201, file()),
    /access/,
  );
  await assert.rejects(
    () =>
      command(3, "save_change", {
        chain_id: B,
        cafe_id: 201,
        payload: { name: "attack" },
        media: { cover: id, gallery: [] },
      }),
    /unavailable/,
  );
  const sql = await db();
  try {
    await sql.query(
      "update public.partner_memberships set revoked_at=now() where user_id=$1",
      [uid(1)],
    );
    assert.ok(
      (await owner.storage.from("partner-drafts").download(m.path)).error,
    );
    assert.ok(
      (await owner.from("partner_media").select("id").eq("id", id)).data
        ?.length === 0,
    );
  } finally {
    await sql.query(
      "update public.partner_memberships set revoked_at=null where user_id=$1",
      [uid(1)],
    );
    await sql.end();
  }
});

test("publication copy failure leaves live listing intact; retry publishes all images once", async () => {
  const cover = await uploadManagedImage(client(1), A, 90101, file());
  const gallery = await uploadManagedImage(client(1), A, 90101, file());
  const before = await snapshot();
  const change = await command(1, "submit_change", {
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: {
      name: "North Star Downtown",
      address: before.address,
      image_url: before.image_url,
      gallery: [],
    },
    media: { cover, gallery: [gallery] },
  });
  const a = await asset(cover),
    b = await asset(gallery);
  assert.ok(
    (await client().storage.from("media").download(a.public_path)).error,
  );
  const input = {
    id: change.id,
    chain_id: A,
    decision: "approve",
    request_id: randomUUID(),
    media_origin: base,
  };
  await assert.rejects(() => command(4, "review", input), /Prepare reviewed/);
  let copies = 0;
  await assert.rejects(
    () =>
      publishReviewedMedia(
        client(4, () => ++copies === 2),
        input,
      ),
    /paused/,
  );
  assert.equal((await snapshot()).image_url, before.image_url);
  const c = await db();
  try {
    assert.equal(
      (
        await c.query("select status from public.partner_changes where id=$1", [
          change.id,
        ])
      ).rows[0].status,
      "pending",
    );
  } finally {
    await c.end();
  }
  await publishReviewedMedia(client(4), input);
  await command(4, "review", input, input.request_id);
  assert.equal(
    (await snapshot()).image_url,
    `${base}/storage/v1/object/public/media/${a.public_path}`,
  );
  assert.equal(
    (await client().storage.from("media").download(b.public_path)).error,
    null,
  );
  await publishReviewedMedia(client(4), input);
  await command(4, "review", input, input.request_id);
  const c2 = await db();
  try {
    assert.equal(
      (
        await c2.query(
          "select count(*) from storage.objects where bucket_id='media' and name=any($1)",
          [[a.public_path, b.public_path]],
        )
      ).rows[0].count,
      "2",
    );
  } finally {
    await c2.end();
  }
});

test("draft references protect staged files; cleanup remains admin-only and cannot delete shared live files", async () => {
  const id = await uploadManagedImage(client(1), A, 90101, file());
  const m = await asset(id);
  const before = await snapshot();
  const draft = await command(1, "save_change", {
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: { name: "Draft protection" },
    media: { cover: id, gallery: [] },
  });
  assert.match(
    (await client(4).rpc("partner_media_cleanup", { p_id: id })).error!.message,
    /referenced/,
  );
  assert.ok((await client(1).rpc("partner_media_cleanup", { p_id: id })).error);
  await command(1, "save_change", {
    id: draft.id,
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: { name: "Draft detached" },
    media: { cover: null, gallery: [] },
  });
  assert.equal(
    (await client(4).rpc("partner_media_cleanup", { p_id: id })).error,
    null,
  );
  assert.ok(
    (await client(1).storage.from("partner-drafts").download(m.path)).error,
  );
  await assert.rejects(
    () =>
      command(1, "save_change", {
        cafe_id: 90101,
        baseline: before.partner_revision,
        payload: { name: "reattach" },
        media: { cover: id, gallery: [] },
      }),
    /unavailable/,
  );
  assert.equal(
    (await client(4).storage.from("partner-drafts").remove([m.path])).error,
    null,
  );
  assert.equal(
    (
      await client(4).rpc("partner_media_cleanup", {
        p_id: id,
        p_result: "deleted",
      })
    ).error,
    null,
  );
  const live = await asset((await dbAssetForPublic(before.image_url))!);
  await removeUnusedCafeUploads(client(4), [before.image_url], base);
  assert.equal(
    (await client().storage.from("media").download(live.public_path)).error,
    null,
  );
});
async function dbAssetForPublic(url: string) {
  const c = await db();
  try {
    return (
      await c.query(
        "select id from public.partner_media where public_path=$1",
        [url.split("/public/media/")[1]],
      )
    ).rows[0]?.id as string;
  } finally {
    await c.end();
  }
}

test("a stale prepared image request cannot overwrite a newer staff edit", async () => {
  const id = await uploadManagedImage(client(1), A, 90101, file());
  const before = await snapshot();
  const change = await command(1, "submit_change", {
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: { name: "Media stale request", image_url: before.image_url },
    media: { cover: id, gallery: [] },
  });
  const input = {
    id: change.id,
    chain_id: A,
    decision: "approve",
    request_id: randomUUID(),
    media_origin: base,
  };
  await publishReviewedMedia(client(4), input);
  const c = await db();
  try {
    await c.query('update public."Cafe" set address=$1 where id=90101', [
      "Newer staff edit",
    ]);
    await assert.rejects(
      () => command(4, "review", input, input.request_id),
      /Conflict/,
    );
    assert.equal((await snapshot()).image_url, before.image_url);
    const pending = (
      await c.query(
        "select status,payload from public.partner_changes where id=$1",
        [change.id],
      )
    ).rows[0];
    assert.equal(pending.status, "pending");
    assert.equal(pending.payload.image_url, before.image_url);
  } finally {
    await c.end();
  }
  await command(4, "review", {
    id: change.id,
    decision: "reject",
    reason: "Resubmit on latest cafe revision",
  });
});

test("cleanup errors remain retryable and obsolete published uploads can be removed only through Storage", async () => {
  const id = await uploadManagedImage(client(1), A, 90101, file());
  const m = await asset(id);
  // Simulate a copy left by an interrupted approval. No live or draft reference.
  assert.equal(
    (
      await client(4)
        .storage.from("media")
        .upload(m.public_path, png, { contentType: "image/png" })
    ).error,
    null,
  );
  assert.equal(
    (await client(4).rpc("partner_media_cleanup", { p_id: id })).error,
    null,
  );
  assert.equal(
    (
      await client(4).rpc("partner_media_cleanup", {
        p_id: id,
        p_result: "Injected Storage failure",
      })
    ).error,
    null,
  );
  assert.equal((await asset(id)).cleanup_error, "Injected Storage failure");
  const url = `${base}/storage/v1/object/public/media/${m.public_path}`;
  await removeUnusedCafeUploads(client(4), [url], base);
  await removeUnusedCafeUploads(client(4), [url], base);
  assert.ok(
    (await client().storage.from("media").download(m.public_path)).error,
  );
  assert.equal(
    (await client(4).storage.from("partner-drafts").remove([m.path])).error,
    null,
  );
  assert.equal(
    (
      await client(4).rpc("partner_media_cleanup", {
        p_id: id,
        p_result: "deleted",
      })
    ).error,
    null,
  );
  assert.equal((await asset(id)).state, "deleted");
});

test("encoded managed URLs cannot bypass draft protection or reattach after cleanup is claimed", async () => {
  const id = await uploadManagedImage(client(1), A, 90101, file());
  const m = await asset(id);
  assert.equal(
    (
      await client(4)
        .storage.from("media")
        .upload(m.public_path, png, { contentType: "image/png" })
    ).error,
    null,
  );
  const url = `${base}/storage/v1/object/public/media/${m.public_path.replace(
    id,
    id.replace(/^./, (char) => "%" + char.charCodeAt(0).toString(16)),
  )}?download=1`;
  const before = await snapshot();
  const draft = await command(1, "save_change", {
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: { name: "Encoded draft URL", image_url: url },
    media: { cover: null, gallery: [] },
  });
  assert.match(
    (await client(4).rpc("partner_media_cleanup", { p_id: id })).error!.message,
    /referenced/,
  );
  await command(1, "save_change", {
    id: draft.id,
    cafe_id: 90101,
    baseline: before.partner_revision,
    payload: { name: "Detached URL", image_url: null },
    media: { cover: null, gallery: [] },
  });
  assert.equal(
    (await client(4).rpc("partner_media_cleanup", { p_id: id })).error,
    null,
  );
  await assert.rejects(
    () =>
      command(1, "save_change", {
        cafe_id: 90101,
        baseline: before.partner_revision,
        payload: { name: "Too late", image_url: url },
      }),
    /being removed/,
  );
});
