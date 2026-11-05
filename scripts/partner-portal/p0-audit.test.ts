import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeAudit } from "./p0-audit";

function fixture() {
  return {
    report_version: 1,
    captured_at: "2026-10-26T04:00:00Z",
    server_version: "17.11",
    transaction_read_only: "on",
    inspection_role: { name: "operator", superuser: false, bypass_rls: true },
    migrations: [{ version: "20261001000000", name: "baseline" }],
    tables: [
      {
        schema_name: "public",
        table_name: "Cafe",
        relation_kind: "r",
        rls_enabled: true,
      },
    ],
    functions: ["add_reward_stamp", "redeem_reward", "log_staff_login"].map(
      (name) => ({ schema_name: "public", name }),
    ),
    data_checks: { cafes: 0 },
  };
}

test("refuses an audit taken outside a read-only transaction", () => {
  assert.throws(() =>
    summarizeAudit({ ...fixture(), transaction_read_only: "off" }, []),
  );
});

test("does not mistake RLS-filtered zero counts for an empty environment", () => {
  assert.throws(
    () =>
      summarizeAudit(
        {
          ...fixture(),
          inspection_role: {
            name: "restricted",
            superuser: false,
            bypass_rls: false,
          },
        },
        [],
      ),
    /RLS-filtered/,
  );
});

test("reports missing, unexpected, and renamed migrations separately", () => {
  const audit = fixture();
  audit.migrations.push({ version: "20261009000000", name: "remote_only" });
  const result = summarizeAudit(audit, [
    { version: "20261001000000", name: "local_baseline" },
    { version: "20261025000200", name: "wire_reward_actions" },
  ]);
  assert.deepEqual(result.missingMigrations, [
    { version: "20261025000200", name: "wire_reward_actions" },
  ]);
  assert.deepEqual(result.unexpectedMigrations, [
    { version: "20261009000000", name: "remote_only" },
  ]);
  assert.deepEqual(result.renamedMigrations, [
    { version: "20261001000000", local: "local_baseline", remote: "baseline" },
  ]);
});

test("accepts CLI results and detects absent public RPCs even if another schema has the name", () => {
  const audit = fixture();
  audit.functions[0].schema_name = "graphql_public";
  const result = summarizeAudit({ rows: [{ partner_portal_p0: audit }] }, []);
  assert.deepEqual(result.missingFunctions, ["add_reward_stamp"]);
});

test("requires complete evidence rather than defaulting missing metadata to success", () => {
  const { migrations, ...incomplete } = fixture();
  assert.ok(migrations);
  assert.throws(() => summarizeAudit(incomplete, []));
  assert.throws(() => summarizeAudit({ rows: [] }, []));
});

test("rejects duplicate migration versions", () => {
  const audit = fixture();
  audit.migrations.push(audit.migrations[0]);
  assert.throws(() => summarizeAudit(audit, []), /Duplicate migration/);
});

test("flags missing RLS without returning unrelated audit contents", () => {
  const audit = { ...fixture(), secret: "must not be copied" };
  audit.tables[0].rls_enabled = false;
  const result = summarizeAudit(audit, []);
  assert.deepEqual(result.publicTablesWithoutRls, ["Cafe"]);
  assert.equal("secret" in result, false);
  assert.deepEqual(result.dataChecks, { cafes: 0 });
});

test("does not misclassify a view as a table with missing RLS", () => {
  const audit = fixture();
  audit.tables.push({
    schema_name: "public",
    table_name: "PublicCafe",
    relation_kind: "v",
    rls_enabled: false,
  });
  assert.deepEqual(summarizeAudit(audit, []).publicTablesWithoutRls, []);
});
