/**
 * PressPort Lightweight Offline Runtime
 * Replaces heavy proprietary Wix Thunderbolt / Santa and Strikingly JS runtimes
 * with a clean, dependency-free vanilla JavaScript controller (< 4 KB).
 */
export const PRESSPORT_LOCAL_RUNTIME_JS = `/* PressPort Offline Local Runtime — Zero External Dependencies */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    // 1. Mobile Navigation Drawer Toggle
    var navToggle = document.querySelector('[data-pp-nav-toggle]');
    var navMenu = document.querySelector('[data-pp-nav-menu]');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', function () {
        var expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        navMenu.classList.toggle('pp-nav-open');
      });
    }

    // 2. Smooth Anchor Scrolling (replaces Wix/Strikingly scroll-router JS)
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') return;
        var target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (navMenu && navMenu.classList.contains('pp-nav-open')) {
            navMenu.classList.remove('pp-nav-open');
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
    });

    // 3. Local Accordion & FAQ Controls
    document.querySelectorAll('[data-pp-accordion-trigger]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panelId = btn.getAttribute('aria-controls');
        var panel = panelId ? document.getElementById(panelId) : btn.nextElementSibling;
        if (!panel) return;
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        panel.hidden = isOpen;
      });
    });

    // 4. Lightweight Local Image Lightbox (replaces Wix Pro Gallery / Strikingly Media JS)
    var lightbox = null;
    function openLightbox(src, alt) {
      if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.className = 'pp-lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.innerHTML =
          '<button type="button" class="pp-lightbox-close" aria-label="Close preview">&times;</button>' +
          '<img class="pp-lightbox-img" alt="" />' +
          '<p class="pp-lightbox-caption"></p>';
        lightbox.addEventListener('click', function (e) {
          if (e.target === lightbox || e.target.classList.contains('pp-lightbox-close')) {
            lightbox.classList.remove('is-visible');
          }
        });
        document.body.appendChild(lightbox);
      }
      var img = lightbox.querySelector('.pp-lightbox-img');
      var cap = lightbox.querySelector('.pp-lightbox-caption');
      img.src = src;
      img.alt = alt || '';
      cap.textContent = alt || '';
      lightbox.classList.add('is-visible');
    }

    document.querySelectorAll('.pp-gallery img, [data-pp-lightbox]').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        openLightbox(img.currentSrc || img.src, img.alt);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-visible')) {
        lightbox.classList.remove('is-visible');
      }
    });

    // 5. Offline-Resilient Contact Form Handler (compatible with WP admin-ajax or static mode)
    document.querySelectorAll('form[data-pp-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        var action = form.getAttribute('action') || '';
        if (!action || action === '#') {
          e.preventDefault();
          var feedback = form.querySelector('.pp-form-feedback');
          if (!feedback) {
            feedback = document.createElement('p');
            feedback.className = 'pp-form-feedback';
            form.appendChild(feedback);
          }
          feedback.textContent =
            'Form validated locally. Connect your WordPress form endpoint (WPForms / Contact Form 7) to receive live submissions.';
          form.reset();
        }
      });
    });
  });
})();
`;

export const PRESSPORT_BASE_CSS = `/* PressPort Migrated Local Stylesheet — 100% Offline & Self-Contained */
:root {
  --pp-bg: #ffffff;
  --pp-surface: #f8fafc;
  --pp-ink: #0f172a;
  --pp-muted: #475569;
  --pp-border: #e2e8f0;
  --pp-accent: #1d4ed8;
  --pp-accent-ink: #ffffff;
  --pp-radius: 8px;
  --pp-max-width: 1120px;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.65;
  color: var(--pp-ink);
  background: var(--pp-bg);
  -webkit-font-smoothing: antialiased;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: var(--pp-radius);
}

a {
  color: var(--pp-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.pp-container {
  width: 100%;
  max-width: var(--pp-max-width);
  margin: 0 auto;
  padding: 0 24px;
}

.pp-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--pp-border);
  backdrop-filter: blur(8px);
}

.pp-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 68px;
}

.pp-brand {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--pp-ink);
  letter-spacing: -0.02em;
}

.pp-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.pp-nav a {
  color: var(--pp-muted);
  font-size: 0.925rem;
  font-weight: 500;
}

.pp-nav a:hover {
  color: var(--pp-ink);
  text-decoration: none;
}

.pp-nav-toggle {
  display: none;
  border: 1px solid var(--pp-border);
  background: var(--pp-bg);
  color: var(--pp-ink);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.pp-section {
  padding: 64px 0;
  border-bottom: 1px solid var(--pp-border);
}

.pp-section:nth-of-type(even) {
  background: var(--pp-surface);
}

.pp-section h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.15;
  letter-spacing: -0.025em;
  margin: 0 0 16px;
}

.pp-section h2 {
  font-size: clamp(1.5rem, 2.5vw, 2.1rem);
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
}

.pp-section h3 {
  font-size: 1.2rem;
  margin: 0 0 8px;
}

.pp-section p {
  margin: 0 0 16px;
  color: var(--pp-muted);
  max-width: 68ch;
}

.pp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  background: var(--pp-accent);
  color: var(--pp-accent-ink);
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.925rem;
  border: none;
  cursor: pointer;
}

.pp-btn:hover {
  opacity: 0.92;
  text-decoration: none;
}

.pp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  margin-top: 28px;
}

.pp-card {
  background: var(--pp-bg);
  border: 1px solid var(--pp-border);
  border-radius: var(--pp-radius);
  padding: 24px;
}

.pp-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.pp-form {
  max-width: 540px;
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.pp-form input,
.pp-form textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--pp-border);
  border-radius: 6px;
  font: inherit;
  background: var(--pp-bg);
}

.pp-form-feedback {
  font-size: 0.875rem;
  color: #15803d;
  font-weight: 500;
}

.pp-footer {
  padding: 40px 0;
  font-size: 0.875rem;
  color: var(--pp-muted);
  background: var(--pp-bg);
}

.pp-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.88);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}

.pp-lightbox.is-visible {
  display: flex;
}

.pp-lightbox-img {
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 6px;
}

.pp-lightbox-caption {
  color: #e2e8f0;
  margin-top: 12px;
  font-size: 0.9rem;
}

.pp-lightbox-close {
  position: absolute;
  top: 20px;
  right: 24px;
  background: none;
  border: none;
  color: #ffffff;
  font-size: 2rem;
  cursor: pointer;
}

@media (max-width: 768px) {
  .pp-nav-toggle {
    display: inline-flex;
  }
  .pp-nav {
    display: none;
    position: absolute;
    top: 68px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: flex-start;
    background: var(--pp-bg);
    border-bottom: 1px solid var(--pp-border);
    padding: 16px 24px;
    gap: 12px;
  }
  .pp-nav.pp-nav-open {
    display: flex;
  }
}
`;
