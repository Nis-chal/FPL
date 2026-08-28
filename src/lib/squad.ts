import type {
  BestSquad,
  FormationRank,
  Position,
  RankBy,
  ScoredPlayer,
} from "@/lib/types";
import { chipPlayerScore, type ChipMode } from "@/lib/chips";
import { playerRatingContribution } from "@/lib/ranking";
import {
  filterSquadCandidates,
  pickOutfieldCaptain,
  pickOutfieldViceCaptain,
  pickStartingGoalkeeper,
} from "@/lib/squad-eligibility";
import { rateTeam } from "@/lib/team-rating";
import { BUDGET, SQUAD_LIMITS } from "@/lib/utils";

function buildScore(p: ScoredPlayer, chip: ChipMode): number {
  if (chip === "none") return p.projectedPoints;
  return chipPlayerScore(p, chip);
}

export const FORMATIONS = [
  { name: "3-4-3", DEF: 3, MID: 4, FWD: 3 },
  { name: "3-5-2", DEF: 3, MID: 5, FWD: 2 },
  { name: "4-4-2", DEF: 4, MID: 4, FWD: 2 },
  { name: "4-3-3", DEF: 4, MID: 3, FWD: 3 },
  { name: "5-4-1", DEF: 5, MID: 4, FWD: 1 },
  { name: "5-3-2", DEF: 5, MID: 3, FWD: 2 },
] as const;

export type FormationName = (typeof FORMATIONS)[number]["name"];
/** Auto = pick the strongest legal XI; otherwise lock that shape. */
export type FormationPreference = "auto" | FormationName;

export const FORMATION_PREFERENCE_OPTIONS: Array<{
  value: FormationPreference;
  label: string;
  hint: string;
}> = [
  { value: "auto", label: "Auto", hint: "Best XI points" },
  ...FORMATIONS.map((f) => ({
    value: f.name as FormationPreference,
    label: f.name,
    hint: `1-${f.DEF}-${f.MID}-${f.FWD}`,
  })),
];

export function parseFormationPreference(
  raw: string | null | undefined,
  fallback: FormationPreference = "auto",
): FormationPreference {
  if (raw == null || raw === "" || raw === "auto") return "auto";
  if (FORMATIONS.some((f) => f.name === raw)) return raw as FormationName;
  return fallback;
}

export function formationPreferenceLabel(pref: FormationPreference): string {
  if (pref === "auto") return "Auto formation";
  return pref;
}

/**
 * Rank legal FPL formations by projected XI points from a player pool
 * (max 3 per club). Used for “best formation” insights.
 */
export function rankFormations(players: ScoredPlayer[]): FormationRank[] {
  const pool = filterSquadCandidates(players);

  const byPos = (pos: Position) =>
    [...pool.filter((p) => p.position === pos)].sort(
      (a, b) => b.projectedPoints - a.projectedPoints,
    );

  const results: FormationRank[] = [];

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

    const startingXi: ScoredPlayer[] = [];
    const clubCount = new Map<number, number>();

    const tryAdd = (candidates: ScoredPlayer[], need: number): boolean => {
      let added = 0;
      for (const p of candidates) {
        if (added >= need) break;
        if (startingXi.some((x) => x.id === p.id)) continue;
        const clubs = clubCount.get(p.teamId) ?? 0;
        if (clubs >= 3) continue;
        startingXi.push(p);
        clubCount.set(p.teamId, clubs + 1);
        added += 1;
      }
      return added >= need;
    };

    if (
      !tryAdd(gk, 1) ||
      !tryAdd(def, formation.DEF) ||
      !tryAdd(mid, formation.MID) ||
      !tryAdd(fwd, formation.FWD)
    ) {
      continue;
    }

    const projectedPoints = Number(
      startingXi.reduce((s, p) => s + p.projectedPoints, 0).toFixed(2),
    );
    const expectedPointsPerGw = Number(
      (
        startingXi.reduce((s, p) => s + p.expectedPointsPerGw, 0) /
        Math.max(1, startingXi.length)
      ).toFixed(2),
    );

    results.push({
      name: formation.name,
      DEF: formation.DEF,
      MID: formation.MID,
      FWD: formation.FWD,
      projectedPoints,
      expectedPointsPerGw,
      startingXi,
    });
  }

  return results.sort((a, b) => b.projectedPoints - a.projectedPoints);
}

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

