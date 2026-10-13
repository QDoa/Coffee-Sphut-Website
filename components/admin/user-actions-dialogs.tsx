"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Award, SlidersHorizontal, Loader2, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  resetUserOnboardingAction,
  adjustPunchCountAction,
  voidRewardAction,
} from "@/app/admin/(dashboard)/users/actions";
import {
  addExistingUserToTeamAction,
  removeStaffMemberAction,
} from "@/app/admin/(dashboard)/team/actions";

export function ResetOnboardingButton({ userId, userName }: { userId: string; userName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for resetting onboarding.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await resetUserOnboardingAction(userId, reason);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setOpen(false);
      setReason("");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 dark:text-amber-400">
          <RotateCcw className="h-4 w-4" /> Reset Onboarding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset User Onboarding</DialogTitle>
          <DialogDescription>
            This will mark onboarding as incomplete for {userName || "this user"} and clear their
            survey responses so they can retake the quiz.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-2 py-2">
          <Label htmlFor="reset-reason">Audit Reason *</Label>
          <Input
            id="reset-reason"
            placeholder="e.g. Customer support request #402 / preferences reset"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustPunchesButton({
  userId,
  chainId,
  chainName,
  currentPunches,
  threshold,
}: {
  userId: string;
  chainId: string;
  chainName: string;
  currentPunches: number;
  threshold: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newCount, setNewCount] = useState(String(currentPunches));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdjust = async () => {
    const val = Number(newCount);
    if (isNaN(val) || val < 0 || val >= threshold) {
      setError(`Punch count must be between 0 and ${threshold - 1}.`);
      return;
    }
    if (!reason.trim()) {
      setError("Please provide an audit reason.");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await adjustPunchCountAction(userId, chainId, val, reason);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setOpen(false);
      setReason("");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust {chainName} Punches
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Punch Count: {chainName}</DialogTitle>
          <DialogDescription>
            Change the current punches for this chain. Must be between 0 and {threshold - 1}{" "}
            (threshold is {threshold}).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="punch-count">New Punch Count (0 - {threshold - 1})</Label>
            <Input
              id="punch-count"
              type="number"
              min="0"
              max={threshold - 1}
              value={newCount}
              onChange={(e) => setNewCount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Audit Reason *</Label>
            <Input
              id="adjust-reason"
              placeholder="e.g. Compensating for missed scan on 2026-10-10"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdjust} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Punches
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoidRewardButton({
  userId,
  rewardId,
  chainName,
}: {
  userId: string;
  rewardId: string;
  chainName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVoid = async () => {
    if (!reason.trim()) {
      setError("Please provide an audit reason for voiding this reward.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await voidRewardAction(userId, rewardId, reason);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setOpen(false);
      setReason("");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-destructive hover:bg-destructive/10">
          <Award className="h-3.5 w-3.5" /> Void Reward
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Issued Reward</DialogTitle>
          <DialogDescription>
            Void this issued reward for {chainName}. This will change its status to &quot;voided&quot;
            and automatically decrement the user&apos;s available reward balance.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-2 py-2">
          <Label htmlFor="void-reason">Audit Reason *</Label>
          <Input
            id="void-reason"
            placeholder="e.g. Issued in error / duplicate reward transaction"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleVoid} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm Void
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserTeamRoleButton({
  userId,
  userEmail,
  currentRole,
}: {
  userId: string;
  userEmail: string;
  currentRole?: "admin" | "editor" | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "editor">(currentRole || "editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeamMember = Boolean(currentRole);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await addExistingUserToTeamAction(userId, role);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove team access for ${userEmail}?`)) return;
    setLoading(true);
    setError(null);
    const res = await removeStaffMemberAction(userId);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isTeamMember ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            Team: {currentRole === "admin" ? "Admin" : "Editor"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 text-primary">
            <Shield className="h-4 w-4" /> Add to Team
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>
              {isTeamMember ? "Manage Team Permissions" : "Add Existing User to Team"}
            </DialogTitle>
            <DialogDescription>
              {isTeamMember
                ? `Update dashboard role or revoke permissions for ${userEmail}.`
                : `Grant dashboard access to ${userEmail} by adding them to the staff team.`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 my-2 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <span className="text-xs text-muted-foreground block">Target User</span>
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs font-mono text-muted-foreground">{userId}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-role">Role</Label>
              <select
                id="team-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "editor")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="editor">Editor (Content, Cafes & Recipes)</option>
                <option value="admin">Admin (Full access + Deletes & Team)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {isTeamMember ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={loading}
              >
                Revoke Access
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {isTeamMember ? "Save Role" : "Add to Team"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
