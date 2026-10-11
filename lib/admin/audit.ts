import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export interface LogAdminActionParams {
  actorId: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData?: Database["public"]["Tables"]["AdminAuditLog"]["Insert"]["old_data"];
  newData?: Database["public"]["Tables"]["AdminAuditLog"]["Insert"]["new_data"];
  changedFields?: string[];
  reason?: string;
}

/**
 * Manually logs an administrative action into AdminAuditLog.
 * Used primarily for service-role operations (such as team invites or user management)
 * that bypass client triggers.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient.from("AdminAuditLog").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail ?? null,
    actor_role: params.actorRole,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
    changed_fields: params.changedFields ?? null,
    reason: params.reason ?? null,
  });

  if (error) {
    console.error("Failed to write to AdminAuditLog:", error);
  }
}
