(() => {
  'use strict';

  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('run-detect');
  const readBtn = document.getElementById('read');
  const structureList = document.getElementById('structure-list');
  const structureEmpty = document.getElementById('structure-empty');
  const questionModal = document.getElementById('question-modal');
  const questionInput = document.getElementById('question-input');
  const questionList = document.getElementById('question-list');
  const questionMore = document.getElementById('question-more');
  const questionDone = document.getElementById('question-done');

  let currentPaper = null;
  let readMode = false;

  function truncate(text, max) {
    const value = String(text || '');
    return value.length <= max ? value : value.slice(0, max) + '...';
  }

  function buildChecklistItems(paper) {
    const items = [];

    if (paper.abstract) {
      items.push({ key: 'abstract', label: 'Abstract', text: paper.abstract });
    }

    (paper.sections || []).forEach((section, i) => {
      items.push({
        key: 'section_' + i,
        label: section.heading || 'Section ' + (i + 1),
        text: section.snippet || '',
        meta: section.id ? '#' + section.id : '',
      });
    });

    (paper.figures || []).forEach((figure, i) => {
      items.push({
        key: 'figure_' + i,
        label: 'Figure ' + figure.index,
        text: figure.caption || figure.alt || '',
        meta: figure.src || '',
      });
    });

    if (paper.methods) {
      items.push({
        key: 'methods',
        label: 'Methods' + (paper.methods.heading ? ' - ' + paper.methods.heading : ''),
        text: paper.methods.text || '',
      });
    }

    if (paper.conclusion) {
      items.push({
        key: 'conclusion',
        label: 'Conclusion' + (paper.conclusion.heading ? ' - ' + paper.conclusion.heading : ''),
        text: paper.conclusion.text || '',
      });
    }

    return items;
  }

  function renderStructure(paper) {
    currentPaper = paper;
    readMode = false;
    readBtn.textContent = 'READ';

    const items = buildChecklistItems(paper);
    const progress = paper.progress || {};
    structureList.innerHTML = '';
    structureList.hidden = items.length === 0;
    structureEmpty.hidden = items.length > 0;
    readBtn.disabled = items.length === 0;

    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'structure-item';

      const label = document.createElement('label');
      label.className = 'structure-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'structure-check';
      checkbox.checked = !!progress[item.key];
      checkbox.addEventListener('change', async (e) => {
        await window.PaperStorage.setProgress(paper.paper_id, item.key, e.target.checked);
        li.classList.toggle('tracked', e.target.checked);
        if (readMode) applyReadFilter();
      });

      const body = document.createElement('span');
      body.className = 'structure-body';

      const heading = document.createElement('span');
      heading.className = 'structure-heading';
      heading.textContent = item.label;

      body.appendChild(heading);
      label.appendChild(checkbox);
      label.appendChild(body);
      li.appendChild(label);
      structureList.appendChild(li);
    }
  }

  function applyReadFilter() {
    for (const li of structureList.querySelectorAll('.structure-item')) {
      const checked = li.querySelector('.structure-check').checked;
      li.hidden = readMode && !checked;
    }
  }

  function renderQuestionList() {
    const questions = (currentPaper && currentPaper.review_questions) || [];
    questionList.innerHTML = '';
    questionList.hidden = questions.length === 0;
    for (const question of questions) {
      const li = document.createElement('li');
      li.className = 'question-item';
      li.textContent = question;
      questionList.appendChild(li);
    }
  }

  function openQuestionModal() {
    questionInput.value = '';
    renderQuestionList();
    questionModal.hidden = false;
    questionInput.focus();
  }

  function closeQuestionModal() {
    questionModal.hidden = true;
  }

  async function saveCurrentQuestion() {
    if (!currentPaper) return false;
    const value = questionInput.value.trim();
    if (!value) return false;
    await window.PaperStorage.addReviewQuestion(currentPaper.paper_id, value);
    currentPaper.review_questions = currentPaper.review_questions || [];
    if (!currentPaper.review_questions.includes(value)) {
      currentPaper.review_questions.push(value);
    }
    return true;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendMessage(tabId, message) {
    return await chrome.tabs.sendMessage(tabId, message);
  }

  async function pingTab(tab, attempt = 0) {
    try {
      const res = await sendMessage(tab.id, { type: 'PING' });
      return res && res.ready ? res : null;
    } catch (err) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return pingTab(tab, attempt + 1);
      }
      return null;
    }
  }

  function setStatus(text, ok) {
    statusEl.textContent = text;
    statusEl.style.color = ok === true ? '#7dd3a0' : ok === false ? '#ffb3a7' : '';
  }

  function showEmptyState() {
    currentPaper = null;
    readMode = false;
    readBtn.textContent = 'READ';
    readBtn.disabled = true;
    structureList.innerHTML = '';
    structureList.hidden = true;
    structureEmpty.hidden = false;
  }

  async function loadFromCache(tab) {
    const paperId = window.PaperStorage.paperIdForUrl(tab.url);
    const cached = await window.PaperStorage.getPaper(paperId);
    if (cached) {
      renderStructure(cached);
      setStatus(
        'Loaded from cache (detected ' + new Date(cached.detected_at).toLocaleString() + ').'
      );
      return true;
    }
    return false;
  }

  async function init() {
    const tab = await getActiveTab();

    if (!tab || !/^https?:/i.test(tab.url || '')) {
      setStatus('Not supported. Open a paper page (HTTP/HTTPS) and retry.', false);
      runBtn.disabled = true;
      showEmptyState();
      return;
    }

    const cachedLoaded = await loadFromCache(tab);

    const ping = await pingTab(tab);
    if (!ping) {
      if (!cachedLoaded) {
        setStatus('Content script not available. Reload the page and retry.', false);
      }
      runBtn.disabled = false;
      return;
    }

    if (!ping.isPaper && !cachedLoaded) {
      setStatus('No research paper detected on this page. Detection may still run.', true);
    } else if (!cachedLoaded) {
      setStatus('Research paper detected on this page. Run detect to build the checklist.');
    }
    runBtn.disabled = false;
  }

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'DETECTING...';
    setStatus('Detecting paper structure...');

    try {
      const tab = await getActiveTab();
      const res = await sendMessage(tab.id, { type: 'DETECT_PAPER' });
      if (res && res.ok) {
        console.log('[Research Reading Assistant] Detection result:', res.data);
        const saved = await window.PaperStorage.savePaper(res.data);
        renderStructure(saved);
        setStatus('Detection complete. Cached for review. See page console (F12) for full output.');
      } else {
        setStatus('Detection returned no data.', false);
      }
    } catch (err) {
      setStatus('Detection failed: ' + (err.message || 'unexpected error'), false);
    } finally {
      runBtn.textContent = 'RUN DETECT';
      runBtn.disabled = false;
    }
  });

  readBtn.addEventListener('click', () => {
    const items = Array.from(structureList.querySelectorAll('.structure-item'));
    const tracked = items.filter(
      (li) => li.querySelector('.structure-check').checked
    );

    if (!readMode && tracked.length === 0) {
      setStatus('Track at least one item to start reading.', false);
      return;
    }

    readMode = !readMode;
    applyReadFilter();

    if (readMode) {
      readBtn.textContent = 'EXIT READ';
      openQuestionModal();
    } else {
      readBtn.textContent = 'READ';
      setStatus('Read mode off. All items shown.');
    }
  });

  questionMore.addEventListener('click', async () => {
    const saved = await saveCurrentQuestion();
    if (saved) {
      questionInput.value = '';
      renderQuestionList();
      questionInput.focus();
    }
  });

  questionDone.addEventListener('click', async () => {
    const saved = await saveCurrentQuestion();
    closeQuestionModal();
    setStatus(
      saved
        ? 'Questions saved. Review the tracked items and reflect.'
        : 'No question recorded. Reading the tracked items.'
    );
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
