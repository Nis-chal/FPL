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
  return (
    <span
      title={`GW${fixture.event ?? "?"} FDR ${fixture.difficulty}`}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        toneClass[tone],
      ].join(" ")}
    >
      {label}
      <span className="opacity-70">{fixture.difficulty}</span>
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
