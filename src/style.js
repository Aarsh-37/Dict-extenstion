/**
 * QuickDefine - CSS Styles for Shadow DOM
 * Isolated styles to prevent conflicts with host website CSS
 */
// Make styles globally accessible to content.js
var QUICKDEFINE_STYLES = `
  /* Reset and Base Styles */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .quickdefine-container {
    position: absolute;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1d1d1f;
    pointer-events: auto;
  }

  .quickdefine-card {
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 16px;
    min-width: 280px;
    max-width: 400px;
    max-height: 500px;
    overflow-y: auto;
    animation: quickdefine-fade-in 0.2s ease-out;
  }

  @keyframes quickdefine-fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Loading State */
  .quickdefine-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: #666;
  }

  .quickdefine-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e0e0e0;
    border-top-color: #007aff;
    border-radius: 50%;
    animation: quickdefine-spin 0.6s linear infinite;
    margin-right: 8px;
  }

  @keyframes quickdefine-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Header Section */
  .quickdefine-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  .quickdefine-word {
    font-size: 20px;
    font-weight: 600;
    color: #1d1d1f;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .quickdefine-phonetic {
    font-size: 13px;
    color: #666;
    font-style: italic;
    margin-top: 2px;
  }

  /* Audio Button */
  .quickdefine-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .quickdefine-audio-btn,
  .quickdefine-copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #007aff;
    font-size: 16px;
    transition: background-color 0.2s, color 0.2s;
  }

  .quickdefine-audio-btn:hover,
  .quickdefine-copy-btn:hover {
    background-color: #f0f0f0;
  }

  .quickdefine-audio-btn:active,
  .quickdefine-copy-btn:active {
    background-color: #e0e0e0;
  }

  /* Definitions Section */
  .quickdefine-definitions {
    margin-top: 8px;
  }

  .quickdefine-meaning {
    margin-bottom: 16px;
  }

  .quickdefine-meaning:last-child {
    margin-bottom: 0;
  }

  .quickdefine-part-of-speech {
    font-size: 12px;
    font-weight: 600;
    color: #007aff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .quickdefine-definition-list {
    list-style: none;
    padding-left: 0;
  }

  .quickdefine-definition-item {
    margin-bottom: 8px;
    padding-left: 16px;
    position: relative;
  }

  .quickdefine-definition-item::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #007aff;
    font-weight: bold;
  }

  .quickdefine-definition-text {
    color: #1d1d1f;
  }

  .quickdefine-example {
    margin-top: 4px;
    padding-left: 16px;
    font-style: italic;
    color: #666;
    font-size: 13px;
  }

  /* Error State */
  .quickdefine-error {
    padding: 24px;
    text-align: center;
    color: #666;
  }

  .quickdefine-error-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .quickdefine-error-message {
    font-size: 14px;
  }

  /* Scrollbar Styling */
  .quickdefine-card::-webkit-scrollbar {
    width: 6px;
  }

  .quickdefine-card::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 3px;
  }

  .quickdefine-card::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    border-radius: 3px;
  }

  .quickdefine-card::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0;
  }
`;
