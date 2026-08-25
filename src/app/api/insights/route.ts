import { NextResponse } from "next/server";
import { getLeagueInsights } from "@/lib/insights";
import { parseHorizon, parseIncludeAccumulated } from "@/lib/probabilities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const horizon = parseHorizon(searchParams.get("horizon"), 5);
    const includeAccumulated = parseIncludeAccumulated(
      searchParams.get("accumulated"),
      true,
    );
    const insights = await getLeagueInsights(horizon, includeAccumulated);
    return NextResponse.json({
      horizon: insights.horizon,
      includeAccumulated: insights.includeAccumulated,
      currentEvent: insights.currentEvent,
      nextEvent: insights.nextEvent,
      topScorers: insights.topScorers,
      captainPick: insights.captainPick,
      transferTargets: insights.transferTargets,
      bestSquad: insights.bestSquad,
      modelRating: insights.modelRating,
      teams: insights.teams,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load insights",
      },
      { status: 502 },
    );
  }
}
