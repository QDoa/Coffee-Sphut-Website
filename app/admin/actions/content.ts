"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

// Common slugifier
function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ----------------------------------------------------
// POSTS
// ----------------------------------------------------
const postSchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  slug: z.string().min(1, "Slug is required").trim(),
  summary: z.string().optional().nullable(),
  author_id: z.string().uuid("Invalid author").optional().nullable().or(z.literal("")),
  main_image_url: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
});

export async function savePostAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const title = formData.get("title")?.toString().trim() || "";
  let slug = formData.get("slug")?.toString().trim() || "";
  if (!slug && title) slug = slugify(title);

  const parsed = postSchema.safeParse({
    title,
    slug,
    summary: formData.get("summary") || null,
    author_id: formData.get("author_id") || null,
    main_image_url: formData.get("main_image_url") || null,
    body_text: formData.get("body_text") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const payload = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    summary: parsed.data.summary,
    author_id: parsed.data.author_id ? parsed.data.author_id : null,
    main_image_url: parsed.data.main_image_url,
    body: parsed.data.body_text || null,
  };

  const selectedCategoryIds = formData.getAll("category_ids") as string[];

  if (id && id !== "new") {
    const { error } = await supabase.from("Post").update(payload).eq("id", id);
    if (error) return { error: error.message };

    // Update categories
    await supabase.from("PostCategory").delete().eq("post_id", id);
    if (selectedCategoryIds.length > 0) {
      await supabase.from("PostCategory").insert(
        selectedCategoryIds.map((cid) => ({ post_id: id!, category_id: cid }))
      );
    }
  } else {
    const { data, error } = await supabase
      .from("Post")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { error: error.message };
    id = data.id;

    if (selectedCategoryIds.length > 0) {
      await supabase.from("PostCategory").insert(
        selectedCategoryIds.map((cid) => ({ post_id: id!, category_id: cid }))
      );
    }
  }

  revalidatePath("/admin/posts");
  redirect("/admin/posts");
}

export async function setPostPublishStatusAction(id: string, publishedAt: string | null) {
  await requireStaff("editor");
  const supabase = await createClient();

  const { error } = await supabase
    .from("Post")
    .update({ published_at: publishedAt })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
}

export async function deletePostAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("Post").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/posts");
}

// ----------------------------------------------------
// RECIPES
// ----------------------------------------------------
export async function saveRecipeAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const title = formData.get("title")?.toString().trim() || "";
  let slug = formData.get("slug")?.toString().trim() || "";
  if (!slug && title) slug = slugify(title);

  let ingredients = [];
  try {
    ingredients = JSON.parse(formData.get("ingredients")?.toString() || "[]");
  } catch {
    ingredients = [];
  }

  let instructions = [];
  try {
    instructions = JSON.parse(formData.get("instructions")?.toString() || "[]");
  } catch {
    instructions = [];
  }

  const payload = {
    title,
    slug,
    description: formData.get("description")?.toString() || null,
    image_url: formData.get("image_url")?.toString() || null,
    servings: formData.get("servings") ? Number(formData.get("servings")) : null,
    prep_time_minutes: formData.get("prep_time_minutes") ? Number(formData.get("prep_time_minutes")) : null,
    cook_time_minutes: formData.get("cook_time_minutes") ? Number(formData.get("cook_time_minutes")) : null,
    difficulty: formData.get("difficulty")?.toString() || null,
    ingredients,
    instructions,
  };

  const supabase = await createClient();

  if (id && id !== "new") {
    const { error } = await supabase.from("Recipe").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("Recipe")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { error: error.message };
    id = data.id;
  }

  revalidatePath("/admin/recipes");
  redirect("/admin/recipes");
}

export async function setRecipePublishStatusAction(id: string, publishedAt: string | null) {
  await requireStaff("editor");
  const supabase = await createClient();

  const { error } = await supabase
    .from("Recipe")
    .update({ published_at: publishedAt })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${id}`);
}

export async function deleteRecipeAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("Recipe").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/recipes");
}

// ----------------------------------------------------
// EVENTS
// ----------------------------------------------------
export async function saveEventAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const title = formData.get("title")?.toString().trim() || "";
  let slug = formData.get("slug")?.toString().trim() || "";
  if (!slug && title) slug = slugify(title);

  const startTimeStr = formData.get("start_time")?.toString();
  if (!startTimeStr) return { error: "Start time is required" };

  const endTimeStr = formData.get("end_time")?.toString();

  const payload = {
    title,
    slug,
    description: formData.get("description")?.toString() || null,
    image_url: formData.get("image_url")?.toString() || null,
    start_time: new Date(startTimeStr).toISOString(),
    end_time: endTimeStr ? new Date(endTimeStr).toISOString() : null,
    cafe_id: formData.get("cafe_id") ? Number(formData.get("cafe_id")) : null,
    address: formData.get("address")?.toString() || null,
    link: formData.get("link")?.toString() || null,
    is_featured: formData.get("is_featured") === "on",
  };

  const supabase = await createClient();

  if (id && id !== "new") {
    const { error } = await supabase.from("Event").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("Event")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { error: error.message };
    id = data.id;
  }

  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function setEventPublishStatusAction(id: string, publishedAt: string | null) {
  await requireStaff("editor");
  const supabase = await createClient();

  const { error } = await supabase
    .from("Event")
    .update({ published_at: publishedAt })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
}

export async function deleteEventAction(id: string) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("Event").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/events");
}
