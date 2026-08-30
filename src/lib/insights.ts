import { getBootstrap, getEntry, getEntryPicks, getFixtures } from "@/lib/fpl-client";
import {
  apiFootballSeasonYear,
  enrichPlayersWithApiFootball,
  getApiFootballExtrasForPlayer,
} from "@/lib/api-football";
import { enrichScoredWithSeasonPoints } from "@/lib/db/season-points";
import { buildVsUpcomingClubs, buildClubVsUpcomingClubs } from "@/lib/opponent-history";
import { pickCaptain } from "@/lib/ranking";
import { applyHorizon, scorePlayers, topProjected } from "@/lib/scoring";
import { buildBestSquad } from "@/lib/squad";
import { bestInboundTargets, suggestTransfers } from "@/lib/transfers";
import { rateTeam } from "@/lib/team-rating";
import { sortSeasonsLatestFirst } from "@/lib/season-sort";
import type { PastSeasonStats, ScoredPlayer } from "@/lib/types";
import {
  getCurrentEvent,
  getNextEvent,
  getPointsEvent,
  nextFixturesForTeam,
  playerUpcomingFixtures,
  recentFixturesForTeam,
  teamMap,
} from "@/lib/utils";

function seasonFromEvent(
  event: { deadline_time: string } | null | undefined,
): number {
  if (!event?.deadline_time) return apiFootballSeasonYear();
  return apiFootballSeasonYear(new Date(event.deadline_time));
}

export async function getLeagueInsights(horizon = 5, includeAccumulated = true) {
  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);
  const currentEvent = getCurrentEvent(bootstrap.events) ?? null;
  const nextEvent = getNextEvent(bootstrap.events) ?? null;
  const pointsEvent = getPointsEvent(bootstrap.events) ?? null;
  let scored = scorePlayers(bootstrap, fixtures, horizon, includeAccumulated);
  scored = await enrichPlayersWithApiFootball(
    scored,
    seasonFromEvent(currentEvent),
  );
  const seasonPoints = await enrichScoredWithSeasonPoints(scored);
  scored = seasonPoints.players;
  const bestSquad = buildBestSquad(scored);
  const topScorers = topProjected(scored, 12, {
    minMinutes: 1,
    availableOnly: true,
    minStartChance: 0.4,
  });
  const captainPick =
    pickCaptain(scored, ["overall"]) ?? topScorers[0] ?? bestSquad.captain;
  const transferTargets = bestInboundTargets(scored, 20);
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
    pointsEvent,
    finishedGameweeks: bootstrap.events
      .filter((e) => e.finished)
      .map((e) => e.id)
      .sort((a, b) => a - b),
    upcomingGameweeks: bootstrap.events
      .filter((e) => !e.finished)
      .map((e) => e.id)
      .sort((a, b) => a - b),
    topScorers,
    captainPick,
    transferTargets,
    bestSquad,
    modelRating,
    scored,
    teams: bootstrap.teams,
    fixtures,
    seasonPointsFromDatabase: seasonPoints.fromDatabase,
    seasonPointsDbMatches: seasonPoints.matchedInDb,
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
  const currentEvent = getCurrentEvent(bootstrap.events);
  const seasonStartYear = currentEvent
    ? new Date(currentEvent.deadline_time).getUTCFullYear() -
      (new Date(currentEvent.deadline_time).getUTCMonth() < 6 ? 1 : 0)
    : new Date().getUTCFullYear();
  const currentSeasonLabel = `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;
  let scored = scorePlayers(bootstrap, fixtures, horizon).filter(
    (p) => p.teamId === teamId,
  );
  const current = currentEvent;
  scored = await enrichPlayersWithApiFootball(
    scored,
    seasonFromEvent(current),
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

  const { fetchHistoricalClubH2hByOpponent } = await import(
    "@/lib/historical-h2h"
  );
  let historicalByShort: Awaited<
    ReturnType<typeof fetchHistoricalClubH2hByOpponent>
  > = new Map();
  try {
    historicalByShort = await fetchHistoricalClubH2hByOpponent(
      team.short_name,
      upcoming.map((u) => u.opponentShort),
    );
  } catch {
    historicalByShort = new Map();
  }

  const vsUpcoming = buildClubVsUpcomingClubs(
    upcoming,
    fixtures,
    teamId,
    teams,
    currentSeasonLabel,
    { historicalByShort, limit: 5 },
  );

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

  const currentEv = getCurrentEvent(bootstrap.events);
  const extras =
    player.extras ??
    (await getApiFootballExtrasForPlayer(
      player,
      seasonFromEvent(currentEv),
    ));
  if (extras) {
    player = { ...player, extras };
  }

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

  const upcomingList = playerUpcomingFixtures(
    summary.fixtures,
    fixtures,
    player.teamId,
    teams,
    7,
  );

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
        upcomingList.map((u) => u.opponentShort),
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
  // PL season spanning Aug–May: label like 2025/26
  const currentSeasonLabel = `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;

  const currentSeason: PastSeasonStats | null = element
    ? {
        season_name: currentSeasonLabel,
        total_points: element.total_points,
        minutes: element.minutes,
        goals_scored: element.goals_scored,
        assists: element.assists,
        clean_sheets: element.clean_sheets,
        goals_conceded: element.goals_conceded,
        own_goals: element.own_goals,
        penalties_saved: element.penalties_saved,
        penalties_missed: element.penalties_missed,
        yellow_cards: element.yellow_cards,
        red_cards: element.red_cards,
        saves: element.saves,
        bonus: element.bonus,
        bps: element.bps,
        start_cost: undefined,
        end_cost: element.now_cost,
        expected_goals: element.expected_goals,
        expected_assists: element.expected_assists,
        expected_goal_involvements: element.expected_goal_involvements,
      }
    : null;

  return {
    player,
    history,
    historyFull,
    upcoming: upcomingList,
    historyPast: sortSeasonsLatestFirst([...summary.history_past]).slice(0, 5),
    currentSeason,
    currentSeasonLabel,
    vsUpcoming: buildVsUpcomingClubs(upcomingList, historyFull, {
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
  let scored = applyHorizon(scoredBase, horizon, includeAccumulated);
  scored = await enrichPlayersWithApiFootball(
    scored,
    seasonFromEvent(getCurrentEvent(bootstrap.events)),
  );
  const seasonPoints = await enrichScoredWithSeasonPoints(scored);
  scored = seasonPoints.players;
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
