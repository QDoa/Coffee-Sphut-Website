"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

export async function uploadMediaAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireStaff("editor");
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) || "general";

  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  const supabase = await createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage
    .from("media")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return { error: error.message };
  }

  const { data: publicUrlData } = supabase.storage
    .from("media")
    .getPublicUrl(fileName);

  revalidatePath("/admin");
  return { url: publicUrlData.publicUrl };
}
