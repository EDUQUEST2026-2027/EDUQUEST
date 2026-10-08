/* ==========================================================================
   APP.JS — EDUQUEST v2.0
   Script principal du jeu : moteur unique chargé sur toutes les pages.

   ARCHITECTURE :
   Ce fichier est chargé sur CHAQUE page HTML. Il contient toutes les
   fonctions du jeu et détecte automatiquement sur quelle page il se trouve
   pour n'initialiser que les fonctions nécessaires.

   DÉPENDANCE : db.js doit être chargé AVANT app.js dans chaque page HTML.
   → <script src="db.js"></script>
   → <script src="app.js"></script>

   SOMMAIRE DES SECTIONS :
   1. Utilitaires partagés  → fonctions communes à toutes les pages
   2. Système Audio         → lecture de la playlist musicale
   3. Accueil & Notifications → page index.html, messages toast
   4. Connexion             → page login.html (connexion + inscription)
   5. Options               → page options.html (préférences du joueur)
   6. Sélecteur de Niveau   → page jouer.html (choix du niveau scolaire et matière)
   7. Carte des Matières    → page map.html (progression par niveau)
   Initialisation globale   → point d'entrée unique (DOMContentLoaded)
   ========================================================================== */

/* ==========================================================================
   1. UTILITAIRES PARTAGÉS
   Fonctions simples utilisées sur plusieurs pages.
   ========================================================================== */

/** Version de l'application — affichée dans le footer de toutes les pages. */
const APP_VERSION = '1.21.0';

/**
 * Crédits du créateur (v1.20) — affichés dans le footer de toutes les pages.
 * Source : AdminStore.getCredits() (personnalisables depuis le panneau
 * d'administration, onglet « Crédits »). Rendus via refreshFooterCredits().
 */
let footerCredits = null;

/**
 * (Re)construit la ligne « crédits » du footer sur toutes les pages qui ont
 * un élément .footer (aucun effet sur admin.html et edu_maj.html, qui n'en
 * ont pas). Appelée au chargement et quand l'admin modifie les crédits.
 * Aucune dépendance au reste du fichier : sûre même si AdminStore est absent.
 */
function refreshFooterCredits() {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    if (!window.AdminStore || typeof AdminStore.getCredits !== 'function') return;
    footerCredits = AdminStore.getCredits();
    const c = footerCredits;
    const bits = [];
    if (c.studioName) bits.push(escapeHtml(c.studioName));
    if (c.creatorName) bits.push('Créé par ' + escapeHtml(c.creatorName));
    if (c.website) {
        const url = /^https?:\/\//i.test(c.website) ? c.website : 'https://' + c.website;
        bits.push('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(c.website) + '</a>');
    }
    if (c.contactEmail) {
        bits.push('<a href="mailto:' + escapeHtml(c.contactEmail) + '">' + escapeHtml(c.contactEmail) + '</a>');
    }
    let html = bits.join(' · ');
    if (c.tagline) html += (html ? ' — ' : '') + '<em>' + escapeHtml(c.tagline) + '</em>';
    footer.innerHTML = html || ('Version ' + APP_VERSION);
    if (!html) footer.classList.remove('footer-with-links');
    else footer.classList.add('footer-with-links');
    footer.title = 'Version ' + APP_VERSION + (c.extraNote ? ' — ' + c.extraNote : '');
}

/*
 * RACCOURCIS VERS LA COUCHE DB.JS
 * Ces deux fonctions font le pont entre l'ancien code (qui appelait getOption/
 * saveOption directement) et la nouvelle couche db.js.
 * Elles permettent de garder l'ancien code app.js intact tout en passant
 * par DB.* pour la compatibilité SQL.
 *
 * Toutes les options passent désormais par DB (localStorage OU API SQL selon
 * la configuration dans db.js).
 */
function getOption(name) { return DB.getOption(name); }
function saveOption(name, value) { DB.saveOption(name, value); }

/**
 * Bande de contenu (collège/lycée) du niveau scolaire actuellement choisi.
 * Tient compte des niveaux personnalisés ajoutés dans le panneau
 * d'administration (admin.html → AdminStore.levelBand) ; à défaut, laisse
 * QuestionBank décider à partir de l'identifiant (comportement historique).
 */
function currentNiveauBand() {
    const niveau = DB.getNiveau();
    if (typeof AdminStore !== 'undefined' && AdminStore && niveau) {
        const band = AdminStore.levelBand(niveau);
        if (band) return band;
    }
    return QuestionBank.bandForNiveau(niveau || '6eme');
}

/**
 * Échappe les caractères HTML spéciaux avant d'insérer une chaîne dans du
 * innerHTML — utile pour tout texte qui vient de l'utilisateur (pseudo,
 * réponses saisies…) plutôt que du contenu écrit en dur dans ce fichier.
 * Sans ça, un pseudo comme "<img src=x onerror=alert(1)>" créé sur
 * login.html s'exécuterait tel quel dans le dashboard (XSS stocké).
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

/**
 * Active ou désactive l'affichage des nuages (particules).
 * Appelée automatiquement lors du chargement de la page et quand l'option
 * "particules" est modifiée dans la page options.
 *
 * L'option 'particules' est stockée sous forme de string 'true'/'false'
 * (comme toutes les options booléennes dans ce projet).
 */
function applyParticulesSetting() {
    const val = getOption('particules');
    const clouds = document.getElementById('clouds');
    if (clouds) {
        // Si l'option est explicitement 'false', on cache les nuages
        // Sinon (valeur null ou 'true'), on les affiche
        clouds.style.display = (val === 'false') ? 'none' : '';
    }
}

/**
 * Active ou désactive le mode Économie d'énergie.
 * Ajoute une classe CSS sur <body> pour couper les animations.
 */
function applyEcoModeSetting() {
    const val = getOption('ecoMode');
    if (val === 'true') {
        document.body.classList.add('eco-mode-active');
    } else {
        document.body.classList.remove('eco-mode-active');
    }
}

/**
 * Génère et insère les éléments visuels de l'environnement (étoiles + nuages).
 * Créée des éléments <div class="star"> et <div class="cloud"> aléatoires
 * dans leurs conteneurs HTML respectifs.
 *
 * Cette fonction est idempotente : si les conteneurs ont déjà des enfants,
 * elle ne rajoute rien (empêche le doublement des éléments au rechargement).
 *
 * Appelée une seule fois au DOMContentLoaded.
 */
function createEnvironment() {
    // Cherche le conteneur d'étoiles (deux IDs possibles selon la page)
    const starsContainer = document.getElementById('stars') || document.getElementById('stars-bg');
    const cloudsContainer = document.getElementById('clouds');

    // Génération des étoiles (100 au total, positions et tailles aléatoires)
    if (starsContainer && starsContainer.children.length === 0) {
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.className = 'star'; // Animé par la keyframe 'twinkle' dans global.css

            // Taille aléatoire entre 1px et 4px
            star.style.width = (Math.random() * 3 + 1) + 'px';
            star.style.height = star.style.width; // Carré → cercle (border-radius: 50% dans CSS)

            // Position aléatoire dans toute la largeur et le haut de l'écran (60%)
            star.style.left = (Math.random() * 100) + '%';
            star.style.top = (Math.random() * 60) + '%';

            // Délai d'animation aléatoire pour que toutes les étoiles ne clignotent pas en même temps
            star.style.animationDelay = (Math.random() * 3) + 's';

            starsContainer.appendChild(star);
        }
    }

    // Génération des nuages (5 au total, tailles et vitesses aléatoires)
    if (cloudsContainer && cloudsContainer.children.length === 0) {
        for (let j = 0; j < 5; j++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud'; // Animé par la keyframe 'float' dans global.css

            // Dimensions aléatoires (largeur 100-300px, hauteur 40-100px)
            cloud.style.width = (Math.random() * 200 + 100) + 'px';
            cloud.style.height = (Math.random() * 60 + 40) + 'px';

            // Les nuages commencent hors écran à gauche, la CSS anime leur passage
            cloud.style.left = '-300px';

            // Position verticale aléatoire dans la bande 20%-70% de l'écran
            cloud.style.top = (Math.random() * 50 + 20) + '%';

            // Durée d'animation aléatoire entre 20s et 40s (vitesse variable)
            cloud.style.animationDuration = (Math.random() * 20 + 20) + 's';

            // Délai aléatoire pour que les nuages n'arrivent pas tous en même temps
            cloud.style.animationDelay = (Math.random() * 15) + 's';

            cloudsContainer.appendChild(cloud);
        }
    }

    applyParticulesSetting();
    applyEcoModeSetting();
}

/**
 * Bandeau de consentement cookies (v1.20 — RGPD/CNIL) : cookies.js s'affiche
 * tout seul au chargement (aucun choix enregistré = bandeau visible) ; ce
 * rappel ne sert que si son chargement a échoué (ex. ouverture du fichier en
 * local avec un bloqueur) : on retente au premier clic, sans bloquer le jeu.
 */
function setupCookieConsentFallback() {
    if (window.EduCookies) return;
    document.addEventListener('click', function retry() {
        document.removeEventListener('click', retry);
        if (!window.EduCookies || !EduCookies.getConsent()) {
            const warn = document.querySelector('.footer');
            if (warn && !document.getElementById('eqck-root')) {
                warn.title = 'Cookies : bandeau de consentement indisponible (cookies.js non chargé)';
            }
        }
    }, true);
}

/**
 * Tente de passer en mode plein écran si l'option 'pleinEcran' est activée.
 * Compatible avec tous les navigateurs (préfixes webkit et ms pour les anciens).
 *
 * Remarque : le plein écran ne peut être activé qu'après une interaction
 * utilisateur (clic). C'est une restriction de sécurité des navigateurs modernes.
 * C'est pourquoi cette fonction est aussi appelée dans l'événement onFirstInteraction.
 *
 * @returns {boolean} true si la demande de plein écran a été envoyée, false sinon
 */
function applyFullscreenSetting() {
    const val = getOption('pleinEcran');
    if (val === 'true' && !document.fullscreenElement) {
        const el = document.documentElement; // On passe <html> en plein écran
        // Support multi-navigateurs : requestFullscreen (standard), webkitRequestFullscreen (Safari), msRequestFullscreen (vieux IE/Edge)
        const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (request) {
            try { request.call(el); } catch (e) {} // Le try/catch évite une erreur si refusé
            return true;
        }
    }
    return false;
}

/**
 * Variable de suivi : true si le plein écran a été activé par notre code.
 * Utilisée pour détecter si l'utilisateur a quitté le plein écran manuellement
 * (touche Échap) et mettre à jour l'option en conséquence.
 */
let _fullscreenAppliedByCommon = false;

/**
 * Synchronise l'état du plein écran avec l'option sauvegardée.
 * Écouteur de l'événement 'fullscreenchange' :
 *   - Si le plein écran est quitté (Échap) → on sauvegarde pleinEcran = 'false'
 *   - Si le plein écran est entré → on note qu'il est actif
 *
 * Sans ça, l'option resterait 'true' même si l'utilisateur a appuyé sur Échap,
 * et le jeu tenterait de remettre le plein écran à chaque changement de page.
 */
function syncFullscreenState() {
    if (!document.fullscreenElement && _fullscreenAppliedByCommon) {
        // L'utilisateur a quitté le plein écran manuellement
        _fullscreenAppliedByCommon = false;
        saveOption('pleinEcran', 'false'); // Mise à jour de l'option sauvegardée
    } else if (document.fullscreenElement) {
        _fullscreenAppliedByCommon = true;
    }
}
// Écoute les changements de plein écran sur toute la durée de vie de la page
document.addEventListener('fullscreenchange', syncFullscreenState);

/**
 * Met à jour le texte du footer avec la version actuelle de l'application.
 * Le footer est présent sur toutes les pages, mais son contenu HTML est
 * parfois figé. Cette fonction assure qu'il affiche toujours APP_VERSION.
 */
function updateFooterVersion() {
    const footer = document.querySelector('.footer');
    if (footer) footer.textContent = 'Version ' + APP_VERSION;
}

/* ==========================================================================
   2. SYSTÈME AUDIO
   Gère la lecture d'une playlist musicale persistante entre les pages.
   ========================================================================== */

/**
 * Objet Audio HTML5 global pour la musique de fond.
 * Un seul objet est utilisé pour toutes les pistes de la playlist.
 */
const music = new Audio();

/**
 * Playlist : liste des fichiers audio dans l'ordre de lecture.
 * Les fichiers sont dans le dossier Musique/ relatif à la racine du projet.
 * Pour ajouter une piste : ajouter une ligne 'Musique/music7.mp3' ici.
 */
const playlist = [
    'Musique/music1.mp3',
    'Musique/music2.mp3',
    'Musique/music3.mp3',
    'Musique/music4.mp3',
    'Musique/music5.mp3',
    'Musique/music6.mp3'
];

/** Index de la piste actuellement chargée dans l'objet music (0 = première). */
let currentTrack = 0;

/** true si la musique est en cours de lecture, false si en pause ou stoppée. */
let isMusicPlaying = false;

/**
 * Activation globale des sons (maître) — correspond à l'option 'sonsActifs'.
 * Si false, AUCUN son ne joue, quelle que soit l'option musicale.
 */
let globalSoundEnabled = true;

/**
 * Initialise la musique au chargement de la page.
 * Lit les préférences sauvegardées (volume, piste, position) et prépare
 * l'objet Audio pour une lecture dès le premier clic de l'utilisateur.
 *
 * Remarque : la musique n'est pas lancée directement ici car les navigateurs
 * bloquent l'autoplay avant une interaction utilisateur. Le lancement réel
 * se fait dans l'écouteur 'click' de document (initMusicOnInteraction).
 */
