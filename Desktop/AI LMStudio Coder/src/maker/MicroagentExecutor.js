import VotingManager from './VotingManager.js';
import TaskDecomposer from './TaskDecomposer.js';

/**
 * MicroagentExecutor - Executes subtasks with minimal context
 * Orchestrates the complete MAKER workflow
 *
 * Core execution loop:
 * 1. Get next subtask from decomposition
 * 2. Build minimal context (only what's needed)
 * 3. Generate candidates using VotingManager
 * 4. Apply the winning solution
 * 5. Verify and track progress
 *
 * Key principle: Each agent sees only the context needed for its specific step
 * This improves reliability by reducing confusion from irrelevant information
 */
class MicroagentExecutor {
  constructor(lmstudioClient, tokenCounter, fileOps) {
    this.lmstudioClient = lmstudioClient;
    this.tokenCounter = tokenCounter;
    this.fileOps = fileOps;

    this.votingManager = new VotingManager(lmstudioClient, tokenCounter);
    this.decomposer = new TaskDecomposer(lmstudioClient, tokenCounter);

    // Execution state
    this.currentPlan = null;
    this.executionLog = [];
  }

  /**
   * Execute a complex task using MAKER framework
   *
   * @param {string} taskDescription - High-level task
   * @param {Object} context - Initial context (files, codebase, etc.)
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeTask(taskDescription, context = {}, options = {}) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  MAKER Framework Execution');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    this.executionLog = [];

    // Step 1: Decompose task
    console.log('[Phase 1] Maximal Agentic Decomposition...');
    this.currentPlan = await this.decomposer.decompose(taskDescription, context, {
      useAI: options.useAI !== false,
    });

    // Step 2: Calculate optimal k for voting
    const k = this.votingManager.calculateOptimalK(
      this.currentPlan.complexity.totalSteps,
      options.baseReliability || 0.7
    );

    console.log(`\n[Phase 2] Execution with k=${k} voting threshold`);
    console.log(`  Total subtasks: ${this.currentPlan.subtasks.length}`);
    console.log(`  Execution order: ${this.currentPlan.executionOrder.join(' → ')}\n`);

    // Step 3: Execute subtasks in order
    let completedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const taskId of this.currentPlan.executionOrder) {
      const subtask = this.currentPlan.subtasks.find(t => t.id === taskId);

      if (!subtask) continue;

      console.log(`\n[Subtask ${taskId}/${this.currentPlan.subtasks.length}] ${subtask.description}`);

      try {
        // Build minimal context for this subtask
        const minimalContext = await this._buildMinimalContext(subtask, context, results);

        // Execute with voting
        const result = await this._executeSubtask(subtask, minimalContext, {
          k: options.criticalTask ? k + 1 : k,
          maxCandidates: options.maxCandidates || 5,
          temperature: options.temperature || 0.7,
        });

        // Apply result
        if (result.votingResult.reliable) {
          await this._applyResult(subtask, result.votingResult.winner, context);
          completedCount++;

          this.executionLog.push({
            taskId,
            subtask: subtask.description,
            status: 'success',
            confidence: result.votingResult.confidence,
            votingStats: result.votingResult.votingStats,
            timestamp: new Date().toISOString(),
          });

          results.push({
            subtask,
            result: result.votingResult.winner,
            confidence: result.votingResult.confidence,
          });

          console.log(`  ✓ Completed with confidence: ${(result.votingResult.confidence * 100).toFixed(1)}%`);
        } else {
          // Low confidence - may want to retry or flag for review
          console.warn(`  ⚠ Low confidence result (${(result.votingResult.confidence * 100).toFixed(1)}%)`);

          if (options.requireHighConfidence) {
            throw new Error(`Subtask failed confidence threshold: ${result.votingResult.warning}`);
          }

          // Apply anyway but log warning
          await this._applyResult(subtask, result.votingResult.winner, context);
          completedCount++;

          this.executionLog.push({
            taskId,
            subtask: subtask.description,
            status: 'warning',
            confidence: result.votingResult.confidence,
            warning: result.votingResult.warning,
            votingStats: result.votingResult.votingStats,
            timestamp: new Date().toISOString(),
          });

          results.push({
            subtask,
            result: result.votingResult.winner,
            confidence: result.votingResult.confidence,
            warning: result.votingResult.warning,
          });
        }

        // Mark as completed
        this.currentPlan.subtasks = this.decomposer.completeSubtask(
          this.currentPlan.subtasks,
          taskId
        );

      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
        errorCount++;

        this.executionLog.push({
          taskId,
          subtask: subtask.description,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        if (options.stopOnError) {
          throw error;
        }
      }
    }

    // Step 4: Generate summary
    const summary = {
      task: taskDescription,
      totalSubtasks: this.currentPlan.subtasks.length,
      completed: completedCount,
      errors: errorCount,
      successRate: completedCount / this.currentPlan.subtasks.length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      executionLog: this.executionLog,
      results,
    };

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Execution Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg confidence: ${(summary.avgConfidence * 100).toFixed(1)}%`);
    console.log(`  Completed: ${completedCount}/${this.currentPlan.subtasks.length}`);
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return summary;
  }

  /**
   * Build minimal context for a subtask
   * Only include what's absolutely necessary
   * @private
   */
  async _buildMinimalContext(subtask, globalContext, previousResults) {
    const minimalContext = {
      task: subtask.description,
      type: subtask.type,
      target: subtask.target,
    };

    // Include results from dependencies
    if (subtask.depends && subtask.depends.length > 0) {
      minimalContext.dependencies = previousResults
        .filter(r => subtask.depends.includes(r.subtask.id))
        .map(r => ({
          task: r.subtask.description,
          result: r.result,
        }));
    }

    // Include target file content if needed
    if (subtask.type === 'edit' || subtask.type === 'read') {
      try {
        if (this.fileOps.fileExists(subtask.target)) {
          const content = await this.fileOps.readFile(subtask.target);

          // Limit context size
          const maxTokens = 500;
          const tokens = this.tokenCounter.countTokens(content);

          if (tokens > maxTokens) {
            minimalContext.targetFile = {
              path: subtask.target,
              content: this.tokenCounter.truncateToTokenLimit(content, maxTokens),
              truncated: true,
            };
          } else {
            minimalContext.targetFile = {
              path: subtask.target,
              content,
              truncated: false,
            };
          }
        }
      } catch (error) {
        console.warn(`  Could not read target file: ${error.message}`);
      }
    }

    // Include relevant global context (limited)
    if (globalContext.relevantFiles) {
      minimalContext.relevantFiles = globalContext.relevantFiles.slice(0, 2); // Max 2 files
    }

    return minimalContext;
  }

