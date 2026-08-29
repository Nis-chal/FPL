import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fixtureRowClass,
  FixtureScore,
  FixtureStatusBadge,
} from "@/components/FixtureListRow";
import { FixtureStrip } from "@/components/FixturePill";
import { LatestNewsCard } from "@/components/LatestNews";
import { PlayerTable } from "@/components/PlayerTable";
import { VsUpcomingSection } from "@/components/VsUpcoming";
import { Card, ErrorBox } from "@/components/ui";
import { getClubDetail } from "@/lib/insights";

export const revalidate = 30;

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isFinite(teamId)) notFound();

  try {
    const detail = await getClubDetail(teamId);
    if (!detail) notFound();

    return (
      <div className="space-y-6">
        <div>
          <Link href="/clubs" className="text-sm text-emerald-400">
            ← Clubs
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-zinc-50">
            {detail.team.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Strength {detail.team.strength} · {detail.team.short_name}
          </p>
        </div>

        <LatestNewsCard
          title="Squad news"
          emptyHint="No FPL news flagged for this squad."
          items={detail.news}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Next 7 fixtures" subtitle="Fixture difficulty from FPL">
            <FixtureStrip fixtures={detail.upcoming} />
            <ul className="mt-4 space-y-2">
              {detail.upcoming.map((f) => (
                <li key={f.id} className={fixtureRowClass(f.isCurrent || f.isLive)}>
                  <span className="text-zinc-200">
                    GW{f.event ?? "?"} · {f.isHome ? "Home" : "Away"} vs{" "}
                    {f.opponentName}
                    <FixtureStatusBadge fixture={f} />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-zinc-400">
                    {f.hasResult ? (
                      <FixtureScore fixture={f} />
                    ) : (
                      <span>FDR {f.difficulty}</span>
                    )}
                  </span>
                </li>
              ))}
              {detail.upcoming.length === 0 && (
                <li className="text-sm text-zinc-500">No upcoming fixtures.</li>
              )}
            </ul>
          </Card>

          <Card
            title="Recent results"
            subtitle="Includes live & provisional scores from FPL"
          >
            <ul className="space-y-2">
              {detail.recent.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-200">
                    <span
                      className={[
                        "mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                        f.result === "W"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : f.result === "L"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-zinc-700 text-zinc-300",
                      ].join(" ")}
                    >
                      {f.result ?? "–"}
                    </span>
                    GW{f.event ?? "?"} · {f.isHome ? "vs" : "@"} {f.opponentName}
                    {f.isLive && (
                      <span className="ml-2 text-[11px] font-semibold text-rose-400">
                        LIVE {f.minutes}&apos;
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-zinc-300">
                    {f.teamScore ?? "–"}-{f.opponentScore ?? "–"}
                  </span>
                </li>
              ))}
              {detail.recent.length === 0 && (
                <li className="text-sm text-zinc-500">
                  No finished matches yet.
                </li>
              )}
            </ul>
          </Card>
        </div>

        <VsUpcomingSection clubs={detail.vsUpcoming} />

        <Card
          title="Squad by projected points"
          subtitle="Form + upcoming fixtures for this club"
        >
          <PlayerTable players={detail.players} />
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error ? error.message : "Failed to load club"
        }
      />
    );
  }
}
