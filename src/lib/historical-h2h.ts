import { withCache } from "@/lib/cache";
import type { VsOpponentMeeting } from "@/lib/opponent-history";

const RAW_BASE =
  "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data";

/** Completed seasons newest-first (current season comes from live FPL API). */
const ARCHIVE_SEASONS = [
  "2025-26",
  "2024-25",
  "2023-24",
  "2022-23",
  "2021-22",
] as const;

const ARCHIVE_TTL = 12 * 60 * 60 * 1000; // 12h — historical data is static

type SeasonPlayer = {
  id: number;
  firstName: string;
  secondName: string;
};

function seasonLabel(folder: string): string {
  // "2024-25" → "2024/25"
  const [a, b] = folder.split("-");
  return b ? `${a}/${b}` : folder;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/csv,*/*", "User-Agent": "fpl-assistant/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

/** Minimal CSV splitter that handles quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function num(value: string | undefined): number {
  if (value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getSeasonTeamIdsByShort(
  season: string,
): Promise<Map<string, number>> {
  return withCache(`hist-teams-${season}`, ARCHIVE_TTL, async () => {
    const text = await fetchText(`${RAW_BASE}/${season}/teams.csv`);
    const map = new Map<string, number>();
    if (!text) return map;
    for (const row of parseCsv(text)) {
      const short = row.short_name?.trim();
      const id = num(row.id);
      if (short && id) map.set(short, id);
    }
    return map;
  });
}

async function getSeasonPlayerByCode(
  season: string,
  playerCode: number,
): Promise<SeasonPlayer | null> {
  return withCache(
    `hist-player-${season}-${playerCode}`,
    ARCHIVE_TTL,
    async () => {
      const text = await fetchText(`${RAW_BASE}/${season}/players_raw.csv`);
      if (!text) return null;
      const codeStr = String(playerCode);
      for (const row of parseCsv(text)) {
        if (row.code === codeStr) {
          return {
            id: num(row.id),
            firstName: row.first_name ?? "",
            secondName: row.second_name ?? "",
          };
        }
      }
      return null;
    },
  );
}

function playerGwPath(season: string, player: SeasonPlayer): string {
  const folder = `${player.firstName}_${player.secondName}_${player.id}`.replace(
    / /g,
    "_",
  );
  return `${RAW_BASE}/${season}/players/${encodeURI(folder)}/gw.csv`;
}

async function getPlayerSeasonGws(
  season: string,
  player: SeasonPlayer,
): Promise<Record<string, string>[]> {
  return withCache(
    `hist-gw-${season}-${player.id}`,
    ARCHIVE_TTL,
    async () => {
      const text = await fetchText(playerGwPath(season, player));
      if (!text) return [];
      return parseCsv(text);
    },
  );
}

function rowToMeeting(
  row: Record<string, string>,
  season: string,
): VsOpponentMeeting | null {
  const minutes = num(row.minutes);
  // Skip blank / DNP rows without a scoreboard
  const teamH = numOrNull(row.team_h_score);
  const teamA = numOrNull(row.team_a_score);
  if (teamH === null && teamA === null && minutes <= 0) return null;

  const wasHome = String(row.was_home).toLowerCase() === "true";
  const teamScore = wasHome ? teamH : teamA;
  const opponentScore = wasHome ? teamA : teamH;
  let result: VsOpponentMeeting["result"] = null;
  if (teamScore !== null && opponentScore !== null) {
    if (teamScore > opponentScore) result = "W";
    else if (teamScore < opponentScore) result = "L";
    else result = "D";
  }

  return {
    round: num(row.round),
    points: num(row.total_points),
    goals: num(row.goals_scored),
    assists: num(row.assists),
    minutes,
    wasHome,
    kickoffTime: row.kickoff_time || null,
    teamScore,
    opponentScore,
    result,
    seasonLabel: seasonLabel(season),
    threat: num(row.threat),
    creativity: num(row.creativity),
    defensiveContribution: num(row.defensive_contribution),
    clearancesBlocksInterceptions: num(row.clearances_blocks_interceptions),
    tackles: num(row.tackles),
    recoveries: num(row.recoveries),
  };
}

/**
 * Last meetings vs each opponent short name from archived FPL seasons.
 * Keyed by opponent short (e.g. "ARS").
 */
export async function fetchHistoricalH2hByOpponent(
  playerCode: number,
  opponentShorts: string[],
): Promise<Map<string, VsOpponentMeeting[]>> {
  const unique = [...new Set(opponentShorts.filter(Boolean))];
  const result = new Map<string, VsOpponentMeeting[]>();
  for (const s of unique) result.set(s, []);
  if (!playerCode || unique.length === 0) return result;

  await Promise.all(
    ARCHIVE_SEASONS.map(async (season) => {
      const [teams, player] = await Promise.all([
        getSeasonTeamIdsByShort(season),
        getSeasonPlayerByCode(season, playerCode),
      ]);
      if (!player) return;

      const opponentIds = new Map<number, string>();
      for (const short of unique) {
        const id = teams.get(short);
        if (id) opponentIds.set(id, short);
      }
      if (opponentIds.size === 0) return;

      const rows = await getPlayerSeasonGws(season, player);
      for (const row of rows) {
        const oppId = num(row.opponent_team);
        const short = opponentIds.get(oppId);
        if (!short) continue;
        const meeting = rowToMeeting(row, season);
        if (!meeting) continue;
        result.get(short)!.push(meeting);
      }
    }),
  );

  for (const [short, meetings] of result) {
    meetings.sort((a, b) => {
      const at = a.kickoffTime ? new Date(a.kickoffTime).getTime() : 0;
      const bt = b.kickoffTime ? new Date(b.kickoffTime).getTime() : 0;
      return bt - at;
    });
    result.set(short, meetings);
  }

  return result;
}
