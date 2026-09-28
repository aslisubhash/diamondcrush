// Interface icons: hand-drawn SVG paths filled with a shared gold leaf
// gradient (defined once in index.html as #gild). No emoji or font glyphs,
// so every platform shows the same crisp, royal set.

const P = {
  gear: '<path fill-rule="evenodd" d="M10.3 1.8h3.4l.5 2.6a8 8 0 0 1 2 .8l2.2-1.5 2.4 2.4-1.5 2.2a8 8 0 0 1 .8 2l2.6.5v3.4l-2.6.5a8 8 0 0 1-.8 2l1.5 2.2-2.4 2.4-2.2-1.5a8 8 0 0 1-2 .8l-.5 2.6h-3.4l-.5-2.6a8 8 0 0 1-2-.8l-2.2 1.5-2.4-2.4 1.5-2.2a8 8 0 0 1-.8-2l-2.6-.5v-3.4l2.6-.5a8 8 0 0 1 .8-2L3.7 6.3l2.4-2.4 2.2 1.5a8 8 0 0 1 2-.8zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/>',
  lantern: '<path d="M10 1.5h4v1.6h-4z"/><path d="M8.5 3.6h7l1.2 2.6H7.3z"/><path fill-rule="evenodd" d="M7 7h10v10.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zm2.2 1.8v8.6h5.6V8.8z"/><path d="M12 10.2c1.4 1.6 1.9 2.7 1.9 3.8a1.9 1.9 0 0 1-3.8 0c0-1.1.5-2.2 1.9-3.8z" opacity=".9"/><path d="M8 20.2h8l.8 2.3H7.2z"/>',
  pause: '<rect x="5.5" y="4" width="4.6" height="16" rx="1.2"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.2"/>',
  rewind: '<path d="M12 3.5a8.5 8.5 0 1 1-8.1 11.1l2.3-.8A6.1 6.1 0 1 0 7.7 7.7L10 10H3V3l2.9 2.9A8.4 8.4 0 0 1 12 3.5z"/>',
  lock: '<path fill-rule="evenodd" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 22H6a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 6 10zm2.4 0h5.2V7.5a2.6 2.6 0 0 0-5.2 0zM12 13.2a1.7 1.7 0 0 0-.9 3.1V19h1.8v-2.7a1.7 1.7 0 0 0-.9-3.1z"/>',
  crown: '<path d="M2.5 8.5l4.6 3.8L12 4l4.9 8.3 4.6-3.8-1.8 10H4.3z"/><rect x="4.2" y="19.3" width="15.6" height="2.4" rx=".6"/><circle cx="2.6" cy="7.6" r="1.4"/><circle cx="21.4" cy="7.6" r="1.4"/><circle cx="12" cy="3" r="1.5"/>',
  star: '<path d="M12 1.8l2.9 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.3 5.7 21l1.6-7.1L1.9 9.1l7.2-.7z"/>',
  skull: '<path fill-rule="evenodd" d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 2.8 1.3 4.8 3.2 6v3.2A1.3 1.3 0 0 0 8 21h8a1.3 1.3 0 0 0 1.3-1.3v-3.2c1.9-1.2 3.2-3.2 3.2-6A8.5 8.5 0 0 0 12 2zM8.6 9.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zm6.8 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM12 14.2l-1.3 2.3h2.6z"/>',
  heart: '<path d="M12 21.3S2.5 15.4 2.5 8.7A4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 9.5 2.3c0 6.7-9.5 12.6-9.5 12.6z"/>',
  up: '<path d="M12 5.5l8 9.5h-5v4h-6v-4H4z"/>',
  down: '<path d="M12 18.5L4 9h5V5h6v4h5z"/>',
  left: '<path d="M5.5 12L15 4v5h4v6h-4v5z"/>',
  right: '<path d="M18.5 12L9 20v-5H5V9h4V4z"/>',
  swap: '<path d="M16.5 2.5l5 4.5-5 4.5V8.4H4V5.6h12.5zM7.5 12.5v3.1H20v2.8H7.5v3.1l-5-4.5z"/>',
  cycle: '<path d="M12 4a8 8 0 0 1 7.4 5h-2.6A5.6 5.6 0 0 0 7 8.9L9 11H3V5l2.3 2.3A8 8 0 0 1 12 4zM4.6 15h2.6a5.6 5.6 0 0 0 9.8.1L15 13h6v6l-2.3-2.3A8 8 0 0 1 4.6 15z"/>',
  scroll: '<path fill-rule="evenodd" d="M6 3h12.5a2.5 2.5 0 0 1 0 5H18v10.5A2.5 2.5 0 0 1 15.5 21H5.5a2.5 2.5 0 0 1 0-5H6zm2.2 2v11h7.3v2.5a.3.3 0 0 0 .3.3.3.3 0 0 0 .3-.3V5zm1.6 2.6h5v1.6h-5zm0 3.2h5v1.6h-5z"/>',
  eye: '<path fill-rule="evenodd" d="M12 5c5.2 0 8.8 4.4 10 7-1.2 2.6-4.8 7-10 7S3.2 14.6 2 12c1.2-2.6 4.8-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>',
  hand: '<path d="M8 11V4.8a1.4 1.4 0 0 1 2.8 0V10h.4V3.4a1.4 1.4 0 0 1 2.8 0V10h.4V4.6a1.4 1.4 0 0 1 2.8 0V11h.3V7.6a1.4 1.4 0 0 1 2.8 0V14c0 4.4-3 7.5-7.2 7.5-3.3 0-5-1.6-6.8-4.4l-2.4-3.8a1.5 1.5 0 0 1 2.4-1.8z"/>',
  close: '<path d="M5.6 3.8L12 10.2l6.4-6.4 1.8 1.8-6.4 6.4 6.4 6.4-1.8 1.8-6.4-6.4-6.4 6.4-1.8-1.8 6.4-6.4-6.4-6.4z"/>',
  question: '<path d="M12 2.5a6 6 0 0 1 6 6c0 2.6-1.7 3.7-3 4.6-.9.6-1.5 1-1.5 1.9v1h-3v-1.2c0-2.1 1.4-3.1 2.5-3.8 1-.7 1.8-1.2 1.8-2.5a2.8 2.8 0 0 0-5.6 0H6a6 6 0 0 1 6-6z"/><circle cx="12" cy="19.6" r="1.9"/>',
  infinity: '<path d="M7 8a4 4 0 1 0 0 8c1.9 0 3.2-1.3 5-3.3 1.8 2 3.1 3.3 5 3.3a4 4 0 1 0 0-8c-1.9 0-3.2 1.3-5 3.3C10.2 9.3 8.9 8 7 8zm0 2.3c1 0 1.9.8 3.4 1.7-1.5 1-2.4 1.7-3.4 1.7a1.7 1.7 0 0 1 0-3.4zm10 0a1.7 1.7 0 0 1 0 3.4c-1 0-1.9-.8-3.4-1.7 1.5-1 2.4-1.7 3.4-1.7z"/>',
  play: '<path d="M7 3.8l13 8.2-13 8.2z"/>',
  map: '<path d="M3 5.5l5.5-2 7 2.3 5.5-2v15l-5.5 2-7-2.3-5.5 2zM9.5 6v12.3l5 1.7V7.7z"/>',
};

// An inline SVG icon. `fill` defaults to the gold leaf gradient.
export function icon(name, { cls = '', fill = 'url(#gild)', title = '' } = {}) {
  const body = P[name] || '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="${title ? 'false' : 'true'}"${title ? ` role="img" aria-label="${title}"` : ''}>${body}</svg>`;
}

export const ICONS = Object.keys(P);
