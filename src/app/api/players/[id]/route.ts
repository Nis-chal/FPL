import { NextResponse } from "next/server";
import { getPlayerDetail } from "@/lib/insights";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const playerId = Number(id);
    if (!Number.isFinite(playerId)) {
      return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
    }
    const detail = await getPlayerDetail(playerId);
    if (!detail) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load player",
      },
      { status: 502 },
    );
  }
}
