import { Client } from "pg";
export const TEST_DATABASE =
  "postgresql://postgres:coffee-local-test-only@127.0.0.1:55432/postgres";
export async function db(
  database: "postgres" | "partner_replay" = process.env.PARTNER_TEST_REPLAY ===
  "1"
    ? "partner_replay"
    : "postgres",
) {
  const client = new Client({
    connectionString: TEST_DATABASE.replace(/\/postgres$/, "/" + database),
  });
  await client.connect();
  return client;
}
