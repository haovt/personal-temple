// Browser storage. The temple keeps nothing between visits: every page load starts
// fresh, so the only job left here is to clear whatever an earlier version stored.
// Guarded, because private windows or blocked storage must never break the page.

export const storage = {
  /** Remove everything this site stored in the browser. */
  clearAll() {
    try { localStorage.clear(); } catch { /* storage unavailable */ }
  },
};
