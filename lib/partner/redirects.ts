/** Closed set of partner destinations; never forward a caller-supplied origin. */
export function safePartnerNext(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/")) return "/partner";
  const url = new URL(input, "https://partner.invalid");
  if (url.origin !== "https://partner.invalid") return "/partner";
  if (url.pathname === "/partner/accept") {
    const token = url.searchParams.get("token");
    return token && /^[a-f0-9-]{72}$/.test(token)
      ? `/partner/accept?token=${token}`
      : "/partner";
  }
  return ["/partner", "/partner/overview", "/partner/password"].includes(
    url.pathname,
  )
    ? url.pathname
    : "/partner";
}
