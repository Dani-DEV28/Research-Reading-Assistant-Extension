import * as pdfjsLib from '../lib/pdfjs/pdf.min.mjs';
import { extractStructure, buildLines } from './parser.js';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

function isPdfBytes(buffer) {
  const head = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
  if (head.length < 5) return false;
  for (let i = 0; i < 5; i++) {
    if (head[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

function looksLikePdf(url) {
  return (
    /\.pdf($|[?#])/i.test(url) ||
    /^data:application\/pdf/i.test(url) ||
    /^file:/i.test(url)
  );
}

async function detectFromUrl(url) {
  const isFile = /^file:/i.test(url);

  if (isFile) {
    try {
      const allowed = await chrome.extension.isAllowedFileSchemeAccess();
      if (!allowed) {
        return { error: 'PDF_FILE_ACCESS' };
      }
    } catch (_) {
      return { error: 'PDF_FILE_ACCESS' };
    }
  }

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    return { error: 'PDF_FETCH_FAILED', detail: err && err.message };
  }

  if (!response.ok) {
    return { error: 'PDF_FETCH_FAILED', detail: String(response.status) };
  }

  const buffer = await response.arrayBuffer();
  if (!isPdfBytes(buffer)) {
    return { error: 'NOT_A_PDF' };
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    'lib/pdfjs/pdf.worker.min.mjs'
  );

  let pdf;
  try {
    const task = pdfjsLib.getDocument({ data: buffer });
    pdf = await task.promise;
  } catch (err) {
    return { error: 'PDF_PARSE_FAILED', detail: err && err.message };
  }

  let metadataTitle = '';
  try {
    const meta = await pdf.getMetadata();
    metadataTitle = (meta && meta.info && meta.info.Title) || '';
  } catch (_) {
    metadataTitle = '';
  }

  let data;
  try {
    data = await extractStructure(pdf, url, metadataTitle);
  } catch (err) {
    return { error: 'PDF_PARSE_FAILED', detail: err && err.message };
  }

  data.paper_id = window.PaperStorage
    ? window.PaperStorage.paperIdForUrl(url)
    : url;

  console.log('[Research Reading Assistant] PDF structure:', {
    pages: pdf.numPages,
    tagged: data.tagged,
    title: data.title ? data.title.slice(0, 80) : '(none)',
    abstract: data.abstract ? data.abstract.length + ' chars' : '(none)',
    sections: data.sections.length,
    figures: data.figures.length,
    methods: Boolean(data.methods),
    conclusion: Boolean(data.conclusion),
    headings: data.sections.map((s) => s.heading).slice(0, 30),
  });

  try {
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent({ includeMarkedContent: true });
    const preview = buildLines(textContent.items)
      .slice(0, 10)
      .map((line) => ({ h: line.height, text: line.text }));
    console.log('[Research Reading Assistant] PDF page 1 preview lines:', preview);
  } catch (_) {
    /* preview is best-effort only */
  }

  return { ok: true, data };
}

window.PdfDetect = { detectFromUrl, looksLikePdf };
