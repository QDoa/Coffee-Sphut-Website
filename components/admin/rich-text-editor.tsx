"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Quote,
  Code,
  RotateCcw,
  Image as ImageIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { uploadMediaAction } from "@/app/admin/actions/upload";

export interface RichTextEditorProps {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  rows?: number;
  uploadFolder?: string;
}

export function RichTextEditor({
  id,
  name,
  defaultValue = "",
  value: controlledValue,
  onChange,
  placeholder = "Write something...",
  minHeight = "140px",
  className,
  rows,
  uploadFolder = "content",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [content, setContent] = useState<string>(controlledValue ?? defaultValue ?? "");
  const [isSourceMode, setIsSourceMode] = useState(false);
  const isControlled = controlledValue !== undefined;

  // Image modal state
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageAltInput, setImageAltInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isControlled && controlledValue !== undefined) {
      setContent(controlledValue);
      if (editorRef.current && editorRef.current.innerHTML !== controlledValue) {
        editorRef.current.innerHTML = controlledValue;
      }
    }
  }, [controlledValue, isControlled]);

  // Initial content setup for uncontrolled usage
  useEffect(() => {
    if (!isControlled && editorRef.current && defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // Normalize empty content
    const clean = html === "<p><br></p>" || html === "<br>" ? "" : html;
    setContent(clean);
    onChange?.(clean);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    onChange?.(val);
    if (editorRef.current) {
      editorRef.current.innerHTML = val;
    }
  };

  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const executeCommand = (command: string, arg?: string) => {
    if (isSourceMode) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleBlockStyle = (style: string) => {
    if (isSourceMode) return;
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, style);
    handleInput();
  };

  const handleInsertLink = () => {
    if (isSourceMode) return;
    const url = prompt("Enter link URL (e.g. https://...):", "");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  const handleRemoveLink = () => {
    executeCommand("unlink");
  };

  // Insert image HTML at cursor
  const insertImageAtCursor = (src: string, alt: string = "") => {
    if (isSourceMode) {
      const imgTag = `<img src="${src}" alt="${alt}" />`;
      setContent((prev) => prev + imgTag);
      onChange?.(content + imgTag);
      return;
    }

    editorRef.current?.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const img = document.createElement("img");
      img.src = src;
      img.alt = alt;
      img.className = "rounded-lg max-w-full my-3 border shadow-xs object-cover";

      range.deleteContents();
      range.insertNode(img);

      // Create a newline/paragraph after image for easier typing
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      range.setStartAfter(img);
      range.insertNode(p);

      range.setStartAfter(p);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand("insertImage", false, src);
    }

    handleInput();
  };

  // Upload an image file to Supabase storage
  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", uploadFolder);

    try {
      const res = await uploadMediaAction(formData);
      if (res?.error) {
        setUploadError(res.error);
      } else if (res?.url) {
        insertImageAtCursor(res.url, file.name.replace(/\.[^/.]+$/, ""));
        setImageDialogOpen(false);
        setImageUrlInput("");
        setImageAltInput("");
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle direct file input selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Insert image from URL input
  const handleInsertFromUrl = () => {
    if (!imageUrlInput.trim()) return;
    insertImageAtCursor(imageUrlInput.trim(), imageAltInput.trim());
    setImageDialogOpen(false);
    setImageUrlInput("");
    setImageAltInput("");
  };

  // Handle drag and drop files onto the editor
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        saveCurrentSelection();
        handleUploadFile(file);
      }
    }
  };

  // Handle paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        saveCurrentSelection();
        handleUploadFile(file);
      }
    }
  };

  const calculatedMinHeight = rows ? `${rows * 28}px` : minHeight;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background shadow-xs focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden",
        className
      )}
    >
      {/* Hidden input for standard Next.js form submissions */}
      {name && <input type="hidden" id={id} name={name} value={content} />}

      {/* Hidden file input for file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5 text-muted-foreground select-none">
        {/* Style selection */}
        <select
          onChange={(e) => handleBlockStyle(e.target.value)}
          defaultValue="p"
          disabled={isSourceMode}
          className="h-7 rounded border border-input bg-background px-2 text-xs font-medium focus:outline-none mr-1"
          title="Text Style"
        >
          <option value="p">Normal text</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="h4">Heading 3</option>
          <option value="blockquote">Quote block</option>
          <option value="pre">Code block</option>
        </select>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Basic formatting */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("bold");
          }}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("italic");
          }}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("underline");
          }}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("strikeThrough");
          }}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Lists & Quotes */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertUnorderedList");
          }}
          title="Bulleted List"
        >
          <List className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertOrderedList");
          }}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            handleBlockStyle("blockquote");
          }}
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Links */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            handleInsertLink();
          }}
          title="Insert Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            handleRemoveLink();
          }}
          title="Remove Link"
        >
          <Unlink className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Image insertion button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode || isUploading}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => {
            saveCurrentSelection();
            setImageDialogOpen(true);
          }}
          title="Insert Image"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Clear formatting */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSourceMode}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("removeFormat");
          }}
          title="Clear formatting"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>

        {/* Source mode toggle */}
        <div className="ml-auto flex items-center">
          <Button
            type="button"
            variant={isSourceMode ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs gap-1 font-mono"
            onClick={() => {
              if (isSourceMode && editorRef.current) {
                editorRef.current.innerHTML = content;
              }
              setIsSourceMode(!isSourceMode);
            }}
            title="Toggle HTML Source"
          >
            <Code className="h-3.5 w-3.5" />
            {isSourceMode ? "Visual" : "HTML"}
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      {isSourceMode ? (
        <textarea
          value={content}
          onChange={handleSourceChange}
          placeholder={placeholder}
          style={{ minHeight: calculatedMinHeight }}
          className="w-full p-3 font-mono text-xs bg-muted/20 text-foreground resize-y focus:outline-none"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          onDrop={handleDrop}
          onPaste={handlePaste}
          style={{ minHeight: calculatedMinHeight }}
          data-placeholder={placeholder}
          className={cn(
            "p-3.5 text-sm text-foreground focus:outline-none overflow-y-auto",
            "prose prose-sm dark:prose-invert max-w-none",
            "[&_p]:my-1.5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-1.5",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2",
            "[&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer",
            "[&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-3 [&_img]:border [&_img]:shadow-xs [&_img]:block",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60 empty:before:pointer-events-none"
          )}
        />
      )}

      {/* Image Insertion Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Insert Image
            </DialogTitle>
          </DialogHeader>

          {uploadError && (
            <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
              {uploadError}
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Option 1: File Upload */}
            <div className="space-y-2">
              <Label>Upload Image from Device</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-muted/40 transition-colors flex flex-col items-center justify-center gap-2"
              >
                {isUploading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Uploading image to Supabase Storage...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Click to choose image or drag & drop directly into the editor
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t" />
              <span className="bg-background px-2 text-[11px] text-muted-foreground uppercase font-semibold">
                Or via URL
              </span>
            </div>

            {/* Option 2: Image URL */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="image-url" className="text-xs">Image URL *</Label>
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="image-alt" className="text-xs">Alt Text / Caption (Optional)</Label>
                <Input
                  id="image-alt"
                  placeholder="A cup of pour-over coffee"
                  value={imageAltInput}
                  onChange={(e) => setImageAltInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageDialogOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInsertFromUrl}
              disabled={isUploading || !imageUrlInput.trim()}
            >
              Insert URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
