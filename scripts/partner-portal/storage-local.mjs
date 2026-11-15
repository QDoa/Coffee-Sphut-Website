import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
const docker = (args) =>
  execFileSync("docker", args, { encoding: "utf8" }).trim();
const secret = "coffee-partner-local-jwt-secret-at-least-32-characters";
const jwt = (role) => {
  const body = [
    { alg: "HS256", typ: "JWT" },
    { role, exp: Math.floor(Date.now() / 1000) + 86400 * 7 },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
    .join(".");
  return (
    body + "." + createHmac("sha256", secret).update(body).digest("base64url")
  );
};
const name = "coffee-partner-storage",
  image = "public.ecr.aws/supabase/storage-api:v1.80.2";
const uri =
  "postgresql://postgres:coffee-local-test-only@host.docker.internal:55432/postgres";
const fixture = JSON.parse(docker(["inspect", "coffee-partner-test"]))[0];
const binding = fixture.HostConfig.PortBindings["5432/tcp"]?.[0];
if (
  fixture.Config.Image !== "supabase/postgres:17.11.0.004" ||
  binding?.HostIp !== "127.0.0.1" ||
  binding?.HostPort !== "55432"
)
  throw new Error("Unexpected disposable database configuration.");
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "coffee-partner-test",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: query, encoding: "utf8" },
  ).trim();
if (sql("select to_regclass('public.partner_media') is not null") !== "t")
  throw new Error("Initialize the consolidated partner schema before starting Storage.");
const hasObjects =
  sql("select to_regclass('storage.objects') is not null") === "t";
const shim =
  hasObjects &&
  sql(
    "select exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='metadata')",
  ) === "f";
if (shim) {
  if (sql("select count(*) from storage.objects") !== "0")
    throw new Error("Refusing to replace a nonempty Storage shim.");
  sql(
    "DROP SCHEMA storage CASCADE; CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;",
  );
}
let existing;
try {
  existing = JSON.parse(docker(["inspect", name]))[0];
} catch {}
if (existing) {
  const bind = existing.HostConfig.PortBindings["5000/tcp"]?.[0];
  if (
    existing.Config.Image !== image ||
    !existing.Config.Env.includes("DATABASE_URL=" + uri) ||
    bind?.HostIp !== "127.0.0.1" ||
    bind?.HostPort !== "55435"
  )
    throw new Error("Unexpected Storage fixture configuration.");
  docker(["start", name]);
} else {
  docker([
    "run",
    "--name",
    name,
    "--add-host",
    "host.docker.internal:host-gateway",
    "-p",
    "127.0.0.1:55435:5000",
    ...Object.entries({
      DATABASE_URL: uri,
      AUTH_JWT_SECRET: secret,
      ANON_KEY: jwt("anon"),
      SERVICE_KEY: jwt("service_role"),
      POSTGREST_URL: "http://host.docker.internal:55431",
      STORAGE_BACKEND: "file",
      FILE_STORAGE_BACKEND_PATH: "/var/lib/storage",
      TENANT_ID: "stub",
      REGION: "local",
      GLOBAL_S3_BUCKET: "stub",
      DB_MIGRATIONS_STRATEGY: "on_startup",
      DB_MIGRATIONS_FREEZE_AT: "drop-bucketid-objname-index",
      FILE_SIZE_LIMIT: "10485760",
    }).flatMap(([k, v]) => ["-e", k + "=" + v]),
    "-d",
    image,
  ]);
}
for (let i = 0; i < 30; i++) {
  let ready = false;
  try {
    ready = (await fetch("http://127.0.0.1:55435/status")).ok;
  } catch {}
  if (ready) {
    sql(
      "GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role; GRANT SELECT ON storage.buckets TO anon,authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;",
    );
    if (shim || !hasObjects) {
      sql(
        readFileSync(
          "supabase/migrations/20261011000400_storage_media_bucket.sql",
          "utf8",
        ),
      );
      const migration = readFileSync(
        "supabase/migrations/20261110060852_partner_portal.sql",
        "utf8",
      );
      const begin = migration.indexOf("-- Begin partner draft storage setup");
      const end = migration.indexOf("-- End partner draft storage setup");
      if (begin < 0 || end <= begin)
        throw new Error("The partner draft Storage setup section is missing.");
      sql(migration.slice(begin, end));
    }
    sql("NOTIFY pgrst, 'reload schema';");
    console.log("Synthetic Storage ready on loopback port 55435");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
throw new Error(
  "Storage did not become ready; inspect coffee-partner-storage logs.",
);
