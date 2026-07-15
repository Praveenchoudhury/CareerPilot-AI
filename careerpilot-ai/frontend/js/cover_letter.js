/**
 * cover_letter.js — Cover Letter Generator modal.
 *
 * Phase 1: Modal open/close and form wiring.
 * Phase 2: Connects to /api/cover-letter SSE endpoint.
 */

const CoverLetter = (() => {

  let modal, openBtn, closeBtn, cancelBtn, generateBtn,
      jobTitleInput, jobDescInput, resultBox, resultText, copyBtn;

  // ── State ──────────────────────────────────────────────────────────────
  let resumeText = '';   // set by App after analysis completes

  // ── Open / Close ──────────────────────────────────────────────────────

  function open(text = '') {
    if (text) resumeText = text;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    jobTitleInput.focus();
  }

  function close() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Generate ──────────────────────────────────────────────────────────

  async function generate() {
    const jobTitle = jobTitleInput.value.trim();
    const jobDesc  = jobDescInput.value.trim();

    if (!jobTitle) {
      App.showToast('Please enter a target job title.', 'warning');
      jobTitleInput.focus();
      return;
    }

    if (!jobDesc || jobDesc.length < 50) {
      App.showToast('Please paste the job description (at least 50 characters).', 'warning');
      jobDescInput.focus();
      return;
    }

    if (!resumeText) {
      App.showToast('Please complete a resume analysis first.', 'info');
      return;
    }

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-default-content').classList.add('hidden');
    generateBtn.querySelector('.btn-loading-content').classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      // Phase 2: replace with StreamClient.openStream call
      // For now, show a placeholder message
      await new Promise(r => setTimeout(r, 600));
      resultText.textContent =
        'Cover letter generation will be available in Phase 2 after Gemini integration.\n\n' +
        'The backend endpoint /api/cover-letter is already defined and ready to connect.';
      resultBox.classList.remove('hidden');
      App.showToast('Cover letter generated! (Phase 2 preview)', 'info');
    } catch (err) {
      App.showToast(err.message || 'Failed to generate cover letter.', 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.querySelector('.btn-default-content').classList.remove('hidden');
      generateBtn.querySelector('.btn-loading-content').classList.add('hidden');
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(resultText.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
    } catch (_) {
      App.showToast('Could not copy. Please select and copy manually.', 'warning');
    }
  }

  // ── Set resume text (called by App after analysis) ─────────────────────

  function setResumeText(text) {
    resumeText = text;
  }

  // ── Enable/disable open button ─────────────────────────────────────────

  function enableOpenBtn(enable) {
    if (openBtn) openBtn.disabled = !enable;
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    modal         = document.getElementById('coverLetterModal');
    openBtn       = document.getElementById('openCoverLetterBtn');
    closeBtn      = document.getElementById('closeCoverLetterModal');
    cancelBtn     = document.getElementById('cancelCoverLetter');
    generateBtn   = document.getElementById('generateCoverLetter');
    jobTitleInput = document.getElementById('clJobTitle');
    jobDescInput  = document.getElementById('clJobDescription');
    resultBox     = document.getElementById('clResult');
    resultText    = document.getElementById('clResultText');
    copyBtn       = document.getElementById('clCopyBtn');

    openBtn.addEventListener('click', () => open());
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    generateBtn.addEventListener('click', generate);
    copyBtn.addEventListener('click', copyToClipboard);

    // Close on overlay click
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });
  }

  return { init, open, close, setResumeText, enableOpenBtn };
})();
