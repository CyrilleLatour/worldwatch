/* capitals-data.js — SHIM : aucune intégration de capitales, base vide.
   Laisse l'API globale dispo au cas où d'autres scripts l'utilisent. */

(function(){
  'use strict';
  window.__CAPITAL_NAME_SET = new Set();
  window.__CAPITAL_COORDS   = {};
  window.TIMEZONE_MAP       = {};
  window.CITY_LIST          = [];
  let SORTED = [];
  Object.defineProperty(window, 'SORTED', { get(){return SORTED;}, set(v){SORTED = Array.isArray(v)?v:[];} });
  window.__capitalsDataReady = true;
  window.__capitalsDataCallbacks = [];
  window.__whenCapitalsReady = function(cb){ try{ typeof cb==='function' && cb(); }catch{} };
  if (typeof window.__mergeCapitalCoordsIntoMap !== 'function'){
    window.__mergeCapitalCoordsIntoMap = function(){};
  }
  console.info('[capitals-data] SHIM actif (aucune ville).');
})();
