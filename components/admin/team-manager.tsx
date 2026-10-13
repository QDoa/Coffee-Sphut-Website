"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Shield,
  UserCheck,
  Trash2,
  Loader2,
  Users,
  Mail,
  Search,
  Check,
  X,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  inviteStaffMemberAction,
  addExistingUserToTeamAction,
  updateStaffRoleAction,
  removeStaffMemberAction,
} from "@/app/admin/(dashboard)/team/actions";
import { cn } from "@/lib/utils";

export interface TeamMember {
  user_id: string;
  email: string;
  role: "admin" | "editor";
  created_at: string;
}

export interface CandidateUser {
  id: string;
  email: string;
  name?: string | null;
  created_at: string;
  is_anonymous: boolean;
  has_profile: boolean;
}

interface TeamManagerProps {
  members: TeamMember[];
  candidateUsers?: CandidateUser[];
  currentUserId: string;
}

export function TeamManager({
  members,
  candidateUsers = [],
  currentUserId,
}: TeamManagerProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "invite">("existing");

  // Existing user state
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [searchCandidateQuery, setSearchCandidateQuery] = useState("");
  const [existingRole, setExistingRole] = useState<"admin" | "editor">("editor");

  // Invite email state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor">("editor");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter candidate users based on search
  const filteredCandidates = useMemo(() => {
    const q = searchCandidateQuery.trim().toLowerCase();
    if (!q) return candidateUsers;
    return candidateUsers.filter((u) => {
      const emailMatch = u.email.toLowerCase().includes(q);
      const nameMatch = u.name?.toLowerCase().includes(q);
      const idMatch = u.id.toLowerCase().includes(q);
      return emailMatch || nameMatch || idMatch;
    });
  }, [candidateUsers, searchCandidateQuery]);

  const selectedCandidate = useMemo(() => {
    return candidateUsers.find((u) => u.id === selectedCandidateId) || null;
  }, [candidateUsers, selectedCandidateId]);

  const handleAddExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateId) {
      setError("Please select an existing user to add to the team.");
      return;
    }
    setError(null);
    setLoading(true);

    const res = await addExistingUserToTeamAction(selectedCandidateId, existingRole);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setInviteOpen(false);
      setSelectedCandidateId("");
      setSearchCandidateQuery("");
      router.refresh();
    }
  };

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

        <Dialog
          open={inviteOpen}
          onOpenChange={(val) => {
            setInviteOpen(val);
            if (!val) {
              setError(null);
              setSelectedCandidateId("");
              setSearchCandidateQuery("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Grant dashboard access by selecting an existing user or inviting via email.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 my-1 text-sm rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as "existing" | "invite");
                setError(null);
              }}
              className="w-full min-w-0 pt-1"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="gap-1.5 text-xs truncate">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Existing Users ({candidateUsers.length})</span>
                </TabsTrigger>
                <TabsTrigger value="invite" className="gap-1.5 text-xs truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Invite by Email</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Select Existing User */}
              <TabsContent value="existing" className="space-y-4 pt-3 w-full min-w-0">
                <form onSubmit={handleAddExisting} className="space-y-4 w-full min-w-0">
                  {/* Search Candidate Input */}
                  <div className="relative w-full min-w-0">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search registered users by email or name..."
                      value={searchCandidateQuery}
                      onChange={(e) => setSearchCandidateQuery(e.target.value)}
                      className="w-full min-w-0 pl-8 pr-8 h-9 text-xs"
                    />
                    {searchCandidateQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchCandidateQuery("")}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Candidate Users Picker List */}
                  <div className="space-y-1.5 w-full min-w-0">
                    <Label className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Choose User to Add:</span>
                      <span className="font-mono text-[11px]">
                        {filteredCandidates.length} available
                      </span>
                    </Label>

                    <div className="max-h-48 overflow-y-auto overflow-x-hidden rounded-lg border bg-muted/20 p-1.5 space-y-1 w-full min-w-0">
                      {filteredCandidates.length > 0 ? (
                        filteredCandidates.map((user) => {
                          const isSelected = selectedCandidateId === user.id;
                          const displayName = user.name || user.email;

                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => setSelectedCandidateId(user.id)}
                              className={cn(
                                "w-full min-w-0 text-left p-2 rounded-md transition-colors flex items-center justify-between gap-2 text-xs",
                                isSelected
                                  ? "bg-primary/10 border border-primary/40 font-medium text-foreground"
                                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {user.email[0]?.toUpperCase() || "U"}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className="truncate font-medium text-foreground">
                                    {displayName}
                                  </div>
                                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                                    {user.email !== displayName ? `${user.email} • ` : ""}
                                    ID: {user.id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {user.has_profile ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-normal"
                                  >
                                    Profile
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1 text-muted-foreground font-normal"
                                  >
                                    No profile
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No candidate users found matching &ldquo;{searchCandidateQuery}&rdquo;.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Candidate Summary */}
                  {selectedCandidate && (
                    <div className="rounded-lg border bg-primary/5 border-primary/20 p-2.5 flex items-center justify-between w-full min-w-0">
                      <div className="text-xs min-w-0 flex-1 overflow-hidden">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                          Selected Member
                        </span>
                        <span className="font-semibold text-foreground block truncate">
                          {selectedCandidate.name || selectedCandidate.email}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground block truncate">
                          {selectedCandidate.email}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCandidateId("")}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0 ml-2"
                      >
                        Change
                      </Button>
                    </div>
                  )}

                  {/* Role Selector */}
                  <div className="space-y-1.5 w-full min-w-0">
                    <Label htmlFor="existing-staff-role" className="text-xs">
                      Dashboard Role
                    </Label>
                    <select
                      id="existing-staff-role"
                      value={existingRole}
                      onChange={(e) => setExistingRole(e.target.value as "admin" | "editor")}
                      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="editor">Editor (Cafes, Recipes, Posts, Events)</option>
                      <option value="admin">Admin (Full Access + Deletes & Team)</option>
                    </select>
                  </div>

                  <DialogFooter className="pt-2 w-full flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteOpen(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!selectedCandidateId || loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Add to Team
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* Tab 2: Invite by Email */}
              <TabsContent value="invite" className="space-y-4 pt-3 w-full min-w-0">
                <form onSubmit={handleInvite} className="space-y-4 w-full min-w-0">
                  <div className="space-y-1.5 w-full min-w-0">
                    <Label htmlFor="staff-email" className="text-xs">
                      Email Address *
                    </Label>
                    <Input
                      id="staff-email"
                      type="email"
                      placeholder="teammate@coffeesphut.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="h-9 text-xs w-full min-w-0"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      If the user already has an account with this email, they will be granted team
                      access immediately. If not, a Supabase signup invite will be sent.
                    </p>
                  </div>

                  <div className="space-y-1.5 w-full min-w-0">
                    <Label htmlFor="staff-role" className="text-xs">
                      Dashboard Role
                    </Label>
                    <select
                      id="staff-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "editor")}
                      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="editor">Editor (Cafes, Recipes, Posts, Events)</option>
                      <option value="admin">Admin (Full Access + Deletes & Team)</option>
                    </select>
                  </div>

                  <DialogFooter className="pt-2 w-full flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteOpen(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                      Send Invite / Add
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
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
