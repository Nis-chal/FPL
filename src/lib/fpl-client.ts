import { getCached, setCached, withCache } from "@/lib/cache";
import type {
  BootstrapStatic,
  ElementSummary,
  EntryPicks,
  EntrySummary,
  EventLive,
  FplFixture,
} from "@/lib/types";
import { getCurrentEvent } from "@/lib/utils";

/** Official API; optional proxy base via FPL_API_BASE (e.g. a Cloudflare Worker). */
const FPL_BASE =
  process.env.FPL_API_BASE?.replace(/\/$/, "") ||
  "https://fantasy.premierleague.com/api";

const LIVE_TTL = 25 * 1000;
const ACTIVE_TTL = 75 * 1000;
const IDLE_TTL = 4 * 60 * 1000;
const SUMMARY_TTL = 5 * 60 * 1000;
const ENTRY_TTL = 5 * 60 * 1000;

/** FPL edge often 403s non-browser clients; mimic the official site. */
const FPL_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://fantasy.premierleague.com/",
  Origin: "https://fantasy.premierleague.com",
};

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fplFetch<T>(path: string): Promise<T> {
  const url = `${FPL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FPL_HEADERS,
        // Bootstrap exceeds Next.js 2MB data cache; we use module TTL cache instead.
        cache: "no-store",
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      lastError = new Error(
        `FPL API ${path} failed: ${res.status} ${res.statusText}`,
      );

      // Transient edge blocks / rate limits — brief backoff then retry.
      const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(300 * attempt);
        continue;
      }
      break;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("FPL API request failed");
      if (attempt < MAX_ATTEMPTS) {
        await sleep(300 * attempt);
        continue;
      }
      break;
    }
  }

  throw lastError ?? new Error(`FPL API ${path} failed`);
}

function isCurrentGwActive(bootstrap: BootstrapStatic): boolean {
  const current = getCurrentEvent(bootstrap.events);
  return Boolean(current && !current.finished);
}

function bootstrapTtl(bootstrap: BootstrapStatic): number {
  return isCurrentGwActive(bootstrap) ? ACTIVE_TTL : IDLE_TTL;
}

export async function getBootstrap(): Promise<BootstrapStatic> {
  const hit = getCached<BootstrapStatic>("bootstrap");
  if (hit !== null) return hit;
  const data = await fplFetch<BootstrapStatic>("/bootstrap-static/");
  return setCached("bootstrap", data, bootstrapTtl(data));
}

export async function getFixtures(): Promise<FplFixture[]> {
  const bootstrap = await getBootstrap();
  // Prefer short TTL while a GW is open so provisional / live scores refresh.
  const ttl = isCurrentGwActive(bootstrap) ? LIVE_TTL : IDLE_TTL;
  return withCache("fixtures", ttl, () => fplFetch<FplFixture[]>("/fixtures/"));
}

export async function getEventLive(eventId: number): Promise<EventLive> {
  return withCache(`event-live-${eventId}`, LIVE_TTL, () =>
    fplFetch<EventLive>(`/event/${eventId}/live/`),
  );
}

export async function getElementSummary(playerId: number): Promise<ElementSummary> {
  return withCache(`element-${playerId}`, SUMMARY_TTL, () =>
    fplFetch<ElementSummary>(`/element-summary/${playerId}/`),
  );
}

export async function getEntry(entryId: number): Promise<EntrySummary> {
  return withCache(`entry-${entryId}`, ENTRY_TTL, () =>
    fplFetch<EntrySummary>(`/entry/${entryId}/`),
  );
}

export async function getEntryPicks(
  entryId: number,
  eventId: number,
): Promise<EntryPicks> {
  return withCache(`entry-picks-${entryId}-${eventId}`, ENTRY_TTL, () =>
    fplFetch<EntryPicks>(`/entry/${entryId}/event/${eventId}/picks/`),
  );
}
