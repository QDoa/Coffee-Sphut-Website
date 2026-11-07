import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Database } from "../../types/database";

interface FieldCoverage {
  handling:
    | "reviewed business field"
    | "lifecycle review"
    | "staff-managed transfer"
    | "staff managed"
    | "system managed";
  currentAdmin: string;
  notes: string;
}

type CafeTables = "Cafe" | "CafeImages" | "CafeMenu";
type Coverage = {
  [Table in CafeTables]: Record<
    keyof Database["public"]["Tables"][Table]["Row"],
    FieldCoverage
  >;
};

const business = (
  currentAdmin: string,
  notes = "Publish only after staff approval.",
): FieldCoverage => ({
  handling: "reviewed business field",
  currentAdmin,
  notes,
});
const system = (notes: string): FieldCoverage => ({
  handling: "system managed",
  currentAdmin: "Not editable",
  notes,
});

// Exhaustive against generated database Row types: schema regeneration must not
// silently leave a cafe business field outside the review implementation.
const coverage = {
  Cafe: {
    partner_revision: system(
      "Optimistic revision; incremented by all live cafe, gallery and menu writes.",
    ),
    id: system(
      "Stable identity; never supplied as a replacement by a partner.",
    ),
    created_at: system("Database timestamp; retained in history."),
    name: business("Saved"),
    image_url: business(
      "Saved",
      "Cover image; coordinate staged assets, approval, and reference-safe cleanup.",
    ),
    address: business("Saved"),
    time_open: business(
      "Saved; invalid JSON silently becomes null",
      "Validate hours and show an inline error; agree canonical shape with mobile parsing.",
    ),
    longitude: business(
      "Saved",
      "Validate range and coordinate pair; derive location through the existing trigger.",
    ),
    latitude: business(
      "Saved",
      "Validate range and coordinate pair; derive location through the existing trigger.",
    ),
    link: business("Saved"),
    description: business(
      "Saved",
      "Preserve compatible rich text and validate rendered content.",
    ),
    phone_number: business("Saved"),
    email: business("Saved"),
    social_media: business(
      "No form control or save mapping",
      "Missing from current admin editor; include explicitly in partner validation and review.",
    ),
    amenities: business(
      "Saved as comma-separated IDs",
      "Partners select from the mobile amenity catalog. Unchanged selections preserve legacy values.",
    ),
    rating: {
      handling: "staff managed",
      currentAdmin: "Saved",
      notes: "Partner requests preserve the saved rating.",
    },
    is_active: {
      handling: "lifecycle review",
      currentAdmin: "Saved; nullable in schema",
      notes:
        "False means archived; approval removes discovery but retains authorized history. Slot consumed only on approved activation. Flag legacy nulls for review; subscription locks remain separate.",
    },
    chain_id: {
      handling: "staff-managed transfer",
      currentAdmin: "Staff can select any chain",
      notes:
        "Partners request a staff-managed transfer; ordinary edits cannot reassign tenants. Preserve historical ownership and validate target access/limits.",
    },
    loyalty_threshold_override: business(
      "Saved",
      "Positive integer or null; reward-sensitive changes still require review.",
    ),
    reward_code: business(
      "Saved",
      "Private operational secret; unique nonblank code; never include in public directory responses.",
    ),
    show_details: business(
      "Saved",
      "Mobile display flag; distinct from archival and subscription restriction.",
    ),
    location: system(
      "Derived from coordinates by sync_cafe_location; not a second independent location input.",
    ),
    fts_vectors: system(
      "Database-generated search vector; recomputed from approved text.",
    ),
    postcode: business("Saved"),
  },
  CafeImages: {
    cafe_id: system(
      "Derived from the authorized parent cafe; immutable identity/ownership link.",
    ),
    created_at: system("Database timestamp."),
    images_url: business(
      "Gallery upsert after cafe save",
      "Review ordered gallery changes with the parent. Existing save is not one transaction; new approval must be atomic for DB associations.",
    ),
  },
  CafeMenu: {
    id: system("Stable menu record identity; assigned on approved creation."),
    created_at: system("Database timestamp."),
    cafe_id: system(
      "Derived from the authorized parent cafe; cannot move a menu item across tenants.",
    ),
    name: business("Add only; no edit UI"),
    description: business("Action accepts it; current add form omits it"),
    price: business(
      "Add only; UI labels cents",
      "Integer minor units; confirm nonnegative values and currency rules without changing historical prices.",
    ),
    currency: business(
      "Action accepts it; UI defaults to CAD",
      "Explicit validated currency; preserve existing record values.",
    ),
  },
} satisfies Coverage;

const escapeCell = (value: string): string =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ");
const sections = Object.entries(coverage).map(([table, fields]) => {
  const rows = Object.entries(fields).map(
    ([name, field]) =>
      `| \`${name}\` | ${field.handling} | ${escapeCell(field.currentAdmin)} | ${escapeCell(field.notes)} |`,
  );
  return `## ${table}\n\n| Field | Partner handling | Current admin coverage | Implementation note |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
});
const markdown = `# Café field coverage\n\nGenerated by \`pnpm exec tsx scripts/partner-portal/cafe-field-coverage.ts --write\`.\n\nExhaustive against \`types/database.ts\` for Cafe, CafeImages, and CafeMenu. System identity, timestamps, and generated values are accounted for separately from editable business fields. Transfers are staff-managed; archival and history follow [confirmed P0 decisions](decisions.md). This inventory does not grant permissions.\n\n${sections.join("\n\n")}\n`;
const output = fileURLToPath(
  new URL("../../docs/partner-portal/cafe-field-coverage.md", import.meta.url),
);
const args = process.argv.slice(2);
if (args.length !== 1 || !["--check", "--write"].includes(args[0])) {
  throw new Error(
    "Use --check to verify the field inventory, or --write to regenerate it.",
  );
}
if (args[0] === "--write") {
  writeFileSync(output, markdown);
  console.log("Updated docs/partner-portal/cafe-field-coverage.md");
} else if (readFileSync(output, "utf8") !== markdown) {
  throw new Error(
    "Cafe field coverage is out of date. Regenerate it with --write.",
  );
} else {
  console.log("Cafe field coverage is current.");
}
