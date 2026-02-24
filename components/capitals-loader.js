// components/capitals-loader.js
// Charge capitals.json, normalise les noms, gère les doublons et peuple l'app.
// — Ne change pas la ville par défaut (Geneva).
// — S'appuie sur les structures déjà utilisées par ui-menus.js : CITY_LIST, TIMEZONE_MAP, SORTED
// — Enregistre les coords carte via registerCityCoords(label, lon, lat)
// — Donne un debug minimal via window.capitalsDebug

(function () {
  // --- Petites gardes-fous si les globals n'existent pas encore
  window.CITY_LIST       = window.CITY_LIST       || [];
  window.TIMEZONE_MAP    = window.TIMEZONE_MAP    || {};
  window.SORTED          = window.SORTED          || [];
  window.__CAPITAL_NAME_SET = window.__CAPITAL_NAME_SET || new Set(); // optionnel (si tu veux styliser les capitales)

  const SOURCES = ["capitals.json", "/capitals.json"]; // selon ton hosting
  const nameCount = new Map();   // baseName -> count (pour désambiguïsation)
  const seenLabel = new Set();   // labels déjà ajoutés (évite les doublons exacts)
  const dupBuckets = new Map();  // baseName -> [{name, cc}]
  const addedLabels = [];        // pour debug/compteurs
  let totalRaw = 0;

  // --- Normalisation des noms
  function stripAccents(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function normalizeName(raw){
    if (!raw) return "";
    let s = String(raw);
    s = stripAccents(s);
    s = s.replace(/[’`]/g, "'");   // apostrophes typographiques -> simple
    s = s.replace(/[.,]/g, "");    // retrait points/virgules
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  function makeLabel(baseName, cc){
    const n = (nameCount.get(baseName) || 0) + 1;
    nameCount.set(baseName, n);
    if (n === 1) return baseName;
    // homonyme : suffixer avec le code pays si dispo
    return cc ? `${baseName} (${cc})` : `${baseName} (*)`;
  }

  function addEntry(e){
    totalRaw++;
    if (!e || !e.name || !isFinite(e.lon) || !isFinite(e.lat)) return;

    const baseName = normalizeName(e.name);
    if (!baseName) return;

    // Bucket pour debug des homonymes
    const b = dupBuckets.get(baseName) || [];
    b.push({ name: e.name, cc: e.cc || "" });
    dupBuckets.set(baseName, b);

    const label = makeLabel(baseName, e.cc ? String(e.cc).toUpperCase() : "");
    if (seenLabel.has(label)) return; // évite redondance label exact (y c. si json répète)
    seenLabel.add(label);

    const tz = e.tz || "UTC";

    // 1) Carte
    if (typeof window.registerCityCoords === "function") {
      window.registerCityCoords(label, e.lon, e.lat);
    } else {
      // garde-fou minimal si la carte n'est pas encore prête
      window.CITY_COORDS = window.CITY_COORDS || {};
      window.CITY_COORDS[label] = [e.lon, e.lat];
    }

    // 2) Structures du menu (utilisées par ui-menus.js)
    if (!window.CITY_LIST.some(c => c.name === label)) {
      window.CITY_LIST.push({ name: label, cc: e.cc || "" });
    }
    window.TIMEZONE_MAP[label] = tz;
    window.__CAPITAL_NAME_SET.add(label); // si tu veux styliser, sinon sans effet

    addedLabels.push(label);
  }

  function finalizeAndRefresh(){
    // Re-trier
    window.SORTED = window.CITY_LIST.slice().sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));

    // Rafraîchir les listes si menu ouvert
    try{
      const tzMenuEl   = document.getElementById('tzMenu');
      const diffMenuEl = document.getElementById('diffMenu');

      if (tzMenuEl && tzMenuEl.classList.contains('show') && typeof window.populateTzList === 'function') {
        const q = document.getElementById('tzSearch')?.value || "";
        window.populateTzList(q);
      }
      if (diffMenuEl && diffMenuEl.classList.contains('show') && typeof window.populateDiffList === 'function') {
        const q = document.getElementById('diffSearch')?.value || "";
        window.populateDiffList(q);
      }
    }catch(e){/* no-op */}
  }

  async function fetchJsonWithFallback(){
    for (const url of SOURCES){
      try{
        const r = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now());
        if (r.ok) return await r.json();
      }catch(e){ /* try next */ }
    }
    return null;
  }

  async function loadCapitals(){
    const data = await fetchJsonWithFallback();
    if (!data){
      console.warn("[capitals-loader] capitals.json introuvable.");
      exposeDebug();
      return;
    }

    // data peut être array direct ou object-by-country
    if (Array.isArray(data)){
      data.forEach(addEntry);
    } else if (data && typeof data === "object"){
      Object.values(data).forEach(entry=>{
        if (Array.isArray(entry)) entry.forEach(addEntry);
        else addEntry(entry);
      });
    }

    finalizeAndRefresh();
    console.log(`[capitals-loader] bruts: ${totalRaw}, ajoutés: ${addedLabels.length}, uniques (labels): ${seenLabel.size}`);
    exposeDebug();
  }

  // --- Debug public
  function exposeDebug(){
    const duplicates = [];
    for (const [base, arr] of dupBuckets.entries()){
      if (arr.length > 1) duplicates.push({ base, variants: arr });
    }
    window.capitalsDebug = {
      totalRaw,
      totalAdded: addedLabels.length,
      uniqueLabels: seenLabel.size,
      duplicates, // [{base, variants:[{name,cc},...]}]
      has(name){ return !!window.TIMEZONE_MAP[name]; },
      stats(){
        return {
          totalRaw,
          totalAdded: addedLabels.length,
          uniqueLabels: seenLabel.size,
          sample: addedLabels.slice(0, 20)
        };
      },
      listMissing(names){
        // utilitaire : passe un tableau de noms que tu t’attends à voir
        const missing = [];
        for (const n of names){
          const norm = normalizeName(n);
          if (!window.TIMEZONE_MAP[n] && !window.TIMEZONE_MAP[norm]) missing.push(n);
        }
        return missing;
      }
    };
  }

  // --- Démarrage quand tout est prêt (DOM + modules)
  function start(){
    // Attendre que map-d3/ui-menus aient posé leurs fonctions/globals
    const depsReady =
      typeof window.registerCityCoords === 'function' &&
      Array.isArray(window.CITY_LIST) &&
      typeof window.TIMEZONE_MAP === 'object';

    if (!depsReady) return void setTimeout(start, 50);
    loadCapitals();
  }

  if (document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(start, 0);
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
