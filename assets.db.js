// assets/db.js
// Homagio localStorage DB (MVP -> Full local app). Later swap to Firebase without changing UI calls.
// SAFE to copy/paste as a whole.

(function () {
  "use strict";

  // ---------------------------
  // Storage keys
  // ---------------------------
  const KEY_DB = "homagio.db.v1";
  const KEY_SETTINGS = "homagio.settings.v1";

  // ---------------------------
  // Utils
  // ---------------------------
  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "id") {
    return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ---------------------------
  // DB read/write
  // ---------------------------
  function readDbRaw() {
    try {
      return localStorage.getItem(KEY_DB);
    } catch (e) {
      console.warn("DB read failed (localStorage blocked?)", e);
      return null;
    }
  }

  function writeDb(db) {
    try {
      localStorage.setItem(KEY_DB, JSON.stringify(db));
    } catch (e) {
      console.warn("DB write failed (quota/blocked?)", e);
    }
  }

  // ---------------------------
  // Settings read/write (non-critical)
  // ---------------------------
  function readSettings() {
    try {
      const raw = localStorage.getItem(KEY_SETTINGS);
      const s = raw ? safeJsonParse(raw) : null;
      return s && typeof s === "object" ? s : { appearance: "system" };
    } catch {
      return { appearance: "system" };
    }
  }

  function writeSettings(s) {
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
    } catch {
      // ignore
    }
  }

  // ---------------------------
  // DB defaults + migrations
  // ---------------------------
  function defaultDb() {
    const demoUserId = "demo-owner";
    return {
      version: 1,
      users: {
        [demoUserId]: { id: demoUserId, name: "Demo User", created: nowIso() },
      },
      session: {
        userId: demoUserId,
        currentHouseId: null,
      },
      houses: {},

      // favorites[userId][houseId] = true
      favorites: {},

      // shopping[userId][houseId] = { items: {rowId: row}, updated }
      shopping: {},
    };
  }

  function normalizeHouse(h) {
    if (!h || typeof h !== "object") return null;

    if (!h.id) h.id = uid("house");
    if (!h.ownerId) h.ownerId = "demo-owner";
    if (!h.updated) h.updated = nowIso();
    if (!h.items) h.items = {};
    if (!h.photos) h.photos = [];
    if (!h.budget) h.budget = { total: 0, spent: 0 };

    // NEW: Address support (primary field), lat/lng optional
    // address: { raw, formatted, line1, city, state, zip, country }
    if (!h.address || typeof h.address !== "object") {
      h.address = {
        raw: "",
        formatted: "",
        line1: "",
        city: "",
        state: "",
        zip: "",
        country: "",
      };
    } else {
      h.address.raw = typeof h.address.raw === "string" ? h.address.raw : "";
      h.address.formatted = typeof h.address.formatted === "string" ? h.address.formatted : "";
      h.address.line1 = typeof h.address.line1 === "string" ? h.address.line1 : "";
      h.address.city = typeof h.address.city === "string" ? h.address.city : "";
      h.address.state = typeof h.address.state === "string" ? h.address.state : "";
      h.address.zip = typeof h.address.zip === "string" ? h.address.zip : "";
      h.address.country = typeof h.address.country === "string" ? h.address.country : "";
    }

    // Keep lat/lng optional (Explore map can still use them when present)
    if (h.lat !== undefined && h.lat !== null) h.lat = Number(h.lat);
    if (h.lng !== undefined && h.lng !== null) h.lng = Number(h.lng);
    if (Number.isNaN(h.lat)) h.lat = null;
    if (Number.isNaN(h.lng)) h.lng = null;

    // Ensure photo shape
    for (const p of h.photos) {
      if (!p.id) p.id = uid("ph");
      if (!p.tab) p.tab = "interior";
      if (!p.label) p.label = "Photo";
      if (typeof p.src !== "string") p.src = "";
      if (!Array.isArray(p.linkedItemIds)) p.linkedItemIds = [];
    }

    // Ensure item shape
    if (h.items && typeof h.items === "object") {
      for (const [id, it] of Object.entries(h.items)) {
        if (!it || typeof it !== "object") continue;
        if (!it.id) it.id = id;
      }
    }

    return h;
  }

  function migrate(db) {
    if (!db || typeof db !== "object") return defaultDb();

    if (!db.version) db.version = 1;
    if (!db.users || typeof db.users !== "object") db.users = {};
    if (!db.session || typeof db.session !== "object") db.session = {};
    if (!db.houses || typeof db.houses !== "object") db.houses = {};
    if (!db.favorites || typeof db.favorites !== "object") db.favorites = {};
    if (!db.shopping || typeof db.shopping !== "object") db.shopping = {};

    const demoUserId = "demo-owner";
    if (!db.users[demoUserId]) db.users[demoUserId] = { id: demoUserId, name: "Demo User", created: nowIso() };

    if (!db.session.userId) db.session.userId = demoUserId;
    if (db.session.currentHouseId === undefined) db.session.currentHouseId = null;

    for (const h of Object.values(db.houses)) normalizeHouse(h);

    const current = db.session.currentHouseId;
    if (current && !db.houses[current]) db.session.currentHouseId = null;
    if (!db.session.currentHouseId) {
      const list = Object.values(db.houses);
      if (list.length) {
        list.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
        db.session.currentHouseId = list[0].id;
      }
    }

    return db;
  }

  function ensureDb() {
    const raw = readDbRaw();
    let db = raw ? safeJsonParse(raw) : null;
    if (!db) db = defaultDb();
    db = migrate(db);
    writeDb(db);
    return db;
  }

  // ---------------------------
  // Demo seed helpers
  // ---------------------------
  function seedDemoHouses({ lat, lng }) {
    const base = [
      { name: "The Birchwood", style: "Modern", tier: "Premium" },
      { name: "Maple Ridge", style: "Classic", tier: "Free" },
      { name: "Cedar Lane", style: "Farmhouse", tier: "Premium" },
      { name: "Stonecrest", style: "Contemporary", tier: "Free" },
      { name: "Willow Point", style: "Modern", tier: "Premium" },
      { name: "Parkview", style: "Traditional", tier: "Free" },
      { name: "Lakeside", style: "Transitional", tier: "Premium" },
      { name: "The Oaks", style: "Rustic", tier: "Free" },
    ];

    const offsets = [
      [0.010, 0.006],
      [0.004, 0.012],
      [-0.008, 0.010],
      [-0.012, -0.002],
      [-0.006, -0.012],
      [0.006, -0.010],
      [0.012, 0.0],
      [0.0, 0.014],
    ];

    const demo0 = {
      id: "demo-0",
      ownerId: "demo-owner",
      name: "The Birchwood",
      style: "Modern",
      tier: "Premium",
      lat: lat + offsets[0][0],
      lng: lng + offsets[0][1],
      address: { raw: "Demo area", formatted: "Demo area (near you)" },
      updated: nowIso(),
      budget: { total: 48000, spent: 19400 },
      items: {
        "it-101": { id: "it-101", name: "Roofing", category: "Exterior • Roofing", colorPattern: "Charcoal", brand: "Berridge", styleFinish: "Standing Seam", purchaseUrl: "https://example.com/roofing" },
        "it-102": { id: "it-102", name: "Interior Paint", category: "Interior • Paint", colorPattern: "Warm White", brand: "Sherwin-Williams", styleFinish: "Eggshell", purchaseUrl: "https://example.com/paint" },
        "it-103": { id: "it-103", name: "Flooring", category: "Interior • Flooring", colorPattern: "Natural Oak", brand: "CoreTec", styleFinish: "Wide Plank", purchaseUrl: "https://example.com/flooring" },
        "it-104": { id: "it-104", name: "Kitchen Faucet", category: "Interior • Fixtures", colorPattern: "Matte Black", brand: "Delta", styleFinish: "Single Handle", purchaseUrl: "https://example.com/faucet" },
        "it-105": { id: "it-105", name: "Pendant Light", category: "Interior • Lighting", colorPattern: "Black + Brass", brand: "West Elm", styleFinish: "Modern Dome", purchaseUrl: "https://example.com/pendant" },
        "it-106": { id: "it-106", name: "Front Door", category: "Exterior • Entry", colorPattern: "Deep Navy", brand: "Therma-Tru", styleFinish: "Modern Panel", purchaseUrl: "https://example.com/door" },
      },
      photos: [
        { id: "ph-1", tab: "interior", label: "Kitchen", src: "", linkedItemIds: ["it-104", "it-105", "it-103"] },
        { id: "ph-2", tab: "interior", label: "Living Room", src: "", linkedItemIds: ["it-102", "it-103"] },
        { id: "ph-3", tab: "interior", label: "Primary Bath", src: "", linkedItemIds: ["it-104"] },
        { id: "ph-4", tab: "interior", label: "Hallway", src: "", linkedItemIds: ["it-102"] },
        { id: "ph-5", tab: "exterior", label: "Front Elevation", src: "", linkedItemIds: ["it-101", "it-106"] },
        { id: "ph-6", tab: "exterior", label: "Roof Detail", src: "", linkedItemIds: ["it-101"] },
        { id: "ph-7", tab: "exterior", label: "Entry", src: "", linkedItemIds: ["it-106"] },
      ],
    };

    const other = base.slice(1).map((b, i) => {
      const idx = i + 1;
      return {
        id: `demo-${idx}`,
        ownerId: "demo-owner",
        name: b.name,
        style: b.style,
        tier: b.tier,
        lat: lat + offsets[idx][0],
        lng: lng + offsets[idx][1],
        address: { raw: "Demo area", formatted: "Demo area (near you)" },
        updated: nowIso(),
        budget: { total: 52000 + idx * 1000, spent: 12000 + idx * 1500 },
        items: {},
        photos: [],
      };
    });

    return [demo0, ...other];
  }

  // ---------------------------
  // Public API
  // ---------------------------
  const DB = {
    uid,

    // ---- Session / User ----
    getSession() {
      const db = ensureDb();
      return { ...(db.session || {}) };
    },

    setSession(patch) {
      const db = ensureDb();
      db.session = { ...(db.session || {}), ...(patch || {}) };
      writeDb(db);
      return { ...db.session };
    },

    getCurrentUser() {
      const db = ensureDb();
      const id = db.session?.userId || "demo-owner";
      return db.users?.[id] || { id, name: "User" };
    },

    upsertUser(user) {
      const db = ensureDb();
      db.users = db.users || {};
      const id = user?.id || uid("usr");
      db.users[id] = { ...(db.users[id] || {}), ...(user || {}), id };
      if (!db.users[id].created) db.users[id].created = nowIso();
      writeDb(db);
      return db.users[id];
    },

    getCurrentHouse() {
      const db = ensureDb();
      const hid = db.session?.currentHouseId;
      if (!hid) return null;
      return (db.houses || {})[hid] || null;
    },

    setCurrentHouse(houseId) {
      const db = ensureDb();
      db.session = db.session || {};
      db.session.currentHouseId = houseId || null;
      writeDb(db);
      return db.session.currentHouseId;
    },

    // ---- Houses ----
    getAllHouses() {
      const db = ensureDb();
      return Object.values(db.houses || {});
    },

    getHouse(id) {
      const db = ensureDb();
      return (db.houses || {})[id] || null;
    },

    // NEW: Create a house using address-first fields (lat/lng optional)
    createHouse({
      name,
      style = "",
      tier = "Free",
      addressRaw = "",
      addressFormatted = "",
      lat = null,
      lng = null,
    } = {}) {
      const h = {
        id: uid("house"),
        ownerId: "demo-owner",
        name: name || "New House",
        style,
        tier,
        lat,
        lng,
        address: {
          raw: addressRaw || "",
          formatted: addressFormatted || addressRaw || "",
          line1: "",
          city: "",
          state: "",
          zip: "",
          country: "",
        },
        updated: nowIso(),
        budget: { total: 0, spent: 0 },
        items: {},
        photos: [],
      };
      return this.upsertHouse(h);
    },

    upsertHouse(house) {
      const db = ensureDb();
      db.houses = db.houses || {};
      const h = normalizeHouse({ ...(house || {}) });
      if (!h) throw new Error("Invalid house");
      h.updated = nowIso();
      db.houses[h.id] = h;

      if (!db.session?.currentHouseId) {
        db.session = db.session || {};
        db.session.currentHouseId = h.id;
      }

      writeDb(db);
      return h;
    },

    deleteHouse(id) {
      const db = ensureDb();
      if (db.houses && db.houses[id]) {
        delete db.houses[id];

        for (const [userId, map] of Object.entries(db.favorites || {})) {
          if (map && map[id]) delete map[id];
          db.favorites[userId] = map;
        }

        for (const [userId, bucket] of Object.entries(db.shopping || {})) {
          if (bucket && bucket[id]) delete bucket[id];
          db.shopping[userId] = bucket;
        }

        if (db.session?.currentHouseId === id) {
          db.session.currentHouseId = null;
          const list = Object.values(db.houses || {});
          if (list.length) {
            list.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
            db.session.currentHouseId = list[0].id;
          }
        }

        writeDb(db);
      }
    },

    seedDemoNear(lat, lng, force = false) {
      const db = ensureDb();
      const existing = Object.keys(db.houses || {});
      if (!force && existing.length) return;

      db.houses = {};
      const demo = seedDemoHouses({ lat, lng });
      for (const h of demo) {
        normalizeHouse(h);
        db.houses[h.id] = h;
      }

      db.session = db.session || {};
      db.session.currentHouseId = "demo-0";
      writeDb(db);
    },

    resetDemo(lat, lng) {
      this.seedDemoNear(lat, lng, true);
    },

    // ---- Explore helpers ----
    searchHouses({ q = "", style = "", tier = "", sort = "updated_desc" } = {}) {
      const db = ensureDb();
      let list = Object.values(db.houses || {});

      const qq = (q || "").trim().toLowerCase();
      if (qq) {
        list = list.filter((h) => {
          const name = (h.name || "").toLowerCase();
          const st = (h.style || "").toLowerCase();
          const addr = ((h.address && (h.address.formatted || h.address.raw)) || "").toLowerCase();
          return name.includes(qq) || st.includes(qq) || addr.includes(qq);
        });
      }

      if (style) list = list.filter((h) => (h.style || "") === style);
      if (tier) list = list.filter((h) => (h.tier || "") === tier);

      if (sort === "updated_desc") {
        list.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
      } else if (sort === "name_asc") {
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      }

      return list;
    },

    getHouseStyles() {
      const houses = this.getAllHouses();
      return Array.from(new Set(houses.map((h) => h.style).filter(Boolean))).sort();
    },

    getHouseTiers() {
      const houses = this.getAllHouses();
      return Array.from(new Set(houses.map((h) => h.tier).filter(Boolean))).sort();
    },

    // ---- Favorites ----
    isFavorite(userId, houseId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      return !!(db.favorites?.[uid_]?.[houseId]);
    },

    toggleFavorite(houseId, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      db.favorites = db.favorites || {};
      db.favorites[uid_] = db.favorites[uid_] || {};

      if (db.favorites[uid_][houseId]) delete db.favorites[uid_][houseId];
      else db.favorites[uid_][houseId] = true;

      writeDb(db);
      return !!db.favorites[uid_][houseId];
    },

    getFavorites(userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const map = db.favorites?.[uid_] || {};
      const ids = Object.keys(map);
      const houses = ids.map((id) => db.houses?.[id]).filter(Boolean);
      houses.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
      return houses;
    },

    // ---- Photos ----
    addPhoto(houseId, { tab, label, src }) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");
      house.photos = house.photos || [];

      const photo = {
        id: uid("ph"),
        tab: tab || "interior",
        label: label || "Photo",
        src: src || "",
        linkedItemIds: [],
      };

      house.photos.push(photo);
      house.updated = nowIso();
      this.upsertHouse(house);
      return photo;
    },

    updatePhoto(houseId, photoId, patch) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      const p = (house.photos || []).find((x) => x.id === photoId);
      if (!p) throw new Error("Photo not found");

      Object.assign(p, patch || {});
      if (!Array.isArray(p.linkedItemIds)) p.linkedItemIds = [];
      house.updated = nowIso();
      this.upsertHouse(house);
      return p;
    },

    deletePhoto(houseId, photoId) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");
      house.photos = (house.photos || []).filter((p) => p.id !== photoId);
      house.updated = nowIso();
      this.upsertHouse(house);
      return true;
    },

    // ---- Items ----
    addItem(houseId, item) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      house.items = house.items || {};
      const id = item?.id || uid("it");
      const it = { id, ...(item || {}) };
      house.items[id] = it;

      house.updated = nowIso();
      this.upsertHouse(house);
      return it;
    },

    updateItem(houseId, itemId, patch) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      house.items = house.items || {};
      if (!house.items[itemId]) throw new Error("Item not found");

      house.items[itemId] = { ...house.items[itemId], ...(patch || {}) };
      house.updated = nowIso();
      this.upsertHouse(house);
      return house.items[itemId];
    },

    deleteItem(houseId, itemId) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");
      house.items = house.items || {};
      if (house.items[itemId]) delete house.items[itemId];

      for (const p of house.photos || []) {
        p.linkedItemIds = (p.linkedItemIds || []).filter((x) => x !== itemId);
      }

      house.updated = nowIso();
      this.upsertHouse(house);
      return true;
    },

    // ---- Linking ----
    linkItem(houseId, photoId, itemId) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      const p = (house.photos || []).find((x) => x.id === photoId);
      if (!p) throw new Error("Photo not found");

      if (!house.items || !house.items[itemId]) throw new Error("Item not found");

      p.linkedItemIds = p.linkedItemIds || [];
      if (!p.linkedItemIds.includes(itemId)) p.linkedItemIds.push(itemId);

      house.updated = nowIso();
      this.upsertHouse(house);
      return true;
    },

    unlinkItem(houseId, photoId, itemId) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      const p = (house.photos || []).find((x) => x.id === photoId);
      if (!p) throw new Error("Photo not found");

      p.linkedItemIds = (p.linkedItemIds || []).filter((x) => x !== itemId);

      house.updated = nowIso();
      this.upsertHouse(house);
      return true;
    },

    // ---- Shopping List ----
    getShoppingList(houseId, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const hid = houseId || db.session?.currentHouseId;
      if (!hid) return { items: [], updated: null };

      const bucket = db.shopping?.[uid_]?.[hid];
      const items = bucket?.items ? Object.values(bucket.items) : [];
      items.sort((a, b) => (a.created || "").localeCompare(b.created || ""));
      return { items, updated: bucket?.updated || null };
    },

    addShoppingRow(houseId, row, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const hid = houseId || db.session?.currentHouseId;
      if (!hid) throw new Error("No house selected");

      db.shopping = db.shopping || {};
      db.shopping[uid_] = db.shopping[uid_] || {};
      db.shopping[uid_][hid] = db.shopping[uid_][hid] || { items: {}, updated: nowIso() };

      const id = row?.id || uid("sl");
      db.shopping[uid_][hid].items[id] = {
        id,
        name: row?.name || "Item",
        qty: row?.qty ?? 1,
        note: row?.note || "",
        linkedItemId: row?.linkedItemId || null,
        purchaseUrl: row?.purchaseUrl || "",
        created: nowIso(),
        done: !!row?.done,
      };

      db.shopping[uid_][hid].updated = nowIso();
      writeDb(db);
      return db.shopping[uid_][hid].items[id];
    },

    updateShoppingRow(houseId, rowId, patch, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const hid = houseId || db.session?.currentHouseId;
      const bucket = db.shopping?.[uid_]?.[hid];
      if (!bucket?.items?.[rowId]) throw new Error("Shopping row not found");

      bucket.items[rowId] = { ...bucket.items[rowId], ...(patch || {}) };
      bucket.updated = nowIso();
      writeDb(db);
      return bucket.items[rowId];
    },

    deleteShoppingRow(houseId, rowId, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const hid = houseId || db.session?.currentHouseId;
      const bucket = db.shopping?.[uid_]?.[hid];
      if (bucket?.items?.[rowId]) {
        delete bucket.items[rowId];
        bucket.updated = nowIso();
        writeDb(db);
      }
      return true;
    },

    generateShoppingFromLinkedItems(houseId) {
      const house = this.getHouse(houseId);
      if (!house) throw new Error("House not found");

      const linked = new Set();
      for (const p of house.photos || []) {
        for (const id of p.linkedItemIds || []) linked.add(id);
      }

      const rows = [];
      for (const itemId of linked) {
        const it = house.items?.[itemId];
        if (!it) continue;
        rows.push({
          name: it.name || "Item",
          qty: 1,
          note: it.category || "",
          linkedItemId: itemId,
          purchaseUrl: it.purchaseUrl || "",
        });
      }
      return rows;
    },

    saveGeneratedShopping(houseId, userId) {
      const db = ensureDb();
      const uid_ = userId || db.session?.userId || "demo-owner";
      const hid = houseId || db.session?.currentHouseId;
      if (!hid) throw new Error("No house selected");

      const rows = this.generateShoppingFromLinkedItems(hid);
      const bucket = this.getShoppingList(hid, uid_);

      const existingLinked = new Set((bucket.items || []).map((r) => r.linkedItemId).filter(Boolean));
      const added = [];
      for (const r of rows) {
        if (r.linkedItemId && existingLinked.has(r.linkedItemId)) continue;
        added.push(this.addShoppingRow(hid, r, uid_));
      }
      return added;
    },

    // ---- Backup / Restore ----
    exportJson() {
      const db = ensureDb();
      return JSON.stringify(db, null, 2);
    },

    importJson(json, { merge = false } = {}) {
      let incoming;
      try {
        incoming = JSON.parse(json);
      } catch {
        throw new Error("Invalid JSON");
      }

      const current = ensureDb();
      const next = merge ? migrate({ ...current, ...incoming }) : migrate(incoming);

      writeDb(next);
      return true;
    },

    // ---- Settings ----
    getSettings() {
      return readSettings();
    },

    setSettings(patch) {
      const s = { ...readSettings(), ...(patch || {}) };
      writeSettings(s);
      return s;
    },
  };

  window.HomagioDB = DB;
})();
