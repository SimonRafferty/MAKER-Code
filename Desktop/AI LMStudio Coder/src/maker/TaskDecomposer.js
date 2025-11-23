/**
 * TaskDecomposer - Maximal Agentic Decomposition (MAD)
 * Breaks complex tasks into minimal atomic subtasks
 *
 * Implements MAD principle from MAKER paper:
 * - Decompose tasks to smallest possible atomic steps
 * - Each step should be solvable by a simple focused agent
 * - Minimize context requirements per step
 * - Create dependency graph for sequential execution
 *
 * Key insight: Smaller steps = higher per-step reliability
 * Trade-off: More steps = more voting needed, but each vote is cheaper
 */
class TaskDecomposer {
  constructor(lmstudioClient, tokenCounter) {
    this.lmstudioClient = lmstudioClient;
    this.tokenCounter = tokenCounter;

    // Decomposition rules
    this.maxTokensPerStep = 150; // Keep steps small
    this.maxLinesPerStep = 20;   // Limit scope
  }

  /**
   * Decompose a task into minimal subtasks
   *
   * @param {string} taskDescription - High-level task description
   * @param {Object} context - Context information (files, functions, etc.)
   * @param {Object} options - Decomposition options
   * @returns {Promise<Object>} - Decomposed task plan
   */
  async decompose(taskDescription, context = {}, options = {}) {
    const useAI = options.useAI !== false; // Default to using AI

    console.log('\n[Task Decomposition] Breaking down task...');
    console.log(`  Task: ${taskDescription}`);

    let subtasks = [];

    if (useAI) {
      // Use LLM to decompose complex tasks
      subtasks = await this._decomposeWithAI(taskDescription, context, options);
    } else {
      // Simple rule-based decomposition
      subtasks = this._decomposeRuleBased(taskDescription, context);
    }

    // Validate and refine subtasks
    subtasks = this._validateSubtasks(subtasks);

    // Build dependency graph
    const dependencyGraph = this._buildDependencyGraph(subtasks);

    // Calculate execution order
    const executionOrder = this._topologicalSort(dependencyGraph);

    // Estimate complexity
    const complexity = this._estimateComplexity(subtasks);

    console.log(`  Decomposed into ${subtasks.length} subtasks`);
    console.log(`  Estimated complexity: ${complexity.totalSteps} steps`);

    return {
      originalTask: taskDescription,
      subtasks,
      dependencyGraph,
      executionOrder,
      complexity,
      context,
    };
  }

  /**
   * AI-assisted decomposition
   * @private
   */
  async _decomposeWithAI(taskDescription, context, options) {
    const prompt = this._buildDecompositionPrompt(taskDescription, context);

    try {
      const response = await this.lmstudioClient.complete([
        {
          role: 'system',
          content: 'You are an expert at breaking down programming tasks into minimal atomic steps. Each step should be simple, focused, and independently executable.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ], {
        temperature: 0.3, // Low temperature for consistent decomposition
        max_tokens: 1000,
        stream: false,
      });

      if (response && response.content) {
        return this._parseDecompositionResponse(response.content);
      }
    } catch (error) {
      console.warn('AI decomposition failed, falling back to rule-based:', error.message);
    }

    // Fallback to rule-based
    return this._decomposeRuleBased(taskDescription, context);
  }

  /**
   * Build decomposition prompt
   * @private
   */
  _buildDecompositionPrompt(taskDescription, context) {
    let prompt = `Break down this programming task into minimal atomic steps:\n\n`;
    prompt += `TASK: ${taskDescription}\n\n`;

    if (context.files && context.files.length > 0) {
      prompt += `Available files: ${context.files.join(', ')}\n`;
    }

    if (context.codebase) {
      prompt += `Codebase context: ${context.codebase}\n`;
    }

    prompt += `\nRULES:\n`;
    prompt += `1. Each step should be atomic - one clear action\n`;
    prompt += `2. Steps should be 1-3 lines of code maximum\n`;
    prompt += `3. Each step should be independently verifiable\n`;
    prompt += `4. Minimize dependencies between steps\n`;
    prompt += `5. Order steps logically\n\n`;

    prompt += `Format each step as:\n`;
    prompt += `STEP N: [action] - [description]\n`;
    prompt += `TYPE: [read|write|edit|create|delete]\n`;
    prompt += `TARGET: [file/function/variable]\n`;
    prompt += `DEPENDS: [comma-separated step numbers or "none"]\n\n`;

    prompt += `Example:\n`;
    prompt += `STEP 1: Create helper function - Add validation function\n`;
    prompt += `TYPE: write\n`;
    prompt += `TARGET: utils.js\n`;
    prompt += `DEPENDS: none\n\n`;

    return prompt;
  }

  /**
   * Parse AI decomposition response
   * @private
   */
  _parseDecompositionResponse(response) {
    const subtasks = [];
    const stepPattern = /STEP (\d+):\s*(.+?)\s*-\s*(.+?)\s*TYPE:\s*(\w+)\s*TARGET:\s*(.+?)\s*DEPENDS:\s*(.+?)(?=\n\n|\n*$)/gs;

    let match;
    while ((match = stepPattern.exec(response)) !== null) {
      const [, stepNum, action, description, type, target, dependsStr] = match;

      const depends = dependsStr.trim().toLowerCase() === 'none'
        ? []
        : dependsStr.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));

      subtasks.push({
        id: parseInt(stepNum, 10),
        action: action.trim(),
        description: description.trim(),
        type: type.trim(),
        target: target.trim(),
        depends,
        status: 'pending',
        estimatedTokens: this._estimateStepTokens(action, description),
      });
    }

