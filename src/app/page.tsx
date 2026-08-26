import Link from "next/link";
import { HomeInsightsClient } from "@/components/HomeInsightsClient";
import { ErrorBox } from "@/components/ui";
import { getLeagueInsights } from "@/lib/insights";
import { formatPrice } from "@/lib/utils";

export const revalidate = 30;

export default async function HomePage() {
  let insights;
  try {
    insights = await getLeagueInsights();
  } catch (error) {
    return (
      <ErrorBox
        message={
          error instanceof Error
            ? error.message
            : "Could not load FPL data. Try again shortly."
        }
      />
    );
  }

  const { currentEvent, nextEvent, scored, bestSquad } = insights;
  const gwLabel = currentEvent?.name ?? "Current gameweek";
  const deadline =
    currentEvent?.deadline_time != null
      ? new Date(currentEvent.deadline_time).toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {gwLabel}
          {deadline ? ` · deadline ${deadline}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-zinc-50 md:text-4xl">
          Expected points outlook
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Always tracks the latest FPL gameweek
          {nextEvent ? ` (next: ${nextEvent.name})` : ""}. Analyze by price,
          start chance, xPts, xGI/90, win/CS, or fixtures. Add your team ID for
          personal transfers and a squad rating.
        </p>
      </div>

      <HomeInsightsClient
        allPlayers={scored}
        currentEvent={currentEvent}
        nextEvent={nextEvent}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Link
          href="/clubs"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-500/40"
        >
          <h3 className="font-bold text-zinc-100">Clubs & fixtures</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Next 7 games and recent results for every Premier League club.
          </p>
        </Link>
        <Link
          href="/transfers"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-500/40"
        >
          <h3 className="font-bold text-zinc-100">Transfer targets</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Best inbound picks league-wide, or personal out→in swaps with your
            team ID.
          </p>
        </Link>
        <Link
          href="/squad"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-500/40"
        >
          <h3 className="font-bold text-zinc-100">Best squad</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Model XV for the next run of fixtures ({bestSquad.formation},{" "}
            {formatPrice(bestSquad.totalCost)}).
          </p>
        </Link>
      </div>
    </div>
  );
}
