"use server";
import { requireStaff } from "@/lib/admin/auth";
import { removeUnusedCafeUploads } from "@/lib/admin/cafe-images";
import { portalClient, portalData } from "@/lib/partner/portal";
import { uploadManagedImage } from "@/lib/partner/media";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { revalidatePath } from "next/cache";
export async function uploadImageAction(
  form: FormData,
): Promise<{ id?: string; error?: string }> {
  try {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose an image.");
    const data = await portalData("overview");
    const cafe = form.get("cafe_id");
    const id = await uploadManagedImage(
      await portalClient(),
      data.chain_id!,
      cafe ? Number(cafe) : null,
      file,
    );
    return { id };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      error:
        error instanceof Error ? error.message : "Upload failed. Try again.",
    };
  }
}
export async function cleanupImageAction(
  _state: { error?: string; message?: string },
  form: FormData,
) {
  let id = "";
  try {
    if (!isLocalPartnerPreview())
      await requireStaff("admin", { redirectOnFailure: false });
    const client = await portalClient(isLocalPartnerPreview());
    id = String(form.get("id"));
    const claimed = await client.rpc("partner_media_cleanup", { p_id: id });
    if (claimed.error) throw new Error(claimed.error.message);
    const asset = claimed.data;
    const base = process.env.SUPABASE_URL!;
    await removeUnusedCafeUploads(
      client,
      [`${base}/storage/v1/object/public/media/${asset.public_path}`],
      base,
    );
    const remaining = await client.storage
      .from("media")
      .exists(asset.public_path);
    if (remaining.data)
      throw new Error(
        "Public image is still referenced or could not be removed. File retained.",
      );
    if (
      remaining.error &&
      (!("status" in remaining.error) ||
        ![400, 404].includes(Number(remaining.error.status)))
    )
      throw new Error(remaining.error.message);
    const removed = await client.storage
      .from("partner-drafts")
      .remove([asset.path]);
    if (removed.error) throw new Error(removed.error.message);
    // Storage may return an empty removal response for an already absent file.
    const privateRemaining = await client.storage
      .from("partner-drafts")
      .exists(asset.path);
    if (
      privateRemaining.data ||
      (privateRemaining.error &&
        (!("status" in privateRemaining.error) ||
          ![400, 404].includes(Number(privateRemaining.error.status))))
    )
      throw new Error(
        "Private image removal was not confirmed. Retry cleanup.",
      );
    const finished = await client.rpc("partner_media_cleanup", {
      p_id: id,
      p_result: "deleted",
    });
    if (finished.error) throw new Error(finished.error.message);
    revalidatePath("/admin/partner-reviews");
    revalidatePath("/partner/preview-review");
    return { message: "Unused upload removed." };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT"))
      throw error;
    const message =
      error instanceof Error
        ? error.message
        : "Cleanup failed. File retained for retry.";
    if (id) {
      const client = await portalClient(isLocalPartnerPreview());
      await client.rpc("partner_media_cleanup", {
        p_id: id,
        p_result: message,
      });
    }
    return { error: message };
  }
}
