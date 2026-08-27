import { getCached, setCached } from "@/lib/cache";
import type { ApiFootballExtras, ScoredPlayer } from "@/lib/types";

const API_BASE = "https://v3.football.api-sports.io";
/** Premier League */
export const AF_PL_LEAGUE_ID = 39;
const LEAGUE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h — free tier is request-limited

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

function toExtras(row: AfPlayerRow): ApiFootballExtras | null {
  const st = pickPlStats(row);
  if (!st) return null;
  return {
    source: "api-football",
    apiPlayerId: row.player.id,
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

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AfPlayersResponse;
}

/** Season year = year the campaign starts (Aug). */
export function apiFootballSeasonYear(fromDate = new Date()): number {
  const y = fromDate.getUTCFullYear();
  const m = fromDate.getUTCMonth(); // 0–11
  return m < 6 ? y - 1 : y;
}

type IndexEntry = {
  extras: ApiFootballExtras;
  fullName: string;
  lastName: string;
  teamName: string;
};

async function loadPremierLeagueIndex(
  season: number,
): Promise<IndexEntry[]> {
  const cacheKey = `af-pl-players-${season}`;
  const hit = getCached<IndexEntry[]>(cacheKey);
  if (hit) return hit;

  const index: IndexEntry[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 45) {
    const data = await afFetch(
      `/players?league=${AF_PL_LEAGUE_ID}&season=${season}&page=${page}`,
    );
    if (data.errors && Object.keys(data.errors as object).length > 0) {
      break;
    }
    for (const row of data.response ?? []) {
      const extras = toExtras(row);
      if (!extras) continue;
      const st = pickPlStats(row);
      const fullName = normalizeName(
        [row.player.firstname, row.player.lastname]
          .filter(Boolean)
          .join(" ") || row.player.name,
      );
      const lastName = normalizeName(
        row.player.lastname || row.player.name.split(" ").slice(-1)[0] || "",
      );
      index.push({
        extras,
        fullName,
        lastName,
        teamName: normalizeName(st?.team?.name ?? ""),
      });
    }
    totalPages = Math.max(1, data.paging?.total ?? 1);
    page += 1;
    if (page <= totalPages) await sleep(250);
  }

  return setCached(cacheKey, index, LEAGUE_CACHE_TTL);
}

function scoreMatch(
  player: ScoredPlayer,
  entry: IndexEntry,
): number {
  const web = normalizeName(player.webName);
  const full = normalizeName(player.fullName);
  const teamOk = teamsOverlap(player.teamName, entry.teamName) ||
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
  // Require a reasonably confident match
  if (!best || bestScore < 55) return null;
  return best.extras;
}

/**
 * Attach API-Football season extras (shots, rating, etc.) when configured.
 * No-ops without API_FOOTBALL_KEY — never throws for callers.
 */
export async function enrichPlayersWithApiFootball(
  players: ScoredPlayer[],
  seasonYear?: number,
): Promise<ScoredPlayer[]> {
  if (!apiKey() || players.length === 0) return players;

  try {
    const season = seasonYear ?? apiFootballSeasonYear();
    const index = await loadPremierLeagueIndex(season);
    if (index.length === 0) return players;

    return players.map((p) => {
      if (p.extras?.source === "api-football") return p;
      const extras = matchPlayer(p, index);
      return extras ? { ...p, extras } : p;
    });
  } catch (err) {
    console.warn(
      "[api-football] enrich failed:",
      err instanceof Error ? err.message : err,
    );
    return players;
  }
}

/** Lookup extras for one player (uses same cached league index). */
export async function getApiFootballExtrasForPlayer(
  player: ScoredPlayer,
  seasonYear?: number,
): Promise<ApiFootballExtras | null> {
  if (!apiKey()) return null;
  try {
    const season = seasonYear ?? apiFootballSeasonYear();
    const index = await loadPremierLeagueIndex(season);
    return matchPlayer(player, index);
  } catch {
    return null;
  }
}
