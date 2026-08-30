"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FixtureStrip } from "@/components/FixturePill";
import { HorizonFilter } from "@/components/HorizonFilter";
import { Card } from "@/components/ui";
import type { FixtureView } from "@/lib/types";

const CLUB_HORIZONS = [1, 2, 3, 4, 5, 6, 7] as const;
const HORIZON_KEY = "fpl-assistant-clubs-horizon";

export type ClubListItem = {
  id: number;
  name: string;
  shortName: string;
  upcoming: FixtureView[];
  recent: FixtureView[];
};

function planningFixtures(upcoming: FixtureView[]): FixtureView[] {
  return upcoming.filter((f) => !f.isCurrent && !f.isLive);
}

/** Current/live GW belongs in Last 5 on list cards, not Next N. */
function lastFiveWithCurrent(
  recent: FixtureView[],
  upcoming: FixtureView[],
): FixtureView[] {
  const current = upcoming.filter((f) => f.isCurrent || f.isLive);
  const seen = new Set(recent.map((f) => f.id));
  const extra = current.filter((f) => !seen.has(f.id));
  return [...extra, ...recent].slice(0, 5);
}

function averageFdr(fixtures: FixtureView[], horizon: number): number {
  const slice = fixtures.slice(0, Math.max(1, horizon));
  if (slice.length === 0) return 3;
  return slice.reduce((sum, f) => sum + f.difficulty, 0) / slice.length;
}

function avgTone(avg: number): string {
  if (avg <= 2.4) return "text-emerald-300";
  if (avg <= 3.2) return "text-amber-300";
  return "text-rose-300";
}

export function ClubsClient({ clubs }: { clubs: ClubListItem[] }) {
  const [horizon, setHorizonState] = useState(5);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(HORIZON_KEY));
    if (Number.isFinite(stored) && stored >= 1 && stored <= 7) {
      setHorizonState(stored);
    }
  }, []);

  const setHorizon = (next: number) => {
    setHorizonState(next);
    window.localStorage.setItem(HORIZON_KEY, String(next));
  };

  const ranked = useMemo(() => {
    return clubs
      .map((club) => {
        const upcoming = planningFixtures(club.upcoming);
        const recent = lastFiveWithCurrent(club.recent, club.upcoming);
        return {
          club: { ...club, upcoming, recent },
          avgFdr: averageFdr(upcoming, horizon),
        };
      })
      .sort((a, b) => {
        if (a.avgFdr !== b.avgFdr) return a.avgFdr - b.avgFdr;
        return a.club.name.localeCompare(b.club.name);
      });
  }, [clubs, horizon]);

  return (
    <div className="space-y-4">
      <HorizonFilter
        value={horizon}
        onChange={setHorizon}
        horizons={CLUB_HORIZONS}
        label="Best upcoming"
        hint="games · easiest FDR first"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map(({ club, avgFdr }, index) => (
          <Card
            key={club.id}
            title={club.name}
            subtitle={`${club.shortName} · #${index + 1} easiest next ${horizon}`}
            action={
              <div className="flex flex-col items-end gap-1">
                <span
                  className={[
                    "font-mono text-sm font-bold tabular-nums",
                    avgTone(avgFdr),
                  ].join(" ")}
                  title={`Average FDR over next ${horizon} fixture${horizon === 1 ? "" : "s"}`}
                >
                  FDR {avgFdr.toFixed(1)}
                </span>
                <Link
                  href={`/clubs/${club.id}`}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  Details →
                </Link>
              </div>
            }
          >
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                  Next {horizon}
                </div>
                <FixtureStrip fixtures={club.upcoming} limit={horizon} />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                  Last 5
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {club.recent.map((f) => (
                    <span
                      key={f.id}
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        f.isLive || f.isCurrent
                          ? "ring-1 ring-rose-400/50"
                          : "",
                        f.result === "W"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : f.result === "L"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-zinc-700 text-zinc-300",
                      ].join(" ")}
                    >
                      {f.result ?? "–"} {f.teamScore ?? "–"}-{f.opponentScore ?? "–"}{" "}
                      {f.isHome ? "vs" : "@"} {f.opponentShort}
                      {f.isLive
                        ? " · LIVE"
                        : f.isCurrent
                          ? " · NOW"
                          : ""}
                    </span>
                  ))}
                  {club.recent.length === 0 && (
                    <span className="text-xs text-zinc-500">
                      No finished matches yet
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
