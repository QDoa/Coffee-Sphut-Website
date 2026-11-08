import { StaffReviews } from "@/components/partner/staff-reviews";
import { requireStaff } from "@/lib/admin/auth";
import { portalData } from "@/lib/partner/portal";
import { isPartnerPortalEnabled } from "@/lib/partner/preview";
import { requestQueueQuery } from "@/lib/partner/request-queue";
import { Panel } from "@/components/partner/workspace";
export default async function PartnerReviews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  if (!isPartnerPortalEnabled())
    return (
      <Panel title="Partner workspace disabled">
        <p>
          Complete the deployment gates and enable PARTNER_PORTAL_ENABLED for
          this environment before provisioning partners.
        </p>
      </Panel>
    );
  const params = await searchParams;
  const data = await portalData("staff", Object.fromEntries(
    Object.entries(params).filter(([, value]) => typeof value === "string"),
  ));
  return (
    <div className="space-y-6">
      <h1>Partner reviews</h1>
      <StaffReviews data={data} query={requestQueueQuery(params, true)} path="/admin/partner-reviews" />
    </div>
  );
}
