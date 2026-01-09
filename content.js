/**
 * QuickDefine - Content Script
 * Main logic for text selection, API fetching, and popup display
 * Optimized with caching, request cancellation, and XSS protection
 */

(function() {
  'use strict';

  // Ensure dependencies are loaded
  if (typeof QUICKDEFINE_CONFIG === 'undefined' || typeof window.QuickDefineUtils === 'undefined') {
    console.error('QuickDefine: Required dependencies not loaded. Ensure constants.js and utils.js are loaded first.');
    return;
  }

  const { DictionaryManager, sanitizeHTML, escapeHTML, debounce, copyToClipboard, formatErrorMessage } = window.QuickDefineUtils;
  const CONFIG = QUICKDEFINE_CONFIG;

  // State management
  let currentPopup = null;
  let debounceTimer = null;
  let dictionaryManager = null;

  // Initialize Dictionary Manager with 3-layer cache system
  if (CONFIG.DICTIONARY.INDEXEDDB.ENABLED) {
    dictionaryManager = new DictionaryManager({
      HOT_CACHE: CONFIG.DICTIONARY.HOT_CACHE,
      API: CONFIG.API,
    });
  }

  /**
   * Validates the selected text
   * @param {string} text - The selected text
   * @param {Selection} selection - The selection object
   * @returns {boolean} - True if valid, false otherwise
   */
  function isValidSelection(text, selection) {
    // Trim whitespace
    const trimmed = text.trim();
    
    // Ignore empty selections or too short
    if (!trimmed || trimmed.length < CONFIG.SELECTION.MIN_LENGTH) {
      return false;
    }

    // Ignore if more than max words
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > CONFIG.SELECTION.MAX_WORDS) {
      return false;
    }

    // Ignore if selection is inside input field or textarea
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range) {
      const container = range.commonAncestorContainer;
      const node = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container;
      
      if (node) {
        // Check all ignore selectors
        for (const selector of CONFIG.IGNORE_SELECTORS) {
          if (node.matches && node.matches(selector)) {
            return false;
          }
          const closest = node.closest && node.closest(selector);
          if (closest) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Gets the bounding rectangle of the selected text
   * @param {Selection} selection - The selection object
   * @returns {DOMRect|null} - The bounding rectangle
   */
  function getSelectionBounds(selection) {
    if (selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    return range.getBoundingClientRect();
  }

  /**
   * Calculates optimal position for the popup with viewport collision detection
   * @param {DOMRect} selectionRect - Bounding rect of selected text
   * @param {number} popupWidth - Width of the popup
   * @param {number} popupHeight - Height of the popup
   * @returns {Object} - {top, left, placement: 'below' | 'above'}
   */
  function calculatePosition(selectionRect, popupWidth, popupHeight) {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Default: show below the selection
    const gap = CONFIG.UI.POPUP.GAP;
    const margin = CONFIG.UI.POPUP.VIEWPORT_MARGIN;
    let top = selectionRect.bottom + scrollY + gap;
    let left = selectionRect.left + scrollX;
    let placement = 'below';

    // Check if popup would overflow bottom of viewport
    const spaceBelow = viewport.height - (selectionRect.bottom - scrollY);
    const spaceAbove = selectionRect.top - scrollY;

    if (spaceBelow < popupHeight + margin && spaceAbove > spaceBelow) {
      // Show above the selection
      top = selectionRect.top + scrollY - popupHeight - gap;
      placement = 'above';
    }

    // Check if popup would overflow right edge
    if (left + popupWidth > viewport.width + scrollX - margin) {
      left = viewport.width + scrollX - popupWidth - margin;
    }

    // Check if popup would overflow left edge
    if (left < scrollX + margin) {
      left = scrollX + margin;
    }

    return { top, left, placement };
  }

  /**
   * Fetches definition using 3-layer cache system (Hot Cache → IndexedDB → API)
   * @param {string} word - The word to look up
   * @returns {Promise<Object>} - The definition result
   */
  async function fetchDefinition(word) {
    if (!dictionaryManager) {
      // Fallback to direct API call if DictionaryManager not available
      return { error: 'not_initialized', message: 'Dictionary manager not initialized' };
    }

    try {
      const result = await dictionaryManager.getDefinition(word);
      return result;
    } catch (error) {
      console.error('QuickDefine: Dictionary lookup failed', error);
      return { error: 'network', message: formatErrorMessage(error) };
    }
  }

  /**
   * Creates and injects the popup into the DOM using Shadow DOM
   * @param {Object} position - Position coordinates {top, left}
   * @returns {HTMLElement} - The shadow root host element
   */
  function createPopupContainer(position) {
    // Remove existing popup if any
    if (currentPopup) {
      currentPopup.remove();
    }

    // Create host element
    const host = document.createElement('div');
    host.className = 'quickdefine-host';
    host.style.cssText = `
      position: absolute;
      top: ${position.top}px;
      left: ${position.left}px;
      z-index: ${CONFIG.UI.POPUP.Z_INDEX};
      pointer-events: none;
    `;

    // Create shadow root
    const shadowRoot = host.attachShadow({ mode: 'open' });

    // Inject styles
    const styleElement = document.createElement('style');
    styleElement.textContent = QUICKDEFINE_STYLES;
    shadowRoot.appendChild(styleElement);

    // Create container
    const container = document.createElement('div');
    container.className = 'quickdefine-container';
    shadowRoot.appendChild(container);

    // Append to document body
    document.body.appendChild(host);
    currentPopup = host;

    return { host, shadowRoot, container };
  }

  /**
   * Renders the loading state
   * @param {HTMLElement} container - The container element
   */
  function renderLoading(container) {
    container.innerHTML = `
      <div class="quickdefine-card">
        <div class="quickdefine-loading">
          <div class="quickdefine-spinner"></div>
          <span>Searching...</span>
        </div>
      </div>
    `;
  }

  /**
   * Renders the error state
   * @param {HTMLElement} container - The container element
   * @param {string} errorType - Type of error ('not_found' | 'network' | 'cancelled')
   * @param {string} errorMessage - Optional error message
   */
  function renderError(container, errorType, errorMessage = '') {
    let message = 'Unable to fetch definition. Please try again.';
    
    if (errorType === 'not_found') {
      message = 'Definition not found';
    } else if (errorType === 'cancelled') {
      message = 'Request cancelled';
    } else if (errorMessage) {
      message = escapeHTML(errorMessage);
    }

    const safeMessage = escapeHTML(message);
    container.innerHTML = `
      <div class="quickdefine-card">
        <div class="quickdefine-error">
          <div class="quickdefine-error-icon">📖</div>
          <div class="quickdefine-error-message">${safeMessage}</div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the success state with definition data
   * @param {HTMLElement} container - The container element
   * @param {Array} data - API response data array
   * @param {HTMLElement} shadowRoot - Shadow root for audio button functionality
   */
  function renderSuccess(container, data, shadowRoot) {
    if (!data || data.length === 0) {
      renderError(container, 'not_found');
      return;
    }

    const entry = data[0];
    const word = escapeHTML(entry.word || '');
    const phonetic = escapeHTML(entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '');
    const audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';

    let definitionsHtml = '';

    // Process meanings
    if (entry.meanings && entry.meanings.length > 0) {
      definitionsHtml = entry.meanings.map(meaning => {
        const partOfSpeech = meaning.partOfSpeech || '';
        const definitions = meaning.definitions || [];

        let defListHtml = definitions.map(def => {
          const definitionText = escapeHTML(def.definition || '');
          const example = def.example ? `<div class="quickdefine-example">"${escapeHTML(def.example)}"</div>` : '';
          
          return `
            <li class="quickdefine-definition-item">
              <div class="quickdefine-definition-text">${definitionText}</div>
              ${example}
            </li>
          `;
        }).join('');

        const safePartOfSpeech = escapeHTML(partOfSpeech);
        return `
          <div class="quickdefine-meaning">
            ${partOfSpeech ? `<div class="quickdefine-part-of-speech">${safePartOfSpeech}</div>` : ''}
            <ul class="quickdefine-definition-list">
              ${defListHtml}
            </ul>
          </div>
        `;
      }).join('');
    }

    const audioButtonHtml = audioUrl 
      ? `<button class="quickdefine-audio-btn" aria-label="Play pronunciation" title="Play pronunciation">🔊</button>`
      : '';
    
    const copyButtonHtml = `<button class="quickdefine-copy-btn" aria-label="Copy definition" title="Copy definition">📋</button>`;

    container.innerHTML = `
      <div class="quickdefine-card">
        <div class="quickdefine-header">
          <div class="quickdefine-word">
            <span>${word}</span>
            <div class="quickdefine-actions">
              ${audioButtonHtml}
              ${copyButtonHtml}
            </div>
          </div>
          ${phonetic ? `<div class="quickdefine-phonetic">${phonetic}</div>` : ''}
        </div>
        <div class="quickdefine-definitions">
          ${definitionsHtml}
        </div>
      </div>
    `;

    // Attach audio button event listener if audio exists
    if (audioUrl) {
      const audioButton = shadowRoot.querySelector('.quickdefine-audio-btn');
      if (audioButton) {
        audioButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const audio = new Audio(audioUrl);
          audio.play().catch(err => {
            console.error('QuickDefine: Audio playback failed', err);
          });
        });
      }
    }

    // Attach copy button event listener
    const copyButton = shadowRoot.querySelector('.quickdefine-copy-btn');
    if (copyButton) {
      copyButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const wordText = entry.word || '';
        const definitionText = entry.meanings?.map(m => 
          m.definitions?.map(d => d.definition).join('\n')
        ).join('\n\n') || '';
        const textToCopy = `${wordText}${phonetic ? ` (${phonetic})` : ''}\n\n${definitionText}`;
        
        const success = await copyToClipboard(textToCopy);
        if (success) {
          // Visual feedback
          const originalText = copyButton.textContent;
          copyButton.textContent = '✓';
          copyButton.style.color = '#34c759';
          setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.color = '';
          }, 1000);
        }
      });
    }
  }

  /**
   * Shows the definition popup for selected text
   * @param {string} selectedText - The selected text
   * @param {Selection} selection - The selection object
   */
  async function showDefinition(selectedText, selection) {
    const selectionRect = getSelectionBounds(selection);
    if (!selectionRect) {
      return;
    }

    // Create popup container with estimated dimensions
    const estimatedWidth = CONFIG.UI.POPUP.MIN_WIDTH + 40; // Slightly larger than min
    const estimatedHeight = 200;
    const position = calculatePosition(selectionRect, estimatedWidth, estimatedHeight);

    const { host, shadowRoot, container } = createPopupContainer(position);

    // Show loading state
    renderLoading(container);

    // Fetch definition
    const result = await fetchDefinition(selectedText);

    // Update popup with result
    if (result.error) {
      renderError(container, result.error, result.message);
    } else {
      renderSuccess(container, result.data, shadowRoot);
      
      // Recalculate position with actual dimensions after render
      requestAnimationFrame(() => {
        const card = shadowRoot.querySelector('.quickdefine-card');
        if (card) {
          const actualRect = card.getBoundingClientRect();
          const actualPosition = calculatePosition(selectionRect, actualRect.width, actualRect.height);
          host.style.top = `${actualPosition.top}px`;
          host.style.left = `${actualPosition.left}px`;
        }
      });
    }
  }

  /**
   * Removes the current popup from the DOM
   */
  function removePopup() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
  }

  /**
   * Handles mouseup event to detect text selection
   * @param {MouseEvent} event - The mouseup event
   */
  function handleMouseUp(event) {
    // Clear any existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce the selection check
    debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      // Check if selection is valid
      if (!isValidSelection(selectedText, selection)) {
        // If clicking outside, remove popup
        if (currentPopup && !currentPopup.contains(event.target)) {
          removePopup();
        }
        return;
      }

      // Show definition
      showDefinition(selectedText, selection);
    }, CONFIG.SELECTION.DEBOUNCE_DELAY);
  }

  /**
   * Handles click events for click-outside-to-close functionality
   * @param {MouseEvent} event - The click event
   */
  function handleClick(event) {
    if (!currentPopup) {
      return;
    }

    // Check if click is outside the popup
    const clickTarget = event.target;
    const shadowRoot = currentPopup.shadowRoot;
    
    // Check if click is inside shadow DOM using elementsFromPoint
    let isInsidePopup = false;
    if (shadowRoot && typeof shadowRoot.elementsFromPoint === 'function') {
      try {
        const shadowElements = shadowRoot.elementsFromPoint(event.clientX, event.clientY);
        isInsidePopup = shadowElements.length > 0;
      } catch (e) {
        // Fallback: check bounding rect
        const rect = currentPopup.getBoundingClientRect();
        isInsidePopup = (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      }
    } else {
      // Fallback: check bounding rect if elementsFromPoint is not available
      const rect = currentPopup.getBoundingClientRect();
      isInsidePopup = (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    // Also check if click is on the host element itself
    if (!isInsidePopup && !currentPopup.contains(clickTarget)) {
      removePopup();
      // Clear selection to prevent immediate re-trigger
      window.getSelection().removeAllRanges();
    }
  }

  /**
   * Handles scroll events to update popup position or remove it
   */
  function handleScroll() {
    if (currentPopup) {
      // Remove popup on scroll for better UX
      removePopup();
    }
  }

  /**
   * Handles keyboard events (ESC to close)
   * @param {KeyboardEvent} event - The keyboard event
   */
  function handleKeyDown(event) {
    if (event.key === CONFIG.KEYBOARD.ESC && currentPopup) {
      removePopup();
      // Clear selection to prevent immediate re-trigger
      window.getSelection().removeAllRanges();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Initializes the extension
   */
  function init() {
    // Attach event listeners
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown, true);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      removePopup();
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
