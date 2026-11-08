"use client";

import { useActionState } from "react";
import { discardCafeChange } from "@/app/partner/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DiscardCafeChangeButtonProps {
  id: string;
  name: string;
  status: "draft" | "pending";
}

export function DiscardCafeChangeButton({
  id,
  name,
  status,
}: DiscardCafeChangeButtonProps) {
  const [state, submit, pending] = useActionState(
    discardCafeChange.bind(null, id, status),
    {},
  );
  const draft = status === "draft";
  const label = draft ? "Discard draft" : "Withdraw removal request";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-destructive"
          aria-label={`${label} for ${name}`}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {draft
              ? `The saved draft for ${name} will be discarded. Any published café details stay as they are.`
              : `This takes the removal request for ${name} out of the review queue and keeps the café listed.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={submit} aria-busy={pending} className="space-y-4">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={pending}>
              {draft ? "Keep draft" : "Keep request"}
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11"
              disabled={pending}
            >
              {pending ? "Removing…" : label}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
