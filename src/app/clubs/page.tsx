import Link from "next/link";
import { Card, ErrorBox } from "@/components/ui";
import { FixtureStrip } from "@/components/FixturePill";
import { getBootstrap, getFixtures } from "@/lib/fpl-client";
import { nextFixturesForTeam, recentFixturesForTeam, teamMap } from "@/lib/utils";

export const revalidate = 900;

export default async function ClubsPage() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      getBootstrap(),
      getFixtures(),
    ]);
    const teams = teamMap(bootstrap.teams);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Clubs</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Next 7 fixtures and recent match history for each club.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {bootstrap.teams
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((team) => {
              const upcoming = nextFixturesForTeam(fixtures, team.id, teams, 7);
              const recent = recentFixturesForTeam(fixtures, team.id, teams, 5);
              return (
                <Card
                  key={team.id}
                  title={team.name}
                  subtitle={team.short_name}
                  action={
                    <Link
                      href={`/clubs/${team.id}`}
                      className="text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Details →
                    </Link>
                  }
                >
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                        Next 7
                      </div>
                      <FixtureStrip fixtures={upcoming} />
                    </div>
                    <div>
                      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                        Last 5
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recent.map((f) => (
                          <span
                            key={f.id}
                            className={[
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              f.result === "W"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : f.result === "L"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-zinc-700 text-zinc-300",
                            ].join(" ")}
                          >
                            {f.result} {f.teamScore}-{f.opponentScore}{" "}
                            {f.isHome ? "vs" : "@"} {f.opponentShort}
                          </span>
                        ))}
                        {recent.length === 0 && (
                          <span className="text-xs text-zinc-500">
                            No finished matches yet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load clubs"
        }
      />
    );
  }
}
