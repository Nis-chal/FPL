"use client";

import { useState } from "react";
import { clubKitUrl, playerPhotoUrl } from "@/lib/media";

export function PlayerPhoto({
  photo,
  alt,
  className = "h-10 w-8 object-cover",
}: {
  photo: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
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
      src={playerPhotoUrl(photo)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ClubKit({
  teamCode,
  teamShort,
  className = "h-8 w-8 object-contain",
}: {
  teamCode: number;
  teamShort: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!teamCode || failed) {
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
      src={clubKitUrl(teamCode)}
      alt={`${teamShort} kit`}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
