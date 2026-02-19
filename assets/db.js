// assets/db.js
// Homagio localStorage DB (MVP). Later swap to Firebase without changing UI calls.
// SAFE to copy/paste as a whole.

(function () {
  const KEY = "homagio.db.v1";

  function uid(prefix = "id") {
    return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("DB read failed", e);
      return null;
    }
  }

  function write(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function ensure() {
    let db = read();
    if (!db) {
      db = {
        version: 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        houses: [],
        materials: [], // global library (optional)
        settings: { demoSeeded: false }
      };
      write(db);
    }
    if (!db.houses) db.houses = [];
    if (!db.materials) db.materials = [];
    if (!db.settings) db.settings = {};
    return db;
  }

  function save(db) {
    db.updatedAt = nowISO();
    write(db);
  }

  // ----------------------------
  // Houses
  // ----------------------------
  function listHouses() {
    const db = ensure();
    return [...db.houses].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  function getHouse(id) {
    const db = ensure();
    return db.houses.find((h) => h.id === id) || null;
  }

  function upsertHouse(house) {
    const db = ensure();
    const existingIdx = db.houses.findIndex((h) => h.id === house.id);
    const next = {
      id: house.id || uid("house"),
      name: house.name || "Untitled House",
      style: house.style || "",
      tier: house.tier || "Free",
      address: house.address || "",
      lat: typeof house.lat === "number" ? house.lat : null,
      lng: typeof house.lng === "number" ? house.lng : null,
      budgetTotal: typeof house.budgetTotal === "number" ? house.budgetTotal : 0,
      budgetSpent: typeof house.budgetSpent === "number" ? house.budgetSpent : 0,
      photos: Array.isArray(house.photos) ? house.photos : [],
      items: Array.isArray(house.items) ? house.items : [],
      createdAt: house.createdAt || nowISO(),
      updatedAt: nowISO()
    };

    if (existingIdx >= 0) db.houses[existingIdx] = next;
    else db.houses.push(next);

    save(db);
    return next;
  }

  function deleteHouse(id) {
    const db = ensure();
    db.houses = db.houses.filter((h) => h.id !== id);
    save(db);
  }

  // ----------------------------
  // Photos & Items
  // ----------------------------
  function addPhoto(houseId, photo) {
    const house = getHouse(houseId);
    if (!house) return null;

    const p = {
      id: uid("photo"),
      section: photo.section || "interior", // interior | exterior
      url: photo.url || "",
      caption: photo.caption || "",
      createdAt: nowISO()
    };

    house.photos = [...(house.photos || []), p];
    upsertHouse(house);
    return p;
  }

  function updatePhoto(houseId, photoId, patch) {
    const house = getHouse(houseId);
    if (!house) return null;

    house.photos = (house.photos || []).map((p) =>
      p.id === photoId ? { ...p, ...patch } : p
    );
    upsertHouse(house);
    return house.photos.find((p) => p.id === photoId) || null;
  }

  function deletePhoto(houseId, photoId) {
    const house = getHouse(houseId);
    if (!house) return false;

    house.photos = (house.photos || []).filter((p) => p.id !== photoId);
    // Also detach items linked to this photo (keep them, just unlink)
    house.items = (house.items || []).map((it) =>
      it.photoId === photoId ? { ...it, photoId: null } : it
    );
    upsertHouse(house);
    return true;
  }

  function addItem(houseId, item) {
    const house = getHouse(houseId);
    if (!house) return null;

    const it = {
      id: uid("item"),
      photoId: item.photoId || null,
      title: item.title || "Item",
      category: item.category || "",
      brand: item.brand || "",
      finish: item.finish || "",
      link: item.link || "",
      price: typeof item.price === "number" ? item.price : 0,
      notes: item.notes || "",
      createdAt: nowISO()
    };

    house.items = [...(house.items || []), it];
    upsertHouse(house);
    return it;
  }

  function updateItem(houseId, itemId, patch) {
    const house = getHouse(houseId);
    if (!house) return null;

    house.items = (house.items || []).map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    upsertHouse(house);
    return house.items.find((it) => it.id === itemId) || null;
  }

  function deleteItem(houseId, itemId) {
    const house = getHouse(houseId);
    if (!house) return false;

    house.items = (house.items || []).filter((it) => it.id !== itemId);
    upsertHouse(house);
    return true;
  }

  // ----------------------------
  // Demo seeding
  // ----------------------------
  function seedDemoNear(lat, lng, force = false) {
    const db = ensure();
    if (db.settings.demoSeeded && !force) return;

    const base = {
      budgetTotal: 25000,
      budgetSpent: 6400,
      style: "Modern",
      tier: "Premium"
    };

    const demos = [
      {
        ...base,
        name: "Demo — Maple House",
        address: "Maple St (Demo)",
        lat: lat + 0.012,
        lng: lng - 0.008
      },
      {
        ...base,
        name: "Demo — Oak Cottage",
        address: "Oak Ave (Demo)",
        lat: lat - 0.009,
        lng: lng + 0.011,
        style: "Farmhouse"
      },
      {
        ...base,
        name: "Demo — Midtown Renovation",
        address: "Midtown (Demo)",
        lat: lat + 0.004,
        lng: lng + 0.004,
        style: "Transitional",
        tier: "Free",
        budgetTotal: 12000,
        budgetSpent: 2800
      }
    ];

    demos.forEach((h) => {
      const created = upsertHouse({
        ...h,
        photos: [
          {
            id: uid("photo"),
            section: "interior",
            url: "https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=1200&q=70",
            caption: "Living room (demo)",
            createdAt: nowISO()
          },
          {
            id: uid("photo"),
            section: "exterior",
            url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=70",
            caption: "Exterior (demo)",
            createdAt: nowISO()
          }
        ],
        items: []
      });

      // Add a couple items linked to first photo
      const firstPhoto = created.photos?.[0]?.id || null;
      addItem(created.id, {
        photoId: firstPhoto,
        title: "Paint — Simply White",
        category: "Paint",
        brand: "Benjamin Moore",
        finish: "Eggshell",
        link: "https://www.benjaminmoore.com/",
        price: 62,
        notes: "Walls — main floor"
      });
      addItem(created.id, {
        photoId: firstPhoto,
        title: "Flooring — White Oak",
        category: "Flooring",
        brand: "Demo Brand",
        finish: "Matte",
        link: "https://www.homedepot.com/",
        price: 6.49,
        notes: "Per sq ft (demo)"
      });
    });

    db.settings.demoSeeded = true;
    save(db);
  }

  // ----------------------------
  // Expose
  // ----------------------------
  window.HomagioDB = {
    _key: KEY,
    uid,

    ensure,
    listHouses,
    getHouse,
    upsertHouse,
    deleteHouse,

    addPhoto,
    updatePhoto,
    deletePhoto,

    addItem,
    updateItem,
    deleteItem,

    seedDemoNear
  };
})();
