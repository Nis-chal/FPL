"use client";

import { useEffect, useId, useState } from "react";
import { HorizonFilter } from "@/components/HorizonFilter";
import {
  PRICE_PRESETS,
  RANK_BY_OPTIONS,
  rankByLabel,
} from "@/lib/ranking";
import type { PriceBounds, RankBy } from "@/lib/types";
import {
  BUDGET,
  BUDGET_MIN,
  BUDGET_PRESETS,
  formatPrice,
} from "@/lib/utils";

function AccumulatedPointsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (include: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-zinc-200">Accumulated form</div>
        <p className="text-xs text-zinc-500">
          Blend recent points / FPL EP into rankings
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full p-0.5 transition",
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
    </div>
  );
}

function priceSummary(bounds: PriceBounds): string {
  const preset = PRICE_PRESETS.find(
    (p) => p.minPrice === bounds.minPrice && p.maxPrice === bounds.maxPrice,
  );
  if (preset) return preset.label === "All" ? "Any price" : preset.label;
  const min = bounds.minPrice != null ? `£${(bounds.minPrice / 10).toFixed(1)}` : "";
  const max = bounds.maxPrice != null ? `£${(bounds.maxPrice / 10).toFixed(1)}` : "";
  if (min && max) return `${min}–${max}m`;
  if (min) return `≥${min}m`;
  if (max) return `≤${max}m`;
  return "Any price";
}

function isOverallOnly(rankBy: RankBy[]): boolean {
  return rankBy.length === 1 && rankBy[0] === "overall";
}

function SquadBudgetControl({
  budget,
  onChange,
}: {
  budget: number;
  onChange: (budget: number) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Squad budget
        </h3>
        <span className="text-sm font-bold text-emerald-400">
          {formatPrice(budget)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Max £100.0m (FPL limit). Lower it to rebuild a cheaper XV.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BUDGET_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={[
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
              budget === preset
                ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            £{(preset / 10).toFixed(0)}m
          </button>
        ))}
      </div>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[11px] text-zinc-500">
          Custom (£{(BUDGET_MIN / 10).toFixed(0)}–£{(BUDGET / 10).toFixed(0)}m)
        </span>
        <input
          type="range"
          min={BUDGET_MIN}
          max={BUDGET}
          step={5}
          value={budget}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </label>
    </section>
  );
}

function FilterDrawerBody({
  horizon,
  onHorizonChange,
  includeAccumulated,
  onAccumulatedChange,
  rankBy,
  onToggleRank,
  priceBounds,
  onPriceBoundsChange,
  budget,
  onBudgetChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  includeAccumulated: boolean;
  onAccumulatedChange: (include: boolean) => void;
  rankBy: RankBy[];
  onToggleRank: (mode: RankBy) => void;
  priceBounds: PriceBounds;
  onPriceBoundsChange: (bounds: PriceBounds) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
}) {
  const activePreset =
    PRICE_PRESETS.find(
      (p) =>
        p.minPrice === priceBounds.minPrice &&
        p.maxPrice === priceBounds.maxPrice,
    )?.id ?? "custom";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Analyze by
          </h3>
          <span className="text-[11px] text-zinc-500">Tap to combine</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RANK_BY_OPTIONS.map((opt) => {
            const active = rankBy.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleRank(opt.value)}
                className={[
                  "rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                    : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <span
                    className={[
                      "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      active
                        ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                        : "border-zinc-600 text-transparent",
                    ].join(" ")}
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{opt.hint}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Selected lenses are averaged into one ranking. Next game / Next 5 also
          set the fixture horizon.
        </p>
      </section>

      <SquadBudgetControl budget={budget} onChange={onBudgetChange} />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Player price band
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onPriceBoundsChange({
                  minPrice: preset.minPrice,
                  maxPrice: preset.maxPrice,
                })
              }
              className={[
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                activePreset === preset.id
                  ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
              ].join(" ")}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <HorizonFilter value={horizon} onChange={onHorizonChange} />
      </section>

      <section className="border-t border-zinc-800 pt-4">
        <AccumulatedPointsToggle
          value={includeAccumulated}
          onChange={onAccumulatedChange}
        />
      </section>
    </div>
  );
}

export function AnalysisFilters({
  horizon,
  onHorizonChange,
  includeAccumulated,
  onAccumulatedChange,
  rankBy,
  onToggleRank,
  onReset,
  priceBounds,
  onPriceBoundsChange,
  budget,
  onBudgetChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  includeAccumulated: boolean;
  onAccumulatedChange: (include: boolean) => void;
  rankBy: RankBy[];
  onToggleRank: (mode: RankBy) => void;
  onReset?: () => void;
  priceBounds: PriceBounds;
  onPriceBoundsChange: (bounds: PriceBounds) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const summary = `${rankByLabel(rankBy)} · next ${horizon} · budget ${formatPrice(budget)} · ${priceSummary(priceBounds)}`;
  const showReset =
    !isOverallOnly(rankBy) ||
    priceBounds.minPrice != null ||
    priceBounds.maxPrice != null ||
    budget !== BUDGET;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-zinc-100 transition hover:border-emerald-500/50 hover:bg-zinc-900"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="size-4 text-emerald-400"
            fill="currentColor"
          >
            <path d="M3 5h14a1 1 0 0 0 0-2H3a1 1 0 1 0 0 2Zm2 6h10a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2Zm3 6h4a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2Z" />
          </svg>
          Filters
          {rankBy.length > 1 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
              {rankBy.length}
            </span>
          )}
        </button>
        <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">{summary}</p>
        {showReset && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-zinc-50">
                  Analysis filters
                </h2>
                <p className="text-xs text-zinc-500">
                  Combine lenses, set budget (max £100m), rebuild the squad
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <FilterDrawerBody
                horizon={horizon}
                onHorizonChange={onHorizonChange}
                includeAccumulated={includeAccumulated}
                onAccumulatedChange={onAccumulatedChange}
                rankBy={rankBy}
                onToggleRank={onToggleRank}
                priceBounds={priceBounds}
                onPriceBoundsChange={onPriceBoundsChange}
                budget={budget}
                onBudgetChange={onBudgetChange}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
