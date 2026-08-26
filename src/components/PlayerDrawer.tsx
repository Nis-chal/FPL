"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { FixtureStrip } from "@/components/FixturePill";
import { LatestNewsCard } from "@/components/LatestNews";
import { PlayerPhoto } from "@/components/PlayerMedia";
import {
  PastSeasonsTable,
  PlayerProgressSection,
} from "@/components/PlayerProgress";
import { Reasons } from "@/components/PlayerTable";
import { VsUpcomingSection } from "@/components/VsUpcoming";
import { Card, ErrorBox, Stat } from "@/components/ui";
import type {
  ElementHistory,
  FixtureView,
  PastSeasonStats,
  ScoredPlayer,
} from "@/lib/types";
import type { VsUpcomingClub } from "@/lib/opponent-history";
import { formatPrice } from "@/lib/utils";

type PlayerDetailPayload = {
  player: ScoredPlayer;
  history: Array<ElementHistory & { opponentShort: string }>;
  historyFull: Array<ElementHistory & { opponentShort: string }>;
  upcoming: FixtureView[];
  historyPast: PastSeasonStats[];
  currentSeason: PastSeasonStats | null;
  currentSeasonLabel: string;
  vsUpcoming: VsUpcomingClub[];
  horizon: number;
};

type PlayerDrawerContextValue = {
  openPlayer: (id: number) => void;
  closePlayer: () => void;
  playerId: number | null;
};

const PlayerDrawerContext = createContext<PlayerDrawerContextValue | null>(
  null,
);

export function usePlayerDrawer(): PlayerDrawerContextValue {
  const ctx = useContext(PlayerDrawerContext);
  if (!ctx) {
    throw new Error("usePlayerDrawer must be used within PlayerDrawerProvider");
  }
  return ctx;
}

/** Safe hook — returns null openers when provider is missing (e.g. tests). */
export function useOptionalPlayerDrawer(): PlayerDrawerContextValue | null {
  return useContext(PlayerDrawerContext);
}

