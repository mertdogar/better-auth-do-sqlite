/* eslint-disable @typescript-eslint/no-explicit-any */
import { betterAuth } from 'better-auth'
import { apiKey, createAuthMiddleware, admin } from 'better-auth/plugins'
import { durableObjectSQLiteAdapter } from './do-sqlite-adapter'

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
      updated_at INTEGER NOT NULL,
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      ban_expires INTEGER
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
      impersonated_by TEXT,
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

    -- API Keys table
    CREATE TABLE IF NOT EXISTS apiKey (
      id TEXT PRIMARY KEY,
      name TEXT,
      start TEXT,
      prefix TEXT,
      key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      refill_interval INTEGER,
      refill_amount INTEGER,
      last_refill_at INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      rate_limit_enabled INTEGER NOT NULL DEFAULT 0,
      rate_limit_time_window INTEGER,
      rate_limit_max INTEGER,
      request_count INTEGER NOT NULL DEFAULT 0,
      remaining INTEGER,
      last_request INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      permissions TEXT,
      metadata TEXT,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_apikey_user ON apiKey(user_id);
    CREATE INDEX IF NOT EXISTS idx_apikey_key ON apiKey(key);
    CREATE INDEX IF NOT EXISTS idx_apikey_expires ON apiKey(expires_at);
    CREATE INDEX IF NOT EXISTS idx_apikey_enabled ON apiKey(enabled);


    -- API Keys for sandboxes table
    CREATE TABLE IF NOT EXISTS sandboxApiKey (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      api_key TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (api_key_id) REFERENCES apiKey(id) ON DELETE CASCADE
    );
  `)
}

export const dummyBetterAuth = betterAuth({
  database: durableObjectSQLiteAdapter({} as any, {
    debugLogs: true, // Set to true for debugging
    usePlural: true,
  }),
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
  plugins: [
    admin(),
    apiKey({
      enableSessionForAPIKeys: true,
    }),
  ],
})

/**
 * Create BetterAuth instance with Durable Object SQLite adapter
 * Note: This function should be called with the SQL instance from the Durable Object
 *
 * @param sql - The Durable Object SQL storage instance
 * @returns Configured BetterAuth instance
 */
export function createAuth(sql: any) {
  const auth = betterAuth({
    database: durableObjectSQLiteAdapter(sql, {
      debugLogs: false, // Set to false for debugging
      usePlural: false,
    }),
    basePath: '/api/auth',
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
    plugins: [
      admin(),
      apiKey({
        enableSessionForAPIKeys: true,
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path.includes('/sign-up')) {
          const newSession = ctx.context.newSession
          if (newSession) {
            const apiKeyResponse = await auth.api.createApiKey({
              body: {
                name: 'default',
                userId: newSession.user.id, // server-only
                rateLimitEnabled: false,
                rateLimitTimeWindow: 1000000000,
              },
            })

            if (!apiKeyResponse) {
              console.error('Failed to create API key:', apiKeyResponse)
              return
            }

            await sql.exec(
              `INSERT INTO sandboxApiKey (id, user_id, api_key_id, api_key)
               VALUES (?, ?, ?, ?)`,
              crypto.randomUUID(),
              newSession.user.id,
              apiKeyResponse.id,
              apiKeyResponse.key
            )
          }
        }
      }),
    },
  })
  return auth
}

export type Auth = typeof dummyBetterAuth
