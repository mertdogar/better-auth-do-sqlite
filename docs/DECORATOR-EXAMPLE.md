# Authentication Decorator Usage

The `@Authenticatable()` decorator provides a clean way to add authentication capabilities to any Durable Object class.

## Basic Usage with Decorator

```typescript
import { DurableObject } from 'cloudflare:workers'
import { Authenticatable } from './bettar-auth-do-sqlite'

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

## Using with Inheritance

```typescript
import { AuthenticatableDurableObject } from './bettar-auth-do-sqlite'

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

## Available RPC Methods

When you use the decorator or inherit from `AuthenticatableDurableObject`, your Durable Object gets these RPC methods:

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

## Authentication Routes

The decorator automatically handles these routes:

- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-in` - Sign in
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session
- And all other Better Auth endpoints...

## Combining with Other Decorators

You can combine the `@Authenticatable()` decorator with other decorators like `@Browsable()`:

```typescript
import { DurableObject } from 'cloudflare:workers'
import { Authenticatable } from './bettar-auth-do-sqlite'
import { Browsable } from './browsable'

@Authenticatable()
@Browsable()
export class MyAppDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    // Both auth routes (/api/auth/*) and query routes (/query/raw)
    // are handled automatically

    // Your custom routes here
    return new Response('Hello World')
  }
}
```

## Worker Integration Example

```typescript
import { DurableObject } from 'cloudflare:workers'
import { Authenticatable } from './bettar-auth-do-sqlite'

@Authenticatable()
export class AuthDO extends DurableObject {}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Route auth requests to the AuthDO
    if (url.pathname.startsWith('/api/auth')) {
      const id = env.AUTH_DO.idFromName('global-auth')
      const stub = env.AUTH_DO.get(id)
      return stub.fetch(request)
    }

    // Your app routes
    return new Response('App Home')
  },
}
```

## Using RPC from Worker

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

## How It Works

The `@Authenticatable()` decorator:

1. **Wraps your class** - Creates a new class that extends your original class
2. **Adds AuthHandler** - Initializes an `AuthHandler` instance that manages all auth logic
3. **Intercepts fetch** - Checks if incoming requests are for auth routes before passing to your fetch method
4. **Adds RPC methods** - Delegates all authentication RPC methods to the handler
5. **Initializes tables** - Automatically creates Better Auth database tables on first use

The handler will:

- Return authentication responses for `/api/auth/*` routes
- Return a 404 for non-auth routes, allowing your custom fetch to handle them
- Initialize the Better Auth database tables automatically
- Manage all user authentication state in the Durable Object's SQL storage