function initGlobalMusic() {
    globalSoundEnabled = getOption('sonsActifs') !== 'false';      // Défaut : activé
    const musicEnabled = getOption('musiqueActive') !== 'false';    // Défaut : activé
    const savedVol     = getOption('volumeMusique');                 // Ex: '75'

    // Volume entre 0.0 et 1.0 (l'option est stockée entre 0 et 100)
    music.volume = savedVol ? (parseInt(savedVol) / 100) : 0.75;
    music.loop = false; // On gère nous-mêmes le passage à la piste suivante

    if (globalSoundEnabled && musicEnabled) {
        // Récupère la piste et la position sauvegardées via db.js
        const musicState = DB.getMusicState();
        currentTrack = musicState.track;

        // Validation de la valeur récupérée (peut être NaN si localStorage vide)
        if (isNaN(currentTrack) || currentTrack < 0 || currentTrack >= playlist.length) {
            currentTrack = 0; // Retour au début si la valeur est invalide
        }

        music.src = playlist[currentTrack]; // Charge le fichier audio
        if (musicState.time) music.currentTime = musicState.time; // Reprend là où on s'était arrêté
        // NE PAS mettre isMusicPlaying = true ici : le vrai démarrage
        // (et le passage à true) se fait dans initMusicOnInteraction au premier clic.
    }
}

/**
 * Lance la lecture d'une piste spécifique.
 * Utilisée pour le passage automatique à la piste suivante (événement 'ended')
 * et depuis la page options pour prévisualiser le volume.
 *
 * @param {number} index - Index de la piste dans le tableau playlist (commence à 0)
 */
function playTrack(index) {
    // Sécurité : si l'index est hors limites, on revient au début
    if (index < 0 || index >= playlist.length) index = 0;

    currentTrack = index;
    music.src = playlist[currentTrack]; // Change le fichier source
    music.currentTime = 0;              // Repart du début de la piste

    // Lance la lecture (retourne une Promise — on gère l'échec silencieusement)
    music.play().catch(e => {
        isMusicPlaying = false; // Lecture refusée (ex: autoplay bloqué)
    });

    // Sauvegarde la piste courante via db.js
    DB.setMusicState(currentTrack, 0);
}

/**
 * Sauvegarde l'état de la musique juste avant de quitter la page.
 * L'événement 'beforeunload' se déclenche lors de toute navigation (changement
 * de page, fermeture d'onglet, rechargement).
 * Permet de reprendre la musique au même endroit sur la page suivante.
 */
window.addEventListener('beforeunload', () => {
    if (isMusicPlaying) {
        // music.currentTime = position en secondes dans la piste courante
        DB.setMusicState(currentTrack, music.currentTime);
    }
});

/**
 * Passage automatique à la piste suivante quand une piste se termine.
 * La playlist boucle : après la dernière piste, on revient à la première.
 * Le modulo (%) gère le retour à 0 après la dernière piste.
 */
music.addEventListener('ended', () => {
    currentTrack = (currentTrack + 1) % playlist.length;
    playTrack(currentTrack);
});

/**
 * Lance la musique dès le premier clic de l'utilisateur sur n'importe quelle page.
 * Technique utilisée pour contourner la restriction autoplay des navigateurs :
 * la lecture audio nécessite une interaction utilisateur préalable.
 *
 * Le { capture: true } permet d'intercepter le clic avant tous les autres gestionnaires.
 * L'écouteur se retire lui-même après le premier déclenchement (removeEventListener).
 */
document.addEventListener('click', function initMusicOnInteraction() {
    if (globalSoundEnabled && getOption('musiqueActive') !== 'false' && !isMusicPlaying) {
        if (!music.src) music.src = playlist[currentTrack]; // Sécurité : src doit être défini
        music.play().then(() => { isMusicPlaying = true; }).catch(e => {});
    }
    // Se retire après le premier clic pour ne pas être appelée à chaque clic
    document.removeEventListener('click', initMusicOnInteraction, true);
}, true);

/* ==========================================================================
   3. LOGIQUE D'ACCUEIL & NOTIFICATIONS
   Gère la page index.html et les messages toast globaux.
   ========================================================================== */

/**
 * Affiche un message de notification temporaire ("toast") dans le coin supérieur droit.
 * Le toast disparaît automatiquement après 3 secondes (défini dans la CSS par fadeOut).
 *
 * Le style visuel est défini dans global.css (.notification, .notification.error).
 *
 * @param {string} message - Texte à afficher dans la notification
 * @param {'success'|'error'} type - 'success' = fond vert (défaut), 'error' = fond rouge
 *
 * Exemples d'appel :
 *   showNotification('Options sauvegardées !');          // Vert
 *   showNotification('Mot de passe incorrect.', 'error'); // Rouge
 */
function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = 'notification';
    if (type === 'error') notif.classList.add('error'); // Applique le style rouge
    notif.textContent = message;
    document.body.appendChild(notif);
    // Suppression automatique après 3 secondes (correspond à la durée de l'animation CSS)
    setTimeout(() => notif.remove(), 3000);
}

/**
 * Initialise la page d'accueil (index.html).
 * Gère le bouton "QUITTER" : affiche une confirmation, puis une page de sortie,
 * et tente de fermer l'onglet (ne fonctionne que si l'onglet a été ouvert par script).
 *
 * N'a aucun effet si le bouton #quitButton n'est pas présent dans la page,
 * ce qui permet d'inclure app.js sur toutes les pages sans erreur.
 */
function initAccueil() {
    const quitButton = document.getElementById('quitButton');
    if (quitButton) {
        quitButton.addEventListener('click', () => {
            // Demande de confirmation avant de quitter
            if (!confirm('Voulez-vous vraiment quitter ?')) return;

            // Cache le menu principal et affiche la page de sortie (#exitPage)
            document.getElementById('mainPage').classList.add('hidden');
            document.getElementById('exitPage').classList.remove('hidden');

            // Tentative de fermeture de l'onglet après 3 secondes
            setTimeout(() => {
                window.close(); // Fonctionne si l'onglet a été ouvert via window.open()
                window.open('', '_self', ''); // Contournement alternatif
                window.close();

                // Si l'onglet ne peut pas être fermé, on affiche un message d'aide
                const subtitle = document.querySelector('#exitPage .exit-subtitle');
                if (subtitle) subtitle.innerHTML = "Vous pouvez maintenant fermer cet onglet.";
            }, 3000);
        });
    }
}

/* ==========================================================================
   4. LOGIQUE DE CONNEXION  (via db.js → compatible SQL)
   Gère la page login.html : onglets Connexion/Inscription, bouton Déconnexion.
   Toutes les opérations d'authentification passent par db.js (DB.login, DB.register, DB.logout).
   ========================================================================== */
function initConnexion() {
    /* --- Récupération des éléments HTML de la page login.html --- */

    const googleLogin    = document.getElementById('googleLogin');    // Bouton connexion Google
    const classicLogin   = document.getElementById('classicLogin');   // Bouton "Connexion" (email+mdp)
    const registerBtn    = document.getElementById('registerBtn');    // Bouton "Créer un compte"
    const logoutBtn      = document.getElementById('logoutBtn');      // Bouton "Se déconnecter"
    const tabLogin       = document.getElementById('tabLogin');       // Onglet "Se connecter"
    const tabRegister    = document.getElementById('tabRegister');    // Onglet "Créer un compte"
    const panelLogin     = document.getElementById('panelLogin');     // Panneau du formulaire connexion
    const panelRegister  = document.getElementById('panelRegister'); // Panneau du formulaire inscription
    const userInfo       = document.getElementById('userInfo');       // Bloc "connecté en tant que"
    const userNameDisplay = document.getElementById('userNameDisplay'); // Texte du pseudo connecté

    /* --- Affichage conditionnel selon l'état de connexion --- */

    /**
     * Met à jour l'interface selon si un utilisateur est connecté ou non.
     * - Si connecté : affiche le bloc userInfo avec le pseudo du joueur
     * - Si non connecté : cache le bloc userInfo
     *
     * Appelée au chargement et après chaque logout.
     */
    function updateUserDisplay() {
        const user = DB.getCurrentUser(); // Retourne { username, email } ou null
        if (userInfo) {
            userInfo.style.display = user ? 'block' : 'none';
        }
        if (userNameDisplay && user) {
            userNameDisplay.textContent = '👤 ' + user.username;
        }
    }

    // Mise à jour immédiate dès le chargement de la page
    updateUserDisplay();

    /* --- Gestion des onglets Connexion / Inscription --- */

    /**
     * Bascule entre les panneaux "Se connecter" et "Créer un compte"
     * en cliquant sur les onglets tabLogin / tabRegister.
     *
     * La classe CSS 'active' sur l'onglet contrôle son style (surligné en doré).
     * L'attribut HTML 'hidden' sur les panneaux contrôle leur visibilité.
     */
    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            if (panelLogin)    panelLogin.hidden    = false; // Affiche le formulaire de connexion
            if (panelRegister) panelRegister.hidden = true;  // Cache le formulaire d'inscription
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            if (panelRegister) panelRegister.hidden = false; // Affiche le formulaire d'inscription
            if (panelLogin)    panelLogin.hidden    = true;  // Cache le formulaire de connexion
        });
    }

    /* --- Connexion via Google (OAuth — à implémenter) --- */
    /**
     * TODO : Brancher Google OAuth 2.0.
     * Pour l'implémentation :
     *   1. Configurer un projet Google Cloud Console avec OAuth2
     *   2. Obtenir un client_id
     *   3. Implémenter DB.loginGoogle(token) dans db.js
     *   4. Le serveur backend valide le token Google et crée/connecte le compte
     * Référence : https://developers.google.com/identity/gsi/web
     */
    if (googleLogin) {
        googleLogin.addEventListener('click', () => {
            showNotification('Connexion Google — à configurer avec OAuth', 'success');
        });
    }

    /* --- Connexion classique (email + mot de passe) --- */
    /**
     * Lit les valeurs des champs email et mot de passe, valide qu'ils sont
     * remplis, puis appelle DB.login() qui gère la vérification (locale ou API).
     *
     * Le bouton est désactivé pendant la requête pour éviter les doubles soumissions.
     * Après succès, redirige vers index.html après 1 seconde.
     */
    if (classicLogin) {
        classicLogin.addEventListener('click', async () => {
            const email    = (document.getElementById('loginEmail')    || {}).value || '';
            const password = (document.getElementById('loginPassword') || {}).value || '';

            // Validation côté client (vérification rapide avant d'appeler DB)
            if (!email || !password) {
                showNotification('Veuillez remplir tous les champs.', 'error');
                return;
            }

            classicLogin.disabled = true; // Désactive le bouton pendant la requête
            showNotification('Connexion en cours...');

            const result = await DB.login(email, password); // Appel db.js

            classicLogin.disabled = false; // Réactive le bouton
            if (result.ok) {
                showNotification('✓ Bienvenue, ' + result.username + ' !');
                setTimeout(() => { 
                    if(document.getElementById('modalLogin')) document.getElementById('modalLogin').hidden = true;
                }, 1000);
            } else {
                // result.error contient le message d'erreur retourné par DB.login()
                showNotification(result.error || 'Erreur de connexion.', 'error');
            }
        });
    }

    /* --- Inscription (création d'un nouveau compte) --- */
    /**
     * Valide les 4 champs du formulaire d'inscription :
     *   - Tous les champs doivent être remplis
     *   - Les deux mots de passe doivent correspondre
     *   - Le mot de passe doit faire au moins 6 caractères (sécurité minimale)
     *
     * Puis appelle DB.register() qui crée le compte (local ou via API).
     * Après succès, redirige vers index.html (connexion automatique).
     */
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const email    = (document.getElementById('regEmail')    || {}).value || '';
            const username = (document.getElementById('regUsername') || {}).value || '';
            const password = (document.getElementById('regPassword') || {}).value || '';
            const confirm  = (document.getElementById('regConfirm')  || {}).value || '';

            // Validations côté client
            if (!email || !username || !password || !confirm) {
                showNotification('Veuillez remplir tous les champs.', 'error');
                return;
            }
            if (password !== confirm) {
                showNotification('Les mots de passe ne correspondent pas.', 'error');
                return;
            }
            if (password.length < 6) {
                showNotification('Le mot de passe doit faire au moins 6 caractères.', 'error');
                return;
            }

            registerBtn.disabled = true; // Évite les doubles soumissions
            showNotification('Création du compte...');

            const result = await DB.register(email, username, password); // Appel db.js

            registerBtn.disabled = false;
            if (result.ok) {
                showNotification('✓ Compte créé ! Bienvenue, ' + result.username + ' !');
                setTimeout(() => { 
                    if(document.getElementById('modalLogin')) document.getElementById('modalLogin').hidden = true;
                }, 1200);
            } else {
                showNotification(result.error || 'Erreur lors de l\'inscription.', 'error');
            }
        });
    }

    /* --- Déconnexion --- */
    /**
     * Appelle DB.logout() pour effacer la session, puis met à jour l'affichage
     * et redirige vers index.html après 800ms.
     */
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await DB.logout(); // Efface la session (locale ET serveur si API activée)
            showNotification('Déconnecté.');
            updateUserDisplay(); // Cache le bloc userInfo immédiatement
            setTimeout(() => { 
                if(document.getElementById('modalLogin')) document.getElementById('modalLogin').hidden = true;
            }, 800);
        });
    }
}

/* ==========================================================================
   5. LOGIQUE DES OPTIONS
   Gère la page options.html : chargement des préférences, sauvegarde, UI.
   ========================================================================== */
/**
 * Initialise tous les contrôles de la page options.html.
 * Cette fonction ne fait rien si le bouton #saveOptions est absent
 * (ce qui est le cas sur toutes les autres pages).
 *
 * FONCTIONNEMENT :
 * - Au chargement : lit les options sauvegardées (via DB) et met à jour l'UI
 * - Contrôle son global (sonsActifs) : désactive musique et effets si off
 * - Plein écran : interagit avec l'API Fullscreen du navigateur
 * - Particules : cache/affiche les nuages en temps réel
 * - Sauvegarde : écrit toutes les options via DB.saveOption() et redirige
 */
