import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { SingleImageUploader } from "@/components/admin/single-image-uploader";
import {
  saveEventAction,
  setEventPublishStatusAction,
} from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PublishingControls } from "@/components/admin/publishing-controls";
import { HistoryPanel } from "@/components/admin/history-panel";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface EventEditPageProps {
  params: Promise<{ id: string }>;
}

function toLocalIso(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EventEditPage({ params }: EventEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();

  const { data: cafes } = await supabase
    .from("Cafe")
    .select("id, name")
    .order("name", { ascending: true });

  let event = null;

  if (!isNew) {
    const { data } = await supabase
      .from("Event")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    event = data;
  }

  const formAction = async (formData: FormData) => {
    "use server";
    const res = await saveEventAction(isNew ? null : id, formData);
    if (res?.error) throw new Error(res.error);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/events">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {!isNew && event?.image_url && (
            <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-muted border shrink-0 shadow-sm">
              <Image
                src={event.image_url}
                alt={event.title || "Event"}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "Create New Event" : `Edit Event: ${event?.title}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <form action={formAction} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Information</CardTitle>
                <CardDescription>Event title, schedule, location, and details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input id="title" name="title" defaultValue={event?.title || ""} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug URL *</Label>
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={event?.slug || ""}
                    placeholder="weekend-cupping-session"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Date & Time *</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="datetime-local"
                      defaultValue={toLocalIso(event?.start_time)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Date & Time</Label>
                    <Input
                      id="end_time"
                      name="end_time"
                      type="datetime-local"
                      defaultValue={toLocalIso(event?.end_time)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cafe_id">Hosted at Cafe (Optional)</Label>
                  <select
                    id="cafe_id"
                    name="cafe_id"
                    defaultValue={event?.cafe_id || ""}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">No linked cafe (Custom location)</option>
                    {cafes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Custom Address / Location Notes</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={event?.address || ""}
                    placeholder="e.g. 124 Main Street, Studio Room B"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link">Registration / RSVP Link</Label>
                  <Input
                    id="link"
                    name="link"
                    type="url"
                    defaultValue={event?.link || ""}
                    placeholder="https://eventbrite.com/..."
                  />
                </div>

                <SingleImageUploader
                  name="image_url"
                  initialUrl={event?.image_url}
                  label="Event Banner Image"
                  description="Cover banner displayed on event cards and RSVP pages."
                />

                <div className="space-y-2">
                  <Label htmlFor="description">Event Description</Label>
                  <RichTextEditor
                    id="description"
                    name="description"
                    defaultValue={event?.description || ""}
                    rows={6}
                    placeholder="Details about the tasting, host, prerequisites..."
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <input
                    type="checkbox"
                    id="is_featured"
                    name="is_featured"
                    defaultChecked={event?.is_featured || false}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="is_featured" className="cursor-pointer">
                    Feature this event on the home banner
                  </Label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button asChild variant="outline">
                    <Link href="/admin/events">Cancel</Link>
                  </Button>
                  <Button type="submit">Save Event</Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Sidebar controls */}
        <div className="space-y-6">
          {!isNew && (
            <PublishingControls
              currentPublishedAt={event?.published_at || null}
              onPublishNow={async () => {
                "use server";
                await setEventPublishStatusAction(id, new Date().toISOString());
              }}
              onSchedule={async (isoDate) => {
                "use server";
                await setEventPublishStatusAction(id, isoDate);
              }}
              onUnpublish={async () => {
                "use server";
                await setEventPublishStatusAction(id, null);
              }}
            />
          )}

          {!isNew && <HistoryPanel tableName="Event" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
