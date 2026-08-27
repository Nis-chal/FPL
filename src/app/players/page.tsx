import { PlayersClient } from "@/components/PlayersClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function PlayersPage() {
  try {
    const insights = await getLeagueInsights();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Players</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Search and filter by position or club. Sorted by expected points.
            When API-Football is configured, lists also show shots (on/total) and
            rating (free plan uses the newest season your key can access, often
            2024/25).
          </p>
        </div>
        <PlayersClient
          players={insights.scored}
          teams={insights.teams.map((t) => ({
            id: t.id,
            name: t.name,
            short_name: t.short_name,
          }))}
        />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load players"
        }
      />
    );
  }
}
