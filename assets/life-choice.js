(function () {
  'use strict';

  const dialogMarkup = `
    <div class="life-choice" aria-hidden="true">
      <div class="life-choice__backdrop" data-life-choice-close></div>
      <section class="life-choice__dialog" role="dialog" aria-modal="true" aria-labelledby="life-choice-title" aria-describedby="life-choice-description" tabindex="-1">
        <button class="life-choice__close" type="button" data-life-choice-close aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <span class="life-choice__eyebrow">Beyond the résumé</span>
        <h2 id="life-choice-title">Which side would you like to explore?</h2>
        <p id="life-choice-description">Choose a path into the parts of my life and work that do not fit on a traditional portfolio.</p>
        <div class="life-choice__options">
          <a class="life-choice__option life-choice__option--personal" href="/personal">
            <span class="life-choice__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="9" cy="10" r="2"/><path d="m5 17 4-4 3 3 2-2 5 4"/></svg>
            </span>
            <span class="life-choice__copy">
              <strong>Personal Life</strong>
              <small>Photos, places, music, routes, and moments outside work.</small>
              <span class="life-choice__action">Open personal timeline <b aria-hidden="true">→</b></span>
            </span>
          </a>
          <a class="life-choice__option life-choice__option--indie" href="https://indie.sagnikdas.com" target="_blank" rel="noopener noreferrer">
            <span class="life-choice__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m13 2-2 7H4l6 4-2 8 5-6 6 4-3-8 5-4h-7z"/></svg>
            </span>
            <span class="life-choice__copy">
              <strong>Indie Side</strong>
              <small>Quirky experiments, small tools, and things built for fun.</small>
              <span class="life-choice__action">Explore indie projects <b aria-hidden="true">↗</b></span>
            </span>
          </a>
        </div>
      </section>
    </div>`;

  let modal;
  let dialog;
  let previousFocus;
  let previousOverflow = '';

  function openDialog() {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => dialog.focus());
  }

  function closeDialog() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow;
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  function handleKeyboard(event) {
    if (!modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled])'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function init() {
    document.body.insertAdjacentHTML('beforeend', dialogMarkup);
    modal = document.querySelector('.life-choice');
    dialog = modal.querySelector('.life-choice__dialog');

    modal.querySelectorAll('[data-life-choice-close]').forEach((button) => {
      button.addEventListener('click', closeDialog);
    });
    document.addEventListener('keydown', handleKeyboard);

    // React owns the hero button, so capture its click before its old scroll handler runs.
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('button, a');
      if (!trigger || trigger.textContent.trim().toLowerCase() !== 'know me better') return;
      event.preventDefault();
      event.stopPropagation();
      openDialog();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
