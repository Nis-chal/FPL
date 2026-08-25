import { getBootstrap, getEntry, getEntryPicks, getFixtures } from "@/lib/fpl-client";
import { buildVsUpcomingClubs } from "@/lib/opponent-history";
import { pickCaptain } from "@/lib/ranking";
import { applyHorizon, scorePlayers, topProjected } from "@/lib/scoring";
import { buildBestSquad } from "@/lib/squad";
import { bestInboundTargets, suggestTransfers } from "@/lib/transfers";
import { rateTeam } from "@/lib/team-rating";
import type { ScoredPlayer } from "@/lib/types";
import {
  getCurrentEvent,
  getNextEvent,
  nextFixturesForTeam,
  recentFixturesForTeam,
  headToHeadFixtures,
  teamMap,
} from "@/lib/utils";

export async function getLeagueInsights(horizon = 5, includeAccumulated = true) {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);
  const scored = scorePlayers(bootstrap, fixtures, horizon, includeAccumulated);
  const bestSquad = buildBestSquad(scored);
  const topScorers = topProjected(scored, 12, {
    minMinutes: 1,
    availableOnly: true,
    minStartChance: 0.4,
  });
  const captainPick =
    pickCaptain(scored, ["overall"]) ?? topScorers[0] ?? bestSquad.captain;
  const transferTargets = bestInboundTargets(scored, 20);
  const currentEvent = getCurrentEvent(bootstrap.events) ?? null;
  const nextEvent = getNextEvent(bootstrap.events) ?? null;
  const modelRating = rateTeam(
    bestSquad.squad,
    bestSquad.startingXi,
    horizon,
  );

  return {
    horizon,
    includeAccumulated,
    currentEvent,
    nextEvent,
    topScorers,
    captainPick,
    transferTargets,
    bestSquad,
    modelRating,
    scored,
    teams: bootstrap.teams,
    fixtures,
  };
}

export async function getClubDetail(teamId: number, horizon = 5) {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);
  const team = bootstrap.teams.find((t) => t.id === teamId);
  if (!team) return null;

  const teams = teamMap(bootstrap.teams);
  const upcoming = nextFixturesForTeam(fixtures, teamId, teams, 7);
  const recent = recentFixturesForTeam(fixtures, teamId, teams, 7);
  const scored = scorePlayers(bootstrap, fixtures, horizon).filter(
    (p) => p.teamId === teamId,
  );

  const news = scored
    .filter((p) => p.news?.trim())
    .sort((a, b) => {
      const at = a.newsAdded ? new Date(a.newsAdded).getTime() : 0;
      const bt = b.newsAdded ? new Date(b.newsAdded).getTime() : 0;
      return bt - at;
    })
    .map((p) => ({
      playerId: p.id,
      playerName: p.webName,
      news: p.news,
      newsAdded: p.newsAdded,
      status: p.status,
      chanceOfPlaying: p.chanceOfPlaying,
    }));

  const vsUpcoming = upcoming.map((u) => {
    const meetings = headToHeadFixtures(fixtures, teamId, u.opponentId, teams);
    return {
      opponentId: u.opponentId,
      opponentName: u.opponentName,
      opponentShort: u.opponentShort,
      nextEvent: u.event,
      nextIsHome: u.isHome,
      nextDifficulty: u.difficulty,
      meetings,
    };
  });

  return {
    team,
    upcoming,
    recent,
    vsUpcoming,
    news,
    players: scored,
    horizon,
  };
}

