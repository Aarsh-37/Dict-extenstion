/**
 * QuickDefine - Background Service Worker
 * Service worker for the browser extension
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('QuickDefine: Extension installed');
  } else if (details.reason === 'update') {
    console.log('QuickDefine: Extension updated');
  }
});

console.log('QuickDefine: Background service worker started');

