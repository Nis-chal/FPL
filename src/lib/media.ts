/** Season token for cache-busting FPL CDN assets. */
export const MEDIA_SEASON = "2026-27";

function withSeason(url: string): string {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}s=${encodeURIComponent(MEDIA_SEASON)}`;
}

/**
 * Player headshot candidates (newest / highest-res first).
 * FPL `photo` is e.g. "223094.jpg" — Premier League hosts `p{code}.png`.
 */
export function playerPhotoCandidates(
  photo: string,
): string[] {
  const code = photo.replace(/\.(jpg|png)$/i, "").replace(/^p/i, "");
  if (!code) return [];
  const sizes = ["250x250", "110x140", "40x40"] as const;
  return sizes.map((size) =>
    withSeason(
      `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`,
    ),
  );
}

export function playerPhotoUrl(
  photo: string,
  size: "40x40" | "110x140" | "250x250" = "250x250",
): string {
  const code = photo.replace(/\.(jpg|png)$/i, "").replace(/^p/i, "");
  return withSeason(
    `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`,
  );
}

/** Current official club crest (SVG) — preferred over stale FPL shirt art. */
export function clubBadgeUrl(teamCode: number): string {
  return withSeason(
    `https://resources.premierleague.com/premierleague/badges/t${teamCode}.svg`,
  );
}

export function clubBadgePngUrl(teamCode: number, size: 70 | 100 = 70): string {
  return withSeason(
    `https://resources.premierleague.com/premierleague/badges/${size}/t${teamCode}.png`,
  );
}

/**
 * FPL jersey art. GKP uses `shirt_{code}_1`.
 * Note: early-season FPL CDN kits can lag real kit launches — badge is preferred for icons.
 */
export function clubKitUrl(
  teamCode: number,
  opts?: { goalkeeper?: boolean; size?: 66 | 110 | 220 },
): string {
  const size = opts?.size ?? 110;
  const gk = opts?.goalkeeper ? "_1" : "";
  return withSeason(
    `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${gk}-${size}.webp`,
  );
}

export function clubKitUrlLarge(
  teamCode: number,
  opts?: { goalkeeper?: boolean },
): string {
  return clubKitUrl(teamCode, { ...opts, size: 220 });
}

/** Ordered sources for a club mark: crest first, then jersey. */
export function clubMarkCandidates(
  teamCode: number,
  opts?: { goalkeeper?: boolean },
): string[] {
  if (!teamCode) return [];
  return [
    clubBadgeUrl(teamCode),
    clubBadgePngUrl(teamCode, 70),
    clubKitUrl(teamCode, { goalkeeper: opts?.goalkeeper, size: 110 }),
    clubKitUrl(teamCode, { goalkeeper: opts?.goalkeeper, size: 66 }),
  ];
}
