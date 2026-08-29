import { RecommendClient } from "@/components/RecommendClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function RecommendPage() {
  try {
    const insights = await getLeagueInsights(5);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Recommend</h1>
        </div>
        <RecommendClient
          allPlayers={insights.scored}
          upcomingGameweeks={insights.upcomingGameweeks}
          currentGameweek={insights.currentEvent?.id ?? 1}
          horizon={5}
        />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error
            ? error.message
            : "Failed to load recommendations"
        }
      />
    );
  }
}
