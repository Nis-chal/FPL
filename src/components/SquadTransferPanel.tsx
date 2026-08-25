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

  const [minPrice, setMinPrice] = useState(40); // £4.0m
  const [maxPrice, setMaxPrice] = useState(maxSpend);
  const [minPoints, setMinPoints] = useState(0);

  // Reset filters when transferring a different player
  useEffect(() => {
    setQuery("");
    setMinPrice(40);
    setMaxPrice(maxSpend);
    setMinPoints(0);
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

  const candidates = useMemo(() => {
    const list = listTransferIns(out, squad, pool, budget, 80, query);
    const lo = Math.min(minPrice, maxPrice);
    const hi = Math.max(minPrice, maxPrice);
    return list.filter(
      (p) =>
        p.price >= lo &&
        p.price <= hi &&
        p.projectedPoints >= minPoints,
    );
  }, [out, squad, pool, budget, query, minPrice, maxPrice, minPoints]);

  const priceCeil = Math.max(maxSpend, out.price, 50);

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
          <label className="block">
            <span className="sr-only">Search replacements</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${out.position}…`}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </label>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Price
              </span>
              <span className="text-xs text-zinc-400">
                {formatPrice(Math.min(minPrice, maxPrice))} –{" "}
                {formatPrice(Math.max(minPrice, maxPrice))}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-zinc-500">
                Min
                <input
                  type="range"
                  min={40}
                  max={priceCeil}
                  step={5}
                  value={Math.min(minPrice, priceCeil)}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-500"
                />
              </label>
              <label className="text-[10px] text-zinc-500">
                Max
                <input
                  type="range"
                  min={40}
                  max={priceCeil}
                  step={5}
                  value={Math.min(maxPrice, priceCeil)}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-500"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Min xPts
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {minPoints.toFixed(1)}+
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={0.5}
              value={minPoints}
              onChange={(e) => setMinPoints(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
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
              No {out.position} matches price / points filters
              {query ? " or search" : ""}.
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}
