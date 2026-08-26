import { spawn } from "node:child_process";
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

/**
 * FPL / Cloudflare often 403s non-browser TLS fingerprints.
 * Match a real Chrome desktop request as closely as fetch allows.
 */
const FPL_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  Referer: "https://fantasy.premierleague.com/",
  Origin: "https://fantasy.premierleague.com",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

const MAX_ATTEMPTS = 3;

let warmedUp = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hit the FPL homepage once per process so edge cookies / bot checks settle. */
async function warmUpFplOrigin(): Promise<void> {
  if (warmedUp || process.env.FPL_API_BASE) return;
  warmedUp = true;
  try {
    await fetch("https://fantasy.premierleague.com/", {
      headers: {
        "User-Agent": FPL_HEADERS["User-Agent"],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": FPL_HEADERS["Accept-Language"],
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Warm-up is best-effort; API call still proceeds.
  }
}

/** curl often succeeds when Node's TLS fingerprint is blocked (403). */
function curlFetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const args = [
      "-sS",
      "-L",
      "--max-time",
      "25",
      "-H",
      `User-Agent: ${FPL_HEADERS["User-Agent"]}`,
      "-H",
      `Accept: ${FPL_HEADERS.Accept}`,
      "-H",
      `Accept-Language: ${FPL_HEADERS["Accept-Language"]}`,
      "-H",
      `Referer: ${FPL_HEADERS.Referer}`,
      "-H",
      `Origin: ${FPL_HEADERS.Origin}`,
      url,
    ];
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => errChunks.push(c));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (code !== 0) {
        reject(
          new Error(
            `curl exit ${code}: ${Buffer.concat(errChunks).toString("utf8") || body.slice(0, 200)}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(
          new Error(
            `FPL curl returned non-JSON (${body.slice(0, 120).replace(/\s+/g, " ")})`,
          ),
        );
      }
    });
  });
}

async function fplFetch<T>(path: string): Promise<T> {
  const url = `${FPL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let lastError: Error | null = null;

  await warmUpFplOrigin();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FPL_HEADERS,
        // Bootstrap exceeds Next.js 2MB data cache; we use module TTL cache instead.
        cache: "no-store",
        redirect: "follow",
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      lastError = new Error(
        `FPL API ${path} failed: ${res.status} ${res.statusText}`,
      );

      // Transient edge blocks / rate limits — brief backoff then retry.
      const retryable =
        res.status === 403 || res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      break;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("FPL API request failed");
      if (attempt < MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      break;
    }
  }

  // Last resort: curl (different TLS stack) when Node fetch is edge-blocked.
  if (!process.env.FPL_API_BASE) {
    try {
      return await curlFetchJson<T>(url);
    } catch (curlErr) {
      const curlMsg =
        curlErr instanceof Error ? curlErr.message : "curl fallback failed";
      throw new Error(
        `${lastError?.message ?? `FPL API ${path} failed`} (curl: ${curlMsg})`,
      );
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
