import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * CodeClusterer - Structural similarity analysis for voting
 * Groups code responses by structural similarity using AST comparison
 *
 * Implements Tier 2 voting from our MAKER adaptation:
 * - Parses code into Abstract Syntax Trees (AST)
 * - Extracts structural features (functions, classes, variables)
 * - Calculates similarity between code snippets
 * - Clusters similar solutions for voting
 */
class CodeClusterer {
  constructor(tokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Cluster responses by similarity
   * @param {Array<string>} responses - Code responses to cluster
   * @param {number} similarityThreshold - Minimum similarity to cluster (0-1)
   * @returns {Array<Object>} - Clusters with members and representative
   */
  cluster(responses, similarityThreshold = 0.7) {
    if (responses.length === 0) return [];
    if (responses.length === 1) {
      return [{
        representative: responses[0],
        members: [{ code: responses[0], index: 0, similarity: 1.0 }],
        size: 1,
        avgSimilarity: 1.0,
      }];
    }

    // Extract features from all responses
    const features = responses.map((code, index) => ({
      index,
      code,
      features: this.extractFeatures(code),
    }));

    // Build similarity matrix
    const similarityMatrix = this._buildSimilarityMatrix(features);

    // Cluster using greedy agglomerative clustering
    const clusters = this._greedyCluster(features, similarityMatrix, similarityThreshold);

    return clusters;
  }

  /**
   * Extract structural features from code
   * @param {string} code - Source code
   * @returns {Object} - Extracted features
   */
  extractFeatures(code) {
    const features = {
      ast: null,
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      variables: [],
      tokens: new Set(),
      structure: {},
      syntaxValid: true,
    };

    try {
      // Parse AST
      features.ast = acorn.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowHashBang: true,
        allowAwaitOutsideFunction: true,
      });

      // Walk AST to extract features
      walk.simple(features.ast, {
        FunctionDeclaration(node) {
          features.functions.push({
            name: node.id?.name,
            params: node.params.length,
            async: node.async,
          });
        },

        ArrowFunctionExpression(node) {
          features.functions.push({
            name: null,
            params: node.params.length,
            async: node.async,
            arrow: true,
          });
        },

        ClassDeclaration(node) {
          features.classes.push({
            name: node.id?.name,
            methods: node.body.body.filter(m => m.type === 'MethodDefinition').length,
          });
        },

        ImportDeclaration(node) {
          features.imports.push({
            source: node.source.value,
            specifiers: node.specifiers.length,
          });
        },

        ExportNamedDeclaration(node) {
          features.exports.push({
            type: 'named',
            declaration: node.declaration?.type,
          });
        },

        ExportDefaultDeclaration(node) {
          features.exports.push({
            type: 'default',
            declaration: node.declaration?.type,
          });
        },

        VariableDeclaration(node) {
          node.declarations.forEach(decl => {
            features.variables.push({
              name: decl.id?.name,
              kind: node.kind,
            });
          });
        },

        Identifier(node) {
          features.tokens.add(node.name);
        },

        Literal(node) {
          if (typeof node.value === 'string') {
            features.tokens.add(`"${node.value}"`);
          }
        },
      });

      // Calculate structural summary
      features.structure = {
        functionCount: features.functions.length,
        classCount: features.classes.length,
        importCount: features.imports.length,
        exportCount: features.exports.length,
        variableCount: features.variables.length,
        tokenCount: features.tokens.size,
      };

    } catch (error) {
      // Syntax error - fall back to token-based analysis
      features.syntaxValid = false;
      features.tokens = new Set(this._tokenizeRaw(code));
      features.structure = {
        functionCount: 0,
        classCount: 0,
        importCount: 0,
        exportCount: 0,
        variableCount: 0,
        tokenCount: features.tokens.size,
      };
    }

