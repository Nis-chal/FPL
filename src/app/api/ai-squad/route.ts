import {
  getAiSquadSnapshot,
  saveAiSquadSnapshot,
  type AiSquadSnapshot,
  AI_SQUAD_KEY,
} from "@/lib/db/ai-squad";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await getAiSquadSnapshot();
    return NextResponse.json({ squad: snap });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load AI Squad",
        squad: null,
      },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<AiSquadSnapshot>;
    if (
      !Array.isArray(body.startingXiIds) ||
      !Array.isArray(body.benchIds) ||
      typeof body.captainId !== "number" ||
      typeof body.viceId !== "number"
    ) {
      return NextResponse.json({ error: "Invalid squad payload" }, { status: 400 });
    }
    await saveAiSquadSnapshot({
      key: AI_SQUAD_KEY,
      startingXiIds: body.startingXiIds.map(Number),
      benchIds: body.benchIds.map(Number),
      captainId: body.captainId,
      viceId: body.viceId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save AI Squad",
      },
      { status: 500 },
    );
  }
}

/** Reset is intentionally blocked here — use `bun run ai:reset`. */
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "AI Squad cannot be reset from the app. Run: bun run ai:reset",
    },
    { status: 403 },
  );
}
