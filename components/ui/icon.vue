<template>
  <span v-if="markup" class="pw-icon" :class="'pw-icon-' + name" aria-hidden="true" v-html="markup" />
  <i v-else class="material-icons" aria-hidden="true">{{ name }}</i>
</template>

<script>
// A small custom line-icon set. Paths are drawn on a 24x24 grid; the default
// stroke style comes from the wrapper SVG.
const ICONS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  remove: '<path d="M5 12h14"/>',
  done: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  "chevron-up": '<path d="M6 15l6-6 6 6"/>',
  "chevron-right": '<path d="M9 6l6 6-6 6"/>',
  "chevron-left": '<path d="M15 6l-6 6 6 6"/>',
  "arrow-right": '<path d="M4 12h16M14 6l6 6-6 6"/>',
  "arrow-left": '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  "arrow-up": '<path d="M12 20V4M6 10l6-6 6 6"/>',
  "arrow-down": '<path d="M12 4v16M6 14l6 6 6-6"/>',
  "expand-more": '<path d="M6 9l6 6 6-6"/>',
  "expand-less": '<path d="M6 15l6-6 6 6"/>',
  "arrow-drop-down": '<path d="M6 9l6 6 6-6"/>',
  "arrow-right-small": '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  settings:
    '<path d="M4 7h8M16 7h4M4 17h4M12 17h8"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  send: '<path d="M4 11.5 20 4l-7.5 16-2.2-6.3L4 11.5Z"/><path d="M10.3 13.7 20 4"/>',
  delete: '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  "file-copy":
    '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  file: '<path d="M6 3h7l5 5v13H6V3Z"/><path d="M13 3v5h5"/>',
  "insert-drive-file": '<path d="M6 3h7l5 5v13H6V3Z"/><path d="M13 3v5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  "folder-open":
    '<path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/><path d="M3 9h18l-2 10H5L3 9Z"/>',
  "create-new-folder":
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 11v5M9.5 13.5h5"/>',
  "folder-special":
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 10l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5L11 12l1-2Z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  "cloud-upload": '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 8.5"/><path d="M12 12v7M9 15l3-3 3 3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  "cloud-download": '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 8.5"/><path d="M12 12v7M9 16l3 3 3-3"/>',
  "get-app": '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  key: '<circle cx="8" cy="12" r="3"/><path d="M11 12h9M17 12v3M14.5 12v2"/>',
  "vpn-key": '<circle cx="8" cy="12" r="3"/><path d="M11 12h9M17 12v3M14.5 12v2"/>',
  sync: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 9A7 7 0 0 1 18 7l2 5M17.5 15A7 7 0 0 1 6 17l-2-5"/>',
  "sync-disabled":
    '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 9A7 7 0 0 1 16 7"/><path d="M17.5 15A7 7 0 0 1 8 17"/><path d="M4 4l16 16"/>',
  share: '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 11l8-4M8 13l8 4"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  create: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 0-2 2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 1 2 2V5Z"/>',
  books: '<path d="M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 0-2 2V5Z"/><path d="M14 5a2 2 0 0 1 2-2h4v18h-4a2 2 0 0 0-2 2V5Z"/>',
  "book-open": '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v18H5.5A2.5 2.5 0 0 0 3 23V5.5Z"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v18h5.5A2.5 2.5 0 0 1 21 23V5.5Z"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.2 8.7 12S9.8 5.9 12 3.5Z"/>',
  language:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.2 8.7 12S9.8 5.9 12 3.5Z"/>',
  public:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.2 8.7 12S9.8 5.9 12 3.5Z"/>',
  translate:
    '<path d="M4 5h9M8.5 3v2M6 5c.6 2.8 2.8 5 6 6"/><path d="M11 16l3.5-8 3.5 8M12.2 14h4.6"/><path d="M4 19h10"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>',
  toc: '<path d="M8 6h12M8 12h8M8 18h10"/><path d="M4 6h1.5M4 12h1.5M4 18h1.5"/>',
  notes: '<path d="M6 3h12v18H6V3Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9 3h6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  timeline: '<path d="M4 18l5-6 4 3 7-9"/><path d="M4 20h16"/>',
  sort: '<path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"/>',
  "sort-by-alpha": '<path d="M4 6h10M4 12h7M4 18h10"/><path d="M17 8V4l3 4h-3M17 16v4l3-4h-3"/>',
  visibility: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  play: '<path d="M8 5l11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
  "play-arrow": '<path d="M8 5l11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/>',
  "offline-bolt": '<path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v4"/>',
  "settings-input-hdmi": '<path d="M4 9h16v5H4V9Z"/><path d="M7 14v3M11 14v3M15 14v3M18 9V6H6v3"/>',
  input: '<path d="M4 12h12M12 8l4 4-4 4"/><path d="M19 5v14"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  "open-in-new": '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.3a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
  warning: '<path d="M12 4 21 20H3L12 4Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  "x-circle": '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/>',
  favorite: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h12"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  extension: '<path d="M9 4a2 2 0 0 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 0 0-4 0v1H6a1 1 0 0 1-1-1v-3H4a2 2 0 0 1 0-4h1V6a1 1 0 0 1 1-1h3V4Z"/>',
  extensions: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  "plus-square": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  "library-add": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  "post-add": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  payment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h3"/>',
  "credit-card": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h3"/>',
  sparkles: '<path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/><path d="M5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14Z"/>',
  "photo-filter": '<path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/><path d="M5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14Z"/>',
  restore: '<path d="M4 10a8 8 0 1 1 2 7"/><path d="M4 5v5h5"/>',
  save: '<path d="M5 3h11l3 3v15H5V3Z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  donut: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  "donut-large": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  "import-export": '<path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4"/>',
  "local-parking": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  clear_all: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  clear: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  "help-circle": '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.3a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  "graphql":
    '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9L12 3Z"/><circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none"/><circle cx="19.8" cy="7.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="19.8" cy="16.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="21" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.2" cy="16.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.2" cy="7.5" r="1.2" fill="currentColor" stroke="none"/><path d="M12 4.2v15.6M5.2 8.3l13.6 7.4M18.8 8.3 5.2 15.7"/>',
  realtime: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  "settings-input-antenna": '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  protocols: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M6.8 7.2 10 10M17.2 7.2 14 10M6.8 16.8 10 14M17.2 16.8 14 14"/>',
  network: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M6.8 7.2 10 10M17.2 7.2 14 10M6.8 16.8 10 14M17.2 16.8 14 14"/>',
  dns: '<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h4M12 17h4"/>',
  swap_horiz: '<path d="M4 9h15M15 5l4 4-4 4M20 15H5M9 11l-4 4 4 4"/>',
  swap_horiz2: '<path d="M4 9h15M15 5l4 4-4 4M20 15H5M9 11l-4 4 4 4"/>',
  call_split: '<path d="M6 4v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v5"/><path d="M4 18l2 2 2-2M16 4l2-2 2 2M18 2v5"/>',
  developer_board: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  language_group: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.2 8.7 12S9.8 5.9 12 3.5Z"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3"/>',
  terminal2: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  star: '<path d="M12 3.5l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8L12 3.5Z"/>',
  "star-border": '<path d="M12 3.5l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8L12 3.5Z"/>',
  "playlist-add": '<path d="M4 6h11M4 11h8M4 16h8"/><path d="M17 13v6M14 16h6"/>',
  "playlist-add-check": '<path d="M4 6h11M4 11h8M4 16h5"/><path d="M14 16l2 2 4-4"/>',
  "unfold-more": '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  "unfold-less": '<path d="M8 8l4 4 4-4M8 16l4-4 4 4"/>',
  "first-page": '<path d="M7 5v14M18 6l-6 6 6 6"/>',
  "last-page": '<path d="M17 5v14M6 6l6 6-6 6"/>',
  "visibility-off": '<path d="M3 3l18 18"/><path d="M10.6 10.7A2.5 2.5 0 0 0 13.3 13.4"/><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.9M6.2 6.2C3.8 7.9 2.5 11 2.5 11s3.5 6 9.5 6c1 0 1.9-.2 2.8-.5"/>',
  "watch-later": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  style: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  http: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.2 8.7 12S9.8 5.9 12 3.5Z"/>',
  "attach-file": '<path d="M20 11.5l-7.8 7.8a4.2 4.2 0 0 1-6-6l8-8a2.8 2.8 0 0 1 4 4l-8 8a1.4 1.4 0 0 1-2-2l7.3-7.3"/>',
  "donut-large": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"/>',
  github:
    '<path fill="currentColor" stroke="none" d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.1 1.16a10.7 10.7 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.56.23 2.71.11 3 .72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/>',
}

function svgMarkup(rawName) {
  const name = String(rawName || "").replace(/_/g, "-")
  const inner = ICONS[name]
  if (!inner) return null
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}

export default {
  name: "PwIcon",
  props: {
    name: { type: String, default: "" },
  },
  computed: {
    markup() {
      return svgMarkup(this.name)
    },
  },
}
</script>
