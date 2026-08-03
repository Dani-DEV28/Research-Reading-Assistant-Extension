(() => {
  'use strict';

  const STYLE_ID = 'rra-focus-style';
  const PANEL_ID = 'rguide-panel';
  const STATE_ATTR = 'data-rra-state';
  let readerState = null;

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function ensureFocusStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.rra-focus-active [${STATE_ATTR}="locked"] {
        opacity: 0.42 !important;
        filter: blur(3px) !important;
        transition: opacity 0.16s ease, filter 0.16s ease !important;
      }

      body.rra-focus-active [${STATE_ATTR}="current"] {
        position: relative !important;
        z-index: 2147483645 !important;
        filter: none !important;
        opacity: 1 !important;
        outline: 3px solid #2f5e4e !important;
        outline-offset: 4px !important;
        background: rgba(255, 255, 255, 0.96) !important;
        box-shadow: 0 8px 28px rgba(20, 33, 45, 0.22) !important;
      }

      body.rra-focus-active [${STATE_ATTR}="complete"] {
        filter: none !important;
        opacity: 1 !important;
      }

      #${PANEL_ID} {
        position: fixed !important;
        top: 76px !important;
        right: 16px !important;
        z-index: 2147483647 !important;
        width: 250px !important;
        max-height: 340px !important;
        overflow: hidden !important;
        color: #18202a !important;
        background: #ffffff !important;
        border: 1px solid #b9dacd !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 26px rgba(20, 33, 45, 0.22) !important;
        font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }

      body.rguide-panel-active {
        padding-right: 286px !important;
      }

      #${PANEL_ID} * {
        box-sizing: border-box !important;
        font-family: inherit !important;
      }

      #${PANEL_ID} button,
      #${PANEL_ID} textarea {
        font: inherit !important;
      }

      .rguide-head {
        background: #213547 !important;
        color: #ffffff !important;
        padding: 10px !important;
        border-radius: 10px 10px 0 0 !important;
      }

      .rguide-title-row {
        display: flex !important;
        justify-content: space-between !important;
        gap: 8px !important;
        align-items: flex-start !important;
      }

      .rguide-name {
        margin: 0 0 4px !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        color: #ffffff !important;
      }

      .rguide-goal {
        margin: 3px 0 0 !important;
        font-size: 12px !important;
        line-height: 1.35 !important;
        color: #ffffff !important;
      }

      .rguide-goal-label {
        margin: 0 !important;
        color: #8fd8c1 !important;
        font-size: 10px !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
      }

      .rguide-close {
        flex: 0 0 auto !important;
        color: #ffffff !important;
        background: transparent !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        border-radius: 5px !important;
        padding: 2px 6px !important;
        cursor: pointer !important;
      }

      .rguide-body {
        padding: 10px !important;
        max-height: 238px !important;
        overflow: auto !important;
      }

      .rguide-progress-label {
        display: flex !important;
        justify-content: space-between !important;
        color: #586777 !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        margin-bottom: 5px !important;
      }

      .rguide-progress {
        height: 7px !important;
        background: #e8edf2 !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        margin-bottom: 10px !important;
      }

      .rguide-progress-fill {
        height: 100% !important;
        width: 0%;
        background: #2f5e4e !important;
        transition: width 0.18s ease !important;
      }

      .rguide-section {
        margin: 0 0 4px !important;
        color: #586777 !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
      }

      .rguide-question {
        margin: 0 0 8px !important;
        color: #18202a !important;
        font-size: 13px !important;
        line-height: 1.35 !important;
        font-weight: 700 !important;
      }

      .rguide-answer,
      .rguide-overall {
        width: 100% !important;
        min-height: 76px !important;
        color: #18202a !important;
        background: #ffffff !important;
        border: 1px solid #cbd5df !important;
        border-radius: 7px !important;
        padding: 8px !important;
        resize: vertical !important;
        line-height: 1.35 !important;
      }

      .rguide-actions {
        display: flex !important;
        gap: 7px !important;
        margin-top: 8px !important;
      }

      .rguide-primary,
      .rguide-secondary {
        border-radius: 6px !important;
        padding: 7px 9px !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        cursor: pointer !important;
      }

      .rguide-primary {
        flex: 1 !important;
        color: #ffffff !important;
        background: #2f5e4e !important;
        border: 1px solid #2f5e4e !important;
      }

      .rguide-secondary {
        color: #2f5e4e !important;
        background: #ffffff !important;
        border: 1px solid #8db2a4 !important;
      }

      .rguide-download {
        width: 100% !important;
        margin-top: 8px !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function clearFocusMode() {
    document.body.classList.remove('rra-focus-active');
    for (const el of document.querySelectorAll('[' + STATE_ATTR + ']')) {
      el.removeAttribute(STATE_ATTR);
    }
  }

  function candidateElements() {
    const candidates = [];

    const title = document.querySelector('h1.title, .ltx_title_document, article h1, h1');
    if (title) candidates.push({ labels: ['title'], targets: ['title'], el: title });

    const abstract = document.querySelector(
      'blockquote.abstract, .ltx_abstract, .ltx_abstract .abstract, #abstract, .abstract, section[id*="abstract" i], section[class*="abstract" i], section[aria-label*="abstract" i]'
    );
    if (abstract) {
      candidates.push({ labels: ['abstract'], targets: ['abstract'], el: abstractContainer(abstract) });
    }
    if (!abstract && title) {
      const fallbackAbstract = findAbstractFallback(title);
      if (fallbackAbstract) {
        candidates.push({ labels: ['abstract'], targets: ['abstract'], el: fallbackAbstract });
      }
    }

    Array.from(document.querySelectorAll('figure.ltx_figure, figure')).forEach((figure, i) => {
      candidates.push({
        labels: ['figure ' + (i + 1)],
        targets: ['figure_' + i],
        el: figure,
      });
    });

    const titleText = title ? cleanText(title.textContent).toLowerCase() : '';
    const headings = Array.from(
      document.querySelectorAll('h1, h2, h3, h4, .ltx_title_section, .ltx_title_subsection')
    );
    let sectionIndex = 0;
    for (const heading of headings) {
      if (heading.closest('figure, figcaption, table, nav, script, style')) continue;
      const label = cleanText(heading.textContent).toLowerCase();
      if (!label) continue;
      if (titleText && label === titleText) continue;
      const section = heading.closest('section') || heading.parentElement || heading;
      const labels = [label];
      const targets = ['section:' + sectionIndex];
      sectionIndex += 1;
      if (heading.id) targets.push('id:' + heading.id);
      if (section.id) targets.push('id:' + section.id);
      if (/method|approach|model|system|design/.test(label)) labels.push('methods');
      if (/conclusion|discussion|summary|future work/.test(label)) labels.push('conclusion');
      if (/method|approach|model|system|design/.test(label)) targets.push('methods');
      if (/conclusion|discussion|summary|future work/.test(label)) targets.push('conclusion');
      candidates.push({ labels, targets, el: section });
    }

    return candidates;
  }

  function findAbstractFallback(title) {
    const explicit = Array.from(document.querySelectorAll('p, div, section')).find((el) => {
      const text = cleanText(el.textContent);
      return /^abstract\.?\s+/i.test(text) && text.length > 80;
    });
    if (explicit) return explicit;

    let current = title;
    for (let i = 0; i < 12 && current; i++) {
      current = current.nextElementSibling;
      if (!current) break;
      const text = cleanText(current.textContent);
      if (text.length > 120 && !current.matches('nav, header, footer')) return current;
      const nested = current.querySelector && Array.from(current.querySelectorAll('p')).find(
        (p) => cleanText(p.textContent).length > 120
      );
      if (nested) return nested;
    }

    return null;
  }

  function abstractContainer(el) {
    const headingLike = /^abstract\.?$/i.test(cleanText(el.textContent));
    const closestSection = el.closest(
      'section, article, .abstractSection, .abstractInFull, .NLM_abstract, .article__abstract, .issue-item__abstract'
    );

    if (closestSection && cleanText(closestSection.textContent).length > 80) {
      return closestSection;
    }

    if (headingLike) {
      let current = el;
      for (let i = 0; i < 4 && current; i++) {
        current = current.parentElement;
        if (current && cleanText(current.textContent).length > 80) return current;
      }
    }

    const parent = el.parentElement;
    if (parent && cleanText(parent.textContent).length > cleanText(el.textContent).length + 40) {
      return parent;
    }

    return el;
  }

  function findCandidateForItem(item, candidates) {
    const label = cleanText(item.label).toLowerCase();
    const target = cleanText(item.target).toLowerCase();

    if (target) {
      const targetHit = candidates.find((candidate) =>
        (candidate.targets || []).some((candidateTarget) => candidateTarget.toLowerCase() === target)
      );
      if (targetHit) return targetHit;
    }

    if (item.id) {
      const idHit = candidates.find((candidate) =>
        (candidate.targets || []).some((candidateTarget) => candidateTarget.toLowerCase() === 'id:' + item.id.toLowerCase())
      );
      if (idHit) return idHit;
    }

    if (!label) return null;

    return candidates.find((candidate) =>
      candidate.labels.some((candidateLabel) => {
        if (candidateLabel === label) return true;
        if (label === 'methods' && candidateLabel === 'methods') return true;
        if (label === 'conclusion' && candidateLabel === 'conclusion') return true;
        return candidateLabel.includes(label) || label.includes(candidateLabel);
      })
    );
  }

  function applyFocusMode(planItems, currentIndex) {
    clearFocusMode();
    ensureFocusStyle();

    const candidates = candidateElements();
    const matchedPlan = (planItems || []).map((item) => findCandidateForItem(item, candidates));
    const visible = new Set(
      matchedPlan
        .slice(0, currentIndex + 1)
        .filter(Boolean)
        .map((candidate) => candidate.el)
    );

    for (const candidate of candidates) {
      const containsVisible = Array.from(visible).some(
        (visibleEl) => candidate.el !== visibleEl && candidate.el.contains(visibleEl)
      );
      if (!visible.has(candidate.el) && !containsVisible) {
        candidate.el.setAttribute(STATE_ATTR, 'locked');
      }
    }

    matchedPlan.forEach((candidate, index) => {
      if (!candidate) return;
      clearFocusStateInside(candidate.el);
      if (index < currentIndex) {
        candidate.el.setAttribute(STATE_ATTR, 'complete');
      } else if (index === currentIndex) {
        candidate.el.setAttribute(STATE_ATTR, 'current');
        candidate.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    document.body.classList.add('rra-focus-active');
  }

  function clearFocusStateInside(el) {
    for (const child of el.querySelectorAll('[' + STATE_ATTR + ']')) {
      child.removeAttribute(STATE_ATTR);
    }
  }

  function revealCurrentItem(planItems, currentIndex) {
    clearFocusMode();
    ensureFocusStyle();

    const current = (planItems || [])[currentIndex];
    if (!current) return;

    const candidate = findCandidateForItem(current, candidateElements());
    if (!candidate) return;

    candidate.el.setAttribute(STATE_ATTR, 'current');
    candidate.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function updateReaderFocus() {
    if (!readerState) return;

    const items = readerState.plan.items || [];
    if (readerState.index >= items.length) {
      clearFocusMode();
      return;
    }

    if (readerState.plan.focus_mode) {
      applyFocusMode(items, readerState.index);
    } else {
      revealCurrentItem(items, readerState.index);
    }
  }

  function startReaderPanel(paper, plan, answers) {
    ensureFocusStyle();
    document.body.classList.add('rguide-panel-active');
    readerState = {
      paper: paper || {},
      plan: plan || { goal: '', items: [] },
      answers: { ...(answers || {}) },
      overall: '',
      index: 0,
    };
    renderReaderPanel();
    updateReaderFocus();
  }

  function renderReaderPanel() {
    if (!readerState) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }

    const items = readerState.plan.items || [];
    const total = items.length;
    const current = items[readerState.index];
    const displayedStep = total ? Math.min(readerState.index + 1, total) : 0;
    const percent = total ? Math.round((displayedStep / total) * 100) : 0;

    panel.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'rguide-head';

    const titleRow = document.createElement('div');
    titleRow.className = 'rguide-title-row';

    const titleBox = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'rguide-name';
    name.textContent = 'RGuide';
    const goalLabel = document.createElement('p');
    goalLabel.className = 'rguide-goal-label';
    goalLabel.textContent = 'Reading goal';
    const goal = document.createElement('p');
    goal.className = 'rguide-goal';
    goal.textContent = readerState.plan.goal || 'Guided reading session';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rguide-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => {
      clearFocusMode();
      document.body.classList.remove('rguide-panel-active');
      panel.remove();
      readerState = null;
    });

    titleBox.appendChild(name);
    titleBox.appendChild(goalLabel);
    titleBox.appendChild(goal);
    titleRow.appendChild(titleBox);
    titleRow.appendChild(close);
    head.appendChild(titleRow);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'rguide-body';

    const progressLabel = document.createElement('div');
    progressLabel.className = 'rguide-progress-label';
    progressLabel.innerHTML = '<span>' + displayedStep + ' / ' + total + '</span><span>' + percent + '%</span>';

    const progress = document.createElement('div');
    progress.className = 'rguide-progress';
    const fill = document.createElement('div');
    fill.className = 'rguide-progress-fill';
    fill.style.setProperty('width', percent + '%', 'important');
    progress.appendChild(fill);

    body.appendChild(progressLabel);
    body.appendChild(progress);

    if (!current) {
      renderFinishPanel(body);
      panel.appendChild(body);
      return;
    }

    const section = document.createElement('p');
    section.className = 'rguide-section';
    section.textContent = current.label;

    const question = document.createElement('p');
    question.className = 'rguide-question';
    question.textContent = current.question || 'What should you remember from this section?';

    const answer = document.createElement('textarea');
    answer.className = 'rguide-answer';
    answer.placeholder = 'Notes for this section...';
    answer.value = readerState.answers[current.key] || '';
    answer.addEventListener('input', () => {
      readerState.answers[current.key] = answer.value;
    });

    const actions = document.createElement('div');
    actions.className = 'rguide-actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'rguide-secondary';
    back.textContent = 'Back';
    back.disabled = readerState.index === 0;
    back.addEventListener('click', () => {
      readerState.answers[current.key] = answer.value;
      readerState.index = Math.max(0, readerState.index - 1);
      renderReaderPanel();
      updateReaderFocus();
    });

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'rguide-primary';
    next.textContent = readerState.index === total - 1 ? 'Finish' : 'Save + next';
    next.addEventListener('click', async () => {
      readerState.answers[current.key] = answer.value;
      await saveReaderProgress(current);
      readerState.index += 1;
      renderReaderPanel();
      updateReaderFocus();
    });

    actions.appendChild(back);
    actions.appendChild(next);
    body.appendChild(section);
    body.appendChild(question);
    body.appendChild(answer);
    body.appendChild(actions);
    panel.appendChild(body);
  }

  function renderFinishPanel(body) {
    clearFocusMode();

    const done = document.createElement('p');
    done.className = 'rguide-question';
    done.textContent = 'Reading complete. Add overall notes before downloading.';

    const overall = document.createElement('textarea');
    overall.className = 'rguide-overall';
    overall.placeholder = 'Overall notes, takeaways, questions, or connection to your work...';
    overall.value = readerState.overall || '';
    overall.addEventListener('input', () => {
      readerState.overall = overall.value;
    });

    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'rguide-primary rguide-download';
    download.textContent = 'Download notes';
    download.addEventListener('click', () => {
      readerState.overall = overall.value;
      downloadNotes();
    });

    body.appendChild(done);
    body.appendChild(overall);
    body.appendChild(download);
  }

  async function saveReaderProgress(current) {
    if (!readerState || !window.PaperStorage || !readerState.paper.paper_id) return;
    await window.PaperStorage.saveAnswers(readerState.paper.paper_id, readerState.answers);
    await window.PaperStorage.setProgress(readerState.paper.paper_id, current.key, true);
  }

  function downloadNotes() {
    const paper = readerState.paper || {};
    const plan = readerState.plan || {};
    const lines = [
      '# RGuide Reading Notes',
      '',
      'Paper: ' + (paper.title || 'Untitled paper'),
      'URL: ' + (paper.url || window.location.href),
      'Reading goal: ' + (plan.goal || ''),
      '',
      '## Section Notes',
      '',
    ];

    for (const item of plan.items || []) {
      lines.push('### ' + item.label);
      lines.push(readerState.answers[item.key] || '');
      lines.push('');
    }

    lines.push('## Overall Notes');
    lines.push(readerState.overall || '');
    lines.push('');

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename((paper.title || 'rguide-notes') + '.md');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function safeFilename(filename) {
    return filename.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        sendResponse({
          ready: true,
          isPaper: window.PaperDetector && window.PaperDetector.isPaperPage(),
          supportsReaderPanel: true,
        });
        break;

      case 'DETECT_PAPER':
        const result = window.PaperDetector.detect();
        window.PaperDetector.logToConsole(result);
        sendResponse({ ok: true, data: result });
        break;

      case 'APPLY_FOCUS_MODE':
        applyFocusMode(message.items || [], message.currentIndex || 0);
        sendResponse({ ok: true });
        break;

      case 'START_READER_PANEL':
        startReaderPanel(message.paper, message.plan, message.answers);
        sendResponse({ ok: true });
        break;

      case 'CLEAR_FOCUS_MODE':
        clearFocusMode();
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.remove();
        document.body.classList.remove('rguide-panel-active');
        readerState = null;
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
    return false;
  });
})();
