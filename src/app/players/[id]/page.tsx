import Link from "next/link";
import { notFound } from "next/navigation";
import { FixtureStrip } from "@/components/FixturePill";
import { Reasons } from "@/components/PlayerTable";
import { Card, ErrorBox, Stat } from "@/components/ui";
import { getPlayerDetail } from "@/lib/insights";
import { formatPrice } from "@/lib/utils";

export const revalidate = 300;

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
    const { player, history, upcoming, historyPast } = detail;

    return (
      <div className="space-y-6">
        <div>
          <Link href="/players" className="text-sm text-emerald-400">
            ← Players
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-zinc-50">
            {player.fullName}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {player.teamName} · {player.position} · {formatPrice(player.price)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="xPts / GW" value={player.expectedPointsPerGw.toFixed(1)} accent />
          <Stat label="Horizon xPts" value={player.projectedPoints.toFixed(1)} />
          <Stat label="Start chance" value={`${Math.round(player.startChance * 100)}%`} />
          <Stat label="xGI / 90" value={player.xgi90.toFixed(2)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Attacking threat" value={`${player.attackingThreat}/100`} />
          <Stat label="Next-win chance" value={`${player.nextWinChance}%`} />
          <Stat
            label="CS chance"
            value={
              player.position === "GKP" || player.position === "DEF"
                ? `${player.cleanSheetChance}%`
                : "—"
            }
          />
          <Stat label="Form (secondary)" value={player.form.toFixed(1)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total pts" value={String(player.totalPoints)} />
          <Stat label="Selected by" value={`${player.selectedBy}%`} />
          <Stat label="Price" value={formatPrice(player.price)} />
          <Stat label="Minutes" value={String(player.minutes)} />
        </div>

        <Card
          title="Why this expected-points score"
          subtitle="xPts ≈ P(start) × (appearance + goals/assists from xG·xA + CS − conceded + bonus), scaled by fixtures"
        >
          <Reasons reasons={player.reasons} />
          {player.news && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {player.news}
            </p>
          )}
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
                    GW{f.event ?? "?"} · {f.isHome ? "H" : "A"}{" "}
                    {f.opponentName}
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
                    <tr key={`${h.round}-${h.fixture}`} className="border-t border-zinc-800">
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

        {historyPast.length > 0 && (
          <Card title="Previous seasons">
            <ul className="space-y-2">
              {historyPast.slice(0, 5).map((season) => (
                <li
                  key={season.season_name}
                  className="flex justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span>{season.season_name}</span>
                  <span className="text-zinc-400">
                    {season.total_points} pts · {season.goals_scored}G{" "}
                    {season.assists}A · {season.minutes}&apos;
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
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
