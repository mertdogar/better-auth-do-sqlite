# Publishing Guide

This guide will help you publish the `better-auth-do-sqlite` package to npm and JSR.

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build-all`
- [ ] README.md is up to date
- [ ] CHANGELOG.md is updated with version changes
- [ ] Version number is correct in `package.json`
- [ ] All changes are committed to git
- [ ] You're on the main branch

## Publishing to npm

### Option 1: Using Changesets (Recommended)

1. **Create a changeset:**

   ```bash
   npm run change
   ```

   Follow the prompts to describe your changes.

2. **Version the package:**

   ```bash
   npx changeset version
   ```

   This will update the version in `package.json` and `CHANGELOG.md`.

3. **Commit the version changes:**

   ```bash
   git add .
   git commit -m "Version x.x.x"
   git push
   ```

4. **Publish:**
   ```bash
   npm run publish-package
   ```

### Option 2: Manual Publishing

1. **Update version in package.json:**

   ```bash
   npm version patch  # or minor, or major
   ```

2. **Build the package:**

   ```bash
   npm run build-all
   ```

3. **Test the package locally:**

   ```bash
   npm pack
   ```

   This creates a `.tgz` file you can inspect.

4. **Publish to npm:**

   ```bash
   npm publish --access public
   ```

5. **Push tags to git:**
   ```bash
   git push --tags
   ```

## Publishing to JSR

1. **Check JSR compatibility:**

   ```bash
   npm run check-jsr
   ```

2. **Fix any issues** reported by the dry-run.

3. **Publish to JSR:**

   ```bash
   npm run publish-package-jsr
   ```

   This will:
   - Update the version in `jsr.json` from `package.json`
   - Publish to JSR

## Verifying the Publication

### npm

1. Check npm registry:

   ```bash
   npm view @mertdogar/better-auth-do-sqlite
   ```

2. Try installing in a test project:
   ```bash
   npm install @mertdogar/better-auth-do-sqlite
   ```

### JSR

1. Check JSR page:

   ```
   https://jsr.io/@mertdogar/better-auth-do-sqlite
   ```

2. Try installing in a test project:
   ```bash
   npx jsr add @mertdogar/better-auth-do-sqlite
   ```

## Post-Publishing

1. **Create a GitHub release:**
   - Go to: https://github.com/mertdogar/better-auth-do-sqlite/releases/new
   - Tag: `v0.0.1` (or your version)
   - Title: `v0.0.1`
   - Description: Copy from CHANGELOG.md
   - Publish release

2. **Update documentation** if needed.

3. **Announce** on relevant platforms:
   - Twitter/X
   - Discord (Better Auth community)
   - Reddit (r/cloudflare, r/typescript)
   - Dev.to

## Troubleshooting

### "prepublishOnly script failed"

This means linting or build failed. Run:

```bash
npm run lint
npm run build-all
```

Fix any errors and try again.

### "You need to be logged in to npm"

Login to npm:

```bash
npm login
```

### "Package already published"

You need to bump the version number:

```bash
npm version patch
```

### JSR publish fails

1. Make sure you're logged into JSR with GitHub
2. Check your repository is public
3. Ensure `jsr.json` is valid
4. Run `npm run check-jsr` for detailed errors

## Package Contents

The published package includes:

```
better-auth-do-sqlite/
├── dist/
│   ├── index.js          # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.mjs         # ESM bundle (alias)
│   ├── index.umd.js      # UMD bundle (browser)
│   └── lib/
│       └── *.d.ts        # TypeScript declarations
├── README.md
├── CHANGELOG.md
└── LICENSE.txt
```

Files **excluded** from the package (via `.npmignore`):

- Source `lib/` files
- Configuration files
- Tests
- Development tools
- Documentation source files

## Semantic Versioning

Follow these guidelines:

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features (backward compatible)
- **PATCH** (0.0.1): Bug fixes (backward compatible)

Examples:

- Adding new RPC methods: MINOR
- Fixing a bug: PATCH
- Removing/renaming exports: MAJOR
- Adding new optional parameters: MINOR
- Changing required parameters: MAJOR

## GitHub Actions

The repository includes GitHub Actions workflows for:

1. **Continuous Integration:**
   - Runs on every push and PR
   - Executes linting and tests
   - Builds the package

2. **Release Workflow:**
   - Automatically publishes when a changeset PR is merged
   - Creates GitHub releases

Make sure these are enabled in your repository settings.

## Need Help?

- Check the [Better Auth Discord](https://discord.gg/better-auth)
- Review [npm publishing docs](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- Review [JSR publishing docs](https://jsr.io/docs/publishing-packages)
- Open an issue on GitHub

## Quick Reference

```bash
# Development
npm install           # Install dependencies
npm run dev           # Watch mode development
npm test              # Run tests
npm run lint          # Check linting
npm run format        # Auto-fix linting issues

# Building
npm run build         # Build the package
npm run build-all     # Build with type definitions

# Publishing
npm run change        # Create changeset
npm run publish-package      # Publish to npm
npm run publish-package-jsr  # Publish to JSR
npm run check-jsr     # Dry-run JSR publish
```