function posCounts(squad: ScoredPlayer[]): Record<Position, number> {
  return {
    GKP: squad.filter((p) => p.position === "GKP").length,
    DEF: squad.filter((p) => p.position === "DEF").length,
    MID: squad.filter((p) => p.position === "MID").length,
    FWD: squad.filter((p) => p.position === "FWD").length,
  };
}

/** Cheapest price seen per position in a candidate pool. */
function minPriceByPos(candidates: ScoredPlayer[]): Record<Position, number> {
  const mins: Record<Position, number> = {
    GKP: Number.POSITIVE_INFINITY,
    DEF: Number.POSITIVE_INFINITY,
    MID: Number.POSITIVE_INFINITY,
    FWD: Number.POSITIVE_INFINITY,
  };
  for (const p of candidates) {
    if (p.price < mins[p.position]) mins[p.position] = p.price;
  }
  for (const pos of Object.keys(mins) as Position[]) {
    if (!Number.isFinite(mins[pos])) mins[pos] = 40; // £4.0m fallback
  }
  return mins;
}

/** Lowest cost to finish a legal 2–5–5–3 from the current squad. */
function minCostToComplete(
  squad: ScoredPlayer[],
  mins: Record<Position, number>,
): number {
  const counts = posCounts(squad);
  let cost = 0;
  for (const pos of ["GKP", "DEF", "MID", "FWD"] as Position[]) {
    const need = SQUAD_LIMITS[pos] - counts[pos];
    if (need > 0) cost += need * mins[pos];
  }
  return cost;
}

function orderBench(
  bench: ScoredPlayer[],
  scoreFn: (p: ScoredPlayer) => number,
): ScoredPlayer[] {
  return [...bench].sort((a, b) => {
    if (a.position === "GKP" && b.position !== "GKP") return -1;
    if (b.position === "GKP" && a.position !== "GKP") return 1;
    return scoreFn(b) - scoreFn(a);
  });
}

/**
 * Split a 15 into best legal XI (max score) + exactly 4 bench.
 * With a locked formation preference, only that shape is tried (falls back to auto).
 */
