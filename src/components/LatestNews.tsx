import Link from "next/link";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { Card } from "@/components/ui";

export type NewsItem = {
  playerId?: number;
  playerName?: string;
  news: string;
  newsAdded: string | null;
  status?: string;
  chanceOfPlaying?: number | null;
};

function formatNewsDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Single latest-news panel for a player or list of club squad news. */
export function LatestNewsCard({
  items,
  title = "Latest news",
  emptyHint = "No FPL news flagged for this player.",
}: {
  items: NewsItem[];
  title?: string;
  emptyHint?: string;
}) {
  const withNews = items.filter((i) => i.news?.trim());
  if (withNews.length === 0) {
    return (
      <Card title={title} subtitle="From the official FPL feed">
        <p className="text-sm text-zinc-500">{emptyHint}</p>
      </Card>
    );
  }

  return (
    <Card
      title={title}
      subtitle={
        withNews.length === 1
          ? "Official FPL availability update"
          : `${withNews.length} squad updates from FPL`
      }
    >
      <ul className="space-y-2">
        {withNews.map((item) => (
          <li
            key={`${item.playerId ?? "p"}-${item.newsAdded ?? item.news}`}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              {item.playerId != null && item.playerName && (
                <Link
                  href={`/players/${item.playerId}`}
                  className="text-sm font-semibold text-zinc-100 hover:text-emerald-400"
                >
                  {item.playerName}
                </Link>
              )}
              {item.status && (
                <AvailabilityBadge
                  status={item.status}
                  chanceOfPlaying={item.chanceOfPlaying ?? null}
                  news={item.news}
                  compact
                />
              )}
              {item.newsAdded && (
                <span className="text-[11px] text-amber-200/70">
                  {formatNewsDate(item.newsAdded)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-amber-100">{item.news}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
