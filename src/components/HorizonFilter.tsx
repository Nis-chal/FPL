"use client";

const DEFAULT_HORIZONS = [1, 3, 4, 5, 6, 7] as const;

export function HorizonFilter({
  value,
  onChange,
  horizons = DEFAULT_HORIZONS,
  label = "Fixture horizon",
  hint = "next games",
}: {
  value: number;
  onChange: (horizon: number) => void;
  horizons?: readonly number[];
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5">
        {horizons.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onChange(h)}
            className={[
              "rounded-md px-2.5 py-1 text-sm font-semibold transition",
              value === h
                ? "bg-emerald-500 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            {h}
          </button>
        ))}
      </div>
      <span className="text-xs text-zinc-500">{hint}</span>
    </div>
  );
}