function pickBestXi(
  squad: ScoredPlayer[],
  scoreFn: (p: ScoredPlayer) => number = (p) => p.projectedPoints,
  preferred: FormationPreference = "auto",
): {
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
    [...squad.filter((p) => p.position === pos)].sort((a, b) => {
      const scoreDiff = scoreFn(b) - scoreFn(a);
      if (Math.abs(scoreDiff) > 0.08) return scoreDiff;
      return b.startChance - a.startChance;
    });

  const tryFormations =
    preferred === "auto"
      ? FORMATIONS
      : FORMATIONS.filter((f) => f.name === preferred);

  const evaluate = (
    list: typeof FORMATIONS | readonly (typeof FORMATIONS)[number][],
  ) => {
    for (const formation of list) {
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

    const gkList = byPos("GKP");
      const gkStarter = pickStartingGoalkeeper(gkList, scoreFn);
      if (!gkStarter) continue;

      const startingXi = [
        gkStarter,
        ...def.slice(0, formation.DEF),
        ...mid.slice(0, formation.MID),
        ...fwd.slice(0, formation.FWD),
      ];
      if (startingXi.length !== 11) continue;

      const startIds = new Set(startingXi.map((p) => p.id));
      const bench = orderBench(
        squad.filter((p) => !startIds.has(p.id)),
        scoreFn,
      );
      if (squad.length === 15 && bench.length !== 4) continue;

      const projectedPoints = startingXi.reduce(
        (sum, p) => sum + scoreFn(p),
        0,
      );

      if (!best || projectedPoints > best.projectedPoints) {
        best = {
          startingXi,
          bench: bench.slice(0, Math.max(0, squad.length - 11)),
          formation: formation.name,
          projectedPoints: Number(projectedPoints.toFixed(2)),
        };
      }
    }
  };

  evaluate(tryFormations);
  if (!best && preferred !== "auto") {
    evaluate(FORMATIONS);
  }

  if (!best) {
    const sorted = [...squad].sort((a, b) => scoreFn(b) - scoreFn(a));
    const xi: ScoredPlayer[] = [];
    for (const p of sorted) {
      if (xi.length >= 11) break;
      const counts = posCounts(xi);
      if (p.position === "GKP" && counts.GKP >= 1) continue;
      if (p.position === "DEF" && counts.DEF >= 5) continue;
      if (p.position === "MID" && counts.MID >= 5) continue;
      if (p.position === "FWD" && counts.FWD >= 3) continue;
      const remainingSlots = 11 - xi.length - 1;
      const wouldNeed =
        Math.max(0, 1 - (counts.GKP + (p.position === "GKP" ? 1 : 0))) +
        Math.max(0, 3 - (counts.DEF + (p.position === "DEF" ? 1 : 0))) +
        Math.max(0, 2 - (counts.MID + (p.position === "MID" ? 1 : 0))) +
        Math.max(0, 1 - (counts.FWD + (p.position === "FWD" ? 1 : 0)));
      if (wouldNeed > remainingSlots) continue;
      xi.push(p);
    }
    const ids = new Set(xi.map((p) => p.id));
    const bench = orderBench(
      squad.filter((p) => !ids.has(p.id)),
      scoreFn,
    );
    best = {
      startingXi: xi.slice(0, 11),
      bench: bench.slice(0, 4),
      formation: "Custom",
      projectedPoints: Number(
        xi.slice(0, 11).reduce((s, p) => s + p.projectedPoints, 0).toFixed(2),
      ),
    };
  }

  return best;
}

/**
 * Build a full 15 (best XI + 4 bench) at ≤ budget, hard-capped at £100.0m.
 * Never exceeds budget; may finish under.
 */
