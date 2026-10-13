"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const chainSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  loyalty_threshold: z.coerce.number().int().min(1, "Threshold must be at least 1"),
});

export async function saveChainAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const parsed = chainSchema.safeParse({
    name: formData.get("name"),
    loyalty_threshold: formData.get("loyalty_threshold"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  if (id && id !== "new") {
    const { error } = await supabase
      .from("Chains")
      .update({
        name: parsed.data.name,
        loyalty_threshold: parsed.data.loyalty_threshold,
      })
      .eq("id", id);

    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("Chains")
      .insert({
        name: parsed.data.name,
        loyalty_threshold: parsed.data.loyalty_threshold,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    id = data.id;
  }

  revalidatePath("/admin/chains");
  redirect("/admin/chains");
}

export async function deleteChainAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();

  const { error } = await supabase.from("Chains").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/chains");
}