export async function getPlayerDetail(playerId: number, horizon = 5) {
  const { getElementSummary } = await import("@/lib/fpl-client");
  const { projectPointsForHorizon } = await import("@/lib/probabilities");
  const { recentRatesFromHistory } = await import("@/lib/scoring");
  const [bootstrap, fixtures, summary] = await Promise.all([
    getBootstrap(),
    getFixtures(),
    getElementSummary(playerId),
  ]);
  const scored = scorePlayers(bootstrap, fixtures, horizon);
  let player = scored.find((p) => p.id === playerId);
  if (!player) return null;

  const teams = teamMap(bootstrap.teams);
  const historyFull = [...summary.history]
    .sort((a, b) => b.round - a.round)
    .map((h) => ({
      ...h,
      opponentShort: teams.get(h.opponent_team)?.short_name ?? "???",
    }));
  const history = historyFull.slice(0, 8);

  // Weight last 3–5 GWs of element-summary xG/xA when available
  const recent = recentRatesFromHistory(historyFull, 5);
  if (recent) {
    const blend = 0.55;
    const xg90 = player.xg90 * (1 - blend) + recent.xg90 * blend;
    const xa90 = player.xa90 * (1 - blend) + recent.xa90 * blend;
    const xgi90 = player.xgi90 * (1 - blend) + recent.xgi90 * blend;
    const { projectedPoints, expectedPointsPerGw } = projectPointsForHorizon({
      position: player.position,
      recentAvgPoints: player.recentAvgPoints,
      startChance: player.startChance,
      availabilityFactor: player.availabilityFactor,
      xg90,
      xa90,
      xgi90,
      xgc90: player.xgc90,
      attackingThreat: player.attackingThreat,
      upcomingFixtures: player.upcomingFixtures,
      horizon,
      nextWinChance: player.nextWinChance,
      nextCleanSheetChance: player.cleanSheetChance,
      epNext: player.epNext,
      penaltiesOrder: player.isPenTaker ? 1 : null,
      includeAccumulated: true,
    });
    player = {
      ...player,
      xg90: Number(xg90.toFixed(3)),
      xa90: Number(xa90.toFixed(3)),
      xgi90: Number(xgi90.toFixed(3)),
      projectedPoints,
      expectedPointsPerGw,
      reasons: [
        `Recent ${recent.sampleMinutes}' sample blended into xGI/90`,
        ...player.reasons,
      ],
    };
  }

  const upcomingFixtures = summary.fixtures.slice(0, 7).map((f) => ({
    opponentId: f.is_home ? f.team_a : f.team_h,
    opponentName:
      teams.get(f.is_home ? f.team_a : f.team_h)?.name ?? "Unknown",
    opponentShort:
      teams.get(f.is_home ? f.team_a : f.team_h)?.short_name ?? "???",
    event: f.event,
    isHome: f.is_home,
    difficulty: f.difficulty,
  }));

  const element = bootstrap.elements.find((e) => e.id === playerId);
  const { fetchHistoricalH2hByOpponent } = await import(
    "@/lib/historical-h2h"
  );
  let historicalByShort: Awaited<
    ReturnType<typeof fetchHistoricalH2hByOpponent>
  > = new Map();
  try {
    if (element?.code) {
      historicalByShort = await fetchHistoricalH2hByOpponent(
        element.code,
        upcomingFixtures.map((u) => u.opponentShort),
      );
    }
  } catch {
    historicalByShort = new Map();
  }

  const currentEvent = getCurrentEvent(bootstrap.events);
  const seasonStartYear = currentEvent
    ? new Date(currentEvent.deadline_time).getUTCFullYear() -
      (new Date(currentEvent.deadline_time).getUTCMonth() < 6 ? 1 : 0)
    : new Date().getUTCFullYear();
  // PL season spanning Aug–May: label like 2026/27
  const currentSeasonLabel = `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;

  return {
    player,
    history,
    historyFull,
    upcoming: summary.fixtures.slice(0, 7).map((f) => ({
      id: f.id,
      event: f.event,
      kickoff_time: f.kickoff_time,
      isHome: f.is_home,
      opponentId: f.is_home ? f.team_a : f.team_h,
      opponentName: teams.get(f.is_home ? f.team_a : f.team_h)?.name ?? "Unknown",
      opponentShort:
        teams.get(f.is_home ? f.team_a : f.team_h)?.short_name ?? "???",
      difficulty: f.difficulty,
      finished: f.finished,
      hasResult: f.finished,
      isLive: false,
      minutes: 0,
      teamScore: null,
      opponentScore: null,
      result: null as null,
    })),
    historyPast: [...summary.history_past].slice(0, 5),
    vsUpcoming: buildVsUpcomingClubs(upcomingFixtures, historyFull, {
      currentSeasonLabel,
      historicalByShort,
      limit: 5,
    }),
    horizon,
  };
}

export async function getEntryInsights(
  entryId: number,
  horizon = 5,
  includeAccumulated = true,
) {
  const [bootstrap, fixtures, entry] = await Promise.all([
    getBootstrap(),
    getFixtures(),
    getEntry(entryId),
  ]);

  const eventId = entry.current_event;
  let picks;
  try {
    picks = await getEntryPicks(entryId, eventId);
  } catch {
    picks = await getEntryPicks(entryId, Math.max(1, eventId - 1));
  }

  const scoredBase = scorePlayers(bootstrap, fixtures, horizon, includeAccumulated);
  const scored = applyHorizon(scoredBase, horizon, includeAccumulated);
  const byId = new Map(scored.map((p) => [p.id, p]));
  const squad = picks.picks
    .map((pick) => byId.get(pick.element))
    .filter((p): p is ScoredPlayer => Boolean(p));

  const bank = picks.entry_history?.bank ?? entry.last_deadline_bank ?? 0;
  const transfers = suggestTransfers(squad, scored, bank, 10, horizon);
  const bestSquad = buildBestSquad(scored);

  const startingIds = new Set(
    picks.picks.filter((p) => p.position <= 11).map((p) => p.element),
  );
  const currentXi = squad
    .filter((p) => startingIds.has(p.id))
    .sort((a, b) => b.projectedPoints - a.projectedPoints);
  const currentBench = squad
    .filter((p) => !startingIds.has(p.id))
    .sort((a, b) => b.projectedPoints - a.projectedPoints);

  const recommendedStarts = [...squad]
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 11);

  const teamRating = rateTeam(squad, currentXi, horizon);

  return {
    entry,
    picks,
    squad,
    currentXi,
    currentBench,
    recommendedStarts,
    transfers,
    bestSquad,
    teamRating,
    horizon,
    includeAccumulated,
    bank,
    freeTransfersHint:
      picks.entry_history?.event_transfers != null
        ? `Transfers already made this GW: ${picks.entry_history.event_transfers}`
        : null,
  };
}
