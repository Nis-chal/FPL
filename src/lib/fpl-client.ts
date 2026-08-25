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

const FPL_BASE = "https://fantasy.premierleague.com/api";

const LIVE_TTL = 25 * 1000;
const ACTIVE_TTL = 75 * 1000;
const IDLE_TTL = 4 * 60 * 1000;
const SUMMARY_TTL = 5 * 60 * 1000;
const ENTRY_TTL = 5 * 60 * 1000;

async function fplFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: {
      "User-Agent": "fpl-assistant/1.0",
      Accept: "application/json",
    },
    // Bootstrap exceeds Next.js 2MB data cache; we use module TTL cache instead.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`FPL API ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
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
  const ttl = bootstrapTtl(bootstrap);
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
