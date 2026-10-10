/* ==========================================================================
   DB.JS — EDUQUEST v2.0
   Couche d'abstraction Base de Données

   RÔLE :
   Ce fichier est le pont entre le site web (frontend) et la base de données
   SQL (backend). Il expose un objet global "DB" avec des fonctions simples
   pour lire et écrire les données du jeu.

   FONCTIONNEMENT EN DEUX MODES :
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  MODE LOCAL (par défaut, aucun serveur requis)                          │
   │  → Toutes les données sont stockées dans le localStorage du navigateur. │
   │  → Fonctionne immédiatement, sans configuration.                        │
   ├─────────────────────────────────────────────────────────────────────────┤
   │  MODE API SQL (pour connecter la vraie base de données)                 │
   │  → Décommentez la ligne API_URL ci-dessous.                             │
   │  → Renseignez l'adresse de votre serveur backend (PHP, Node.js…).       │
   │  → Les fonctions basculeront automatiquement vers des requêtes fetch().  │
   │  → Le reste du code (app.js, HTML) ne change pas.                       │
   └─────────────────────────────────────────────────────────────────────────┘

   STRUCTURE DE L'API ATTENDUE (quand API_URL est activé) :
     POST   /auth/login           → { token, username }
     POST   /auth/register        → { token, username }
     POST   /auth/logout          → { ok: true }
     GET    /options              → [ { cle, valeur }, … ]
     GET    /options/:cle         → { cle, valeur }
     POST   /options              → { cle, valeur }
     GET    /progression/:matiere/:niveau  → { levels: { 1: {unlocked, stars}, … } }
     POST   /progression          → { matiere, niveau, data }

   FICHIERS LIÉS :
     - schema.sql  : Structure SQL des tables côté serveur
     - app.js      : Utilise DB.* pour toutes les lectures/écritures de données
   ========================================================================== */

