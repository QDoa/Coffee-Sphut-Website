import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/admin/auth";
import { recordStaffLogin, safeAdminPath } from "@/lib/admin/login";

/**
 * Google OAuth callback. Exchanges the PKCE code for a session, then enforces
 * the AdminUser allow-list. Any Google account may authenticate, but only
 * staff keep a session; everyone else is signed out immediately.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeAdminPath(searchParams.get("next"));

  const loginUrl = (error: string): URL => {
    const url = new URL("/admin/login", origin);
    url.searchParams.set("error", error);
    if (next !== "/admin") url.searchParams.set("redirectTo", next);
    return url;
  };

  // Google returns ?error=access_denied when the user cancels consent.
  if (!code || searchParams.get("error")) {
    return NextResponse.redirect(loginUrl("oauth_failed"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth code exchange failed:", error.message);
    return NextResponse.redirect(loginUrl("oauth_failed"));
  }

  const staff = await getStaff();
  if (!staff) {
    // Required: a lingering non-staff session would loop between the proxy
    // (login -> /admin) and requireStaff (/admin -> login).
    await supabase.auth.signOut();
    return NextResponse.redirect(loginUrl("not_staff"));
  }

  await recordStaffLogin("google");

  return NextResponse.redirect(new URL(next, origin));
}
