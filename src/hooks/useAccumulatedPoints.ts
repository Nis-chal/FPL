"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fpl-assistant-accumulated";

export function useAccumulatedPoints(defaultValue = true) {
  const [includeAccumulated, setInclude] = useState(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("accumulated");
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromQuery === "0" || fromQuery === "false") setInclude(false);
    else if (fromQuery === "1" || fromQuery === "true") setInclude(true);
    else if (fromStorage === "0") setInclude(false);
    else if (fromStorage === "1") setInclude(true);
    setReady(true);
  }, []);

  const setIncludeAccumulated = useCallback((value: boolean) => {
    setInclude(value);
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    const url = new URL(window.location.href);
    url.searchParams.set("accumulated", value ? "1" : "0");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return { includeAccumulated, setIncludeAccumulated, ready };
}
