import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Circle, ListChecks } from "lucide-react";
import type { PartnerOnboardingData, PortalData } from "@/lib/partner/portal";

interface SetupStep {
  label: string;
  description: string;
  complete: boolean;
  href?: string;
  action?: string;
  optional?: boolean;
}

export function OnboardingChecklist({ data, setup }: {
  data: PortalData;
  setup: PartnerOnboardingData;
}) {
  const owner = data.role === "owner";
  const canManageChain = data.role !== "cafe_manager";
  const firstItem = data.items.some((item) => item.active);
  const steps: SetupStep[] = [];

  if (owner && data.selection_required) {
    steps.push({
      label: "Choose your Free cafés",
      description: "Pick the locations your team will manage on the Free plan.",
      complete: false,
      href: "/partner/billing",
      action: "Choose cafés",
    });
  }
  steps.push({
    label: canManageChain ? "Get a café ready" : "Get access to a café",
    description: setup.activeCafe
      ? "Your workspace has an active café."
      : setup.cafePending
        ? "Your new café request is awaiting Coffee Sphut review."
        : canManageChain
          ? "Add your first café and submit the listing for review."
          : "Ask your Owner to assign you to an active café.",
    complete: setup.activeCafe,
    href: data.selection_required ? undefined : setup.cafePending
      ? "/partner/cafes?tab=requests" : canManageChain ? "/partner/cafe" : undefined,
    action: setup.cafePending ? "View requests" : "Add a café",
  });
  if (data.plan === "paid") {
    steps.push(
      {
        label: "Add an inventory item",
        description: "Create an ingredient or product with a unit and low-stock threshold.",
        complete: firstItem,
        href: setup.activeCafe ? "/partner/inventory" : undefined,
        action: "Open inventory",
      },
      {
        label: "Record your first stock movement",
        description: "Record starting stock, a delivery, or your first physical count.",
        complete: setup.movement,
        href: setup.activeCafe && firstItem ? "/partner/inventory?view=stocktake" : undefined,
        action: "Open stocktake",
      },
    );
    if (canManageChain) steps.push({
      label: "Save your first chain recipe",
      description: "Set the serving yield and link the ingredients you use.",
      complete: setup.recipe,
      href: firstItem ? "/partner/recipes" : undefined,
      action: "Open recipes",
    });
  }
  if (owner) steps.push({
    label: "Invite a manager",
    description: "Share access and choose which cafés they can manage.",
    complete: setup.hasTeam,
    href: "/partner/team",
    action: "Open team",
    optional: true,
  });

  const required = steps.filter((step) => !step.optional);
  const completed = required.filter((step) => step.complete).length;
  return (
    <section aria-label="Onboarding checklist" className="rounded-2xl border bg-card">
      <details className="group" open={completed < required.length}>
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><ListChecks className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Onboarding checklist</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{completed} of {required.length} setup steps complete</span>
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <progress aria-label="Onboarding progress" className="h-2 w-full accent-primary" max={required.length} value={completed} />
          <ul className="mt-2 divide-y">
            {steps.map((step) => {
              const Icon = step.complete ? Check : Circle;
              return (
                <li key={step.label} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
                  <Icon className={`mt-1 size-4 shrink-0 ${step.complete ? "text-emerald-700" : "text-muted-foreground"}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="text-sm font-medium">
                      {step.label}
                      {step.complete && <span className="sr-only">, complete</span>}
                      {step.optional && <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>}
                    </p>
                    {!step.complete && <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>}
                  </div>
                  {!step.complete && step.href && (
                    <Link href={step.href} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
                      {step.action} <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </section>
  );
}
