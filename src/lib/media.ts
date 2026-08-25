/** Player headshot from FPL photo filename (e.g. "123456.jpg"). */
export function playerPhotoUrl(photo: string, size: "110x140" | "250x250" = "110x140"): string {
  const code = photo.replace(/\.(jpg|png)$/i, "");
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`;
}

/** Club kit / shirt from FPL team code. */
export function clubKitUrl(teamCode: number): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.webp`;
}

export function clubKitUrlLarge(teamCode: number): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}.webp`;
}
