<div align="center">

# Better Auth - Durable Object SQLite

A complete authentication and database solution for Cloudflare Durable Objects with SQLite storage.

[![npm version](https://img.shields.io/npm/v/better-auth-do-sqlite.svg)](https://www.npmjs.com/package/better-auth-do-sqlite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Examples](#examples)

</div>

---

## Overview

`better-auth-do-sqlite` is a comprehensive adapter and toolkit for building authenticated applications on Cloudflare Durable Objects. It combines [Better Auth](https://better-auth.com) with native SQLite storage and adds a complete libSQL HTTP protocol server for direct database access.

### What's Included

- 🔐 **Better Auth Adapter** - Full Better Auth integration with automatic schema management
- 🎯 **Base Auth Class** - Extend `AuthDO` for instant authentication capabilities
- 🔌 **libSQL HTTP Server** - Query your SQLite database via standard HTTP protocol (v1, v2, v3)
- 🛡️ **Type-Safe** - Full TypeScript support with comprehensive type definitions
- ⚡ **Production Ready** - Optimized for Cloudflare's global edge network

---

## Features

### Authentication (Better Auth)

- ✅ **Full Better Auth Support** - All adapter methods implemented
- ✅ **Email & Password Auth** - Built-in credential authentication
- ✅ **Session Management** - Secure session handling with configurable expiration
- ✅ **Auto Schema Init** - Automatic table creation with proper indexes
- ✅ **Data Transformation** - Automatic JS ↔ SQLite type conversion
- ✅ **Debug Logging** - Optional detailed logs for troubleshooting
- ✅ **RPC Methods** - Direct method calls for user management

### libSQL HTTP Protocol Server

- ✅ **V1 API** - Simple batch query execution with parameter binding
- ✅ **V2 API** - Stateful streams with Hrana over HTTP protocol
- ✅ **V3 API** - Enhanced Hrana with metadata and autocommit detection
- ✅ **Direct SQLite Access** - Query your database via HTTP
- ✅ **Standard Protocol** - Full compatibility with official `@libsql/client`
- ✅ **Multiple Request Types** - Execute, batch, sequence, describe, get_autocommit
- ✅ **SQL Statement Caching** - Store and reuse frequently used queries
- ✅ **Conditional Execution** - Execute queries based on previous results

### Developer Experience

- 🎯 **Simple Inheritance Pattern** - Extend AuthDO to add your custom functionality
- 📚 **Comprehensive Docs** - Detailed guides and examples
- 🧪 **Test Suite** - Complete testing framework included
- 🔧 **Easy Integration** - Works with Hono, vanilla fetch handlers, and more

---

## Installation

```bash
npm install better-auth-do-sqlite better-auth
# or
pnpm add better-auth-do-sqlite better-auth
# or
bun add better-auth-do-sqlite better-auth
```

---

## Quick Start

### Step 1: Create Your Auth Durable Object

Extend the `AuthDO` base class to add authentication to your Durable Object:

```typescript
import { DurableObject } from 'cloudflare:workers'
import { createAuth, initBetterAuthTables, type Auth } from 'better-auth-do-sqlite'

export class MyAuthDO extends DurableObject {
  protected sql = this.ctx.storage.sql
  protected auth: Auth | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Initialize Better Auth database tables
    initBetterAuthTables(this.sql)
  }

  /**
   * Get or create the Better Auth instance
   */
  getAuth(): Auth {
    if (!this.auth) {
      this.auth = createAuth(this.sql)
    }
    return this.auth
  }

  /**
   * Handle incoming HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const auth = this.getAuth()

    try {
      return await auth.handler(request)
    } catch (error) {
      console.error('Auth error:', error)
      return new Response(JSON.stringify({ error: 'Authentication error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
```

### Step 2: Extend for Custom Functionality

Add your own application logic by extending the Auth DO:

```typescript
import { MyAuthDO } from './auth-do'

export class MyAppDO extends MyAuthDO {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // Initialize your custom tables
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      )
    `)
  }

  // Add custom RPC methods
  async createTodo(userId: string, title: string) {
    const id = crypto.randomUUID()
    const now = Date.now()

    this.sql.exec(
      `INSERT INTO todos (id, user_id, title, created_at)
       VALUES (?, ?, ?, ?)`,
      id,
      userId,
      title,
      now
    )

    return { id, userId, title, completed: false, createdAt: now }
  }

  async listTodos(userId: string) {
    return this.sql.exec(`SELECT * FROM todos WHERE user_id = ?`, userId).toArray()
  }
}
```

### Step 3: Set Up Routing in Your Worker

Use the provided routers to handle authentication and SQL requests:

```typescript
import { Hono } from 'hono'
import { betterAuthRouter, sqlServerRouter, authMiddleware } from 'better-auth-do-sqlite'