    // If parsing failed, try simple line-by-line fallback
    if (subtasks.length === 0) {
      const lines = response.split('\n').filter(l => l.trim().length > 0);
      lines.forEach((line, idx) => {
        if (/^STEP|^\d+[.)]/.test(line)) {
          subtasks.push({
            id: idx + 1,
            action: 'execute',
            description: line.replace(/^STEP\s*\d+:?\s*/, '').replace(/^\d+[.)]\s*/, ''),
            type: 'execute',
            target: 'unknown',
            depends: idx > 0 ? [idx] : [],
            status: 'pending',
            estimatedTokens: 100,
          });
        }
      });
    }

    return subtasks;
  }

  /**
   * Rule-based decomposition (fallback)
   * @private
   */
  _decomposeRuleBased(taskDescription, context) {
    const subtasks = [];

    // Simple heuristic-based decomposition
    const keywords = {
      create: /create|add|implement|write|new/i,
      read: /read|get|fetch|load|check/i,
      edit: /modify|update|change|edit|fix/i,
      delete: /remove|delete|clear/i,
    };

    let type = 'execute';
    for (const [key, pattern] of Object.entries(keywords)) {
      if (pattern.test(taskDescription)) {
        type = key;
        break;
      }
    }

    // Break by sentences or logical chunks
    const sentences = taskDescription.split(/[.;]/).filter(s => s.trim().length > 0);

    sentences.forEach((sentence, idx) => {
      subtasks.push({
        id: idx + 1,
        action: type,
        description: sentence.trim(),
        type,
        target: context.files?.[0] || 'unknown',
        depends: idx > 0 ? [idx] : [],
        status: 'pending',
        estimatedTokens: this._estimateStepTokens(type, sentence),
      });
    });

    // If only one subtask, try to break it down further
    if (subtasks.length === 1) {
      // Check if it mentions multiple operations
      const operations = taskDescription.match(/(?:and|then|also|plus)/gi);
      if (operations && operations.length > 0) {
        // Split on conjunctions
        const parts = taskDescription.split(/\s+(?:and|then|also|plus)\s+/i);
        return parts.map((part, idx) => ({
          id: idx + 1,
          action: type,
          description: part.trim(),
          type,
          target: context.files?.[0] || 'unknown',
          depends: idx > 0 ? [idx] : [],
          status: 'pending',
          estimatedTokens: this._estimateStepTokens(type, part),
        }));
      }
    }

    return subtasks.length > 0 ? subtasks : [{
      id: 1,
      action: type,
      description: taskDescription,
      type,
      target: 'unknown',
      depends: [],
      status: 'pending',
      estimatedTokens: this._estimateStepTokens(type, taskDescription),
    }];
  }

  /**
   * Validate and refine subtasks
   * @private
   */
  _validateSubtasks(subtasks) {
    // Ensure sequential IDs
    return subtasks.map((task, idx) => ({
      ...task,
      id: idx + 1,
      // Adjust dependencies to new IDs
      depends: task.depends.map(d => {
        const oldIndex = subtasks.findIndex(st => st.id === d);
        return oldIndex !== -1 ? oldIndex + 1 : d;
      }).filter(d => d > 0 && d <= subtasks.length),
    }));
  }

  /**
   * Build dependency graph
   * @private
   */
  _buildDependencyGraph(subtasks) {
    const graph = {};

    for (const task of subtasks) {
      graph[task.id] = {
        task,
        dependsOn: task.depends,
        requiredBy: [],
      };
    }

    // Build reverse dependencies
    for (const task of subtasks) {
      for (const depId of task.depends) {
        if (graph[depId]) {
          graph[depId].requiredBy.push(task.id);
        }
      }
    }

    return graph;
  }

  /**
   * Topological sort for execution order
   * @private
   */
  _topologicalSort(graph) {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;

      visited.add(nodeId);

      const node = graph[nodeId];
      if (node) {
        // Visit dependencies first
        for (const depId of node.dependsOn) {
          visit(depId);
        }

        order.push(nodeId);
      }
    };

    // Visit all nodes
    for (const nodeId of Object.keys(graph)) {
      visit(parseInt(nodeId, 10));
    }

    return order;
  }

  /**
   * Estimate step token requirements
   * @private
   */
  _estimateStepTokens(action, description) {
    const baseTokens = this.tokenCounter.countTokens(description);

    // Add overhead based on operation type
    const overhead = {
      create: 100,
      write: 80,
      edit: 60,
      read: 40,
      delete: 20,
      execute: 50,
    };

    return baseTokens + (overhead[action] || 50);
  }

  /**
   * Estimate overall complexity
   * @private
   */
  _estimateComplexity(subtasks) {
    const totalSteps = subtasks.length;
    const totalTokens = subtasks.reduce((sum, task) => sum + task.estimatedTokens, 0);

    // Calculate depth (longest dependency chain)
    let maxDepth = 0;
    const calculateDepth = (task, visited = new Set()) => {
      if (visited.has(task.id)) return 0;
      visited.add(task.id);

      if (task.depends.length === 0) return 1;

      const depthsOfDeps = task.depends.map(depId => {
        const depTask = subtasks.find(t => t.id === depId);
        return depTask ? calculateDepth(depTask, new Set(visited)) : 0;
      });

      return 1 + Math.max(...depthsOfDeps);
    };

    for (const task of subtasks) {
      const depth = calculateDepth(task);
      maxDepth = Math.max(maxDepth, depth);
    }

    // Parallelizability
    const parallelizable = subtasks.filter(t => t.depends.length === 0).length;

    return {
      totalSteps,
      totalTokens,
      maxDepth,
      parallelizable,
      avgTokensPerStep: Math.round(totalTokens / totalSteps),
      complexity: maxDepth > 5 ? 'high' : maxDepth > 2 ? 'medium' : 'low',
    };
  }

  /**
   * Get next executable subtasks (no pending dependencies)
   *
   * @param {Array} subtasks - All subtasks
   * @returns {Array} - Subtasks ready to execute
   */
  getReadySubtasks(subtasks) {
    return subtasks.filter(task => {
      if (task.status !== 'pending') return false;

      // Check if all dependencies are completed
      return task.depends.every(depId => {
        const depTask = subtasks.find(t => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
    });
  }

  /**
   * Mark subtask as completed
   *
   * @param {Array} subtasks - All subtasks
   * @param {number} taskId - Task ID to mark complete
   * @returns {Array} - Updated subtasks
   */
  completeSubtask(subtasks, taskId) {
    return subtasks.map(task =>
      task.id === taskId
        ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
        : task
    );
  }
}

export default TaskDecomposer;
