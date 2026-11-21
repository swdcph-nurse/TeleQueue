/**
 * icons.js - Modern SVG Icon Library for TeleQueue (Zero Emoji, Clean Minimal Design)
 */

const Icons = {
  // SVG Icons Helper
  svg: function(path, className = "w-4 h-4", viewBox = "0 0 24 24") {
    return `<svg class="${className}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  },

  dashboard: function(c = "w-5 h-5") {
    return this.svg('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>', c);
  },

  today: function(c = "w-5 h-5") {
    return this.svg('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/>', c);
  },

  calendar: function(c = "w-5 h-5") {
    return this.svg('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>', c);
  },

  manage: function(c = "w-5 h-5") {
    return this.svg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>', c);
  },

  bell: function(c = "w-4 h-4") {
    return this.svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', c);
  },

  plus: function(c = "w-4 h-4") {
    return this.svg('<path d="M5 12h14"/><path d="M12 5v14"/>', c);
  },

  settings: function(c = "w-4 h-4") {
    return this.svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', c);
  },

  user: function(c = "w-4 h-4") {
    return this.svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', c);
  },

  phone: function(c = "w-4 h-4") {
    return this.svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', c);
  },

  check: function(c = "w-4 h-4") {
    return this.svg('<path d="M20 6 9 17l-5-5"/>', c);
  },

  checkCircle: function(c = "w-5 h-5") {
    return this.svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', c);
  },

  clock: function(c = "w-4 h-4") {
    return this.svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', c);
  },

  alertTriangle: function(c = "w-5 h-5") {
    return this.svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>', c);
  },

  search: function(c = "w-4 h-4") {
    return this.svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', c);
  },

  edit: function(c = "w-4 h-4") {
    return this.svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', c);
  },

  trash: function(c = "w-4 h-4") {
    return this.svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', c);
  },

  eye: function(c = "w-4 h-4") {
    return this.svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', c);
  },

  printer: function(c = "w-4 h-4") {
    return this.svg('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>', c);
  },

  refresh: function(c = "w-4 h-4") {
    return this.svg('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>', c);
  },

  close: function(c = "w-4 h-4") {
    return this.svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', c);
  },

  external: function(c = "w-4 h-4") {
    return this.svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>', c);
  },

  message: function(c = "w-4 h-4") {
    return this.svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', c);
  },

  copy: function(c = "w-4 h-4") {
    return this.svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', c);
  },

  stethoscope: function(c = "w-4 h-4") {
    return this.svg('<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>', c);
  },

  activity: function(c = "w-5 h-5") {
    return this.svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', c);
  },

  hospital: function(c = "w-6 h-6") {
    return this.svg('<path d="M12 6v4"/><path d="M10 8h4"/><path d="M18 20V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/><path d="M2 20h20"/><path d="M14 12v.01"/><path d="M10 12v.01"/><path d="M14 16v.01"/><path d="M10 16v.01"/>', c);
  },

  chevronLeft: function(c = "w-4 h-4") {
    return this.svg('<path d="m15 18-6-6 6-6"/>', c);
  },

  chevronRight: function(c = "w-4 h-4") {
    return this.svg('<path d="m9 18 6-6-6-6"/>', c);
  },

  users: function(c = "w-5 h-5") {
    return this.svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', c);
  },

  fileText: function(c = "w-4 h-4") {
    return this.svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>', c);
  },

  shield: function(c = "w-4 h-4") {
    return this.svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>', c);
  },

  send: function(c = "w-4 h-4") {
    return this.svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', c);
  }
};

window.Icons = Icons;
