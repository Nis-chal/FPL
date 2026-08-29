import { SquadPageClient } from "@/components/SquadPageClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function SquadPage() {
  try {
    const insights = await getLeagueInsights(5);
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Squad</h1>
        </div>
        <SquadPageClient
          allPlayers={insights.scored}
          currentGameweek={insights.pointsEvent?.id ?? insights.currentEvent?.id ?? 1}
          initialHorizon={5}
        />
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
