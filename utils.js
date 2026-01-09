/**
 * QuickDefine - Utility Functions
 * Reusable utility functions for the extension
 */

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
   * Dictionary Manager - 3-Layer Cache System
   * Manages dictionary lookups across In-Memory Map, IndexedDB, and API
   */
  class DictionaryManager {
    constructor(config) {
      this.config = config;
      this.hotCache = new SimpleCache(
        config.HOT_CACHE.MAX_SIZE,
        config.HOT_CACHE.TTL
      );
      this.db = null; // Will be initialized when IndexedDB is available
      this.apiUrl = config.API.BASE_URL;
      this.apiTimeout = config.API.TIMEOUT;
      this.apiRetries = config.API.RETRY_ATTEMPTS;
    }

    /**
     * Initialize IndexedDB connection
     * @returns {Promise<void>}
     */
    async initDB() {
      if (typeof window.QuickDefineDB === 'undefined') {
        console.warn('QuickDefine: IndexedDB class not loaded');
        return;
      }

      if (!this.db) {
        this.db = new window.QuickDefineDB();
        try {
          await this.db.init();
        } catch (error) {
          console.error('QuickDefine: Failed to initialize IndexedDB', error);
          this.db = null;
        }
      }
    }

    /**
     * Get definition using 3-layer lookup system
     * @param {string} word - Word to look up
     * @returns {Promise<Object>} Definition result
     */
    async getDefinition(word) {
      const cleanWord = word.trim().toLowerCase();
      const startTime = performance.now();

      // Layer 1: Check Hot Cache (In-Memory Map)
      const hotCacheResult = this.hotCache.get(`word_${cleanWord}`);
      if (hotCacheResult) {
        const time = performance.now() - startTime;
        console.log(`QuickDefine: Found in hot cache (${time.toFixed(2)}ms)`);
        return { data: hotCacheResult, source: 'hot_cache' };
      }

      // Layer 2: Check IndexedDB
      await this.initDB();
      if (this.db) {
        try {
          const dbResult = await this.db.get(cleanWord);
          if (dbResult && dbResult.data) {
            // Store in hot cache for faster future access
            this.hotCache.set(`word_${cleanWord}`, dbResult.data);
            const time = performance.now() - startTime;
            console.log(`QuickDefine: Found in IndexedDB (${time.toFixed(2)}ms)`);
            return { data: dbResult.data, source: 'indexeddb' };
          }
        } catch (error) {
          console.error('QuickDefine: IndexedDB lookup failed', error);
        }
      }

      // Layer 3: Fetch from API
      try {
        const apiResult = await this.fetchFromAPI(cleanWord);
        if (apiResult.data) {
          // Cache in both layers
          this.hotCache.set(`word_${cleanWord}`, apiResult.data);
          if (this.db) {
            try {
              await this.db.set({
                word: cleanWord,
                data: apiResult.data,
              });
            } catch (error) {
              console.error('QuickDefine: Failed to cache in IndexedDB', error);
            }
          }
          const time = performance.now() - startTime;
          console.log(`QuickDefine: Fetched from API (${time.toFixed(2)}ms)`);
          return { ...apiResult, source: 'api' };
        }
        return apiResult;
      } catch (error) {
        const time = performance.now() - startTime;
        console.error(`QuickDefine: All lookup layers failed (${time.toFixed(2)}ms)`, error);
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
     * Preload dictionary entries into IndexedDB
     * @param {Array<Object>} entries - Array of dictionary entries
     * @param {Function} onProgress - Progress callback (current, total)
     * @returns {Promise<void>}
     */
    async preloadDictionary(entries, onProgress) {
      await this.initDB();
      if (!this.db) {
        throw new Error('IndexedDB not available');
      }

      const batchSize = 100;
      const total = entries.length;
      let processed = 0;

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const formattedBatch = batch.map(entry => ({
          word: entry.word?.trim().toLowerCase() || '',
          data: entry.data || entry,
        }));

        await this.db.setBatch(formattedBatch);
        processed += batch.length;

        if (onProgress) {
          onProgress(processed, total);
        }

        // Yield to prevent blocking UI
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Cache stats
     */
    async getStats() {
      const stats = {
        hotCache: {
          size: this.hotCache.size(),
          maxSize: this.config.HOT_CACHE.MAX_SIZE,
        },
        indexedDB: {
          count: 0,
          available: false,
        },
      };

      if (this.db) {
        try {
          stats.indexedDB.count = await this.db.count();
          stats.indexedDB.available = true;
        } catch (error) {
          console.error('QuickDefine: Failed to get IndexedDB stats', error);
        }
      }

      return stats;
    }

    /**
     * Clear all caches
     * @returns {Promise<void>}
     */
    async clearAll() {
      this.hotCache.clear();
      if (this.db) {
        try {
          await this.db.clear();
        } catch (error) {
          console.error('QuickDefine: Failed to clear IndexedDB', error);
        }
      }
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
