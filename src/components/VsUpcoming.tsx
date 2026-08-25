import type { VsUpcomingClub } from "@/lib/opponent-history";
import { Card } from "@/components/ui";

export function VsUpcomingSection({ clubs }: { clubs: VsUpcomingClub[] }) {
  if (clubs.length === 0) return null;

  return (
    <Card
      title="Vs upcoming clubs"
      subtitle="Points scored earlier this season against these opponents"
    >
      <div className="space-y-3">
        {clubs.map((c) => (
          <div
            key={`${c.opponentId}-${c.nextEvent}`}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-semibold text-zinc-100">
                  {c.nextIsHome ? "vs" : "@"} {c.opponentShort}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  GW{c.nextEvent ?? "?"} · FDR {c.nextDifficulty}
                </span>
              </div>
              {c.games > 0 ? (
                <div className="text-sm text-zinc-300">
                  <span className="font-bold text-emerald-400">
                    {c.totalPoints} pts
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    · {c.games} game{c.games === 1 ? "" : "s"} · {c.avgPoints}{" "}
                    avg · {c.totalGoals}G {c.totalAssists}A
                  </span>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">No meetings yet</div>
              )}
            </div>

            {c.meetings.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2">
                {c.meetings.map((m) => (
                  <li
                    key={m.round}
                    className="flex justify-between text-xs text-zinc-400"
                  >
                    <span>
                      GW{m.round} · {m.wasHome ? "H" : "A"} · {m.minutes}&apos;
                    </span>
                    <span>
                      <span className="font-semibold text-emerald-400">
                        {m.points} pts
                      </span>
                      {(m.goals > 0 || m.assists > 0) && (
                        <span className="ml-2 text-zinc-500">
                          {m.goals}G {m.assists}A
                        </span>
                      )}
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
