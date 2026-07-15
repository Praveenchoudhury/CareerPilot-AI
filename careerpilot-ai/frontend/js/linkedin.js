/**
 * linkedin.js — LinkedIn Optimizer modal.
 *
 * Phase 1: Modal open/close and form wiring.
 * Phase 2: Connects to /api/linkedin SSE endpoint.
 */

const LinkedIn = (() => {

  let modal, openBtn, closeBtn, cancelBtn, generateBtn, resultBox,
      headlinesContainer, aboutContainer;

  // ── State ──────────────────────────────────────────────────────────────
  let resumeText = '';
  let jobTitle   = '';

  // ── Open / Close ──────────────────────────────────────────────────────

  function open(text = '', title = '') {
    if (text)  resumeText = text;
    if (title) jobTitle   = title;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Generate ──────────────────────────────────────────────────────────

  async function generate() {
    if (!resumeText) {
      App.showToast('Please complete a resume analysis first.', 'info');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-default-content').classList.add('hidden');
    generateBtn.querySelector('.btn-loading-content').classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      // Phase 2: replace with real SSE call to /api/linkedin
      await new Promise(r => setTimeout(r, 600));

      // Placeholder render
      renderResult({
        headlines: [
          { variant: 1, text: 'Software Engineer | Full-Stack Developer | React & Node.js | Building Scalable Web Applications', tone: 'Achievement-focused' },
          { variant: 2, text: 'Full-Stack Engineer @ [Company] | JavaScript · TypeScript · Cloud | Open to Senior Roles', tone: 'Role + Value' },
          { variant: 3, text: 'Senior Software Engineer | React · Node.js · AWS | 5+ Years Building High-Performance Systems', tone: 'Keyword-optimized' },
        ],
        about_section:
          'LinkedIn optimization will be available in Phase 2 after Gemini integration.\n\n' +
          'The backend endpoint /api/linkedin is already defined and ready to connect.\n\n' +
          'Your personalized About section will appear here once the AI is integrated.',
      });

      resultBox.classList.remove('hidden');
      App.showToast('LinkedIn content generated! (Phase 2 preview)', 'info');
    } catch (err) {
      App.showToast(err.message || 'Failed to generate LinkedIn content.', 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.querySelector('.btn-default-content').classList.remove('hidden');
      generateBtn.querySelector('.btn-loading-content').classList.add('hidden');
    }
  }

  // ── Render result ─────────────────────────────────────────────────────

  function renderResult(data) {
    // Headlines
    headlinesContainer.innerHTML = data.headlines.map(h => `
      <div class="li-headline-item">
        <div class="li-headline-num">${h.variant}</div>
        <div>
          <div class="li-headline-text">${escHtml(h.text)}</div>
          <div class="li-headline-tone">${escHtml(h.tone)}</div>
        </div>
        <button class="btn-text-sm copy-headline-btn" data-text="${escAttr(h.text)}">Copy</button>
      </div>`).join('');

    // About section
    aboutContainer.innerHTML = `
      <div class="result-label" style="margin-top: var(--space-5)">About Section</div>
      <div class="result-text">${escHtml(data.about_section)}</div>
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
    d.textContent = str;
    return d.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