export function buildBestSquad(
  scored: ScoredPlayer[],
  budgetTenths: number = BUDGET,
  chip: ChipMode = "none",
  formationPref: FormationPreference = "auto",
): BestSquad {
  const budget = Math.min(BUDGET, Math.max(700, Math.round(budgetTenths)));
  const minAvail = chip === "bench_boost" || chip === "free_hit" ? 0.4 : 0.35;
  const candidates = filterSquadCandidates(scored).filter(
    (p) => p.availabilityFactor >= minAvail,
  );

  const scoreFn = (p: ScoredPlayer) => buildScore(p, chip);
  const mins = minPriceByPos(candidates);
  const squad: ScoredPlayer[] = [];
  let remaining = budget;

  const tryAdd = (player: ScoredPlayer): boolean => {
    if (!canAdd(player, squad, remaining)) return false;
    const after = [...squad, player];
    if (remaining - player.price < minCostToComplete(after, mins)) return false;
    squad.push(player);
    remaining -= player.price;
    return true;
  };

  const positions: Position[] = ["GKP", "DEF", "MID", "FWD"];
  for (const pos of positions) {
    const needed = SQUAD_LIMITS[pos];
    const pool = candidates
      .filter((p) => p.position === pos)
      .sort((a, b) => {
        const diff = scoreFn(b) - scoreFn(a);
        if (Math.abs(diff) > 1e-9) return diff;
        return b.valueScore - a.valueScore;
      });
    for (const player of pool) {
      if (squad.filter((p) => p.position === pos).length >= needed) break;
      tryAdd(player);
    }
  }

  if (squad.length < 15) {
    const pool = [...candidates].sort(
      (a, b) => a.price - b.price || scoreFn(b) - scoreFn(a),
    );
    for (const player of pool) {
      if (squad.length >= 15) break;
      tryAdd(player);
    }
  }

  if (squad.length < 15) {
    const pool = [...candidates].sort((a, b) => a.price - b.price);
    for (const player of pool) {
      if (squad.length >= 15) break;
      if (!canAdd(player, squad, remaining)) continue;
      squad.push(player);
      remaining -= player.price;
    }
  }

  const upgrades = [...candidates].sort((a, b) => scoreFn(b) - scoreFn(a));
  for (const candidate of upgrades) {
    if (squad.some((p) => p.id === candidate.id)) continue;
    const samePos = squad
      .filter((p) => p.position === candidate.position)
      .sort((a, b) => scoreFn(a) - scoreFn(b));
    for (const weak of samePos) {
      const afterRemove = squad.filter((p) => p.id !== weak.id);
      const bank = remaining + weak.price;
      const clubOk =
        afterRemove.filter((p) => p.teamId === candidate.teamId).length < 3;
      if (!clubOk) continue;
      if (candidate.price > bank) continue;
      if (scoreFn(candidate) <= scoreFn(weak) + 0.15) continue;
      const nextRemaining = bank - candidate.price;
      if (nextRemaining < 0) continue;
      const idx = squad.findIndex((p) => p.id === weak.id);
      squad[idx] = candidate;
      remaining = nextRemaining;
      break;
    }
  }

  let totalCost = squad.reduce((s, p) => s + p.price, 0);
  if (totalCost > budget) {
    while (totalCost > budget && squad.length > 0) {
      squad.sort((a, b) => b.price - a.price);
      const dropped = squad.shift();
      if (!dropped) break;
      totalCost -= dropped.price;
    }
  }
  remaining = Math.max(0, budget - totalCost);
  totalCost = squad.reduce((s, p) => s + p.price, 0);

  const { startingXi, formation, projectedPoints } = pickBestXi(
    squad,
    scoreFn,
    formationPref,
  );
  const captain =
    pickOutfieldCaptain(startingXi, scoreFn) ?? startingXi[0] ?? squad[0];
  const viceCaptain =
    pickOutfieldViceCaptain(startingXi, captain, scoreFn) ??
    captain;

  if (!captain) {
    const fallback = candidates[0] ?? scored[0];
    if (!fallback) {
      throw new Error("No players available to build a squad");
    }
    return {
      squad,
      startingXi: [],
      bench: squad,
      captain: fallback,
      viceCaptain: fallback,
      formation: "—",
      totalCost,
      projectedPoints: 0,
      bank: remaining,
    };
  }

  const xiIds = new Set(startingXi.map((p) => p.id));
  const finalBench = orderBench(
    squad.filter((p) => !xiIds.has(p.id)),
    scoreFn,
  ).slice(0, 4);
  const finalXi = startingXi.length === 11 ? startingXi : startingXi.slice(0, 11);

  const xiOrFifteen =
    chip === "bench_boost"
      ? squad.reduce((s, p) => s + p.projectedPoints, 0)
      : projectedPoints;
  const captainExtra =
    chip === "bench_boost"
      ? 0
      : chip === "triple_captain"
        ? captain.projectedPoints * 2
        : captain.projectedPoints;

  return {
    squad: [...squad].sort(
      (a, b) => a.positionId - b.positionId || scoreFn(b) - scoreFn(a),
    ),
    startingXi: finalXi,
    bench: finalBench,
    captain,
    viceCaptain,
    formation,
    totalCost,
    projectedPoints: Number((xiOrFifteen + captainExtra).toFixed(2)),
    bank: remaining,
  };
}

