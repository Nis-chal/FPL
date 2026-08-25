# FPL Assistant

Next.js decision helper for Fantasy Premier League. League-wide insights by default; optionally enter your FPL team ID for personal transfer and squad advice.

## Features

- **Home** — current/next GW, captain pick, top projected scorers (threat + win %)
- **Clubs** — next 7 fixtures + recent results; club squad ranked by projection
- **Players** — search/filter; player detail with GW history, threat, and win chance
- **Transfers** — 3–7 fixture horizon filter; inbound targets + personal out→in swaps using form, **attacking threat**, and **next-game win chance** (not past points alone); **team rating** with your ID
- **Squad** — model £100.0m best XV for the chosen horizon; rate your team (form / fixtures / threat / win chance / availability)

Suggestions maximise **expected points (xPts)**. Toggle **accumulated points** on Home, Players, Transfers, and Squad:

- **On** — blend recent form / FPL expected points into rankings
- **Off** — underlying model only (minutes, xG/xA, fixtures, CS)

`xPts ≈ P(start) × (appearance + goals/assists from xG·xA/90 + clean sheets − conceded + bonus)`

## Data source

Unofficial public Fantasy Premier League API (`fantasy.premierleague.com/api/...`), fetched server-side with caching. Not affiliated with the Premier League or FPL.

## Run locally

```bash
cd fpl-assistant
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## FPL team ID

1. Open your team on the FPL site.
2. Copy the number from the URL: `fantasy.premierleague.com/entry/XXXXXX/`
3. Paste it in the Team ID form (saved in `localStorage` and `?teamId=`).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
# FPL
