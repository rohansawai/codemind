#!/usr/bin/env node

import chalk from 'chalk';
import CodebaseIndexer from '../core/codebase-indexer.js';
import config from '../config/index.js';

/**
 * Stats Dashboard - Visual overview of indexed codebase
 */
class StatsDashboard {
  constructor() {
    this.indexer = null;
  }

  async show() {
    this.indexer = new CodebaseIndexer(config);
    await this.indexer.connect();

    const stats = await this.indexer.getStats();
    const functions = await this.indexer.getAllFunctions();

    // Calculate additional metrics
    const metrics = await this.calculateMetrics(functions);

    this.displayDashboard(stats, metrics);

    await this.indexer.disconnect();
  }

  async calculateMetrics(functions) {
    const metrics = {
      totalFunctions: functions.length,
      functionsWithCallers: 0,
      functionsWithCallees: 0,
      orphanFunctions: 0,
      maxCallDepth: 0,
      avgCallsPerFunction: 0,
      topCallers: [],
      topCalled: [],
    };

    let totalCalls = 0;
    const callerCounts = {};
    const calledCounts = {};

    // Sample first 100 functions for performance
    const sample = functions.slice(0, Math.min(100, functions.length));

    for (const funcName of sample) {
      const info = await this.indexer.queryFunction(funcName);
      if (!info) continue;

      if (info.calls.length > 0) {
        metrics.functionsWithCallees++;
        totalCalls += info.calls.length;
        callerCounts[funcName] = info.calls.length;
      }

      if (info.calledBy.length > 0) {
        metrics.functionsWithCallers++;
        calledCounts[funcName] = info.calledBy.length;
      }

      if (info.calls.length === 0 && info.calledBy.length === 0) {
        metrics.orphanFunctions++;
      }
    }

    metrics.avgCallsPerFunction = sample.length > 0 ? (totalCalls / sample.length).toFixed(2) : 0;

    // Top callers (functions that call the most)
    metrics.topCallers = Object.entries(callerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top called (functions called most often)
    metrics.topCalled = Object.entries(calledCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return metrics;
  }

  displayDashboard(stats, metrics) {
    console.log(chalk.bold.cyan('\n📊 CodeMind Stats Dashboard\n'));
    console.log(chalk.gray('─'.repeat(60)));

    // Basic Stats
    console.log(chalk.bold('\n📁 Database Overview'));
    console.log(chalk.cyan(`  Files indexed:      ${stats.filesIndexed}`));
    console.log(chalk.cyan(`  Functions indexed:  ${stats.functionsIndexed}`));
    console.log(chalk.gray(`  Last updated:       ${new Date(stats.timestamp).toLocaleString()}`));

    // Function Metrics
    console.log(chalk.bold('\n🔗 Call Graph Metrics'));
    console.log(chalk.cyan(`  Functions with calls out: ${metrics.functionsWithCallees}`));
    console.log(chalk.cyan(`  Functions with calls in:  ${metrics.functionsWithCallers}`));
    console.log(chalk.yellow(`  Orphan functions:         ${metrics.orphanFunctions}`));
    console.log(chalk.cyan(`  Avg calls per function:   ${metrics.avgCallsPerFunction}`));

    // Top Callers
    if (metrics.topCallers.length > 0) {
      console.log(chalk.bold('\n📤 Top Callers (most outgoing calls)'));
      metrics.topCallers.forEach(({ name, count }) => {
        const bar = '█'.repeat(Math.min(count, 20));
        console.log(chalk.green(`  ${name.padEnd(30)} ${bar} ${count}`));
      });
    }

    // Top Called
    if (metrics.topCalled.length > 0) {
      console.log(chalk.bold('\n📥 Top Called (most incoming calls)'));
      metrics.topCalled.forEach(({ name, count }) => {
        const bar = '█'.repeat(Math.min(count, 20));
        console.log(chalk.blue(`  ${name.padEnd(30)} ${bar} ${count}`));
      });
    }

    // Health Score
    const healthScore = this.calculateHealthScore(stats, metrics);
    console.log(chalk.bold('\n💚 Codebase Health Score'));
    console.log(this.getHealthBar(healthScore));
    console.log(chalk.gray(`  ${healthScore}/100 - ${this.getHealthDescription(healthScore)}`));

    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.gray('  Based on sample of 100 functions\n'));
  }

  calculateHealthScore(stats, metrics) {
    let score = 50; // Base score

    // More functions = better (up to +20)
    if (stats.functionsIndexed > 100) score += 10;
    if (stats.functionsIndexed > 500) score += 10;

    // Low orphan rate = better (up to +20)
    const orphanRate = metrics.orphanFunctions / Math.max(1, metrics.totalFunctions);
    if (orphanRate < 0.1) score += 20;
    else if (orphanRate < 0.3) score += 10;

    // Good connectivity = better (up to +10)
    if (metrics.avgCallsPerFunction > 2) score += 10;

    return Math.min(100, score);
  }

  getHealthBar(score) {
    const bars = Math.floor(score / 10);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(10 - bars);
    
    let color = chalk.red;
    if (score >= 70) color = chalk.green;
    else if (score >= 50) color = chalk.yellow;

    return color(`  ${filled}${empty} ${score}%`);
  }

  getHealthDescription(score) {
    if (score >= 80) return 'Excellent connectivity';
    if (score >= 60) return 'Good structure';
    if (score >= 40) return 'Fair connectivity';
    return 'Low connectivity detected';
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new StatsDashboard();
  dashboard.show().catch((error) => {
    console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  });
}

export default StatsDashboard;

