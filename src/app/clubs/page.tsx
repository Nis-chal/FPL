import { ClubsClient } from "@/components/ClubsClient";
import { ErrorBox } from "@/components/ui";
import { getBootstrap, getFixtures } from "@/lib/fpl-client";
import { nextFixturesForTeam, recentFixturesForTeam, teamMap } from "@/lib/utils";

export const revalidate = 30;

export default async function ClubsPage() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      getBootstrap(),
      getFixtures(),
    ]);
    const teams = teamMap(bootstrap.teams);
    const clubs = bootstrap.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      upcoming: nextFixturesForTeam(fixtures, team.id, teams, 8),
      recent: recentFixturesForTeam(fixtures, team.id, teams, 5),
    }));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Clubs</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Fixtures and recent results. Optionally rank by easiest upcoming run
            (1–7 games).
          </p>
        </div>
        <ClubsClient clubs={clubs} />
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
