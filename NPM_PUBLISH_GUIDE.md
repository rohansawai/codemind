# 📦 How to Publish CodeMind to npm

Step-by-step guide to publish your first npm package!

---

## Prerequisites

- [x] Package built and tested ✅
- [x] `package.json` configured ✅
- [x] README written ✅
- [x] LICENSE added ✅
- [ ] npm account (we'll create this)

---

## Step 1: Create npm Account

### Option A: Via Website
1. Go to [npmjs.com/signup](https://www.npmjs.com/signup)
2. Fill in:
   - Username (will be visible in package URL)
   - Email
   - Password
3. Verify email

### Option B: Via CLI
```bash
npm adduser
```

Follow the prompts.

---

## Step 2: Login to npm

```bash
npm login
```

Enter your credentials when prompted.

**Verify you're logged in:**
```bash
npm whoami
# Should print your username
```

---

## Step 3: Check Package Name Availability

```bash
npm search codemind
```

If another package named "codemind" exists, you'll need to:
- Use a scoped package: `@yourusername/codemind`
- Or pick a different name: `codemind-mcp`, `codemind-redis`, etc.

**To use scoped package, update `package.json`:**
```json
{
  "name": "@sawairohan90/codemind",
  ...
}
```

---

## Step 4: Test Package Locally

Before publishing, test that everything works:

```bash
cd /Users/sawairohan90/codemind/codemind

# Pack the package (creates a .tgz file)
npm pack

# This creates: codemind-0.1.0.tgz
```

**Install it globally to test:**
```bash
npm install -g ./codemind-0.1.0.tgz

# Test the commands
codemind --help
codemind-index --help
codemind-query --help

# Clean up
npm uninstall -g codemind
rm codemind-0.1.0.tgz
```

---

## Step 5: Update Version (if needed)

For first publish, `0.1.0` is fine. For updates:

```bash
# Patch (0.1.0 → 0.1.1)
npm version patch

# Minor (0.1.0 → 0.2.0)
npm version minor

# Major (0.1.0 → 1.0.0)
npm version major
```

---

## Step 6: Publish to npm! 🚀

```bash
cd /Users/sawairohan90/codemind/codemind

# Dry run (see what will be published)
npm publish --dry-run

# Actually publish
npm publish
```

**For scoped packages (if needed):**
```bash
# Public scoped package
npm publish --access public
```

---

## Step 7: Verify Publication

1. Check npm: [npmjs.com/package/codemind](https://www.npmjs.com/package/codemind)
2. Install globally:
   ```bash
   npm install -g codemind
   ```
3. Test:
   ```bash
   codemind --help
   ```

---

## Step 8: Test Installation

On a different machine (or clean directory):

```bash
# Install globally
npm install -g codemind

# Test all commands
codemind
codemind-index --help
codemind-query stats
codemind-mcp
```

---

## Common Issues & Fixes

### Issue: "Package name already exists"

**Solution 1:** Use scoped package
```json
// package.json
{
  "name": "@yourusername/codemind"
}
```
```bash
npm publish --access public
```

**Solution 2:** Pick a different name
- `codemind-mcp`
- `codemind-redis`
- `redis-codemind`

---

### Issue: "You must verify your email"

1. Check your email inbox
2. Click verification link
3. Try `npm publish` again

---

### Issue: "402 Payment Required"

**Cause:** Trying to publish a scoped package privately (requires paid account)

**Solution:** Add `--access public` flag:
```bash
npm publish --access public
```

---

### Issue: "Need to login"

```bash
npm login
```

---

### Issue: "403 Forbidden"

**Causes:**
1. Package name taken → Use scoped or different name
2. Not logged in → Run `npm login`
3. Email not verified → Check email

---

## What Gets Published?

npm will include:
- ✅ Everything in `src/`
- ✅ `README.md`
- ✅ `LICENSE`
- ✅ `package.json`
- ❌ `node_modules/` (auto-excluded)
- ❌ `.git/` (auto-excluded)
- ❌ Files in `.npmignore`

**Check what will be included:**
```bash
npm pack --dry-run
```

---

## Update Package After Publishing

Made changes? Publish an update:

```bash
# 1. Make your changes

# 2. Bump version
npm version patch  # 0.1.0 → 0.1.1

# 3. Publish
npm publish
```

---

## Unpublish (if needed)

**Warning:** Can only unpublish within 72 hours!

```bash
# Unpublish specific version
npm unpublish codemind@0.1.0

# Unpublish entire package (discouraged)
npm unpublish codemind --force
```

---

## Best Practices

### Before Publishing Checklist

- [ ] `npm whoami` works
- [ ] `package.json` version is correct
- [ ] README is clear and has examples
- [ ] LICENSE file exists
- [ ] No sensitive info in code (.env, keys, etc.)
- [ ] `npm pack` shows correct files
- [ ] Tested locally with `npm pack` + install

### After Publishing

- [ ] Test `npm install -g codemind`
- [ ] Star your own package on npm (why not? 😄)
- [ ] Tweet about it
- [ ] Add npm badge to README
- [ ] Update your residency application with npm link

---

## npm Badge for README

After publishing, add to README:

```markdown
[![npm version](https://img.shields.io/npm/v/codemind.svg)](https://www.npmjs.com/package/codemind)
[![npm downloads](https://img.shields.io/npm/dm/codemind.svg)](https://www.npmjs.com/package/codemind)
```

---

## Summary

```bash
# 1. Create npm account (once)
npm adduser

# 2. Login
npm login

# 3. Check package name
npm search codemind

# 4. Test locally
npm pack
npm install -g ./codemind-0.1.0.tgz

# 5. Publish!
npm publish

# 6. Verify
npm install -g codemind
codemind
```

---

## What Happens After Publishing?

1. **Within minutes:**
   - Package appears on [npmjs.com](https://npmjs.com)
   - Anyone can `npm install -g codemind`

2. **Within hours:**
   - npm registry mirrors worldwide
   - Search engines index it
   - npm stats start tracking downloads

3. **Within days:**
   - If it's good, people start using it
   - GitHub stars (if you add repo)
   - Issues/PRs from users

---

## Next Steps After Publishing

1. **Add to README:**
   ```markdown
   ## Install
   \`\`\`bash
   npm install -g codemind
   \`\`\`
   ```

2. **Tweet it:**
   ```
   Just published CodeMind to npm! 🧠

   World's first Redis-powered MCP server that gives AI 
   assistants permanent memory of your codebase.

   npm install -g codemind

   Sub-ms queries. Infinite sessions. Zero context limits.
   ```

3. **Update Delta application:**
   - Add npm package link
   - Show installation instructions
   - Demonstrate it works for anyone

---

## You're Ready!

Run these commands when you're ready to publish:

```bash
cd /Users/sawairohan90/codemind/codemind

# 1. Login
npm login

# 2. Publish
npm publish

# 3. Test
npm install -g codemind
codemind
```

**That's it! Your package will be live on npm for the world to use.** 🚀

---

**Questions?** Read the [npm publish docs](https://docs.npmjs.com/cli/v9/commands/npm-publish)


