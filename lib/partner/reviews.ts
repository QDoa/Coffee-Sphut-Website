import { CAFE_AMENITIES } from "./amenities";
import type { MediaSelection } from "./media";

export interface PartnerReviewActor {
  userId: string;
  staffRole: "admin" | "editor" | null;
}

/**
 * Requires a freshly authorized internal staff actor and the immutable request
 * submitter. The database approval transaction must repeat this identity check.
 */
export function canReviewPartnerSubmission(
  actor: PartnerReviewActor | null,
  submitterUserId: string,
): boolean {
  return Boolean(
    actor?.userId &&
    submitterUserId &&
    (actor.staffRole === "admin" || actor.staffRole === "editor") &&
    actor.userId !== submitterUserId,
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Café name",
  postcode: "Postal code",
  time_open: "Opening hours",
  link: "Website",
  image_url: "Cover image",
  gallery: "Gallery photos",
  phone_number: "Phone number",
  reward_code: "Café code",
  show_details: "Show listing details",
  is_active: "Listing status",
  loyalty_threshold_override: "Loyalty threshold override",
};

type Row = Record<string, unknown>;

export interface ReviewField {
  key: string;
  label: string;
  current: string | null;
  proposed: string;
  changed: boolean;
}

function formatValue(field: string, value: unknown): string {
  if (field === "is_active" && typeof value === "boolean")
    return value ? "Active" : "Archived";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    if (field === "amenities") {
      return value.map((item) => CAFE_AMENITIES.find(({ id }) => id === item)?.label || String(item)).join(", ") || "—";
    }
    return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join("\n") || "—";
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([label, detail]) => {
      const text = detail && typeof detail === "object" && "open" in detail && "close" in detail
        ? `${detail.open}–${detail.close}`
        : typeof detail === "object" ? JSON.stringify(detail) : String(detail);
      return `${label} · ${text}`;
    }).join("\n") || "—";
  }
  return String(value);
}

function sameValue(current: unknown, proposed: unknown): boolean {
  if (current === proposed) return true;
  if (Array.isArray(current) && Array.isArray(proposed)) {
    return current.length === proposed.length &&
      current.every((item, index) => sameValue(item, proposed[index]));
  }
  if (!current || !proposed || typeof current !== "object" ||
    typeof proposed !== "object" || Array.isArray(current) || Array.isArray(proposed))
    return false;
  const entries = Object.entries(current);
  return entries.length === Object.keys(proposed).length &&
    entries.every(([key, value]) =>
      Object.hasOwn(proposed, key) && sameValue(value, (proposed as Row)[key]),
    );
}

export function cafeRequestFields(
  payload: Row,
  current: Row,
  media: MediaSelection,
  newListing: boolean,
): ReviewField[] {
  const fields: ReviewField[] = Object.entries(payload).map(([key, value]) => {
    const comparable = Object.hasOwn(current, key);
    const uploadedCover = key === "image_url" && media.cover;
    const uploadedGallery = key === "gallery" && media.gallery.length > 0;
    const formatted = formatValue(key, value);
    const proposed = uploadedCover
      ? "Uploaded cover photo"
      : uploadedGallery
        ? [`${media.gallery.length} uploaded ${media.gallery.length === 1 ? "photo" : "photos"}`,
            ...(formatted === "—" ? [] : [formatted])].join("\n")
        : formatted;
    return {
      key,
      label: FIELD_LABELS[key] || key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
      current: comparable ? formatValue(key, current[key]) : null,
      proposed,
      changed: newListing
        ? proposed !== "—"
        : !comparable || Boolean(uploadedCover) || uploadedGallery || !sameValue(current[key], value),
    };
  });
  if (media.cover && !Object.hasOwn(payload, "image_url")) {
    fields.push({
      key: "image_url",
      label: "Cover image",
      current: Object.hasOwn(current, "image_url") ? formatValue("image_url", current.image_url) : null,
      proposed: "Uploaded cover photo",
      changed: true,
    });
  }
  return fields;
}

export function cafeRequestPhotos(media: MediaSelection): { id: string; label: string }[] {
  return [
    ...(media.cover ? [{ id: media.cover, label: "Proposed cover" }] : []),
    ...media.gallery.map((id, i) => ({ id, label: `Proposed gallery ${i + 1}` })),
  ];
}
