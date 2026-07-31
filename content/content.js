(() => {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        sendResponse({
          ready: true,
          isPaper: window.PaperDetector && window.PaperDetector.isPaperPage(),
        });
        break;

      case 'DETECT_PAPER':
        const result = window.PaperDetector.detect();
        window.PaperDetector.logToConsole(result);
        sendResponse({ ok: true, data: result });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
    return false;
  });
})();
