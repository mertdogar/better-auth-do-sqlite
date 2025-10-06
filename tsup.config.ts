import { defineConfig } from 'tsup'

export default defineConfig({
  external: ['cloudflare:workers'],
  dts: true,
})
