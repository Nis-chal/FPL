#!/usr/bin/env bun
/**
 * Walk-forward backtest for xPts vs actual FPL points.
 *
 * Usage:
 *   bun run backtest
 *   bun run backtest -- --limit 120 --no-accumulated --json
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  formatBacktestReport,
  runBacktest,
  type BacktestReport,
} from "../src/lib/backtest.ts";

function parseArgs(argv: string[]) {
  let limit = 80;
  let includeAccumulated = true;
  let json = false;
  let delay = 120;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" || a === "-n") {
      limit = Number(argv[++i]) || limit;
    } else if (a === "--no-accumulated") {
      includeAccumulated = false;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--delay") {
      delay = Number(argv[++i]) || delay;
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: bun run backtest [-- options]

Options:
  --limit, -n <n>     Players to sample (default 80, sorted by minutes)
  --no-accumulated    Underlying-only projection (no form / EP blend)
  --delay <ms>        Pause between element-summary calls (default 120)
  --json              Write .cache/backtest-latest.json
  --help              Show this help
`);
      process.exit(0);
    }
  }

  return { limit, includeAccumulated, json, delay };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const report: BacktestReport = await runBacktest({
    playerLimit: opts.limit,
    includeAccumulated: opts.includeAccumulated,
    fetchDelayMs: opts.delay,
    onProgress: (msg) => console.log(msg),
  });

  console.log("\n" + formatBacktestReport(report));

  if (opts.json) {
    const dir = join(process.cwd(), ".cache");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "backtest-latest.json");
    writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote ${file}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