const DB = (() => {

    /* -----------------------------------------------------------------------
       CONFIGURATION
       -----------------------------------------------------------------------
       API_URL : adresse de base de votre serveur backend.
         - Si null  → mode localStorage (aucun serveur, tout en local).
         - Si défini → mode API REST (toutes les fonctions envoient des requêtes
                       HTTP vers votre serveur qui lit/écrit dans la base SQL).

       Exemple pour activer :
         const API_URL = 'http://localhost/eduquest/api';
         const API_URL = 'https://mon-serveur.com/api';
    ----------------------------------------------------------------------- */
    // const API_URL = 'http://localhost/eduquest/api'; // ← Décommentez pour activer le mode SQL
    const API_URL = null; // null = mode localStorage uniquement

    // Booléen pratique : vrai si une API est configurée, faux sinon
    const USE_API = API_URL !== null;

    /* -----------------------------------------------------------------------
       CLÉS DE STOCKAGE localStorage
       -----------------------------------------------------------------------
       Toutes les clés utilisées dans le localStorage sont centralisées ici
       pour éviter les fautes de frappe et faciliter les modifications futures.
    ----------------------------------------------------------------------- */
    const KEYS = {
        OPTIONS:       'eduquest_options',        // Objet JSON de toutes les options du jeu
        NIVEAU:        'eduquest_niveau',          // Niveau scolaire sélectionné (ex: "6eme")
        TRACK:         'eduquest_current_track',   // Index de la piste audio en cours
        MUSIC_TIME:    'eduquest_music_time',      // Position (secondes) dans la piste en cours
        SESSION:       'eduquest_session',         // Session utilisateur connecté (token + username)
        QUESTS:        'eduquest_daily_quests',    // Quêtes journalières
    };

    /* -----------------------------------------------------------------------
       UTILITAIRE — Requêtes HTTP vers l'API REST
       -----------------------------------------------------------------------
       Cette fonction centralise tous les appels réseau vers le serveur backend.
       Elle ajoute automatiquement le token d'authentification dans les headers
       si l'utilisateur est connecté.

       Paramètres :
         method   (string) : méthode HTTP — 'GET', 'POST', 'PUT', 'DELETE'
         endpoint (string) : chemin relatif à API_URL — ex: '/auth/login'
         body     (object) : données à envoyer en JSON (optionnel, pour POST/PUT)

       Retourne toujours un objet :
         { ok: boolean, data: any, error: string|null }
         - ok    : true si la réponse HTTP est 2xx, false sinon
         - data  : contenu JSON de la réponse du serveur
         - error : message d'erreur si ok est false, ou si le serveur est inaccessible
    ----------------------------------------------------------------------- */
    async function apiRequest(method, endpoint, body = null) {
        const session = _getSession(); // Récupère la session locale (token JWT)
        const headers = { 'Content-Type': 'application/json' };

        // Si l'utilisateur est connecté, on envoie son token dans le header Authorization
        // Le serveur backend utilisera ce token pour identifier le joueur
        if (session && session.token) {
            headers['Authorization'] = 'Bearer ' + session.token;
        }

        try {
            const res = await fetch(API_URL + endpoint, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined, // body uniquement si fourni
            });
            const data = await res.json();
            return {
                ok: res.ok,                                          // true si HTTP 200-299
                data,                                                // réponse JSON du serveur
                error: res.ok ? null : (data.message || 'Erreur serveur')
            };
        } catch (e) {
            // Erreur réseau : serveur inaccessible ou pas de connexion internet
            return { ok: false, data: null, error: 'Impossible de joindre le serveur.' };
        }
    }

    /* -----------------------------------------------------------------------
       GESTION DE SESSION (connexion locale)
       -----------------------------------------------------------------------
       La session est un petit objet JSON stocké dans localStorage contenant :
         { token: "...", username: "...", email: "..." }

       En mode API : le token est le JWT renvoyé par le serveur à la connexion.
       En mode local : le token est une chaîne factice (ex: "local_1719999999").

       _getSession()        → retourne l'objet session ou null si non connecté
       _setSession(session) → sauvegarde la session (null = déconnexion)
    ----------------------------------------------------------------------- */
    function _getSession() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null');
        } catch { return null; }
    }

    function _setSession(session) {
        if (session) {
            // Connexion : on sauvegarde le token et les infos du joueur
            localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
        } else {
            // Déconnexion : on supprime la session du localStorage
            localStorage.removeItem(KEYS.SESSION);
        }
    }

    /* -----------------------------------------------------------------------
       OPTIONS DU JEU
       -----------------------------------------------------------------------
       Les options sont les préférences de l'utilisateur : volume, plein écran,
       particules, etc. Elles sont stockées en tant que paires clé/valeur.

       Correspondance avec la base SQL :
         Table "parametres" → colonnes : joueur_id, cle, valeur

       En mode local, toutes les options sont dans un seul objet JSON sous
       la clé localStorage "eduquest_options".

       En mode API, les fonctions async (getOptionAsync, saveOptionAsync)
       synchronisent avec le serveur. Les fonctions synchrones (getOption,
       saveOption) utilisent un cache localStorage pour ne pas bloquer l'UI.
    ----------------------------------------------------------------------- */

    /**
     * Récupère une option par son nom (version synchrone — utilise le cache local).
     *
     * @param {string} name - Nom de l'option (ex: 'volumeMusique', 'pleinEcran')
     * @returns {string|null} La valeur de l'option (toujours une chaîne), ou null si non définie
     *
     * Exemples de noms d'options et valeurs :
     *   'volumeMusique' → '75'      (nombre entre 0 et 100, sous forme de string)
     *   'pleinEcran'    → 'true'    (booléen sous forme de string)
     *   'particules'    → 'false'
     *   'sonsActifs'    → 'true'
     *   'musiqueActive' → 'true'
     *   'effetsActifs'  → 'true'
     *   'vsync'         → 'false'
     *   'volumeEffets'  → '80'
     */
    function getOption(name) {
        if (USE_API) {
            // En mode API, on lit depuis le cache localStorage (mis à jour par syncOptionsFromServer)
            // Remarque : pour une valeur fraîche du serveur, utiliser getOptionAsync()
            const cache = _getOptionsCache();
            return cache.hasOwnProperty(name) ? cache[name] : null;
        }
        // En mode local, on lit directement le localStorage
        try {
            const options = JSON.parse(localStorage.getItem(KEYS.OPTIONS) || '{}');
            return options.hasOwnProperty(name) ? options[name] : null;
        } catch { return null; }
    }

    /**
     * Sauvegarde une option (version synchrone).
     * En mode API : mise à jour immédiate du cache local, puis sync async vers le serveur.
     * En mode local : écriture directe dans le localStorage.
     *
     * @param {string} name  - Nom de l'option
     * @param {string} value - Valeur à enregistrer (toujours convertir en string)
     *
     * Exemple d'appel : DB.saveOption('volumeMusique', '60');
     */
    function saveOption(name, value) {
        if (USE_API) {
            // 1. Mise à jour locale immédiate pour que l'UI reste réactive
            const cache = _getOptionsCache();
            cache[name] = value;
            _setOptionsCache(cache);
            // 2. Synchronisation vers le serveur en arrière-plan (sans attendre)
            saveOptionAsync(name, value).catch(() => {});
            return;
        }
        // Mode local : écriture simple dans le localStorage
        try {
            const options = JSON.parse(localStorage.getItem(KEYS.OPTIONS) || '{}');
            options[name] = value;
            localStorage.setItem(KEYS.OPTIONS, JSON.stringify(options));
        } catch {}
    }

    /**
     * Sauvegarde une option côté serveur (version asynchrone, utilisable avec await).
     * Utile si vous voulez attendre la confirmation du serveur avant de continuer.
     *
     * @param {string} name  - Nom de l'option
     * @param {string} value - Valeur à sauvegarder
     * @returns {Promise<{ok: boolean}>}
     */
    async function saveOptionAsync(name, value) {
        if (!USE_API) {
            // Si pas d'API, on appelle la version synchrone et on retourne un succès
            saveOption(name, value);
            return { ok: true };
        }
        // Appel API : POST /options avec { cle: name, valeur: value }
        return await apiRequest('POST', '/options', { cle: name, valeur: value });
    }

    /**
     * Récupère une option fraîche depuis le serveur (version asynchrone).
     * Met à jour le cache local au passage.
     *
     * @param {string} name - Nom de l'option
     * @returns {Promise<string|null>} La valeur de l'option, ou null si non trouvée
     */
    async function getOptionAsync(name) {
        if (!USE_API) return getOption(name); // Pas d'API → lecture locale
        const res = await apiRequest('GET', '/options/' + name);
        if (res.ok && res.data) {
            // Mise à jour du cache local pour les prochains getOption() synchrones
            const cache = _getOptionsCache();
            cache[name] = res.data.valeur;
            _setOptionsCache(cache);
            return res.data.valeur;
        }
        return null;
    }

    /**
     * Télécharge TOUTES les options depuis le serveur et met à jour le cache local.
     * À appeler une fois après la connexion d'un utilisateur pour avoir ses préférences.
     * N'a aucun effet en mode local.
     */
    async function syncOptionsFromServer() {
        if (!USE_API) return; // Rien à faire en mode local
        const res = await apiRequest('GET', '/options');
        if (res.ok && res.data) {
            // On reconstruit le cache avec les données du serveur
            const newCache = {};
            res.data.forEach(opt => { newCache[opt.cle] = opt.valeur; });
            _setOptionsCache(newCache);
        }
    }

    // --- Helpers internes pour le cache des options ---

    /** Lit l'objet options depuis le localStorage (cache en mode API) */
    function _getOptionsCache() {
        try { return JSON.parse(localStorage.getItem(KEYS.OPTIONS) || '{}'); } catch { return {}; }
    }

    /** Écrit l'objet options dans le localStorage (cache en mode API) */
    function _setOptionsCache(cache) {
        try { localStorage.setItem(KEYS.OPTIONS, JSON.stringify(cache)); } catch {}
    }

    /* -----------------------------------------------------------------------
       PROGRESSION DES NIVEAUX
       -----------------------------------------------------------------------
       La progression représente l'avancement d'un joueur dans une matière
       pour un niveau scolaire donné.

       Format de l'objet "progress" :
       {
         levels: {
           1: { unlocked: true,  stars: 3 },  // Niveau 1 terminé avec 3 étoiles
           2: { unlocked: true,  stars: 1 },  // Niveau 2 terminé avec 1 étoile
           3: { unlocked: true,  stars: 0 },  // Niveau 3 débloqué mais pas encore fait
           4: { unlocked: false, stars: 0 },  // Niveaux 4-6 verrouillés
           5: { unlocked: false, stars: 0 },
           6: { unlocked: false, stars: 0 },
         }
       }

       En mode local : stocké en localStorage sous la clé
         "eduquest_<matiere>_<niveauScolaire>_progress"
         Exemple : "eduquest_mathématiques_6eme_progress"

       En mode API : chargé et sauvegardé via le serveur.
         La sauvegarde locale reste TOUJOURS active (en parallèle de l'API)
         comme cache et sécurité en cas de panne réseau.

       Correspondance SQL : table "progression"
    ----------------------------------------------------------------------- */

    /**
     * Génère la clé localStorage pour une matière et un niveau donnés.
     * Utilisé en mode local pour trouver la progression sauvegardée.
     *
     * @param {string} matiere - Nom de la matière (ex: 'Mathématiques')
     * @param {string} niveau  - Niveau scolaire (ex: '6eme', '5eme')
     * @returns {string} Clé localStorage (ex: 'eduquest_mathématiques_6eme_progress')
     */
    function _progressKey(matiere, niveau) {
        return 'eduquest_' + matiere.toLowerCase() + '_' + niveau + '_progress';
    }

    /**
     * Charge la progression d'un joueur pour une matière et un niveau scolaire.
     * En mode API : tente de charger depuis le serveur, sinon utilise le cache local.
     * En mode local : lit directement le localStorage.
     *
     * @param {string} matiere - Nom de la matière (ex: 'Mathématiques')
     * @param {string} niveau  - Niveau scolaire (ex: '6eme')
     * @returns {Promise<object|null>} Objet progression, ou null si aucune donnée (→ utiliser getDefaultProgress())
     *
     * Exemple d'appel dans app.js :
     *   const data = await DB.loadProgress('Mathématiques', '6eme');
     *   const progress = data || getDefaultProgress();
     */
    async function loadProgress(matiere, niveau) {
        if (USE_API) {
            // Tentative de chargement depuis le serveur
            const res = await apiRequest('GET',
                '/progression/' + encodeURIComponent(matiere) + '/' + encodeURIComponent(niveau)
            );
            if (res.ok && res.data) return res.data;
            // En cas d'échec réseau, on lit le cache local (localStorage)
        }
        // Mode local (ou fallback) : lecture du localStorage
        try {
            const saved = localStorage.getItem(_progressKey(matiere, niveau));
            if (saved) return JSON.parse(saved);
        } catch {}
        return null; // Aucune progression trouvée → l'appelant utilisera getDefaultProgress()
    }

    /**
     * Sauvegarde la progression d'un joueur.
     * La progression est TOUJOURS sauvegardée localement en premier (immédiat),
     * puis synchronisée vers le serveur si l'API est activée (asynchrone).
     *
     * @param {string} matiere - Nom de la matière
     * @param {string} niveau  - Niveau scolaire
     * @param {object} data    - Objet progression complet à sauvegarder
     * @returns {Promise<{ok: boolean}>}
     *
     * Exemple d'appel dans app.js (après avoir modifié la progression) :
     *   progress.levels[currentModalLevel].stars = starsEarned;
     *   DB.saveProgress('Mathématiques', '6eme', progress);
     */
    async function saveProgress(matiere, niveau, data) {
        // 1. Sauvegarde locale immédiate (toujours, pour ne pas perdre de données)
        try {
            localStorage.setItem(_progressKey(matiere, niveau), JSON.stringify(data));
        } catch {}

        // 2. Synchronisation vers le serveur si l'API est activée
        if (USE_API) {
            return await apiRequest('POST', '/progression', { matiere, niveau, data });
        }
        return { ok: true };
    }

    /* -----------------------------------------------------------------------
       NIVEAU SCOLAIRE SÉLECTIONNÉ
       -----------------------------------------------------------------------
       Le niveau scolaire détermine quel contenu est affiché (6ème, 5ème…).
       Il est sélectionné sur la page jouer.html et utilisé partout ailleurs.

       Valeurs possibles : '6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale'
    ----------------------------------------------------------------------- */

    /**
     * Retourne le niveau scolaire actuellement sélectionné.
     * @returns {string|null} Ex: '6eme', ou null si aucun niveau sélectionné
     */
    function getNiveau() {
        return localStorage.getItem(KEYS.NIVEAU) || null;
    }

    /**
     * Sauvegarde le niveau scolaire sélectionné.
     * En mode API, synchronise aussi l'option 'niveau_actuel' vers le serveur.
     *
     * @param {string} niveau - Ex: '6eme', '5eme'
     */
    function setNiveau(niveau) {
        localStorage.setItem(KEYS.NIVEAU, niveau); // Sauvegarde locale immédiate
        if (USE_API) {
            // Synchronisation optionnelle vers le serveur
            saveOptionAsync('niveau_actuel', niveau).catch(() => {});
        }
    }

    /* -----------------------------------------------------------------------
       AUTHENTIFICATION (Connexion / Inscription / Déconnexion)
       -----------------------------------------------------------------------
       Gère les comptes utilisateurs du jeu.

       En mode API :
         - Le serveur valide les identifiants contre la table "joueurs"
         - Le serveur retourne un token JWT sécurisé
         - Toutes les données sont ensuite associées au compte du joueur

       En mode local (démonstration) :
         - Les comptes sont stockés dans le localStorage (NON sécurisé)
         - Le "hash" du mot de passe est une simple obfuscation (usage démo)
         - ⚠ En production, utilisez TOUJOURS le mode API avec bcrypt côté serveur

       Correspondance SQL : table "joueurs"
    ----------------------------------------------------------------------- */

    /**
     * Connecte un utilisateur avec son email et son mot de passe.
     *
     * En mode API :
     *   → POST /auth/login avec { email, password }
     *   → Le serveur vérifie le hash bcrypt du mot de passe
     *   → Retourne un token JWT qui sera envoyé dans tous les prochains appels
     *
     * En mode local :
     *   → Cherche l'utilisateur dans le localStorage
     *   → Vérifie avec un hash simplifié (non sécurisé — démo uniquement)
     *
     * @param {string} email    - Email de l'utilisateur
     * @param {string} password - Mot de passe en clair (chiffré côté serveur en mode API)
     * @returns {Promise<{ok: boolean, username?: string, error?: string}>}
     *
     * Exemple de gestion du retour dans app.js :
     *   const result = await DB.login('test@mail.com', 'monmdp');
     *   if (result.ok) {
     *     console.log('Bonjour', result.username);
     *   } else {
     *     afficherErreur(result.error);
     *   }
     */
    async function login(email, password) {
        if (USE_API) {
            const res = await apiRequest('POST', '/auth/login', { email, password });
            if (res.ok && res.data.token) {
                // Sauvegarde de la session : token + infos du joueur
                _setSession({ token: res.data.token, username: res.data.username, email });
                // Chargement des options personnalisées depuis le serveur
                await syncOptionsFromServer();
            }
            return res.ok
                ? { ok: true, username: res.data.username }
                : { ok: false, error: res.error };
        }

        // Mode local : vérification dans le localStorage (avec migration SHA-256)
        const users = _getLocalUsers();
        const inputHash = await _secureHash(password);
        let user = users.find(u => u.email === email && u.password === inputHash);

        // Migration transparente : si pas trouvé avec SHA-256, essayer l'ancien hash
        if (!user) {
            const legacyCandidate = users.find(u => u.email === email && u.password === _legacyHash(password));
            if (legacyCandidate) {
                // Re-hasher le mot de passe en SHA-256 et sauvegarder
                legacyCandidate.password = inputHash;
                _setLocalUsers(users);
                user = legacyCandidate;
            }
        }

        if (user) {
            _setSession({ token: 'local_' + Date.now(), username: user.username, email: user.email, role: user.role || 'eleve' });
            return { ok: true, username: user.username };
        }
        return { ok: false, error: 'Email ou mot de passe incorrect.' };
    }

    /**
     * Crée un nouveau compte joueur.
     *
     * En mode API :
     *   → POST /auth/register avec { email, username, password }
     *   → Le serveur crée la ligne dans la table "joueurs" avec password hashé (bcrypt)
     *   → Retourne un token de session pour connexion automatique après inscription
     *
     * En mode local :
     *   → Vérifie que l'email n'est pas déjà pris (dans le localStorage)
     *   → Ajoute l'utilisateur à la liste locale
     *
     * @param {string} email    - Email du nouveau joueur (doit être unique)
     * @param {string} username - Pseudo affiché dans le jeu
     * @param {string} password - Mot de passe en clair (minimum 6 caractères — validé dans app.js)
     * @returns {Promise<{ok: boolean, username?: string, error?: string}>}
     */
    async function register(email, username, password) {
        if (USE_API) {
            const res = await apiRequest('POST', '/auth/register', { email, username, password });
            if (res.ok && res.data.token) {
                // Connexion automatique après inscription réussie
                _setSession({ token: res.data.token, username, email });
            }
            return res.ok
                ? { ok: true, username }
                : { ok: false, error: res.error };
        }

        // Mode local : création simplifiée dans le localStorage
        const users = _getLocalUsers();
        if (users.find(u => u.email === email)) {
            return { ok: false, error: 'Cet email est déjà utilisé.' };
        }
        users.push({ email, username, password: await _secureHash(password), role: 'eleve', created: new Date().toISOString() });
        _setLocalUsers(users);
        _setSession({ token: 'local_' + Date.now(), username, email, role: 'eleve' });
        return { ok: true, username };
    }

    /**
     * Déconnecte l'utilisateur courant.
     * Supprime la session locale et invalide le token côté serveur (si API active).
     *
     * @returns {Promise<void>}
     *
     * Après un logout, getCurrentUser() retourne null et isLoggedIn() retourne false.
     */
    async function logout() {
        if (USE_API) {
            // Invalidation du token côté serveur (ignore les erreurs réseau)
            await apiRequest('POST', '/auth/logout').catch(() => {});
        }
        _setSession(null); // Suppression de la session locale
    }

    /**
     * Retourne les informations de l'utilisateur actuellement connecté.
     *
     * @returns {{ username: string, email: string } | null}
     *   - null si personne n'est connecté
     *   - Un objet avec username et email si connecté
     *
     * Utilisation typique dans app.js (affichage du pseudo) :
     *   const user = DB.getCurrentUser();
     *   if (user) afficherPseudo(user.username);
     */
    function getCurrentUser() {
        const session = _getSession();
        if (!session) return null;
        return { username: session.username, email: session.email, role: session.role || 'eleve' };
    }

    /**
     * Vérifie rapidement si un utilisateur est connecté.
     * @returns {boolean} true si une session est active, false sinon
     */
    function isLoggedIn() {
        return _getSession() !== null;
    }

    /* -----------------------------------------------------------------------
       BADGES (SUCCÈS) — v2.1
       -----------------------------------------------------------------------
       Stockage simple : un tableau d'identifiants de badges débloqués,
       persisté comme une option de plus (clé 'dash_badges'). La logique de
       DÉBLOCAGE (à quel moment un badge est gagné) vit dans app.js
       (initDashboard → checkBadges) ; db.js ne fait que stocker le résultat.

       Ce découpage est volontairement le même que pour la progression/XP :
       le jour où l'API sera branchée, seule la ligne `if (USE_API)` d'un
       futur endpoint POST /badges/unlock changera, pas l'appelant.
    ----------------------------------------------------------------------- */

    /**
     * Liste des identifiants de badges déjà débloqués par le joueur.
     * @returns {string[]}
     */
    function getBadges() {
        try { return JSON.parse(getOption('dash_badges') || '[]'); }
        catch { return []; }
    }

    /**
     * Débloque un badge (idempotent : ne fait rien s'il est déjà possédé).
     * @param {string} badgeId - identifiant du badge (voir BADGES_CATALOG dans app.js)
     * @returns {boolean} true si le badge vient d'être débloqué, false s'il l'était déjà
     */
    function unlockBadge(badgeId) {
        const badges = getBadges();
        if (badges.includes(badgeId)) return false;
        badges.push(badgeId);
        saveOption('dash_badges', JSON.stringify(badges));
        return true;
    }

    /* --- Helpers internes pour les comptes locaux (mode sans API) --- */

    /**
     * Récupère la liste des comptes stockés localement (mode démo uniquement).
     * Format : [ { email, username, password (hashé) }, … ]
     */
    function _getLocalUsers() {
        try { return JSON.parse(localStorage.getItem('eduquest_local_users') || '[]'); } catch { return []; }
    }

    /** Sauvegarde la liste des comptes locaux. */
    function _setLocalUsers(users) {
        try { localStorage.setItem('eduquest_local_users', JSON.stringify(users)); } catch {}
    }

    /**
     * Hash sécurisé via l'API native crypto.subtle (SHA-256).
     * Retourne une promesse résolue avec une chaîne hex préfixée 'sh_'.
     *
     * @param {string} str - Chaîne à hasher (mot de passe en clair)
     * @returns {Promise<string>} Ex: 'sh_a3f2c...'
     */
    async function _secureHash(str) {
        const encoded = new TextEncoder().encode(String(str || ''));
        const buf = await crypto.subtle.digest('SHA-256', encoded);
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        return 'sh_' + hex;
    }

    /**
     * Hash legacy (32 bits) — conservé UNIQUEMENT pour la migration transparente.
     * Ne jamais l'utiliser pour de nouveaux comptes.
     * @param {string} str
     * @returns {string} Ex: 'lh_1a2b3c'
     */
    function _legacyHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'lh_' + Math.abs(hash).toString(16);
    }

    /* -----------------------------------------------------------------------
       MEMBRES — Gestion des comptes locaux (panneau d'administration)
       -----------------------------------------------------------------------
       Ces fonctions sont utilisées par admin.html (mode local uniquement).
       En mode API (USE_API = true), la gestion des comptes se fait côté
       backend SQL : ces fonctions retournent une erreur explicite.

       Rôles : 'eleve' (par défaut) ou 'admin' (accès au panneau).
       Une protection empêche de supprimer ou rétrograder le DERNIER admin.
    ----------------------------------------------------------------------- */

    function _normalizeRole(role) {
        return role === 'admin' ? 'admin' : 'eleve';
    }

    function _countAdmins(users) {
        return users.filter(u => (u.role || 'eleve') === 'admin').length;
    }

    /** Liste des comptes locaux (sans le mot de passe, avec rôle et création). */
    async function listLocalMembers() {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const data = _getLocalUsers().map(u => ({
            email: u.email,
            username: u.username,
            role: u.role || 'eleve',
            created: u.created || null,
        }));
        return { ok: true, data };
    }

    /** Crée un compte local (email unique, mot de passe ≥ 6 caractères). */
    async function createLocalMember(email, username, password, role = 'eleve') {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const mail = String(email || '').trim().toLowerCase();
        const pseudo = String(username || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { ok: false, error: 'Adresse e-mail invalide.' };
        if (!pseudo) return { ok: false, error: 'Le pseudo ne peut pas être vide.' };
        if (String(password || '').length < 6) return { ok: false, error: 'Mot de passe trop court (6 caractères minimum).' };
        const users = _getLocalUsers();
        if (users.some(u => u.email.toLowerCase() === mail)) return { ok: false, error: 'Cet e-mail est déjà utilisé.' };
        users.push({ email: mail, username: pseudo, password: await _secureHash(password), role: _normalizeRole(role), created: new Date().toISOString() });
        _setLocalUsers(users);
        return { ok: true, data: { email: mail, username: pseudo, role: _normalizeRole(role) } };
    }

    /** Modifie un compte local (pseudo, mot de passe, rôle). email = identifiant. */
    async function updateLocalMember(email, patch = {}) {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const users = _getLocalUsers();
        const idx = users.findIndex(u => u.email === email);
        if (idx === -1) return { ok: false, error: 'Compte introuvable.' };
        const user = users[idx];
        if (patch.username !== undefined) {
            const pseudo = String(patch.username).trim();
            if (!pseudo) return { ok: false, error: 'Le pseudo ne peut pas être vide.' };
            user.username = pseudo;
        }
        if (patch.password !== undefined) {
            const pw = String(patch.password || '');
            if (pw && pw.length < 6) return { ok: false, error: 'Mot de passe trop court (6 caractères minimum).' };
            if (pw) user.password = await _secureHash(pw);
        }
        if (patch.role !== undefined) {
            const newRole = _normalizeRole(patch.role);
            const wasAdmin = (user.role || 'eleve') === 'admin';
            if (wasAdmin && newRole !== 'admin' && _countAdmins(users) <= 1) {
                return { ok: false, error: 'Impossible de rétrograder le dernier administrateur.' };
            }
            user.role = newRole;
        }
        _setLocalUsers(users);
        return { ok: true, data: { email: user.email, username: user.username, role: user.role || 'eleve' } };
    }

    /** Supprime un compte local (protège le dernier administrateur). */
    async function deleteLocalMember(email) {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const users = _getLocalUsers();
        const idx = users.findIndex(u => u.email === email);
        if (idx === -1) return { ok: false, error: 'Compte introuvable.' };
        if ((users[idx].role || 'eleve') === 'admin' && _countAdmins(users) <= 1) {
            return { ok: false, error: 'Impossible de supprimer le dernier administrateur.' };
        }
        users.splice(idx, 1);
        _setLocalUsers(users);
        // Si le compte supprimé était celui connecté sur cet appareil, on coupe la session
        const session = _getSession();
        if (session && session.email === email) _setSession(null);
        return { ok: true };
    }

    /** Met à jour le profil du membre connecté (pseudo / mot de passe). */
    async function updateProfile(patch = {}) {
        if (USE_API) return { ok: false, error: 'Mode API SQL : non disponible localement.' };
        const session = _getSession();
        if (!session) return { ok: false, error: 'Aucune session active.' };
        const users = _getLocalUsers();
        const idx = users.findIndex(u => u.email === session.email);
        if (idx === -1) return { ok: false, error: 'Compte introuvable.' };
        const user = users[idx];
        if (patch.username !== undefined) {
            const pseudo = String(patch.username).trim();
            if (!pseudo) return { ok: false, error: 'Le pseudo ne peut pas être vide.' };
            user.username = pseudo;
        }
        if (patch.password !== undefined) {
            const pw = String(patch.password || '');
            if (pw && pw.length < 6) return { ok: false, error: 'Mot de passe trop court (6 caractères minimum).' };
            if (pw) user.password = await _secureHash(pw);
        }
        _setLocalUsers(users);
        // Actualise la session (le token reste valide, le pseudo peut changer)
        _setSession({ ...session, username: user.username });
        return { ok: true, data: { username: user.username, email: user.email, role: user.role || 'eleve' } };
    }

    /* -----------------------------------------------------------------------
       ÉTAT AUDIO — Persistance de la musique entre les pages
       -----------------------------------------------------------------------
       Quand l'utilisateur navigue d'une page à l'autre, le navigateur recharge
       la page et la musique s'arrête. On sauvegarde la piste et la position
       pour reprendre exactement où on s'était arrêté.

       Stockage : deux entrées dans localStorage (KEYS.TRACK et KEYS.MUSIC_TIME)
    ----------------------------------------------------------------------- */

    /**
     * Récupère l'état de la musique sauvegardé (piste et position).
     *
     * @returns {{ track: number, time: number }}
     *   - track : index de la piste dans la playlist (0 à 5)
     *   - time  : position en secondes dans la piste
     */
    function getMusicState() {
        return {
            track: parseInt(localStorage.getItem(KEYS.TRACK) || '0'),
            time:  parseFloat(localStorage.getItem(KEYS.MUSIC_TIME) || '0'),
        };
    }

    /**
     * Sauvegarde l'état actuel de la musique (appelé lors de chaque changement
     * de piste et avant de quitter la page via l'événement 'beforeunload').
     *
     * @param {number} track - Index de la piste courante dans la playlist
     * @param {number} time  - Position en secondes dans la piste courante
     */
    function setMusicState(track, time) {
        localStorage.setItem(KEYS.TRACK, track);
        localStorage.setItem(KEYS.MUSIC_TIME, time);
    }

    /* -----------------------------------------------------------------------
       EXPORT PUBLIC — Interface de DB accessible depuis app.js et les pages HTML
       -----------------------------------------------------------------------
       Seules les fonctions listées ci-dessous sont accessibles depuis l'extérieur.
       Les fonctions préfixées par _ (ex: _getSession, _simpleHash) sont privées
       et ne doivent pas être appelées directement depuis app.js.
    ----------------------------------------------------------------------- */
    return {
        // --- Options du jeu ---
        getOption,              // Lecture synchrone (utilise le cache)
        saveOption,             // Écriture synchrone (+ sync API en arrière-plan)
        getOptionAsync,         // Lecture asynchrone (depuis le serveur)
        saveOptionAsync,        // Écriture asynchrone (attend la confirmation serveur)
        syncOptionsFromServer,  // Télécharge toutes les options depuis le serveur

        // --- Progression par matière ---
        loadProgress,           // Charge la progression (async, API ou local)
        saveProgress,           // Sauvegarde la progression (async, toujours local + API si activé)

        // --- Niveau scolaire ---
        getNiveau,              // Lecture du niveau scolaire actuel
        setNiveau,              // Changement du niveau scolaire actuel

        // --- Authentification ---
        login,                  // Connexion par email/mot de passe
        register,               // Création d'un compte
        logout,                 // Déconnexion
        getCurrentUser,         // Infos du joueur connecté (ou null)
        isLoggedIn,             // Vérifie si connecté (boolean)

        // --- Musique ---
        getMusicState,          // Lit la piste et position sauvegardée
        setMusicState,          // Sauvegarde la piste et position courante

        // --- Badges (succès) ---
        getBadges,              // Liste des identifiants de badges débloqués
        unlockBadge,            // Débloque un badge (idempotent)

        // --- Quêtes (Phase 3.2) ---
        getDailyQuests: () => {
            try { return JSON.parse(localStorage.getItem(KEYS.QUESTS)) || null; }
            catch { return null; }
        },
        saveDailyQuests: (questsObj) => {
            localStorage.setItem(KEYS.QUESTS, JSON.stringify(questsObj));
        },

        // --- Membres / comptes locaux (panneau d'administration) ---
        listLocalMembers,       // Liste des comptes locaux (email, pseudo, rôle, date)
        createLocalMember,      // Crée un compte local
        updateLocalMember,      // Modifie pseudo / mot de passe / rôle d'un compte
        deleteLocalMember,      // Supprime un compte (protège le dernier admin)
        updateProfile,          // Modifie le profil du membre connecté

        // --- Informations de configuration (lecture seule) ---
        get useApi() { return USE_API; },   // true si le mode API est activé
        get apiUrl() { return API_URL; },   // URL de l'API (ou null)
    };

})(); // Le () à la fin exécute immédiatement la fonction et retourne l'objet DB
