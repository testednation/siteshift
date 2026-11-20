/**
 * Minimal CSS Reset document generator for visualizing WordPress Gutenberg
 * structure (page, section group, or individual block) with zero theme bloat.
 */

const MINIMAL_WP_CSS_RESET = `
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  padding: 28px 32px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #111827;
  background: #ffffff;
}

main.wp-site-blocks {
  max-width: 760px;
  margin: 0 auto;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0 0 0.55em;
  line-height: 1.25;
  font-weight: 600;
  color: #0f172a;
}

h1 { font-size: 1.875rem; }
h2 { font-size: 1.375rem; }
h3 { font-size: 1.125rem; }

p {
  margin: 0 0 1rem;
  color: #334155;
}

ul, ol {
  margin: 0 0 1rem;
  padding-left: 1.35rem;
  color: #334155;
}

li + li {
  margin-top: 0.3rem;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

figure {
  margin: 0 0 1.25rem;
}

figcaption {
  margin-top: 0.45rem;
  font-size: 12px;
  color: #64748b;
}

a {
  color: #1d4ed8;
  text-decoration: underline;
}

.wp-block-group {
  padding: 20px 0;
  border-bottom: 1px solid #e2e8f0;
}

.wp-block-group:last-child {
  border-bottom: none;
}

.wp-block-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 1rem;
}

.wp-block-button__link {
  display: inline-block;
  padding: 8px 16px;
  background: #0f172a;
  color: #ffffff;
  text-decoration: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

form {
  display: grid;
  gap: 12px;
  max-width: 480px;
}

label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  text-transform: capitalize;
}

input, textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font: inherit;
  color: #0f172a;
  background: #ffffff;
}

button[type="submit"] {
  justify-self: start;
  padding: 8px 16px;
  border: 1px solid #0f172a;
  background: #0f172a;
  color: #ffffff;
  border-radius: 4px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
`;

const WP_BLOCK_OUTLINE_CSS = `
[data-wp-block] {
  position: relative;
  outline: 1px dashed #cbd5e1;
  outline-offset: 4px;
  padding: 18px 12px 10px;
  margin-bottom: 18px;
  border-radius: 3px;
}

section[data-wp-block] {
  outline: 1px solid #93c5fd;
  outline-offset: 0;
  background: #f8fafc;
  padding: 28px 18px 14px;
  margin-bottom: 24px;
  border-bottom: none;
}

[data-wp-block]::before {
  content: attr(data-wp-block);
  position: absolute;
  top: 0;
  left: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  color: #475569;
  background: #e2e8f0;
  border-bottom-right-radius: 3px;
  pointer-events: none;
}

section[data-wp-block]::before {
  color: #1e40af;
  background: #dbeafe;
}
`;

export function buildWpInstantPreviewDoc(options: {
  title: string;
  bodyHtml: string;
  showBlockOutlines: boolean;
}): string {
  const safeTitle = options.title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
${MINIMAL_WP_CSS_RESET}
${options.showBlockOutlines ? WP_BLOCK_OUTLINE_CSS : ''}
  </style>
</head>
<body>
  <main class="wp-site-blocks">
${options.bodyHtml}
  </main>
</body>
</html>`;
}
