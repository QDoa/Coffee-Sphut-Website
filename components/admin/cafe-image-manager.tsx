"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Star,
  ExternalLink,
  Plus,
  Loader2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadMediaAction } from "@/app/admin/actions/upload";
import { removedCafeImageUrls } from "@/lib/admin/cafe-images";

interface CafeImageManagerProps {
  initialCoverUrl?: string | null;
  initialGalleryUrls?: string[];
  deleteUploadsOnSave?: boolean;
}

export function CafeImageManager({
  initialCoverUrl = "",
  initialGalleryUrls = [],
  deleteUploadsOnSave = false,
}: CafeImageManagerProps) {
  const [coverUrl, setCoverUrl] = useState<string>(initialCoverUrl || "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialGalleryUrls);
  const [knownUrls, setKnownUrls] = useState<string[]>([initialCoverUrl || "", ...initialGalleryUrls]);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [newUrlInput, setNewUrlInput] = useState("");
  const [showAddUrlInput, setShowAddUrlInput] = useState(false);

  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler for cover image
  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "cafes/covers");

      const res = await uploadMediaAction(formData);
      if (res.error) {
        setUploadError(`Failed to upload cover: ${res.error}`);
      } else if (res.url) {
        setCoverUrl(res.url);
        setKnownUrls((previous) => [...previous, res.url!]);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload cover image");
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  }

  // Upload handler for multiple gallery photos
  async function handleGalleryFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingGallery(true);
      setUploadError(null);

      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "cafes/gallery");

        const res = await uploadMediaAction(formData);
        if (res.url) {
          uploaded.push(res.url);
        } else if (res.error) {
          setUploadError(`Error uploading ${file.name}: ${res.error}`);
        }
      }

      if (uploaded.length > 0) {
        setGalleryUrls((prev) => [...prev, ...uploaded]);
        setKnownUrls((previous) => [...previous, ...uploaded]);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload gallery images");
    } finally {
      setUploadingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    }
  }

  // Remove gallery item
  function handleRemoveGalleryItem(index: number) {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // Promote gallery item to cover
  function handleSetAsCover(url: string) {
    if (coverUrl && !galleryUrls.includes(coverUrl)) {
      setGalleryUrls((prev) => [...prev, coverUrl]);
    }
    setCoverUrl(url);
  }

  // Add gallery image by URL
  function handleAddUrl() {
    const trimmed = newUrlInput.trim();
    if (!trimmed) return;
    if (!galleryUrls.includes(trimmed)) {
      setGalleryUrls((prev) => [...prev, trimmed]);
    }
    setNewUrlInput("");
    setShowAddUrlInput(false);
  }

  return (
    <div className="space-y-8">
      {/* Hidden inputs to feed standard form submission */}
      <input type="hidden" name="image_url" value={coverUrl} />
      <input type="hidden" name="gallery_images" value={galleryUrls.join("\n")} />
      <input type="hidden" name="removed_image_urls" value={JSON.stringify(removedCafeImageUrls(knownUrls, coverUrl, galleryUrls))} />
      <input type="hidden" name="images_uploading" value={uploadingCover || uploadingGallery ? "true" : "false"} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        {deleteUploadsOnSave
          ? "Changes take effect when you save the café. Removed café uploads are permanently deleted; images still used by a café are kept. Other image links are only removed from this café."
          : "Changes take effect when you save the café. Removing an image here keeps its stored file; only admins can permanently delete uploads."}
      </p>

      {uploadError && (
        <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
          {uploadError}
        </div>
      )}

      {/* SECTION 1: COVER IMAGE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Store Cover Image</h3>
            <p className="text-xs text-muted-foreground">
              Primary photo or brand logo shown on cards and search results.
            </p>
          </div>
          {coverUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCoverUrl("")}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove Cover
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-12 items-start">
          {/* Cover preview box */}
          <div className="md:col-span-6 lg:col-span-5">
            {coverUrl ? (
              <div className="relative group rounded-lg overflow-hidden border bg-muted aspect-video flex items-center justify-center">
                <Image
                  src={coverUrl}
                  alt="Cafe Cover"
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPreviewModalUrl(coverUrl)}
                    className="h-8 text-xs gap-1"
                  >
                    <Maximize2 className="h-3.5 w-3.5" /> View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setCoverUrl("")}
                    className="h-8 text-xs gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
                <Badge className="absolute top-2 left-2 bg-black/60 text-white text-[10px] pointer-events-none">
                  Cover Photo
                </Badge>
              </div>
            ) : (
              <div
                onClick={() => coverFileInputRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 aspect-video flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/30"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium">No cover image uploaded</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click to select a photo from your computer
                </p>
              </div>
            )}
          </div>

          {/* Cover controls */}
          <div className="md:col-span-6 lg:col-span-7 space-y-3">
            <div>
              <Label className="text-xs font-medium">Upload New Cover Photo</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingCover}
                  onClick={() => coverFileInputRef.current?.click()}
                  className="gap-1.5 text-xs"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploadingCover ? "Uploading..." : "Upload Cover Image"}
                </Button>
                <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP up to 10MB</span>
              </div>
            </div>

            <div className="pt-2 border-t space-y-1.5">
              <Label htmlFor="manual-cover-url" className="text-xs text-muted-foreground">
                Or paste cover image URL:
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-cover-url"
                  placeholder="https://..."
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GALLERY IMAGES */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Store Gallery Photos</h3>
              <Badge variant="outline" className="text-xs font-mono">
                {galleryUrls.length} {galleryUrls.length === 1 ? "photo" : "photos"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Interior, exterior, coffee drinks, and storefront photos for mobile gallery.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryFilesChange}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              disabled={uploadingGallery}
              onClick={() => galleryFileInputRef.current?.click()}
              className="gap-1.5 text-xs"
            >
              {uploadingGallery ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploadingGallery ? "Uploading..." : "Upload Photos"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddUrlInput(!showAddUrlInput)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add URL
            </Button>
          </div>
        </div>

        {/* Add URL input bar */}
        {showAddUrlInput && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <Label htmlFor="gallery-url-input" className="text-xs font-medium">
              Add Photo by Image URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="gallery-url-input"
                placeholder="https://tcxenxliwzykhxzhlien.supabase.co/..."
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                className="h-8 text-xs font-mono"
              />
              <Button type="button" size="sm" onClick={handleAddUrl} className="h-8 text-xs">
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {galleryUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {galleryUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="group relative rounded-lg overflow-hidden border bg-muted aspect-square flex items-center justify-center"
              >
                <Image
                  src={url}
                  alt={`Gallery photo ${idx + 1}`}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-105"
                />

                {/* Hover overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/90 bg-black/60 px-1.5 py-0.5 rounded font-mono">
                      #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={() => handleRemoveGalleryItem(idx)}
                      className="h-6 w-6"
                      title="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewModalUrl(url)}
                      className="h-7 text-[11px] px-2 gap-1 bg-white/90 text-black hover:bg-white"
                    >
                      <Maximize2 className="h-3 w-3" /> View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetAsCover(url)}
                      className="h-7 text-[11px] px-2 gap-1 bg-white/90 text-black hover:bg-white"
                      title="Set as main cover"
                    >
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> Cover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => galleryFileInputRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 p-8 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium">No gallery photos added yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Click &quot;Upload Photos&quot; to upload multiple store images from your computer
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal for enlarged photo viewing */}
      <Dialog
        open={Boolean(previewModalUrl)}
        onOpenChange={(isOpen) => !isOpen && setPreviewModalUrl(null)}
      >
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full p-4 sm:p-5 bg-neutral-950 border-neutral-800 text-white shadow-2xl">
          <DialogHeader className="pr-10 pb-3 border-b border-neutral-800 text-left">
            <DialogTitle className="text-sm font-semibold text-white tracking-tight">
              Store Photo Preview
            </DialogTitle>
            {previewModalUrl && (
              <p
                className="text-[11px] font-mono text-neutral-400 truncate max-w-[calc(100%-2rem)] mt-0.5"
                title={previewModalUrl}
              >
                {previewModalUrl}
              </p>
            )}
          </DialogHeader>

          {previewModalUrl && (
            <div className="relative w-full h-[62vh] max-h-[640px] rounded-lg overflow-hidden bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-center p-2 my-1">
              <Image
                src={previewModalUrl}
                alt="Enlarged preview"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          )}

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-400 truncate">
              Store photography preview
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="text-xs text-white border-neutral-700 bg-neutral-900 hover:bg-neutral-800 shrink-0"
            >
              <a href={previewModalUrl || "#"} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Original Tab
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
