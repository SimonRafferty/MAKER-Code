import * as acorn from 'acorn';

/**
 * ResponseValidator - Red-flagging component of MAKER
 * Filters out unreliable responses using static analysis
 *
 * Implements red-flagging from MAKER paper:
 * - Syntax validation (parse errors)
 * - Length checks (too verbose = confused)
 * - Completeness checks (truncated responses)
 * - Hallucination markers (apologies, uncertainty)
 */
class ResponseValidator {
  constructor(tokenCounter) {
    this.tokenCounter = tokenCounter;

    // Red-flag patterns that indicate unreliable responses
    this.hallucination_patterns = [
      /sorry,?\s+(?:i|but)\s+(?:can't|cannot|couldn't)/i,
      /(?:i'm|i am)\s+(?:not|un)able\s+to/i,
      /(?:i|i'm)\s+(?:confused|uncertain|unsure)/i,
      /(?:i\s+)?(?:don't|do not)\s+(?:have|know|understand)/i,
      /as an ai/i,
      /i apologize/i,
      /(?:i'm|i am)\s+sorry/i,
    ];

    // Indicators of incomplete responses
    this.incompleteness_patterns = [
      /\.\.\.\s*$/,           // Ends with ...
      /\[(?:truncated|incomplete|rest omitted)\]/i,
      /(?:to be continued|will continue|see next)/i,
      /(?:and so on|etc\.?)\s*$/i,
    ];
  }

  /**
   * Validate a code response
   * @param {string} code - Generated code to validate
   * @param {Object} task - Task context (description, expected format, etc.)
   * @param {Object} options - Validation options
   * @returns {Object} - { valid: boolean, flags: Array, confidence: number }
   */
  validate(code, task = {}, options = {}) {
    const flags = [];

    // 1. Check for empty or whitespace-only response
    if (!code || code.trim().length === 0) {
      flags.push({
        type: 'empty_response',
        severity: 'critical',
        message: 'Response is empty or whitespace-only',
      });
      return { valid: false, flags, confidence: 0 };
    }

    // 2. Check for hallucination markers
    const hallucinationFlags = this._checkHallucinations(code);
    flags.push(...hallucinationFlags);

    // 3. Check for incompleteness
    const incompletenessFlags = this._checkCompleteness(code);
    flags.push(...incompletenessFlags);

    // 4. Check length (too long indicates confusion)
    const lengthFlags = this._checkLength(code, task, options);
    flags.push(...lengthFlags);

    // 5. Validate syntax if it's code
    if (task.type === 'code' || this._looksLikeCode(code)) {
      const syntaxFlags = this._validateSyntax(code, task);
      flags.push(...syntaxFlags);
    }

    // 6. Check for format compliance
    if (task.expectedFormat) {
      const formatFlags = this._checkFormat(code, task.expectedFormat);
      flags.push(...formatFlags);
    }

    // Calculate confidence score (0-1)
    const confidence = this._calculateConfidence(flags);

    // Determine if valid (no critical flags)
    const valid = !flags.some(f => f.severity === 'critical');

    return {
      valid,
      flags,
      confidence,
      summary: this._generateSummary(flags),
    };
  }

  /**
   * Check for hallucination markers
   * @private
   */
  _checkHallucinations(code) {
    const flags = [];

    for (const pattern of this.hallucination_patterns) {
      if (pattern.test(code)) {
        flags.push({
          type: 'hallucination_marker',
          severity: 'critical',
          message: `Contains hallucination pattern: ${pattern}`,
          pattern: pattern.toString(),
        });
      }
    }

    return flags;
  }

  /**
   * Check for incompleteness indicators
   * @private
   */
  _checkCompleteness(code) {
    const flags = [];

    for (const pattern of this.incompleteness_patterns) {
      if (pattern.test(code)) {
        flags.push({
          type: 'incomplete_response',
          severity: 'high',
          message: `Response appears incomplete: ${pattern}`,
          pattern: pattern.toString(),
        });
      }
    }

    // Check for unmatched braces/brackets/parens
    const brackets = this._checkBalancedBrackets(code);
    if (!brackets.balanced) {
      flags.push({
        type: 'unbalanced_brackets',
        severity: 'high',
        message: `Unbalanced brackets: ${brackets.details}`,
      });
    }

    return flags;
  }

  /**
   * Check if brackets are balanced
   * @private
   */
  _checkBalancedBrackets(code) {
    const stack = [];
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const opening = Object.keys(pairs);
    const closing = Object.values(pairs);

    for (const char of code) {
      if (opening.includes(char)) {
        stack.push(char);
      } else if (closing.includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) {
          return {
            balanced: false,
            details: `Unexpected '${char}' without matching opening`,
          };
        }
      }
    }

    if (stack.length > 0) {
      return {
        balanced: false,
        details: `Unclosed '${stack[stack.length - 1]}'`,
      };
    }

    return { balanced: true };
  }

  /**
   * Check response length
   * @private
   */
  _checkLength(code, task, options) {
    const flags = [];
    const tokenCount = this.tokenCounter.countTokens(code);

    // Default thresholds
    const maxTokens = options.maxTokens || 1500;
    const minTokens = options.minTokens || 5;

    // Adjust based on task complexity
    const expectedTokens = task.expectedLength || 200;
    const tolerance = 2.0; // Allow 2x expected length

    if (tokenCount > maxTokens) {
      flags.push({
        type: 'too_verbose',
        severity: 'high',
        message: `Response is excessively long (${tokenCount} tokens, max ${maxTokens})`,
        tokenCount,
        maxTokens,
      });
    } else if (tokenCount > expectedTokens * tolerance) {
      flags.push({
        type: 'possibly_verbose',
        severity: 'medium',
        message: `Response is longer than expected (${tokenCount} tokens, expected ~${expectedTokens})`,
        tokenCount,
        expectedTokens,
      });
    }

    if (tokenCount < minTokens) {
      flags.push({
        type: 'too_short',
        severity: 'high',
        message: `Response is too short (${tokenCount} tokens, min ${minTokens})`,
        tokenCount,
        minTokens,
      });
    }

    return flags;
  }

  /**
   * Validate JavaScript syntax using acorn
   * @private
   */
  _validateSyntax(code, task) {
    const flags = [];

    try {
      // Try parsing as module first
      acorn.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowHashBang: true,
        allowAwaitOutsideFunction: true,
      });
    } catch (moduleError) {
      // Try as script
      try {
        acorn.parse(code, {
          ecmaVersion: 2022,
          sourceType: 'script',
          allowHashBang: true,
        });
      } catch (scriptError) {
        // Both failed - report syntax error
        flags.push({
          type: 'syntax_error',
          severity: 'critical',
          message: `Syntax error: ${scriptError.message}`,
          line: scriptError.loc?.line,
          column: scriptError.loc?.column,
          error: scriptError.message,
        });
      }
    }

    return flags;
  }

  /**
   * Check if text looks like code
   * @private
   */
  _looksLikeCode(text) {
    // Simple heuristic: contains common code patterns
    const codeIndicators = [
      /\bfunction\s+\w+\s*\(/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bvar\s+\w+\s*=/,
      /\bclass\s+\w+/,
      /=>\s*{/,
      /\bimport\s+.*\s+from/,
      /\bexport\s+(?:default|class|function|const)/,
    ];

    return codeIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Check format compliance
   * @private
   */
  _checkFormat(code, expectedFormat) {
    const flags = [];

    // expectedFormat can be: 'function', 'class', 'expression', etc.
    switch (expectedFormat) {
      case 'function':
        if (!/\bfunction\s+\w+/.test(code) && !/=>\s*{/.test(code)) {
          flags.push({
            type: 'format_mismatch',
            severity: 'high',
            message: 'Expected a function definition',
          });
        }
        break;

      case 'class':
        if (!/\bclass\s+\w+/.test(code)) {
          flags.push({
            type: 'format_mismatch',
            severity: 'high',
            message: 'Expected a class definition',
          });
        }
        break;

      case 'import':
        if (!/\bimport\s+/.test(code)) {
          flags.push({
            type: 'format_mismatch',
            severity: 'high',
            message: 'Expected an import statement',
          });
        }
        break;

      case 'export':
        if (!/\bexport\s+/.test(code)) {
          flags.push({
            type: 'format_mismatch',
            severity: 'high',
            message: 'Expected an export statement',
          });
        }
        break;
    }

    return flags;
  }

  /**
   * Calculate confidence score from flags
   * @private
   */
  _calculateConfidence(flags) {
    if (flags.length === 0) {
      return 1.0; // Perfect confidence
    }

    // Deduct based on severity
    let penalty = 0;
    for (const flag of flags) {
      switch (flag.severity) {
        case 'critical':
          penalty += 1.0; // Critical = complete failure
          break;
        case 'high':
          penalty += 0.3;
          break;
        case 'medium':
          penalty += 0.1;
          break;
        case 'low':
          penalty += 0.05;
          break;
      }
    }

    return Math.max(0, 1.0 - penalty);
  }

  /**
   * Generate human-readable summary
   * @private
   */
  _generateSummary(flags) {
    if (flags.length === 0) {
      return 'Response passed all validation checks';
    }

    const critical = flags.filter(f => f.severity === 'critical').length;
    const high = flags.filter(f => f.severity === 'high').length;
    const medium = flags.filter(f => f.severity === 'medium').length;

    let summary = `Found ${flags.length} issue(s)`;
    if (critical > 0) summary += ` (${critical} critical)`;
    if (high > 0) summary += ` (${high} high)`;
    if (medium > 0) summary += ` (${medium} medium)`;

    return summary;
  }

  /**
   * Batch validate multiple responses
   * @param {Array<string>} responses - Multiple candidate responses
   * @param {Object} task - Task context
   * @param {Object} options - Validation options
   * @returns {Array<Object>} - Validation results for each response
   */
  validateBatch(responses, task = {}, options = {}) {
    return responses.map((response, index) => ({
      index,
      response,
      validation: this.validate(response, task, options),
    }));
  }

  /**
   * Filter out invalid responses
   * @param {Array<string>} responses - Multiple candidate responses
   * @param {Object} task - Task context
   * @param {Object} options - Validation options
   * @returns {Array<Object>} - Valid responses with metadata
   */
  filterValid(responses, task = {}, options = {}) {
    const results = this.validateBatch(responses, task, options);
    return results.filter(r => r.validation.valid);
  }
}

export default ResponseValidator;
