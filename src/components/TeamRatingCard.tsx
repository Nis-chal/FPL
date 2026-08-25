import type { TeamRating } from "@/lib/types";

export function TeamRatingCard({ rating }: { rating: TeamRating }) {
  const bars: Array<{ key: keyof TeamRating["breakdown"]; label: string }> = [
    { key: "form", label: "Expected pts" },
    { key: "availability", label: "Start chance" },
    { key: "fixtures", label: "Fixtures" },
    { key: "attackingThreat", label: "Attacking threat" },
    { key: "nextWinChance", label: "Next-win chance" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Team rating · next {rating.horizon}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-4xl font-bold text-emerald-400">
              {rating.grade}
            </span>
            <span className="text-xl font-semibold text-zinc-200">
              {rating.score}/100
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-400">{rating.summary}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {bars.map(({ key, label }) => {
          const value = rating.breakdown[key];
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
                <span>{label}</span>
                <span>{value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
