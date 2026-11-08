import { StaffReviews } from "@/components/partner/staff-reviews";
import { Dashboard } from "@/components/partner/dashboard";
import { Inventory } from "@/components/partner/inventory";
import { PlanSettings } from "@/components/partner/plan-settings";
import { Recipes } from "@/components/partner/recipes";
import { Team } from "@/components/partner/team";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { portalCafeRequest, portalData } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { requestQueueQuery } from "@/lib/partner/request-queue";
import { PartnerShell } from "@/components/partner/shell";
import {
  Cafes,
  CafeEditor,
  Rewards,
  Panel,
  Field,
  removableCafeChange,
} from "@/components/partner/workspace";
import { ActionForm } from "@/components/partner/action-form";
import { DiscardCafeChangeButton } from "@/components/partner/discard-cafe-change-button";
import { RemoveCafeButton } from "@/components/partner/remove-cafe-button";
import { passwordAction } from "../actions";
export const dynamic = "force-dynamic";
async function loadWorkspace(
  section: string,
  query: Record<string, string | undefined>,
) {
  const source =
    section === "preview-review"
      ? "staff"
      : section === "billing" || (section === "cafe" && (!query.id || query.change))
        ? "overview"
        : section;
  // Let Next.js redirects propagate; source failures render explicitly below.
  return portalData(
    source,
    Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== "" && v !== undefined),
    ),
    section === "preview-review",
    ["overview", "inventory"].includes(section),
  )
    .then((data) => ({ data, error: null, loadedAt: Date.now() }))
    .catch((error: Error) => {
      if (error.message.startsWith("NEXT_REDIRECT")) throw error;
      return { data: null, error: error.message };
    });
}
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const preview = isLocalPartnerPreview();
  if (
    ![
      "overview",
      "cafes",
      "cafe",
      "rewards",
      "inventory",
      "recipes",
      "team",
      "billing",
      "preview-review",
      "accept",
      "password",
    ].includes(section)
  )
    notFound();
  if (section === "preview-review" && !preview) notFound();
  if (section === "accept")
    return (
      <main className="mx-auto max-w-xl space-y-6 p-8">
        <h1 className="font-serif text-3xl">Accept partner invitation</h1>
        <p>
          Sign in with the invited email first. The link fixes your chain, role
          and café assignments.
        </p>
        <Link
          className="underline"
          href={`/partner/login?next=${encodeURIComponent(`/partner/accept?token=${query.token || ""}`)}`}
        >
          Sign in
        </Link>
        <ActionForm
          operation="accept_invite"
          context={{ request_id: randomUUID(), token: query.token }}
          label="Accept invitation"
        >
          <p className="text-sm text-muted-foreground">
            Accepting requires an authenticated invited account.
          </p>
        </ActionForm>
      </main>
    );
  if (section === "password")
    return (
      <main className="mx-auto max-w-xl p-8">
        <Panel title="Set your password">
          <ActionForm action={passwordAction} label="Update password">
            <Field
              name="password"
              label="New password"
              type="password"
              required
            />
          </ActionForm>
        </Panel>
      </main>
    );
  const result = await loadWorkspace(section, query);
  if (!result.data)
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <h1 className="font-serif text-4xl">Workspace unavailable</h1>
        <p role="alert">{result.error}</p>
        {["inventory", "recipes"].includes(section) && (
          <p>Inventory and recipes require an active Paid plan.</p>
        )}
        <div className="flex gap-4">
          <Link className="underline" href="/partner/overview">
            Dashboard
          </Link>
          <Link className="underline" href="/partner/billing">
            Plan & access
          </Link>
          <Link className="underline" href="/partner/login">
            Sign in
          </Link>
        </div>
      </main>
    );
  let data = result.data;
  const selection =
    section === "billing" && data.plan === "free" && data.role === "owner"
      ? await portalData("selection").catch(() => null)
      : null;
  let approvedAmenities = data.cafe?.amenities;
  if (section === "cafe" && query.change) {
    const draft = await portalCafeRequest(query.change, data.chain_id);
    if (!draft || (query.id && query.id !== String(draft.cafe_id))) notFound();
    const payload = draft.payload as Record<string, unknown>;
    const removableStatus = removableCafeChange(draft, data.actor);
    if (!["draft", "rejected"].includes(String(draft.status)))
      return (
        <PartnerShell data={data} preview={preview}>
          <Panel
            title={
              draft.cafe_id && payload.is_active === false
                ? "Café removal request"
                : "Change request"
            }
          >
            <p role="status">
              {draft.status === "approved"
                ? "Coffee Sphut approved this request."
                : "Submitted to Coffee Sphut and awaiting review."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link className="underline" href="/partner/cafes">
                Return to cafés
              </Link>
              {removableStatus && (
                <DiscardCafeChangeButton
                  id={query.change}
                  name={String(payload.name ||
                    data.cafes.find((cafe) => cafe.id === draft.cafe_id)?.name || "this café")}
                  status={removableStatus}
                />
              )}
            </div>
          </Panel>
        </PartnerShell>
      );
    if (draft.cafe_id) data = await portalData("cafe", { id: Number(draft.cafe_id) });
    approvedAmenities = data.cafe?.amenities;
    data.cafe = {
      ...(data.cafe || {}),
      ...(draft.payload as Record<string, unknown>),
    };
    data.changes = [draft];
    if (Array.isArray(payload.gallery))
      data.gallery = payload.gallery as string[];
  }
  return (
    <PartnerShell data={data} preview={preview}>
      {section === "overview" ? (
        <Dashboard data={data} />
      ) : section === "cafes" ? (
        <Cafes
          data={data}
          q={query.q}
          removed={query.removed}
          tab={query.tab === "directory" ? "directory" :
            query.tab === "requests" || query.removed || query.request_q ||
              query.request_filter || query.request_page ? "requests" : undefined}
          queueQuery={requestQueueQuery(query)}
        />
      ) : section === "cafe" ? (
        <>
          {query.change &&
            removableCafeChange(data.changes[0], data.actor) === "draft" && (
              <div className="flex justify-end">
                <DiscardCafeChangeButton
                  id={query.change}
                  name={String(data.cafe?.name || "this café")}
                  status="draft"
                />
              </div>
            )}
          {!query.change && data.cafe?.is_active === true && (
            <div className="flex justify-end">
              <RemoveCafeButton
                cafeId={Number(data.cafe.id)}
                name={String(data.cafe.name || "this café")}
                revision={Number(data.cafe.partner_revision)}
                requestId={randomUUID()}
              />
            </div>
          )}
          <CafeEditor data={data} approvedAmenities={approvedAmenities} />
        </>
      ) : section === "rewards" ? (
        <Rewards data={data} params={query} />
      ) : section === "inventory" ? (
        <Inventory
          key={`${query.cafe_id || ""}:${query.item_id || ""}`}
          data={data}
          cafeId={query.cafe_id}
          itemId={query.item_id}
        />
      ) : section === "recipes" ? (
        <Recipes data={data} />
      ) : section === "team" ? (
        <Team data={data} loadedAt={result.loadedAt} />
      ) : section === "billing" ? (
        <PlanSettings data={data} selectionCafes={selection?.cafes} />
      ) : (
        <StaffReviews data={data} query={requestQueueQuery(query, true)} path="/partner/preview-review" />
      )}
    </PartnerShell>
  );
}
