import { createMediaUploadAction } from "@/app/admin/actions/upload";

export async function uploadMedia(
  file: File,
  folder = "general",
): Promise<{ url?: string; error?: string }> {
  const upload = await createMediaUploadAction(folder, file.type, file.size);
  if ("error" in upload) return upload;

  // Match the multipart format Supabase uses for signed file uploads.
  const body = new FormData();
  body.set("cacheControl", "3600");
  body.set("", file);

  try {
    const response = await fetch(upload.uploadUrl, { method: "PUT", body });
    if (response.ok) return { url: upload.url };

    const error = await response.json().catch(() => null);
    return {
      error: typeof error?.message === "string"
        ? error.message
        : `Storage rejected the image (HTTP ${response.status}).`,
    };
  } catch {
    return { error: "Could not reach image storage. Try uploading again." };
  }
}
