import type { BestSquad, Position, ScoredPlayer } from "@/lib/types";
import { BUDGET, SQUAD_LIMITS } from "@/lib/utils";

const FORMATIONS: Array<{ name: string; DEF: number; MID: number; FWD: number }> = [
  { name: "3-4-3", DEF: 3, MID: 4, FWD: 3 },
  { name: "3-5-2", DEF: 3, MID: 5, FWD: 2 },
  { name: "4-4-2", DEF: 4, MID: 4, FWD: 2 },
  { name: "4-3-3", DEF: 4, MID: 3, FWD: 3 },
  { name: "5-4-1", DEF: 5, MID: 4, FWD: 1 },
  { name: "5-3-2", DEF: 5, MID: 3, FWD: 2 },
];

function canAdd(
  player: ScoredPlayer,
  squad: ScoredPlayer[],
  remainingBudget: number,
): boolean {
  if (player.price > remainingBudget) return false;
  if (player.availabilityFactor < 0.35) return false;
  const posCount = squad.filter((p) => p.position === player.position).length;
  if (posCount >= SQUAD_LIMITS[player.position]) return false;
  const clubCount = squad.filter((p) => p.teamId === player.teamId).length;
  if (clubCount >= 3) return false;
  if (squad.some((p) => p.id === player.id)) return false;
  return true;
}

function pickBestXi(squad: ScoredPlayer[]): {
  startingXi: ScoredPlayer[];
  bench: ScoredPlayer[];
  formation: string;
  projectedPoints: number;
} {
  let best: {
    startingXi: ScoredPlayer[];
    bench: ScoredPlayer[];
    formation: string;
    projectedPoints: number;
  } | null = null;

  const byPos = (pos: Position) =>
    [...squad.filter((p) => p.position === pos)].sort(
      (a, b) => b.projectedPoints - a.projectedPoints,
    );

  for (const formation of FORMATIONS) {
    const gk = byPos("GKP");
    const def = byPos("DEF");
    const mid = byPos("MID");
    const fwd = byPos("FWD");

    if (
      gk.length < 1 ||
      def.length < formation.DEF ||
      mid.length < formation.MID ||
      fwd.length < formation.FWD
    ) {
      continue;
    }

    const startingXi = [
      gk[0],
      ...def.slice(0, formation.DEF),
      ...mid.slice(0, formation.MID),
      ...fwd.slice(0, formation.FWD),
    ];
    const startIds = new Set(startingXi.map((p) => p.id));
    const bench = squad
      .filter((p) => !startIds.has(p.id))
      .sort((a, b) => {
        // Bench GK first typically, then by projection
        if (a.position === "GKP" && b.position !== "GKP") return -1;
        if (b.position === "GKP" && a.position !== "GKP") return 1;
        return b.projectedPoints - a.projectedPoints;
      });

    const projectedPoints = startingXi.reduce(
      (sum, p) => sum + p.projectedPoints,
      0,
    );

    if (!best || projectedPoints > best.projectedPoints) {
      best = {
        startingXi,
        bench,
        formation: formation.name,
        projectedPoints: Number(projectedPoints.toFixed(2)),
      };
    }
  }

  if (!best) {
    // Fallback: top 11 by projection with at least 1 GK, 3 DEF, 2 MID, 1 FWD
    const sorted = [...squad].sort((a, b) => b.projectedPoints - a.projectedPoints);
    const xi: ScoredPlayer[] = [];
    for (const p of sorted) {
      if (xi.length >= 11) break;
      const counts = {
        GKP: xi.filter((x) => x.position === "GKP").length,
        DEF: xi.filter((x) => x.position === "DEF").length,
        MID: xi.filter((x) => x.position === "MID").length,
        FWD: xi.filter((x) => x.position === "FWD").length,
      };
      if (p.position === "GKP" && counts.GKP >= 1) continue;
      if (p.position === "DEF" && counts.DEF >= 5) continue;
      if (p.position === "MID" && counts.MID >= 5) continue;
      if (p.position === "FWD" && counts.FWD >= 3) continue;
      // Ensure room for minimums
      const remaining = 11 - xi.length - 1;
      const need =
        Math.max(0, 1 - counts.GKP) +
        Math.max(0, 3 - counts.DEF) +
        Math.max(0, 2 - counts.MID) +
        Math.max(0, 1 - counts.FWD);
      const wouldNeed =
        (p.position === "GKP" ? Math.max(0, 1 - (counts.GKP + 1)) : Math.max(0, 1 - counts.GKP)) +
        (p.position === "DEF" ? Math.max(0, 3 - (counts.DEF + 1)) : Math.max(0, 3 - counts.DEF)) +
        (p.position === "MID" ? Math.max(0, 2 - (counts.MID + 1)) : Math.max(0, 2 - counts.MID)) +
        (p.position === "FWD" ? Math.max(0, 1 - (counts.FWD + 1)) : Math.max(0, 1 - counts.FWD));
      if (wouldNeed > remaining) continue;
      void need;
      xi.push(p);
    }
    const ids = new Set(xi.map((p) => p.id));
    best = {
      startingXi: xi,
      bench: squad.filter((p) => !ids.has(p.id)),
      formation: "Custom",
      projectedPoints: Number(
        xi.reduce((s, p) => s + p.projectedPoints, 0).toFixed(2),
      ),
    };
  }

  return best;
}

