import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "editor";

export interface StaffUser {
  id: string;
  userId: string;
  email: string | null;
  role: StaffRole;
}

/**
 * Returns current staff member details if logged in and on the AdminUser allow-list.
 * Returns null if not authenticated or not on the allow-list.
 */
export async function getStaff(): Promise<StaffUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: adminRecord, error } = await supabase
    .from("AdminUser")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !adminRecord) {
    return null;
  }

  return {
    id: user.id,
    userId: user.id,
    email: user.email ?? null,
    role: adminRecord.role as StaffRole,
  };
}

/**
 * Ensures the caller is authenticated and holds at least the required role ('editor' or 'admin').
 * If unauthorized, either redirects to login (or /admin unauthorized state) or throws an Error.
 */
export async function requireStaff(
  minRole: StaffRole = "editor",
  options: { redirectOnFailure?: boolean } = { redirectOnFailure: true }
): Promise<StaffUser> {
  const staff = await getStaff();

  if (!staff) {
    if (options.redirectOnFailure) {
      redirect("/admin/login?error=unauthorized");
    }
    throw new Error("Unauthorized: Staff access required");
  }

  if (minRole === "admin" && staff.role !== "admin") {
    if (options.redirectOnFailure) {
      redirect("/admin?error=forbidden");
    }
    throw new Error("Forbidden: Admin role required");
  }

  return staff;
}

export async function requireAdmin(
  options: { redirectOnFailure?: boolean } = { redirectOnFailure: true }
): Promise<StaffUser> {
  return requireStaff("admin", options);
}

