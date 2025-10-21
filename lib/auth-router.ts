import { Hono } from 'hono'
import { getDO } from './auth-middleware'
import type { User } from 'better-auth'

export function betterAuthRouter(doName: string = 'app') {
  const router = new Hono<{ Variables: { user: User } }>()

  router.all('/*', (c) => {
    const authDO = getDO(c, doName)
    return authDO.fetch(c.req.raw)
  })

  return router
}
