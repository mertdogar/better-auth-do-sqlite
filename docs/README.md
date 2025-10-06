# Better Auth - Durable Object SQLite Adapter

A comprehensive [Better Auth](https://better-auth.com) adapter for [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) with SQLite storage.

## Features

### Authentication (Better Auth)
- ✅ **Full Better Auth Support**: Implements all required adapter methods
- ✅ **Type-Safe**: Written in TypeScript with full type safety
- ✅ **Optimized for Durable Objects**: Works seamlessly with DO SQL storage API
- ✅ **Data Transformation**: Automatic conversion between JS types and SQLite types
- ✅ **Debug Logging**: Optional debug logs for troubleshooting
- ✅ **Schema Initialization**: Automatic table creation with proper indexes
- ✅ **Email & Password Auth**: Built-in support for email/password authentication
- ✅ **Session Management**: Secure session handling with configurable expiration

### libSQL HTTP Protocol Server
- ✅ **V1 API**: Simple batch query execution with parameter binding
- ✅ **V2 API**: Stateful streams with Hrana over HTTP protocol
- ✅ **V3 API**: Enhanced Hrana with metadata and autocommit detection
- ✅ **Direct SQLite Access**: Query your Durable Object's SQLite database via HTTP
- ✅ **Standard Protocol**: Full compatibility with official `@libsql/client`
- ✅ **Multiple Request Types**: Execute, batch, sequence, describe, get_autocommit
- ✅ **SQL Statement Caching**: Store and reuse frequently used queries
- ✅ **Conditional Execution**: Execute queries based on previous results
- ✅ **Transaction Compatibility**: Automatic handling of BEGIN/COMMIT statements

## Installation

This adapter is designed to work within a Cloudflare Workers project with Durable Objects enabled.

Ensure you have Better Auth installed:

```bash
npm install better-auth
# or
pnpm add better-auth
# or
bun add better-auth
```

## Usage

### 1. Configure Wrangler

Add the Durable Object binding to your `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "AUTH_DO",
        "class_name": "AuthDO",
        "script_name": "your-worker-name"
      }
    ]
  }
}
```

### 2. Create the Authentication Durable Object

```typescript
import { DurableObject } from "cloudflare:workers";
import {
  durableObjectSQLiteAdapter,
  initBetterAuthTables,
  createAuth,
  type Auth
} from "./bettar-auth-do-sqlite";

export class AuthDO extends DurableObject {
  protected sql = this.ctx.storage.sql;
  protected auth: Auth | null = null;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);

    // Initialize Better Auth tables on first instantiation
    initBetterAuthTables(this.sql);
  }

  protected getAuth(baseURL: string): Auth {
    if (!this.auth) {
      this.auth = createAuth(this.sql, baseURL);
    }
    return this.auth;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const baseURL = `${url.protocol}//${url.host}`;
    const auth = this.getAuth(baseURL);

    try {
      // Forward authentication requests to Better Auth
      return await auth.handler(request);
    } catch (error) {
      console.error("Auth error:", error);
      return new Response(
        JSON.stringify({ error: "Authentication error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
}
```

### 3. Use in Your Worker

```typescript
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// Route auth requests to the Durable Object
app.all("/api/auth/*", async (c) => {
  const authDO = c.env.AUTH_DO.get(c.env.AUTH_DO.idFromName("auth"));
  return authDO.fetch(c.req.raw);
});

export default app;
```

### 4. Use the Client

On the frontend:

```typescript
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: "http://localhost:8787", // Your worker URL
});

// Sign up
await authClient.signUp.email({
  email: "user@example.com",
  password: "securePassword123",
  name: "John Doe",
});

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "securePassword123",
});

// Get session
const session = await authClient.getSession();
```

## Configuration

### Adapter Options

The `durableObjectSQLiteAdapter` accepts optional configuration:

```typescript
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

### Better Auth Options

Customize Better Auth configuration in `createAuth()`:

