import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { db } from "./database";
async function main() {
  const c = await db(
    process.argv[2] === "replay" ? "partner_replay" : "postgres",
  );
  try {
    await c.query(`CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage; CREATE SCHEMA IF NOT EXISTS extensions; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role; CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
 CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
 CREATE TABLE IF NOT EXISTS storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE IF NOT EXISTS storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
    for (const name of readdirSync("supabase/migrations")
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      console.log("Applying", name);
      await c.query(readFileSync("supabase/migrations/" + name, "utf8"));
    }
    await c.query(
      readFileSync("scripts/partner-portal/seed-local.sql", "utf8"),
    );
    const secret = "coffee-partner-local-jwt-secret-at-least-32-characters";
    const jwt = (sub?: string) => {
      const data = [
        { alg: "HS256", typ: "JWT" },
        {
          role: sub ? "authenticated" : "anon",
          sub,
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      ]
        .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
        .join(".");
      return (
        data +
        "." +
        createHmac("sha256", secret).update(data).digest("base64url")
      );
    };
    writeFileSync(
      ".partner-portal/preview.env",
      `PARTNER_LOCAL_PREVIEW=1\nSUPABASE_URL=http://127.0.0.1:55434\nSUPABASE_ANON_KEY=${jwt()}\nPARTNER_PREVIEW_JWT=${jwt("10000000-0000-4000-8000-000000000001")}\nPARTNER_REVIEW_JWT=${jwt("10000000-0000-4000-8000-000000000004")}\n`,
    );
    console.log("Local data seeded. Start PostgREST and pnpm partner:preview.");
  } finally {
    await c.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
