"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { PlayerPhoto } from "@/components/PlayerMedia";
import {
  listTransferIns,
  transferSpendLimit,
} from "@/lib/transfers";
import type { ScoredPlayer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

const XPTS_PRESETS = [
  { id: "any", label: "Any", min: 0 },
  { id: "8", label: "8+", min: 8 },
  { id: "12", label: "12+", min: 12 },
  { id: "16", label: "16+", min: 16 },
  { id: "20", label: "20+", min: 20 },
  { id: "25", label: "25+", min: 25 },
] as const;

type XptsId = (typeof XPTS_PRESETS)[number]["id"];

/** FPL prices in tenths of £m, every £0.5m from £4.0m up to bank. */
function maxPriceSteps(maxSpend: number): number[] {
  const cap = Math.max(40, maxSpend);
  const steps: number[] = [];
  for (let p = 40; p <= cap; p += 5) steps.push(p);
  const last = steps[steps.length - 1];
  if (last !== cap) steps.push(cap);
  return steps;
}

function OptionChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string; disabled?: boolean }>;
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              disabled={opt.disabled}
              onClick={() => onChange(opt.id)}
              className={[
                "rounded-lg border px-2.5 py-1 text-sm font-medium transition",
                opt.disabled
                  ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-600"
                  : active
                    ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                    : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-100",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SquadTransferDrawer({
  out,
  squad,
  pool,
  budget,
  onTransferIn,
  onClose,
}: {
  out: ScoredPlayer;
  squad: ScoredPlayer[];
  pool: ScoredPlayer[];
  budget: number;
  onTransferIn: (player: ScoredPlayer) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const maxSpend = transferSpendLimit(squad, budget, out);

  const [priceMax, setPriceMax] = useState<number | "ALL">("ALL");
  const [xptsPreset, setXptsPreset] = useState<XptsId>("any");
  const [clubId, setClubId] = useState<number | "ALL">("ALL");

  const clubs = useMemo(() => {
    const map = new Map<
      number,
      { id: number; name: string; short: string; full: boolean }
    >();
    for (const p of pool) {
      if (map.has(p.teamId)) continue;
      const held = squad.filter(
        (s) => s.teamId === p.teamId && s.id !== out.id,
      ).length;
      map.set(p.teamId, {
        id: p.teamId,
        name: p.teamName,
        short: p.teamShort,
        full: held >= 3,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pool, squad, out.id]);

  useEffect(() => {
    setQuery("");
    setPriceMax("ALL");
    setXptsPreset("any");
    setClubId("ALL");
  }, [out.id, maxSpend]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const priceSteps = useMemo(() => maxPriceSteps(maxSpend), [maxSpend]);

  const candidates = useMemo(() => {
    const list = listTransferIns(out, squad, pool, budget, 250, query);
    const minPts = XPTS_PRESETS.find((p) => p.id === xptsPreset)?.min ?? 0;
    return list.filter((p) => {
      if (clubId !== "ALL" && p.teamId !== clubId) return false;
      if (priceMax !== "ALL" && p.price > priceMax) return false;
      if (p.projectedPoints < minPts) return false;
      return true;
    });
  }, [out, squad, pool, budget, query, priceMax, xptsPreset, clubId]);

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <button
        type="button"
        aria-label="Close transfer drawer"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Transfer out
            </p>
            <h2 id={titleId} className="truncate text-lg font-bold text-zinc-50">
              {out.webName}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {out.position} · {formatPrice(out.price)} · bank up to{" "}
              <span className="font-semibold text-emerald-400">
                {formatPrice(maxSpend)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-zinc-800 px-4 py-3">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search replacements</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${out.position}…`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="w-40 shrink-0">
              <span className="sr-only">Club</span>
              <select
                value={clubId === "ALL" ? "ALL" : String(clubId)}
                onChange={(e) =>
                  setClubId(
                    e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                  )
                }
                className="h-full w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All clubs</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.full}>
                    {c.name}
                    {c.full ? " (3/3)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Max price
            </span>
            <select
              value={priceMax === "ALL" ? "ALL" : String(priceMax)}
              onChange={(e) =>
                setPriceMax(
                  e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">Any (up to {formatPrice(maxSpend)})</option>
              {priceSteps.map((p) => (
                <option key={p} value={p}>
                  {formatPrice(p)} or less
                </option>
              ))}
            </select>
          </label>

          <OptionChips
            label="Min xPts"
            value={xptsPreset}
            options={XPTS_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            onChange={setXptsPreset}
          />
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {candidates.map((p) => {
            const delta = p.projectedPoints - out.projectedPoints;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onTransferIn(p)}
                  className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                >
                  <PlayerPhoto
                    photo={p.photo}
                    alt={p.webName}
                    className="h-9 w-7 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-zinc-100">
                        {p.webName}
                      </span>
                      <AvailabilityBadge
                        status={p.status}
                        chanceOfPlaying={p.chanceOfPlaying}
                        news={p.news}
                        compact
                      />
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {p.teamShort} · {formatPrice(p.price)} ·{" "}
                      {Math.round(p.startChance * 100)}% start
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-emerald-300">
                      {p.projectedPoints.toFixed(1)}
                    </div>
                    <div
                      className={[
                        "text-[11px] font-medium",
                        delta >= 0 ? "text-emerald-400" : "text-rose-400",
                      ].join(" ")}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)} xPts
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {candidates.length === 0 && (
            <li className="px-2 py-8 text-center text-sm text-zinc-500">
              No {out.position} matches price / club / points filters
              {query ? " or search" : ""}.
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}