    return features;
  }

  /**
   * Calculate similarity between two code snippets
   * @param {string} code1 - First code snippet
   * @param {string} code2 - Second code snippet
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(code1, code2) {
    if (code1 === code2) return 1.0;

    const features1 = this.extractFeatures(code1);
    const features2 = this.extractFeatures(code2);

    return this._compareFeaturesEnhanced(features1, features2);
  }

  /**
   * Compare features with weighted scoring
   * @private
   */
  _compareFeaturesEnhanced(f1, f2) {
    // If both have syntax errors, fall back to pure token similarity
    if (!f1.syntaxValid && !f2.syntaxValid) {
      return this._jaccardSimilarity(f1.tokens, f2.tokens);
    }

    // If only one has syntax error, penalize heavily
    if (f1.syntaxValid !== f2.syntaxValid) {
      return 0.1 * this._jaccardSimilarity(f1.tokens, f2.tokens);
    }

    // Both valid - use multi-dimensional similarity
    const weights = {
      structure: 0.3,
      functions: 0.25,
      tokens: 0.2,
      classes: 0.15,
      imports: 0.1,
    };

    let totalSimilarity = 0;

    // 1. Structural similarity (counts)
    const structSim = this._structuralSimilarity(f1.structure, f2.structure);
    totalSimilarity += weights.structure * structSim;

    // 2. Function signature similarity
    const funcSim = this._functionSimilarity(f1.functions, f2.functions);
    totalSimilarity += weights.functions * funcSim;

    // 3. Token overlap (Jaccard)
    const tokenSim = this._jaccardSimilarity(f1.tokens, f2.tokens);
    totalSimilarity += weights.tokens * tokenSim;

    // 4. Class similarity
    const classSim = this._classSimilarity(f1.classes, f2.classes);
    totalSimilarity += weights.classes * classSim;

    // 5. Import similarity
    const importSim = this._importSimilarity(f1.imports, f2.imports);
    totalSimilarity += weights.imports * importSim;

    return totalSimilarity;
  }

  /**
   * Calculate structural similarity from counts
   * @private
   */
  _structuralSimilarity(s1, s2) {
    const keys = ['functionCount', 'classCount', 'importCount', 'exportCount', 'variableCount'];

    let similarity = 0;
    for (const key of keys) {
      const v1 = s1[key] || 0;
      const v2 = s2[key] || 0;

      if (v1 === 0 && v2 === 0) {
        similarity += 1; // Both zero = similar
      } else {
        const max = Math.max(v1, v2);
        const min = Math.min(v1, v2);
        similarity += min / max;
      }
    }

    return similarity / keys.length;
  }

  /**
   * Calculate function signature similarity
   * @private
   */
  _functionSimilarity(funcs1, funcs2) {
    if (funcs1.length === 0 && funcs2.length === 0) return 1.0;
    if (funcs1.length === 0 || funcs2.length === 0) return 0;

    // Match functions by signature (params, async, arrow)
    let matches = 0;
    const used = new Set();

    for (const f1 of funcs1) {
      for (let i = 0; i < funcs2.length; i++) {
        if (used.has(i)) continue;

        const f2 = funcs2[i];
        if (f1.params === f2.params && f1.async === f2.async) {
          matches++;
          used.add(i);
          break;
        }
      }
    }

    return matches / Math.max(funcs1.length, funcs2.length);
  }

  /**
   * Calculate class similarity
   * @private
   */
  _classSimilarity(classes1, classes2) {
    if (classes1.length === 0 && classes2.length === 0) return 1.0;
    if (classes1.length === 0 || classes2.length === 0) return 0;

    // Match by method count
    let similarity = 0;
    for (const c1 of classes1) {
      for (const c2 of classes2) {
        const methodSim = Math.min(c1.methods, c2.methods) / Math.max(c1.methods, c2.methods);
        similarity = Math.max(similarity, methodSim);
      }
    }

    return similarity / Math.max(classes1.length, classes2.length);
  }

  /**
   * Calculate import similarity
   * @private
   */
  _importSimilarity(imports1, imports2) {
    if (imports1.length === 0 && imports2.length === 0) return 1.0;
    if (imports1.length === 0 || imports2.length === 0) return 0;

    const sources1 = new Set(imports1.map(imp => imp.source));
    const sources2 = new Set(imports2.map(imp => imp.source));

    return this._jaccardSimilarity(sources1, sources2);
  }

  /**
   * Jaccard similarity for sets
   * @private
   */
  _jaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0) return 1.0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Build similarity matrix
   * @private
   */
  _buildSimilarityMatrix(features) {
    const n = features.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const sim = this._compareFeaturesEnhanced(features[i].features, features[j].features);
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
    }

    return matrix;
  }

  /**
   * Greedy clustering algorithm
   * @private
   */
  _greedyCluster(features, similarityMatrix, threshold) {
    const n = features.length;
    const clusters = [];
    const assigned = new Set();

    // Sort by potential cluster size (greedy)
    const candidates = features.map((f, i) => ({
      index: i,
      avgSimilarity: similarityMatrix[i].reduce((a, b) => a + b, 0) / n,
    })).sort((a, b) => b.avgSimilarity - a.avgSimilarity);

    for (const candidate of candidates) {
      if (assigned.has(candidate.index)) continue;

      // Start new cluster with this candidate as representative
      const cluster = {
        representative: features[candidate.index].code,
        members: [{
          code: features[candidate.index].code,
          index: candidate.index,
          similarity: 1.0,
        }],
        size: 1,
      };

      assigned.add(candidate.index);

      // Find similar responses to add to cluster
      for (let i = 0; i < n; i++) {
        if (assigned.has(i)) continue;

        const similarity = similarityMatrix[candidate.index][i];
        if (similarity >= threshold) {
          cluster.members.push({
            code: features[i].code,
            index: i,
            similarity,
          });
          cluster.size++;
          assigned.add(i);
        }
      }

      // Calculate average similarity within cluster
      cluster.avgSimilarity = cluster.members.reduce((sum, m) => sum + m.similarity, 0) / cluster.size;

      clusters.push(cluster);
    }

    // Sort clusters by size (largest first)
    return clusters.sort((a, b) => b.size - a.size);
  }

  /**
   * Simple tokenization fallback for invalid syntax
   * @private
   */
  _tokenizeRaw(code) {
    // Split on non-alphanumeric, filter out whitespace
    return code
      .split(/[^a-zA-Z0-9_]+/)
      .filter(token => token.length > 0);
  }

  /**
   * Find the best cluster (largest with highest avg similarity)
   * @param {Array<Object>} clusters - Clusters from cluster()
   * @returns {Object|null} - Best cluster or null
   */
  getBestCluster(clusters) {
    if (clusters.length === 0) return null;

    // Score by size and average similarity
    const scored = clusters.map(c => ({
      cluster: c,
      score: c.size * c.avgSimilarity,
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].cluster;
  }
}

export default CodeClusterer;
