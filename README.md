# @mertdogar/better-auth-do-sqlite

A [Better Auth](https://www.better-auth.com/) adapter for Cloudflare Durable Objects with SQLite storage. This library enables you to use Better Auth's authentication features in Cloudflare Workers with Durable Objects as your database layer.

## Features

- 🔐 Full Better Auth integration with Cloudflare Durable Objects
- 💾 SQLite storage via Durable Objects
- 🚀 Built for Cloudflare Workers
- 🎯 Type-safe with TypeScript
- 🔄 Session management with Durable Objects
- 🛠️ Works seamlessly with Hono and other frameworks

## Installation

```bash
npm install @mertdogar/better-auth-do-sqlite better-auth hono
```

Or with other package managers:

```bash
# pnpm
pnpm add @mertdogar/better-auth-do-sqlite better-auth hono

# yarn
yarn add @mertdogar/better-auth-do-sqlite better-auth hono

# bun
bun add @mertdogar/better-auth-do-sqlite better-auth hono
```

## Quick Start

### 1. Configure Wrangler

Create or update your `wrangler.jsonc`:

```jsonc
{
  "name": "my-auth-app",
  "main": "src/index.ts",
  "compatibility_date": "2025-05-04",
  "vars": {
    "JWT_SECRET": "your-secret-key-here",
  },
  "durable_objects": {
    "bindings": [
      {
        "class_name": "APPDO",
        "name": "APP_DO",
      },
    ],
  },
  "migrations": [
    {
      "new_sqlite_classes": ["APPDO"],
      "tag": "v1",
    },
  ],
}
```

### 2. Create Worker Types

Create a `worker-configuration.d.ts` file:

```typescript
interface Env extends Cloudflare.Env {
  JWT_SECRET: string
  APP_DO: DurableObjectNamespace
}
```

### 3. Implement Your Worker

```typescript
import { Hono } from 'hono'
import { AuthDO, authMiddleware, betterAuthRouter, getDO } from '@mertdogar/better-auth-do-sqlite'

// Extend AuthDO to create your Durable Object class
export class APPDO extends AuthDO {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }
}

const app = new Hono<{ Bindings: Env }>()

// Apply auth middleware globally
app.use('*', authMiddleware('app'))

// Mount Better Auth routes
app.route('/api/auth', betterAuthRouter('app'))

// Protected route example
app.get('/', async (c) => {
  const appDO = getDO(c, 'app')
  const session = await appDO.getActiveSession(c.req.raw)

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ message: 'Hello authenticated user!', session })
})

export default app
```

## API Reference

### `AuthDO`

The base Durable Object class that provides authentication functionality.

```typescript
export class APPDO extends AuthDO {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }
}
```

#### Methods

- **`getActiveSession(request: Request): Promise<Session | null>`**

  Retrieves the active session for the given request.

  ```typescript
  const session = await appDO.getActiveSession(request)
  ```

### `authMiddleware(bindingPrefix: string)`

Middleware that attaches authentication context to requests.

**Parameters:**

- `bindingPrefix`: The prefix of your Durable Object binding (e.g., `'app'` for `APP_DO`)

```typescript
app.use('*', authMiddleware('app'))
```

### `betterAuthRouter(bindingPrefix: string)`

Hono router that handles all Better Auth endpoints.

**Parameters:**

- `bindingPrefix`: The prefix of your Durable Object binding (e.g., `'app'` for `APP_DO`)

```typescript
app.route('/api/auth', betterAuthRouter('app'))
```

This will create the following endpoints:

- `POST /api/auth/sign-in`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- And all other Better Auth endpoints

### `getDO(context: HonoContext, bindingPrefix: string)`

Helper function to get the Durable Object instance.

**Parameters:**

- `context`: Hono context object
- `bindingPrefix`: The prefix of your Durable Object binding

```typescript
const appDO = getDO(c, 'app')
```

## Configuration

### Environment Variables

Set these in your `wrangler.jsonc` or `.dev.vars` file:

```bash
# Required
JWT_SECRET=your-secret-key-here-min-32-characters

# Optional - for development
# Add other Better Auth configuration as needed
```

### Durable Object Binding

The library expects a Durable Object binding with the pattern `{PREFIX}_DO`. For example:

- If you use `authMiddleware('app')`, you need an `APP_DO` binding
- If you use `authMiddleware('auth')`, you need an `AUTH_DO` binding

## Advanced Usage

### Custom Session Handling

```typescript
app.get('/profile', async (c) => {
  const appDO = getDO(c, 'app')
  const session = await appDO.getActiveSession(c.req.raw)

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Access user information from session
  return c.json({
    userId: session.userId,
    email: session.user?.email,
    // ... other session data
  })
})
```

### Multiple Authentication Domains

You can use multiple Durable Object instances for different authentication domains:

```typescript
// User authentication
export class UserAuthDO extends AuthDO {}

// Admin authentication
export class AdminAuthDO extends AuthDO {}

const app = new Hono()

// User routes
app.use('/user/*', authMiddleware('userAuth'))
app.route('/user/auth', betterAuthRouter('userAuth'))

// Admin routes
app.use('/admin/*', authMiddleware('adminAuth'))
app.route('/admin/auth', betterAuthRouter('adminAuth'))
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## How It Works

This library leverages Cloudflare Durable Objects with SQLite to provide a serverless, edge-based authentication solution:

1. **Durable Objects**: Each authentication instance runs in a Durable Object, providing strong consistency and SQLite storage
2. **Better Auth Integration**: Full Better Auth functionality is available through the Durable Object interface
3. **Edge Performance**: Authentication runs at the edge, close to your users
4. **Persistent Storage**: SQLite in Durable Objects ensures your authentication data persists

## Requirements

- Node.js 16.x or later (or Bun)
- Cloudflare Workers account
- Wrangler CLI (`npm install -g wrangler`)

## Limitations

- Durable Objects have [usage limits](https://developers.cloudflare.com/durable-objects/platform/limits/) that should be considered
- SQLite storage in Durable Objects is persistent per object instance
- Authentication state is isolated per Durable Object instance

## Troubleshooting

### "Durable Object not found" Error

Make sure your Durable Object binding matches the prefix you're using:

```typescript
// If using authMiddleware('app')
// Your binding should be APP_DO (uppercase {PREFIX}_DO)
```

### Session Not Persisting

Ensure your `JWT_SECRET` is set and is at least 32 characters long.

### TypeScript Errors

Make sure you have the worker types configured:

```bash
npm run types  # or: wrangler types
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Related

- [Better Auth](https://www.better-auth.com/) - The authentication framework
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Serverless storage and compute
- [Hono](https://hono.dev/) - Lightweight web framework

## Support

- [GitHub Issues](https://github.com/mertdogar/better-auth-do-sqlite/issues)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
