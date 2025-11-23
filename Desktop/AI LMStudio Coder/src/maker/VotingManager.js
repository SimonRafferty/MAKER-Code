import ResponseValidator from './ResponseValidator.js';
import CodeClusterer from './CodeClusterer.js';

/**
 * VotingManager - First-to-ahead-by-k voting implementation
 * Core component of MAKER framework for error correction
 *
 * Implements Algorithm 3 from MAKER paper:
 * - Generate multiple candidate solutions
 * - Apply red-flagging to filter unreliable responses
 * - Cluster similar responses using structural similarity
 * - Run first-to-ahead-by-k voting
 * - Return winning solution with confidence metrics
 *
 * Key insight: kmin = Θ(ln s) for s-step problems
 * Higher k = more reliability but higher cost
 */
class VotingManager {
  constructor(lmstudioClient, tokenCounter) {
    this.lmstudioClient = lmstudioClient;
    this.tokenCounter = tokenCounter;
    this.validator = new ResponseValidator(tokenCounter);
    this.clusterer = new CodeClusterer(tokenCounter);

    // Voting parameters (from MAKER paper)
    this.defaultK = 3; // Default voting threshold
    this.maxCandidates = 10; // Maximum candidates to generate
    this.similarityThreshold = 0.7; // Clustering threshold
  }

  /**
   * Calculate optimal k based on problem complexity
   * kmin = Θ(ln s) where s = expected number of steps
   *
   * @param {number} problemSteps - Expected number of steps
   * @param {number} baseReliability - Base per-step success probability (0-1)
   * @returns {number} - Optimal k value
   */
  calculateOptimalK(problemSteps, baseReliability = 0.7) {
    // From MAKER paper: kmin scales logarithmically with problem size
    const baseK = Math.ceil(Math.log2(problemSteps + 1));

    // Adjust based on base reliability
    // Lower reliability needs higher k
    const reliabilityFactor = Math.max(1, 2 * (1 - baseReliability));

    const optimalK = Math.ceil(baseK * reliabilityFactor);

    // Clamp between reasonable bounds
    return Math.max(2, Math.min(10, optimalK));
  }

  /**
   * Generate multiple candidate responses
   * @param {Array} messages - Conversation context
   * @param {number} count - Number of candidates to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Array<Object>>} - Generated candidates
   */
  async generateCandidates(messages, count, options = {}) {
    const candidates = [];

    // Generate candidates with slight temperature variation for diversity
    for (let i = 0; i < count; i++) {
      try {
        const temperature = options.temperature || 0.7;
        // Vary temperature slightly to get diverse responses
        const variedTemp = temperature + (Math.random() * 0.2 - 0.1);

        const response = await this.lmstudioClient.complete(messages, {
          temperature: Math.max(0.1, Math.min(1.0, variedTemp)),
          max_tokens: options.max_tokens,
          stream: false,
        });

        if (response && response.content) {
          candidates.push({
            index: i,
            content: response.content,
            temperature: variedTemp,
            tokens: response.usage?.completion_tokens,
          });
        }
      } catch (error) {
        console.warn(`Failed to generate candidate ${i}:`, error.message);
      }
    }

    return candidates;
  }

  /**
   * Run first-to-ahead-by-k voting
   *
   * @param {Array} messages - Conversation messages
   * @param {Object} task - Task metadata
   * @param {Object} options - Voting options
   * @returns {Promise<Object>} - Voting result with winner and statistics
   */
  async vote(messages, task = {}, options = {}) {
    const k = options.k || this.defaultK;
    const maxCandidates = options.maxCandidates || this.maxCandidates;
    const taskType = task.type || 'code';

    console.log(`\n[MAKER Voting] k=${k}, max_candidates=${maxCandidates}`);

    // Step 1: Generate candidate responses
    console.log('[Step 1/4] Generating candidates...');
    const candidates = await this.generateCandidates(messages, maxCandidates, {
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens,
    });

    if (candidates.length === 0) {
      throw new Error('Failed to generate any candidates');
    }

    console.log(`  Generated ${candidates.length} candidates`);

    // Step 2: Red-flagging - filter out invalid responses
    console.log('[Step 2/4] Applying red-flagging...');
    const validCandidates = [];

    for (const candidate of candidates) {
      const validation = this.validator.validate(candidate.content, task);

      if (validation.valid) {
        validCandidates.push({
          ...candidate,
          validation,
          confidence: validation.confidence,
        });
      } else {
        console.log(`  Rejected candidate ${candidate.index}: ${validation.summary}`);
      }
    }

    if (validCandidates.length === 0) {
      // All candidates failed validation - return best of bad lot
      console.warn('  WARNING: All candidates failed validation');
      const bestInvalid = candidates.sort((a, b) => {
        const vA = this.validator.validate(a.content, task);
        const vB = this.validator.validate(b.content, task);
        return vB.confidence - vA.confidence;
      })[0];

      return {
        winner: bestInvalid.content,
        confidence: 0.3,
        votingStats: {
          totalCandidates: candidates.length,
          validCandidates: 0,
          clusterCount: 0,
          votesNeeded: k,
          reliable: false,
        },
        warning: 'All candidates failed validation - returning least bad option',
      };
    }

    console.log(`  ${validCandidates.length}/${candidates.length} candidates passed validation`);

    // If only one valid candidate, return it
    if (validCandidates.length === 1) {
      return {
        winner: validCandidates[0].content,
        confidence: validCandidates[0].confidence,
        votingStats: {
          totalCandidates: candidates.length,
          validCandidates: 1,
          clusterCount: 1,
          votesNeeded: k,
          reliable: false,
        },
        warning: 'Only one valid candidate - no voting performed',
      };
    }

    // Step 3: Clustering - group similar responses
    console.log('[Step 3/4] Clustering similar responses...');
    const responseCodes = validCandidates.map(c => c.content);
    const clusters = this.clusterer.cluster(responseCodes, this.similarityThreshold);

    console.log(`  Formed ${clusters.length} clusters`);
    clusters.forEach((cluster, i) => {
      console.log(`    Cluster ${i + 1}: ${cluster.size} members (avg similarity: ${cluster.avgSimilarity.toFixed(2)})`);
    });

    // Step 4: First-to-ahead-by-k voting
    console.log('[Step 4/4] Running first-to-ahead-by-k voting...');

    // Each cluster gets votes equal to its size
    const votes = clusters.map((cluster, index) => ({
      clusterIndex: index,
      cluster,
      votes: cluster.size,
      representative: cluster.representative,
    })).sort((a, b) => b.votes - a.votes);

    console.log('  Vote distribution:');
    votes.forEach((v, i) => {
      console.log(`    Cluster ${i + 1}: ${v.votes} votes`);
    });

    // Check for winner (first-to-ahead-by-k)
    const winner = votes[0];
    const runnerUp = votes[1] || { votes: 0 };
    const margin = winner.votes - runnerUp.votes;

    const hasWinner = margin >= k;
    const confidence = this._calculateConfidence(winner, runnerUp, k, validCandidates.length);

    if (hasWinner) {
      console.log(`  ✓ Winner found! (margin: ${margin} >= k: ${k})`);
    } else {
      console.log(`  ✗ No clear winner (margin: ${margin} < k: ${k})`);
    }

    return {
      winner: winner.representative,
      confidence,
      votingStats: {
        totalCandidates: candidates.length,
        validCandidates: validCandidates.length,
        clusterCount: clusters.length,
        winnerVotes: winner.votes,
        runnerUpVotes: runnerUp.votes,
        margin,
        votesNeeded: k,
        reliable: hasWinner,
      },
      clusters,
      warning: hasWinner ? null : `Margin (${margin}) below threshold (k=${k}) - result may be unreliable`,
    };
  }

