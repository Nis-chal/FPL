import { Card } from "@/components/ui";
import type { VsOpponentMeeting, VsUpcomingClub } from "@/lib/opponent-history";

function formatMatchDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scoreLabel(m: VsOpponentMeeting): string {
  if (m.teamScore === null || m.opponentScore === null) return "–";
  return `${m.teamScore}–${m.opponentScore}`;
}

function ContribBadge({
  kind,
  count,
}: {
  kind: "goal" | "assist";
  count: number;
}) {
  if (count <= 0) return null;
  const isGoal = kind === "goal";
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        isGoal
          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
          : "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40",
      ].join(" ")}
      title={isGoal ? `${count} goal${count === 1 ? "" : "s"}` : `${count} assist${count === 1 ? "" : "s"}`}
    >
      <span aria-hidden>{isGoal ? "⚽" : "👟"}</span>
      <span>
        {count} {isGoal ? (count === 1 ? "Goal" : "Goals") : count === 1 ? "Assist" : "Assists"}
      </span>
    </span>
  );
}

function MeetingLine({ m }: { m: VsOpponentMeeting }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span
        className={[
          "inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold",
          m.result === "W"
            ? "bg-emerald-500/20 text-emerald-300"
            : m.result === "L"
              ? "bg-rose-500/20 text-rose-300"
              : "bg-zinc-700 text-zinc-300",
        ].join(" ")}
      >
        {m.result ?? "–"}
      </span>
      <span className="font-mono font-semibold tabular-nums text-zinc-100">
        {scoreLabel(m)}
      </span>
      <span className="text-xs text-zinc-500">{formatMatchDate(m.kickoffTime)}</span>
      <ContribBadge kind="goal" count={m.goals} />
      <ContribBadge kind="assist" count={m.assists} />
    </li>
  );
}

export function VsUpcomingSection({ clubs }: { clubs: VsUpcomingClub[] }) {
  if (clubs.length === 0) return null;

  return (
    <Card
      title="Vs upcoming clubs"
      subtitle="Previous results this season against these opponents"
    >
      <div className="space-y-4">
        {clubs.map((club) => (
          <div
            key={`${club.opponentId}-${club.nextEvent}`}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-50">
                {club.nextIsHome ? "vs" : "@"} {club.opponentName}
              </h3>
              <span className="text-xs text-zinc-500">
                Next GW{club.nextEvent ?? "?"} · FDR {club.nextDifficulty}
              </span>
            </div>

            {club.meetings.length > 0 ? (
              <ul className="mt-2.5 space-y-2">
                {club.meetings.map((m) => (
                  <MeetingLine key={`${m.round}-${m.kickoffTime}`} m={m} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                No meetings this season yet.
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
