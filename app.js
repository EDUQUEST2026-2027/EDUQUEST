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
   GESTIONNAIRE D'ERREUR GLOBAL (PWA / Audit v1.18)
   Capture les erreurs fatales pour afficher une UI élégante plutôt qu'un écran blanc.
========================================================================== */
function setupGlobalErrorHandler() {
    function showErrorScreen(msg) {
        if (document.getElementById('eduquest-crash-screen')) return;
        const crashScreen = document.createElement('div');
        crashScreen.id = 'eduquest-crash-screen';
        crashScreen.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 15, 36, 0.95); backdrop-filter: blur(10px);
            z-index: 999999; display: flex; flex-direction: column;
            justify-content: center; align-items: center; color: white;
            font-family: var(--font-pixel-ui, 'Cinzel', serif); text-align: center;
            padding: 20px; box-sizing: border-box;
        `;
        crashScreen.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
            <h1 style="color: #ff4757; margin-bottom: 15px; font-size: 2rem;">Aïe... Le jeu a trébuché !</h1>
            <p style="color: #a4b0be; max-width: 600px; margin-bottom: 30px; line-height: 1.6;">
                Une erreur inattendue s'est produite en coulisses.<br>
                <code style="display: block; margin-top: 15px; padding: 10px; background: #2f3542; color: #ff6b81; border-radius: 5px; font-family: monospace; font-size: 0.9rem;">${msg}</code>
            </p>
            <button onclick="window.location.reload(true)" style="
                background: linear-gradient(135deg, #1e90ff, #3742fa);
                border: none; padding: 15px 30px; color: white; font-weight: bold;
                border-radius: 8px; cursor: pointer; font-size: 1.2rem;
                box-shadow: 0 4px 15px rgba(30, 144, 255, 0.4);
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                🔄 Recharger la page
            </button>
        `;
        document.body.appendChild(crashScreen);
    }

    window.addEventListener('error', (event) => {
        console.error("Global error caught:", event.error);
        showErrorScreen(event.message || "Erreur de script inconnue.");
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error("Unhandled promise rejection:", event.reason);
        const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
        showErrorScreen("Erreur asynchrone : " + msg);
    });
}
setupGlobalErrorHandler();

/* ==========================================================================
   1. UTILITAIRES PARTAGÉS
   Fonctions simples utilisées sur plusieurs pages.
   ========================================================================== */

/** Version de l'application — affichée dans le footer de toutes les pages. */
const APP_VERSION = '1.25.0';

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
    if (c.githubUrl) {
        const ghUrl = /^https?:\/\//i.test(c.githubUrl) ? c.githubUrl : 'https://' + c.githubUrl;
        bits.push('<a href="' + escapeHtml(ghUrl) + '" target="_blank" rel="noopener" class="footer-github-link" title="Dépôt GitHub du projet">🐙 GitHub</a>');
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

    const optGh = document.getElementById('optionsGithubLink');
    if (optGh) {
        if (c.githubUrl) {
            optGh.href = /^https?:\/\//i.test(c.githubUrl) ? c.githubUrl : 'https://' + c.githubUrl;
            optGh.style.display = '';
        } else {
            optGh.style.display = 'none';
        }
    }
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

function currentNiveau() {
    return (typeof DB !== 'undefined' && DB.getNiveau) ? (DB.getNiveau() || '6eme') : '6eme';
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
 * Active ou désactive les animations esthétiques de l'interface (Étape 10).
 * Ajoute ou retire la classe 'no-animations' sur document.body.
 */
function applyAnimationsSetting() {
    const val = getOption('animationsActives');
    if (val === 'false') {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
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
    applyAnimationsSetting();
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
                    window.location.reload();
                }, 800);
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
                    window.location.reload();
                }, 800);
            } else {
                showNotification(result.error || 'Erreur lors de l\'inscription.', 'error');
            }
        });
    }

    /* --- Déconnexion --- */
    /**
     * Appelle DB.logout() pour effacer la session, puis met à jour l'affichage
     * et recharge la page pour basculer sur la session invité.
     */
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await DB.logout(); // Efface la session (locale ET serveur si API activée)
            showNotification('Déconnecté.');
            updateUserDisplay(); // Cache le bloc userInfo immédiatement
            setTimeout(() => { 
                if(document.getElementById('modalLogin')) document.getElementById('modalLogin').hidden = true;
                window.location.reload();
            }, 600);
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
    const animationsCheckbox = document.getElementById('animationsActives'); // Checkbox Animations esthétiques
    const modeChronoCheckbox = document.getElementById('modeChrono');    // Checkbox Mode Défi Chronométré

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
        ['pleinEcran', 'particules', 'ecoMode', 'sonsActifs', 'musiqueActive', 'effetsActifs', 'modeChrono', 'animationsActives'].forEach(id => {
            const value = getOption(id);
            const el    = document.getElementById(id);
            if (!el) return;
            if (value !== null) {
                el.checked = value === 'true'; // Convertit la string en booléen
            } else if (['sonsActifs', 'musiqueActive', 'effetsActifs', 'animationsActives'].includes(id)) {
                el.checked = true; // Valeur par défaut : activé
            }
        });

        const optNiveauEl = document.getElementById('optionsNiveauSelect');
        if (optNiveauEl && typeof DB !== 'undefined' && DB.getNiveau) {
            optNiveauEl.value = DB.getNiveau() || '6eme';
        }

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

    // Checkbox Particules & Animations : affiche/cache et applique immédiatement
    ecoModeCheckbox.addEventListener('change', applyEcoModeSetting);
    particulesCheckbox.addEventListener('change', applyParticulesSetting);
    if (animationsCheckbox) animationsCheckbox.addEventListener('change', applyAnimationsSetting);

    /* --- Bouton Sauvegarder --- */
    /**
     * Sauvegarde toutes les options via DB.saveOption().
     * Gestion spéciale pour la musique/effets : si le son global est désactivé,
     * on sauvegarde les valeurs "précédentes" (avant désactivation) pour les
     * restaurer correctement à la prochaine ouverture.
     */
    function saveCurrentOptionsLocally() {
        saveOption('volumeMusique', volumeMusique.value);
        saveOption('volumeEffets', volumeEffets.value);
        saveOption('pleinEcran', String(pleinEcran.checked));
        saveOption('particules', String(particulesCheckbox.checked));
        saveOption('ecoMode', String(ecoModeCheckbox.checked));
        if (animationsCheckbox) saveOption('animationsActives', String(animationsCheckbox.checked));
        saveOption('sonsActifs', String(sonsActifs.checked));
        if (modeChronoCheckbox) saveOption('modeChrono', String(modeChronoCheckbox.checked));

        const optNiveau = document.getElementById('optionsNiveauSelect');
        if (optNiveau && typeof DB !== 'undefined' && DB.setNiveau) {
            DB.setNiveau(optNiveau.value);
            if (typeof getEffectiveSubjects === 'function') {
                DASH_SUBJECTS = getEffectiveSubjects(optNiveau.value);
            }
        }

        if (sonsActifs.checked) {
            // Son global activé → on sauvegarde les états actuels des sous-options
            saveOption('musiqueActive', String(musiqueActive.checked));
            saveOption('effetsActifs', String(effetsActifs.checked));
        } else {
            // Son global désactivé → on sauvegarde les états "d'avant" pour les restaurer
            // dataset.prevChecked contient 'true' ou 'false' sous forme de string
            saveOption('musiqueActive', String(musiqueActive.dataset.prevChecked !== 'false'));
            saveOption('effetsActifs', String(effetsActifs.dataset.prevChecked !== 'false'));
        }
    }

    saveOptionsBtn.addEventListener('click', () => {
        saveCurrentOptionsLocally();
        showNotification('⚙ Options sauvegardées !');
        // Retour à l'accueil après 1 seconde pour laisser le temps de voir la notification
        setTimeout(() => { 
            if(document.getElementById('modalOptions')) document.getElementById('modalOptions').hidden = true;
        }, 1000);
    });

    // Bouton Retour : sauvegarde automatique et navigation
    if (backButton) {
        backButton.addEventListener('click', () => {
            saveCurrentOptionsLocally(); // Sauvegarde automatique pour éviter la perte de configs
            if(document.getElementById('modalOptions')) document.getElementById('modalOptions').hidden = true;
        });
    }

    // Auto-save en temps réel à chaque modification pour éviter toute perte
    const autoSave = () => saveCurrentOptionsLocally();
    sonsActifs.addEventListener('change', autoSave);
    musiqueActive.addEventListener('change', autoSave);
    effetsActifs.addEventListener('change', autoSave);
    volumeMusique.addEventListener('change', autoSave);
    volumeEffets.addEventListener('change', autoSave);
    pleinEcran.addEventListener('change', autoSave);
    particulesCheckbox.addEventListener('change', autoSave);
    ecoModeCheckbox.addEventListener('change', autoSave);
    if (animationsCheckbox) animationsCheckbox.addEventListener('change', autoSave);
    if (modeChronoCheckbox) modeChronoCheckbox.addEventListener('change', autoSave);

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
   6bis. CÉLÉBRATIONS (confettis) & QUÊTES JOURNALIÈRES
   Modules partagés entre map.html et dashboard.html.
   ========================================================================== */

/**
 * Moteur de confettis autonome (aucune dépendance externe / CDN) :
 * fonctionne hors-ligne et avec le service worker.
 *   Celebrate.confetti();                  // pluie depuis le haut
 *   Celebrate.burst(element);              // explosion depuis un élément
 */
const Celebrate = (() => {
    const COLORS = ['#ffd166', '#c8a84b', '#6bca82', '#4cc9f0', '#f72585', '#b388ff', '#ff9f43'];
    let canvas = null, ctx = null, particles = [], rafId = null;

    function reducedMotion() {
        const animSaved = (typeof getOption === 'function') ? getOption('animationsActives') : null;
        if (animSaved === 'false') return true;
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '999999';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(x, y, count, spread, power, angle) {
        for (let i = 0; i < count; i++) {
            const a = angle + (Math.random() - 0.5) * spread;
            const v = power * (0.5 + Math.random() * 0.7);
            particles.push({
                x, y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                w: 6 + Math.random() * 6,
                h: 4 + Math.random() * 6,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.3,
                color: COLORS[(Math.random() * COLORS.length) | 0],
                shape: Math.random() < 0.3 ? 'circle' : 'rect',
                life: 0,
                maxLife: 140 + Math.random() * 80,
            });
        }
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        particles = particles.filter(p => p.life < p.maxLife && p.y < window.innerHeight + 40);
        particles.forEach(p => {
            p.life++;
            p.vy += 0.18;          // gravité
            p.vx *= 0.985;         // frottement de l'air
            p.vy *= 0.985;
            p.x += p.vx + Math.sin(p.life / 10) * 0.6; // léger flottement
            p.y += p.vy;
            p.rot += p.vr;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            if (p.shape === 'circle') {
                ctx.beginPath(); ctx.arc(0, 0, p.w / 2.5, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot)));
            }
            ctx.restore();
        });
        if (particles.length) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    }

    return {
        /** Grande célébration : deux canons latéraux + pluie centrale. */
        confetti() {
            if (reducedMotion()) return;
            ensureCanvas();
            const w = window.innerWidth, h = window.innerHeight;
            spawn(0, h * 0.75, 70, 0.9, 17, -Math.PI / 3);
            spawn(w, h * 0.75, 70, 0.9, 17, -Math.PI * 2 / 3);
            setTimeout(() => spawn(w / 2, h * 0.35, 60, Math.PI * 2, 9, 0), 180);
        },
        /** Petite explosion centrée sur un élément (ex : bouton « Réclamer »). */
        burst(el) {
            if (reducedMotion()) return;
            ensureCanvas();
            const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
            const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
            const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
            spawn(x, y, 55, Math.PI * 2, 10, 0);
        },
    };
})();
window.Celebrate = Celebrate;

/**
 * Quêtes journalières — source de vérité unique (localStorage via DB).
 * Les quêtes se renouvellent à minuit (heure locale) ; 3 quêtes sont tirées
 * chaque jour dans QUEST_POOL (tirage déterministe basé sur la date), plus la
 * quête de connexion. Une quête accomplie doit être « réclamée » sur le
 * tableau de bord pour toucher sa récompense (XP + pièces).
 */
