import { type NextRequest, type NextResponse } from "next/server";
import { redirectAppLink } from "@/lib/app-link-redirect";

export function GET(request: NextRequest): NextResponse {
  return redirectAppLink(request);
}
