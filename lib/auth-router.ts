import { Hono } from 'hono'
import { getDO } from './auth-middleware'
import type { User } from 'better-auth'

/**
 * Better Auth Handlers Plugin for Hono
 *
 * Creates a Hono instance with all auth routes configured.
 * Use with router.use() to mount at any base path:
 *
 * @example
 * router.use('/api/auth', betterAuthRouter('auth'))
 *
 * @param doName - The name of the Durable Object binding to use for auth
 * @returns A Hono instance with all auth routes
 */
export function betterAuthRouter(doName: string = 'app') {
  const router = new Hono<{ Variables: { user: User } }>()

  router.all('/*', (c) => {
    const authDO = getDO(c, doName)
    return authDO.fetch(c.req.raw)
  })

  // router.on(['POST', 'GET'], '/*', (c) => {
  //   console.log('@@@ BetterAuth router', c.req.url)
  //   const authDO = getDO(c, doName)
  //   return authDO.fetch(c.req.raw)
  // })

  // router.post('/signup', async (c) => {
  //   try {
  //     const { email, name, password } = await c.req.json()

  //     if (!email || !name || !password) {
  //       return c.json({ error: 'Email, name, and password are required' }, 400)
  //     }

  //     const authDO = getDO(c, doName)
  //     const result = await authDO.signUp(email, name, password)

  //     if ('error' in result) {
  //       return c.json(result, 400)
  //     }

  //     return c.json(result as AuthResponse, 201)
  //   } catch (error) {
  //     console.error('Error signing up:', error)
  //     return c.json({ error: 'Invalid request' }, 400)
  //   }
  // })

  // router.post('/signin', async (c) => {
  //   try {
  //     const { email, password } = await c.req.json()

  //     if (!email || !password) {
  //       return c.json({ error: 'Email and password are required' }, 400)
  //     }

  //     const authDO = getDO(c, doName)
  //     const result = await authDO.signIn(email, password)

  //     if ('error' in result) {
  //       return c.json(result, 401)
  //     }

  //     return c.json(result as AuthResponse)
  //   } catch (error) {
  //     console.error('Error signing in:', error)
  //     return c.json({ error: 'Invalid request' }, 400)
  //   }
  // })

  // router.get('/me', requireAuth, async (c) => {
  //   const user = c.get('user')
  //   return c.json({ user } as UserResponse)
  // })

  // router.post('/signout', requireAuth, async (c) => {
  //   const token = getBearerToken(c)

  //   if (!token) {
  //     return c.json({ error: 'Authorization token required' }, 401)
  //   }

  //   const authDO = getDO(c, doName)
  //   const result = await authDO.signOut(token)

  //   return c.json(result as SignOutResponse)
  // })

  // router.post('/forgot-password', requireAuth, async (c) => {
  //   try {
  //     const { email } = await c.req.json()

  //     if (!email) {
  //       return c.json({ error: 'Email is required' }, 400)
  //     }

  //     const authDO = getDO(c, doName)
  //     const result = await authDO.requestPasswordReset(email)

  //     if ('error' in result) {
  //       return c.json(result, 400)
  //     }

  //     // In production, you would send this token via email
  //     // For now, returning it in the response
  //     return c.json({
  //       message: 'Password reset token generated',
  //       resetToken: result.resetToken,
  //       note: 'In production, this would be sent via email',
  //     } as ForgotPasswordResponse)
  //   } catch (error) {
  //     console.error('Error requesting password reset:', error)
  //     return c.json({ error: 'Invalid request' }, 400)
  //   }
  // })

  // router.post('/reset-password', async (c) => {
  //   try {
  //     const { resetToken, newPassword } = await c.req.json()

  //     if (!resetToken || !newPassword) {
  //       return c.json({ error: 'Reset token and new password are required' }, 400)
  //     }

  //     const authDO = getDO(c, doName)
  //     const result = await authDO.resetPassword(resetToken, newPassword)

  //     if ('error' in result) {
  //       return c.json(result, 400)
  //     }

  //     return c.json({ message: 'Password reset successfully' } as ResetPasswordResponse)
  //   } catch (error) {
  //     console.error('Error resetting password:', error)
  //     return c.json({ error: 'Invalid request' }, 400)
  //   }
  // })

  return router
}
