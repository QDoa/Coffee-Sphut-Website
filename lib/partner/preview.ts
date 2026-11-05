export function isLocalPartnerPreview(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL ||
    env.PARTNER_LOCAL_PREVIEW !== "1"
  )
    return false;
  try {
    const url = new URL(env.SUPABASE_URL ?? "");
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "55434"
    );
  } catch {
    return false;
  }
}

/** Release gate; all database authorization remains mandatory when enabled. */
export function isPartnerPortalEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV !== "production" || env.PARTNER_PORTAL_ENABLED === "1";
}
