"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerDrawer } from "@/components/PlayerDrawer";

/** Deep links `/players/[id]` open the drawer on the players list instead. */
export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { openPlayer } = usePlayerDrawer();

  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (cancelled) return;
      const playerId = Number(id);
      if (Number.isFinite(playerId)) openPlayer(playerId);
      router.replace("/players");
    });
    return () => {
      cancelled = true;
    };
  }, [params, openPlayer, router]);

  return (
    <p className="text-sm text-zinc-400">Opening player detail…</p>
  );
}
