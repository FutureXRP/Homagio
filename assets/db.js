// assets.db.js (repo root)
// Back-compat shim for older pages that referenced /assets.db.js
// Upgrade: auto-load /assets/core.js + /assets/db.js if missing.

(function () {
  function loadOnce(src) {
    return new Promise((resolve, reject) => {
      // already present?
      const already = Array.from(document.scripts).some((s) => (s.src || "").includes(src));
      if (already) return resolve(true);

      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function ensure() {
    try {
      if (!window.HomagioCore) {
        await loadOnce("/assets/core.js");
      }
    } catch (e) {
      console.warn("HomagioCore not loaded (non-fatal)", e);
    }

    try {
      if (!window.HomagioDB) {
        await loadOnce("/assets/db.js");
      }
    } catch (e) {
      console.warn("HomagioDB not loaded. Make sure /assets/db.js exists and is reachable.", e);
    }
  }

  // If the DOM isn't ready yet, still safe to inject into <head>.
  ensure();
})();
