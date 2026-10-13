import "server-only";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_ADMIN_PATH = "/admin";

export type LoginMethod = "password" | "google";

/**
 * Returns `input` only if it is a same-origin path under /admin.
 * Guards post-login redirects against open-redirect payloads such as
 * `//evil.com`, `/\evil.com` or absolute URLs.
 */
export function safeAdminPath(input: string | null | undefined): string {
  if (!input) return DEFAULT_ADMIN_PATH;
  if (!input.startsWith("/admin")) return DEFAULT_ADMIN_PATH;
  if (input.startsWith("//") || input.includes("\\")) return DEFAULT_ADMIN_PATH;
  return input;
}

/**
 * Records a successful staff sign-in in AdminAuditLog via the
 * `log_staff_login` RPC. Never throws: an audit failure must not block login.
 */
export async function recordStaffLogin(method: LoginMethod): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_staff_login", { p_method: method });
    if (error) {
      console.error("Failed to record staff login:", error.message);
    }
  } catch (err) {
    console.error("Failed to record staff login:", err);
  }
}
