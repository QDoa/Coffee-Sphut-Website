"use client";

import { useState } from "react";
import { Search, Download, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteWaitlistEntryAction } from "@/app/admin/(dashboard)/waitlist/actions";

interface WaitlistEntry {
  id: number;
  email: string;
  resend_id: string;
  created_at: string;
}

export function WaitlistTable({ entries }: { entries: WaitlistEntry[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = entries.filter((e) =>
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCsv = () => {
    const headers = ["ID,Email,Resend_ID,Created_At"];
    const rows = entries.map(
      (e) => `${e.id},"${e.email.replace(/"/g, '""')}",${e.resend_id},"${e.created_at}"`
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `coffee_sphut_waitlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the waitlist?`)) return;
    setDeletingId(id);
    try {
      await deleteWaitlistEntryAction(id);
    } catch (err: any) {
      alert(err.message || "Failed to remove entry");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search waitlist emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV ({entries.length})
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Resend ID</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[80px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{entry.id}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {entry.email}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.resend_id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {new Date(entry.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(entry.id, entry.email)}
                      disabled={deletingId === entry.id}
                      className="text-muted-foreground hover:text-destructive"
                      title={`Remove ${entry.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  {searchTerm
                    ? `No entries matching "${searchTerm}".`
                    : "No waitlist signups recorded yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
