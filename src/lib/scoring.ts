import type {
  BootstrapStatic,
  FixtureView,
  FplElement,
  FplFixture,
  ScoredPlayer,
} from "@/lib/types";
import {
  attackingThreatScore,
  estimateCleanSheetChance,
  estimateStartChance,
  estimateWinChance,
  horizonAverageDifficulty,
  per90Rates,
  projectPointsForHorizon,
} from "@/lib/probabilities";
import {
  availabilityFactor,
  nextFixturesForTeam,
  parseFloatSafe,
  playerFullName,
  POSITION_MAP,
  teamMap,
} from "@/lib/utils";

function recentFormFromBootstrap(element: FplElement): {
  avg: number;
  gamesProxy: number;
} {
  const form = parseFloatSafe(element.form);
  const ppg = parseFloatSafe(element.points_per_game);
  const avg = form > 0 ? form : ppg;
  const gamesProxy = Math.min(5, Math.max(1, Math.round(element.minutes / 90)));
  return { avg, gamesProxy };
}

function buildReasons(params: {
  recentAvg: number;
  upcoming: FixtureView[];
  horizon: number;
  startChance: number;
  element: FplElement;
  attackingThreat: number;
  nextWinChance: number;
  cleanSheetChance: number;
  xgi90: number;
  expectedPointsPerGw: number;
  projectedPoints: number;
  position: ScoredPlayer["position"];
  includeAccumulated: boolean;
}): string[] {
  const {
    recentAvg,
    upcoming,
    horizon,
    startChance,
    element,
    attackingThreat,
    nextWinChance,
    cleanSheetChance,
    xgi90,
    expectedPointsPerGw,
    projectedPoints,
    position,
    includeAccumulated,
  } = params;

  const reasons: string[] = [];
  reasons.push(
    includeAccumulated
      ? `Includes accumulated form · ~${expectedPointsPerGw.toFixed(1)} xPts/GW · ${projectedPoints.toFixed(1)} over next ${horizon}`
      : `Underlying only (accumulated points off) · ~${expectedPointsPerGw.toFixed(1)} xPts/GW · ${projectedPoints.toFixed(1)} over next ${horizon}`,
  );
  reasons.push(
    `${Math.round(startChance * 100)}% start / minutes chance (minutes dominate)`,
  );
  reasons.push(
    `Underlying ${xgi90.toFixed(2)} xGI/90 · threat ${attackingThreat}/100`,
  );

  if (upcoming.length > 0) {
    const slice = upcoming.slice(0, horizon);
    const fdr = slice.map((f) => f.difficulty).join("-");
    reasons.push(`FDR ${fdr} next ${slice.length}`);
    reasons.push(`Club next-win ~${nextWinChance}%`);
    if (position === "GKP" || position === "DEF") {
      reasons.push(`Clean-sheet chance ~${cleanSheetChance}%`);
    }
  }

  if (element.penalties_order === 1) {
    reasons.push("On penalties (set-piece boost)");
  } else if (element.corners_and_indirect_freekicks_order === 1) {
    reasons.push("Takes corners");
  }

  if (startChance < 0.75) {
    const chance =
      element.chance_of_playing_next_round ??
      element.chance_of_playing_this_round;
    if (chance !== null && chance !== undefined) {
      reasons.push(`FPL lists ${chance}% chance of playing`);
    } else if (element.news) {
      reasons.push(element.news);
    }
  }

  reasons.push(
    includeAccumulated
      ? `Form ${recentAvg.toFixed(1)} pts/g blended into score`
      : `Form ${recentAvg.toFixed(1)} pts/g ignored (toggle off)`,
  );
  return reasons;
}

