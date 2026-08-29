# FPL Assistant

Unofficial Fantasy Premier League helper: expected points, fixtures, **AI Squad** manager mode, transfers, and optional MongoDB caching.

Built with **Next.js**, **TypeScript**, and the public [FPL API](https://fantasy.premierleague.com/api).

---

## Features

| Area | What it does |
|------|----------------|
| **Home** | Current GW, top picks, captain hint |
| **Players** | Ranked list with xPts, starts, shots (API-Football) |
| **Clubs** | Fixtures, form, squad lists |
| **AI Squad** | AI builds a £100m XI; you act as manager (transfers, swaps, captain) |
| **Transfers** | Suggestions for *your* FPL team (enter team ID) |
| **Backtest** | Measure projection accuracy vs actual GW points |

---

## Quick start

```bash
cd fpl-assistant
cp .env.example .env.local
# Edit .env.local — see Environment below

bun install   # or npm install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Recommended | Atlas connection string. Database name: **`fpl_assistant`** |
| `API_FOOTBALL_KEY` | Optional | [api-football.com](https://www.api-football.com/) — shots & match stats. Free plan: seasons ~2022–2024 |
| `FPL_API_BASE` | Optional | Proxy if `fantasy.premierleague.com` returns 403 |

**MongoDB URI example** (replace password):

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/fpl_assistant?retryWrites=true&w=majority&appName=Cluster0
```

Atlas setup:

1. **Database Access** — user with read/write on `fpl_assistant`
2. **Network Access** — allow your IP (or `0.0.0.0/0` for dev only)

---

## Squad pages

| Page | Route | What it shows |
|------|-------|----------------|
| **Points** | `/points` | Your FPL team (team ID) · this GW points · transfer tips |
| **AI** | `/ai` | Locked AI £100m squad (transfers/swaps OK; reset only via script) |

Reset AI Squad:

```bash
bun run ai:reset
```

Then refresh `/ai` — the model rebuilds and saves to MongoDB. There is no Reset button in the UI.
| **Squad** | `/squad` | Edit best £100m XI · Filters + team ID search |
| **Recommend** | `/recommend` | Best XI at top · chip timing, captain, transfers below |

Pitch header: **XI xPts** · **GW#** (current week squad pts) · **Season** total.

---

## MongoDB

Database: **`fpl_assistant`**

| Collection | Purpose |
|------------|---------|
| `api_cache` | FPL bootstrap, fixtures, element summaries, API-Football blobs (TTL) |
| `player_histories` | Per-player GW history — season accumulated points on Squad page |
| `backtest_runs` | Saved backtest reports |
| `sync_meta` | Last sync timestamp |

### Commands

```bash
# Test connection
bun run db:ping

# Sync FPL → MongoDB (bootstrap, fixtures, player histories)
bun run db:sync
bun run db:sync -- --limit 150 --delay 100

# Backtest (uses DB when populated; saves report to DB)
bun run backtest -- --limit 100 --json
```

Run **`db:sync`** after each gameweek (or daily during the season) so the app and backtests avoid redundant FPL calls.

### Caching layers

1. **In-memory** — hot path inside a running server  
2. **MongoDB** (`api_cache`) — survives restarts; shared across instances  
3. **Disk** (`.cache/api-football/`) — API-Football index fallback  

When `MONGODB_URI` is set, FPL bootstrap/fixtures/element-summary and API-Football progress are written to MongoDB automatically on fetch.

---

## Backtest (tune your model)

Compares **predicted xPts** vs **actual FPL points** per finished GW (walk-forward, no future leak).

```bash
bun run backtest
bun run backtest -- --limit 100 --no-accumulated --json
```

Outputs **MAE**, **bias**, breakdown by position/GW, and writes `.cache/backtest-latest.json` with `--json`.

Tune weights in `src/lib/probabilities.ts`, re-run, and compare MAE.

---

## Project structure

```
src/
  app/              Next.js pages & API routes
  components/       UI (AiSquadClient, PlayerTable, PitchView, …)
  lib/
    probabilities.ts   xPts / fixture model (main tuning surface)
    scoring.ts         Player scoring pipeline
    squad.ts           Squad builder
    transfers.ts       Transfer suggestions
    backtest.ts        Projection backtest
    fpl-client.ts      FPL API + retries + Mongo cache
    api-football.ts    Optional shots / stats
    db/                MongoDB client, sync, api_cache
scripts/
  backtest.mts       CLI backtest
  sync-db.mts        CLI FPL → MongoDB sync
  db-ping.mts        Connection check
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Development server |
| `bun run build` | Production build |
| `bun run backtest` | Run projection backtest |
| `bun run db:ping` | Verify MongoDB |
| `bun run db:sync` | Sync FPL data to Atlas |

---

## Notes

- **Not affiliated** with the Premier League or FPL.
- FPL sometimes returns **503** (“game is updating”) — team/entry endpoints fail until maintenance ends; cached data may still work.
- API-Football free tier is **rate-limited** (~100 req/day); first shots load can be slow, then cached.
- **MongoDB + Bun:** use Bun **1.3.11+** (`bun upgrade`) for Atlas TLS. Older Bun versions are patched automatically in `src/lib/db/client.ts`.
- If `db:ping` times out, check Atlas **Network Access** (your IP must be allowed).

---

## License

Private / personal project.
