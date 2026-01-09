/**
 * QuickDefine - Constants and Configuration
 * Centralized configuration for the extension
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
    // Hot Cache (In-Memory Map) - Layer 1
    HOT_CACHE: {
      MAX_SIZE: 500, // Recent 500 words in memory
      TTL: 3600000, // 1 hour
    },
    // IndexedDB - Layer 2
    INDEXEDDB: {
      ENABLED: true,
      PRELOAD_ENABLED: true, // Preload common words on install
      PRELOAD_COUNT: 50000, // Number of words to preload
      BATCH_SIZE: 100, // Batch size for preloading
    },
    // API - Layer 3
    API_FALLBACK: {
      ENABLED: true,
      CACHE_RESPONSES: true, // Cache API responses in IndexedDB
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
