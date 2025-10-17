# CodeMind Quick Start ⚡

Get up and running in 2 minutes.

---

## 1. Install

```bash
cd /Users/sawairohan90/redis-learning/codemind
npm install
```

---

## 2. Start Redis

```bash
# Check if running
redis-cli ping

# If not running:
redis-server
```

---

## 3. Index Your Code

```bash
# Index the test folder
npm run test

# Or index any project
npm run index /path/to/your/project

# Or index CodeMind itself
npm run index .
```

**Output:**
```
🧠 CodeMind - Codebase Indexer

✔ ✓ Indexed 12 files, 56 functions in 0.33s

📊 Indexing Results:
  ✓ Files processed: 12
  ⚡ Functions indexed: 56
```

---

## 4. Query Your Code

```bash
# Show stats
npm run query stats

# List all functions
npm run query list

# Find a function
npm run query find processPayment

# Trace what it calls
npm run query trace processPayment

# Find what breaks if you change it
npm run query affected processPayment
```

**Output:**
```
🔍 Looking for function: processPayment

Function Details:
  File: /path/to/file.js
  Line: 3-7
  Params: order
  
Calls:
  → validateOrder
  → calculateTotal
  → updateDatabase
```

---

## 5. Real-World Example

```bash
# Ask AI: "What does processPayment do?"
# CodeMind answers instantly from Redis:
# - Location: line 3-7 in payment.js
# - Calls: validateOrder, calculateTotal, updateDatabase
# - Called by: checkoutFlow, retryPayment

# No context limits. No re-explaining. Forever.
```

---

## Common Commands

| Command | What it does |
|---------|-------------|
| `npm run index <path>` | Index a codebase |
| `npm run index <path> -- -f` | Force re-index all files |
| `npm run query stats` | Show database stats |
| `npm run query list` | List all functions |
| `npm run query find <name>` | Find function details |
| `npm run query trace <name>` | Show call tree |
| `npm run query affected <name>` | Find impact of changes |

---

## Configuration

Edit `.env`:
```bash
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
IGNORE_PATTERNS=node_modules,.git,dist,build,coverage
MAX_FILE_SIZE_MB=5
```

---

## Troubleshooting

**Redis not running?**
```bash
redis-server
```

**No functions found?**
```bash
# Re-index with force flag
npm run index . -- -f
```

**Parse errors?**
```bash
# Check which files failed in logs
LOG_LEVEL=debug npm run index .
```

---

## What's Next?

- Read [README.md](./README.md) for full docs
- Read [TESTING.md](./TESTING.md) for test guide
- Start Sprint 2 to add MCP integration

---

**You're ready to give AI permanent memory of your code!** 🧠


