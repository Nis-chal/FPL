import type {
  ElementHistory,
  FixtureView,
  PastSeasonStats,
} from "@/lib/types";

export type VsOpponentMeeting = {
  round: number;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
  wasHome: boolean;
};

export type VsUpcomingClub = {
  opponentId: number;
  opponentName: string;
  opponentShort: string;
  nextEvent: number | null;
  nextIsHome: boolean;
  nextDifficulty: number;
  games: number;
  totalPoints: number;
  avgPoints: number;
  totalGoals: number;
  totalAssists: number;
  meetings: VsOpponentMeeting[];
};

/**
 * For each upcoming opponent, summarise this-season meetings (points / G / A).
 * FPL element history is current season only.
 */
export function buildVsUpcomingClubs(
  upcoming: Array<{
    opponentId: number;
    opponentName: string;
    opponentShort: string;
    event: number | null;
    isHome: boolean;
    difficulty: number;
  }>,
  history: Array<
    Pick<
      ElementHistory,
      | "opponent_team"
      | "round"
      | "total_points"
      | "goals_scored"
      | "assists"
      | "minutes"
      | "was_home"
    >
  >,
): VsUpcomingClub[] {
  return upcoming.map((u) => {
    const meetings = history
      .filter((h) => h.opponent_team === u.opponentId)
      .sort((a, b) => b.round - a.round)
      .map((h) => ({
        round: h.round,
        points: h.total_points,
        goals: h.goals_scored,
        assists: h.assists,
        minutes: h.minutes,
        wasHome: h.was_home,
      }));

    const totalPoints = meetings.reduce((s, m) => s + m.points, 0);
    const totalGoals = meetings.reduce((s, m) => s + m.goals, 0);
    const totalAssists = meetings.reduce((s, m) => s + m.assists, 0);
    const games = meetings.length;

    return {
      opponentId: u.opponentId,
      opponentName: u.opponentName,
      opponentShort: u.opponentShort,
      nextEvent: u.event,
      nextIsHome: u.isHome,
      nextDifficulty: u.difficulty,
      games,
      totalPoints,
      avgPoints: games > 0 ? Number((totalPoints / games).toFixed(1)) : 0,
      totalGoals,
      totalAssists,
      meetings,
    };
  });
}

/** Soft prior from past FPL seasons → pts per 90 for blending into ratings. */
export function pastSeasonPtsPer90(seasons: PastSeasonStats[]): number | null {
  const slice = seasons.slice(0, 3);
  if (slice.length === 0) return null;
  let pts = 0;
  let minutes = 0;
  for (const s of slice) {
    pts += s.total_points;
    minutes += s.minutes;
  }
  if (minutes < 90) return null;
  return pts / (minutes / 90);
}

export function fixtureLabel(f: Pick<FixtureView, "isHome" | "opponentShort">): string {
  return `${f.isHome ? "vs" : "@"} ${f.opponentShort}`;
}
