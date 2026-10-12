"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function deleteWaitlistEntryAction(id: number) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("Waitlist").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/waitlist");
}
