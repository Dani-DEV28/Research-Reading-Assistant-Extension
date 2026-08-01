import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  'lib/pdf.worker.min.mjs'
);

let busy = false;

function pageLinesFromItems(items) {
  const lines = [];
  let lastY = null;
  let lastX = null;
  let line = [];
  let lineY = 0;

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const x = item.transform ? item.transform[4] : 0;
    const y = item.transform ? item.transform[5] : 0;

    if (lastY !== null && Math.abs(y - lastY) > 2) {
      const text = line.join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push({ text, y: lineY });
      line = [];
    } else if (lastX !== null && line.length && x < lastX - 2) {
      const text = line.join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push({ text, y: lineY });
      line = [];
    }

    if (!line.length) lineY = y;
    line.push(item.str);
    lastY = y;
    lastX = x;
  }

  if (line.length) {
    const text = line.join(' ').replace(/\s+/g, ' ').trim();
    if (text) lines.push({ text, y: lineY });
  }

  return lines;
}

const TOP_BAND = 0.9;
const BOTTOM_BAND = 0.1;

const HEADER_FOOTER_PATTERNS = [
  /^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$/,
  /^\s*page\s+\d+\s+of\s+\d+\s*$/i,
  /^arxiv:\s*\d{4}\.\d{5}/i,
  /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*$/i,
];

function stripHeaderFooter(rawPages) {
  const seen = {};
  for (const page of rawPages) {
    for (const line of page.lines) {
      const norm = line.y / page.height;
      if (norm >= TOP_BAND || norm <= BOTTOM_BAND) {
        const key = Math.round(norm * 200) / 200 + '\u0000' + line.text;
        seen[key] = (seen[key] || 0) + 1;
      }
    }
  }

  const repeated = new Set(
    Object.entries(seen)
      .filter(([, count]) => count >= 2)
      .map(([key]) => key)
  );

  return rawPages.map((page) => {
    const kept = [];
    for (const line of page.lines) {
      const norm = line.y / page.height;
      if (norm >= TOP_BAND || norm <= BOTTOM_BAND) {
        const key = Math.round(norm * 200) / 200 + '\u0000' + line.text;
        if (
          repeated.has(key) ||
          HEADER_FOOTER_PATTERNS.some((p) => p.test(line.text))
        ) {
          continue;
        }
      }
      kept.push(line.text);
    }
    return kept.join('\n');
  });
}

async function fetchPdfBytes(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    if (/^file:/i.test(url)) {
      throw new Error(
        'Cannot load the local file. Enable "Allow access to file URLs" for this extension in chrome://extensions.'
      );
    }
    throw new Error('Failed to fetch the PDF from the page.');
  }
  if (!res.ok) {
    throw new Error('Failed to fetch PDF (HTTP ' + res.status + ').');
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function extractPdf(url) {
  let task = null;
  try {
    const bytes = await fetchPdfBytes(url);
    task = pdfjsLib.getDocument({ data: bytes });
    const doc = await task.promise;
    const rawPages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const view = page.view || [0, 0, 0, 612];
      const height = Math.max(1, (view[3] || 0) - (view[1] || 0));
      rawPages.push({
        pageNum: i,
        height,
        lines: pageLinesFromItems(content.items),
      });
      page.cleanup();
    }
    await doc.destroy();

    const texts = stripHeaderFooter(rawPages);
    const pages = texts.map((text, i) => ({ pageNum: i + 1, text }));
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
  extractPdf(message.url).then((result) => {
    busy = false;
    sendResponse(result);
  });
  return true;
});
