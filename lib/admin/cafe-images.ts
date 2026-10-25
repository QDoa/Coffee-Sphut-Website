import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface StoredCafeImage {
  bucket: "media";
  path: string;
}

// Only uploads owned by this app can be deleted. External/legacy image links
// are detached from the café without attempting to delete someone else's file.
export function getStoredCafeImage(
  url: string,
  projectUrl: string,
): StoredCafeImage | null {
  try {
    const image = new URL(url);
    if (
      image.origin !== new URL(projectUrl).origin ||
      image.username ||
      image.password
    )
      return null;
    const prefix = "/storage/v1/object/public/media/";
    if (!image.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(image.pathname.slice(prefix.length));
    if (
      !path.startsWith("cafes/") ||
      path.endsWith("/") ||
      path.includes("\\") ||
      [...path].some((character) => character.charCodeAt(0) < 32)
    )
      return null;
    if (path.split("/").some((part) => !part || part === "." || part === ".."))
      return null;
    return { bucket: "media", path };
  } catch {
    return null;
  }
}

export function removedCafeImageUrls(
  knownUrls: string[],
  coverUrl: string | null,
  galleryUrls: string[],
): string[] {
  const retained = new Set([coverUrl, ...galleryUrls]);
  return [...new Set(knownUrls)].filter((url) => url && !retained.has(url));
}

export async function removeUnusedCafeUploads(
  supabase: SupabaseClient<Database>,
  urls: string[],
  projectUrl: string,
): Promise<void> {
  const candidates = new Map<string, StoredCafeImage>();
  for (const url of urls) {
    const image = getStoredCafeImage(url, projectUrl);
    if (image) candidates.set(image.path, image);
  }
  if (!candidates.size) return;

  // Read every page, and compare decoded object paths rather than raw URLs.
  // Query strings and alternate encodings must not hide a shared reference.
  const referenced = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; ) {
    const { data, error } = await supabase
      .from("Cafe")
      .select("image_url")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error || !data)
      throw new Error("Could not check image references. Its file was kept.");
    for (const row of data) {
      const image =
        row.image_url && getStoredCafeImage(row.image_url, projectUrl);
      if (image) referenced.add(image.path);
    }
    if (!data.length) break;
    offset += data.length;
  }
  for (let offset = 0; ; ) {
    const { data, error } = await supabase
      .from("CafeImages")
      .select("images_url")
      .order("cafe_id")
      .range(offset, offset + pageSize - 1);
    if (error || !data)
      throw new Error("Could not check gallery references. Its file was kept.");
    for (const row of data) {
      for (const url of row.images_url ?? []) {
        const image = getStoredCafeImage(url, projectUrl);
        if (image) referenced.add(image.path);
      }
    }
    if (!data.length) break;
    offset += data.length;
  }

  for (const image of candidates.values()) {
    if (referenced.has(image.path)) continue;

    // Never DELETE storage.objects / storage.buckets through SQL or PostgREST.
    // The authenticated Storage API checks the existing admin-only RLS policy.
    const { data, error } = await supabase.storage
      .from(image.bucket)
      .remove([image.path]);
    if (error) throw new Error(error.message);
    if (!data?.some((file) => file.name === image.path)) {
      // Retry safely after a partial batch: a previously deleted file is done.
      const existing = await supabase.storage
        .from(image.bucket)
        .exists(image.path);
      if (
        existing.error &&
        "status" in existing.error &&
        existing.error.status === 404
      )
        continue;
      throw new Error(
        "Storage did not confirm deletion. The file may already be missing or your account may not have permission.",
      );
    }
  }
}
