/**
 * QuickDefine - IndexedDB Database Manager
 * Handles dictionary storage and retrieval using IndexedDB
 */

(function() {
  'use strict';

  const DB_NAME = 'QuickDefineDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'dictionary';
  const INDEX_NAME = 'wordIndex';

  /**
   * IndexedDB Dictionary Manager
   * Manages dictionary entries in IndexedDB with fast indexed lookups
   */
  class DictionaryDB {
    constructor() {
      this.db = null;
      this.initPromise = null;
    }

    /**
     * Initialize IndexedDB database
     * @returns {Promise<IDBDatabase>} Database instance
     */
    async init() {
      // Return existing promise if initialization is in progress
      if (this.initPromise) {
        return this.initPromise;
      }

      // Return existing database if already initialized
      if (this.db) {
        return this.db;
      }

      this.initPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB open failed', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const objectStore = db.createObjectStore(STORE_NAME, {
              keyPath: 'word',
            });

            // Create index on word for fast lookups
            objectStore.createIndex(INDEX_NAME, 'word', { unique: true });
          }
        };
      });

      return this.initPromise;
    }

    /**
     * Get dictionary entry by word
     * @param {string} word - Word to look up
     * @returns {Promise<Object|null>} Dictionary entry or null if not found
     */
    async get(word) {
      await this.init();
      const cleanWord = word.trim().toLowerCase();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cleanWord);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB get failed', request.error);
          reject(request.error);
        };
      });
    }

    /**
     * Store dictionary entry
     * @param {Object} entry - Dictionary entry object
     * @returns {Promise<void>}
     */
    async set(entry) {
      await this.init();
      
      if (!entry.word) {
        throw new Error('Dictionary entry must have a word property');
      }

      const cleanWord = entry.word.trim().toLowerCase();
      const entryToStore = {
        ...entry,
        word: cleanWord,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entryToStore);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB set failed', request.error);
          reject(request.error);
        };
      });
    }

    /**
     * Store multiple dictionary entries in batch
     * @param {Array<Object>} entries - Array of dictionary entries
     * @returns {Promise<void>}
     */
    async setBatch(entries) {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let completed = 0;
        let hasError = false;

        entries.forEach((entry) => {
          if (!entry.word) {
            console.warn('QuickDefine: Skipping entry without word property', entry);
            completed++;
            if (completed === entries.length && !hasError) {
              resolve();
            }
            return;
          }

          const cleanWord = entry.word.trim().toLowerCase();
          const entryToStore = {
            ...entry,
            word: cleanWord,
            timestamp: Date.now(),
          };

          const request = store.put(entryToStore);

          request.onsuccess = () => {
            completed++;
            if (completed === entries.length && !hasError) {
              resolve();
            }
          };

          request.onerror = () => {
            if (!hasError) {
              hasError = true;
              console.error('QuickDefine: IndexedDB batch set failed', request.error);
              reject(request.error);
            }
          };
        });
      });
    }

    /**
     * Check if word exists in database
     * @param {string} word - Word to check
     * @returns {Promise<boolean>} True if word exists
     */
    async has(word) {
      const entry = await this.get(word);
      return entry !== null;
    }

    /**
     * Get count of entries in database
     * @returns {Promise<number>} Number of entries
     */
    async count() {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB count failed', request.error);
          reject(request.error);
        };
      });
    }

    /**
     * Clear all entries from database
     * @returns {Promise<void>}
     */
    async clear() {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB clear failed', request.error);
          reject(request.error);
        };
      });
    }

    /**
     * Delete specific entry
     * @param {string} word - Word to delete
     * @returns {Promise<void>}
     */
    async delete(word) {
      await this.init();
      const cleanWord = word.trim().toLowerCase();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(cleanWord);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB delete failed', request.error);
          reject(request.error);
        };
      });
    }

    /**
     * Get all words (for debugging/testing)
     * @param {number} limit - Maximum number of entries to return
     * @returns {Promise<Array>} Array of entries
     */
    async getAll(limit = 1000) {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result.slice(0, limit);
          resolve(results);
        };

        request.onerror = () => {
          console.error('QuickDefine: IndexedDB getAll failed', request.error);
          reject(request.error);
        };
      });
    }
  }

  // Export to global scope
  window.QuickDefineDB = DictionaryDB;
})();
