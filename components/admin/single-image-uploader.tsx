"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Loader2,
  Maximize2,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadMediaAction } from "@/app/admin/actions/upload";
import { cn } from "@/lib/utils";

interface SingleImageUploaderProps {
  name: string;
  initialUrl?: string | null;
  label?: string;
  description?: string;
  shape?: "rectangle" | "square" | "circle";
  onChange?: (url: string) => void;
  className?: string;
}

export function SingleImageUploader({
  name,
  initialUrl = "",
  label = "Cover Image",
  description,
  shape = "rectangle",
  onChange,
  className,
}: SingleImageUploaderProps) {
  const [url, setUrl] = useState<string>(initialUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputVal, setUrlInputVal] = useState(initialUrl || "");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initialUrl if it changes from outside
  useEffect(() => {
    if (initialUrl !== undefined && initialUrl !== null) {
      setUrl(initialUrl);
      setUrlInputVal(initialUrl);
    }
  }, [initialUrl]);

  const handleUpdateUrl = (newUrl: string) => {
    setUrl(newUrl);
    setUrlInputVal(newUrl);
    onChange?.(newUrl);
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadMediaAction(formData);
      if (res?.error) {
        setUploadError(res.error);
      } else if (res?.url) {
        handleUpdateUrl(res.url);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const isCircle = shape === "circle";
  const isSquare = shape === "square";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Hidden input for server actions / form data */}
      <input type="hidden" name={name} value={url} />

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleUpdateUrl("")}
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove Image
          </Button>
        )}
      </div>

      {uploadError && (
        <div className="p-2.5 text-xs rounded bg-destructive/15 text-destructive border border-destructive/20">
          {uploadError}
        </div>
      )}

      {/* Main Container - Responsive flex layout preventing card overflow */}
      <div className="flex flex-col sm:flex-row gap-4 items-start min-w-0">
        {/* Preview Container */}
        <div className="shrink-0">
          {url ? (
            <div
              className={cn(
                "relative group overflow-hidden border bg-muted/40 flex items-center justify-center shadow-xs",
                isCircle
                  ? "w-28 h-28 rounded-full"
                  : isSquare
                  ? "w-32 h-32 rounded-lg"
                  : "w-48 h-32 rounded-lg sm:w-44 sm:h-28"
              )}
            >
              <Image
                src={url}
                alt={label}
                fill
                unoptimized
                className={isCircle ? "object-cover" : "object-contain p-1"}
              />
              {/* Hover overlay controls */}
              <div
                className={cn(
                  "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5",
                  isCircle && "rounded-full"
                )}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviewModalOpen(true)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Maximize2 className="h-3 w-3" /> View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleUpdateUrl("")}
                  className="h-7 px-2 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/30",
                isCircle
                  ? "w-28 h-28 rounded-full"
                  : isSquare
                  ? "w-32 h-32 rounded-lg"
                  : "w-48 h-32 rounded-lg sm:w-44 sm:h-28"
              )}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                <ImageIcon className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-medium leading-tight">No image</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click to upload</p>
            </div>
          )}
        </div>

        {/* Upload & URL actions */}
        <div className="flex-1 min-w-0 space-y-2.5 w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs h-8 shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading..." : url ? "Replace" : "Upload File"}
            </Button>

            {url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalOpen(true)}
                className="gap-1.5 text-xs h-8 shrink-0"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                View Full
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-xs text-muted-foreground hover:text-foreground h-8 shrink-0"
            >
              <LinkIcon className="h-3.5 w-3.5 mr-1" />
              {showUrlInput ? "Hide Link" : "Link"}
            </Button>
          </div>

          {/* Optional manual URL input */}
          {showUrlInput && (
            <div className="flex items-center gap-2 pt-0.5 max-w-full">
              <Input
                type="url"
                value={urlInputVal}
                onChange={(e) => setUrlInputVal(e.target.value)}
                placeholder="https://..."
                className="text-xs h-8 font-mono min-w-0 flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => handleUpdateUrl(urlInputVal.trim())}
                className="text-xs h-8 shrink-0"
              >
                Apply
              </Button>
            </div>
          )}

          {url && !showUrlInput && (
            <p
              className="text-[11px] text-muted-foreground font-mono truncate max-w-full block"
              title={url}
            >
              {url}
            </p>
          )}
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full p-4 sm:p-5 bg-neutral-950 border-neutral-800 text-white shadow-2xl">
          <DialogHeader className="pr-10 pb-3 border-b border-neutral-800 text-left">
            <DialogTitle className="text-sm font-semibold text-white tracking-tight">
              {label || "Image Preview"}
            </DialogTitle>
            {url && (
              <p
                className="text-[11px] font-mono text-neutral-400 truncate max-w-[calc(100%-2rem)] mt-0.5"
                title={url}
              >
                {url}
              </p>
            )}
          </DialogHeader>

          {url && (
            <div className="relative w-full h-[62vh] max-h-[640px] rounded-lg overflow-hidden bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-center p-2 my-1">
              <Image
                src={url}
                alt={label}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          )}

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-400 truncate">
              Previewing posted image
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="text-xs text-white border-neutral-700 bg-neutral-900 hover:bg-neutral-800 shrink-0"
            >
              <a href={url || "#"} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Original Tab
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
