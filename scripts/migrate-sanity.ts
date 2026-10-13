/**
 * Sanity.io to Supabase Migration Script
 *
 * Migrates Authors, Categories, Posts, PostCategories, and OnboardingQuestions
 * from Sanity dataset (production or dev) into Supabase PostgreSQL.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-sanity.ts [--dataset=production|dev] [--dry-run] [--include-drafts] [--skip-images]
 *
 * Examples:
 *   pnpm tsx scripts/migrate-sanity.ts --dry-run
 *   pnpm tsx scripts/migrate-sanity.ts --dataset=dev --dry-run
 *   pnpm tsx scripts/migrate-sanity.ts --dataset=production
 */

import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

// Load .env.local if present
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Ignored
  }
} else if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignored
  }
}

// ----------------------------------------------------
// Configuration & Arguments
// ----------------------------------------------------
const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.some((a) => a === flag || a.startsWith(`${flag}=`));
const getArg = (flag: string, defaultValue: string) => {
  const match = args.find((a) => a.startsWith(`${flag}=`));
  return match ? match.split("=")[1] : defaultValue;
};

const DATASET = getArg("--dataset", "production");
const IS_DRY_RUN = hasFlag("--dry-run");
const INCLUDE_DRAFTS = hasFlag("--include-drafts");
const SKIP_IMAGES = hasFlag("--skip-images");

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID || "xkkg995c";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required in environment.");
  process.exit(1);
}

const sanity = createSanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: DATASET,
  useCdn: false,
  apiVersion: "2024-01-01",
});

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper to validate or format UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idMap = new Map<string, string>();

function ensureUuid(rawId: string): string {
  // Strip Sanity drafts prefix if any
  const cleanId = rawId.replace(/^drafts\./, "");
  if (UUID_REGEX.test(cleanId)) {
    return cleanId;
  }
  if (!idMap.has(cleanId)) {
    const generated = randomUUID();
    idMap.set(cleanId, generated);
    console.warn(`⚠️ Non-UUID Sanity ID "${rawId}" mapped to UUID "${generated}"`);
  }
  return idMap.get(cleanId)!;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Convert Sanity image reference (e.g. image-hash-1200x415-png) to public CDN URL
function sanityAssetRefToCdnUrl(ref?: string): string | null {
  if (!ref || typeof ref !== "string") return null;
  const match = ref.match(/^image-([a-f0-9]+)-([0-9]+x[0-9]+)-([a-z0-9]+)$/);
  if (!match) return null;
  const [, hash, dimensions, format] = match;
  return `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${DATASET}/${hash}-${dimensions}.${format}`;
}

// Upload image from URL to Supabase media bucket
async function uploadToMediaBucket(sourceUrl: string, storagePath: string): Promise<string> {
  if (SKIP_IMAGES || IS_DRY_RUN) return sourceUrl;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`⚠️ Failed to download image from ${sourceUrl}: HTTP ${res.status}`);
      return sourceUrl;
    }
    const rawContentType = res.headers.get("content-type") || "image/jpeg";
    const contentType = rawContentType.split(";")[0].trim().toLowerCase();
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from("media")
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.warn(`⚠️ Failed to upload image to bucket (${storagePath}): ${error.message}`);
      return sourceUrl;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err: any) {
    console.warn(`⚠️ Image migration failed for ${sourceUrl}: ${err.message}`);
    return sourceUrl;
  }
}

// Process Portable Text block to rewrite inline image refs
async function processPortableText(blocks: any[], postId: string): Promise<any[]> {
  if (!Array.isArray(blocks)) return blocks;

  const processed = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = { ...blocks[i] };
    if (block._type === "image" && block.asset?._ref) {
      const cdnUrl = sanityAssetRefToCdnUrl(block.asset._ref);
      if (cdnUrl) {
        const destPath = `posts/inline-${postId}-${i}.png`;
        const uploadedUrl = await uploadToMediaBucket(cdnUrl, destPath);
        block.asset = {
          ...block.asset,
          url: uploadedUrl,
          migrated_from: cdnUrl,
        };
      }
    }
    processed.push(block);
  }
  return processed;
}

