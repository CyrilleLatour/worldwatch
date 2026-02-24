// components/map-d3.js
// Carte D3 + terminator + marqueur ville (Geneva par défaut)
// Aucune intégration des capitales ici. Possibilité de fusionner des coords via __mergeCapitalCoordsIntoMap.

(function initMap(){
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') return;
  const svg = d3.select('#map');
  if (svg.empty()) return;

  const width = 1200, height = 600;
  const projection = d3.geoEquirectangular().rotate([-10,0]).fitExtent([[0,0],[width,height]],{type:"Sphere"});
  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();
  const g = svg.append('g');

  /* ===== Masques jour/nuit ===== */
  const defs = svg.append('defs');
  const nightMask = defs.append('mask').attr('id','nightMask');
  nightMask.append('rect').attr('width',width).attr('height',height).attr('fill','black');
  const nightMaskPath = nightMask.append('path').attr('id','nightMaskPath').attr('fill','white');

  const dayMask = defs.append('mask').attr('id','dayMask');
  dayMask.append('rect').attr('width',width).attr('height',height).attr('fill','white');
  const dayMaskBlock = dayMask.append('path').attr('id','dayMaskBlock').attr('fill','black');

  function drawFallback(){
    g.selectAll('*').remove();
    g.append('path').attr('class','sphere').attr('d', path({type:'Sphere'}));
    g.append('path').attr('class','graticule').attr('d', path(graticule));
    placeInitialMarker();
  }

  let landGeom = null, bordersMesh = null;

  // Base (sphere + graticule)
  g.append('path').attr('class','sphere').attr('d', path({type:'Sphere'}));
  g.append('path').attr('class','graticule').attr('d', path(graticule));

  // Couches "nuit" (au-dessus du fond de carte)
  const nightPath   = g.append('path').attr('class','night'); // overlay plein (océans + terres)
  const coastNight  = g.append('path').attr('class','night-only').attr('mask','url(#nightMask)');  // remplira la terre (même couleur que la nuit via overlay)
  const bordersNight= g.append('path').attr('class','night-only').attr('mask','url(#nightMask)');  // frontières blanches en zone nuit

  // Chargement du monde
  fetch('https://unpkg.com/world-atlas@2/countries-50m.json')
    .then(r=>r.json())
    .then(world=>{
      const countries = topojson.feature(world, world.objects.countries);
      const borders   = topojson.mesh(world, world.objects.countries, (a,b)=>a!==b);
      const land      = topojson.feature(world, world.objects.land);

      landGeom   = land;
      bordersMesh= borders;

      // Jour : continents blancs + frontières noires
      g.selectAll('path.land')
        .data(countries.features)
        .join('path')
        .attr('class','land')
        .attr('fill','#ffffff')
        .attr('d', path);

      g.append('path')
        .attr('class','boundary')
        .attr('d', path(borders))
        .attr('fill','none')
        .attr('stroke','#000')
        .attr('stroke-width',0.6);

      // Préparer les chemins nuit (seront masqués dynamiquement)
      if (landGeom)    coastNight.attr('d', path(landGeom));
      if (bordersMesh) bordersNight.attr('d', path(bordersMesh))
                               .attr('fill','none')
                               .attr('stroke','#ffffff')
                               .attr('stroke-width',0.9);

      // S'assurer que les traits nuit sont au-dessus
      if (typeof bordersNight.raise === 'function') bordersNight.raise();
    })
    .catch(e=>{
      console.warn('world-atlas fetch failed, using fallback:', e);
      drawFallback();
    });

  /* ===== Coordonnées & marqueur ===== */
  // Par défaut uniquement Geneva (tu peux fusionner d'autres coords via __mergeCapitalCoordsIntoMap)
  window.CITY_COORDS = window.CITY_COORDS || {};
  if (!window.CITY_COORDS.Geneva) window.CITY_COORDS.Geneva = [6.15, 46.2];

  // API pour fusionner des coordonnées depuis un autre module (optionnel)
  window.__mergeCapitalCoordsIntoMap = function(dict){
    if (!dict) return;
    for (const k in dict){ window.CITY_COORDS[k] = dict[k]; }
  };

  let currentCityLL = null;
  const marker = g.append('circle').attr('class','city-marker').attr('r',6).attr('opacity',1);

  function updateCityMarker(cityName){
    const ll = window.CITY_COORDS[cityName];
    currentCityLL = ll ? ll.slice() : [6.15,46.2];
    const [x,y] = projection(currentCityLL);
    marker.attr('cx',x).attr('cy',y).attr('opacity',1);
    if (!window.__isAnimatingMarker) setTimeout(()=>{ if (window.pulseMarker) window.pulseMarker(true); }, 20);
  }
  window.updateCityMarker = updateCityMarker;

  // Animation du marqueur (géodésique)
  window.__isAnimatingMarker = false;
  window.animateMarkerTo = function(cityName, duration=1200){
    const target = window.CITY_COORDS[cityName];
    if (!target){
      console.warn(`No coordinates found for ${cityName} animation`);
      updateCityMarker(cityName);
      if (window.updateSunTimes) window.updateSunTimes(cityName);
      updateMarkerColor(subsolar(new Date()));
      return;
    }
    if (!currentCityLL){
      updateCityMarker(cityName);
      if (window.updateSunTimes) window.updateSunTimes(cityName);
      updateMarkerColor(subsolar(new Date()));
      return;
    }

    window.__isAnimatingMarker = true;
    const dot = document.querySelector('.city-marker');
    if (dot) dot.classList.remove('pulse');

    const interp = d3.geoInterpolate(currentCityLL, target);
    const t0 = performance.now();

    function step(now){
      const u = Math.min(1, (now - t0)/duration);
      const ll = interp(u);
      const [x,y] = projection(ll);
      marker.attr('cx',x).attr('cy',y).attr('opacity',1);

      const sub = subsolar(new Date());
      const night = isNightAt(ll, sub);
      marker.attr('fill', night ? 'yellow' : 'red');

      if (u < 1){ requestAnimationFrame(step); }
      else{
        window.__isAnimatingMarker = false;
        currentCityLL = target.slice();
        if (window.updateSunTimes) window.updateSunTimes(cityName);
        if (window.pulseMarker) window.pulseMarker(true);
      }
    }
    requestAnimationFrame(step);
  };

  function placeInitialMarker(){
    const city = (document.getElementById('city')?.textContent || 'Geneva').trim();
    updateCityMarker(city);
    if (window.updateSunTimes) window.updateSunTimes(city);
    updateMarkerColor(subsolar(new Date()));
  }

  /* ===== Soleil / terminator ===== */
  const toRad = Math.PI/180;
  const ALT_CORR_DEG = 0.833;
  const ALT_CORR_RAD = ALT_CORR_DEG * toRad;

  const dayMs=86400000, rad=Math.PI/180, J1970=2440588, J2000=2451545, e=rad*23.4397, J0=0.0009;
  const toJulian=d=>d/ dayMs - 0.5 + J1970;
  const fromJulian=j=>new Date((j + 0.5 - J1970)*dayMs);
  const toDays=date=>toJulian(date.getTime()) - J2000;
  const solarMeanAnomaly=d=>rad*(357.5291+0.98560028*d);
  const eclipticLongitude=M=>{
    const C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
    const P=rad*102.9372;
    return M+C+P+Math.PI;
  };
  const declination=(L,b=0)=>Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(L));
  const rightAscension=(L,b=0)=>Math.atan2(Math.sin(L)*Math.cos(e)-Math.tan(b)*Math.sin(e), Math.cos(L));
  const hourAngle=(h,phi,d)=>Math.acos((Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d)));
  const approxTransit=(Ht,lw,n)=>J0+(Ht+lw)/(2*Math.PI)+n;
  const solarTransitJ=(ds,M,L)=>J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L);

  function getSunTimes(dateUTC, lat, lon){
    const lw = -lon*rad, phi = lat*rad;
    const d = toDays(dateUTC);
    const n = Math.round(d - J0 - lw/(2*Math.PI));
    const ds = approxTransit(0, lw, n);
    const M = solarMeanAnomaly(ds);
    const L = eclipticLongitude(M);
    const dec = declination(L, 0);
    const Jnoon = solarTransitJ(ds, M, L);
    const h0 = (-0.833) * rad;
    const w0 = hourAngle(h0, phi, dec);
    if (isNaN(w0)) return { sunrise:null, solarNoon:fromJulian(Jnoon), sunset:null };
    const Jrise = solarTransitJ(approxTransit(-w0, lw, n), M, L);
    const Jset  = solarTransitJ(approxTransit( w0, lw, n), M, L);
    return { sunrise: fromJulian(Jrise), solarNoon: fromJulian(Jnoon), sunset: fromJulian(Jset) };
  }

  const sunriseEl = document.getElementById('sunrise');
  const solarNoonEl = document.getElementById('solarNoon');
  const sunsetEl = document.getElementById('sunset');

  function updateSunTimes(cityName){
    // Dépend de window.currentTZ et getPartsForTZ définis dans watch-core.js
    if (!window.currentTZ || typeof window.getPartsForTZ !== 'function') return;
    let lon=6.15, lat=46.2;
    const ll = window.CITY_COORDS[cityName];
    if (ll){ lon = ll[0]; lat = ll[1]; }
    const {Y,Mo,D} = window.getPartsForTZ(window.currentTZ);
    const baseUTC = new Date(Date.UTC(Y,Mo-1,D,12,0,0));
    const t = getSunTimes(baseUTC, lat, lon);
    const fmt = d => d ? d.toLocaleTimeString('en-GB',{timeZone: window.currentTZ, hour:'2-digit', minute:'2-digit'}) : '—';
    if (sunriseEl) sunriseEl.textContent = fmt(t.sunrise);
    if (solarNoonEl) solarNoonEl.textContent = fmt(t.solarNoon);
    if (sunsetEl) sunsetEl.textContent = fmt(t.sunset);
  }
  window.updateSunTimes = updateSunTimes;

  function subsolar(date){
    const d = toDays(date);
    const M = solarMeanAnomaly(d);
    const L = eclipticLongitude(M);
    const dec = declination(L, 0);
    const ra  = rightAscension(L, 0);

    const JD = toJulian(date.getTime());
    const T  = (JD - 2451545.0) / 36525.0;
    let GMST = 280.46061837 + 360.98564736629*(JD-2451545.0) + 0.000387933*T*T - T*T*T/38710000.0;
    GMST = ((GMST%360)+360)%360 * Math.PI/180;

    let lon = (ra - GMST);
    lon = ((lon + Math.PI*3)%(2*Math.PI)) - Math.PI;
    const lat = dec;
    return { lon: lon*180/Math.PI, lat: lat*180/Math.PI };
  }

  function isNightAt(lonLat, sub){
    // lonLat = [lon, lat]
    const dist = d3.geoDistance(lonLat, [sub.lon, sub.lat]);
    return dist > (Math.PI/2 + ALT_CORR_RAD);
  }

  function updateMarkerColor(sub){
    if (!currentCityLL) return;
    const night = isNightAt(currentCityLL, sub);
    marker.attr('fill', night ? 'yellow' : 'red').attr('opacity',1);
  }

  /* ===== Croix de fermeture (jour/nuit via masques, couleurs pilotées par :root) ===== */
  const crossDay   = g.append('g').attr('class','close-cross-day').attr('mask','url(#dayMask)').style('pointer-events','none');
  const crossNight = g.append('g').attr('class','close-cross-night').attr('mask','url(#nightMask)').style('pointer-events','none');

  function drawCloseCross(){
    const svgNode = document.getElementById('map');
    if (!svgNode) return;
    const rect = svgNode.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // carte masquée

    const rootStyle = getComputedStyle(document.documentElement);
    const offX = parseFloat(rootStyle.getPropertyValue('--close-offset-x')) || 5;
    const offY = parseFloat(rootStyle.getPropertyValue('--close-offset-y')) || 15;
    const sizePx   = parseFloat(rootStyle.getPropertyValue('--close-size'))   || 28;
    const strokePx = parseFloat(rootStyle.getPropertyValue('--close-stroke')) || 5;
    const colorDay   = (rootStyle.getPropertyValue('--close-color-day')   || 'orange').trim();
    const colorNight = (rootStyle.getPropertyValue('--close-color-night') || 'orange').trim();

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const scale = Math.min(scaleX, scaleY);

    const cx_px = offX + sizePx/2;
    const cy_px = rect.height - offY - sizePx/2;

    const cx = cx_px / scale;
    const cy = cy_px / scale;
    const half = (sizePx/2) / scale;
    const sw = strokePx / scale;

    crossDay.selectAll('*').remove();
    crossNight.selectAll('*').remove();

    const lines = [
      { x1: cx - half, y1: cy - half, x2: cx + half, y2: cy + half },
      { x1: cx - half, y1: cy + half, x2: cx + half, y2: cy - half }
    ];

    lines.forEach(l=>{
      crossDay.append('line')
        .attr('x1', l.x1).attr('y1', l.y1).attr('x2', l.x2).attr('y2', l.y2)
        .attr('stroke', colorDay).attr('stroke-width', sw).attr('stroke-linecap','round');
      crossNight.append('line')
        .attr('x1', l.x1).attr('y1', l.y1).attr('x2', l.x2).attr('y2', l.y2)
        .attr('stroke', colorNight).attr('stroke-width', sw).attr('stroke-linecap','round');
    });
  }

  /* ===== Terminator + mise à jour ===== */
  function updateTerminator(){
    const sub = subsolar(new Date());
    const center = [sub.lon + 180, -sub.lat]; // antipode => zone nuit
    const nightCircle = d3.geoCircle().center(center).radius(90 - ALT_CORR_DEG)();

    // Overlay nuit (bleu foncé)
    nightPath.attr('d', path(nightCircle)).attr('fill','#191970').attr('fill-opacity',0.90);

    // Masques (nuit seule)
    nightMaskPath.attr('d', path(nightCircle));
    dayMaskBlock.attr('d', path(nightCircle));

    updateMarkerColor(sub);
    drawCloseCross();

    // S'assurer que le trait nuit est au-dessus
    if (typeof bordersNight.raise === 'function') bordersNight.raise();
  }

  updateTerminator();
  setInterval(updateTerminator, 60*1000);

  // Observer : quand la ville (header) change, repositionner le marqueur
  const cityNode = document.getElementById('city');
  if (cityNode){
    const observer = new MutationObserver(()=>{
      if (window.__skipNextCityMutation){ window.__skipNextCityMutation = false; return; }
      const city = cityNode.textContent.trim();
      updateCityMarker(city);
      updateMarkerColor(subsolar(new Date()));
    });
    observer.observe(cityNode, { childList:true, characterData:true, subtree:true });
  }

  // Resize : recalcule la croix
  window.addEventListener('resize', drawCloseCross);

  // Initial
  placeInitialMarker();
  drawCloseCross();
})();
