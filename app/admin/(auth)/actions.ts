"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/admin/auth";

export async function loginAction(
  prevState: { error?: string } | null,
  formData: FormData
) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  console.log("Form data received:", { email, password });
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

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

  redirect(redirectTo.startsWith("/admin") ? redirectTo : "/admin");
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
