import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  Referer: "https://fantasy.premierleague.com/",
  Origin: "https://fantasy.premierleague.com",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

const MAX_ATTEMPTS = 4;
const COOKIE_JAR = join(tmpdir(), "fpl-assistant-cookie-jar.txt");

let warmedUp = false;
let sessionCookie = "";
let curlPath: string | null = null;
/** Serialize outbound FPL calls — burst traffic triggers edge 403s. */
let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCurlBin(): string | null {
  if (curlPath !== null) return curlPath || null;
  for (const candidate of [
    "/usr/bin/curl",
    "/bin/curl",
    "/usr/local/bin/curl",
    "/opt/homebrew/bin/curl",
  ]) {
    if (existsSync(candidate)) {
      curlPath = candidate;
      return curlPath;
    }
  }
  curlPath = "";
  return null;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function mergeSetCookie(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq > 0) map.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Hit the FPL homepage so edge cookies / bot checks settle. */
async function warmUpFplOrigin(): Promise<void> {
  if (warmedUp || process.env.FPL_API_BASE) return;
  warmedUp = true;

  // Prefer curl warmup — persists a real Netscape cookie jar for later curls.
  const bin = resolveCurlBin();
  if (bin) {
    try {
      await runCurlRaw([
        "-sS",
        "-L",
        "--max-time",
        "15",
        "-c",
        COOKIE_JAR,
        "-b",
        COOKIE_JAR,
        "-A",
        FPL_HEADERS["User-Agent"],
        "-H",
        `Accept-Language: ${FPL_HEADERS["Accept-Language"]}`,
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "https://fantasy.premierleague.com/",
      ]);
    } catch {
      // continue with fetch warmup
    }
  }

  try {
    const res = await fetch("https://fantasy.premierleague.com/", {
      headers: {
        "User-Agent": FPL_HEADERS["User-Agent"],
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": FPL_HEADERS["Accept-Language"],
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    if (setCookies.length) {
      sessionCookie = mergeSetCookie(sessionCookie, setCookies);
    }
  } catch {
    // Warm-up is best-effort; API call still proceeds.
  }
}

function runCurlRaw(args: string[]): Promise<{ body: string; code: number }> {
  const bin = resolveCurlBin();
  if (!bin) {
    return Promise.reject(new Error("curl binary not found"));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `/usr/bin:/bin:/usr/local/bin:${process.env.PATH ?? ""}` },
    });
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
            `curl exit ${code}: ${Buffer.concat(errChunks).toString("utf8").slice(0, 200) || "no stderr"}`,
          ),
        );
        return;
      }
      resolve({ body, code: code ?? 0 });
    });
  });
}

/** curl often succeeds when Node's TLS fingerprint is blocked (403). */
async function curlFetchJson<T>(url: string): Promise<T> {
  const bin = resolveCurlBin();
  if (!bin) {
    throw new Error("curl binary not found on PATH");
  }

  const marker = "\n__FPL_HTTP__";
  const args = [
    "-sS",
    "-L",
    "--compressed",
    "--max-time",
    "30",
    "-c",
    COOKIE_JAR,
    "-b",
    COOKIE_JAR,
    "-A",
    FPL_HEADERS["User-Agent"],
    "-H",
    `Accept: ${FPL_HEADERS.Accept}`,
    "-H",
    `Accept-Language: ${FPL_HEADERS["Accept-Language"]}`,
    "-H",
    `Referer: ${FPL_HEADERS.Referer}`,
    "-H",
    `Origin: ${FPL_HEADERS.Origin}`,
    "-H",
    "Sec-Fetch-Dest: empty",
    "-H",
    "Sec-Fetch-Mode: cors",
    "-H",
    "Sec-Fetch-Site: same-origin",
    "-w",
    `${marker}%{http_code}`,
    url,
  ];

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { body } = await runCurlRaw(args);
      const idx = body.lastIndexOf(marker);
      const jsonPart = idx >= 0 ? body.slice(0, idx) : body;
      const status =
        idx >= 0 ? Number(body.slice(idx + marker.length).trim()) : 0;

      if (status && status !== 200) {
        lastErr = new Error(`curl HTTP ${status}`);
        if ((status === 403 || status === 429 || status >= 500) && attempt < 3) {
          await sleep(500 * attempt);
          continue;
        }
        throw lastErr;
      }

      if (!jsonPart.trim()) {
        lastErr = new Error("empty body");
        if (attempt < 3) {
          await sleep(500 * attempt);
          continue;
        }
        throw lastErr;
      }

      return JSON.parse(jsonPart) as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await sleep(500 * attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new Error("curl fallback failed");
}

async function fetchJsonOnce<T>(url: string, path: string): Promise<T> {
  const headers: Record<string, string> = { ...FPL_HEADERS };
  if (sessionCookie) headers.Cookie = sessionCookie;

  const res = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "follow",
  });

  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (setCookies.length) {
    sessionCookie = mergeSetCookie(sessionCookie, setCookies);
  }

  if (!res.ok) {
    throw new Error(`FPL API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function fplFetch<T>(path: string): Promise<T> {
  return enqueue(async () => {
    const url = `${FPL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    let lastError: Error | null = null;

    await warmUpFplOrigin();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await fetchJsonOnce<T>(url, path);
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("FPL API request failed");
        const msg = lastError.message;
        const retryable =
          msg.includes(" 403 ") ||
          msg.includes(" 429 ") ||
          / 5\d\d /.test(msg) ||
          msg.includes("fetch failed");
        if (retryable && attempt < MAX_ATTEMPTS) {
          await sleep(450 * attempt);
          continue;
        }
        break;
      }
    }

    // Last resort: curl (different TLS stack + cookie jar) when Node is blocked.
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
  });
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
