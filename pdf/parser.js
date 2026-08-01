export function cleanText(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

export function truncate(text, max) {
  const value = cleanText(text);
  if (value.length <= max) return value;
  return value.slice(0, max) + '...';
}

function stripLeadingNumber(text) {
  return String(text || '').replace(
    /^\s*(?:\d+(?:\.\d+)*(?:[.\u00b7\-:,)]?\s*)+|(?:[IVXLCDM]{1,8})[.\u00b7\-:,)]?\s+)/,
    ''
  );
}

function isTitleCase(text) {
  const words = String(text || '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || !/^[A-Z]/u.test(words[0])) return false;
  if (words.length === 1) return true;
  const capped = words.filter((w) => /^[A-Z]/u.test(w)).length;
  return capped / words.length >= 0.5;
}

const HEADING_KEYWORDS =
  /^(?:abstract|introduction|background|related work|overview|motivation|contributions?|methods?|methodology|approach(?:es)?|model(?:s)?|design|experiment(?:s|al setup)?|evaluation|results?|analysis|implementation|conclusion(?:s)?|discussion(?:s)?|summary|future work|limitations?|references?|acknowledg(?:e)?ments?)\b/i;

const METHOD_PATTERNS = [
  { pattern: /\b(methodology|method)\b/i, label: 'method' },
  { pattern: /\bapproach\b/i, label: 'approach' },
  { pattern: /\bmodel\b/i, label: 'model' },
  { pattern: /\b(design|implementation)\b/i, label: 'design' },
  { pattern: /experimental setup/i, label: 'experimental setup' },
  { pattern: /\bsystem\b/i, label: 'system' },
];

const CONCLUSION_PATTERNS = [
  { pattern: /\bconclusion\b/i, label: 'conclusion' },
  { pattern: /\bdiscussion\b/i, label: 'discussion' },
  { pattern: /\bsummary\b/i, label: 'summary' },
  { pattern: /\bfuture work\b/i, label: 'future work' },
];

const CONTAINER_ROLES = new Set([
  'Document',
  'Part',
  'Art',
  'Sect',
  'Div',
  'Section',
  'Aside',
  'NonStruct',
  'Private',
  'TOC',
  'TOCI',
  'Index',
  'Table',
  'THead',
  'TBody',
  'TFoot',
  'TR',
]);

function findSection(sections, patterns) {
  for (const { pattern, label } of patterns) {
    const hit = sections.find((s) => pattern.test(s.heading));
    if (hit) {
      return { label, heading: hit.heading, id: hit.id, text: hit.text };
    }
  }
  return null;
}

function buildRuns(items) {
  const stack = [];
  const runs = [];
  let current = null;
  for (const item of items) {
    if (item.type === 'beginMarkedContentProps') {
      stack.push(item.id != null ? String(item.id) : null);
    } else if (item.type === 'endMarkedContent') {
      stack.pop();
    } else if (typeof item.str === 'string' && item.str) {
      const mcid = stack.length ? stack[stack.length - 1] : null;
      if (current && current.mcid === mcid) {
        current.text += ' ' + item.str;
      } else {
        current = { mcid, text: item.str };
        runs.push(current);
      }
    }
  }
  return runs;
}

function resolveText(ids, runs) {
  const idSet = new Set(ids);
  let text = '';
  for (const run of runs) {
    if (run.mcid != null && idSet.has(run.mcid)) {
      text += ' ' + run.text;
    }
  }
  return cleanText(text);
}

function collectContentIds(node, ids) {
  for (const child of node.children || []) {
    if (child && child.type === 'content') {
      ids.push(String(child.id));
    } else if (child && child.role) {
      collectContentIds(child, ids);
    }
  }
  return ids;
}

function walkTree(node, resolve, out) {
  const role = node.role || '';
  const ids = collectContentIds(node, []);
  const text = ids.length ? resolve(ids) : '';
  const headingMatch = /^H([1-6])$/.exec(role);
  let emitted = null;

  if (role === 'Title' && text) {
    emitted = { type: 'title', text };
  } else if (headingMatch && text) {
    emitted = { type: 'heading', level: parseInt(headingMatch[1], 10), text };
  } else if (role === 'H' && text) {
    emitted = { type: 'heading', level: 2, text };
  } else if (role === 'Figure') {
    emitted = { type: 'figure', alt: node.alt || text, text };
  } else if (role === 'Caption' && text) {
    emitted = { type: 'caption', text };
  } else if (text && !CONTAINER_ROLES.has(role)) {
    emitted = { type: 'text', role, text };
  }

  if (emitted) out.push(emitted);

  if (emitted && emitted.type !== 'figure' && emitted.type !== 'caption') {
    return;
  }
  for (const child of node.children || []) {
    if (child && child.role) walkTree(child, resolve, out);
  }
}

function isBoldItem(item) {
  return /(?:bold|heavy|black|semibold|demi)/i.test(item.fontName || '');
}

export function buildLines(items) {
  const rows = new Map();
  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const key = Math.round(item.transform[5] / 3);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(item);
  }
  const lines = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.transform[4] - b.transform[4]);
    const boldItems = row.filter(isBoldItem).length;
    lines.push({
      y: row[0].transform[5],
      height: Math.max(...row.map((i) => Math.round(i.transform[3]))),
      bold: boldItems / row.length > 0.5,
      text: cleanText(row.map((i) => i.str).join(' ')),
    });
  }
  lines.sort((a, b) => a.y - b.y);
  return lines;
}

