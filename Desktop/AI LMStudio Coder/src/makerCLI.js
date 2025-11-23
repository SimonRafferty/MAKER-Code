#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Core components
import LMStudioClient from './core/lmstudioClient.js';
import TokenCounter from './core/tokenCounter.js';
import FileOperations from './core/fileOperations.js';

// MAKER components
import MicroagentExecutor from './maker/MicroagentExecutor.js';
import VotingManager from './maker/VotingManager.js';
import TaskDecomposer from './maker/TaskDecomposer.js';
import ResponseValidator from './maker/ResponseValidator.js';
import CodeClusterer from './maker/CodeClusterer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MAKER CLI - Command-line interface for MAKER framework
 * Provides reliable code generation using voting and task decomposition
 */
class MAKERCLI {
  constructor() {
    this.config = this.loadConfig();
    this.rootPath = process.cwd();

    // Initialize core components
    this.lmstudioClient = new LMStudioClient(this.config.lmstudio);
    this.tokenCounter = new TokenCounter();
    this.fileOps = new FileOperations(this.rootPath);

    // Initialize MAKER components
    this.executor = new MicroagentExecutor(
      this.lmstudioClient,
      this.tokenCounter,
      this.fileOps
    );
    this.votingManager = new VotingManager(this.lmstudioClient, this.tokenCounter);
    this.validator = new ResponseValidator(this.tokenCounter);
    this.clusterer = new CodeClusterer(this.tokenCounter);

    // State
    this.running = false;
    this.mode = 'normal'; // 'normal' or 'maker'
  }

  /**
   * Load configuration
   */
  loadConfig() {
    // Default config
    return {
      lmstudio: {
        baseURL: 'http://localhost:1234/v1',
        temperature: 0.7,
      },
      maker: {
        defaultK: 3,
        similarityThreshold: 0.7,
        maxCandidates: 5,
      },
    };
  }

  /**
   * Start the CLI
   */
  async start() {
    this.showWelcome();

    // Test connection to LMStudio
    try {
      await this.lmstudioClient.testConnection();
      console.log(chalk.green('✓ Connected to LMStudio\n'));
    } catch (error) {
      console.error(chalk.red('✗ Failed to connect to LMStudio:'), error.message);
      console.log(chalk.yellow('\nPlease make sure:'));
      console.log('  1. LMStudio is running');
      console.log('  2. A model is loaded');
      console.log('  3. The local server is started\n');
      process.exit(1);
    }

    // Fetch model capabilities
    try {
      await this.lmstudioClient.fetchModelCapabilities();
      const contextWindow = this.lmstudioClient.getContextWindow();

      if (contextWindow) {
        console.log(chalk.blue(`Model: ${this.lmstudioClient.model}`));
        console.log(chalk.blue(`Context window: ${contextWindow} tokens\n`));
      } else {
        console.log(chalk.yellow('⚠ Could not detect context window size'));
        console.log(chalk.yellow('  Use /context <size> to set it manually\n'));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠ Could not fetch model info:'), error.message);
      console.log(chalk.yellow('  Use /context <size> to set context window\n'));
    }

    // Start main loop
    this.running = true;
    await this.mainLoop();
  }

  /**
   * Show welcome message
   */
  showWelcome() {
    console.clear();
    console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.cyan('  MAKER - Reliable Code Generation Framework'));
    console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    console.log('  Maximal Agentic decomposition');
    console.log('  first-to-ahead-by-K Error correction');
    console.log('  Red-flagging\n');
    console.log(chalk.dim('  Type /help for available commands'));
    console.log(chalk.dim('  Type /mode to toggle MAKER mode'));
    console.log(chalk.dim('  Type exit to quit\n'));
  }

