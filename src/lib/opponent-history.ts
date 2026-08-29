import type {
  ElementHistory,
  FixtureView,
  FplFixture,
  FplTeam,
  PastSeasonStats,
} from "@/lib/types";
import { headToHeadFixtures } from "@/lib/utils";

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
  /** e.g. "2024/25" or "2025/26" */
  seasonLabel: string;
};

export type VsUpcomingClub = {
  opponentId: number;
  opponentName: string;
  opponentShort: string;
  nextEvent: number | null;
  nextIsHome: boolean;
  nextDifficulty: number;
  /** Next fixture is live or provisional. */
  nextIsCurrent?: boolean;
  nextIsLive?: boolean;
  nextMinutes?: number;
  nextTeamScore?: number | null;
  nextOpponentScore?: number | null;
  games: number;
  totalPoints: number;
  avgPoints: number;
  totalGoals: number;
  totalAssists: number;
  /** Up to last 5 meetings (this + prior seasons). */
  meetings: VsOpponentMeeting[];
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

function meetingKey(m: Pick<VsOpponentMeeting, "kickoffTime" | "round" | "seasonLabel">): string {
  return `${m.seasonLabel}|${m.kickoffTime ?? ""}|${m.round}`;
}

/**
 * For each upcoming opponent, last N H2H meetings (this season + archives).
 */
export function buildVsUpcomingClubs(
  upcoming: FixtureView[],
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
  options?: {
    currentSeasonLabel?: string;
    historicalByShort?: Map<string, VsOpponentMeeting[]>;
    limit?: number;
  },
): VsUpcomingClub[] {
  const limit = options?.limit ?? 5;
  const currentSeasonLabel = options?.currentSeasonLabel ?? "2026/27";
  const historicalByShort = options?.historicalByShort;

  return upcoming.map((u) => {
    const thisSeason = history
      .filter((h) => h.opponent_team === u.opponentId)
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
          seasonLabel: currentSeasonLabel,
          ...involvementFromHistory(h),
        } satisfies VsOpponentMeeting;
      });

    const archived = historicalByShort?.get(u.opponentShort) ?? [];
    const seen = new Set<string>();
    const merged: VsOpponentMeeting[] = [];
    for (const m of [...thisSeason, ...archived]) {
      const key = meetingKey(m);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(m);
    }

    merged.sort((a, b) => {
      const at = a.kickoffTime ? new Date(a.kickoffTime).getTime() : 0;
      const bt = b.kickoffTime ? new Date(b.kickoffTime).getTime() : 0;
      return bt - at;
    });

    const meetings = merged.slice(0, limit);
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
      nextIsCurrent: u.isCurrent || u.isLive,
      nextIsLive: u.isLive,
      nextMinutes: u.minutes,
      nextTeamScore: u.teamScore,
      nextOpponentScore: u.opponentScore,
      games,
      totalPoints,
      avgPoints: games > 0 ? Number((totalPoints / games).toFixed(1)) : 0,
      totalGoals,
      totalAssists,
      meetings,
    };
  });
}

/** Club page: H2H scorelines vs each upcoming opponent (from FPL fixtures). */
export function buildClubVsUpcomingClubs(
  upcoming: FixtureView[],
  fixtures: FplFixture[],
  teamId: number,
  teams: Map<number, FplTeam>,
  currentSeasonLabel: string,
  limit = 5,
): VsUpcomingClub[] {
  return upcoming.map((u) => {
    const meetings: VsOpponentMeeting[] = headToHeadFixtures(
      fixtures,
      teamId,
      u.opponentId,
      teams,
    )
      .slice(0, limit)
      .map((f) => ({
        round: f.event ?? 0,
        points: 0,
        goals: 0,
        assists: 0,
        minutes: f.isLive ? f.minutes : f.hasResult ? 90 : 0,
        wasHome: f.isHome,
        kickoffTime: f.kickoff_time,
        teamScore: f.teamScore,
        opponentScore: f.opponentScore,
        result: f.result,
        seasonLabel: currentSeasonLabel,
        ...involvementFromHistory({
          threat: "0",
          creativity: "0",
          defensive_contribution: 0,
          clearances_blocks_interceptions: 0,
          tackles: 0,
          recoveries: 0,
        }),
      }));

    return {
      opponentId: u.opponentId,
      opponentName: u.opponentName,
      opponentShort: u.opponentShort,
      nextEvent: u.event,
      nextIsHome: u.isHome,
      nextDifficulty: u.difficulty,
      nextIsCurrent: u.isCurrent || u.isLive,
      nextIsLive: u.isLive,
      nextMinutes: u.minutes,
      nextTeamScore: u.teamScore,
      nextOpponentScore: u.opponentScore,
      games: meetings.length,
      totalPoints: 0,
      avgPoints: 0,
      totalGoals: 0,
      totalAssists: 0,
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
