"use client";

import { useState } from "react";
import Link from "next/link";
import { ClubKit } from "@/components/PlayerMedia";
import { PlayerLink } from "@/components/PlayerDrawer";
import type { FormationRank } from "@/lib/types";

export function BestFormationCard({
  formations,
  horizon,
  defaultOpen = false,
}: {
  formations: FormationRank[];
  horizon: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (formations.length === 0) return null;
  const best = formations[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-zinc-900/80 md:px-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-100">Best formation</h2>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
              {best.name}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {open
              ? `Highest projected XI over next ${horizon} fixtures · max 3 per club`
              : `${best.projectedPoints.toFixed(1)} xPts · ${formations.length} shapes · click to expand`}
          </p>
        </div>
        <span
          className={[
            "mt-1 shrink-0 text-zinc-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3 md:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-400">
              <span className="text-lg font-bold text-emerald-400">
                {best.projectedPoints.toFixed(1)}
              </span>{" "}
              xPts · avg {best.expectedPointsPerGw.toFixed(1)} /GW
            </div>
            <Link
              href="/recommend"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
              onClick={(e) => e.stopPropagation()}
            >
              Open recommend →
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {best.startingXi.map((p) => (
              <PlayerLink
                key={p.id}
                playerId={p.id}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5 text-xs hover:border-emerald-500/40"
              >
                <ClubKit
                  teamCode={p.teamCode}
                  teamShort={p.teamShort}
                  position={p.position}
                  className="h-5 w-5 object-contain"
                />
                <span className="font-semibold text-zinc-100">{p.webName}</span>
                <span className="text-zinc-500">{p.position}</span>
                <span className="text-emerald-400">
                  {p.projectedPoints.toFixed(1)}
                </span>
              </PlayerLink>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Formation</th>
                  <th className="px-2 py-1.5">Shape</th>
                  <th className="px-2 py-1.5">XI xPts</th>
                </tr>
              </thead>
              <tbody>
                {formations.map((f, i) => (
                  <tr
                    key={f.name}
                    className={[
                      "border-t border-zinc-800",
                      i === 0 ? "bg-emerald-500/5" : "",
                    ].join(" ")}
                  >
                    <td className="px-2 py-2 text-zinc-500">{i + 1}</td>
                    <td className="px-2 py-2 font-semibold text-zinc-100">
                      {f.name}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">
                          Best
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-zinc-400">
                      1-{f.DEF}-{f.MID}-{f.FWD}
                    </td>
                    <td className="px-2 py-2 font-semibold text-emerald-400">
                      {f.projectedPoints.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
