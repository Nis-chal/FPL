import { withCache } from "@/lib/cache";
import type {
  BootstrapStatic,
  ElementSummary,
  EntryPicks,
  EntrySummary,
  FplFixture,
} from "@/lib/types";

const FPL_BASE = "https://fantasy.premierleague.com/api";

const BOOTSTRAP_TTL = 15 * 60 * 1000;
const FIXTURES_TTL = 15 * 60 * 1000;
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

export async function getBootstrap(): Promise<BootstrapStatic> {
  return withCache("bootstrap", BOOTSTRAP_TTL, () =>
    fplFetch<BootstrapStatic>("/bootstrap-static/"),
  );
}

export async function getFixtures(): Promise<FplFixture[]> {
  return withCache("fixtures", FIXTURES_TTL, () =>
    fplFetch<FplFixture[]>("/fixtures/"),
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
