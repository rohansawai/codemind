# CodeMind 🧠

So I was getting really frustrated with Cursor hitting context restarts. You know that feeling when you're in the middle of a conversation with your AI assistant, asking about your codebase, and suddenly it's like "I don't have access to our previous conversation..." 

Every. Single. Time.

I was tired of re-explaining my entire architecture every session. So I built CodeMind - a Redis-powered MCP server that gives AI assistants permanent memory of your codebase.

[![npm version](https://img.shields.io/npm/v/codemind.svg)](https://www.npmjs.com/package/codemind)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem I Was Solving

```
You: "What does processPayment do?"
AI: *reads file, parses AST, builds context...*
AI: "It calls validateOrder and updateDatabase"

[Session restarts]

You: "What calls processPayment?"
AI: "I don't have access to our previous conversation..."
```

This was driving me insane.

---

## What I Built

CodeMind indexes your codebase into a Redis graph. Your AI assistant can query it in under 1ms. Forever.

```bash
# Index once
codemind-index /path/to/your/project

# Query forever (even after 100 session restarts)
"What does processPayment do?"
→ Redis: 0.5ms → File: payment.js, Line: 42, Calls: [validateOrder, updateDatabase]

"What breaks if I change validateOrder?"
→ Redis: 0.3ms → Affected: [processPayment, checkout, retryPayment]
```

No more re-reading files. No more re-parsing. Just permanent memory.

---

## What It Does

- ⚡ **Sub-millisecond queries** - Redis graph storage for instant function lookups
- 🔄 **Survives session restarts** - Permanent memory that persists across conversations
- 📊 **Call graph analysis** - Trace dependencies and find affected functions
- 🔍 **Incremental indexing** - Only re-index changed files
- 🎯 **JavaScript/TypeScript support** - Powered by Babel parser
- 🔌 **MCP integration** - Works with Cursor, Claude Desktop, any MCP client
- 📈 **Production-grade** - Structured logging, error handling, battle-tested

---

## Getting Started

### 1. Install It

```bash
npm install -g codemind
```

### 2. Start Redis

```bash
redis-server
```

### 3. Index Your Code

```bash
# Interactive mode (easier)
codemind

# Or command line
codemind-index /path/to/your/project
```

### 4. Query Functions

```bash
# Find a function
codemind-query find processPayment

# Trace dependencies
codemind-query trace processPayment --depth 3

# Find what breaks
codemind-query affected validateOrder

# Show stats
npm run stats
```

---

## Using with Cursor/Claude Desktop

### Setup

Add to `~/.cursor/mcp.json` (or Claude config):

```json
{
  "mcpServers": {
    "codemind": {
      "command": "node",
      "args": ["$(npm root -g)/codemind/src/mcp/server.js"],
      "env": {
        "REDIS_URL": "redis://127.0.0.1:6379"
      }
    }
  }
}
```

### Then Just Chat

In Cursor chat:

```
"Use codemind to index /path/to/my/project"
"What does startApp do?"
"Trace dependencies of processPayment"
"What breaks if I change sendEmail?"
```

The AI answers instantly from Redis. Every time. Forever.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `codemind` | Interactive mode with prompts |
| `codemind-index <path>` | Index a codebase |
| `codemind-query find <name>` | Find function details |
| `codemind-query trace <name>` | Trace dependencies |
| `codemind-query affected <name>` | Find affected functions |
| `codemind-query list` | List all functions |
| `codemind-query stats` | Show statistics |

---

## How It Actually Works

```
Your Code Files
       ↓
Babel Parser (extracts functions & calls)
       ↓
Redis Graph Storage
  ├── function:NAME → metadata (HASH)
  ├── function:NAME:calls → SET
  └── function:NAME:called_by → SET
       ↓
MCP Tools / CLI query Redis
       ↓
AI gets instant answers (<1ms)
       ↓
SURVIVES SESSION RESTARTS ✨
```

---

## Redis Schema

```redis
# Function metadata
HGETALL function:processPayment
{
  file: "/path/to/payment.js",
  line: "42",
  params: '["order", "userId"]',
  isAsync: "1"
}

# Call graph
SMEMBERS function:processPayment:calls
["validateOrder", "updateDatabase"]

SMEMBERS function:validateOrder:called_by
["processPayment", "checkout"]
```

---

## Configuration

Create `.env`:

```bash
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
IGNORE_PATTERNS=node_modules,.git,dist,build
MAX_FILE_SIZE_MB=5
```

---

## Performance

| Operation | Time | Description |
|-----------|------|-------------|
| Index 100 files | ~5s | Parse + store |
| Index 1000 files | ~50s | Incremental available |
| Query function | <1ms | Redis lookup |
| Trace deps (5 levels) | <10ms | Graph traversal |
| Find affected | <5ms | Reverse lookup |

**Tested on 20k+ functions. Scales to 100k+.**

---

## Examples

### Find Function

```bash
$ codemind-query find startApp

📍 Function: startApp
  File: /path/to/app.js
  Lines: 1-5
  
Calls:
  → initDatabase
  → startServer
  → log
```

### Trace Dependencies

```bash
$ codemind-query trace startApp

🔗 Dependency tree:

● startApp
  → initDatabase
    → connectToDB
    → runMigrations
  → startServer
    → listenOnPort
```

### Find Affected

```bash
$ codemind-query affected sendEmail

⚠️  3 functions would be affected:
  • sendConfirmation
  • processPayment
  • notifyAdmin
```

### Stats Dashboard

```bash
$ npm run stats

📊 CodeMind Stats Dashboard

📁 Database Overview
  Files indexed:      22
  Functions indexed:  76
  
🔗 Call Graph Metrics
  Functions with calls:  72
  Avg calls per function: 3.7
  
💚 Codebase Health Score
  ████████░░ 80%
```

---

## Why I Built This

### vs. Reading Files Every Time
- **1000x faster** (Redis vs file I/O + parsing)
- **Zero context consumed** (no need to load files into AI context)
- **Permanent** (survives restarts)

### vs. Bigger Context Windows
- **More efficient** (query graph vs read everything)
- **More accurate** (structured data vs text search)
- **Unlimited** (Redis stores any amount)

### vs. Other Code Indexers
- **MCP native** (works with any AI assistant)
- **Redis-powered** (battle-tested, scalable)
- **Sub-millisecond** (in-memory graph queries)

---

## Adding More Languages

Want Python support? Here's how:

```javascript
// parsers/python-parser.js
import BaseParser from './base-parser.js';

class PythonParser extends BaseParser {
  canParse(filePath) {
    return /\.py$/.test(filePath);
  }
  
  async parse(filePath, content) {
    // Use Python AST parser
    return { functions: [], imports: [], classes: [] };
  }
}

// Register in codebase-indexer.js
this.parserRegistry.register(new PythonParser());
```

---

## Troubleshooting

### Redis Connection Failed

```bash
# Start Redis
redis-server

# Check connection
redis-cli ping  # Should return PONG
```

### No Functions Found

```bash
# Re-index with force flag
codemind-index /path/to/project -f
```

### MCP Not Working

1. Check `~/.cursor/mcp.json` config
2. Restart Cursor completely (Cmd+Q)
3. Verify in Settings → Features → MCP

---

## Roadmap

- [ ] Python, Go, Java parsers
- [ ] Semantic search with embeddings
- [ ] Class/import tracking
- [ ] Watch mode (auto re-index on file changes)
- [ ] Web dashboard
- [ ] Multi-repo support

---

## Contributing

PRs welcome! This thing is built to be extended.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

---

## License

MIT © [Rohan Sawai](https://github.com/sawairohan90)

---

## Credits

Built with:
- [@babel/parser](https://babeljs.io/) - AST parsing
- [ioredis](https://github.com/luin/ioredis) - Redis client
- [@modelcontextprotocol/sdk](https://modelcontextprotocol.io/) - MCP integration
- [pino](https://getpino.io/) - Logging

---

**Give your AI permanent code memory. Index once. Query forever. 🧠✨**