function finalizeSquad(
  squad: ScoredPlayer[],
  remaining: number,
  budget: number,
  candidates: ScoredPlayer[],
  scored: ScoredPlayer[],
  optimize: "points" | "rating",
  horizon: number,
  formationPref: FormationPreference = "auto",
): BestSquad {
  const scoreFn =
    optimize === "rating"
      ? (p: ScoredPlayer) => playerRatingContribution(p)
      : (p: ScoredPlayer) => p.projectedPoints;
  let bestXi = pickBestXi(squad, scoreFn, formationPref);
  if (optimize === "rating") {
    let bestScore = rateTeam(squad, bestXi.startingXi, horizon).score;
    const list =
      formationPref === "auto"
        ? FORMATIONS
        : FORMATIONS.filter((f) => f.name === formationPref);
    const evaluate = (formations: typeof list) => {
      for (const formation of formations) {
        const byPos = (pos: Position) =>
          [...squad.filter((p) => p.position === pos)].sort(
            (a, b) =>
              playerRatingContribution(b) - playerRatingContribution(a),
          );
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
        const gkStarter = pickStartingGoalkeeper(gk, (p) =>
          playerRatingContribution(p),
        );
        if (!gkStarter) continue;
        const startingXi = [
          gkStarter,
          ...def.slice(0, formation.DEF),
          ...mid.slice(0, formation.MID),
          ...fwd.slice(0, formation.FWD),
        ];
        const startIds = new Set(startingXi.map((p) => p.id));
        const bench = squad.filter((p) => !startIds.has(p.id));
        const projectedPoints = Number(
          startingXi.reduce((s, p) => s + p.projectedPoints, 0).toFixed(2),
        );
        const score = rateTeam(squad, startingXi, horizon).score;
        if (score > bestScore) {
          bestScore = score;
          bestXi = {
            startingXi,
            bench,
            formation: formation.name,
            projectedPoints,
          };
        }
      }
    };
    evaluate(list);
    if (
      formationPref !== "auto" &&
      bestXi.formation !== formationPref
    ) {
      evaluate(FORMATIONS);
    }
  }

  const { startingXi, formation, projectedPoints } = bestXi;
  const xiIds = new Set(startingXi.map((p) => p.id));
  const bench = orderBench(
    squad.filter((p) => !xiIds.has(p.id)),
    (p) =>
      optimize === "rating"
        ? playerRatingContribution(p)
        : p.projectedPoints,
  ).slice(0, 4);
  const captain =
    pickOutfieldCaptain(startingXi, scoreFn) ?? startingXi[0] ?? squad[0];
  const viceCaptain =
    pickOutfieldViceCaptain(startingXi, captain, scoreFn) ?? captain;

  if (!captain) {
    const fallback = candidates[0] ?? scored[0];
    if (!fallback) {
      throw new Error("No players available to build a squad");
    }
    return {
      squad,
      startingXi: [],
      bench: squad,
      captain: fallback,
      viceCaptain: fallback,
      formation: "—",
      totalCost: budget - remaining,
      projectedPoints: 0,
      bank: remaining,
    };
  }

  return {
    squad: [...squad].sort(
      (a, b) =>
        a.positionId - b.positionId || b.projectedPoints - a.projectedPoints,
    ),
    startingXi: startingXi.slice(0, 11),
    bench,
    captain,
    viceCaptain,
    formation,
    totalCost: Math.min(budget, budget - remaining),
    projectedPoints: Number(
      (projectedPoints + captain.projectedPoints).toFixed(2),
    ),
    bank: Math.max(0, remaining),
  };
}

/**
 * Build a 15 within budget (≤ £100m) that maximises team rating grade/score.
 * May leave bank unused if that yields a higher-rated XI.
 */
