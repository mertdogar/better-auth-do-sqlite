# Publish Checklist

## ✅ Completed Setup

The library has been prepared for publishing with the following:

### 1. ✅ `.npmignore` Created

- Excludes source files, tests, and dev configs from npm package
- Only distributes compiled `dist/` folder and essential docs
- Keeps package size minimal

### 2. ✅ `package.json` Updated

- **Description**: Professional description added
- **Keywords**: Comprehensive keywords for npm search (better-auth, cloudflare, durable-objects, sqlite, etc.)
- **Files**: Updated to include all necessary distribution files
- **prepublishOnly**: Added script to automatically lint and build before publishing

### 3. ✅ `CHANGELOG.md` Created

- Follows Keep a Changelog format
- Initial release (0.0.1) documented
- Ready for future updates

### 4. ✅ `PUBLISHING.md` Created

- Complete step-by-step publishing guide
- Instructions for npm and JSR publishing
- Troubleshooting section
- Quick reference commands

### 5. ✅ `jsr.json` Fixed

- Version updated to `0.0.1` (removed `-invalid` suffix)

## 📋 Before Publishing

Run these commands to verify everything is ready:

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Run linting
npm run lint

# 3. Build the package
npm run build-all

# 4. Run tests (if available)
npm test

# 5. Check package contents
npm pack --dry-run
```

## 🚀 Publishing Steps

### For npm:

```bash
# Option A: Manual (first time)
npm login
npm publish --access public

# Option B: Using changesets (recommended)
npm run change           # Create a changeset
npx changeset version    # Update version
git add . && git commit -m "Version 0.0.1" && git push
npm run publish-package  # Publish
```

### For JSR:

```bash
# Check if everything is valid
npm run check-jsr

# Publish to JSR
npm run publish-package-jsr
```

## 📦 What Gets Published

The package will include:

```
@mertdogar/better-auth-do-sqlite@0.0.1
├── dist/
│   ├── index.js          # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.mjs         # ESM alias
│   ├── index.umd.js      # UMD bundle (browser)
│   ├── index.d.ts        # Type declarations
│   ├── index.d.cts       # CommonJS type declarations
│   └── lib/
│       └── *.d.ts        # Additional type declarations
├── README.md             # Comprehensive documentation
├── CHANGELOG.md          # Version history
└── LICENSE.txt           # MIT license
```

**Excluded** (via `.npmignore`):

- Source `lib/` TypeScript files
- Tests and test configs
- Dev tools and scripts
- Config files (tsconfig, eslint, etc.)
- Documentation source files
- Node modules and lock files

## ⚠️ Important Notes

1. **First-time npm publish**: You need to be logged in

   ```bash
   npm login
   ```

2. **Scoped package**: Since it's `@mertdogar/better-auth-do-sqlite`, use:

   ```bash
   npm publish --access public
   ```

3. **Version bumps**: Always update version before publishing

   ```bash
   npm version patch  # 0.0.1 → 0.0.2
   npm version minor  # 0.0.1 → 0.1.0
   npm version major  # 0.0.1 → 1.0.0
   ```

4. **Git tags**: npm version automatically creates git tags

5. **Test locally first**: Use `npm pack` to create a tarball and test
   ```bash
   npm pack
   # Creates: mertdogar-better-auth-do-sqlite-0.0.1.tgz
   ```

## 🔍 Verification After Publishing

### npm

```bash
# Check if published
npm view @mertdogar/better-auth-do-sqlite

# Test installation
mkdir test-install && cd test-install
npm init -y
npm install @mertdogar/better-auth-do-sqlite
```

### JSR

Visit: https://jsr.io/@mertdogar/better-auth-do-sqlite

## 📝 Post-Publishing TODO

- [ ] Create GitHub release (tag: v0.0.1)
- [ ] Update GitHub README badges
- [ ] Tweet/announce on social media
- [ ] Post on Better Auth Discord
- [ ] Share on r/cloudflare
- [ ] Add to Cloudflare community showcase

## 🛠️ If Something Goes Wrong

### Build fails

```bash
npm run lint          # Check for errors
npm run format        # Auto-fix linting
```

### Publish fails

- Check if you're logged in: `npm whoami`
- Check version hasn't been published: `npm view @mertdogar/better-auth-do-sqlite versions`
- Ensure package.json version is bumped

### JSR fails

- Make sure you're authenticated with GitHub on jsr.io
- Repository must be public
- Run `npm run check-jsr` for detailed errors

## 📚 Documentation

All documentation is ready:

- ✅ README.md - Comprehensive usage guide
- ✅ CHANGELOG.md - Version history
- ✅ PUBLISHING.md - Detailed publishing guide
- ✅ docs/ - Additional technical documentation
- ✅ LICENSE.txt - MIT license

## 🎯 Quick Publish Commands

```bash
# Full publish flow
npm run lint && \
npm run build-all && \
npm publish --access public

# Or with version bump
npm version patch && \
npm run lint && \
npm run build-all && \
npm publish --access public && \
git push --tags
```

---

**Ready to publish!** 🚀

Follow the steps in `PUBLISHING.md` for detailed instructions.
