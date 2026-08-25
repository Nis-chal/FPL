"use client";

import { HorizonFilter } from "@/components/HorizonFilter";
import {
  PRICE_PRESETS,
  RANK_BY_OPTIONS,
} from "@/lib/ranking";
import type { PriceBounds, RankBy } from "@/lib/types";

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

function PriceFilter({
  bounds,
  onChange,
}: {
  bounds: PriceBounds;
  onChange: (bounds: PriceBounds) => void;
}) {
  const activePreset =
    PRICE_PRESETS.find(
      (p) => p.minPrice === bounds.minPrice && p.maxPrice === bounds.maxPrice,
    )?.id ?? "custom";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Price band
      </span>
      <div className="flex flex-wrap gap-1.5">
        {PRICE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              onChange({
                minPrice: preset.minPrice,
                maxPrice: preset.maxPrice,
              })
            }
            className={[
              "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
              activePreset === preset.id
                ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <label className="flex items-center gap-1">
          Min £
          <input
            type="number"
            step="0.5"
            min={3}
            max={15}
            value={bounds.minPrice != null ? bounds.minPrice / 10 : ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...bounds,
                minPrice: v === "" ? null : Math.round(Number(v) * 10),
              });
            }}
            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-100"
          />
        </label>
        <label className="flex items-center gap-1">
          Max £
          <input
            type="number"
            step="0.5"
            min={3}
            max={15}
            value={bounds.maxPrice != null ? bounds.maxPrice / 10 : ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...bounds,
                maxPrice: v === "" ? null : Math.round(Number(v) * 10),
              });
            }}
            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-zinc-100"
          />
        </label>
        <span className="text-zinc-600">m</span>
      </div>
    </div>
  );
}

function AnalyzeByControl({
  value,
  onChange,
}: {
  value: RankBy;
  onChange: (rankBy: RankBy) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Analyze by
      </span>
      <div className="flex flex-wrap gap-1.5">
        {RANK_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
              value === opt.value
                ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AnalysisFilters({
  horizon,
  onHorizonChange,
  includeAccumulated,
  onAccumulatedChange,
  rankBy,
  onRankByChange,
  priceBounds,
  onPriceBoundsChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  includeAccumulated: boolean;
  onAccumulatedChange: (include: boolean) => void;
  rankBy: RankBy;
  onRankByChange: (rankBy: RankBy) => void;
  priceBounds: PriceBounds;
  onPriceBoundsChange: (bounds: PriceBounds) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <AnalyzeByControl value={rankBy} onChange={onRankByChange} />
      <PriceFilter bounds={priceBounds} onChange={onPriceBoundsChange} />
      <HorizonFilter value={horizon} onChange={onHorizonChange} />
      <AccumulatedPointsToggle
        value={includeAccumulated}
        onChange={onAccumulatedChange}
      />
    </div>
  );
}
