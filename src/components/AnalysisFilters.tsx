"use client";

import { HorizonFilter } from "@/components/HorizonFilter";

export function AccumulatedPointsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (include: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Accumulated points
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          "relative h-7 w-12 rounded-full p-0.5 transition",
          value ? "bg-emerald-500" : "bg-zinc-700",
        ].join(" ")}
      >
        <span
          className={[
            "block size-6 rounded-full bg-zinc-950 shadow transition-transform",
            value ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      <span className="text-xs text-zinc-400">
        {value
          ? "On — blend recent form / FPL EP into rankings"
          : "Off — underlying xPts only (minutes, xG/xA, fixtures)"}
      </span>
    </div>
  );
}

export function AnalysisFilters({
  horizon,
  onHorizonChange,
  includeAccumulated,
  onAccumulatedChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  includeAccumulated: boolean;
  onAccumulatedChange: (include: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <HorizonFilter value={horizon} onChange={onHorizonChange} />
      <AccumulatedPointsToggle
        value={includeAccumulated}
        onChange={onAccumulatedChange}
      />
    </div>
  );
}
