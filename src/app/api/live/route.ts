import { NextResponse } from "next/server";
import { getBootstrap, getEventLive, getFixtures } from "@/lib/fpl-client";
import { getCurrentEvent, teamMap } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      getBootstrap(),
      getFixtures(),
    ]);
    const current = getCurrentEvent(bootstrap.events);
    if (!current) {
      return NextResponse.json({
        event: null,
        isLive: false,
        elements: {},
        fixtures: [],
        topScorers: [],
      });
    }

    const teams = teamMap(bootstrap.teams);
    const eventFixtures = fixtures.filter((f) => f.event === current.id);
    const isLive =
      !current.finished &&
      eventFixtures.some((f) => f.started === true && !f.finished);

    let liveElements: Awaited<ReturnType<typeof getEventLive>>["elements"] = [];
    if (!current.finished) {
      try {
        const live = await getEventLive(current.id);
        liveElements = live.elements ?? [];
      } catch {
        liveElements = [];
      }
    }

    const elementsById: Record<
      number,
      { minutes: number; total_points: number; bonus: number; bps: number }
    > = {};
    for (const el of liveElements) {
      elementsById[el.id] = {
        minutes: el.stats?.minutes ?? 0,
        total_points: el.stats?.total_points ?? 0,
        bonus: el.stats?.bonus ?? 0,
        bps: el.stats?.bps ?? 0,
      };
    }

    const elementMeta = new Map(
      bootstrap.elements.map((e) => [
        e.id,
        {
          web_name: e.web_name,
          team: e.team,
          element_type: e.element_type,
          photo: e.photo,
        },
      ]),
    );

    const topScorers = liveElements
      .filter((el) => (el.stats?.total_points ?? 0) > 0)
      .sort(
        (a, b) => (b.stats?.total_points ?? 0) - (a.stats?.total_points ?? 0),
      )
      .slice(0, 12)
      .map((el) => {
        const meta = elementMeta.get(el.id);
        const team = meta ? teams.get(meta.team) : undefined;
        return {
          id: el.id,
          webName: meta?.web_name ?? `Player ${el.id}`,
          teamShort: team?.short_name ?? "???",
          teamCode: team?.code ?? 0,
          photo: meta?.photo ?? "",
          points: el.stats?.total_points ?? 0,
          minutes: el.stats?.minutes ?? 0,
        };
      });

    return NextResponse.json({
      event: {
        id: current.id,
        name: current.name,
        finished: current.finished,
        deadline_time: current.deadline_time,
      },
      isLive,
      elements: elementsById,
      fixtures: eventFixtures.map((f) => ({
        id: f.id,
        kickoff_time: f.kickoff_time,
        started: f.started,
        finished: f.finished,
        minutes: f.minutes,
        team_h: f.team_h,
        team_a: f.team_a,
        team_h_score: f.team_h_score,
        team_a_score: f.team_a_score,
        team_h_name: teams.get(f.team_h)?.short_name ?? "???",
        team_a_name: teams.get(f.team_a)?.short_name ?? "???",
      })),
      topScorers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load live data",
      },
      { status: 502 },
    );
  }
}