export function buildBestSquadByRating(
  scored: ScoredPlayer[],
  budgetTenths: number = BUDGET,
  horizon = 5,
  formationPref: FormationPreference = "auto",
): BestSquad {
  const budget = Math.min(BUDGET, Math.max(700, Math.round(budgetTenths)));
  const candidates = filterSquadCandidates(scored).filter(
    (p) => p.availabilityFactor >= 0.35,
  );

  const squad: ScoredPlayer[] = [];
  let remaining = budget;
  const positions: Position[] = ["GKP", "DEF", "MID", "FWD"];

  for (const pos of positions) {
    const needed = SQUAD_LIMITS[pos];
    const pool = candidates
      .filter((p) => p.position === pos)
      .sort(
        (a, b) =>
          playerRatingContribution(b) - playerRatingContribution(a) ||
          b.projectedPoints - a.projectedPoints,
      );
    for (const player of pool) {
      if (squad.filter((p) => p.position === pos).length >= needed) break;
      if (!canAdd(player, squad, remaining)) continue;
      squad.push(player);
      remaining -= player.price;
    }
  }

  if (squad.length < 15) {
    const pool = [...candidates].sort(
      (a, b) =>
        playerRatingContribution(b) / Math.max(1, b.price) -
          playerRatingContribution(a) / Math.max(1, a.price) ||
        a.price - b.price,
    );
    for (const player of pool) {
      if (squad.length >= 15) break;
      if (!canAdd(player, squad, remaining)) continue;
      squad.push(player);
      remaining -= player.price;
    }
  }

  // Rating-driven upgrade pass (including cheaper → better rating swaps)
  let improved = true;
  let guard = 0;
  while (improved && guard < 40) {
    improved = false;
    guard += 1;
    const current = finalizeSquad(
      squad,
      remaining,
      budget,
      candidates,
      scored,
      "rating",
      horizon,
      formationPref,
    );
    const currentScore = rateTeam(
      current.squad,
      current.startingXi,
      horizon,
    ).score;

    const upgrades = [...candidates].sort(
      (a, b) => playerRatingContribution(b) - playerRatingContribution(a),
    );
    outer: for (const candidate of upgrades) {
      if (squad.some((p) => p.id === candidate.id)) continue;
      const samePos = squad.filter((p) => p.position === candidate.position);
      for (const weak of samePos) {
        const afterRemove = squad.filter((p) => p.id !== weak.id);
        const bank = remaining + weak.price;
        const clubOk =
          afterRemove.filter((p) => p.teamId === candidate.teamId).length < 3;
        if (!clubOk || candidate.price > bank) continue;

        const trial = [...afterRemove, candidate];
        const trialRemaining = bank - candidate.price;
        const trialBuilt = finalizeSquad(
          trial,
          trialRemaining,
          budget,
          candidates,
          scored,
          "rating",
          horizon,
          formationPref,
        );
        const trialScore = rateTeam(
          trialBuilt.squad,
          trialBuilt.startingXi,
          horizon,
        ).score;
        if (trialScore > currentScore) {
          const idx = squad.findIndex((p) => p.id === weak.id);
          squad[idx] = candidate;
          remaining = trialRemaining;
          improved = true;
          break outer;
        }
      }
    }
  }

  return finalizeSquad(
    squad,
    remaining,
    budget,
    candidates,
    scored,
    "rating",
    horizon,
    formationPref,
  );
}

/** Choose points or rating optimiser from active analyze filters + chip lens. */
export function buildRecommendedSquad(
  scored: ScoredPlayer[],
  budgetTenths: number,
  horizon: number,
  rankBy: RankBy | RankBy[],
  chip: ChipMode = "none",
  formationPref: FormationPreference = "auto",
): BestSquad {
  const modes = Array.isArray(rankBy) ? rankBy : [rankBy];
  if (modes.includes("team_rating") && chip === "none") {
    return buildBestSquadByRating(
      scored,
      budgetTenths,
      horizon,
      formationPref,
    );
  }
  return buildBestSquad(scored, budgetTenths, chip, formationPref);
}
