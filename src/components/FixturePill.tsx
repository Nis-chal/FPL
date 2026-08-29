import { difficultyTone } from "@/lib/utils";
import type { FixtureView } from "@/lib/types";

const toneClass = {
  easy: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  hard: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export function FixturePill({ fixture }: { fixture: FixtureView }) {
  const tone = difficultyTone(fixture.difficulty);
  const label = `${fixture.isHome ? "H" : "A"} ${fixture.opponentShort}`;
  const isCurrent = fixture.isCurrent || fixture.isLive;
  return (
    <span
      title={`GW${fixture.event ?? "?"} FDR ${fixture.difficulty}${
        fixture.isLive
          ? ` · LIVE ${fixture.minutes}'`
          : fixture.isCurrent
            ? " · current"
            : ""
      }`}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        isCurrent
          ? "border-rose-400/60 bg-rose-500/25 text-rose-100 ring-1 ring-rose-400/40"
          : toneClass[tone],
      ].join(" ")}
    >
      {label}
      <span className="opacity-70">{fixture.difficulty}</span>
      {fixture.isLive && (
        <span className="rounded bg-rose-600 px-1 text-[9px] font-bold text-white">
          LIVE
        </span>
      )}
      {!fixture.isLive && fixture.isCurrent && (
        <span className="rounded bg-amber-500 px-1 text-[9px] font-bold text-zinc-950">
          NOW
        </span>
      )}
      {fixture.hasResult && (
        <span className="font-mono text-[10px] opacity-90">
          {fixture.teamScore ?? "–"}-{fixture.opponentScore ?? "–"}
        </span>
      )}
    </span>
  );
}

export function FixtureStrip({
  fixtures,
  limit = 7,
}: {
  fixtures: FixtureView[];
  limit?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fixtures.slice(0, limit).map((f) => (
        <FixturePill key={f.id} fixture={f} />
      ))}
      {fixtures.length === 0 && (
        <span className="text-xs text-zinc-500">No fixtures</span>
      )}
    </div>
  );
}
