import { PostHog } from "posthog-node";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_CAPTURE_MAX_RETRIES = 1;
const POSTHOG_REQUEST_TIMEOUT_MS = 2000;
const POSTHOG_SHUTDOWN_TIMEOUT_MS = 2500;
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
 * Captures a server-side PostHog event immediately with bounded timeout/retries.
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
    flushInterval: 0,
    captureMaxRetries: POSTHOG_CAPTURE_MAX_RETRIES,
    requestTimeout: POSTHOG_REQUEST_TIMEOUT_MS,
  });

  client.on("error", (error) => {
    console.error("PostHog server capture failed", { event, error });
  });

  try {
    await client.captureImmediate({
      distinctId: distinctId.trim(),
      event,
      properties: {
        ...sanitizeProperties(properties),
        platform: "web_server",
        is_anonymous: false,
      },
    });
    await client.shutdown(POSTHOG_SHUTDOWN_TIMEOUT_MS);
  } catch (error) {
    console.error("PostHog server capture failed", { event, error });
  }
}
