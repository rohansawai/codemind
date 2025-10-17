#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import CodebaseIndexer from '../core/codebase-indexer.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const program = new Command();

program
  .name('codemind-query')
  .description('Query indexed codebase')
  .option('--redis-url <url>', 'Redis URL', process.env.REDIS_URL);

// Find function command
program
  .command('find <functionName>')
  .description('Find a function and show its details')
  .action(async (functionName, options, command) => {
    const indexer = await setupIndexer(command.parent.opts());
    
    try {
      console.log(chalk.bold.cyan(`\n🔍 Looking for function: ${functionName}\n`));
      
      const info = await indexer.queryFunction(functionName);
      
      if (!info) {
        console.log(chalk.yellow(`Function "${functionName}" not found\n`));
        await indexer.disconnect();
        process.exit(0);
      }

      console.log(chalk.bold('Function Details:'));
      console.log(chalk.gray(`  File: ${info.file}`));
      console.log(chalk.gray(`  Line: ${info.line}-${info.endLine}`));
      console.log(chalk.gray(`  Type: ${info.type}`));
      console.log(chalk.gray(`  Params: ${info.params.join(', ') || 'none'}`));
      console.log(chalk.gray(`  Async: ${info.isAsync ? 'yes' : 'no'}`));
      console.log(chalk.gray(`  Exported: ${info.isExported ? 'yes' : 'no'}`));
      
      if (info.calls.length > 0) {
        console.log(chalk.bold('\nCalls:'));
        info.calls.forEach(fn => console.log(chalk.cyan(`  → ${fn}`)));
      }
      
      if (info.calledBy.length > 0) {
        console.log(chalk.bold('\nCalled by:'));
        info.calledBy.forEach(fn => console.log(chalk.green(`  ← ${fn}`)));
      }
      
      console.log();
      await indexer.disconnect();

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      await indexer.disconnect();
      process.exit(1);
    }
  });

// Trace dependencies command
program
  .command('trace <functionName>')
  .description('Trace all dependencies of a function')
  .option('-d, --depth <number>', 'Maximum depth', '5')
  .action(async (functionName, options, command) => {
    const indexer = await setupIndexer(command.parent.opts());
    
    try {
      const depth = parseInt(options.depth, 10);
      console.log(chalk.bold.cyan(`\n🔗 Tracing dependencies: ${functionName} (depth: ${depth})\n`));
      
      const tree = await indexer.traceDependencies(functionName, depth);
      
      printDependencyTree(tree, 0);
      
      console.log();
      await indexer.disconnect();

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      await indexer.disconnect();
      process.exit(1);
    }
  });

// Find affected command
program
  .command('affected <functionName>')
  .description('Find all functions affected if this function changes')
  .option('-d, --depth <number>', 'Maximum depth', '5')
  .action(async (functionName, options, command) => {
    const indexer = await setupIndexer(command.parent.opts());
    
    try {
      const depth = parseInt(options.depth, 10);
      console.log(chalk.bold.cyan(`\n⚠️  Finding affected functions: ${functionName} (depth: ${depth})\n`));
      
      const affected = await indexer.findAffected(functionName, depth);
      
      if (affected.length === 0) {
        console.log(chalk.gray('No functions would be affected\n'));
      } else {
        console.log(chalk.yellow(`${affected.length} functions would be affected:\n`));
        affected.forEach(fn => console.log(chalk.yellow(`  ⚠️  ${fn}`)));
        console.log();
      }
      
      await indexer.disconnect();

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      await indexer.disconnect();
      process.exit(1);
    }
  });

// List all functions command
program
  .command('list')
  .description('List all indexed functions')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options, command) => {
    const indexer = await setupIndexer(command.parent.opts());
    
    try {
      console.log(chalk.bold.cyan('\n📋 Listing indexed functions...\n'));
      
      const functions = await indexer.getAllFunctions();
      const limit = parseInt(options.limit, 10);
      
      console.log(chalk.gray(`Total functions: ${functions.length}\n`));
      
      const displayFunctions = functions.slice(0, limit);
      displayFunctions.forEach(fn => console.log(chalk.cyan(`  • ${fn}`)));
      
      if (functions.length > limit) {
        console.log(chalk.gray(`\n  ... and ${functions.length - limit} more`));
      }
      
      console.log();
      await indexer.disconnect();

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      await indexer.disconnect();
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show indexing statistics')
  .action(async (options, command) => {
    const indexer = await setupIndexer(command.parent.opts());
    
    try {
      console.log(chalk.bold.cyan('\n📊 Database Statistics\n'));
      
      const stats = await indexer.getStats();
      
      console.log(chalk.cyan(`  Files indexed: ${stats.filesIndexed}`));
      console.log(chalk.cyan(`  Functions indexed: ${stats.functionsIndexed}`));
      console.log(chalk.gray(`  Last updated: ${new Date(stats.timestamp).toLocaleString()}`));
      
      console.log();
      await indexer.disconnect();

    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      await indexer.disconnect();
      process.exit(1);
    }
  });

/**
 * Setup indexer with config
 */
async function setupIndexer(options) {
  if (options.redisUrl) {
    config.redis.url = options.redisUrl;
  }
  
  const indexer = new CodebaseIndexer(config);
  await indexer.connect();
  return indexer;
}

/**
 * Print dependency tree recursively
 */
function printDependencyTree(node, indent) {
  const prefix = '  '.repeat(indent);
  const symbol = indent === 0 ? '●' : '→';
  console.log(chalk.cyan(`${prefix}${symbol} ${node.function}`));
  
  for (const dep of node.dependencies) {
    printDependencyTree(dep, indent + 1);
  }
}

program.parse();


