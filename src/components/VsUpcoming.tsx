"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { VsOpponentMeeting, VsUpcomingClub } from "@/lib/opponent-history";

function formatMatchDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scoreLabel(m: VsOpponentMeeting): string {
  if (m.teamScore === null || m.opponentScore === null) return "–";
  return `${m.teamScore}–${m.opponentScore}`;
}

function resultTabClass(m: Pick<VsOpponentMeeting, "result" | "minutes">): string {
  if (m.minutes <= 0) {
    return "border-amber-500/50 bg-amber-400/25 text-amber-100";
  }
  if (m.result === "W") {
    return "border-emerald-500/50 bg-emerald-500/25 text-emerald-100";
  }
  if (m.result === "L") {
    return "border-rose-500/40 bg-rose-500/20 text-rose-100";
  }
  return "border-zinc-600 bg-zinc-800 text-zinc-200";
}

function IconBadges({ goals, assists }: { goals: number; assists: number }) {
  if (goals <= 0 && assists <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {goals > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-black/30 px-1 py-0.5 text-[10px] font-bold"
          title={`${goals} goal${goals === 1 ? "" : "s"}`}
        >
          ⚽{goals > 1 ? goals : ""}
        </span>
      )}
      {assists > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-black/30 px-1 py-0.5 text-[10px] font-bold"
          title={`${assists} assist${assists === 1 ? "" : "s"}`}
        >
          👟{assists > 1 ? assists : ""}
        </span>
      )}
    </span>
  );
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

type H2hProjection = {
  appearances: number;
  scoreProb: number;
  assistProb: number;
  likelyScorelines: Array<{ line: string; pct: number; note?: string }>;
};

