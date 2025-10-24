import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import CodebaseIndexer from '../core/codebase-indexer.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * CodeMind MCP Server
 * Provides AI assistants with tools to query code structure
 */
class CodeMindMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'codemind',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.indexer = null;
    this.logger = logger.child({ component: 'MCPServer' });
    
    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  /**
   * Initialize the indexer and connect to Redis
   */
  async initialize() {
    try {
      this.indexer = new CodebaseIndexer(config);
      await this.indexer.connect();
      this.logger.info('MCP Server initialized and connected to Redis');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize MCP server');
      throw error;
    }
  }

  /**
   * Setup tool request handlers
   */
  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'index_codebase',
            description: 'Index a codebase to build function call graph. Returns statistics about indexed functions.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to the codebase root directory',
                },
                force: {
                  type: 'boolean',
                  description: 'Force re-index all files (default: false, only indexes changed files)',
                  default: false,
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'find_function',
            description: 'Find a function by name and get its details: file location, line number, parameters, what it calls, and what calls it.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Function name to search for (e.g., "processPayment" or "AnonymousClass.methodName")',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'trace_dependencies',
            description: 'Trace all functions that a given function calls (recursively). Shows the full dependency tree.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Function name to trace dependencies for',
                },
                depth: {
                  type: 'number',
                  description: 'Maximum depth to trace (default: 5)',
                  default: 5,
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'find_affected',
            description: 'Find all functions that would be affected if the given function changes. Shows reverse dependencies (what calls this).',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Function name to find affected functions for',
                },
                depth: {
                  type: 'number',
                  description: 'Maximum depth to search (default: 5)',
                  default: 5,
                },
              },
              required: ['name'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'index_codebase':
            return await this.handleIndexCodebase(args);
          
          case 'find_function':
            return await this.handleFindFunction(args);
          
          case 'trace_dependencies':
            return await this.handleTraceDependencies(args);
          
          case 'find_affected':
            return await this.handleFindAffected(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(
          { error: error.message, tool: name, args },
          'Tool execution failed'
        );
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Handle index_codebase tool
   */
  async handleIndexCodebase(args) {
    const { path, force = false } = args;
    
    this.logger.info({ path, force }, 'Indexing codebase');

    const results = await this.indexer.indexCodebase(path, { force });

    const response = `✅ Codebase indexed successfully!

📊 Results:
  • Files processed: ${results.filesProcessed}
  • Files skipped: ${results.filesSkipped}
  • Functions indexed: ${results.functionsIndexed}
  • Errors: ${results.errors}
  • Duration: ${(results.duration / 1000).toFixed(2)}s

📈 Total in database:
  • Files: ${results.stats.filesIndexed}
  • Functions: ${results.stats.functionsIndexed}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  /**
   * Handle find_function tool
   */
  async handleFindFunction(args) {
    const { name } = args;
    
    this.logger.info({ functionName: name }, 'Finding function');

    const info = await this.indexer.queryFunction(name);

    if (!info) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Function "${name}" not found in indexed codebase.`,
          },
        ],
      };
    }

    const response = `📍 Function: ${name}

📄 Location:
  • File: ${info.file}
  • Lines: ${info.line}-${info.endLine}
  • Type: ${info.type}
  • Async: ${info.isAsync ? 'yes' : 'no'}
  • Exported: ${info.isExported ? 'yes' : 'no'}

📝 Parameters:
  ${info.params.length > 0 ? info.params.join(', ') : 'none'}

➡️  Calls (${info.calls.length}):
  ${info.calls.length > 0 ? info.calls.map(fn => `• ${fn}`).join('\n  ') : '• none'}

⬅️  Called by (${info.calledBy.length}):
  ${info.calledBy.length > 0 ? info.calledBy.map(fn => `• ${fn}`).join('\n  ') : '• none'}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  /**
   * Handle trace_dependencies tool
   */
  async handleTraceDependencies(args) {
    const { name, depth = 5 } = args;
    
    this.logger.info({ functionName: name, depth }, 'Tracing dependencies');

    const tree = await this.indexer.traceDependencies(name, depth);

    const formatTree = (node, indent = 0) => {
      const prefix = '  '.repeat(indent);
      const symbol = indent === 0 ? '●' : '→';
      let result = `${prefix}${symbol} ${node.function}\n`;
      
      for (const dep of node.dependencies) {
        result += formatTree(dep, indent + 1);
      }
      
      return result;
    };

    const response = `🔗 Dependency tree for: ${name}\n(depth: ${depth})\n\n${formatTree(tree)}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  /**
   * Handle find_affected tool
   */
  async handleFindAffected(args) {
    const { name, depth = 5 } = args;
    
    this.logger.info({ functionName: name, depth }, 'Finding affected functions');

    const affected = await this.indexer.findAffected(name, depth);

    if (affected.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ No functions would be directly affected by changes to "${name}".`,
          },
        ],
      };
    }

    const response = `⚠️  ${affected.length} function(s) would be affected by changes to "${name}":\n\n${affected.map(fn => `  • ${fn}`).join('\n')}`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  /**
   * Setup error handlers
   */
  setupErrorHandlers() {
    this.server.onerror = (error) => {
      this.logger.error({ error: error.message }, 'MCP Server error');
    };

    process.on('SIGINT', async () => {
      this.logger.info('Shutting down MCP server');
      if (this.indexer) {
        await this.indexer.disconnect();
      }
      process.exit(0);
    });
  }

  /**
   * Start the MCP server
   */
  async run() {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('MCP Server running on stdio');
  }
}

// Start server
const server = new CodeMindMCPServer();
server.run().catch((error) => {
  logger.error({ error: error.message }, 'Failed to start MCP server');
  process.exit(1);
});


