"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const questionSchema = z.object({
  question: z.string().min(1, "Question prompt is required").trim(),
  multi_select: z.boolean(),
  priority: z.number().int(),
  active: z.boolean(),
});

export async function saveQuestionAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  let options: string[] = [];
  try {
    const rawOptions = formData.get("options")?.toString() || "[]";
    const parsed = JSON.parse(rawOptions);
    options = Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean) : [];
  } catch {
    options = [];
  }

  const parsed = questionSchema.safeParse({
    question: formData.get("question")?.toString().trim() || "",
    multi_select: formData.get("multi_select") === "on",
    priority: Number(formData.get("priority") || 0),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const payload = {
    ...parsed.data,
    options,
  };

  const supabase = await createClient();

  if (id && id !== "new") {
    const { error } = await supabase
      .from("OnboardingQuestion")
      .update(payload)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("OnboardingQuestion").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function deleteQuestionAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("OnboardingQuestion").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/questions");
}
