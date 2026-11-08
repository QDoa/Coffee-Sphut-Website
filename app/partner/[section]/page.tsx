import { Dashboard } from "@/components/partner/dashboard";
import { Inventory } from "@/components/partner/inventory";
import { Recipes } from "@/components/partner/recipes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { portalData } from "@/lib/partner/portal";
import { isLocalPartnerPreview } from "@/lib/partner/preview";
import { PartnerShell } from "@/components/partner/shell";
import {
  Cafes,
  CafeEditor,
  Rewards,
  Team,
  Billing,
  StaffReviews,
  Panel,
  Field,
  removableCafeChange,
} from "@/components/partner/workspace";
import { ActionForm } from "@/components/partner/action-form";
import { DiscardCafeChangeButton } from "@/components/partner/discard-cafe-change-button";
import { RemoveCafeButton } from "@/components/partner/remove-cafe-button";
import { passwordAction } from "../actions";
export const dynamic = "force-dynamic";
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
  const source =
    section === "preview-review"
      ? "staff"
      : section === "billing"
        ? "selection"
        : section === "cafe" && !query.id
          ? "overview"
          : section;
  // Let Next.js redirects propagate; source failures render explicitly below.
  const result = await portalData(
    source,
    Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== "" && v !== undefined),
    ),
    section === "preview-review",
    ["overview", "inventory"].includes(section),
  )
    .then((data) => ({ data, error: null }))
    .catch((error: Error) => {
      if (error.message.startsWith("NEXT_REDIRECT")) throw error;
      return { data: null, error: error.message };
    });
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
  const data = result.data;
  const approvedAmenities = data.cafe?.amenities;
  if (section === "cafe" && query.change) {
    const available = await portalData("cafes");
    const draft = available.changes.find((ch) => ch.id === query.change);
    if (!draft) notFound();
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
                  name={String(payload.name || data.cafe?.name || "this café")}
                  status={removableStatus}
                />
              )}
            </div>
          </Panel>
        </PartnerShell>
      );
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
        <Cafes data={data} q={query.q} removed={query.removed} />
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
        <Inventory data={data} />
      ) : section === "recipes" ? (
        <Recipes data={data} />
      ) : section === "team" ? (
        <Team data={data} />
      ) : section === "billing" ? (
        <Billing data={data} />
      ) : (
        <StaffReviews data={data} />
      )}
    </PartnerShell>
  );
}
