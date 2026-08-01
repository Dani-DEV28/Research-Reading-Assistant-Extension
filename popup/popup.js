(() => {
  'use strict';

  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('run-detect');
  const readBtn = document.getElementById('read');
  const structureList = document.getElementById('structure-list');
  const structureEmpty = document.getElementById('structure-empty');
  const questionsList = document.getElementById('questions-list');
  const questionsEmpty = document.getElementById('questions-empty');
  const addQuestionBtn = document.getElementById('add-question');
  const questionModal = document.getElementById('question-modal');
  const questionInput = document.getElementById('question-input');
  const questionList = document.getElementById('question-list');
  const questionMore = document.getElementById('question-more');
  const questionDone = document.getElementById('question-done');
  const answerModal = document.getElementById('answer-modal');
  const answerList = document.getElementById('answer-list');
  const answerSave = document.getElementById('answer-save');
  const answerCancel = document.getElementById('answer-cancel');

  let currentPaper = null;
  let readMode = false;
  let answerFields = [];

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

  function renderQuestions() {
    const questions = (currentPaper && currentPaper.review_questions) || [];
    addQuestionBtn.disabled = !currentPaper;
    questionsList.innerHTML = '';
    questionsList.hidden = questions.length === 0;
    questionsEmpty.hidden = questions.length > 0;
    for (const question of questions) {
      const li = document.createElement('li');
      li.className = 'question-item';

      const text = document.createElement('span');
      text.className = 'question-text';
      text.textContent = question;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'question-remove';
      removeBtn.textContent = '-';
      removeBtn.title = 'Remove question';
      removeBtn.addEventListener('click', async () => {
        await window.PaperStorage.removeReviewQuestion(
          currentPaper.paper_id,
          question
        );
        const idx = currentPaper.review_questions.indexOf(question);
        if (idx !== -1) currentPaper.review_questions.splice(idx, 1);
        renderQuestions();
        renderQuestionList();
      });

      li.appendChild(text);
      li.appendChild(removeBtn);
      questionsList.appendChild(li);
    }
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

    renderQuestions();
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

  function openAnswerModal() {
    const questions = (currentPaper && currentPaper.review_questions) || [];
    if (questions.length === 0) return false;

    const answers = (currentPaper && currentPaper.answers) || {};
    answerFields = [];
    answerList.innerHTML = '';

    for (const question of questions) {
      const li = document.createElement('li');
      li.className = 'answer-item';

      const label = document.createElement('span');
      label.className = 'answer-question';
      label.textContent = question;

      const textarea = document.createElement('textarea');
      textarea.rows = 2;
      textarea.placeholder = 'Your reflection...';
      textarea.value = answers[question] || '';

      li.appendChild(label);
      li.appendChild(textarea);
      answerList.appendChild(li);
      answerFields.push({ question, textarea });
    }

    answerModal.hidden = false;
    if (answerFields[0]) answerFields[0].textarea.focus();
    return true;
  }

  function closeAnswerModal() {
    answerModal.hidden = true;
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

  function isPdfUrl(url) {
    if (/\.pdf(?:$|[?#])/i.test(url || '')) return true;
    return /arxiv\.org\/pdf\//i.test(url || '');
  }

  async function ensureOffscreen() {
    try {
      if (await chrome.offscreen.hasDocument()) return;
    } catch (err) {
      /* fall through to create */
    }
    await chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Parse PDF documents with pdf.js to extract paper structure.',
    });
  }

  async function sendToOffscreen(message, attempt = 0) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return sendToOffscreen(message, attempt + 1);
      }
      throw err;
    }
  }

  async function extractPdfFromTab(tab) {
    const res = await fetch(tab.url);
    if (!res.ok) {
      throw new Error('Failed to fetch PDF (HTTP ' + res.status + ').');
    }
    const data = new Uint8Array(await res.arrayBuffer());
    await ensureOffscreen();
    const result = await sendToOffscreen({
      type: 'EXTRACT_PDF',
      url: tab.url,
      data,
    });
    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'PDF extraction failed.');
    }
    const paper = window.PaperDetector.fromText(result.pages, { url: tab.url });
    window.PaperDetector.logToConsole(paper);
    return paper;
  }

  async function tryFetchPdf(tab) {
    let probe;
    try {
      probe = await fetch(tab.url, { headers: { Range: 'bytes=0-0' } });
      const type = (probe.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('application/pdf')) return null;
    } catch (err) {
      return null;
    }
    return await extractPdfFromTab(tab);
  }

  async function detectCurrentTab(tab) {
    if (isPdfUrl(tab.url)) {
      return await extractPdfFromTab(tab);
    }

    try {
      const res = await sendMessage(tab.id, { type: 'DETECT_PAPER' });
      if (res && res.ok && res.data) return res.data;
      if (res && res.ok === false && res.error) {
        const pdf = await tryFetchPdf(tab);
        if (pdf) return pdf;
        throw new Error(res.error);
      }
    } catch (err) {
      const pdf = await tryFetchPdf(tab);
      if (pdf) return pdf;
      throw err;
    }

    return null;
  }

  function showEmptyState() {
    currentPaper = null;
    readMode = false;
    readBtn.textContent = 'READ';
    readBtn.disabled = true;
    structureList.innerHTML = '';
    structureList.hidden = true;
    structureEmpty.hidden = false;
    renderQuestions();
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

    const isPdf = isPdfUrl(tab.url);
    const cachedLoaded = await loadFromCache(tab);

    if (isPdf) {
      runBtn.disabled = false;
      if (cachedLoaded) {
        setStatus('PDF loaded from cache. Re-run detect to re-extract text.');
      } else {
        setStatus('PDF detected on this page. Run detect to build the checklist.');
      }
      return;
    }

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
      const result = await detectCurrentTab(tab);
      if (!result) {
        setStatus('No paper or PDF detected on this page.', false);
        return;
      }
      console.log('[Research Reading Assistant] Detection result:', result);
      const saved = await window.PaperStorage.savePaper(result);
      renderStructure(saved);
      setStatus('Detection complete. Cached for review. See page console (F12) for full output.');
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
      if (openAnswerModal()) {
        setStatus('Reading complete. Answer your review questions.');
      } else {
        setStatus('Read mode off. All items shown.');
      }
    }
  });

  addQuestionBtn.addEventListener('click', () => {
    openQuestionModal();
  });

  questionMore.addEventListener('click', async () => {
    const saved = await saveCurrentQuestion();
    if (saved) {
      questionInput.value = '';
      renderQuestionList();
      renderQuestions();
      questionInput.focus();
    }
  });

  questionDone.addEventListener('click', async () => {
    const saved = await saveCurrentQuestion();
    closeQuestionModal();
    renderQuestions();
    setStatus(
      saved
        ? 'Questions saved. Review the tracked items and reflect.'
        : 'No question recorded. Reading the tracked items.'
    );
  });

  answerSave.addEventListener('click', async () => {
    if (!currentPaper) {
      closeAnswerModal();
      return;
    }
    const answers = {};
    for (const { question, textarea } of answerFields) {
      const value = textarea.value.trim();
      if (value) answers[question] = value;
    }
    await window.PaperStorage.saveAnswers(currentPaper.paper_id, answers);
    currentPaper.answers = { ...(currentPaper.answers || {}), ...answers };
    closeAnswerModal();
    setStatus(
      Object.keys(answers).length > 0
        ? 'Answers saved. Reading session complete.'
        : 'No answers recorded. Reading session complete.'
    );
  });

  answerCancel.addEventListener('click', () => {
    closeAnswerModal();
    setStatus('Read mode off. You can answer your questions later.');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
