import Link from "next/link";
import Image from "next/image";
import { PlusCircle, Calendar, CheckCircle2, Clock, EyeOff, MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteEventAction } from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function EventsPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("Event")
    .select("id, title, slug, start_time, end_time, cafe_id, is_featured, published_at, created_at, image_url, Cafe(name)")
    .order("start_time", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Community Events</h1>
          <p className="text-sm text-muted-foreground">
            Manage coffee cuppings, workshops, latte art throwdowns, and roastery tours.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/events/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Event
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Title</TableHead>
              <TableHead>Location / Cafe</TableHead>
              <TableHead>Event Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events && events.length > 0 ? (
              events.map((event: any) => {
                const isPublished =
                  event.published_at !== null &&
                  new Date(event.published_at).getTime() <= Date.now();
                const isScheduled =
                  event.published_at !== null &&
                  new Date(event.published_at).getTime() > Date.now();

                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {event.image_url ? (
                          <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0 border">
                            <Image
                              src={event.image_url}
                              alt={event.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground border">
                            <Calendar className="h-5 w-5" />
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="font-medium hover:underline flex items-center gap-2 truncate"
                          >
                            <span className="truncate">{event.title}</span>
                            {event.is_featured && (
                              <Badge variant="secondary" className="gap-1 text-xs py-0 shrink-0">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> Featured
                              </Badge>
                            )}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            /{event.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.Cafe?.name ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {event.Cafe.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(event.start_time).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      {isPublished ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      ) : isScheduled ? (
                        <Badge variant="secondary" className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Scheduled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/events/${event.id}`}>Edit</Link>
                        </Button>
                        {staff.role === "admin" && (
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deleteEventAction(event.id);
                            }}
                            title={`Delete ${event.title}?`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  No events found. Click &quot;New Event&quot; to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
