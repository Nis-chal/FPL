import type {
  ElementHistory,
  FixtureView,
  PastSeasonStats,
} from "@/lib/types";

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export type InvolvementStats = {
  /** FPL Threat — attacking involvement proxy (shots not published). */
  threat: number;
  /** FPL Creativity — chance-creation / progressive-pass proxy. */
  creativity: number;
  defensiveContribution: number;
  clearancesBlocksInterceptions: number;
  tackles: number;
  recoveries: number;
};

export type VsOpponentMeeting = InvolvementStats & {
  round: number;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
  wasHome: boolean;
  kickoffTime: string | null;
  /** Player's team score first. */
  teamScore: number | null;
  opponentScore: number | null;
  result: "W" | "D" | "L" | null;
};

export type PastSeasonSlice = InvolvementStats & {
  seasonName: string;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
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
  /** Totals across this-season meetings (0 if none). */
  involvement: InvolvementStats;
  /** When no this-season H2H: last up to 5 FPL seasons (overall — FPL has no past H2H). */
  pastSeasons: PastSeasonSlice[];
};

function involvementFromHistory(
  h: Pick<
    ElementHistory,
    | "threat"
    | "creativity"
    | "defensive_contribution"
    | "clearances_blocks_interceptions"
    | "tackles"
    | "recoveries"
  >,
): InvolvementStats {
  return {
    threat: num(h.threat),
    creativity: num(h.creativity),
    defensiveContribution: h.defensive_contribution ?? 0,
    clearancesBlocksInterceptions: h.clearances_blocks_interceptions ?? 0,
    tackles: h.tackles ?? 0,
    recoveries: h.recoveries ?? 0,
  };
}

function involvementFromPast(s: PastSeasonStats): InvolvementStats {
  return {
    threat: num(s.threat),
    creativity: num(s.creativity),
    defensiveContribution: s.defensive_contribution ?? 0,
    clearancesBlocksInterceptions: s.clearances_blocks_interceptions ?? 0,
    tackles: s.tackles ?? 0,
    recoveries: s.recoveries ?? 0,
  };
}

function sumInvolvement(rows: InvolvementStats[]): InvolvementStats {
  return rows.reduce(
    (acc, r) => ({
      threat: acc.threat + r.threat,
      creativity: acc.creativity + r.creativity,
      defensiveContribution:
        acc.defensiveContribution + r.defensiveContribution,
      clearancesBlocksInterceptions:
        acc.clearancesBlocksInterceptions + r.clearancesBlocksInterceptions,
      tackles: acc.tackles + r.tackles,
      recoveries: acc.recoveries + r.recoveries,
    }),
    {
      threat: 0,
      creativity: 0,
      defensiveContribution: 0,
      clearancesBlocksInterceptions: 0,
      tackles: 0,
      recoveries: 0,
    },
  );
}

/**
 * For each upcoming opponent, summarise this-season meetings.
 * If none, attach last 5 overall FPL seasons (API has no per-opponent past history).
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
      | "kickoff_time"
      | "team_h_score"
      | "team_a_score"
      | "threat"
      | "creativity"
      | "defensive_contribution"
      | "clearances_blocks_interceptions"
      | "tackles"
      | "recoveries"
    >
  >,
  pastSeasons: PastSeasonStats[] = [],
): VsUpcomingClub[] {
  const pastSlices: PastSeasonSlice[] = [...pastSeasons]
    .slice(0, 5)
    .map((s) => ({
      seasonName: s.season_name,
      points: s.total_points,
      goals: s.goals_scored,
      assists: s.assists,
      minutes: s.minutes,
      ...involvementFromPast(s),
    }));

  return upcoming.map((u) => {
    const meetings = history
      .filter((h) => h.opponent_team === u.opponentId)
      .sort((a, b) => b.round - a.round)
      .map((h) => {
        const teamScore = h.was_home ? h.team_h_score : h.team_a_score;
        const opponentScore = h.was_home ? h.team_a_score : h.team_h_score;
        let result: VsOpponentMeeting["result"] = null;
        if (teamScore !== null && opponentScore !== null) {
          if (teamScore > opponentScore) result = "W";
          else if (teamScore < opponentScore) result = "L";
          else result = "D";
        }
        return {
          round: h.round,
          points: h.total_points,
          goals: h.goals_scored,
          assists: h.assists,
          minutes: h.minutes,
          wasHome: h.was_home,
          kickoffTime: h.kickoff_time ?? null,
          teamScore,
          opponentScore,
          result,
          ...involvementFromHistory(h),
        };
      });

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
      involvement: sumInvolvement(meetings),
      pastSeasons: games === 0 ? pastSlices : [],
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
