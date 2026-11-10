import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "./workspace";

interface ReportFiltersProps {
  path: string;
  formKey: string;
  cafe: ReactNode;
  from?: string;
  through?: string;
  presets?: ReactNode;
  children?: ReactNode;
  error?: string;
}

export function ReportFilters({ path, formKey, cafe, from, through, presets, children, error }: ReportFiltersProps) {
  return (
    <section aria-labelledby="report-filters-title" className="@container min-w-0 rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-5">
        <h2 id="report-filters-title" className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
          Report filters
        </h2>
        {presets}
      </div>
      <form action={path} key={formKey} className="space-y-3 px-4 py-4 sm:px-5">
        <div className="grid min-w-0 items-end gap-3 @min-[38rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {cafe}
          <div className="grid min-w-0 gap-3 min-[375px]:grid-cols-2">
            <Field name="from" label="From" type="date" value={from} inputClassName="rounded-lg bg-background px-3 text-sm shadow-none" />
            <Field name="to" label="Through" type="date" value={through} inputClassName="rounded-lg bg-background px-3 text-sm shadow-none" />
          </div>
        </div>
        {children}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button asChild variant="ghost" className="min-h-11">
            <a href={path}>Reset filters</a>
          </Button>
          <Button type="submit" className="min-h-11">Apply filters</Button>
        </div>
      </form>
    </section>
  );
}
