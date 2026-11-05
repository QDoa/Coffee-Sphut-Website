import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export interface MediaSelection {
  cover: string | null;
  gallery: string[];
}
export const EMPTY_MEDIA: MediaSelection = { cover: null, gallery: [] };
export function imageMime(bytes: Uint8Array, declared: string): string {
  const is = (...values: number[]) => values.every((v, i) => bytes[i] === v);
  const detected = is(137, 80, 78, 71, 13, 10, 26, 10)
    ? "image/png"
    : is(255, 216, 255)
      ? "image/jpeg"
      : is(82, 73, 70, 70) &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
        ? "image/webp"
        : "";
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new Error("Choose an image up to 5 MB.");
  if (!detected || detected !== declared)
    throw new Error(
      "Choose a JPEG, PNG or WebP image with matching file contents.",
    );
  return detected;
}
export async function uploadManagedImage(
  client: SupabaseClient<Database>,
  chain: string,
  cafe: number | null,
  file: File,
) {
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Choose an image up to 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMime(bytes, file.type);
  const reserved = await client.rpc("partner_media_reserve", {
    p_chain: chain,
    p_cafe: cafe as number,
    p_mime: mime,
    p_size: bytes.length,
  });
  if (reserved.error) throw new Error(reserved.error.message);
  const asset = reserved.data;
  const uploaded = await client.storage
    .from("partner-drafts")
    .upload(asset.path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const ready = await client.rpc("partner_media_ready", { p_id: asset.id });
  if (ready.error) throw new Error(ready.error.message);
  return asset.id;
}
/** Each call rechecks reviewer permissions. Failed copies retain the immutable
 * request and deterministic destinations, so retrying never duplicates files. */
export async function publishReviewedMedia(
  client: SupabaseClient<Database>,
  input: Record<string, Json | undefined>,
) {
  const prepared = await client.rpc("partner_media_prepare", {
    p_change: String(input.id),
  });
  if (prepared.error) throw new Error(prepared.error.message);
  for (const asset of prepared.data) {
    const source = await client.storage
      .from("partner-drafts")
      .download(asset.path);
    if (source.error)
      throw new Error(
        `Image publication paused: ${source.error.message}. Retry approval.`,
      );
    const bytes = new Uint8Array(await source.data.arrayBuffer());
    imageMime(bytes, asset.mime);
    const uploaded = await client.storage
      .from("media")
      .upload(asset.public_path, bytes, {
        contentType: asset.mime,
        upsert: false,
        cacheControl: "3600",
      });
    if (uploaded.error) {
      // A previous attempt may have copied this file before a later failure.
      const existing = await client.storage
        .from("media")
        .download(asset.public_path);
      if (existing.error)
        throw new Error(
          `Image publication paused: ${uploaded.error.message}. Retry approval.`,
        );
      const previous = new Uint8Array(await existing.data.arrayBuffer());
      if (
        bytes.length !== previous.length ||
        !bytes.every((v, i) => v === previous[i])
      )
        throw new Error(
          "Published image differs from the reviewed file. Ask an administrator to investigate.",
        );
    }
  }
}
