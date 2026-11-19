import { PostHog } from "posthog-node";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const BLOCKED_PROPERTY_KEYS = new Set([
  "email",
  "first_name",
  "last_name",
  "full_name",
  "phone",
  "phone_number",
  "cafe_code",
]);

function getPostHogConfig(): { apiKey: string; host: string } | null {
  const apiKey =
    process.env.POSTHOG_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const host =
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    DEFAULT_POSTHOG_HOST;

  return { apiKey, host };
}

export function isPostHogConfigured(): boolean {
  return getPostHogConfig() !== null;
}

function sanitizeProperties(
  properties?: Record<string, unknown>,
): Record<string, unknown> {
  if (!properties) return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || BLOCKED_PROPERTY_KEYS.has(key.toLowerCase())) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export interface CaptureServerEventParams {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

/**
 * Captures a server-side PostHog event and flushes immediately.
 * Never throws so analytics failures cannot disrupt customer reward flows.
 */
export async function captureServerEvent({
  distinctId,
  event,
  properties,
}: CaptureServerEventParams): Promise<void> {
  const config = getPostHogConfig();
  if (!config || !distinctId.trim()) {
    return;
  }

  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  try {
    client.capture({
      distinctId: distinctId.trim(),
      event,
      properties: {
        platform: "web_server",
        is_anonymous: false,
        ...sanitizeProperties(properties),
      },
    });
    await client.shutdown();
  } catch (error) {
    console.error("PostHog server capture failed", { event, error });
  }
}