function scoreOne(
  el: FplElement,
  fixtures: FplFixture[],
  teams: ReturnType<typeof teamMap>,
  horizon: number,
  includeAccumulated: boolean,
): ScoredPlayer {
  const team = teams.get(el.team);
  const position = POSITION_MAP[el.element_type];
  const upcoming = nextFixturesForTeam(fixtures, el.team, teams, 7);
  const { avg: recentAvg, gamesProxy } = recentFormFromBootstrap(el);
  const next = upcoming[0] ?? null;
  const avail = availabilityFactor(el);
  const startChance = estimateStartChance(el);
  const rates = per90Rates(el);
  const attackingThreat = attackingThreatScore(el, position);
  const epNext = parseFloatSafe(el.ep_next);

  let nextWinChance = 50;
  let cleanSheetChance = 30;
  if (next && team) {
    const opponent = teams.get(next.opponentId);
    if (opponent) {
      nextWinChance = estimateWinChance(
        team,
        opponent,
        next.isHome,
        next.difficulty,
      );
      cleanSheetChance = estimateCleanSheetChance(
        team,
        opponent,
        next.isHome,
        next.difficulty,
        nextWinChance,
      );
    }
  }

  const { projectedPoints, expectedPointsPerGw } = projectPointsForHorizon({
    position,
    recentAvgPoints: recentAvg,
    startChance,
    availabilityFactor: avail,
    xg90: rates.xg90,
    xa90: rates.xa90,
    xgi90: rates.xgi90,
    xgc90: rates.xgc90,
    attackingThreat,
    upcomingFixtures: upcoming,
    horizon,
    nextWinChance,
    nextCleanSheetChance: cleanSheetChance,
    epNext: epNext > 0 ? epNext : null,
    penaltiesOrder: el.penalties_order,
    includeAccumulated,
  });

  const price = el.now_cost / 10;
  const upcomingAvgDifficulty = Number(
    horizonAverageDifficulty(upcoming, horizon).toFixed(2),
  );

  return {
    id: el.id,
    webName: el.web_name,
    fullName: playerFullName(el),
    teamId: el.team,
    teamName: team?.name ?? "Unknown",
    teamShort: team?.short_name ?? "???",
    teamCode: team?.code ?? 0,
    photo: el.photo,
    position,
    positionId: el.element_type,
    price: el.now_cost,
    selectedBy: parseFloatSafe(el.selected_by_percent),
    totalPoints: el.total_points,
    eventPoints: el.event_points ?? 0,
    form: parseFloatSafe(el.form),
    minutes: el.minutes,
    status: el.status,
    news: el.news,
    newsAdded: el.news_added ?? null,
    chanceOfPlaying: el.chance_of_playing_next_round,
    recentAvgPoints: Number(recentAvg.toFixed(2)),
    recentGames: gamesProxy,
    nextDifficulty: next?.difficulty ?? null,
    nextOpponent: next
      ? `${next.isHome ? "vs" : "@"} ${next.opponentShort}`
      : null,
    nextIsHome: next?.isHome ?? null,
    upcomingAvgDifficulty,
    upcomingFixtures: upcoming,
    projectedPoints,
    expectedPointsPerGw,
    valueScore: price > 0 ? Number((projectedPoints / price).toFixed(3)) : 0,
    availabilityFactor: avail,
    startChance: Number(startChance.toFixed(3)),
    xg90: Number(rates.xg90.toFixed(3)),
    xa90: Number(rates.xa90.toFixed(3)),
    xgi90: Number(rates.xgi90.toFixed(3)),
    xgc90: Number(rates.xgc90.toFixed(3)),
    isPenTaker: el.penalties_order === 1,
    attackingThreat,
    nextWinChance,
    cleanSheetChance,
    epNext: epNext > 0 ? epNext : null,
    reasons: buildReasons({
      recentAvg,
      upcoming,
      horizon,
      startChance,
      element: el,
      attackingThreat,
      nextWinChance,
      cleanSheetChance,
      xgi90: rates.xgi90,
      expectedPointsPerGw,
      projectedPoints,
      position,
      includeAccumulated,
    }),
  };
}

export function applyHorizon(
  players: ScoredPlayer[],
  horizon: number,
  includeAccumulated = true,
): ScoredPlayer[] {
  return players
    .map((p) => {
      const { projectedPoints, expectedPointsPerGw } = projectPointsForHorizon({
        position: p.position,
        recentAvgPoints: p.recentAvgPoints,
        startChance: p.startChance,
        availabilityFactor: p.availabilityFactor,
        xg90: p.xg90,
        xa90: p.xa90,
        xgi90: p.xgi90,
        xgc90: p.xgc90,
        attackingThreat: p.attackingThreat,
        upcomingFixtures: p.upcomingFixtures,
        horizon,
        nextWinChance: p.nextWinChance,
        nextCleanSheetChance: p.cleanSheetChance,
        epNext: includeAccumulated ? p.epNext : null,
        penaltiesOrder: p.isPenTaker ? 1 : null,
        includeAccumulated,
      });
      const price = p.price / 10;
      const upcomingAvgDifficulty = Number(
        horizonAverageDifficulty(p.upcomingFixtures, horizon).toFixed(2),
      );
      return {
        ...p,
        projectedPoints,
        expectedPointsPerGw,
        upcomingAvgDifficulty,
        valueScore:
          price > 0 ? Number((projectedPoints / price).toFixed(3)) : 0,
        reasons: [
          includeAccumulated
            ? `Includes accumulated form · ~${expectedPointsPerGw.toFixed(1)} xPts/GW · ${projectedPoints.toFixed(1)} over next ${horizon}`
            : `Underlying only (accumulated points off) · ~${expectedPointsPerGw.toFixed(1)} xPts/GW · ${projectedPoints.toFixed(1)} over next ${horizon}`,
          `${Math.round(p.startChance * 100)}% start / minutes chance`,
          `Underlying ${p.xgi90.toFixed(2)} xGI/90 · threat ${p.attackingThreat}/100`,
          `FDR run next ${horizon}: ${
            p.upcomingFixtures
              .slice(0, horizon)
              .map((f) => f.difficulty)
              .join("-") || "n/a"
          }`,
          `Club next-win ~${p.nextWinChance}%`,
          ...(p.position === "GKP" || p.position === "DEF"
            ? [`Clean-sheet chance ~${p.cleanSheetChance}%`]
            : []),
          includeAccumulated
            ? `Form ${p.recentAvgPoints.toFixed(1)} pts/g blended into score`
            : `Form ${p.recentAvgPoints.toFixed(1)} pts/g ignored (toggle off)`,
          ...p.reasons.filter(
            (r) =>
              !r.includes("xPts") &&
              !r.includes("accumulated") &&
              !r.includes("Underlying only") &&
              !r.includes("start / minutes") &&
              !r.includes("xGI/90") &&
              !r.includes("FDR") &&
              !r.includes("next-win") &&
              !r.includes("Clean-sheet") &&
              !r.includes("Form "),
          ),
        ],
      };
    })
    .sort((a, b) => b.projectedPoints - a.projectedPoints);
}

