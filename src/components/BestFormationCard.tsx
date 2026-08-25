"use client";

import Link from "next/link";
import { ClubKit } from "@/components/PlayerMedia";
import { Card } from "@/components/ui";
import type { FormationRank } from "@/lib/types";

export function BestFormationCard({
  formations,
  horizon,
}: {
  formations: FormationRank[];
  horizon: number;
}) {
  if (formations.length === 0) return null;
  const best = formations[0];

  return (
    <Card
      title="Best formation"
      subtitle={`Highest projected XI over next ${horizon} fixtures · max 3 per club`}
      action={
        <Link
          href="/squad"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          Open pitch →
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-emerald-400">
            Recommended
          </div>
          <div className="mt-1 text-3xl font-bold text-zinc-50">{best.name}</div>
        </div>
        <div className="text-sm text-zinc-400">
          <span className="text-lg font-bold text-emerald-400">
            {best.projectedPoints.toFixed(1)}
          </span>{" "}
          xPts horizon · avg {best.expectedPointsPerGw.toFixed(1)} /GW
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {best.startingXi.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5 text-xs hover:border-emerald-500/40"
          >
            <ClubKit
              teamCode={p.teamCode}
              teamShort={p.teamShort}
              className="h-5 w-5 object-contain"
            />
            <span className="font-semibold text-zinc-100">{p.webName}</span>
            <span className="text-zinc-500">{p.position}</span>
            <span className="text-emerald-400">{p.projectedPoints.toFixed(1)}</span>
          </Link>
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
    </Card>
  );
}
