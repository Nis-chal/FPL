import { getBootstrap, getElementSummary, getFixtures } from "@/lib/fpl-client";
import {
  attackingThreatScore,
  estimateCleanSheetChance,
  estimateStartChance,
  estimateWinChance,
  per90Rates,
  projectPointsForHorizon,
} from "@/lib/probabilities";
import type {
  ElementHistory,
  FplElement,
  FplFixture,
  FplTeam,
  Position,
} from "@/lib/types";
import {
  availabilityFactor,
  parseFloatSafe,
  POSITION_MAP,
  teamMap,
  toFixtureViews,
} from "@/lib/utils";

export type BacktestSample = {
  playerId: number;
  webName: string;
  position: Position;
  round: number;
  predicted: number;
  actual: number;
  error: number;
  absError: number;
  minutes: number;
};

export type BacktestBucket = {
  n: number;
  mae: number;
  rmse: number;
  bias: number;
};

export type BacktestReport = {
  generatedAt: string;
  playerLimit: number;
  includeAccumulated: boolean;
  finishedRounds: number[];
  samples: number;
  overall: BacktestBucket;
  whenPlayed: BacktestBucket;
  byPosition: Record<Position, BacktestBucket>;
  byRound: Record<number, BacktestBucket>;
  rankCorrelationByRound: Record<number, number | null>;
  largestOver: BacktestSample[];
  largestUnder: BacktestSample[];
  notes: string[];
};

export type RunBacktestOptions = {
  /** Max players to fetch element-summary for (API cost). */
  playerLimit?: number;
  includeAccumulated?: boolean;
  /** Delay between element-summary requests (ms). */
  fetchDelayMs?: number;
  onProgress?: (msg: string) => void;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sumHistory(
  rows: ElementHistory[],
  pick: (h: ElementHistory) => number,
): number {
  return rows.reduce((s, h) => s + pick(h), 0);
}

/** Rebuild bootstrap element stats using only GWs strictly before `round`. */
export function buildElementAsOf(
  base: FplElement,
  history: ElementHistory[],
  round: number,
): FplElement {
  const prior = history.filter((h) => h.round < round);
  const last3 = prior.slice(-3);
  const formAvg =
    last3.length > 0
      ? last3.reduce((s, h) => s + h.total_points, 0) / last3.length
      : 0;
  const gwCount = Math.max(1, prior.length);

  return {
    ...base,
    minutes: sumHistory(prior, (h) => h.minutes),
    goals_scored: sumHistory(prior, (h) => h.goals_scored),
    assists: sumHistory(prior, (h) => h.assists),
    clean_sheets: sumHistory(prior, (h) => h.clean_sheets),
    goals_conceded: sumHistory(prior, (h) => h.goals_conceded),
    saves: sumHistory(prior, (h) => h.saves),
    bonus: sumHistory(prior, (h) => h.bonus),
    expected_goals: String(
      sumHistory(prior, (h) => parseFloatSafe(h.expected_goals)),
    ),
    expected_assists: String(
      sumHistory(prior, (h) => parseFloatSafe(h.expected_assists)),
    ),
    expected_goal_involvements: String(
      sumHistory(prior, (h) => parseFloatSafe(h.expected_goal_involvements)),
    ),
    expected_goals_conceded: String(
      sumHistory(prior, (h) => parseFloatSafe(h.expected_goals_conceded)),
    ),
    form: formAvg.toFixed(1),
    points_per_game: (sumHistory(prior, (h) => h.total_points) / gwCount).toFixed(
      1,
    ),
    total_points: sumHistory(prior, (h) => h.total_points),
    ep_next: null,
    ep_this: null,
    status: "a",
    news: "",
    chance_of_playing_next_round: null,
    chance_of_playing_this_round: null,
  };
}

function fixtureViewForRound(
  fixtures: FplFixture[],
  teamId: number,
  round: number,
  teams: Map<number, FplTeam>,
) {
  return toFixtureViews(fixtures, teamId, teams).find((f) => f.event === round);
}

/** Predict a single GW using only information available before that GW. */
export function predictPointsForRound(
  element: FplElement,
  fixtures: FplFixture[],
  teams: Map<number, FplTeam>,
  round: number,
  includeAccumulated: boolean,
): number {
  const position = POSITION_MAP[element.element_type];
  const fixture = fixtureViewForRound(fixtures, element.team, round, teams);
  if (!fixture) return 0;

  const team = teams.get(element.team);
  const opponent = teams.get(fixture.opponentId);
  if (!team || !opponent) return 0;

  const startChance = estimateStartChance(element);
  const avail = availabilityFactor(element);
  const rates = per90Rates(element);

  const nextWinChance = estimateWinChance(
    team,
    opponent,
    fixture.isHome,
    fixture.difficulty,
  );
  const cleanSheetChance = estimateCleanSheetChance(
    team,
    opponent,
    fixture.isHome,
    fixture.difficulty,
    nextWinChance,
  );
  const recentAvg = parseFloatSafe(element.form);

  const { expectedPointsPerGw } = projectPointsForHorizon({
    position,
    recentAvgPoints: recentAvg,
    startChance,
    availabilityFactor: avail,
    xg90: rates.xg90,
    xa90: rates.xa90,
    xgi90: rates.xgi90,
    xgc90: rates.xgc90,
    attackingThreat: attackingThreatScore(element, position),
    upcomingFixtures: [fixture],
    horizon: 1,
    nextWinChance,
    nextCleanSheetChance: cleanSheetChance,
    epNext: null,
    penaltiesOrder: element.penalties_order,
    includeAccumulated,
  });

  return expectedPointsPerGw;
}

function bucket(samples: BacktestSample[]): BacktestBucket {
  if (samples.length === 0) {
    return { n: 0, mae: 0, rmse: 0, bias: 0 };
  }
  const n = samples.length;
  let absSum = 0;
  let sqSum = 0;
  let biasSum = 0;
  for (const s of samples) {
    absSum += s.absError;
    sqSum += s.error * s.error;
    biasSum += s.error;
  }
  return {
    n,
    mae: Number((absSum / n).toFixed(3)),
    rmse: Number(Math.sqrt(sqSum / n).toFixed(3)),
    bias: Number((biasSum / n).toFixed(3)),
  };
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  for (let r = 0; r < indexed.length; r++) {
    ranks[indexed[r]!.i] = r + 1;
  }
  return ranks;
}

/** Spearman rank correlation (−1..1) for same-length arrays. */
export function spearman(actual: number[], predicted: number[]): number | null {
  if (actual.length < 3 || actual.length !== predicted.length) return null;
  const ra = rankValues(actual);
  const rp = rankValues(predicted);
  const n = actual.length;
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = ra[i]! - rp[i]!;
    sumD2 += d * d;
  }
  return Number((1 - (6 * sumD2) / (n * (n * n - 1))).toFixed(3));
}

