"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";

const cafeSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  chain_id: z.string().uuid("Please select a valid chain"),
  address: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  link: z.string().url("Invalid URL").optional().nullable().or(z.literal("")),
  description: z.string().optional().nullable(),
  reward_code: z.string().optional().nullable(),
  loyalty_threshold_override: z.coerce.number().int().positive().optional().nullable(),
  rating: z.coerce.number().min(0).max(5).optional().nullable(),
  is_active: z.coerce.boolean().default(true),
  show_details: z.coerce.boolean().default(false),
  image_url: z.string().optional().nullable(),
});

export async function saveCafeAction(id: string | null, formData: FormData) {
  await requireStaff("editor");

  const rawData = {
    name: formData.get("name"),
    chain_id: formData.get("chain_id"),
    address: formData.get("address") || null,
    postcode: formData.get("postcode") || null,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
    phone_number: formData.get("phone_number") || null,
    email: formData.get("email") || null,
    link: formData.get("link") || null,
    description: formData.get("description") || null,
    reward_code: formData.get("reward_code") || null,
    loyalty_threshold_override: formData.get("loyalty_threshold_override")
      ? Number(formData.get("loyalty_threshold_override"))
      : null,
    rating: formData.get("rating") ? Number(formData.get("rating")) : null,
    is_active: formData.get("is_active") === "on",
    show_details: formData.get("show_details") === "on",
    image_url: formData.get("image_url") || null,
  };

  const parsed = cafeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Parse hours and amenities if provided
  let time_open = null;
  const timeOpenRaw = formData.get("time_open_json")?.toString();
  if (timeOpenRaw) {
    try {
      time_open = JSON.parse(timeOpenRaw);
    } catch {
      // ignore
    }
  }

  let amenities: string[] = [];
  const amenitiesRaw = formData.get("amenities")?.toString();
  if (amenitiesRaw) {
    amenities = amenitiesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const supabase = await createClient();

  const payload = {
    ...parsed.data,
    time_open,
    amenities,
    reward_code: parsed.data.reward_code ? parsed.data.reward_code.trim() : null,
  };

  if (id && id !== "new") {
    const cafeId = Number(id);
    const { error } = await supabase.from("Cafe").update(payload).eq("id", cafeId);
    if (error) return { error: error.message };

    // Update cafe images array if provided
    const galleryUrlsRaw = formData.get("gallery_images")?.toString();
    if (galleryUrlsRaw !== undefined) {
      const urls = galleryUrlsRaw
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      await supabase
        .from("CafeImages")
        .upsert({ cafe_id: cafeId, images_url: urls });
    }
  } else {
    const { data, error } = await supabase
      .from("Cafe")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { error: error.message };
    id = String(data.id);

    const galleryUrlsRaw = formData.get("gallery_images")?.toString();
    if (galleryUrlsRaw) {
      const urls = galleryUrlsRaw
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      await supabase
        .from("CafeImages")
        .upsert({ cafe_id: data.id, images_url: urls });
    }
  }

  revalidatePath("/admin/cafes");
  revalidatePath("/stores");
  redirect("/admin/cafes");
}

export async function deleteCafeAction(id: number) {
  await requireStaff("admin");
  const supabase = await createClient();

  const { error } = await supabase.from("Cafe").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/cafes");
  revalidatePath("/stores");
}

export async function saveMenuItemAction(cafeId: number, formData: FormData) {
  await requireStaff("editor");
  const name = formData.get("name")?.toString().trim();
  const price = Number(formData.get("price"));
  const currency = formData.get("currency")?.toString().trim() || "CAD";
  const description = formData.get("description")?.toString().trim() || null;

  if (!name || isNaN(price)) {
    return { error: "Name and price are required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("CafeMenu").insert({
    cafe_id: cafeId,
    name,
    price,
    currency,
    description,
  });

  if (error) return { error: error.message };
  revalidatePath(`/admin/cafes/${cafeId}`);
  return { success: true };
}

export async function deleteMenuItemAction(menuItemId: string, cafeId: number) {
  await requireStaff("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("CafeMenu").delete().eq("id", menuItemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cafes/${cafeId}`);
}
