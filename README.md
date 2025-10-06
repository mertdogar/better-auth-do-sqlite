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
- 🎨 **TypeScript Decorators** - Clean `@Authenticatable()` decorator for instant auth capabilities
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

- 🎯 **Two Usage Patterns** - Decorator or inheritance, your choice
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

### Option 1: Using the Decorator (Recommended)

The easiest way to add authentication to your Durable Object:

```typescript
import { DurableObject } from 'cloudflare:workers'
import { Authenticatable } from 'better-auth-do-sqlite'

@Authenticatable()
export class MyAppDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Authentication routes (/api/auth/*) are handled automatically
    // by the decorator, so you only need to handle your app routes

    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello World' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
```

### Option 2: Using Inheritance

Extend the `AuthenticatableDurableObject` class:

```typescript
import { AuthenticatableDurableObject } from 'better-auth-do-sqlite'

export class MyAppDO extends AuthenticatableDurableObject {
  async fetch(request: Request): Promise<Response> {
    // Try auth routes first
    const response = await super.fetch(request)
    if (response.status !== 404) {
      return response
    }

    // Handle your custom routes
    const url = new URL(request.url)
    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello World' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
```

### Configure Wrangler

Add the Durable Object binding to your `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "AUTH_DO"
class_name = "MyAppDO"
script_name = "your-worker-name"
```

### Use in Your Worker

```typescript
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

// Route auth requests to the Durable Object
app.all('/api/auth/*', async (c) => {
  const id = c.env.AUTH_DO.idFromName('global-auth')
  const stub = c.env.AUTH_DO.get(id)
  return stub.fetch(c.req.raw)
})

export default app
```

### Frontend Client

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

---

## Documentation

### Authentication Routes

The decorator automatically handles these Better Auth endpoints:

- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-in` - Sign in with email/password
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session
- And all other Better Auth endpoints...

### RPC Methods

When using the decorator or inheritance, your Durable Object gets these RPC methods:

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

### Combining with Other Decorators

```typescript
import { DurableObject } from 'cloudflare:workers'
import { Authenticatable } from 'better-auth-do-sqlite'

@Authenticatable()
export class MyAppDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    // Both auth routes (/api/auth/*) and SQL routes (/api/sql/*)
    // are handled automatically

    // Your custom routes here
    return new Response('Hello World')
  }
}
```

### Protected Routes with Middleware

```typescript
import { requireAuth } from 'better-auth-do-sqlite'

app.use('/protected/*', requireAuth)

app.get('/protected/profile', async (c) => {
  const user = c.get('user')
  return c.json({ user })
})
```

### Custom RPC Methods

Extend the Durable Object with your own methods:

```typescript
import { AuthenticatableDurableObject } from 'better-auth-do-sqlite'

export class MyAppDO extends AuthenticatableDurableObject {
  async getActiveUsers() {
    return this.sql
      .exec(
        `SELECT u.* FROM user u
         JOIN session s ON u.id = s.user_id
         WHERE s.expires_at > ?`,
        Date.now()
      )
      .toArray()
  }

  async getUserStats(userId: string) {
    const user = await this.getUserById(userId)
    const sessions = this.sql
      .exec(`SELECT COUNT(*) as count FROM session WHERE user_id = ?`, userId)
      .toArray()

    return {
      user,
      sessionCount: sessions[0].count,
    }
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

### The Decorator Pattern

The `@Authenticatable()` decorator:

1. **Wraps your class** - Creates a new class that extends your original class
2. **Adds AuthHandler** - Initializes an `AuthHandler` instance that manages all auth logic
3. **Intercepts fetch** - Checks if incoming requests are for auth routes before passing to your fetch method
4. **Adds RPC methods** - Delegates all authentication RPC methods to the handler
5. **Initializes tables** - Automatically creates Better Auth database tables on first use

The handler will:

- Return authentication responses for `/api/auth/*` routes
- Return libSQL responses for `/api/sql/*` routes
- Return a 404 for other routes, allowing your custom fetch to handle them
- Initialize the Better Auth database tables automatically
- Manage all user authentication state in the Durable Object's SQL storage

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Durable Object                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MyAppDO (fetch handler)                 │   │
│  │                                                       │   │
│  │  ┌──────────────┐    ┌───────────────────────────┐ │   │
│  │  │   Request    │    │   Path Routing           │ │   │
│  │  │   Arrives    │───▶│   - /api/auth/* → Auth   │ │   │
│  │  │              │    │   - /api/sql/* → libSQL  │ │   │
│  │  └──────────────┘    └───────────────────────────┘ │   │
│  │                                                       │   │
│  │  ┌───────────────────┐      ┌─────────────────────┐│   │
│  │  │ LibSQLHttpServer  │      │    Better Auth      ││   │
│  │  │                   │      │                     ││   │
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
└─────────────────────────────────────────────────────────────┘
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
// Decorator
export { Authenticatable }

// Base class
export { AuthenticatableDurableObject }

// Adapter & config
export { durableObjectSQLiteAdapter, initBetterAuthTables, createAuth }

// Middleware
export { requireAuth, optionalAuth, getBearerToken, getAuthDO }

// libSQL Server
export { LibSQLHttpServer }

// Types
export type {
  Auth,
  AuthHandler,
  DurableObjectSQLiteAdapterOptions,
  // ... and many more
}
```

---

## Additional Resources

- 📖 **[Decorator Usage Examples](./docs/DECORATOR-EXAMPLE.md)**
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
