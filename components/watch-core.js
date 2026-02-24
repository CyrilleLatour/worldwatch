/* ============================================================
   components/watch-core.js — CORE (sans capitales)
   - État & utilitaires (Geneva par défaut, noir / non gras)
   - Horloge + calendrier + animation d’aiguilles
   - Mise en page du cadran (marques, numéros)
   - Tick aligné à la seconde
   - API minimale partagée avec les autres modules
   ============================================================ */

/* -------------------- État global minimal -------------------- */
window.CITY_LIST = window.CITY_LIST || [];
window.TIMEZONE_MAP = window.TIMEZONE_MAP || {};
window.SORTED = window.SORTED || [];
window.__CAPITAL_NAME_SET = window.__CAPITAL_NAME_SET || new Set(); // vide (Geneva n’est pas une capitale)
window.CITY_COORDS = window.CITY_COORDS || {};
window.currentTZ = window.currentTZ || 'Europe/Zurich'; // fuseau de Geneva

// Seed Geneva (uniquement pour que tout fonctionne sans données externes)
(function seedGeneva(){
  if (!window.CITY_LIST.some(c => c.name === 'Geneva')) {
    window.CITY_LIST.push({ name: 'Geneva', cc: 'CH' });
  }
  window.TIMEZONE_MAP['Geneva'] = 'Europe/Zurich';
  window.SORTED = window.CITY_LIST.slice(); // une seule entrée
  // Coordonnées pour la carte (lon, lat)
  window.CITY_COORDS['Geneva'] = [6.15, 46.2];
})();

/* -------------------- Utilitaires généraux -------------------- */
const $ = (id) => document.getElementById(id);
function mod360(x){ return ((x % 360) + 360) % 360; }

function saveTZState(city,tz){ try{ localStorage.setItem('tzState', JSON.stringify({ city, tz })); }catch{} }
function loadTZState(){ try{ return JSON.parse(localStorage.getItem('tzState') || 'null'); }catch{ return null; } }

function getPartsForTZ(tz){
  const now = new Date();
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).formatToParts(now);
  const H = parseInt(t.find(p=>p.type==='hour').value,10);
  const M = parseInt(t.find(p=>p.type==='minute').value,10);
  const S = parseInt(t.find(p=>p.type==='second').value,10);
  const d = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' }).formatToParts(now);
  const Y = parseInt(d.find(p=>p.type==='year').value,10);
  const Mo = parseInt(d.find(p=>p.type==='month').value,10);
  const D = parseInt(d.find(p=>p.type==='day').value,10);
  const wd = d.find(p=>p.type==='weekday').value.toLowerCase().slice(0,3);
  return { H,M,S,Y,Mo,D,wd };
}
window.getPartsForTZ = getPartsForTZ; // utilisée par la carte pour les heures solaires

function isoWeekOf(y,m,d){
  const date=new Date(Date.UTC(y,m-1,d));
  const dayNum=(date.getUTCDay()+6)%7+1;
  date.setUTCDate(date.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date-yearStart)/86400000)+1)/7);
}

/* -------------------- Horloge & Calendrier -------------------- */
let funTimerId = null, isAnimating = false;
let lastAngles = { h:0, m:0, s:0 };
let prevSecond = null;
let lastSunKey = null;

function updateClockTZ(){
  const {H,M,S} = getPartsForTZ(window.currentTZ);
  const sDeg = S*6;
  $('second').style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
  lastAngles.s = sDeg;

  $('digital').textContent = `${String(H).padStart(2,'0')}:${String(M).padStart(2,'0')}:${String(S).padStart(2,'0')}`;

  if (isAnimating) return;

  const mDeg = M*6 + S*0.1;
  const hDeg = (H%12)*30 + M*0.5;
  $('minute').style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
  $('hour').style.transform   = `translateX(-50%) rotate(${hDeg}deg)`;
  lastAngles.m = mDeg; lastAngles.h = hDeg;
}

function updateCalendarTZ(){
  const months=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const {Y,Mo,D,wd} = getPartsForTZ(window.currentTZ);
  $('week').textContent = wd;
  $('day').textContent = String(D);
  $('month').textContent = months[Mo-1];
  $('weeknum').textContent = String(isoWeekOf(Y,Mo,D));
}

/* -------------------- Animation fun des aiguilles -------------------- */
function pulseMarker(){
  const el = document.querySelector('.city-marker');
  if (!el) return;
  if (window.__isAnimatingMarker) { el.classList.remove('pulse'); return; }
  if (!el.classList.contains('pulse')) el.classList.add('pulse');
}
window.pulseMarker = pulseMarker;

function startFunAnimation(){
  const DURATION=1200, EASE='cubic-bezier(.25,.9,.3,1)';
  const LEAD_MS=120;

  const {H,M,S} = getPartsForTZ(window.currentTZ);
  const targetMinute = M*6 + S*0.1;
  const targetHour   = (H%12)*30 + M*0.5;

  const hourEl=$('hour'), minuteEl=$('minute');
  hourEl.style.transition='none'; minuteEl.style.transition='none';
  hourEl.style.transform=`translateX(-50%) rotate(${lastAngles.h}deg)`;
  minuteEl.style.transform=`translateX(-50%) rotate(${lastAngles.m}deg)`;

  const deltaHcw=mod360(targetHour-lastAngles.h), endH=lastAngles.h+360+deltaHcw;
  const deltaMccw=-mod360(lastAngles.m-targetMinute), endM=lastAngles.m-360+deltaMccw;

  requestAnimationFrame(()=>{
    isAnimating=true;
    setTimeout(()=>pulseMarker(true), Math.max(0, DURATION-LEAD_MS));
    hourEl.style.transition=`transform ${DURATION}ms ${EASE}`;
    minuteEl.style.transition=`transform ${DURATION}ms ${EASE}`;
    hourEl.style.transform=`translateX(-50%) rotate(${endH}deg)`;
    minuteEl.style.transform=`translateX(-50%) rotate(${endM}deg)`;
    setTimeout(()=>{
      hourEl.style.transition='none'; minuteEl.style.transition='none';
      const hFinal=mod360(targetHour), mFinal=mod360(targetMinute);
      hourEl.style.transform=`translateX(-50%) rotate(${hFinal}deg)`;
      minuteEl.style.transform=`translateX(-50%) rotate(${mFinal}deg)`;
      lastAngles.h=hFinal; lastAngles.m=mFinal; isAnimating=false;
    }, DURATION+30);
  });
}
function queueFunAnimation(d=500){ clearTimeout(funTimerId); funTimerId=setTimeout(startFunAnimation,d); }
window.queueFunAnimation = queueFunAnimation;

