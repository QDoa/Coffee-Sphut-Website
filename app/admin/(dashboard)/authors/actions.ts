"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const authorSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  slug: z.string().min(1, "Slug is required").trim(),
  bio: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function saveAuthorAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const name = formData.get("name")?.toString().trim() || "";
  let slug = formData.get("slug")?.toString().trim() || "";
  if (!slug && name) slug = slugify(name);

  const rawBio = formData.get("bio")?.toString() || null;
  let bioJson: any = rawBio;
  if (rawBio) {
    try {
      bioJson = JSON.parse(rawBio);
    } catch {
      bioJson = rawBio;
    }
  }

  const parsed = authorSchema.safeParse({
    name,
    slug,
    bio: rawBio,
    image_url: formData.get("image_url") || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    image_url: parsed.data.image_url,
    bio: bioJson,
  };

  if (id && id !== "new") {
    const { error } = await supabase
      .from("Author")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("Author").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/authors");
  redirect("/admin/authors");
}

export async function deleteAuthorAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("Author").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/authors");
}
