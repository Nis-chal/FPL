export {
  closeDb,
  FPL_DB_NAME,
  getDb,
  isMongoConfigured,
  mongoUri,
} from "@/lib/db/client";
export {
  getStoredApi,
  setStoredApi,
  withStoredApi,
} from "@/lib/db/api-cache";
export { withPersistentCache } from "@/lib/db/persistent-cache";
export {
  countPlayerHistories,
  getPlayerHistories,
  getPlayerHistory,
  listTopPlayerIdsByMinutes,
  upsertPlayerHistory,
  type PlayerHistoryDoc,
} from "@/lib/db/player-history";
export {
  getLatestBacktestRun,
  listBacktestRuns,
  saveBacktestRun,
  type BacktestRunDoc,
} from "@/lib/db/backtest-runs";
export { getSyncMeta, setSyncMeta } from "@/lib/db/sync-meta";
export { enrichScoredWithSeasonPoints, type SeasonPointsEnrichment } from "@/lib/db/season-points";
export {
  AI_SQUAD_KEY,
  clearAiSquadSnapshot,
  getAiSquadSnapshot,
  saveAiSquadSnapshot,
  type AiSquadSnapshot,
} from "@/lib/db/ai-squad";
export { syncFplToMongo, type SyncFplOptions } from "@/lib/db/sync-fpl";