// ----------------------------------------------------
// Main Migration Routine
// ----------------------------------------------------
async function runMigration() {
  console.log("==================================================");
  console.log(`🚀 Starting Sanity -> Supabase Migration`);
  console.log(`   Dataset:        ${DATASET}`);
  console.log(`   Dry Run:        ${IS_DRY_RUN ? "YES (No writes)" : "NO (Live writes)"}`);
  console.log(`   Include Drafts: ${INCLUDE_DRAFTS ? "YES" : "NO"}`);
  console.log(`   Skip Images:    ${SKIP_IMAGES ? "YES" : "NO"}`);
  console.log(`   Supabase URL:   ${SUPABASE_URL}`);
  console.log("==================================================\n");

  // 1. Fetch Authors
  console.log("📥 Fetching authors from Sanity...");
  const rawAuthors = await sanity.fetch<any[]>(`*[_type == "author"]`);
  console.log(`   Found ${rawAuthors.length} authors.`);

  // 2. Fetch Categories
  console.log("📥 Fetching categories from Sanity...");
  const rawCategories = await sanity.fetch<any[]>(`*[_type == "category"]`);
  console.log(`   Found ${rawCategories.length} categories.`);

  // 3. Fetch Posts
  console.log("📥 Fetching posts from Sanity...");
  const draftFilter = INCLUDE_DRAFTS ? "" : " && !(_id in path('drafts.**'))";
  const rawPosts = await sanity.fetch<any[]>(`*[_type == "post"${draftFilter}]`);
  console.log(`   Found ${rawPosts.length} posts.`);

  // 4. Fetch Onboarding Questions
  console.log("📥 Fetching questions from Sanity...");
  const rawQuestions = await sanity.fetch<any[]>(`*[_type == "question"]`);
  console.log(`   Found ${rawQuestions.length} questions.\n`);

  if (IS_DRY_RUN) {
    console.log("🔍 [DRY RUN] Inspection Summary:");
    console.log("--------------------------------------------------");
    console.log(`Authors to import:    ${rawAuthors.length}`);
    rawAuthors.forEach((a) => console.log(`  - [${a._id}] ${a.name}`));

    console.log(`\nCategories to import: ${rawCategories.length}`);
    rawCategories.forEach((c) => console.log(`  - [${c._id}] ${c.title}`));

    console.log(`\nPosts to import:      ${rawPosts.length}`);
    rawPosts.forEach((p) => {
      const isDraft = p._id.startsWith("drafts.") || !p.publishedAt;
      console.log(`  - [${p._id}] ${p.title} (${isDraft ? "Draft" : `Published: ${p.publishedAt}`})`);
    });

    console.log(`\nQuestions to import:  ${rawQuestions.length}`);
    rawQuestions.forEach((q) =>
      console.log(`  - [${q._id}] #${q.priority ?? 0} ${q.question} (${(q.options || []).length} options)`)
    );

    // Check for orphan bookmarks
    console.log("\n🔎 Checking for orphan bookmarks in Supabase...");
    try {
      const { data: bookmarks } = await supabase.from("Bookmark").select("post_id");
      if (bookmarks && bookmarks.length > 0) {
        const postIds = new Set(rawPosts.map((p) => ensureUuid(p._id)));
        const orphans = bookmarks.filter((b) => !postIds.has(b.post_id));
        if (orphans.length > 0) {
          console.warn(`⚠️ Warning: Found ${orphans.length} bookmarks pointing to unknown posts:`);
          orphans.forEach((o) => console.warn(`   Bookmark post_id: ${o.post_id}`));
        } else {
          console.log(`   ✅ All ${bookmarks.length} existing bookmarks map to valid posts!`);
        }
      } else {
        console.log("   (No bookmarks found in database)");
      }
    } catch (e: any) {
      console.warn(`   Could not query Bookmark table: ${e.message}`);
    }

    console.log("\n✨ Dry run complete. Run without --dry-run to apply changes.");
    return;
  }

  // ----------------------------------------------------
  // WRITE OPERATIONS
  // ----------------------------------------------------

  // 1. Authors
  console.log("⏳ Migrating Authors...");
  let authorsImported = 0;
  for (const a of rawAuthors) {
    const id = ensureUuid(a._id);
    let imageUrl = null;
    if (a.image?.asset?._ref) {
      const cdnUrl = sanityAssetRefToCdnUrl(a.image.asset._ref);
      if (cdnUrl) {
        imageUrl = await uploadToMediaBucket(cdnUrl, `authors/${id}.png`);
      }
    }

    const payload = {
      id,
      sanity_id: a._id,
      name: a.name || "Unknown Author",
      slug: a.slug?.current || slugify(a.name || id),
      image_url: imageUrl,
      bio: a.bio || null,
      created_at: a._createdAt || new Date().toISOString(),
      updated_at: a._updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase.from("Author").upsert(payload, { onConflict: "sanity_id" });
    if (error) {
      console.error(`❌ Failed to upsert author ${a.name}:`, error.message);
    } else {
      authorsImported++;
    }
  }
  console.log(`✅ ${authorsImported}/${rawAuthors.length} Authors imported.`);

  // 2. Categories
  console.log("⏳ Migrating Categories...");
  let categoriesImported = 0;
  for (const c of rawCategories) {
    const id = ensureUuid(c._id);
    const payload = {
      id,
      sanity_id: c._id,
      title: c.title || "Untitled Category",
      description: c.description || null,
      created_at: c._createdAt || new Date().toISOString(),
      updated_at: c._updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase.from("Category").upsert(payload, { onConflict: "sanity_id" });
    if (error) {
      console.error(`❌ Failed to upsert category ${c.title}:`, error.message);
    } else {
      categoriesImported++;
    }
  }
  console.log(`✅ ${categoriesImported}/${rawCategories.length} Categories imported.`);

  // 3. Posts & PostCategories
  console.log("⏳ Migrating Posts...");
  let postsImported = 0;
  let postCategoriesImported = 0;

  for (const p of rawPosts) {
    const id = ensureUuid(p._id);
    let mainImageUrl = null;
    if (p.mainImage?.asset?._ref) {
      const cdnUrl = sanityAssetRefToCdnUrl(p.mainImage.asset._ref);
      if (cdnUrl) {
        mainImageUrl = await uploadToMediaBucket(cdnUrl, `posts/${id}.png`);
      }
    }

    const processedBody = await processPortableText(p.body, id);

    let publishedAt: string | null = null;
    if (p.publishedAt) {
      publishedAt = new Date(p.publishedAt).toISOString();
    } else if (!p._id.startsWith("drafts.")) {
      publishedAt = p._createdAt ? new Date(p._createdAt).toISOString() : new Date().toISOString();
    }

    const authorId = p.author?._ref ? ensureUuid(p.author._ref) : null;

    const postPayload = {
      id,
      sanity_id: p._id,
      title: p.title || "Untitled Post",
      slug: p.slug?.current || slugify(p.title || id),
      author_id: authorId,
      main_image_url: mainImageUrl,
      summary: p.summary || null,
      body: processedBody ? (typeof processedBody === "string" ? processedBody : JSON.stringify(processedBody)) : null,
      published_at: publishedAt,
      created_at: p._createdAt || new Date().toISOString(),
      updated_at: p._updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase.from("Post").upsert(postPayload, { onConflict: "sanity_id" });
    if (error) {
      console.error(`❌ Failed to upsert post ${p.title}:`, error.message);
      continue;
    }
    postsImported++;

    // Join categories
    if (Array.isArray(p.categories) && p.categories.length > 0) {
      await supabase.from("PostCategory").delete().eq("post_id", id);
      const categoryRows = p.categories
        .filter((cat: any) => cat?._ref)
        .map((cat: any) => ({
          post_id: id,
          category_id: ensureUuid(cat._ref),
        }));

      if (categoryRows.length > 0) {
        const { error: catErr } = await supabase.from("PostCategory").insert(categoryRows);
        if (catErr) {
          console.warn(`⚠️ PostCategory insert error for post ${id}:`, catErr.message);
        } else {
          postCategoriesImported += categoryRows.length;
        }
      }
    }
  }
  console.log(`✅ ${postsImported}/${rawPosts.length} Posts imported.`);
  console.log(`✅ ${postCategoriesImported} PostCategory relations established.`);

  // 4. Onboarding Questions
  console.log("⏳ Migrating Onboarding Questions...");
  let questionsImported = 0;
  for (const q of rawQuestions) {
    const id = ensureUuid(q._id);
    const payload = {
      id,
      sanity_id: q._id,
      question: q.question || "Untitled Question",
      options: Array.isArray(q.options) ? q.options : [],
      priority: typeof q.priority === "number" ? q.priority : 0,
      multi_select: Boolean(q.multiSelect),
      active: q.active !== undefined ? Boolean(q.active) : true,
      created_at: q._createdAt || new Date().toISOString(),
      updated_at: q._updatedAt || new Date().toISOString(),
    };

    const { error } = await supabase.from("OnboardingQuestion").upsert(payload, { onConflict: "sanity_id" });
    if (error) {
      console.error(`❌ Failed to upsert question ${q.question}:`, error.message);
    } else {
      questionsImported++;
    }
  }
  console.log(`✅ ${questionsImported}/${rawQuestions.length} Onboarding Questions imported.`);

  // 5. Audit Log Record
  console.log("📝 Writing migration audit record...");
  try {
    await supabase.from("AdminAuditLog").insert({
      action: "migration.sanity_import",
      table_name: "Post",
      record_id: DATASET,
      reason: `Sanity import from dataset "${DATASET}": ${authorsImported} authors, ${categoriesImported} categories, ${postsImported} posts, ${questionsImported} questions.`,
      new_data: {
        dataset: DATASET,
        authors_count: authorsImported,
        categories_count: categoriesImported,
        posts_count: postsImported,
        questions_count: questionsImported,
        mapped_ids_count: idMap.size,
      },
    });
  } catch (err: any) {
    console.warn("⚠️ Could not write audit log entry:", err.message);
  }

  console.log("\n🎉 Sanity migration completed successfully!");
}

runMigration().catch((err) => {
  console.error("💥 Unhandled migration error:", err);
  process.exit(1);
});
