/**
 * cover_letter.js — Cover Letter Generator modal.
 * Streams plain text from /api/cover-letter via SSE and renders it in the modal.
 */

const CoverLetter = (() => {

  let modal, openBtn, closeBtn, cancelBtn, generateBtn,
      jobTitleInput, jobDescInput, resultBox, resultText, copyBtn;

  // ── State ──────────────────────────────────────────────────────────────
  let resumeText    = '';   // set by App after analysis completes
  let activeStream  = null; // current SSE controller

  // ── Open / Close ──────────────────────────────────────────────────────

  function open(text = '') {
    if (text) resumeText = text;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    jobTitleInput.focus();
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

    // Abort any in-flight stream
    if (activeStream) { activeStream.abort(); activeStream = null; }

    setLoading(true);
    resultBox.classList.add('hidden');
    resultText.textContent = '';

    activeStream = StreamClient.openStream({
      url:         '/api/cover-letter',
      body:        { resume_text: resumeText, job_title: jobTitle, job_description: jobDesc },
      parseAsText: true,

      onChunk(chunk) {
        // Stream text into the result box as it arrives
        resultText.textContent += chunk;
        if (resultBox.classList.contains('hidden')) {
          resultBox.classList.remove('hidden');
        }
      },

      onComplete(text) {
        activeStream = null;
        setLoading(false);
        resultText.textContent = text;
        resultBox.classList.remove('hidden');
        App.showToast('Cover letter generated!', 'success');
      },

      onError(err) {
        activeStream = null;
        setLoading(false);
        App.showToast(err.message || 'Failed to generate cover letter.', 'error');
      },
    });
  }

  // ── Copy ──────────────────────────────────────────────────────────────

  async function copyToClipboard() {
    const text = resultText.textContent;
    if (!text) {
      App.showToast('Nothing to copy yet.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
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
