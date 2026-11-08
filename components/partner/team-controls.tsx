"use client";

import { useActionState, useId, useState } from "react";
import { commandAction } from "@/app/partner/actions";
import { ActionForm } from "./action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface InviteManagerFormProps {
  requestId: string;
  cafes: { id: string; name: string }[];
}

export function InviteManagerForm({ requestId, cafes }: InviteManagerFormProps) {
  const emailId = useId();
  const [role, setRole] = useState("chain_manager");
  const [assigned, setAssigned] = useState<string[]>([]);
  const cafeManager = role === "cafe_manager";

  return (
    <ActionForm
      operation="invite"
      context={{ request_id: requestId }}
      label="Create invitation link"
      submitDisabled={cafeManager && !assigned.length}
    >
      <div className="space-y-2">
        <label htmlFor={emailId} className="text-sm font-medium">
          Manager email
        </label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="manager@example.com"
          className="min-h-11"
          required
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Role</legend>
        {[
          {
            value: "chain_manager",
            label: "Chain Manager",
            description: "Manages operations across accessible cafés.",
          },
          {
            value: "cafe_manager",
            label: "Café Manager",
            description: "Manages operations at the cafés you assign.",
          },
        ].map(({ value, label, description }) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 has-checked:border-primary/40 has-checked:bg-primary/5"
          >
            <input
              className="mt-1 size-4 shrink-0 accent-primary"
              type="radio"
              name="role"
              value={value}
              checked={role === value}
              onChange={() => {
                setRole(value);
                setAssigned([]);
              }}
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {cafeManager && (
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-medium">Assign cafés</legend>
          <p className="mb-2 text-xs text-muted-foreground">
            {cafes.length ? "Select at least one café." : "No cafés are available to assign."}
          </p>
          {cafes.length > 0 && (
            <div className="max-h-56 divide-y overflow-y-auto rounded-xl border bg-background">
              {cafes.map((cafe) => (
                <label key={cafe.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    className="size-4 shrink-0 accent-primary"
                    type="checkbox"
                    name="cafe_ids"
                    value={cafe.id}
                    checked={assigned.includes(cafe.id)}
                    onChange={(event) => {
                      const include = event.currentTarget.checked;
                      setAssigned((current) =>
                        include
                          ? [...current, cafe.id]
                          : current.filter((id) => id !== cafe.id),
                      );
                    }}
                  />
                  <span className="[overflow-wrap:anywhere]">{cafe.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </ActionForm>
  );
}

interface RevokeTeamAccessProps {
  id: string;
  email: string;
  requestId: string;
  invitation?: boolean;
}

export function RevokeTeamAccess({ id, email, requestId, invitation }: RevokeTeamAccessProps) {
  const [state, submit, pending] = useActionState(commandAction, {});
  const label = invitation ? "Revoke invitation" : "Remove access";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-primary"
          aria-label={`${label} for ${email}`}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault();
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {invitation
              ? `The invitation link for ${email} will stop working.`
              : `${email} will lose access to this partner workspace.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={submit} aria-busy={pending} className="space-y-4">
          <input type="hidden" name="operation" value={invitation ? "revoke_invite" : "revoke_member"} />
          <input type="hidden" name="context" value={JSON.stringify({ id, request_id: requestId })} />
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" className="min-h-11" disabled={pending}>
              {pending ? "Updating…" : label}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
