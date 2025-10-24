# Testing CodeMind 🧪

Complete guide to testing CodeMind's indexing and query capabilities.

---

## Prerequisites

1. **Redis running**:
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   
   # If not running, start Redis:
   redis-server
   # Or with Docker:
   docker run -p 6379:6379 redis:latest
   ```

2. **Dependencies installed**:
   ```bash
   cd /Users/sawairohan90/codemind/codemind
   npm install
   ```

3. **Environment configured**:
   ```bash
   # .env file should exist with:
   REDIS_URL=redis://localhost:6379
   LOG_LEVEL=info
   ```

---

## Quick Tests

### 1. Test on mcp-test folder
```bash
npm run test
```

**Expected output**:
```
✓ Indexed 1 files, 1 functions in 0.43s
Total files in DB: 1
Total functions in DB: 1
```

### 2. Test on CodeMind itself (Dogfooding)
```bash
npm run index .
```

**Expected output**:
```
✓ Indexed 12 files, 56 functions in 0.33s
Total files in DB: 13
Total functions in DB: 56
```

### 3. View statistics
```bash
npm run query stats
```

**Expected output**:
```
Files indexed: 13
Functions indexed: 56
```

---

## Comprehensive Test Suite

### Test 1: Basic Indexing
```bash
# Force re-index to clear cache
node src/cli/index-codebase.js . -f

# Verify files were indexed
node src/cli/query.js stats
```

**What to check**:
- ✅ No errors in output
- ✅ Files processed count > 0
- ✅ Functions indexed count > 0
- ✅ Duration < 2 seconds

---

### Test 2: Incremental Indexing
```bash
# First index
node src/cli/index-codebase.js . -f

# Second index (should skip all)
node src/cli/index-codebase.js .
```

**Expected second run**:
```
Files processed: 0
Files skipped: 11+
```

**What to check**:
- ✅ All files skipped (no changes detected)
- ✅ Duration < 100ms
- ✅ "File unchanged, skipping" in logs

---

### Test 3: Function Lookup
```bash
# List all functions
node src/cli/query.js list --limit 20

# Find specific function
node src/cli/query.js find processPayment

# Find non-existent function
node src/cli/query.js find nonExistentFunction
```

**What to check**:
- ✅ List shows function names
- ✅ Find returns: file, line, params, calls
- ✅ Non-existent returns: "Function not found"
- ✅ Query time < 10ms

---

### Test 4: Call Graph Tracing
```bash
# Trace dependencies (forward)
node src/cli/query.js trace processPayment --depth 3

# Find affected (reverse)
node src/cli/query.js affected validateOrder --depth 3
```

**Expected trace output**:
```
● processPayment
  → validateOrder
    → checkInventory
      → log
  → calculateTotal
  → updateDatabase
```

**Expected affected output**:
```
1 functions would be affected:
  ⚠️  processPayment
```

**What to check**:
- ✅ Tree structure displays correctly
- ✅ Relationships are accurate
- ✅ Depth limit respected
- ✅ No infinite loops

---

### Test 5: Complex Codebase
```bash
# Index a larger project (example: express or react)
node src/cli/index-codebase.js /path/to/large/project

# Check stats
node src/cli/query.js stats
```

**What to check**:
- ✅ Handles 100+ files
- ✅ Handles 1000+ functions
- ✅ No parse errors (or minimal)
- ✅ Reasonable performance (<10s for 100 files)

---

### Test 6: File Extensions
```bash
# Index only .js files
node src/cli/index-codebase.js . -e .js

# Index multiple extensions
node src/cli/index-codebase.js . -e .js,.ts,.jsx
```

**What to check**:
- ✅ Only specified extensions indexed
- ✅ Other files skipped

---

### Test 7: Ignore Patterns
```bash
# Edit .env to add ignore pattern
# IGNORE_PATTERNS=node_modules,.git,dist,test

# Re-index
node src/cli/index-codebase.js . -f

# Check that test files are skipped
node src/cli/query.js list | grep -i test
```

**What to check**:
- ✅ Ignored directories skipped
- ✅ No test files in results

---

### Test 8: Large File Handling
```bash
# Edit .env
# MAX_FILE_SIZE_MB=1

# Create a large file (2MB+)
node -e "console.log('x'.repeat(3000000))" > large-file.js

# Try to index
node src/cli/index-codebase.js . -f

# Check logs for "File exceeds size limit"
```

**What to check**:
- ✅ Large files skipped
- ✅ Warning logged
- ✅ Indexing continues for other files

---

### Test 9: Error Handling (Syntax Errors)
```bash
# Create file with syntax error
echo "function broken( { invalid syntax" > broken.js

# Index
node src/cli/index-codebase.js . -f

