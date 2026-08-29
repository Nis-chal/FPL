import { AiSquadClient } from "@/components/AiSquadClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function AiPage() {
  try {
    const insights = await getLeagueInsights(5);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">AI</h1>
        </div>
        <AiSquadClient
          allPlayers={insights.scored}
          initialHorizon={5}
          seasonPointsFromDatabase={insights.seasonPointsFromDatabase ?? false}
          currentGameweek={insights.pointsEvent?.id ?? insights.currentEvent?.id ?? 1}
        />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load AI Squad"
        }
      />
    );
  }
}
