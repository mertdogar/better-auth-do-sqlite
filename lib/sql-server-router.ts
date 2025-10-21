import { Hono } from 'hono'
import { getDO } from './auth-middleware'
import { cors } from 'hono/cors'
import type { PublicAuthVariables } from './types'



export function sqlServerRouter(doName: string = 'app', prefixRegex: RegExp = /^\/api\/sqld/) {
  const router = new Hono<{ Variables: PublicAuthVariables }>()

  // ========================================
  // libSQL HTTP Protocol Server Routes
  // ========================================

  // Add CORS middleware for libSQL endpoints
  router.use(
    '/sql/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type'],
      maxAge: 86400,
    })
  )

  router.use(
    '/v2/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type'],
      maxAge: 86400,
    })
  )

  router.use(
    '/v3/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type'],
      maxAge: 86400,
    })
  )

  // Route /api/v2 and /api/v3 version checks (for clients without trailing slash)
  router.get('/v2', async (c) => {
    console.log('v2', c.req.url)
    const appDO = getDO(c, doName)
    const url = new URL(c.req.url)
    url.pathname = '/sql/v2'
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  router.get('/v3', async (c) => {
    console.log('v3', c.req.url)
    const appDO = getDO(c, doName)
    const url = new URL(c.req.url)
    url.pathname = '/sql/v3'
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  router.get('/v3-protobuf', async (c) => {
    console.log('v3-protobuf', c.req.url)
    const appDO = getDO(c, doName)
    const url = new URL(c.req.url)
    url.pathname = '/sql/v3-protobuf'
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  // Route /api/v2/* and /api/v3/* (for clients without trailing slash in base URL)
  router.all('/v2/*', async (c) => {
    console.log('v2/*', c.req.url)
    const appDO = getDO(c, doName)
    // Rewrite to /sql/v2/* for the DO
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(prefixRegex, '/sql')
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  router.all('/v3/*', async (c) => {
    console.log('v3/*', c.req.url)
    const appDO = getDO(c, doName)
    // Rewrite to /sql/v3/* for the DO
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(prefixRegex, '/sql')
    console.log('modified url', url.pathname)
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  // Route all /api/sql/* requests to the Durable Object for libSQL HTTP protocol
  router.all('/sql/*', async (c) => {
    console.log('sql/*', c.req.url)
    const appDO = getDO(c, doName)
    // Rewrite URL to remove /api prefix for the DO
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(prefixRegex, '')
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  // Also handle /api/sql without trailing slash
  router.all('/sql', async (c) => {
    console.log('sql', c.req.url)
    const appDO = getDO(c, doName)
    // Rewrite URL to remove /api prefix for the DO
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(prefixRegex, '')
    const modifiedRequest = new Request(url, c.req.raw)
    return appDO.fetch(modifiedRequest)
  })

  return router
}
