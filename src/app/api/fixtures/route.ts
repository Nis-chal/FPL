import { NextResponse } from "next/server";
import { getFixtures } from "@/lib/fpl-client";

export async function GET() {
  try {
    const fixtures = await getFixtures();
    return NextResponse.json({ fixtures });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load fixtures" },
      { status: 502 },
    );
  }
}
