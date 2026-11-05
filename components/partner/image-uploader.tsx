"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { uploadImageAction } from "@/app/partner/media-actions";
import { type MediaSelection, EMPTY_MEDIA } from "@/lib/partner/media";
import { Button } from "@/components/ui/button";
export function ImageUploader({
  cafeId,
  initial = EMPTY_MEDIA,
}: {
  cafeId?: number;
  initial?: MediaSelection;
}) {
  const [selection, setSelection] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function upload(file: File | undefined, placement: "cover" | "gallery") {
    if (!file) return;
    setError("");
    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      if (cafeId) form.set("cafe_id", String(cafeId));
      const result = await uploadImageAction(form);
      if (result.error) setError(result.error);
      if (result.id)
        setSelection((previous) =>
          placement === "cover"
            ? { ...previous, cover: result.id! }
            : { ...previous, gallery: [...previous.gallery, result.id!] },
        );
    });
  }
  return (
    <fieldset
      className="min-w-0 space-y-4 rounded-xl border p-4"
      disabled={pending}
      data-upload-pending={pending || undefined}
    >
      <legend className="px-2 text-sm font-medium">Upload café images</legend>
      <p className="text-sm text-muted-foreground">
        JPEG, PNG or WebP, up to 5 MB each. Uploads stay private until Coffee
        Sphut approves your request. A new cover replaces the cover URL; gallery
        uploads follow the gallery URLs above.
      </p>
      <input type="hidden" name="media" value={JSON.stringify(selection)} />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["cover", "gallery"] as const).map((placement) => (
          <label
            key={placement}
            className="min-w-0 space-y-2 text-sm font-medium"
          >
            <span>
              {placement === "cover"
                ? "Upload cover image"
                : "Upload gallery image"}
            </span>
            <input
              className="block min-h-11 w-full min-w-0 text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                upload(event.target.files?.[0], placement);
                event.target.value = "";
              }}
            />
          </label>
        ))}
      </div>
      {pending && <p role="status">Uploading image…</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        {[
          ...(selection.cover ? [{ id: selection.cover, label: "Cover" }] : []),
          ...selection.gallery.map((id, i) => ({
            id,
            label: `Gallery ${i + 1}`,
          })),
        ].map(({ id, label }, i) => (
          <div key={`${id}-${i}`} className="space-y-2">
            <Image
              src={`/partner/media/${id}`}
              alt={`${label} awaiting review`}
              width={160}
              height={120}
              unoptimized
              className="h-30 w-40 rounded-lg object-cover"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSelection((previous) =>
                  label === "Cover"
                    ? { ...previous, cover: null }
                    : {
                        ...previous,
                        gallery: previous.gallery.filter(
                          (_, index) => index !== i - (selection.cover ? 1 : 0),
                        ),
                      },
                )
              }
            >
              Remove {label.toLowerCase()}
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
