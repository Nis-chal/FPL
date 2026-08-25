"use client";

import { useState } from "react";
import type {
  InvolvementStats,
  PastSeasonSlice,
  VsOpponentMeeting,
  VsUpcomingClub,
} from "@/lib/opponent-history";

function InvolvementRow({
  label,
  stats,
  compact,
}: {
  label?: string;
  stats: InvolvementStats;
  compact?: boolean;
}) {
  const cells = [
    { key: "Threat", value: Math.round(stats.threat), hint: "att. volume" },
    { key: "Creat.", value: Math.round(stats.creativity), hint: "chance / pass" },
    { key: "Def", value: stats.defensiveContribution, hint: "def contrib" },
    {
      key: "CBI",
      value: stats.clearancesBlocksInterceptions,
      hint: "clr/blk/int",
    },
    { key: "Tackles", value: stats.tackles, hint: "tackles" },
  ];

  return (
    <div className={compact ? "mt-1.5" : "mt-2"}>
      {label && (
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {cells.map((c) => (
          <div
            key={c.key}
            title={c.hint}
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-1.5 py-1.5 text-center"
          >
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">
              {c.key}
            </div>
            <div className="text-sm font-semibold text-zinc-100">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingRow({ m }: { m: VsOpponentMeeting }) {
  return (
    <li className="rounded-lg border border-zinc-800/80 px-2 py-2">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>
          GW{m.round} · {m.wasHome ? "H" : "A"} · {m.minutes}&apos;
        </span>
        <span>
          <span className="font-semibold text-emerald-400">{m.points} pts</span>
          <span className="ml-2 text-zinc-500">
            {m.goals}G {m.assists}A
          </span>
        </span>
      </div>
      <InvolvementRow stats={m} compact />
    </li>
  );
}

function PastSeasonRow({ s }: { s: PastSeasonSlice }) {
  return (
    <li className="rounded-lg border border-zinc-800/80 px-2 py-2">
      <div className="flex justify-between text-xs text-zinc-400">
        <span className="font-semibold text-zinc-200">{s.seasonName}</span>
        <span>
          <span className="font-semibold text-emerald-400">{s.points} pts</span>
          <span className="ml-2 text-zinc-500">
            {s.goals}G {s.assists}A · {s.minutes}&apos;
          </span>
        </span>
      </div>
      <InvolvementRow stats={s} compact />
    </li>
  );
}

function OpponentBlock({ club }: { club: VsUpcomingClub }) {
  const [open, setOpen] = useState(false);
  const summary =
    club.games > 0
      ? `${club.totalPoints} pts · ${club.games} game${club.games === 1 ? "" : "s"} · ${club.avgPoints} avg`
      : club.pastSeasons.length > 0
        ? `No H2H yet · ${club.pastSeasons.length} prior season${club.pastSeasons.length === 1 ? "" : "s"}`
        : "No meetings yet";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-zinc-900/60"
      >
        <div className="min-w-0">
          <div className="font-semibold text-zinc-100">
            {club.nextIsHome ? "vs" : "@"} {club.opponentShort}
            <span className="ml-2 text-xs font-normal text-zinc-500">
              GW{club.nextEvent ?? "?"} · FDR {club.nextDifficulty}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-zinc-400">{summary}</div>
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
        <div className="space-y-3 border-t border-zinc-800 px-3 pb-3 pt-2">
          {club.games > 0 ? (
            <>
              <InvolvementRow
                label="This season vs them (totals)"
                stats={club.involvement}
              />
              <ul className="space-y-2">
                {club.meetings.map((m) => (
                  <MeetingRow key={m.round} m={m} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                No meetings this season. FPL has no past H2H by club — showing
                last {club.pastSeasons.length || 5} overall seasons (Threat ≈
                shot volume, Creativity ≈ chance/pass creation).
              </p>
              {club.pastSeasons.length > 0 ? (
                <ul className="space-y-2">
                  {club.pastSeasons.map((s) => (
                    <PastSeasonRow key={s.seasonName} s={s} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No prior FPL seasons.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function VsUpcomingSection({ clubs }: { clubs: VsUpcomingClub[] }) {
  const [open, setOpen] = useState(false);
  if (clubs.length === 0) return null;

  const withH2h = clubs.filter((c) => c.games > 0).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-zinc-900/80 md:px-5"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-zinc-100">Vs upcoming clubs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {open
              ? "This-season H2H, or prior seasons if not played yet · FPL Threat / Creativity / Def / CBI / Tackles"
              : `${clubs.length} opponents · ${withH2h} with H2H · click to expand`}
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
        <div className="space-y-2 border-t border-zinc-800 px-4 pb-4 pt-3 md:px-5">
          {clubs.map((c) => (
            <OpponentBlock key={`${c.opponentId}-${c.nextEvent}`} club={c} />
          ))}
        </div>
      )}
    </section>
  );
}
