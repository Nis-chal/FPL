import { NextResponse } from "next/server";
import { getClubDetail } from "@/lib/insights";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const teamId = Number(id);
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ error: "Invalid club id" }, { status: 400 });
    }
    const detail = await getClubDetail(teamId);
    if (!detail) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load club" },
      { status: 502 },
    );
  }
}
