(() => {
  'use strict';

  const GOAL_COPY = {
    quick: 'Get a quick overview of the paper and decide whether to read more deeply.',
    methods: 'Understand the methodology and the assumptions behind it.',
    results: 'Evaluate whether the results support the paper\'s main claim.',
    project: 'Connect this paper to my own research, project, or questions.',
  };

  const DEFAULT_PATH_KEYS = ['title', 'figure_0', 'abstract', 'conclusion', 'methods'];

  const statusEl = document.getElementById('status');
  const detectPanel = document.getElementById('detect-panel');
  const setupPanel = document.getElementById('setup-panel');
  const readingPanel = document.getElementById('reading-panel');
  const completePanel = document.getElementById('complete-panel');
  const paperSource = document.getElementById('paper-source');
  const paperTitle = document.getElementById('paper-title');
  const paperSummary = document.getElementById('paper-summary');
  const runBtn = document.getElementById('run-detect');
  const goalGrid = document.getElementById('goal-grid');
  const readingGoalInput = document.getElementById('reading-goal');
  const suggestedFlowBtn = document.getElementById('suggested-flow');
  const customFlowBtn = document.getElementById('custom-flow');
  const workflowBox = document.getElementById('workflow-box');
  const workflowInput = document.getElementById('workflow-input');
  const generateWorkflowBtn = document.getElementById('generate-workflow');
  const preReadList = document.getElementById('pre-read-list');
  const addSectionSelect = document.getElementById('add-section-select');
  const addSectionBtn = document.getElementById('add-section');
  const focusModeInput = document.getElementById('focus-mode');
  const startReviewBtn = document.getElementById('start-review');
  const readingTitle = document.getElementById('reading-title');
  const toggleCompactBtn = document.getElementById('toggle-compact');
  const readingCount = document.getElementById('reading-count');
  const progressFill = document.getElementById('progress-fill');
  const readingSteps = document.getElementById('reading-steps');
  const currentSectionLabel = document.getElementById('current-section-label');
  const reflectionQuestion = document.getElementById('reflection-question');
  const reflectionAnswer = document.getElementById('reflection-answer');
  const previousStepBtn = document.getElementById('previous-step');
  const nextStepBtn = document.getElementById('next-step');
  const reviewSummary = document.getElementById('review-summary');
  const editPlanBtn = document.getElementById('edit-plan');

  let activeTab = null;
  let currentPaper = null;
  let allItems = [];
  let planItems = [];
  let currentStepIndex = 0;
  let sessionAnswers = {};
  let compactReading = false;

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(text, max) {
    const value = cleanText(text);
    return value.length <= max ? value : value.slice(0, max - 3) + '...';
  }

  function setStatus(text, ok) {
    statusEl.textContent = text;
    statusEl.style.color = ok === true ? '#bfe9ce' : ok === false ? '#ffb3a7' : '';
  }

  function showScreen(screen) {
    detectPanel.hidden = screen !== 'detect';
    setupPanel.hidden = screen !== 'setup';
    readingPanel.hidden = screen !== 'reading';
    completePanel.hidden = screen !== 'complete';
  }

  function buildChecklistItems(paper) {
    const items = [];

    if (paper.title) {
      items.push({
        key: 'title',
        label: 'Title',
        type: 'orientation',
        target: 'title',
        text: paper.title,
        question: 'What problem does this title suggest the paper is trying to solve?',
      });
    }

    (paper.figures || []).slice(0, 3).forEach((figure, i) => {
      items.push({
        key: 'figure_' + i,
        label: 'Figure ' + figure.index,
        type: 'visual',
        target: 'figure_' + i,
        text: figure.caption || figure.alt || '',
        question: 'What does this figure help you understand about the paper?',
      });
    });

    if (paper.abstract) {
      items.push({
        key: 'abstract',
        label: 'Abstract',
        type: 'overview',
        target: 'abstract',
        text: paper.abstract,
        question: 'What is the main claim and what evidence do the authors preview?',
      });
    } else {
      items.push({
        key: 'abstract',
        label: 'Abstract',
        type: 'overview',
        target: 'abstract',
        text: '',
        question: 'What is the main claim and what evidence do the authors preview?',
      });
    }

    (paper.sections || []).forEach((section, i) => {
      items.push({
        key: 'section_' + i,
        label: section.heading || 'Section ' + (i + 1),
        type: 'section',
        id: section.id || '',
        target: section.id ? 'id:' + section.id : 'section:' + i,
        text: section.snippet || '',
        question: questionForHeading(section.heading || ''),
      });
    });

    if (paper.conclusion) {
      items.push({
        key: 'conclusion',
        label: 'Conclusion',
        type: 'wrap-up',
        id: paper.conclusion.id || '',
        target: paper.conclusion.id ? 'id:' + paper.conclusion.id : 'conclusion',
        text: paper.conclusion.text || '',
        question: 'What do the authors want you to remember, and do you agree?',
      });
    }

    if (paper.methods) {
      items.push({
        key: 'methods',
        label: 'Methods',
        type: 'method',
        id: paper.methods.id || '',
        target: paper.methods.id ? 'id:' + paper.methods.id : 'methods',
        text: paper.methods.text || '',
        question: 'What are the key steps of the method, and what assumptions does it make?',
      });
    }

    return dedupeItems(items);
  }

  function dedupeItems(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const signature = item.key + '|' + item.label.toLowerCase();
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push(item);
    }
    return result;
  }

  function questionForHeading(heading) {
    if (/method|approach|model|system|design/i.test(heading)) {
      return 'How does this method work, step by step?';
    }
    if (/result|experiment|evaluation|analysis|study/i.test(heading)) {
      return 'What evidence in this section supports or weakens the main claim?';
    }
    if (/intro|background|related/i.test(heading)) {
      return 'What context or prior work do you need to understand from this section?';
    }
    if (/discussion|limitation|future|conclusion/i.test(heading)) {
      return 'What should you remember, and what questions remain?';
    }
    return 'What is the most useful idea from this section?';
  }

  function getSuggestedFlow(items) {
    const byKey = new Map(items.map((item) => [item.key, item]));
    const suggested = [];
    for (const key of DEFAULT_PATH_KEYS) {
      if (byKey.has(key)) suggested.push(byKey.get(key));
    }
    return suggested.length > 0 ? suggested : items.slice(0, 5);
  }

  function renderPaperCard(paper) {
    paperSource.textContent = paper.source ? paper.source.toUpperCase() : 'Detected paper';
    paperTitle.textContent = paper.title || 'Untitled paper';
    paperSummary.textContent = paper.abstract
      ? truncate(paper.abstract, 150)
      : 'Paper structure detected. Build a path before reading.';
  }

  function renderSetup(paper, useSavedPlan = true) {
    currentPaper = paper;
    allItems = buildChecklistItems(paper);
    const savedPlan = useSavedPlan ? paper.review_plan : null;

    if (savedPlan && savedPlan.items && savedPlan.items.length) {
      planItems = savedPlan.items
        .map((savedItem) => allItems.find((item) => item.key === savedItem.key))
        .filter(Boolean);
    } else {
      planItems = getSuggestedFlow(allItems);
    }

    readingGoalInput.value = savedPlan && savedPlan.goal ? savedPlan.goal : readingGoalInput.value;
    focusModeInput.checked = savedPlan && typeof savedPlan.focus_mode === 'boolean'
      ? savedPlan.focus_mode
      : true;

    renderPaperCard(paper);
    workflowBox.hidden = true;
    suggestedFlowBtn.classList.add('active');
    customFlowBtn.classList.remove('active');
    renderPlanList();
    renderAddSectionOptions();
    startReviewBtn.disabled = planItems.length === 0;
    showScreen('setup');
  }

  function renderPlanList() {
    preReadList.innerHTML = '';

    if (planItems.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-row';
      empty.textContent = 'Add at least one section to build your reading path.';
      preReadList.appendChild(empty);
      startReviewBtn.disabled = true;
      return;
    }

    planItems.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'pre-read-item';

      const order = document.createElement('span');
      order.className = 'item-order';
      order.textContent = String(index + 1);

      const body = document.createElement('div');
      body.className = 'item-body';

      const label = document.createElement('strong');
      label.textContent = item.label;

      const question = document.createElement('span');
      question.textContent = item.question;

      const controls = document.createElement('div');
      controls.className = 'item-controls';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'icon-button';
      upBtn.textContent = 'Up';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => movePlanItem(index, index - 1));

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'icon-button';
      downBtn.textContent = 'Down';
      downBtn.disabled = index === planItems.length - 1;
      downBtn.addEventListener('click', () => movePlanItem(index, index + 1));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-button';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removePlanItem(index));

      body.appendChild(label);
      body.appendChild(question);
      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(removeBtn);
      li.appendChild(order);
      li.appendChild(body);
      li.appendChild(controls);
      preReadList.appendChild(li);
    });

    startReviewBtn.disabled = planItems.length === 0;
  }

  function renderAddSectionOptions() {
    const selectedKeys = new Set(planItems.map((item) => item.key));
    addSectionSelect.innerHTML = '<option value="">Add another section...</option>';
    for (const item of allItems) {
      if (selectedKeys.has(item.key)) continue;
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      addSectionSelect.appendChild(option);
    }
    addSectionBtn.disabled = addSectionSelect.options.length <= 1;
  }

  function movePlanItem(fromIndex, toIndex) {
    const item = planItems.splice(fromIndex, 1)[0];
    planItems.splice(toIndex, 0, item);
    renderPlanList();
    renderAddSectionOptions();
  }

  function removePlanItem(index) {
    planItems.splice(index, 1);
    renderPlanList();
    renderAddSectionOptions();
  }

  function useSuggestedFlow() {
    planItems = getSuggestedFlow(allItems);
    workflowBox.hidden = true;
    suggestedFlowBtn.classList.add('active');
    customFlowBtn.classList.remove('active');
    renderPlanList();
    renderAddSectionOptions();
  }

  function useCustomFlow() {
    workflowBox.hidden = false;
    customFlowBtn.classList.add('active');
    suggestedFlowBtn.classList.remove('active');
    workflowInput.focus();
  }

  function generateWorkflowPlan() {
    const description = cleanText(workflowInput.value || readingGoalInput.value);
    planItems = inferPlanFromWorkflow(description);
    customFlowBtn.classList.add('active');
    suggestedFlowBtn.classList.remove('active');
    renderPlanList();
    renderAddSectionOptions();
    setStatus('Drafted a path from keywords. Adjust the steps before starting.', true);
  }

  function inferPlanFromWorkflow(description) {
    const text = description.toLowerCase();
    const chosen = [];
    const requestedOrder = [];

    const addByKey = (key) => {
      const item = allItems.find((candidate) => candidate.key === key);
      if (item && !chosen.some((selected) => selected.key === item.key)) chosen.push(item);
    };

    const addMatching = (pattern) => {
      const item = allItems.find((candidate) =>
        pattern.test(candidate.label) || pattern.test(candidate.type || '')
      );
      if (item && !chosen.some((selected) => selected.key === item.key)) chosen.push(item);
    };

    const queue = (name, add) => {
      if (!requestedOrder.some((entry) => entry.name === name)) {
        requestedOrder.push({ name, add });
      }
    };

    if (/title|start|first/.test(text)) queue('title', () => addByKey('title'));
    if (/figure|diagram|visual|architecture|system overview|big picture/.test(text)) {
      queue('figure', () => addByKey('figure_0'));
    }
    if (/abstract|overview|skim|summary|quick|big picture/.test(text)) {
      queue('abstract', () => addByKey('abstract'));
    }
    if (/intro|background|related|prior work|literature|context/.test(text)) {
      queue('background', () => addMatching(/intro|background|related/i));
    }
    if (/method|methodology|approach|pipeline|implementation|how it works/.test(text)) {
      queue('methods', () => {
        addByKey('methods');
        addMatching(/method|approach|model|system|design/i);
      });
    }
    if (/result|evidence|experiment|evaluation|metric|performance|claim/.test(text)) {
      queue('results', () => addMatching(/result|experiment|evaluation|analysis|study/i));
    }
    if (/conclusion|takeaway|remember|final|wrap/.test(text)) {
      queue('conclusion', () => addByKey('conclusion'));
    }

    for (const entry of requestedOrder) {
      entry.add();
    }

    if (/project|my work|relevance|connect|cite|useful/.test(text)) {
      addByKey('abstract');
      addByKey('methods');
      addByKey('conclusion');
    }

    if (chosen.length === 0) {
      addByKey('title');
      addByKey('abstract');
    }

    if (chosen.length < 3) {
      for (const item of getSuggestedFlow(allItems)) {
        if (!chosen.some((selected) => selected.key === item.key)) chosen.push(item);
        if (chosen.length >= 4) break;
      }
    }

    return chosen.length > 0 ? chosen : getSuggestedFlow(allItems);
  }

  function buildReviewPlan() {
    return {
      goal: cleanText(readingGoalInput.value),
      focus_mode: focusModeInput.checked,
      current_step: 0,
      items: planItems.map((item) => ({
        key: item.key,
        label: item.label,
        question: item.question,
        id: item.id || '',
        target: item.target || '',
        type: item.type || '',
      })),
      started_at: Date.now(),
    };
  }

  async function updatePageFocus() {
    const plan = currentPaper && currentPaper.review_plan;
    if (!activeTab || !activeTab.id || !plan || !plan.focus_mode) return;

    try {
      await sendMessage(activeTab.id, {
        type: 'APPLY_FOCUS_MODE',
        items: plan.items,
        currentIndex: currentStepIndex,
      });
    } catch (err) {
      // The popup still works if the content script cannot alter the page.
    }
  }

  async function clearPageFocus() {
    if (!activeTab || !activeTab.id) return;

    try {
      await sendMessage(activeTab.id, { type: 'CLEAR_FOCUS_MODE' });
    } catch (err) {
      // Ignore pages that cannot receive extension messages.
    }
  }

  async function startReview() {
    if (!currentPaper || planItems.length === 0) return;

    activeTab = await getActiveTab();
    const ping = activeTab ? await pingTab(activeTab) : null;
    if (!ping || !ping.supportsReaderPanel) {
      setStatus('Reload the paper page, then open RGuide again to use the page guide.', false);
      return;
    }

    const reviewPlan = buildReviewPlan();
    await window.PaperStorage.setReviewPlan(currentPaper.paper_id, reviewPlan);
    currentPaper.review_plan = reviewPlan;
    currentPaper.progress = currentPaper.progress || {};

    for (const item of reviewPlan.items) {
      currentPaper.progress[item.key] = false;
      await window.PaperStorage.setProgress(currentPaper.paper_id, item.key, false);
    }

    sessionAnswers = currentPaper.answers || {};
    currentStepIndex = 0;
    compactReading = false;

    try {
      await sendMessage(activeTab.id, {
        type: 'START_READER_PANEL',
        paper: {
          paper_id: currentPaper.paper_id,
          title: currentPaper.title || 'Untitled paper',
          url: currentPaper.url || activeTab.url || '',
        },
        plan: reviewPlan,
        answers: sessionAnswers,
      });
      setStatus('RGuide opened on the page.', true);
      window.close();
    } catch (err) {
      setStatus('Reload the paper page, then open RGuide again to use the page guide.', false);
    }
  }

  function renderReading() {
    const plan = currentPaper && currentPaper.review_plan;
    const items = plan && plan.items || [];
    const total = items.length;
    const current = items[currentStepIndex];
    const completed = Math.min(currentStepIndex, total);
    const percent = total ? Math.round((completed / total) * 100) : 0;

    readingTitle.textContent = plan && plan.goal ? plan.goal : 'Guided reading';
    readingCount.textContent = total ? currentStepIndex + 1 + ' / ' + total + ' · ' + percent + '%' : '0 / 0 · 0%';
    progressFill.style.width = percent + '%';
    readingSteps.innerHTML = '';
    readingPanel.classList.toggle('is-compact', compactReading);
    toggleCompactBtn.textContent = compactReading ? 'Full view' : 'Compact view';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'reading-step';
      if (index < currentStepIndex) li.classList.add('complete');
      if (index === currentStepIndex) li.classList.add('current');
      if (plan.focus_mode && index > currentStepIndex) li.classList.add('locked');
      li.textContent = item.label;
      li.addEventListener('click', () => {
        if (!plan.focus_mode || index <= currentStepIndex) {
          saveAnswerDraft();
          currentStepIndex = index;
          renderReading();
        }
      });
      readingSteps.appendChild(li);
    });

    if (!current) {
      finishReview();
      return;
    }

    currentSectionLabel.textContent = current.label;
    reflectionQuestion.textContent = current.question || 'What should you remember from this section?';
    reflectionAnswer.value = sessionAnswers[current.key] || '';
    previousStepBtn.disabled = currentStepIndex === 0;
    nextStepBtn.textContent = currentStepIndex === total - 1
      ? 'Save and finish'
      : 'Save and unlock next';
    updatePageFocus();
  }

  function saveAnswerDraft() {
    const plan = currentPaper && currentPaper.review_plan;
    const current = plan && plan.items[currentStepIndex];
    if (!current) return;
    const value = cleanText(reflectionAnswer.value);
    if (value) sessionAnswers[current.key] = value;
  }

  async function saveCurrentStepAndAdvance() {
    if (!currentPaper) return;

    const plan = currentPaper.review_plan;
    const current = plan && plan.items[currentStepIndex];
    if (!current) return;

    saveAnswerDraft();
    await window.PaperStorage.saveAnswers(currentPaper.paper_id, sessionAnswers);
    await window.PaperStorage.setProgress(currentPaper.paper_id, current.key, true);
    currentPaper.answers = { ...(currentPaper.answers || {}), ...sessionAnswers };
    currentPaper.progress = currentPaper.progress || {};
    currentPaper.progress[current.key] = true;

    currentStepIndex += 1;
    if (currentStepIndex >= plan.items.length) {
      finishReview();
    } else {
      renderReading();
      setStatus('Reflection saved. Next section unlocked.', true);
    }
  }

  function goToPreviousStep() {
    saveAnswerDraft();
    currentStepIndex = Math.max(0, currentStepIndex - 1);
    renderReading();
  }

  function toggleCompactReading() {
    compactReading = !compactReading;
    renderReading();
  }

  function finishReview() {
    const plan = currentPaper && currentPaper.review_plan;
    const items = plan && plan.items || [];
    progressFill.style.width = '100%';
    reviewSummary.innerHTML = '';

    for (const item of items) {
      const term = document.createElement('dt');
      term.textContent = item.label;
      const definition = document.createElement('dd');
      definition.textContent = sessionAnswers[item.key] || 'No reflection saved.';
      reviewSummary.appendChild(term);
      reviewSummary.appendChild(definition);
    }

    showScreen('complete');
    clearPageFocus();
    setStatus('Review saved to local research memory.', true);
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
        await new Promise((resolve) => setTimeout(resolve, 350));
        return pingTab(tab, attempt + 1);
      }
      return null;
    }
  }

  async function detectActivePaper() {
    if (!activeTab) activeTab = await getActiveTab();
    if (!activeTab || !activeTab.id) return false;

    runBtn.disabled = true;
    runBtn.textContent = 'Detecting...';
    setStatus('Detecting paper structure...');

    try {
      const res = await sendMessage(activeTab.id, { type: 'DETECT_PAPER' });
      if (!res || !res.ok) {
        setStatus('Detection returned no paper data.', false);
        return false;
      }

      const saved = await window.PaperStorage.savePaper(res.data);
      currentPaper = saved;
      renderSetup(saved);
      setStatus('Paper detected. Set a goal and build your reading path.', true);
      return true;
    } catch (err) {
      setStatus('Detection failed. Reload the paper page and try again.', false);
      return false;
    } finally {
      runBtn.textContent = 'Detect paper';
      runBtn.disabled = false;
    }
  }

  async function loadFromCache(tab) {
    const paperId = window.PaperStorage.paperIdForUrl(tab.url);
    const cached = await window.PaperStorage.getPaper(paperId);
    if (!cached) return false;

    currentPaper = cached;
    renderSetup(cached);
    setStatus('Loaded saved plan for this paper.', true);
    return true;
  }

  async function init() {
    activeTab = await getActiveTab();

    if (!activeTab || !/^https?:/i.test(activeTab.url || '')) {
      showScreen('detect');
      runBtn.disabled = true;
      setStatus('Open a supported paper page to start.', false);
      return;
    }

    runBtn.disabled = false;
    const cachedLoaded = await loadFromCache(activeTab);
    const ping = await pingTab(activeTab);

    if (!ping) {
      if (!cachedLoaded) {
        showScreen('detect');
        setStatus('Reload the page so the extension can inspect it.', false);
      }
      return;
    }

    if (cachedLoaded) return;

    if (ping.isPaper) {
      await detectActivePaper();
    } else {
      showScreen('detect');
      setStatus('No research paper detected yet. You can still try detection.', true);
    }
  }

  goalGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.goal-chip');
    if (!button) return;

    for (const chip of goalGrid.querySelectorAll('.goal-chip')) {
      chip.classList.toggle('active', chip === button);
    }
    readingGoalInput.value = GOAL_COPY[button.dataset.goal] || '';
    readingGoalInput.focus();
  });

  suggestedFlowBtn.addEventListener('click', useSuggestedFlow);
  customFlowBtn.addEventListener('click', useCustomFlow);
  generateWorkflowBtn.addEventListener('click', generateWorkflowPlan);

  addSectionBtn.addEventListener('click', () => {
    const key = addSectionSelect.value;
    if (!key) return;
    const item = allItems.find((candidate) => candidate.key === key);
    if (!item) return;
    planItems.push(item);
    renderPlanList();
    renderAddSectionOptions();
  });

  startReviewBtn.addEventListener('click', startReview);
  toggleCompactBtn.addEventListener('click', toggleCompactReading);
  previousStepBtn.addEventListener('click', goToPreviousStep);
  nextStepBtn.addEventListener('click', saveCurrentStepAndAdvance);
  editPlanBtn.addEventListener('click', () => {
    clearPageFocus();
    renderSetup(currentPaper);
  });
  runBtn.addEventListener('click', detectActivePaper);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
