/**
 * dashboard.js — Renders all 13 result cards from the AI analysis.
 *
 * Phase 1: Defines the full render interface. Card rendering functions
 * are stubbed with placeholder content until Phase 2 wires in real data.
 *
 * Phase 2: Replace stub bodies; data flows from stream.js → dashboard.js.
 */

const Dashboard = (() => {

  const grid = () => document.getElementById('dashboardGrid');

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function iconHtml(color, svgPath) {
    return `<div class="card-icon feature-icon--${color}">${svgPath}</div>`;
  }

  function cardHeader(iconColor, svgPath, title, subtitle = '') {
    return `
      <div class="card-header">
        ${iconHtml(iconColor, svgPath)}
        <div>
          <div class="card-title">${title}</div>
          ${subtitle ? `<div class="card-subtitle">${subtitle}</div>` : ''}
        </div>
      </div>`;
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  const ICONS = {
    summary:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`,
    strength: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    weakness: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    skills:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    improve:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    career:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    roadmap:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    cert:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    projects: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    interview:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  };

  /* ── Remove skeletons ────────────────────────────────────────────────── */
  function clearSkeletons() {
    const skeletons = grid().querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
  }

  /* ── Individual card renderers ───────────────────────────────────────── */

  function renderSummary(text) {
    const card = document.createElement('div');
    card.className = 'result-card card-span-12 card-summary';
    card.innerHTML = `
      ${cardHeader('purple', ICONS.summary, 'Professional Summary')}
      <p>${escHtml(text)}</p>`;
    return card;
  }

  function renderStrengths(items) {
    const listItems = items.map(s => `
      <div class="card-list-item">
        <span class="list-bullet bullet-green"></span>
        <span>${escHtml(s)}</span>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('green', ICONS.strength, 'Strengths', `${items.length} identified`)}
      <div class="card-list">${listItems}</div>`;
    return card;
  }

  function renderWeaknesses(items) {
    const listItems = items.map(w => `
      <div class="card-list-item">
        <span class="list-bullet bullet-red"></span>
        <span>${escHtml(w)}</span>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('purple', ICONS.weakness, 'Weaknesses', `${items.length} identified`)}
      <div class="card-list">${listItems}</div>`;
    return card;
  }

  function renderMissingSkills(skills) {
    const tags = skills.map(s =>
      `<span class="skill-tag skill-tag--missing">${escHtml(s)}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('blue', ICONS.skills, 'Missing Skills', 'vs. market expectations')}
      <div class="skill-tags">${tags}</div>`;
    return card;
  }

  function renderImprovements(items) {
    const listItems = items.map(i => `
      <div class="card-list-item">
        <span class="list-bullet bullet-yellow"></span>
        <span>${escHtml(i)}</span>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('orange', ICONS.improve, 'Suggested Improvements')}
      <div class="card-list">${listItems}</div>`;
    return card;
  }

  function renderCareerPaths(paths) {
    const { short_term, mid_term, long_term } = paths;

    const card = document.createElement('div');
    card.className = 'result-card card-span-12';
    card.innerHTML = `
      ${cardHeader('orange', ICONS.career, 'Career Path Recommendations')}
      <div class="career-paths">
        <div class="career-path-item">
          <span class="career-path-badge badge-short">Short-term</span>
          <p class="career-path-text">${escHtml(short_term)}</p>
        </div>
        <div class="career-path-item">
          <span class="career-path-badge badge-mid">Mid-term</span>
          <p class="career-path-text">${escHtml(mid_term)}</p>
        </div>
        <div class="career-path-item">
          <span class="career-path-badge badge-long">Long-term</span>
          <p class="career-path-text">${escHtml(long_term)}</p>
        </div>
      </div>`;
    return card;
  }

  function renderRoadmap(roadmap) {
    const renderPeriod = (cls, label, items) => `
      <div class="roadmap-period ${cls}">
        <div class="roadmap-label">${label}</div>
        <div class="roadmap-items">
          ${items.map(i => `<div class="roadmap-item">${escHtml(i)}</div>`).join('')}
        </div>
      </div>`;

    const card = document.createElement('div');
    card.className = 'result-card card-span-12';
    card.innerHTML = `
      ${cardHeader('cyan', ICONS.roadmap, '30 / 60 / 90-Day Skill Roadmap')}
      <div class="roadmap-grid">
        ${renderPeriod('roadmap-30', '30 Days', roadmap.days_30 || [])}
        ${renderPeriod('roadmap-60', '60 Days', roadmap.days_60 || [])}
        ${renderPeriod('roadmap-90', '90 Days', roadmap.days_90 || [])}
      </div>`;
    return card;
  }

  function renderCertifications(certs) {
    const certItems = certs.map(c => `
      <div class="cert-item">
        <span class="cert-priority priority-${(c.priority || 'medium').toLowerCase()}">${escHtml(c.priority || 'Medium')}</span>
        <div class="cert-info">
          <div class="cert-name">${escHtml(c.name)}</div>
          <div class="cert-provider">${escHtml(c.provider)}</div>
          <div class="cert-reason">${escHtml(c.reason)}</div>
        </div>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('yellow', ICONS.cert, 'Recommended Certifications')}
      <div class="cert-list">${certItems}</div>`;
    return card;
  }

  function renderProjects(projects) {
    const projectItems = projects.map(p => `
      <div class="project-item">
        <div class="project-title">${escHtml(p.title)}</div>
        <p class="project-desc">${escHtml(p.description)}</p>
        <div class="project-skills">
          ${(p.skills_demonstrated || []).map(s =>
            `<span class="project-skill-tag">${escHtml(s)}</span>`
          ).join('')}
        </div>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-6';
    card.innerHTML = `
      ${cardHeader('purple', ICONS.projects, 'Portfolio Project Ideas')}
      <div class="project-list">${projectItems}</div>`;
    return card;
  }

  function renderInterviewQuestions(questions) {
    const qItems = questions.map((q, i) => {
      const typeClass = (q.type || 'behavioral').toLowerCase();
      return `
        <div class="interview-item" data-index="${i}">
          <div class="interview-question-row">
            <span class="q-type-badge q-${typeClass}">${escHtml(q.type || 'Behavioral')}</span>
            <p class="q-text">${escHtml(q.question)}</p>
            <svg class="q-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div class="interview-answer">${escHtml(q.model_answer || '')}</div>
        </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'result-card card-span-12';
    card.innerHTML = `
      ${cardHeader('green', ICONS.interview, 'Interview Questions', `${questions.length} questions with model answers`)}
      <div class="interview-list">${qItems}</div>`;

    // Accordion toggle
    card.querySelectorAll('.interview-question-row').forEach(row => {
      row.addEventListener('click', () => {
        const item = row.closest('.interview-item');
        item.classList.toggle('open');
      });
    });

    return card;
  }

  /* ── Render all cards from a result object ───────────────────────────── */

  function renderAll(result) {
    clearSkeletons();

    const g = grid();

    if (result.professional_summary) {
      g.appendChild(renderSummary(result.professional_summary));
    }
    if (result.strengths?.length) {
      g.appendChild(renderStrengths(result.strengths));
    }
    if (result.weaknesses?.length) {
      g.appendChild(renderWeaknesses(result.weaknesses));
    }
    if (result.missing_skills?.length) {
      g.appendChild(renderMissingSkills(result.missing_skills));
    }
    if (result.suggested_improvements?.length) {
      g.appendChild(renderImprovements(result.suggested_improvements));
    }
    if (result.career_path_recommendations) {
      g.appendChild(renderCareerPaths(result.career_path_recommendations));
    }
    if (result.skill_roadmap) {
      g.appendChild(renderRoadmap(result.skill_roadmap));
    }
    if (result.recommended_certifications?.length) {
      g.appendChild(renderCertifications(result.recommended_certifications));
    }
    if (result.recommended_projects?.length) {
      g.appendChild(renderProjects(result.recommended_projects));
    }
    if (result.interview_questions?.length) {
      g.appendChild(renderInterviewQuestions(result.interview_questions));
    }

    // Update ATS score ring
    if (typeof result.ats_score === 'number') {
      const canvas = document.getElementById('atsRingCanvas');
      const scoreEl = document.getElementById('atsScoreNumber');
      const reasonEl = document.getElementById('atsReasoning');

      if (canvas) {
        AtsRing.animate(canvas, result.ats_score, (val) => {
          if (scoreEl) scoreEl.textContent = val;
        });
      }

      if (reasonEl && result.ats_score_reasoning) {
        reasonEl.textContent = result.ats_score_reasoning;
      }
    }
  }

  /* ── Reset dashboard ─────────────────────────────────────────────────── */
  function reset() {
    const g = grid();
    g.innerHTML = `
      <div class="result-card skeleton-card" id="sk-summary">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-60"></div>
      </div>
      <div class="result-card skeleton-card" id="sk-strengths">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-70"></div>
      </div>
      <div class="result-card skeleton-card" id="sk-weaknesses">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line w-80"></div>
      </div>
      <div class="result-card skeleton-card" id="sk-skills">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-50"></div>
      </div>`;
  }

  return { renderAll, reset, clearSkeletons };
})();