export function scorePlayers(
  bootstrap: BootstrapStatic,
  fixtures: FplFixture[],
  horizon = 5,
  includeAccumulated = true,
): ScoredPlayer[] {
  const teams = teamMap(bootstrap.teams);
  const scored = bootstrap.elements
    .filter((el) => el.element_type >= 1 && el.element_type <= 4)
    .map((el) => scoreOne(el, fixtures, teams, horizon, includeAccumulated));
  return adjustGoalkeeperStartChances(scored).sort(
    (a, b) => b.projectedPoints - a.projectedPoints,
  );
}

/** Backup keepers share a team — scale start chance by minutes vs the #1. */
export function adjustGoalkeeperStartChances(
  players: ScoredPlayer[],
): ScoredPlayer[] {
  const byTeam = new Map<number, ScoredPlayer[]>();
  for (const p of players) {
    if (p.position !== "GKP") continue;
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }

  const nextStart = new Map<number, number>();
  for (const gks of byTeam.values()) {
    const maxMinutes = Math.max(0, ...gks.map((g) => g.minutes));
    for (const g of gks) {
      if (maxMinutes <= 0) continue;
      const share = g.minutes / maxMinutes;
      const scaled = g.startChance * (0.12 + 0.88 * share);
      nextStart.set(g.id, Number(Math.max(0.05, Math.min(1, scaled)).toFixed(3)));
    }
  }

  return players.map((p) =>
    nextStart.has(p.id) ? { ...p, startChance: nextStart.get(p.id)! } : p,
  );
}

export function topProjected(
  scored: ScoredPlayer[],
  limit = 10,
  options?: { minMinutes?: number; availableOnly?: boolean; minStartChance?: number },
): ScoredPlayer[] {
  const minMinutes = options?.minMinutes ?? 0;
  const minStart = options?.minStartChance ?? 0;
  return scored
    .filter((p) => p.minutes >= minMinutes)
    .filter((p) => p.startChance >= minStart)
    .filter((p) => (options?.availableOnly ? p.availabilityFactor >= 0.5 : true))
    .slice(0, limit);
}

/** Overlay official FPL live minutes/points; confirm start when already played. */
export function applyLiveOverlay(
  players: ScoredPlayer[],
  liveById: Record<number, { minutes: number; total_points: number }>,
): ScoredPlayer[] {
  return players.map((p) => {
    const live = liveById[p.id];
    if (!live) return p;
    const liveMinutes = live.minutes ?? 0;
    const livePoints = live.total_points ?? 0;
    const confirmedStart =
      liveMinutes > 0
        ? Math.max(p.startChance, liveMinutes >= 60 ? 1 : 0.85)
        : p.startChance;
    return {
      ...p,
      liveMinutes,
      livePoints,
      startChance: Number(confirmedStart.toFixed(3)),
    };
  });
}

/**
 * Recompute per-90 rates from recent element-summary history (last 3–5 GWs).
 * Used on player detail to tighten projections without inventing new sources.
 */
export function recentRatesFromHistory(
  history: Array<{
    minutes: number;
    expected_goals: string | number;
    expected_assists: string | number;
  }>,
  limit = 5,
): { xg90: number; xa90: number; xgi90: number; sampleMinutes: number } | null {
  const slice = history.filter((h) => h.minutes > 0).slice(0, limit);
  if (slice.length === 0) return null;
  const minutes = slice.reduce((s, h) => s + h.minutes, 0);
  if (minutes < 30) return null;
  const nineties = minutes / 90;
  let xg = 0;
  let xa = 0;
  for (const h of slice) {
    xg += Number(h.expected_goals) || 0;
    xa += Number(h.expected_assists) || 0;
  }
  return {
    xg90: xg / nineties,
    xa90: xa / nineties,
    xgi90: (xg + xa) / nineties,
    sampleMinutes: minutes,
  };
}
