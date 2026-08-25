"use client";

import { useCallback, useEffect, useState } from "react";
import type { SeasonBasis } from "@/lib/season-basis";

const STORAGE_KEY = "fpl-assistant-seasonBasis";
const ACCUM_KEY = "fpl-assistant-accumulated";

export function useSeasonBasis(defaultValue: SeasonBasis = "current") {
  const [seasonBasis, setBasis] = useState<SeasonBasis>(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("season") ?? params.get("accumulated");
    const fromStorage =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(ACCUM_KEY);

    if (fromQuery === "prior" || fromQuery === "1" || fromQuery === "true") {
      setBasis("prior");
    } else if (
      fromQuery === "current" ||
      fromQuery === "0" ||
      fromQuery === "false"
    ) {
      setBasis("current");
    } else if (fromStorage === "prior" || fromStorage === "1") {
      setBasis("prior");
    } else if (fromStorage === "current" || fromStorage === "0") {
      setBasis("current");
    }
    setReady(true);
  }, []);

  const setSeasonBasis = useCallback((value: SeasonBasis) => {
    setBasis(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    // Keep legacy key in sync for API routes that still read accumulated
    window.localStorage.setItem(ACCUM_KEY, value === "prior" ? "1" : "0");
    const url = new URL(window.location.href);
    url.searchParams.set("season", value);
    url.searchParams.set("accumulated", value === "prior" ? "1" : "0");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const includeAccumulated = seasonBasis === "prior";

  return {
    seasonBasis,
    setSeasonBasis,
    includeAccumulated,
    setIncludeAccumulated: (v: boolean) =>
      setSeasonBasis(v ? "prior" : "current"),
    ready,
  };
}

/** @deprecated Prefer useSeasonBasis */
export function useAccumulatedPoints(defaultValue = true) {
  return useSeasonBasis(defaultValue ? "prior" : "current");
}
