/**
 * QuickDefine - Background Service Worker
 * Handles dictionary preloading and background tasks
 */

// Import configuration (we'll need to inline it or use importScripts)
// For Manifest V3, we need to use importScripts or inline the config

// Dictionary preloading configuration
const PRELOAD_CONFIG = {
  ENABLED: true,
  PRELOAD_COUNT: 50000,
  BATCH_SIZE: 100,
  API_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
};

// Inline configuration for the background script (from constants.js)
const QUICKDEFINE_CONFIG_INLINE = {
  DICTIONARY: {
    INDEXEDDB: {
      PRELOAD_ENABLED: true,
      PRELOAD_COUNT: 50000,
      BATCH_SIZE: 100,
    },
  },
  API: {
    BASE_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
  },
};

// Update PRELOAD_CONFIG from inline config
PRELOAD_CONFIG.ENABLED = QUICKDEFINE_CONFIG_INLINE.DICTIONARY.INDEXEDDB.PRELOAD_ENABLED;
PRELOAD_CONFIG.PRELOAD_COUNT = QUICKDEFINE_CONFIG_INLINE.DICTIONARY.INDEXEDDB.PRELOAD_COUNT;
PRELOAD_CONFIG.BATCH_SIZE = QUICKDEFINE_CONFIG_INLINE.DICTIONARY.INDEXEDDB.BATCH_SIZE;
PRELOAD_CONFIG.API_URL = QUICKDEFINE_CONFIG_INLINE.API.BASE_URL;

// No longer need COMMON_WORDS here, as we're loading from dictionary.json


/**
 * Initialize IndexedDB in service worker context
 */
async function initDB() {
  return new Promise((resolve, reject) => {
    const DB_NAME = 'QuickDefineDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'dictionary';

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'word',
        });
        objectStore.createIndex('wordIndex', 'word', { unique: true });
      }
    };
  });
}


/**
 * Store batch of entries
 */
async function storeBatch(db, entries) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['dictionary'], 'readwrite');
    const store = transaction.objectStore('dictionary');
    let completed = 0;
    let hasError = false;

    entries.forEach((entry) => {
      if (!entry.word) {
        completed++;
        if (completed === entries.length && !hasError) resolve();
        return;
      }

      const request = store.put({
        word: entry.word.trim().toLowerCase(),
        data: entry.data || entry,
        timestamp: Date.now(),
      });

      request.onsuccess = () => {
        completed++;
        if (completed === entries.length && !hasError) resolve();
      };

      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
    });
  });
}

/**
 * Fetch word definition from API
 */
async function fetchWordDefinition(word) {
  try {
    const response = await fetch(`${PRELOAD_CONFIG.API_URL}/${encodeURIComponent(word)}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`QuickDefine: Failed to fetch ${word}`, error);
    return null;
  }
}


/**
 * Preload dictionary with common words
 * This runs in the background and doesn't block the extension
 */
async function preloadDictionary() {
  if (!PRELOAD_CONFIG.ENABLED) {
    return;
  }

  try {
    const db = await initDB();
    const countRequest = db.transaction(['dictionary'], 'readonly').objectStore('dictionary').count();
    const currentWordCount = await new Promise(resolve => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => resolve(0);
    });

    if (currentWordCount >= PRELOAD_CONFIG.PRELOAD_COUNT) {
      console.log('QuickDefine: Dictionary already preloaded with sufficient words.');
      return;
    }

    console.log('QuickDefine: Starting dictionary preload...');

    // Fetch the dictionary.json bundled with the extension
    const response = await fetch(chrome.runtime.getURL('dictionary.json'));
    if (!response.ok) {
      throw new Error(`Failed to load dictionary.json: ${response.statusText}`);
    }
    const dictionaryEntries = await response.json();

    console.log(`QuickDefine: Processing ${dictionaryEntries.length} words from bundled file...`);

    let loaded = 0;
    const batch = [];

    for (const entry of dictionaryEntries.slice(0, PRELOAD_CONFIG.PRELOAD_COUNT)) {
      // Ensure the entry is in the correct format for IndexedDB
      const formattedEntry = {
        word: entry.word.trim().toLowerCase(),
        data: entry.data || entry, // Use existing 'data' or the whole entry if 'data' is missing
      };
      batch.push(formattedEntry);

      if (batch.length >= PRELOAD_CONFIG.BATCH_SIZE) {
        await storeBatch(db, batch);
        loaded += batch.length;
        batch.length = 0;
        console.log(`QuickDefine: Preloaded ${loaded} words...`);
        // Yield to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Store remaining batch
    if (batch.length > 0) {
      await storeBatch(db, batch);
      loaded += batch.length;
    }

    console.log(`QuickDefine: Dictionary preload complete. Loaded ${loaded} words.`);

    // Send message to content scripts that preload is complete
    chrome.runtime.sendMessage({
      type: 'PRELOAD_COMPLETE',
      count: loaded,
    }).catch(() => {
      // Ignore errors if no listeners
    });

  } catch (error) {
    console.error('QuickDefine: Dictionary preload failed', error);
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('QuickDefine: Extension installed, starting dictionary preload...');
    // Start preload in background (non-blocking)
    preloadDictionary();
  } else if (details.reason === 'update') {
    console.log('QuickDefine: Extension updated');
    // Optionally check for dictionary updates
  }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_PRELOAD_STATUS') {
    // Check current word count to determine preload status
    initDB().then(db => {
      const transaction = db.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        sendResponse({ preloaded: countRequest.result >= PRELOAD_CONFIG.PRELOAD_COUNT });
      };
      countRequest.onerror = () => sendResponse({ preloaded: false });
    }).catch(() => sendResponse({ preloaded: false }));
    return true; // Keep channel open for async response
  }

  if (request.type === 'TRIGGER_PRELOAD') {
    preloadDictionary().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initialize on service worker startup
console.log('QuickDefine: Background service worker started');
