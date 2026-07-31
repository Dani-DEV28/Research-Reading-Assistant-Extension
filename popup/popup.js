(() => {
  'use strict';

  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('run-detect');
  const resultSection = document.getElementById('result');
  const resultOutput = document.getElementById('result-output');

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

  function renderResult(data) {
    const summary = {
      source: data.source,
      title: data.title || '(not found)',
      abstract: data.abstract
        ? data.abstract.length > 220
          ? data.abstract.slice(0, 220) + '...'
          : data.abstract
        : '(not found)',
      sections: data.sections.map((s) => s.heading),
      figures: data.figures.map((f) => f.caption || f.alt || f.src || `figure ${f.index}`),
      methods: data.methods ? { heading: data.methods.heading, text: data.methods.text.slice(0, 220) + (data.methods.text.length > 220 ? '...' : '') } : null,
      conclusion: data.conclusion ? { heading: data.conclusion.heading, text: data.conclusion.text.slice(0, 220) + (data.conclusion.text.length > 220 ? '...' : '') } : null,
    };
    resultOutput.textContent = JSON.stringify(summary, null, 2);
    resultSection.hidden = false;
  }

  async function init() {
    const tab = await getActiveTab();

    if (!tab || !/^https?:/i.test(tab.url || '')) {
      setStatus('Not supported. Open a paper page (HTTP/HTTPS) and retry.', false);
      runBtn.disabled = true;
      return;
    }

    const ping = await pingTab(tab);
    if (!ping) {
      setStatus('Content script not available. Reload the page and retry.', false);
      runBtn.disabled = true;
      return;
    }

    if (!ping.isPaper) {
      setStatus('No research paper detected on this page. Detection may still run.', true);
    } else {
      setStatus('Research paper detected on this page.');
    }
    runBtn.disabled = false;
  }

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'DETECTING...';
    resultSection.hidden = true;
    setStatus('Detecting paper structure...');

    try {
      const tab = await getActiveTab();
      const res = await sendMessage(tab.id, { type: 'DETECT_PAPER' });
      if (res && res.ok) {
        console.log('[Research Reading Assistant] Detection result:', res.data);
        renderResult(res.data);
        setStatus('Detection complete. See page console (F12) for full output.');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
