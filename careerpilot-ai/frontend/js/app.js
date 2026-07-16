/**
 * app.js — CareerPilot AI Bootstrap & Global State Manager
 *
 * Responsibilities:
 *  - Initialise all modules
 *  - Manage view state (landing ↔ dashboard)
 *  - Expose App.runAnalysis() called by upload.js
 *  - Expose App.showToast() used everywhere
 *  - Navbar scroll effect
 *  - Scroll-triggered section animations
 *  - New analysis button
 */

const App = (() => {

  // ── Views ─────────────────────────────────────────────────────────────

  function showDashboard() {
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('dashboardSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideDashboard() {
    const dash = document.getElementById('dashboardSection');
    dash.classList.add('hidden');
    Dashboard.reset();
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Active stream controller ───────────────────────────────────────────
  let _activeStream = null;

  // ── Analysis ──────────────────────────────────────────────────────────

  /**
   * runAnalysis — called by upload.js when the Analyze button is clicked.
   * Calls StreamClient.openStream → Dashboard.renderAll via SSE.
   */
  async function runAnalysis({ resumeText, jobTitle }) {
    if (!resumeText || resumeText.trim().length < 50) {
      showToast('Please provide more resume content.', 'warning');
      return;
    }

    // Abort any in-flight stream
    if (_activeStream) {
      _activeStream.abort();
      _activeStream = null;
    }

    // Reset dashboard and show it with skeleton loaders
    Dashboard.reset();
    showDashboard();

    // Reset ATS display
    const atsNumber    = document.getElementById('atsScoreNumber');
    const atsReasoning = document.getElementById('atsReasoning');
    if (atsNumber)    atsNumber.textContent    = '--';
    if (atsReasoning) atsReasoning.textContent = 'Analyzing your resume with AI...';

    // Disable the analyze button while streaming
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.disabled = true;

    showToast('Sending resume to Gemini AI…', 'info', 3000);

    _activeStream = StreamClient.openStream({
      url:  '/api/analyze',
      body: { resume_text: resumeText, job_title: jobTitle || '' },

      onProgress(msg) {
        if (atsReasoning) atsReasoning.textContent = msg;
      },

      onChunk(_chunk) {
        // chunks are accumulating — no per-token UI needed
      },

      onComplete(result) {
        _activeStream = null;
        if (analyzeBtn) analyzeBtn.disabled = false;

        // Check for server-side error propagated through the stream
        if (result && result.error) {
          showToast(result.error, 'error', 6000);
          hideDashboard();
          return;
        }

        Dashboard.renderAll(result);
        CoverLetter.setResumeText(resumeText);
        CoverLetter.enableOpenBtn(true);
        LinkedIn.setData(resumeText, jobTitle);
        LinkedIn.enableOpenBtn(true);
        showToast('Analysis complete!', 'success', 3000);
      },

      onError(err) {
        _activeStream = null;
        if (analyzeBtn) analyzeBtn.disabled = false;
        showToast(err.message || 'Analysis failed. Please try again.', 'error', 6000);
        hideDashboard();
      },
    });
  }

  // ── Toast notifications ────────────────────────────────────────────────

  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  // ── Navbar scroll effect ───────────────────────────────────────────────

  function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    const menuBtn  = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');

    if (menuBtn && navLinks) {
      menuBtn.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(open));
      });

      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
          menuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  // ── Scroll-triggered animations ────────────────────────────────────────

  function initScrollAnimations() {
    const targets = document.querySelectorAll('.feature-card, .step-card');
    targets.forEach(el => el.classList.add('animate-on-scroll'));

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach(el => observer.observe(el));
  }

  // ── New Analysis button ────────────────────────────────────────────────

  function initNewAnalysisBtn() {
    const btn = document.getElementById('newAnalysisBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (_activeStream) { _activeStream.abort(); _activeStream = null; }
        hideDashboard();
        Upload.resetForm();
        CoverLetter.enableOpenBtn(false);
        LinkedIn.enableOpenBtn(false);
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    Upload.init();
    CoverLetter.init();
    LinkedIn.init();
    initNavbar();
    initScrollAnimations();
    initNewAnalysisBtn();

    console.log('%cCareerPilot AI loaded ✓', 'color: #8b5cf6; font-weight: bold; font-size: 14px;');
    console.log('%cGemini AI integration active.', 'color: #22c55e; font-size: 12px;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { runAnalysis, showToast };
})();
