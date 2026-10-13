import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManager, type CandidateUser } from "@/components/admin/team-manager";

export default async function TeamPage() {
  const staff = await requireAdmin();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("AdminUser")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true });

  const memberIds = new Set((members || []).map((m) => m.user_id));
  const emailMap: Record<string, string> = {};
  const candidateUsers: CandidateUser[] = [];

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createAdminClient();
      const [authUsersRes, profilesRes] = await Promise.all([
        adminClient.auth.admin.listUsers({ perPage: 1000 }),
        adminClient
          .from("Profile")
          .select("id, created_at, onboarding_completed, onboarding_responses"),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));

      if (authUsersRes.data?.users) {
        for (const u of authUsersRes.data.users) {
          if (u.email) {
            emailMap[u.id] = u.email;
          }

          // If not currently a team member, include in candidate list
          if (!memberIds.has(u.id)) {
            const prof = profileMap.get(u.id);
            const isAnon = Boolean(u.is_anonymous || !u.email);
            const meta = (u.user_metadata || {}) as Record<string, any>;
            const metaName =
              meta.full_name ||
              meta.name ||
              (meta["First Name"] && meta["Last Name"]
                ? `${meta["First Name"]} ${meta["Last Name"]}`
                : null) ||
              null;

            candidateUsers.push({
              id: u.id,
              email: u.email || "No email (Anonymous)",
              name: metaName,
              created_at: u.created_at,
              is_anonymous: isAnon,
              has_profile: Boolean(prof),
            });
          }
        }
      }

      // Also check any profiles that might not have an auth record in listUsers (rare fallback)
      if (profilesRes.data) {
        for (const p of profilesRes.data) {
          if (!memberIds.has(p.id) && !candidateUsers.some((c) => c.id === p.id)) {
            candidateUsers.push({
              id: p.id,
              email: "No email (Profile only)",
              name: null,
              created_at: p.created_at,
              is_anonymous: false,
              has_profile: true,
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch candidate team users:", err);
    }
  }

  // Sort candidate users: identified first, then by email or name, then recent
  candidateUsers.sort((a, b) => {
    if (!a.is_anonymous && b.is_anonymous) return -1;
    if (a.is_anonymous && !b.is_anonymous) return 1;
    if (a.email && b.email && !a.email.includes("No email") && !b.email.includes("No email")) {
      return a.email.localeCompare(b.email);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const formattedMembers = (members || []).map((m) => ({
    user_id: m.user_id,
    role: m.role as "admin" | "editor",
    created_at: m.created_at,
    email: emailMap[m.user_id] || (m.user_id === staff.userId ? staff.email || m.user_id : m.user_id),
  }));

  return (
    <TeamManager
      members={formattedMembers}
      candidateUsers={candidateUsers}
      currentUserId={staff.userId}
    />
  );
}
