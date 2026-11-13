// Applies the saved theme before first paint (kept out of index.html for the CSP).
try {
  var t = localStorage.getItem('tactic.theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