function initOptions() {
    /* --- Récupération des éléments HTML de la page options.html --- */
    const volumeMusique    = document.getElementById('volumeMusique');  // Slider 0-100
    const volumeEffets     = document.getElementById('volumeEffets');   // Slider 0-100
    const pleinEcran       = document.getElementById('pleinEcran');     // Checkbox plein écran
    const sonsActifs       = document.getElementById('sonsActifs');     // Checkbox son global
    const musiqueActive    = document.getElementById('musiqueActive');  // Checkbox musique
    const effetsActifs     = document.getElementById('effetsActifs');   // Checkbox effets sonores
    const saveOptionsBtn   = document.getElementById('saveOptions');    // Bouton "Sauvegarder"
    const backButton       = document.getElementById('backButton');     // Bouton "Retour"
    const particulesCheckbox = document.getElementById('particules');   // Checkbox particules
    const ecoModeCheckbox    = document.getElementById('ecoMode');          // Checkbox Économie d'énergie

    // Détection de la page : si saveOptions n'existe pas, on n'est pas sur options.html
    if (!saveOptionsBtn) return;

    /* --- Fonctions de mise à jour de l'UI --- */

    /**
     * Met à jour l'affichage du pourcentage et le volume réel de la musique
     * en temps réel (pendant que l'utilisateur glisse le curseur).
     */
    function updateVolumeMusique() {
        document.getElementById('valueMusiqueDisplay').textContent = volumeMusique.value + '%';
        music.volume = volumeMusique.value / 100; // Applique immédiatement au lecteur audio
    }

    /**
     * Met à jour uniquement l'affichage du pourcentage des effets sonores.
     * Note : les effets sonores ne sont pas encore implémentés — c'est un
     * contrôle visuel prévu pour une version future.
     */
    function updateVolumeEffets() {
        document.getElementById('valueEffetsDisplay').textContent = volumeEffets.value + '%';
    }

    /**
     * Lance ou arrête la musique selon l'état des checkboxes.
     * La musique doit jouer seulement si DEUX conditions sont vraies :
     *   1. sonsActifs est coché (son global activé)
     *   2. musiqueActive est coché (musique de fond activée)
     */
    function toggleMusique() {
        const shouldPlay = sonsActifs.checked && musiqueActive.checked;
        if (shouldPlay && !isMusicPlaying) {
            playTrack(currentTrack); // Lance la lecture
            isMusicPlaying = true;
        } else if (!shouldPlay && isMusicPlaying) {
            music.pause();           // Met en pause
            isMusicPlaying = false;
        }
    }

    /**
     * Gère l'état des contrôles dépendant du son global (sonsActifs).
     * Quand le son global est désactivé :
     *   - Les checkboxes musique et effets sont désactivées visuellement
     *   - Leurs valeurs précédentes sont mémorisées dans dataset.prevChecked
     *   - La classe CSS 'disabled' est appliquée pour le style visuel
     * Quand le son global est réactivé :
     *   - Les valeurs précédentes sont restaurées
     *   - Les contrôles redeviennent interactifs
     */
    function updateSoundControlsState() {
        const allActive       = sonsActifs.checked;
        const musiqueContainer = musiqueActive.closest('.checkbox-container');
        const effetsContainer  = effetsActifs.closest('.checkbox-container');

        if (!allActive) {
            // Mémorisation des états actuels avant désactivation
            musiqueActive.dataset.prevChecked = musiqueActive.checked;
            effetsActifs.dataset.prevChecked  = effetsActifs.checked;

            // Désactivation visuelle et fonctionnelle
            musiqueActive.checked  = false;
            musiqueActive.disabled = true;
            effetsActifs.checked   = false;
            effetsActifs.disabled  = true;

            // Application du style "grisé"
            if (musiqueContainer) musiqueContainer.classList.add('disabled');
            if (effetsContainer)  effetsContainer.classList.add('disabled');
        } else {
            // Réactivation des contrôles
            musiqueActive.disabled = false;
            effetsActifs.disabled  = false;

            // Restauration des états précédents
            // dataset.prevChecked est une string 'true'/'false', on compare à 'false'
            musiqueActive.checked = musiqueActive.dataset.prevChecked !== 'false';
            effetsActifs.checked  = effetsActifs.dataset.prevChecked !== 'false';

            // Retrait du style "grisé"
            if (musiqueContainer) musiqueContainer.classList.remove('disabled');
            if (effetsContainer)  effetsContainer.classList.remove('disabled');
        }

        // Mise à jour de la lecture musicale selon le nouvel état
        toggleMusique();
    }

    /**
     * Charge toutes les options sauvegardées et met à jour les contrôles HTML.
     * Appelée une seule fois au chargement de la page options.
     *
     * Pour les sliders : convertit la valeur string en number (implicite dans .value).
     * Pour les checkboxes : compare la string 'true'/'false' à 'true'.
     * Si une option n'a pas encore de valeur (première utilisation), les sons
     * sont activés par défaut pour une meilleure expérience.
     */
    function chargerOptionsUI() {
        // Sliders (valeurs numériques de 0 à 100)
        volumeMusique.value = getOption('volumeMusique') || '75';
        volumeEffets.value  = getOption('volumeEffets')  || '80';
        updateVolumeMusique(); // Met à jour l'affichage et le volume réel
        updateVolumeEffets();  // Met à jour l'affichage

        // Checkboxes (booléens stockés en string)
        ['pleinEcran', 'particules', 'ecoMode', 'sonsActifs', 'musiqueActive', 'effetsActifs'].forEach(id => {
            const value = getOption(id);
            const el    = document.getElementById(id);
            if (value !== null) {
                el.checked = value === 'true'; // Convertit la string en booléen
            } else if (['sonsActifs', 'musiqueActive', 'effetsActifs'].includes(id)) {
                el.checked = true; // Valeur par défaut : sons activés
            }
        });

        // Si le son global est désactivé, on mémorise les états des sous-options
        // avant d'appeler updateSoundControlsState() qui les efface
        if (!sonsActifs.checked) {
            musiqueActive.dataset.prevChecked = getOption('musiqueActive') || 'true';
            effetsActifs.dataset.prevChecked  = getOption('effetsActifs')  || 'true';
        }

        // Application de la logique de désactivation si nécessaire
        updateSoundControlsState();
    }

    // Chargement initial des options sauvegardées
    chargerOptionsUI();

    /* --- Écouteurs d'événements sur les contrôles --- */

    // Son global : désactive/réactive musique et effets
    sonsActifs.addEventListener('change', updateSoundControlsState);

    // Musique et effets : lance/arrête la lecture
    musiqueActive.addEventListener('change', toggleMusique);
    effetsActifs.addEventListener('change', toggleMusique);

    // Sliders de volume : mise à jour en temps réel
    volumeMusique.addEventListener('input', updateVolumeMusique);
    volumeEffets.addEventListener('input', updateVolumeEffets);

    // Checkbox Plein Écran : bascule l'API fullscreen du navigateur
    pleinEcran.addEventListener('change', () => {
        if (pleinEcran.checked) {
            // Entrée en plein écran (multi-navigateur)
            const request = document.documentElement.requestFullscreen
                         || document.documentElement.webkitRequestFullscreen
                         || document.documentElement.msRequestFullscreen;
            if (request) request.call(document.documentElement);
        } else {
            // Sortie du plein écran (multi-navigateur)
            const exit = document.exitFullscreen
                      || document.webkitExitFullscreen
                      || document.msExitFullscreen;
            if (exit) exit.call(document);
        }
    });

    // Checkbox Particules : affiche/cache les nuages immédiatement
    ecoModeCheckbox.addEventListener('change', applyEcoModeSetting);
    particulesCheckbox.addEventListener('change', applyParticulesSetting);

    /* --- Bouton Sauvegarder --- */
    /**
     * Sauvegarde toutes les options via DB.saveOption().
     * Gestion spéciale pour la musique/effets : si le son global est désactivé,
     * on sauvegarde les valeurs "précédentes" (avant désactivation) pour les
     * restaurer correctement à la prochaine ouverture.
     */
    // Extraction de la logique de sauvegarde pour pouvoir l'appeler facilement
    function performSaveOptions() {
        saveOption('volumeMusique', volumeMusique.value);
        saveOption('volumeEffets', volumeEffets.value);
        saveOption('pleinEcran', String(pleinEcran.checked));
        saveOption('particules', String(particulesCheckbox.checked));
        saveOption('ecoMode', String(ecoModeCheckbox.checked));
        saveOption('sonsActifs', String(sonsActifs.checked));

        if (sonsActifs.checked) {
            saveOption('musiqueActive', String(musiqueActive.checked));
            saveOption('effetsActifs', String(effetsActifs.checked));
        } else {
            saveOption('musiqueActive', String(musiqueActive.dataset.prevChecked !== 'false'));
            saveOption('effetsActifs', String(effetsActifs.dataset.prevChecked !== 'false'));
        }
    }

    // Sauvegarde automatique à chaque changement pour que ce soit toujours "sincro"
    [volumeMusique, volumeEffets, pleinEcran, particulesCheckbox, ecoModeCheckbox, sonsActifs, musiqueActive, effetsActifs].forEach(el => {
        el.addEventListener('change', performSaveOptions);
    });

    saveOptionsBtn.addEventListener('click', () => {
        performSaveOptions();

        showNotification('⚙ Options sauvegardées !');
        // Retour à l'accueil après 1 seconde pour laisser le temps de voir la notification
        setTimeout(() => { 
            if(document.getElementById('modalOptions')) document.getElementById('modalOptions').hidden = true;
        }, 1000);
    });

    // Bouton Retour : navigation sans sauvegarder
    if (backButton) {
        backButton.addEventListener('click', () => {
            if(document.getElementById('modalOptions')) document.getElementById('modalOptions').hidden = true;
        });
    }

    // Sync de la checkbox plein écran quand l'utilisateur appuie sur Échap
    document.addEventListener('fullscreenchange', () => {
        pleinEcran.checked = !!document.fullscreenElement; // !! convertit en booléen
    });
}

/* ==========================================================================
   6. SÉLECTEUR DE NIVEAU (page jouer.html)
   Gère le choix du niveau scolaire et l'affichage de la grille des matières.
   ========================================================================== */
/**
 * Initialise la page jouer.html.
 * Sort immédiatement si le conteneur #niveauPills n'existe pas (pas sur cette page).
 *
 * FONCTIONNEMENT :
 * - Affiche les "pills" de niveau scolaire (6ème, 5ème, …)
 * - Restaure le niveau précédemment sélectionné (surligné) via DB.getNiveau()
 * - Affiche la grille des matières si un niveau est déjà sélectionné
 * - Gère le clic sur une pill : sélectionne le niveau, sauvegarde via DB.setNiveau()
 *   et affiche la grille avec une animation
 */

/* ==========================================================================
   7. CARTE DES MATIÈRES (page map.html)
   Gère l'affichage et l'interaction de la carte de progression par matière.
   ========================================================================== */
/**
 * Initialise la page map.html.
 * Sort immédiatement si l'en-tête .map-header n'existe pas (pas sur cette page).
 *
 * FONCTIONNEMENT GÉNÉRAL :
 * - La matière et l'icône sont passées dans l'URL (ex: map.html?matiere=Maths&icon=maths.png)
 * - La progression est chargée de façon asynchrone via DB.loadProgress()
 * - Les 6 boutons de niveau (dots) sont mis à jour visuellement selon la progression
 * - Un clic sur un dot ouvre une modale pour simuler la complétion d'un niveau
 * - La progression est sauvegardée via DB.saveProgress() à chaque modification
 *
 * FORMAT DE LA PROGRESSION (objet JavaScript) :
 * {
 *   levels: {
 *     1: { unlocked: true,  stars: 3 },
 *     2: { unlocked: true,  stars: 0 },
 *     3: { unlocked: false, stars: 0 },
 *     ...
 *   }
 * }
 */
