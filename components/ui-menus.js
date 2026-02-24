// components/ui-menus.js — CLEAN menus (no capitals, empty lists by default)

(function () {
  const $ = (id) => document.getElementById(id);

  // Elements (town menu)
  const tzBtn    = $('tzBtn');
  const tzMenu   = $('tzMenu');
  const tzList   = $('tzList');
  const tzSearch = $('tzSearch');
  const cityEl   = $('city');

  // Elements (time difference)
  const diffBtn    = $('diffBtn');
  const diffMenu   = $('diffMenu');
  const diffList   = $('diffList');
  const diffSearch = $('diffSearch');
  const diffOutput = $('diffOutput');

  // Drapeaux globaux utilisés par la carte/animation
  if (typeof window.__skipNextCityMutation === 'undefined') window.__skipNextCityMutation = false;
  if (typeof window.__isAnimatingMarker   === 'undefined') window.__isAnimatingMarker   = false;

  // Données locales du menu (VIDE par défaut)
  // Chaque entrée: { name, tz, cc? }
  window.__CITY_MENU = window.__CITY_MENU || [];
  const CITY_MENU = window.__CITY_MENU;

  // Mapping nom -> timezone (uniquement pour ce que vous ajoutez vous-même)
  window.__CITY_TZ = window.__CITY_TZ || {};

  /**
   * API publique pour ajouter une ville dans les menus.
   * - name: string
   * - tz:   string IANA (ex: "Asia/Baku")
   * - lon/lat: coordonnées (optionnelles mais utiles pour la carte)
   * - cc: code pays optionnel (affichage)
   */
  window.addCityToMenu = function(name, tz, lon, lat, cc){
    if (!name || !tz) return;
    if (!CITY_MENU.some(c => c.name === name)) {
      CITY_MENU.push({ name, tz, cc: cc || '' });
    }
    window.__CITY_TZ[name] = tz;
    if (typeof lon === 'number' && typeof lat === 'number' && typeof window.registerCityCoords === 'function') {
      window.registerCityCoords(name, lon, lat);
    }
    // Rafraîchit les listes si un menu est ouvert
    try {
      if (tzMenu && tzMenu.classList.contains('show')) populateTzList(tzSearch ? tzSearch.value : '');
      if (diffMenu && diffMenu.classList.contains('show')) populateDiffList(diffSearch ? diffSearch.value : '');
    } catch {}
  };

  /* ---------------- Town menu ---------------- */

  function populateTzList(filterText=""){
    if (!tzList) return;
    tzList.innerHTML = "";
    const f = filterText.trim().toLowerCase();
    const filtered = CITY_MENU
      .slice()
      .sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}))
      .filter(({name}) => name.toLowerCase().includes(f));

    filtered.forEach(({name, cc})=>{
      const li = document.createElement('div');
      li.className = 'tz-item';
      li.setAttribute('role','option');
      li.setAttribute('tabindex','0');

      const label = document.createElement('span');
      label.textContent = name;

      const ccSpan = document.createElement('span');
      ccSpan.className = 'tz-cc';
      ccSpan.textContent = cc ? `(${cc})` : '';

      li.appendChild(label);
      li.appendChild(ccSpan);

      li.addEventListener('click', ()=>{
        const tz = window.__CITY_TZ[name] || 'Europe/Zurich';
        window.__skipNextCityMutation = true;
        if (cityEl) cityEl.textContent = name;
        window.currentTZ = tz;
        if (typeof window.saveTZState === 'function') window.saveTZState(name, tz);
        if (typeof window.updateCalendarTZ === 'function') window.updateCalendarTZ();
        if (typeof window.updateClockTZ === 'function') window.updateClockTZ();
        if (typeof window.resetDiff === 'function') window.resetDiff();

        if (tzMenu){ tzMenu.classList.remove('show'); if (tzBtn) tzBtn.setAttribute('aria-expanded','false'); }
        if (typeof window.queueFunAnimation === 'function'){ window.queueFunAnimation(500); }
        if (typeof window.animateMarkerTo === 'function'){ setTimeout(()=>window.animateMarkerTo(name, 1200), 500); }
      });

      li.addEventListener('keydown', e=>{
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      });

      tzList.appendChild(li);
    });
  }

  function attachSearchHandlerTz(){
    if (!tzSearch) return;
    tzSearch.value = "";
    tzSearch.addEventListener('input', ()=>populateTzList(tzSearch.value));
    setTimeout(()=>tzSearch.focus(), 0);
  }

  function toggleTzMenu(){
    if (!tzMenu || !tzBtn) return;
    const isOpen = tzMenu.classList.toggle('show');
    tzBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen){ populateTzList(); attachSearchHandlerTz(); }
  }

  if (tzBtn) {
    tzBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleTzMenu(); });
  }
  document.addEventListener('click', (e)=>{
    if (tzMenu && tzMenu.classList.contains('show')) {
      const inside = tzMenu.contains(e.target) || (tzBtn && tzBtn.contains(e.target));
      if (!inside) { tzMenu.classList.remove('show'); if (tzBtn) tzBtn.setAttribute('aria-expanded','false'); }
    }
  });
  document.addEventListener('keydown', (e)=>{
    if (!tzMenu || !tzMenu.classList.contains('show') || !tzList) return;
    const items = [...tzList.querySelectorAll('.tz-item')];
    if (!items.length) return;
    const active = document.activeElement;
    let idx = items.indexOf(active);
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      (items[Math.min(idx+1, items.length-1)] || items[0]).focus();
    } else if (e.key === 'ArrowUp'){
      e.preventDefault();
      (items[Math.max(idx-1, 0)] || items[0]).focus();
    }
  });

  /* --------------- Time Difference --------------- */

  let diffSelection = null; // { name, tz }

  function getTZOffsetMinutes(tz){
    try{
      const now = new Date();
      const tzDate  = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      return Math.round((tzDate - utcDate) / 60000);
    }catch{ return 0; }
  }
  function formatOffset(mins){
    const sign = mins >= 0 ? '+' : '-';
    const a = Math.abs(mins);
    const h = Math.floor(a/60);
    const m = a % 60;
    return m===0 ? `${sign}${h}` : `${sign}${h}:${String(m).padStart(2,'0')}`;
  }
  function computeDiffLabel(targetTZ){
    const cur = getTZOffsetMinutes(window.currentTZ || 'Europe/Zurich');
    const tgt = getTZOffsetMinutes(targetTZ);
    return formatOffset(tgt - cur);
  }

  function populateDiffList(filterText=""){
    if (!diffList) return;
    diffList.innerHTML = "";
    const f = filterText.trim().toLowerCase();
    const filtered = CITY_MENU
      .slice()
      .sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}))
      .filter(({name}) => name.toLowerCase().includes(f));

    filtered.forEach(({name, cc})=>{
      const li = document.createElement('div');
      li.className = 'diff-item';
      li.setAttribute('role','option');
      li.setAttribute('tabindex','0');

      const label = document.createElement('span');
      label.textContent = name;

      const ccSpan = document.createElement('span');
      ccSpan.className = 'diff-cc';
      ccSpan.textContent = cc ? `(${cc})` : '';

      li.appendChild(label);
      li.appendChild(ccSpan);

      li.addEventListener('click', ()=>{
        const tz = window.__CITY_TZ[name] || 'Europe/Zurich';
        diffSelection = { name, tz };
        if (diffMenu) diffMenu.classList.remove('show');
        if (diffBtn)  diffBtn.style.display = 'none';
        if (diffOutput) diffOutput.textContent = ` ${name}: ${computeDiffLabel(tz)}`;
        if (typeof window.updateCompare === 'function') window.updateCompare(name);
      });

      li.addEventListener('keydown', e=>{
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      });

      diffList.appendChild(li);
    });
  }

  function attachSearchHandlerDiff(){
    if (!diffSearch) return;
    diffSearch.value = "";
    diffSearch.addEventListener('input', ()=>populateDiffList(diffSearch.value));
    setTimeout(()=>diffSearch.focus(), 0);
  }

  function toggleDiffMenu(){
    if (!diffMenu || !diffBtn) return;
    const isOpen = diffMenu.classList.toggle('show');
    diffBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen){ populateDiffList(); attachSearchHandlerDiff(); }
  }

  if (diffBtn) diffBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleDiffMenu(); });
  document.addEventListener('click', (e)=>{
    if (diffMenu && diffMenu.classList.contains('show')) {
      const inside = diffMenu.contains(e.target) || (diffBtn && diffBtn.contains(e.target));
      if (!inside) { diffMenu.classList.remove('show'); if (diffBtn) diffBtn.setAttribute('aria-expanded','false'); }
    }
  });

  // Reset (exposé pour event-handlers.js)
  function resetDiff(){
    diffSelection = null;
    if (diffOutput) diffOutput.textContent = '';
    if (diffBtn) { diffBtn.style.display = 'inline-block'; diffBtn.setAttribute('aria-expanded','false'); }
    if (diffMenu) diffMenu.classList.remove('show');
    if (typeof window.updateCompare === 'function') window.updateCompare(null);
  }
  window.resetDiff = resetDiff;

  // Recalcul périodique (DST)
  setInterval(()=>{
    if (diffSelection && diffOutput){
      diffOutput.textContent = ` ${diffSelection.name}: ${computeDiffLabel(diffSelection.tz)}`;
    }
  }, 60*1000);
})();
