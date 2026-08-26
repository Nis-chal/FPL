"use client";

import { useEffect, useId, useState } from "react";
import { HorizonFilter } from "@/components/HorizonFilter";
import {
  CHIP_OPTIONS,
  chipLabel,
  type ChipMode,
} from "@/lib/chips";
import {
  PRICE_PRESETS,
  RANK_BY_OPTIONS,
  SEASON_BASIS_OPTIONS,
  rankByLabel,
} from "@/lib/ranking";
import type { SeasonBasis } from "@/lib/season-basis";
import type { PriceBounds, RankBy } from "@/lib/types";
import {
  FORMATION_PREFERENCE_OPTIONS,
  formationPreferenceLabel,
  type FormationPreference,
} from "@/lib/squad";

function ChipModeControl({
  value,
  onChange,
}: {
  value: ChipMode;
  onChange: (chip: ChipMode) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Chip lens
        </h3>
        <span className="text-[11px] text-zinc-500">Exclusive</span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Rebuild rankings / squad for Triple Captain, Bench Boost, or Free Hit.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {CHIP_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SeasonBasisControl({
  value,
  onChange,
}: {
  value: SeasonBasis;
  onChange: (basis: SeasonBasis) => void;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Player rating basis
      </h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        Choose whether ratings use this season only, or blend prior FPL seasons.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {SEASON_BASIS_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FormationControl({
  value,
  onChange,
}: {
  value: FormationPreference;
  onChange: (formation: FormationPreference) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Formation
        </h3>
        <span className="text-sm font-bold text-emerald-400">
          {formationPreferenceLabel(value)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Lock the starting XI shape when building a squad. Auto picks the
        strongest legal formation.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FORMATION_PREFERENCE_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              title={opt.hint}
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
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

function FilterDrawerBody({
  horizon,
  onHorizonChange,
  seasonBasis,
  onSeasonBasisChange,
  rankBy,
  onToggleRank,
  priceBounds,
  onPriceBoundsChange,
  chip,
  onChipChange,
  formation,
  onFormationChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  seasonBasis: SeasonBasis;
  onSeasonBasisChange: (basis: SeasonBasis) => void;
  rankBy: RankBy[];
  onToggleRank: (mode: RankBy) => void;
  priceBounds: PriceBounds;
  onPriceBoundsChange: (bounds: PriceBounds) => void;
  chip: ChipMode;
  onChipChange: (chip: ChipMode) => void;
  formation: FormationPreference;
  onFormationChange: (formation: FormationPreference) => void;
}) {
  const activePreset =
    PRICE_PRESETS.find(
      (p) =>
        p.minPrice === priceBounds.minPrice &&
        p.maxPrice === priceBounds.maxPrice,
    )?.id ?? "custom";

  return (
    <div className="flex flex-col gap-6">
      <SeasonBasisControl value={seasonBasis} onChange={onSeasonBasisChange} />

      <ChipModeControl value={chip} onChange={onChipChange} />

      <FormationControl value={formation} onChange={onFormationChange} />

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
          Selected lenses are averaged into one ranking when no chip is active.
          Next game / Next 5 also set the fixture horizon.
        </p>
      </section>

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
    </div>
  );
}

export function AnalysisFilters({
  horizon,
  onHorizonChange,
  seasonBasis,
  onSeasonBasisChange,
  rankBy,
  onToggleRank,
  onReset,
  priceBounds,
  onPriceBoundsChange,
  chip,
  onChipChange,
  formation,
  onFormationChange,
}: {
  horizon: number;
  onHorizonChange: (horizon: number) => void;
  seasonBasis: SeasonBasis;
  onSeasonBasisChange: (basis: SeasonBasis) => void;
  rankBy: RankBy[];
  onToggleRank: (mode: RankBy) => void;
  onReset?: () => void;
  priceBounds: PriceBounds;
  onPriceBoundsChange: (bounds: PriceBounds) => void;
  chip: ChipMode;
  onChipChange: (chip: ChipMode) => void;
  formation: FormationPreference;
  onFormationChange: (formation: FormationPreference) => void;
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

  const seasonLabel =
    seasonBasis === "prior" ? "prior seasons" : "this season";
  const chipBit = chip !== "none" ? ` · ${chipLabel(chip)}` : "";
  const formationBit =
    formation !== "auto" ? ` · ${formation}` : " · auto XI";
  const summary = `${rankByLabel(rankBy)}${chipBit}${formationBit} · ${seasonLabel} · next ${horizon} · ${priceSummary(priceBounds)}`;
  const showReset =
    !isOverallOnly(rankBy) ||
    priceBounds.minPrice != null ||
    priceBounds.maxPrice != null ||
    seasonBasis !== "current" ||
    chip !== "none" ||
    formation !== "auto";

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
          {(rankBy.length > 1 || chip !== "none" || formation !== "auto") && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
              {chip !== "none"
                ? CHIP_OPTIONS.find((c) => c.value === chip)?.short
                : formation !== "auto"
                  ? formation
                  : rankBy.length}
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
                  Formation, chips, lenses (squad £100m)
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
                seasonBasis={seasonBasis}
                onSeasonBasisChange={onSeasonBasisChange}
                rankBy={rankBy}
                onToggleRank={onToggleRank}
                priceBounds={priceBounds}
                onPriceBoundsChange={onPriceBoundsChange}
                chip={chip}
                onChipChange={onChipChange}
                formation={formation}
                onFormationChange={onFormationChange}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
