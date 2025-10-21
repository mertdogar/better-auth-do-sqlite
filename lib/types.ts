export type user = {
  id: string
  email: string
  emailVerified: number
  name: string
  image: string | null
  createdAt: number
  updatedAt: number
  role: string
  banned: number
  banReason: string | null
  banExpires: number | null
}

export type account = {
  id: string
  userId: string
  accountId: string
  providerId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  expiresAt: number | null
  password: string | null
  createdAt: number
  updatedAt: number
}

export type session = {
  id: string
  userId: string
  expiresAt: number
  token: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: number
  updatedAt: number
  impersonatedBy: string | null
}

export type verification = {
  id: string
  identifier: string
  value: string
  expiresAt: number
  createdAt: number
  updatedAt: number
}

export type apiKey = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  key: string
  userId: string
  refillInterval: number | null
  refillAmount: number | null
  lastRefillAt: number | null
  enabled: number
  rateLimitEnabled: number
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: number
  remaining: number | null
  lastRequest: number | null
  expiresAt: number | null
  createdAt: number
  updatedAt: number
  permissions: string | null
  metadata: string | null
}

export type sandboxApiKey = {
  id: string
  userId: string
  apiKeyId: string
  apiKey: string
}

export type BetterAuthDatabase = {
  user: user
  account: account
  session: session
  verification: verification
  apiKey: apiKey
  sandboxApiKey: sandboxApiKey
}

export type Database<DB = object> = DB & BetterAuthDatabase

export type PublicAuthVariables = {
  user: user | null
  session: session | null
  sandboxApiKey: sandboxApiKey | null
}

export type ProtectedAuthVariables = {
  user: user
  session: session
  sandboxApiKey: sandboxApiKey
}