function initMap() {
    const mapHeader = document.querySelector('.map-header');
    if (!mapHeader) return; // Pas sur la page map.html → on sort

    /** Une icône de matière peut être un fichier d'îlot (PNG ou SVG) ou un
     *  emoji Unicode. Retourne true si c'est un fichier image. */
    function isIconFile(icon) {
        return /\.(png|svg|webp)$/i.test(icon);
    }

    /**
     * Correspondance entre le nom de matière affiché (paramètre d'URL
     * ?matiere=...) et l'identifiant utilisé dans DASH_SUBJECTS (v2.1).
     * jouer.html propose « Physique » et « Chimie » séparément (deux îlots
     * distincts) : depuis v1.18, la Chimie possède ses propres questions
     * (id 'chimie', banque dédiée dans question-bank.js) et n'est plus un
     * alias de la Physique. EMC n'a pas de carte dans jouer.html (pas
     * d'îlot graphique dédié pour l'instant) → carteSubject sera
     * `undefined` pour elle, et initMap retombe sur l'ancien comportement
     * (modale à étoiles) plutôt que d'échouer silencieusement.
     */
    const MATIERE_TO_SUBJECT_ID = {
        'Mathématiques': 'maths',
        'Français': 'francais',
        'Histoire': 'histoire',
        'Géographie': 'geo',
        'SVT': 'svt',
        'Anglais': 'anglais',
        'Physique': 'physique',
        'Chimie': 'chimie',
        'Technologie': 'techno',
    };

    /* --- Lecture des paramètres d'URL --- */
    // Ex: map.html?matiere=Mathématiques&icon=maths.png
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get('matiere') || 'Inconnu'; // Nom de la matière
    const icon    = urlParams.get('icon')    || '📚';      // Emoji ou nom de fichier .png

    // Matière correspondante côté quiz réel (DASH_SUBJECTS), si elle existe.
    // v1.19 — Recherche aussi par NOM affiché : couvre les matières renommées
    // ou créées dans le panneau d'administration (le nom peut différer des
    // clés historiques de MATIERE_TO_SUBJECT_ID).
    const carteSubject = DASH_SUBJECTS.find(s => s.id === MATIERE_TO_SUBJECT_ID[subject])
        || DASH_SUBJECTS.find(s => s.name === subject);

    /** Nombre de niveaux affichés : aligné sur le nombre de leçons réelles
     *  si la matière est connue du moteur de quiz, sinon 6 par défaut
     *  (ancien comportement, modale à étoiles). */
    const TOTAL_LEVELS = carteSubject ? carteSubject.lessons.length : 6;

    /* --- Mise à jour des éléments visuels d'en-tête --- */
    const titleEl = document.querySelector('h1');          // Titre de la matière
    const iconEl  = document.querySelector('.subject-icon'); // Icône de la matière
    if (titleEl) titleEl.textContent = subject;

    if (iconEl) {
        // Icône fichier (PNG ou SVG îlot) vs emoji Unicode.
        if (isIconFile(icon)) {
            // Si l'icône est un fichier image : on crée une balise <img>
            iconEl.innerHTML = `<img src="Image/ile/${icon}" class="matiere-icon" style="width:1em;height:1em;vertical-align:middle;">`;
        } else {
            // Sinon c'est un emoji : on l'affiche directement comme texte
            iconEl.textContent = icon;
        }
    }

    // Illustration d'îlot en arrière-plan (v2.2) : seulement si l'icône est
    // un vrai fichier image (PNG ou SVG).
    const bgIslandEl = document.getElementById('subject-bg-island');
    if (bgIslandEl) {
        if (isIconFile(icon)) {
            bgIslandEl.src = 'Image/ile/' + icon;
        } else {
            bgIslandEl.remove();
        }
    }

    // Met à jour le titre de l'onglet du navigateur
    document.title = 'EDUQUEST - ' + subject;

    /* --- Niveau scolaire actuel (ex: '6eme') --- */
    // Récupéré via db.js pour être cohérent avec le reste du jeu
    const niveauActuel = DB.getNiveau() || '6eme';

    /**
     * Coordonnées d'un niveau sur la piste (v2.3 — jusqu'à 100 niveaux).
     * Remplace l'ancien objet `levelPositions` codé en dur (6 entrées) : à
     * cette échelle, les positions sont calculées plutôt qu'écrites une par une.
     *
     * - Niveau 1 en bas de la piste, TOTAL_LEVELS en haut : le joueur "grimpe"
     *   au fur et à mesure de sa progression.
     * - x ondule entre ~20% et ~80% de la largeur (sinusoïde déterministe),
     *   pour un chemin sinueux façon carte de jeu plutôt qu'une ligne droite.
     *
     * @returns {{x: number, y: number}} x en % de la largeur, y en px dans la piste
     */
    const LEVEL_SPACING = 130; // Distance verticale (px) entre deux niveaux
    const TRACK_PADDING = 160; // Marge (px) en haut et en bas de la piste
    const trackHeight = TOTAL_LEVELS * LEVEL_SPACING + TRACK_PADDING * 2;

    function levelCoords(i) {
        const y = trackHeight - TRACK_PADDING - (i - 1) * LEVEL_SPACING;
        const x = 50 + 30 * Math.sin(i * 0.7);
        return { x, y };
    }

    /**
     * Construit la piste complète (chemin SVG + personnage + boutons de
     * niveau) et l'injecte dans #level-track. Appelée une seule fois au
     * chargement de la page — renderLevels() se contente ensuite de mettre
     * à jour les classes d'état des boutons déjà créés ici.
     */
    function buildLevelTrack() {
        const trackEl = document.getElementById('level-track');
        if (!trackEl) return;
        trackEl.style.height = trackHeight + 'px';

        // Chemin reliant tous les niveaux par des segments droits — avec
        // l'ondulation sinusoïdale de levelCoords, le résultat reste visuellement
        // fluide sans avoir besoin de courbes de Bézier calculées point par point.
        let pathD = '';
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            const { x, y } = levelCoords(i);
            pathD += (i === 1 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(1) + ' ';
        }

        let dotsHTML = '';
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            const { x, y } = levelCoords(i);
            dotsHTML += `<button class="level-dot" type="button" data-level="${i}" style="left:${x}%; top:${y}px;">
                <span class="level-number">${i}</span>
                <span class="level-stars-display"></span>
            </button>`;
        }

        // viewBox : x en 0-100 (≈ %), y en px réels de la piste (mêmes unités
        // que le style.top des boutons/personnage — évite toute conversion).
        trackEl.innerHTML = `
            <svg class="path" viewBox="0 0 100 ${trackHeight}" preserveAspectRatio="none" aria-hidden="true" style="width:100%; height:${trackHeight}px;">
                <path class="path-shadow" d="${pathD}"></path>
                <path class="path-ground" d="${pathD}"></path>
                <path class="path-light"  d="${pathD}"></path>
            </svg>
            <div id="character" class="character" aria-label="Personnage">
                <div class="character-body">
                    <div class="character-head">
                        <div class="character-eyes">
                            <span class="eye left-eye"></span>
                            <span class="eye right-eye"></span>
                        </div>
                        <div class="character-mouth"></div>
                    </div>
                    <div class="character-hat"></div>
                    <div class="character-cape"></div>
                </div>
                <div class="character-shadow"></div>
            </div>
            ${dotsHTML}
        `;
    }
    buildLevelTrack();

    /* --- Fonctions de gestion de la progression --- */

    /**
     * Génère une progression "vierge" pour une matière.
     * Seul le niveau 1 est débloqué au départ, tous les autres sont verrouillés.
     * @returns {object} Objet progression avec 6 niveaux
     */
    function getDefaultProgress() {
        const levels = {};
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            levels[i] = {
                unlocked: i === 1, // true pour le niveau 1, false pour les autres
                stars: 0           // Pas encore joué
            };
        }
        return { levels };
    }

    /**
     * Charge la progression depuis DB (localStorage ou API SQL).
     * Retourne getDefaultProgress() si aucune donnée n'est trouvée.
     *
     * @returns {Promise<object>} La progression du joueur pour cette matière
     */
    async function loadProgress() {
        const data = await DB.loadProgress(subject, niveauActuel);
        return data || getDefaultProgress(); // Progression par défaut si rien en base
    }

    /**
     * Sauvegarde la progression via DB (localStorage + API si activée).
     * Appelée à chaque modification de la progression (étoiles gagnées).
     *
     * @param {object} progress - Objet progression complet
     */
    function saveProgress(progress) {
        DB.saveProgress(subject, niveauActuel, progress);
    }

    /**
     * Génère la chaîne d'affichage des étoiles pour un niveau.
     * Utilise des étoiles pleines (⭐) pour les gagnées et vides (☆) pour le reste.
     *
     * @param {number} stars - Nombre d'étoiles gagnées (0, 1, 2 ou 3)
     * @returns {string} Ex: '⭐⭐☆' pour 2 étoiles
     */
    function renderStars(stars) {
        return stars === 0 ? '' : '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    }

    /**
     * Détermine quel niveau est "le niveau courant" du joueur.
     * Le niveau courant est le premier niveau débloqué sans étoiles (non encore terminé),
     * ou le dernier niveau débloqué si tous ont des étoiles.
     *
     * C'est là que se positionne le personnage animé sur la carte.
     *
     * @param {object} progress - Objet progression
     * @returns {number} Numéro du niveau courant (entre 1 et TOTAL_LEVELS)
     */
    function findCurrentLevel(progress) {
        let current = 1;
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            if (progress.levels[i].unlocked) {
                current = i;
                if (progress.levels[i].stars === 0) return i; // Niveau en cours
            }
        }
        return current; // Tous terminés → dernier niveau
    }

    /**
     * Déplace le personnage animé vers la position d'un niveau.
     * Avec animation : délai de 100ms avant de changer la position (effet de déplacement CSS).
     * Sans animation : changement immédiat de la position.
     *
     * La transition CSS sur #character gère l'animation de déplacement fluide.
     *
     * @param {number} levelNumber - Numéro du niveau cible (1 à 6)
     * @param {boolean} animate    - true pour une transition animée, false pour immédiat
     */
    function positionCharacter(levelNumber, animate) {
        const character = document.getElementById('character');
        if (!character) return;
        const { x, y } = levelCoords(levelNumber);

        if (animate) {
            // Petit délai pour que la transition CSS ait le temps de s'appliquer
            setTimeout(() => {
                character.style.left = x + '%';
                character.style.top  = y + 'px';
            }, 100);
        } else {
            // Placement immédiat (ex: au chargement de la page)
            character.style.left = x + '%';
            character.style.top  = y + 'px';
        }
    }

    /**
     * Fait défiler la piste pour centrer verticalement un niveau donné dans
     * la fenêtre. Appelée une seule fois au chargement, sur le niveau courant
     * — indispensable ici puisque la piste peut être bien plus haute que
     * l'écran (jusqu'à 100 niveaux).
     */
    function scrollToLevel(levelNumber, smooth) {
        const viewport = document.getElementById('level-map-viewport');
        if (!viewport) return;
        const { y } = levelCoords(levelNumber);
        const target = Math.max(0, y - viewport.clientHeight / 2);
        viewport.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    }

    /**
     * Met à jour l'apparence visuelle de tous les boutons de niveau.
     * Appelée à chaque modification de la progression (chargement + après un niveau).
     *
     * Chaque bouton peut avoir un de ces états exclusifs :
     *   - 'locked'    : niveau verrouillé (disabled + cadenas)
     *   - 'completed' : niveau terminé avec au moins 1 étoile
     *   - 'active'    : niveau courant (en cours)
     *   - aucune      : débloqué mais pas encore commencé (et pas courant)
     *
     * @param {object} progress - Objet progression complet
     */
    function renderLevels(progress) {
        const currentLevel = findCurrentLevel(progress); // Trouve le niveau courant

        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            const btn = document.querySelector('.level-dot[data-level="' + i + '"]');
            if (!btn) continue; // Sécurité si le bouton n'existe pas dans le HTML

            const data         = progress.levels[i];
            const starsDisplay = btn.querySelector('.level-stars-display');

            // Réinitialise toutes les classes d'état avant de les réassigner
            btn.classList.remove('locked', 'active', 'completed', 'selected');
            btn.disabled = false;

            if (!data.unlocked) {
                // Niveau verrouillé : grisé, non cliquable
                btn.classList.add('locked');
                btn.disabled = true;
                if (starsDisplay) starsDisplay.textContent = '🔒';

            } else if (data.stars > 0) {
                // Niveau terminé avec étoiles : affiche les étoiles gagnées
                btn.classList.add('completed');
                if (starsDisplay) starsDisplay.textContent = renderStars(data.stars);

            } else {
                // Niveau débloqué mais pas encore terminé
                if (i === currentLevel) btn.classList.add('active'); // Niveau en cours
                if (starsDisplay) starsDisplay.textContent = ''; // Pas d'étoiles
            }
        }

        // Positionne le personnage sur le niveau courant
        positionCharacter(currentLevel, false);
    }

    /* --- Chargement initial de la progression (asynchrone) --- */

    // On affiche d'abord la progression par défaut pour éviter un écran vide
    let progress = getDefaultProgress();

    // Puis on charge la vraie progression (depuis localStorage ou l'API)
    loadProgress().then(loaded => {
        progress = loaded;
        renderLevels(progress); // Met à jour l'affichage avec les données réelles
        // Défile jusqu'au niveau courant : indispensable avec une piste de
        // 100 niveaux, sinon le joueur arrive tout en bas (niveau 1) à chaque fois.
        scrollToLevel(findCurrentLevel(progress), false);
    });

    /* --- Gestion de la modale de résultat de niveau --- */

    /**
     * Stocke le numéro du niveau dont la modale est ouverte, et l'état de
     * la tentative en cours (mode quiz réel uniquement — voir carteSubject).
     * null si aucune modale n'est ouverte.
     *
     * Flux unifié avec le dashboard (v1.18) : la question est récupérée via
     * AiProvider.fetchQuestion() — serveur (Make) si configuré, sinon repli
     * local — et la correction passe par AiProvider.submitAnswer(), qui
     * interroge le serveur quand la question vient de l'IA (la bonne réponse
     * ne transite alors jamais dans le navigateur avant la soumission).
     * `checking` vaut 'loading' pendant la génération, true pendant la
     * correction. `lesson`/`questionId` sont remplis quand la question arrive.
     */
    let currentModalLevel = null;
    let currentAttempt = null; // { attempts, submitted, answered, isCorrect, checking, lesson, questionId, explanation } — mode quiz réel
    const modal = document.getElementById('level-modal');
    const quizZone = document.getElementById('modal-quiz-zone');
    const starsZone = document.getElementById('modal-stars-zone');

    /**
     * Convertit un résultat de quiz en étoiles, sur le même principe que le
     * dashboard : plus l'élève a eu besoin d'essais, moins il gagne d'étoiles.
     */
    function starsFromAttempts(attempts) {
        if (attempts === 1) return 3;
        if (attempts === 2) return 2;
        return 1;
    }

    /** Débloque le niveau suivant et sauvegarde, commun aux deux modes. */
    function unlockNextAndSave(starsEarned) {
        const wasCompleted = progress.levels[currentModalLevel].stars > 0;

        if (starsEarned > progress.levels[currentModalLevel].stars) {
            progress.levels[currentModalLevel].stars = starsEarned;
        }
        if (currentModalLevel + 1 <= TOTAL_LEVELS) {
            progress.levels[currentModalLevel + 1].unlocked = true;
        }
        saveProgress(progress);
        renderLevels(progress);

        // --- Synchronisation pour le Dashboard ---
        let completedCount = 0;
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            if (progress.levels[i] && progress.levels[i].stars > 0) {
                completedCount++;
            }
        }
        
        if (carteSubject) {
            let dashProg = {};
            try { dashProg = JSON.parse(DB.getOption('dash_progress') || '{}'); } catch(e) {}
            dashProg[carteSubject.id] = completedCount;
            DB.saveOption('dash_progress', JSON.stringify(dashProg));
        }

        // Ajout XP/Coins seulement si c'est la première fois qu'on termine ce niveau
        if (!wasCompleted) {
            let currentXp = parseInt(DB.getOption('dash_xp') || '0');
            let currentCoins = parseInt(DB.getOption('dash_coins') || '30');
            currentXp += 15;
            currentCoins += 10;
            DB.saveOption('dash_xp', String(currentXp));
            DB.saveOption('dash_coins', String(currentCoins));
        }
    }

    /** Rendu de la question courante dans #modal-quiz-zone (mode quiz réel). */
    function renderModalQuiz() {
        const { submitted, answered, isCorrect, checking, lesson } = currentAttempt;
        const questionEl = document.getElementById('modal-quiz-question');
        const body = document.getElementById('modal-quiz-body');
        const feedbackEl = document.getElementById('modal-quiz-feedback');
        const actionsEl = document.getElementById('modal-quiz-actions');

        /* --- État « génération en cours » (AiProvider.fetchQuestion) --- */
        if (checking === 'loading' || !lesson) {
            questionEl.textContent = 'Génération de la question…';
            body.innerHTML = `<div class="dash-feedback">⏳ Préparation de la question du niveau ${currentModalLevel}…</div>`;
            feedbackEl.innerHTML = '';
            actionsEl.innerHTML = `<button class="dash-btn-ghost" id="modal-quiz-cancel">Annuler</button>`;
            document.getElementById('modal-quiz-cancel').addEventListener('click', () => {
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            return;
        }

        questionEl.textContent = lesson.q;
        body.innerHTML = QuizEngine.renderBody(lesson);

        if (!answered && !checking) {
            feedbackEl.innerHTML = '';
            actionsEl.innerHTML = `<button class="dash-btn-ghost" id="modal-quiz-cancel">Annuler</button>`;
            document.getElementById('modal-quiz-cancel').addEventListener('click', () => {
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            QuizEngine.bind(body, lesson, currentAttempt, _mapSubmitQuiz);
        } else if (checking) {
            /* --- État « correction en cours » (potentiellement côté serveur) ---
               Le corps interactif reste affiché mais sans events attachés
               (même comportement que le dashboard pendant sa correction). */
            feedbackEl.innerHTML = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
            actionsEl.innerHTML = '';
        } else {
            QuizEngine.reveal(body, lesson, submitted);
            feedbackEl.innerHTML = `<div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">${isCorrect ? '✓ Bonne réponse ! ' : '✗ Pas tout à fait. '}${escapeHtml(currentAttempt.explanation || lesson.exp || '')}</div>`;

            if (isCorrect) {
                actionsEl.innerHTML = `<button class="dash-btn-primary" id="modal-quiz-continue">Continuer</button>`;
                document.getElementById('modal-quiz-continue').addEventListener('click', () => {
                    const stars = starsFromAttempts(currentAttempt.attempts);
                    unlockNextAndSave(stars);
                    modal.hidden = true;
                    showNotification(`✓ Niveau réussi — ${'⭐'.repeat(stars)}`);
                });
            } else {
                actionsEl.innerHTML = `
                    <button class="dash-btn-ghost" id="modal-quiz-quit">Quitter</button>
                    <button class="dash-btn-primary" id="modal-quiz-retry">Réessayer</button>`;
                document.getElementById('modal-quiz-quit').addEventListener('click', () => {
                    modal.hidden = true;
                    positionCharacter(findCurrentLevel(progress), true);
                });
                document.getElementById('modal-quiz-retry').addEventListener('click', () => {
                    currentAttempt.submitted = null;
                    currentAttempt.answered = false;
                    currentAttempt.isCorrect = false;
                    currentAttempt.checking = false;
                    currentAttempt.explanation = '';
                    renderModalQuiz();
                });
            }
        }
    }

    /**
     * Soumission d'une réponse dans la modale de la carte — même sémantique
     * que _dashSubmitQuiz du dashboard : correction via AiProvider (serveur
     * en mode IA, QuizEngine en repli local), fusion de la clé de correction
     * dans la leçon pour que reveal() surligne la bonne réponse.
     */
    async function _mapSubmitQuiz(rawAnswer) {
        const attempt = currentAttempt;
        attempt.submitted = rawAnswer;
        attempt.attempts += 1;
        attempt.checking = true;
        renderModalQuiz();

        const result = await AiProvider.submitAnswer(attempt.questionId, attempt.lesson, rawAnswer);
        // La modale a pu être fermée (ou un autre niveau ouvert) pendant l'attente :
        // on n'applique le résultat que si c'est toujours la même tentative.
        if (currentAttempt !== attempt || modal.hidden) return;

        attempt.checking = false;
        attempt.answered = true;
        attempt.isCorrect = result.isCorrect;
        attempt.explanation = result.explanation;
        attempt.lesson = { ...attempt.lesson, ...result.answerKey };
        renderModalQuiz();
    }

    /**
     * Clic sur un bouton de niveau (dot) :
     * - Ignore les niveaux verrouillés (classe 'locked')
     * - Déplace le personnage vers ce niveau
     * - Ouvre la modale en mode quiz réel si la matière est reconnue,
     *   sinon retombe sur l'ancien choix d'étoiles.
     */
    document.querySelectorAll('.level-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('locked')) return; // Niveau verrouillé → on ignore
            currentModalLevel = parseInt(btn.dataset.level);
            positionCharacter(currentModalLevel, true); // Déplace le personnage (animé)

            if (!modal) return;
            document.getElementById('modal-title').textContent = 'Niveau ' + currentModalLevel;

            if (carteSubject && carteSubject.lessons[currentModalLevel - 1]) {
                quizZone.hidden = false;
                starsZone.hidden = true;
                const requestedLevel = currentModalLevel;
                currentAttempt = { attempts: 0, submitted: null, answered: false, isCorrect: false, checking: 'loading', lesson: null, questionId: null, explanation: '' };
                const attempt = currentAttempt; // identité figée pour le garde anti-course
                renderModalQuiz(); // Affiche d'abord l'état « génération… »

                /* Question via AiProvider : serveur (Make) si configuré, sinon
                   repli local — en local, on sert la leçon existante du niveau
                   (leçons 1 à 5 écrites à la main, puis génération déterministe
                   identique à QuestionBank.generateOne pour les suivantes). */
                const localLesson = carteSubject.lessons[requestedLevel - 1];
                AiProvider.fetchQuestion(carteSubject.id, requestedLevel - 1, currentNiveauBand(), { localLesson })
                    .then(({ lesson, questionId }) => {
                        // Garde anti-course : la modale a pu être fermée, un autre
                        // niveau ouvert, ou la tentative remplacée pendant l'attente.
                        if (currentAttempt !== attempt) return;
                        if (currentModalLevel !== requestedLevel || modal.hidden) return;
                        attempt.lesson = lesson;
                        attempt.questionId = questionId;
                        attempt.checking = false;
                        renderModalQuiz();
                    })
                    .catch(err => {
                        console.warn('[map] Récupération de question échouée, repli local.', err);
                        if (currentAttempt !== attempt) return;
                        if (currentModalLevel !== requestedLevel || modal.hidden) return;
                        attempt.lesson = localLesson;
                        attempt.questionId = null;
                        attempt.checking = false;
                        renderModalQuiz();
                    });
            } else {
                quizZone.hidden = true;
                starsZone.hidden = false;
            }
            modal.hidden = false; // Affiche la modale
        });
    });

    /**
     * Clic sur un choix d'étoiles dans la modale (mode repli uniquement) :
     * - Met à jour les étoiles du niveau (on ne peut qu'améliorer, jamais réduire)
     * - Débloque automatiquement le niveau suivant
     * - Sauvegarde la progression
     * - Ferme la modale et met à jour l'affichage
     *
     * Le bouton data-stars="1/2/3" contient le nombre d'étoiles choisies.
     */
    document.querySelectorAll('.star-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentModalLevel) return;
            unlockNextAndSave(parseInt(btn.dataset.stars));
            modal.hidden = true;
        });
    });

    /**
     * Bouton "Annuler" de la modale (mode étoiles) :
     * Ferme la modale et repositionne le personnage sur le niveau courant.
     */
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        modal.hidden = true;
        positionCharacter(findCurrentLevel(progress), true);
    });

    /**
     * Bouton "Réinitialiser la progression" :
     * Remet la progression à zéro (uniquement le niveau 1 débloqué, sans étoiles).
     * Utile pendant le développement ou pour recommencer une matière.
     */
    const resetBtn = document.getElementById('reset-progress');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        progress = getDefaultProgress(); // Remet à zéro en mémoire
        saveProgress(progress);          // Sauvegarde la progression réinitialisée
        modal.hidden = true;
        renderLevels(progress);          // Met à jour l'affichage
    });
}

