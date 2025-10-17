# CodeMind MCP Setup Guide 🔌

How to connect CodeMind to Cursor (or any MCP-compatible AI assistant).

---

## What You Get

Once configured, you can ask your AI assistant:

- **"Index my project"** → CodeMind indexes the codebase
- **"What does `processPayment` do?"** → Instant function details with call graph
- **"What calls `validateOrder`?"** → Shows all callers
- **"Trace dependencies of `startApp`"** → Full dependency tree
- **"What breaks if I change `sendEmail`?"** → Impact analysis

**All answers come from Redis in <10ms. Survives session restarts. Forever.**

---

## Prerequisites

1. **Redis running**:
   ```bash
   redis-cli ping  # Should return PONG
   ```

2. **CodeMind installed**:
   ```bash
   cd /Users/sawairohan90/redis-learning/codemind
   npm install
   ```

3. **Cursor installed** (or Claude Desktop, or any MCP client)

---

## Setup Steps

### 1. The MCP config is already added!

Location: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "codemind": {
      "command": "/Users/sawairohan90/.nvm/versions/node/v20.19.3/bin/node",
      "type": "stdio",
      "name": "codemind",
      "args": ["/Users/sawairohan90/redis-learning/codemind/src/mcp/server.js"],
      "env": {
        "REDIS_URL": "redis://127.0.0.1:6379",
        "LOG_LEVEL": "info"
      },
      "cwd": "/Users/sawairohan90/redis-learning/codemind"
    }
  }
}
```

### 2. Restart Cursor

**Important:** Cursor only loads MCP servers on startup.

1. Quit Cursor completely (Cmd+Q)
2. Restart Cursor
3. Wait 5 seconds for MCP servers to initialize

### 3. Verify Connection

1. Open Cursor Settings
2. Go to "Features" → "MCP"
3. Look for "codemind" in the list
4. Should show: **4 tools available** ✅

If you see errors, check the troubleshooting section below.

---

## Using CodeMind in Cursor

### First: Index Your Codebase

In Cursor chat, ask:

```
Use the codemind MCP server to index /Users/sawairohan90/redis-learning/test-project
```

Or be more specific:

```
Use codemind's index_codebase tool with path: /Users/sawairohan90/redis-learning/test-project
```

**Expected response:**
```
✅ Codebase indexed successfully!

📊 Results:
  • Files processed: 1
  • Functions indexed: 6
  • Duration: 0.06s
```

### Then: Query Your Code

**Find a function:**
```
Use codemind to find the function "startApp"
```

**Trace dependencies:**
```
Use codemind to trace dependencies of "startApp" with depth 3
```

**Find impact:**
```
Use codemind to find what would be affected if I change "validateOrder"
```

**General questions:**
```
What does processPayment do?
What calls initDatabase?
Show me the call tree for startApp
```

The AI will automatically use CodeMind tools to answer!

---

## Available Tools

| Tool | Description | Example Use |
|------|-------------|-------------|
| `index_codebase` | Index a project | "Index my project at /path/to/code" |
| `find_function` | Find function details | "What does processPayment do?" |
| `trace_dependencies` | Show what function calls | "Trace dependencies of startApp" |
| `find_affected` | Show what breaks if changed | "What breaks if I change sendEmail?" |

---

## Example Conversation

**You:** "Index /Users/sawairohan90/redis-learning/test-project"

**AI uses:** `index_codebase` tool
```
✅ Indexed 1 file, 6 functions in 0.06s
```

---

**You:** "What does startApp do?"

**AI uses:** `find_function` tool
```
📍 Function: startApp
📄 Location: test-project/app.js (lines 1-5)

➡️  Calls:
  • initDatabase
  • startServer
  • log
```

---

**You:** "Show me the full call tree"

**AI uses:** `trace_dependencies` tool
```
🔗 Dependency tree for: startApp

● startApp
  → initDatabase
    → connectToDB
    → runMigrations
  → startServer
    → listenOnPort
