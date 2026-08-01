(() => {
  'use strict';

  const ARXIV_HOSTS = ['arxiv.org', 'ar5iv.org'];

  const SELECTORS = {
    title: [
      'meta[name="citation_title"]',
      'h1.title',
      '.ltx_title_document',
      'article h1',
      'h1',
      'meta[property="og:title"]',
    ],
    abstract: [
      'meta[name="citation_abstract"]',
      'blockquote.abstract',
      '.ltx_abstract .abstract',
      '#abstract',
      '.abstract',
      'section[aria-label*="abstract" i]',
      'meta[property="og:description"]',
    ],
    headings: ['h1', 'h2', 'h3', 'h4'],
    arxivHeadings: ['.ltx_title_section', '.ltx_title_subsection', '.ltx_title_subsubsection'],
    figures: ['figure.ltx_figure', 'figure'],
    captions: ['.ltx_caption', 'figcaption'],
  };

  const METHOD_PATTERNS = [
    { pattern: /\b(methodology|method)\b/i, label: 'method' },
    { pattern: /\bapproach\b/i, label: 'approach' },
    { pattern: /\bmodel\b/i, label: 'model' },
    { pattern: /\b(design|implementation)\b/i, label: 'design' },
    { pattern: /experimental setup/i, label: 'experimental setup' },
    { pattern: /\bsystem\b/i, label: 'system' },
  ];

  const CONCLUSION_PATTERNS = [
    { pattern: /\bconclu\w*\b/i, label: 'conclusion' },
    { pattern: /\bconclud\w*\b/i, label: 'conclusion' },
    { pattern: /\bdiscussion\b/i, label: 'discussion' },
    { pattern: /\bsummary\b/i, label: 'summary' },
    { pattern: /\bfuture work\b/i, label: 'future work' },
  ];

  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function truncate(text, max) {
    const value = cleanText(text);
    if (value.length <= max) return value;
    return value.slice(0, max) + '...';
  }

  function metaContent(selector) {
    const el = document.querySelector(selector);
    return el ? cleanText(el.getAttribute('content')) : '';
  }

  function detectSource() {
    const host = window.location.hostname;
    if (ARXIV_HOSTS.some((h) => host.includes(h))) return 'arxiv';
    if (document.querySelector('.ltx_document, .ltx_page_body')) return 'arxiv';
    return 'generic';
  }

  function getContentRoot() {
    return (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function detectTitle(source) {
    for (const selector of SELECTORS.title) {
      if (selector.startsWith('meta[')) {
        const value = metaContent(selector);
        if (value) return value;
      } else {
        const el = document.querySelector(selector);
        const value = el && cleanText(el.textContent);
        if (value) return value;
      }
    }
    return cleanText(document.title);
  }

  function detectAbstract(source) {
    for (const selector of SELECTORS.abstract) {
      let value = '';
      if (selector.startsWith('meta[')) {
        value = metaContent(selector);
      } else {
        const el = document.querySelector(selector);
        value = el && cleanText(el.textContent);
      }
      if (value) return value.replace(/^abstract:?\s*/i, '');
    }
    return '';
  }

  function collectSections(source) {
    const root = getContentRoot();
    const selectors =
      source === 'arxiv' ? SELECTORS.arxivHeadings : SELECTORS.headings;

    const elements = Array.from(root.querySelectorAll(selectors.join(',')));
    const title = detectTitle(source).toLowerCase();

    const sections = [];
    for (const el of elements) {
      if (el.closest('figure, figcaption, .ltx_caption, table, nav, script, style')) continue;

      const heading = cleanText(el.textContent);
      if (!heading) continue;
      if (title && heading.toLowerCase() === title) continue;

      const container = el.closest('section') || el.parentElement;
      let text = cleanText(container.textContent);
      if (heading && text.startsWith(heading)) {
        text = text.slice(heading.length).trim();
      }

      sections.push({
        id: el.id || (el.closest('section') ? el.closest('section').id : ''),
        level: source === 'arxiv' ? arxivHeadingLevel(el) : parseInt(el.tagName.slice(1), 10),
        heading,
        text,
        snippet: truncate(text, 300),
      });
    }
    return sections;
  }

  function arxivHeadingLevel(el) {
    if (el.classList.contains('ltx_title_subsubsection')) return 4;
    if (el.classList.contains('ltx_title_subsection')) return 3;
    return 2;
  }

  function detectFigures(source) {
    const root = getContentRoot();
    const figures = [];
    const captionSelector = SELECTORS.captions.join(',');

    const figureEls = Array.from(root.querySelectorAll(SELECTORS.figures.join(',')));
    for (const fig of figureEls) {
      if (fig.closest('figure') !== fig) continue;

      const captionEl = fig.querySelector(captionSelector);
      const img = fig.querySelector('img');
      figures.push({
        index: figures.length + 1,
        caption: captionEl ? cleanText(captionEl.textContent) : '',
        alt: img ? cleanText(img.alt) : '',
        src: img ? img.currentSrc || img.src : '',
      });
    }

    if (figures.length === 0) {
      const imgs = Array.from(root.querySelectorAll('img[alt]')).filter(
        (img) => cleanText(img.alt) && !img.closest('figure')
      );
      for (const img of imgs.slice(0, 50)) {
        figures.push({
          index: figures.length + 1,
          caption: '',
          alt: cleanText(img.alt),
          src: img.currentSrc || img.src,
        });
      }
    }

    return figures.slice(0, 50);
  }

  function findSection(sections, patterns) {
    for (const { pattern, label } of patterns) {
      const hit = sections.find((s) => pattern.test(s.heading));
      if (hit) {
        return { label, heading: hit.heading, id: hit.id, text: hit.text };
      }
    }
    return null;
  }

  function detect() {
    const source = detectSource();
    const sections = collectSections(source);
    const url = window.location.href;

    return {
      detected: true,
      source,
      url,
      paper_id: window.PaperStorage
        ? window.PaperStorage.paperIdForUrl(url)
        : url,
      detected_at: Date.now(),
      title: detectTitle(source),
      abstract: detectAbstract(source),
      sections: sections.map((s) => ({
        id: s.id,
        level: s.level,
        heading: s.heading,
        snippet: s.snippet,
      })),
      figures: detectFigures(source),
      methods: findSection(sections, METHOD_PATTERNS),
      conclusion: findSection(sections, CONCLUSION_PATTERNS),
    };
  }

  const BLOCKLIST_PATTERNS = [
    /^\s*\d+\s*$/, // bare page numbers
    /^arxiv:/i,
    /^\S+@\S+$/, // email
    /^(doi|http|https):/i,
    /^(submitted|received|accepted|published|available|last updated|version)\b/i,
    /^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\b/i,
  ];

  const KEYWORD_HEADINGS = [
    /^(abstract|introduction|background|related work|methods?|methodology|approach|proposed (method|approach|model)|experiments?|experimental setup|evaluation|results?|discussion|conclusion|conclusions?|future work|references|acknowledgements?)\b[:.]?\s*$/i,
  ];

  function isJunkLine(line) {
    return BLOCKLIST_PATTERNS.some((p) => p.test(line));
  }

  function isLikelyHeading(line, title) {
    const len = line.length;
    if (len < 3 || len > 150) return false;
    if (title && line === title) return false;
    if (/^\s*(figure|fig\.?)\s*\d+/i.test(line)) return false;
    if (isJunkLine(line)) return false;

    const alpha = (line.replace(/[^A-Za-z]/g, '') || '').length;
    if (alpha < 3) return false;

    if (/^\s*\d+(\.\d+)*[\.\)\-–]?\s+[A-Z]/.test(line)) {
      if (!line.endsWith('.') || !/[a-z]/.test(line.slice(1))) return true;
    }
    if (/^\s*[IVXLCDM]+\.?\s+[A-Z]/.test(line)) return true;
    if (/^[A-Z][A-Z0-9\s&\-/:]+$/.test(line)) return true;
    if (KEYWORD_HEADINGS.some((p) => p.test(line))) return true;
    return false;
  }

  function headingLevel(line) {
    if (/^\s*[IVXLCDM]+\.?\s+[A-Z]/.test(line)) return 3;
    return 2;
  }

  function cleanHeading(line) {
    let heading = line.replace(/^\s*\d+(\.\d+)*[\.\)\-–]?\s*/, '');
    heading = heading.replace(/^\s*[IVXLCDM]+\.?\s+/, '');
    heading = heading.replace(/^\s*:\s*/, '');
    return heading.trim();
  }

  function textLines(pages) {
    const lines = [];
    for (const page of pages || []) {
      for (const raw of String(page.text || '').split('\n')) {
        const line = raw.trim();
        if (line) lines.push(line);
      }
    }
    return lines;
  }

  function isAuthorLike(line) {
    if (line.length < 3 || line.length > 20) return false;
    return /^[A-Z][A-Za-z'\-]*(?:\s+[A-Z][A-Za-z'\-]*){1,3}\s*[\d*,†‡§]?$/.test(line);
  }

  function findTitle(lines) {
    const parts = [];
    for (const line of lines.slice(0, 40)) {
      if (!line || line.length < 2) break;
      if (isJunkLine(line)) continue;
      if (isLikelyHeading(line)) break;
      if (line.length > 180) break;
      if (/@|e-?mail|university|department|institute|college|techniker|corresponding|contributing/i.test(line)) break;
      if (isAuthorLike(line)) break;
      parts.push(line);
      if (parts.join(' ').length > 140) break;
      if (parts.length >= 6) break;
    }
    return parts.join(' ');
  }

  function findAbstract(lines, title) {
    const idx = lines.findIndex(
      (l) => /^\s*abstract\b[:.]?\s*$/i.test(l) || /^\s*abstract\./i.test(l)
    );
    if (idx !== -1) {
      let text = '';
      for (const line of lines.slice(idx + 1)) {
        if (text && isLikelyHeading(line)) break;
        if (line.length > 220) continue;
        text += ' ' + line;
      }
      if (cleanText(text).length > 20) return cleanText(text).slice(0, 3000);
    }

    const start = title ? lines.indexOf(title) : 0;
    let text = '';
    let started = false;
    for (const line of lines.slice(start + 1)) {
      if (started && isLikelyHeading(line)) break;
      if (/^keywords?\b/i.test(line)) continue;
      if (isJunkLine(line)) continue;
      if (started) {
        text += ' ' + line;
      } else if (line.length >= 60) {
        started = true;
        text = line;
      }
    }
    return cleanText(text).length >= 80 ? cleanText(text).slice(0, 3000) : '';
  }

  function collectSectionsFromLines(lines, title) {
    const sections = [];
    let current = null;

    for (const line of lines) {
      if (isLikelyHeading(line, title)) {
        const cleaned = cleanHeading(line);
        if (/^(abstract|summary)\b/i.test(cleaned)) continue;
        if (!cleaned || /^[^A-Za-z0-9]+$/.test(cleaned)) continue;

        if (current && current.text.trim()) {
          sections.push(current);
          current = null;
        }
        if (current) {
          current.heading += ' ' + cleaned;
        } else {
          current = {
            id: '',
            level: headingLevel(line),
            heading: cleaned,
            text: '',
          };
        }
      } else if (current) {
        current.text = (current.text + ' ' + line).trim();
      }
    }

    if (current && current.text.trim()) sections.push(current);
    return sections;
  }

  function collectFiguresFromText(lines) {
    const figures = [];
    for (const line of lines) {
      const match = line.match(/^\s*(?:figure|fig\.?)\s*(\d+)[:.\-–—]?\s+(.+)$/i);
      if (match) {
        figures.push({
          index: parseInt(match[1], 10),
          caption: cleanText(match[2]),
          alt: '',
          src: '',
        });
      }
    }
    return figures.slice(0, 50);
  }

  function fromText(pages, opts) {
    const url = (opts && opts.url) || window.location.href;
    const lines = textLines(pages);
    const title = findTitle(lines);
    const sections = collectSectionsFromLines(lines, title);

    return {
      detected: true,
      source: 'pdf',
      url,
      paper_id: window.PaperStorage
        ? window.PaperStorage.paperIdForUrl(url)
        : 'pdf_' + url,
      detected_at: Date.now(),
      title,
      abstract: findAbstract(lines),
      sections: sections.map((s) => ({
        id: s.id,
        level: s.level,
        heading: s.heading,
        snippet: truncate(s.text, 300),
      })),
      figures: collectFiguresFromText(lines),
      methods: findSection(sections, METHOD_PATTERNS),
      conclusion: findSection(sections, CONCLUSION_PATTERNS),
    };
  }

  function isPaperPage() {
    if (detectSource() === 'arxiv') return true;

    const hasCitationMeta = Boolean(
      document.querySelector('meta[name="citation_title"], meta[name="citation_abstract"]')
    );
    const h1 = cleanText(
      (document.querySelector('article h1, h1') || {}).textContent || ''
    );
    const hasAbstract = Boolean(
      document.querySelector('#abstract, .abstract, blockquote.abstract')
    );
    const headingCount = document.querySelectorAll('article h2, article h3').length;

    return hasCitationMeta || (h1 && hasAbstract) || headingCount >= 3;
  }

  function logToConsole(result) {
    const labelStyle = 'color:#1e3a5f;font-weight:bold;';
    const banner = [
      '%c Research Reading Assistant - Paper structure detected ',
      'background:#1e3a5f;color:#ffffff;font-weight:bold;font-size:12px;padding:4px 6px;border-radius:3px;',
    ];

    console.log(...banner);
    console.groupCollapsed(
      'Paper: ' + (result.title ? truncate(result.title, 80) : '(untitled)')
    );
    console.log(
      '%cTitle%c ' + (result.title || '(not found)'),
      labelStyle,
      'color:inherit;font-weight:normal;'
    );
    console.log('%cAbstract', labelStyle, result.abstract || '(not found)');
    console.log('%cSections (' + result.sections.length + ')', labelStyle, result.sections);
    console.log('%cFigures (' + result.figures.length + ')', labelStyle, result.figures);
    console.log('%cMethods', labelStyle, result.methods);
    console.log('%cConclusion', labelStyle, result.conclusion);
    console.log('%cURL', labelStyle, result.url);
    console.groupEnd();
  }

  window.PaperDetector = {
    detect,
    fromText,
    isPaperPage,
    logToConsole,
    detectSource,
  };
})();
