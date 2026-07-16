/**
 * linkedin.js — LinkedIn Optimizer modal.
 * Streams JSON from /api/linkedin via SSE and renders headlines + About section.
 */

const LinkedIn = (() => {

  let modal, openBtn, closeBtn, cancelBtn, generateBtn, resultBox,
      headlinesContainer, aboutContainer;

  // ── State ──────────────────────────────────────────────────────────────
  let resumeText   = '';
  let jobTitle     = '';
  let activeStream = null;

  // ── Open / Close ──────────────────────────────────────────────────────

  function open(text = '', title = '') {
    if (text)  resumeText = text;
    if (title) jobTitle   = title;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (activeStream) { activeStream.abort(); activeStream = null; }
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── UI helpers ─────────────────────────────────────────────────────────

  function setLoading(on) {
    generateBtn.disabled = on;
    generateBtn.querySelector('.btn-default-content').classList.toggle('hidden', on);
    generateBtn.querySelector('.btn-loading-content').classList.toggle('hidden', !on);
  }

  // ── Generate ──────────────────────────────────────────────────────────

  function generate() {
    if (!resumeText) {
      App.showToast('Please complete a resume analysis first.', 'info');
      return;
    }

    // Abort any in-flight stream
    if (activeStream) { activeStream.abort(); activeStream = null; }

    setLoading(true);
    resultBox.classList.add('hidden');

    activeStream = StreamClient.openStream({
      url:  '/api/linkedin',
      body: { resume_text: resumeText, job_title: jobTitle || '' },

      onChunk(_chunk) {
        // accumulate silently — JSON must be complete before rendering
      },

      onComplete(data) {
        activeStream = null;
        setLoading(false);

        if (data && data.error) {
          App.showToast(data.error, 'error', 6000);
          return;
        }

        renderResult(data);
        resultBox.classList.remove('hidden');
        App.showToast('LinkedIn content generated!', 'success');
      },

      onError(err) {
        activeStream = null;
        setLoading(false);
        App.showToast(err.message || 'Failed to generate LinkedIn content.', 'error');
      },
    });
  }

  // ── Render result ─────────────────────────────────────────────────────

  function renderResult(data) {
    const headlines = Array.isArray(data.headlines) ? data.headlines : [];
    const about     = data.about_section || '';

    // Headlines
    headlinesContainer.innerHTML = headlines.map(h => `
      <div class="li-headline-item">
        <div class="li-headline-num">${Number(h.variant) || ''}</div>
        <div>
          <div class="li-headline-text">${escHtml(h.text)}</div>
          <div class="li-headline-tone">${escHtml(h.tone || '')}</div>
        </div>
        <button class="btn-text-sm copy-headline-btn" data-text="${escAttr(h.text)}">Copy</button>
      </div>`).join('');

    // About section
    aboutContainer.innerHTML = `
      <div class="result-label" style="margin-top: var(--space-5)">About Section</div>
      <div class="result-text">${escHtml(about)}</div>
      <button class="btn btn-outline btn-sm" style="margin-top: var(--space-4)" id="copyAboutBtn">
        Copy About Section
      </button>`;

    // Copy headline buttons
    headlinesContainer.querySelectorAll('.copy-headline-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.text);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        } catch (_) {
          App.showToast('Could not copy. Please select manually.', 'warning');
        }
      });
    });

    // Copy about button
    const copyAbout = aboutContainer.querySelector('#copyAboutBtn');
    if (copyAbout) {
      copyAbout.addEventListener('click', async () => {
        try {
          const text = aboutContainer.querySelector('.result-text').textContent;
          await navigator.clipboard.writeText(text);
          copyAbout.textContent = 'Copied!';
          setTimeout(() => { copyAbout.textContent = 'Copy About Section'; }, 2000);
        } catch (_) {
          App.showToast('Could not copy. Please select manually.', 'warning');
        }
      });
    }
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Set data (called by App after analysis) ────────────────────────────

  function setData(text, title) {
    resumeText = text;
    jobTitle   = title;
  }

  function enableOpenBtn(enable) {
    if (openBtn) openBtn.disabled = !enable;
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    modal              = document.getElementById('linkedinModal');
    openBtn            = document.getElementById('openLinkedInBtn');
    closeBtn           = document.getElementById('closeLinkedInModal');
    cancelBtn          = document.getElementById('cancelLinkedIn');
    generateBtn        = document.getElementById('generateLinkedIn');
    resultBox          = document.getElementById('liResult');
    headlinesContainer = document.getElementById('liHeadlines');
    aboutContainer     = document.getElementById('liAbout');

    openBtn.addEventListener('click', () => open());
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    generateBtn.addEventListener('click', generate);

    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });
  }

  return { init, open, close, setData, enableOpenBtn };
})();