const app = new Hono<{ Bindings: Env }>()

// Optional: Add auth middleware to protect routes
app.use('*', authMiddleware('APP_DO'))

// Mount Better Auth routes
app.route('/api/auth', betterAuthRouter('APP_DO'))

// Optional: Mount libSQL HTTP server routes
app.route('/api/sql', sqlServerRouter('APP_DO', /^\/api\/sql/))

// Your custom routes
app.get('/api/todos', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.env.APP_DO.idFromName('global')
  const stub = c.env.APP_DO.get(id)
  const todos = await stub.listTodos(user.id)

  return c.json({ todos })
})

export default app
```

### Step 4: Configure Wrangler

Add the Durable Object binding to your `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "APP_DO"
class_name = "MyAppDO"
script_name = "your-worker-name"
```

### Frontend Client

Use Better Auth's official client directly in your frontend:

```typescript
import { createAuthClient } from 'better-auth/client'

const authClient = createAuthClient({
  baseURL: 'http://localhost:8787', // Your worker URL
})

// Sign up
await authClient.signUp.email({
  email: 'user@example.com',
  password: 'securePassword123',
  name: 'John Doe',
})

// Sign in
await authClient.signIn.email({
  email: 'user@example.com',
  password: 'securePassword123',
})

// Get session
const session = await authClient.getSession()
```

**Or integrate it into your API client:**

```typescript
import { createAuthClient } from 'better-auth/client'
import { apiKeyClient, adminClient } from 'better-auth/client/plugins'

const authClient = createAuthClient({
  baseURL: 'http://localhost:8787',
  plugins: [apiKeyClient(), adminClient()],
})

export class APIClient {
  public authClient: typeof authClient

  constructor(baseURL: string = 'http://localhost:8787') {
    this.authClient = authClient
  }

  get auth() {
    return this.authClient
  }
}

// Usage
const api = new APIClient()

// Sign up
await api.auth.signUp.email({
  email: 'user@example.com',
  password: 'securePassword123',
  name: 'John Doe',
})

// Get session
const session = await api.auth.getSession()
```

---

## Documentation

Better Auth handles all authentication endpoints automatically. Use the [Better Auth client](https://www.better-auth.com) in your frontend to interact with these endpoints. See the [Frontend Client](#frontend-client) section above for examples.

For a complete list of available endpoints and features, refer to the [Better Auth API documentation](https://www.better-auth.com/docs/api-reference).

### Built-in RPC Methods

The base AuthDO class can be extended to include these authentication RPC methods:

```typescript
// Sign up a new user
await stub.signUp(email: string, name: string, password: string)

// Sign in
await stub.signIn(email: string, password: string)

// Get authenticated user by token
await stub.getAuthenticatedUser(token: string)

// Request password reset
await stub.requestPasswordReset(email: string)

// Reset password using token
await stub.resetPassword(resetToken: string, newPassword: string)

// Sign out
await stub.signOut(token: string)

// Get user by ID
await stub.getUserById(userId: string)

// List all users with pagination
await stub.listUsers(limit?: number, offset?: number)
```

### Using RPC from Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/protected') {
      // Get auth token from header
      const token = request.headers.get('Authorization')?.replace('Bearer ', '')

      if (!token) {
        return new Response('Unauthorized', { status: 401 })
      }

      // Use RPC to verify token
      const id = env.AUTH_DO.idFromName('global-auth')
      const stub = env.AUTH_DO.get(id)
      const user = await stub.getAuthenticatedUser(token)

      if ('error' in user) {
        return new Response('Unauthorized', { status: 401 })
      }

      return new Response(JSON.stringify({ user }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
```

