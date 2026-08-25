"use client";

import { useMemo, useState } from "react";
import {
  clubBadgePngUrl,
  clubBadgeUrl,
  clubKitUrl,
  clubKitUrlLarge,
  playerPhotoCandidates,
} from "@/lib/media";
import type { Position } from "@/lib/types";

export function PlayerPhoto({
  photo,
  alt,
  className = "h-10 w-8 object-cover",
  size = "list",
}: {
  photo: string;
  alt: string;
  className?: string;
  /** Detail pages prefer higher-res; lists use the same fallback chain. */
  size?: "list" | "detail";
}) {
  const candidates = useMemo(() => {
    const all = playerPhotoCandidates(photo);
    // Detail: start at 250; list: start at 110 (skip huge files in tables).
    if (size === "list" && all.length > 1) {
      return all.slice(1);
    }
    return all;
  }, [photo, size]);

  const [index, setIndex] = useState(0);
  const exhausted = index >= candidates.length;
  const src = exhausted ? null : candidates[index];

  if (!src) {
    return (
      <div
        className={[
          "flex items-center justify-center bg-zinc-800 text-[10px] font-bold text-zinc-500",
          className,
        ].join(" ")}
        aria-hidden
      >
        ?
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export function ClubKit({
  teamCode,
  teamShort,
  className = "h-8 w-8 object-contain",
  position,
  preferJersey = false,
}: {
  teamCode: number;
  teamShort: string;
  className?: string;
  position?: Position;
  /** When true, try jersey art before club crest. */
  preferJersey?: boolean;
}) {
  const goalkeeper = position === "GKP";
  const candidates = useMemo(() => {
    const badge = [
      clubBadgeUrl(teamCode),
      clubBadgePngUrl(teamCode, 70),
    ];
    const jersey = [
      clubKitUrlLarge(teamCode, { goalkeeper }),
      clubKitUrl(teamCode, { goalkeeper, size: 110 }),
      clubKitUrl(teamCode, { goalkeeper, size: 66 }),
    ];
    return preferJersey ? [...jersey, ...badge] : [...badge, ...jersey];
  }, [teamCode, goalkeeper, preferJersey]);

  const [index, setIndex] = useState(0);
  const exhausted = !teamCode || index >= candidates.length;
  const src = exhausted ? null : candidates[index];

  if (!src) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white",
          className,
        ].join(" ")}
      >
        {teamShort.slice(0, 3)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={`${teamShort} ${preferJersey ? "kit" : "badge"}`}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
