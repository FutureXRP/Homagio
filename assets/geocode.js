// assets/geocode.js
// SAFE to copy/paste as a whole.
// Uses OpenStreetMap Nominatim to geocode an address into { lat, lng, formatted }.
// Note: For production scale, use your own proxy or a paid geocoder.

(function () {
  "use strict";

  async function geocodeAddress(addressText) {
    const q = (addressText || "").trim();
    if (!q) return null;

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(q);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Language": "en",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;

    const best = data[0];
    const lat = Number(best.lat);
    const lng = Number(best.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      formatted: best.display_name || q,
    };
  }

  window.HomagioGeo = { geocodeAddress };
})();
