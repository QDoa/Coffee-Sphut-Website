import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  if (isLocalPartnerPreview() && ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname) && request.nextUrl.pathname.startsWith("/partner")) return supabaseResponse;

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run auth code if it is an asset or non-admin request
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/partner")) {
    // Refresh cookies; partner routes check membership in their own server/RPC path.
    await supabase.auth.getUser();
    return supabaseResponse;
  }
  if (!pathname.startsWith("/admin")) {
    return supabaseResponse;
  }

  // The OAuth callback arrives without a session and establishes one itself.
  if (pathname.startsWith("/admin/auth/callback")) {
    return supabaseResponse;
  }

  // Refresh user session if available
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/forgot-password");

  if (!user && !isAuthPage) {
    // Redirect unauthenticated requests to /admin/login
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  const staffOnAuthPage = user && isAuthPage
    ? await supabase.from("AdminUser").select("role").eq("user_id",user.id).maybeSingle()
    : null;
  if (user && isAuthPage && staffOnAuthPage?.data) {
    // A partner session alone must not loop between admin login and requireStaff.
    // Redirect only an allow-listed staff user away from the staff auth pages.
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
