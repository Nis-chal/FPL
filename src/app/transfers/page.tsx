import { TransfersClient } from "@/components/TransfersClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";

export const revalidate = 60;

export default async function TransfersPage() {
  try {
    const insights = await getLeagueInsights(5);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Transfers</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Suggestions maximise expected points over a 3–7 fixture horizon:
            start chance, xG/xA per 90, clean-sheet chance, and fixtures — not
            past points alone. Enter your FPL team ID for personal swaps and a
            team rating.
          </p>
        </div>
        <TransfersClient allPlayers={insights.scored} initialHorizon={5} />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load transfers"
        }
      />
    );
  }
}
