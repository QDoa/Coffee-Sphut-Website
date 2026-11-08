import { portalData } from "@/lib/partner/portal";
import { rewardExportCsv } from "@/lib/partner/reward-export";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const cafeId = params.get("cafe_id");
  if (cafeId && (!/^\d{1,16}$/.test(cafeId) || !Number.isSafeInteger(Number(cafeId)) || Number(cafeId) < 1))
    return new Response("Choose a valid café.", { status: 400, headers });

  const report = await portalData("rewards", {
    export: "csv",
    ...(cafeId ? { cafe_id: cafeId } : {}),
    from: params.get("from"),
    to: params.get("to"),
    range: params.get("range"),
  });
  if (report.reward_error)
    return new Response(report.reward_error, { status: 400, headers });
  if (cafeId && !report.cafes.some((cafe) => Number(cafe.id) === Number(cafeId)))
    return new Response("Café access is required.", { status: 403, headers });
  if (report.events.length !== report.total)
    return new Response(
      "This export is too large. Choose a shorter date range or a single café.",
      { status: 422, headers },
    );

  const filename = `reward-redemptions-${report.reward_from}-${report.reward_to}.csv`;
  return new Response(rewardExportCsv(report), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
