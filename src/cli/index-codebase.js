#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import CodebaseIndexer from '../core/codebase-indexer.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const program = new Command();

program
  .name('codemind-index')
  .description('Index a codebase into Redis for AI-powered code analysis')
  .argument('<path>', 'Path to codebase root directory')
  .option('-f, --force', 'Force re-index all files (ignore hash checks)')
  .option('-e, --extensions <exts>', 'File extensions to index (comma-separated)', '.js,.ts,.jsx,.tsx')
  .option('--redis-url <url>', 'Redis URL', process.env.REDIS_URL)
  .action(async (codePath, options) => {
    try {
      console.log(chalk.bold.cyan('\n🧠 CodeMind - Codebase Indexer\n'));

      // Resolve path
      const rootPath = path.resolve(codePath);
      console.log(chalk.gray(`Indexing: ${rootPath}\n`));

      // Update config if custom Redis URL provided
      if (options.redisUrl) {
        config.redis.url = options.redisUrl;
      }

      // Parse extensions
      const extensions = options.extensions.split(',').map(e => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`);

      // Create indexer
      const indexer = new CodebaseIndexer(config);
      await indexer.connect();

      // Index codebase
      const results = await indexer.indexCodebase(rootPath, {
        force: options.force,
        extensions,
      });

      // Display results
      console.log(chalk.bold('\n📊 Indexing Results:\n'));
      console.log(chalk.green(`  ✓ Files processed: ${results.filesProcessed}`));
      console.log(chalk.gray(`  ○ Files skipped: ${results.filesSkipped}`));
      console.log(chalk.cyan(`  ⚡ Functions indexed: ${results.functionsIndexed}`));
      
      if (results.errors > 0) {
        console.log(chalk.red(`  ✗ Errors: ${results.errors}`));
      }
      
      console.log(chalk.gray(`  ⏱  Duration: ${(results.duration / 1000).toFixed(2)}s`));
      
      if (results.stats) {
        console.log(chalk.bold('\n📈 Database Stats:\n'));
        console.log(chalk.cyan(`  Total files in DB: ${results.stats.filesIndexed}`));
        console.log(chalk.cyan(`  Total functions in DB: ${results.stats.functionsIndexed}`));
      }

      // Disconnect
      await indexer.disconnect();

      console.log(chalk.green('\n✓ Indexing complete!\n'));
      process.exit(0);

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      logger.error({ error: error.message, stack: error.stack }, 'CLI error');
      process.exit(1);
    }
  });

program.parse();


