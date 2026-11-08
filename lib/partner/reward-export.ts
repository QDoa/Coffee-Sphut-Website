import type { PortalData } from "./portal";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Café names are user-controlled. Keep spreadsheet applications from evaluating formulas.
  const safe = /^[=+@-]/.test(text.trimStart()) || /^[\t\r\n]/.test(text)
    ? "'" + text
    : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function rewardExportCsv(report: Pick<PortalData, "events" | "timezone" | "reward_from" | "reward_to" | "coverage_at">): string {
  const columns = [
    "Café",
    "Café ID",
    "Redemption date (local)",
    "Redemption time (local)",
    "Redemption timestamp (UTC)",
    "Reporting timezone",
    "Reference",
    "Status",
    "Report from",
    "Report through",
    "Tracking coverage begins",
  ];
  const rows = report.events.map((event) => {
    const [date, time] = String(event.occurred_local ?? "").split(" ");
    return [
      event.cafe_name,
      event.cafe_id,
      date,
      time,
      event.occurred_utc,
      report.timezone,
      event.id,
      event.status,
      report.reward_from,
      report.reward_to,
      report.coverage_at,
    ];
  });
  return "\uFEFF" + [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
