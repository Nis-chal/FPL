"use client";

import { FormEvent, useState } from "react";
import { useTeamId } from "@/hooks/useTeamId";

export function TeamIdForm({ compact = false }: { compact?: boolean }) {
  const { teamId, setTeamId, clearTeamId, ready } = useTeamId();
  const [draft, setDraft] = useState("");

  if (!ready) return null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTeamId(draft || teamId);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={[
        "rounded-xl border border-zinc-800 bg-zinc-900/70",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Your FPL Team ID (optional)
      </label>
      <p className="mt-1 text-xs text-zinc-500">
        Find it in the FPL URL: fantasy.premierleague.com/entry/<strong>XXXXXX</strong>/
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder={teamId || "e.g. 123456"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Save
        </button>
        {teamId && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              clearTeamId();
            }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Clear
          </button>
        )}
      </div>
      {teamId && (
        <p className="mt-2 text-xs text-emerald-400">
          Using team ID <span className="font-mono">{teamId}</span>
        </p>
      )}
    </form>
  );
}
