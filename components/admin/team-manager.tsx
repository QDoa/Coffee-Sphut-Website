"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Shield, UserCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  inviteStaffMemberAction,
  updateStaffRoleAction,
  removeStaffMemberAction,
} from "@/app/admin/(dashboard)/team/actions";

interface TeamMember {
  user_id: string;
  email: string;
  role: "admin" | "editor";
  created_at: string;
}

export function TeamManager({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor">("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await inviteStaffMemberAction(inviteEmail, inviteRole);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setInviteOpen(false);
      setInviteEmail("");
      router.refresh();
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "editor") => {
    const res = await updateStaffRoleAction(userId, newRole);
    if (res?.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;
    const res = await removeStaffMemberAction(userId);
    if (res?.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to the admin dashboard and their permission roles.
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite Staff Member</DialogTitle>
                <DialogDescription>
                  Grant dashboard access to an existing or new team member.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="p-3 my-2 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email Address *</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="teammate@coffeesphut.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="staff-role">Role</Label>
                  <select
                    id="staff-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="editor">Editor (Content, Cafes & Recipes)</option>
                    <option value="admin">Admin (Full access + Deletes & Team)</option>
                  </select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Send Invite / Add
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teammate</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;

              return (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {member.role === "admin" ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {member.email}
                          {isSelf && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {member.user_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.user_id, e.target.value as "admin" | "editor")
                      }
                      disabled={isSelf}
                      className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(member.user_id, member.email)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Revoke access"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