---

## libSQL HTTP Protocol Server

Access your Durable Object's SQLite database directly via HTTP using the standard libSQL protocol.

### Quick Example

#### Using Official @libsql/client

```typescript
import { createClient } from '@libsql/client'

const client = createClient({
  url: 'http://your-worker.com/api/sql',
})

const result = await client.execute('SELECT * FROM user')
console.log(result.rows)
```

#### Using Direct HTTP Requests

```typescript
const response = await fetch('http://your-worker.com/api/sql/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statements: [
      {
        q: 'SELECT * FROM user WHERE email = ?',
        params: ['user@example.com'],
      },
    ],
  }),
})

const results = await response.json()
console.log(results[0].results.rows)
```

#### Using Curl

```bash
curl -X POST http://your-worker.com/api/sql/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT * FROM user LIMIT 5"]}'
```

### API Endpoints

```
Base URL:    http://your-worker.com/api/sql

V1 API:      POST /
V2 API:      POST /v2/pipeline
V3 API:      POST /v3/pipeline
Health:      GET  /health
Version:     GET  /version
```

### Parameterized Queries

**Positional Parameters:**

```typescript
{
  q: "SELECT * FROM users WHERE id = ? AND age > ?",
  params: ["123", 25]
}
```

**Named Parameters:**

```typescript
{
  q: "SELECT * FROM users WHERE name = :name AND age > :age",
  params: {
    name: "Alice",
    age: 25
  }
}
```

### V2 API - Stateful Streams

```typescript
let baton = null

// First request - creates stream
const res1 = await fetch('http://your-worker.com/api/sql/v2/pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baton,
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: 'CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT)',
        },
      },
    ],
  }),
})

const data1 = await res1.json()
baton = data1.baton

// Second request - uses same stream
const res2 = await fetch('http://your-worker.com/api/sql/v2/pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baton,
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: 'INSERT INTO todos (id, title) VALUES (?, ?)',
          args: ['1', 'Buy milk'],
        },
      },
    ],
  }),
})
```

📖 **[Complete libSQL HTTP Server Documentation](./docs/LIBSQL-HTTP-SERVER.md)**
📋 **[Quick Reference Card](./docs/LIBSQL-QUICK-REFERENCE.md)**

---

## Examples

### Complete Auth + libSQL Setup

```typescript
import { DurableObject } from 'cloudflare:workers'
import {
  createAuth,
  initBetterAuthTables,
  LibSQLHttpServer,
  type Auth,
} from 'better-auth-do-sqlite'

export class MyAppDO extends DurableObject {
  protected sql = this.ctx.storage.sql
  protected auth: Auth | null = null
  protected libsqlServer: LibSQLHttpServer

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    initBetterAuthTables(this.sql)
    this.libsqlServer = new LibSQLHttpServer(this.sql)
  }

  getAuth(): Auth {
    if (!this.auth) {
      this.auth = createAuth(this.sql)
    }
    return this.auth
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Route libSQL requests
    if (url.pathname.startsWith('/sql')) {
      return await this.libsqlServer.handleRequest(request)
    }

    // Route auth requests
    return await this.getAuth().handler(request)
  }
}
```

### Protected Routes with Middleware

```typescript
import { requireAuth, authMiddleware } from 'better-auth-do-sqlite'

// Apply auth middleware to all routes
app.use('*', authMiddleware('APP_DO'))

// Protect specific routes
app.use('/api/protected/*', requireAuth)

app.get('/api/protected/profile', async (c) => {
  const user = c.get('user')
  return c.json({ user })
})
```

### Session Management Example

Get the active session from your Durable Object:

```typescript
export class MyAuthDO extends DurableObject {
  protected sql = this.ctx.storage.sql
  protected auth: Auth | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    initBetterAuthTables(this.sql)
  }

  getAuth(): Auth {
    if (!this.auth) {
      this.auth = createAuth(this.sql)
    }
    return this.auth
  }

  async getActiveSession(request: Request) {
    const session = await this.getAuth().api.getSession({
      headers: request.headers,
    })

    if (session) {
      return {
        user: session.user,
        session: session.session,
      }
    }
    return null
  }

  async fetch(request: Request): Promise<Response> {
    const auth = this.getAuth()
    return await auth.handler(request)
  }
}
```