# Check logs
```

**What to check**:
- ✅ Parse error logged
- ✅ File skipped gracefully
- ✅ Other files still indexed
- ✅ No crash

---

### Test 10: Redis Connection Failure
```bash
# Stop Redis
redis-cli shutdown

# Try to index
node src/cli/index-codebase.js .
```

**What to check**:
- ✅ Clear error message
- ✅ "Failed to connect to Redis"
- ✅ No crash

```bash
# Restart Redis
redis-server &
```

---

### Test 11: Performance Benchmarking
```bash
# Benchmark indexing speed
time node src/cli/index-codebase.js . -f

# Benchmark query speed
time node src/cli/query.js find processPayment
```

**Target benchmarks**:
- ✅ Indexing: ~50-100 files/second
- ✅ Query: <10ms for function lookup
- ✅ Trace: <50ms for depth 5

---

### Test 12: Logging Levels
```bash
# Debug logging
LOG_LEVEL=debug node src/cli/index-codebase.js .

# Silent (only errors)
LOG_LEVEL=error node src/cli/index-codebase.js .

# Trace (very verbose)
LOG_LEVEL=trace node src/cli/index-codebase.js .
```

**What to check**:
- ✅ Debug shows detailed logs
- ✅ Error shows minimal output
- ✅ Trace shows AST details

---

## Test Example Code

The `test-example.js` file contains:
- ✅ 9 functions
- ✅ Complex call relationships
- ✅ 3 levels of nesting
- ✅ Forward and reverse dependencies

**Test commands**:
```bash
# Index it
node src/cli/index-codebase.js . -f

# Find main function
node src/cli/query.js find processPayment

# Trace full tree
node src/cli/query.js trace processPayment --depth 3

# Find what breaks
node src/cli/query.js affected sendEmail
```

---

## Expected Results Summary

| Test | Expected Files | Expected Functions | Expected Time |
|------|----------------|-------------------|---------------|
| mcp-test | 1 | 1 | <1s |
| codemind | 12 | 56 | <2s |
| Incremental | 0 (skipped) | 0 | <0.1s |
| Query | - | - | <10ms |
| Trace | - | - | <50ms |

---

## Visual Test Output

### ✅ Good Output
```
🧠 CodeMind - Codebase Indexer
Indexing: /path/to/project

✔ ✓ Indexed 12 files, 56 functions in 0.33s

📊 Indexing Results:
  ✓ Files processed: 12
  ○ Files skipped: 0
  ⚡ Functions indexed: 56
  ⏱  Duration: 0.33s
```

### ❌ Bad Output (Redis not running)
```
✗ Error: Connection refused
Failed to connect to Redis
```

### ⚠️ Warning Output (Syntax error)
```
⚠  Failed to parse file: broken.js
Parse error: Unexpected token (1:23)

✔ ✓ Indexed 11 files, 55 functions in 0.35s
  ✗ Errors: 1
```

---

## Cleanup After Tests

```bash
# Clear test files
rm test-example.js
rm broken.js
rm large-file.js

# Clear Redis database
redis-cli FLUSHDB

# Confirm clean
node src/cli/query.js stats
# Should show: Files indexed: 0, Functions indexed: 0
```

---

## Automated Testing (Future)

Create `test/integration.test.js`:
```javascript
import { expect } from 'chai';
import CodebaseIndexer from '../src/core/codebase-indexer.js';

describe('CodebaseIndexer', () => {
  it('should index test-example.js', async () => {
    const indexer = new CodebaseIndexer(config);
    await indexer.connect();
    
    const result = await indexer.indexCodebase('./test-example.js');
    
    expect(result.functionsIndexed).to.equal(9);
    expect(result.errors).to.equal(0);
    
    await indexer.disconnect();
  });
});
```

Run with:
```bash
npm test
```

---

## Troubleshooting

### Issue: "No files found to index"
**Solution**: Check ignore patterns in `.env`, ensure path is correct

### Issue: "Parse error" on valid JS
**Solution**: Check Babel parser plugins in `javascript-parser.js`

### Issue: Functions not showing in results
**Solution**: Re-index with `-f` flag, check Redis connection

### Issue: Slow indexing
**Solution**: Check file count, reduce `MAX_FILE_SIZE_MB`, add more ignore patterns

### Issue: Query returns null
**Solution**: Function name is case-sensitive, check with `list` command

---

## Success Criteria

✅ **Sprint 1 Complete** if:
- [ ] Can index 10+ files successfully
- [ ] Can find functions by name
- [ ] Can trace call dependencies
- [ ] Can find affected functions
- [ ] Incremental indexing skips unchanged files
- [ ] Parse errors handled gracefully
- [ ] Redis connection errors clear
- [ ] Query responses < 50ms
- [ ] Beautiful CLI output
- [ ] Logging works at all levels

---

**Test often. Break things. Fix them. Ship it.** 🚀


