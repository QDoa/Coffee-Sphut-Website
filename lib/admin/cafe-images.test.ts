import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getStoredCafeImage,
  removedCafeImageUrls,
  removeUnusedCafeUploads,
} from "./cafe-images";

const PROJECT = "https://coffee-test.supabase.co";
const IMAGE = `${PROJECT}/storage/v1/object/public/media/cafes/gallery/coffee%20cup.jpg`;
const PATH = "cafes/gallery/coffee cup.jpg";

interface FixtureOptions {
  covers?: { image_url: string | null }[];
  galleries?: { images_url: string[] | null }[];
  failRead?: boolean;
  failDelete?: boolean;
  noDeletedRows?: boolean;
  missing?: boolean;
  maxRows?: number;
}

function fixture(options: FixtureOptions = {}) {
  const requests: { method: string; pathname: string; body: string | null }[] =
    [];
  const supabase = createClient<Database>(PROJECT, "unit-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        requests.push({
          method: request.method,
          pathname: url.pathname,
          body: request.method === "DELETE" ? await request.text() : null,
        });
        if (url.pathname.startsWith("/rest/v1/")) {
          assert.equal(
            request.method,
            "GET",
            "Application rows are only read by cleanup",
          );
          if (options.failRead)
            return Response.json({ message: "read failed" }, { status: 500 });
          const rows = url.pathname.endsWith("/Cafe")
            ? (options.covers ?? [])
            : (options.galleries ?? []);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Math.min(
            Number(url.searchParams.get("limit") ?? 1000),
            options.maxRows ?? 1000,
          );
          return Response.json(rows.slice(offset, offset + limit));
        }
        if (request.method === "HEAD")
          return new Response(null, { status: options.missing ? 404 : 200 });
        assert.equal(url.pathname, "/storage/v1/object/media");
        assert.equal(request.method, "DELETE");
        if (options.failDelete)
          return Response.json(
            { message: "Permission denied", statusCode: "403" },
            { status: 403 },
          );
        return Response.json(options.noDeletedRows ? [] : [{ name: PATH }]);
      },
    },
  });
  return { supabase, requests };
}

test("maps public café upload URLs to bucket keys, decoding the key once", () => {
  assert.deepEqual(getStoredCafeImage(IMAGE, PROJECT), {
    bucket: "media",
    path: PATH,
  });
  assert.equal(
    getStoredCafeImage(IMAGE.replace("%20", "%2520"), PROJECT)?.path,
    "cafes/gallery/coffee%20cup.jpg",
  );
});

test("does not delete external, other-project, non-café, signed, or malformed paths", () => {
  for (const url of [
    IMAGE.replace(PROJECT, "https://other.supabase.co"),
    IMAGE.replace("/media/cafes/", "/media/posts/"),
    IMAGE.replace("/media/", "/avatars/"),
    IMAGE.replace("/public/", "/sign/"),
    `${PROJECT}/storage/v1/object/public/media/cafes/%2E%2E%2Fposts/test.jpg`,
    `${PROJECT}/storage/v1/object/public/media/cafes/bad%00.jpg`,
    "not a URL",
  ])
    assert.equal(getStoredCafeImage(url, PROJECT), null);
});

test("retains cover/gallery promotions and deduplicates removal candidates", () => {
  assert.deepEqual(removedCafeImageUrls([IMAGE, IMAGE, "other"], IMAGE, []), [
    "other",
  ]);
  assert.deepEqual(removedCafeImageUrls([IMAGE], null, [IMAGE]), []);
});

test("deletes through the Storage API with a bucket-relative path", async () => {
  const { supabase, requests } = fixture();
  await removeUnusedCafeUploads(supabase, [IMAGE, IMAGE], PROJECT);
  const deletions = requests.filter((request) => request.method === "DELETE");
  assert.deepEqual(deletions, [
    {
      method: "DELETE",
      pathname: "/storage/v1/object/media",
      body: JSON.stringify({ prefixes: [PATH] }),
    },
  ]);
});

test("keeps images referenced by any café, including alternate URL encodings", async () => {
  for (const options of [
    { covers: [{ image_url: `${IMAGE}?width=400` }] },
    { galleries: [{ images_url: [IMAGE.replace("%20", " ")] }] },
    {
      covers: [
        ...Array.from({ length: 1000 }, () => ({ image_url: null })),
        { image_url: IMAGE },
      ],
    },
    {
      galleries: [
        ...Array.from({ length: 1000 }, () => ({ images_url: null })),
        { images_url: [IMAGE] },
      ],
    },
  ]) {
    const { supabase, requests } = fixture(options);
    await removeUnusedCafeUploads(supabase, [IMAGE], PROJECT);
    assert.equal(
      requests.some((request) => request.method === "DELETE"),
      false,
    );
  }
});

test("keeps files when reference lookup fails", async () => {
  const { supabase, requests } = fixture({ failRead: true });
  await assert.rejects(
    removeUnusedCafeUploads(supabase, [IMAGE], PROJECT),
    /file was kept/,
  );
  assert.equal(
    requests.some((request) => request.method === "DELETE"),
    false,
  );
});

test("does not skip references when the API caps pages below the requested size", async () => {
  const { supabase, requests } = fixture({
    maxRows: 1,
    galleries: [{ images_url: null }, { images_url: [IMAGE] }],
  });
  await removeUnusedCafeUploads(supabase, [IMAGE], PROJECT);
  assert.equal(
    requests.some((request) => request.method === "DELETE"),
    false,
  );
});

test("surfaces Storage API permission failures", async () => {
  const { supabase } = fixture({ failDelete: true });
  await assert.rejects(
    removeUnusedCafeUploads(supabase, [IMAGE], PROJECT),
    /Permission denied/,
  );
});

test("does not report success for a silent no-op when the file still exists", async () => {
  const { supabase } = fixture({ noDeletedRows: true });
  await assert.rejects(
    removeUnusedCafeUploads(supabase, [IMAGE], PROJECT),
    /did not confirm deletion/,
  );
});

test("allows retry after an earlier removal already deleted the file", async () => {
  const { supabase } = fixture({ noDeletedRows: true, missing: true });
  await removeUnusedCafeUploads(supabase, [IMAGE], PROJECT);
});

test("ignores linked external images without making API requests", async () => {
  const { supabase, requests } = fixture();
  await removeUnusedCafeUploads(
    supabase,
    ["https://example.com/cup.jpg"],
    PROJECT,
  );
  assert.equal(requests.length, 0);
});
