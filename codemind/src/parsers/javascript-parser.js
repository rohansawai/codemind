import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import BaseParser from './base-parser.js';

/**
 * JavaScript/TypeScript parser using Babel
 * Supports: .js, .jsx, .ts, .tsx, .mjs, .cjs
 */
class JavaScriptParser extends BaseParser {
  constructor(config = {}) {
    super(config);
    this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  }

  canParse(filePath) {
    return this.supportedExtensions.some(ext => filePath.endsWith(ext));
  }

  async parse(filePath, content) {
    const startTime = Date.now();
    this.logger.debug({ filePath }, 'Parsing file');

    try {
      // Parse with Babel - handles JS, JSX, TS, TSX
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'asyncGenerators',
          'dynamicImport',
          'objectRestSpread',
          'optionalChaining',
          'nullishCoalescingOperator',
        ],
        errorRecovery: true, // Continue parsing even with errors
      });

      const functions = [];
      const imports = [];
      const classes = [];

      // Traverse AST and extract functions
      traverse.default(ast, {
        // Function declarations: function foo() {}
        FunctionDeclaration: (path) => {
          const fn = this.extractFunction(path, filePath);
          if (fn) functions.push(fn);
        },

        // Arrow functions and function expressions: const foo = () => {}
        VariableDeclarator: (path) => {
          if (
            path.node.init &&
            (path.node.init.type === 'ArrowFunctionExpression' ||
             path.node.init.type === 'FunctionExpression')
          ) {
            const fn = this.extractFunctionFromVariable(path, filePath);
            if (fn) functions.push(fn);
          }
        },

        // Class methods
        ClassMethod: (path) => {
          const fn = this.extractClassMethod(path, filePath);
          if (fn) functions.push(fn);
        },

        // Object methods: { foo() {} }
        ObjectMethod: (path) => {
          const fn = this.extractObjectMethod(path, filePath);
          if (fn) functions.push(fn);
        },

        // Import statements (for future use)
        ImportDeclaration: (path) => {
          imports.push({
            source: path.node.source.value,
            specifiers: path.node.specifiers.map(s => s.local.name),
            line: path.node.loc?.start.line,
          });
        },
      });

      const parseTime = Date.now() - startTime;
      this.logger.info(
        { filePath, functionCount: functions.length, parseTime },
        'File parsed successfully'
      );

      return { functions, imports, classes };

    } catch (error) {
      this.logger.error(
        { filePath, error: error.message, stack: error.stack },
        'Failed to parse file'
      );
      // Return empty result on parse failure
      return { functions: [], imports: [], classes: [] };
    }
  }

  /**
   * Extract function from FunctionDeclaration node
   */
  extractFunction(path, filePath) {
    try {
      const node = path.node;
      if (!node.id || !node.id.name) return null;

      return {
        name: node.id.name,
        line: node.loc?.start.line || 0,
        endLine: node.loc?.end.line || 0,
        params: node.params.map(p => this.getParamName(p)),
        calls: this.extractFunctionCalls(path),
        isAsync: node.async || false,
        isExported: this.isExported(path),
        type: 'function',
      };
    } catch (error) {
      this.logger.warn({ error: error.message, filePath }, 'Failed to extract function');
      return null;
    }
  }

  /**
   * Extract function from VariableDeclarator (arrow functions, function expressions)
   */
  extractFunctionFromVariable(path, filePath) {
    try {
      const node = path.node;
      if (!node.id || !node.id.name) return null;

      const funcNode = node.init;
      return {
        name: node.id.name,
        line: funcNode.loc?.start.line || 0,
        endLine: funcNode.loc?.end.line || 0,
        params: funcNode.params.map(p => this.getParamName(p)),
        calls: this.extractFunctionCalls(path),
        isAsync: funcNode.async || false,
        isExported: this.isExported(path.parentPath),
        type: 'arrow',
      };
    } catch (error) {
      this.logger.warn({ error: error.message, filePath }, 'Failed to extract variable function');
      return null;
    }
  }

  /**
   * Extract class method
   */
  extractClassMethod(path, filePath) {
    try {
      const node = path.node;
      const className = path.parent.id?.name || 'AnonymousClass';
      const methodName = node.key.name || 'anonymous';
      const fullName = `${className}.${methodName}`;

      return {
        name: fullName,
        line: node.loc?.start.line || 0,
        endLine: node.loc?.end.line || 0,
        params: node.params.map(p => this.getParamName(p)),
        calls: this.extractFunctionCalls(path),
        isAsync: node.async || false,
        isExported: false, // Will be handled at class level
        type: 'method',
        className,
      };
    } catch (error) {
      this.logger.warn({ error: error.message, filePath }, 'Failed to extract class method');
      return null;
    }
  }

  /**
   * Extract object method
   */
  extractObjectMethod(path, filePath) {
    try {
      const node = path.node;
      const methodName = node.key.name || 'anonymous';

      return {
        name: methodName,
        line: node.loc?.start.line || 0,
        endLine: node.loc?.end.line || 0,
        params: node.params.map(p => this.getParamName(p)),
        calls: this.extractFunctionCalls(path),
        isAsync: node.async || false,
        isExported: false,
        type: 'objectMethod',
      };
    } catch (error) {
      this.logger.warn({ error: error.message, filePath }, 'Failed to extract object method');
      return null;
    }
  }

  /**
   * Extract all function calls within a function body
   */
  extractFunctionCalls(path) {
    const calls = new Set();

    path.traverse({
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;
        
        // Direct function call: foo()
        if (callee.type === 'Identifier') {
          calls.add(callee.name);
        }
        
        // Method call: obj.foo()
        else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          calls.add(callee.property.name);
        }
      },
    });

    return Array.from(calls);
  }

  /**
   * Get parameter name (handles destructuring, rest params)
   */
  getParamName(param) {
    if (param.type === 'Identifier') {
      return param.name;
    }
    if (param.type === 'RestElement') {
      return `...${param.argument.name}`;
    }
    if (param.type === 'ObjectPattern') {
      return '{...}'; // Simplified for now
    }
    if (param.type === 'ArrayPattern') {
      return '[...]'; // Simplified for now
    }
    return 'unknown';
  }

  /**
   * Check if function is exported
   */
  isExported(path) {
    let currentPath = path;
    while (currentPath) {
      if (
        currentPath.node.type === 'ExportNamedDeclaration' ||
        currentPath.node.type === 'ExportDefaultDeclaration'
      ) {
        return true;
      }
      currentPath = currentPath.parentPath;
    }
    return false;
  }
}

export default JavaScriptParser;


