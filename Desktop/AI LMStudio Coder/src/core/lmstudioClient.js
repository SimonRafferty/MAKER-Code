import axios from 'axios';

/**
 * LMStudioClient - OpenAI-compatible API client for LMStudio
 * Simplified version for MAKER framework (no tool calling needed)
 */
class LMStudioClient {
  constructor(config) {
    this.baseURL = config.baseURL || 'http://localhost:1234/v1';
    this.model = config.model || 'local-model';
    this.temperature = config.temperature || 0.7;

    this.contextWindow = null; // Will be fetched or set by user
    this.lastUsage = null;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 0,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            'Cannot connect to LMStudio. Make sure LMStudio is running and the server is started.'
          );
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          throw new Error('Connection to LMStudio was interrupted.');
        }
        throw error;
      }
    );
  }

  /**
   * Complete a chat interaction
   * @param {Array} messages - Message objects {role, content}
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Response {type, content, message}
   */
  async complete(messages, options = {}) {
    if (!this.contextWindow) {
      throw new Error('Context window not set. Please set context length using /context command.');
    }

    let maxCompletionTokens = options.max_tokens;

    if (!maxCompletionTokens && options.promptTokens && this.contextWindow) {
      const availableTokens = this.contextWindow - options.promptTokens - 100;
      maxCompletionTokens = Math.max(512, availableTokens);
    } else if (!maxCompletionTokens) {
      maxCompletionTokens = Math.floor(this.contextWindow / 2);
    }

    const useStreaming = options.onProgress && !options.stream === false;

    const requestBody = {
      model: options.model || this.model,
      messages: messages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: maxCompletionTokens,
      stream: useStreaming,
    };

    try {
      if (useStreaming) {
        return await this.completeWithStreaming(
          requestBody,
          options.onProgress,
          options.retries || 3,
          options.signal
        );
      }

      const response = await this.retryRequest(
        () => this.client.post('/chat/completions', requestBody, { signal: options.signal }),
        options.retries || 3
      );

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response from LMStudio');
      }

      if (response.data.usage) {
        this.lastUsage = {
          promptTokens: response.data.usage.prompt_tokens || 0,
          completionTokens: response.data.usage.completion_tokens || 0,
          totalTokens: response.data.usage.total_tokens || 0,
          timestamp: new Date().toISOString(),
        };
      }

      const message = response.data.choices[0].message;
      const completion = message.content || '';

      return {
        type: 'content',
        content: completion,
        message: message,
        usage: this.lastUsage,
      };
    } catch (error) {
      if (error.response) {
        throw new Error(
          `LMStudio API error (${error.response.status}): ${
            error.response.data?.error?.message || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Complete with streaming
   * @private
   */
  async completeWithStreaming(requestBody, onProgress, maxRetries = 3, signal = null) {
    let completionText = '';
    let tokenCount = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.post('/chat/completions', requestBody, {
          responseType: 'stream',
          signal: signal,
        });

        return await new Promise((resolve, reject) => {
          let buffer = '';

          response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (!line.trim() || line.trim() === 'data: [DONE]') continue;

              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.choices && data.choices[0]?.delta?.content) {
                    const content = data.choices[0].delta.content;
                    completionText += content;
                    tokenCount++;

                    if (tokenCount % 10 === 0) {
                      onProgress(tokenCount, completionText);
                    }
                  }

                  if (data.usage) {
                    this.lastUsage = {
                      promptTokens: data.usage.prompt_tokens || 0,
                      completionTokens: data.usage.completion_tokens || 0,
                      totalTokens: data.usage.total_tokens || 0,
                      timestamp: new Date().toISOString(),
                    };
                  }
                } catch (parseError) {
                  // Ignore parse errors
                }
              }
            }
          });

          response.data.on('end', () => {
            onProgress(tokenCount, completionText);
            resolve({
              type: 'content',
              content: completionText,
              message: { role: 'assistant', content: completionText },
              usage: this.lastUsage,
            });
          });

          response.data.on('error', (error) => {
            reject(error);
          });
        });

      } catch (error) {
        if (
          error.code === 'ECONNREFUSED' ||
          (error.response && error.response.status === 400)
        ) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Test connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await this.client.get('/models', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to LMStudio at ' + this.baseURL +
          '. Make sure LMStudio is running.'
        );
      }
      throw new Error('Connection test failed: ' + error.message);
    }
  }

  /**
   * Get models with native API (includes context length)
   * @returns {Promise<Array>}
   */
  async getModelsNative() {
    try {
      const response = await this.client.get('/api/v0/models');
      return response.data.data || [];
    } catch (error) {
      return null;
    }
  }

  /**
   * Get models (OpenAI-compatible)
   * @returns {Promise<Array>}
   */
  async getModels() {
    try {
      const response = await this.client.get('/models');
      return response.data.data || [];
    } catch (error) {
      throw new Error('Failed to fetch models: ' + error.message);
    }
  }

  /**
   * Fetch model capabilities
   * @returns {Promise<void>}
   */
  async fetchModelCapabilities() {
    try {
      if (this.contextWindow) {
        try {
          let models = await this.getModelsNative();
          if (!models || models.length === 0) {
            models = await this.getModels();
          }
          if (models && models.length > 0) {
            const loadedModels = models.filter(m => !m.state || m.state === 'loaded');
            const modelInfo = loadedModels.length > 0 ? loadedModels[0] : models[0];
            this.model = modelInfo.id;
          }
        } catch (error) {
          // Silently continue
        }
        return;
      }

      let models = await this.getModelsNative();
      let usingNativeAPI = false;

      if (models && models.length > 0) {
        usingNativeAPI = true;
      } else {
        models = await this.getModels();
      }

      if (!models || models.length === 0) {
        throw new Error('No models loaded in LMStudio.');
      }

      const loadedModels = models.filter(m => !m.state || m.state === 'loaded');
      const modelInfo = loadedModels.length > 0 ? loadedModels[0] : models[0];

      this.model = modelInfo.id;

      if (usingNativeAPI) {
        this.contextWindow =
          modelInfo?.loaded_context_length ||
          modelInfo?.max_context_length ||
          null;
      } else {
        this.contextWindow =
          modelInfo?.context_length ||
          modelInfo?.max_tokens ||
          modelInfo?.context_window ||
          null;
      }

    } catch (error) {
      throw new Error(`Failed to fetch model info: ${error.message}`);
    }
  }

  /**
   * Get context window size
   * @returns {number|null}
   */
  getContextWindow() {
    return this.contextWindow;
  }

  /**
   * Get last usage
   * @returns {Object|null}
   */
  getLastUsage() {
    return this.lastUsage;
  }

  /**
   * Retry with backoff
   * @private
   */
  async retryRequest(requestFn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        if (
          error.code === 'ECONNREFUSED' ||
          (error.response && error.response.status === 400)
        ) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Compress text
   * @param {string} text - Text to compress
   * @param {string} instructions - Instructions
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>}
   */
  async compress(text, instructions, onProgress = null) {
    const messages = [
      {
        role: 'system',
        content: instructions,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const options = {
      temperature: 0.3,
      max_tokens: 1000,
    };

    if (onProgress) {
      options.onProgress = onProgress;
    }

    const response = await this.complete(messages, options);
    return response.content;
  }
}

export default LMStudioClient;
