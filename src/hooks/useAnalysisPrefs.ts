"use client";

import { useCallback, useEffect, useState } from "react";
import { horizonForRankBy, parsePriceBounds, parseRankBy } from "@/lib/ranking";
import type { PriceBounds, RankBy } from "@/lib/types";

const RANK_KEY = "fpl-assistant-rankBy";
const MIN_PRICE_KEY = "fpl-assistant-minPrice";
const MAX_PRICE_KEY = "fpl-assistant-maxPrice";
const HORIZON_KEY = "fpl-assistant-horizon";

export function useAnalysisPrefs(defaults?: {
  rankBy?: RankBy;
  horizon?: number;
}) {
  const [rankBy, setRankByState] = useState<RankBy>(defaults?.rankBy ?? "xpts");
  const [horizon, setHorizonState] = useState(defaults?.horizon ?? 5);
  const [priceBounds, setPriceBoundsState] = useState<PriceBounds>({
    minPrice: null,
    maxPrice: null,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRankByState(
      parseRankBy(
        params.get("rankBy") ?? window.localStorage.getItem(RANK_KEY),
        defaults?.rankBy ?? "xpts",
      ),
    );
    const storedHorizon = Number(
      params.get("horizon") ?? window.localStorage.getItem(HORIZON_KEY),
    );
    if (Number.isFinite(storedHorizon) && storedHorizon >= 1 && storedHorizon <= 7) {
      setHorizonState(storedHorizon);
    } else if (defaults?.horizon) {
      setHorizonState(defaults.horizon);
    }
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
      rankBy?: RankBy;
      horizon?: number;
      priceBounds?: PriceBounds;
    }) => {
      const url = new URL(window.location.href);
      if (next.rankBy !== undefined) {
        url.searchParams.set("rankBy", next.rankBy);
        window.localStorage.setItem(RANK_KEY, next.rankBy);
      }
      if (next.horizon !== undefined) {
        url.searchParams.set("horizon", String(next.horizon));
        window.localStorage.setItem(HORIZON_KEY, String(next.horizon));
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
    (value: RankBy) => {
      setRankByState(value);
      const implied = horizonForRankBy(value);
      if (implied != null) {
        setHorizonState(implied);
        syncUrl({ rankBy: value, horizon: implied });
      } else {
        syncUrl({ rankBy: value });
      }
    },
    [syncUrl],
  );

  const setHorizon = useCallback(
    (value: number) => {
      setHorizonState(value);
      // Custom horizon → leave rankBy unless it was a horizon shortcut
      setRankByState((prev) => {
        if (prev === "next_game" && value !== 1) {
          syncUrl({ horizon: value, rankBy: "xpts" });
          return "xpts";
        }
        if (prev === "next_5" && value !== 5) {
          syncUrl({ horizon: value, rankBy: "xpts" });
          return "xpts";
        }
        syncUrl({ horizon: value });
        return prev;
      });
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

  return {
    ready,
    rankBy,
    setRankBy,
    horizon,
    setHorizon,
    priceBounds,
    setPriceBounds,
  };
}
