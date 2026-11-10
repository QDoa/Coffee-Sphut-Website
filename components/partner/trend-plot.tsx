import type { ReactNode } from "react";

export function trendScale(lower: number, upper: number, minimumStep = 1) {
  const roughStep = Math.max(minimumStep, (upper - lower || 1) / 4);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 5].find((factor) => factor * magnitude >= roughStep) ?? 10) * magnitude;
  const first = Math.floor(lower / step);
  const last = Math.max(first + 1, Math.ceil(upper / step));
  const span = (last - first) * step;

  return {
    ticks: Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step),
    position: (value: number) => (value - first * step) / span * 100,
  };
}

const tickFormat = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 2 });

interface TrendPlotProps {
  axisLabel: string;
  scale: ReturnType<typeof trendScale>;
  dates: ReactNode;
  children: ReactNode;
}

export function TrendPlot({ axisLabel, scale, dates, children }: TrendPlotProps) {
  return (
    <div className="mt-4" aria-hidden="true">
      <p className="mb-3 text-xs font-medium text-muted-foreground">{axisLabel}</p>
      <div className="ms-14">
        <div className="relative h-36 border-s">
          {scale.ticks.map((tick) => (
            <div
              key={tick}
              className={`pointer-events-none absolute inset-x-0 border-t ${tick === 0 ? "border-muted-foreground/40" : "border-border/70"}`}
              style={{ bottom: `${scale.position(tick)}%` }}
            >
              <span className="absolute end-full -translate-y-1/2 pe-2 text-end text-[11px] leading-none whitespace-nowrap text-muted-foreground tabular-nums">
                {tickFormat.format(tick)}
              </span>
            </div>
          ))}
          {children}
        </div>
        <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">{dates}</div>
      </div>
    </div>
  );
}