  /**
   * Main input loop
   */
  async mainLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        rl.prompt();
        return;
      }

      // Handle exit
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(chalk.yellow('\nGoodbye!\n'));
        rl.close();
        process.exit(0);
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
        rl.prompt();
        return;
      }

      // Handle queries
      try {
        await this.handleQuery(trimmed);
      } catch (error) {
        console.error(chalk.red('\n✗ Error:'), error.message);
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log(chalk.yellow('\nGoodbye!\n'));
      process.exit(0);
    });
  }

  /**
   * Get command prompt
   */
  getPrompt() {
    const modeIndicator = this.mode === 'maker' ? chalk.cyan('[MAKER]') : chalk.dim('[Normal]');
    return `${modeIndicator} ${chalk.green('>')} `;
  }

  /**
   * Handle commands
   */
  async handleCommand(command) {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;

      case 'context':
        await this.setContextLength(args);
        break;

      case 'mode':
        this.toggleMode();
        break;

      case 'config':
        this.showConfig();
        break;

      case 'k':
        this.setKValue(args);
        break;

      case 'test':
        await this.testVoting();
        break;

      default:
        console.log(chalk.red(`Unknown command: /${cmd}`));
        console.log(chalk.dim('Type /help for available commands'));
    }
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.bold('\nAvailable Commands:\n'));
    console.log(chalk.cyan('  /help') + '              Show this help message');
    console.log(chalk.cyan('  /context <size>') + '   Set context window size');
    console.log(chalk.cyan('  /mode') + '              Toggle MAKER mode on/off');
    console.log(chalk.cyan('  /config') + '            Show current configuration');
    console.log(chalk.cyan('  /k <value>') + '         Set voting threshold (k)');
    console.log(chalk.cyan('  /test') + '              Test voting with simple task');
    console.log(chalk.cyan('  exit') + '               Exit the program\n');

    console.log(chalk.bold('Modes:\n'));
    console.log(chalk.yellow('  Normal:') + '  Direct LLM queries (fast, less reliable)');
    console.log(chalk.yellow('  MAKER:') + '   Full MAKER framework (slower, more reliable)\n');

    console.log(chalk.bold('Usage:\n'));
    console.log('  In Normal mode: Ask questions directly');
    console.log('  In MAKER mode: Describe coding tasks for decomposition + voting\n');
  }

  /**
   * Set context length
   */
  async setContextLength(args) {
    if (args.length === 0) {
      const current = this.lmstudioClient.getContextWindow();
      console.log(chalk.blue(`\nCurrent context window: ${current || 'not set'} tokens`));
      console.log(chalk.dim('Usage: /context <size>\n'));
      return;
    }

    const contextValue = parseInt(args[0], 10);

    if (isNaN(contextValue) || contextValue <= 0) {
      console.log(chalk.red('\n✗ Invalid context size. Must be a positive number.\n'));
      return;
    }

    this.lmstudioClient.contextWindow = contextValue;
    console.log(chalk.green(`\n✓ Context window set to ${contextValue} tokens\n`));
  }

  /**
   * Toggle mode
   */
  toggleMode() {
    this.mode = this.mode === 'normal' ? 'maker' : 'normal';
    console.log(chalk.green(`\n✓ Switched to ${this.mode.toUpperCase()} mode\n`));

    if (this.mode === 'maker') {
      console.log(chalk.dim('  MAKER mode uses:'));
      console.log(chalk.dim('  - Task decomposition into atomic steps'));
      console.log(chalk.dim('  - Multi-candidate voting (k=' + this.config.maker.defaultK + ')'));
      console.log(chalk.dim('  - Red-flagging for quality control'));
      console.log(chalk.dim('  - Higher reliability, more API calls\n'));
    } else {
      console.log(chalk.dim('  Normal mode: Direct queries without voting\n'));
    }
  }

  /**
   * Show configuration
   */
  showConfig() {
    console.log(chalk.bold('\nCurrent Configuration:\n'));
    console.log(chalk.cyan('LMStudio:'));
    console.log(`  Base URL: ${this.lmstudioClient.baseURL}`);
    console.log(`  Model: ${this.lmstudioClient.model}`);
    console.log(`  Context window: ${this.lmstudioClient.getContextWindow() || 'not set'}`);
    console.log(`  Temperature: ${this.lmstudioClient.temperature}`);

    console.log(chalk.cyan('\nMAKER:'));
    console.log(`  Mode: ${this.mode}`);
    console.log(`  Default k: ${this.config.maker.defaultK}`);
    console.log(`  Similarity threshold: ${this.config.maker.similarityThreshold}`);
    console.log(`  Max candidates: ${this.config.maker.maxCandidates}\n`);
  }

  /**
   * Set k value
   */
  setKValue(args) {
    if (args.length === 0) {
      console.log(chalk.blue(`\nCurrent k value: ${this.config.maker.defaultK}`));
      console.log(chalk.dim('Usage: /k <value>\n'));
      return;
    }

    const k = parseInt(args[0], 10);

    if (isNaN(k) || k < 1 || k > 10) {
      console.log(chalk.red('\n✗ Invalid k value. Must be between 1 and 10.\n'));
      return;
    }

    this.config.maker.defaultK = k;
    console.log(chalk.green(`\n✓ Voting threshold (k) set to ${k}\n`));
  }

  /**
   * Test voting
   */
  async testVoting() {
    console.log(chalk.bold('\n━━━ Voting Test ━━━\n'));

    const testMessages = [
      {
        role: 'system',
        content: 'You are a helpful coding assistant. Write clean, minimal code.',
      },
      {
        role: 'user',
        content: 'Write a JavaScript function that checks if a number is prime.',
      },
    ];

    try {
      const result = await this.votingManager.vote(testMessages, {
        type: 'code',
        expectedLength: 150,
      }, {
        k: this.config.maker.defaultK,
        maxCandidates: 5,
      });

      console.log(chalk.bold('\n━━━ Result ━━━\n'));
      console.log(result.winner);
      console.log(chalk.dim(`\nConfidence: ${(result.confidence * 100).toFixed(1)}%`));
      console.log(chalk.dim(`Votes: ${result.votingStats.winnerVotes}/${result.votingStats.validCandidates}`));
      console.log(chalk.dim(`Clusters: ${result.votingStats.clusterCount}\n`));

    } catch (error) {
      console.error(chalk.red('\n✗ Test failed:'), error.message, '\n');
    }
  }

  /**
   * Handle user query
   */
  async handleQuery(query) {
    if (this.mode === 'maker') {
      await this.handleMAKERQuery(query);
    } else {
      await this.handleNormalQuery(query);
    }
  }

  /**
   * Handle MAKER mode query
   */
  async handleMAKERQuery(query) {
    console.log(chalk.dim('\n[Using MAKER framework]\n'));

    try {
      const result = await this.executor.executeTask(query, {
        rootPath: this.rootPath,
      }, {
        useAI: true,
        maxCandidates: this.config.maker.maxCandidates,
        temperature: 0.7,
      });

      console.log(chalk.bold('\n━━━ Task Complete ━━━\n'));
      console.log(chalk.green(`Success rate: ${(result.successRate * 100).toFixed(1)}%`));
      console.log(chalk.green(`Average confidence: ${(result.avgConfidence * 100).toFixed(1)}%`));
      console.log(chalk.green(`Completed: ${result.completed}/${result.totalSubtasks} subtasks\n`));

    } catch (error) {
      console.error(chalk.red('\n✗ Execution failed:'), error.message, '\n');
    }
  }

  /**
   * Handle normal mode query
   */
  async handleNormalQuery(query) {
    console.log(''); // Blank line before response

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful coding assistant. Provide clear, concise answers.',
      },
      {
        role: 'user',
        content: query,
      },
    ];

    try {
      let responseText = '';

      const response = await this.lmstudioClient.complete(messages, {
        temperature: 0.7,
        onProgress: (tokens, text) => {
          // Clear line and show progress
          process.stdout.write(`\r${chalk.dim(`[${tokens} tokens]`)} ${text.slice(-60)}`);
        },
      });

      responseText = response.content;

      // Clear progress line
      process.stdout.write('\r' + ' '.repeat(100) + '\r');

      console.log(responseText);

      const usage = this.lmstudioClient.getLastUsage();
      if (usage) {
        console.log(chalk.dim(`\n[Tokens: ${usage.totalTokens}]`));
      }

      console.log(''); // Blank line after response

    } catch (error) {
      console.error(chalk.red('\n✗ Query failed:'), error.message, '\n');
    }
  }
}

// Main entry point
const cli = new MAKERCLI();
cli.start().catch((error) => {
  console.error(chalk.red('\n✗ Fatal error:'), error.message, '\n');
  process.exit(1);
});