function PlayerDetailBody({ detail }: { detail: PlayerDetailPayload }) {
  const {
    player,
    history,
    historyFull,
    upcoming,
    historyPast,
    currentSeason,
    currentSeasonLabel,
    vsUpcoming,
  } = detail;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <PlayerPhoto
          photo={player.photo}
          alt={player.fullName}
          size="detail"
          className="h-24 w-[4.75rem] rounded-xl object-cover ring-1 ring-zinc-700 sm:h-28 sm:w-[5.5rem]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-zinc-50 sm:text-3xl">
            {player.fullName}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>
              {player.teamName} · {player.position} · {formatPrice(player.price)}
            </span>
            <AvailabilityBadge
              status={player.status}
              chanceOfPlaying={player.chanceOfPlaying}
              news={player.news}
            />
          </p>
        </div>
      </div>

      <LatestNewsCard
        items={[
          {
            news: player.news,
            newsAdded: player.newsAdded,
            status: player.status,
            chanceOfPlaying: player.chanceOfPlaying,
          },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label="xPts / GW"
          value={player.expectedPointsPerGw.toFixed(1)}
          accent
          tip={
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Why this score
              </div>
              <p className="text-xs text-zinc-400">
                Built mainly from {currentSeasonLabel} minutes, form, xG/xA and
                upcoming fixtures.
              </p>
              <Reasons reasons={player.reasons} />
            </div>
          }
        />
        <Stat
          label="Horizon xPts"
          value={player.projectedPoints.toFixed(1)}
          tip={
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Why this score
              </div>
              <p className="text-xs text-zinc-400">
                Summed projected points over the active fixture horizon using
                current-season rates.
              </p>
              <Reasons reasons={player.reasons} />
            </div>
          }
        />
        <Stat
          label="Start chance"
          value={`${Math.round(player.startChance * 100)}%`}
        />
        <Stat label="xGI / 90" value={player.xgi90.toFixed(2)} />
      </div>

      {currentSeason && (
        <Card
          title={`${currentSeasonLabel} season`}
          subtitle="Live FPL totals for the current campaign"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total pts" value={String(currentSeason.total_points)} accent />
            <Stat label="Minutes" value={String(currentSeason.minutes)} />
            <Stat
              label="Goals"
              value={String(currentSeason.goals_scored)}
            />
            <Stat label="Assists" value={String(currentSeason.assists)} />
            <Stat
              label="Clean sheets"
              value={String(currentSeason.clean_sheets ?? 0)}
            />
            <Stat label="Bonus" value={String(currentSeason.bonus ?? 0)} />
            <Stat label="Form" value={player.form.toFixed(1)} />
            <Stat
              label="xGI (season)"
              value={
                currentSeason.expected_goal_involvements != null
                  ? Number(currentSeason.expected_goal_involvements).toFixed(1)
                  : "—"
              }
            />
          </div>
        </Card>
      )}

      <VsUpcomingSection clubs={vsUpcoming} />

      <PlayerProgressSection history={historyFull} />

      <PastSeasonsTable
        seasons={historyPast}
        currentSeason={currentSeason}
      />

      <Card title="Upcoming fixtures">
        <FixtureStrip fixtures={upcoming} />
        <ul className="mt-4 space-y-2">
          {upcoming.map((f) => (
            <li
              key={f.id}
              className="flex justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <span>
                GW{f.event ?? "?"} · {f.isHome ? "H" : "A"} {f.opponentName}
              </span>
              <span className="text-zinc-400">FDR {f.difficulty}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Recent gameweeks" subtitle="Last 8 appearances">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-2 py-1">GW</th>
                <th className="px-2 py-1">Opp</th>
                <th className="px-2 py-1">Pts</th>
                <th className="px-2 py-1">Min</th>
                <th className="px-2 py-1">G/A</th>
                <th className="px-2 py-1">xGI</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr
                  key={`${h.round}-${h.fixture}`}
                  className="border-t border-zinc-800"
                >
                  <td className="px-2 py-1.5">{h.round}</td>
                  <td className="px-2 py-1.5">
                    {h.was_home ? "vs" : "@"} {h.opponentShort}
                  </td>
                  <td className="px-2 py-1.5 font-semibold text-emerald-400">
                    {h.total_points}
                  </td>
                  <td className="px-2 py-1.5">{h.minutes}</td>
                  <td className="px-2 py-1.5">
                    {h.goals_scored}/{h.assists}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-400">
                    {(
                      Number(h.expected_goals) + Number(h.expected_assists)
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-zinc-500">
                    No history yet this season.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PlayerDrawerShell({
  playerId,
  onClose,
}: {
  playerId: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const [detail, setDetail] = useState<PlayerDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/players/${playerId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load player");
        if (!cancelled) setDetail(data as PlayerDetailPayload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const heading =
    detail?.player.webName ?? (loading ? "Loading…" : "Player detail");

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Close player detail"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl sm:max-w-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 id={titleId} className="truncate text-lg font-bold text-zinc-50">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="text-sm text-zinc-400">Loading player detail…</p>
          )}
          {error && <ErrorBox message={error} />}
          {detail && <PlayerDetailBody detail={detail} />}
        </div>
      </aside>
    </div>
  );
}

export function PlayerDrawerProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<number | null>(null);

  const openPlayer = useCallback((id: number) => {
    if (!Number.isFinite(id)) return;
    setPlayerId(id);
  }, []);

  const closePlayer = useCallback(() => setPlayerId(null), []);

  const value = useMemo(
    () => ({ openPlayer, closePlayer, playerId }),
    [openPlayer, closePlayer, playerId],
  );

  return (
    <PlayerDrawerContext.Provider value={value}>
      {children}
      {playerId != null && (
        <PlayerDrawerShell playerId={playerId} onClose={closePlayer} />
      )}
    </PlayerDrawerContext.Provider>
  );
}

/** Opens the player drawer instead of navigating to a detail page. */
export function PlayerLink({
  playerId,
  children,
  className,
  onClick,
}: {
  playerId: number;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { openPlayer } = usePlayerDrawer();
  return (
    <button
      type="button"
      className={
        className ??
        "text-left font-semibold text-zinc-100 hover:text-emerald-400"
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
        openPlayer(playerId);
      }}
    >
      {children}
    </button>
  );
}