function backtestPlayer(
  base: FplElement,
  history: ElementHistory[],
  fixtures: FplFixture[],
  teams: Map<number, FplTeam>,
  finishedRounds: number[],
  includeAccumulated: boolean,
): BacktestSample[] {
  const position = POSITION_MAP[base.element_type];
  const out: BacktestSample[] = [];

  for (const round of finishedRounds) {
    const row = history.find((h) => h.round === round);
    if (!row) continue;

    const asOf = buildElementAsOf(base, history, round);
    const predicted = predictPointsForRound(
      asOf,
      fixtures,
      teams,
      round,
      includeAccumulated,
    );
    const actual = row.total_points;
    const error = predicted - actual;

    out.push({
      playerId: base.id,
      webName: base.web_name,
      position,
      round,
      predicted: Number(predicted.toFixed(2)),
      actual,
      error: Number(error.toFixed(2)),
      absError: Number(Math.abs(error).toFixed(2)),
      minutes: row.minutes,
    });
  }

  return out;
}

export async function runBacktest(
  options: RunBacktestOptions = {},
): Promise<BacktestReport> {
  const playerLimit = options.playerLimit ?? 80;
  const includeAccumulated = options.includeAccumulated ?? true;
  const fetchDelayMs = options.fetchDelayMs ?? 120;
  const log = options.onProgress ?? (() => undefined);

  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);
  const teams = teamMap(bootstrap.teams);

  const finishedRounds = bootstrap.events
    .filter((e) => e.finished)
    .map((e) => e.id)
    .sort((a, b) => a - b);

  const pool = bootstrap.elements
    .filter((el) => el.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, playerLimit);

  log(
    `Backtesting ${pool.length} players across GWs ${finishedRounds.join(", ") || "none"}…`,
  );

  const allSamples: BacktestSample[] = [];

  for (let i = 0; i < pool.length; i++) {
    const el = pool[i]!;
    log(`[${i + 1}/${pool.length}] ${el.web_name}`);
    try {
      const summary = await getElementSummary(el.id);
      allSamples.push(
        ...backtestPlayer(
          el,
          summary.history,
          fixtures,
          teams,
          finishedRounds,
          includeAccumulated,
        ),
      );
    } catch (err) {
      log(
        `  skip ${el.web_name}: ${err instanceof Error ? err.message : err}`,
      );
    }
    if (i < pool.length - 1) await sleep(fetchDelayMs);
  }

  const whenPlayed = allSamples.filter((s) => s.minutes > 0);
  const positions: Position[] = ["GKP", "DEF", "MID", "FWD"];
  const byPosition = Object.fromEntries(
    positions.map((pos) => [
      pos,
      bucket(allSamples.filter((s) => s.position === pos)),
    ]),
  ) as Record<Position, BacktestBucket>;

  const byRound: Record<number, BacktestBucket> = {};
  const rankCorrelationByRound: Record<number, number | null> = {};
  for (const round of finishedRounds) {
    const slice = allSamples.filter((s) => s.round === round);
    byRound[round] = bucket(slice);
    const played = slice.filter((s) => s.minutes > 0);
    rankCorrelationByRound[round] = spearman(
      played.map((s) => s.actual),
      played.map((s) => s.predicted),
    );
  }

  const sortedByError = [...allSamples].sort((a, b) => b.error - a.error);
  const largestOver = sortedByError.slice(0, 8);
  const largestUnder = [...allSamples]
    .sort((a, b) => a.error - b.error)
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    playerLimit,
    includeAccumulated,
    finishedRounds,
    samples: allSamples.length,
    overall: bucket(allSamples),
    whenPlayed: bucket(whenPlayed),
    byPosition,
    byRound,
    rankCorrelationByRound,
    largestOver,
    largestUnder,
    notes: [
      "Uses current team strength ratings (not historical snapshots) — known limitation.",
      "Does not use ep_next for past GWs (no future leak).",
      "Tune weights in src/lib/probabilities.ts, then re-run to compare MAE.",
    ],
  };
}

