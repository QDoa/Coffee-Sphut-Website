import Link from "next/link";
import { markReviewNotificationRead } from "@/app/partner/actions";
import type { PortalData, ReviewNotificationsData } from "@/lib/partner/portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "./action-form";

export function ReviewNotifications({
  data,
  notifications,
}: {
  data: PortalData;
  notifications: ReviewNotificationsData | null;
}) {
  let dateFormat: Intl.DateTimeFormat;
  try {
    dateFormat = new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: data.timezone || "UTC",
    });
  } catch {
    dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  }

  return (
    <section aria-labelledby="review-updates-heading" className="rounded-2xl border bg-card">
      <header className="space-y-1 border-b p-4 sm:p-5">
        <h2 id="review-updates-heading" className="font-semibold">Café review updates</h2>
        <p className="text-sm text-muted-foreground">
          Decisions and reviewer feedback on requests you submitted.
        </p>
        {notifications && <p className="text-sm font-medium">{notifications.unread} unread</p>}
      </header>
      {!notifications ? (
        <p role="alert" className="p-5 text-sm text-destructive">
          Could not load review notifications. Refresh the page to try again.
        </p>
      ) : notifications.updates.length ? (
        <ul className="divide-y">
          {notifications.updates.map((update) => {
            const name = update.name || String(data.cafes.find((cafe) => cafe.id === update.cafe_id)?.name || "Café request");
            const query = new URLSearchParams({ change: update.id });
            if (update.cafe_id !== null) query.set("id", String(update.cafe_id));
            return (
              <li key={update.id} className={`space-y-3 p-4 sm:p-5 ${update.read ? "" : "bg-primary/5"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 font-medium [overflow-wrap:anywhere]">{name}</h3>
                  <Badge variant={update.status === "approved" ? "secondary" : "outline"}>
                    {update.status === "approved" ? "Approved" : "Changes requested"}
                  </Badge>
                  {!update.read && <Badge>Unread</Badge>}
                </div>
                <time dateTime={update.reviewed_at} className="block text-sm text-muted-foreground">
                  {dateFormat.format(new Date(update.reviewed_at))}
                </time>
                {update.reason && <p className="text-sm [overflow-wrap:anywhere]">{update.reason}</p>}
                <div className="flex flex-wrap items-start gap-2">
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={`/partner/cafe?${query}`} prefetch={false}>Open request</Link>
                  </Button>
                  {!update.read && (
                    <ActionForm action={markReviewNotificationRead} label="Mark as read">
                      <input type="hidden" name="notification_id" value={update.id} />
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-5 text-sm text-muted-foreground">Review decisions will appear here.</p>
      )}
      {notifications && notifications.total > 20 && (
        <nav aria-label="Notification pages" className="flex flex-wrap items-center gap-3 border-t p-4 text-sm sm:p-5">
          {notifications.page > 1 && (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`?page=${notifications.page - 1}`}>Previous page</Link>
            </Button>
          )}
          <span>Page {notifications.page} of {Math.ceil(notifications.total / 20)}</span>
          {notifications.page * 20 < notifications.total && (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`?page=${notifications.page + 1}`}>Next page</Link>
            </Button>
          )}
        </nav>
      )}
    </section>
  );
}
