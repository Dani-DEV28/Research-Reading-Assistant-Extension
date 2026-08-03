(() => {
  'use strict';

  const TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_PAPERS = 10;
  const STORAGE_KEY = 'papers';

  function fnv1a(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  function paperIdForUrl(url) {
    const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([a-z0-9.]+)/i);
    if (match) return 'arxiv_' + match[1];
    return 'page_' + fnv1a(url);
  }

  async function readAll() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] || {};
  }

  async function writeAll(map) {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  }

  function purgeExpired(map, now) {
    for (const id of Object.keys(map)) {
      const record = map[id];
      if (!record || now - (record.detected_at || 0) > TTL_MS) {
        delete map[id];
      }
    }
  }

  function enforceCap(map) {
    const entries = Object.keys(map)
      .map((id) => ({ id, detected_at: map[id].detected_at || 0 }))
      .sort((a, b) => b.detected_at - a.detected_at);
    for (const entry of entries.slice(MAX_PAPERS)) {
      delete map[entry.id];
    }
  }

  async function savePaper(record) {
    const now = Date.now();
    const map = await readAll();
    purgeExpired(map, now);

    const paperId = record.paper_id || paperIdForUrl(record.url || '');
    const existing = map[paperId] || {};
    const updated = {
      ...existing,
      ...record,
      paper_id: paperId,
      detected_at: now,
    };
    delete updated.tracked;
    updated.progress = existing.progress || {};
    map[paperId] = updated;

    enforceCap(map);
    await writeAll(map);
    return updated;
  }

  async function listPapers() {
    const now = Date.now();
    const map = await readAll();
    purgeExpired(map, now);
    return Object.values(map).sort(
      (a, b) => (b.detected_at || 0) - (a.detected_at || 0)
    );
  }

  async function getPaper(paperId) {
    const map = await readAll();
    return map[paperId] || null;
  }

  async function setProgress(paperId, itemKey, done) {
    const map = await readAll();
    if (map[paperId]) {
      map[paperId].progress = map[paperId].progress || {};
      map[paperId].progress[itemKey] = !!done;
      await writeAll(map);
    }
  }

  async function setReviewPlan(paperId, reviewPlan) {
    const map = await readAll();
    if (map[paperId]) {
      map[paperId].review_plan = reviewPlan;
      await writeAll(map);
    }
  }

  async function addReviewQuestion(paperId, question) {
    const map = await readAll();
    if (map[paperId]) {
      const list = map[paperId].review_questions || [];
      const trimmed = String(question || '').trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
        map[paperId].review_questions = list;
        await writeAll(map);
      }
    }
  }

  async function removeReviewQuestion(paperId, question) {
    const map = await readAll();
    if (map[paperId]) {
      const list = map[paperId].review_questions || [];
      const idx = list.indexOf(question);
      if (idx !== -1) {
        list.splice(idx, 1);
        map[paperId].review_questions = list;
        await writeAll(map);
      }
    }
  }

  async function saveAnswers(paperId, answers) {
    const map = await readAll();
    if (map[paperId]) {
      map[paperId].answers = { ...(map[paperId].answers || {}), ...answers };
      await writeAll(map);
    }
  }

  async function deletePaper(paperId) {
    const map = await readAll();
    if (map[paperId]) {
      delete map[paperId];
      await writeAll(map);
    }
  }

  window.PaperStorage = {
    TTL_MS,
    MAX_PAPERS,
    paperIdForUrl,
    savePaper,
    listPapers,
    getPaper,
    setProgress,
    setReviewPlan,
    addReviewQuestion,
    removeReviewQuestion,
    saveAnswers,
    deletePaper,
  };
})();
