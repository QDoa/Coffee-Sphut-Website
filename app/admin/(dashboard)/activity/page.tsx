import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ActivityLogViewer } from "@/components/admin/activity-log-viewer";

export default async function ActivityPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("AdminAuditLog")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit & Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Comprehensive immutable audit trail of all staff modifications across content and user records.
        </p>
      </div>

      <ActivityLogViewer logs={(logs as any) || []} />
    </div>
  );
}
