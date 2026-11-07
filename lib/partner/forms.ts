import { z } from "zod";
import { CAFE_AMENITIES } from "./amenities";

const amenitySelection = z.array(
  z.enum(CAFE_AMENITIES.map(({ id }) => id), {
    error: "Choose from the available café amenities.",
  }),
);
const optionalNumber = (value: FormDataEntryValue | null): number | null =>
  value === null || value === ""
    ? null
    : z.coerce.number().finite().parse(value);
export function cafePayload(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of [
    "name",
    "address",
    "postcode",
    "description",
    "phone_number",
    "email",
    "link",
    "image_url",
    "reward_code",
  ])
    payload[key] = form.get(key)?.toString().trim() || null;
  payload.name = z
    .string()
    .trim()
    .min(1, "Cafe name is required")
    .parse(form.get("name"));
  payload.latitude = optionalNumber(form.get("latitude"));
  payload.longitude = optionalNumber(form.get("longitude"));
  payload.loyalty_threshold_override = optionalNumber(
    form.get("loyalty_threshold_override"),
  );
  payload.is_active = form.get("is_active") === "on";
  payload.show_details = form.get("show_details") === "on";
  const selected = new Set(amenitySelection.parse(form.getAll("amenities")));
  const approved = new Set(form.getAll("approved_amenities"));
  // Omit unchanged selections so ordinary edits preserve legacy amenity data.
  if (
    selected.size !== approved.size ||
    [...selected].some((id) => !approved.has(id))
  )
    payload.amenities = [...selected];
  payload.gallery = (form.get("gallery")?.toString() || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const socials: Record<string, string> = {};
  for (const line of (form.get("social_media")?.toString() || "")
    .split("\n")
    .filter(Boolean)) {
    const i = line.indexOf("=");
    if (i < 1)
      throw new Error("Social links use Label=https://address, one per line.");
    socials[line.slice(0, i).trim()] = z.url().parse(line.slice(i + 1).trim());
  }
  payload.social_media = socials;
  const hours: Record<string, { open: string; close: string }> = {};
  const updateHours =
    form.get("hours_update") === "on" || !form.has("previous_hours");
  for (const day of [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]) {
    if (!updateHours) continue;
    const open = form.get(`hours_${day}_open`)?.toString() || "";
    const close = form.get(`hours_${day}_close`)?.toString() || "";
    if (Boolean(open) !== Boolean(close))
      throw new Error(`Provide both ${day} opening and closing times.`);
    if (open) hours[day] = { open, close };
  }
  payload.time_open = updateHours
    ? hours
    : JSON.parse(String(form.get("previous_hours") || "null"));
  payload.menu = (form.get("menu")?.toString() || "")
    .split("\n")
    .filter((x) => x.trim())
    .map((line) => {
      const [name, price, currency, ...description] = line
        .split("|")
        .map((x) => x.trim());
      return {
        name: z.string().min(1).parse(name),
        price: z.coerce.number().int().nonnegative().parse(price),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .parse(currency),
        description: description.join(" | ") || null,
      };
    });
  for (const url of payload.gallery as string[]) z.url().parse(url);
  for (const key of ["image_url", "link"])
    if (payload[key]) z.url().parse(payload[key]);
  if (payload.email) z.email().parse(payload.email);
  return payload;
}
