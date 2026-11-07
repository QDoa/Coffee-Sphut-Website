"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import { uploadImageAction } from "@/app/partner/media-actions";
import {
  EMPTY_MEDIA,
  MAX_IMAGE_BYTES,
  type MediaSelection,
} from "@/lib/partner/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const imageTypes = "image/jpeg,image/png,image/webp";
const galleryLimit = 50;

function isImageLink(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function PhotoPreview({ src, alt }: { src: string; alt: string }) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable || (!src.startsWith("/partner/media/") && !isImageLink(src)))
    return (
      <span className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
        Image preview unavailable
      </span>
    );
  return (
    <Image
      src={src}
      alt={alt}
      width={640}
      height={360}
      unoptimized
      onError={() => setUnavailable(true)}
      className="h-full w-full object-cover"
    />
  );
}

export function ImageUploader({
  cafeId,
  initial = EMPTY_MEDIA,
  initialCoverUrl = "",
  initialGalleryUrls = [],
}: {
  cafeId?: number;
  initial?: MediaSelection;
  initialCoverUrl?: string;
  initialGalleryUrls?: string[];
}) {
  const id = useId();
  const coverFiles = useRef<HTMLInputElement>(null);
  const galleryFiles = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState(initial);
  const [coverUrl, setCoverUrl] = useState(
    initial.cover ? "" : initialCoverUrl,
  );
  const [galleryUrls, setGalleryUrls] = useState(initialGalleryUrls);
  const [urlEditorOpen, setUrlEditorOpen] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pending, startTransition] = useTransition();
  const count = galleryUrls.length + selection.gallery.length;
  const coverSrc = selection.cover
    ? `/partner/media/${selection.cover}`
    : coverUrl.trim();

  function upload(files: File[], placement: "cover" | "gallery"): void {
    if (!files.length) return;
    if (placement === "gallery" && count + files.length > galleryLimit) {
      setUploadError(`Choose up to ${galleryLimit} gallery photos in total.`);
      return;
    }
    setUploadError("");
    startTransition(async () => {
      const uploaded: string[] = [];
      const errors: string[] = [];
      for (const file of files) {
        try {
          if (file.size > MAX_IMAGE_BYTES)
            throw new Error("Choose an image up to 5 MB.");
          const form = new FormData();
          form.set("file", file);
          if (cafeId) form.set("cafe_id", String(cafeId));
          const result = await uploadImageAction(form);
          if (!result.id) throw new Error(result.error || "Upload failed.");
          uploaded.push(result.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          errors.push(`${file.name}: ${message}`);
        }
      }
      if (placement === "cover" && uploaded[0]) {
        const cover = uploaded[0];
        setCoverUrl("");
        setSelection((previous) => ({ ...previous, cover }));
      } else if (uploaded.length) {
        setSelection((previous) => ({
          ...previous,
          gallery: [...previous.gallery, ...uploaded],
        }));
      }
      setUploadError(errors.join(" "));
    });
  }

  function addGalleryUrl(): void {
    const url = galleryUrl.trim();
    if (!isImageLink(url)) {
      setUrlError(
        "Enter a valid image URL beginning with https:// or http://.",
      );
      return;
    }
    if (galleryUrls.includes(url)) {
      setUrlError("This photo is already in the gallery.");
      return;
    }
    if (count >= galleryLimit) {
      setUrlError(`Choose up to ${galleryLimit} gallery photos in total.`);
      return;
    }
    setGalleryUrls((previous) => [...previous, url]);
    setGalleryUrl("");
    setUrlError("");
    setUrlEditorOpen(false);
  }

  return (
    <fieldset
      aria-labelledby={`${id}-heading`}
      className="min-w-0 space-y-7 rounded-2xl border bg-card p-4 sm:p-6"
      disabled={pending}
      data-upload-pending={pending || undefined}
    >
      <input type="hidden" name="media" value={JSON.stringify(selection)} />
      <input type="hidden" name="gallery" value={galleryUrls.join("\n")} />
      <div className="space-y-2">
        <h3 id={`${id}-heading`} className="text-lg font-semibold">
          Store Imagery
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload cover and gallery images, or preview store photography.
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Image changes appear publicly after Coffee Sphut approves your request.
        New uploads stay private during review. Removing a photo detaches it
        from this café after approval.
      </p>
      {pending && (
        <p role="status" className="text-sm">
          Uploading photos…
        </p>
      )}
      {uploadError && (
        <p role="alert" className="break-words text-sm text-destructive">
          {uploadError}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold">Store Cover Image</h4>
          <p className="text-sm text-muted-foreground">
            Primary photo or brand logo shown on cards and search results.
          </p>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {coverSrc ? (
            <div className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-xl border bg-muted">
                <PhotoPreview
                  key={coverSrc}
                  src={coverSrc}
                  alt={
                    selection.cover
                      ? "Cover awaiting review"
                      : "Store cover photo"
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setCoverUrl("");
                  setSelection((previous) => ({ ...previous, cover: null }));
                }}
              >
                <Trash2 aria-hidden="true" />
                Remove cover
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverFiles.current?.click()}
              className="flex aspect-video min-h-40 w-full min-w-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4 text-center hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <ImageIcon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">
                No cover image uploaded
              </span>
              <span className="text-xs text-muted-foreground">
                Choose a photo from your device
              </span>
            </button>
          )}
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Upload New Cover Photo</p>
              <input
                ref={coverFiles}
                type="file"
                accept={imageTypes}
                aria-label="Cover image file"
                hidden
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || []);
                  event.currentTarget.value = "";
                  upload(files, "cover");
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => coverFiles.current?.click()}
                >
                  <Upload aria-hidden="true" />
                  Upload cover image
                </Button>
                <span className="text-xs text-muted-foreground">
                  JPEG, PNG or WebP up to 5 MB each
                </span>
              </div>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor={`${id}-cover-url`}>
                Or paste a cover image URL
              </Label>
              <Input
                id={`${id}-cover-url`}
                name="image_url"
                type="url"
                className="min-h-11"
                placeholder="https://..."
                value={coverUrl}
                onChange={(event) => {
                  setCoverUrl(event.currentTarget.value);
                  setSelection((previous) => ({ ...previous, cover: null }));
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold">Store Gallery Photos</h4>
              <Badge variant="outline">
                {count} {count === 1 ? "photo" : "photos"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Interior, exterior, coffee drinks, and storefront photos for the
              mobile gallery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={galleryFiles}
              type="file"
              accept={imageTypes}
              aria-label="Gallery image files"
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files || []);
                event.currentTarget.value = "";
                upload(files, "gallery");
              }}
            />
            <Button
              type="button"
              className="min-h-11"
              onClick={() => galleryFiles.current?.click()}
            >
              <Upload aria-hidden="true" />
              Upload photos
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-expanded={urlEditorOpen}
              aria-controls={`${id}-gallery-editor`}
              onClick={() => setUrlEditorOpen((open) => !open)}
            >
              <Plus aria-hidden="true" />
              Add URL
            </Button>
          </div>
        </div>

        <div
          id={`${id}-gallery-editor`}
          hidden={!urlEditorOpen}
          className="space-y-2 rounded-xl border p-3"
        >
          <Label htmlFor={`${id}-gallery-url`}>Gallery image URL</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-gallery-url`}
              inputMode="url"
              placeholder="https://..."
              className="min-h-11 min-w-0 flex-1"
              value={galleryUrl}
              onChange={(event) => {
                setGalleryUrl(event.currentTarget.value);
                setUrlError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addGalleryUrl();
                }
              }}
            />
            <Button type="button" className="min-h-11" onClick={addGalleryUrl}>
              Add photo
            </Button>
          </div>
          {urlError && (
            <p role="alert" className="text-sm text-destructive">
              {urlError}
            </p>
          )}
        </div>

        {count ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ...galleryUrls.map((url) => ({ src: url, staged: false })),
              ...selection.gallery.map((uploadId) => ({
                src: `/partner/media/${uploadId}`,
                staged: true,
              })),
            ].map(({ src, staged }, index) => (
              <div key={`${src}-${index}`} className="space-y-1">
                <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
                  <PhotoPreview
                    src={src}
                    alt={`Gallery photo ${index + 1}${staged ? " awaiting review" : ""}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remove gallery photo ${index + 1}`}
                  onClick={() => {
                    if (staged) {
                      const stagedIndex = index - galleryUrls.length;
                      setSelection((previous) => ({
                        ...previous,
                        gallery: previous.gallery.filter(
                          (_, i) => i !== stagedIndex,
                        ),
                      }));
                    } else {
                      setGalleryUrls((previous) =>
                        previous.filter((_, i) => i !== index),
                      );
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => galleryFiles.current?.click()}
            className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4 text-center hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">
              No gallery photos added yet
            </span>
            <span className="text-xs text-muted-foreground">
              Choose one or more photos from your device
            </span>
          </button>
        )}
      </div>
    </fieldset>
  );
}