const DailyQuests = (() => {
    const VERSION = 2;
    const BONUS_COINS = 50; // Coffre bonus quand toutes les quêtes sont réclamées

    const QUEST_POOL = [
        { type: 'xp',       icon: '⚡', title: 'Gagne 30 XP',                      target: 30, xp: 20, coins: 10, color: '#ffb547' },
        { type: 'xp',       icon: '🔥', title: 'Gagne 60 XP',                      target: 60, xp: 35, coins: 15, color: '#ff6b6b' },
        { type: 'levels',   icon: '🏝️', title: 'Réussis 2 niveaux',                target: 2,  xp: 20, coins: 10, color: '#4cc9f0' },
        { type: 'levels',   icon: '🗺️', title: 'Réussis 4 niveaux',                target: 4,  xp: 35, coins: 20, color: '#3ddc97' },
        { type: 'perfect',  icon: '⭐', title: 'Décroche 3 étoiles sur un niveau', target: 1,  xp: 25, coins: 15, color: '#ffd166' },
        { type: 'firstTry', icon: '🎯', title: 'Réponds juste du 1er coup 3 fois', target: 3,  xp: 30, coins: 15, color: '#b388ff' },
    ];

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /** Tirage pseudo-aléatoire reproductible pour une date donnée. */
    function seededPick(dateStr) {
        let seed = 0;
        for (const ch of dateStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
        const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
        const picked = [], usedTypes = new Set();
        const pool = QUEST_POOL.slice().sort(() => rand() - 0.5);
        for (const q of pool) {
            if (usedTypes.has(q.type)) continue;
            usedTypes.add(q.type);
            picked.push(q);
            if (picked.length === 3) break;
        }
        return picked;
    }

    function generate(date) {
        const quests = [
            { id: 'q_login', type: 'login', icon: '🌅', title: 'Connecte-toi aujourd\'hui', target: 1, progress: 1, xp: 10, coins: 5, color: '#6bca82', claimed: false },
            ...seededPick(date).map((q, i) => ({ id: 'q_' + q.type + '_' + i, ...q, progress: 0, claimed: false })),
        ];
        return { v: VERSION, date, quests, bonusClaimed: false };
    }

    function save(data) {
        if (typeof DB !== 'undefined' && DB.saveDailyQuests) DB.saveDailyQuests(data);
    }

    function get() {
        const today = todayKey();
        let data = (typeof DB !== 'undefined' && DB.getDailyQuests) ? DB.getDailyQuests() : null;
        if (!data || data.v !== VERSION || data.date !== today || !Array.isArray(data.quests)) {
            data = generate(today);
            save(data);
        }
        return data;
    }

    const isComplete = q => q.progress >= q.target;

    /**
     * Enregistre la progression après un niveau réussi.
     * @param {{levels?:number, perfect?:number, firstTry?:number, xp?:number}} delta
     * @returns {Array} quêtes nouvellement accomplies
     */
    function track(delta) {
        const data = get();
        const newlyDone = [];
        data.quests.forEach(q => {
            const inc = delta[q.type] || 0;
            if (!inc || isComplete(q)) return;
            q.progress = Math.min(q.target, q.progress + inc);
            if (isComplete(q)) newlyDone.push(q);
        });
        save(data);
        if (newlyDone.length) {
            setTimeout(() => {
                Celebrate.confetti();
                newlyDone.forEach(q => showNotification(`🎉 Quête accomplie : ${q.title} — récompense à réclamer !`));
            }, 450);
        }
        return newlyDone;
    }

    function addRewards(xp, coins) {
        saveOption('dash_xp', String(parseInt(getOption('dash_xp') || '0') + xp));
        saveOption('dash_coins', String(parseInt(getOption('dash_coins') || '30') + coins));
    }

    /** Réclame la récompense d'une quête accomplie. Retourne la quête ou null. */
    function claim(id) {
        const data = get();
        const q = data.quests.find(x => x.id === id);
        if (!q || q.claimed || !isComplete(q)) return null;
        q.claimed = true;
        const mult = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
            ? (AdminStore.getRewardsConfig().questRewardMultiplier || 1)
            : 1;
        const finalXp = Math.round(q.xp * mult);
        const finalCoins = Math.round(q.coins * mult);
        addRewards(finalXp, finalCoins);
        save(data);
        return { ...q, xp: finalXp, coins: finalCoins };
    }

    function getBonusCoins() {
        if (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function') {
            return AdminStore.getRewardsConfig().dailyChestCoins || BONUS_COINS;
        }
        return BONUS_COINS;
    }

    /** Ouvre le coffre bonus (toutes les quêtes réclamées). */
    function claimBonus() {
        const data = get();
        if (data.bonusClaimed || !data.quests.every(q => q.claimed)) return 0;
        const chestCoins = getBonusCoins();
        data.bonusClaimed = true;
        addRewards(0, chestCoins);
        save(data);
        return chestCoins;
    }

    /** Temps restant avant le renouvellement (minuit local), en texte. */
    function timeLeftLabel() {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const mins = Math.max(0, Math.ceil((midnight - now) / 60000));
        const h = Math.floor(mins / 60), m = mins % 60;
        return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`;
    }

    return { get, track, claim, claimBonus, getBonusCoins, isComplete, timeLeftLabel, todayKey, BONUS_COINS };
})();
window.DailyQuests = DailyQuests;

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
/**
 * Retourne un indice pédagogique adapté pour la leçon et la matière.
 */
function getLessonHint(lesson, subjectId) {
    if (!lesson) return '';
    if (lesson.hint && typeof lesson.hint === 'string' && lesson.hint.trim()) {
        return lesson.hint.trim();
    }
    const q = (lesson.q || '').toLowerCase();
    const subj = String(subjectId || '').toLowerCase();

    if (subj.includes('math')) {
        if (q.includes('+')) return "Effectue l'addition colonne par colonne en surveillant les retenues.";
        if (q.includes('-')) return "Pour la soustraction, pose le calcul ou décompose en dizaines et unités.";
        if (q.includes('×') || q.includes('*')) return "Fais appel à tes tables de multiplication et décompose si nécessaire.";
        if (q.includes('÷') || q.includes('/')) return "La division cherche combien de fois le diviseur est contenu dans le dividende.";
        if (q.includes('hypoténuse') || q.includes('pythagore')) return "Théorème de Pythagore : Hypoténuse² = Côté1² + Côté2².";
        if (q.includes('périmètre')) return "Le périmètre est le tour de la figure : additionne les longueurs de tous les côtés.";
        if (q.includes('aire')) return "Pour un rectangle ou carré : Aire = Longueur × Largeur.";
        if (q.includes('pourcentage') || q.includes('%')) return "Une hausse de p% revient à multiplier la valeur par (1 + p/100).";
        if (q.includes('exp') || q.includes('e⁰')) return "Rappel : l'exponentielle est toujours positive, et e⁰ = 1.";
        if (q.includes('ln')) return "Rappel : ln(1) = 0 et la fonction logarithme est la réciproque de l'exponentielle.";
        if (q.includes('dérivée')) return "Applique la formule de dérivation associée (ax^n → n ax^(n-1), e^(kx) → k e^(kx)).";
        return "Prends un brouillon et détaille les étapes du calcul sans te précipiter.";
    }
    if (subj.includes('franc') || subj.includes('gramm')) {
        if (q.includes('conjugue') || q.includes('verbe')) return "Identifie le sujet (pronom ou nom) pour accorder la bonne terminaison au verbe.";
        return "Observe bien les accords en genre et en nombre ainsi que la nature grammaticale des mots.";
    }
    if (subj.includes('anglais')) {
        if (q.includes('past') || q.includes('prétérit')) return "Vérifie s'il s'agit d'un verbe régulier (-ed) ou d'un verbe irrégulier (2ème colonne).";
        if (q.includes('comparative') || q.includes('superlative')) return "Les adjectifs courts prennent -er/-est ; les adjectifs longs sont précédés de more/most.";
        return "Repère les indices temporels (yesterday, now, already...) pour choisir le bon temps verbal.";
    }
    if (subj.includes('hist')) {
        return "Remémore-toi la frise chronologique et les grandes périodes clés (Antiquité, Moyen Âge, Siècle des Lumières, Guerres mondiales).";
    }
    if (subj.includes('geo')) {
        return "Situe mentalement le continent, le pays ou le repère géographique sur la carte.";
    }
    if (subj.includes('svt')) {
        return "Pense au rôle vital ou à la fonction biologique de cet organe ou de ce système dans l'organisme.";
    }
    if (subj.includes('phys')) {
        if (q.includes('ohm') || q.includes('tension')) return "Loi d'Ohm : U = R × I (Tension = Résistance × Intensité).";
        if (q.includes('puissance') || q.includes('watt')) return "Puissance électrique : P = U × I.";
        if (q.includes('vitesse')) return "Relation cinématique : Vitesse = Distance ÷ Temps (v = d / t).";
        return "Vérifie les unités physiques fondamentales (mètres, secondes, Volts, Joules).";
    }
    if (subj.includes('chim')) {
        if (q.includes('ph')) return "À 25 °C : pH < 7 est acide, pH = 7 est neutre, pH > 7 est basique.";
        if (q.includes('atome') || q.includes('molécule')) return "Chaque symbole représente un élément (H = Hydrogène, C = Carbone, O = Oxygène, N = Azote).";
        return "Pense aux formules moléculaires usuelles et à la conservation des atomes.";
    }
    if (subj.includes('techno')) {
        return "Pense à la chaîne d'information (capteur → processeur → actionneur) et aux propriétés des matériaux.";
    }
    if (subj.includes('emc')) {
        return "Rappelle-toi les principes républicains fondamentaux (Liberté, Égalité, Fraternité, Laïcité) et les institutions démocratiques.";
    }
    if (subj.includes('philo')) {
        return "Réfléchis au sens étymologique des concepts et aux grandes thèses de la philosophie.";
    }

    return "Lis attentivement l'énoncé et procède par élimination des réponses manifestement fausses.";
}

window._toggleQuizHint = function(btn) {
    const parent = btn.closest('.dash-modal') || btn.closest('.modal') || btn.closest('#modal-quiz-zone') || document;
    const drawer = parent.querySelector('.dash-hint-drawer');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none' || !drawer.style.display;
    drawer.style.display = isHidden ? 'block' : 'none';
    btn.classList.toggle('active', isHidden);
    btn.setAttribute('aria-expanded', String(isHidden));
    btn.innerHTML = isHidden 
        ? `<span class="dash-hint-icon">💡</span> Masquer l'indice` 
        : `<span class="dash-hint-icon">💡</span> Besoin d'un indice ?`;
};

function initMap() {
    const mapHeader = document.querySelector('.map-header');
    if (!mapHeader) return; // Pas sur la page map.html → on sort

    /** Une icône de matière peut être un fichier d'îlot (PNG ou SVG, WebP, JPG),
     *  une URL web, un data:image ou un emoji Unicode. Retourne true si c'est un fichier image. */
    function isIconFile(icon) {
        return /\.(png|svg|webp|jpg|jpeg)$/i.test(icon) || (typeof icon === 'string' && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:') || icon.startsWith('Image/')));
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
        'Philosophie': 'philo',
        'Philo': 'philo',
        'EMC': 'emc',
        'NSI & Numérique': 'nsi',
        'NSI': 'nsi',
        'SES (Économie)': 'ses',
        'SES': 'ses',
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
    let carteSubject = DASH_SUBJECTS.find(s => s.id === MATIERE_TO_SUBJECT_ID[subject])
        || DASH_SUBJECTS.find(s => s.name === subject);

    if (!carteSubject) {
        const rawList = (typeof AdminStore !== 'undefined' && typeof AdminStore.applyOverrides === 'function')
            ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS)
            : RAW_DASH_SUBJECTS;
        const fallbackRaw = rawList.find(s => s.id === MATIERE_TO_SUBJECT_ID[subject])
            || rawList.find(s => s.name === subject);
        if (fallbackRaw) {
            const curNiv = (typeof DB !== 'undefined' && DB.getNiveau) ? (DB.getNiveau() || '6eme') : '6eme';
            carteSubject = fallbackRaw._custom ? fallbackRaw : (typeof QuestionBank !== 'undefined' ? QuestionBank.extend(fallbackRaw, 100, curNiv) : fallbackRaw);
        }
    }

    /** Nombre de niveaux affichés : aligné sur le nombre de leçons réelles
     *  si la matière est connue du moteur de quiz, sinon 6 par défaut
     *  (ancien comportement, modale à étoiles). */
    const TOTAL_LEVELS = carteSubject ? carteSubject.lessons.length : 6;

    /* --- Mise à jour des éléments visuels d'en-tête --- */
    const titleEl = document.querySelector('h1');          // Titre de la matière
    const iconEl  = document.querySelector('.subject-icon'); // Icône de la matière
    if (titleEl) titleEl.textContent = subject;

    const mapGradeSelect = document.getElementById('mapGradeSelect');
    if (mapGradeSelect) {
        const curNiveau = (typeof DB !== 'undefined' && DB.getNiveau) ? (DB.getNiveau() || '6eme') : '6eme';
        mapGradeSelect.value = curNiveau;
        mapGradeSelect.addEventListener('change', () => {
            const newNiv = mapGradeSelect.value;
            if (typeof DB !== 'undefined' && DB.setNiveau) {
                DB.setNiveau(newNiv);
            }
            if (typeof getEffectiveSubjects === 'function') {
                DASH_SUBJECTS = getEffectiveSubjects(newNiv);
                carteSubject = DASH_SUBJECTS.find(s => s.id === MATIERE_TO_SUBJECT_ID[subject])
                    || DASH_SUBJECTS.find(s => s.name === subject);
                if (!carteSubject) {
                    const rawList = (typeof AdminStore !== 'undefined' && typeof AdminStore.applyOverrides === 'function')
                        ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS)
                        : RAW_DASH_SUBJECTS;
                    const fallbackRaw = rawList.find(s => s.id === MATIERE_TO_SUBJECT_ID[subject])
                        || rawList.find(s => s.name === subject);
                    if (fallbackRaw) {
                        carteSubject = fallbackRaw._custom ? fallbackRaw : (typeof QuestionBank !== 'undefined' ? QuestionBank.extend(fallbackRaw, 100, newNiv) : fallbackRaw);
                    }
                }
            }
            const lbl = mapGradeSelect.options[mapGradeSelect.selectedIndex]?.text || newNiv;
            showNotification(`🎓 Programme actualisé : ${lbl}`, 'info');
        });
    }

    const resolveIslandUrl = (src) => {
        if (!src) return '';
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/') || src.startsWith('Image/')) {
            return src;
        }
        return 'Image/ile/' + src;
    };

    if (iconEl) {
        // Icône fichier (PNG ou SVG îlot, URL web ou image perso) vs emoji Unicode.
        if (isIconFile(icon)) {
            // Si l'icône est un fichier image : on crée une balise <img>
            iconEl.innerHTML = `<img src="${resolveIslandUrl(icon)}" class="matiere-icon" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`;
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
            bgIslandEl.src = resolveIslandUrl(icon);
        } else {
            bgIslandEl.remove();
        }
    }

    // Met à jour le titre de l'onglet du navigateur
    document.title = 'EDUQUEST - ' + subject;

    function renderMapHeaderStreak() {
        const headerRight = mapHeader.querySelector('div[style*="pointer-events: auto"]');
        if (!headerRight) return;
        let streakEl = document.getElementById('mapHeaderStreakPill');
        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const streakCount = streakData.count || 0;
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
        const isHot = streakCount >= 2 || comboCount >= 2;

        const html = `<div class="dash-streak-pill ${isHot ? 'is-hot' : ''}" title="Série de victoires : ${streakCount} · Combo : x${comboCount}">
            <span class="dash-streak-flame">${isHot ? '🔥' : '⚡'}</span>
            <span class="dash-streak-count">${streakCount}</span>
            <span class="dash-streak-label">SÉRIE</span>
            ${multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier}</span>` : ''}
        </div>`;

        if (!streakEl) {
            streakEl = document.createElement('div');
            streakEl.id = 'mapHeaderStreakPill';
            streakEl.style.display = 'inline-flex';
            streakEl.style.alignItems = 'center';
            headerRight.insertBefore(streakEl, headerRight.firstChild);
        }
        streakEl.innerHTML = html;
    }
    renderMapHeaderStreak();

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
    function starsFromAttempts(attempts, usedShield = false) {
        if (attempts === 1) return 3;
        if (attempts === 2) {
            // Si le bouclier a déjà été consommé lors de l'erreur au 1er essai, 3 étoiles sont accordées sans redébit
            if (usedShield) {
                return 3;
            }
            // Secours si le bouclier est en réserve mais n'avait pas été consommé à la 1re tentative
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-shield')) {
                DB.useBooster('boost-shield');
                window._lastUsedBoosterShield = true;
                if (typeof showNotification === 'function') {
                    showNotification('🛡️ Bouclier d\'Étoile consommé : 3 étoiles préservées !', 'info');
                }
                if (typeof window.checkBadges === 'function') {
                    window.checkBadges({ usedShield: true, usedBooster: 'boost-shield', boosterId: 'boost-shield' });
                }
                return 3;
            }
            return 2;
        }
        return 1;
    }

    /** Débloque le niveau suivant et sauvegarde, commun aux deux modes. */
    function unlockNextAndSave(starsEarned) {
        if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
        const isFirstSuccess = progress.levels[currentModalLevel].stars === 0 && starsEarned > 0;
        if (starsEarned > progress.levels[currentModalLevel].stars) {
            progress.levels[currentModalLevel].stars = starsEarned;
        }
        if (currentModalLevel + 1 <= TOTAL_LEVELS) {
            progress.levels[currentModalLevel + 1].unlocked = true;
        }
        
        const streakRes = (typeof DB !== 'undefined' && DB.recordLevelVictory) ? DB.recordLevelVictory() : { streak: 1, combo: 0, multiplier: 1.0 };
        const mult = (streakRes && streakRes.multiplier) || ((typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier() : 1.0);
        renderMapHeaderStreak();

        let xpGained = 0;
        let coinsGained = 0;
        let scoreGained = 0;
        let usedDoubleXp = false;

        if (isFirstSuccess) {
            const rewards = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                ? AdminStore.getRewardsConfig()
                : { xpBase: 15, coinsBase: 10, chronoBonusMaxXp: 15, dailyChestCoins: 50, firstTryBonusXp: 10, questRewardMultiplier: 1 };

            const chronoEnabled = (typeof DB !== 'undefined' && DB.getOption('modeChrono') === 'true');
            const chronoBonus = (chronoEnabled && (window.mapQuizTimeRemaining || 0) > 0)
                ? Math.floor(rewards.chronoBonusMaxXp * (window.mapQuizTimeRemaining / 30))
                : 0;
            const firstTryBonus = (starsEarned === 3) ? (rewards.firstTryBonusXp || 0) : 0;

            let baseCalcXp = rewards.xpBase + chronoBonus + firstTryBonus;
            // Potion Double XP
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-xp')) {
                DB.useBooster('boost-xp');
                usedDoubleXp = true;
                baseCalcXp *= 2;
                if (typeof showNotification === 'function') {
                    showNotification('🧪 Potion Double XP consommée : XP doublée !', 'success');
                }
            }

            xpGained = Math.round(baseCalcXp * mult);
            coinsGained = rewards.coinsBase;

            const baseScore = 100 * starsEarned;
            scoreGained = Math.round(baseScore * mult);
            const currentScore = parseInt(getOption('dash_total_score') || '0', 10);
            saveOption('dash_total_score', String(currentScore + scoreGained));

            const currentXp = parseInt(getOption('dash_xp') || '0', 10);
            const currentCoins = parseInt(getOption('dash_coins') || '30', 10);
            saveOption('dash_xp', String(currentXp + xpGained));
            saveOption('dash_coins', String(currentCoins + coinsGained));
        }

        saveProgress(progress);
        renderLevels(progress);

        // Célébration + progression des quêtes journalières
        if (starsEarned > 0) {
            Celebrate.confetti();
            DailyQuests.track({
                levels:   1,
                xp:       xpGained,
                perfect:  starsEarned === 3 ? 1 : 0,
                firstTry: starsEarned === 3 ? 1 : 0,
            });
            const usedShield = Boolean(window._lastUsedBoosterShield || (typeof currentAttempt !== 'undefined' && currentAttempt && currentAttempt.usedShield));
            window._lastUsedBoosterShield = false;
            if (typeof window.checkBadges === 'function') {
                window.checkBadges({
                    justCompletedLevel: true,
                    starsEarned: starsEarned,
                    justAnsweredFirstTry: starsEarned === 3,
                    subjectId: carteSubject ? carteSubject.id : MATIERE_TO_SUBJECT_ID[subject],
                    usedDoubleXp: usedDoubleXp,
                    usedShield: usedShield,
                    usedBooster: usedDoubleXp ? 'boost-xp' : (usedShield ? 'boost-shield' : null),
                    boosterId: usedDoubleXp ? 'boost-xp' : (usedShield ? 'boost-shield' : null),
                    streakCount: streakRes.streak,
                    comboCount: streakRes.combo,
                    maxCombo: streakRes.maxCombo
                });
            }
        }
        return { isFirstSuccess, xpGained, coinsGained, scoreGained, multiplier: mult, streak: streakRes.streak };
    }

    /** Rendu de la question courante dans #modal-quiz-zone (mode quiz réel). */
    function renderModalQuiz() {
        const { submitted, answered, isCorrect, checking, lesson } = currentAttempt;
        const questionEl = document.getElementById('modal-quiz-question');
        const body = document.getElementById('modal-quiz-body');
        const feedbackEl = document.getElementById('modal-quiz-feedback');
        const actionsEl = document.getElementById('modal-quiz-actions');

        const chronoEnabled = (typeof DB !== 'undefined' && DB.getOption('modeChrono') === 'true');
        let chronoBarEl = document.getElementById('map-chrono-bar-container');

        /* --- État « génération en cours » (AiProvider.fetchQuestion) --- */
        if (checking === 'loading' || !lesson) {
            if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
            if (chronoBarEl) chronoBarEl.remove();
            const oldComboBar = document.getElementById('map-combo-bar-container');
            if (oldComboBar) oldComboBar.remove();
            delete body.dataset.renderedLessonKey;
            questionEl.textContent = 'Génération de la question…';
            body.innerHTML = `<div class="dash-feedback">⏳ Préparation de la question du niveau ${currentModalLevel}…</div>`;
            feedbackEl.innerHTML = '';
            actionsEl.innerHTML = `<button class="dash-btn-ghost" id="modal-quiz-cancel">Annuler</button>`;
            document.getElementById('modal-quiz-cancel').addEventListener('click', () => {
                if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            return;
        }

        // Gestion de la barre chrono visuelle
        if (chronoEnabled && !answered && !checking) {
            if (!chronoBarEl) {
                chronoBarEl = document.createElement('div');
                chronoBarEl.id = 'map-chrono-bar-container';
                chronoBarEl.style.cssText = 'width:100%; height:10px; background:#1c2430; border-radius:5px; margin-bottom:14px; overflow:hidden; position:relative; box-shadow:inset 0 1px 3px rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);';
                chronoBarEl.innerHTML = `
                    <div id="map-chrono-bar" style="width:${Math.max(0, (window.mapQuizTimeRemaining / 30) * 100)}%; height:100%; background:linear-gradient(90deg, #ff4757, #ffa502); transition: width 1s linear;"></div>
                    <span id="map-chrono-time-text" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-family:'Rajdhani',monospace; font-weight:700; font-size:11px; color:#fff; text-shadow:0 1px 2px #000;">⏱ ${window.mapQuizTimeRemaining || 30}s</span>
                `;
                questionEl.parentNode.insertBefore(chronoBarEl, questionEl);
            }
        } else if (chronoBarEl) {
            chronoBarEl.remove();
        }

        // Barre visuelle de combo et multiplicateur
        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
        const tierName = (typeof window.comboTierName === 'function') ? window.comboTierName(comboCount) : '';

        let comboBarEl = document.getElementById('map-combo-bar-container');
        if (!comboBarEl) {
            comboBarEl = document.createElement('div');
            comboBarEl.id = 'map-combo-bar-container';
            questionEl.parentNode.insertBefore(comboBarEl, questionEl);
        }
        comboBarEl.className = `dash-quiz-combo-bar ${comboCount >= 2 ? 'is-lit' : ''}`;
        comboBarEl.innerHTML = `
            <div class="dash-combo-left">
                <span class="dash-streak-flame">${comboCount >= 2 ? '🔥' : '⚡'}</span>
                <div>
                    <div class="dash-combo-txt">Combo : <b>${comboCount}</b></div>
                    <div class="dash-combo-subtitle">${tierName}</div>
                </div>
            </div>
            <div class="dash-combo-mult-badge">Bonus <b>x${multiplier.toFixed(1)}</b></div>
        `;

        const lessonKey = (lesson.id || lesson.q) + '_' + (currentAttempt.variant || 0);
        const needsRender = (body.dataset.renderedLessonKey !== lessonKey);

        if (needsRender) {
            questionEl.textContent = lesson.q;
            body.innerHTML = QuizEngine.renderBody(lesson);
            body.dataset.renderedLessonKey = lessonKey;
        }

        const hintSlot = document.getElementById('modal-quiz-hint-slot');
        const hintText = getLessonHint(lesson, carteSubject ? carteSubject.id : subject);

        if (!answered && !checking) {
            if (hintSlot) {
                hintSlot.innerHTML = hintText ? `
                    <div class="dash-hint-container">
                        <button class="dash-hint-toggle-btn" type="button" onclick="window._toggleQuizHint(this)" aria-expanded="false">
                            <span class="dash-hint-icon">💡</span> Besoin d'un indice ?
                        </button>
                        <div class="dash-hint-drawer" style="display: none;">
                            <div class="dash-hint-drawer-content">
                                <span class="dash-hint-badge">💡 INDICE PÉDAGOGIQUE</span>
                                <p class="dash-hint-text">${escapeHtml(hintText)}</p>
                            </div>
                        </div>
                    </div>` : '';
            }
            feedbackEl.innerHTML = '';
            actionsEl.innerHTML = `<button class="dash-btn-ghost" id="modal-quiz-cancel">Annuler</button>`;
            document.getElementById('modal-quiz-cancel').addEventListener('click', () => {
                if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            if (needsRender) {
                QuizEngine.bind(body, lesson, currentAttempt, _mapSubmitQuiz);
            }

            if (chronoEnabled) {
                if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
                window.mapQuizChronoInterval = setInterval(() => {
                    window.mapQuizTimeRemaining--;
                    const bar = document.getElementById('map-chrono-bar');
                    const text = document.getElementById('map-chrono-time-text');
                    if (bar) bar.style.width = Math.max(0, (window.mapQuizTimeRemaining / 30) * 100) + '%';
                    if (text) text.textContent = '⏱ ' + Math.max(0, window.mapQuizTimeRemaining) + 's';
                    if (window.mapQuizTimeRemaining <= 0) {
                        clearInterval(window.mapQuizChronoInterval);
                        _mapSubmitQuiz('TEMPS_ECOULE');
                    }
                }, 1000);
            }
        } else if (checking) {
            if (hintSlot) hintSlot.innerHTML = '';
            if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
            QuizEngine.freeze(body, lesson, submitted);
            feedbackEl.innerHTML = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
            actionsEl.innerHTML = '';
        } else {
            if (hintSlot) hintSlot.innerHTML = '';
            if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
            QuizEngine.reveal(body, lesson, submitted);
            const multTag = multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier.toFixed(1)}</span> ` : '';
            const expText = currentAttempt.explanation || (lesson ? lesson.exp : '') || '';
            feedbackEl.innerHTML = `
                <div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">
                    <div class="dash-feedback-badge">${isCorrect ? '✓ Bonne réponse ! ' + multTag : '✗ Pas tout à fait...'}</div>
                    ${expText ? `
                        <div class="dash-feedback-exp">
                            <div class="dash-feedback-exp-title">📖 Explication & Règle de cours :</div>
                            <div class="dash-feedback-exp-content">${escapeHtml(expText)}</div>
                        </div>
                    ` : ''}
                </div>`;

            if (isCorrect) {
                const starsNow = starsFromAttempts(currentAttempt.attempts, currentAttempt.usedShield);
                if (starsNow === 3) {
                    Celebrate.confetti();
                }
                actionsEl.innerHTML = `<button class="dash-btn-primary" id="modal-quiz-continue">Continuer</button>`;
                document.getElementById('modal-quiz-continue').addEventListener('click', () => {
                    const res = unlockNextAndSave(starsNow);
                    modal.hidden = true;
                    showNotification(`✓ Niveau réussi — ${'⭐'.repeat(starsNow)}${res.isFirstSuccess ? ` (+${res.xpGained} XP ${res.multiplier > 1.0 ? `[x${res.multiplier}] ` : ''}, +${res.coinsGained} pièces, +${res.scoreGained} pts)` : ''}`);
                });
            } else {
                actionsEl.innerHTML = `
                    <button class="dash-btn-ghost" id="modal-quiz-quit">Quitter</button>
                    <button class="dash-btn-primary" id="modal-quiz-retry">Réessayer</button>`;
                document.getElementById('modal-quiz-quit').addEventListener('click', () => {
                    if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
                    modal.hidden = true;
                    positionCharacter(findCurrentLevel(progress), true);
                });
                document.getElementById('modal-quiz-retry').addEventListener('click', async () => {
                    if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
                    delete body.dataset.renderedLessonKey;
                    window.mapQuizTimeRemaining = 30;
                    const nextVariant = ((currentAttempt.variant || 0) + 1 + Math.floor(Math.random() * 2)) % 3;
                    currentAttempt.variant = nextVariant;
                    currentAttempt.submitted = null;
                    currentAttempt.answered = false;
                    currentAttempt.isCorrect = false;
                    currentAttempt.checking = 'loading';
                    currentAttempt.explanation = '';
                    renderModalQuiz();

                    try {
                        const { lesson, questionId } = await AiProvider.fetchQuestion(
                            carteSubject.id, currentModalLevel - 1, currentNiveau(), {
                                variant: nextVariant,
                                subject: carteSubject
                            }
                        );
                        if (currentAttempt.variant !== nextVariant || modal.hidden) return;
                        currentAttempt.lesson = lesson;
                        currentAttempt.questionId = questionId;
                        currentAttempt.checking = false;
                        renderModalQuiz();
                    } catch (err) {
                        console.warn('[map retry] Erreur chargement variante', err);
                        currentAttempt.checking = false;
                        renderModalQuiz();
                    }
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
        if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
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
        attempt.explanation = (rawAnswer === 'TEMPS_ECOULE')
            ? "Temps écoulé ! Tu as dépassé les 30 secondes accordées."
            : result.explanation;
        attempt.lesson = { ...attempt.lesson, ...result.answerKey };

        if (result.isCorrect) {
            if (typeof DB !== 'undefined' && DB.recordCorrectAnswer) {
                DB.recordCorrectAnswer();
            }
        } else {
            let shieldSaved = false;
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-shield')) {
                DB.useBooster('boost-shield');
                shieldSaved = true;
                attempt.usedShield = true;
                window._lastUsedBoosterShield = true;
                if (typeof showNotification === 'function') {
                    showNotification('🛡️ Bouclier d\'Étoile consommé : Série et 3 étoiles protégées !', 'info');
                }
            }
            if (typeof DB !== 'undefined' && DB.recordWrongAnswer) {
                DB.recordWrongAnswer(shieldSaved);
            }
        }
        renderMapHeaderStreak();
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
            window.mapQuizTimeRemaining = 30;
            if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);

            if (carteSubject && carteSubject.lessons[currentModalLevel - 1]) {
                const mapBody = document.getElementById('modal-quiz-body');
                if (mapBody) delete mapBody.dataset.renderedLessonKey;
                quizZone.hidden = false;
                starsZone.hidden = true;
                const requestedLevel = currentModalLevel;
                const initialVariant = Math.floor(Math.random() * 3);
                currentAttempt = {
                    attempts: 0,
                    variant: initialVariant,
                    submitted: null,
                    answered: false,
                    isCorrect: false,
                    checking: 'loading',
                    lesson: null,
                    questionId: null,
                    explanation: '',
                    usedShield: false
                };
                const attempt = currentAttempt; // identité figée pour le garde anti-course
                renderModalQuiz(); // Affiche d'abord l'état « génération… »

                /* Question via AiProvider : variante aléatoire parmi 3 */
                AiProvider.fetchQuestion(carteSubject.id, requestedLevel - 1, currentNiveau(), {
                    variant: initialVariant,
                    subject: carteSubject
                })
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
                        const fallbackLesson = carteSubject.lessons[requestedLevel - 1];
                        attempt.lesson = fallbackLesson;
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
            const stars = parseInt(btn.dataset.stars);
            const res = unlockNextAndSave(stars);
            modal.hidden = true;
            if (res.isFirstSuccess) {
                showNotification(`✓ Progression sauvegardée (+${res.xpGained} XP, +${res.coinsGained} pièces)`);
            }
        });
    });

    /**
     * Bouton "Annuler" de la modale (mode étoiles) :
     * Ferme la modale et repositionne le personnage sur le niveau courant.
     */
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
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
        if (window.mapQuizChronoInterval) clearInterval(window.mapQuizChronoInterval);
        progress = getDefaultProgress(); // Remet à zéro en mémoire
        saveProgress(progress);          // Sauvegarde la progression réinitialisée
        modal.hidden = true;
        renderLevels(progress);          // Met à jour l'affichage
    });

    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            if (window.history.length > 1) {
                e.preventDefault();
                window.history.back();
            }
        });
    }
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
    { id: 'neon',     name: 'Éclair Néon',      color: '#00ffcc', cost: 250 },
    { id: 'magma',    name: 'Flamboiement Magma', color: '#ff3300', cost: 300 },
    // Skins "personnage" (v2.2) — portraits au lieu d'un halo de couleur.
    // `color` reste renseigné : il sert de couleur de halo derrière le
    // portrait (voir renderHud/renderShop), le portrait lui-même vient de `img`.
    { id: 'einstein',          name: 'Albert Einstein',     color: '#7fb3d5', img: 'Image/personnages/einstein.webp',          cost: 150 },
    { id: 'marie-curie',       name: 'Marie Curie',         color: '#6bca82', img: 'Image/personnages/marie-curie.webp',       cost: 150 },
    { id: 'christophe-colomb', name: 'Christophe Colomb',   color: '#c8a84b', img: 'Image/personnages/christophe-colomb.webp', cost: 200 },
    { id: 'lovelace',          name: 'Ada Lovelace',        color: '#ff66b2', img: 'Image/personnages/lovelace.webp',          cost: 400 },
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
        { type: "texte_a_choix", title: "L'argumentation", q: "Complète la phrase avec les connecteurs logiques appropriés.", textWithBlanks: "Il pleuvait des cordes, ___ nous sommes sortis ___ nous avions promis d'aider Marc.", choices: [["mais", "donc", "ainsi", "alors"], ["car", "pourtant", "cependant", "en effet"]], blanks: [["mais"], ["car"]], exp: "« Mais » marque l'opposition et « car » introduit la cause." },
        { type: "texte_a_trous", title: "Accord du participe passé", q: "Complète la règle.", textWithBlanks: "Avec l'auxiliaire être, le participe passé s'accorde avec le ___ ; avec avoir, il ne s'accorde en général pas avec le ___.", blanks: [["sujet"], ["sujet"]], distractors: ["verbe", "complément", "adjectif"], exp: "Être → accord avec le sujet ; avoir → pas d'accord avec le sujet (sauf COD placé avant, hors programme ici)." },
    ]},
    { id: "physique", name: "Physique", icon: "⚛", lessons: [
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
        { type: "texte_a_choix", title: "La neutralisation", q: "Complète le bilan de la réaction.", textWithBlanks: "La réaction entre un acide et une base produit un ___ et de l'___.", choices: [["sel", "gaz", "métal", "précipité"], ["eau", "alcool", "huile", "air"]], blanks: [["sel"], ["eau"]], exp: "Acide + Base → Sel + Eau : c'est la réaction de neutralisation acido-basique." },
        { type: "texte_a_trous", title: "La molécule d'eau", q: "Complète la formule de la molécule d'eau.", textWithBlanks: "La formule de l'eau est ___₂___ : deux atomes d'hydrogène pour un atome d'oxygène.", blanks: [["H"], ["O"]], distractors: ["C", "N", "Fe"], exp: "H₂O : deux hydrogènes (H) et un oxygène (O)." },
    ]},
    { id: "svt", name: "SVT", icon: "❦", lessons: [
        { title: "La photosynthèse", q: "Quel gaz les plantes absorbent-elles lors de la photosynthèse ?", opts: ["le CO₂", "l'O₂", "l'hydrogène", "l'azote"], correct: 0, exp: "Le CO₂ est transformé en matière organique grâce à la lumière." },
        { title: "Le système digestif", q: "Où débute la digestion des glucides ?", opts: ["dans la bouche", "dans l'estomac", "dans le foie", "dans l'intestin grêle"], correct: 0, exp: "La salive contient une enzyme qui amorce la digestion de l'amidon." },
        { title: "La génétique", q: "L'ADN se trouve principalement dans :", opts: ["le cytoplasme", "la membrane", "le noyau de la cellule", "les ribosomes"], correct: 2, exp: "Le noyau protège et organise le matériel génétique." },
        { title: "Les écosystèmes", q: "Un organisme qui se nourrit exclusivement de végétaux est un :", opts: ["décomposeur", "carnivore", "herbivore", "omnivore"], correct: 2, exp: "Par définition, un herbivore ne consomme que des végétaux." },
        { type: "reponse_courte", title: "Le cœur", q: "Combien de cavités possède le cœur humain ?", accepted: ["4", "quatre"], exp: "Le cœur a 4 cavités : 2 oreillettes et 2 ventricules." },
    ]},
    { id: "techno", name: "Technologie", icon: "⚙", band: "college", lessons: [
        { type: "texte_a_choix", title: "Les algorithmes", q: "Choisis les bons termes pour compléter la définition.", textWithBlanks: "Pour répéter des instructions tant qu'une condition est vraie, on utilise une boucle ___, et pour faire un choix, une condition ___.", choices: [["tant que", "pour", "infinie"], ["si", "sinon", "alors"]], blanks: [["tant que"], ["si"]], exp: "« Tant que » (while) et « si » (if) sont des structures fondamentales en programmation." },
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
        { type: "texte_a_trous", title: "Simple past", q: "Complète la phrase.", textWithBlanks: "Yesterday, she ___ (go) to the cinema and ___ (watch) a great film.", blanks: [["went"], ["watched"]], distractors: ["gone", "goes", "watches", "watching"], exp: "'Go' est irrégulier (went) ; 'watch' est régulier (+ed)." },
    ]},
    { id: "histoire", name: "Histoire", icon: "⌂", lessons: [
        { title: "La Révolution française", q: "En quelle année la Révolution française a-t-elle débuté ?", opts: ["1804", "1715", "1848", "1789"], correct: 3, exp: "La prise de la Bastille a lieu le 14 juillet 1789." },
        { title: "La Première Guerre mondiale", q: "La Première Guerre mondiale se termine en :", opts: ["1920", "1918", "1945", "1914"], correct: 1, exp: "L'armistice est signé le 11 novembre 1918." },
        { title: "L'Empire romain", q: "Quelle ville était la capitale de l'Empire romain ?", opts: ["Carthage", "Byzance", "Rome", "Athènes"], correct: 2, exp: "Rome est le centre politique de l'Empire jusqu'à sa scission." },
        { title: "La décolonisation", q: "L'indépendance de l'Algérie a eu lieu en :", opts: ["1970", "1962", "1958", "1954"], correct: 1, exp: "Les accords d'Évian entérinent l'indépendance en 1962." },
        { type: "vrai_faux", title: "Napoléon", q: "Napoléon Bonaparte est devenu empereur des Français en 1804.", correct: true, exp: "Vrai : il est sacré empereur le 2 décembre 1804." },
    ]},
    { id: "geo", name: "Géographie", icon: "⊕", lessons: [
        { title: "Les fuseaux horaires", q: "Combien de fuseaux horaires existe-t-il sur Terre ?", opts: ["12", "20", "24", "30"], correct: 2, exp: "La Terre est divisée en 24 fuseaux d'environ 15° chacun." },
        { title: "L'urbanisation", q: "Une mégapole compte généralement plus de :", opts: ["100 millions d'habitants", "500 000 habitants", "1 million d'habitants", "10 millions d'habitants"], correct: 3, exp: "Le seuil communément retenu pour une mégapole est 10 millions d'habitants." },
        { title: "Le climat", q: "Le climat équatorial se caractérise par :", opts: ["tempéré", "froid et sec", "aride", "chaud et humide toute l'année"], correct: 3, exp: "Proche de l'équateur, températures et précipitations restent élevées toute l'année." },
        { title: "Les ressources", q: "Quelle énergie est considérée comme renouvelable ?", opts: ["le pétrole", "le gaz naturel", "le charbon", "l'énergie solaire"], correct: 3, exp: "Le soleil est une source inépuisable à l'échelle humaine." },
        { type: "reponse_courte", title: "Le plus long fleuve", q: "Quel est le plus long fleuve du monde ?", accepted: ["nil", "le nil"], exp: "Le Nil (environ 6 650 km) est généralement considéré comme le plus long fleuve du monde." },
    ]},
    { id: "emc", name: "EMC", icon: "⚖", island: "Image/ile/emc.svg", lessons: [
        { title: "La citoyenneté", q: "Quel âge faut-il avoir pour voter en France ?", opts: ["21 ans", "18 ans", "16 ans", "25 ans"], correct: 1, exp: "La majorité électorale est fixée à 18 ans." },
        { title: "Les institutions", q: "Qui est élu au suffrage universel direct en France ?", opts: ["le Premier ministre", "les préfets", "le Président de la République", "les juges"], correct: 2, exp: "Le Président est élu directement par les citoyens depuis 1962." },
        { title: "Les valeurs de la République", q: "« Liberté, Égalité, Fraternité » est :", opts: ["un traité", "un article de loi", "la devise de la France", "une chanson"], correct: 2, exp: "Cette devise figure dans la Constitution française." },
        { title: "La justice", q: "Le principe de présomption d'innocence signifie que :", opts: ["on est toujours coupable", "on est innocent tant que la culpabilité n'est pas prouvée", "la peine est automatique", "il n'y a pas de procès"], correct: 1, exp: "Ce principe protège tout accusé jusqu'au jugement." },
        { type: "drag_and_drop", title: "Les pouvoirs", q: "Associe chaque pouvoir à son rôle.", items: ["Pouvoir exécutif", "Pouvoir législatif", "Pouvoir judiciaire"], targets: ["Applique les lois", "Vote les lois", "Fait respecter les lois"], pairs: { "Pouvoir exécutif": "Applique les lois", "Pouvoir législatif": "Vote les lois", "Pouvoir judiciaire": "Fait respecter les lois" }, exp: "La séparation des pouvoirs structure les institutions démocratiques." },
    ]},
    { id: "philo", name: "Philosophie", icon: "🏛️", island: "Image/ile/philo.svg", lessons: [
        { title: "L'allégorie de la caverne", q: "Qui a écrit l'allégorie de la caverne ?", opts: ["Socrate", "Platon", "Aristote", "Descartes"], correct: 1, exp: "Platon expose l'allégorie de la caverne dans La République (Livre VII)." },
        { title: "Le doute méthodique", q: "Quelle célèbre formule résume la certitude première de René Descartes ?", opts: ["Je sais que je ne sais rien", "L'homme est un loup pour l'homme", "Cogito, ergo sum (Je pense, donc je suis)", "Connais-toi toi-même"], correct: 2, exp: "Dans le Discours de la méthode, Descartes découvre le « Cogito » au terme du doute méthodique." },
        { title: "La conscience", q: "Pour Sigmund Freud, quelle partie de la psyché regroupe les pulsions refoulées ?", opts: ["Le Surmoi", "Le Moi", "L'Inconscient / Le Ça", "La conscience morale"], correct: 2, exp: "Le Ça représente le réservoir des pulsions inconscientes." },
        { type: "vrai_faux", title: "L'éthique et la morale", q: "Pour Emmanuel Kant, un acte moral doit être guidé par le devoir et l'impératif catégorique, sans rechercher son propre intérêt.", correct: true, exp: "Vrai : la morale déontologique kantienne repose sur le devoir désintéressé." },
        { type: "texte_a_trous", title: "Le contrat social", q: "Complète la citation de Jean-Jacques Rousseau.", textWithBlanks: "L'homme est né ___ et partout il est dans les ___.", blanks: [["libre"], ["fers"]], distractors: ["seul", "sage", "liens", "chaînes"], exp: "« L'homme est né libre et partout il est dans les fers » (Du contrat social, 1762)." },
    ]},
    { id: "nsi", name: "NSI & Numérique", icon: "Image/ile/nsi.svg", band: "lycee", island: "Image/ile/nsi.svg", lessons: [
        { title: "Binaire et Bits", q: "Quelle est la valeur décimale de l'octet binaire 00001010 ?", opts: ["8", "10", "12", "16"], correct: 1, exp: "En binaire : 8 + 2 = 10 (positions 2³ et 2¹)." },
        { title: "Algorithmique Python", q: "En Python, que renvoie l'expression [x * 2 for x in [1, 2, 3]] ?", opts: ["[1, 2, 3]", "[2, 4, 6]", "[2, 2, 2]", "Error"], correct: 1, exp: "C'est une compréhension de liste qui multiplie chaque élément par 2 : [2, 4, 6]." },
        { type: "vrai_faux", title: "Complexité algorithmique", q: "La recherche dichotomique dans un tableau trié de taille N a une complexité logarithmique O(log N).", correct: true, exp: "Vrai : à chaque étape, on divise par deux l'espace de recherche." },
        { type: "texte_a_trous", title: "Architecture Web", q: "Complète le rôle des langages du Web.", textWithBlanks: "Le langage ___ structure le contenu d'une page, le langage ___ gère sa présentation visuelle et ___ assure son interactivité dynamique.", blanks: [["HTML"], ["CSS"], ["JavaScript"]], distractors: ["SQL", "Python", "PHP"], exp: "Le trio fondamental du front-end est HTML (structure), CSS (style) et JavaScript (interactivité)." },
        { type: "drag_and_drop", title: "Réseaux & Protocoles", q: "Associe chaque protocole à son usage.", items: ["HTTP / HTTPS", "DNS", "SSH"], targets: ["Transfert de pages Web", "Résolution nom de domaine en IP", "Connexion à distance sécurisée"], pairs: { "HTTP / HTTPS": "Transfert de pages Web", "DNS": "Résolution nom de domaine en IP", "SSH": "Connexion à distance sécurisée" }, exp: "Ces protocoles fondamentaux structurent les communications sur Internet." },
    ]},
    { id: "ses", name: "SES (Économie)", icon: "Image/ile/ses.svg", band: "lycee", island: "Image/ile/ses.svg", lessons: [
        { title: "Le marché et les prix", q: "Selon la loi de l'offre et de la demande, lorsque la demande d'un bien augmente sans que l'offre ne change, son prix :", opts: ["diminue", "tend à augmenter", "reste toujours fixe", "devient nul"], correct: 1, exp: "La rareté relative entraîne une hausse du prix d'équilibre." },
        { title: "La création monétaire", q: "Qui crée la majeure partie de la monnaie en circulation dans une économie moderne ?", opts: ["L'État par l'impôt", "Les banques commerciales lors de l'octroi de crédits", "La banque centrale par impression de billets", "Les entreprises industrielles"], correct: 1, exp: "« Les crédits font les dépôts » : les banques commerciales créent la monnaie scripturale lors d'un prêt." },
        { type: "vrai_faux", title: "Le PIB et la croissance", q: "Le Produit Intérieur Brut (PIB) mesure la richesse totale des patrimoines des ménages.", correct: false, exp: "Faux : le PIB mesure le flux de valeur ajoutée créée sur une période donnée (un an), pas le stock de patrimoine." },
        { type: "texte_a_choix", title: "La socialisation", q: "Complète les modes d'apprentissage social.", textWithBlanks: "La socialisation ___ se déroule pendant l'enfance au sein de la famille et de l'école, tandis que la socialisation ___ s'exerce à l'âge adulte dans le monde professionnel.", choices: [["primaire", "secondaire", "initiale"], ["secondaire", "primaire", "tertiaire"]], blanks: [["primaire"], ["secondaire"]], exp: "La sociologie distingue la socialisation primaire (enfance) de la socialisation secondaire (vie adulte)." },
        { type: "drag_and_drop", title: "Facteurs de production", q: "Associe chaque facteur de production à sa définition.", items: ["Facteur Travail", "Facteur Capital", "Progrès technique"], targets: ["Activité humaine rémunérée", "Biens durables utilisés pour produire (machines)", "Amélioration de l'efficacité productive"], pairs: { "Facteur Travail": "Activité humaine rémunérée", "Facteur Capital": "Biens durables utilisés pour produire (machines)", "Progrès technique": "Amélioration de l'efficacité productive" }, exp: "Le travail, le capital et la productivité globale des facteurs sont les moteurs de la production." },
    ]},
];

