"use client";

import { useActionState, useId, useState, type Dispatch, type SetStateAction } from "react";
import {
  commandAction,
  editManagerAccess,
  type PortalActionState,
} from "@/app/partner/actions";
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

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ManagerRole = "chain_manager" | "cafe_manager";
type CafeOption = { id: string; name: string; unavailable?: boolean };

interface InviteManagerFormProps {
  requestId: string;
  cafes: CafeOption[];
}

export function InviteManagerForm({ requestId, cafes }: InviteManagerFormProps) {
  const emailId = useId();
  const [role, setRole] = useState<ManagerRole>("chain_manager");
  const [assigned, setAssigned] = useState<string[]>([]);

  return (
    <ActionForm
      operation="invite"
      context={{ request_id: requestId }}
      label="Create invitation link"
      submitDisabled={role === "cafe_manager" && !assigned.length}
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
      <ManagerRoleFields
        role={role}
        onRoleChange={(nextRole) => {
          setRole(nextRole);
          setAssigned([]);
        }}
        cafes={cafes}
        assigned={assigned}
        setAssigned={setAssigned}
      />
    </ActionForm>
  );
}

interface ManagerRoleFieldsProps {
  role: ManagerRole;
  onRoleChange: (role: ManagerRole) => void;
  cafes: CafeOption[];
  assigned: string[];
  setAssigned: Dispatch<SetStateAction<string[]>>;
}

function ManagerRoleFields({
  role,
  onRoleChange,
  cafes,
  assigned,
  setAssigned,
}: ManagerRoleFieldsProps) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Role</legend>
        {([
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
        ] as const).map(({ value, label, description }) => (
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
              onChange={() => onRoleChange(value)}
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === "cafe_manager" && (
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-medium">Assign cafés</legend>
          <p className="mb-2 text-xs text-muted-foreground">
            {cafes.some((cafe) => !cafe.unavailable)
              ? "Select at least one available café."
              : "No cafés are available to assign."}
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
    </>
  );
}

interface EditManagerAccessProps {
  id: string;
  email: string;
  role: ManagerRole;
  assignedIds: number[];
  cafes: CafeOption[];
}

export function EditManagerAccess(props: EditManagerAccessProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setMessage("");
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-label={`Edit access for ${props.email}`}
          >
            Edit access
          </Button>
        </DialogTrigger>
        {open && (
          <EditManagerAccessForm
            {...props}
            onSaved={(notice) => {
              setMessage(notice);
              setOpen(false);
            }}
          />
        )}
      </Dialog>
      {message && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

function EditManagerAccessForm({
  id,
  email,
  role: savedRole,
  assignedIds,
  cafes,
  onSaved,
}: EditManagerAccessProps & { onSaved: (message: string) => void }) {
  // Keep the baseline from when the dialog opened, even if the page refreshes.
  const [baseline] = useState({ role: savedRole, ids: assignedIds });
  const [role, setRole] = useState(savedRole);
  const [assigned, setAssigned] = useState(assignedIds.map(String));
  const [state, submit, pending] = useActionState<PortalActionState, FormData>(
    async (_previous, form) => {
      const result = await editManagerAccess(id, baseline.role, baseline.ids, form);
      if (result.message) onSaved(result.message);
      return result;
    },
    {},
  );
  const unavailable = baseline.ids
    .filter((cafeId) => !cafes.some((cafe) => cafe.id === String(cafeId)))
    .map((cafeId, index) => ({
      id: String(cafeId),
      name: `Unavailable café ${index + 1}`,
      unavailable: true,
    }));
  const hasAvailableCafe = cafes.some((cafe) => assigned.includes(cafe.id));
  const changed =
    role !== baseline.role ||
    (role === "cafe_manager" &&
      (assigned.length !== baseline.ids.length ||
        baseline.ids.some((cafeId) => !assigned.includes(String(cafeId)))));

  return (
    <DialogContent
      showCloseButton={false}
      className="max-h-[90svh] overflow-y-auto"
      onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault();
      }}
      onInteractOutside={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit manager access</DialogTitle>
        <DialogDescription className="[overflow-wrap:anywhere]">
          Update the role and café access for {email}.
        </DialogDescription>
      </DialogHeader>
      <form action={submit} aria-busy={pending} className="space-y-4">
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <ManagerRoleFields
            role={role}
            onRoleChange={setRole}
            cafes={[...cafes, ...unavailable]}
            assigned={assigned}
            setAssigned={setAssigned}
          />
          {role === "cafe_manager" && unavailable.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Unavailable cafés are existing assignments outside current
              workspace access. You can keep or remove them.
            </p>
          )}
          {role === "chain_manager" && role !== baseline.role && baseline.ids.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This replaces individual café assignments with chain-wide access.
            </p>
          )}
        </fieldset>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="min-h-11" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            className="min-h-11"
            disabled={pending || !changed || (role === "cafe_manager" && !hasAvailableCafe)}
          >
            {pending ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
