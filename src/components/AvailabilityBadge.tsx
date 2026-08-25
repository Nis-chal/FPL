"use client";

import type { FplElement } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  a: "Available",
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
};

export function availabilityLabel(
  status: string,
  chanceOfPlaying: number | null | undefined,
): string {
  const base = STATUS_LABELS[status] ?? status.toUpperCase();
  if (status === "d" && chanceOfPlaying != null) {
    return `${base} ${chanceOfPlaying}%`;
  }
  if (
    (status === "i" || status === "s" || status === "u") &&
    chanceOfPlaying != null &&
    chanceOfPlaying > 0
  ) {
    return `${base} ${chanceOfPlaying}%`;
  }
  return base;
}

export function availabilityFromElement(el: Pick<
  FplElement,
  "status" | "chance_of_playing_next_round" | "chance_of_playing_this_round"
>) {
  return {
    status: el.status,
    chance:
      el.chance_of_playing_next_round ?? el.chance_of_playing_this_round ?? null,
  };
}

export function AvailabilityBadge({
  status,
  chanceOfPlaying,
  news,
  compact = false,
}: {
  status: string;
  chanceOfPlaying?: number | null;
  news?: string;
  compact?: boolean;
}) {
  if (status === "a" && !news) return null;

  const label = availabilityLabel(status, chanceOfPlaying);
  const tone =
    status === "i" || status === "s" || status === "u"
      ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
      : status === "d"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
        : "border-zinc-600 bg-zinc-800 text-zinc-300";

  return (
    <span
      title={news || label}
      className={[
        "inline-flex items-center rounded border font-semibold uppercase tracking-wide",
        compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[10px]",
        tone,
      ].join(" ")}
    >
      {compact
        ? status === "d" && chanceOfPlaying != null
          ? `${chanceOfPlaying}%`
          : status.toUpperCase()
        : label}
    </span>
  );
}
