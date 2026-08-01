import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  'lib/pdf.worker.min.mjs'
);

let busy = false;

function pageTextFromItems(items) {
  const lines = [];
  let lastY = null;
  let lastX = null;
  let line = [];

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const x = item.transform ? item.transform[4] : 0;
    const y = item.transform ? item.transform[5] : 0;

    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
      line = [];
    } else if (lastX !== null && line.length && x < lastX - 2) {
      lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
      line = [];
    }

    line.push(item.str);
    lastY = y;
    lastX = x;
  }

  if (line.length) {
    lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
  }

  return lines.filter(Boolean).join('\n');
}

async function extractPdf(data, url) {
  let task = null;
  try {
    const bytes =
      data instanceof Uint8Array
        ? data
        : data && data.buffer instanceof ArrayBuffer
          ? new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength)
          : new Uint8Array(data);
    task = pdfjsLib.getDocument({ data: bytes });
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push({
        pageNum: i,
        text: pageTextFromItems(content.items),
      });
      page.cleanup();
    }
    await doc.destroy();
    return { ok: true, pages, url };
  } catch (err) {
    if (task && !task.destroyed) {
      try {
        await task.destroy();
      } catch (destroyErr) {
        /* ignore */
      }
    }
    return {
      ok: false,
      error: String((err && err.message) || err || 'failed to parse PDF'),
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'EXTRACT_PDF') return false;

  if (busy) {
    sendResponse({ ok: false, error: 'PDF extraction is already running.' });
    return false;
  }

  busy = true;
  extractPdf(message.data, message.url).then((result) => {
    busy = false;
    sendResponse(result);
  });
  return true;
});
