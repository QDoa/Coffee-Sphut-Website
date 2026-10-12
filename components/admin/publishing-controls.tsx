"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Clock, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface PublishingControlsProps {
  currentPublishedAt: string | null;
  onPublishNow: () => Promise<void>;
  onSchedule: (scheduleDateIso: string) => Promise<void>;
  onUnpublish: () => Promise<void>;
}

export function PublishingControls({
  currentPublishedAt,
  onPublishNow,
  onSchedule,
  onUnpublish,
}: PublishingControlsProps) {
  const [scheduleInput, setScheduleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPublished =
    currentPublishedAt !== null &&
    new Date(currentPublishedAt).getTime() <= Date.now();

  const isScheduled =
    currentPublishedAt !== null &&
    new Date(currentPublishedAt).getTime() > Date.now();

  const isDraft = currentPublishedAt === null;

  async function handleAction(fn: () => Promise<void>) {
    try {
      setLoading(true);
      await fn();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Publishing Status</CardTitle>
          {isPublished && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              <CheckCircle2 className="h-3 w-3" /> Published
            </Badge>
          )}
          {isScheduled && (
            <Badge variant="secondary" className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
              <Clock className="h-3 w-3" /> Scheduled
            </Badge>
          )}
          {isDraft && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <EyeOff className="h-3 w-3" /> Draft
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs" suppressHydrationWarning>
          {isPublished && (
            <span suppressHydrationWarning>
              Live since {mounted ? new Date(currentPublishedAt!).toLocaleString() : ""}
            </span>
          )}
          {isScheduled && (
            <span suppressHydrationWarning>
              Will automatically go live on{" "}
              {mounted ? new Date(currentPublishedAt!).toLocaleString() : ""}
            </span>
          )}
          {isDraft && "Hidden from public view and mobile apps."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="flex flex-wrap gap-2">
          {!isPublished && (
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={() => handleAction(onPublishNow)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Publish Now
            </Button>
          )}

          {!isDraft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleAction(onUnpublish)}
              className="text-amber-700 hover:text-amber-800 dark:text-amber-400"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Unpublish to Draft
            </Button>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <Label htmlFor="schedule-time" className="text-xs text-muted-foreground">
            Schedule for future release:
          </Label>
          <div className="flex gap-2">
            <Input
              id="schedule-time"
              type="datetime-local"
              value={scheduleInput}
              onChange={(e) => setScheduleInput(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!scheduleInput || loading}
              onClick={() => {
                if (scheduleInput) {
                  const iso = new Date(scheduleInput).toISOString();
                  handleAction(() => onSchedule(iso));
                }
              }}
              className="h-8 text-xs shrink-0"
            >
              Schedule
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
