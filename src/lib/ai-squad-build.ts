import { pickCaptain, pickViceCaptain } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { buildBestSquadByRating } from "@/lib/squad";
import type { AiSquadSnapshot } from "@/lib/db/ai-squad";
import type { BestSquad, RankBy, ScoredPlayer } from "@/lib/types";
import { BUDGET } from "@/lib/utils";

/** AI squad optimises team rating (fixtures, starts, form) — not raw xPts greedy pick. */
export const AI_SQUAD_RANK_BY: RankBy[] = ["team_rating"];
export const AI_SQUAD_HORIZON = 5;

export function prepareAiSquadPool(
  allPlayers: ScoredPlayer[],
  horizon = AI_SQUAD_HORIZON,
  includeAccumulated = true,
): ScoredPlayer[] {
  return applyHorizon(allPlayers, horizon, includeAccumulated);
}

/** Build the locked AI £100m squad (shared by /ai page and `bun run ai:reset`). */
export function buildAiSquad(
  allPlayers: ScoredPlayer[],
  options?: { horizon?: number; includeAccumulated?: boolean },
): BestSquad {
  const horizon = options?.horizon ?? AI_SQUAD_HORIZON;
  const pool = prepareAiSquadPool(
    allPlayers,
    horizon,
    options?.includeAccumulated ?? true,
  );
  const squad = buildBestSquadByRating(pool, BUDGET, horizon, "auto");
  if (!squad.captain || squad.startingXi.length === 0) return squad;

  const captain =
    pickCaptain(squad.startingXi, AI_SQUAD_RANK_BY, "current", "none") ??
    squad.captain;
  const vice =
    pickViceCaptain(
      squad.startingXi,
      captain,
      AI_SQUAD_RANK_BY,
      "current",
      "none",
    ) ?? squad.viceCaptain;

  return { ...squad, captain, viceCaptain: vice };
}

export function aiSquadSnapshotFromBuilt(
  built: BestSquad,
): Omit<AiSquadSnapshot, "updatedAt" | "key"> | null {
  if (!built.captain || built.startingXi.length !== 11 || built.bench.length !== 4) {
    return null;
  }
  return {
    startingXiIds: built.startingXi.map((p) => p.id),
    benchIds: built.bench.map((p) => p.id),
    captainId: built.captain.id,
    viceId: built.viceCaptain.id,
  };
}
