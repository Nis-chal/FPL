import { SquadClient } from "@/components/SquadClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function SquadPage() {
  try {
    const insights = await getLeagueInsights(5);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Best squad</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Model £100.0m / 15-man squad for your chosen fixture horizon. Team
            rating covers form, fixtures, attacking threat, next-win chance, and
            availability. Add your team ID to rate your own squad.
          </p>
        </div>
        <SquadClient allPlayers={insights.scored} initialHorizon={5} />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load squad"
        }
      />
    );
  }
}
