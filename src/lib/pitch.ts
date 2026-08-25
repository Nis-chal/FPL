import type { ScoredPlayer } from "@/lib/types";

/** Simple 0–99 overall for jersey badge — xPts + starts + threat. */
export function playerOverall(player: ScoredPlayer): number {
  const xpts = Math.min(40, (player.expectedPointsPerGw / 7) * 40);
  const starts = player.startChance * 25;
  const threat = (player.attackingThreat / 100) * 20;
  const win = (player.nextWinChance / 100) * 10;
  const fixture = Math.max(0, (5 - player.upcomingAvgDifficulty) * 3);
  return Math.max(1, Math.min(99, Math.round(xpts + starts + threat + win + fixture)));
}

/** Horizon projected points shown on pitch (captain doubles if marked). */
export function displayProjected(
  player: ScoredPlayer,
  options?: { isCaptain?: boolean },
): number {
  const base = player.projectedPoints;
  return Number((options?.isCaptain ? base * 2 : base).toFixed(1));
}

export function formationFromXi(xi: ScoredPlayer[]): string {
  const def = xi.filter((p) => p.position === "DEF").length;
  const mid = xi.filter((p) => p.position === "MID").length;
  const fwd = xi.filter((p) => p.position === "FWD").length;
  return `${def}-${mid}-${fwd}`;
}

export function groupByPosition(players: ScoredPlayer[]): Record<
  "GKP" | "DEF" | "MID" | "FWD",
  ScoredPlayer[]
> {
  return {
    GKP: players.filter((p) => p.position === "GKP"),
    DEF: players.filter((p) => p.position === "DEF"),
    MID: players.filter((p) => p.position === "MID"),
    FWD: players.filter((p) => p.position === "FWD"),
  };
}

export function isValidStartingXi(xi: ScoredPlayer[]): boolean {
  if (xi.length !== 11) return false;
  const g = groupByPosition(xi);
  if (g.GKP.length !== 1) return false;
  if (g.DEF.length < 3 || g.DEF.length > 5) return false;
  if (g.MID.length < 2 || g.MID.length > 5) return false;
  if (g.FWD.length < 1 || g.FWD.length > 3) return false;
  return true;
}

export function trySwap(
  startingXi: ScoredPlayer[],
  bench: ScoredPlayer[],
  aId: number,
  bId: number,
): { startingXi: ScoredPlayer[]; bench: ScoredPlayer[] } | null {
  const aInXi = startingXi.find((p) => p.id === aId);
  const bInXi = startingXi.find((p) => p.id === bId);
  const aOnBench = bench.find((p) => p.id === aId);
  const bOnBench = bench.find((p) => p.id === bId);

  let starter: ScoredPlayer | undefined;
  let reserve: ScoredPlayer | undefined;

  if (aInXi && bOnBench) {
    starter = aInXi;
    reserve = bOnBench;
  } else if (bInXi && aOnBench) {
    starter = bInXi;
    reserve = aOnBench;
  } else {
    return null;
  }

  const nextXi = startingXi.map((p) => (p.id === starter!.id ? reserve! : p));
  const nextBench = bench.map((p) => (p.id === reserve!.id ? starter! : p));

  if (!isValidStartingXi(nextXi)) return null;
  return { startingXi: nextXi, bench: nextBench };
}

export function xiProjectedTotal(
  xi: ScoredPlayer[],
  captainId?: number,
): number {
  return Number(
    xi
      .reduce((sum, p) => {
        const pts = p.projectedPoints;
        return sum + (p.id === captainId ? pts * 2 : pts);
      }, 0)
      .toFixed(1),
  );
}
