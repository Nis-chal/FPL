import { Card } from "@/components/ui";
import type { FixtureView } from "@/lib/types";

export type ClubVsUpcomingRow = {
  opponentId: number;
  opponentName: string;
  opponentShort: string;
  nextEvent: number | null;
  nextIsHome: boolean;
  nextDifficulty: number;
  meetings: FixtureView[];
};

export function ClubVsUpcomingSection({
  rows,
}: {
  rows: ClubVsUpcomingRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <Card
      title="Vs upcoming clubs"
      subtitle="This-season results against your next opponents"
    >
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={`${row.opponentId}-${row.nextEvent}`}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-semibold text-zinc-100">
                  {row.nextIsHome ? "vs" : "@"} {row.opponentShort}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  Next GW{row.nextEvent ?? "?"} · FDR {row.nextDifficulty}
                </span>
              </div>
              {row.meetings.length === 0 ? (
                <div className="text-sm text-zinc-500">No meetings yet</div>
              ) : (
                <div className="text-sm text-zinc-400">
                  {row.meetings.length} meeting
                  {row.meetings.length === 1 ? "" : "s"}
                </div>
              )}
            </div>

            {row.meetings.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2">
                {row.meetings.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 text-xs text-zinc-400"
                  >
                    <span>
                      GW{m.event ?? "?"} · {m.isHome ? "H" : "A"}
                      {m.isLive && (
                        <span className="ml-1.5 font-semibold text-rose-400">
                          LIVE {m.minutes}&apos;
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                          m.result === "W"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : m.result === "L"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-zinc-700 text-zinc-300",
                        ].join(" ")}
                      >
                        {m.result ?? "–"}
                      </span>
                      <span className="font-mono text-zinc-200">
                        {m.teamScore ?? "–"}-{m.opponentScore ?? "–"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
