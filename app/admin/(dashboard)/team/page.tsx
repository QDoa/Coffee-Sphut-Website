import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManager } from "@/components/admin/team-manager";

export default async function TeamPage() {
  const staff = await requireAdmin();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("AdminUser")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true });

  const emailMap: Record<string, string> = {};
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          if (u.email) emailMap[u.id] = u.email;
        }
      }
    } catch {
      // Ignored
    }
  }

  const formattedMembers = (members || []).map((m) => ({
    user_id: m.user_id,
    role: m.role as "admin" | "editor",
    created_at: m.created_at,
    email: emailMap[m.user_id] || (m.user_id === staff.userId ? staff.email || m.user_id : m.user_id),
  }));

  return <TeamManager members={formattedMembers} currentUserId={staff.userId} />;
}