```typescript
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

    // Add social providers if needed
    socialProviders: {
      // github: {
      //   clientId: process.env.GITHUB_CLIENT_ID,
      //   clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // },
    },
  });
}
```

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

## libSQL HTTP Protocol Server

The Durable Object also includes a **libSQL HTTP protocol server**, allowing you to query the SQLite database directly via HTTP using the standard libSQL protocol.

### Quick Example

```typescript
// Query via libSQL HTTP API
const response = await fetch("http://your-worker.com/api/sql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    statements: [
      "SELECT * FROM user WHERE email = ?",
      { params: ["user@example.com"] }
    ]
  })
});

const results = await response.json();
```

### Using with Direct HTTP Requests

```typescript
// Direct HTTP requests work great!
const response = await fetch("http://your-worker.com/api/sql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    statements: ["SELECT * FROM user LIMIT 5"]
  })
});

const results = await response.json();
```

✅ **Works with @libsql/client**: The official `@libsql/client` library works great!

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "http://your-worker.com/api/sql"  // Works with or without trailing slash!
});

const result = await client.execute("SELECT * FROM user");
```

📖 **[Full libSQL HTTP Server Documentation](./LIBSQL-HTTP-SERVER.md)**

## How It Works

This adapter implements the Better Auth adapter interface using the `createAdapter` function from `better-auth/adapters`. It provides:

1. **CRUD Operations**: `create`, `findOne`, `findMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`
2. **Data Transformation**: Automatic conversion between JavaScript and SQLite types
3. **Query Building**: Dynamic SQL query construction with parameterized queries
4. **Type Safety**: Full TypeScript support with proper type definitions

The adapter is optimized for Durable Objects' SQL API, which provides:
- ACID transactions
- Single-threaded consistency
- Automatic persistence
- Built-in SQLite engine

## Advanced Usage

### Custom RPC Methods

You can extend the `AuthDO` class with custom RPC methods:

```typescript
export class AuthDO extends DurableObject {
  // ... existing code ...

  async getUserById(userId: string) {
    const result = this.sql.exec(
      `SELECT * FROM user WHERE id = ?`,
      userId
    ).toArray()[0];

    return result || null;
  }

  async listUsers(limit = 50, offset = 0) {
    return this.sql.exec(
      `SELECT * FROM user ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      limit,
      offset
    ).toArray();
  }
}
```

### Middleware

Use the provided middleware to protect routes:

```typescript
import { authMiddleware } from "./bettar-auth-do-sqlite";

app.use("/protected/*", async (c, next) => {
  const authDO = c.env.AUTH_DO.get(c.env.AUTH_DO.idFromName("auth"));
  const auth = await authMiddleware(c, authDO);

  if (!auth.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", auth.user);
  await next();
});
```

## Troubleshooting

### Enable Debug Logs

```typescript
durableObjectSQLiteAdapter(sql, {
  debugLogs: true, // Enables all debug logs
})
```

### Check Table Creation

```typescript
// In your AuthDO constructor
const tables = this.sql.exec(`
  SELECT name FROM sqlite_master WHERE type='table'
`).toArray();
console.log("Tables:", tables);
```

### Inspect Data

```typescript
// Query directly from SQL
const users = this.sql.exec("SELECT * FROM user").toArray();
console.log("Users:", users);
```

## Comparison with Other Adapters

This adapter follows the same patterns as official Better Auth adapters:

- **Drizzle Adapter**: Uses ORM abstraction
- **Prisma Adapter**: Uses Prisma Client
- **Kysely Adapter**: Uses query builder
- **DO SQLite Adapter**: Uses native DO SQL API (this adapter)

The DO SQLite adapter is optimized specifically for Cloudflare's Durable Objects environment and provides the best performance for this use case.

## References

- [Better Auth Documentation](https://better-auth.com)
- [Better Auth Adapters](https://better-auth.com/docs/adapters)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Durable Objects SQL API](https://developers.cloudflare.com/durable-objects/api/sql-api/)

## License

MIT

## Contributing

Contributions are welcome! This adapter is part of a larger project and can be extracted as a standalone package if needed.

