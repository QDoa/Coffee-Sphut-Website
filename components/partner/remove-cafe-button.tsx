"use client";

import { useActionState } from "react";
import { Archive } from "lucide-react";
import { commandAction } from "@/app/partner/actions";
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

export function RemoveCafeButton({
  cafeId,
  name,
  revision,
  requestId,
}: {
  cafeId: number;
  name: string;
  revision: number;
  requestId: string;
}) {
  const [state, submit, pending] = useActionState(commandAction, {});

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 text-destructive"
        >
          <Archive aria-hidden="true" />
          Remove café
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Coffee Sphut will review your request. Once approved, this café
            will be removed from public listings. Its details and history will
            remain available in the workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={submit} aria-busy={pending} className="space-y-4">
          <input type="hidden" name="operation" value="remove_cafe" />
          <input
            type="hidden"
            name="context"
            value={JSON.stringify({
              cafe_id: cafeId,
              baseline: revision,
              request_id: requestId,
            })}
          />
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={pending}>
              Keep café
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11"
              disabled={pending}
            >
              {pending ? "Submitting…" : "Request removal"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