  /**
   * Execute a subtask with voting
   * @private
   */
  async _executeSubtask(subtask, context, votingOptions) {
    // Build prompt for this specific subtask
    const messages = this._buildSubtaskPrompt(subtask, context);

    // Use voting to get reliable solution
    const votingResult = await this.votingManager.vote(messages, {
      type: 'code',
      expectedLength: subtask.estimatedTokens,
      estimatedSteps: 1, // Each subtask is atomic
    }, votingOptions);

    return {
      subtask,
      context,
      votingResult,
    };
  }

  /**
   * Build prompt for subtask
   * @private
   */
  _buildSubtaskPrompt(subtask, context) {
    let prompt = `Task: ${subtask.description}\n\n`;

    prompt += `Operation: ${subtask.type}\n`;
    if (subtask.target !== 'unknown') {
      prompt += `Target: ${subtask.target}\n`;
    }
    prompt += `\n`;

    // Add dependencies
    if (context.dependencies && context.dependencies.length > 0) {
      prompt += `Previous steps:\n`;
      context.dependencies.forEach((dep, idx) => {
        prompt += `${idx + 1}. ${dep.task}\n`;
      });
      prompt += `\n`;
    }

    // Add file context
    if (context.targetFile) {
      prompt += `Current file content (${context.targetFile.path}):\n`;
      prompt += `\`\`\`javascript\n${context.targetFile.content}\n\`\`\`\n`;
      if (context.targetFile.truncated) {
        prompt += `(Content truncated for brevity)\n`;
      }
      prompt += `\n`;
    }

    prompt += `Requirements:\n`;
    prompt += `- Write ONLY the code needed for this specific step\n`;
    prompt += `- Keep it minimal and focused\n`;
    prompt += `- Do not include explanations or comments (unless required)\n`;
    prompt += `- Output valid JavaScript code\n`;

    return [
      {
        role: 'system',
        content: 'You are a focused coding agent. Complete the specific task exactly as described. Be concise and precise.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  /**
   * Apply the result of a subtask
   * @private
   */
  async _applyResult(subtask, result, context) {
    // For now, just log the result
    // In full implementation, would actually modify files

    switch (subtask.type) {
      case 'write':
      case 'create':
        console.log(`  → Would create/write to: ${subtask.target}`);
        // await this.fileOps.writeFile(subtask.target, result);
        break;

      case 'edit':
        console.log(`  → Would edit: ${subtask.target}`);
        // await this.fileOps.editFile(subtask.target, oldContent, result);
        break;

      case 'read':
        console.log(`  → Read: ${subtask.target}`);
        // No file modification needed
        break;

      case 'delete':
        console.log(`  → Would delete: ${subtask.target}`);
        // await this.fileOps.deleteFile(subtask.target);
        break;

      default:
        console.log(`  → Executed: ${subtask.type}`);
    }

    // Store in context for dependent subtasks
    if (!context.completedSubtasks) {
      context.completedSubtasks = [];
    }
    context.completedSubtasks.push({
      id: subtask.id,
      description: subtask.description,
      result,
    });
  }

  /**
   * Get current execution progress
   * @returns {Object} - Progress information
   */
  getProgress() {
    if (!this.currentPlan) {
      return { status: 'idle', progress: 0 };
    }

    const completed = this.currentPlan.subtasks.filter(t => t.status === 'completed').length;
    const total = this.currentPlan.subtasks.length;

    return {
      status: 'executing',
      completed,
      total,
      progress: completed / total,
      currentSubtask: this.currentPlan.subtasks.find(t => t.status === 'pending'),
    };
  }

  /**
   * Get execution log
   * @returns {Array} - Execution log entries
   */
  getExecutionLog() {
    return this.executionLog;
  }
}

export default MicroagentExecutor;
