import { Context, Next } from "hono";

/**
 * Extract bearer token from Authorization header
 */
export function getBearerToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get auth DO stub
 */
export function getAuthDO(c: Context) {
  const id = c.env.APP_DO.idFromName("auth");
  return c.env.APP_DO.get(id);
}

/**
 * Middleware: Require authentication
 * Adds authenticated user to context as c.get('user')
 */
export async function requireAuth(c: Context, next: Next) {
  const token = getBearerToken(c);

  if (!token) {
    return c.json({ error: "Authorization token required" }, 401);
  }

  const authDO = getAuthDO(c);
  const result = await authDO.getAuthenticatedUser(token);

  if ("error" in result) {
    return c.json(result, 401);
  }

  // Store user in context for downstream handlers
  c.set("user", result);
  await next();
}

/**
 * Middleware: Optional authentication
 * Adds authenticated user to context if token is provided
 */
export async function optionalAuth(c: Context, next: Next) {
  const token = getBearerToken(c);

  if (token) {
    const authDO = getAuthDO(c);
    const result = await authDO.getAuthenticatedUser(token);

    if (!("error" in result)) {
      c.set("user", result);
    }
  }

  await next();
}

