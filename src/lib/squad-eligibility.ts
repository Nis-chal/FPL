import type { ScoredPlayer } from "@/lib/types";

/** Captain / vice must be outfield — never GKP or DEF. */
export function isOutfieldCaptainCandidate(p: ScoredPlayer): boolean {
  return p.position === "MID" || p.position === "FWD";
}

/** Each club's #1 keeper by season minutes (must have played). */
export function primaryGoalkeeperIds(players: ScoredPlayer[]): Set<number> {
  const byTeam = new Map<number, ScoredPlayer[]>();
  for (const p of players) {
    if (p.position !== "GKP") continue;
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }

  const ids = new Set<number>();
  for (const gks of byTeam.values()) {
    const withMinutes = gks.filter((g) => g.minutes > 0);
    if (withMinutes.length === 0) continue;
    const primary = [...withMinutes].sort(
      (a, b) => b.minutes - a.minutes || b.startChance - a.startChance,
    )[0];
    if (primary) ids.add(primary.id);
  }
  return ids;
}

/**
 * Squad pool: appeared this season, likely to start, and (for GKP) club starter.
 */
export function isSquadEligible(
  p: ScoredPlayer,
  primaryGkIds: Set<number>,
): boolean {
  if (p.availabilityFactor < 0.35) return false;
  // Must have meaningful season minutes — not a unused squad player.
  if (p.minutes < 45) return false;
  if (p.startChance < 0.6) return false;
  if (p.position === "GKP") return primaryGkIds.has(p.id);
  return true;
}

export function filterSquadCandidates(players: ScoredPlayer[]): ScoredPlayer[] {
  const primaryGkIds = primaryGoalkeeperIds(players);
  return players.filter((p) => isSquadEligible(p, primaryGkIds));
}

/** XI starter between two squad keepers — highest start chance, then projection. */
export function pickStartingGoalkeeper(
  gks: ScoredPlayer[],
  scoreFn: (p: ScoredPlayer) => number,
): ScoredPlayer | undefined {
  if (gks.length === 0) return undefined;
  return [...gks].sort((a, b) => {
    const startDiff = b.startChance - a.startChance;
    if (Math.abs(startDiff) > 0.02) return startDiff;
    return scoreFn(b) - scoreFn(a);
  })[0];
}

export function pickOutfieldCaptain(
  startingXi: ScoredPlayer[],
  scoreFn: (p: ScoredPlayer) => number,
): ScoredPlayer | undefined {
  const pool = startingXi.filter(
    (p) =>
      isOutfieldCaptainCandidate(p) &&
      p.startChance >= 0.5 &&
      p.availabilityFactor >= 0.5,
  );
  const ranked = [...(pool.length > 0 ? pool : startingXi.filter(isOutfieldCaptainCandidate))].sort(
    (a, b) => scoreFn(b) - scoreFn(a),
  );
  return ranked[0];
}

export function pickOutfieldViceCaptain(
  startingXi: ScoredPlayer[],
  captain: ScoredPlayer,
  scoreFn: (p: ScoredPlayer) => number,
): ScoredPlayer | undefined {
  const pool = startingXi.filter(
    (p) =>
      p.id !== captain.id &&
      isOutfieldCaptainCandidate(p) &&
      p.startChance >= 0.45 &&
      p.availabilityFactor >= 0.45,
  );
  const ranked = [...pool].sort((a, b) => scoreFn(b) - scoreFn(a));
  return ranked[0] ?? captain;
}
