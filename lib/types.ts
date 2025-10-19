import { dummyBetterAuth } from './better-auth-config'

export type SandboxApiKey = {
  id: string
  api_key_id: string
  api_key: string
}

export type PublicAuthVariables = {
  user: typeof dummyBetterAuth.$Infer.Session.user | null
  session: typeof dummyBetterAuth.$Infer.Session.session | null
  sandboxApiKey: SandboxApiKey | null
}

export type ProtectedAuthVariables = {
  user: typeof dummyBetterAuth.$Infer.Session.user
  session: typeof dummyBetterAuth.$Infer.Session.session
  sandboxApiKey: SandboxApiKey
}
