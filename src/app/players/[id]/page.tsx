import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getPlayerDetail } from "@/lib/insights";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  try {
    const detail = await getPlayerDetail(playerId);
    if (!detail) notFound();
    const {
      player,
      history,
      historyFull,
      upcoming,
      historyPast,
      vsUpcoming,
    } = detail;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <PlayerPhoto
            photo={player.photo}
            alt={player.fullName}
            className="h-28 w-[5.5rem] rounded-xl object-cover ring-1 ring-zinc-700"
          />
          <div>
            <Link href="/players" className="text-sm text-emerald-400">
              ← Players
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-zinc-50">
              {player.fullName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <span>
                {player.teamName} · {player.position} ·{" "}
                {formatPrice(player.price)}
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="xPts / GW"
            value={player.expectedPointsPerGw.toFixed(1)}
            accent
          />
          <Stat label="Horizon xPts" value={player.projectedPoints.toFixed(1)} />
          <Stat
            label="Start chance"
            value={`${Math.round(player.startChance * 100)}%`}
          />
          <Stat label="xGI / 90" value={player.xgi90.toFixed(2)} />
        </div>

        <VsUpcomingSection clubs={vsUpcoming} />

        <PlayerProgressSection history={historyFull} />

        <PastSeasonsTable seasons={historyPast} />

        <Card
          title="Why this score"
          subtitle="Expected points from starts, xG/xA, fixtures"
        >
          <Reasons reasons={player.reasons} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load player"
        }
      />
    );
  }
}