function bodyFontSize(lines) {
  const counts = new Map();
  for (const line of lines) {
    const h = Math.round(line.height) || 10;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  let bestCount = 0;
  let bestHeight = 10;
  for (const [h, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestHeight = h;
    }
  }
  return bestHeight;
}

function analyzeBlocks(blocks) {
  const sections = [];
  const figures = [];
  let current = null;
  let title = '';
  let lastFigure = -1;

  for (const block of blocks) {
    if (block.type === 'title') {
      title = cleanText(title + ' ' + block.text);
    } else if (block.type === 'heading') {
      current = { heading: block.text, level: block.level || 2, text: '', id: '' };
      sections.push(current);
    } else if (block.type === 'figure') {
      figures.push({
        index: figures.length + 1,
        caption: '',
        alt: block.alt || '',
        src: '',
      });
      lastFigure = figures.length - 1;
    } else if (block.type === 'caption') {
      if (lastFigure >= 0) {
        figures[lastFigure].caption = cleanText(
          figures[lastFigure].caption + ' ' + block.text
        );
      }
    } else if (block.type === 'text') {
      if (current) current.text = cleanText(current.text + ' ' + block.text);
    }
  }

  return { title, abstract: '', sections, figures };
}

function analyzeTagged(pageData) {
  const blocks = [];
  for (const { textContent, tree } of pageData) {
    if (tree) {
      const runs = buildRuns(textContent.items);
      const resolve = (ids) => resolveText(ids, runs);
      walkTree(tree, resolve, blocks);
    } else {
      for (const line of buildLines(textContent.items)) {
        blocks.push({ type: 'text', role: 'P', text: line.text });
      }
    }
  }
  return analyzeBlocks(blocks);
}

function analyzeHeuristic(pageData) {
  const pagesLines = pageData.map(({ textContent }) => buildLines(textContent.items));
  const allLines = pagesLines.flat();
  const body = bodyFontSize(allLines);

  const titlePage = pagesLines[0] || [];
  const pageHeight = titlePage.reduce((max, line) => Math.max(max, line.y), 0) || 1;
  let title = '';
  if (titlePage.length) {
    const minTitleHeight = body * 1.15;
    let topLine = null;
    let maxLine = null;
    for (const line of titlePage) {
      if (line.height < minTitleHeight) continue;
      if (!maxLine || line.height > maxLine.height) maxLine = line;
      if (
        line.y <= pageHeight * 0.3 &&
        (!topLine || line.height > topLine.height)
      ) {
        topLine = line;
      }
    }
    title = (topLine || maxLine || {}).text || '';
  }

  const sections = [];
  const figures = [];
  let current = null;
  let abstract = '';
  let capturingAbstract = false;
  let stopNewSections = false;

  const threshold = body * 1.12;

  for (const line of allLines) {
    const text = line.text;
    if (!text) continue;
    if (title && text === title) continue;

    if (/^figure\s*\d+[.:-]?\s/i.test(text)) {
      figures.push({ index: figures.length + 1, caption: text, alt: text, src: '' });
      current = null;
      continue;
    }

    const stripped = stripLeadingNumber(text);
    const keywordHeading = stripped && HEADING_KEYWORDS.test(stripped);
    const numberedHeading =
      /^\d+(?:\.\d+)*[.)\s-]/.test(text) &&
      text.length <= 60 &&
      !/[.!?]$/.test(text) &&
      isTitleCase(stripped);
    const isHeading =
      !stopNewSections &&
      (line.height >= threshold || keywordHeading || numberedHeading || line.bold);

    if (isHeading) {
      if (stripped && /^abstract\b/i.test(stripped)) {
        capturingAbstract = true;
        abstract = '';
        current = null;
        continue;
      }
      capturingAbstract = false;
      if (/^(?:references?|bibliography|acknowledg)/i.test(stripped)) {
        stopNewSections = true;
      }
      current = {
        heading: text,
        level: line.height >= body * 1.6 ? 1 : 2,
        text: '',
        id: '',
      };
      sections.push(current);
    } else if (capturingAbstract) {
      abstract = cleanText(abstract + ' ' + text);
    } else if (current) {
      current.text = cleanText(current.text + ' ' + text);
    }
  }

  return { title, abstract, sections, figures };
}

