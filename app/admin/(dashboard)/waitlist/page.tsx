import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { WaitlistTable } from "@/components/admin/waitlist-table";

export default async function WaitlistPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("Waitlist")
    .select("id, email, resend_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Waitlist Signups</h1>
        <p className="text-sm text-muted-foreground">
          View users who signed up for the mobile app early access waitlist.
        </p>
      </div>

      <WaitlistTable entries={entries || []} />
    </div>
  );
}
