import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getCached, setCached } from "@/lib/cache";
import { isMongoConfigured } from "@/lib/db/client";
import type { ApiFootballExtras, ScoredPlayer } from "@/lib/types";

const API_BASE = "https://v3.football.api-sports.io";
/** Premier League */
export const AF_PL_LEAGUE_ID = 39;
/** Free tier ~100 req/day; index is ~50+ pages — cache hard on disk across restarts. */
const LEAGUE_CACHE_TTL = 24 * 60 * 60 * 1000;
const DISK_CACHE_DIR = path.join(process.cwd(), ".cache", "api-football");

type DiskEnvelope<T> = { expiresAt: number; value: T };

function readDiskCache<T>(key: string): T | null {
  try {
    const file = path.join(DISK_CACHE_DIR, `${key}.json`);
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as DiskEnvelope<T>;
    if (!parsed || Date.now() > parsed.expiresAt) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeDiskCache<T>(key: string, value: T, ttlMs: number): T {
  try {
    mkdirSync(DISK_CACHE_DIR, { recursive: true });
    const file = path.join(DISK_CACHE_DIR, `${key}.json`);
    const envelope: DiskEnvelope<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };
    writeFileSync(file, JSON.stringify(envelope), "utf8");
  } catch (err) {
    console.warn(
      "[api-football] disk cache write failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return value;
}

function getAfCache<T>(key: string): T | null {
  const mem = getCached<T>(key);
  if (mem != null) return mem;
  const disk = readDiskCache<T>(key);
  if (disk != null) {
    setCached(key, disk, LEAGUE_CACHE_TTL);
    return disk;
  }
  return null;
}

async function getAfCacheAsync<T>(key: string): Promise<T | null> {
  const sync = getAfCache<T>(key);
  if (sync != null) return sync;
  if (!isMongoConfigured()) return null;
  try {
    const { getStoredApi } = await import("@/lib/db/api-cache");
    const stored = await getStoredApi<T>(`af:${key}`);
    if (stored != null) {
      setCached(key, stored, LEAGUE_CACHE_TTL);
      return stored;
    }
  } catch {
    // optional
  }
  return null;
}

function setAfCache<T>(key: string, value: T, ttlMs: number): T {
  setCached(key, value, ttlMs);
  writeDiskCache(key, value, ttlMs);
  if (isMongoConfigured()) {
    import("@/lib/db/api-cache")
      .then(({ setStoredApi }) => setStoredApi(`af:${key}`, value, ttlMs))
      .catch(() => undefined);
  }
  return value;
}

export type { ApiFootballExtras };

type AfPlayerRow = {
  player: {
    id: number;
    name: string;
    firstname?: string | null;
    lastname?: string | null;
    photo?: string | null;
  };
  statistics: Array<{
    team?: { id?: number; name?: string };
    league?: { id?: number; name?: string; season?: number };
    games?: {
      appearences?: number | null;
      minutes?: number | null;
      rating?: string | null;
      position?: string | null;
    };
    shots?: { total?: number | null; on?: number | null };
    goals?: { total?: number | null; assists?: number | null };
    passes?: { key?: number | null; accuracy?: number | string | null };
    tackles?: {
      total?: number | null;
      blocks?: number | null;
      interceptions?: number | null;
    };
    dribbles?: { attempts?: number | null; success?: number | null };
    fouls?: { drawn?: number | null; committed?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }>;
};

type AfPlayersResponse = {
  response?: AfPlayerRow[];
  paging?: { current?: number; total?: number };
  errors?: unknown;
};

/** Team name aliases: FPL / common → API-Football */
const TEAM_ALIASES: Record<string, string[]> = {
  spurs: ["tottenham", "tottenham hotspur"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "man utd": ["manchester united", "man united"],
  "man united": ["manchester united", "man utd"],
  "manchester united": ["man united", "man utd"],
  "man city": ["manchester city"],
  "manchester city": ["man city"],
  "nottingham forest": ["nottm forest", "forest", "nottingham"],
  "nottm forest": ["nottingham forest", "forest"],
  "wolverhampton wanderers": ["wolves", "wolverhampton"],
  wolves: ["wolverhampton wanderers", "wolverhampton"],
  "brighton and hove albion": ["brighton"],
  brighton: ["brighton and hove albion"],
  "west ham": ["west ham united"],
  "west ham united": ["west ham"],
  "newcastle united": ["newcastle"],
  newcastle: ["newcastle united"],
};

function apiKey(): string | null {
  const key =
    process.env.API_FOOTBALL_KEY?.trim() ||
    process.env.APISPORTS_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim() ||
    null;
  return key || null;
}

export function isApiFootballConfigured(): boolean {
  return Boolean(apiKey());
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamKeys(name: string): string[] {
  const n = normalizeName(name);
  const aliases = TEAM_ALIASES[n] ?? [];
  return [n, ...aliases.map(normalizeName)];
}

function teamsOverlap(a: string, b: string): boolean {
  const ak = new Set(teamKeys(a));
  for (const k of teamKeys(b)) {
    if (ak.has(k)) return true;
    // substring for "brighton" vs "brighton and hove albion"
    for (const other of ak) {
      if (other.includes(k) || k.includes(other)) return true;
    }
  }
  return false;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickPlStats(row: AfPlayerRow): AfPlayerRow["statistics"][number] | null {
  const stats = row.statistics ?? [];
  const pl = stats.find((s) => s.league?.id === AF_PL_LEAGUE_ID);
  return pl ?? stats[0] ?? null;
}

function hasAfErrors(data: { errors?: unknown }): boolean {
  const e = data.errors;
  if (e == null) return false;
  if (Array.isArray(e)) return e.length > 0;
  if (typeof e === "object") return Object.keys(e as object).length > 0;
  return Boolean(e);
}

function errorBlob(errors: unknown): string {
  try {
    return JSON.stringify(errors ?? "");
  } catch {
    return String(errors);
  }
}

function isRateLimitError(errors: unknown): boolean {
  return /rate\s*limit|too many requests/i.test(errorBlob(errors));
}

function isPlanPageLimitError(errors: unknown): boolean {
  return /page parameter|maximum value of 3/i.test(errorBlob(errors));
}

function toExtras(row: AfPlayerRow, season: number): ApiFootballExtras | null {
  const st = pickPlStats(row);
  if (!st) return null;
  return {
    source: "api-football",
    apiPlayerId: row.player.id,
    season,
    photo: row.player.photo ?? null,
    rating: num(st.games?.rating),
    appearances: num(st.games?.appearences),
    minutes: num(st.games?.minutes),
    shotsTotal: num(st.shots?.total),
    shotsOn: num(st.shots?.on),
    keyPasses: num(st.passes?.key),
    passAccuracy: num(st.passes?.accuracy),
    tackles: num(st.tackles?.total),
    interceptions: num(st.tackles?.interceptions),
    blocks: num(st.tackles?.blocks),
    dribblesAttempted: num(st.dribbles?.attempts),
    dribblesSuccess: num(st.dribbles?.success),
    foulsDrawn: num(st.fouls?.drawn),
    foulsCommitted: num(st.fouls?.committed),
    yellowCards: num(st.cards?.yellow),
    redCards: num(st.cards?.red),
    goals: num(st.goals?.total),
    assists: num(st.goals?.assists),
  };
}

async function afFetch(pathAndQuery: string): Promise<AfPlayersResponse> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");

  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${API_BASE}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": key,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    lastStatus = res.status;

    if (res.status === 429 || res.status === 503) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      throw new Error(`API-Football ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as AfPlayersResponse;
  }

  throw new Error(`API-Football ${lastStatus} (rate limited)`);
}

/** Season year = year the campaign starts (Aug). */
export function apiFootballSeasonYear(fromDate = new Date()): number {
  const y = fromDate.getUTCFullYear();
  const m = fromDate.getUTCMonth(); // 0–11
  return m < 6 ? y - 1 : y;
}

/**
 * Free API-Football plans often only allow older seasons (e.g. 2022–2024).
 * Probe preferred year, then walk backward until a page returns players.
 * Rate limits must NOT skip to an older season.
 */
async function resolveAccessibleSeason(preferred: number): Promise<number> {
  const cacheKey = "af-accessible-season-v2";
  const cached = await getAfCacheAsync<number>(cacheKey);
  if (cached != null) return cached;

  const candidates = [
    preferred,
    preferred - 1,
    preferred - 2,
    2024,
    2023,
    2022,
  ].filter((y, i, arr) => y >= 2022 && arr.indexOf(y) === i);

  for (const season of candidates) {
    try {
      const data = await afFetch(
        `/players?league=${AF_PL_LEAGUE_ID}&season=${season}&page=1`,
      );
      if (hasAfErrors(data)) {
        if (isRateLimitError(data.errors)) {
          // Don't fall back to an older season on rate limit.
          break;
        }
        continue;
      }
      if ((data.response?.length ?? 0) > 0) {
        if (season !== preferred) {
          console.warn(
            `[api-football] season ${preferred} unavailable on this plan; using ${season}`,
          );
        }
        return setAfCache(cacheKey, season, LEAGUE_CACHE_TTL);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429|rate limited/i.test(msg)) break;
      continue;
    }
  }

  // Sensible free-plan default when probe is inconclusive.
  return setAfCache(cacheKey, Math.min(preferred, 2024), LEAGUE_CACHE_TTL);
}

type IndexEntry = {
  extras: ApiFootballExtras;
  fullName: string;
  lastName: string;
  teamName: string;
};

type TeamRef = { id: number; name: string };

type IndexProgress = {
  season: number;
  complete: boolean;
  teams: TeamRef[];
  /** Index into teams[] for the next team to fetch. */
  nextTeamIndex: number;
  entries: IndexEntry[];
};

/** Free: league list capped at page 3; team endpoints are not. */
const MAX_FREE_PAGE = 3;
/** Stay under ~10 req/min — process a couple of teams per page load. */
const TEAMS_PER_TICK = 2;
const SEARCH_BUDGET_PER_ENRICH = 3;

function rowsToEntries(rows: AfPlayerRow[], season: number): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const row of rows) {
    const extras = toExtras(row, season);
    if (!extras) continue;
    const st = pickPlStats(row);
    const fullName = normalizeName(
      [row.player.firstname, row.player.lastname].filter(Boolean).join(" ") ||
        row.player.name,
    );
    const lastName = normalizeName(
      row.player.lastname || row.player.name.split(" ").slice(-1)[0] || "",
    );
    const display = normalizeName(row.player.name);
    const teamName = normalizeName(st?.team?.name ?? "");
    out.push({
      extras,
      fullName: fullName || display,
      lastName,
      teamName,
    });
    if (display && display !== fullName) {
      out.push({ extras, fullName: display, lastName, teamName });
    }
  }
  return out;
}

function progressCacheKey(season: number) {
  return `af-pl-team-progress-v2-${season}`;
}

async function loadPlTeams(season: number): Promise<TeamRef[]> {
  const cacheKey = `af-pl-teams-${season}`;
  const hit = await getAfCacheAsync<TeamRef[]>(cacheKey);
  if (hit && hit.length > 0) return hit;

  const data = (await afFetch(
    `/teams?league=${AF_PL_LEAGUE_ID}&season=${season}`,
  )) as AfPlayersResponse & {
    response?: Array<{ team?: { id?: number; name?: string } }>;
  };
  if (hasAfErrors(data)) {
    throw new Error(`teams: ${errorBlob(data.errors)}`);
  }
  const teams: TeamRef[] = [];
  for (const row of data.response ?? []) {
    const id = row.team?.id;
    const name = row.team?.name;
    if (id && name) teams.push({ id, name });
  }
  if (teams.length === 0) return teams;
  return setAfCache(cacheKey, teams, LEAGUE_CACHE_TTL);
}

async function fetchTeamPlayerPages(
  teamId: number,
  season: number,
): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_FREE_PAGE) {
    const data = await afFetch(
      `/players?team=${teamId}&season=${season}&page=${page}`,
    );
    if (hasAfErrors(data)) {
      if (isPlanPageLimitError(data.errors) || isRateLimitError(data.errors)) {
        throw Object.assign(new Error(errorBlob(data.errors)), {
          afErrors: data.errors,
        });
      }
      break;
    }
    entries.push(...rowsToEntries(data.response ?? [], season));
    totalPages = Math.max(1, data.paging?.total ?? 1);
    page += 1;
    if (page <= totalPages && page <= MAX_FREE_PAGE) await sleep(350);
  }

  return entries;
}

/**
 * Build / resume a PL player index via per-team fetches.
 * Free plans block league-wide page>3, so team queries are required for coverage.
 */
async function loadPremierLeagueIndex(
  preferredSeason: number,
): Promise<IndexEntry[]> {
  const season = await resolveAccessibleSeason(preferredSeason);
  const cacheKey = progressCacheKey(season);
  const existing = await getAfCacheAsync<IndexProgress>(cacheKey);

  if (existing?.complete && existing.entries.length > 0) {
    return existing.entries;
  }

  let progress: IndexProgress = existing ?? {
    season,
    complete: false,
    teams: [],
    nextTeamIndex: 0,
    entries: [],
  };

  if (progress.teams.length === 0) {
    try {
      progress.teams = await loadPlTeams(season);
    } catch (err) {
      console.warn(
        "[api-football] teams fetch failed:",
        err instanceof Error ? err.message : err,
      );
      return progress.entries;
    }
  }

  const seen = new Set(
    progress.entries.map((e) => `${e.extras.apiPlayerId}:${e.fullName}`),
  );

  let teamsThisTick = 0;
  while (
    !progress.complete &&
    progress.nextTeamIndex < progress.teams.length &&
    teamsThisTick < TEAMS_PER_TICK
  ) {
    const team = progress.teams[progress.nextTeamIndex]!;
    try {
      const fresh = await fetchTeamPlayerPages(team.id, season);
      for (const entry of fresh) {
        const k = `${entry.extras.apiPlayerId}:${entry.fullName}`;
        if (seen.has(k)) continue;
        seen.add(k);
        progress.entries.push(entry);
      }
      progress.nextTeamIndex += 1;
      teamsThisTick += 1;
    } catch (err) {
      const afErrors =
        err && typeof err === "object" && "afErrors" in err
          ? (err as { afErrors: unknown }).afErrors
          : null;
      if (afErrors && isPlanPageLimitError(afErrors)) {
        // Count team as done even if later pages are blocked.
        progress.nextTeamIndex += 1;
        teamsThisTick += 1;
        continue;
      }
      console.warn(
        "[api-football] index fetch paused:",
        err instanceof Error ? err.message : err,
      );
      break;
    }

    if (
      teamsThisTick < TEAMS_PER_TICK &&
      progress.nextTeamIndex < progress.teams.length
    ) {
      await sleep(400);
    }
  }

  if (progress.nextTeamIndex >= progress.teams.length && progress.teams.length > 0) {
    progress.complete = true;
  }

  if (progress.entries.length > 0 || progress.teams.length > 0) {
    setAfCache(cacheKey, progress, LEAGUE_CACHE_TTL);
    console.warn(
      `[api-football] PL ${season}: ${progress.entries.length} name rows` +
        ` · teams ${progress.nextTeamIndex}/${progress.teams.length}` +
        (progress.complete ? " · complete" : " · partial (refresh to resume)"),
    );
  }

  return progress.entries;
}

async function searchPlayerExtras(
  player: ScoredPlayer,
  season: number,
): Promise<ApiFootballExtras | null> {
  const q = (player.webName || player.fullName.split(" ").slice(-1)[0] || "")
    .trim()
    .slice(0, 40);
  if (q.length < 3) return null;

  try {
    const data = await afFetch(
      `/players?search=${encodeURIComponent(q)}&league=${AF_PL_LEAGUE_ID}&season=${season}`,
    );
    if (hasAfErrors(data) || !data.response?.length) return null;
    const entries = rowsToEntries(data.response, season);
    return matchPlayer(player, entries);
  } catch {
    return null;
  }
}

function scoreMatch(player: ScoredPlayer, entry: IndexEntry): number {
  const web = normalizeName(player.webName);
  const full = normalizeName(player.fullName);
  const teamOk =
    teamsOverlap(player.teamName, entry.teamName) ||
    teamsOverlap(player.teamShort, entry.teamName);

  let score = 0;
  if (full && full === entry.fullName) score += 100;
  else if (full && entry.fullName.includes(full)) score += 70;
  else if (full && full.includes(entry.fullName) && entry.fullName.length > 4) {
    score += 60;
  }

  if (web && (entry.fullName.endsWith(web) || entry.lastName === web)) {
    score += 40;
  } else if (web && entry.fullName.includes(web) && web.length >= 3) {
    score += 25;
  }

  const webLast = web.split(" ").slice(-1)[0] ?? "";
  if (webLast.length >= 3 && entry.lastName === webLast) score += 30;

  if (teamOk) score += 35;
  else score -= 20;

  return score;
}

function matchPlayer(
  player: ScoredPlayer,
  index: IndexEntry[],
): ApiFootballExtras | null {
  let best: IndexEntry | null = null;
  let bestScore = 0;
  for (const entry of index) {
    const s = scoreMatch(player, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  if (!best || bestScore < 50) return null;
  return best.extras;
}

/**
 * Attach API-Football season extras (shots, rating, etc.) when configured.
 * No-ops without API_FOOTBALL_KEY — never throws for callers.
 * Free plans auto-fall back to the newest season the key can access (often 2024).
 */
export async function enrichPlayersWithApiFootball(
  players: ScoredPlayer[],
  seasonYear?: number,
): Promise<ScoredPlayer[]> {
  if (!apiKey() || players.length === 0) return players;

  try {
    const preferred = seasonYear ?? apiFootballSeasonYear();
    const season = await resolveAccessibleSeason(preferred);
    const index = await loadPremierLeagueIndex(preferred);

    const out = players.map((p) => {
      if (p.extras?.source === "api-football") return p;
      const extras = matchPlayer(p, index);
      return extras ? { ...p, extras } : p;
    });

    // Free-tier coverage builds slowly — search a few misses only when the
    // team index is still thin (searches compete with the same 10 req/min budget).
    if (index.length < 80) {
      const unmatched = out
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !p.extras)
        .sort((a, b) => (b.p.totalPoints ?? 0) - (a.p.totalPoints ?? 0))
        .slice(0, SEARCH_BUDGET_PER_ENRICH);

      for (const { p, i } of unmatched) {
        const extras = await searchPlayerExtras(p, season);
        if (extras) out[i] = { ...p, extras };
        await sleep(300);
      }
    }

    return out;
  } catch (err) {
    console.warn(
      "[api-football] enrich failed:",
      err instanceof Error ? err.message : err,
    );
    return players;
  }
}

/** Lookup extras for one player (index first, then name search). */
export async function getApiFootballExtrasForPlayer(
  player: ScoredPlayer,
  seasonYear?: number,
): Promise<ApiFootballExtras | null> {
  if (!apiKey()) return null;
  try {
    const preferred = seasonYear ?? apiFootballSeasonYear();
    const season = await resolveAccessibleSeason(preferred);
    const index = await loadPremierLeagueIndex(preferred);
    const hit = matchPlayer(player, index);
    if (hit) return hit;
    return searchPlayerExtras(player, season);
  } catch {
    return null;
  }
}
