export {
  durableObjectSQLiteAdapter,
  type DurableObjectSQLiteAdapterConfig,
} from './do-sqlite-adapter'
export { initBetterAuthTables, createAuth, type Auth } from './better-auth-config'
export { AuthDO } from './auth-do'
export { requireAuth, optionalAuth, getBearerToken, getAuthDO } from './auth-middleware'
export { LibSQLHttpServer } from './libsql-http-server'
export type * from './libsql-http-server'
export type * from './types'
// New decorator pattern exports
export {
  Authenticatable,
  AuthenticatableDurableObject,
  AuthHandler,
  corsHeaders,
  corsPreflight,
  createResponse,
} from './auth-decorator'