// Étend chaque matière de 5 leçons écrites à la main à 100 niveaux
// (voir question-bank.js — QuestionBank.extend). Les 5 premières restent
// inchangées (et sont les seules à utiliser les types autres que QCM) ;
// les niveaux 6 à 100 sont générés depuis une banque de vraies questions
// adaptée au niveau scolaire choisi (6ème → Terminale).
if (typeof AdminStore !== 'undefined' && AdminStore.registerDefaults) {
    AdminStore.registerDefaults(RAW_DASH_SUBJECTS);
}

const NIVEAU_BAND = currentNiveauBand();

/**
 * Retourne les matières effectives avec 100 niveaux générés selon le niveau scolaire courant.
 * Permet d'adapter instantanément les questions quand l'élève change de classe dans le sélecteur.
 */
function getEffectiveSubjects(niveau) {
    const currentNiv = niveau || (typeof DB !== 'undefined' && DB.getNiveau ? DB.getNiveau() : '6eme') || '6eme';
    const band = (typeof AdminStore !== 'undefined' && AdminStore.levelBand)
        ? (AdminStore.levelBand(currentNiv) || (typeof QuestionBank !== 'undefined' ? QuestionBank.bandForNiveau(currentNiv) : 'college'))
        : (typeof QuestionBank !== 'undefined' ? QuestionBank.bandForNiveau(currentNiv) : 'college');

    const raw = (typeof AdminStore !== 'undefined' ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS) : RAW_DASH_SUBJECTS);

    // Filtrage des matières selon le cycle scolaire :
    // - "techno" (Technologie) est uniquement réservé aux niveaux collège (6e, 5e, 4e, 3e)
    // - "nsi" (NSI & Numérique) est uniquement réservé aux niveaux lycée (2nde, 1ère, Terminale)
    const filtered = raw.filter(s => {
        if (s.id === 'techno' && band !== 'college') return false;
        if (s.id === 'nsi' && band !== 'lycee') return false;
        return true;
    });

    return filtered.map(s => s._custom ? s : QuestionBank.extend(s, 100, currentNiv));
}

