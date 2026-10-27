import { NextResponse, userAgent, type NextRequest } from "next/server";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

export function redirectAppLink(request: NextRequest): NextResponse {
  const { os } = userAgent(request);
  const destination = os.name === "iOS"
    ? APP_STORE_URL
    : os.name === "Android"
      ? PLAY_STORE_URL
      : new URL("/#download", request.url);

  return NextResponse.redirect(destination, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "User-Agent",
    },
  });
}