---

## Configuration

### Adapter Options

```typescript
import { durableObjectSQLiteAdapter } from 'better-auth-do-sqlite'

durableObjectSQLiteAdapter(sql, {
  // Enable debug logging
  debugLogs: {
    create: true,
    update: true,
    findOne: true,
    findMany: true,
    delete: true,
    deleteMany: true,
    updateMany: true,
    count: true,
  },

  // Use plural table names (default: false)
  usePlural: false,
})
```

### Better Auth Configuration

Customize Better Auth settings:

```typescript
import { betterAuth } from 'better-auth'
import { durableObjectSQLiteAdapter } from 'better-auth-do-sqlite'

export function createAuth(sql: any, baseURL: string) {
  return betterAuth({
    database: durableObjectSQLiteAdapter(sql),
    baseURL,

    // Email & Password configuration
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    // Advanced configuration
    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: {
        enabled: false,
      },
    },
  })
}
```

---

## Database Schema

The adapter automatically creates the following tables:

### `user`

- `id` (TEXT, PRIMARY KEY)
- `email` (TEXT, UNIQUE, NOT NULL)
- `email_verified` (INTEGER, DEFAULT 0)
- `name` (TEXT, NOT NULL)
- `image` (TEXT)
- `created_at` (INTEGER, NOT NULL)
- `updated_at` (INTEGER, NOT NULL)

### `account`

- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, NOT NULL, FOREIGN KEY)
- `account_id` (TEXT, NOT NULL)
- `provider_id` (TEXT, NOT NULL)
- `access_token` (TEXT)
- `refresh_token` (TEXT)
- `id_token` (TEXT)
- `expires_at` (INTEGER)
- `password` (TEXT)
- `created_at` (INTEGER, NOT NULL)
- `updated_at` (INTEGER, NOT NULL)

### `session`

- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, NOT NULL, FOREIGN KEY)
- `expires_at` (INTEGER, NOT NULL)
- `token` (TEXT, UNIQUE, NOT NULL)
- `ip_address` (TEXT)
- `user_agent` (TEXT)
- `created_at` (INTEGER, NOT NULL)
- `updated_at` (INTEGER, NOT NULL)

### `verification`

- `id` (TEXT, PRIMARY KEY)
- `identifier` (TEXT, NOT NULL)
- `value` (TEXT, NOT NULL)
- `expires_at` (INTEGER, NOT NULL)
- `created_at` (INTEGER, NOT NULL)
- `updated_at` (INTEGER, NOT NULL)

---

## Data Type Transformations

The adapter handles the following transformations automatically:

### Input (JS → SQLite)

- `Date` objects → Timestamps (milliseconds)
- `boolean` values → Integers (0 or 1)
- `null` values → NULL
- `undefined` values → Skipped

### Output (SQLite → JS)

- Timestamps → `Date` objects (for fields ending in `At`)
- Integers → `boolean` (for fields like `emailVerified`, `twoFactorEnabled`)
- NULL → `null`

---

## How It Works

### The Inheritance Pattern

The base pattern follows a simple class inheritance model:

1. **Create Base Auth DO** - Extend `DurableObject` and initialize Better Auth
2. **Initialize Tables** - Call `initBetterAuthTables(this.sql)` in constructor
3. **Create Auth Instance** - Use `createAuth(this.sql)` to get Better Auth instance
4. **Handle Requests** - Route requests to `auth.handler(request)`
5. **Extend for Custom Logic** - Add your own tables and RPC methods

The Better Auth adapter will:

- Handle all authentication endpoints (`/api/auth/*`)
- Manage user accounts, sessions, and verification tokens
- Store everything in your Durable Object's SQLite database
- Provide type-safe access to user data

The libSQL HTTP Server (optional) will:

