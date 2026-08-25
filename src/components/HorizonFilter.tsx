"use client";

const HORIZONS = [3, 4, 5, 6, 7] as const;

export function HorizonFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (horizon: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Fixture horizon
      </span>
      <div className="flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5">
        {HORIZONS.map((h) => (
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
      <span className="text-xs text-zinc-500">next games</span>
    </div>
  );
}
