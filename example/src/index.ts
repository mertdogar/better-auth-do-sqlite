import { Hono } from 'hono'
import { AuthDO, authMiddleware, betterAuthRouter, getDO } from '@mertdogar/better-auth-do-sqlite'
import { DurableObject } from 'cloudflare:workers'

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

export class PUBSUBDO extends DurableObject<unknown> {
  private sessions: Map<string, WebSocket> = new Map()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/subscribe') {
      // Accept WebSocket upgrade
      const upgradeHeader = request.headers.get('Upgrade')
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected websocket upgrade', { status: 426 })
      }

      const webSocketPair = new WebSocketPair()
      const [client, server] = Object.values(webSocketPair)

      this.ctx.acceptWebSocket(server)

      const sessionId = crypto.randomUUID()
      this.sessions.set(sessionId, server)

      // Send initial connection message
      server.send(
        JSON.stringify({
          type: 'connected',
          sessionId,
          timestamp: new Date().toISOString(),
        })
      )

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async sendEvent(event: string) {
    const message = JSON.stringify({
      type: 'event',
      event,
      timestamp: new Date().toISOString(),
    })

    // Broadcast to all connected WebSocket sessions
    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(message)
      } catch (err) {
        console.error('Error sending to websocket:', err)
      }
    })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Handle incoming messages from clients if needed
    console.log('Received message:', message)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean) {
    ws.close(code, 'Durable Object is closing WebSocket')
    // Clean up session
    for (const [sessionId, socket] of this.sessions.entries()) {
      if (socket === ws) {
        this.sessions.delete(sessionId)
        break
      }
    }
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

  console.log('session', c.get('session'))
  console.log('sandboxApiKey', c.get('sandboxApiKey'))
  return c.text('Hello World')
})

app.get('/:projectId/events/subscribe', async (c) => {
  const projectId = c.req.param('projectId')
  const id = c.env.PUBSUB_DO.idFromName(projectId)
  const pubsubDO = c.env.PUBSUB_DO.get(id)

  // Forward the original request (which should contain WebSocket upgrade headers) to the Durable Object
  const url = new URL(c.req.url)
  url.pathname = '/subscribe'

  // Create a new request with the original headers
  const upgradeRequest = new Request(url, {
    headers: c.req.raw.headers,
  })

  return pubsubDO.fetch(upgradeRequest)
})

app.post('/:projectId/events', async (c) => {
  const projectId = c.req.param('projectId')
  const id = c.env.PUBSUB_DO.idFromName(projectId)
  const pubsubDO = c.env.PUBSUB_DO.get(id) as DurableObjectStub<PUBSUBDO>

  const body = await c.req.json()
  if (!body.event) {
    return c.json({ error: 'Event is required' }, 400)
  }

  await pubsubDO.sendEvent(body.event)

  return c.json({ message: 'Event sent' })
})

export default app
