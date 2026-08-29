"use client";

import type { GwPointsFilter, GwPointsFilterMode } from "@/lib/season-accumulated";

export function GwPointsFilterControl({
  filter,
  onChange,
  finishedGameweeks,
  fromDatabase,
}: {
  filter: GwPointsFilter;
  onChange: (next: GwPointsFilter) => void;
  finishedGameweeks: number[];
  fromDatabase: boolean;
}) {
  const gwOptions =
    finishedGameweeks.length > 0
      ? [...finishedGameweeks].sort((a, b) => b - a)
      : [filter.gameweek];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Points view
        </span>
        {(
          [
            { mode: "total" as const, label: "Season total" },
            { mode: "through" as const, label: "Through GW" },
            { mode: "week" as const, label: "One GW" },
          ] as const
        ).map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            disabled={mode !== "total" && !fromDatabase}
            onClick={() => onChange({ ...filter, mode })}
            className={[
              "rounded-lg px-2.5 py-1 text-xs font-medium transition",
              filter.mode === mode
                ? "bg-emerald-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800",
              mode !== "total" && !fromDatabase ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        {(filter.mode === "through" || filter.mode === "week") && fromDatabase && (
          <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            GW
            <select
              value={filter.gameweek}
              onChange={(e) =>
                onChange({ ...filter, gameweek: Number(e.target.value) })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            >
              {gwOptions.map((gw) => (
                <option key={gw} value={gw}>
                  {gw}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!fromDatabase ? (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Per-GW needs <code className="rounded bg-zinc-800 px-1">db:sync</code>
        </p>
      ) : null}
    </div>
  );
}

export type { GwPointsFilter, GwPointsFilterMode };
