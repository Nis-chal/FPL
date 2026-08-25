"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fpl-assistant-team-id";

export function useTeamId() {
  const [teamId, setTeamIdState] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("teamId") || params.get("entry");
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    const initial = fromQuery || fromStorage || "";
    setTeamIdState(initial);
    setReady(true);
  }, []);

  const setTeamId = useCallback((value: string) => {
    const cleaned = value.replace(/\D/g, "");
    setTeamIdState(cleaned);
    if (cleaned) {
      window.localStorage.setItem(STORAGE_KEY, cleaned);
      const url = new URL(window.location.href);
      url.searchParams.set("teamId", cleaned);
      window.history.replaceState({}, "", url.toString());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("teamId");
      url.searchParams.delete("entry");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const clearTeamId = useCallback(() => setTeamId(""), [setTeamId]);

  return { teamId, setTeamId, clearTeamId, ready, numericId: Number(teamId) || null };
}
