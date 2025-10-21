/* eslint-disable @typescript-eslint/no-explicit-any */
import { DurableObject } from 'cloudflare:workers'
import { LibSQLHttpServer } from './libsql-http-server'
import { Kysely } from 'kysely'
import { DODialect } from './kysely-do'
import { BetterAuthDatabase } from './types'
import { betterAuth } from 'better-auth'
import { admin, apiKey, createAuthMiddleware, openAPI } from 'better-auth/plugins'
export class AuthDO<DB = BetterAuthDatabase> extends DurableObject<any> {
  protected db: Kysely<BetterAuthDatabase>
  protected auth
  protected libsqlServer: LibSQLHttpServer

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env)
    this.db = new Kysely<BetterAuthDatabase>({
      dialect: new DODialect({ ctx }),
    })
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initBetterAuthTables()
    })

    this.auth = betterAuth({
      database: {
        db: this.db,
        type: 'sqlite',
      },
      basePath: '/api/auth',
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      advanced: {
        database: {
          generateId: () => crypto.randomUUID(),
        },
      },
      plugins: [
        admin(),
        apiKey({
          enableSessionForAPIKeys: true,
        }),
        openAPI(),
      ],
      hooks: {
        after: createAuthMiddleware(async (ctx) => {
          if (ctx.path.includes('/sign-up')) {
            const newSession = ctx.context.newSession
            if (newSession) {
              const apiKeyResponse = await this.auth.api.createApiKey({
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

              await this.db
                .insertInto('sandboxApiKey')
                .values({
                  id: crypto.randomUUID(),
                  userId: newSession.user.id,
                  apiKeyId: apiKeyResponse.id!,
                  apiKey: apiKeyResponse.key!,
                })
                .execute()
            }
          }
        }),
      },
    })

    this.libsqlServer = new LibSQLHttpServer(this.ctx.storage.sql)
  }

  getDB(): Kysely<BetterAuthDatabase & DB> {
    return this.db as unknown as Kysely<BetterAuthDatabase & DB>
  }

  private async initBetterAuthTables() {
    // Enable foreign keys
    this.ctx.storage.sql.exec('PRAGMA foreign_keys = ON')
    // Users table
    await this.db.schema
      .createTable('user')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('email', 'text', (col) => col.unique().notNull())
      .addColumn('emailVerified', 'integer', (col) => col.defaultTo(0))
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('image', 'text')
      .addColumn('createdAt', 'integer', (col) => col.notNull())
      .addColumn('updatedAt', 'integer', (col) => col.notNull())
      .addColumn('role', 'text', (col) => col.defaultTo('user'))
      .addColumn('banned', 'integer', (col) => col.defaultTo(0))
      .addColumn('banReason', 'text')
      .addColumn('banExpires', 'integer')
      .execute()

    await this.db.schema
      .createIndex('idxUserEmail')
      .ifNotExists()
      .on('user')
      .column('email')
      .execute()

    // Accounts table (for OAuth and credentials)
    await this.db.schema
      .createTable('account')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('userId', 'text', (col) => col.notNull())
      .addColumn('accountId', 'text', (col) => col.notNull())
      .addColumn('providerId', 'text', (col) => col.notNull())
      .addColumn('accessToken', 'text')
      .addColumn('refreshToken', 'text')
      .addColumn('idToken', 'text')
      .addColumn('expiresAt', 'integer')
      .addColumn('password', 'text')
      .addColumn('createdAt', 'integer', (col) => col.notNull())
      .addColumn('updatedAt', 'integer', (col) => col.notNull())
      .addForeignKeyConstraint('fkAccountUser', ['userId'], 'user', ['id'], (cb) =>
        cb.onDelete('cascade')
      )
      .execute()

    await this.db.schema
      .createIndex('idxAccountUser')
      .ifNotExists()
      .on('account')
      .column('userId')
      .execute()

    await this.db.schema
      .createIndex('idxAccountProvider')
      .ifNotExists()
      .on('account')
      .columns(['providerId', 'accountId'])
      .execute()

    // Sessions table
    await this.db.schema
      .createTable('session')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('userId', 'text', (col) => col.notNull())
      .addColumn('expiresAt', 'integer', (col) => col.notNull())
      .addColumn('token', 'text', (col) => col.unique().notNull())
      .addColumn('ipAddress', 'text')
      .addColumn('userAgent', 'text')
      .addColumn('createdAt', 'integer', (col) => col.notNull())
      .addColumn('updatedAt', 'integer', (col) => col.notNull())
      .addColumn('impersonatedBy', 'text')
      .addForeignKeyConstraint('fkSessionUser', ['userId'], 'user', ['id'], (cb) =>
        cb.onDelete('cascade')
      )
      .execute()

    await this.db.schema
      .createIndex('idxSessionUser')
      .ifNotExists()
      .on('session')
      .column('userId')
      .execute()

    await this.db.schema
      .createIndex('idxSessionToken')
      .ifNotExists()
      .on('session')
      .column('token')
      .execute()

    await this.db.schema
      .createIndex('idxSessionExpires')
      .ifNotExists()
      .on('session')
      .column('expiresAt')
      .execute()

    // Verification tokens table (for email verification, password reset)
    await this.db.schema
      .createTable('verification')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('identifier', 'text', (col) => col.notNull())
      .addColumn('value', 'text', (col) => col.notNull())
      .addColumn('expiresAt', 'integer', (col) => col.notNull())
      .addColumn('createdAt', 'integer', (col) => col.notNull())
      .addColumn('updatedAt', 'integer', (col) => col.notNull())
      .execute()

    await this.db.schema
      .createIndex('idxVerificationIdentifier')
      .ifNotExists()
      .on('verification')
      .column('identifier')
      .execute()

    await this.db.schema
      .createIndex('idxVerificationValue')
      .ifNotExists()
      .on('verification')
      .column('value')
      .execute()

    // API Keys table
    await this.db.schema
      .createTable('apiKey')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text')
      .addColumn('start', 'text')
      .addColumn('prefix', 'text')
      .addColumn('key', 'text', (col) => col.notNull())
      .addColumn('userId', 'text', (col) => col.notNull())
      .addColumn('refillInterval', 'integer')
      .addColumn('refillAmount', 'integer')
      .addColumn('lastRefillAt', 'integer')
      .addColumn('enabled', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('rateLimitEnabled', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('rateLimitTimeWindow', 'integer')
      .addColumn('rateLimitMax', 'integer')
      .addColumn('requestCount', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('remaining', 'integer')
      .addColumn('lastRequest', 'integer')
      .addColumn('expiresAt', 'integer')
      .addColumn('createdAt', 'integer', (col) => col.notNull())
      .addColumn('updatedAt', 'integer', (col) => col.notNull())
      .addColumn('permissions', 'text')
      .addColumn('metadata', 'text')
      .addForeignKeyConstraint('fkApikeyUser', ['userId'], 'user', ['id'], (cb) =>
        cb.onDelete('cascade')
      )
      .execute()

    await this.db.schema
      .createIndex('idxApikeyUser')
      .ifNotExists()
      .on('apiKey')
      .column('userId')
      .execute()

    await this.db.schema
      .createIndex('idxApikeyKey')
      .ifNotExists()
      .on('apiKey')
      .column('key')
      .execute()

    await this.db.schema
      .createIndex('idxApikeyExpires')
      .ifNotExists()
      .on('apiKey')
      .column('expiresAt')
      .execute()

    await this.db.schema
      .createIndex('idxApikeyEnabled')
      .ifNotExists()
      .on('apiKey')
      .column('enabled')
      .execute()

    // API Keys for sandboxes table
    await this.db.schema
      .createTable('sandboxApiKey')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('userId', 'text', (col) => col.notNull())
      .addColumn('apiKeyId', 'text', (col) => col.notNull())
      .addColumn('apiKey', 'text', (col) => col.notNull())
      .addForeignKeyConstraint('fkSandboxApikeyUser', ['userId'], 'user', ['id'], (cb) =>
        cb.onDelete('cascade')
      )
      .addForeignKeyConstraint('fkSandboxApikeyApikey', ['apiKeyId'], 'apiKey', ['id'], (cb) =>
        cb.onDelete('cascade')
      )
      .execute()
  }

  async getSandboxApiKey(userId: string) {
    const sandboxApiKey = await this.db
      .selectFrom('sandboxApiKey')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst()
    if (!sandboxApiKey) {
      return null
    }
    return sandboxApiKey
  }

  async getActiveSession(request: Request) {
    const session = await this.auth.api.getSession({ headers: request.headers })

    if (session) {
      const sandboxApiKey = await this.getSandboxApiKey(session.user.id)

      return { session, sandboxApiKey }
    }
    return null
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    console.log('fetch ==> ', request.url, path)
    if (this.isLibSQLRequest(path)) {
      const sqlPath = path.replace(/^\/sql/, '') || '/'
      const sqlUrl = new URL(request.url)
      sqlUrl.pathname = sqlPath

      return await this.libsqlServer.handleRequest(new Request(sqlUrl, request))
    }

    try {
      console.log('auth.handler ==> ', request.url)
      return await this.auth.handler(request)
    } catch (error) {
      console.error('Auth error:', error)
      return new Response(JSON.stringify({ error: 'Authentication error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  protected isLibSQLRequest(path: string): boolean {
    return path.startsWith('/sql/') || path === '/sql'
  }
}
