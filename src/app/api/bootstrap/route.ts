import { NextResponse } from "next/server";
import { getBootstrap } from "@/lib/fpl-client";
import { summarizeBootstrap } from "@/lib/utils";

export async function GET() {
  try {
    const bootstrap = await getBootstrap();
    return NextResponse.json({
      ...summarizeBootstrap(bootstrap),
      teams: bootstrap.teams.map((t) => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        strength: t.strength,
      })),
      events: bootstrap.events.map((e) => ({
        id: e.id,
        name: e.name,
        deadline_time: e.deadline_time,
        finished: e.finished,
        is_current: e.is_current,
        is_next: e.is_next,
      })),
      elements: bootstrap.elements.map((el) => ({
        id: el.id,
        web_name: el.web_name,
        team: el.team,
        element_type: el.element_type,
        now_cost: el.now_cost,
        form: el.form,
        total_points: el.total_points,
        selected_by_percent: el.selected_by_percent,
        status: el.status,
        news: el.news,
        minutes: el.minutes,
        chance_of_playing_next_round: el.chance_of_playing_next_round,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load bootstrap" },
      { status: 502 },
    );
  }
}