/* ==========================================================================
   8. DASHBOARD (page dashboard.html)
   Moteur complet du tableau de bord : matières, carte, quiz et boutique.
   Fusionné depuis edu_maj.html avec persistance via DB (localStorage).
   ========================================================================== */

/**
 * Initialise le dashboard interactif (dashboard.html).
 * Sort immédiatement si le conteneur #dashboard-app est absent.
 *
 * FONCTIONNEMENT :
 * - Charge l'état persisté (XP, pièces, skins, progression) depuis localStorage via DB
 * - Affiche le HUD (avatar, niveau, XP, pièces)
 * - Permet de naviguer entre Matières (dashboard), Carte (map) et Boutique (shop)
 * - Gère les quiz interactifs avec feedback et récompenses
 * - Persiste toutes les modifications via DB.saveOption()
 */
/* ==========================================================================
   DONNÉES PARTAGÉES — matières, leçons, skins, badges (v2.1)
   Sorties d'initDashboard() pour être également accessibles depuis
   initMap() (voir plus bas), qui les utilise désormais pour afficher de
   vraies questions sur la carte de progression au lieu de la modale
   placeholder "choisis tes étoiles" de la v2.0.
   ========================================================================== */
/* ============ DONNÉES CONSTANTES ============ */
const DASH_SKINS = [
    { id: 'aurore',   name: 'Aurore Boréale',   color: '#4fd8c4', cost: 0 },
    { id: 'robot',    name: 'Robot Assistant',  color: '#8fb8c9', img: 'Image/personnages/robot.webp', cost: 0 },
    { id: 'or',       name: 'Comète Dorée',     color: '#c8a84b', cost: 60 },
    { id: 'ametiste', name: 'Nova Améthyste',   color: '#b685f5', cost: 90 },
    { id: 'rose',     name: 'Étoile Rose',      color: '#f58fc2', cost: 130 },
    { id: 'braise',   name: 'Braise Cosmique',  color: '#f5714f', cost: 170 },
    // Skins "personnage" (v2.2) — portraits au lieu d'un halo de couleur.
    // `color` reste renseigné : il sert de couleur de halo derrière le
    // portrait (voir renderHud/renderShop), le portrait lui-même vient de `img`.
    { id: 'einstein',          name: 'Albert Einstein',     color: '#7fb3d5', img: 'Image/personnages/einstein.webp',          cost: 150 },
    { id: 'marie-curie',       name: 'Marie Curie',         color: '#6bca82', img: 'Image/personnages/marie-curie.webp',       cost: 150 },
    { id: 'christophe-colomb', name: 'Christophe Colomb',   color: '#c8a84b', img: 'Image/personnages/christophe-colomb.webp', cost: 200 },
];

