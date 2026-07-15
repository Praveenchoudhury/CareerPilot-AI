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
    // Re-scroll to upload section
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Analysis ──────────────────────────────────────────────────────────

  /**
   * runAnalysis — called by upload.js when the Analyze button is clicked.
   * Phase 1: Shows placeholder dashboard.
   * Phase 2: Calls StreamClient.openStream → Dashboard.renderAll.
   */
  async function runAnalysis({ resumeText, jobTitle }) {
    if (!resumeText || resumeText.trim().length < 50) {
      showToast('Please provide more resume content.', 'warning');
      return;
    }

    // Reset dashboard and show it
    Dashboard.reset();
    showDashboard();

    // Reset ATS display
    const atsNumber = document.getElementById('atsScoreNumber');
    const atsReasoning = document.getElementById('atsReasoning');
    if (atsNumber) atsNumber.textContent = '--';
    if (atsReasoning) atsReasoning.textContent = 'Analyzing your resume with AI...';

    try {
      // Phase 2: replace with StreamClient.openStream
      showToast('AI analysis coming in Phase 2 — Gemini integration in progress.', 'info');

      // Simulate a small delay then show placeholder
      await new Promise(r => setTimeout(r, 800));

      // Phase 1 placeholder result — demonstrates the full UI
      const placeholderResult = buildPlaceholderResult(jobTitle);
      Dashboard.renderAll(placeholderResult);

      // Enable action buttons once analysis is done
      CoverLetter.setResumeText(resumeText);
      CoverLetter.enableOpenBtn(true);
      LinkedIn.setData(resumeText, jobTitle);
      LinkedIn.enableOpenBtn(true);

    } catch (err) {
      showToast(err.message || 'Analysis failed. Please try again.', 'error');
      hideDashboard();
    }
  }

  /**
   * Phase 1 placeholder result — populates all 13 cards with demo data
   * so the dashboard UI can be fully tested before Gemini is wired in.
   */
  function buildPlaceholderResult(jobTitle) {
    const role = jobTitle || 'Software Engineer';
    return {
      professional_summary:
        `A results-driven professional with demonstrated expertise in software engineering and system design. ` +
        `Strong background in full-stack development with a track record of delivering scalable solutions. ` +
        `Experienced in cross-functional team collaboration and agile delivery. ` +
        `Seeking a ${role} role to drive technical excellence and product impact.`,

      ats_score: 72,
      ats_score_reasoning:
        `Your resume scores 72/100 for ATS compatibility. Strong use of action verbs and quantified achievements, ` +
        `but missing some high-frequency keywords for ${role} roles. Consider adding more role-specific terminology.`,

      strengths: [
        'Strong quantified achievements throughout (e.g., "reduced latency by 40%")',
        'Clear progression of responsibility across positions',
        'Technical skills section is well-organised and scannable',
        'Education section is cleanly formatted with relevant coursework',
        'Contact information is complete and professional',
      ],

      weaknesses: [
        'Summary section is generic — missing specific value proposition for ' + role,
        'Missing keywords: Docker, Kubernetes, CI/CD pipelines',
        'No mention of team size or leadership scope in work experience',
        'GitHub/portfolio link is absent — critical for technical roles',
        'Date formatting is inconsistent across positions',
      ],

      missing_skills: [
        'Kubernetes', 'Terraform', 'GraphQL', 'System Design',
        'CI/CD Pipelines', 'Technical Leadership', 'Docker', 'AWS',
      ],

      suggested_improvements: [
        'Add a targeted summary tailored to ' + role + ' with your top 3 technical strengths',
        'Include GitHub profile and portfolio URL in the header',
        'Quantify all bullet points — replace "worked on" with measurable outcomes',
        'Add a "Projects" section with 2–3 noteworthy personal or open-source contributions',
        'Standardise date format to "Month YYYY – Month YYYY" consistently',
      ],

      career_path_recommendations: {
        short_term: `Transition into a ${role} II or Senior ${role} position at a mid-size tech company. ` +
          `Focus on deepening expertise in cloud infrastructure and system design. Target 20% salary increase.`,
        mid_term: `Move into a Staff Engineer or Tech Lead role, owning the architecture for a product area. ` +
          `Build mentorship experience and cross-functional leadership skills over 2–3 years.`,
        long_term: `Pursue Principal Engineer or Engineering Manager track at a FAANG-tier company or founding ` +
          `an engineering-led startup. Build a strong public technical profile via talks, blogs, or OSS contributions.`,
      },

      skill_roadmap: {
        days_30: [
          'Complete AWS Solutions Architect Associate (or relevant cert for your stack)',
          'Build and deploy one Docker + Kubernetes project',
          'Study 3 system design case studies (design Twitter, URL shortener, etc.)',
        ],
        days_60: [
          'Contribute one meaningful PR to an open-source project',
          'Add CI/CD pipeline to an existing personal project using GitHub Actions',
          'Complete a GraphQL course and integrate it into a side project',
        ],
        days_90: [
          'Publish a technical blog post or give a lightning talk at a meetup',
          'Complete a full-stack project showcasing all newly acquired skills',
          'Apply to 15 senior roles and track ATS pass-through rate with new resume',
        ],
      },

      recommended_certifications: [
        { name: 'AWS Solutions Architect Associate', provider: 'Amazon Web Services', priority: 'High',
          reason: 'Validates cloud expertise — required or preferred in 70%+ of ' + role + ' JDs.' },
        { name: 'Certified Kubernetes Administrator (CKA)', provider: 'CNCF', priority: 'High',
          reason: 'Container orchestration is a top missing skill in your profile.' },
        { name: 'Google Professional Cloud Developer', provider: 'Google Cloud', priority: 'Medium',
          reason: 'Complements AWS cert; broadens cloud platform knowledge.' },
        { name: 'Terraform Associate', provider: 'HashiCorp', priority: 'Medium',
          reason: 'Infrastructure-as-code is a key differentiator for senior roles.' },
      ],

      recommended_projects: [
        { title: 'Distributed Task Queue', description: 'Build a Redis-backed distributed task queue with retry logic, dead-letter queues, and a real-time dashboard. Deploy on AWS ECS.',
          skills_demonstrated: ['Distributed Systems', 'Redis', 'AWS ECS', 'Python/Node.js'] },
        { title: 'Real-time Chat with WebSockets', description: 'Full-stack chat application with rooms, typing indicators, read receipts, and message persistence. CI/CD pipeline via GitHub Actions.',
          skills_demonstrated: ['WebSockets', 'React', 'PostgreSQL', 'CI/CD'] },
        { title: 'GraphQL API Gateway', description: 'Build a GraphQL gateway that federates multiple REST microservices. Add authentication, rate limiting, and query depth limits.',
          skills_demonstrated: ['GraphQL', 'API Design', 'Authentication', 'Microservices'] },
      ],

      interview_questions: [
        { question: 'Tell me about a time you had to optimise the performance of a system under pressure. What was your approach?',
          model_answer: 'Identify the bottleneck using profiling tools, implement targeted fix (caching, query optimisation, async processing), measure impact, document for future reference.',
          type: 'Behavioral' },
        { question: 'Design a URL shortening service like bit.ly. Walk me through your architecture decisions.',
          model_answer: 'Cover: hashing strategy, database choice (KV store for lookups), CDN for redirect performance, analytics pipeline, rate limiting, and scalability considerations.',
          type: 'Technical' },
        { question: 'If you joined this team and found the codebase was significantly worse than expected, what would you do in your first 90 days?',
          model_answer: 'Listen and learn first. Map the debt. Propose an incremental improvement plan. Build trust through small wins before large refactors. Advocate without alienating.',
          type: 'Situational' },
        { question: 'How do you approach mentoring junior developers without slowing down delivery?',
          model_answer: 'Pair programming on complex tasks, structured code review feedback, weekly 1:1s, delegating well-scoped tasks with clear acceptance criteria.',
          type: 'Behavioral' },
        { question: 'Explain the CAP theorem and give a practical example of when you\'ve made a consistency vs. availability trade-off.',
          model_answer: 'CAP: consistency, availability, partition tolerance — pick two under a partition. Example: chose eventual consistency for a shopping cart (availability) but strong consistency for payment records.',
          type: 'Technical' },
      ],
    };
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

    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      navbar.classList.toggle('scrolled', y > 20);
      lastY = y;
    }, { passive: true });

    // Mobile menu toggle
    const menuBtn   = document.getElementById('mobileMenuBtn');
    const navLinks  = document.getElementById('navLinks');

    if (menuBtn && navLinks) {
      menuBtn.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(open));
      });

      // Close menu on link click
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

    targets.forEach(el => {
      el.classList.add('animate-on-scroll');
    });

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

    console.log('%cCareerPilot AI — Phase 1 loaded ✓', 'color: #8b5cf6; font-weight: bold; font-size: 14px;');
    console.log('%cPhase 2 will add Gemini AI integration.', 'color: #94a3b8; font-size: 12px;');
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { runAnalysis, showToast };
})();
