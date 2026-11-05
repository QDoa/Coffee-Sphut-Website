import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const migrationSchema = z.object({
  version: z.string(),
  name: z.string().nullable(),
});
const auditSchema = z.object({
  report_version: z.literal(1),
  captured_at: z.string(),
  server_version: z.string(),
  transaction_read_only: z.literal("on"),
  inspection_role: z.object({
    name: z.string(),
    superuser: z.boolean(),
    bypass_rls: z.boolean(),
  }),
  migrations: z.array(migrationSchema),
  tables: z.array(
    z.object({
      schema_name: z.string(),
      table_name: z.string(),
      relation_kind: z.string(),
      rls_enabled: z.boolean(),
    }),
  ),
  functions: z.array(z.object({ schema_name: z.string(), name: z.string() })),
  data_checks: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export interface Migration {
  version: string;
  name: string;
}

export interface P0Summary {
  capturedAt: string;
  serverVersion: string;
  missingMigrations: Migration[];
  unexpectedMigrations: { version: string; name: string | null }[];
  renamedMigrations: {
    version: string;
    local: string;
    remote: string | null;
  }[];
  missingFunctions: string[];
  publicTablesWithoutRls: string[];
  dataChecks: Record<string, string | number | boolean | null>;
}

export function readLocalMigrations(directory: string): Migration[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const match = /^(\d+)_(.+)\.sql$/.exec(name);
      if (!match) throw new Error(`Unrecognized migration filename: ${name}`);
      return { version: match[1], name: match[2] };
    });
}

export function summarizeAudit(input: unknown, local: Migration[]): P0Summary {
  // Accept the CLI's wrapped result or the extracted report. Neither path runs
  // commands or treats database content as instructions.
  const wrapper = z
    .object({
      rows: z.array(z.object({ partner_portal_p0: z.unknown() })).length(1),
    })
    .safeParse(input);
  const audit = auditSchema.parse(
    wrapper.success ? wrapper.data.rows[0].partner_portal_p0 : input,
  );
  if (!audit.inspection_role.superuser && !audit.inspection_role.bypass_rls) {
    throw new Error(
      "Audit role may see RLS-filtered data. Use an authorized operator role with complete visibility before trusting counts.",
    );
  }
  const remoteByVersion = new Map(
    audit.migrations.map((migration) => [migration.version, migration]),
  );
  const localByVersion = new Map(
    local.map((migration) => [migration.version, migration]),
  );
  if (
    remoteByVersion.size !== audit.migrations.length ||
    localByVersion.size !== local.length
  ) {
    throw new Error("Duplicate migration versions require reconciliation.");
  }
  const names = new Set(
    audit.functions
      .filter((fn) => fn.schema_name === "public")
      .map((fn) => fn.name),
  );
  return {
    capturedAt: audit.captured_at,
    serverVersion: audit.server_version,
    missingMigrations: local.filter(
      (migration) => !remoteByVersion.has(migration.version),
    ),
    unexpectedMigrations: audit.migrations.filter(
      (migration) => !localByVersion.has(migration.version),
    ),
    renamedMigrations: local.flatMap((migration) => {
      const remote = remoteByVersion.get(migration.version);
      return remote && remote.name !== migration.name
        ? [
            {
              version: migration.version,
              local: migration.name,
              remote: remote.name,
            },
          ]
        : [];
    }),
    missingFunctions: [
      "add_reward_stamp",
      "redeem_reward",
      "log_staff_login",
    ].filter((name) => !names.has(name)),
    publicTablesWithoutRls: audit.tables
      .filter(
        (table) =>
          table.schema_name === "public" &&
          ["r", "p"].includes(table.relation_kind) &&
          !table.rls_enabled,
      )
      .map((table) => table.table_name),
    dataChecks: audit.data_checks,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  if (process.argv.length !== 3)
    throw new Error(
      "Usage: pnpm exec tsx scripts/partner-portal/p0-audit.ts <local-audit.json>",
    );
  const local = readLocalMigrations(
    fileURLToPath(new URL("../../supabase/migrations", import.meta.url)),
  );
  const summary = summarizeAudit(
    JSON.parse(readFileSync(process.argv[2], "utf8")),
    local,
  );
  console.log(JSON.stringify(summary, null, 2));
  // A report can be valid while the environment is not ready. Make that visible
  // to operators/CI rather than silently treating pending migrations as a pass.
  if (
    summary.missingMigrations.length ||
    summary.unexpectedMigrations.length ||
    summary.renamedMigrations.length ||
    summary.missingFunctions.length ||
    summary.publicTablesWithoutRls.length
  ) {
    process.exitCode = 1;
  }
}