/* -------------------- Cadran (marques + numéros) -------------------- */
function drawMarks(size){
  const watch=$('watch');
  watch.querySelectorAll('.dot,.min-dot,.mark-wrap').forEach(n=>n.remove());

  const CENTER=size/2, RADIUS_MARKS=size*.45, RADIUS_EDGE=size/2;
  watch.style.setProperty('--edge-translate',(-RADIUS_EDGE)+'px');

  for(let i=0;i<12;i++){
    const deg=i*30;
    if(i===0||i===3||i===6||i===9){
      const w=document.createElement('div');
      w.className='mark-wrap';
      w.style.transform=`translate(-50%,-50%) rotate(${deg}deg)`;
      const m=document.createElement('div'); m.className='main-mark';
      w.appendChild(m); watch.appendChild(w);
    } else {
      const d=document.createElement('div'); d.className='dot';
      const rad=(deg-90)*Math.PI/180;
      const x=CENTER+RADIUS_MARKS*Math.cos(rad)-5, y=CENTER+RADIUS_MARKS*Math.sin(rad)-5;
      d.style.left=`${x}px`; d.style.top=`${y}px`; watch.appendChild(d);
    }
  }

  for(let m=0;m<60;m++){
    if(m%5===0) continue;
    const deg=m*6, rad=(deg-90)*Math.PI/180;
    const md=document.createElement('div'); md.className='min-dot';
    const x=CENTER+RADIUS_MARKS*Math.cos(rad)-2.5, y=CENTER+RADIUS_MARKS*Math.sin(rad)-2.5;
    md.style.left=`${x}px`; md.style.top=`${y}px`; watch.appendChild(md);
  }
}

function drawHourNumbers(size){
  const watch=$('watch');
  watch.querySelectorAll('.hour-num').forEach(n=>n.remove());
  const CENTER=size/2, RADIUS_NUM=size*.36, fontPx=Math.max(12,Math.round(size*.08));
  for(let h=1;h<=12;h++){
    if(h===3||h===9) continue;
    const deg=h*30, rad=(deg-90)*Math.PI/180, x=CENTER+RADIUS_NUM*Math.cos(rad), y=CENTER+RADIUS_NUM*Math.sin(rad);
    const el=document.createElement('div'); el.className='hour-num'; el.textContent=(h===12)?'12':String(h);
    el.style.left=`${x}px`; el.style.top=`${y}px`; el.style.fontSize=`${fontPx}px`;
    watch.appendChild(el);
  }
}

function layoutWatch(){
  const phone=$('phone'), watch=$('watch');
  const screen=phone.querySelector('.screen'), header=phone.querySelector('.header'), footer=phone.querySelector('.footer');
  const sr=screen.getBoundingClientRect(), hr=header.getBoundingClientRect(), fr=footer.getBoundingClientRect();
  const verticalPadding=12, availableW=sr.width-8, availableH=sr.height-hr.height-fr.height-verticalPadding*2;
  const size=Math.floor(Math.min(availableW,availableH));
  watch.style.width=size+'px'; watch.style.height=size+'px';
  drawMarks(size); drawHourNumbers(size);
}

/* -------------------- Boot (Geneva par défaut) -------------------- */
(function initTZ(){
  const saved=loadTZState();
  if (saved && saved.tz){
    window.currentTZ = saved.tz;
    const label = saved.city || ($('city')?.textContent || 'Geneva') || 'Geneva';
    if ($('city')) $('city').textContent = label;
    saveTZState(label, window.currentTZ);
  } else {
    // on impose Geneva comme demandé
    if ($('city')) $('city').textContent = 'Geneva';
    window.currentTZ = 'Europe/Zurich';
    saveTZState('Geneva','Europe/Zurich');
  }
})();

window.addEventListener('resize', layoutWatch);
layoutWatch();

/* -------------------- Tick aligné à la seconde -------------------- */
(function tick(){
  updateClockTZ();
  updateCalendarTZ();

  // Recalcul des heures solaire aux changements de date
  const { Y, Mo, D, S } = getPartsForTZ(window.currentTZ);
  const key = `${Y}-${Mo}-${D}`;
  if (key !== lastSunKey){
    lastSunKey = key;
    if (window.updateSunTimes){
      const city = ($('city')?.textContent || 'Geneva').trim();
      window.updateSunTimes(city);
    }
  }

  // Pulse du marker à la seconde
  if (prevSecond === null){ prevSecond=S; pulseMarker();
  } else if (S !== prevSecond){ prevSecond=S; pulseMarker(); }

  const delay = 1000 - (Date.now() % 1000) + 2;
  setTimeout(tick, delay);
})();

/* -------------------- Exports utiles aux autres modules -------------------- */
window.saveTZState = saveTZState;
window.loadTZState = loadTZState;
