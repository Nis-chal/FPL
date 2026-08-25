import type { ScoredPlayer, TeamRating } from "@/lib/types";
import { horizonAverageDifficulty } from "@/lib/probabilities";

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Rate squad by expected-points drivers: starts, xPts, fixtures, threat, win/CS.
 */
export function rateTeam(
  squad: ScoredPlayer[],
  startingXi: ScoredPlayer[],
  horizon: number,
): TeamRating {
  const xi = startingXi.length > 0 ? startingXi : squad.slice(0, 11);
  if (xi.length === 0) {
    return {
      grade: "F",
      score: 0,
      horizon,
      summary: "No squad loaded.",
      breakdown: {
        form: 0,
        fixtures: 0,
        attackingThreat: 0,
        nextWinChance: 0,
        availability: 0,
      },
    };
  }

  const avgXpts =
    xi.reduce((s, p) => s + p.expectedPointsPerGw, 0) / xi.length;
  // ~2–8 xPts/GW → 0–100
  const xptsScore = Math.min(100, (avgXpts / 7) * 100);

  const avgStart =
    (xi.reduce((s, p) => s + p.startChance, 0) / xi.length) * 100;

  const avgFdr =
    xi.reduce(
      (s, p) => s + horizonAverageDifficulty(p.upcomingFixtures, horizon),
      0,
    ) / xi.length;
  const fixturesScore = Math.max(0, Math.min(100, (5 - avgFdr) * 33));

  const attackers = xi.filter((p) => p.position !== "GKP");
  const avgThreat =
    attackers.length > 0
      ? attackers.reduce((s, p) => s + p.attackingThreat, 0) / attackers.length
      : 40;

  const clubWin = new Map<number, number>();
  for (const p of xi) {
    if (!clubWin.has(p.teamId)) clubWin.set(p.teamId, p.nextWinChance);
  }
  const avgWin =
    [...clubWin.values()].reduce((s, v) => s + v, 0) /
    Math.max(1, clubWin.size);

  // Weight: starts + xPts dominate; form is folded into xPts already
  const score = Math.round(
    xptsScore * 0.32 +
      avgStart * 0.22 +
      fixturesScore * 0.18 +
      avgThreat * 0.16 +
      avgWin * 0.12,
  );

  const grade = gradeFromScore(score);
  const summaryParts = [
    `${avgXpts.toFixed(1)} xPts/GW`,
    `${Math.round(avgStart)}% starts`,
    `FDR ${avgFdr.toFixed(1)} next ${horizon}`,
    `Threat ${Math.round(avgThreat)}`,
    `Win ${Math.round(avgWin)}%`,
  ];

  return {
    grade,
    score,
    horizon,
    summary: summaryParts.join(" · "),
    breakdown: {
      form: Math.round(xptsScore),
      fixtures: Math.round(fixturesScore),
      attackingThreat: Math.round(avgThreat),
      nextWinChance: Math.round(avgWin),
      availability: Math.round(avgStart),
    },
  };
}
