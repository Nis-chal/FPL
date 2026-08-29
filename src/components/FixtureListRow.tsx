import type { FixtureView } from "@/lib/types";

export function fixtureRowClass(isCurrent: boolean): string {
  return [
    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
    isCurrent
      ? "border-rose-500/50 bg-rose-500/10 ring-1 ring-rose-500/30"
      : "border-zinc-800",
  ].join(" ");
}

export function FixtureStatusBadge({ fixture }: { fixture: FixtureView }) {
  if (fixture.isLive) {
    return (
      <span className="ml-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
        Live {fixture.minutes}&apos;
      </span>
    );
  }
  if (fixture.isCurrent) {
    return (
      <span className="ml-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
        Current
      </span>
    );
  }
  return null;
}

export function FixtureScore({
  fixture,
}: {
  fixture: Pick<FixtureView, "hasResult" | "teamScore" | "opponentScore">;
}) {
  if (!fixture.hasResult) return null;
  return (
    <span className="font-mono text-zinc-300">
      {fixture.teamScore ?? "–"}-{fixture.opponentScore ?? "–"}
    </span>
  );
}
