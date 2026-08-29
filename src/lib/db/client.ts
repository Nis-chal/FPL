import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

/** Database name on your Atlas cluster. */
export const FPL_DB_NAME = "fpl_assistant";

let client: MongoClient | null = null;
let db: Db | null = null;

/** Bun <1.3.11 crashes in TLS checkServerIdentity when connecting to Atlas. */
function bunNeedsTlsWorkaround(): boolean {
  const bunVersion = process.versions.bun;
  if (!bunVersion) return false;

  const [major, minor, patch] = bunVersion.split(".").map(Number);
  if (major !== 1) return true;
  if (minor < 3) return true;
  if (minor === 3 && patch < 11) return true;
  return false;
}

function mongoClientOptions(): MongoClientOptions {
  const options: MongoClientOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
  };

  // Bun <1.3.11 passes an empty peer cert into checkServerIdentity and crashes with
  // "Cannot destructure property 'subject'…". No-op keeps rejectUnauthorized=true.
  if (bunNeedsTlsWorkaround()) {
    options.checkServerIdentity = () => undefined;
  }

  return options;
}

function enrichMongoError(err: unknown): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  if (!err.message.includes("destructure property 'subject'")) return err;

  return new Error(
    `${err.message}\n\nBun TLS bug when connecting to MongoDB Atlas. Upgrade Bun to 1.3.11+ (\`bun upgrade\`) or use Node for db:ping / db:sync.`,
  );
}

export function mongoUri(): string | null {
  const uri =
    process.env.MONGODB_URI?.trim() ||
    process.env.MONGO_URI?.trim() ||
    null;
  if (!uri || uri.includes("<db_password>")) return null;
  return uri;
}

export function isMongoConfigured(): boolean {
  return Boolean(mongoUri());
}

export async function getDb(): Promise<Db> {
  const uri = mongoUri();
  if (!uri) {
    throw new Error(
      "MONGODB_URI not set — add it to .env.local (replace <db_password> with your Atlas password).",
    );
  }

  if (db) return db;

  const pending = new MongoClient(uri, mongoClientOptions());
  try {
    await pending.connect();
    db = pending.db(FPL_DB_NAME);
    await ensureIndexes(db);
    client = pending;
    return db;
  } catch (err) {
    await pending.close().catch(() => undefined);
    throw enrichMongoError(err);
  }
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

async function ensureIndexes(database: Db): Promise<void> {
  await database.collection("player_histories").createIndex(
    { playerId: 1 },
    { unique: true },
  );
  await database.collection("player_histories").createIndex({ teamId: 1 });
  await database.collection("player_histories").createIndex({ minutes: -1 });
  await database.collection("backtest_runs").createIndex({ generatedAt: -1 });
  await database.collection("sync_meta").createIndex({ key: 1 }, { unique: true });
  await database.collection("api_cache").createIndex({ key: 1 }, { unique: true });
  await database.collection("api_cache").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.collection("ai_squad").createIndex({ key: 1 }, { unique: true });
}
