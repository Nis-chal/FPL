"use client";

import { FormEvent, useState } from "react";
import { DEFAULT_TEAM_ID, useTeamId } from "@/hooks/useTeamId";

/** Compact team ID search — sits on the same row as Filters. */
export function TeamIdSearch() {
  const { teamId, setTeamId, clearTeamId, ready } = useTeamId();
  const [draft, setDraft] = useState("");

  if (!ready) return null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTeamId(draft || teamId);
  };

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        placeholder={teamId ? `Team ${teamId}` : DEFAULT_TEAM_ID}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="FPL team ID"
        className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Load
      </button>
      {teamId && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            clearTeamId();
          }}
          className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          Clear
        </button>
      )}
    </form>
  );
}