- Provide direct SQL access via HTTP protocol
- Support v1, v2, and v3 libSQL APIs
- Enable use of standard `@libsql/client`
- Allow both positional and named parameters

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Worker                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Hono Router (index.ts)                    │  │
│  │                                                         │  │
│  │  /api/auth/*  ──▶  betterAuthRouter('APP_DO')         │  │
│  │  /api/sql/*   ──▶  sqlServerRouter('APP_DO')          │  │
│  │  /api/todos   ──▶  Your custom routes                  │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Durable Object (MyAppDO)                │   │
│  │                                                       │   │
│  │  ┌──────────────┐    ┌───────────────────────────┐ │   │
│  │  │   Request    │    │   fetch() Handler         │ │   │
│  │  │   Arrives    │───▶│   - Auth requests         │ │   │
│  │  │              │    │   - SQL requests          │ │   │
│  │  └──────────────┘    │   - Custom RPC methods    │ │   │
│  │                      └───────────────────────────┘ │   │
│  │                                                       │   │
│  │  ┌───────────────────┐      ┌─────────────────────┐│   │
│  │  │ LibSQLHttpServer  │      │    Better Auth      ││   │
│  │  │ (Optional)        │      │                     ││   │
│  │  │ - V1 API Handler  │      │ - Auth Handler      ││   │
│  │  │ - V2 API Handler  │      │ - Session Mgmt      ││   │
│  │  │ - V3 API Handler  │      │ - User CRUD         ││   │
│  │  │ - Stream Mgmt     │      │                     ││   │
│  │  └─────────┬─────────┘      └──────────┬──────────┘│   │
│  │            │                            │           │   │
│  │            └────────────┬───────────────┘           │   │
│  │                         │                           │   │
│  │                    ┌────▼────┐                      │   │
│  │                    │ SQLite  │                      │   │
│  │                    │ Storage │                      │   │
│  │                    └─────────┘                      │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Enable Debug Logs

```typescript
durableObjectSQLiteAdapter(sql, {
  debugLogs: true, // Enables all debug logs
})
```

### Check Table Creation

```typescript
// In your Durable Object constructor
const tables = this.sql
  .exec(
    `
  SELECT name FROM sqlite_master WHERE type='table'
`
  )
  .toArray()
console.log('Tables:', tables)
```

### Inspect Data

```typescript
// Query directly from SQL
const users = this.sql.exec('SELECT * FROM user').toArray()
console.log('Users:', users)
```

### Common Issues

**"Invalid or expired baton" (libSQL V2)**

- Use the latest baton from the previous response
- The stream may have expired (5 minute timeout)

**"SQL not provided and sql_id not found"**

- You're trying to use a `sql_id` that wasn't stored with `store_sql`

**Empty rows but query should return data**

- Check your SQL syntax
- Verify the table exists and has data
- Check parameter binding

---

## API Reference

### Exports

```typescript
// Core adapter & config
export { durableObjectSQLiteAdapter, initBetterAuthTables, createAuth, type Auth }

// Middleware
export { requireAuth, authMiddleware, getBearerToken, getDO }

// Routers
export { betterAuthRouter, sqlServerRouter }

// libSQL Server
export {
  LibSQLHttpServer,
  type PipelineRequest,
  type PipelineResponse,
  type SqlValue,
  // ... and more libSQL types
}

// Types
export type {
  DurableObjectSQLiteAdapterConfig,
  User,
  // ... and many more
}
```

---

## Additional Resources

- 📋 **[Implementation Details](./docs/IMPLEMENTATION.md)**
- 🔧 **[libSQL HTTP Server Guide](./docs/LIBSQL-HTTP-SERVER.md)**
- 📚 **[libSQL Quick Reference](./docs/LIBSQL-QUICK-REFERENCE.md)**
- 🚀 **[Better Auth Documentation](https://better-auth.com)**
- ⚡ **[Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)**

---

## Contributing

Contributions are welcome! This library is designed to be:

- **Type-safe** - Full TypeScript support
- **Well-documented** - Comprehensive docs and examples
- **Well-tested** - Test suite included
- **Production-ready** - Optimized for edge deployment

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm build-all`
4. Test: `pnpm test`
5. Lint: `pnpm lint`

---

## License

MIT License - See [LICENSE.txt](./LICENSE.txt) for details

---

## Support

For issues and questions:

- 📝 [Open an issue](https://github.com/mertdogar/better-auth-do-sqlite/issues)

---
