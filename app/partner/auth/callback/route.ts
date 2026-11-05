import { NextResponse, type NextRequest } from "next/server";
import { safePartnerNext } from "@/lib/partner/redirects";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const target = safePartnerNext(next);
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.redirect(
    new URL("/partner/login?error=callback_failed", request.url),
  );
}
