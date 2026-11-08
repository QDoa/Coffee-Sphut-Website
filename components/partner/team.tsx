import { randomUUID } from "node:crypto";
import { MailPlus, Users } from "lucide-react";
import type { PortalData } from "@/lib/partner/portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditManagerAccess, InviteManagerForm, RevokeTeamAccess } from "./team-controls";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  chain_manager: "Chain Manager",
  cafe_manager: "Café Manager",
};

const ROLE_ACCESS: Record<string, string> = {
  owner: "Team, plan, and all accessible cafés",
  chain_manager: "All accessible cafés",
  cafe_manager: "Assigned cafés",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function Team({ data, loadedAt }: { data: PortalData; loadedAt: number }) {
  const cafes = data.cafes.map((cafe) => ({
    id: String(cafe.id),
    name: `${cafe.name}${cafe.is_active === false ? " (archived)" : ""}`,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const cafeNames = new Map(cafes.map(({ id, name }) => [id, name]));
  const members = data.members.map((member) => ({
    id: String(member.id),
    email: String(member.email),
    role: String(member.role),
    you: member.user_id === data.actor,
    active: !member.revoked_at,
  })).sort((a, b) => Number(b.you) - Number(a.you) || a.email.localeCompare(b.email));
  const invitations = data.invitations.map((invitation) => {
    const expires = new Date(String(invitation.expires_at));
    const status = invitation.revoked_at ? "Revoked" : invitation.accepted_at
      ? "Accepted" : expires.getTime() <= loadedAt ? "Expired" : "Pending";
    return {
      id: String(invitation.id),
      email: String(invitation.email),
      role: String(invitation.role),
      cafeIds: Array.isArray(invitation.cafe_ids) ? invitation.cafe_ids.map(String) : [],
      status,
      expires,
    };
  }).sort((a, b) => b.expires.getTime() - a.expires.getTime());
  const active = members.filter((member) => member.active);
  const former = members.filter((member) => !member.active);
  const pending = invitations.filter((invitation) => invitation.status === "Pending");
  const history = invitations.filter((invitation) => invitation.status !== "Pending");

  function memberRows(rows: typeof members) {
    return rows.map(({ id, email, role, you, active }) => {
      const assignedIds = data.manager_assignments[id] ?? [];
      const assignedNames = assignedIds
        .map((cafeId) => cafeNames.get(String(cafeId)))
        .filter(Boolean);
      const unavailable = assignedIds.length - assignedNames.length;
      const scope = role === "cafe_manager" && active
        ? [
            ...assignedNames,
            unavailable ? `${unavailable} unavailable ${unavailable === 1 ? "café" : "cafés"}` : "",
          ].filter(Boolean).join(", ") || "No cafés assigned"
        : ROLE_ACCESS[role];
      return (
        <li key={id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{email}</p>
              {you && <Badge variant="secondary">You</Badge>}
            </div>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {ROLE_LABELS[role]} <span aria-hidden="true">·</span> {scope}
            </p>
          </div>
          {active && (role === "chain_manager" || role === "cafe_manager") && (
            <div className="flex flex-wrap items-start gap-1">
              <EditManagerAccess id={id} email={email} role={role} assignedIds={assignedIds} cafes={cafes} />
              <RevokeTeamAccess id={id} email={email} requestId={randomUUID()} />
            </div>
          )}
          {!active && <Badge variant="outline">Access removed</Badge>}
        </li>
      );
    });
  }

  function invitationRows(rows: typeof invitations) {
    return rows.map(({ id, email, role, cafeIds, status, expires }) => (
      <li key={id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{email}</p>
            <Badge variant="outline" className={status === "Pending" ? "bg-amber-100 text-amber-950" : undefined}>
              {status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {ROLE_LABELS[role]} <span aria-hidden="true">·</span>{" "}
            {role === "cafe_manager"
              ? cafeIds.map((cafeId) => cafeNames.get(cafeId) || "Unavailable café").join(", ") || "No cafés assigned"
              : ROLE_ACCESS[role]}
          </p>
          {status === "Pending" && (
            <p className="text-xs text-muted-foreground">
              Expires <time dateTime={expires.toISOString()}>{DATE_FORMAT.format(expires)} UTC</time>
            </p>
          )}
        </div>
        {status === "Pending" && (
          <RevokeTeamAccess id={id} email={email} requestId={randomUUID()} invitation />
        )}
      </li>
    ));
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Invite managers and control who can access your partner workspace.
        </p>
        <Button asChild className="min-h-11">
          <a href="#invite-manager">
            <MailPlus aria-hidden="true" />
            Invite a manager
          </a>
        </Button>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="members-heading" className="rounded-2xl border bg-card">
            <div className="flex items-center gap-3 border-b p-4 sm:p-5">
              <Users className="size-5 text-primary" aria-hidden="true" />
              <h2 id="members-heading" className="font-semibold">Team members</h2>
              <Badge variant="secondary">{active.length} active</Badge>
            </div>
            <ul className="divide-y">{memberRows(active)}</ul>
            {former.length > 0 && (
              <details className="border-t">
                <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">
                  Former members ({former.length})
                </summary>
                <ul className="divide-y border-t">{memberRows(former)}</ul>
              </details>
            )}
          </section>
          <section aria-labelledby="invitations-heading" className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5">
              <h2 id="invitations-heading" className="font-semibold">Invitations</h2>
              <Badge variant="secondary">{pending.length} pending</Badge>
            </div>
            {pending.length ? (
              <ul className="divide-y">{invitationRows(pending)}</ul>
            ) : (
              <p className="p-4 text-sm text-muted-foreground sm:p-5">No pending invitations.</p>
            )}
            {history.length > 0 && (
              <details className="border-t">
                <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">
                  Invitation history ({history.length})
                </summary>
                <ul className="divide-y border-t">{invitationRows(history)}</ul>
              </details>
            )}
          </section>
        </div>
        <section id="invite-manager" tabIndex={-1} aria-labelledby="invite-manager-heading" className="min-w-0 scroll-mt-4 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="space-y-1">
            <h2 id="invite-manager-heading" className="font-semibold">Invite a manager</h2>
            <p className="text-sm text-muted-foreground">
              Create a link and share it with the invited manager. It expires in seven days.
            </p>
          </div>
          <InviteManagerForm requestId={randomUUID()} cafes={cafes} />
        </section>
      </div>
    </>
  );
}
