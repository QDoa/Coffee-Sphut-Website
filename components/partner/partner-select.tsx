import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PartnerSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block min-w-0">
      <select
        {...props}
        className={cn(
          "min-h-11 w-full min-w-0 appearance-none rounded-xl border bg-background ps-3 pe-10 text-sm forced-colors:appearance-auto",
          className,
        )}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground forced-colors:hidden"
      />
    </span>
  );
}