const RAW_DASH_SUBJECTS = [
    { id: "maths", name: "Mathématiques", icon: "∑", lessons: [
        { title: "Les fractions", q: "Combien font 1/2 + 1/4 ?", opts: ["3/6", "1/6", "3/4", "2/6"], correct: 2, exp: "Au même dénominateur (4) : 2/4 + 1/4 = 3/4." },
        { title: "Le théorème de Pythagore", q: "Dans un triangle rectangle de côtés 3 et 4, quelle est la longueur de l'hypoténuse ?", opts: ["4,5", "7", "6", "5"], correct: 3, exp: "√(3² + 4²) = √25 = 5." },
        { title: "Équations du 1er degré", q: "Résous 2x + 3 = 11. Que vaut x ?", opts: ["3", "5,5", "7", "4"], correct: 3, exp: "2x = 8, donc x = 4." },
        { title: "Les probabilités", q: "On lance un dé à 6 faces. Quelle est la probabilité d'obtenir un nombre pair ?", opts: ["1/2", "1/3", "2/3", "1/6"], correct: 0, exp: "3 issues favorables (2,4,6) sur 6 : 3/6 = 1/2." },
        { type: "drag_and_drop", title: "Calcul mental", q: "Associe chaque opération à son résultat.", items: ["7 × 8", "144 ÷ 12", "9²", "√81"], targets: ["56", "12", "81", "9"], pairs: { "7 × 8": "56", "144 ÷ 12": "12", "9²": "81", "√81": "9" }, exp: "7 × 8 = 56, 144 ÷ 12 = 12, 9² = 81, √81 = 9." },
    ]},
    { id: "francais", name: "Français", icon: "Aa", lessons: [
        { title: "Les classes grammaticales", q: "Dans « Le chat noir dort », quel mot est un adjectif ?", opts: ["noir", "le", "chat", "dort"], correct: 0, exp: "« Noir » qualifie le nom « chat »." },
        { title: "Le conditionnel", q: "Quelle est la terminaison du conditionnel présent à la 1ère personne du singulier pour « aimer » ?", opts: ["aimerais", "aimais", "aimerai", "aime"], correct: 0, exp: "Radical du futur + terminaisons de l'imparfait : j'aimerais." },
        { title: "Les figures de style", q: "« Il pleut des cordes » est une :", opts: ["comparaison", "anaphore", "métaphore", "litote"], correct: 2, exp: "L'image remplace directement la réalité, sans outil de comparaison : c'est une métaphore." },
        { title: "L'argumentation", q: "Un connecteur logique d'opposition est :", opts: ["ainsi", "mais", "donc", "car"], correct: 1, exp: "« Mais » introduit une idée contraire à la précédente." },
        { type: "texte_a_trous", title: "Accord du participe passé", q: "Complète la règle.", textWithBlanks: "Avec l'auxiliaire être, le participe passé s'accorde avec le ___ ; avec avoir, il ne s'accorde en général pas avec le ___.", blanks: [["sujet"], ["sujet"]], exp: "Être → accord avec le sujet ; avoir → pas d'accord avec le sujet (sauf COD placé avant, hors programme ici)." },
    ]},
    { id: "physique", name: "Physique-Chimie", icon: "⚛", lessons: [
        { title: "Les états de la matière", q: "Comment appelle-t-on le passage direct de l'état solide à l'état gazeux ?", opts: ["condensation", "fusion", "évaporation", "sublimation"], correct: 3, exp: "La sublimation évite l'étape liquide." },
        { title: "La tension électrique", q: "Quelle unité mesure la tension électrique ?", opts: ["le volt", "l'ohm", "le watt", "l'ampère"], correct: 0, exp: "Le volt (V) mesure la tension." },
        { title: "Les atomes", q: "Combien de protons possède un atome d'hydrogène ?", opts: ["0", "2", "1", "8"], correct: 2, exp: "L'hydrogène a le numéro atomique 1." },
        { title: "Les mélanges", q: "L'eau salée est un exemple de :", opts: ["mélange homogène", "solide", "corps pur", "mélange hétérogène"], correct: 0, exp: "Le sel est totalement dissous : on ne distingue plus les constituants." },
        { type: "vrai_faux", title: "La lumière", q: "La lumière se déplace plus vite dans l'eau que dans le vide.", correct: false, exp: "Faux : la lumière est plus rapide dans le vide (≈300 000 km/s) que dans l'eau, où elle ralentit." },
    ]},
    { id: "chimie", name: "Chimie", icon: "🧪", lessons: [
        { title: "Les états de l'eau", q: "Comment appelle-t-on le passage direct de l'état solide à l'état gazeux ?", opts: ["la sublimation", "la fusion", "la condensation", "la liquéfaction"], correct: 0, exp: "La sublimation transforme la glace directement en vapeur, sans passer par l'état liquide." },
        { title: "Les atomes", q: "Que représente le numéro atomique Z d'un élément ?", opts: ["le nombre de protons du noyau", "le nombre de neutrons", "la masse totale de l'atome", "le nombre d'électrons perdus"], correct: 0, exp: "Z compte les protons : c'est lui qui définit l'élément chimique." },
        { type: "vrai_faux", title: "Les acides", q: "Une solution acide a un pH inférieur à 7.", correct: true, exp: "Vrai : à 25 °C, pH < 7 = acide, pH = 7 = neutre, pH > 7 = basique." },
        { title: "La neutralisation", q: "Que produit la réaction entre un acide et une base ?", opts: ["un sel et de l'eau", "un gaz toxique uniquement", "un métal", "rien : ils se neutralisent sans réaction"], correct: 0, exp: "Acide + base → sel + eau : c'est la réaction de neutralisation." },
        { type: "texte_a_trous", title: "La molécule d'eau", q: "Complète la formule de la molécule d'eau.", textWithBlanks: "La formule de l'eau est ___₂___ : deux atomes d'hydrogène pour un atome d'oxygène.", blanks: [["H"], ["O"]], exp: "H₂O : deux hydrogènes (H) et un oxygène (O)." },
    ]},
    { id: "svt", name: "SVT", icon: "❦", lessons: [
        { title: "La photosynthèse", q: "Quel gaz les plantes absorbent-elles lors de la photosynthèse ?", opts: ["le CO₂", "l'O₂", "l'hydrogène", "l'azote"], correct: 0, exp: "Le CO₂ est transformé en matière organique grâce à la lumière." },
        { title: "Le système digestif", q: "Où débute la digestion des glucides ?", opts: ["dans la bouche", "dans l'estomac", "dans le foie", "dans l'intestin grêle"], correct: 0, exp: "La salive contient une enzyme qui amorce la digestion de l'amidon." },
        { title: "La génétique", q: "L'ADN se trouve principalement dans :", opts: ["le cytoplasme", "la membrane", "le noyau de la cellule", "les ribosomes"], correct: 2, exp: "Le noyau protège et organise le matériel génétique." },
        { title: "Les écosystèmes", q: "Un organisme qui se nourrit exclusivement de végétaux est un :", opts: ["décomposeur", "carnivore", "herbivore", "omnivore"], correct: 2, exp: "Par définition, un herbivore ne consomme que des végétaux." },
        { type: "reponse_courte", title: "Le cœur", q: "Combien de cavités possède le cœur humain ?", accepted: ["4", "quatre"], exp: "Le cœur a 4 cavités : 2 oreillettes et 2 ventricules." },
    ]},
    { id: "techno", name: "Technologie", icon: "⚙", lessons: [
        { title: "Les algorithmes", q: "Une boucle qui répète des instructions tant qu'une condition est vraie s'appelle :", opts: ["une fonction", "une condition « si »", "une boucle « pour »", "une boucle « tant que »"], correct: 3, exp: "« Tant que » (while) répète tant que la condition reste vraie." },
        { title: "Les capteurs", q: "Un capteur de température mesure :", opts: ["la pression", "la chaleur ambiante", "le son", "la lumière"], correct: 1, exp: "C'est sa fonction première : convertir une température en signal exploitable." },
        { title: "Les matériaux", q: "Le PLA est un matériau souvent utilisé en :", opts: ["chauffage", "soudure", "impression 3D", "isolation électrique"], correct: 2, exp: "Le PLA est un plastique biodégradable très utilisé en fabrication additive." },
        { title: "Les réseaux", q: "Le Wi-Fi fait référence à :", opts: ["un câble réseau", "un type de processeur", "une connexion sans fil", "un logiciel"], correct: 2, exp: "Le Wi-Fi permet une connexion réseau sans câble." },
        { type: "drag_and_drop", title: "Composants électroniques", q: "Associe chaque composant à son rôle.", items: ["Résistance", "LED", "Capteur"], targets: ["Limite le courant", "Émet de la lumière", "Mesure une grandeur physique"], pairs: { "Résistance": "Limite le courant", LED: "Émet de la lumière", Capteur: "Mesure une grandeur physique" }, exp: "Chaque composant a une fonction précise dans un circuit." },
    ]},
    { id: "anglais", name: "Anglais", icon: "En", lessons: [
        { title: "Present Perfect", q: "Choose the correct form: 'I ___ never been to London.'", opts: ["have", "having", "has", "had"], correct: 0, exp: "Subject 'I' + present perfect → 'have never been'." },
        { title: "Vocabulaire du quotidien", q: "What does 'to look forward to' mean?", opts: ["chercher quelque chose", "attendre avec impatience", "regarder devant soi", "avancer"], correct: 1, exp: "Cette expression exprime une attente positive d'un événement." },
        { title: "Comparatives", q: "'This book is ___ than the other one.'", opts: ["interesting", "more interesting", "most interesting", "interestinger"], correct: 1, exp: "Les adjectifs longs forment leur comparatif avec 'more'." },
        { title: "Modal verbs", q: "Which modal expresses obligation?", opts: ["must", "could", "would", "might"], correct: 0, exp: "'Must' exprime une obligation forte." },
        { type: "texte_a_trous", title: "Simple past", q: "Complète la phrase.", textWithBlanks: "Yesterday, she ___ (go) to the cinema and ___ (watch) a great film.", blanks: [["went"], ["watched"]], exp: "'Go' est irrégulier (went) ; 'watch' est régulier (+ed)." },
    ]},
    { id: "histoire", name: "Histoire", icon: "⌂", lessons: [
        { title: "La Révolution française", q: "En quelle année la Révolution française a-t-elle débuté ?", opts: ["1804", "1715", "1848", "1789"], correct: 3, exp: "La prise de la Bastille a lieu le 14 juillet 1789." },
        { title: "La Première Guerre mondiale", q: "La Première Guerre mondiale se termine en :", opts: ["1920", "1918", "1945", "1914"], correct: 1, exp: "L'armistice est signé le 11 novembre 1918." },
        { title: "L'Empire romain", q: "Quelle ville était la capitale de l'Empire romain ?", opts: ["Carthage", "Byzance", "Rome", "Athènes"], correct: 2, exp: "Rome est le centre politique de l'Empire jusqu'à sa scission." },
        { title: "La décolonisation", q: "L'indépendance de l'Algérie a eu lieu en :", opts: ["1970", "1962", "1958", "1954"], correct: 1, exp: "Les accords d'Évian entérinent l'indépendance en 1962." },
        { type: "vrai_faux", title: "Napoléon", q: "Napoléon Bonaparte est devenu empereur des Français en 1804.", correct: false, exp: "Vrai : il est sacré empereur le 2 décembre 1804." },
    ]},
    { id: "geo", name: "Géographie", icon: "⊕", lessons: [
        { title: "Les fuseaux horaires", q: "Combien de fuseaux horaires existe-t-il sur Terre ?", opts: ["12", "20", "24", "30"], correct: 2, exp: "La Terre est divisée en 24 fuseaux d'environ 15° chacun." },
        { title: "L'urbanisation", q: "Une mégapole compte généralement plus de :", opts: ["100 millions d'habitants", "500 000 habitants", "1 million d'habitants", "10 millions d'habitants"], correct: 3, exp: "Le seuil communément retenu pour une mégapole est 10 millions d'habitants." },
        { title: "Le climat", q: "Le climat équatorial se caractérise par :", opts: ["tempéré", "froid et sec", "aride", "chaud et humide toute l'année"], correct: 3, exp: "Proche de l'équateur, températures et précipitations restent élevées toute l'année." },
        { title: "Les ressources", q: "Quelle énergie est considérée comme renouvelable ?", opts: ["le pétrole", "le gaz naturel", "le charbon", "l'énergie solaire"], correct: 3, exp: "Le soleil est une source inépuisable à l'échelle humaine." },
        { type: "reponse_courte", title: "Le plus long fleuve", q: "Quel est le plus long fleuve du monde ?", accepted: ["nil", "le nil"], exp: "Le Nil (environ 6 650 km) est généralement considéré comme le plus long fleuve du monde." },
    ]},
    { id: "emc", name: "EMC", icon: "⚖", lessons: [
        { title: "La citoyenneté", q: "Quel âge faut-il avoir pour voter en France ?", opts: ["21 ans", "18 ans", "16 ans", "25 ans"], correct: 1, exp: "La majorité électorale est fixée à 18 ans." },
        { title: "Les institutions", q: "Qui est élu au suffrage universel direct en France ?", opts: ["le Premier ministre", "les préfets", "le Président de la République", "les juges"], correct: 2, exp: "Le Président est élu directement par les citoyens depuis 1962." },
        { title: "Les valeurs de la République", q: "« Liberté, Égalité, Fraternité » est :", opts: ["un traité", "un article de loi", "la devise de la France", "une chanson"], correct: 2, exp: "Cette devise figure dans la Constitution française." },
        { title: "La justice", q: "Le principe de présomption d'innocence signifie que :", opts: ["on est toujours coupable", "on est innocent tant que la culpabilité n'est pas prouvée", "la peine est automatique", "il n'y a pas de procès"], correct: 1, exp: "Ce principe protège tout accusé jusqu'au jugement." },
        { type: "drag_and_drop", title: "Les pouvoirs", q: "Associe chaque pouvoir à son rôle.", items: ["Pouvoir exécutif", "Pouvoir législatif", "Pouvoir judiciaire"], targets: ["Applique les lois", "Vote les lois", "Fait respecter les lois"], pairs: { "Pouvoir exécutif": "Applique les lois", "Pouvoir législatif": "Vote les lois", "Pouvoir judiciaire": "Fait respecter les lois" }, exp: "La séparation des pouvoirs structure les institutions démocratiques." },
    ]},
];

// Étend chaque matière de 5 leçons écrites à la main à 100 niveaux
// (voir question-bank.js — QuestionBank.extend). Les 5 premières restent
// inchangées (et sont les seules à utiliser les types autres que QCM) ;
// les niveaux 6 à 100 sont générés depuis une banque de vraies questions
// (9 matières) ou procéduralement (Mathématiques).
// Le niveau scolaire choisi sur jouer.html (DB.setNiveau) est stocké
// globalement — dashboard.html et map.html le relisent tous les deux ici,
// même si seul jouer.html propose un sélecteur. Sans niveau enregistré
// (première visite, ou visite directe du dashboard), on suppose un niveau
// collège par défaut plutôt que de deviner.
// v1.19 — Fournit les matières par défaut au panneau d'administration
// (admin.html les affiche et les édite sans les dupliquer).
if (typeof AdminStore !== 'undefined' && AdminStore.registerDefaults) {
    AdminStore.registerDefaults(RAW_DASH_SUBJECTS);
}

const NIVEAU_BAND = currentNiveauBand();

// v1.19 — Matières et leçons personnalisées via le panneau d'administration
// (admin.html). AdminStore applique les surcharges nom/icône/leçons sur les
// matières par défaut et ajoute les matières créées dans le panneau. Les
// matières personnalisées (_custom) gardent EXACTEMENT les leçons écrites par
// l'administrateur (pas de génération automatique) ; les autres sont étendues
// à 100 niveaux par QuestionBank comme avant.
const DASH_SUBJECTS = (typeof AdminStore !== 'undefined' ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS) : RAW_DASH_SUBJECTS)
    .map(s => s._custom ? s : QuestionBank.extend(s, 100, NIVEAU_BAND));

