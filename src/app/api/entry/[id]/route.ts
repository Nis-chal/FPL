import { NextResponse } from "next/server";
import { FplMaintenanceError } from "@/lib/fpl-client";
import { getEntryInsights } from "@/lib/insights";
import { parseHorizon, parseIncludeAccumulated } from "@/lib/probabilities";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const entryId = Number(id);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const horizon = parseHorizon(searchParams.get("horizon"), 5);
    const includeAccumulated = parseIncludeAccumulated(
      searchParams.get("accumulated"),
      true,
    );
    const detail = await getEntryInsights(entryId, horizon, includeAccumulated);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof FplMaintenanceError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load FPL team. Check the team ID.",
      },
      { status: 502 },
    );
  }
}