```

---

**You:** "What breaks if I change listenOnPort?"

**AI uses:** `find_affected` tool
```
⚠️  2 functions would be affected:
  • startServer
  • startApp
```

---

## Troubleshooting

### Issue: "No tools available" in Cursor MCP settings

**Solution:**
1. Check that `~/.cursor/mcp.json` has the codemind entry
2. Verify the `command` path points to your Node.js:
   ```bash
   which node
   # Update the "command" field with this path
   ```
3. Restart Cursor completely (Cmd+Q, then reopen)

### Issue: "spawn node ENOENT"

**Solution:**
Update the `command` field in `~/.cursor/mcp.json` to absolute Node.js path:
```bash
which node
# Copy this path into mcp.json
```

### Issue: "Redis connection failed"

**Solution:**
```bash
# Start Redis
redis-server

# Or in background
redis-server --daemonize yes

# Verify it's running
redis-cli ping
```

### Issue: MCP server crashes on startup

**Solution:**
Check the logs:
```bash
# Look at Cursor's MCP logs
tail -f ~/.cursor/logs/mcp-*.log

# Or run the server manually to see errors
cd /Users/sawairohan90/redis-learning/codemind
node src/mcp/server.js
```

### Issue: "Function not found"

**Solution:**
The codebase hasn't been indexed yet. Ask:
```
Index /path/to/your/project first
```

### Issue: Tools work but responses are slow

**Solution:**
1. Check Redis performance: `redis-cli --latency`
2. Reduce trace depth: use depth 2-3 instead of 5
3. Index only relevant directories

---

## Configuration

### Custom Redis URL

Edit `~/.cursor/mcp.json`:
```json
"env": {
  "REDIS_URL": "redis://your-redis-host:6379"
}
```

### Enable Debug Logging

```json
"env": {
  "LOG_LEVEL": "debug"
}
```

Then check logs:
```bash
tail -f ~/.cursor/logs/mcp-codemind.log
```

### Change Working Directory

```json
"cwd": "/path/to/different/directory"
```

---

## Testing MCP Server Manually

Before adding to Cursor, test it works:

```bash
cd /Users/sawairohan90/redis-learning/codemind

# Run the MCP server (it reads from stdin, writes to stdout)
node src/mcp/server.js
```

The server should start without errors. Press Ctrl+C to stop.

---

## For Other MCP Clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codemind": {
      "command": "/Users/sawairohan90/.nvm/versions/node/v20.19.3/bin/node",
      "args": ["/Users/sawairohan90/redis-learning/codemind/src/mcp/server.js"],
      "env": {
        "REDIS_URL": "redis://127.0.0.1:6379"
      }
    }
  }
}
```

### VS Code (Claude Dev extension)

Similar config in VS Code settings under "MCP Servers".

---

## What's Next?

Once working:

1. **Index your main project**: Start with a small codebase first
2. **Ask questions**: "What does X do?", "What calls Y?", "Trace Z"
3. **Experience the magic**: No re-explaining. No context limits. Forever.

---

## Success Checklist

- [ ] Redis running (`redis-cli ping`)
- [ ] CodeMind installed (`cd codemind && npm install`)
- [ ] MCP config added (`~/.cursor/mcp.json`)
- [ ] Cursor restarted completely
- [ ] 4 tools visible in Cursor MCP settings
- [ ] Can index a codebase
- [ ] Can find functions
- [ ] Can trace dependencies
- [ ] Can find affected functions

**All checked? You're ready to give AI permanent code memory!** 🧠✨

---

## Get Help

If stuck, check:
1. Cursor MCP logs: `~/.cursor/logs/`
2. Redis: `redis-cli ping`
3. Server manually: `node src/mcp/server.js`
4. Node path: `which node`

Still stuck? The issue is usually:
- Wrong Node.js path in `mcp.json`
- Redis not running
- Cursor not restarted

Fix those three and it works 99% of the time.