/**
 * Greedy squad builder: fill each position with best projected players under budget/club caps.
 * Then refine by trying to swap in higher-value alternatives within residual budget.
 */
export function buildBestSquad(scored: ScoredPlayer[]): BestSquad {
  const candidates = scored
    .filter((p) => p.minutes > 0 || p.form > 0)
    .filter((p) => p.availabilityFactor >= 0.35);

  const squad: ScoredPlayer[] = [];
  let remaining = BUDGET;

  const positions: Position[] = ["GKP", "DEF", "MID", "FWD"];
  for (const pos of positions) {
    const needed = SQUAD_LIMITS[pos];
    const pool = candidates
      .filter((p) => p.position === pos)
      .sort((a, b) => {
        // Prefer projection, then value
        if (b.projectedPoints !== a.projectedPoints) {
          return b.projectedPoints - a.projectedPoints;
        }
        return b.valueScore - a.valueScore;
      });

    for (const player of pool) {
      if (squad.filter((p) => p.position === pos).length >= needed) break;
      if (!canAdd(player, squad, remaining)) continue;
      squad.push(player);
      remaining -= player.price;
    }
  }

  // Fill any shortfall with cheapest available
  if (squad.length < 15) {
    const pool = [...candidates].sort((a, b) => a.price - b.price);
    for (const player of pool) {
      if (squad.length >= 15) break;
      if (!canAdd(player, squad, remaining)) continue;
      squad.push(player);
      remaining -= player.price;
    }
  }

  // Upgrade pass: try to replace lower-projected players with better ones using leftover bank
  const upgrades = [...candidates].sort(
    (a, b) => b.projectedPoints - a.projectedPoints,
  );
  for (const candidate of upgrades) {
    if (squad.some((p) => p.id === candidate.id)) continue;
    const samePos = squad
      .filter((p) => p.position === candidate.position)
      .sort((a, b) => a.projectedPoints - b.projectedPoints);
    for (const weak of samePos) {
      const afterRemove = squad.filter((p) => p.id !== weak.id);
      const bank = remaining + weak.price;
      const clubOk =
        afterRemove.filter((p) => p.teamId === candidate.teamId).length < 3;
      if (!clubOk) continue;
      if (candidate.price > bank) continue;
      if (candidate.projectedPoints <= weak.projectedPoints + 0.15) continue;
      const idx = squad.findIndex((p) => p.id === weak.id);
      squad[idx] = candidate;
      remaining = bank - candidate.price;
      break;
    }
  }

  const { startingXi, bench, formation, projectedPoints } = pickBestXi(squad);
  const orderedXi = [...startingXi].sort(
    (a, b) => b.projectedPoints - a.projectedPoints,
  );
  const captain = orderedXi[0];
  const viceCaptain = orderedXi[1] ?? orderedXi[0];

  return {
    squad: [...squad].sort((a, b) => a.positionId - b.positionId || b.projectedPoints - a.projectedPoints),
    startingXi,
    bench,
    captain,
    viceCaptain,
    formation,
    totalCost: BUDGET - remaining,
    projectedPoints: Number(
      (projectedPoints + captain.projectedPoints).toFixed(2), // captain doubles
    ),
    bank: remaining,
  };
}
