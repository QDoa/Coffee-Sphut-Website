import { NextResponse, type NextRequest } from "next/server";
import { isLocalPartnerPreview, PARTNER_PREVIEW_RECORDING_COOKIE } from "@/lib/partner/preview";

export function GET(request: NextRequest): NextResponse {
  const host = request.headers.get("host")?.split(":")[0];
  if (!isLocalPartnerPreview() || (host !== "localhost" && host !== "127.0.0.1")) {
    return new NextResponse(null, { status: 404 });
  }

  const enabled = request.nextUrl.searchParams.get("enabled");
  if (enabled !== "1" && enabled !== "0") {
    return new NextResponse(null, { status: 400 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/partner/overview", "Cache-Control": "no-store" },
  });
  response.cookies.set(PARTNER_PREVIEW_RECORDING_COOKIE, enabled === "1" ? "1" : "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/partner",
    ...(enabled === "0" ? { maxAge: 0 } : {}),
  });
  return response;
}
