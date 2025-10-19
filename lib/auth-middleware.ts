import { Context, Next } from 'hono'
import { AuthDO } from './auth-do'
import { DurableObject } from 'cloudflare:workers'

/**
 * Extract bearer token from Authorization header
 */
export function getBearerToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Get auth DO stub
 */
export function getDO<DO extends DurableObject<unknown> = AuthDO>(c: Context, name: string) {
  const id = c.env.APP_DO.idFromName(name)
  return c.env.APP_DO.get(id) as DO
}

/**
 * Middleware: Require authentication
 * Adds authenticated user to context as c.get('user')
 */
export function authMiddleware(name: string) {
  return async (c: Context, next: Next) => {
    const authDO = getDO(c, name)
    const headersOnlyRequest = new Request(c.req.url, {
      headers: c.req.raw.headers,
    })
    const result = await authDO.getActiveSession(headersOnlyRequest)
    if (!result) {
      c.set('user', null)
      c.set('session', null)
      c.set('sandboxApiKey', null)
      return next()
    }

    c.set('user', result.session.user)
    c.set('session', result.session)
    c.set('sandboxApiKey', result.sandboxApiKey)
    return next()
  }
}

/**
 * Middleware: Require authentication
 * Adds authenticated user to context as c.get('user')
 */
export function requireAuth(c: Context, next: Next) {
  if (!c.get('user')) {
    return c.json({ error: 'Authorization token required' }, 401)
  }
  return next()
}