  /**
   * Calculate confidence score
   * @private
   */
  _calculateConfidence(winner, runnerUp, k, totalValid) {
    // Base confidence from vote margin
    const margin = winner.votes - runnerUp.votes;
    const marginConfidence = Math.min(1.0, margin / k);

    // Confidence from cluster quality
    const clusterConfidence = winner.cluster.avgSimilarity;

    // Confidence from sample size
    const sampleConfidence = Math.min(1.0, totalValid / 5); // 5+ candidates = full confidence

    // Weighted combination
    const confidence = (
      0.5 * marginConfidence +
      0.3 * clusterConfidence +
      0.2 * sampleConfidence
    );

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Adaptive voting - automatically determine k and generate enough candidates
   *
   * @param {Array} messages - Conversation messages
   * @param {Object} task - Task metadata with complexity estimate
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Voting result
   */
  async adaptiveVote(messages, task = {}, options = {}) {
    // Estimate problem complexity
    const estimatedSteps = task.estimatedSteps || 1;
    const criticalityFactor = task.critical ? 1.5 : 1.0;

    // Calculate optimal k
    const k = Math.ceil(
      this.calculateOptimalK(estimatedSteps, task.baseReliability) * criticalityFactor
    );

    console.log(`[Adaptive Voting] Estimated steps: ${estimatedSteps}, k: ${k}`);

    // Generate enough candidates to ensure k can be achieved
    // Need at least k+1 candidates to have meaningful voting
    const minCandidates = Math.max(k + 2, 5);
    const maxCandidates = Math.min(minCandidates * 2, this.maxCandidates);

    return this.vote(messages, task, {
      ...options,
      k,
      maxCandidates,
    });
  }

  /**
   * Quick vote - single round, minimal candidates (for low-criticality tasks)
   *
   * @param {Array} messages - Conversation messages
   * @param {Object} task - Task metadata
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Voting result
   */
  async quickVote(messages, task = {}, options = {}) {
    return this.vote(messages, task, {
      ...options,
      k: 2,
      maxCandidates: 3,
    });
  }

  /**
   * High-reliability vote - for critical tasks
   *
   * @param {Array} messages - Conversation messages
   * @param {Object} task - Task metadata
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Voting result
   */
  async reliableVote(messages, task = {}, options = {}) {
    return this.vote(messages, task, {
      ...options,
      k: Math.max(5, this.calculateOptimalK(task.estimatedSteps || 10)),
      maxCandidates: 10,
    });
  }

  /**
   * Estimate cost of voting operation
   *
   * @param {number} k - Voting threshold
   * @param {number} maxCandidates - Maximum candidates
   * @param {number} avgTokensPerResponse - Average tokens per response
   * @returns {Object} - Cost estimate
   */
  estimateCost(k, maxCandidates, avgTokensPerResponse = 200) {
    // From MAKER paper: E[cost] = Θ(s ln s)
    // For our single-vote case, cost scales with k

    const expectedValidCandidates = maxCandidates * 0.7; // 70% pass validation
    const totalCompletionTokens = maxCandidates * avgTokensPerResponse;

    return {
      k,
      maxCandidates,
      expectedValidCandidates,
      totalCompletionTokens,
      scalingFactor: Math.log2(k + 1),
    };
  }
}

export default VotingManager;
