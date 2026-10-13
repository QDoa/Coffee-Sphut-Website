"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateStaffRoleAction(targetUserId: string, newRole: "admin" | "editor") {
  const currentStaff = await requireAdmin();

  // Prevent self demotion
  if (currentStaff.userId === targetUserId && newRole !== "admin") {
    return { error: "You cannot demote yourself from admin." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("AdminUser")
    .update({ role: newRole })
    .eq("user_id", targetUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  return { success: true };
}

export async function removeStaffMemberAction(targetUserId: string) {
  const currentStaff = await requireAdmin();

  if (currentStaff.userId === targetUserId) {
    return { error: "You cannot remove your own admin access." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("AdminUser")
    .delete()
    .eq("user_id", targetUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  return { success: true };
}

export async function addExistingUserToTeamAction(
  userId: string,
  role: "admin" | "editor"
) {
  const currentStaff = await requireAdmin();

  const cleanUserId = userId.trim();
  if (!cleanUserId) {
    return { error: "A valid user ID is required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("AdminUser").upsert(
    {
      user_id: cleanUserId,
      role,
      created_by: currentStaff.userId,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/team");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${cleanUserId}`);
  return { success: true };
}

export async function inviteStaffMemberAction(email: string, role: "admin" | "editor") {
  const currentStaff = await requireAdmin();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required to provision staff users. Please set it in .env.local",
    };
  }

  try {
    const adminSupabase = createAdminClient();

    // Check if user already exists in auth.users
    const { data: userList } = await adminSupabase.auth.admin.listUsers();
    let existingUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    let targetUserId = existingUser?.id;

    if (!targetUserId) {
      // Invite user via Supabase Auth
      const { data: inviteData, error: inviteErr } =
        await adminSupabase.auth.admin.inviteUserByEmail(cleanEmail);

      if (inviteErr) {
        return { error: inviteErr.message };
      }
      targetUserId = inviteData.user.id;
    }

    // Add to AdminUser
    const supabase = await createClient();
    const { error: insertErr } = await supabase.from("AdminUser").upsert({
      user_id: targetUserId,
      role,
      created_by: currentStaff.userId,
    });

    if (insertErr) return { error: insertErr.message };

    revalidatePath("/admin/team");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to invite staff member." };
  }
}