/**
 * Catalogue des badges (succès) disponibles.
 * `test(ctx)` reçoit un petit contexte et retourne true si le badge doit
 * être débloqué. Appelé après chaque quiz terminé et chaque achat de
 * skin (voir checkBadges ci-dessous). Idempotent : DB.unlockBadge()
 * ignore un badge déjà possédé.
 */
/**
 * Correspondance matière (id DASH_SUBJECTS) → nom affiché + icône attendus
 * par map.html (?matiere=...&icon=...). Utilisée par _dashOpenMap pour
 * rediriger vers la vraie carte de progression (v2.3, 100 niveaux) plutôt
 * que la constellation interne du dashboard (voir renderMap plus bas,
 * conservée uniquement en repli pour les matières sans îlot graphique
 * dédié — actuellement seule l'EMC est dans ce cas).
 */
const SUBJECT_TO_MATIERE = {
    maths:    { name: 'Mathématiques', icon: 'maths.webp' },
    francais: { name: 'Français',      icon: 'francais.webp' },
    histoire: { name: 'Histoire',      icon: 'histoire.webp' },
    geo:      { name: 'Géographie',    icon: 'geo.svg' },
    svt:      { name: 'SVT',           icon: 'svt.webp' },
    anglais:  { name: 'Anglais',       icon: 'anglais.webp' },
    physique: { name: 'Physique',      icon: 'physique.webp' },
    chimie:   { name: 'Chimie',        icon: 'chimie.svg' },
    techno:   { name: 'Technologie',   icon: 'technologie.webp' },
};

const BADGES_CATALOG = [
    { id: 'premier_quiz', icon: '🎯', name: 'Premier pas', desc: 'Réussis ta toute première question.',
        test: (ctx) => ctx.totalCompleted >= 1 },
    { id: 'sans_faute', icon: '✨', name: 'Sans-faute', desc: 'Réponds juste du premier coup, sans réessayer.',
        test: (ctx) => ctx.justAnsweredFirstTry },
    { id: 'toutes_matieres', icon: '🌐', name: 'Touche-à-tout', desc: 'Termine au moins une leçon dans chaque matière.',
        test: (ctx) => DASH_SUBJECTS.every(s => (ctx.state.progress[s.id] || 0) >= 1) },
    { id: 'matiere_complete', icon: '🏆', name: 'Expert(e)', desc: 'Termine toutes les leçons d\'une même matière.',
        test: (ctx) => DASH_SUBJECTS.some(s => (ctx.state.progress[s.id] || 0) >= s.lessons.length) },
    { id: 'collectionneur', icon: '🎨', name: 'Collectionneur', desc: 'Possède 3 skins différents.',
        test: (ctx) => ctx.state.ownedSkins.length >= 3 },
    { id: 'niveau_5', icon: '🚀', name: 'Étoile montante', desc: 'Atteins le niveau 5.',
        test: (ctx) => Math.floor(ctx.state.xp / 100) + 1 >= 5 },
];

