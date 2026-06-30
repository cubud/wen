// Shared internal helpers for the ƿen editor.
// Imported by the view classes; not part of the public API surface.

import DOMPurify from 'https://esm.sh/dompurify@3.1.6';

// Escape a string for safe interpolation into HTML text or double-quoted attributes.
// This is baseline correctness (a stray `"` or `<` in a value must not break the DOM)
// and is applied regardless of `unsafe` mode.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sanitize a rich-HTML fragment (e.g. marked output) before it is injected via innerHTML.
// Only called on the safe-mode render paths; `unsafe: true` bypasses this entirely.
export function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty);
}
