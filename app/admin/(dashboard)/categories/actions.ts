"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const categorySchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  description: z.string().optional().nullable(),
});

export async function saveCategoryAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const title = formData.get("title")?.toString().trim() || "";

  const parsed = categorySchema.safeParse({
    title,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();

  if (id && id !== "new") {
    const { error } = await supabase
      .from("Category")
      .update(parsed.data)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("Category").insert(parsed.data);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategoryAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("Category").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
}