function initDashboard() {
    const dashApp = document.getElementById('dashboard-app');
    if (!dashApp) return; // Pas sur la page dashboard.html → on sort

    /* ============ ÉTAT PERSISTÉ ============ */

    /**
     * Charge l'état du dashboard depuis localStorage via DB.
     * Toutes les valeurs sont des strings dans DB, on les parse ici.
     */
    function loadState() {
        return {
            coins:        parseInt(getOption('dash_coins') || '30'),
            xp:           parseInt(getOption('dash_xp') || '0'),
            equippedSkin: getOption('dash_equippedSkin') || 'aurore',
            ownedSkins:   JSON.parse(getOption('dash_ownedSkins') || '["aurore"]'),
            view:         'dashboard', // Toujours revenir au dashboard au chargement
            currentSubject: null,
            progress:     JSON.parse(getOption('dash_progress') || '{}'),
            quiz:         null,
            badges:       DB.getBadges(), // Identifiants des badges déjà débloqués
        };
    }

    /** Sauvegarde l'état modifiable dans localStorage via DB. */
    function persistState() {
        saveOption('dash_coins',        String(state.coins));
        saveOption('dash_xp',           String(state.xp));
        saveOption('dash_equippedSkin', state.equippedSkin);
        saveOption('dash_ownedSkins',   JSON.stringify(state.ownedSkins));
        saveOption('dash_progress',     JSON.stringify(state.progress));
    }

    let state = loadState();
    // Initialise la progression pour les matières qui n'ont pas encore de données
    DASH_SUBJECTS.forEach(s => {
        if (!(s.id in state.progress)) state.progress[s.id] = 0;
    });

    /* ============ HELPERS ============ */
    function skinColor(id) {
        return (DASH_SKINS.find(s => s.id === id) || DASH_SKINS[0]).color;
    }
    /** Chemin de l'image de portrait d'un skin, ou null pour les skins "halo de couleur" pure. */
    function skinImage(id) {
        return (DASH_SKINS.find(s => s.id === id) || DASH_SKINS[0]).img || null;
    }
    function level() { return Math.floor(state.xp / 100) + 1; }
    function xpInLevel() { return state.xp % 100; }

    /**
     * Vérifie tous les badges du catalogue et débloque ceux dont la
     * condition est remplie. Affiche une notification pour chaque nouveau
     * badge. Retourne la liste des badges nouvellement débloqués.
     *
     * @param {object} extra - contexte ponctuel ajouté au ctx passé aux tests
     *   (ex: { justAnsweredFirstTry: true } juste après une bonne réponse)
     */
    function checkBadges(extra = {}) {
        const totalCompleted = Object.values(state.progress).reduce((a, b) => a + b, 0);
        const ctx = { state, totalCompleted, justAnsweredFirstTry: false, ...extra };
        const unlocked = [];
        BADGES_CATALOG.forEach(badge => {
            if (state.badges.includes(badge.id)) return;
            if (badge.test(ctx)) {
                DB.unlockBadge(badge.id);
                state.badges.push(badge.id);
                unlocked.push(badge);
            }
        });
        unlocked.forEach(badge => showNotification(`${badge.icon} Succès débloqué : ${badge.name} !`));
        return unlocked;
    }

    /* ============ RENDU ============ */

    /** Point d'entrée du rendu — reconstruit tout le contenu de #dashboard-app */
    function render() {
        document.documentElement.style.setProperty('--dash-skin', skinColor(state.equippedSkin));
        dashApp.innerHTML = `
            ${renderHeader()}
            ${renderHud()}
            ${renderTabs()}
            ${state.view === 'dashboard' ? renderDashboard() : ''}
            ${state.view === 'map' ? renderMap() : ''}
            ${state.view === 'shop' ? renderShop() : ''}
            ${state.view === 'badges' ? renderBadges() : ''}
            <div class="dash-footer-note">EDUQUEST — Contenus pédagogiques rédigés à titre d'exemple.</div>
        `;
        if (state.quiz) renderQuizModal();
    }

    function renderHeader() {
        // Affiche le pseudo du joueur connecté (login.html) s'il y en a un ;
        // le dashboard reste utilisable sans compte (progression stockée
        // localement dans ce cas, comme pour un invité).
        const user = DB.getCurrentUser();
        const greeting = user ? `<span class="dash-user-greeting">Salut, ${escapeHtml(user.username)} 👋</span>` : '';
        
        // --- Sélecteur de niveau scolaire (remplace jouer.html) ---
        const niveaux = (window.AdminStore && typeof AdminStore.getNiveauxScolaires === 'function') 
            ? AdminStore.getNiveauxScolaires() 
            : [
                {id:'6eme', name:'6ème'}, {id:'5eme', name:'5ème'}, {id:'4eme', name:'4ème'},
                {id:'3eme', name:'3ème'}, {id:'2nde', name:'2nde'}, {id:'1ere', name:'1ère'}, {id:'terminale', name:'Terminale'}
            ];
        const currentNiveau = DB.getNiveau() || '6eme';
        const optionsHtml = niveaux.map(n => `<option value="${n.id}" ${n.id === currentNiveau ? 'selected' : ''}>${escapeHtml(n.label || n.name)}</option>`).join('');

        return `<header class="dash-header">
            <div class="dash-brand"><b>EDU</b><span>QUEST</span></div>
            <select class="dash-grade-select" onchange="window._dashChangeNiveau(this.value)" aria-label="Choisir sa classe">
                ${optionsHtml}
            </select>
            ${greeting}
        </header>`;    }

    function renderHud() {
        const pct = xpInLevel();
        return `<div class="dash-hud">
            <div class="dash-avatar" style="--dash-skin:${skinColor(state.equippedSkin)}">${skinImage(state.equippedSkin) ? `<img src="${skinImage(state.equippedSkin)}" alt="">` : `N${level()}`}</div>
            <div class="dash-hud-mid">
                <div class="dash-hud-level">Niveau ${level()} <span class="mono">· ${pct}/100 XP</span></div>
                <div class="dash-xp-track"><div class="dash-xp-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="dash-coins"><span class="dash-coin-dot"></span>${state.coins}</div>
        </div>`;
    }

    function renderTabs() {
        return `<nav class="dash-tabs">
            <button class="dash-tab ${state.view === 'dashboard' || state.view === 'map' ? 'active' : ''}" onclick="window._dashGoDashboard()">Matières</button>
            <button class="dash-tab ${state.view === 'shop' ? 'active' : ''}" onclick="window._dashGoShop()">Boutique</button>
            <button class="dash-tab ${state.view === 'badges' ? 'active' : ''}" onclick="window._dashGoBadges()">Succès (${state.badges.length}/${BADGES_CATALOG.length})</button>
        </nav>`;
    }

    /** Vue "Succès" : catalogue complet des badges, débloqués ou non. */
    function renderBadges() {
        const cards = BADGES_CATALOG.map(badge => {
            const unlocked = state.badges.includes(badge.id);
            return `<div class="dash-skin-card dash-badge-card ${unlocked ? '' : 'locked'}">
                <div class="dash-badge-icon">${unlocked ? badge.icon : '🔒'}</div>
                <div class="dash-skin-name">${escapeHtml(badge.name)}</div>
                <div class="dash-badge-desc">${escapeHtml(badge.desc)}</div>
            </div>`;
        }).join('');
        return `<section>
            <div class="dash-eyebrow">Succès</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Tes accomplissements</h2>
            <div class="dash-skins-grid">${cards}</div>
        </section>`;
    }

    function renderDashboard() {
        const cards = DASH_SUBJECTS.map(s => {
            const done = state.progress[s.id] || 0;
            const total = s.lessons.length;
            const pct = Math.round((done / total) * 100);
            return `<div class="dash-subject-card" onclick="window._dashOpenMap('${s.id}')" tabindex="0" role="button" aria-label="${escapeHtml(s.name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window._dashOpenMap('${s.id}');}">
                <span class="dash-pct mono">${done}/${total}</span>
                <div class="dash-subject-icon">${s.icon}</div>
                <h3>${s.name}</h3>
                <div class="dash-progress-track"><div class="dash-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
        return `<section>
            <div class="dash-eyebrow">Ta progression</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Choisis une matière à explorer</h2>
            <div class="dash-subjects-grid">${cards}</div>
        </section>`;
    }

    function nodePositions(n) {
        const positions = [];
        const stepX = 560 / (n - 1);
        for (let i = 0; i < n; i++) {
            const x = 20 + stepX * i;
            const y = i % 2 === 0 ? 150 : 60;
            positions.push({ x, y });
        }
        return positions;
    }

    function renderMap() {
        const subject = DASH_SUBJECTS.find(s => s.id === state.currentSubject);
        const done = state.progress[subject.id] || 0;
        // Repli constellation (EMC uniquement, voir _dashOpenMap) : cette vue
        // n'est pas défilante, donc on plafonne l'affichage pour rester lisible
        // plutôt que de compresser 100 nœuds sur 600px de large.
        const MAX_VISIBLE = 12;
        const visibleLessons = subject.lessons.slice(0, MAX_VISIBLE);
        const positions = nodePositions(visibleLessons.length);
        const pathD = positions.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ');

        const nodesSvg = visibleLessons.map((lesson, i) => {
            const p = positions[i];
            const completed = i < done;
            const current = i === done;
            const locked = i > done;
            // Couleurs adaptées à la charte global.css
            let fill = 'rgba(255,255,255,0.12)'; // locked
            let ring = '';
            if (completed) fill = 'var(--c-green-light)';
            if (current) {
                fill = 'var(--c-gold)';
                ring = `<circle cx="${p.x}" cy="${p.y}" r="22" fill="none" stroke="var(--c-gold)" stroke-width="1.5" opacity="0.5">
                    <animate attributeName="r" values="16;24;16" dur="2.4s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite"/>
                </circle>`;
            }
            const glyph = completed ? '✓' : (locked ? '🔒' : (i + 1));
            return `
                ${ring}
                <g class="dash-node-group" onclick="${locked ? '' : `window._dashOpenQuiz('${subject.id}', ${i})`}" style="${locked ? 'cursor:default;' : ''}">
                    <circle cx="${p.x}" cy="${p.y}" r="16" fill="${fill}" stroke="var(--c-night)" stroke-width="2"/>
                    <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="${locked ? 'rgba(255,255,255,0.3)' : 'var(--c-night)'}">${glyph}</text>
                    <text x="${p.x}" y="${p.y + (i % 2 === 0 ? -26 : 34)}" text-anchor="middle" class="dash-node-label">${escapeHtml(lesson.title)}</text>
                </g>`;
        }).join('');

        return `<section>
            <button class="dash-back-map" onclick="window._dashGoDashboard()">← Retour aux matières</button>
            <div class="dash-map-wrap">
                <div class="dash-map-title">
                    <div class="dash-eyebrow">${subject.icon}  Parcours</div>
                    <h2>${subject.name}</h2>
                    ${subject.lessons.length > MAX_VISIBLE ? `<p style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:4px;">Aperçu des ${MAX_VISIBLE} premiers niveaux sur ${subject.lessons.length}.</p>` : ''}
                </div>
                <svg viewBox="0 0 600 210" style="width:100%; height:auto; display:block; margin-top:6px;">
                    <path d="${pathD}" fill="none" stroke="rgba(200,168,75,0.2)" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
                    ${nodesSvg}
                </svg>
            </div>
        </section>`;
    }

    function renderShop() {
        const cards = DASH_SKINS.map(s => {
            const owned = state.ownedSkins.includes(s.id);
            const equipped = state.equippedSkin === s.id;
            let btn;
            if (equipped) {
                btn = `<button class="dash-skin-btn equipped" disabled>Équipé</button>`;
            } else if (owned) {
                btn = `<button class="dash-skin-btn equip" onclick="window._dashEquipSkin('${s.id}')">Équiper</button>`;
            } else {
                const affordable = state.coins >= s.cost;
                btn = `<button class="dash-skin-btn buy" ${affordable ? '' : 'disabled'} onclick="window._dashBuySkin('${s.id}')">Acheter</button>`;
            }
            return `<div class="dash-skin-card">
                <div class="dash-skin-orb" style="--sc:${s.color}">${s.img ? `<img src="${s.img}" alt="">` : ''}</div>
                <div class="dash-skin-name">${escapeHtml(s.name)}</div>
                <div class="dash-skin-cost">${s.cost === 0 ? 'Offert' : s.cost + ' pièces'}</div>
                ${btn}
            </div>`;
        }).join('');
        return `<section>
            <div class="dash-eyebrow">Boutique</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Personnalise ton halo</h2>
            <div class="dash-skins-grid">${cards}</div>
        </section>`;
    }

    /**
     * Rendu de la modale de quiz. Contrairement à la version v2.0 (QCM
     * uniquement, boutons générés ici-même), la zone de réponse est
     * maintenant déléguée à QuizEngine, qui sait rendre/corriger les 5
     * types de questions (voir quiz-engine.js). Ce qui reste propre au
     * dashboard (titre, feedback, boutons Continuer/Réessayer, récompenses)
     * continue d'être généré ici.
     */
    function renderQuizModal() {
        const { subjectId, lessonIndex, submitted, answered, isCorrect, loading, checking, explanation } = state.quiz;
        const subject = DASH_SUBJECTS.find(s => s.id === subjectId);

        if (loading) {
            const overlay = document.createElement('div');
            overlay.className = 'dash-overlay';
            overlay.id = 'dashQuizOverlay';
            overlay.innerHTML = `<div class="dash-modal">
                <div class="dash-eyebrow">${subject.name} · Niveau ${lessonIndex + 1}</div>
                <h3 role="status" aria-live="polite">Génération de la question…</h3>
            </div>`;
            dashApp.appendChild(overlay);
            return;
        }

        const lesson = state.quiz.lesson;

        let feedback = '';
        if (checking) {
            feedback = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
        } else if (answered) {
            feedback = `<div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">${isCorrect ? '✓ Bonne réponse ! ' : '✗ Pas tout à fait. '}${escapeHtml(explanation)}</div>`;
            if (isCorrect) {
                feedback += `<div class="dash-reward-line"><span>+15 XP</span><span>+10 <span class="dash-coin-dot" style="display:inline-block; width:10px;height:10px; vertical-align:middle;"></span></span></div>`;
            }
        }

        const actions = !answered
            ? `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Annuler</button></div>`
            : isCorrect
                ? `<div class="dash-modal-actions"><button class="dash-btn-primary" onclick="window._dashFinishQuiz()">Continuer</button></div>`
                : `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Quitter</button><button class="dash-btn-primary" onclick="window._dashRetryQuiz()">Réessayer</button></div>`;

        const overlay = document.createElement('div');
        overlay.className = 'dash-overlay';
        overlay.id = 'dashQuizOverlay';
        overlay.innerHTML = `<div class="dash-modal">
            <div class="dash-eyebrow">${escapeHtml(subject.name)} · ${escapeHtml(lesson.title)}</div>
            <h3>${escapeHtml(lesson.q)}</h3>
            <div class="dash-quiz-body">${QuizEngine.renderBody(lesson)}</div>
            ${feedback}
            ${actions}
        </div>`;
        dashApp.appendChild(overlay);

        // La zone interactive est câblée après insertion dans le DOM (les
        // événements ont besoin des vrais éléments, pas de la chaîne HTML).
        const body = overlay.querySelector('.dash-quiz-body');
        if (answered) {
            QuizEngine.reveal(body, lesson, submitted);
        } else if (!checking) {
            QuizEngine.bind(body, lesson, state.quiz, window._dashSubmitQuiz);
        }
    }

    /* ============ ACTIONS (exposées sur window pour les onclick inline) ============ */

    window._dashChangeNiveau = function(val) {
        DB.setNiveau(val);
        // Force la recharge du dashboard complet (HUD, Map, etc.)
        render();
    };

    window._dashGoDashboard = function () {
        state.view = 'dashboard';
        state.currentSubject = null;
        render();
    };

    window._dashGoShop = function () {
        state.view = 'shop';
        render();
    };

    window._dashGoBadges = function () {
        state.view = 'badges';
        render();
    };

    window._dashOpenMap = function (id) {
        // v1.19 — Matières renommées/personnalisées via le panneau d'admin :
        // on cherche d'abord le sujet réel dans DASH_SUBJECTS pour son nom et
        // son icône actuels, puis on retombe sur la correspondance historique
        // (îlots graphiques dédiés avec fichiers PNG/SVG dans Image/ile/).
        const subj = DASH_SUBJECTS.find(s => s.id === id);
        // L'icône fichier (îlot graphique) reste prioritaire quand elle existe
        // (SUBJECT_TO_MATIERE) ; sinon on utilise l'icône/emoji de la matière.
        const island = SUBJECT_TO_MATIERE[id];
        const matiere = subj ? { name: subj.name, icon: island ? island.icon : subj.icon } : null;
        if (matiere) {
            // Redirige vers la vraie carte de progression (100 niveaux, v2.3).
            window.location.href = 'map.html?matiere=' + encodeURIComponent(matiere.name) + '&icon=' + encodeURIComponent(matiere.icon);
            return;
        }
        // Repli : constellation interne (voir renderMap), pour les matières
        // sans îlot graphique dédié.
        state.currentSubject = id;
        state.view = 'map';
        render();
    };

    window._dashOpenQuiz = async function (subjectId, lessonIndex) {
        // "loading: true" affiche un état d'attente pendant l'appel à
        // l'agent IA (voir renderQuizModal) — indispensable maintenant que
        // la question n'est plus toujours disponible instantanément en mémoire.
        state.quiz = { subjectId, lessonIndex, loading: true, lesson: null, questionId: null, submitted: null, answered: false, isCorrect: false, attempts: 0, explanation: '' };
        render();

        const niveauBand = currentNiveauBand();
        // v1.19 — La leçon du niveau (éventuellement surchargée par le panneau
        // d'administration) est servie telle quelle en mode local, comme sur
        // map.html ; sinon on laisse l'IA / le générateur faire.
        const dashSubj = DASH_SUBJECTS.find(s => s.id === subjectId);
        const localLesson = dashSubj && dashSubj.lessons[lessonIndex] ? dashSubj.lessons[lessonIndex] : null;
        const { lesson, questionId } = await AiProvider.fetchQuestion(
            subjectId, lessonIndex, niveauBand, localLesson ? { localLesson } : {}
        );

        // Si l'élève a fermé la modale pendant le chargement, on ignore le résultat.
        if (!state.quiz || state.quiz.subjectId !== subjectId || state.quiz.lessonIndex !== lessonIndex) return;
        state.quiz.lesson = lesson;
        state.quiz.questionId = questionId;
        state.quiz.loading = false;
        render();
    };

    window._dashCloseQuiz = function () {
        state.quiz = null;
        render();
    };

    window._dashRetryQuiz = function () {
        state.quiz.submitted = null;
        state.quiz.answered = false;
        state.quiz.isCorrect = false;
        state.quiz.explanation = '';
        render();
    };

    /**
     * Appelée par QuizEngine.bind() quel que soit le type de question :
     * un index (QCM), un booléen (Vrai/Faux), une chaîne (réponse courte),
     * un tableau (texte à trous) ou un objet de paires (association).
     * La correction elle-même passe par AiProvider (agent IA si configuré,
     * repli local sinon) — voir ai-provider.js.
     */
    window._dashSubmitQuiz = async function (rawAnswer) {
        const quiz = state.quiz;
        quiz.submitted = rawAnswer;
        quiz.attempts += 1;
        quiz.checking = true; // Court instant d'attente pendant la correction côté IA
        render();

        const result = await AiProvider.submitAnswer(quiz.questionId, quiz.lesson, rawAnswer);
        if (state.quiz !== quiz) return; // Modale fermée entre-temps

        quiz.checking = false;
        quiz.answered = true;
        quiz.isCorrect = result.isCorrect;
        quiz.explanation = result.explanation;
        // Fusionne la clé de correction (ex. correctIndex) dans la leçon en
        // mémoire, pour que QuizEngine.reveal() puisse surligner la bonne
        // réponse — elle n'était pas présente avant cette réponse en mode IA.
        quiz.lesson = { ...quiz.lesson, ...result.answerKey };
        render();
    };

    window._dashFinishQuiz = function () {
        const { subjectId, lessonIndex, attempts } = state.quiz;
        let unlocked = [];
        if (lessonIndex === (state.progress[subjectId] || 0)) {
            state.progress[subjectId] = (state.progress[subjectId] || 0) + 1;
            state.xp += 15;
            state.coins += 10;
            unlocked = checkBadges({ justAnsweredFirstTry: attempts === 1 });
        }
        state.quiz = null;
        persistState(); // Sauvegarde la progression, XP, pièces et badges
        render();
        showNotification('✓ +15 XP et +10 pièces !');
    };

    window._dashBuySkin = function (id) {
        const skin = DASH_SKINS.find(s => s.id === id);
        if (state.coins < skin.cost) return;
        state.coins -= skin.cost;
        state.ownedSkins.push(id);
        state.equippedSkin = id;
        checkBadges();
        persistState(); // Sauvegarde l'achat (+ les badges éventuellement débloqués)
        render();
        showNotification('✓ Skin « ' + skin.name + ' » acheté et équipé !');
    };

    window._dashEquipSkin = function (id) {
        state.equippedSkin = id;
        persistState(); // Sauvegarde l'équipement
        render();
    };

    /* ============ PREMIER RENDU ============ */
    persistState(); // Sauvegarde initiale pour créer les clés si elles n'existent pas
    render();
}

/* ==========================================================================
   INITIALISATION GLOBALE — Point d'entrée unique
   ========================================================================== */
/**
 * Exécuté quand le DOM est entièrement chargé (tous les éléments HTML sont disponibles).
 * Lance les fonctions d'initialisation communes à toutes les pages, puis les
 * initialiseurs spécifiques à chaque page.
 *
 * ORDRE D'EXÉCUTION :
 * 1. Musique    → prépare la lecture audio (pas encore lancée)
 * 2. Environnement → génère les étoiles et nuages
 * 3. Footer     → version + crédits personnalisés (panneau d'administration)
 * 4. Cookies    → bandeau de consentement RGPD (cookies.js, automatique)
 * 5. Fullscreen → tente le plein écran si activé dans les options
 * 6. Initialiseurs de pages → seul celui de la bonne page fait quelque chose
 *
 * DÉTECTION DE PAGE :
 * Chaque initX() vérifie si ses éléments HTML cibles existent.
 * Si non → retour immédiat sans erreur.
 * Si oui → initialisation complète.
 * Cela évite d'avoir un fichier JS par page.
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Initialisation de la musique (lit les préférences, charge la piste)
    initGlobalMusic();

    // 2. Création des éléments visuels (étoiles + nuages)
    createEnvironment();

    // 3. Mise à jour du numéro de version dans le footer
    updateFooterVersion();

    // 3bis. Crédits du créateur (v1.20) — personnalisables depuis le panneau
    refreshFooterCredits();

    // 3ter. Consentement cookies (v1.20) — filet de sécurité si cookies.js
    // n'a pas pu s'initialiser (le bandeau lui-même est auto-suffisant)
    // setupCookieConsentFallback();

    // 4. Plein écran automatique si activé dans les options
    // Première tentative au chargement (souvent bloquée par les navigateurs)
    applyFullscreenSetting();

    // Deuxième tentative au premier clic (les navigateurs l'autorisent alors)
    function onFirstInteraction() {
        applyFullscreenSetting();
        document.removeEventListener('click', onFirstInteraction, true); // Retire l'écouteur
    }
    document.addEventListener('click', onFirstInteraction, true);

    // 5. Initialisation des fonctionnalités spécifiques à chaque page
    // Chaque fonction détecte si elle est sur la bonne page avant d'agir
    initAccueil();    // index.html   → bouton Quitter
    // initConnexion();  // login.html   → formulaires connexion + inscription
    initOptions();    // options.html → contrôles de préférences

    initMap();        // map.html     → carte de progression par niveau
    initDashboard();  // dashboard.html → tableau de bord + quiz + boutique

    // Ouverture automatique de la modale des options si demandée via l'URL (#options)
    if (window.location.hash === '#options') {
        const modalOptions = document.getElementById('modalOptions');
        if (modalOptions) {
            modalOptions.hidden = false;
            // Supprime le hash de l'URL pour ne pas le rouvrir au rechargement
            history.replaceState(null, null, window.location.pathname + window.location.search);
        }
    }

    // 6. Enregistrement du Service Worker (PWA) pour le mode 100% hors-ligne
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker enregistré', reg.scope))
            .catch(err => console.error('Erreur Service Worker', err));
    }
});