function finalize(analyzed, metadataTitle) {
  let { title, abstract, sections, figures } = analyzed;
  title = cleanText(metadataTitle || title);

  const abstractSection = sections.find((s) =>
    /^abstract\b/i.test(stripLeadingNumber(s.heading))
  );
  if (abstractSection) {
    abstract = abstractSection.text;
  }
  sections = sections.filter(
    (s) => !/^abstract\b/i.test(stripLeadingNumber(s.heading))
  );

  const methods = findSection(sections, METHOD_PATTERNS);
  const conclusion = findSection(sections, CONCLUSION_PATTERNS);

  sections = sections.map((s, i) => ({
    ...s,
    id: s.id || 'pdf-h-' + i,
  }));

  return { title, abstract, sections, figures, methods, conclusion };
}

export async function extractStructure(pdf, url, metadataTitle) {
  const pageData = [];
  let anyTagged = false;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({ includeMarkedContent: true });
    let tree = null;
    try {
      tree = await page.getStructTree();
    } catch (_) {
      tree = null;
    }
    if (tree) anyTagged = true;
    pageData.push({ textContent, tree });
  }

  const analyzed = anyTagged ? analyzeTagged(pageData) : analyzeHeuristic(pageData);
  const result = finalize(analyzed, metadataTitle);

  return {
    detected: true,
    source: 'pdf',
    url,
    paper_id: '',
    detected_at: Date.now(),
    tagged: anyTagged,
    title: result.title,
    abstract: result.abstract,
    sections: result.sections.map((s) => ({
      id: s.id,
      level: s.level,
      heading: s.heading,
      snippet: truncate(s.text, 300),
    })),
    figures: result.figures.map((f) => ({
      index: f.index,
      caption: f.caption,
      alt: f.alt || f.caption,
      src: f.src || '',
    })),
    methods: result.methods,
    conclusion: result.conclusion,
  };
}
