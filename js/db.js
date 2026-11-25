/* ==========================================================================
   DB.JS — EDUQUEST v1.29.1
   Couche d'abstraction Base de Données (LocalStorage / API REST MySQL).

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
        OPTIONS: 'eduquest_options',        // Objet JSON de toutes les options du jeu
        NIVEAU: 'eduquest_niveau',          // Niveau scolaire sélectionné (ex: "6eme")
        FILIERE: 'eduquest_filiere',        // Filière / voie sélectionnée (ex: "generale", "stmg", "sti2d", "ciel", "nsi_spe", "st2s")
        TRACK: 'eduquest_current_track',   // Index de la piste audio en cours
        MUSIC_TIME: 'eduquest_music_time',      // Position (secondes) dans la piste en cours
        SESSION: 'eduquest_session',         // Session utilisateur connecté (token + username)
        QUESTS: 'eduquest_daily_quests',    // Quêtes journalières
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
            let data = null;
            try {
                if (res.status !== 204) data = await res.json();
            } catch {
                data = null;
            }
            return {
                ok: res.ok,                                          // true si HTTP 200-299
                data,                                                // réponse JSON du serveur
                error: res.ok ? null : ((data && data.message) || ('Erreur serveur (HTTP ' + res.status + ')'))
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
    let _sessionCacheRaw = undefined;
    let _sessionCacheVal = null;

    function _getSession() {
        try {
            const raw = localStorage.getItem(KEYS.SESSION);
            if (raw === _sessionCacheRaw) {
                return _sessionCacheVal ? { ..._sessionCacheVal } : null;
            }
            _sessionCacheRaw = raw;
            _sessionCacheVal = raw ? JSON.parse(raw) : null;
            return _sessionCacheVal ? { ..._sessionCacheVal } : null;
        } catch {
            _sessionCacheRaw = undefined;
            _sessionCacheVal = null;
            return null;
        }
    }

    function _setSession(session) {
        if (session) {
            // Connexion : on sauvegarde le token et les infos du joueur
            const serialized = JSON.stringify(session);
            try { localStorage.setItem(KEYS.SESSION, serialized); } catch { }
            _sessionCacheRaw = serialized;
            _sessionCacheVal = { ...session };
        } else {
            // Déconnexion : on supprime la session du localStorage
            try { localStorage.removeItem(KEYS.SESSION); } catch { }
            _sessionCacheRaw = null;
            _sessionCacheVal = null;
        }
    }

    /* -----------------------------------------------------------------------
       OPTIONS DU JEU
       -----------------------------------------------------------------------
       Les options sont les préférences de l'utilisateur : volume, particules,
       apparence, mode chrono, etc. Elles sont stockées en tant que paires clé/valeur.

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
     * @param {string} name - Nom de l'option (ex: 'volumeMusique', 'modeChrono')
     * @returns {string|null} La valeur de l'option (toujours une chaîne), ou null si non définie
     *
     * Exemples de noms d'options et valeurs :
     *   'volumeMusique' → '75'      (nombre entre 0 et 100, sous forme de string)
     *   'modeChrono'    → 'true'    (booléen sous forme de string)
     *   'particules'    → 'false'
     *   'sonsActifs'    → 'true'
     *   'musiqueActive' → 'true'
     *   'effetsActifs'  → 'true'
     *   'ecoMode'       → 'false'
     *   'volumeEffets'  → '80'
     */
    function _userScope() {
        const session = _getSession();
        if (session && session.email) {
            return 'u_' + String(session.email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        }
        return 'guest';
    }

    function _optionsKey() {
        return 'eduquest_opts_' + _userScope();
    }

    let _optsCacheKey = null;
    let _optsCacheRaw = undefined;
    let _optsCacheObj = null;

    function _readLocalOptions(key) {
        let raw = localStorage.getItem(key);
        if (!raw && _userScope() === 'guest') {
            const legacy = localStorage.getItem(KEYS.OPTIONS);
            if (legacy) {
                try { localStorage.setItem(key, legacy); } catch { }
                raw = legacy;
            }
        }
        if (key === _optsCacheKey && raw === _optsCacheRaw && _optsCacheObj) {
            return _optsCacheObj;
        }
        const parsed = JSON.parse(raw || '{}') || {};
        _optsCacheKey = key;
        _optsCacheRaw = raw;
        _optsCacheObj = parsed;
        return parsed;
    }

    function getOption(name) {
        if (USE_API) {
            const cache = _getOptionsCache();
            return (cache && Object.prototype.hasOwnProperty.call(cache, name)) ? cache[name] : null;
        }
        try {
            const options = _readLocalOptions(_optionsKey());
            return Object.prototype.hasOwnProperty.call(options, name) ? options[name] : null;
        } catch { return null; }
    }

    /**
     * Sauvegarde une option (version synchrone).
     * En mode API : mise à jour immédiate du cache local, puis sync async vers le serveur.
     * En mode local : écriture directe dans le localStorage isolé par utilisateur.
     */
    function saveOption(name, value) {
        if (USE_API) {
            const cache = _getOptionsCache();
            cache[name] = value;
            _setOptionsCache(cache);
            saveOptionAsync(name, value).catch(() => { });
            return;
        }
        try {
            const key = _optionsKey();
            const options = { ..._readLocalOptions(key) };
            options[name] = value;
            const serialized = JSON.stringify(options);
            localStorage.setItem(key, serialized);
            _optsCacheKey = key;
            _optsCacheRaw = serialized;
            _optsCacheObj = options;
        } catch { }
    }

    /**
     * Sauvegarde plusieurs options en une seule lecture/écriture localStorage.
     * @param {Record<string, string>} patch
     */
    function saveOptions(patch) {
        if (!patch || typeof patch !== 'object') return;
        const entries = Object.entries(patch);
        if (entries.length === 0) return;
        if (USE_API) {
            const cache = _getOptionsCache();
            entries.forEach(([k, v]) => {
                cache[k] = v;
                saveOptionAsync(k, v).catch(() => { });
            });
            _setOptionsCache(cache);
            return;
        }
        try {
            const key = _optionsKey();
            const options = { ..._readLocalOptions(key) };
            entries.forEach(([k, v]) => { options[k] = v; });
            const serialized = JSON.stringify(options);
            localStorage.setItem(key, serialized);
            _optsCacheKey = key;
            _optsCacheRaw = serialized;
            _optsCacheObj = options;
        } catch { }
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
        try { localStorage.setItem(KEYS.OPTIONS, JSON.stringify(cache)); } catch { }
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
        const mat = String(matiere || '').toLowerCase().trim();
        const niv = String(niveau || '6eme').toLowerCase().trim();
        return 'eduquest_prog_' + _userScope() + '_' + mat + '_' + niv;
    }

    /**
     * Charge la progression d'un joueur pour une matière et un niveau scolaire.
     */
    async function loadProgress(matiere, niveau) {
        if (USE_API) {
            const res = await apiRequest('GET',
                '/progression/' + encodeURIComponent(matiere) + '/' + encodeURIComponent(niveau)
            );
            if (res.ok && res.data) return res.data;
        }
        try {
            const key = _progressKey(matiere, niveau);
            let saved = localStorage.getItem(key);
            if (!saved && _userScope() === 'guest') {
                // Migration / repli depuis l'ancienne clé globale uniquement pour le profil invité
                const legacyKey = 'eduquest_' + String(matiere || '').toLowerCase() + '_' + niveau + '_progress';
                saved = localStorage.getItem(legacyKey);
                if (saved) {
                    try { localStorage.setItem(key, saved); } catch { }
                }
            }
            if (saved) return JSON.parse(saved);
        } catch { }
        return null;
    }

    /**
     * Sauvegarde la progression d'un joueur.
     */
    async function saveProgress(matiere, niveau, data) {
        try {
            localStorage.setItem(_progressKey(matiere, niveau), JSON.stringify(data));
        } catch { }

        if (USE_API) {
            return await apiRequest('POST', '/progression', { matiere, niveau, data });
        }
        return { ok: true };
    }

    /**
     * Lecture synchrone de la progression (utilisé par le dashboard pour l'état des matières).
     */
    function getProgressSync(matiere, niveau) {
        try {
            const key = _progressKey(matiere, niveau);
            let saved = localStorage.getItem(key);
            if (!saved && _userScope() === 'guest') {
                const legacyKey = 'eduquest_' + String(matiere || '').toLowerCase() + '_' + (niveau || '6eme') + '_progress';
                saved = localStorage.getItem(legacyKey);
                if (saved) {
                    try { localStorage.setItem(key, saved); } catch { }
                }
            }
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    }

    /* -----------------------------------------------------------------------
       NIVEAU SCOLAIRE SÉLECTIONNÉ
       -----------------------------------------------------------------------
       Détermine quel contenu est affiché (6ème → Terminale, BTS 1 & 2).
       Sélectionné sur le tableau de bord (dashboard.html) ou dans les options.
       Valeurs : '6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale', 'bts1', 'bts2'
    ----------------------------------------------------------------------- */

    function _niveauKey() {
        return 'eduquest_niveau_' + _userScope();
    }

    /**
     * Retourne le niveau scolaire actuellement sélectionné pour l'utilisateur courant.
     * @returns {string|null} Ex: '6eme', ou null si aucun niveau sélectionné
     */
    function getNiveau() {
        try {
            const scoped = localStorage.getItem(_niveauKey());
            if (scoped) return scoped;
            if (_userScope() === 'guest') return localStorage.getItem(KEYS.NIVEAU) || null;
            return null;
        } catch { return null; }
    }

    /**
     * Sauvegarde le niveau scolaire sélectionné (isolé par utilisateur).
     * En mode API, synchronise aussi l'option 'niveau_actuel' vers le serveur.
     *
     * @param {string} niveau - Ex: '6eme', '5eme'
     */
    function setNiveau(niveau) {
        try {
            localStorage.setItem(_niveauKey(), niveau);
            if (_userScope() === 'guest') {
                localStorage.setItem(KEYS.NIVEAU, niveau);
            }
        } catch { }
        if (USE_API) {
            // Synchronisation optionnelle vers le serveur
            saveOptionAsync('niveau_actuel', niveau).catch(() => { });
        }
    }

    /* -----------------------------------------------------------------------
       FILIÈRE / VOIE D'ÉTUDES SÉLECTIONNÉE (Lycée & BTS — 18 filières officielles)
       Ex : 'generale', 'nsi_spe', 'stmg', 'sti2d', 'ciel', 'st2s', 'stl', 'std2a',
            'sthr', 'stav', 's2tmd', 'hlp_llce', 'sciences_spe', 'bts_sio',
            'bts_mco', 'bts_cg', 'bac_pro_melec', 'bac_pro_assp'
    ----------------------------------------------------------------------- */

    function _filiereKey() {
        return 'eduquest_filiere_' + _userScope();
    }

    /**
     * Retourne la filière actuellement sélectionnée pour l'utilisateur courant.
     * @returns {string} Ex: 'generale', 'stmg', 'sti2d', 'ciel', 'nsi_spe', 'st2s'
     */
    function getFiliere() {
        try {
            const scoped = localStorage.getItem(_filiereKey());
            if (scoped) return scoped;
            if (_userScope() === 'guest') {
                return localStorage.getItem(KEYS.FILIERE) || 'generale';
            }
            return 'generale';
        } catch { return 'generale'; }
    }

    /**
     * Sauvegarde la filière / voie d'études sélectionnée (isolée par utilisateur).
     * @param {string} filiere
     */
    function setFiliere(filiere) {
        const clean = String(filiere || 'generale').toLowerCase().trim() || 'generale';
        try {
            localStorage.setItem(_filiereKey(), clean);
            if (_userScope() === 'guest') {
                localStorage.setItem(KEYS.FILIERE, clean);
            }
        } catch { }
        if (USE_API) {
            saveOptionAsync('filiere_actuelle', clean).catch(() => { });
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
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (USE_API) {
            const res = await apiRequest('POST', '/auth/login', { email: cleanEmail, password });
            if (res.ok && res.data && res.data.token) {
                // Sauvegarde de la session : token + infos du joueur (avec rôle serveur)
                _setSession({ token: res.data.token, username: res.data.username, email: cleanEmail, role: _normalizeRole(res.data.role) });
                // Chargement des options personnalisées depuis le serveur
                await syncOptionsFromServer();
            }
            return res.ok
                ? { ok: true, username: res.data && res.data.username }
                : { ok: false, error: res.error };
        }

        // Mode local : vérification dans le localStorage (insensible à la casse sur l'email, PBKDF2-SHA256 + migration auto)
        const users = _getLocalUsers();
        const matchEmail = (u) => String(u && u.email || '').trim().toLowerCase() === cleanEmail;
        const candidate = users.find(matchEmail);
        let user = null;

        if (candidate && candidate.password) {
            const check = await _verifyPassword(password, candidate.password);
            if (check.ok) {
                if (check.needsUpgrade) {
                    candidate.password = await _secureHash(password);
                    _setLocalUsers(users);
                }
                user = candidate;
            }
        }

        if (user) {
            const role = _normalizeRole(user.role);
            const sess = {
                token: 'local_' + _randomHex(16),
                username: user.username,
                email: user.email,
                role,
            };
            if (role === 'admin') {
                sess.adminProof = _computeAdminProof(user.email, user.password);
            }
            _setSession(sess);
            return { ok: true, username: user.username, role };
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
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanUser = String(username || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
            return { ok: false, error: 'Adresse e-mail invalide.' };
        }
        if (!cleanUser) {
            return { ok: false, error: 'Le pseudo ne peut pas être vide.' };
        }
        if (String(password || '').length < 6) {
            return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
        }
        if (USE_API) {
            const res = await apiRequest('POST', '/auth/register', { email: cleanEmail, username: cleanUser, password });
            if (res.ok && res.data && res.data.token) {
                // Connexion automatique après inscription réussie
                _setSession({ token: res.data.token, username: cleanUser, email: cleanEmail, role: _normalizeRole(res.data.role) });
            }
            return res.ok
                ? { ok: true, username: cleanUser }
                : { ok: false, error: res.error };
        }

        // Mode local : création simplifiée dans le localStorage (email normalisé insensible à la casse)
        const users = _getLocalUsers();
        if (users.some(u => String(u && u.email || '').trim().toLowerCase() === cleanEmail)) {
            return { ok: false, error: 'Cet email est déjà utilisé.' };
        }
        users.push({ email: cleanEmail, username: cleanUser, password: await _secureHash(password), role: 'eleve', created: new Date().toISOString() });
        _setLocalUsers(users);
        _setSession({ token: 'local_' + Date.now(), username: cleanUser, email: cleanEmail, role: 'eleve' });
        return { ok: true, username: cleanUser };
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
            await apiRequest('POST', '/auth/logout').catch(() => { });
        }
        lockAdminPanelSession();
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

    function unlockBadge(badgeId) {
        const badges = getBadges();
        if (badges.includes(badgeId)) return false;
        badges.push(badgeId);
        saveOption('dash_badges', JSON.stringify(badges));
        return true;
    }

    function lockBadge(badgeId) {
        const badges = getBadges().filter(b => b !== badgeId);
        saveOption('dash_badges', JSON.stringify(badges));
        return true;
    }

    function resetBadges() {
        saveOption('dash_badges', JSON.stringify([]));
        return true;
    }

    function setBadges(list) {
        saveOption('dash_badges', JSON.stringify(Array.isArray(list) ? list : []));
        return true;
    }

    /* -----------------------------------------------------------------------
       POTIONS ET BOOSTERS (Consommables)
       ----------------------------------------------------------------------- */
    function _boostersKey() {
        return 'eduquest_boosters_' + _userScope();
    }

    function _boostersHistoryKey() {
        return 'eduquest_boosters_history_' + _userScope();
    }

    function getBoosters() {
        try {
            return JSON.parse(localStorage.getItem(_boostersKey())) || {};
        } catch {
            return {};
        }
    }

    function getBoostersHistory() {
        try {
            return JSON.parse(localStorage.getItem(_boostersHistoryKey())) || { acquired: {}, used: {} };
        } catch {
            return { acquired: {}, used: {} };
        }
    }

    function _recordBoosterHistory(type, id, count = 1) {
        try {
            const num = parseInt(count, 10);
            if (!Number.isFinite(num) || num <= 0) return;
            const h = getBoostersHistory();
            if (!h.acquired) h.acquired = {};
            if (!h.used) h.used = {};
            if (type === 'acquired') {
                h.acquired[id] = (h.acquired[id] || 0) + num;
            } else if (type === 'used') {
                h.used[id] = (h.used[id] || 0) + num;
            }
            localStorage.setItem(_boostersHistoryKey(), JSON.stringify(h));
        } catch { }
    }

    function hasBooster(id) {
        return (getBoosters()[id] || 0) > 0;
    }

    function addBooster(id, count = 1) {
        const b = getBoosters();
        const delta = parseInt(count, 10);
        if (!Number.isFinite(delta) || delta <= 0) return b[id] || 0;
        b[id] = Math.max(0, (b[id] || 0) + delta);
        try { localStorage.setItem(_boostersKey(), JSON.stringify(b)); } catch { }
        _recordBoosterHistory('acquired', id, delta);
        return b[id];
    }

    function useBooster(id) {
        const b = getBoosters();
        if ((b[id] || 0) > 0) {
            b[id] -= 1;
            try { localStorage.setItem(_boostersKey(), JSON.stringify(b)); } catch { }
            _recordBoosterHistory('used', id, 1);
            return true;
        }
        return false;
    }

    /* -----------------------------------------------------------------------
       SYSTÈME DE STREAK & COMBOS (Multiplicateurs de Score & XP)
       ----------------------------------------------------------------------- */
    function _streakKey() {
        return 'eduquest_streak_' + _userScope();
    }

    function getStreakData() {
        try {
            const raw = localStorage.getItem(_streakKey());
            if (raw) return JSON.parse(raw);
        } catch { }
        return { count: 0, best: 0, combo: 0, maxCombo: 0, lastPlayedDate: null };
    }

    function _saveStreakData(data) {
        try { localStorage.setItem(_streakKey(), JSON.stringify(data)); } catch { }
    }

    function getStreak() {
        return getStreakData().count || 0;
    }

    function getCombo() {
        return getStreakData().combo || 0;
    }

    function getMultiplier(comboVal) {
        const c = typeof comboVal === 'number' ? comboVal : getCombo();
        if (c <= 1) return 1.0;
        if (c === 2) return 1.2;
        if (c === 3) return 1.4;
        if (c === 4) return 1.6;
        if (c < 10) return 2.0;
        return 2.5;
    }

    function recordCorrectAnswer() {
        const s = getStreakData();
        s.combo = (s.combo || 0) + 1;
        if (s.combo > (s.maxCombo || 0)) s.maxCombo = s.combo;
        _saveStreakData(s);
        return {
            combo: s.combo,
            multiplier: getMultiplier(s.combo),
            maxCombo: s.maxCombo
        };
    }

    function recordWrongAnswer(protectedByShield = false) {
        const s = getStreakData();
        if (protectedByShield) {
            return {
                combo: s.combo || 0,
                streak: s.count || 0,
                multiplier: getMultiplier(s.combo || 0),
                shieldSaved: true
            };
        }
        s.combo = 0;
        s.count = 0; // Remise à zéro de la série de victoires en cas d'erreur
        _saveStreakData(s);
        return {
            combo: 0,
            streak: 0,
            multiplier: 1.0,
            shieldSaved: false
        };
    }

    function recordLevelVictory() {
        const s = getStreakData();
        s.count = (s.count || 0) + 1;
        if (s.count > (s.best || 0)) s.best = s.count;
        s.lastPlayedDate = new Date().toISOString().slice(0, 10);
        _saveStreakData(s);
        return {
            streak: s.count,
            best: s.best,
            combo: s.combo || 0,
            maxCombo: s.maxCombo || 0,
            multiplier: getMultiplier(s.combo || 0)
        };
    }

    function resetStreak() {
        const s = getStreakData();
        s.count = 0;
        s.combo = 0;
        _saveStreakData(s);
        return s;
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
        try { localStorage.setItem('eduquest_local_users', JSON.stringify(users)); } catch { }
    }

    function _randomHex(byteLen = 16) {
        const bytes = new Uint8Array(byteLen);
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < byteLen; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function _hexToBytes(hex) {
        const clean = String(hex || '');
        const out = new Uint8Array(Math.floor(clean.length / 2));
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
        }
        return out;
    }

    function _constantTimeEqual(a, b) {
        const sa = String(a || '');
        const sb = String(b || '');
        let diff = sa.length ^ sb.length;
        const len = Math.max(sa.length, sb.length);
        for (let i = 0; i < len; i++) {
            diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
        }
        return diff === 0;
    }

    async function _sha256Hex(str) {
        if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
            try {
                const encoded = new TextEncoder().encode(String(str || ''));
                const buf = await crypto.subtle.digest('SHA-256', encoded);
                return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch { }
        }
        return null;
    }

    function _fallbackHash(str) {
        let h1 = 0x811c9dc5, h2 = 0x6c62272e;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 0x01000193);
            h2 = Math.imul(h2 ^ (ch + i), 0x5bd1e995);
        }
        return 'sh_fb_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Hash sécurisé PBKDF2-SHA256 avec sel aléatoire par utilisateur (100 000 itérations).
     * Repli propre vers SHA-256 salé / fallback en contexte HTTP non sécurisé.
     *
     * @param {string} str - Secret / mot de passe en clair
     * @param {string} [explicitSaltHex] - Sel hex optionnel (pour vérification)
     * @returns {Promise<string>} Ex: 'pbkdf2_<salt>_<derivedHex>'
     */
    async function _secureHash(str, explicitSaltHex = null) {
        const saltHex = explicitSaltHex || _randomHex(16);
        if (typeof crypto !== 'undefined' && crypto.subtle
            && typeof crypto.subtle.importKey === 'function'
            && typeof crypto.subtle.deriveBits === 'function') {
            try {
                const enc = new TextEncoder();
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    enc.encode(String(str || '')),
                    { name: 'PBKDF2' },
                    false,
                    ['deriveBits']
                );
                const bits = await crypto.subtle.deriveBits(
                    { name: 'PBKDF2', salt: _hexToBytes(saltHex), iterations: 100000, hash: 'SHA-256' },
                    keyMaterial,
                    256
                );
                const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
                return 'pbkdf2_' + saltHex + '_' + hex;
            } catch { }
        }
        const sha = await _sha256Hex(saltHex + ':' + String(str || ''));
        if (sha) return 'sh2_' + saltHex + '_' + sha;
        return _fallbackHash(saltHex + ':' + String(str || '')).replace('sh_fb_', 'shfb2_' + saltHex + '_');
    }

    /**
     * Vérifie un secret contre un hash stocké (PBKDF2, SHA-256 salé, SHA-256 legacy ou hash 32-bit legacy).
     * Indique `needsUpgrade: true` si le hash provient d'un ancien format à migrer vers PBKDF2.
     */
    async function _verifyPassword(password, storedHash) {
        const stored = String(storedHash || '');
        if (!stored) return { ok: false, needsUpgrade: false };

        if (stored.startsWith('pbkdf2_')) {
            const parts = stored.split('_');
            if (parts.length !== 3) return { ok: false, needsUpgrade: false };
            const derived = await _secureHash(password, parts[1]);
            return { ok: _constantTimeEqual(derived, stored), needsUpgrade: false };
        }
        if (stored.startsWith('sh2_')) {
            const parts = stored.split('_');
            if (parts.length !== 3) return { ok: false, needsUpgrade: false };
            const sha = await _sha256Hex(parts[1] + ':' + String(password || ''));
            return { ok: Boolean(sha && _constantTimeEqual('sh2_' + parts[1] + '_' + sha, stored)), needsUpgrade: true };
        }
        if (stored.startsWith('shfb2_')) {
            const parts = stored.split('_');
            if (parts.length !== 3) return { ok: false, needsUpgrade: false };
            const fb = _fallbackHash(parts[1] + ':' + String(password || '')).replace('sh_fb_', 'shfb2_' + parts[1] + '_');
            return { ok: _constantTimeEqual(fb, stored), needsUpgrade: true };
        }
        if (stored.startsWith('sh_fb_')) {
            return { ok: _constantTimeEqual(_fallbackHash(password), stored), needsUpgrade: true };
        }
        if (stored.startsWith('sh_')) {
            const sha = await _sha256Hex(password);
            return { ok: Boolean(sha && _constantTimeEqual('sh_' + sha, stored)), needsUpgrade: true };
        }
        if (stored.startsWith('lh_')) {
            return { ok: _constantTimeEqual(_legacyHash(password), stored), needsUpgrade: true };
        }
        return { ok: false, needsUpgrade: false };
    }

    /**
     * Empreinte d'intégrité de session admin liée à l'e-mail et au hash de mot de passe stocké.
     * Empêche l'usurpation simple de `eduquest_session` par modification de `role: "admin"` en console.
     */
    function _computeAdminProof(email, storedPasswordHash) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        return _fallbackHash('eq-adm-proof::' + cleanEmail + '::' + String(storedPasswordHash || ''));
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
       SÉCURITÉ DU PANNEAU D'ADMINISTRATION (v1.30.1)
       - Politique de mot de passe robuste pour les comptes admin (≥ 8 car., lettre + chiffre)
       - Vérification croisée de la session admin (anti-usurpation localStorage)
       - Session panneau isolée à l'onglet (sessionStorage) + verrouillage auto par inactivité
       - Limitation anti-force brute avec blocage progressif (5 échecs → 60s / 5min / 15min)
       - Code PIN secondaire d'administration optionnel (hashé PBKDF2, hors export AdminStore)
       - Journal d'audit des connexions et opérations sensibles
       ----------------------------------------------------------------------- */
    const ADMIN_SEC_KEYS = {
        PANEL_LOCK: 'eduquest_admin_panel_lock', // sessionStorage uniquement (verrouillé à la fermeture de l'onglet)
        LOCKOUT: 'eduquest_admin_lockout',       // localStorage (persiste contre F5)
        SECURITY: 'eduquest_admin_security',     // localStorage (PIN hashé + délai d'inactivité)
        AUDIT: 'eduquest_admin_audit',           // localStorage (50 derniers événements)
    };
    const ADMIN_MAX_ATTEMPTS = 5;
    let _memPanelLock = null;

    function _getSessionStore() {
        try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage;
        } catch { }
        return null;
    }

    function validateAdminPassword(password) {
        const pw = String(password || '');
        if (pw.length < 8) {
            return { ok: false, error: 'Mot de passe administrateur trop court (8 caractères minimum).' };
        }
        if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/[0-9]/.test(pw)) {
            return { ok: false, error: 'Le mot de passe administrateur doit contenir au moins une lettre et un chiffre.' };
        }
        const weak = ['password1', 'admin123', 'admin1234', '12345678', 'azerty12', 'azerty123', 'qwerty12', 'eduquest1'];
        if (weak.includes(pw.toLowerCase())) {
            return { ok: false, error: 'Ce mot de passe est trop courant. Choisissez un mot de passe plus robuste.' };
        }
        return { ok: true };
    }

    function _readAdminSecurityRaw() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ADMIN_SEC_KEYS.SECURITY) || '{}') || {};
            return {
                pinEnabled: Boolean(parsed.pinEnabled && parsed.pinHash),
                pinHash: typeof parsed.pinHash === 'string' ? parsed.pinHash : '',
                inactivityMinutes: Math.min(120, Math.max(1, parseInt(parsed.inactivityMinutes, 10) || 15)),
            };
        } catch {
            return { pinEnabled: false, pinHash: '', inactivityMinutes: 15 };
        }
    }

    function _writeAdminSecurityRaw(obj) {
        try { localStorage.setItem(ADMIN_SEC_KEYS.SECURITY, JSON.stringify(obj)); } catch { }
    }

    function getAdminSecurityConfig() {
        const raw = _readAdminSecurityRaw();
        return {
            pinEnabled: raw.pinEnabled,
            inactivityMinutes: raw.inactivityMinutes,
        };
    }

    async function setAdminPin(pin) {
        const clean = String(pin || '').trim();
        if (clean.length < 4 || clean.length > 32) {
            return { ok: false, error: 'Le code PIN d’accès doit contenir entre 4 et 32 caractères.' };
        }
        const raw = _readAdminSecurityRaw();
        raw.pinHash = await _secureHash(clean);
        raw.pinEnabled = true;
        _writeAdminSecurityRaw(raw);
        appendAdminAudit('pin_enabled', 'Code PIN administrateur activé/mis à jour');
        return { ok: true };
    }

    function disableAdminPin() {
        const raw = _readAdminSecurityRaw();
        raw.pinHash = '';
        raw.pinEnabled = false;
        _writeAdminSecurityRaw(raw);
        appendAdminAudit('pin_disabled', 'Code PIN administrateur désactivé');
        return { ok: true };
    }

    async function verifyAdminPin(pin) {
        const raw = _readAdminSecurityRaw();
        if (!raw.pinEnabled || !raw.pinHash) return { ok: true };
        const res = await _verifyPassword(String(pin || '').trim(), raw.pinHash);
        return { ok: res.ok };
    }

    function setAdminInactivityMinutes(mins) {
        const n = Math.min(120, Math.max(1, parseInt(mins, 10) || 15));
        const raw = _readAdminSecurityRaw();
        raw.inactivityMinutes = n;
        _writeAdminSecurityRaw(raw);
        appendAdminAudit('timeout_updated', `Verrouillage automatique réglé sur ${n} min`);
        return { ok: true, inactivityMinutes: n };
    }

    /** Vérifie de manière croisée que la session courante appartient réellement à un admin existant. */
    function verifyAdminSession() {
        const session = _getSession();
        if (!session || session.role !== 'admin') {
            return { ok: false, reason: 'not_admin' };
        }
        if (USE_API) {
            if (!session.token) return { ok: false, reason: 'missing_token' };
            return { ok: true, user: { username: session.username, email: session.email, role: 'admin' } };
        }
        const cleanEmail = String(session.email || '').trim().toLowerCase();
        const users = _getLocalUsers();
        const realUser = users.find(u => String(u && u.email || '').trim().toLowerCase() === cleanEmail);
        if (!realUser || _normalizeRole(realUser.role) !== 'admin') {
            return { ok: false, reason: 'invalid_account' };
        }
        const expectedProof = _computeAdminProof(realUser.email, realUser.password);
        if (!session.adminProof || !_constantTimeEqual(session.adminProof, expectedProof)) {
            return { ok: false, reason: 'invalid_proof' };
        }
        return { ok: true, user: { username: realUser.username, email: realUser.email, role: 'admin' }, proof: expectedProof };
    }

    function _readPanelLock() {
        const store = _getSessionStore();
        try {
            const raw = store ? store.getItem(ADMIN_SEC_KEYS.PANEL_LOCK) : _memPanelLock;
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function _writePanelLock(obj) {
        const serialized = obj ? JSON.stringify(obj) : null;
        const store = _getSessionStore();
        _memPanelLock = serialized;
        try {
            if (store) {
                if (serialized) store.setItem(ADMIN_SEC_KEYS.PANEL_LOCK, serialized);
                else store.removeItem(ADMIN_SEC_KEYS.PANEL_LOCK);
            }
        } catch { }
    }

    function openAdminPanelSession() {
        const verified = verifyAdminSession();
        if (!verified.ok) return { ok: false, reason: verified.reason };
        const now = Date.now();
        _writePanelLock({
            email: verified.user.email,
            proof: verified.proof || 'api',
            token: _randomHex(16),
            openedAt: now,
            lastActivityAt: now,
        });
        return { ok: true, user: verified.user };
    }

    function lockAdminPanelSession() {
        _writePanelLock(null);
    }

    function touchAdminPanelSession() {
        const lock = _readPanelLock();
        if (!lock) return false;
        lock.lastActivityAt = Date.now();
        _writePanelLock(lock);
        return true;
    }

    function checkAdminPanelSession() {
        const verified = verifyAdminSession();
        if (!verified.ok) {
            lockAdminPanelSession();
            return { ok: false, reason: verified.reason };
        }
        const lock = _readPanelLock();
        if (!lock || String(lock.email || '').toLowerCase() !== String(verified.user.email || '').toLowerCase()) {
            return { ok: false, reason: 'locked' };
        }
        if (!USE_API && (!lock.proof || !_constantTimeEqual(lock.proof, verified.proof))) {
            lockAdminPanelSession();
            return { ok: false, reason: 'invalid_proof' };
        }
        const timeoutMs = _readAdminSecurityRaw().inactivityMinutes * 60 * 1000;
        if (Date.now() - (Number(lock.lastActivityAt) || 0) > timeoutMs) {
            lockAdminPanelSession();
            appendAdminAudit('lock_auto', 'Session admin verrouillée après inactivité');
            return { ok: false, reason: 'expired' };
        }
        return { ok: true, user: verified.user };
    }

    function _readLockout() {
        try {
            const p = JSON.parse(localStorage.getItem(ADMIN_SEC_KEYS.LOCKOUT) || '{}') || {};
            return {
                attempts: Math.max(0, parseInt(p.attempts, 10) || 0),
                strikes: Math.max(0, parseInt(p.strikes, 10) || 0),
                lockedUntil: Math.max(0, parseInt(p.lockedUntil, 10) || 0),
            };
        } catch {
            return { attempts: 0, strikes: 0, lockedUntil: 0 };
        }
    }

    function _writeLockout(obj) {
        try { localStorage.setItem(ADMIN_SEC_KEYS.LOCKOUT, JSON.stringify(obj)); } catch { }
    }

    function getAdminLockoutStatus() {
        const st = _readLockout();
        const now = Date.now();
        const remainingMs = st.lockedUntil > now ? (st.lockedUntil - now) : 0;
        return {
            locked: remainingMs > 0,
            remainingMs,
            attempts: st.attempts,
            maxAttempts: ADMIN_MAX_ATTEMPTS,
            strikes: st.strikes,
        };
    }

    function recordAdminLoginFailure(email = '') {
        const st = _readLockout();
        const now = Date.now();
        if (st.lockedUntil > now) {
            return getAdminLockoutStatus();
        }
        st.attempts += 1;
        if (st.attempts >= ADMIN_MAX_ATTEMPTS) {
            st.strikes += 1;
            const durationSec = st.strikes === 1 ? 60 : (st.strikes === 2 ? 300 : 900);
            st.lockedUntil = now + durationSec * 1000;
            st.attempts = 0;
            appendAdminAudit('lockout', `Blocage anti-force brute (${durationSec}s) après 5 échecs${email ? ' (' + String(email).slice(0, 60) + ')' : ''}`);
        } else {
            appendAdminAudit('login_fail', `Échec de connexion admin (${st.attempts}/${ADMIN_MAX_ATTEMPTS})${email ? ' — ' + String(email).slice(0, 60) : ''}`);
        }
        _writeLockout(st);
        return getAdminLockoutStatus();
    }

    function clearAdminLoginFailures() {
        try { localStorage.removeItem(ADMIN_SEC_KEYS.LOCKOUT); } catch { }
    }

    function getAdminAuditLog() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ADMIN_SEC_KEYS.AUDIT) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    function appendAdminAudit(action, detail = '') {
        try {
            const log = getAdminAuditLog();
            const cur = _getSession();
            log.unshift({
                ts: new Date().toISOString(),
                actor: (cur && cur.email) ? String(cur.email).slice(0, 80) : 'anonyme',
                action: String(action || 'event').slice(0, 40),
                detail: String(detail || '').slice(0, 200),
            });
            if (log.length > 50) log.length = 50;
            localStorage.setItem(ADMIN_SEC_KEYS.AUDIT, JSON.stringify(log));
        } catch { }
    }

    function clearAdminAuditLog() {
        try { localStorage.removeItem(ADMIN_SEC_KEYS.AUDIT); } catch { }
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

    function _scopeForEmail(email) {
        return 'u_' + String(email || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    /** Lit les statistiques locales (classe, filière, XP, pièces, badges) d'un compte donné. */
    function getLocalMemberStats(email) {
        const scope = _scopeForEmail(email);
        let opts = {};
        try { opts = JSON.parse(localStorage.getItem('eduquest_opts_' + scope) || '{}'); } catch { }
        const niveau = (function () {
            try { return localStorage.getItem('eduquest_niveau_' + scope) || '6eme'; } catch { return '6eme'; }
        })();
        const filiere = (function () {
            try { return localStorage.getItem('eduquest_filiere_' + scope) || 'generale'; } catch { return 'generale'; }
        })();
        let badges = [];
        try { badges = JSON.parse(opts.dash_badges || '[]'); } catch { }
        return {
            niveau,
            filiere,
            xp: parseInt(opts.dash_xp || '0', 10) || 0,
            coins: parseInt(opts.dash_coins || '30', 10) || 0,
            badgesCount: Array.isArray(badges) ? badges.length : 0,
        };
    }

    function _purgeLocalScope(scope, includeOptions = true) {
        try {
            const remove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                const isProgressOrData =
                    k.startsWith('eduquest_prog_' + scope) ||
                    k.startsWith('eduquest_attempts_' + scope) ||
                    k.startsWith('eduquest_adaptive_' + scope) ||
                    k === 'eduquest_streak_' + scope ||
                    k === 'eduquest_quests_' + scope ||
                    k === 'eduquest_boosters_' + scope ||
                    k === 'eduquest_boosters_history_' + scope;
                const isAccountMeta = includeOptions && (
                    k === 'eduquest_opts_' + scope ||
                    k === 'eduquest_niveau_' + scope ||
                    k === 'eduquest_filiere_' + scope
                );
                if (isProgressOrData || isAccountMeta) remove.push(k);
            }
            remove.forEach(k => localStorage.removeItem(k));
        } catch { }
    }

    /** Met à jour la classe, la filière, l'XP ou les pièces d'un compte local (panneau admin). */
    function updateLocalMemberData(email, patch = {}) {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les données depuis votre backend.' };
        const cleanMail = String(email || '').trim().toLowerCase();
        const users = _getLocalUsers();
        const target = users.find(u => String(u && u.email || '').trim().toLowerCase() === cleanMail);
        if (!target) return { ok: false, error: 'Compte introuvable.' };
        const scope = _scopeForEmail(target.email);
        try {
            if (typeof patch.niveau === 'string' && patch.niveau.trim()) {
                localStorage.setItem('eduquest_niveau_' + scope, patch.niveau.trim());
            }
            if (typeof patch.filiere === 'string' && patch.filiere.trim()) {
                localStorage.setItem('eduquest_filiere_' + scope, patch.filiere.trim().toLowerCase());
            }
            if (patch.xp !== undefined || patch.coins !== undefined || patch.resetProgress) {
                const optKey = 'eduquest_opts_' + scope;
                let opts = {};
                try { opts = JSON.parse(localStorage.getItem(optKey) || '{}'); } catch { }
                if (patch.resetProgress) {
                    opts.dash_xp = '0';
                    opts.dash_coins = '30';
                    opts.dash_badges = '[]';
                    _purgeLocalScope(scope, false);
                } else {
                    if (patch.xp !== undefined) opts.dash_xp = String(Math.max(0, parseInt(patch.xp, 10) || 0));
                    if (patch.coins !== undefined) opts.dash_coins = String(Math.max(0, parseInt(patch.coins, 10) || 0));
                }
                localStorage.setItem(optKey, JSON.stringify(opts));
            }
        } catch {
            return { ok: false, error: 'Impossible de modifier le stockage local.' };
        }
        return { ok: true, stats: getLocalMemberStats(target.email) };
    }

    /** Liste des comptes locaux (sans le mot de passe, avec rôle, création et statistiques). */
    async function listLocalMembers() {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const data = _getLocalUsers().map(u => {
            const stats = getLocalMemberStats(u.email);
            return {
                email: u.email,
                username: u.username,
                role: u.role || 'eleve',
                created: u.created || null,
                niveau: stats.niveau,
                filiere: stats.filiere,
                xp: stats.xp,
                coins: stats.coins,
                badgesCount: stats.badgesCount,
            };
        });
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
        const cleanMail = String(email || '').trim().toLowerCase();
        const users = _getLocalUsers();
        const idx = users.findIndex(u => String(u && u.email || '').trim().toLowerCase() === cleanMail);
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

    /** Supprime un compte local et purge ses données locales (RGPD — droit à l'effacement). */
    async function deleteLocalMember(email) {
        if (USE_API) return { ok: false, error: 'Mode API SQL : gérez les membres depuis votre backend.' };
        const cleanMail = String(email || '').trim().toLowerCase();
        const users = _getLocalUsers();
        const idx = users.findIndex(u => String(u && u.email || '').trim().toLowerCase() === cleanMail);
        if (idx === -1) return { ok: false, error: 'Compte introuvable.' };
        if ((users[idx].role || 'eleve') === 'admin' && _countAdmins(users) <= 1) {
            return { ok: false, error: 'Impossible de supprimer le dernier administrateur.' };
        }
        const removedEmail = users[idx].email;
        users.splice(idx, 1);
        _setLocalUsers(users);
        // Effacement RGPD complet des données locales du compte supprimé
        _purgeLocalScope(_scopeForEmail(removedEmail), true);
        // Si le compte supprimé était celui connecté sur cet appareil, on coupe la session
        const session = _getSession();
        if (session && String(session.email || '').trim().toLowerCase() === cleanMail) _setSession(null);
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
        // Actualise la session (le token reste valide, le pseudo et la preuve admin sont mis à jour)
        const nextSess = { ...session, username: user.username };
        if (_normalizeRole(user.role) === 'admin') {
            nextSess.adminProof = _computeAdminProof(user.email, user.password);
        }
        _setSession(nextSess);
        if (_normalizeRole(user.role) === 'admin' && _readPanelLock()) {
            openAdminPanelSession();
        }
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
        try {
            return {
                track: parseInt(localStorage.getItem(KEYS.TRACK) || '0', 10) || 0,
                time: parseFloat(localStorage.getItem(KEYS.MUSIC_TIME) || '0') || 0,
            };
        } catch {
            return { track: 0, time: 0 };
        }
    }

    /**
     * Sauvegarde l'état actuel de la musique (appelé lors de chaque changement
     * de piste et avant de quitter la page via l'événement 'beforeunload').
     *
     * @param {number} track - Index de la piste courante dans la playlist
     * @param {number} time  - Position en secondes dans la piste courante
     */
    function setMusicState(track, time) {
        try {
            localStorage.setItem(KEYS.TRACK, String(track));
            localStorage.setItem(KEYS.MUSIC_TIME, String(time));
        } catch { }
    }

    /* -----------------------------------------------------------------------
       EXPORT PUBLIC — Interface de DB accessible depuis app.js et les pages HTML
       -----------------------------------------------------------------------
       Seules les fonctions listées ci-dessous sont accessibles depuis l'extérieur.
       Les fonctions préfixées par _ (ex: _getSession, _simpleHash) sont privées
       et ne doivent pas être appelées directement depuis app.js.
    ----------------------------------------------------------------------- */
    function _questsKey() {
        return 'eduquest_quests_' + _userScope();
    }

    function getDailyQuests() {
        try {
            const key = _questsKey();
            let raw = localStorage.getItem(key);
            if (!raw && _userScope() === 'guest') {
                raw = localStorage.getItem(KEYS.QUESTS);
                if (raw) {
                    try { localStorage.setItem(key, raw); } catch { }
                }
            }
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function saveDailyQuests(questsObj) {
        try {
            localStorage.setItem(_questsKey(), JSON.stringify(questsObj));
            if (_userScope() === 'guest') {
                localStorage.setItem(KEYS.QUESTS, JSON.stringify(questsObj));
            }
        } catch { }
    }

    /* -----------------------------------------------------------------------
       SUIVI ANTI-TRICHE DES TENTATIVES PAR NIVEAU (v1.27.0)
       Persiste les erreurs et le sel de réinitialisation des questions par
       niveau pour empêcher de récupérer 3 étoiles via retour de page / F5.
       ----------------------------------------------------------------------- */
    function _attemptsKey() {
        return 'eduquest_attempts_' + _userScope();
    }

    function _attemptSlot(subjectKey, niveau, levelNum) {
        const s = String(subjectKey || '').toLowerCase().trim();
        const n = String(niveau || '6eme').toLowerCase().trim();
        const l = Number(levelNum) || 0;
        return s + '::' + n + '::' + l;
    }

    function _readAttemptsMap() {
        try { return JSON.parse(localStorage.getItem(_attemptsKey()) || '{}') || {}; }
        catch { return {}; }
    }

    function _writeAttemptsMap(map) {
        try { localStorage.setItem(_attemptsKey(), JSON.stringify(map || {})); } catch { }
    }

    function _parseAttemptEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return { fails: 0, usedShield: false, questionSalt: 0, failedSignatures: [], lastFailedSig: null, lastProviderId: null };
        }
        const sigs = Array.isArray(entry.failedSignatures)
            ? entry.failedSignatures.filter(Boolean)
            : (entry.lastFailedSig ? [entry.lastFailedSig] : []);
        return {
            fails: Math.max(0, parseInt(entry.fails, 10) || 0),
            usedShield: Boolean(entry.usedShield),
            questionSalt: Math.max(0, parseInt(entry.questionSalt, 10) || 0),
            failedSignatures: sigs,
            lastFailedSig: sigs[sigs.length - 1] || entry.lastFailedSig || null,
            lastProviderId: entry.lastProviderId || null,
        };
    }

    function getLevelAttempt(subjectKey, niveau, levelNum) {
        const map = _readAttemptsMap();
        return _parseAttemptEntry(map[_attemptSlot(subjectKey, niveau, levelNum)]);
    }

    function recordLevelFailure(subjectKey, niveau, levelNum, opts = {}) {
        const map = _readAttemptsMap();
        const slot = _attemptSlot(subjectKey, niveau, levelNum);
        const cur = _parseAttemptEntry(map[slot]);
        const newSig = opts.failedSignature || opts.questionSig || '';
        const sigs = cur.failedSignatures.slice();
        if (newSig && !sigs.includes(newSig)) {
            sigs.push(newSig);
            if (sigs.length > 20) sigs.splice(0, sigs.length - 20);
        }
        const updated = {
            fails: cur.fails + 1,
            usedShield: Boolean(cur.usedShield || opts.usedShield || opts.shieldAbsorbed),
            questionSalt: cur.questionSalt + 1,
            failedSignatures: sigs,
            lastFailedSig: newSig || cur.lastFailedSig || null,
            lastProviderId: opts.providerId || cur.lastProviderId || null,
            updatedAt: Date.now(),
        };
        map[slot] = updated;
        _writeAttemptsMap(map);
        return updated;
    }

    function clearLevelAttempt(subjectKey, niveau, levelNum) {
        const map = _readAttemptsMap();
        const slot = _attemptSlot(subjectKey, niveau, levelNum);
        if (Object.prototype.hasOwnProperty.call(map, slot)) {
            delete map[slot];
            _writeAttemptsMap(map);
        }
    }

    function clearSubjectAttempts(subjectKey, niveau) {
        const map = _readAttemptsMap();
        const prefix = String(subjectKey || '').toLowerCase().trim() + '::' + String(niveau || '6eme').toLowerCase().trim() + '::';
        let changed = false;
        Object.keys(map).forEach(k => {
            if (k.startsWith(prefix)) {
                delete map[k];
                changed = true;
            }
        });
        if (changed) _writeAttemptsMap(map);
    }

    /* -----------------------------------------------------------------------
       PROFIL ADAPTATIF & HISTORIQUE ANTI-RÉPÉTITION (v1.27.0)
       ----------------------------------------------------------------------- */
    function _adaptiveKey() {
        return 'eduquest_adaptive_' + _userScope();
    }

    function getAdaptiveState() {
        try { return JSON.parse(localStorage.getItem(_adaptiveKey()) || '{}') || {}; }
        catch { return {}; }
    }

    function saveAdaptiveState(data) {
        try { localStorage.setItem(_adaptiveKey(), JSON.stringify(data || {})); } catch { }
    }

    /* -----------------------------------------------------------------------
       EXPORT PUBLIC — Interface de DB accessible depuis app.js et les pages HTML
       ----------------------------------------------------------------------- */
    return {
        // --- Options du jeu ---
        getOption,              // Lecture synchrone (utilise le cache)
        saveOption,             // Écriture synchrone (+ sync API en arrière-plan)
        saveOptions,            // Écriture groupée en un seul cycle localStorage
        getOptionAsync,         // Lecture asynchrone (depuis le serveur)
        saveOptionAsync,        // Écriture asynchrone (attend la confirmation serveur)
        syncOptionsFromServer,  // Télécharge toutes les options depuis le serveur

        // --- Progression par matière ---
        loadProgress,           // Charge la progression (async, API ou local)
        saveProgress,           // Sauvegarde la progression (async, toujours local + API si activé)
        getProgressSync,        // Lecture synchrone de la progression isolée par utilisateur

        // --- Niveau scolaire & Filière ---
        getNiveau,              // Lecture du niveau scolaire actuel
        setNiveau,              // Changement du niveau scolaire actuel
        getFiliere,             // Lecture de la filière / voie actuelle (Générale, STMG, STI2D, CIEL, NSI, ST2S)
        setFiliere,             // Changement de la filière / voie actuelle

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
        lockBadge,              // Retire un badge (panneau admin)
        resetBadges,            // Réinitialise tous les badges
        setBadges,              // Définit la liste exacte

        // --- Potions et Boosters consommables ---
        getBoosters,            // Inventaire des potions : { 'pot-boost': 2, 'pot-shield': 1 }
        getBoostersHistory,     // Historique cumulé des potions acquises et consommées
        hasBooster,             // Vérifie si au moins 1 potion est possédée
        addBooster,             // Ajoute une ou plusieurs potions
        useBooster,             // Consomme 1 potion (retourne true si consommée)

        // --- Système de Streak & Combos (Multiplicateurs de Score & XP) ---
        getStreakData,          // Données complètes de série et de combo
        getStreak,              // Nombre de victoires consécutives actuelles
        getCombo,               // Nombre de bonnes réponses consécutives actuelles
        getMultiplier,          // Multiplicateur de score et d'XP en fonction du combo (ex: 1.5)
        recordCorrectAnswer,    // Enregistre une bonne réponse (+1 combo)
        recordWrongAnswer,      // Enregistre une erreur (reset combo sauf si protégé)
        recordLevelVictory,     // Enregistre un niveau réussi (+1 streak)
        resetStreak,            // Réinitialise série et combo

        // --- Quêtes (isolées par compte) ---
        getDailyQuests,
        saveDailyQuests,

        // --- Anti-triche tentatives & réinitialisation questions (v1.27.0) ---
        getLevelAttempt,
        recordLevelFailure,
        clearLevelAttempt,
        clearSubjectAttempts,

        // --- Profil adaptatif & anti-répétition (v1.27.0) ---
        getAdaptiveState,
        saveAdaptiveState,

        // --- Membres / comptes locaux (panneau d'administration) ---
        listLocalMembers,       // Liste des comptes locaux (email, pseudo, rôle, date, classe, filière, XP, pièces)
        getLocalMemberStats,    // Lit classe, filière, XP, pièces et badges d'un compte local
        updateLocalMemberData,  // Modifie classe, filière, XP, pièces ou réinitialise la progression d'un compte local
        createLocalMember,      // Crée un compte local
        updateLocalMember,      // Modifie pseudo / mot de passe / rôle d'un compte
        deleteLocalMember,      // Supprime un compte (protège le dernier admin)
        updateProfile,          // Modifie le profil du membre connecté

        // --- Sécurité du panneau d'administration (v1.30.1) ---
        validateAdminPassword,
        verifyAdminSession,
        openAdminPanelSession,
        lockAdminPanelSession,
        touchAdminPanelSession,
        checkAdminPanelSession,
        getAdminLockoutStatus,
        recordAdminLoginFailure,
        clearAdminLoginFailures,
        getAdminSecurityConfig,
        setAdminPin,
        disableAdminPin,
        verifyAdminPin,
        setAdminInactivityMinutes,
        getAdminAuditLog,
        appendAdminAudit,
        clearAdminAuditLog,

        // --- Informations de configuration (lecture seule) ---
        get useApi() { return USE_API; },   // true si le mode API est activé
        get apiUrl() { return API_URL; },   // URL de l'API (ou null)
    };

})();

if (typeof window !== 'undefined') window.DB = DB;
if (typeof globalThis !== 'undefined') globalThis.DB = DB;
if (typeof module !== 'undefined' && module.exports) module.exports = DB;


