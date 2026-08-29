import { PointsClient } from "@/components/PointsClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function PointsPage() {
  try {
    const insights = await getLeagueInsights(5);
    const gw = insights.pointsEvent?.id ?? insights.currentEvent?.id ?? 1;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Points</h1>
        </div>
        <PointsClient
          allPlayers={insights.scored}
          currentGameweek={gw}
          horizon={5}
        />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load points"
        }
      />
    );
  }
}