function projectFromMeetings(meetings: VsOpponentMeeting[]): H2hProjection | null {
  if (meetings.length === 0) return null;

  const played = meetings.filter((m) => m.minutes > 0);
  const scored = meetings.filter(
    (m) => m.teamScore !== null && m.opponentScore !== null,
  );

  const appearances = played.length;
  const avgGoals =
    appearances > 0
      ? played.reduce((s, m) => s + m.goals, 0) / appearances
      : 0;
  const avgAssists =
    appearances > 0
      ? played.reduce((s, m) => s + m.assists, 0) / appearances
      : 0;

  const scoreProb = appearances > 0 ? 1 - Math.exp(-avgGoals) : 0;
  const assistProb = appearances > 0 ? 1 - Math.exp(-avgAssists) : 0;

  const avgFor =
    scored.length > 0
      ? scored.reduce((s, m) => s + (m.teamScore ?? 0), 0) / scored.length
      : 1.2;
  const avgAgainst =
    scored.length > 0
      ? scored.reduce((s, m) => s + (m.opponentScore ?? 0), 0) / scored.length
      : 1.2;

  const counts = new Map<string, number>();
  for (const m of scored) {
    const line = `${m.teamScore}–${m.opponentScore}`;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const poissonLines: Array<{ line: string; pct: number }> = [];
  for (let gf = 0; gf <= 4; gf++) {
    for (let ga = 0; ga <= 4; ga++) {
      const p = poissonPmf(gf, avgFor) * poissonPmf(ga, avgAgainst);
      poissonLines.push({ line: `${gf}–${ga}`, pct: p * 100 });
    }
  }
  poissonLines.sort((a, b) => b.pct - a.pct);

  const likelyScorelines: H2hProjection["likelyScorelines"] = [];
  if (mode) {
    likelyScorelines.push({
      line: mode[0],
      pct: (mode[1] / scored.length) * 100,
      note: "most common",
    });
  }
  for (const row of poissonLines) {
    if (likelyScorelines.some((x) => x.line === row.line)) continue;
    likelyScorelines.push({ line: row.line, pct: row.pct });
    if (likelyScorelines.length >= 3) break;
  }

  return { appearances, scoreProb, assistProb, likelyScorelines };
}

/** Compact chips right after the club name. */
function OutlookInline({ meetings }: { meetings: VsOpponentMeeting[] }) {
  const proj = projectFromMeetings(meetings);
  if (!proj || proj.appearances === 0) {
    return (
      <span className="text-xs text-zinc-500">No H2H appearances</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300"
        title="Chance of scoring ≥1 (from last 5 H2H)"
      >
        ⚽ {pct(proj.scoreProb)}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-300"
        title="Chance of assisting ≥1 (from last 5 H2H)"
      >
        👟 {pct(proj.assistProb)}
      </span>
      <span className="text-zinc-600">·</span>
      {proj.likelyScorelines.map((s, i) => (
        <span
          key={`${s.line}-${i}`}
          title={s.note ? `${s.note} · ${Math.round(s.pct)}%` : `${Math.round(s.pct)}%`}
          className={[
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono font-bold",
            i === 0
              ? "bg-zinc-100/10 text-zinc-100"
              : "text-zinc-400",
          ].join(" ")}
        >
          {s.line}
          <span className="font-sans text-[9px] font-medium text-zinc-500">
            {Math.round(s.pct)}%
          </span>
        </span>
      ))}
    </div>
  );
}

function MatchDetailBlock({ m }: { m: VsOpponentMeeting }) {
  const shotProxy = Math.round(m.threat);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={[
            "rounded-md border px-2 py-0.5 text-xs font-bold",
            resultTabClass(m),
          ].join(" ")}
        >
          {m.minutes <= 0 ? "DNP" : (m.result ?? "–")} {scoreLabel(m)}
        </span>
        <span className="text-zinc-300">{formatMatchDate(m.kickoffTime)}</span>
        <span className="text-xs text-zinc-500">
          {m.seasonLabel} · {m.wasHome ? "H" : "A"} · GW{m.round} ·{" "}
          {m.minutes <= 0 ? (
            <span className="font-semibold text-amber-300">Did not play</span>
          ) : (
            <>
              {m.minutes}&apos; ·{" "}
              <span className="font-semibold text-emerald-400">
                {m.points} pts
              </span>
            </>
          )}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          ⚽ {m.goals}
        </span>
        <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
          👟 {m.assists}
        </span>
        <span
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
          title="FPL Threat ≈ shot volume"
        >
          🎯 {shotProxy}
        </span>
        <span className="text-[11px] text-zinc-500">
          Creat {Math.round(m.creativity)} · Def {m.defensiveContribution} · CBI{" "}
          {m.clearancesBlocksInterceptions} · Tkl {m.tackles}
        </span>
      </div>
    </div>
  );
}

function OpponentBlock({ club }: { club: VsUpcomingClub }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2.5",
        club.nextIsCurrent || club.nextIsLive
          ? "border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20"
          : "border-zinc-800/80 bg-zinc-950/30",
      ].join(" ")}
    >
      {/* Row 1: name + odds + scorelines */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="shrink-0 text-sm font-semibold text-zinc-50">
          {club.nextIsHome ? "vs" : "@"} {club.opponentShort}
          <span className="ml-1.5 text-[11px] font-normal text-zinc-500">
            GW{club.nextEvent ?? "?"} · FDR {club.nextDifficulty}
          </span>
          {club.nextIsLive && (
            <span className="ml-1.5 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
              Live {club.nextMinutes ?? 0}&apos;
            </span>
          )}
          {!club.nextIsLive && club.nextIsCurrent && (
            <span className="ml-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
              Current
            </span>
          )}
          {club.nextTeamScore != null && club.nextOpponentScore != null && (
            <span className="ml-1.5 font-mono text-xs font-bold text-zinc-200">
              {club.nextTeamScore}–{club.nextOpponentScore}
            </span>
          )}
        </h3>
        {club.meetings.length > 0 && (
          <OutlookInline meetings={club.meetings} />
        )}
        {club.meetings.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
          >
            {open ? "Hide" : "Details"}{" "}
            <span
              className={["inline-block", open ? "rotate-180" : ""].join(" ")}
              aria-hidden
            >
              ▾
            </span>
          </button>
        )}
      </div>

      {club.meetings.length > 0 ? (
        <>
          {/* Row 2: compact result pills */}
          <div className="mt-1.5 flex flex-row flex-wrap items-center gap-1">
            {club.meetings.map((m) => (
              <span
                key={`${m.seasonLabel}-${m.round}-${m.kickoffTime}`}
                className={[
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                  resultTabClass(m),
                ].join(" ")}
                title={
                  m.minutes <= 0
                    ? "Did not play"
                    : `${formatMatchDate(m.kickoffTime)} · ${m.seasonLabel}`
                }
              >
                <span className="text-[9px] font-bold uppercase opacity-80">
                  {m.minutes <= 0 ? "DNP" : (m.result ?? "–")}
                </span>
                <span className="font-mono text-xs font-bold tabular-nums">
                  {scoreLabel(m)}
                </span>
                {m.minutes > 0 && (
                  <IconBadges goals={m.goals} assists={m.assists} />
                )}
              </span>
            ))}
          </div>

          {open && (
            <div className="mt-2 space-y-1.5 border-t border-zinc-800/80 pt-2">
              {club.meetings.map((m) => (
                <MatchDetailBlock
                  key={`${m.seasonLabel}-${m.round}-${m.kickoffTime}`}
                  m={m}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">No previous meetings.</p>
      )}
    </div>
  );
}

export function VsUpcomingSection({ clubs }: { clubs: VsUpcomingClub[] }) {
  if (clubs.length === 0) return null;

  return (
    <Card
      title="Vs upcoming clubs"
      subtitle="⚽ score % · 👟 assist % · likely scorelines · green win · yellow DNP"
    >
      <div className="space-y-2">
        {clubs.map((club) => (
          <OpponentBlock
            key={`${club.opponentId}-${club.nextEvent}`}
            club={club}
          />
        ))}
      </div>
    </Card>
  );
}