let DASH_SUBJECTS = getEffectiveSubjects();

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
    philo:    { name: 'Philosophie',   icon: 'philo.svg' },
    emc:      { name: 'EMC',           icon: 'emc.svg' },
    nsi:      { name: 'NSI & Numérique', icon: 'nsi.svg' },
    ses:      { name: 'SES (Économie)', icon: 'ses.svg' },
};

/**
 * Résout l'illustration de l'île flottante pour une matière (DASH_SUBJECTS).
 * Priorité : image personnalisée, island SVG/WebP du projet, ou fallback null.
 */
function getSubjectIslandSrc(subject) {
    if (!subject) return null;
    if (subject.image) return subject.image;
    if (subject.island) return subject.island;
    if (subject.id === 'nsi') return 'Image/ile/nsi.svg';
    if (subject.id === 'ses') return 'Image/ile/ses.svg';
    if (subject.id === 'emc') return 'Image/ile/emc.svg';

    const iconStr = typeof subject.icon === 'string' ? subject.icon.trim() : '';
    if (iconStr && (iconStr.startsWith('http://') || iconStr.startsWith('https://') || iconStr.startsWith('data:') || /\.(png|webp|svg|jpg)$/i.test(iconStr))) {
        if (iconStr.startsWith('http') || iconStr.startsWith('data:') || iconStr.startsWith('/') || iconStr.startsWith('Image/')) {
            return iconStr;
        }
        return 'Image/ile/' + iconStr;
    }

    const mapping = SUBJECT_TO_MATIERE[subject.id];
    if (mapping && mapping.icon && /\.(png|webp|svg)$/i.test(mapping.icon)) {
        return 'Image/ile/' + mapping.icon;
    }

    const byName = Object.values(SUBJECT_TO_MATIERE).find(m => m.name.toLowerCase() === (subject.name || '').toLowerCase());
    if (byName && byName.icon && /\.(png|webp|svg)$/i.test(byName.icon)) {
        return 'Image/ile/' + byName.icon;
    }

    return null;
}


