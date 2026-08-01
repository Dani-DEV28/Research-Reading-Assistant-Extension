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
        try {
          const result = window.PaperDetector.detect();
          window.PaperDetector.logToConsole(result);
          sendResponse({ ok: true, data: result });
        } catch (err) {
          sendResponse({ ok: false, error: 'Detection failed: ' + (err.message || err) });
        }
        break;

      default:
        return;
    }
    return false;
  });
})();