export function formatBacktestReport(report: BacktestReport): string {
  const lines: string[] = [];
  lines.push("FPL Assistant — projection backtest");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Players: ${report.playerLimit} · GWs: ${report.finishedRounds.join(", ") || "—"} · samples: ${report.samples}`,
  );
  lines.push(
    `Accumulated form blend: ${report.includeAccumulated ? "on" : "off"}`,
  );
  lines.push("");
  lines.push("Overall");
  lines.push(
    `  MAE ${report.overall.mae} · RMSE ${report.overall.rmse} · bias ${report.overall.bias} (n=${report.overall.n})`,
  );
  lines.push("When player got minutes (>0)");
  lines.push(
    `  MAE ${report.whenPlayed.mae} · RMSE ${report.whenPlayed.rmse} · bias ${report.whenPlayed.bias} (n=${report.whenPlayed.n})`,
  );
  lines.push("");
  lines.push("By position (MAE / bias / n)");
  for (const pos of ["GKP", "DEF", "MID", "FWD"] as const) {
    const b = report.byPosition[pos];
    lines.push(`  ${pos}: ${b.mae} / ${b.bias} / ${b.n}`);
  }
  lines.push("");
  lines.push("By gameweek (MAE · rank corr. among players who played)");
  for (const round of report.finishedRounds) {
    const b = report.byRound[round]!;
    const rho = report.rankCorrelationByRound[round];
    lines.push(
      `  GW${round}: MAE ${b.mae} · ρ ${rho ?? "—"} · n=${b.n}`,
    );
  }
  lines.push("");
  lines.push("Largest over-predictions (pred − actual)");
  for (const s of report.largestOver) {
    lines.push(
      `  GW${s.round} ${s.webName} (${s.position}): pred ${s.predicted} vs ${s.actual}`,
    );
  }
  lines.push("");
  lines.push("Largest under-predictions");
  for (const s of report.largestUnder) {
    lines.push(
      `  GW${s.round} ${s.webName} (${s.position}): pred ${s.predicted} vs ${s.actual}`,
    );
  }
  lines.push("");
  lines.push("Notes");
  for (const n of report.notes) lines.push(`  · ${n}`);
  return lines.join("\n");
}
