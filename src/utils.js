/**
 * QuickDefine - Utility Functions & Configuration
 * Reusable utility functions and centralized configuration for the extension
 */

const QUICKDEFINE_CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000, // 1 second
  },

  // Selection Configuration
  SELECTION: {
    MAX_WORDS: 5, // Increased limit for phrases
    DEBOUNCE_DELAY: 300, // milliseconds
    MIN_LENGTH: 1,
  },

  // UI Configuration
  UI: {
    POPUP: {
      MIN_WIDTH: 280,
      MAX_WIDTH: 400,
      MAX_HEIGHT: 500,
      GAP: 8, // Gap between selection and popup
      VIEWPORT_MARGIN: 20, // Margin from viewport edges
      Z_INDEX: 2147483647, // Maximum z-index
      ANIMATION_DURATION: 200, // milliseconds
    },
  },

  // Dictionary Configuration
  DICTIONARY: {
    // In-Memory Cache - Layer 1
    CACHE: {
      MAX_SIZE: 500, // Recent 500 words in memory
      TTL: 3600000, // 1 hour
    },
    // API - Layer 2
    API_FALLBACK: {
      ENABLED: true,
    },
  },

  // Selectors for elements to ignore
  IGNORE_SELECTORS: [
    'input',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ],

  // Keyboard shortcuts
  KEYBOARD: {
    ESC: 'Escape',
    ENTER: 'Enter',
  },
};

(function() {
  'use strict';

  /**
   * Simple LRU Cache implementation for API responses
   */
  class SimpleCache {
    constructor(maxSize = 100, ttl = 3600000) {
      this.maxSize = maxSize;
      this.ttl = ttl; // Time to live in milliseconds
      this.cache = new Map();
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null
     */
    get(key) {
      const item = this.cache.get(key);
      if (!item) {
        return null;
      }

      // Check if expired
      if (Date.now() - item.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }

      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, item);
      return item.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
      // Remove oldest if at max size
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(key, {
        value,
        timestamp: Date.now(),
      });
    }

    /**
     * Clear all cache entries
     */
    clear() {
      this.cache.clear();
    }

    /**
     * Get cache size
     * @returns {number} Number of cached items
     */
    size() {
      return this.cache.size;
    }
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  function sanitizeHTML(str) {
    if (typeof str !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Escape HTML entities
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') {
      return '';
    }

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return str.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {boolean} immediate - Whether to call immediately
   * @returns {Function} Debounced function
   */
  function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} True if successful
   */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (err) {
      console.error('QuickDefine: Failed to copy to clipboard', err);
      return false;
    }
  }

  /**
   * Create AbortController for request cancellation
   * @returns {AbortController} AbortController instance
   */
  function createAbortController() {
    return new AbortController();
  }

  /**
   * Fetch with timeout and retry logic
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Response>} Fetch response
   */
  async function fetchWithTimeout(url, options = {}, timeout = 10000, retries = 2) {
    const controller = createAbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      // Retry logic
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWithTimeout(url, options, timeout, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Format error message for user display
   * @param {Error|string} error - Error object or message
   * @returns {string} Formatted error message
   */
  function formatErrorMessage(error) {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message || 'An unexpected error occurred';
    }

    return 'An unexpected error occurred';
  }

  /**
   * Dictionary Manager - API-first lookup system
   * Manages dictionary lookups using in-memory cache and API fallback
   */
  class DictionaryManager {
    constructor(config) {
      this.config = config;
      this.cache = new SimpleCache(
        config.DICTIONARY.CACHE.MAX_SIZE,
        config.DICTIONARY.CACHE.TTL
      );
      this.apiUrl = config.API.BASE_URL;
      this.apiTimeout = config.API.TIMEOUT;
      this.apiRetries = config.API.RETRY_ATTEMPTS;
    }

    /**
     * Get definition using cache and API
     * @param {string} word - Word to look up
     * @returns {Promise<Object>} Definition result
     */
    async getDefinition(word) {
      const cleanWord = word.trim().toLowerCase();
      const startTime = performance.now();

      // Layer 1: Check In-Memory Cache
      const cachedResult = this.cache.get(`word_${cleanWord}`);
      if (cachedResult) {
        const time = performance.now() - startTime;
        console.log(`QuickDefine: Found in cache (${time.toFixed(2)}ms)`);
        return { data: cachedResult, source: 'cache' };
      }

      // Layer 2: Fetch from API
      try {
        const result = await this.fetchFromAPI(cleanWord);
        if (result.data) {
          // Store in cache
          this.cache.set(`word_${cleanWord}`, result.data);
          const time = performance.now() - startTime;
          console.log(`QuickDefine: Fetched from API (${time.toFixed(2)}ms)`);
          return { ...result, source: 'api' };
        }
        return result;
      } catch (error) {
        const time = performance.now() - startTime;
        console.error(`QuickDefine: API lookup failed (${time.toFixed(2)}ms)`, error);
        return { error: 'network', message: formatErrorMessage(error) };
      }
    }

    /**
     * Fetch definition from API
     * @param {string} word - Word to fetch
     * @returns {Promise<Object>} API response
     */
    async fetchFromAPI(word) {
      const url = `${this.apiUrl}/${encodeURIComponent(word)}`;
      const controller = createAbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      try {
        const response = await fetchWithTimeout(
          url,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          },
          this.apiTimeout,
          this.apiRetries
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            return { error: 'not_found' };
          }
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return { data };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          return { error: 'timeout' };
        }
        throw error;
      }
    }

    /**
     * Clear cache
     */
    clearCache() {
      this.cache.clear();
    }
  }

  // Export utilities to global scope
  window.QuickDefineUtils = {
    SimpleCache,
    DictionaryManager,
    sanitizeHTML,
    escapeHTML,
    debounce,
    copyToClipboard,
    createAbortController,
    fetchWithTimeout,
    formatErrorMessage,
  };
})();

