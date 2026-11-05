import { NextRequest } from "next/server";
import { portalClient } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const client = await portalClient(
    isLocalPartnerPreview() &&
      request.nextUrl.searchParams.get("review") === "1",
  );
  const { data: asset, error } = await client
    .from("partner_media")
    .select("path,mime,state")
    .eq("id", id)
    .single();
  if (error || !asset || asset.state !== "ready")
    return new Response("Image unavailable", { status: 404 });
  const file = await client.storage.from("partner-drafts").download(asset.path);
  if (file.error) return new Response("Image unavailable", { status: 404 });
  return new Response(file.data, {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