const BADGES_CATALOG = (typeof AdminStore !== 'undefined' && AdminStore.DEFAULT_BADGES)
    ? AdminStore.DEFAULT_BADGES
    : [
        { id: 'premier_quiz', icon: '🎯', name: 'Premier pas', desc: 'Réussis ta toute première question.', category: 'progression', condition: 'totalCompleted >= 1' },
        { id: 'sans_faute', icon: '✨', name: 'Sans-faute', desc: 'Réponds juste du premier coup, sans réessayer.', category: 'precision', condition: 'justAnsweredFirstTry' },
        { id: 'toutes_matieres', icon: '🌐', name: 'Touche-à-tout', desc: 'Termine au moins une leçon dans chaque matière.', category: 'exploration', condition: 'allSubjectsStarted' },
        { id: 'matiere_complete', icon: '🏆', name: 'Expert(e)', desc: 'Termine au moins 5 leçons d\'une même matière.', category: 'maitrise', condition: 'oneSubjectAdvanced' },
        { id: 'collectionneur', icon: '🎨', name: 'Collectionneur', desc: 'Possède 3 skins ou articles différents.', category: 'boutique', condition: 'ownedSkins >= 3' },
        { id: 'niveau_5', icon: '🚀', name: 'Étoile montante', desc: 'Atteins le niveau 5 (400+ XP).', category: 'niveau', condition: 'playerLevel >= 5' },
        { id: 'niveau_10', icon: '👑', name: 'Grand Maître', desc: 'Atteins le niveau 10 (900+ XP).', category: 'niveau', condition: 'playerLevel >= 10' },
        { id: 'riche', icon: '💰', name: 'Bourse pleine', desc: 'Accumule au moins 100 pièces d\'or.', category: 'economie', condition: 'coins >= 100' },
        { id: 'magnat', icon: '🏦', name: 'Magnat d\'Eduquest', desc: 'Accumule au moins 250 pièces d\'or.', category: 'economie', condition: 'coins >= 250' },
        { id: 'alchimiste', icon: '🧪', name: 'Alchimiste', desc: 'Achète ou possède une potion magique.', category: 'potions', condition: 'hasBooster' },
        { id: 'potion_double_xp', icon: '⚡', name: 'Surtension', desc: 'Utilise une Potion Double XP.', category: 'potions', condition: 'usedDoubleXp' },
        { id: 'bouclier_etoile', icon: '🛡️', name: 'Invulnérable', desc: 'Utilise un Bouclier d\'Étoile pour protéger un score parfait.', category: 'potions', condition: 'usedShield' },
        { id: 'maths_fan', icon: '📐', name: 'Arithméticien', desc: 'Atteins le niveau 5 en Mathématiques.', category: 'matieres', condition: 'mathsLevel >= 5' },
        { id: 'francais_fan', icon: '📚', name: 'Littéraire', desc: 'Atteins le niveau 5 en Français.', category: 'matieres', condition: 'francaisLevel >= 5' },
        { id: 'histoire_fan', icon: '📜', name: 'Chroniqueur', desc: 'Atteins le niveau 5 en Histoire.', category: 'matieres', condition: 'histoireLevel >= 5' },
        { id: 'sciences_fan', icon: '🔬', name: 'Scientifique', desc: 'Atteins le niveau 5 en SVT, Physique ou Chimie.', category: 'matieres', condition: 'scienceLevel >= 5' },
        { id: 'philo_fan', icon: '🏛️', name: 'Penseur Antique', desc: 'Atteins le niveau 5 en Philosophie.', category: 'matieres', condition: 'philoLevel >= 5' },
        { id: 'polyglotte', icon: '🇬🇧', name: 'Polyglotte', desc: 'Atteins le niveau 5 en Anglais.', category: 'matieres', condition: 'anglaisLevel >= 5' },
        { id: 'citoyen', icon: '⚖️', name: 'Citoyen Éclairé', desc: 'Atteins le niveau 5 en EMC.', category: 'matieres', condition: 'emcLevel >= 5' },
        { id: 'technophile', icon: '💻', name: 'Technophile', desc: 'Atteins le niveau 5 en Technologie.', category: 'matieres', condition: 'technoLevel >= 5' },
        { id: 'fashion_victim', icon: '✨', name: 'Aura Éclatante', desc: 'Équipe une aura scintillante pour ton avatar.', category: 'personnalisation', condition: 'auraEquipped' },
        { id: 'theme_custom', icon: '🎭', name: 'Nouveau Décor', desc: 'Applique un thème visuel personnalisé.', category: 'personnalisation', condition: 'themeEquipped' },
        { id: 'streak_3', icon: '🔥', name: 'Série Ardente', desc: 'Réussis 3 leçons d\'affilée.', category: 'progression', condition: 'streakCount >= 3' },
        { id: 'streak_5', icon: '⚡', name: 'Inarrêtable', desc: 'Atteins une série de 5 victoires d\'affilée.', category: 'progression', condition: 'streakCount >= 5' },
        { id: 'combo_5', icon: '👑', name: 'Maître du Combo', desc: 'Enchaîne 5 bonnes réponses consécutives.', category: 'precision', condition: 'comboCount >= 5' },
        { id: 'queteur', icon: '📋', name: 'Assidu', desc: 'Réclame une récompense de quête journalière.', category: 'quetes', condition: 'questClaimed' },
        { id: 'coffre_ouvert', icon: '🎁', name: 'Chasseur de Trésor', desc: 'Ouvre le coffre quotidien bonus.', category: 'quetes', condition: 'dailyChestOpened' },
    ];

function comboTierName(combo) {
    if (!combo || combo <= 1) return 'Standard (+0%)';
    if (combo === 2) return 'En rythme (+20%)';
    if (combo === 3) return 'En feu ! (+40%) 🔥';
    if (combo === 4) return 'Surtension ! (+60%) ⚡';
    if (combo < 10) return 'Inarrêtable ! (+100%) 👑';
    return 'Légendaire ! (+150%) 🌌';
}
window.comboTierName = comboTierName;

function getBadgesCatalog() {
    return (typeof AdminStore !== 'undefined' && typeof AdminStore.getBadges === 'function')
        ? AdminStore.getBadges()
        : BADGES_CATALOG;
}

/**
 * Système universel de validation des succès : fonctionne sur toutes les pages.
 */
