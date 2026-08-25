import type { ScoredPlayer, TransferSuggestion } from "@/lib/types";

function clubCount(squad: ScoredPlayer[], teamId: number, excludeId?: number): number {
  return squad.filter((p) => p.teamId === teamId && p.id !== excludeId).length;
}

/**
 * Transfer appeal = expected points first, then starts, underlying attack, fixtures.
 * Past form is only a small residual via projectedPoints blend.
 */
function appeal(p: ScoredPlayer): number {
  return (
    p.projectedPoints * 2.5 +
    p.expectedPointsPerGw * 1.5 +
    p.startChance * 4 +
    p.xgi90 * 8 +
    (p.attackingThreat / 100) * 2 +
    (p.nextWinChance / 100) * 1.5 +
    (p.position === "GKP" || p.position === "DEF"
      ? (p.cleanSheetChance / 100) * 2
      : 0) -
    p.upcomingAvgDifficulty * 0.6 +
    (p.isPenTaker ? 1.5 : 0)
  );
}

export function suggestTransfers(
  squad: ScoredPlayer[],
  allPlayers: ScoredPlayer[],
  bankTenths: number,
  limit = 8,
  horizon = 5,
): TransferSuggestion[] {
  if (squad.length === 0) return [];

  const squadIds = new Set(squad.map((p) => p.id));
  const outs = [...squad].sort((a, b) => appeal(a) - appeal(b));
  const suggestions: TransferSuggestion[] = [];

  for (const out of outs.slice(0, 12)) {
    const budget = bankTenths + out.price;
    const candidates = allPlayers
      .filter((p) => !squadIds.has(p.id))
      .filter((p) => p.position === out.position)
      .filter((p) => p.price <= budget)
      .filter((p) => clubCount(squad, p.teamId, out.id) < 3)
      .filter((p) => p.startChance >= 0.35)
      .filter((p) => appeal(p) > appeal(out) + 0.5)
      .sort((a, b) => appeal(b) - appeal(a));

    const bestIn = candidates[0];
    if (!bestIn) continue;

    const netProjectedGain = Number(
      (bestIn.projectedPoints - out.projectedPoints).toFixed(2),
    );
    const threatDelta = bestIn.attackingThreat - out.attackingThreat;
    const winChanceDelta = bestIn.nextWinChance - out.nextWinChance;
    const costDelta = bestIn.price - out.price;

    const reasons = [
      `Horizon: next ${horizon} fixtures (xPts model)`,
      `xPts ${out.projectedPoints.toFixed(1)} → ${bestIn.projectedPoints.toFixed(1)} (${netProjectedGain >= 0 ? "+" : ""}${netProjectedGain.toFixed(1)})`,
      `Start ${Math.round(out.startChance * 100)}% → ${Math.round(bestIn.startChance * 100)}%`,
      `xGI/90 ${out.xgi90.toFixed(2)} → ${bestIn.xgi90.toFixed(2)}`,
      `Threat ${out.attackingThreat} → ${bestIn.attackingThreat} · win ${out.nextWinChance}% → ${bestIn.nextWinChance}%`,
      ...bestIn.reasons.slice(0, 2),
    ];

    suggestions.push({
      out,
      in: bestIn,
      netProjectedGain,
      costDelta,
      threatDelta,
      winChanceDelta,
      horizon,
      reasons,
    });
  }

  const seenIn = new Set<number>();
  const unique: TransferSuggestion[] = [];
  for (const s of suggestions.sort((a, b) => {
    const scoreA =
      a.netProjectedGain * 2.5 +
      (a.in.startChance - a.out.startChance) * 3 +
      a.threatDelta / 25 +
      a.winChanceDelta / 30;
    const scoreB =
      b.netProjectedGain * 2.5 +
      (b.in.startChance - b.out.startChance) * 3 +
      b.threatDelta / 25 +
      b.winChanceDelta / 30;
    return scoreB - scoreA;
  })) {
    if (seenIn.has(s.in.id)) continue;
    seenIn.add(s.in.id);
    unique.push(s);
    if (unique.length >= limit) break;
  }

  return unique;
}

export function bestInboundTargets(
  allPlayers: ScoredPlayer[],
  limit = 15,
): ScoredPlayer[] {
  return allPlayers
    .filter((p) => p.startChance >= 0.45)
    .filter((p) => p.availabilityFactor >= 0.45)
    .filter(
      (p) =>
        p.minutes >= 90 ||
        p.xgi90 >= 0.25 ||
        p.attackingThreat >= 40 ||
        p.expectedPointsPerGw >= 3,
    )
    .sort((a, b) => {
      const scoreA =
        a.projectedPoints * 2.2 +
        a.expectedPointsPerGw * 1.2 +
        a.startChance * 3 +
        a.xgi90 * 6;
      const scoreB =
        b.projectedPoints * 2.2 +
        b.expectedPointsPerGw * 1.2 +
        b.startChance * 3 +
        b.xgi90 * 6;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.valueScore - a.valueScore;
    })
    .slice(0, limit);
}
