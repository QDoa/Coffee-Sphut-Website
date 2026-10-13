import { Clock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface HistoryPanelProps {
  tableName: string;
  recordId: string;
}

export async function HistoryPanel({ tableName, recordId }: HistoryPanelProps) {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("AdminAuditLog")
    .select("id, action, actor_email, actor_role, changed_fields, reason, created_at, old_data, new_data")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <Card className="mt-8 border-muted">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Audit Trail & Change History
            </CardTitle>
            <CardDescription className="text-xs">
              Immutable log of changes made to this record by team members
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {logs?.length ?? 0} {logs?.length === 1 ? "entry" : "entries"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border p-3 text-sm space-y-1.5 bg-muted/20 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 shrink-0">
                    {log.action}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0" suppressHydrationWarning>
                    {new Date(log.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate font-medium text-foreground/80" title={log.actor_email ?? "System"}>
                    {log.actor_email ?? "System"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ({log.actor_role ?? "staff"})
                  </span>
                </div>

                {log.changed_fields && log.changed_fields.length > 0 && (
                  <div className="text-xs text-muted-foreground pt-0.5">
                    <span className="font-medium text-foreground">Modified: </span>
                    <span className="font-mono text-[11px] break-words">
                      {log.changed_fields.join(", ")}
                    </span>
                  </div>
                )}

                {log.reason && (
                  <p className="text-xs italic text-muted-foreground break-words">
                    Reason: &ldquo;{log.reason}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No history recorded yet for this item.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