function checkBadges(extra = {}) {
    if (typeof DB === 'undefined' || !DB.getBadges || !DB.unlockBadge) return [];
    const catalog = getBadgesCatalog();
    const unlockedIds = DB.getBadges();
    
    const currentNiveau = (typeof DB.getNiveau === 'function' ? DB.getNiveau() : '6eme') || '6eme';
    const xp = parseInt(DB.getOption('dash_xp') || '0', 10);
    const coins = parseInt(DB.getOption('dash_coins') || '30', 10);
    const playerLevel = Math.floor(xp / 100) + 1;
    let ownedSkins = [];
    try { ownedSkins = JSON.parse(DB.getOption('dash_ownedSkins') || '["aurore", "robot"]'); } catch(e) {}
    const theme = DB.getOption('dash_equippedTheme') || 'default';
    const equippedAura = DB.getOption('dash_equippedAura') || DB.getOption('dash_equippedSkin') || 'aurore';
    const boosters = (typeof DB.getBoosters === 'function') ? DB.getBoosters() : {};
    const boostersHistory = (typeof DB.getBoostersHistory === 'function') ? DB.getBoostersHistory() : { acquired: {}, used: {} };

    const totalBoostersInStock = Object.values(boosters).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
    const totalBoostersAcquired = Object.values(boostersHistory.acquired || {}).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
    const totalBoostersUsed = Object.values(boostersHistory.used || {}).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
    const hasAnyBooster = totalBoostersInStock > 0 || (boosters['boost-xp'] > 0) || (boosters['boost-shield'] > 0) || totalBoostersAcquired > 0 || !!extra.boughtBooster || !!extra.hasBooster || !!extra.boosterId;

    let totalCompleted = 0;
    let threeStarCount = 0;
    const completedPerSubject = {};
    const subjects = (typeof DASH_SUBJECTS !== 'undefined') ? DASH_SUBJECTS : [];
    
    subjects.forEach(s => {
        let count = 0;
        const prog = (typeof DB.getProgressSync === 'function')
            ? (DB.getProgressSync(s.name, currentNiveau) || DB.getProgressSync(s.id, currentNiveau))
            : null;
        if (prog && prog.levels) {
            for (let lvl in prog.levels) {
                if (prog.levels[lvl].stars > 0) {
                    count++;
                    totalCompleted++;
                    if (prog.levels[lvl].stars === 3) threeStarCount++;
                }
            }
        }
        if (count === 0 && typeof state !== 'undefined' && state.progress && state.progress[s.id]) {
            count = state.progress[s.id];
            totalCompleted += count;
        }
        completedPerSubject[s.id] = count;
    });

    if (extra.justCompletedLevel) totalCompleted = Math.max(totalCompleted, 1);
    if (extra.starsEarned === 3) threeStarCount = Math.max(threeStarCount, 1);

    const newlyUnlocked = [];

    catalog.forEach(b => {
        if (unlockedIds.includes(b.id)) return;
        let pass = false;
        switch (b.id) {
            case 'premier_quiz':
                pass = totalCompleted >= 1 || !!extra.justAnsweredFirstTry || !!extra.justCompletedLevel;
                break;
            case 'sans_faute':
                pass = !!extra.justAnsweredFirstTry || extra.starsEarned === 3;
                break;
            case 'trois_etoiles':
                pass = threeStarCount >= 1 || extra.starsEarned === 3;
                break;
            case 'streak_3':
                pass = (extra.streakCount >= 3) || (typeof DB !== 'undefined' && DB.getStreak && DB.getStreak() >= 3) || totalCompleted >= 3;
                break;
            case 'streak_5':
                pass = (extra.streakCount >= 5) || (typeof DB !== 'undefined' && DB.getStreak && DB.getStreak() >= 5);
                break;
            case 'combo_5':
                pass = (extra.comboCount >= 5) || (extra.maxCombo >= 5) || (typeof DB !== 'undefined' && DB.getStreakData && DB.getStreakData().maxCombo >= 5);
                break;
            case 'toutes_matieres':
                pass = (subjects.length > 0 && subjects.every(s => (completedPerSubject[s.id] || 0) >= 1)) || !!extra.allSubjectsStarted;
                break;
            case 'cinq_niveaux':
                pass = totalCompleted >= 5;
                break;
            case 'dix_niveaux':
                pass = totalCompleted >= 10;
                break;
            case 'matiere_complete':
                pass = Object.values(completedPerSubject).some(c => c >= 5) || !!extra.oneSubjectAdvanced;
                break;
            case 'cent_niveaux':
                pass = totalCompleted >= 100;
                break;
            case 'grand_maitre':
                pass = threeStarCount >= 10;
                break;
            case 'premier_achat':
                pass = ownedSkins.length > 2 || !!extra.boughtSkin || !!extra.boughtBooster || totalBoostersAcquired > 0;
                break;
            case 'collectionneur':
                pass = ownedSkins.length >= 3;
                break;
            case 'fashion_victim':
                pass = (equippedAura && equippedAura !== 'aurore') || ownedSkins.length >= 3 || !!extra.auraEquipped || !!extra.boughtSkin;
                break;
            case 'theme_custom':
                pass = (theme && theme !== 'default') || (extra.theme && extra.theme !== 'default') || !!extra.themeEquipped;
                break;
            case 'niveau_5':
                pass = playerLevel >= 5;
                break;
            case 'niveau_10':
                pass = playerLevel >= 10;
                break;
            case 'niveau_20':
                pass = playerLevel >= 20;
                break;
            case 'premier_sou':
                pass = coins >= 50;
                break;
            case 'riche':
                pass = coins >= 100;
                break;
            case 'magnat':
                pass = coins >= 250;
                break;
            case 'alchimiste':
            case 'potion_xp':
                pass = hasAnyBooster;
                break;
            case 'potion_double_xp':
                pass = !!extra.usedDoubleXp || extra.usedBooster === 'boost-xp' || extra.boosterId === 'boost-xp' || ((boostersHistory.used && boostersHistory.used['boost-xp']) > 0) || (boosters['boost-xp'] > 0);
                break;
            case 'bouclier_etoile':
            case 'potion_shield':
                pass = !!extra.usedShield || extra.usedBooster === 'boost-shield' || extra.boosterId === 'boost-shield' || ((boostersHistory.used && boostersHistory.used['boost-shield']) > 0) || (boosters['boost-shield'] > 0);
                break;
            case 'maths_fan':
                pass = (completedPerSubject['maths'] || 0) >= 5;
                break;
            case 'francais_fan':
                pass = (completedPerSubject['francais'] || 0) >= 5;
                break;
            case 'histoire_fan':
                pass = (completedPerSubject['histoire'] || 0) >= 5;
                break;
            case 'sciences_fan':
            case 'maitre_chimie':
                pass = (completedPerSubject['svt'] || 0) >= 5 || (completedPerSubject['physique'] || 0) >= 5 || (completedPerSubject['chimie'] || 0) >= 5 || (extra.subjectId === 'chimie' && extra.justCompletedLevel);
                break;
            case 'philo_fan':
            case 'maitre_philo':
                pass = (completedPerSubject['philo'] || 0) >= 1 || (extra.subjectId === 'philo' && extra.justCompletedLevel);
                break;
            case 'polyglotte':
                pass = (completedPerSubject['anglais'] || 0) >= 5;
                break;
            case 'citoyen':
                pass = (completedPerSubject['emc'] || 0) >= 5;
                break;
            case 'technophile':
                pass = (completedPerSubject['techno'] || 0) >= 5;
                break;
            case 'queteur':
                pass = !!extra.questClaimed;
                break;
            case 'coffre_ouvert':
                pass = !!extra.dailyChestOpened;
                break;
            default:
                if (typeof b.test === 'function') {
                    pass = b.test({ totalCompleted, xp, coins, playerLevel, ownedSkins, theme, completedPerSubject, ...extra });
                }
                break;
        }

        // Évaluation générique des conditions techniques (éditables dans le panneau admin)
        if (!pass && b.condition) {
            const cond = String(b.condition).trim();
            if (cond === 'hasBooster' && hasAnyBooster) pass = true;
            else if (cond === 'usedDoubleXp' && (!!extra.usedDoubleXp || extra.usedBooster === 'boost-xp' || (boostersHistory.used && boostersHistory.used['boost-xp'] > 0) || boosters['boost-xp'] > 0)) pass = true;
            else if (cond === 'usedShield' && (!!extra.usedShield || extra.usedBooster === 'boost-shield' || (boostersHistory.used && boostersHistory.used['boost-shield'] > 0) || boosters['boost-shield'] > 0)) pass = true;
            else if (cond === 'questClaimed' && !!extra.questClaimed) pass = true;
            else if (cond === 'dailyChestOpened' && !!extra.dailyChestOpened) pass = true;
            else if (cond === 'justAnsweredFirstTry' && (!!extra.justAnsweredFirstTry || extra.starsEarned === 3)) pass = true;
            else if (cond === 'auraEquipped' && ((equippedAura && equippedAura !== 'aurore') || !!extra.auraEquipped || !!extra.boughtSkin)) pass = true;
            else if (cond === 'themeEquipped' && ((theme && theme !== 'default') || (extra.theme && extra.theme !== 'default') || !!extra.themeEquipped)) pass = true;
            else if (cond === 'allSubjectsStarted' && subjects.length > 0 && subjects.every(s => (completedPerSubject[s.id] || 0) >= 1)) pass = true;
            else if (cond === 'oneSubjectAdvanced' && Object.values(completedPerSubject).some(c => c >= 5)) pass = true;
            else {
                const ctx = {
                    totalCompleted,
                    threeStarCount,
                    xp,
                    coins,
                    playerLevel,
                    ownedSkins: ownedSkins.length,
                    mathsLevel: completedPerSubject['maths'] || 0,
                    francaisLevel: completedPerSubject['francais'] || 0,
                    histoireLevel: completedPerSubject['histoire'] || 0,
                    scienceLevel: Math.max(completedPerSubject['svt'] || 0, completedPerSubject['physique'] || 0, completedPerSubject['chimie'] || 0),
                    philoLevel: completedPerSubject['philo'] || 0,
                    anglaisLevel: completedPerSubject['anglais'] || 0,
                    emcLevel: completedPerSubject['emc'] || 0,
                    technoLevel: completedPerSubject['techno'] || 0,
                    hasBooster: hasAnyBooster ? 1 : 0,
                    usedDoubleXp: (extra.usedDoubleXp || extra.usedBooster === 'boost-xp') ? 1 : 0,
                    usedShield: (extra.usedShield || extra.usedBooster === 'boost-shield') ? 1 : 0,
                    streakCount: (typeof extra.streakCount === 'number') ? extra.streakCount : ((typeof DB !== 'undefined' && DB.getStreak) ? DB.getStreak() : 0),
                    comboCount: (typeof extra.comboCount === 'number') ? extra.comboCount : ((typeof DB !== 'undefined' && DB.getCombo) ? DB.getCombo() : 0),
                    maxCombo: (typeof extra.maxCombo === 'number') ? extra.maxCombo : ((typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData().maxCombo : 0),
                    totalScore: (typeof extra.totalScore === 'number') ? extra.totalScore : parseInt((typeof DB !== 'undefined' && DB.getOption) ? (DB.getOption('dash_total_score') || '0') : '0', 10)
                };
                const m = cond.match(/^([a-zA-Z0-9_]+)\s*(>=|<=|>|<|===|==)\s*([0-9]+)$/);
                if (m) {
                    const varVal = ctx[m[1]] ?? 0;
                    const op = m[2];
                    const num = parseInt(m[3], 10);
                    if (op === '>=' && varVal >= num) pass = true;
                    else if (op === '<=' && varVal <= num) pass = true;
                    else if (op === '>' && varVal > num) pass = true;
                    else if (op === '<' && varVal < num) pass = true;
                    else if ((op === '==' || op === '===') && varVal === num) pass = true;
                }
            }
        }

        if (pass) {
            DB.unlockBadge(b.id);
            unlockedIds.push(b.id);
            newlyUnlocked.push(b);
        }
    });

    if (newlyUnlocked.length > 0) {
        newlyUnlocked.forEach(badge => {
            if (typeof showNotification === 'function') {
                showNotification(`${badge.icon} Succès débloqué : ${badge.name} !`);
            }
        });
        if (typeof Celebrate !== 'undefined' && Celebrate.confetti) {
            Celebrate.confetti();
        }
    }

    return newlyUnlocked;
}
window.checkBadges = checkBadges;

function initDashboard() {
    const dashApp = document.getElementById('dashboard-app');
    if (!dashApp) return; // Pas sur la page dashboard.html → on sort

    function getShopCatalog() {
        return (typeof AdminStore !== 'undefined' && typeof AdminStore.getShopItems === 'function')
            ? AdminStore.getShopItems()
            : DASH_SKINS;
    }

    /* ============ ÉTAT PERSISTÉ ============ */

    /**
     * Charge l'état du dashboard depuis localStorage via DB.
     * Toutes les valeurs sont des strings dans DB, on les parse ici.
     */
    function loadState() {
        const savedSkin = getOption('dash_equippedSkin') || 'aurore';
        const savedAura = getOption('dash_equippedAura');
        const savedAvatar = getOption('dash_equippedAvatar');
        const catalog = getShopCatalog();
        const curItem = catalog.find(s => s.id === savedSkin);
        const curCat = curItem ? (curItem.category || 'aura') : 'aura';

        const equippedAura = savedAura || (curCat === 'aura' ? savedSkin : 'aurore');
        const equippedAvatar = savedAvatar || (curCat === 'avatar' ? savedSkin : 'robot');
        const equippedTheme = getOption('dash_equippedTheme') || 'default';
        document.documentElement.setAttribute('data-theme', equippedTheme);

        return {
            coins:          parseInt(getOption('dash_coins') || '30', 10),
            xp:             parseInt(getOption('dash_xp') || '0', 10),
            equippedSkin:   savedSkin,
            equippedAura:   equippedAura,
            equippedAvatar: equippedAvatar,
            equippedTitle:  getOption('dash_equippedTitle') || '',
            equippedTheme:  equippedTheme,
            ownedSkins:     JSON.parse(getOption('dash_ownedSkins') || '["aurore", "robot"]'),
            shopCategory:   'all',
            view:           'dashboard', // Toujours revenir au dashboard au chargement
            currentSubject: null,
            progress:       JSON.parse(getOption('dash_progress') || '{}'),
            quiz:           null,
            badges:         DB.getBadges(), // Identifiants des badges déjà débloqués
        };
    }

    /** Sauvegarde l'état modifiable dans localStorage via DB. */
    function persistState() {
        saveOption('dash_coins',          String(state.coins));
        saveOption('dash_xp',             String(state.xp));
        saveOption('dash_equippedSkin',   state.equippedSkin || 'aurore');
        saveOption('dash_equippedAura',   state.equippedAura || 'aurore');
        saveOption('dash_equippedAvatar', state.equippedAvatar || 'robot');
        saveOption('dash_equippedTitle',  state.equippedTitle || '');
        saveOption('dash_equippedTheme',  state.equippedTheme || 'default');
        saveOption('dash_ownedSkins',     JSON.stringify(state.ownedSkins));
        saveOption('dash_progress',       JSON.stringify(state.progress));
    }

    let state = loadState();
    // Initialise la progression pour les matières qui n'ont pas encore de données
    DASH_SUBJECTS.forEach(s => {
        if (!(s.id in state.progress)) state.progress[s.id] = 0;
    });

    /* ============ HELPERS ============ */
    function skinColor(id) {
        const targetId = id || state.equippedAura || 'aurore';
        const item = getShopCatalog().find(s => s.id === targetId);
        return item ? (item.color || '#4fd8c4') : '#4fd8c4';
    }
    /** Chemin de l'image de portrait d'un skin, ou null pour les skins "halo de couleur" pure. */
    function skinImage(id) {
        const targetId = id || state.equippedAvatar || 'robot';
        const item = getShopCatalog().find(s => s.id === targetId);
        return (item && item.img) ? item.img : null;
    }
    function level() { return Math.floor(state.xp / 100) + 1; }
    function xpInLevel() { return state.xp % 100; }

    function triggerBadgesCheck(extra = {}) {
        const unlocked = checkBadges({ ...extra });
        state.badges = DB.getBadges();
        return unlocked;
    }
    // Validation passive immédiate de tous les succès existants au démarrage
    triggerBadgesCheck();

    /* ============ RENDU ============ */

    /** Point d'entrée du rendu — reconstruit tout le contenu de #dashboard-app */
    function render() {
        document.documentElement.style.setProperty('--dash-skin', skinColor(state.equippedAura));
        document.documentElement.setAttribute('data-theme', state.equippedTheme || 'default');
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
                { id: '6eme', label: '6ème', name: '6ème' },
                { id: '5eme', label: '5ème', name: '5ème' },
                { id: '4eme', label: '4ème', name: '4ème' },
                { id: '3eme', label: '3ème', name: '3ème' },
                { id: '2nde', label: '2nde', name: '2nde' },
                { id: '1ere', label: '1ère', name: '1ère' },
                { id: 'terminale', label: 'Terminale', name: 'Terminale' }
            ];
        const currentNiveau = (typeof DB !== 'undefined' && DB.getNiveau) ? (DB.getNiveau() || '6eme') : '6eme';
        const optionsHtml = niveaux.map(n => {
            const label = n.label || n.name || n.id;
            const isSelected = n.id === currentNiveau;
            return `<option value="${escapeHtml(n.id)}"${isSelected ? ' selected' : ''}>🎓 ${escapeHtml(label)}</option>`;
        }).join('');

        return `<header class="dash-header">
            <div class="dash-header-left" style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                <div class="dash-brand"><b>EDU</b><span>QUEST</span></div>
                <div class="dash-grade-wrap" style="display: inline-flex; align-items: center;">
                    <select class="dash-grade-select" onchange="window._dashChangeNiveau(this.value)" aria-label="Choisir sa classe">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
            ${greeting}
        </header>`;
    }

    function renderHud() {
        const pct = xpInLevel();
        const equippedTitleObj = state.equippedTitle ? getShopCatalog().find(x => x.id === state.equippedTitle) : null;
        const titleBadge = equippedTitleObj
            ? `<span class="dash-hud-title-badge" style="color:${equippedTitleObj.color}; border: 1px solid ${equippedTitleObj.color}44; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 6px;">${escapeHtml(equippedTitleObj.name)}</span>`
            : '';

        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const streakCount = streakData.count || 0;
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
        const isHot = streakCount >= 2 || comboCount >= 2;

        const streakPill = `<div class="dash-streak-pill ${isHot ? 'is-hot' : ''}" title="Série de victoires : ${streakCount} d'affilée · Combo : x${comboCount}">
            <span class="dash-streak-flame">${isHot ? '🔥' : '⚡'}</span>
            <span class="dash-streak-count">${streakCount}</span>
            <span class="dash-streak-label">SÉRIE</span>
            ${multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier}</span>` : ''}
        </div>`;

        return `<div class="dash-hud">
            <div class="dash-avatar" style="--dash-skin:${skinColor(state.equippedAura)}">${skinImage(state.equippedAvatar) ? `<img src="${skinImage(state.equippedAvatar)}" alt="Avatar">` : `N${level()}`}</div>
            <div class="dash-hud-mid">
                <div class="dash-hud-level">Niveau ${level()} <span class="mono">· ${pct}/100 XP</span> ${titleBadge}</div>
                <div class="dash-xp-track"><div class="dash-xp-fill" style="width:${pct}%"></div></div>
            </div>
            ${streakPill}
            <div class="dash-coins"><span class="dash-coin-dot"></span>${state.coins}</div>
        </div>`;
    }

    function renderTabs() {
        const badgesTotal = getBadgesCatalog().length;
        const unlockedCount = (typeof DB !== 'undefined' && DB.getBadges) ? DB.getBadges().length : state.badges.length;
        return `
        <!-- Onglets bureau classiques -->
        <nav class="dash-tabs" aria-label="Navigation principale">
            <button class="dash-tab ${state.view === 'dashboard' || state.view === 'map' ? 'active' : ''}" onclick="window._dashGoDashboard()">🏝️ Matières</button>
            <button class="dash-tab ${state.view === 'shop' ? 'active' : ''}" onclick="window._dashGoShop()">🛍️ Boutique</button>
            <button class="dash-tab ${state.view === 'badges' ? 'active' : ''}" onclick="window._dashGoBadges()">🏆 Succès (${unlockedCount}/${badgesTotal})</button>
        </nav>

        <!-- Barre de navigation inférieure ergonomique pour mobile (Bottom Navigation Bar) -->
        <nav class="dash-bottom-nav" aria-label="Navigation mobile">
            <button class="dash-bnav-item ${state.view === 'dashboard' || state.view === 'map' ? 'active' : ''}" onclick="window._dashGoDashboard()" aria-label="Matières">
                <span class="dash-bnav-icon">🏝️</span>
                <span class="dash-bnav-label">Matières</span>
            </button>
            <button class="dash-bnav-item ${state.view === 'shop' ? 'active' : ''}" onclick="window._dashGoShop()" aria-label="Boutique">
                <span class="dash-bnav-icon">🛍️</span>
                <span class="dash-bnav-label">Boutique</span>
            </button>
            <button class="dash-bnav-item ${state.view === 'badges' ? 'active' : ''}" onclick="window._dashGoBadges()" aria-label="Succès">
                <span class="dash-bnav-icon">
                    🏆
                    <span class="dash-bnav-badge">${unlockedCount}</span>
                </span>
                <span class="dash-bnav-label">Succès</span>
            </button>
            <a class="dash-bnav-item" href="index.html#options" aria-label="Options">
                <span class="dash-bnav-icon">⚙️</span>
                <span class="dash-bnav-label">Options</span>
            </a>
            <a class="dash-bnav-item" href="index.html" aria-label="Accueil">
                <span class="dash-bnav-icon">🏠</span>
                <span class="dash-bnav-label">Accueil</span>
            </a>
        </nav>`;
    }

    /** Vue "Succès" : catalogue complet des badges, débloqués ou non. */
    function renderBadges() {
        const unlockedIds = (typeof DB !== 'undefined' && DB.getBadges) ? DB.getBadges() : state.badges;
        state.badges = unlockedIds;
        const catalog = getBadgesCatalog();
        const cards = catalog.map(badge => {
            const unlocked = unlockedIds.includes(badge.id);
            return `<div class="dash-skin-card dash-badge-card ${unlocked ? 'is-unlocked' : 'locked'}">
                <div class="dash-badge-icon">${unlocked ? badge.icon : '🔒'}</div>
                <div class="dash-skin-name">${escapeHtml(badge.name)}</div>
                <div class="dash-badge-desc">${escapeHtml(badge.desc)}</div>
                <div class="dash-badge-status" style="margin-top:8px; font-size:0.75rem; font-weight:700; color:${unlocked ? '#4ade80' : '#8fa1d0'};">
                    ${unlocked ? '✓ DÉBLOQUÉ' : '🔒 VERROUILLÉ'}
                </div>
            </div>`;
        }).join('');
        return `<section>
            <div class="dash-eyebrow">Succès</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Tes accomplissements (${unlockedIds.length}/${catalog.length})</h2>
            <div class="dash-skins-grid">${cards}</div>
        </section>`;
    }

    function renderDashboard() {
        const currentNiveau = (typeof DB !== 'undefined' && DB.getNiveau) ? (DB.getNiveau() || '6eme') : '6eme';
        const cards = DASH_SUBJECTS.map(s => {
            let done = 0;
            const data = (typeof DB !== 'undefined' && DB.getProgressSync)
                ? DB.getProgressSync(s.name, currentNiveau)
                : null;
            if (data && data.levels) {
                for (let key in data.levels) {
                    if (data.levels[key].stars > 0) {
                        done++;
                    }
                }
            }
            if (done === 0) {
                done = state.progress[s.id] || 0;
            }
            
            const total = s.lessons.length;
            const pct = Math.round((done / total) * 100);
            const islandSrc = getSubjectIslandSrc(s);
            const iconHtml = islandSrc
                ? `<div class="dash-subject-island-wrap">
                     <img src="${escapeHtml(islandSrc)}" alt="${escapeHtml(s.name)}" class="dash-subject-island" loading="lazy">
                   </div>`
                : `<div class="dash-subject-icon">${s.icon}</div>`;

            return `<div class="dash-subject-card" onclick="window._dashOpenMap('${s.id}')" tabindex="0" role="button" aria-label="${escapeHtml(s.name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window._dashOpenMap('${s.id}');}">
                <span class="dash-pct mono">${done}/${total}</span>
                ${iconHtml}
                <h3>${s.name}</h3>
                <div class="dash-progress-track"><div class="dash-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');

        return `
        ${renderQuests()}
        <section>
            <div class="dash-eyebrow">Ta progression</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Choisis une matière à explorer</h2>
            <div class="dash-subjects-grid">${cards}</div>
        </section>`;
    }

    /** Tableau des quêtes journalières : cartes avec anneau de progression. */
    function renderQuests() {
        const data = DailyQuests.get();
        const total = data.quests.length;
        const claimedCount = data.quests.filter(q => q.claimed).length;
        const allClaimed = claimedCount === total;
        const R = 26, C = 2 * Math.PI * R; // Anneau SVG

        const cards = data.quests.map((q, i) => {
            const done = DailyQuests.isComplete(q);
            const pct = Math.min(1, q.progress / q.target);
            const status = q.claimed ? 'claimed' : done ? 'ready' : 'active';
            const action = q.claimed
                ? `<div class="quest-stamp">✓ Réclamée</div>`
                : done
                    ? `<button class="quest-claim-btn" id="quest-claim-${q.id}" onclick="window._dashClaimQuest('${q.id}', this)">Réclamer</button>`
                    : `<div class="quest-progress-label mono">${q.progress} / ${q.target}</div>`;
            return `<article class="quest-card is-${status}" style="--q-color:${q.color}; --q-delay:${i * 70}ms">
                <div class="quest-ring">
                    <svg viewBox="0 0 64 64" aria-hidden="true">
                        <circle class="quest-ring-bg" cx="32" cy="32" r="${R}"></circle>
                        <circle class="quest-ring-fg" cx="32" cy="32" r="${R}"
                            stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(2)}"></circle>
                    </svg>
                    <span class="quest-icon">${q.icon}</span>
                </div>
                <h3 class="quest-title">${escapeHtml(q.title)}</h3>
                <div class="quest-rewards">
                    <span class="quest-chip xp">+${q.xp} XP</span>
                    <span class="quest-chip coin"><span class="dash-coin-dot"></span>${q.coins}</span>
                </div>
                ${action}
            </article>`;
        }).join('');

        const bonusCoins = (typeof DailyQuests.getBonusCoins === 'function') ? DailyQuests.getBonusCoins() : DailyQuests.BONUS_COINS;
        const chestState = data.bonusClaimed ? 'opened' : allClaimed ? 'ready' : 'locked';
        const chest = `<button class="quest-chest is-${chestState}" id="quest-bonus-chest"
                ${chestState === 'ready' ? `onclick="window._dashClaimBonus(this)"` : 'disabled'}
                title="${chestState === 'opened' ? 'Coffre ouvert — reviens demain !' : `Réclame toutes les quêtes pour +${bonusCoins} pièces`}">
                <span class="quest-chest-icon">${chestState === 'opened' ? '🎁' : chestState === 'ready' ? '🎁' : '🔒'}</span>
                <span class="quest-chest-text">${chestState === 'opened' ? 'Bonus récupéré' : chestState === 'ready' ? `Ouvrir (+${bonusCoins})` : `Bonus +${bonusCoins}`}</span>
            </button>`;

        return `<section class="quest-board" aria-labelledby="quest-board-title">
            <div class="quest-board-head">
                <div>
                    <div class="dash-eyebrow quest-eyebrow">Quêtes du jour</div>
                    <h2 id="quest-board-title" class="quest-board-title">Tes missions quotidiennes</h2>
                    <div class="quest-timer">⏳ Nouvelles quêtes dans <b>${DailyQuests.timeLeftLabel()}</b></div>
                </div>
                <div class="quest-board-side">
                    <div class="quest-overall">
                        <div class="quest-overall-label mono">${claimedCount}/${total}</div>
                        <div class="quest-overall-track"><div class="quest-overall-fill" style="width:${(claimedCount / total) * 100}%"></div></div>
                    </div>
                    ${chest}
                </div>
            </div>
            <div class="quest-grid">${cards}</div>
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
        const MAX_VISIBLE = 12;
        const visibleLessons = subject.lessons.slice(0, MAX_VISIBLE);
        const positions = nodePositions(visibleLessons.length);
        const pathD = positions.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ');

        const nodesSvg = visibleLessons.map((lesson, i) => {
            const p = positions[i];
            const completed = i < done;
            const current = i === done;
            const locked = i > done;
            let fill = 'rgba(255,255,255,0.12)';
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

        const islandSrc = getSubjectIslandSrc(subject);
        const eyebrowIcon = islandSrc
            ? `<img src="${escapeHtml(islandSrc)}" alt="" style="width:1.3em;height:1.3em;vertical-align:middle;object-fit:contain;margin-right:6px;">`
            : `${escapeHtml(subject.icon || '📘')} `;

        return `<section>
            <button class="dash-back-map" onclick="window._dashGoDashboard()">← Retour aux matières</button>
            <div class="dash-map-wrap">
                <div class="dash-map-title">
                    <div class="dash-eyebrow" style="display:flex; align-items:center;">${eyebrowIcon} Parcours</div>
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
        const catalog = getShopCatalog();
        const activeCategory = state.shopCategory || 'all';
        const filtered = activeCategory === 'all' ? catalog : catalog.filter(item => (item.category || 'aura') === activeCategory);

        const categoryFilters = [
            { id: 'all', label: 'Tous', icon: '✨' },
            { id: 'aura', label: 'Halos', icon: '🌟' },
            { id: 'avatar', label: 'Personnages', icon: '👤' },
            { id: 'title', label: 'Titres', icon: '🏷️' },
            { id: 'theme', label: 'Thèmes', icon: '🎨' },
            { id: 'booster', label: 'Boosters', icon: '⚡' },
        ].map(cat => {
            const count = cat.id === 'all' ? catalog.length : catalog.filter(i => (i.category || 'aura') === cat.id).length;
            const active = activeCategory === cat.id ? 'active' : '';
            return `<button class="dash-shop-filter-btn ${active}" onclick="window._dashSetShopCategory('${cat.id}')">${cat.icon} ${cat.label} <span class="dash-shop-badge">${count}</span></button>`;
        }).join('');

        const cards = filtered.map(s => {
            const cat = s.category || 'aura';
            const isAura = cat === 'aura';
            const isAvatar = cat === 'avatar';
            const isTitle = cat === 'title';
            const isTheme = cat === 'theme';
            const isBooster = cat === 'booster';

            const boosterStock = (typeof DB !== 'undefined' && DB.getBoosters) ? (DB.getBoosters()[s.id] || 0) : 0;
            const owned = isBooster ? (boosterStock > 0) : (s.id === 'default' || state.ownedSkins.includes(s.id));
            const isEquipped = isAura
                ? (state.equippedAura === s.id)
                : isAvatar
                    ? (state.equippedAvatar === s.id)
                    : isTitle
                        ? (state.equippedTitle === s.id)
                        : isTheme
                            ? ((state.equippedTheme || 'default') === s.id)
                            : false;

            let visualHtml = '';
            if (s.img) {
                visualHtml = `<div class="dash-skin-orb" style="--sc:${s.color || '#4fd8c4'}"><img src="${s.img}" alt="${escapeHtml(s.name)}"></div>`;
            } else if (isTitle) {
                visualHtml = `<div class="dash-shop-title-preview" style="color:${s.color || '#ffd166'}; border: 1px dashed ${s.color || '#ffd166'}88; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px 6px; margin: 0 auto 12px; max-width: 140px; font-weight: 700; font-size: 13px;">${escapeHtml(s.name)}</div>`;
            } else if (isTheme) {
                visualHtml = `<div class="dash-shop-theme-preview" style="display: flex; gap: 4px; justify-content: center; margin: 0 auto 12px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: ${s.color}; box-shadow: 0 0 6px ${s.color};"></div>
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #1a103c;"></div>
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #ffd166;"></div>
                </div>`;
            } else if (isBooster) {
                visualHtml = `<div class="dash-shop-booster-preview" style="width: 48px; height: 48px; line-height: 48px; border-radius: 50%; margin: 0 auto 12px; background: radial-gradient(circle, ${s.color}66, rgba(0,0,0,0.5)); border: 1px solid ${s.color}; font-size: 22px;">⚡</div>`;
            } else {
                visualHtml = `<div class="dash-skin-orb" style="--sc:${s.color || '#4fd8c4'}"></div>`;
            }

            let btn = '';
            if (isBooster) {
                const affordable = state.coins >= s.cost;
                btn = `<div style="font-size:12px; margin-bottom:8px; color:#ffd166; font-weight:700;">En réserve : ${boosterStock}</div>
                       <button class="dash-skin-btn buy" ${affordable ? '' : 'disabled'} onclick="window._dashBuySkin('${s.id}')">Acheter (+1) · ${s.cost} pièces</button>`;
            } else if (isEquipped) {
                btn = `<button class="dash-skin-btn equipped" disabled>✓ Équipé</button>`;
            } else if (owned) {
                const actionLabel = isTitle ? 'Porter ce titre' : isTheme ? 'Appliquer' : isAvatar ? 'Incarner' : 'Équiper';
                btn = `<button class="dash-skin-btn equip" onclick="window._dashEquipSkin('${s.id}')">${actionLabel}</button>`;
            } else {
                const affordable = state.coins >= s.cost;
                btn = `<button class="dash-skin-btn buy" ${affordable ? '' : 'disabled'} onclick="window._dashBuySkin('${s.id}')">${s.cost === 0 ? 'Obtenir' : `Acheter (${s.cost} pièces)`}</button>`;
            }

            return `<div class="dash-skin-card ${owned ? 'is-owned' : ''} ${isEquipped ? 'is-equipped' : ''}">
                ${visualHtml}
                <div class="dash-skin-name">${escapeHtml(s.name)}</div>
                ${s.desc ? `<div class="dash-skin-desc" style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 8px; line-height: 1.3;">${escapeHtml(s.desc)}</div>` : ''}
                <div class="dash-skin-cost">${s.cost === 0 ? 'Offert' : `${s.cost} pièces`}</div>
                ${btn}
            </div>`;
        }).join('');

        return `<section>
            <div class="dash-eyebrow">Boutique & Personnalisation</div>
            <h2 style="font-family:'Cinzel',serif; font-size:22px; color:#fff; text-shadow:0 0 10px rgba(200,168,75,0.4), 2px 2px 6px rgba(0,0,0,0.7); letter-spacing:1px;">Personnalise ton héros</h2>
            <div class="dash-shop-filters" style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0 18px 0;">${categoryFilters}</div>
            <div class="dash-skins-grid">${cards}</div>
        </section>`;
    }

    function renderQuizModal() {
        if (!state.quiz) {
            const oldOverlay = document.getElementById('dashQuizOverlay');
            if (oldOverlay) oldOverlay.remove();
            return;
        }

        const { subjectId, lessonIndex, submitted, answered, isCorrect, loading, checking, explanation } = state.quiz;
        const subject = DASH_SUBJECTS.find(s => s.id === subjectId);
        let overlay = document.getElementById('dashQuizOverlay');

        if (loading) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'dash-overlay';
                overlay.id = 'dashQuizOverlay';
                document.body.appendChild(overlay);
            }
            delete overlay.dataset.quizKey;
            overlay.innerHTML = `<div class="dash-modal">
                <div class="dash-eyebrow">${subject ? escapeHtml(subject.name) : 'Quiz'} · Niveau ${lessonIndex + 1}</div>
                <h3 role="status" aria-live="polite">Génération de la question…</h3>
            </div>`;
            return;
        }

        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
        const tierName = (typeof window.comboTierName === 'function') ? window.comboTierName(comboCount) : '';
        const comboBarHtml = `<div class="dash-quiz-combo-bar ${comboCount >= 2 ? 'is-lit' : ''}">
            <div class="dash-combo-left">
                <span class="dash-streak-flame">${comboCount >= 2 ? '🔥' : '⚡'}</span>
                <div>
                    <div class="dash-combo-txt">Combo : <b>${comboCount}</b></div>
                    <div class="dash-combo-subtitle">${tierName}</div>
                </div>
            </div>
            <div class="dash-combo-mult-badge">Bonus <b>x${multiplier.toFixed(1)}</b></div>
        </div>`;

        const lesson = state.quiz.lesson;
        const hintText = getLessonHint(lesson, subjectId);
        const hintButtonHtml = (!answered && !checking && hintText) ? `
            <div class="dash-hint-container">
                <button class="dash-hint-toggle-btn" type="button" onclick="window._toggleQuizHint(this)" aria-expanded="false">
                    <span class="dash-hint-icon">💡</span> Besoin d'un indice ?
                </button>
                <div class="dash-hint-drawer" style="display: none;">
                    <div class="dash-hint-drawer-content">
                        <span class="dash-hint-badge">💡 INDICE PÉDAGOGIQUE</span>
                        <p class="dash-hint-text">${escapeHtml(hintText)}</p>
                    </div>
                </div>
            </div>` : '';

        let feedback = '';
        if (checking) {
            feedback = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
        } else if (answered) {
            const multTag = multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier.toFixed(1)}</span> ` : '';
            const expText = explanation || (lesson ? lesson.exp : '') || '';
            feedback = `<div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">
                <div class="dash-feedback-badge">${isCorrect ? '✓ Bonne réponse ! ' + multTag : '✗ Pas tout à fait...'}</div>
                ${expText ? `
                    <div class="dash-feedback-exp">
                        <div class="dash-feedback-exp-title">📖 Explication & Règle de cours :</div>
                        <div class="dash-feedback-exp-content">${escapeHtml(expText)}</div>
                    </div>
                ` : ''}
            </div>`;
            if (isCorrect) {
                const rewards = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                    ? AdminStore.getRewardsConfig()
                    : { xpBase: 15, coinsBase: 10, chronoBonusMaxXp: 15, firstTryBonusXp: 10 };
                const chronoEnabled = (typeof DB !== 'undefined' && DB.getOption('modeChrono') === 'true');
                const chronoBonus = (chronoEnabled && (window.quizTimeRemaining || 0) > 0)
                    ? Math.floor(rewards.chronoBonusMaxXp * (window.quizTimeRemaining / 30))
                    : 0;
                const hasShieldBonus = (state.quiz.attempts === 1 || Boolean(state.quiz.usedShield));
                const baseTotalXp = rewards.xpBase + chronoBonus + (hasShieldBonus ? (rewards.firstTryBonusXp || 0) : 0);
                const totalXp = Math.round(baseTotalXp * multiplier);
                const baseScore = 100 * (hasShieldBonus ? 3 : (state.quiz.attempts === 2 ? 2 : 1));
                const earnedScore = Math.round(baseScore * multiplier);
                feedback += `<div class="dash-reward-line"><span>+${totalXp} XP ${multiplier > 1.0 ? `<b style="color:#ffa502;">(x${multiplier.toFixed(1)})</b>` : ''}</span><span>+${rewards.coinsBase} <span class="dash-coin-dot" style="display:inline-block; width:10px;height:10px; vertical-align:middle;"></span></span><span style="color:#ffbe0b; font-weight:700;">+${earnedScore} pts</span></div>`;
            }
        }

        const actions = !answered
            ? `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Annuler</button></div>`
            : isCorrect
                ? `<div class="dash-modal-actions"><button class="dash-btn-primary" onclick="window._dashFinishQuiz()">Continuer</button></div>`
                : `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Quitter</button><button class="dash-btn-primary" onclick="window._dashRetryQuiz()">Réessayer</button></div>`;

        const chronoEnabled = (typeof DB !== 'undefined' && DB.getOption('modeChrono') === 'true');
        const chronoHtml = chronoEnabled && !answered && !checking 
            ? `<div id="chrono-bar-container" style="width:100%; height:10px; background:#1c2430; border-radius:5px; margin-bottom:15px; overflow:hidden; position:relative; box-shadow:inset 0 1px 3px rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);">
                <div id="chrono-bar" style="width:${Math.max(0, (window.quizTimeRemaining / 30) * 100)}%; height:100%; background:linear-gradient(90deg, #ff4757, #ffa502); transition: width 1s linear;"></div>
                <span id="chrono-time-text" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-family:'Rajdhani',monospace; font-weight:700; font-size:11px; color:#fff; text-shadow:0 1px 2px #000;">⏱ ${window.quizTimeRemaining || 30}s</span>
               </div>`
            : '';

        const quizKey = lesson ? ((lesson.id || lesson.q) + '_' + (state.quiz.variant || 0)) : null;

        if (overlay && overlay.dataset.quizKey === quizKey && overlay.querySelector('.dash-quiz-body')) {
            // Mise à jour sur place : le DOM de la question n'est PAS réinitialisé, les choix ne sautent pas !
            const comboEl = overlay.querySelector('.dash-quiz-combo-bar');
            if (comboEl) comboEl.outerHTML = comboBarHtml;

            if (checking || answered) {
                const chronoBar = overlay.querySelector('#chrono-bar-container');
                if (chronoBar) chronoBar.remove();
                const hintEl = overlay.querySelector('.dash-hint-container');
                if (hintEl) hintEl.remove();
            }

            const feedbackSlot = overlay.querySelector('.dash-modal-feedback-slot');
            if (feedbackSlot) feedbackSlot.innerHTML = feedback;

            const actionsSlot = overlay.querySelector('.dash-modal-actions-slot');
            if (actionsSlot) actionsSlot.innerHTML = actions;

            const body = overlay.querySelector('.dash-quiz-body');
            if (checking && lesson) {
                QuizEngine.freeze(body, lesson, submitted);
            } else if (answered && lesson) {
                QuizEngine.reveal(body, lesson, submitted);
            }
            return;
        }

        // Première création ou changement de question
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'dash-overlay';
            overlay.id = 'dashQuizOverlay';
            document.body.appendChild(overlay);
        }
        overlay.dataset.quizKey = quizKey || '';
        overlay.innerHTML = `<div class="dash-modal">
            <div class="dash-eyebrow">${escapeHtml(subject ? subject.name : '')} · ${escapeHtml(lesson ? lesson.title : '')}</div>
            ${chronoHtml}
            ${comboBarHtml}
            <h3>${escapeHtml(lesson ? lesson.q : '')}</h3>
            ${hintButtonHtml}
            <div class="dash-quiz-body">${lesson ? QuizEngine.renderBody(lesson) : ''}</div>
            <div class="dash-modal-feedback-slot">${feedback}</div>
            <div class="dash-modal-actions-slot">${actions}</div>
        </div>`;

        const body = overlay.querySelector('.dash-quiz-body');
        if (answered && lesson) {
            QuizEngine.reveal(body, lesson, submitted);
        } else if (checking && lesson) {
            QuizEngine.freeze(body, lesson, submitted);
        } else if (lesson) {
            QuizEngine.bind(body, lesson, state.quiz, window._dashSubmitQuiz);
            if (chronoEnabled) {
                if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
                window.quizChronoInterval = setInterval(() => {
                    window.quizTimeRemaining--;
                    const chronoBar = document.getElementById('chrono-bar');
                    const chronoText = document.getElementById('chrono-time-text');
                    if (chronoBar) chronoBar.style.width = Math.max(0, (window.quizTimeRemaining / 30) * 100) + '%';
                    if (chronoText) chronoText.textContent = '⏱ ' + Math.max(0, window.quizTimeRemaining) + 's';
                    if (window.quizTimeRemaining <= 0) {
                        clearInterval(window.quizChronoInterval);
                        window._dashSubmitQuiz('TEMPS_ECOULE');
                    }
                }, 1000);
            }
        }
    }

    /* ============ ACTIONS (exposées sur window pour les onclick inline) ============ */

    window._dashChangeNiveau = function(val) {
        DB.setNiveau(val);
        if (typeof getEffectiveSubjects === 'function') {
            DASH_SUBJECTS = getEffectiveSubjects(val);
        }
        const niveaux = (window.AdminStore && typeof AdminStore.getNiveauxScolaires === 'function')
            ? AdminStore.getNiveauxScolaires()
            : [];
        const found = niveaux.find(n => n.id === val);
        const label = found ? (found.label || found.name) : val;
        showNotification(`🎓 Programme actualisé pour la classe : ${label}`, 'info');
        render();
    };

    function navigateToView(viewName, subjectId = null, push = true) {
        if (state.quiz) {
            state.quiz = null;
            const overlay = document.getElementById('dashQuizOverlay');
            if (overlay) overlay.remove();
        }
        state.view = viewName;
        state.currentSubject = subjectId;
        if (viewName === 'badges') {
            triggerBadgesCheck();
            state.badges = DB.getBadges();
        }
        if (push && window.history && window.history.pushState) {
            window.history.pushState({ view: viewName, currentSubject: subjectId }, '', `#${viewName}${subjectId ? '-' + subjectId : ''}`);
        }
        render();
    }

    window._dashGoDashboard = function () {
        navigateToView('dashboard');
    };

    window._dashGoShop = function () {
        navigateToView('shop');
    };

    window._dashGoBadges = function () {
        navigateToView('badges');
    };

    window._dashOpenMap = function (id) {
        const subj = DASH_SUBJECTS.find(s => s.id === id);
        const island = SUBJECT_TO_MATIERE[id];
        const islandSrc = subj ? getSubjectIslandSrc(subj) : null;
        let iconParam = island ? island.icon : (subj ? subj.icon : '');
        if (islandSrc) {
            iconParam = islandSrc;
        }
        const matiere = subj ? { name: subj.name, icon: iconParam } : null;
        if (matiere) {
            window.location.href = 'map.html?matiere=' + encodeURIComponent(matiere.name) + '&icon=' + encodeURIComponent(matiere.icon);
            return;
        }
        navigateToView('map', id);
    };

    window._dashOpenQuiz = async function (subjectId, lessonIndex) {
        window.quizTimeRemaining = 30;
        if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
        const initialVariant = Math.floor(Math.random() * 3);
        state.quiz = {
            subjectId,
            lessonIndex,
            variant: initialVariant,
            loading: true,
            lesson: null,
            questionId: null,
            submitted: null,
            answered: false,
            isCorrect: false,
            attempts: 0,
            explanation: '',
            usedShield: false
        };
        render();

        const currentNiv = currentNiveau();
        const dashSubj = DASH_SUBJECTS.find(s => s.id === subjectId);
        const { lesson, questionId } = await AiProvider.fetchQuestion(
            subjectId, lessonIndex, currentNiv, { variant: initialVariant, subject: dashSubj }
        );

        if (!state.quiz || state.quiz.subjectId !== subjectId || state.quiz.lessonIndex !== lessonIndex) return;
        state.quiz.lesson = lesson;
        state.quiz.questionId = questionId;
        state.quiz.loading = false;
        renderQuizModal();
    };

    window._dashCloseQuiz = function () {
        if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
        state.quiz = null;
        const overlay = document.getElementById('dashQuizOverlay');
        if (overlay) overlay.remove();
        render();
    };

    window._dashRetryQuiz = async function () {
        if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
        window.quizTimeRemaining = 30;
        const overlay = document.getElementById('dashQuizOverlay');
        if (overlay) delete overlay.dataset.quizKey;
        const { subjectId, lessonIndex } = state.quiz;
        const nextVariant = ((state.quiz.variant || 0) + 1 + Math.floor(Math.random() * 2)) % 3;
        state.quiz.variant = nextVariant;
        state.quiz.submitted = null;
        state.quiz.answered = false;
        state.quiz.isCorrect = false;
        state.quiz.checking = false;
        state.quiz.loading = true;
        state.quiz.explanation = '';
        renderQuizModal();

        const currentNiv = currentNiveau();
        const dashSubj = DASH_SUBJECTS.find(s => s.id === subjectId);
        const { lesson, questionId } = await AiProvider.fetchQuestion(
            subjectId, lessonIndex, currentNiv, { variant: nextVariant, subject: dashSubj }
        );
        if (!state.quiz || state.quiz.subjectId !== subjectId || state.quiz.lessonIndex !== lessonIndex) return;
        state.quiz.lesson = lesson;
        state.quiz.questionId = questionId;
        state.quiz.loading = false;
        renderQuizModal();
    };

    window._dashSubmitQuiz = async function (rawAnswer) {
        if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
        const quiz = state.quiz;
        quiz.submitted = rawAnswer;
        quiz.attempts += 1;
        quiz.checking = true;
        renderQuizModal();

        const result = await AiProvider.submitAnswer(quiz.questionId, quiz.lesson, rawAnswer);
        if (state.quiz !== quiz) return;

        quiz.checking = false;
        quiz.answered = true;
        quiz.isCorrect = result.isCorrect;
        quiz.explanation = (rawAnswer === 'TEMPS_ECOULE')
            ? "Temps écoulé ! Tu as dépassé les 30 secondes accordées."
            : result.explanation;
        quiz.lesson = { ...quiz.lesson, ...result.answerKey };

        if (result.isCorrect) {
            if (typeof DB !== 'undefined' && DB.recordCorrectAnswer) {
                DB.recordCorrectAnswer();
            }
        } else {
            let shieldSaved = false;
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-shield')) {
                DB.useBooster('boost-shield');
                shieldSaved = true;
                quiz.usedShield = true;
                window._lastUsedBoosterShield = true;
                showNotification('🛡️ Bouclier d\'Étoile consommé : Série et 3 étoiles protégées !', 'info');
            }
            if (typeof DB !== 'undefined' && DB.recordWrongAnswer) {
                DB.recordWrongAnswer(shieldSaved);
            }
        }
        renderQuizModal();
    };

    window._dashFinishQuiz = function () {
        if (window.quizChronoInterval) clearInterval(window.quizChronoInterval);
        const { subjectId, lessonIndex, attempts } = state.quiz;
        const streakRes = (typeof DB !== 'undefined' && DB.recordLevelVictory) ? DB.recordLevelVictory() : { streak: 1, combo: 0, multiplier: 1.0 };
        const mult = (streakRes && streakRes.multiplier) || ((typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier() : 1.0);
        let xpGained = 0;
        let coinsGained = 0;
        let scoreGained = 0;
        
        let usedShield = Boolean(state.quiz && state.quiz.usedShield);
        if (lessonIndex === (state.progress[subjectId] || 0)) {
            state.progress[subjectId] = (state.progress[subjectId] || 0) + 1;
            
            const rewards = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                ? AdminStore.getRewardsConfig()
                : { xpBase: 15, coinsBase: 10, chronoBonusMaxXp: 15, dailyChestCoins: 50, firstTryBonusXp: 10, questRewardMultiplier: 1 };

            const chronoEnabled = (typeof DB !== 'undefined' && DB.getOption('modeChrono') === 'true');
            const chronoBonus = (chronoEnabled && (window.quizTimeRemaining || 0) > 0)
                ? Math.floor(rewards.chronoBonusMaxXp * (window.quizTimeRemaining / 30))
                : 0;
            let usedDoubleXp = false;
            if (!usedShield && attempts === 2 && typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-shield')) {
                DB.useBooster('boost-shield');
                usedShield = true;
                showNotification('🛡️ Bouclier d\'Étoile consommé : 3 étoiles préservées !', 'info');
            }
            const firstTryBonus = (attempts === 1 || usedShield) ? (rewards.firstTryBonusXp || 0) : 0;
            
            let baseCalcXp = rewards.xpBase + chronoBonus + firstTryBonus;
            // Potion Double XP
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster('boost-xp')) {
                DB.useBooster('boost-xp');
                usedDoubleXp = true;
                baseCalcXp *= 2;
                showNotification('🧪 Potion Double XP consommée : XP doublée !', 'success');
            }

            xpGained = Math.round(baseCalcXp * mult);
            coinsGained = rewards.coinsBase;

            const baseScore = 100 * ((attempts === 1 || usedShield) ? 3 : (attempts === 2 ? 2 : 1));
            scoreGained = Math.round(baseScore * mult);
            const currentScore = parseInt(getOption('dash_total_score') || '0', 10);
            saveOption('dash_total_score', String(currentScore + scoreGained));

            state.xp += xpGained;
            state.coins += coinsGained;
            triggerBadgesCheck({
                justAnsweredFirstTry: (attempts === 1 || usedShield),
                justCompletedLevel: true,
                starsEarned: (attempts === 1 || usedShield) ? 3 : (attempts === 2 ? 2 : 1),
                subjectId,
                usedDoubleXp,
                usedShield,
                usedBooster: usedDoubleXp ? 'boost-xp' : (usedShield ? 'boost-shield' : null),
                boosterId: usedDoubleXp ? 'boost-xp' : (usedShield ? 'boost-shield' : null),
                streakCount: streakRes.streak,
                comboCount: streakRes.combo,
                maxCombo: streakRes.maxCombo,
                totalScore: currentScore + scoreGained
            });
        }
        state.quiz = null;
        const overlay = document.getElementById('dashQuizOverlay');
        if (overlay) overlay.remove();
        persistState();

        Celebrate.confetti();
        DailyQuests.track({
            levels:   1,
            xp:       xpGained,
            perfect:  (attempts === 1 || usedShield) ? 1 : 0,
            firstTry: (attempts === 1 || usedShield) ? 1 : 0,
        });

        render();
        if (xpGained > 0) {
            showNotification(`✓ +${xpGained} XP ${mult > 1.0 ? `[x${mult.toFixed(1)}] ` : ''}, +${coinsGained} pièces, +${scoreGained} pts !`);
        }
    };

    function syncWallet() {
        state.xp = parseInt(getOption('dash_xp') || '0', 10);
        state.coins = parseInt(getOption('dash_coins') || '30', 10);
    }

    window._dashClaimQuest = function (id, btn) {
        const q = DailyQuests.claim(id);
        if (!q) return;
        if (btn) Celebrate.burst(btn);
        syncWallet();
        triggerBadgesCheck({ questClaimed: true });
        render();
        showNotification(`${q.icon} Récompense : +${q.xp} XP et +${q.coins} pièces !`);
    };

    window._dashClaimBonus = function (btn) {
        const coins = DailyQuests.claimBonus();
        if (!coins) return;
        if (btn) Celebrate.burst(btn);
        Celebrate.confetti();
        syncWallet();
        triggerBadgesCheck({ dailyChestOpened: true });
        render();
        showNotification(`🎁 Coffre du jour ouvert : +${coins} pièces !`);
    };

    window._dashSetShopCategory = function (cat) {
        state.shopCategory = cat;
        render();
    };

    window._dashBuySkin = function (id) {
        const item = getShopCatalog().find(s => s.id === id);
        if (!item) return;
        if (state.coins < item.cost) {
            showNotification('❌ Pas assez de pièces pour cet article !');
            return;
        }
        state.coins -= item.cost;
        const cat = item.category || 'aura';

        if (cat === 'booster') {
            if (typeof DB !== 'undefined' && DB.addBooster) {
                DB.addBooster(id, 1);
            }
            triggerBadgesCheck({ boughtBooster: true, boosterId: id, hasBooster: true });
            persistState();
            render();
            showNotification(`⚡ Potion « ${item.name} » ajoutée à ta réserve (+1) !`);
            return;
        }

        if (!state.ownedSkins.includes(id)) {
            state.ownedSkins.push(id);
        }
        if (cat === 'title') {
            state.equippedTitle = id;
        } else if (cat === 'theme') {
            state.equippedTheme = id;
            document.documentElement.setAttribute('data-theme', id);
        } else if (cat === 'avatar') {
            state.equippedAvatar = id;
        } else {
            // aura
            state.equippedAura = id;
            state.equippedSkin = id;
        }
        triggerBadgesCheck({ boughtSkin: true, skinId: id });
        persistState();
        render();
        showNotification(`✓ « ${item.name} » débloqué et équipé !`);
    };

    window._dashEquipSkin = function (id) {
        const item = getShopCatalog().find(s => s.id === id);
        if (!item) return;
        const cat = item.category || 'aura';
        if (cat === 'title') {
            state.equippedTitle = (state.equippedTitle === id ? '' : id);
            showNotification(state.equippedTitle ? `🏷️ Titre « ${item.name} » activé !` : 'Titre retiré.');
        } else if (cat === 'theme') {
            if (id === 'default') {
                state.equippedTheme = 'default';
                document.documentElement.setAttribute('data-theme', 'default');
                showNotification(`🎨 Thème d'origine Astral rétabli !`);
            } else {
                state.equippedTheme = (state.equippedTheme === id ? 'default' : id);
                document.documentElement.setAttribute('data-theme', state.equippedTheme);
                triggerBadgesCheck({ theme: state.equippedTheme });
                showNotification(`🎨 Thème « ${item.name} » appliqué !`);
            }
        } else if (cat === 'avatar') {
            state.equippedAvatar = id;
            showNotification(`👤 Avatar « ${item.name} » équipé !`);
        } else if (cat === 'aura') {
            state.equippedAura = id;
            state.equippedSkin = id;
            showNotification(`✨ Aura « ${item.name} » équipée !`);
        } else {
            state.equippedSkin = id;
            showNotification(`✓ « ${item.name} » équipé !`);
        }
        persistState();
        render();
    };

    /* ============ NAVIGATION RETOUR & SYNCHRONISATION SANS RECHARGEMENT ============ */
    window.addEventListener('popstate', (e) => {
        if (state.quiz) {
            window._dashCloseQuiz();
            return;
        }
        if (e.state && e.state.view) {
            navigateToView(e.state.view, e.state.currentSubject || null, false);
        } else {
            navigateToView('dashboard', null, false);
        }
    });

    window.addEventListener('pageshow', () => {
        // En cas de retour (BFCache ou retour arrière du navigateur),
        // resynchronise silencieusement l'état sans rechargement de page
        state = loadState();
        render();
    });

    /* ============ PREMIER RENDU ============ */
    persistState();
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
    setupCookieConsentFallback();

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
    initConnexion();  // login.html   → formulaires connexion + inscription
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
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker enregistré', reg.scope))
            .catch(err => console.error('Erreur Service Worker', err));
    }
});
