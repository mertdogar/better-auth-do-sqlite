import { Hono } from 'hono'
import { AuthDO, authMiddleware, betterAuthRouter, getDO } from '@mertdogar/better-auth-do-sqlite'

export type MyTables = {
  myTable: {
    id: string
    name: string
  }
}
export class APPDO extends AuthDO<MyTables> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  async getMyTable(id: string) {
    return this.getDB().selectFrom('myTable').selectAll().where('id', '=', id).executeTakeFirst()
  }
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', authMiddleware('app'))
app.route('/api/auth', betterAuthRouter('app'))

app.get('/', async (c) => {
  const appDO = getDO(c, 'app')
  const session = await appDO.getActiveSession(c.req.raw)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.text('Hello World')
})

export default app
