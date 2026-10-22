"use client";

import { useState } from "react";
import { Coffee, RotateCcw, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STAMP_COUNT = 5;

export function LoyaltyDemo() {
  const [stamps, setStamps] = useState(2);
  const complete = stamps === STAMP_COUNT;

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            A little loyalty goes a long way
          </p>
          <h3 className="mt-3 font-serif text-3xl tracking-tight">
            Your usual. More rewarding.
          </h3>
        </div>
        <Coffee
          className="mt-1 size-6 shrink-0 text-primary"
          aria-hidden="true"
        />
      </div>
      <div className="my-8 grid grid-cols-5 gap-2 sm:gap-3" aria-hidden="true">
        {Array.from({ length: STAMP_COUNT }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full border border-dashed transition-colors duration-200",
              index < stamps
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {index < stamps ? (
              <Coffee
                key="stamped"
                className="size-5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300 sm:size-6"
              />
            ) : (
              <span className="text-sm">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
          </div>
        ))}
      </div>
      <p
        role="status"
        className="min-h-12 text-sm leading-relaxed text-muted-foreground"
      >
        {complete
          ? "Card complete! In the app, your café sets the reward you can unlock."
          : `${stamps} of ${STAMP_COUNT} stamps. Try adding a visit to see how a digital card fills up.`}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          onClick={() => setStamps((value) => Math.min(value + 1, STAMP_COUNT))}
          disabled={complete}
          className="h-11 gap-2 motion-safe:active:scale-[0.98]"
        >
          {complete ? (
            <>
              <Check /> Card complete
            </>
          ) : (
            <>
              Try a coffee stamp <ArrowRight />
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          onClick={() => setStamps(0)}
          aria-label="Reset demo stamp card"
        >
          <RotateCcw /> Reset
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Interactive demo · No real stamps or rewards are issued.
      </p>
    </div>
  );
}
