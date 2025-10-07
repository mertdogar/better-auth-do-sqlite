# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2025-10-06

### Fixed

- Fixed package entry points in `package.json`
  - Corrected `types` path from `dist/lib/index.d.ts` to `dist/index.d.ts`
  - Removed non-existent `browser` (UMD) export
  - Updated `main` to point to CommonJS build (`dist/index.cjs`)
  - Simplified `exports` configuration for better compatibility with Vite and other bundlers

## [0.0.1] - 2025-10-06

### Added

- Initial release
- Better Auth adapter for Cloudflare Durable Objects with SQLite storage
- `@Authenticatable()` decorator for easy integration
- `AuthenticatableDurableObject` base class
- Full Better Auth support with automatic schema initialization
- libSQL HTTP protocol server (v1, v2, v3)
- Direct SQLite database access via HTTP
- Compatible with official `@libsql/client`
- Email & password authentication
- Session management with configurable expiration
- RPC methods for user management
- Hono middleware for route protection
- Comprehensive TypeScript type definitions
- Debug logging support
- Data type transformations (JS ↔ SQLite)
- Complete documentation and examples

[unreleased]: https://github.com/mertdogar/better-auth-do-sqlite/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/mertdogar/better-auth-do-sqlite/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/mertdogar/better-auth-do-sqlite/releases/tag/v0.0.1
