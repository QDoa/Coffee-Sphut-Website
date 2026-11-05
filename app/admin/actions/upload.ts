"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

export async function createMediaUploadAction(
  folder: string,
  type: string,
  size: number,
): Promise<{ uploadUrl: string; url: string } | { error: string }> {
  await requireStaff("editor");

  if (!Number.isSafeInteger(size) || size <= 0) {
    return { error: "Choose a non-empty image." };
  }
  if (size > 10 * 1024 * 1024) {
    return { error: "Images must be 10 MB or smaller." };
  }
  const extension = IMAGE_EXTENSIONS.get(type);
  if (!extension) {
    return { error: "Choose a JPG, PNG, WebP, GIF, or AVIF image." };
  }
  if (typeof folder !== "string" || !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(folder)) {
    return { error: "Invalid upload folder." };
  }

  const supabase = await createClient();
  const bucket = supabase.storage.from("media");
  const path = `${folder}/${randomUUID()}.${extension}`;
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error) {
    return { error: error.message };
  }

  return { uploadUrl: data.signedUrl, url: bucket.getPublicUrl(path).data.publicUrl };
}
