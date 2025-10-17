#!/usr/bin/env node

import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import CodebaseIndexer from '../core/codebase-indexer.js';
import config from '../config/index.js';
import { paginate, formatPaginationInfo } from '../utils/pagination.js';

/**
 * Interactive CLI for CodeMind
 * User-friendly prompts for all operations
 */
class InteractiveCLI {
  constructor() {
    this.indexer = null;
  }

  async start() {
    console.log(chalk.bold.cyan('\n🧠 CodeMind - Interactive Mode\n'));

    this.indexer = new CodebaseIndexer(config);
    await this.indexer.connect();

    await this.mainMenu();
  }

  async mainMenu() {
    const choice = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '📁 Index a codebase', value: 'index' },
        { name: '🔍 Find a function', value: 'find' },
        { name: '🔗 Trace dependencies', value: 'trace' },
        { name: '⚠️  Find affected functions', value: 'affected' },
        { name: '📋 List all functions', value: 'list' },
        { name: '📊 Show stats', value: 'stats' },
        { name: '🚪 Exit', value: 'exit' },
      ],
    });

    switch (choice) {
      case 'index':
        await this.indexCodebase();
        break;
      case 'find':
        await this.findFunction();
        break;
      case 'trace':
        await this.traceDependencies();
        break;
      case 'affected':
        await this.findAffected();
        break;
      case 'list':
        await this.listFunctions();
        break;
      case 'stats':
        await this.showStats();
        break;
      case 'exit':
        await this.indexer.disconnect();
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
    }

    // Return to main menu
    await this.mainMenu();
  }

  async indexCodebase() {
    const path = await input({
      message: 'Enter codebase path:',
      default: '.',
    });

    const force = await confirm({
      message: 'Force re-index all files? (Otherwise only changed files)',
      default: false,
    });

    const results = await this.indexer.indexCodebase(path, { force });

    console.log(chalk.bold('\n📊 Results:\n'));
    console.log(chalk.cyan(`  Files processed: ${results.filesProcessed}`));
    console.log(chalk.gray(`  Files skipped: ${results.filesSkipped}`));
    console.log(chalk.green(`  Functions indexed: ${results.functionsIndexed}`));
    if (results.errors > 0) {
      console.log(chalk.red(`  Errors: ${results.errors}`));
    }
    console.log();
  }

  async findFunction() {
    const name = await input({
      message: 'Enter function name:',
    });

    const spinner = ora('Searching...').start();
    const info = await this.indexer.queryFunction(name);
    spinner.stop();

    if (!info) {
      console.log(chalk.yellow(`\n❌ Function "${name}" not found\n`));
      return;
    }

    console.log(chalk.bold(`\n📍 Function: ${name}\n`));
    console.log(chalk.gray(`  File: ${info.file}`));
    console.log(chalk.gray(`  Lines: ${info.line}-${info.endLine}`));
    console.log(chalk.gray(`  Type: ${info.type}`));
    console.log(chalk.gray(`  Params: ${info.params.join(', ') || 'none'}`));
    
    if (info.calls.length > 0) {
      console.log(chalk.bold('\n  Calls:'));
      info.calls.forEach(fn => console.log(chalk.cyan(`    → ${fn}`)));
    }
    
    if (info.calledBy.length > 0) {
      console.log(chalk.bold('\n  Called by:'));
      info.calledBy.forEach(fn => console.log(chalk.green(`    ← ${fn}`)));
    }
    console.log();
  }

  async traceDependencies() {
    const name = await input({
      message: 'Enter function name:',
    });

    const depth = parseInt(await input({
      message: 'Maximum depth:',
      default: '5',
    }), 10);

    const spinner = ora('Tracing dependencies...').start();
    const tree = await this.indexer.traceDependencies(name, depth);
    spinner.stop();

    console.log(chalk.bold.cyan(`\n🔗 Dependency tree:\n`));
    this.printTree(tree, 0);
    console.log();
  }

  printTree(node, indent) {
    const prefix = '  '.repeat(indent);
    const symbol = indent === 0 ? '●' : '→';
    console.log(chalk.cyan(`${prefix}${symbol} ${node.function}`));
    
    for (const dep of node.dependencies) {
      this.printTree(dep, indent + 1);
    }
  }

  async findAffected() {
    const name = await input({
      message: 'Enter function name:',
    });

    const depth = parseInt(await input({
      message: 'Maximum depth:',
      default: '5',
    }), 10);

    const spinner = ora('Finding affected functions...').start();
    const affected = await this.indexer.findAffected(name, depth);
    spinner.stop();

    if (affected.length === 0) {
      console.log(chalk.green(`\n✅ No functions affected by "${name}"\n`));
      return;
    }

    console.log(chalk.bold.yellow(`\n⚠️  ${affected.length} functions would be affected:\n`));
    affected.forEach(fn => console.log(chalk.yellow(`  • ${fn}`)));
    console.log();
  }

  async listFunctions() {
    const spinner = ora('Loading functions...').start();
    const functions = await this.indexer.getAllFunctions();
    spinner.stop();

    const pageSize = 20;
    const result = paginate(functions, 1, pageSize);

    this.displayPage(result);

    if (result.pagination.hasNextPage) {
      const showMore = await confirm({
        message: `Show next ${pageSize} results?`,
        default: true,
      });

      if (showMore) {
        await this.showMoreFunctions(functions, 2, pageSize);
      }
    }
  }

  async showMoreFunctions(allFunctions, page, pageSize) {
    const result = paginate(allFunctions, page, pageSize);
    this.displayPage(result);

    if (result.pagination.hasNextPage) {
      const showMore = await confirm({
        message: `Show next ${pageSize} results?`,
        default: true,
      });

      if (showMore) {
        await this.showMoreFunctions(allFunctions, page + 1, pageSize);
      }
    }
  }

  displayPage(result) {
    console.log(chalk.bold.cyan(`\n📋 Functions (${formatPaginationInfo(result.pagination)}):\n`));
    result.items.forEach(fn => console.log(chalk.cyan(`  • ${fn}`)));
    console.log();
  }

  async showStats() {
    const spinner = ora('Loading stats...').start();
    const stats = await this.indexer.getStats();
    spinner.stop();

    console.log(chalk.bold.cyan('\n📊 Database Statistics\n'));
    console.log(chalk.cyan(`  Files indexed: ${stats.filesIndexed}`));
    console.log(chalk.cyan(`  Functions indexed: ${stats.functionsIndexed}`));
    console.log(chalk.gray(`  Last updated: ${new Date(stats.timestamp).toLocaleString()}`));
    console.log();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new InteractiveCLI();
  cli.start().catch((error) => {
    console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  });
}

export default InteractiveCLI;

