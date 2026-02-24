// Attendre que le DOM et toutes les variables globales soient prêtes
window.addEventListener('load', function() {
  
  // Vérifier que les variables globales existent
  if (typeof CITY_LIST === 'undefined' || typeof TIMEZONE_MAP === 'undefined') {
    console.error('Variables globales non disponibles');
    return;
  }

 // Liste des fichiers de capitales à charger
const capitalFiles = [
  'capitals_A.json',
  'capitals_B.json',
  'capitals_C.json',
  'capitals_D.json',
  'capitals_E.json',
  'capitals_F.json',
  'capitals_G.json',
  'capitals_H.json',
  'capitals_I.json',
  'capitals_J.json',
  'capitals_K.json',
  'capitals_L.json',
  'capitals_M.json',
  'capitals_N.json',
  'capitals_O.json',
  'capitals_P.json',
  'capitals_Q.json',
  'capitals_R.json',
  'capitals_S.json',
  'capitals_T.json',
  'capitals_U.json',
  'capitals_V.json',
  'capitals_Y.json',
  'capitals_Z.json'
];


  // Fonction pour charger tous les fichiers
  async function loadAllCapitals() {
    try {
      // Charger tous les fichiers en parallèle
      const promises = capitalFiles.map(file => 
        fetch(`countries/${file}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} pour ${file}`);
            }
            return response.json();
          })
          .catch(error => {
            console.warn(`Erreur chargement ${file}:`, error);
            return {}; // Retourner objet vide en cas d'erreur
          })
      );

      const results = await Promise.all(promises);
      
      // Fusionner tous les résultats
      let allCapitals = {};
      results.forEach(data => {
        Object.assign(allCapitals, data);
      });

      if (Object.keys(allCapitals).length === 0) {
        console.warn('Aucune capitale chargée, conservation de Geneva');
        return;
      }

      // Vider les structures existantes (sauf Geneva qu'on garde comme fallback)
      const genevaBackup = {
        list: CITY_LIST.find(city => city.name === 'Geneva'),
        tz: TIMEZONE_MAP['Geneva'],
        coords: CITY_COORDS['Geneva']
      };

      CITY_LIST.length = 0;
      Object.keys(TIMEZONE_MAP).forEach(key => delete TIMEZONE_MAP[key]);
      Object.keys(CITY_COORDS).forEach(key => delete CITY_COORDS[key]);
      __CAPITAL_NAME_SET.clear();

      // Ajouter Geneva en premier (fallback)
      if (genevaBackup.list) {
        CITY_LIST.push(genevaBackup.list);
        TIMEZONE_MAP['Geneva'] = genevaBackup.tz;
        CITY_COORDS['Geneva'] = genevaBackup.coords;
      }

      // Ajouter toutes les capitales chargées
      Object.entries(allCapitals).forEach(([country, cities]) => {
        cities.forEach(city => {
          // Éviter les doublons
          if (!CITY_LIST.find(c => c.name === city.name)) {
            CITY_LIST.push({ name: city.name, cc: city.cc });
            TIMEZONE_MAP[city.name] = city.tz;
            CITY_COORDS[city.name] = [city.lon, city.lat];
            __CAPITAL_NAME_SET.add(city.name);
          }
        });
      });

      // Trier la liste
      SORTED = CITY_LIST.slice().sort((a, b) => a.name.localeCompare(b.name));
      
      // Repeupler la liste si le menu TZ est ouvert
      if (window.tzMenu && window.tzMenu.classList.contains('show') && window.populateTzList) {
        const searchValue = window.tzSearch ? window.tzSearch.value : '';
        window.populateTzList(searchValue);
      }

      console.log(`Capitales chargées: ${CITY_LIST.length} villes`);

    } catch (error) {
      console.error('Erreur lors du chargement des capitales:', error);
    }
  }

  // Lancer le chargement
  loadAllCapitals();
  
});