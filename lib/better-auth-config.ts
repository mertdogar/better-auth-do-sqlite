import { betterAuth } from "better-auth";
import { durableObjectSQLiteAdapter } from "./do-sqlite-adapter";

/**
 * Initialize BetterAuth tables in the Durable Object
 */
export function initBetterAuthTables(sql: any) {
  sql.exec(`
    PRAGMA foreign_keys = ON;

    -- Users table
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      email_verified INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);

    -- Accounts table (for OAuth and credentials)
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      expires_at INTEGER,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_account_user ON account(user_id);
    CREATE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id, account_id);

    -- Sessions table
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_session_expires ON session(expires_at);

    -- Verification tokens table (for email verification, password reset)
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
    CREATE INDEX IF NOT EXISTS idx_verification_value ON verification(value);
  `);
}

/**
 * Create BetterAuth instance with Durable Object SQLite adapter
 * Note: This function should be called with the SQL instance from the Durable Object
 *
 * @param sql - The Durable Object SQL storage instance
 * @param baseURL - The base URL for the authentication service
 * @returns Configured BetterAuth instance
 */
export function createAuth(sql: any, baseURL: string) {
  return betterAuth({
    database: durableObjectSQLiteAdapter(sql, {
      debugLogs: false, // Set to true for debugging
      usePlural: false,
    }),
    baseURL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    advanced: {
      generateId: () => crypto.randomUUID(),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

