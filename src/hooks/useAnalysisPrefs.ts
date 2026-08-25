"use client";

import { useCallback, useEffect, useState } from "react";
import {
  horizonForRankBy,
  normalizeRankBy,
  parsePriceBounds,
  parseRankByList,
  serializeRankBy,
  toggleRankBy,
} from "@/lib/ranking";
import type { PriceBounds, RankBy } from "@/lib/types";
import { BUDGET, clampBudget, parseBudget } from "@/lib/utils";

const RANK_KEY = "fpl-assistant-rankBy";
const MIN_PRICE_KEY = "fpl-assistant-minPrice";
const MAX_PRICE_KEY = "fpl-assistant-maxPrice";
const HORIZON_KEY = "fpl-assistant-horizon";
const BUDGET_KEY = "fpl-assistant-budget";

export function useAnalysisPrefs(defaults?: {
  rankBy?: RankBy[];
  horizon?: number;
  budget?: number;
}) {
  const [rankBy, setRankByState] = useState<RankBy[]>(
    defaults?.rankBy ?? ["overall"],
  );
  const [horizon, setHorizonState] = useState(defaults?.horizon ?? 5);
  const [budget, setBudgetState] = useState(defaults?.budget ?? BUDGET);
  const [priceBounds, setPriceBoundsState] = useState<PriceBounds>({
    minPrice: null,
    maxPrice: null,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextRank = parseRankByList(
      params.get("rankBy") ?? window.localStorage.getItem(RANK_KEY),
      defaults?.rankBy ?? ["overall"],
    );
    setRankByState(nextRank);

    const implied = horizonForRankBy(nextRank);
    const storedHorizon = Number(
      params.get("horizon") ?? window.localStorage.getItem(HORIZON_KEY),
    );
    if (implied != null) {
      setHorizonState(implied);
    } else if (
      Number.isFinite(storedHorizon) &&
      storedHorizon >= 1 &&
      storedHorizon <= 7
    ) {
      setHorizonState(storedHorizon);
    } else if (defaults?.horizon) {
      setHorizonState(defaults.horizon);
    }

    setBudgetState(
      parseBudget(
        params.get("budget") ?? window.localStorage.getItem(BUDGET_KEY),
        defaults?.budget ?? BUDGET,
      ),
    );

    setPriceBoundsState(
      parsePriceBounds(
        params.get("minPrice") ?? window.localStorage.getItem(MIN_PRICE_KEY),
        params.get("maxPrice") ?? window.localStorage.getItem(MAX_PRICE_KEY),
      ),
    );
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncUrl = useCallback(
    (next: {
      rankBy?: RankBy[];
      horizon?: number;
      priceBounds?: PriceBounds;
      budget?: number;
    }) => {
      const url = new URL(window.location.href);
      if (next.rankBy !== undefined) {
        const serialized = serializeRankBy(next.rankBy);
        url.searchParams.set("rankBy", serialized);
        window.localStorage.setItem(RANK_KEY, serialized);
      }
      if (next.horizon !== undefined) {
        url.searchParams.set("horizon", String(next.horizon));
        window.localStorage.setItem(HORIZON_KEY, String(next.horizon));
      }
      if (next.budget !== undefined) {
        const b = clampBudget(next.budget);
        url.searchParams.set("budget", String(b));
        window.localStorage.setItem(BUDGET_KEY, String(b));
      }
      if (next.priceBounds !== undefined) {
        const { minPrice, maxPrice } = next.priceBounds;
        if (minPrice != null) {
          url.searchParams.set("minPrice", String(minPrice));
          window.localStorage.setItem(MIN_PRICE_KEY, String(minPrice));
        } else {
          url.searchParams.delete("minPrice");
          window.localStorage.removeItem(MIN_PRICE_KEY);
        }
        if (maxPrice != null) {
          url.searchParams.set("maxPrice", String(maxPrice));
          window.localStorage.setItem(MAX_PRICE_KEY, String(maxPrice));
        } else {
          url.searchParams.delete("maxPrice");
          window.localStorage.removeItem(MAX_PRICE_KEY);
        }
      }
      window.history.replaceState({}, "", url.toString());
    },
    [],
  );

  const setRankBy = useCallback(
    (value: RankBy | RankBy[]) => {
      const next = normalizeRankBy(value);
      setRankByState(next);
      const implied = horizonForRankBy(next);
      if (implied != null) {
        setHorizonState(implied);
        syncUrl({ rankBy: next, horizon: implied });
      } else {
        syncUrl({ rankBy: next });
      }
    },
    [syncUrl],
  );

  const toggleRank = useCallback(
    (mode: RankBy) => {
      setRankByState((prev) => {
        const next = toggleRankBy(prev, mode);
        const implied = horizonForRankBy(next);
        if (implied != null) {
          setHorizonState(implied);
          syncUrl({ rankBy: next, horizon: implied });
        } else {
          syncUrl({ rankBy: next });
        }
        return next;
      });
    },
    [syncUrl],
  );

  const setHorizon = useCallback(
    (value: number) => {
      setHorizonState(value);
      setRankByState((prev) => {
        let next = [...prev];
        if (value !== 1) next = next.filter((r) => r !== "next_game");
        if (value !== 5) next = next.filter((r) => r !== "next_5");
        if (next.length === 0) next = ["overall"];
        syncUrl({ horizon: value, rankBy: next });
        return next;
      });
    },
    [syncUrl],
  );

  const setBudget = useCallback(
    (value: number) => {
      const next = clampBudget(value);
      setBudgetState(next);
      syncUrl({ budget: next });
    },
    [syncUrl],
  );

  const setPriceBounds = useCallback(
    (bounds: PriceBounds) => {
      setPriceBoundsState(bounds);
      syncUrl({ priceBounds: bounds });
    },
    [syncUrl],
  );

  const resetFilters = useCallback(() => {
    const defaultBudget = defaults?.budget ?? BUDGET;
    setRankByState(["overall"]);
    setHorizonState(defaults?.horizon ?? 5);
    setBudgetState(defaultBudget);
    setPriceBoundsState({ minPrice: null, maxPrice: null });
    syncUrl({
      rankBy: ["overall"],
      horizon: defaults?.horizon ?? 5,
      budget: defaultBudget,
      priceBounds: { minPrice: null, maxPrice: null },
    });
  }, [defaults?.horizon, defaults?.budget, syncUrl]);

  return {
    ready,
    rankBy,
    setRankBy,
    toggleRank,
    horizon,
    setHorizon,
    budget,
    setBudget,
    priceBounds,
    setPriceBounds,
    resetFilters,
  };
}
