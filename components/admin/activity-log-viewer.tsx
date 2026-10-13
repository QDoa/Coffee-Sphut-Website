"use client";

import { useState } from "react";
import { Search, History, Eye, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditEntry {
  id: number;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  changed_fields: string[] | null;
  reason: string | null;
}

export function ActivityLogViewer({ logs }: { logs: AuditEntry[] }) {
  const [tableFilter, setTableFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  const tables = Array.from(new Set(logs.map((l) => l.table_name))).sort();

  const filtered = logs.filter((log) => {
    if (tableFilter !== "all" && log.table_name !== tableFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchEmail = log.actor_email?.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      const matchReason = log.reason?.toLowerCase().includes(q);
      const matchRecord = log.record_id?.toLowerCase().includes(q);
      if (!matchEmail && !matchAction && !matchReason && !matchRecord) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity by email, reason, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="all">All Tables</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Audit Reason</TableHead>
              <TableHead className="w-[80px] text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((log) => {
                const actionColor =
                  log.action === "DELETE" || log.action.includes(".remove")
                    ? "destructive"
                    : log.action === "INSERT" || log.action.includes(".add")
                    ? "default"
                    : "secondary";

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                      {new Date(log.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {log.actor_email || "System / API"}
                      </div>
                      {log.actor_role && (
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {log.actor_role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionColor as any} className="text-xs font-mono">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="font-semibold">{log.table_name}</span>
                        {log.record_id && (
                          <span className="text-muted-foreground font-mono ml-1">
                            #{log.record_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      {log.changed_fields && log.changed_fields.length > 0 && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          Fields: {log.changed_fields.join(", ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs italic text-muted-foreground max-w-[240px] truncate">
                      {log.reason || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedLog(log)}
                        title="View payload diff"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No activity log entries found matching criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payload Diff Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Entry #{selectedLog?.id} ({selectedLog?.table_name})
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded bg-muted">
                <div>
                  <span className="text-muted-foreground block">Actor:</span>
                  <span className="font-medium">{selectedLog.actor_email || "System"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Action:</span>
                  <span className="font-mono font-medium">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Record ID:</span>
                  <span className="font-mono">{selectedLog.record_id || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reason:</span>
                  <span className="italic">{selectedLog.reason || "None specified"}</span>
                </div>
              </div>

              {selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
                <div>
                  <span className="font-semibold block mb-1">Changed Fields:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedLog.changed_fields.map((f) => (
                      <Badge key={f} variant="outline" className="text-[11px]">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold block mb-1 text-muted-foreground">
                    Previous State (Old)
                  </span>
                  <pre className="p-2.5 rounded bg-muted/60 font-mono text-[11px] overflow-x-auto max-h-60 border">
                    {selectedLog.old_data
                      ? JSON.stringify(selectedLog.old_data, null, 2)
                      : "(null)"}
                  </pre>
                </div>
                <div>
                  <span className="font-semibold block mb-1 text-muted-foreground">
                    New State (Updated)
                  </span>
                  <pre className="p-2.5 rounded bg-muted/60 font-mono text-[11px] overflow-x-auto max-h-60 border">
                    {selectedLog.new_data
                      ? JSON.stringify(selectedLog.new_data, null, 2)
                      : "(null)"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
