/* ═══════════════════════════════════════════════
   extra-sections.js
   Injects: ThingsBuilt, Maps of Interest, and Now — before #contact
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── SVG helpers ─── */
  const externalIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

  /* ─── Wait for React to mount and data.json to load ─── */
  function waitForData(cb, retries = 0) {
    const contact = document.getElementById('contact');
    if (contact && window._extraSectionsData) {
      cb(window._extraSectionsData);
    } else if (retries < 60) {
      setTimeout(() => waitForData(cb, retries + 1), 150);
    }
  }

  /* ─── SECTION 1: Things Built ─── */
  function buildThingsSection(items) {
    const cards = items.map(item => `
      <div class="tb-card">
        <div class="tb-for">${escHtml(item.for)}</div>
        <div class="tb-title">${escHtml(item.title)}</div>
        <div class="tb-desc">${escHtml(item.description)}</div>
        <a href="${escHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="tb-link">
          ${externalIcon} Visit
        </a>
      </div>`).join('');

    return `
      <section id="things-built" class="es-section">
        <div class="es-inner">
          <p class="es-eyebrow">Real Impact</p>
          <h2 class="es-heading">Things I Built That People Actually Used</h2>
          <p class="es-subtext">
            These were not toy projects or portfolio demos. They are websites and tools
            built for specific people and academic contexts — and they are live.
          </p>
          <div class="tb-grid">${cards}</div>
        </div>
      </section>`;
  }

  /* ─── SECTION 2: Maps of Interest ─── */
  function buildMapsSection() {
    /* NLP radial map data */
    const nlpNodes = [
      'Bengali NLP',
      'Machine Translation',
      'Low-resource Languages',
      'Direct vs. MT\nInference',
      'Inference\nRouting',
      'Translation\nFailures',
      'LLM Evaluation',
      'Reasoning in LLMs',
      'Error Analysis',
      'Prompt-aware\nSelection',
      'Benchmarking',
      'Applied AI\nfor Education',
    ];

    const CX = 270, CY = 270, R = 195, rNode = 52;
    const n = nlpNodes.length;
    const edges = nlpNodes.map((_, i) => {
      const ang = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = CX + R * Math.cos(ang);
      const y = CY + R * Math.sin(ang);
      return `<line class="nlp-edge" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join('');

    const nodeEls = nlpNodes.map((label, i) => {
      const ang = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = CX + R * Math.cos(ang);
      const y = CY + R * Math.sin(ang);
      const lines = label.split('\n');
      const lineEls = lines.map((l, li) =>
        `<text x="${x.toFixed(1)}" y="${(y + (li - (lines.length - 1) / 2) * 13).toFixed(1)}"
           text-anchor="middle" dominant-baseline="middle"
           font-family="Inter,-apple-system,sans-serif" font-size="10.5" font-weight="500">${escHtml(l)}</text>`
      ).join('');
      return `
        <g class="nlp-node" tabindex="0" role="img" aria-label="${escHtml(lines.join(' '))}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rNode}"/>
          ${lineEls}
        </g>`;
    }).join('');

    const nlpSVG = `
      <svg class="nlp-map-svg" viewBox="0 0 540 540" width="540" height="540"
           role="img" aria-label="NLP interest map centred on NLP and LLMs">
        ${edges}
        <g class="nlp-node-center">
          <circle cx="${CX}" cy="${CY}" r="58"/>
          <text x="${CX}" y="${CY - 8}" text-anchor="middle" dominant-baseline="middle"
                font-family="Playfair Display,Georgia,serif" font-size="14" font-weight="700" fill="#fff">NLP &amp;</text>
          <text x="${CX}" y="${CY + 10}" text-anchor="middle" dominant-baseline="middle"
                font-family="Playfair Display,Georgia,serif" font-size="14" font-weight="700" fill="#fff">LLMs</text>
        </g>
        ${nodeEls}
      </svg>`;

    /* Career lifecycle nodes */
    const lcSteps = [
      { label: 'Data\nEngineering', active: false },
      { label: 'Supervised\nLearning', active: false },
      { label: "Master's\nAI & Robotics", active: false },
      { label: 'Robotics\n& ML', active: false },
      { label: 'Deep\nLearning', active: false },
      { label: 'Computer\nVision', active: false },
      { label: 'NLP', active: false },
      { label: 'LLMs', active: false },
      { label: 'Multilingual /\nLow-resource NLP', active: true },
    ];

    const lcHTML = lcSteps.map((s, i) => {
      const lines = s.label.split('\n');
      const labelHtml = lines.join('<br>');
      const connector = i < lcSteps.length - 1 ? `<div class="lc-connector"></div>` : '';
      return `
        <div class="lc-node${s.active ? ' active' : ''}">
          <div class="lc-dot"></div>
          <div class="lc-label">${labelHtml}</div>
        </div>
        ${connector}`;
    }).join('');

    return `
      <section id="interest-maps" class="es-section es-section--alt">
        <div class="es-inner">
          <p class="es-eyebrow">Maps of Interest</p>
          <h2 class="es-heading">Where My Thinking Lives</h2>

          <div class="map-block">
            <div class="map-label">Bengali LLM Reasoning and Inference Routing</div>
            <p class="map-desc">
              My thesis compares direct and machine-translation inference across four LLMs
              and five datasets, then uses the observed headroom to train a prompt- and
              model-aware router.
            </p>
            <div class="nlp-map-wrap">${nlpSVG}</div>
          </div>

          <div class="map-block">
            <div class="map-label">From Data Engineering to NLP and LLM Systems</div>
            <p class="map-desc">
              My path moved from production data engineering and privacy-aware platforms
              through deep learning and edge computer vision, and now into LLM engineering,
              evaluation, and low-resource language technology.
            </p>
            <div class="lifecycle-wrap">
              <div class="lifecycle-scroll">
                <div class="lifecycle-nodes">${lcHTML}</div>
              </div>
            </div>
          </div>

        </div>
      </section>`;
  }

  /* ─── SECTION 3: Beyond Work ─── */
  function buildBeyondSection() {
    const cards = [
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        title: 'Living in Nürnberg',
        text: 'Studying and living in Nürnberg, Germany. There is something about the pace of life in European cities that I find conducive to thinking clearly.',
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
        title: 'Learning Keyboard',
        text: 'Currently learning keyboard on a Yamaha PSR-E383. Slow progress, but genuinely enjoyable — a useful reminder that not everything needs to be optimized.',
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        title: 'City Cycling',
        text: 'Exploring offbeat routes in Nürnberg on VAG RAD city bikes — places not easily reachable by public transport. Good for clearing the head.',
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
        title: 'Life Philosophy',
        text: 'Learning about philosophy of science and life through conversations with my HiWi supervisor, Prof. Miklós Rédei. Epistemic humility is a good thing.',
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        title: 'Building Small Tools',
        text: 'There is a particular satisfaction in building something small that a real person finds genuinely useful — more so than large, abstract systems.',
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        title: 'European Life',
        text: 'I appreciate the European balance of work, rest, and culture — the sense that life is not only measured by productivity.',
      },
    ];

    const cardHTML = cards.map(c => `
      <div class="bw-card">
        <div class="bw-icon">${c.icon}</div>
        <div class="bw-title">${escHtml(c.title)}</div>
        <div class="bw-text">${escHtml(c.text)}</div>
      </div>`).join('');

    return `
      <section id="beyond-work" class="es-section">
        <div class="es-inner">
          <p class="es-eyebrow">Beyond Work</p>
          <h2 class="es-heading">The Other Side</h2>
          <p class="es-subtext">
            A portfolio is incomplete without some sense of the person behind it.
          </p>
          <div class="bw-grid">${cardHTML}</div>
          <div class="bw-cta" style="margin-top: 40px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;">
            <a href="/personal" class="tb-link" style="display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body); font-weight: 600; font-size: 14px; background: #ede9fe; color: #4f46e5; border: 1px solid #bae6fd; padding: 10px 20px; border-radius: 10px; text-decoration: none; transition: all 0.2s;">
              <span>Explore my personal timeline (Photos, routes, music)</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
            <a href="https://indie.sagnikdas.com" target="_blank" rel="noopener noreferrer" class="tb-link" style="display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body); font-weight: 600; font-size: 14px; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 10px; text-decoration: none; transition: all 0.2s;">
              <span>Explore my quirky indie side</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17 17 7"></path>
                <path d="M7 7h10v10"></path>
              </svg>
            </a>
          </div>
        </div>
      </section>`;
  }

  /* ─── SECTION 4: Now ─── */
  function buildNowSection() {
    const items = [
      'Learning German — currently at B1 level.',
      'Comparing direct and machine-translation inference for Bengali across four LLMs and five datasets.',
      'Analyzing translation failures behind a preliminary 27.2-point gain on Belebele.',
      'Training a prompt- and model-aware inference router using 35.6 points of oracle headroom.',
      'Building and piloting grounded learning tools for university courses.',
      'Continuing to connect production data engineering with applied AI research.',
    ];

    const listHTML = items.map(item => `
      <li class="now-item">
        <span class="now-bullet"></span>
        <span>${escHtml(item)}</span>
      </li>`).join('');

    return `
      <section id="now" class="es-section now-section">
        <div class="es-inner now-inner">
          <p class="es-eyebrow">Now</p>
          <h2 class="es-heading">What I Am Working On</h2>
          <p class="now-intro">
            Right now, I am completing my M.Sc. thesis on machine-translation inference for
            Bengali NLP, developing an inference router, supporting applied-AI teaching tools at
            UTN, and continuing to learn German at B1 level.
          </p>
          <ul class="now-list">${listHTML}</ul>
          <div style="margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px;">
            <a href="/blog/" class="tb-link" style="text-decoration: none;">
              ${externalIcon} Read the blog
            </a>
            <a href="/personal" class="tb-link" style="text-decoration: none; background: #ffffff; color: #4f46e5; border: 1px solid #bae6fd;">
              Personal archive
            </a>
          </div>
          <p class="now-note">Last updated: September 2026</p>
        </div>
      </section>`;
  }

  /* ─── HTML escaping ─── */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─── Inject sections before #contact ─── */
  function inject(data) {
    const contact = document.getElementById('contact');
    if (!contact) return;

    const wrap = document.createElement('div');
    wrap.id = 'extra-sections-root';
    wrap.innerHTML =
      buildThingsSection(data.things_built || []) +
      buildMapsSection() +
      buildNowSection();

    contact.parentNode.insertBefore(wrap, contact);
  }

  /* ─── Dynamic Footer Link Observer ─── */
  function watchForFooter() {
    const observer = new MutationObserver((mutations) => {
      const footerEl = document.querySelector('footer');
      if (footerEl) {
        const mailLink = footerEl.querySelector('a[href^="mailto:"]');
        if (mailLink) {
          const parent = mailLink.parentElement;
          if (parent && !parent.querySelector('.personal-link')) {
            const separator = document.createTextNode(' · ');
            const link = document.createElement('a');
            link.className = 'personal-link';
            link.href = '/personal';
            link.textContent = 'Personal';
            link.style.color = '#4f46e5';
            link.style.textDecoration = 'none';
            link.style.fontWeight = '500';
            link.style.transition = 'color 0.2s';
            
            link.onmouseover = () => link.style.textDecoration = 'underline';
            link.onmouseout = () => link.style.textDecoration = 'none';

            mailLink.parentNode.insertBefore(separator, mailLink.nextSibling);
            mailLink.parentNode.insertBefore(link, separator.nextSibling);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function syncBlogLinks() {
    document.querySelectorAll('a[href="https://blogs.sagnikdas.com"]').forEach(link => {
      link.href = '/blog';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    });
  }

  /* ─── Scroll-driven experience timeline ─── */
  function enhanceExperienceTimeline() {
    const section = document.getElementById('experience');
    if (!section || section.dataset.timelineEnhanced === 'true') return;

    const entriesWrap = section.querySelector('.space-y-12');
    const timeline = entriesWrap && entriesWrap.parentElement;
    if (!timeline) return;

    section.dataset.timelineEnhanced = 'true';
    section.classList.add('experience-timeline');
    timeline.classList.add('experience-timeline__canvas');

    const baseTrack = Array.from(timeline.children).find(el => el !== entriesWrap);
    if (baseTrack) baseTrack.classList.add('experience-timeline__track');

    const progress = document.createElement('div');
    progress.className = 'experience-timeline__progress';
    progress.setAttribute('aria-hidden', 'true');
    timeline.insertBefore(progress, entriesWrap);

    const entries = Array.from(entriesWrap.children);
    entries.forEach((entry, index) => {
      entry.classList.add('experience-timeline__entry');
      entry.style.setProperty('--timeline-index', index);

      const marker = entry.querySelector('.absolute');
      if (marker) marker.classList.add('experience-timeline__marker');
    });

    const revealObserver = new IntersectionObserver((observed) => {
      observed.forEach(item => {
        if (item.isIntersecting) {
          item.target.classList.add('is-visible');
          revealObserver.unobserve(item.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    entries.forEach(entry => revealObserver.observe(entry));

    let ticking = false;
    const updateProgress = () => {
      const rect = timeline.getBoundingClientRect();
      const cursor = window.innerHeight * 0.55;
      const amount = Math.max(0, Math.min(1, (cursor - rect.top) / rect.height));
      progress.style.transform = `scaleY(${amount})`;
      section.style.setProperty('--timeline-progress', amount.toFixed(3));
      ticking = false;
    };
    const requestProgressUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate, { passive: true });
  }

  /* ─── Reveal injected sections without competing with React animations ─── */
  function enhanceExtraSections() {
    const items = document.querySelectorAll(
      '#extra-sections-root .es-eyebrow, #extra-sections-root .es-heading, ' +
      '#extra-sections-root .es-subtext, #extra-sections-root .tb-card, ' +
      '#extra-sections-root .map-block, ' +
      '#extra-sections-root .now-intro, #extra-sections-root .now-item'
    );

    const observer = new IntersectionObserver((observed) => {
      observed.forEach(item => {
        if (item.isIntersecting) {
          item.target.classList.add('is-visible');
          observer.unobserve(item.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    items.forEach((item, index) => {
      item.classList.add('es-reveal');
      item.style.setProperty('--reveal-delay', `${Math.min(index % 6, 4) * 55}ms`);
      observer.observe(item);
    });
  }

  /* ─── Bootstrap: load data then inject ─── */
  function init() {
    watchForFooter();
    syncBlogLinks();

    fetch('./data.json')
      .then(r => r.json())
      .then(data => {
        window._extraSectionsData = data;
        inject(data);
        syncBlogLinks();
        requestAnimationFrame(() => {
          enhanceExperienceTimeline();
          enhanceExtraSections();
        });
      })
      .catch(err => console.warn('[extra-sections] Could not load data.json', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
