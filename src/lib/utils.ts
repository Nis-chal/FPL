import type {
  BootstrapStatic,
  FixtureView,
  FplElement,
  FplEvent,
  FplFixture,
  FplTeam,
  Position,
} from "@/lib/types";

export const POSITION_MAP: Record<number, Position> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export const SQUAD_LIMITS: Record<Position, number> = {
  GKP: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export const BUDGET = 1000; // tenths of a million (100.0m) — FPL hard max
export const BUDGET_MIN = 800; // £80.0m practical floor for a full 15

export const BUDGET_PRESETS = [800, 850, 900, 950, 1000] as const;

/** Clamp squad budget to £80–£100m (tenths). */
export function clampBudget(tenths: number): number {
  if (!Number.isFinite(tenths)) return BUDGET;
  return Math.min(BUDGET, Math.max(BUDGET_MIN, Math.round(tenths)));
}

export function parseBudget(
  value: string | null | undefined,
  fallback = BUDGET,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  // Accept £m (e.g. 100) or tenths (e.g. 1000)
  const tenths = n <= 150 ? Math.round(n * 10) : Math.round(n);
  return clampBudget(tenths);
}

export function priceToMillions(nowCost: number): number {
  return nowCost / 10;
}

export function formatPrice(nowCost: number): string {
  return `£${priceToMillions(nowCost).toFixed(1)}m`;
}

export function getCurrentEvent(events: FplEvent[]): FplEvent | undefined {
  return events.find((e) => e.is_current) ?? events.find((e) => e.is_next);
}

export function getNextEvent(events: FplEvent[]): FplEvent | undefined {
  return events.find((e) => e.is_next) ?? events.find((e) => e.is_current);
}

export function teamMap(teams: FplTeam[]): Map<number, FplTeam> {
  return new Map(teams.map((t) => [t.id, t]));
}

export function difficultyTone(difficulty: number): "easy" | "medium" | "hard" {
  if (difficulty <= 2) return "easy";
  if (difficulty === 3) return "medium";
  return "hard";
}

export function availabilityFactor(element: FplElement): number {
  const status = element.status;
  if (status === "u" || status === "i" || status === "s") {
    const chance =
      element.chance_of_playing_next_round ??
      element.chance_of_playing_this_round;
    if (chance === null || chance === undefined) return 0;
    return Math.max(0, Math.min(0.35, chance / 100));
  }
  if (status === "d") {
    const chance =
      element.chance_of_playing_next_round ??
      element.chance_of_playing_this_round ??
      50;
    return Math.max(0.2, chance / 100);
  }
  const chance = element.chance_of_playing_next_round;
  if (chance === null || chance === undefined) return 1;
  return Math.max(0.2, chance / 100);
}

export function toFixtureViews(
  fixtures: FplFixture[],
  teamId: number,
  teams: Map<number, FplTeam>,
): FixtureView[] {
  return fixtures
    .filter((f) => f.team_h === teamId || f.team_a === teamId)
    .map((f) => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponent = teams.get(opponentId);
      const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
      const teamScore = isHome ? f.team_h_score : f.team_a_score;
      const opponentScore = isHome ? f.team_a_score : f.team_h_score;
      let result: FixtureView["result"] = null;
      if (f.finished && teamScore !== null && opponentScore !== null) {
        if (teamScore > opponentScore) result = "W";
        else if (teamScore < opponentScore) result = "L";
        else result = "D";
      }
      return {
        id: f.id,
        event: f.event,
        kickoff_time: f.kickoff_time,
        isHome,
        opponentId,
        opponentName: opponent?.name ?? "Unknown",
        opponentShort: opponent?.short_name ?? "???",
        difficulty,
        finished: f.finished,
        teamScore,
        opponentScore,
        result,
      };
    })
    .sort((a, b) => {
      const at = a.kickoff_time ? new Date(a.kickoff_time).getTime() : 0;
      const bt = b.kickoff_time ? new Date(b.kickoff_time).getTime() : 0;
      return at - bt;
    });
}

export function nextFixturesForTeam(
  fixtures: FplFixture[],
  teamId: number,
  teams: Map<number, FplTeam>,
  limit = 7,
): FixtureView[] {
  return toFixtureViews(fixtures, teamId, teams)
    .filter((f) => !f.finished)
    .slice(0, limit);
}

export function recentFixturesForTeam(
  fixtures: FplFixture[],
  teamId: number,
  teams: Map<number, FplTeam>,
  limit = 7,
): FixtureView[] {
  return toFixtureViews(fixtures, teamId, teams)
    .filter((f) => f.finished)
    .slice(-limit)
    .reverse();
}

export function playerFullName(element: FplElement): string {
  return `${element.first_name} ${element.second_name}`.trim();
}

export function parseFloatSafe(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function summarizeBootstrap(bootstrap: BootstrapStatic) {
  const current = getCurrentEvent(bootstrap.events);
  const next = getNextEvent(bootstrap.events);
  return {
    currentEvent: current ?? null,
    nextEvent: next ?? null,
    teamCount: bootstrap.teams.length,
    playerCount: bootstrap.elements.length,
  };
}
