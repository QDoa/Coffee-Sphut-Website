"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/admin/auth";
import { recordStaffLogin, safeAdminPath } from "@/lib/admin/login";

export async function loginAction(
  prevState: { error?: string } | null,
  formData: FormData
) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const redirectTo = safeAdminPath(formData.get("redirectTo")?.toString());

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: error?.message || "Invalid credentials." };
  }

  // Verify that the signed-in user is actually in the AdminUser allow-list
  const staff = await getStaff();
  if (!staff) {
    await supabase.auth.signOut();
    return {
      error:
        "Access denied: your account is not authorized to access the admin dashboard.",
    };
  }

  await recordStaffLogin("password");

  redirect(redirectTo);
}

/**
 * Starts the Google OAuth (PKCE) flow. The code verifier is stored in a cookie
 * by the Supabase SSR client and consumed by /admin/auth/callback.
 */
export async function googleLoginAction(formData: FormData): Promise<void> {
  const next = safeAdminPath(formData.get("redirectTo")?.toString());
  const origin = await getRequestOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/admin/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    console.error("Google OAuth init failed:", error?.message);
    redirect("/admin/login?error=oauth_failed");
  }

  redirect(data.url);
}

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (host) {
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL || "https://coffeesphut.com";
}

export async function forgotPasswordAction(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get("email")?.toString().trim();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://coffeesphut.com"}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
