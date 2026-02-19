// assets.db.js
// Compatibility shim: older pages referenced /assets.db.js
// Keep this file at repo root so nothing breaks.
(function () {
  // If assets/db.js is loaded first, HomagioDB is already available.
  // If this loads first, do nothing.
  if (window.HomagioDB) return;
  console.warn("HomagioDB not found yet. Make sure pages include /assets/db.js before using DB calls.");
})();
