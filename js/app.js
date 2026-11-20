/* ==========================================================================
   APP.JS — EDUQUEST v1.29.1
   Contrôleur principal du jeu : cycle de vie des vues, apparence, audio,
   chronomètre, anti-triche, moteur adaptatif / multi-IA, HUD et modales.
   ========================================================================== */

/* ==========================================================================
   GESTIONNAIRE D'ERREUR GLOBAL (PWA / Audit v1.18)
   Capture les erreurs fatales pour afficher une UI élégante plutôt qu'un écran blanc.
========================================================================== */
function setupGlobalErrorHandler() {
    function sanitize(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isBenignError(msg, err) {
        const text = String(msg || '') + ' ' + String(err && err.message ? err.message : '');
        // Erreurs non fatales fréquentes dans les navigateurs ou PWA
        return (
            text.includes('ResizeObserver') ||
            text.includes('play() failed') ||
            text.includes('NotAllowedError') ||
            text.includes('AbortError') ||
            text.includes('Failed to fetch') ||
            text.includes('NetworkError') ||
            text.includes('Script error.')
        );
    }

    function showErrorScreen(msg, isPromise = false) {
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
            <div style="font-size: 3.5rem; margin-bottom: 15px;">⚠️</div>
            <h1 style="color: #ff4757; margin-bottom: 12px; font-size: 1.8rem;">Oups... Une anicroche technique !</h1>
            <p style="color: #a4b0be; max-width: 600px; margin-bottom: 25px; line-height: 1.5; font-size: 0.95rem;">
                Le jeu a rencontré un problème inattendu.<br>
                <code style="display: block; margin-top: 12px; padding: 10px; background: #2f3542; color: #ff6b81; border-radius: 6px; font-family: monospace; font-size: 0.85rem; word-break: break-all;">${sanitize(msg)}</code>
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                <button id="eduquest-crash-reload-btn" style="
                    background: linear-gradient(135deg, #1e90ff, #3742fa);
                    border: none; padding: 12px 24px; color: white; font-weight: bold;
                    border-radius: 8px; cursor: pointer; font-size: 1rem;
                    box-shadow: 0 4px 15px rgba(30, 144, 255, 0.4);
                ">🔄 Recharger la page</button>
                <button id="eduquest-crash-dismiss-btn" style="
                    background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 12px 20px; color: #ced6e0; font-weight: 600;
                    border-radius: 8px; cursor: pointer; font-size: 0.95rem;
                ">Continuer malgré tout</button>
            </div>
        `;
        document.body.appendChild(crashScreen);
        const reloadBtn = document.getElementById('eduquest-crash-reload-btn');
        if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload(true));
        const dismissBtn = document.getElementById('eduquest-crash-dismiss-btn');
        if (dismissBtn) dismissBtn.addEventListener('click', () => crashScreen.remove());
    }

    window.addEventListener('error', (event) => {
        console.error("Global error caught:", event.error || event.message);
        if (isBenignError(event.message, event.error)) return;
        showErrorScreen(event.message || "Erreur de script inconnue.");
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error("Unhandled promise rejection:", event.reason);
        const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
        if (isBenignError(msg, event.reason)) return;
        showErrorScreen("Erreur asynchrone : " + msg, true);
    });
}
setupGlobalErrorHandler();

/* ==========================================================================
   1. UTILITAIRES PARTAGÉS
   Fonctions simples utilisées sur plusieurs pages.
   ========================================================================== */

/** Version de l'application — affichée dans le footer de toutes les pages. */
const APP_VERSION = '1.29.1';

/**
 * Calcule une couleur de texte à fort contraste (#0b1220 ou #f0f4ff) selon
 * la luminance relative d'une couleur hexadécimale #rrggbb.
 */
function _contrastTextForHex(hex) {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return '#f0f4ff';
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.62 ? '#0b1220' : '#f0f4ff';
}

/**
 * Applique globalement les réglages d'apparence (thème boutique, couleur
 * de l'interface, couleur des boutons, luminosité des boutons) sur TOUTES
 * les pages du site.
 */
function applyAppearanceSettings() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;

    // 1. Thème de la boutique (data-theme) appliqué partout (index, dashboard, map)
    const shopTheme = getOption('dash_equippedTheme') || 'default';
    root.setAttribute('data-theme', shopTheme);

    // 2. Luminosité des boutons (défaut adouci : 80 % = 0.80)
    const rawBrightness = parseInt(getOption('btnBrightness') || '80', 10);
    const clampedPct = Number.isFinite(rawBrightness) ? Math.min(110, Math.max(45, rawBrightness)) : 80;
    root.style.setProperty('--btn-brightness', (clampedPct / 100).toFixed(2));

    // 3. Couleur personnalisée de l'interface
    const uiPreset = getOption('uiPreset') || 'default';
    const uiColor = getOption('uiColor') || '';
    const uiAccent = getOption('uiAccent') || '';
    if (uiPreset !== 'default' && /^#[0-9a-f]{6}$/i.test(uiColor)) {
        root.setAttribute('data-ui-custom', 'true');
        root.style.setProperty('--ui-bg-tint', uiColor);
        if (/^#[0-9a-f]{6}$/i.test(uiAccent)) {
            root.style.setProperty('--ui-accent', uiAccent);
            root.style.setProperty('--c-gold', uiAccent);
        } else {
            root.style.setProperty('--ui-accent', uiColor);
        }
    } else {
        root.removeAttribute('data-ui-custom');
        root.style.removeProperty('--ui-bg-tint');
        root.style.removeProperty('--ui-accent');
        root.style.removeProperty('--c-gold');
    }

    // 4. Couleur personnalisée des boutons
    const btnPreset = getOption('btnPreset') || 'default';
    const btnColor = getOption('btnColor') || '';
    if (btnPreset !== 'default' && /^#[0-9a-f]{6}$/i.test(btnColor)) {
        root.setAttribute('data-btn-custom', 'true');
        root.style.setProperty('--ui-btn-bg', btnColor);
        root.style.setProperty('--ui-btn-border', btnColor);
        root.style.setProperty('--ui-btn-text', _contrastTextForHex(btnColor));
    } else {
        root.removeAttribute('data-btn-custom');
        root.style.removeProperty('--ui-btn-bg');
        root.style.removeProperty('--ui-btn-border');
        root.style.removeProperty('--ui-btn-text');
    }
}

/**
 * Affiche le bandeau d'annonce globale (AdminStore.siteConfig.announcement)
 * sur l'accueil et le tableau de bord lorsqu'un message est configuré.
 */
function applySiteAnnouncement() {
    const el = document.getElementById('siteAnnouncement');
    if (!el) return;
    const cfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
        ? AdminStore.getSiteConfig()
        : null;
    const maint = cfg && cfg.maintenanceMode;
    const maintMsg = (cfg && typeof cfg.maintenanceMessage === 'string') ? cfg.maintenanceMessage.trim() : '';
    const msg = (cfg && typeof cfg.announcement === 'string') ? cfg.announcement.trim() : '';
    if (maint && maintMsg) {
        el.textContent = '⚠️ ' + maintMsg;
        el.hidden = false;
    } else if (maint) {
        el.textContent = '⚠️ Mode maintenance / examen activé par l\'administrateur.';
        el.hidden = false;
    } else if (msg) {
        el.textContent = '📢 ' + msg;
        el.hidden = false;
    } else {
        el.textContent = '';
        el.hidden = true;
    }
}

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

/**
 * Réapplique l'ensemble des préférences visuelles, particules, performances et audio.
 * Appelée au chargement, lors du retour arrière (pageshow / bfcache), au focus et sur storage.
 */
function applyAllRuntimeSettings() {
    applyAppearanceSettings();
    applyParticulesSetting();
    applyEcoModeSetting();
    applyAnimationsSetting();
    applySiteAnnouncement();
    if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncWithOptions === 'function') {
        AudioManager.syncWithOptions(false);
    }
}

// Synchronisation temps réel des crédits, de l'annonce, des particules et de tous les paramètres
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === 'eduquest_admin_data') {
            if (typeof AdminStore !== 'undefined' && typeof AdminStore.invalidateCache === 'function') AdminStore.invalidateCache();
            if (typeof _effectiveSubjectsCache !== 'undefined') _effectiveSubjectsCache.clear();
            refreshFooterCredits();
            applySiteAnnouncement();
        }
        if (event.key && (event.key === 'eduquest_options' || event.key.startsWith('eduquest_opts_'))) {
            applyAllRuntimeSettings();
            if (typeof window._syncOptionsModalUI === 'function') window._syncOptionsModalUI();
        }
    });
    window.addEventListener('eduquest:credits-updated', refreshFooterCredits);
    window.addEventListener('pageshow', () => {
        applyAllRuntimeSettings();
        if (typeof window._syncOptionsModalUI === 'function') window._syncOptionsModalUI();
    });
    window.addEventListener('focus', () => {
        applyAllRuntimeSettings();
    });
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) applyAllRuntimeSettings();
        });
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
    const saved = (typeof DB !== 'undefined' && DB.getNiveau) ? DB.getNiveau() : null;
    if (saved) return saved;
    const cfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
        ? AdminStore.getSiteConfig()
        : null;
    return (cfg && cfg.defaultNiveau) ? cfg.defaultNiveau : '6eme';
}

function currentFiliere() {
    const cfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
        ? AdminStore.getSiteConfig()
        : null;
    const saved = (typeof DB !== 'undefined' && DB.getFiliere) ? DB.getFiliere() : null;
    const active = (typeof AdminStore !== 'undefined' && typeof AdminStore.getActiveFilieres === 'function')
        ? AdminStore.getActiveFilieres()
        : null;
    const candidate = saved || (cfg && cfg.defaultFiliere) || 'generale';
    if (Array.isArray(active) && active.length > 0 && !active.some(f => f.id === candidate)) {
        return active[0].id;
    }
    return candidate;
}

/**
 * Échappe les caractères HTML spéciaux avant d'insérer une chaîne dans du
 * innerHTML — utile pour tout texte qui vient de l'utilisateur (pseudo,
 * réponses saisies…) plutôt que du contenu écrit en dur dans ce fichier.
 * Sans ça, un pseudo comme "<img src=x onerror=alert(1)>" créé sur
 * login.html s'exécuterait tel quel dans le dashboard (XSS stocké).
 */
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Active ou désactive l'affichage des particules (nuages, étoiles scintillantes et confettis).
 * Garantit que le réglage s'applique immédiatement et proprement sur toutes les pages.
 */
function applyParticulesSetting() {
    const val = getOption('particules');
    const disabled = (val === 'false');
    if (document.body) {
        document.body.classList.toggle('no-particles', disabled);
    }
    const clouds = document.getElementById('clouds');
    const stars = document.getElementById('stars') || document.getElementById('stars-bg');
    if (clouds) {
        clouds.style.display = disabled ? 'none' : '';
    }
    if (stars) {
        stars.style.display = disabled ? 'none' : '';
    }
    if (disabled) {
        if (typeof Celebrate !== 'undefined' && typeof Celebrate.clear === 'function') {
            Celebrate.clear();
        }
    } else if ((clouds && clouds.children.length === 0) || (stars && stars.children.length === 0)) {
        createEnvironment();
    }
}

/**
 * Active ou désactive le mode Économie d'énergie.
 * Ajoute une classe CSS sur <body> pour couper les animations et particules.
 */
function applyEcoModeSetting() {
    const val = getOption('ecoMode');
    const isEco = (val === 'true');
    if (document.body) {
        document.body.classList.toggle('eco-mode-active', isEco);
    }
    if (isEco && typeof Celebrate !== 'undefined' && typeof Celebrate.clear === 'function') {
        Celebrate.clear();
    }
}

/**
 * Active ou désactive les animations esthétiques de l'interface (Étape 10).
 * Ajoute ou retire la classe 'no-animations' sur document.body.
 */
function applyAnimationsSetting() {
    const val = getOption('animationsActives');
    const noAnim = (val === 'false');
    if (document.body) {
        document.body.classList.toggle('no-animations', noAnim);
    }
    if (noAnim && typeof Celebrate !== 'undefined' && typeof Celebrate.clear === 'function') {
        Celebrate.clear();
    }
}

/**
 * Génère et insère les éléments visuels de l'environnement (étoiles + nuages).
 * Optimisé : utilise DocumentFragment (1 seul reflow), adapte la densité sur mobile,
 * et utilise des délais négatifs sur les nuages pour éviter l'empilement sur le bord gauche.
 */
function createEnvironment() {
    const starsContainer = document.getElementById('stars') || document.getElementById('stars-bg');
    const cloudsContainer = document.getElementById('clouds');
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // Génération des étoiles (densité allégée sur mobile pour de meilleures performances)
    if (starsContainer && starsContainer.children.length === 0) {
        const starCount = isMobile ? 36 : 72;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = (Math.random() * 2.5 + 1).toFixed(1) + 'px';
            star.style.width = size;
            star.style.height = size;
            star.style.left = (Math.random() * 100).toFixed(2) + '%';
            star.style.top = (Math.random() * 62).toFixed(2) + '%';
            const dur = (2.4 + Math.random() * 2.6).toFixed(2) + 's';
            const delay = (-Math.random() * 3).toFixed(2) + 's';
            star.style.setProperty('--dur', dur);
            star.style.setProperty('--delay', delay);
            frag.appendChild(star);
        }
        starsContainer.appendChild(frag);
    }

    // Génération des nuages (répartis dès la 1ère frame grâce aux délais négatifs)
    if (cloudsContainer && cloudsContainer.children.length === 0) {
        const cloudCount = isMobile ? 3 : 5;
        const frag = document.createDocumentFragment();
        for (let j = 0; j < cloudCount; j++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            const width = Math.round(Math.random() * 180 + 110);
            const height = Math.round(Math.random() * 52 + 38);
            const duration = 26 + Math.random() * 18;
            cloud.style.width = width + 'px';
            cloud.style.height = height + 'px';
            cloud.style.left = '-320px';
            cloud.style.top = (18 + (j / cloudCount) * 52 + Math.random() * 6).toFixed(1) + '%';
            cloud.style.animationDuration = duration.toFixed(1) + 's';
            // Délai négatif : chaque nuage démarre déjà réparti dans le ciel sans jamais s'empiler au bord
            cloud.style.animationDelay = (-(j / cloudCount) * duration).toFixed(1) + 's';
            frag.appendChild(cloud);
        }
        cloudsContainer.appendChild(frag);
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
   2. SYSTÈME AUDIO GLOBAL (délégué à js/core/audio-manager.js — v1.27.0)
   Garantit une musique continue sur tout le site (accueil, dashboard, carte,
   exercices, légal) ET zéro réactivation aléatoire après coupure manuelle.
   ========================================================================== */

function initGlobalMusic() {
    if (typeof AudioManager !== 'undefined' && typeof AudioManager.init === 'function') {
        AudioManager.init();
    }
}

function playTrack(index) {
    if (typeof AudioManager !== 'undefined' && typeof AudioManager.playTrack === 'function') {
        AudioManager.playTrack(index, true);
    }
}

/* ==========================================================================
   3. LOGIQUE D'ACCUEIL & NOTIFICATIONS
   Gère la page index.html, l'expulsion propre sur Quitter et les toasts.
   ========================================================================== */

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = 'notification';
    if (type === 'error') notif.classList.add('error');
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

/**
 * Initialise la page d'accueil (index.html).
 * Bouton « QUITTER » :
 *   1. Ouvre la modale thématique #modalQuitConfirm.
 *   2. À la confirmation (dans le geste utilisateur synchrone) :
 *      - Coupe immédiatement la musique & tout audio (AudioManager.stopAll)
 *      - Quitte le plein écran s'il est actif
 *      - Tente la fermeture directe de l'onglet (window.close)
 *      - Affiche l'écran d'au revoir puis expulse automatiquement vers about:blank
 *        si le navigateur empêche la fermeture d'un onglet ouvert manuellement.
 */
function initAccueil() {
    const quitButton = document.getElementById('quitButton');
    const quitModal = document.getElementById('modalQuitConfirm');
    const confirmYes = document.getElementById('confirmQuitYes');
    const confirmCancel = document.getElementById('confirmQuitCancel');

    function performQuitExpulsion() {
        // 1. Coupe tout son immédiatement
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.stopAll === 'function') {
            AudioManager.stopAll();
        }
        // 2. Quitte le plein écran si actif
        if (document.fullscreenElement) {
            const exitFs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
            if (exitFs) { try { exitFs.call(document); } catch (_) {} }
        }
        // 3. Bascule vers l'écran de sortie
        if (quitModal) quitModal.hidden = true;
        const mainPage = document.getElementById('mainPage');
        const exitPage = document.getElementById('exitPage');
        if (mainPage) mainPage.classList.add('hidden');
        if (exitPage) exitPage.classList.remove('hidden');

        // 4. Tentative synchrone de fermeture dans le geste utilisateur
        try { window.close(); } catch (_) {}
        try { window.open('', '_self', ''); window.close(); } catch (_) {}

        // 5. Si l'onglet reste ouvert (sécurité navigateur), expulsion propre vers about:blank
        setTimeout(() => {
            try { window.close(); } catch (_) {}
            const subtitle = document.querySelector('#exitPage .exit-subtitle');
            if (subtitle) subtitle.textContent = 'Fermeture de la session EDUQUEST…';
            setTimeout(() => {
                try {
                    window.location.replace('about:blank');
                } catch (_) {
                    if (subtitle) subtitle.textContent = 'Session terminée. Vous pouvez fermer cet onglet.';
                }
            }, 650);
        }, 450);
    }

    if (quitButton) {
        quitButton.addEventListener('click', () => {
            if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
                AudioManager.playSfx('click');
            }
            if (quitModal) {
                quitModal.hidden = false;
                if (confirmCancel) confirmCancel.focus();
            } else if (confirm('Voulez-vous vraiment quitter EDUQUEST ?')) {
                performQuitExpulsion();
            }
        });
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', performQuitExpulsion);
    }
    if (confirmCancel && quitModal) {
        confirmCancel.addEventListener('click', () => {
            quitModal.hidden = true;
        });
    }
    if (quitModal) {
        quitModal.addEventListener('click', (e) => {
            if (e.target === quitModal) quitModal.hidden = true;
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !quitModal.hidden) quitModal.hidden = true;
        });
    }
}

/* ==========================================================================
   4. AUTHENTIFICATION & COMPTE (Modale #modalLogin)
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
        const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : null;
        const allowReg = !siteCfg || siteCfg.allowRegistration !== false;
        if (!allowReg) {
            tabRegister.hidden = true;
            if (panelRegister) panelRegister.hidden = true;
        }

        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            if (panelLogin)    panelLogin.hidden    = false; // Affiche le formulaire de connexion
            if (panelRegister) panelRegister.hidden = true;  // Cache le formulaire d'inscription
        });

        tabRegister.addEventListener('click', () => {
            if (!allowReg) {
                showNotification('Les inscriptions sont temporairement fermées par l\'administrateur.', 'error');
                return;
            }
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

    const modalLogin = document.getElementById('modalLogin');
    const closeLoginX = document.getElementById('closeLoginX');
    const closeLoginModal = () => {
        if (modalLogin) modalLogin.hidden = true;
    };
    if (closeLoginX) closeLoginX.addEventListener('click', closeLoginModal);
    if (modalLogin) {
        modalLogin.addEventListener('click', (e) => {
            if (e.target === modalLogin) closeLoginModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modalLogin.hidden) closeLoginModal();
        });
    }
    window._openLoginModal = function () {
        updateUserDisplay();
        if (modalLogin) modalLogin.hidden = false;
    };
}

/* ==========================================================================
   5. GESTION DES OPTIONS & APPARENCE (Modale #modalOptions — v1.28.0)
   ========================================================================== */
let _optionsOpenedFromHash = false;

function initOptions() {
    const volumeMusique      = document.getElementById('volumeMusique');
    const volumeEffets       = document.getElementById('volumeEffets');
    const pleinEcran         = document.getElementById('pleinEcran');
    const sonsActifs         = document.getElementById('sonsActifs');
    const musiqueActive      = document.getElementById('musiqueActive');
    const effetsActifs       = document.getElementById('effetsActifs');
    const saveOptionsBtn     = document.getElementById('saveOptions');
    const backButton         = document.getElementById('backButton');
    const closeOptionsX      = document.getElementById('closeOptionsX');
    const modalOptionsEl     = document.getElementById('modalOptions');
    const particulesCheckbox = document.getElementById('particules');
    const ecoModeCheckbox    = document.getElementById('ecoMode');
    const animationsCheckbox = document.getElementById('animationsActives');
    const modeChronoCheckbox = document.getElementById('modeChrono');
    const chronoDurLabel     = document.getElementById('chronoDurationLabel');
    const optNiveauSelect    = document.getElementById('optionsNiveauSelect');
    const optFiliereGroup    = document.getElementById('optionsFiliereGroup');
    const optFiliereSelect   = document.getElementById('optionsFiliereSelect');

    // Contrôles d'apparence (Couleur interface, Couleur boutons, Luminosité boutons)
    const uiColorPresets     = document.getElementById('uiColorPresets');
    const uiColorPicker      = document.getElementById('uiColorPicker');
    const btnColorPresets    = document.getElementById('btnColorPresets');
    const btnColorPicker     = document.getElementById('btnColorPicker');
    const btnBrightness      = document.getElementById('btnBrightness');
    const btnBrightnessDisp  = document.getElementById('valueBtnBrightnessDisplay');
    const resetAppearanceBtn = document.getElementById('resetAppearanceBtn');

    if (!saveOptionsBtn) return;

    // Etat courant d'apparence en cours d'édition
    let curUiPreset  = getOption('uiPreset') || 'default';
    let curUiColor   = getOption('uiColor') || '#0d1f3a';
    let curUiAccent  = getOption('uiAccent') || '#c8a84b';
    let curBtnPreset = getOption('btnPreset') || 'default';
    let curBtnColor  = getOption('btnColor') || '#24354f';

    // 1. Durée dynamique du chrono (AdminStore.siteConfig.quizTimerSeconds)
    if (chronoDurLabel && typeof QuizTimer !== 'undefined' && typeof QuizTimer.getConfiguredDuration === 'function') {
        chronoDurLabel.textContent = QuizTimer.getConfiguredDuration() + 's';
    }

    // 2. Peuplement dynamique du sélecteur de classe depuis AdminStore.getLevels()
    if (optNiveauSelect && typeof AdminStore !== 'undefined' && typeof AdminStore.getLevels === 'function') {
        const levels = AdminStore.getLevels();
        if (Array.isArray(levels) && levels.length > 0) {
            optNiveauSelect.innerHTML = levels.map(l => {
                const isBts = l.id === 'bts1' || l.id === 'bts2';
                const cycle = isBts ? 'Supérieur' : (l.band === 'lycee' ? 'Lycée' : 'Collège');
                return `<option value="${escapeHtml(l.id)}">🎓 ${escapeHtml(l.label || l.id)} (${cycle})</option>`;
            }).join('');
        }
    }

    // 3. Peuplement dynamique du sélecteur de filière (Lycée & BTS — filières actives)
    if (optFiliereSelect && typeof AdminStore !== 'undefined') {
        const filieres = (typeof AdminStore.getActiveFilieres === 'function')
            ? AdminStore.getActiveFilieres()
            : (typeof AdminStore.getFilieres === 'function' ? AdminStore.getFilieres() : []);
        if (Array.isArray(filieres) && filieres.length > 0) {
            optFiliereSelect.innerHTML = filieres.map(f =>
                `<option value="${escapeHtml(f.id)}">${escapeHtml(f.icon || '🧭')} ${escapeHtml(f.label || f.id)}</option>`
            ).join('');
        }
    }

    function syncFiliereGroupVisibility() {
        if (!optFiliereGroup || !optNiveauSelect) return;
        const applicable = (typeof AdminStore !== 'undefined' && typeof AdminStore.isFiliereApplicable === 'function')
            ? AdminStore.isFiliereApplicable(optNiveauSelect.value)
            : ['2nde', '1ere', 'terminale', 'bts1', 'bts2'].includes(optNiveauSelect.value);
        optFiliereGroup.hidden = !applicable;
    }

    function updateVolumeMusique(applyLive = true) {
        const disp = document.getElementById('valueMusiqueDisplay');
        if (disp) disp.textContent = volumeMusique.value + '%';
        if (applyLive) {
            saveOption('volumeMusique', volumeMusique.value);
            if (typeof AudioManager !== 'undefined' && typeof AudioManager.setMusicVolume === 'function') {
                AudioManager.setMusicVolume(volumeMusique.value);
            }
        }
    }

    function updateVolumeEffets(applyLive = true) {
        const disp = document.getElementById('valueEffetsDisplay');
        if (disp) disp.textContent = volumeEffets.value + '%';
        if (applyLive) {
            saveOption('volumeEffets', volumeEffets.value);
            if (typeof AudioManager !== 'undefined' && typeof AudioManager.setSfxVolume === 'function') {
                AudioManager.setSfxVolume(volumeEffets.value);
            }
        }
    }

    function updateBtnBrightnessDisplay() {
        if (!btnBrightness) return;
        const pct = parseInt(btnBrightness.value, 10) || 80;
        if (btnBrightnessDisp) btnBrightnessDisp.textContent = pct + '%';
        document.documentElement.style.setProperty('--btn-brightness', (pct / 100).toFixed(2));
    }

    function refreshAppearanceSwatches() {
        if (uiColorPresets) {
            uiColorPresets.querySelectorAll('.color-swatch').forEach(sw => {
                sw.classList.toggle('active', sw.dataset.uiPreset === curUiPreset);
            });
        }
        if (btnColorPresets) {
            btnColorPresets.querySelectorAll('.color-swatch').forEach(sw => {
                sw.classList.toggle('active', sw.dataset.btnPreset === curBtnPreset);
            });
        }
        if (uiColorPicker && /^#[0-9a-f]{6}$/i.test(curUiColor)) uiColorPicker.value = curUiColor;
        if (btnColorPicker && /^#[0-9a-f]{6}$/i.test(curBtnColor)) btnColorPicker.value = curBtnColor;
    }

    function updateSoundControlsState(userInitiated = false) {
        const allActive        = sonsActifs.checked;
        const musiqueContainer = musiqueActive.closest('.checkbox-container');
        const effetsContainer  = effetsActifs.closest('.checkbox-container');

        if (!allActive) {
            musiqueActive.dataset.prevChecked = String(musiqueActive.checked);
            effetsActifs.dataset.prevChecked  = String(effetsActifs.checked);
            musiqueActive.checked  = false;
            musiqueActive.disabled = true;
            effetsActifs.checked   = false;
            effetsActifs.disabled  = true;
            if (musiqueContainer) musiqueContainer.classList.add('disabled');
            if (effetsContainer)  effetsContainer.classList.add('disabled');
        } else {
            musiqueActive.disabled = false;
            effetsActifs.disabled  = false;
            if (musiqueActive.dataset.prevChecked !== undefined) {
                musiqueActive.checked = musiqueActive.dataset.prevChecked !== 'false';
            }
            if (effetsActifs.dataset.prevChecked !== undefined) {
                effetsActifs.checked = effetsActifs.dataset.prevChecked !== 'false';
            }
            if (musiqueContainer) musiqueContainer.classList.remove('disabled');
            if (effetsContainer)  effetsContainer.classList.remove('disabled');
        }

        // Ne JAMAIS déclencher de démarrage audio au chargement passif de la page !
        if (userInitiated) {
            saveCurrentOptionsLocally();
            if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncWithOptions === 'function') {
                AudioManager.syncWithOptions(true);
            }
        }
    }

    function chargerOptionsUI() {
        const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : null;
        const defaultBgm = siteCfg && siteCfg.defaultBgmVolume != null ? String(siteCfg.defaultBgmVolume) : '35';
        const defaultSfx = siteCfg && siteCfg.defaultSfxVolume != null ? String(siteCfg.defaultSfxVolume) : '60';
        const defaultSoundOn = !siteCfg || siteCfg.soundEnabledByDefault !== false;

        if (chronoDurLabel && typeof QuizTimer !== 'undefined' && typeof QuizTimer.getConfiguredDuration === 'function') {
            chronoDurLabel.textContent = QuizTimer.getConfiguredDuration() + 's';
        }

        volumeMusique.value = getOption('volumeMusique') || defaultBgm;
        volumeEffets.value  = getOption('volumeEffets')  || defaultSfx;
        updateVolumeMusique(false);
        updateVolumeEffets(false);

        ['pleinEcran', 'particules', 'ecoMode', 'sonsActifs', 'musiqueActive', 'effetsActifs', 'modeChrono', 'animationsActives'].forEach(id => {
            const value = getOption(id);
            const el    = document.getElementById(id);
            if (!el) return;
            if (value !== null) {
                el.checked = value === 'true';
            } else if (['sonsActifs', 'musiqueActive', 'effetsActifs'].includes(id)) {
                el.checked = defaultSoundOn;
            } else if (id === 'animationsActives' || id === 'particules') {
                el.checked = true;
            } else {
                el.checked = false;
            }
        });

        if (optNiveauSelect && typeof DB !== 'undefined' && DB.getNiveau) {
            optNiveauSelect.value = DB.getNiveau() || '6eme';
        }
        if (optFiliereSelect && typeof DB !== 'undefined' && DB.getFiliere) {
            optFiliereSelect.value = DB.getFiliere() || 'generale';
        }
        syncFiliereGroupVisibility();

        if (!sonsActifs.checked) {
            musiqueActive.dataset.prevChecked = getOption('musiqueActive') || 'true';
            effetsActifs.dataset.prevChecked  = getOption('effetsActifs')  || 'true';
        }
        // Mise à jour visuelle UNIQUEMENT (userInitiated = false)
        updateSoundControlsState(false);

        // Apparence
        curUiPreset  = getOption('uiPreset') || 'default';
        curUiColor   = getOption('uiColor') || '#0d1f3a';
        curUiAccent  = getOption('uiAccent') || '#c8a84b';
        curBtnPreset = getOption('btnPreset') || 'default';
        curBtnColor  = getOption('btnColor') || '#24354f';
        if (btnBrightness) {
            btnBrightness.value = getOption('btnBrightness') || '80';
            updateBtnBrightnessDisplay();
        }
        refreshAppearanceSwatches();
    }

    function saveCurrentOptionsLocally() {
        saveOption('volumeMusique', volumeMusique.value);
        saveOption('volumeEffets', volumeEffets.value);
        saveOption('pleinEcran', String(pleinEcran.checked));
        saveOption('particules', String(particulesCheckbox.checked));
        saveOption('ecoMode', String(ecoModeCheckbox.checked));
        if (animationsCheckbox) saveOption('animationsActives', String(animationsCheckbox.checked));
        saveOption('sonsActifs', String(sonsActifs.checked));
        if (modeChronoCheckbox) saveOption('modeChrono', String(modeChronoCheckbox.checked));

        // Apparence
        saveOption('uiPreset', curUiPreset);
        saveOption('uiColor', curUiColor);
        saveOption('uiAccent', curUiAccent);
        saveOption('btnPreset', curBtnPreset);
        saveOption('btnColor', curBtnColor);
        if (btnBrightness) saveOption('btnBrightness', String(btnBrightness.value));

        if (optNiveauSelect && typeof DB !== 'undefined' && DB.setNiveau) {
            DB.setNiveau(optNiveauSelect.value);
        }
        if (optFiliereSelect && typeof DB !== 'undefined' && DB.setFiliere) {
            DB.setFiliere(optFiliereSelect.value);
        }
        syncFiliereGroupVisibility();

        if (typeof _effectiveSubjectsCache !== 'undefined') _effectiveSubjectsCache.clear();
        if (typeof getEffectiveSubjects === 'function') {
            const niv = optNiveauSelect ? optNiveauSelect.value : currentNiveau();
            const fil = optFiliereSelect ? optFiliereSelect.value : currentFiliere();
            DASH_SUBJECTS = getEffectiveSubjects(niv, fil);
        }

        if (sonsActifs.checked) {
            saveOption('musiqueActive', String(musiqueActive.checked));
            saveOption('effetsActifs', String(effetsActifs.checked));
        } else {
            saveOption('musiqueActive', String(musiqueActive.dataset.prevChecked !== 'false'));
            saveOption('effetsActifs', String(effetsActifs.dataset.prevChecked !== 'false'));
        }

        // Application immédiate de TOUS les paramètres visuels et de particules
        applyAppearanceSettings();
        applyParticulesSetting();
        applyEcoModeSetting();
        applyAnimationsSetting();
    }

    function closeOptionsModal() {
        if (modalOptionsEl) modalOptionsEl.hidden = true;
        if (_optionsOpenedFromHash) {
            _optionsOpenedFromHash = false;
            const ref = document.referrer || '';
            if (ref && (ref.includes('dashboard.html') || ref.includes('map.html'))) {
                window.history.back();
            }
        }
    }

    // Exposition globale : garantit une synchro fraîche à chaque ouverture de la modale
    window._syncOptionsModalUI = chargerOptionsUI;
    window._openOptionsModal = function () {
        chargerOptionsUI();
        if (modalOptionsEl) modalOptionsEl.hidden = false;
    };

    chargerOptionsUI();

    /* --- Écouteurs audio --- */
    sonsActifs.addEventListener('change', () => updateSoundControlsState(true));
    musiqueActive.addEventListener('change', () => {
        saveCurrentOptionsLocally();
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncWithOptions === 'function') {
            AudioManager.syncWithOptions(true);
        }
    });
    // Correctif v1.27.0 : effetsActifs ne touche JAMAIS la musique de fond !
    effetsActifs.addEventListener('change', () => {
        saveCurrentOptionsLocally();
        if (effetsActifs.checked && sonsActifs.checked && typeof AudioManager !== 'undefined') {
            AudioManager.playSfx('click');
        }
    });

    volumeMusique.addEventListener('input', () => updateVolumeMusique(true));
    volumeMusique.addEventListener('change', saveCurrentOptionsLocally);
    volumeEffets.addEventListener('input', () => updateVolumeEffets(true));
    volumeEffets.addEventListener('change', () => {
        saveCurrentOptionsLocally();
        if (typeof AudioManager !== 'undefined') AudioManager.playSfx('click');
    });

    /* --- Écouteurs Apparence --- */
    if (uiColorPresets) {
        uiColorPresets.querySelectorAll('.color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                curUiPreset = sw.dataset.uiPreset || 'default';
                curUiColor  = sw.dataset.bg || '#0d1f3a';
                curUiAccent = sw.dataset.accent || '#c8a84b';
                refreshAppearanceSwatches();
                saveCurrentOptionsLocally();
            });
        });
    }
    if (uiColorPicker) {
        uiColorPicker.addEventListener('input', () => {
            curUiPreset = 'custom';
            curUiColor  = uiColorPicker.value;
            curUiAccent = '#c8a84b';
            refreshAppearanceSwatches();
            saveCurrentOptionsLocally();
        });
    }
    if (btnColorPresets) {
        btnColorPresets.querySelectorAll('.color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                curBtnPreset = sw.dataset.btnPreset || 'default';
                curBtnColor  = sw.dataset.btn || '#24354f';
                refreshAppearanceSwatches();
                saveCurrentOptionsLocally();
            });
        });
    }
    if (btnColorPicker) {
        btnColorPicker.addEventListener('input', () => {
            curBtnPreset = 'custom';
            curBtnColor  = btnColorPicker.value;
            refreshAppearanceSwatches();
            saveCurrentOptionsLocally();
        });
    }
    if (btnBrightness) {
        btnBrightness.addEventListener('input', () => {
            updateBtnBrightnessDisplay();
            saveOption('btnBrightness', String(btnBrightness.value));
        });
        btnBrightness.addEventListener('change', saveCurrentOptionsLocally);
    }
    if (resetAppearanceBtn) {
        resetAppearanceBtn.addEventListener('click', () => {
            curUiPreset  = 'default';
            curUiColor   = '#0d1f3a';
            curUiAccent  = '#c8a84b';
            curBtnPreset = 'default';
            curBtnColor  = '#24354f';
            if (btnBrightness) {
                btnBrightness.value = '80';
                updateBtnBrightnessDisplay();
            }
            refreshAppearanceSwatches();
            saveCurrentOptionsLocally();
            showNotification('🎨 Apparence réinitialisée par défaut !');
        });
    }

    /* --- Écouteurs affichage, classe & filière --- */
    pleinEcran.addEventListener('change', () => {
        if (pleinEcran.checked) {
            const request = document.documentElement.requestFullscreen
                         || document.documentElement.webkitRequestFullscreen
                         || document.documentElement.msRequestFullscreen;
            if (request) {
                try { Promise.resolve(request.call(document.documentElement)).catch(() => {}); } catch (_) {}
            }
        } else if (document.fullscreenElement) {
            const exit = document.exitFullscreen
                      || document.webkitExitFullscreen
                      || document.msExitFullscreen;
            if (exit) {
                try { Promise.resolve(exit.call(document)).catch(() => {}); } catch (_) {}
            }
        }
        saveCurrentOptionsLocally();
    });

    ecoModeCheckbox.addEventListener('change', saveCurrentOptionsLocally);
    particulesCheckbox.addEventListener('change', saveCurrentOptionsLocally);
    if (animationsCheckbox) animationsCheckbox.addEventListener('change', saveCurrentOptionsLocally);
    if (modeChronoCheckbox) modeChronoCheckbox.addEventListener('change', saveCurrentOptionsLocally);
    if (optNiveauSelect) {
        optNiveauSelect.addEventListener('change', () => {
            syncFiliereGroupVisibility();
            saveCurrentOptionsLocally();
        });
    }
    if (optFiliereSelect) optFiliereSelect.addEventListener('change', saveCurrentOptionsLocally);

    /* --- Boutons Sauvegarder, Retour & Fermeture rapide --- */
    saveOptionsBtn.addEventListener('click', () => {
        saveCurrentOptionsLocally();
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncWithOptions === 'function') {
            AudioManager.syncWithOptions(true);
        }
        showNotification('⚙ Options sauvegardées et appliquées !');
        setTimeout(closeOptionsModal, 600);
    });

    if (backButton) {
        backButton.addEventListener('click', () => {
            saveCurrentOptionsLocally();
            closeOptionsModal();
        });
    }

    if (closeOptionsX) {
        closeOptionsX.addEventListener('click', () => {
            saveCurrentOptionsLocally();
            closeOptionsModal();
        });
    }

    if (modalOptionsEl) {
        modalOptionsEl.addEventListener('click', (e) => {
            if (e.target === modalOptionsEl) {
                saveCurrentOptionsLocally();
                closeOptionsModal();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modalOptionsEl.hidden) {
                saveCurrentOptionsLocally();
                closeOptionsModal();
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        pleinEcran.checked = !!document.fullscreenElement;
    });
}

/* ==========================================================================
   6. CÉLÉBRATIONS (confettis)
   Moteur de confettis Canvas autonome, optimisé mobile & respectueux des options.
   ========================================================================== */

/**
 * Moteur de confettis autonome (aucune dépendance externe / CDN) :
 * - Respecte strictement les options Particules, Mode Éco et Animations.
 * - Densité nettement allégée sur téléphone + plafond dur + anti-doublon (cooldown).
 *   Celebrate.confetti();                  // célébration calibrée
 *   Celebrate.burst(element);              // petite explosion sur un bouton
 *   Celebrate.clear();                     // purge immédiate du canvas
 */
const Celebrate = (() => {
    const COLORS = ['#ffd166', '#c8a84b', '#6bca82', '#4cc9f0', '#f72585', '#b388ff', '#ff9f43'];
    let canvas = null, ctx = null, particles = [], rafId = null;
    let lastConfettiAt = 0;
    const CONFETTI_COOLDOWN_MS = 1800;

    function isMobileViewport() {
        if (typeof window === 'undefined') return false;
        const narrow = window.innerWidth <= 768;
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        return narrow || coarse;
    }

    function particlesBlocked() {
        if (typeof getOption === 'function') {
            if (getOption('animationsActives') === 'false') return true;
            if (getOption('particules') === 'false') return true;
            if (getOption('ecoMode') === 'true') return true;
        }
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
        if (!canvas || !ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function clear() {
        particles = [];
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (ctx && canvas) {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    }

    function spawn(x, y, count, spread, power, angle) {
        const mobile = isMobileViewport();
        const maxParticles = mobile ? 36 : 110;
        const room = Math.max(0, maxParticles - particles.length);
        const actualCount = Math.min(count, room);
        if (actualCount <= 0) return;

        for (let i = 0; i < actualCount; i++) {
            const a = angle + (Math.random() - 0.5) * spread;
            const v = power * (0.5 + Math.random() * 0.65);
            particles.push({
                x, y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                w: mobile ? (4.5 + Math.random() * 3.5) : (6 + Math.random() * 5),
                h: mobile ? (3 + Math.random() * 3.5) : (4 + Math.random() * 5),
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.28,
                color: COLORS[(Math.random() * COLORS.length) | 0],
                shape: Math.random() < 0.35 ? 'circle' : 'rect',
                life: 0,
                maxLife: mobile ? (65 + Math.random() * 38) : (105 + Math.random() * 55),
            });
        }
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
        if (particlesBlocked()) {
            clear();
            return;
        }
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        particles = particles.filter(p => p.life < p.maxLife && p.y < window.innerHeight + 36);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.life++;
            p.vy += 0.19;
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.x += p.vx + Math.sin(p.life / 10) * 0.45;
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
        }
        if (particles.length) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    }

    function confettiEnabledBySite() {
        const cfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : null;
        return !cfg || cfg.enableConfetti !== false;
    }

    return {
        /** Célébration calibrée (sobre sur mobile, anti-spam intégré). */
        confetti() {
            if (particlesBlocked() || !confettiEnabledBySite()) return;
            const now = Date.now();
            if (now - lastConfettiAt < CONFETTI_COOLDOWN_MS) return;
            lastConfettiAt = now;
            ensureCanvas();
            const w = window.innerWidth, h = window.innerHeight;
            if (isMobileViewport()) {
                spawn(w * 0.2, h * 0.65, 11, 0.75, 11, -Math.PI / 2.5);
                spawn(w * 0.8, h * 0.65, 11, 0.75, 11, -Math.PI * 1.5 / 2.5);
            } else {
                spawn(0, h * 0.75, 28, 0.85, 15, -Math.PI / 3);
                spawn(w, h * 0.75, 28, 0.85, 15, -Math.PI * 2 / 3);
                setTimeout(() => {
                    if (!particlesBlocked() && confettiEnabledBySite()) spawn(w / 2, h * 0.35, 20, Math.PI * 2, 8, 0);
                }, 160);
            }
        },
        /** Petite explosion centrée sur un élément (ex : bouton « Réclamer »). */
        burst(el) {
            if (particlesBlocked() || !confettiEnabledBySite()) return;
            ensureCanvas();
            const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
            const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
            const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
            const mobile = isMobileViewport();
            spawn(x, y, mobile ? 12 : 24, Math.PI * 2, mobile ? 7 : 9, 0);
        },
        clear,
    };
})();
window.Celebrate = Celebrate;

/* Quêtes journalières : déplacées dans js/features/daily-quests.js (v1.26).
   Ce fichier doit être chargé AVANT app.js ; il expose window.DailyQuests. */
if (typeof window !== 'undefined' && !window.DailyQuests) {
    console.error('[EDUQUEST] js/features/daily-quests.js manquant : ajoutez-le avant app.js.');
}

/* ==========================================================================
   7. CARTE DES MATIÈRES (page map.html)
   Gère l'affichage et l'interaction de la carte de progression par matière.
   ========================================================================== */
/**
 * Initialise la page map.html.
 * Sort immédiatement si l'en-tête .map-header n'existe pas (pas sur cette page).
 *
 * FONCTIONNEMENT GÉNÉRAL :
 * - La matière et l'icône sont passées dans l'URL (ex: map.html?matiere=Mathématiques&icon=Image/ile/maths.webp)
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
    if (subj.includes('espagnol')) {
        return "Vérifie le genre (el / la), la conjugaison (ser vs estar) et le temps demandé en espagnol.";
    }
    if (subj.includes('arts')) {
        return "Pense aux techniques artistiques (couleurs primaires/complémentaires, perspective) et aux grands mouvements culturels.";
    }
    if (subj.includes('hggsp')) {
        return "Relie l'événement historique, l'enjeu géopolitique (frontières, puissances, traités) et les acteurs internationaux.";
    }
    if (subj === 'si') {
        return "Pense à la chaîne d'énergie (alimenter → distribuer → convertir → transmettre) et aux lois de mécanique (P = C × ω, η = Pu / Pa).";
    }
    if (subj.includes('msgn')) {
        return "Distingue l'entreprise (but lucratif), l'organisation publique et l'association, ainsi que les indicateurs (CA, VA, BFR, SWOT).";
    }
    if (subj.includes('droit_eco')) {
        return "En droit, identifie les parties, le contrat ou la juridiction ; en économie, pense au PIB, à l'inflation et aux politiques budgétaire/monétaire.";
    }
    if (subj.includes('mercatique')) {
        return "Rappelle-toi les 4P du marketing mix (Produit, Prix, Distribution, Communication) et les formules de marge ou de taux d'évolution.";
    }
    if (subj === 'i2d') {
        return "Pense au développement durable (ACV, écoconception), à l'efficacité énergétique (E = P × t) et aux propriétés mécaniques/thermiques.";
    }
    if (subj === 'sin') {
        return "Vérifie les bases numériques (binaire, hexadécimal), la logique booléenne (ET, OU, NON) et la résolution des CAN (2ⁿ niveaux).";
    }
    if (subj.includes('cyber')) {
        return "Pense à la triade CIA (Confidentialité, Intégrité, Disponibilité), au chiffrement, au hachage et aux bonnes pratiques ANSSI.";
    }
    if (subj.includes('reseaux')) {
        return "Repère la couche du modèle OSI (L2 = MAC/Switch, L3 = IP/Routeur, L4 = TCP/UDP) et les masques CIDR (/24 = 254 hôtes).";
    }
    if (subj.includes('electronique')) {
        return "Applique les lois d'électricité (U = R·I, diviseur de tension, loi des mailles/nœuds) et les caractéristiques des diodes, transistors et PWM.";
    }
    if (subj.includes('stss')) {
        return "Appuie-toi sur les déterminants de santé, la protection sociale (Sécurité sociale, ARS, PMI) et les démarches de prévention.";
    }
    if (subj.includes('nsi')) {
        return "Vérifie la structure de données (pile LIFO, file FIFO, arbre, graphe), le binaire ou la complexité algorithmique.";
    }
    if (subj.includes('ses')) {
        return "Distingue l'analyse économique (offre/demande, PIB, monnaie) de l'analyse sociologique (socialisation, stratification).";
    }
    if (subj === 'biotech') {
        return "Pense aux protocoles de laboratoire STL/ASSP (asepsie, coloration de Gram, dilution C1·V1 = C2·V2, Beer-Lambert, PCR).";
    }
    if (subj === 'design') {
        return "Appuie-toi sur la démarche de projet STD2A : ergonomie, échelles, couleurs complémentaires, CMJN/RVB, typographie et matériaux.";
    }
    if (subj === 'hotellerie') {
        return "Rappelle-toi les règles HACCP (+3 °C froid / +63 °C chaud), la marche en avant, les techniques culinaires et indicateurs hôteliers (TO, RevPAR).";
    }
    if (subj === 'agronomie') {
        return "Pense à l'agroécologie (rotation, légumineuses, complexe argilo-humique, lutte biologique, 1 ha = 10 000 m²).";
    }
    if (subj === 'spectacle') {
        return "Mobilise les repères des arts de la scène : didascalies, catharsis, côté cour/jardin, rythmes musicaux et chorégraphie.";
    }
    if (subj === 'hlp') {
        return "Relie les grands auteurs humanistes, les outils rhétoriques (éthos, pathos, logos) et les enjeux philosophiques du texte.";
    }
    if (subj === 'dev_bdd') {
        return "Vérifie la syntaxe SQL (SELECT, WHERE, JOIN, GROUP BY), la modélisation Merise/UML, les codes HTTP et les principes POO/MVC.";
    }
    if (subj === 'commerce') {
        return "Utilise les repères BTS MCO : zone de chalandise, SONCAS, CAP, panier moyen, taux de transformation et merchandising.";
    }
    if (subj === 'comptabilite') {
        return "Rappelle-toi le PCG (Actif = Passif, Débit = Crédit, classe 6 Charges / classe 7 Produits, TVA 20 %, amortissement linéaire).";
    }
    if (subj === 'electrotech') {
        return "Appuie-toi sur la norme NF C 15-100, l'habilitation NF C 18-510, le 30 mA, P = U·I (mono) et U = V·√3 (triphasé 400 V).";
    }

    return "Lis attentivement l'énoncé et procède par élimination des réponses manifestement fausses.";
}

/**
 * Affiche une explication claire et instantanée de la différence entre
 * 🔥 Série (victoires consécutives) et ⚡ Énergie Combo (multiplicateur de points/XP).
 */
window._showStatHelp = function (kind) {
    const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
    const streakCount = streakData.count || 0;
    const comboCount = streakData.combo || 0;
    const mult = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
    if (kind === 'streak') {
        showNotification(`🔥 SÉRIE (${streakCount}) : nombre de niveaux réussis d'affilée sans quitter ni abandonner.`);
    } else {
        showNotification(`⚡ ÉNERGIE COMBO (x${mult.toFixed(1)}, ${comboCount} justes) : augmente ton multiplicateur d'XP et de score à chaque bonne réponse consécutive !`);
    }
};

/**
 * Génère deux pastilles distinctes et sans ambiguïté :
 * - 🔥 Série (niveaux réussis d'affilée — couleur feu)
 * - ⚡ Énergie / Combo (multiplicateur d'XP & score — couleur électrique)
 */
function renderStreakAndComboPillsHtml(streakData, { compact = false } = {}) {
    const data = streakData || { count: 0, combo: 0 };
    const streakCount = data.count || 0;
    const comboCount = data.combo || 0;
    const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
    const streakHot = streakCount >= 2;
    const comboLit = comboCount >= 2 || multiplier > 1.0;

    return `<div class="dash-stats-pills ${compact ? 'is-compact' : ''}">
        <button type="button" class="dash-streak-pill ${streakHot ? 'is-hot' : ''}" onclick="window._showStatHelp('streak')" title="🔥 Série : ${streakCount} niveau${streakCount > 1 ? 'x' : ''} réussi${streakCount > 1 ? 's' : ''} d'affilée (clic pour info)" aria-label="Série de ${streakCount} victoires">
            <span class="dash-pill-icon" aria-hidden="true">🔥</span>
            <span class="dash-streak-count">${streakCount}</span>
            <span class="dash-pill-label">Série</span>
        </button>
        <button type="button" class="dash-combo-pill ${comboLit ? 'is-lit' : ''}" onclick="window._showStatHelp('combo')" title="⚡ Énergie Combo : ${comboCount} bonne${comboCount > 1 ? 's' : ''} réponse${comboCount > 1 ? 's' : ''} de suite → Multiplicateur x${multiplier.toFixed(1)} XP &amp; score" aria-label="Énergie Combo multiplicateur x${multiplier.toFixed(1)}">
            <span class="dash-pill-icon" aria-hidden="true">⚡</span>
            <span class="dash-combo-val">x${multiplier.toFixed(1)}</span>
            <span class="dash-pill-label">Combo</span>
        </button>
    </div>`;
}

/**
 * Barre de combo dans une modale de quiz :
 * ⚡ est TOUJOURS réservé à l'Énergie / Multiplicateur de Combo ;
 * 🔥 est TOUJOURS réservé au rappel de la Série de victoires.
 */
function renderQuizComboBarHtml(streakData) {
    const data = streakData || { count: 0, combo: 0 };
    const streakCount = data.count || 0;
    const comboCount = data.combo || 0;
    const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
    const tierName = (typeof window.comboTierName === 'function') ? window.comboTierName(comboCount) : '';
    const streakMini = streakCount > 0
        ? `<span class="dash-quiz-streak-mini" title="🔥 Série actuelle : ${streakCount} victoires d'affilée">🔥 ${streakCount}</span>`
        : '';

    return `<div class="dash-quiz-combo-bar ${comboCount >= 2 ? 'is-lit' : ''}">
        <div class="dash-combo-left">
            <span class="dash-combo-bolt" aria-hidden="true">⚡</span>
            <div>
                <div class="dash-combo-txt">Énergie Combo : <b>${comboCount}</b></div>
                <div class="dash-combo-subtitle">${escapeHtml(tierName)}</div>
            </div>
        </div>
        <div class="dash-combo-right">
            ${streakMini}
            <div class="dash-combo-mult-badge" title="Multiplicateur appliqué à l'XP et au score">⚡ <b>x${multiplier.toFixed(1)}</b></div>
        </div>
    </div>`;
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

/**
 * Génère le bandeau méta d'un quiz : étoiles maximales encore en jeu (anti-triche)
 * + indicateur du moteur adaptatif / fournisseur Multi-IA utilisé.
 */
function renderQuizMetaStripHtml(attempt) {
    if (!attempt) return '';
    // Nombre max d'étoiles si l'élève répond juste sur la tentative actuelle
    const nextAttemptNumber = attempt.answered ? attempt.attempts : (attempt.attempts + 1);
    const maxStars = (typeof GameRules !== 'undefined' && GameRules.starsFor)
        ? GameRules.starsFor(nextAttemptNumber, Boolean(attempt.usedShield))
        : 3;
    const penalized = maxStars < 3;
    const starsHtml = '⭐'.repeat(maxStars) + '☆'.repeat(3 - maxStars);
    const stakeLabel = penalized
        ? `${starsHtml} Max ${maxStars} étoile${maxStars > 1 ? 's' : ''}`
        : `${starsHtml} 3 étoiles en jeu`;

    const isAi = attempt.source === 'ai';
    const tierId = attempt.difficultyTier || (attempt.tierInfo && attempt.tierInfo.id) || 'standard';
    const tierIcon = (attempt.tierInfo && attempt.tierInfo.icon) || (tierId === 'remediation' ? '🌱' : tierId === 'approfondissement' ? '🚀' : '⚡');
    const sourceLabel = isAi
        ? `🤖 ${attempt.providerName || 'IA adaptative'}`
        : `${tierIcon} ${attempt.providerName || 'Adaptatif'}`;

    return `
        <span class="quiz-stars-stake ${penalized ? 'penalized' : ''}" title="${penalized ? 'Une erreur précédente sur ce niveau réduit le maximum d\'étoiles.' : 'Réponds juste du premier coup pour 3 étoiles !'}">${stakeLabel}</span>
        <span class="quiz-source-pill ${isAi ? 'is-ai' : ''} tier-${escapeHtml(tierId)}" title="Difficulté adaptative & anti-répétition">${escapeHtml(sourceLabel)}</span>
    `;
}

/** Retourne le catalogue boutique effectif (AdminStore + surcharges, sinon DASH_SKINS). */
function getShopCatalogSafe() {
    return (typeof AdminStore !== 'undefined' && typeof AdminStore.getShopItems === 'function')
        ? AdminStore.getShopItems()
        : DASH_SKINS;
}

/** Normalise un identifiant de skin en nom de classe CSS sûr (lettres, chiffres, tirets). */
function sanitizeSkinClassId(id) {
    const clean = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return clean || 'robot';
}

/** Lit la liste des articles possédés depuis DB sans jamais lever d'exception JSON. */
function getOwnedSkinsSafe() {
    try {
        const raw = (typeof DB !== 'undefined' && typeof DB.getOption === 'function')
            ? DB.getOption('dash_ownedSkins')
            : null;
        const parsed = JSON.parse(raw || '["aurore", "robot"]');
        if (Array.isArray(parsed)) return parsed;
    } catch { /* option corrompue -> repli par défaut */ }
    return ['aurore', 'robot'];
}

/** Indique si un article de boutique est débloqué (offert, défaut ou acheté). */
function isShopItemOwned(item, ownedList) {
    if (!item) return false;
    return item.id === 'default'
        || Number(item.cost) === 0
        || (Array.isArray(ownedList) && ownedList.includes(item.id));
}

/** Résout l'identifiant de l'avatar actuellement équipé (harmonisé Dashboard & Carte). */
function getEquippedAvatarId() {
    const savedAvatar = (typeof DB !== 'undefined' && typeof DB.getOption === 'function')
        ? DB.getOption('dash_equippedAvatar')
        : null;
    if (savedAvatar) return savedAvatar;
    const savedSkin = (typeof DB !== 'undefined' && typeof DB.getOption === 'function')
        ? DB.getOption('dash_equippedSkin')
        : null;
    if (savedSkin) {
        const item = getShopCatalogSafe().find(s => s.id === savedSkin);
        if (item && item.category === 'avatar') return item.id;
    }
    return 'robot';
}

/** Vérifie qu'une URL d'image d'avatar est sûre pour un attribut src. */
function isSafeAvatarImgSrc(src) {
    if (typeof src !== 'string') return false;
    const clean = src.trim();
    if (!clean) return false;
    if (/^(javascript|vbscript|data):/i.test(clean)) return false;
    return true;
}

function initMap() {
    const mapHeader = document.querySelector('.map-header');
    if (!mapHeader) return; // Pas sur la page map.html → on sort

    /** Vérifie si une chaîne correspond à un fichier image local ou sûr. */
    function isIconFile(icon) {
        if (typeof icon !== 'string') return false;
        const clean = icon.trim();
        return /\.(png|svg|webp|jpg|jpeg)$/i.test(clean)
            || clean.startsWith('Image/')
            || clean.startsWith('https://')
            || clean.startsWith('http://');
    }

    const MATIERE_TO_SUBJECT_ID = {
        'Mathématiques': 'maths',
        'Français': 'francais',
        'Histoire': 'histoire',
        'Géographie': 'geo',
        'SVT': 'svt',
        'Anglais': 'anglais',
        'Espagnol': 'espagnol',
        'Physique': 'physique',
        'Chimie': 'chimie',
        'Technologie': 'techno',
        'Arts & Musique': 'arts',
        'Arts': 'arts',
        'Philosophie': 'philo',
        'Philo': 'philo',
        'EMC': 'emc',
        'NSI & Numérique': 'nsi',
        'NSI': 'nsi',
        'SES (Économie)': 'ses',
        'SES': 'ses',
        'HGGSP (Géopolitique)': 'hggsp',
        'HGGSP': 'hggsp',
        "Sciences de l'Ingénieur": 'si',
        'SI': 'si',
        'Management & Gestion': 'msgn',
        'MSGN': 'msgn',
        'Droit & Économie': 'droit_eco',
        'Mercatique (Marketing)': 'mercatique',
        'Mercatique': 'mercatique',
        'I2D (Innovation & Éco)': 'i2d',
        'I2D': 'i2d',
        'SIN (Info & Numérique)': 'sin',
        'SIN': 'sin',
        'Cybersécurité': 'cybersecurite',
        'Réseaux & Systèmes': 'reseaux',
        'Électronique & Systèmes': 'electronique',
        'STSS (Santé & Social)': 'stss',
        'STSS': 'stss',
        'Biotechnologies & Labo': 'biotech',
        'Biotechnologies': 'biotech',
        'Design & Arts Appliqués': 'design',
        'Design': 'design',
        'Hôtellerie & Gastronomie': 'hotellerie',
        'Hôtellerie': 'hotellerie',
        'Agronomie & Écologie': 'agronomie',
        'Agronomie': 'agronomie',
        'Arts de la Scène & Culture': 'spectacle',
        'Spectacle': 'spectacle',
        'Humanités & Littérature (HLP)': 'hlp',
        'HLP': 'hlp',
        'Développement & BDD': 'dev_bdd',
        'Relation Client & Commerce': 'commerce',
        'Commerce': 'commerce',
        'Comptabilité & Finance': 'comptabilite',
        'Comptabilité': 'comptabilite',
        'Électrotechnique & Énergie': 'electrotech',
        'Électrotechnique': 'electrotech',
    };

    const urlParams = new URLSearchParams(window.location.search);
    let subject = urlParams.get('matiere');
    let icon    = urlParams.get('icon');

    const niveauActuel = currentNiveau();
    const filiereActuelle = currentFiliere();
    const niveauLabel = (typeof AdminStore !== 'undefined' && typeof AdminStore.levelLabel === 'function')
        ? AdminStore.levelLabel(niveauActuel)
        : niveauActuel;
    const isFiliereUsed = (typeof AdminStore !== 'undefined' && typeof AdminStore.isFiliereApplicable === 'function')
        ? AdminStore.isFiliereApplicable(niveauActuel)
        : false;
    const filiereObj = (isFiliereUsed && typeof AdminStore !== 'undefined' && typeof AdminStore.getFiliere === 'function')
        ? AdminStore.getFiliere(filiereActuelle)
        : null;

    // Affiche la classe (et la filière au lycée/BTS) en lecture seule dans l'en-tête
    const mapGradeBadge = document.getElementById('mapGradeBadge');
    if (mapGradeBadge) {
        mapGradeBadge.textContent = filiereObj
            ? `🎓 ${niveauLabel} · ${filiereObj.shortLabel || filiereObj.label}`
            : `🎓 ${niveauLabel}`;
    }

    /** Transition dynamique d'expulsion vers le tableau de bord si la matière est hors programme. */
    function triggerExpulsionToDashboard(reasonText) {
        const overlay = document.getElementById('mapExpelOverlay');
        const textEl = document.getElementById('mapExpelText');
        if (textEl && reasonText) textEl.textContent = reasonText;
        if (overlay) {
            overlay.hidden = false;
            requestAnimationFrame(() => overlay.classList.add('visible'));
            setTimeout(() => {
                window.location.replace('dashboard.html');
            }, 1250);
        } else {
            window.location.replace('dashboard.html');
        }
    }

    // Rafraîchit la liste des matières autorisées pour la classe et la filière courantes
    DASH_SUBJECTS = getEffectiveSubjects(niveauActuel, filiereActuelle);

    if (!subject) {
        const defaultSubject = (DASH_SUBJECTS && DASH_SUBJECTS[0]) ? DASH_SUBJECTS[0] : null;
        if (defaultSubject) {
            subject = defaultSubject.name;
            icon = icon || getSubjectIslandSrc(defaultSubject) || defaultSubject.icon || 'Image/ile/maths.webp';
        } else {
            subject = 'Mathématiques';
            icon = icon || 'Image/ile/maths.webp';
        }
    }

    // Recherche stricte dans les matières AUTORISÉES pour cette classe et cette filière
    const requestedId = MATIERE_TO_SUBJECT_ID[subject] || null;
    let carteSubject = DASH_SUBJECTS.find(s => (requestedId && s.id === requestedId) || s.name === subject);

    if (!carteSubject) {
        // Vérifie si la matière existe dans le catalogue complet mais est interdite pour la classe/filière actuelle
        const allRaw = (typeof AdminStore !== 'undefined' && typeof AdminStore.applyOverrides === 'function')
            ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS)
            : RAW_DASH_SUBJECTS;
        const matchedRaw = allRaw.find(s => (requestedId && s.id === requestedId) || s.name === subject);
        if (matchedRaw) {
            const allowed = (typeof AdminStore !== 'undefined' && typeof AdminStore.isSubjectAllowedForNiveau === 'function')
                ? AdminStore.isSubjectAllowedForNiveau(matchedRaw, niveauActuel, filiereActuelle)
                : false;
            if (!allowed) {
                const trackSuffix = filiereObj ? ` (${filiereObj.shortLabel || filiereObj.label})` : '';
                triggerExpulsionToDashboard(
                    `La matière « ${matchedRaw.name} » ne fait pas partie du programme de ${niveauLabel}${trackSuffix}. Retour dynamique vers le tableau de bord…`
                );
                return;
            }
            carteSubject = matchedRaw._custom
                ? matchedRaw
                : (typeof QuestionBank !== 'undefined' ? QuestionBank.extend(matchedRaw, 100, niveauActuel) : matchedRaw);
        }
    }

    // Surveillance dynamique : si la classe ou la filière change ailleurs (Options ou autre onglet),
    // on expulse proprement si la matière n'est plus autorisée (ou on actualise si autorisée).
    function verifyGradeConsistency() {
        const latestNiv = currentNiveau();
        const latestFil = currentFiliere();
        if (latestNiv === niveauActuel && latestFil === filiereActuelle) return;
        const allRaw = (typeof AdminStore !== 'undefined' && typeof AdminStore.applyOverrides === 'function')
            ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS)
            : RAW_DASH_SUBJECTS;
        const rawSub = carteSubject ? allRaw.find(s => s.id === carteSubject.id) : null;
        const stillAllowed = rawSub && (typeof AdminStore !== 'undefined' && typeof AdminStore.isSubjectAllowedForNiveau === 'function')
            ? AdminStore.isSubjectAllowedForNiveau(rawSub, latestNiv, latestFil)
            : false;
        if (!stillAllowed) {
            const newLbl = (typeof AdminStore !== 'undefined' && AdminStore.levelLabel) ? AdminStore.levelLabel(latestNiv) : latestNiv;
            triggerExpulsionToDashboard(
                `Ton parcours a changé (${newLbl}) : cette matière n'y est plus au programme. Retour au tableau de bord…`
            );
        } else {
            window.location.reload();
        }
    }
    window.addEventListener('pageshow', verifyGradeConsistency);
    window.addEventListener('storage', (e) => {
        if (e.key && (e.key === 'eduquest_niveau' || e.key.startsWith('eduquest_niveau_') || e.key === 'eduquest_filiere' || e.key.startsWith('eduquest_filiere_'))) {
            verifyGradeConsistency();
        }
    });

    // Préfère l'icône canonique de la matière (évite tout XSS via ?icon=)
    const canonicalIcon = carteSubject ? (getSubjectIslandSrc(carteSubject) || carteSubject.icon) : null;
    if (canonicalIcon) {
        icon = canonicalIcon;
    } else if (!icon || !isIconFile(icon)) {
        icon = 'Image/ile/maths.webp';
    }

    const TOTAL_LEVELS = carteSubject ? carteSubject.lessons.length : 6;

    /* --- Mise à jour des éléments visuels d'en-tête --- */
    const titleEl = document.querySelector('h1');
    const iconEl  = document.querySelector('.subject-icon');
    if (titleEl) titleEl.textContent = carteSubject ? carteSubject.name : subject;

    const resolveIslandUrl = (src) => {
        if (!src || typeof src !== 'string') return '';
        const clean = src.trim();
        // Refuse javascript: et schémas dangereux
        if (/^\s*javascript:/i.test(clean) || /^\s*data:text\/html/i.test(clean)) return 'Image/ile/maths.webp';
        if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/') || clean.startsWith('Image/')) {
            return clean;
        }
        return 'Image/ile/' + clean.replace(/[^a-zA-Z0-9._-]/g, '');
    };

    if (iconEl) {
        iconEl.textContent = '';
        if (isIconFile(icon)) {
            const img = document.createElement('img');
            img.src = resolveIslandUrl(icon);
            img.alt = carteSubject ? carteSubject.name : subject;
            img.className = 'matiere-icon';
            img.style.cssText = 'width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;';
            iconEl.appendChild(img);
        } else {
            iconEl.textContent = icon;
        }
    }

    const bgIslandEl = document.getElementById('subject-bg-island');
    if (bgIslandEl) {
        if (isIconFile(icon)) {
            bgIslandEl.src = resolveIslandUrl(icon);
        } else {
            bgIslandEl.remove();
        }
    }

    document.title = 'EDUQUEST - ' + (carteSubject ? carteSubject.name : subject);

    function renderMapHeaderStreak() {
        const headerRight = mapHeader.querySelector('div[style*="pointer-events: auto"]');
        if (!headerRight) return;
        let streakEl = document.getElementById('mapHeaderStreakPill');
        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };

        if (!streakEl) {
            streakEl = document.createElement('div');
            streakEl.id = 'mapHeaderStreakPill';
            streakEl.className = 'map-header-stats-slot';
            headerRight.insertBefore(streakEl, headerRight.firstChild);
        }
        streakEl.innerHTML = renderStreakAndComboPillsHtml(streakData, { compact: true });
    }
    renderMapHeaderStreak();

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

    let levelButtonsCache = [];

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

        // Chemin reliant tous les niveaux par des segments
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

        const equippedAvatar = getEquippedAvatarId();
        const safeSkin = sanitizeSkinClassId(equippedAvatar);

        trackEl.innerHTML = `
            <svg class="path" viewBox="0 0 100 ${trackHeight}" preserveAspectRatio="none" aria-hidden="true" style="width:100%; height:${trackHeight}px;">
                <path class="path-shadow" d="${pathD}"></path>
                <path class="path-ground" d="${pathD}"></path>
                <path class="path-light"  d="${pathD}"></path>
            </svg>
            <div id="character" class="character skin-${safeSkin}" data-skin="${safeSkin}" aria-label="Personnage">
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

        // Cache O(1) de tous les boutons de niveau pour un rendu ultra-rapide
        levelButtonsCache = [null]; // 1-indexé
        trackEl.querySelectorAll('.level-dot').forEach(btn => {
            const lvl = parseInt(btn.dataset.level, 10);
            levelButtonsCache[lvl] = {
                btn,
                starsDisplay: btn.querySelector('.level-stars-display')
            };
        });
    }
    buildLevelTrack();

    /* --- Sélecteur rapide de personnage sur la carte --- */
    function initMapSkinSelector() {
        const btn = document.getElementById('mapSkinBtn');
        const popover = document.getElementById('mapSkinPopover');
        const closeBtn = document.getElementById('mapSkinClose');
        const grid = document.getElementById('mapSkinGrid');

        function getMapAvatars() {
            const equippedId = getEquippedAvatarId();
            return getShopCatalogSafe().filter(item => {
                if ((item.category || 'aura') !== 'avatar') return false;
                if (item.disabled && item.id !== equippedId) return false;
                return true;
            });
        }

        function updateTriggerVisual(activeId) {
            if (!btn) return;
            const avatars = getMapAvatars();
            const current = avatars.find(a => a.id === activeId)
                || getShopCatalogSafe().find(a => a.id === activeId);
            const name = current ? current.name : 'Personnage';
            const color = (current && current.color) ? current.color : '#c8a84b';
            btn.style.setProperty('--skin-accent', color);
            btn.title = `Personnage : ${name} (cliquer pour changer)`;
            btn.setAttribute('aria-label', `Changer de personnage (actuel : ${name})`);
            if (current && isSafeAvatarImgSrc(current.img)) {
                btn.innerHTML = `<img src="${escapeHtml(current.img)}" alt="${escapeHtml(name)}">`;
            } else {
                btn.textContent = '👤';
            }
        }

        function applyMapCharacterSkin(skinId) {
            const activeId = skinId || getEquippedAvatarId();
            const safeSkin = sanitizeSkinClassId(activeId);
            const charEl = document.getElementById('character');
            if (charEl) {
                charEl.className = `character skin-${safeSkin}`;
                charEl.dataset.skin = safeSkin;
            }
            updateTriggerVisual(activeId);
        }

        function renderSkinGrid() {
            if (!grid) return;
            const ownedList = getOwnedSkinsSafe();
            const activeId = getEquippedAvatarId();
            const avatars = getMapAvatars();
            const unlocked = avatars.filter(a => isShopItemOwned(a, ownedList));
            const locked = avatars.filter(a => !isShopItemOwned(a, ownedList));
            const ordered = unlocked.concat(locked);

            grid.innerHTML = ordered.map(avatar => {
                const isUnlocked = isShopItemOwned(avatar, ownedList);
                const isActive = avatar.id === activeId;
                const imgHtml = isSafeAvatarImgSrc(avatar.img)
                    ? `<img src="${escapeHtml(avatar.img)}" alt="${escapeHtml(avatar.name)}">`
                    : `<span class="map-skin-fallback">👤</span>`;
                const badgeHtml = isActive
                    ? `<span class="map-skin-badge is-equipped">✓</span>`
                    : (!isUnlocked
                        ? `<span class="map-skin-badge is-locked">🔒 ${Number(avatar.cost) || 0}</span>`
                        : '');
                return `
                    <button type="button"
                        class="map-skin-item ${isActive ? 'is-active' : ''} ${isUnlocked ? '' : 'is-locked'}"
                        data-skin-id="${escapeHtml(avatar.id)}"
                        style="--skin-accent:${escapeHtml(avatar.color || '#c8a84b')}"
                        ${isUnlocked ? '' : 'disabled'}
                        title="${escapeHtml(avatar.name)}${isUnlocked ? '' : ` — À débloquer en boutique (${Number(avatar.cost) || 0} pièces)`}">
                        <span class="map-skin-thumb">${imgHtml}${badgeHtml}</span>
                        <span class="map-skin-name">${escapeHtml(avatar.name)}</span>
                    </button>`;
            }).join('');
        }

        function setPopoverOpen(open) {
            if (!popover || !btn) return;
            if (open) {
                renderSkinGrid();
                popover.hidden = false;
                btn.setAttribute('aria-expanded', 'true');
            } else {
                popover.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        }

        applyMapCharacterSkin();

        if (btn && popover) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setPopoverOpen(popover.hidden);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                setPopoverOpen(false);
                if (btn) btn.focus();
            });
        }
        if (grid) {
            grid.addEventListener('click', (e) => {
                const itemBtn = e.target.closest('.map-skin-item');
                if (!itemBtn || itemBtn.disabled) return;
                const id = itemBtn.dataset.skinId;
                const targetAvatar = getMapAvatars().find(a => a.id === id);
                if (!targetAvatar || !isShopItemOwned(targetAvatar, getOwnedSkinsSafe())) return;
                saveOption('dash_equippedAvatar', targetAvatar.id);
                applyMapCharacterSkin(targetAvatar.id);
                if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
                    AudioManager.playSfx('click');
                }
                setPopoverOpen(false);
            });
        }

        document.addEventListener('click', (e) => {
            if (!popover || popover.hidden) return;
            if (!popover.contains(e.target) && (!btn || !btn.contains(e.target))) {
                setPopoverOpen(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popover && !popover.hidden) {
                setPopoverOpen(false);
                if (btn) btn.focus();
            }
        });

        window.addEventListener('pageshow', () => {
            applyMapCharacterSkin();
            if (popover && !popover.hidden) renderSkinGrid();
        });
        window.addEventListener('storage', (e) => {
            if (e.key && (e.key === 'eduquest_options' || e.key.startsWith('eduquest_opts_'))) {
                applyMapCharacterSkin();
                if (popover && !popover.hidden) renderSkinGrid();
            }
        });
    }
    initMapSkinSelector();

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
     * Optimisé avec levelButtonsCache (évite 100 querySelector à chaque appel).
     *
     * @param {object} progress - Objet progression complet
     */
    function renderLevels(progress) {
        const currentLevel = findCurrentLevel(progress); // Trouve le niveau courant

        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            const entry = levelButtonsCache[i];
            if (!entry || !entry.btn) continue;
            const { btn, starsDisplay } = entry;
            const data = progress.levels[i];

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
        // Défile jusqu'au niveau courant avec stabilisation rAF
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => scrollToLevel(findCurrentLevel(progress), false));
            });
        } else {
            scrollToLevel(findCurrentLevel(progress), false);
        }
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
    let currentAttempt = null;
    const modal = document.getElementById('level-modal');
    const quizZone = document.getElementById('modal-quiz-zone');
    const starsZone = document.getElementById('modal-stars-zone');
    const effectiveSubjectId = carteSubject ? carteSubject.id : (MATIERE_TO_SUBJECT_ID[subject] || subject);

    // Contrôleur de chronomètre dédié à map.html (fonctionne sur TOUS les exercices & réessais)
    const mapTimer = (typeof QuizTimer !== 'undefined')
        ? QuizTimer.create({
            containerId: 'map-chrono-bar-container',
            onExpire: () => _mapSubmitQuiz(GameRules.TIMEOUT_ANSWER),
        })
        : null;

    function stopMapTimer() {
        if (mapTimer) mapTimer.stop();
    }

    function getMapRemainingTime() {
        return mapTimer ? mapTimer.getRemaining() : 0;
    }

    window.addEventListener('pagehide', stopMapTimer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hidden) {
            stopMapTimer();
            modal.hidden = true;
            positionCharacter(findCurrentLevel(progress), true);
        }
    });

    function starsFromAttempts(attempts, usedShield = false) {
        return GameRules.starsFor(attempts, usedShield);
    }

    /**
     * Débloque le niveau suivant et sauvegarde, commun aux deux modes.
     */
    function unlockNextAndSave(starsEarned, attempt = null) {
        stopMapTimer();
        const isFirstSuccess = progress.levels[currentModalLevel].stars === 0 && starsEarned > 0;
        if (starsEarned > progress.levels[currentModalLevel].stars) {
            progress.levels[currentModalLevel].stars = starsEarned;
        }
        if (currentModalLevel + 1 <= TOTAL_LEVELS) {
            progress.levels[currentModalLevel + 1].unlocked = true;
        }

        // Réussite validée → on efface le compteur anti-triche d'erreurs de ce niveau
        if (typeof DB !== 'undefined' && typeof DB.clearLevelAttempt === 'function') {
            DB.clearLevelAttempt(effectiveSubjectId, niveauActuel, currentModalLevel - 1);
        }

        const streakRes = (typeof DB !== 'undefined' && DB.recordLevelVictory) ? DB.recordLevelVictory() : { streak: 1, combo: 0, multiplier: 1.0 };
        const mult = (streakRes && streakRes.multiplier) || ((typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier() : 1.0);
        renderMapHeaderStreak();

        let xpGained = 0;
        let coinsGained = 0;
        let scoreGained = 0;
        let usedDoubleXp = false;
        let usedDoubleCoins = false;

        if (isFirstSuccess) {
            const rewards = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                ? AdminStore.getRewardsConfig()
                : GameRules.DEFAULT_REWARDS;
            const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
                ? AdminStore.getSiteConfig()
                : null;

            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(GameRules.DOUBLE_XP_ID)) {
                usedDoubleXp = DB.useBooster(GameRules.DOUBLE_XP_ID);
                if (usedDoubleXp && typeof showNotification === 'function') {
                    showNotification('🧪 Potion Double XP consommée : XP doublée !', 'success');
                }
            }

            const doubleCoinsId = GameRules.DOUBLE_COINS_ID || 'boost-coins';
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(doubleCoinsId)) {
                usedDoubleCoins = DB.useBooster(doubleCoinsId);
                if (usedDoubleCoins && typeof showNotification === 'function') {
                    showNotification('🪙 Élixir de Fortune consommé : pièces doublées !', 'success');
                }
            }

            const gains = GameRules.computeLevelRewards({
                stars: starsEarned,
                multiplier: mult,
                chronoEnabled: (typeof QuizTimer !== 'undefined') ? QuizTimer.isEnabled() : (getOption('modeChrono') === 'true'),
                timeRemaining: getMapRemainingTime(),
                chronoDuration: (attempt && attempt.chronoDuration) || ((typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45),
                doubleXp: usedDoubleXp,
                doubleCoins: usedDoubleCoins,
                rewards,
                siteXpMultiplier: siteCfg ? siteCfg.xpMultiplier : 1,
                siteCoinMultiplier: siteCfg ? siteCfg.coinMultiplier : 1,
            });
            xpGained = gains.xp;
            coinsGained = gains.coins;
            scoreGained = gains.score;
            const currentScore = parseInt(getOption('dash_total_score') || '0', 10);
            saveOption('dash_total_score', String(currentScore + scoreGained));

            const currentXp = parseInt(getOption('dash_xp') || '0', 10);
            const currentCoins = parseInt(getOption('dash_coins') || '30', 10);
            saveOption('dash_xp', String(currentXp + xpGained));
            saveOption('dash_coins', String(currentCoins + coinsGained));
        }

        saveProgress(progress);
        renderLevels(progress);

        if (starsEarned > 0) {
            Celebrate.confetti();
            if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
                AudioManager.playSfx('victory');
            }
            DailyQuests.track(GameRules.questDelta({
                stars: starsEarned,
                attempts: attempt ? attempt.attempts : 0,
                xp: xpGained,
            }));
            const usedShield = Boolean(attempt && attempt.usedShield);
            if (typeof window.checkBadges === 'function') {
                window.checkBadges({
                    justCompletedLevel: true,
                    starsEarned: starsEarned,
                    justAnsweredFirstTry: starsEarned === 3,
                    subjectId: effectiveSubjectId,
                    usedDoubleXp: usedDoubleXp,
                    usedDoubleCoins: usedDoubleCoins,
                    usedShield: usedShield,
                    usedBooster: usedDoubleXp ? 'boost-xp' : (usedDoubleCoins ? 'boost-coins' : (usedShield ? 'boost-shield' : null)),
                    boosterId: usedDoubleXp ? 'boost-xp' : (usedDoubleCoins ? 'boost-coins' : (usedShield ? 'boost-shield' : null)),
                    streakCount: streakRes.streak,
                    comboCount: streakRes.combo,
                    maxCombo: streakRes.maxCombo,
                });
            }
        }
        return { isFirstSuccess, xpGained, coinsGained, scoreGained, multiplier: mult, streak: streakRes.streak };
    }

    /** Charge une nouvelle question via AiProvider (Multi-IA + AdaptiveEngine local). */
    async function loadQuestionForAttempt(attempt, levelNumber, { excludeProviderId = null } = {}) {
        const idx = levelNumber - 1;
        const duration = (typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45;
        attempt.chronoDuration = duration;
        try {
            const fetched = await AiProvider.fetchQuestion(effectiveSubjectId, idx, niveauActuel, {
                variant: attempt.variant,
                salt: attempt.salt,
                subject: carteSubject,
                subjectName: carteSubject ? carteSubject.name : subject,
                localLesson: (attempt.salt === 0 && carteSubject && carteSubject.lessons[idx]) ? carteSubject.lessons[idx] : null,
                excludeSignatures: attempt.failedSignatures || [],
                excludeProviderId,
            });
            if (currentAttempt !== attempt || currentModalLevel !== levelNumber || modal.hidden) return;
            attempt.lesson = fetched.lesson;
            attempt.questionId = fetched.questionId || null;
            attempt.source = fetched.source || 'local';
            attempt.providerId = fetched.providerId || null;
            attempt.providerName = fetched.providerName || '';
            attempt.difficultyTier = fetched.difficultyTier || 'standard';
            attempt.tierInfo = fetched.tierInfo || null;
            attempt.signature = fetched.signature || (typeof QuestionBank !== 'undefined' && QuestionBank.questionSignature ? QuestionBank.questionSignature(fetched.lesson) : '');
            attempt.checking = false;
            renderModalQuiz();
        } catch (err) {
            console.warn('[map] Récupération de question échouée, repli local.', err);
            if (currentAttempt !== attempt || currentModalLevel !== levelNumber || modal.hidden) return;
            const fallback = (typeof AdaptiveEngine !== 'undefined' && AdaptiveEngine.pickLocalQuestion)
                ? AdaptiveEngine.pickLocalQuestion({
                    subject: carteSubject,
                    subjectId: effectiveSubjectId,
                    levelIndex: idx,
                    niveau: niveauActuel,
                    salt: attempt.salt,
                    excludeSignatures: attempt.failedSignatures || [],
                })
                : { lesson: carteSubject.lessons[idx], signature: '', source: 'local', providerName: 'Banque locale', difficultyTier: 'standard' };
            attempt.lesson = fallback.lesson;
            attempt.questionId = null;
            attempt.source = 'local';
            attempt.providerName = fallback.providerName || 'Banque locale';
            attempt.difficultyTier = fallback.difficultyTier || 'standard';
            attempt.tierInfo = fallback.tierInfo || null;
            attempt.signature = fallback.signature || '';
            attempt.checking = false;
            renderModalQuiz();
        }
    }

    /** Rendu de la question courante dans #modal-quiz-zone (mode quiz réel). */
    function renderModalQuiz() {
        const { submitted, answered, isCorrect, checking, lesson } = currentAttempt;
        const metaEl     = document.getElementById('modal-quiz-meta');
        const questionEl = document.getElementById('modal-quiz-question');
        const body       = document.getElementById('modal-quiz-body');
        const feedbackEl = document.getElementById('modal-quiz-feedback');
        const actionsEl  = document.getElementById('modal-quiz-actions');

        const chronoEnabled = (typeof QuizTimer !== 'undefined') ? QuizTimer.isEnabled() : (getOption('modeChrono') === 'true');
        const chronoDuration = (typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45;
        let chronoBarEl = document.getElementById('map-chrono-bar-container');

        /* --- État « génération en cours » --- */
        if (checking === 'loading' || !lesson) {
            stopMapTimer();
            if (chronoBarEl) chronoBarEl.remove();
            const oldComboBar = document.getElementById('map-combo-bar-container');
            if (oldComboBar) oldComboBar.remove();
            if (metaEl) metaEl.innerHTML = '';
            delete body.dataset.renderedLessonKey;
            questionEl.textContent = 'Génération de la question…';
            body.innerHTML = `<div class="dash-feedback">⏳ Préparation d'une question adaptée pour le niveau ${currentModalLevel}…</div>`;
            feedbackEl.innerHTML = '';
            actionsEl.innerHTML = `<button class="dash-btn-ghost" id="modal-quiz-cancel">Annuler</button>`;
            document.getElementById('modal-quiz-cancel').addEventListener('click', () => {
                stopMapTimer();
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            return;
        }

        // Bandeau méta : étoiles max en jeu (anti-triche) + palier adaptatif / IA
        if (metaEl) {
            metaEl.innerHTML = renderQuizMetaStripHtml(currentAttempt);
        }

        // Barre visuelle d'Énergie Combo (⚡) et rappel Série (🔥)
        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;

        let comboBarEl = document.getElementById('map-combo-bar-container');
        if (!comboBarEl) {
            comboBarEl = document.createElement('div');
            comboBarEl.id = 'map-combo-bar-container';
            questionEl.parentNode.insertBefore(comboBarEl, questionEl);
        }
        comboBarEl.innerHTML = renderQuizComboBarHtml(streakData);

        // Barre de chronomètre unifiée (créée / mise à jour proprement à chaque exercice)
        if (chronoEnabled && !answered && !checking) {
            if (!chronoBarEl && typeof QuizTimer !== 'undefined') {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = QuizTimer.renderBarHtml('map-chrono-bar-container', chronoDuration).trim();
                chronoBarEl = wrapper.firstElementChild;
                questionEl.parentNode.insertBefore(chronoBarEl, comboBarEl);
            }
        } else if (chronoBarEl) {
            chronoBarEl.remove();
        }

        const lessonKey = [currentModalLevel, currentAttempt.salt, currentAttempt.variant, currentAttempt.signature || lesson.q].join('::');
        const needsRender = (body.dataset.renderedLessonKey !== lessonKey);

        if (needsRender) {
            questionEl.textContent = lesson.q;
            body.innerHTML = QuizEngine.renderBody(lesson);
            body.dataset.renderedLessonKey = lessonKey;
        }

        const hintSlot = document.getElementById('modal-quiz-hint-slot');
        const hintText = getLessonHint(lesson, effectiveSubjectId);

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
                stopMapTimer();
                modal.hidden = true;
                positionCharacter(findCurrentLevel(progress), true);
            });
            if (needsRender) {
                QuizEngine.bind(body, lesson, currentAttempt, _mapSubmitQuiz);
                // Démarre un chronomètre neuf pour CHAQUE exercice et CHAQUE réessai !
                if (chronoEnabled && mapTimer) {
                    let effectiveDuration = chronoDuration;
                    const extraTimeId = (typeof GameRules !== 'undefined' && GameRules.EXTRA_TIME_ID) ? GameRules.EXTRA_TIME_ID : 'boost-time';
                    const extraSec = (typeof GameRules !== 'undefined' && GameRules.EXTRA_TIME_BONUS_S) ? GameRules.EXTRA_TIME_BONUS_S : 15;
                    if (!currentAttempt.usedExtraTime && typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(extraTimeId) && DB.useBooster(extraTimeId)) {
                        currentAttempt.usedExtraTime = true;
                        effectiveDuration += extraSec;
                        currentAttempt.chronoDuration = effectiveDuration;
                        showNotification(`⏳ Sablier Temporel consommé : +${extraSec}s ajoutées au chrono !`, 'info');
                    }
                    mapTimer.start(effectiveDuration);
                }
            }
        } else if (checking) {
            if (hintSlot) hintSlot.innerHTML = '';
            stopMapTimer();
            QuizEngine.freeze(body, lesson, submitted);
            feedbackEl.innerHTML = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
            actionsEl.innerHTML = '';
        } else {
            if (hintSlot) hintSlot.innerHTML = '';
            stopMapTimer();
            QuizEngine.reveal(body, lesson, submitted);
            const multTag = multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier.toFixed(1)}</span> ` : '';
            const expText = currentAttempt.explanation || (lesson ? lesson.exp : '') || '';
            feedbackEl.innerHTML = `
                <div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">
                    <div class="dash-feedback-badge">${isCorrect ? '✓ Bonne réponse ! ' + multTag : '✗ Pas tout à fait... (une nouvelle question te sera proposée)'}</div>
                    ${expText ? `
                        <div class="dash-feedback-exp">
                            <div class="dash-feedback-exp-title">📖 Explication &amp; Règle de cours :</div>
                            <div class="dash-feedback-exp-content">${escapeHtml(expText)}</div>
                        </div>
                    ` : ''}
                </div>`;

            if (isCorrect) {
                const starsNow = starsFromAttempts(currentAttempt.attempts, currentAttempt.usedShield);
                actionsEl.innerHTML = `<button class="dash-btn-primary" id="modal-quiz-continue">Continuer (${'⭐'.repeat(starsNow)})</button>`;
                document.getElementById('modal-quiz-continue').addEventListener('click', () => {
                    const res = unlockNextAndSave(starsNow, currentAttempt);
                    modal.hidden = true;
                    showNotification(`✓ Niveau réussi — ${'⭐'.repeat(starsNow)}${res.isFirstSuccess ? ` (+${res.xpGained} XP ${res.multiplier > 1.0 ? `[x${res.multiplier}] ` : ''}, +${res.coinsGained} pièces, +${res.scoreGained} pts)` : ''}`);
                }, { once: true });
            } else {
                actionsEl.innerHTML = `
                    <button class="dash-btn-ghost" id="modal-quiz-quit">Quitter</button>
                    <button class="dash-btn-primary" id="modal-quiz-retry">🔄 Réessayer (nouvelle question)</button>`;
                document.getElementById('modal-quiz-quit').addEventListener('click', () => {
                    stopMapTimer();
                    modal.hidden = true;
                    positionCharacter(findCurrentLevel(progress), true);
                });
                document.getElementById('modal-quiz-retry').addEventListener('click', async () => {
                    stopMapTimer();
                    delete body.dataset.renderedLessonKey;
                    const prevProviderId = currentAttempt.providerId;
                    const nextVariant = QuizSession.nextVariant(currentAttempt.variant);
                    QuizSession.resetForRetry(currentAttempt, nextVariant);
                    renderModalQuiz();
                    await loadQuestionForAttempt(currentAttempt, currentModalLevel, { excludeProviderId: prevProviderId });
                });
            }
        }
    }

    async function _mapSubmitQuiz(rawAnswer) {
        stopMapTimer();
        const attempt = currentAttempt;
        if (!attempt) return;
        const res = await QuizSession.submit(attempt, rawAnswer, {
            render: renderModalQuiz,
            isStale: () => currentAttempt !== attempt || modal.hidden,
            subjectId: effectiveSubjectId,
            niveau: niveauActuel,
            levelIndex: currentModalLevel - 1,
            chronoDuration: attempt.chronoDuration || (typeof QuizTimer !== 'undefined' ? QuizTimer.getConfiguredDuration() : 45),
        });
        if (res) renderMapHeaderStreak();
    }

    document.querySelectorAll('.level-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('locked')) return;
            currentModalLevel = parseInt(btn.dataset.level, 10);
            positionCharacter(currentModalLevel, true);

            const skinPop = document.getElementById('mapSkinPopover');
            if (skinPop && !skinPop.hidden) {
                skinPop.hidden = true;
                const skinTrigger = document.getElementById('mapSkinBtn');
                if (skinTrigger) skinTrigger.setAttribute('aria-expanded', 'false');
            }

            if (!modal) return;
            document.getElementById('modal-title').textContent = 'Niveau ' + currentModalLevel;
            stopMapTimer();

            if (carteSubject && carteSubject.lessons[currentModalLevel - 1]) {
                const mapBody = document.getElementById('modal-quiz-body');
                if (mapBody) delete mapBody.dataset.renderedLessonKey;
                quizZone.hidden = false;
                starsZone.hidden = true;

                // Recharge l'historique anti-triche persisté pour ce niveau !
                // Si l'élève a déjà fait une erreur puis quitté/rechargé la page :
                //  - attempts démarre au nombre d'échecs persistés (max 2 étoiles, jamais 3 !)
                //  - salt > 0 + failedSignatures → question réinitialisée vers une nouvelle question !
                const persisted = (typeof DB !== 'undefined' && typeof DB.getLevelAttempt === 'function')
                    ? DB.getLevelAttempt(effectiveSubjectId, niveauActuel, currentModalLevel - 1)
                    : { fails: 0, usedShield: false, questionSalt: 0, failedSignatures: [] };

                const requestedLevel = currentModalLevel;
                const initialVariant = persisted.questionSalt > 0
                    ? (persisted.questionSalt % 3)
                    : Math.floor(Math.random() * 3);

                currentAttempt = QuizSession.createAttempt({
                    attempts: persisted.fails || 0,
                    usedShield: Boolean(persisted.usedShield),
                    variant: initialVariant,
                    salt: persisted.questionSalt || 0,
                    failedSignatures: Array.isArray(persisted.failedSignatures) ? persisted.failedSignatures.slice() : [],
                    checking: 'loading',
                    chronoDuration: (typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45,
                });
                const attempt = currentAttempt;
                modal.hidden = false;
                renderModalQuiz();
                loadQuestionForAttempt(attempt, requestedLevel);
            } else {
                quizZone.hidden = true;
                starsZone.hidden = false;
                modal.hidden = false;
            }
        });
    });

    document.querySelectorAll('.star-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentModalLevel) return;
            const stars = parseInt(btn.dataset.stars, 10);
            const res = unlockNextAndSave(stars);
            modal.hidden = true;
            if (res.isFirstSuccess) {
                showNotification(`✓ Progression sauvegardée (+${res.xpGained} XP, +${res.coinsGained} pièces)`);
            }
        });
    });

    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        stopMapTimer();
        modal.hidden = true;
        positionCharacter(findCurrentLevel(progress), true);
    });

    const resetBtn = document.getElementById('reset-progress');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        stopMapTimer();
        if (typeof DB !== 'undefined' && typeof DB.clearSubjectAttempts === 'function') {
            DB.clearSubjectAttempts(effectiveSubjectId, niveauActuel);
        }
        progress = getDefaultProgress();
        saveProgress(progress);
        modal.hidden = true;
        renderLevels(progress);
    });

    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            stopMapTimer();
            if (window.history.length > 1 && document.referrer && document.referrer.includes('dashboard.html')) {
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
    { id: 'aurore',   name: 'Aurore Boréale',   category: 'aura', color: '#4fd8c4', cost: 0 },
    { id: 'or',       name: 'Comète Dorée',     category: 'aura', color: '#c8a84b', cost: 60 },
    { id: 'ametiste', name: 'Nova Améthyste',   category: 'aura', color: '#b685f5', cost: 90 },
    { id: 'rose',     name: 'Étoile Rose',      category: 'aura', color: '#f58fc2', cost: 130 },
    { id: 'braise',   name: 'Braise Cosmique',  category: 'aura', color: '#f5714f', cost: 170 },
    { id: 'neon',     name: 'Éclair Néon',      category: 'aura', color: '#00ffcc', cost: 250 },
    { id: 'magma',    name: 'Flamboiement Magma', category: 'aura', color: '#ff3300', cost: 300 },
    // Skins "personnage" — portraits dans la Boutique + habillage CSS sur la carte.
    { id: 'robot',             name: 'Robot Assistant',    category: 'avatar', color: '#8fb8c9', img: 'Image/personnages/robot.webp',             cost: 0 },
    { id: 'david-martinez',    name: 'David Martinez',     category: 'avatar', color: '#ffea00', img: 'Image/personnages/david-martinez.svg',     cost: 0 },
    { id: 'fall-guys',         name: 'Champion Fall Guys', category: 'avatar', color: '#ff3e9d', img: 'Image/personnages/fall-guys.svg',          cost: 150 },
    { id: 'hope-fortnite',     name: 'Hope (Fortnite)',    category: 'avatar', color: '#2563eb', img: 'Image/personnages/hope-fortnite.svg',      cost: 200 },
    { id: 'kasane-teto',       name: 'Kasane Teto',        category: 'avatar', color: '#e11d48', img: 'Image/personnages/kasane-teto.svg',        cost: 250 },
    { id: 'helldiver',         name: 'Helldiver',          category: 'avatar', color: '#ffd60a', img: 'Image/personnages/helldiver.svg',          cost: 300 },
    { id: 'space-marine',      name: 'Space Marine',       category: 'avatar', color: '#1d4ed8', img: 'Image/personnages/space-marine.svg',       cost: 350 },
    { id: 'doom-guy',          name: 'Doom Slayer',        category: 'avatar', color: '#4f772d', img: 'Image/personnages/doom-guy.svg',           cost: 400 },
    { id: 'einstein',          name: 'Albert Einstein',    category: 'avatar', color: '#7fb3d5', img: 'Image/personnages/einstein.webp',          cost: 150 },
    { id: 'marie-curie',       name: 'Marie Curie',        category: 'avatar', color: '#6bca82', img: 'Image/personnages/marie-curie.webp',       cost: 150 },
    { id: 'christophe-colomb', name: 'Christophe Colomb',  category: 'avatar', color: '#c8a84b', img: 'Image/personnages/christophe-colomb.webp', cost: 200 },
    { id: 'lovelace',          name: 'Ada Lovelace',       category: 'avatar', color: '#ff66b2', img: 'Image/personnages/lovelace.webp',          cost: 250 },
    { id: 'pythagore',         name: 'Pythagore',          category: 'avatar', color: '#ffd166', img: 'Image/personnages/pythagore.webp',         cost: 300 },
    { id: 'davinci',           name: 'Léonard de Vinci',   category: 'avatar', color: '#a8dadc', img: 'Image/personnages/davinci.webp',           cost: 350 },
    { id: 'hugo',              name: 'Victor Hugo',        category: 'avatar', color: '#457b9d', img: 'Image/personnages/hugo.webp',              cost: 350 },
    { id: 'astronaute',        name: 'Astronaute Céleste',  category: 'avatar', color: '#f1faee', img: 'Image/personnages/astronaute.webp',        cost: 400 },
    { id: 'mage',              name: 'Archimage du Savoir', category: 'avatar', color: '#9d4edd', img: 'Image/personnages/mage.webp',              cost: 500 },
    { id: 'nikola-tesla',      name: 'Nikola Tesla',        category: 'avatar', color: '#38bdf8', img: 'Image/personnages/nikola-tesla.svg',       cost: 220 },
    { id: 'pasteur',           name: 'Louis Pasteur',       category: 'avatar', color: '#4ade80', img: 'Image/personnages/pasteur.svg',            cost: 220 },
    { id: 'rosalind-franklin', name: 'Rosalind Franklin',   category: 'avatar', color: '#34d399', img: 'Image/personnages/rosalind-franklin.svg',  cost: 240 },
    { id: 'galilee',           name: 'Galilée',             category: 'avatar', color: '#60a5fa', img: 'Image/personnages/galilee.svg',            cost: 240 },
    { id: 'alan-turing',       name: 'Alan Turing',         category: 'avatar', color: '#22d3ee', img: 'Image/personnages/alan-turing.svg',        cost: 260 },
    { id: 'hypatie',           name: 'Hypatie d\'Alexandrie',category: 'avatar', color: '#c084fc', img: 'Image/personnages/hypatie.svg',           cost: 260 },
    { id: 'cleopatre',         name: 'Cléopâtre VII',       category: 'avatar', color: '#fbbf24', img: 'Image/personnages/cleopatre.svg',          cost: 280 },
    { id: 'samourai-cyber',    name: 'Ronin Cyber',         category: 'avatar', color: '#f43f5e', img: 'Image/personnages/samourai-cyber.svg',     cost: 360 },
    { id: 'alchimiste-etoile', name: 'Alchimiste Stellaire',category: 'avatar', color: '#a855f7', img: 'Image/personnages/alchimiste-etoile.svg',  cost: 420 },
    { id: 'chevalier-astral',  name: 'Chevalier Astral',    category: 'avatar', color: '#facc15', img: 'Image/personnages/chevalier-astral.svg',   cost: 550 },
];

const RAW_DASH_SUBJECTS = [
    { id: "maths", name: "Mathématiques", icon: "∑", island: "Image/ile/maths.webp", lessons: [
        { title: "Les fractions", q: "Combien font 1/2 + 1/4 ?", opts: ["3/6", "1/6", "3/4", "2/6"], correct: 2, exp: "Au même dénominateur (4) : 2/4 + 1/4 = 3/4." },
        { title: "Le théorème de Pythagore", q: "Dans un triangle rectangle de côtés 3 et 4, quelle est la longueur de l'hypoténuse ?", opts: ["4,5", "7", "6", "5"], correct: 3, exp: "√(3² + 4²) = √25 = 5." },
        { title: "Équations du 1er degré", q: "Résous 2x + 3 = 11. Que vaut x ?", opts: ["3", "5,5", "7", "4"], correct: 3, exp: "2x = 8, donc x = 4." },
        { title: "Les probabilités", q: "On lance un dé à 6 faces. Quelle est la probabilité d'obtenir un nombre pair ?", opts: ["1/2", "1/3", "2/3", "1/6"], correct: 0, exp: "3 issues favorables (2,4,6) sur 6 : 3/6 = 1/2." },
        { type: "drag_and_drop", title: "Calcul mental", q: "Associe chaque opération à son résultat.", items: ["7 × 8", "144 ÷ 12", "9²", "√81"], targets: ["56", "12", "81", "9"], pairs: { "7 × 8": "56", "144 ÷ 12": "12", "9²": "81", "√81": "9" }, exp: "7 × 8 = 56, 144 ÷ 12 = 12, 9² = 81, √81 = 9." },
    ]},
    { id: "francais", name: "Français", icon: "Aa", island: "Image/ile/francais.webp", lessons: [
        { title: "Les classes grammaticales", q: "Dans « Le chat noir dort », quel mot est un adjectif ?", opts: ["noir", "le", "chat", "dort"], correct: 0, exp: "« Noir » qualifie le nom « chat »." },
        { title: "Le conditionnel", q: "Quelle est la terminaison du conditionnel présent à la 1ère personne du singulier pour « aimer » ?", opts: ["aimerais", "aimais", "aimerai", "aime"], correct: 0, exp: "Radical du futur + terminaisons de l'imparfait : j'aimerais." },
        { title: "Les figures de style", q: "« Il pleut des cordes » est une :", opts: ["comparaison", "anaphore", "métaphore", "litote"], correct: 2, exp: "L'image remplace directement la réalité, sans outil de comparaison : c'est une métaphore." },
        { type: "texte_a_choix", title: "L'argumentation", q: "Complète la phrase avec les connecteurs logiques appropriés.", textWithBlanks: "Il pleuvait des cordes, ___ nous sommes sortis ___ nous avions promis d'aider Marc.", choices: [["mais", "donc", "ainsi", "alors"], ["car", "pourtant", "cependant", "en effet"]], blanks: [["mais"], ["car"]], exp: "« Mais » marque l'opposition et « car » introduit la cause." },
        { type: "texte_a_trous", title: "Accord du participe passé", q: "Complète la règle.", textWithBlanks: "Avec l'auxiliaire être, le participe passé s'accorde avec le ___ ; avec avoir, il ne s'accorde en général pas avec le ___.", blanks: [["sujet"], ["sujet"]], distractors: ["verbe", "complément", "adjectif"], exp: "Être → accord avec le sujet ; avoir → pas d'accord avec le sujet (sauf COD placé avant, hors programme ici)." },
    ]},
    { id: "physique", name: "Physique", icon: "⚛", island: "Image/ile/physique.webp", lessons: [
        { title: "Les états de la matière", q: "Comment appelle-t-on le passage direct de l'état solide à l'état gazeux ?", opts: ["condensation", "fusion", "évaporation", "sublimation"], correct: 3, exp: "La sublimation évite l'étape liquide." },
        { title: "La tension électrique", q: "Quelle unité mesure la tension électrique ?", opts: ["le volt", "l'ohm", "le watt", "l'ampère"], correct: 0, exp: "Le volt (V) mesure la tension." },
        { title: "Les atomes", q: "Combien de protons possède un atome d'hydrogène ?", opts: ["0", "2", "1", "8"], correct: 2, exp: "L'hydrogène a le numéro atomique 1." },
        { title: "Les mélanges", q: "L'eau salée est un exemple de :", opts: ["mélange homogène", "solide", "corps pur", "mélange hétérogène"], correct: 0, exp: "Le sel est totalement dissous : on ne distingue plus les constituants." },
        { type: "vrai_faux", title: "La lumière", q: "La lumière se déplace plus vite dans l'eau que dans le vide.", correct: false, exp: "Faux : la lumière est plus rapide dans le vide (≈300 000 km/s) que dans l'eau, où elle ralentit." },
    ]},
    { id: "chimie", name: "Chimie", icon: "🧪", island: "Image/ile/chimie.svg", lessons: [
        { title: "Les états de l'eau", q: "Comment appelle-t-on le passage direct de l'état solide à l'état gazeux ?", opts: ["la sublimation", "la fusion", "la condensation", "la liquéfaction"], correct: 0, exp: "La sublimation transforme la glace directement en vapeur, sans passer par l'état liquide." },
        { title: "Les atomes", q: "Que représente le numéro atomique Z d'un élément ?", opts: ["le nombre de protons du noyau", "le nombre de neutrons", "la masse totale de l'atome", "le nombre d'électrons perdus"], correct: 0, exp: "Z compte les protons : c'est lui qui définit l'élément chimique." },
        { type: "vrai_faux", title: "Les acides", q: "Une solution acide a un pH inférieur à 7.", correct: true, exp: "Vrai : à 25 °C, pH < 7 = acide, pH = 7 = neutre, pH > 7 = basique." },
        { type: "texte_a_choix", title: "La neutralisation", q: "Complète le bilan de la réaction.", textWithBlanks: "La réaction entre un acide et une base produit un ___ et de l'___.", choices: [["sel", "gaz", "métal", "précipité"], ["eau", "alcool", "huile", "air"]], blanks: [["sel"], ["eau"]], exp: "Acide + Base → Sel + Eau : c'est la réaction de neutralisation acido-basique." },
        { type: "texte_a_trous", title: "La molécule d'eau", q: "Complète la formule de la molécule d'eau.", textWithBlanks: "La formule de l'eau est ___₂___ : deux atomes d'hydrogène pour un atome d'oxygène.", blanks: [["H"], ["O"]], distractors: ["C", "N", "Fe"], exp: "H₂O : deux hydrogènes (H) et un oxygène (O)." },
    ]},
    { id: "svt", name: "SVT", icon: "❦", island: "Image/ile/svt.webp", lessons: [
        { title: "La photosynthèse", q: "Quel gaz les plantes absorbent-elles lors de la photosynthèse ?", opts: ["le CO₂", "l'O₂", "l'hydrogène", "l'azote"], correct: 0, exp: "Le CO₂ est transformé en matière organique grâce à la lumière." },
        { title: "Le système digestif", q: "Où débute la digestion des glucides ?", opts: ["dans la bouche", "dans l'estomac", "dans le foie", "dans l'intestin grêle"], correct: 0, exp: "La salive contient une enzyme qui amorce la digestion de l'amidon." },
        { title: "La génétique", q: "L'ADN se trouve principalement dans :", opts: ["le cytoplasme", "la membrane", "le noyau de la cellule", "les ribosomes"], correct: 2, exp: "Le noyau protège et organise le matériel génétique." },
        { title: "Les écosystèmes", q: "Un organisme qui se nourrit exclusivement de végétaux est un :", opts: ["décomposeur", "carnivore", "herbivore", "omnivore"], correct: 2, exp: "Par définition, un herbivore ne consomme que des végétaux." },
        { type: "reponse_courte", title: "Le cœur", q: "Combien de cavités possède le cœur humain ?", accepted: ["4", "quatre"], exp: "Le cœur a 4 cavités : 2 oreillettes et 2 ventricules." },
    ]},
    { id: "techno", name: "Technologie", icon: "⚙", band: "college", allowedNiveaux: ["6eme", "5eme", "4eme", "3eme"], island: "Image/ile/technologie.webp", lessons: [
        { type: "texte_a_choix", title: "Les algorithmes", q: "Choisis les bons termes pour compléter la définition.", textWithBlanks: "Pour répéter des instructions tant qu'une condition est vraie, on utilise une boucle ___, et pour faire un choix, une condition ___.", choices: [["tant que", "pour", "infinie"], ["si", "sinon", "alors"]], blanks: [["tant que"], ["si"]], exp: "« Tant que » (while) et « si » (if) sont des structures fondamentales en programmation." },
        { title: "Les capteurs", q: "Un capteur de température mesure :", opts: ["la pression", "la chaleur ambiante", "le son", "la lumière"], correct: 1, exp: "C'est sa fonction première : convertir une température en signal exploitable." },
        { title: "Les matériaux", q: "Le PLA est un matériau souvent utilisé en :", opts: ["chauffage", "soudure", "impression 3D", "isolation électrique"], correct: 2, exp: "Le PLA est un plastique biodégradable très utilisé en fabrication additive." },
        { title: "Les réseaux", q: "Le Wi-Fi fait référence à :", opts: ["un câble réseau", "un type de processeur", "une connexion sans fil", "un logiciel"], correct: 2, exp: "Le Wi-Fi permet une connexion réseau sans câble." },
        { type: "drag_and_drop", title: "Composants électroniques", q: "Associe chaque composant à son rôle.", items: ["Résistance", "LED", "Capteur"], targets: ["Limite le courant", "Émet de la lumière", "Mesure une grandeur physique"], pairs: { "Résistance": "Limite le courant", LED: "Émet de la lumière", Capteur: "Mesure une grandeur physique" }, exp: "Chaque composant a une fonction précise dans un circuit." },
    ]},
    { id: "anglais", name: "Anglais", icon: "En", island: "Image/ile/anglais.webp", lessons: [
        { title: "Present Perfect", q: "Choose the correct form: 'I ___ never been to London.'", opts: ["have", "having", "has", "had"], correct: 0, exp: "Subject 'I' + present perfect → 'have never been'." },
        { title: "Vocabulaire du quotidien", q: "What does 'to look forward to' mean?", opts: ["chercher quelque chose", "attendre avec impatience", "regarder devant soi", "avancer"], correct: 1, exp: "Cette expression exprime une attente positive d'un événement." },
        { title: "Comparatives", q: "'This book is ___ than the other one.'", opts: ["interesting", "more interesting", "most interesting", "interestinger"], correct: 1, exp: "Les adjectifs longs forment leur comparatif avec 'more'." },
        { title: "Modal verbs", q: "Which modal expresses obligation?", opts: ["must", "could", "would", "might"], correct: 0, exp: "'Must' exprime une obligation forte." },
        { type: "texte_a_trous", title: "Simple past", q: "Complète la phrase.", textWithBlanks: "Yesterday, she ___ (go) to the cinema and ___ (watch) a great film.", blanks: [["went"], ["watched"]], distractors: ["gone", "goes", "watches", "watching"], exp: "'Go' est irrégulier (went) ; 'watch' est régulier (+ed)." },
    ]},
    { id: "histoire", name: "Histoire", icon: "⌂", island: "Image/ile/histoire.webp", lessons: [
        { title: "La Révolution française", q: "En quelle année la Révolution française a-t-elle débuté ?", opts: ["1804", "1715", "1848", "1789"], correct: 3, exp: "La prise de la Bastille a lieu le 14 juillet 1789." },
        { title: "La Première Guerre mondiale", q: "La Première Guerre mondiale se termine en :", opts: ["1920", "1918", "1945", "1914"], correct: 1, exp: "L'armistice est signé le 11 novembre 1918." },
        { title: "L'Empire romain", q: "Quelle ville était la capitale de l'Empire romain ?", opts: ["Carthage", "Byzance", "Rome", "Athènes"], correct: 2, exp: "Rome est le centre politique de l'Empire jusqu'à sa scission." },
        { title: "La décolonisation", q: "L'indépendance de l'Algérie a eu lieu en :", opts: ["1970", "1962", "1958", "1954"], correct: 1, exp: "Les accords d'Évian entérinent l'indépendance en 1962." },
        { type: "vrai_faux", title: "Napoléon", q: "Napoléon Bonaparte est devenu empereur des Français en 1804.", correct: true, exp: "Vrai : il est sacré empereur le 2 décembre 1804." },
    ]},
    { id: "geo", name: "Géographie", icon: "⊕", island: "Image/ile/geo.svg", lessons: [
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
    { id: "philo", name: "Philosophie", icon: "🏛️", band: "lycee", allowedNiveaux: ["terminale"], island: "Image/ile/philo.svg", lessons: [
        { title: "L'allégorie de la caverne", q: "Qui a écrit l'allégorie de la caverne ?", opts: ["Socrate", "Platon", "Aristote", "Descartes"], correct: 1, exp: "Platon expose l'allégorie de la caverne dans La République (Livre VII)." },
        { title: "Le doute méthodique", q: "Quelle célèbre formule résume la certitude première de René Descartes ?", opts: ["Je sais que je ne sais rien", "L'homme est un loup pour l'homme", "Cogito, ergo sum (Je pense, donc je suis)", "Connais-toi toi-même"], correct: 2, exp: "Dans le Discours de la méthode, Descartes découvre le « Cogito » au terme du doute méthodique." },
        { title: "La conscience", q: "Pour Sigmund Freud, quelle partie de la psyché regroupe les pulsions refoulées ?", opts: ["Le Surmoi", "Le Moi", "L'Inconscient / Le Ça", "La conscience morale"], correct: 2, exp: "Le Ça représente le réservoir des pulsions inconscientes." },
        { type: "vrai_faux", title: "L'éthique et la morale", q: "Pour Emmanuel Kant, un acte moral doit être guidé par le devoir et l'impératif catégorique, sans rechercher son propre intérêt.", correct: true, exp: "Vrai : la morale déontologique kantienne repose sur le devoir désintéressé." },
        { type: "texte_a_trous", title: "Le contrat social", q: "Complète la citation de Jean-Jacques Rousseau.", textWithBlanks: "L'homme est né ___ et partout il est dans les ___.", blanks: [["libre"], ["fers"]], distractors: ["seul", "sage", "liens", "chaînes"], exp: "« L'homme est né libre et partout il est dans les fers » (Du contrat social, 1762)." },
    ]},
    { id: "nsi", name: "NSI & Numérique", icon: "Image/ile/nsi.svg", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["generale", "nsi_spe", "sti2d", "ciel"], island: "Image/ile/nsi.svg", lessons: [
        { title: "Binaire et Bits", q: "Quelle est la valeur décimale de l'octet binaire 00001010 ?", opts: ["8", "10", "12", "16"], correct: 1, exp: "En binaire : 8 + 2 = 10 (positions 2³ et 2¹)." },
        { title: "Algorithmique Python", q: "En Python, que renvoie l'expression [x * 2 for x in [1, 2, 3]] ?", opts: ["[1, 2, 3]", "[2, 4, 6]", "[2, 2, 2]", "Error"], correct: 1, exp: "C'est une compréhension de liste qui multiplie chaque élément par 2 : [2, 4, 6]." },
        { type: "vrai_faux", title: "Complexité algorithmique", q: "La recherche dichotomique dans un tableau trié de taille N a une complexité logarithmique O(log N).", correct: true, exp: "Vrai : à chaque étape, on divise par deux l'espace de recherche." },
        { type: "texte_a_trous", title: "Architecture Web", q: "Complète le rôle des langages du Web.", textWithBlanks: "Le langage ___ structure le contenu d'une page, le langage ___ gère sa présentation visuelle et ___ assure son interactivité dynamique.", blanks: [["HTML"], ["CSS"], ["JavaScript"]], distractors: ["SQL", "Python", "PHP"], exp: "Le trio fondamental du front-end est HTML (structure), CSS (style) et JavaScript (interactivité)." },
        { type: "drag_and_drop", title: "Réseaux & Protocoles", q: "Associe chaque protocole à son usage.", items: ["HTTP / HTTPS", "DNS", "SSH"], targets: ["Transfert de pages Web", "Résolution nom de domaine en IP", "Connexion à distance sécurisée"], pairs: { "HTTP / HTTPS": "Transfert de pages Web", "DNS": "Résolution nom de domaine en IP", "SSH": "Connexion à distance sécurisée" }, exp: "Ces protocoles fondamentaux structurent les communications sur Internet." },
    ]},
    { id: "ses", name: "SES (Économie)", icon: "Image/ile/ses.svg", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale"], allowedFilieres: ["generale"], island: "Image/ile/ses.svg", lessons: [
        { title: "Le marché et les prix", q: "Selon la loi de l'offre et de la demande, lorsque la demande d'un bien augmente sans que l'offre ne change, son prix :", opts: ["diminue", "tend à augmenter", "reste toujours fixe", "devient nul"], correct: 1, exp: "La rareté relative entraîne une hausse du prix d'équilibre." },
        { title: "La création monétaire", q: "Qui crée la majeure partie de la monnaie en circulation dans une économie moderne ?", opts: ["L'État par l'impôt", "Les banques commerciales lors de l'octroi de crédits", "La banque centrale par impression de billets", "Les entreprises industrielles"], correct: 1, exp: "« Les crédits font les dépôts » : les banques commerciales créent la monnaie scripturale lors d'un prêt." },
        { type: "vrai_faux", title: "Le PIB et la croissance", q: "Le Produit Intérieur Brut (PIB) mesure la richesse totale des patrimoines des ménages.", correct: false, exp: "Faux : le PIB mesure le flux de valeur ajoutée créée sur une période donnée (un an), pas le stock de patrimoine." },
        { type: "texte_a_choix", title: "La socialisation", q: "Complète les modes d'apprentissage social.", textWithBlanks: "La socialisation ___ se déroule pendant l'enfance au sein de la famille et de l'école, tandis que la socialisation ___ s'exerce à l'âge adulte dans le monde professionnel.", choices: [["primaire", "secondaire", "initiale"], ["secondaire", "primaire", "tertiaire"]], blanks: [["primaire"], ["secondaire"]], exp: "La sociologie distingue la socialisation primaire (enfance) de la socialisation secondaire (vie adulte)." },
        { type: "drag_and_drop", title: "Facteurs de production", q: "Associe chaque facteur de production à sa définition.", items: ["Facteur Travail", "Facteur Capital", "Progrès technique"], targets: ["Activité humaine rémunérée", "Biens durables utilisés pour produire (machines)", "Amélioration de l'efficacité productive"], pairs: { "Facteur Travail": "Activité humaine rémunérée", "Facteur Capital": "Biens durables utilisés pour produire (machines)", "Progrès technique": "Amélioration de l'efficacité productive" }, exp: "Le travail, le capital et la productivité globale des facteurs sont les moteurs de la production." },
    ]},
    { id: "espagnol", name: "Espagnol", icon: "Es", allowedNiveaux: ["5eme", "4eme", "3eme", "2nde", "1ere", "terminale"], allowedFilieres: ["generale", "stmg", "st2s"], island: "Image/ile/espagnol.svg", lessons: [
        { title: "Ser ou Estar", q: "Complète : « Madrid ___ en España. »", opts: ["es", "está", "son", "estoy"], correct: 1, exp: "On emploie toujours « estar » pour situer un lieu dans l'espace." },
        { title: "Vocabulaire du quotidien", q: "Que signifie le mot espagnol « biblioteca » ?", opts: ["librairie", "bibliothèque", "école", "cahier"], correct: 1, exp: "« Biblioteca » = bibliothèque (librairie se dit « librería »)." },
        { type: "vrai_faux", title: "L'accent écrit", q: "En espagnol, le verbe « gustar » s'accorde avec ce qui plaît (ex : « Me gustan los libros »).", correct: true, exp: "Vrai : le sujet grammatical est « los libros », d'où « gustan » au pluriel." },
        { type: "texte_a_choix", title: "Présent de l'indicatif", q: "Complète la phrase en espagnol.", textWithBlanks: "Nosotros ___ en la escuela y ___ español cada día.", choices: [["estamos", "somos", "están"], ["hablamos", "hablan", "habla"]], blanks: [["estamos"], ["hablamos"]], exp: "« Nosotros estamos » (lieu) et « hablamos » (1re personne du pluriel de hablar)." },
        { type: "drag_and_drop", title: "Faux amis & lexique", q: "Associe chaque mot espagnol à sa traduction française.", items: ["La calle", "El verano", "El desayuno"], targets: ["La rue", "L'été", "Le petit-déjeuner"], pairs: { "La calle": "La rue", "El verano": "L'été", "El desayuno": "Le petit-déjeuner" }, exp: "Des mots incontournables du vocabulaire courant en LV2." },
    ]},
    { id: "arts", name: "Arts & Musique", icon: "🎨", allowedNiveaux: ["6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "terminale"], allowedFilieres: ["generale"], island: "Image/ile/arts.svg", lessons: [
        { title: "Couleurs primaires", q: "En peinture (synthèse soustractive), quelles sont les trois couleurs primaires ?", opts: ["Rouge, Vert, Bleu", "Cyan (bleu), Magenta (rouge), Jaune", "Orange, Vert, Violet", "Noir, Blanc, Gris"], correct: 1, exp: "En peinture, les primaires sont bleu/cyan, rouge/magenta et jaune." },
        { title: "Histoire de l'art", q: "Qui a peint le célèbre tableau « Guernica » en 1937 ?", opts: ["Claude Monet", "Pablo Picasso", "Vincent van Gogh", "Salvador Dalí"], correct: 1, exp: "Pablo Picasso a peint Guernica pour dénoncer le bombardement de la ville basque." },
        { type: "vrai_faux", title: "Rythme musical", q: "Une noire dure deux fois plus longtemps qu'une croche.", correct: true, exp: "Vrai : 1 noire = 2 croches (et 1 blanche = 2 noires)." },
        { type: "texte_a_trous", title: "La perspective", q: "Complète la règle de la perspective linéaire.", textWithBlanks: "Dans un dessin en perspective, les droites parallèles fuyantes convergent vers un point appelé point de ___ situé sur la ligne d'___.", blanks: [["fuite"], ["horizon"]], distractors: ["centre", "sol", "ombre"], exp: "La perspective centrale de la Renaissance s'appuie sur la ligne d'horizon et le point de fuite." },
        { type: "drag_and_drop", title: "Familles d'instruments", q: "Associe chaque instrument à sa famille orchestrale.", items: ["Violon", "Trompette", "Flûte traversière"], targets: ["Cordes frottées", "Cuivres", "Bois"], pairs: { "Violon": "Cordes frottées", "Trompette": "Cuivres", "Flûte traversière": "Bois" }, exp: "La flûte traversière appartient historiquement à la famille des bois." },
    ]},
    { id: "hggsp", name: "HGGSP (Géopolitique)", icon: "🌐", band: "lycee", allowedNiveaux: ["1ere", "terminale"], allowedFilieres: ["generale"], island: "Image/ile/hggsp.svg", lessons: [
        { title: "Soft power & Hard power", q: "Qui a théorisé la distinction entre « hard power » et « soft power » ?", opts: ["Joseph Nye", "Karl Marx", "Montesquieu", "John Maynard Keynes"], correct: 0, exp: "Le politologue américain Joseph Nye a formulé le concept de soft power en 1990." },
        { title: "Droit de la mer", q: "Jusqu'à quelle distance des côtes s'étend la Zone Économique Exclusive (ZEE) selon Montego Bay (1982) ?", opts: ["12 milles marins", "200 milles marins", "50 milles marins", "500 milles marins"], correct: 1, exp: "La ZEE s'étend jusqu'à 200 milles marins (~370 km) des côtes." },
        { type: "vrai_faux", title: "Paix de Westphalie", q: "Les traités de Westphalie (1648) consacrent le principe de souveraineté des États.", correct: true, exp: "Vrai : ils mettent fin à la guerre de Trente Ans et fondent l'ordre interétatique moderne." },
        { type: "texte_a_choix", title: "L'espace & les océans", q: "Complète les enjeux géopolitiques des nouveaux espaces.", textWithBlanks: "La conquête spatiale débute avec le satellite soviétique ___ en 1957, puis les États-Unis remportent la course à la Lune avec la mission ___ en 1969.", choices: [["Spoutnik", "Voyager", "Ariane"], ["Apollo 11", "Gemini 4", "Mir"]], blanks: [["Spoutnik"], ["Apollo 11"]], exp: "Spoutnik 1 (1957) et Apollo 11 (1969) marquent les jalons clés de la guerre froide spatiale." },
        { type: "drag_and_drop", title: "Institutions internationales", q: "Associe chaque organisation à son rôle principal.", items: ["ONU", "UNESCO", "CPI"], targets: ["Maintien de la paix internationale", "Protection du patrimoine mondial", "Jugement des crimes contre l'humanité"], pairs: { "ONU": "Maintien de la paix internationale", "UNESCO": "Protection du patrimoine mondial", "CPI": "Jugement des crimes contre l'humanité" }, exp: "Chaque institution remplit un mandat distinct dans la gouvernance mondiale." },
    ]},
    { id: "si", name: "Sciences de l'Ingénieur", icon: "📐", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale"], allowedFilieres: ["generale", "nsi_spe", "sti2d"], island: "Image/ile/si.svg", lessons: [
        { title: "Chaîne d'énergie", q: "Dans la chaîne d'énergie, quelle fonction réalise un moteur électrique ?", opts: ["Alimenter", "Convertir", "Transmettre", "Acquérir"], correct: 1, exp: "Un moteur convertit l'énergie électrique en énergie mécanique." },
        { title: "Rendement énergétique", q: "Un système consomme 200 W et restitue 150 W utiles. Quel est son rendement η ?", opts: ["50 %", "75 %", "80 %", "133 %"], correct: 1, exp: "η = Pu / Pa = 150 / 200 = 0,75 soit 75 %." },
        { type: "vrai_faux", title: "Puissance mécanique", q: "En rotation, la puissance mécanique vaut P = C × ω (couple en N·m fois vitesse angulaire en rad/s).", correct: true, exp: "Vrai : P (W) = C (N·m) × ω (rad/s)." },
        { type: "texte_a_choix", title: "Ingénierie SysML", q: "Complète les diagrammes SysML fondamentaux.", textWithBlanks: "Le diagramme des ___ recense les contraintes du cahier des charges, tandis que le diagramme des ___ décrit les services attendus par l'utilisateur.", choices: [["exigences (req)", "séquences", "états"], ["cas d'utilisation (uc)", "blocs internes", "flux"]], blanks: [["exigences (req)"], ["cas d'utilisation (uc)"]], exp: "En SysML, « req » formalise les exigences et « uc » les cas d'utilisation." },
        { type: "drag_and_drop", title: "Liaisons mécaniques", q: "Associe chaque liaison à ses degrés de liberté.", items: ["Encastrement", "Pivot", "Glissière"], targets: ["0 degré de liberté", "1 rotation uniquement", "1 translation uniquement"], pairs: { "Encastrement": "0 degré de liberté", "Pivot": "1 rotation uniquement", "Glissière": "1 translation uniquement" }, exp: "Les liaisons élémentaires définissent les mouvements possibles entre solides." },
    ]},
    { id: "msgn", name: "Management & Gestion", icon: "📊", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["stmg"], island: "Image/ile/msgn.svg", lessons: [
        { title: "Types d'organisations", q: "Quelle est la finalité principale d'une entreprise privée ?", opts: ["Réaliser un profit pour assurer sa pérennité", "Fournir un service public gratuit", "Défendre une cause bénévole sans bénéfice", "Voter des lois"], correct: 0, exp: "Une entreprise a une finalité lucrative (créer de la valeur et dégager un profit)." },
        { title: "Valeur ajoutée", q: "Comment calcule-t-on la Valeur Ajoutée (VA) d'une entreprise ?", opts: ["Chiffre d'affaires + Achats", "Chiffre d'affaires − Consommations intermédiaires", "Bénéfice × Salaires", "Actif − Passif"], correct: 1, exp: "VA = Chiffre d'affaires (production) − Consommations intermédiaires." },
        { type: "vrai_faux", title: "Diagnostic SWOT", q: "Dans une matrice SWOT, les Forces et Faiblesses relèvent du diagnostic interne de l'organisation.", correct: true, exp: "Vrai : Forces/Faiblesses = interne ; Opportunités/Menaces = environnement externe." },
        { type: "texte_a_choix", title: "Styles de direction (Likert)", q: "Complète les styles de management.", textWithBlanks: "Un manager qui décide seul sans consulter ses équipes adopte un style ___, tandis que celui qui associe les salariés aux décisions adopte un style ___.", choices: [["autoritaire", "participatif", "délégatif"], ["participatif", "autoritaire", "paternaliste"]], blanks: [["autoritaire"], ["participatif"]], exp: "Rensis Likert distingue autoritaire, paternaliste, consultatif et participatif." },
        { type: "drag_and_drop", title: "Indicateurs comptables", q: "Associe chaque document ou notion à sa définition.", items: ["Bilan comptable", "Compte de résultat", "Seuil de rentabilité"], targets: ["Patrimoine (Actif / Passif) à une date donnée", "Produits et charges sur un exercice", "CA à partir duquel l'entreprise fait un bénéfice"], pairs: { "Bilan comptable": "Patrimoine (Actif / Passif) à une date donnée", "Compte de résultat": "Produits et charges sur un exercice", "Seuil de rentabilité": "CA à partir duquel l'entreprise fait un bénéfice" }, exp: "Ces outils clés pilotent la performance financière en STMG." },
    ]},
    { id: "droit_eco", name: "Droit & Économie", icon: "⚖️", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["stmg", "ciel"], island: "Image/ile/droit_eco.svg", lessons: [
        { title: "Contrat de travail", q: "Quel est le contrat de travail de droit commun en France ?", opts: ["Le CDD", "Le CDI", "Le contrat d'intérim", "La convention de stage"], correct: 1, exp: "Le Contrat à Durée Indéterminée (CDI) est la forme normale et générale de la relation de travail." },
        { title: "Politique monétaire", q: "Quelle institution conduit la politique monétaire dans la zone euro ?", opts: ["Le Parlement français", "La Banque Centrale Européenne (BCE)", "L'ONU", "La Cour de cassation"], correct: 1, exp: "La BCE fixe les taux directeurs afin de maintenir la stabilité des prix (~2 % d'inflation)." },
        { type: "vrai_faux", title: "Responsabilité civile", q: "Pour engager la responsabilité civile délictuelle, il faut prouver un fait générateur, un dommage et un lien de causalité.", correct: true, exp: "Vrai : ce sont les trois conditions cumulatives prévues par le Code civil." },
        { type: "texte_a_choix", title: "Juridictions françaises", q: "Identifie les juridictions compétentes.", textWithBlanks: "Un litige individuel entre un salarié et son employeur est jugé par le ___, tandis qu'un litige entre deux commerçants relève du ___.", choices: [["Conseil de prud'hommes", "Tribunal administratif", "Tribunal correctionnel"], ["Tribunal de commerce", "Conseil d'État", "Cour d'assises"]], blanks: [["Conseil de prud'hommes"], ["Tribunal de commerce"]], exp: "Chaque ordre et juridiction spécialisée dispose d'une compétence d'attribution précise." },
        { type: "drag_and_drop", title: "Notions économiques", q: "Associe chaque terme à sa définition.", items: ["Inflation", "Chômage conjoncturel", "Balance commerciale"], targets: ["Hausse générale et durable des prix", "Lié à un ralentissement de l'activité économique", "Exportations moins Importations de biens"], pairs: { "Inflation": "Hausse générale et durable des prix", "Chômage conjoncturel": "Lié à un ralentissement de l'activité économique", "Balance commerciale": "Exportations moins Importations de biens" }, exp: "Des repères essentiels de macroéconomie au programme STMG et BTS." },
    ]},
    { id: "mercatique", name: "Mercatique (Marketing)", icon: "📈", band: "lycee", allowedNiveaux: ["1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["stmg"], island: "Image/ile/mercatique.svg", lessons: [
        { title: "Le Marketing Mix (4P)", q: "Quels sont les 4 piliers historiques du plan de marchéage (4P) ?", opts: ["Produit, Prix, Distribution (Place), Communication (Promotion)", "Profit, Personnel, Production, Publicité", "Part de marché, Panier, Promotion, Pénurie", "Plan, Projet, Pilote, Partenaire"], correct: 0, exp: "Le marketing mix articule Produit, Prix, Place (distribution) et Promotion (communication)." },
        { title: "Stratégie de prix", q: "Fixer volontairement un prix élevé au lancement pour cibler une clientèle haut de gamme s'appelle :", opts: ["l'écrémage", "la pénétration", "l'alignement", "le dumping"], correct: 0, exp: "La stratégie d'écrémage privilégie une forte marge unitaire et une image premium." },
        { type: "vrai_faux", title: "Segmentation de marché", q: "Segmenter un marché consiste à le découper en groupes homogènes de consommateurs aux attentes similaires.", correct: true, exp: "Vrai : la segmentation précède le ciblage puis le positionnement (SCP)." },
        { type: "texte_a_choix", title: "Distribution", q: "Complète les types de réseaux de distribution.", textWithBlanks: "Vendre un produit dans un maximum de points de vente correspond à une distribution ___, alors que réserver la vente à un seul distributeur par zone est une distribution ___.", choices: [["intensive", "exclusive", "sélective"], ["exclusive", "intensive", "directe"]], blanks: [["intensive"], ["exclusive"]], exp: "On distingue distribution intensive (grande conso), sélective (parfums) et exclusive (luxe/auto)." },
        { type: "drag_and_drop", title: "Cycle de vie du produit", q: "Associe chaque phase du cycle de vie à sa caractéristique.", items: ["Lancement", "Croissance", "Maturité"], targets: ["Ventes faibles et forts coûts de communication", "Forte hausse des ventes et arrivée de concurrents", "Ventes au sommet et fidélisation prioritaire"], pairs: { "Lancement": "Ventes faibles et forts coûts de communication", "Croissance": "Forte hausse des ventes et arrivée de concurrents", "Maturité": "Ventes au sommet et fidélisation prioritaire" }, exp: "Le cycle de vie compte 4 phases : Lancement, Croissance, Maturité, Déclin." },
    ]},
    { id: "i2d", name: "I2D (Innovation & Éco)", icon: "🔋", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["sti2d"], island: "Image/ile/i2d.svg", lessons: [
        { title: "Analyse du Cycle de Vie", q: "Que permet d'évaluer une Analyse du Cycle de Vie (ACV) d'un produit ?", opts: ["Uniquement son prix en magasin", "Ses impacts environnementaux de l'extraction au recyclage", "Sa couleur dominante", "Son nombre de brevets"], correct: 1, exp: "L'ACV quantifie les impacts (CO₂, eau, énergie) du berceau à la tombe." },
        { title: "Énergie électrique", q: "Un radiateur de 2 kW fonctionne pendant 3 heures. Quelle énergie consomme-t-il ?", opts: ["5 kWh", "6 kWh", "1,5 kWh", "600 Wh"], correct: 1, exp: "E = P × t = 2 kW × 3 h = 6 kWh." },
        { type: "vrai_faux", title: "Résistance thermique", q: "Plus la résistance thermique R d'une paroi est élevée, meilleure est son isolation.", correct: true, exp: "Vrai : R = e / λ (épaisseur divisée par la conductivité thermique)." },
        { type: "texte_a_choix", title: "Écoconception & Matériaux", q: "Complète les principes du développement durable.", textWithBlanks: "Un matériau dont la conductivité thermique λ est très faible est un bon ___, et l'énergie issue du vent est appelée énergie ___.", choices: [["isolant thermique", "conducteur thermique", "aimant"], ["éolienne", "fossile", "nucléaire"]], blanks: [["isolant thermique"], ["éolienne"]], exp: "Faible λ = bon isolant (ex : laine de bois, polystyrène) ; le vent alimente les éoliennes." },
        { type: "drag_and_drop", title: "Sollicitations mécaniques", q: "Associe chaque sollicitation mécanique à son effet.", items: ["Traction", "Compression", "Flexion"], targets: ["Allonge une poutre", "Écrase ou raccourcit une pièce", "Courbe une poutre sous charge"], pairs: { "Traction": "Allonge une poutre", "Compression": "Écrase ou raccourcit une pièce", "Flexion": "Courbe une poutre sous charge" }, exp: "La résistance des matériaux (RDM) analyse ces sollicitations pour dimensionner les structures." },
    ]},
    { id: "sin", name: "SIN (Info & Numérique)", icon: "📡", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["sti2d"], island: "Image/ile/sin.svg", lessons: [
        { title: "Conversion Hexadécimale", q: "Quelle est la valeur décimale du nombre hexadécimal 0x1A ?", opts: ["16", "26", "30", "110"], correct: 1, exp: "1 × 16 + 10 (A) = 26." },
        { title: "Convertisseur CAN", q: "Combien de niveaux numériques distincts peut coder un CAN sur 8 bits ?", opts: ["8", "64", "128", "256"], correct: 3, exp: "Sur n bits, un CAN possède 2ⁿ niveaux : 2⁸ = 256 (de 0 à 255)." },
        { type: "vrai_faux", title: "Théorème de Shannon", q: "Pour numériser un signal sans perte d'information spectrale, la fréquence d'échantillonnage doit être au moins le double de la fréquence maximale du signal.", correct: true, exp: "Vrai : c'est le critère de Nyquist-Shannon (fe ≥ 2 × fmax)." },
        { type: "texte_a_choix", title: "Logique booléenne", q: "Complète les portes logiques de base.", textWithBlanks: "La sortie d'une porte ___ vaut 1 uniquement si toutes ses entrées valent 1, tandis qu'une porte ___ inverse l'état de son entrée.", choices: [["ET (AND)", "OU (OR)", "XOR"], ["NON (NOT)", "ET (AND)", "OU (OR)"]], blanks: [["ET (AND)"], ["NON (NOT)"]], exp: "ET (A·B) exige toutes les entrées à 1 ; NON (Ā) inverse 0↔1." },
        { type: "drag_and_drop", title: "Bus embarqués", q: "Associe chaque interface embarquée à sa caractéristique.", items: ["I2C", "PWM (MLI)", "UART / Série"], targets: ["Bus 2 fils (SDA, SCL) maître-esclave", "Signal carré à rapport cyclique variable", "Liaison asynchrone TX / RX"], pairs: { "I2C": "Bus 2 fils (SDA, SCL) maître-esclave", "PWM (MLI)": "Signal carré à rapport cyclique variable", "UART / Série": "Liaison asynchrone TX / RX" }, exp: "Ces protocoles relient microcontrôleurs, capteurs et actionneurs en STI2D SIN." },
    ]},
    { id: "cybersecurite", name: "Cybersécurité", icon: "🛡️", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["ciel", "nsi_spe"], island: "Image/ile/cybersecurite.svg", lessons: [
        { title: "Triade CIA", q: "Quels sont les trois piliers fondamentaux de la sécurité informatique (CIA) ?", opts: ["Confidentialité, Intégrité, Disponibilité", "Code, Internet, Antivirus", "Cryptage, IP, Authentification", "Cloud, Identité, Accès"], correct: 0, exp: "CIA = Confidentiality (Confidentialité), Integrity (Intégrité), Availability (Disponibilité)." },
        { title: "Attaques Web", q: "Quelle attaque consiste à injecter des commandes SQL malveillantes via un champ de formulaire ?", opts: ["Phishing", "Injection SQL (SQLi)", "DDoS", "Ransomware"], correct: 1, exp: "Une injection SQL exploite une requête non préparée pour lire ou altérer la base de données." },
        { type: "vrai_faux", title: "Fonctions de hachage", q: "Une fonction de hachage cryptographique comme SHA-256 est conçue pour être irréversible (à sens unique).", correct: true, exp: "Vrai : on ne peut pas retrouver le message d'origine à partir de son empreinte SHA-256." },
        { type: "texte_a_choix", title: "Chiffrement", q: "Distingue chiffrement symétrique et asymétrique.", textWithBlanks: "L'algorithme ___ utilise la même clé secrète pour chiffrer et déchiffrer (symétrique), tandis que ___ utilise une paire clé publique / clé privée (asymétrique).", choices: [["AES", "RSA", "SHA-256"], ["RSA", "AES", "MD5"]], blanks: [["AES"], ["RSA"]], exp: "AES est le standard de chiffrement symétrique ; RSA repose sur une paire de clés asymétriques." },
        { type: "drag_and_drop", title: "Menaces cyber", q: "Associe chaque menace à son mode opératoire.", items: ["Phishing (Hameçonnage)", "Ransomware (Rançongiciel)", "DDoS"], targets: ["Usurpation d'identité pour voler des identifiants", "Chiffrement des fichiers contre une rançon", "Saturation d'un serveur par un flot de requêtes"], pairs: { "Phishing (Hameçonnage)": "Usurpation d'identité pour voler des identifiants", "Ransomware (Rançongiciel)": "Chiffrement des fichiers contre une rançon", "DDoS": "Saturation d'un serveur par un flot de requêtes" }, exp: "Reconnaître chaque vecteur d'attaque est la base de la cyberdéfense en CIEL." },
    ]},
    { id: "reseaux", name: "Réseaux & Systèmes", icon: "🌐", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["ciel", "nsi_spe"], island: "Image/ile/reseaux.svg", lessons: [
        { title: "Modèle OSI", q: "À quelle couche du modèle OSI opère un routeur IP ?", opts: ["Couche 1 (Physique)", "Couche 2 (Liaison)", "Couche 3 (Réseau)", "Couche 7 (Application)"], correct: 2, exp: "Le routeur achemine les paquets selon les adresses IP (couche 3 — Réseau)." },
        { title: "Adressage IPv4 / CIDR", q: "Combien d'adresses d'hôtes utilisables offre un sous-réseau IPv4 en /24 ?", opts: ["256", "254", "126", "510"], correct: 1, exp: "2⁸ − 2 = 254 hôtes (on retire l'adresse réseau et l'adresse de broadcast)." },
        { type: "vrai_faux", title: "Protocole DHCP", q: "Le protocole DHCP attribue automatiquement une adresse IP, un masque et une passerelle aux machines d'un réseau.", correct: true, exp: "Vrai : DHCP évite la configuration IP manuelle de chaque poste." },
        { type: "texte_a_choix", title: "Ports TCP/UDP usuels", q: "Associe les ports standards.", textWithBlanks: "Le trafic Web chiffré HTTPS utilise par défaut le port TCP ___, et la connexion distante sécurisée SSH utilise le port TCP ___.", choices: [["443", "80", "21"], ["22", "53", "25"]], blanks: [["443"], ["22"]], exp: "HTTP = 80, HTTPS = 443, SSH = 22, DNS = 53." },
        { type: "drag_and_drop", title: "Équipements réseau", q: "Associe chaque équipement à sa fonction.", items: ["Switch (Commutateur)", "Routeur", "Pare-feu (Firewall)"], targets: ["Transmet les trames selon les adresses MAC (L2)", "Interconnecte différents réseaux IP (L3)", "Filtre le trafic selon des règles de sécurité"], pairs: { "Switch (Commutateur)": "Transmet les trames selon les adresses MAC (L2)", "Routeur": "Interconnecte différents réseaux IP (L3)", "Pare-feu (Firewall)": "Filtre le trafic selon des règles de sécurité" }, exp: "Maîtriser le rôle de chaque équipement est indispensable en Bac Pro et BTS CIEL." },
    ]},
    { id: "electronique", name: "Électronique & Systèmes", icon: "🔌", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["ciel", "sti2d"], island: "Image/ile/electronique.svg", lessons: [
        { title: "Loi d'Ohm", q: "Une résistance de 220 Ω est traversée par un courant de 0,05 A (50 mA). Quelle est la tension à ses bornes ?", opts: ["4,4 V", "11 V", "22 V", "0,11 V"], correct: 1, exp: "U = R × I = 220 × 0,05 = 11 V." },
        { title: "Diode & LED", q: "Quel est le rôle principal d'une résistance placée en série avec une LED ?", opts: ["Augmenter la tension d'alimentation", "Limiter l'intensité du courant pour ne pas détruire la LED", "Redresser le courant alternatif", "Amplifier le signal audio"], correct: 1, exp: "Sans résistance de limitation, le courant excessif détruirait instantanément la jonction de la LED." },
        { type: "vrai_faux", title: "Résistances en série", q: "Deux résistances R1 et R2 montées en série ont une résistance équivalente Réq = R1 + R2.", correct: true, exp: "Vrai : en série les résistances s'additionnent ; en parallèle, ce sont les inverses (1/Réq = 1/R1 + 1/R2)." },
        { type: "texte_a_choix", title: "Mesures électriques", q: "Complète les règles de branchement des appareils de mesure.", textWithBlanks: "Un voltmètre se branche toujours en ___ du composant étudié, tandis qu'un ampèremètre se branche toujours en ___.", choices: [["dérivation (parallèle)", "série", "court-circuit"], ["série", "dérivation (parallèle)", "boucle ouverte"]], blanks: [["dérivation (parallèle)"], ["série"]], exp: "Voltmètre en parallèle (mesure de tension) ; ampèremètre en série (mesure d'intensité)." },
        { type: "drag_and_drop", title: "Composants électroniques", q: "Associe chaque composant à son unité ou sa fonction.", items: ["Condensateur", "Transistor MOSFET", "Oscilloscope"], targets: ["Stocke de l'énergie électrique (Farad)", "Interrupteur commandé en tension", "Visualise l'évolution d'une tension dans le temps"], pairs: { "Condensateur": "Stocke de l'énergie électrique (Farad)", "Transistor MOSFET": "Interrupteur commandé en tension", "Oscilloscope": "Visualise l'évolution d'une tension dans le temps" }, exp: "Des bases incontournables en électronique et systèmes embarqués (CIEL / STI2D)." },
    ]},
    { id: "stss", name: "STSS (Santé & Social)", icon: "🩺", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["st2s", "bac_pro_assp"], island: "Image/ile/stss.svg", lessons: [
        { title: "Définition de la santé (OMS)", q: "Selon l'OMS (1946), la santé est un état de complet bien-être :", opts: ["uniquement physique", "physique, mental et social", "financier et sportif", "biologique seulement"], correct: 1, exp: "L'OMS définit la santé comme un bien-être physique, mental et social, et non seulement l'absence de maladie." },
        { title: "Niveaux de prévention", q: "La vaccination vise à éviter l'apparition d'une maladie : de quel niveau de prévention s'agit-il ?", opts: ["Prévention primaire", "Prévention secondaire", "Prévention tertiaire", "Réadaptation"], correct: 0, exp: "La prévention primaire agit avant l'apparition de la maladie (vaccination, hygiène)." },
        { type: "vrai_faux", title: "Sécurité sociale", q: "En France, la Sécurité sociale a été créée par les ordonnances de 1945 selon le principe de solidarité nationale.", correct: true, exp: "Vrai : créée en octobre 1945 pour protéger contre les grands risques sociaux." },
        { type: "texte_a_choix", title: "Indicateurs démographiques", q: "Complète les notions d'épidémiologie.", textWithBlanks: "L'___ mesure le nombre de nouveaux cas d'une maladie sur une période donnée, tandis que la ___ mesure le nombre total de cas présents à un instant donné.", choices: [["incidence", "prévalence", "mortalité"], ["prévalence", "incidence", "natalité"]], blanks: [["incidence"], ["prévalence"]], exp: "Incidence = nouveaux cas sur une période ; Prévalence = total des cas existants." },
        { type: "drag_and_drop", title: "Acteurs de santé publique", q: "Associe chaque organisme à sa mission.", items: ["ARS", "PMI", "HAS"], targets: ["Pilote la politique de santé en région", "Protection maternelle et infantile", "Évalue les soins et publie des recommandations médicales"], pairs: { "ARS": "Pilote la politique de santé en région", "PMI": "Protection maternelle et infantile", "HAS": "Évalue les soins et publie des recommandations médicales" }, exp: "Ces acteurs structurent le système de santé et la protection sociale en ST2S." },
    ]},
    { id: "biotech", name: "Biotechnologies & Labo", icon: "🧫", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["stl", "bac_pro_assp"], island: "Image/ile/biotech.svg", lessons: [
        { title: "Coloration de Gram", q: "Après une coloration de Gram, quelle couleur prennent les bactéries Gram positives (Gram+) ?", opts: ["Rose / rouge", "Violette", "Verte fluorescente", "Incolore"], correct: 1, exp: "La paroi épaisse de peptidoglycane des Gram+ retient le violet de gentiane." },
        { title: "Amplification ADN (PCR)", q: "Quel est l'objectif principal de la technique PCR en biologie moléculaire ?", opts: ["Détruire l'ADN", "Amplifier en millions de copies une séquence précise d'ADN", "Mesurer le pH d'un tampon", "Colorer une coupe de tissu"], correct: 1, exp: "La PCR (Polymerase Chain Reaction) multiplie exponentiellement (2ⁿ) un fragment d'ADN cible." },
        { type: "vrai_faux", title: "Stérilisation à l'autoclave", q: "Un autoclave stérilise les milieux de culture par vapeur d'eau saturée sous pression à 121 °C.", correct: true, exp: "Vrai : 121 °C sous 1 bar de surpression détruit bactéries, virus et spores." },
        { type: "texte_a_choix", title: "Antisepsie et Désinfection", q: "Distingue l'usage des produits d'hygiène.", textWithBlanks: "Un ___ s'applique sur les tissus vivants (peau), tandis qu'un ___ s'applique sur les surfaces inertes (paillasse).", choices: [["antiseptique", "désinfectant", "solvant"], ["désinfectant", "antiseptique", "réactif"]], blanks: [["antiseptique"], ["désinfectant"]], exp: "Règle d'or en microbiologie STL et soins ASSP." },
        { type: "drag_and_drop", title: "Outils de laboratoire", q: "Associe chaque appareil de labo à son rôle.", items: ["Spectrophotomètre", "Micropipette", "Autoclave"], targets: ["Mesure l'absorbance (Beer-Lambert)", "Prélève des microvolumes (µL)", "Stérilise à la vapeur sous pression"], pairs: { "Spectrophotomètre": "Mesure l'absorbance (Beer-Lambert)", "Micropipette": "Prélève des microvolumes (µL)", "Autoclave": "Stérilise à la vapeur sous pression" }, exp: "Ces appareils sont essentiels en travaux pratiques de Biotechnologies." },
    ]},
    { id: "design", name: "Design & Arts Appliqués", icon: "🎨", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["std2a"], island: "Image/ile/design.svg", lessons: [
        { title: "Le Bauhaus (1919)", q: "Quelle école fondée par Walter Gropius a posé les bases du design industriel moderne ?", opts: ["Le Bauhaus", "Le Baroque", "L'Impressionnisme", "Le Surréalisme"], correct: 0, exp: "Le Bauhaus relie création artistique, fonctionnalité et production industrielle." },
        { title: "Synthèse d'impression", q: "Quel mode colorimétrique à 4 encres utilise-t-on pour imprimer une affiche ou un magazine ?", opts: ["RVB", "CMJN", "ASCII", "MP4"], correct: 1, exp: "CMJN (Cyan, Magenta, Jaune, Noir) est le standard d'imprimerie (synthèse soustractive)." },
        { type: "vrai_faux", title: "Image vectorielle", q: "Un logo conçu en format vectoriel (SVG) peut être agrandi à l'échelle d'un panneau publicitaire sans pixelliser.", correct: true, exp: "Vrai : le vectoriel utilise des courbes mathématiques (Bézier) indépendantes de la résolution." },
        { type: "texte_a_choix", title: "Typographie", q: "Complète les deux grandes familles typographiques.", textWithBlanks: "Une police ___ possède des empattements (ex : Garamond), tandis qu'une police ___ n'en possède pas (ex : Helvetica).", choices: [["Serif", "Sans-Serif", "Bitmap"], ["Sans-Serif", "Serif", "CMJN"]], blanks: [["Serif"], ["Sans-Serif"]], exp: "Les polices Sans-Serif (linéales) offrent une excellente lisibilité sur écrans et signalétiques." },
        { type: "drag_and_drop", title: "Pôles du design", q: "Associe chaque domaine du design à un exemple concret.", items: ["Design d'espace", "Design graphique", "Design produit"], targets: ["Aménagement d'un musée", "Identité visuelle & logo", "Fauteuil ergonomique"], pairs: { "Design d'espace": "Aménagement d'un musée", "Design graphique": "Identité visuelle & logo", "Design produit": "Fauteuil ergonomique" }, exp: "Les 4 pôles STD2A : produit, espace, graphique et mode/textile." },
    ]},
    { id: "hotellerie", name: "Hôtellerie & Gastronomie", icon: "🍽️", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["sthr"], island: "Image/ile/hotellerie.svg", lessons: [
        { title: "Démarche HACCP", q: "Quel est l'objectif de la méthode HACCP en cuisine professionnelle ?", opts: ["Maîtriser la sécurité sanitaire des aliments", "Décorer les chambres d'hôtel", "Calculer les pourboires", "Choisir la musique de salle"], correct: 0, exp: "HACCP identifie les points critiques (températures, hygiène, traçabilité) pour prévenir les contaminations." },
        { title: "Liaison chaude", q: "Quelle est la température minimale réglementaire de maintien en liaison chaude avant service ?", opts: ["+20 °C", "+40 °C", "+63 °C", "+100 °C"], correct: 2, exp: "En dessous de +63 °C (et au-dessus de +10 °C), les bactéries se multiplient rapidement." },
        { type: "vrai_faux", title: "Réaction de Maillard", q: "La réaction de Maillard est responsable du brunissement et des arômes grillés d'une viande saisie ou d'une croûte de pain.", correct: true, exp: "Vrai : elle se produit à haute température entre sucres réducteurs et acides aminés." },
        { type: "texte_a_choix", title: "Service en salle", q: "Complète les règles classiques du service à table.", textWithBlanks: "En service à l'assiette, on sert le client par la ___, tandis que le pain et le service au plat se présentent par la ___.", choices: [["droite", "gauche", "cuisine"], ["gauche", "droite", "réserve"]], blanks: [["droite"], ["gauche"]], exp: "Règle protocolaire de service en restauration française." },
        { type: "drag_and_drop", title: "Indicateurs hôteliers", q: "Associe chaque terme STHR à sa définition.", items: ["RevPAR", "Taux d'occupation", "Marche en avant"], targets: ["CA hébergement par chambre disponible", "Pourcentage de chambres vendues", "Séparation stricte circuits propre et sale"], pairs: { "RevPAR": "CA hébergement par chambre disponible", "Taux d'occupation": "Pourcentage de chambres vendues", "Marche en avant": "Séparation stricte circuits propre et sale" }, exp: "Des repères incontournables en gestion hôtelière et sciences culinaires." },
    ]},
    { id: "agronomie", name: "Agronomie & Écologie", icon: "🌱", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["stav"], island: "Image/ile/agronomie.svg", lessons: [
        { title: "Éléments NPK", q: "Quels sont les trois éléments nutritifs majeurs (NPK) indispensables aux plantes ?", opts: ["Azote, Phosphore, Potassium", "Nickel, Plomb, Krypton", "Or, Fer, Zinc", "Sodium, Chlore, Soufre"], correct: 0, exp: "N (azote), P (phosphore) et K (potassium) assurent croissance, enracinement et floraison." },
        { title: "Légumineuses et azote", q: "Pourquoi introduit-on des légumineuses (trèfle, luzerne, pois) dans une rotation agricole ?", opts: ["Elles fixent l'azote de l'air grâce à une symbiose racinaire", "Elles stérilisent le sol", "Elles empêchent la pluie de tomber", "Elles produisent du pétrole"], correct: 0, exp: "Les bactéries Rhizobium dans leurs nodosités enrichissent naturellement le sol en azote." },
        { type: "vrai_faux", title: "Conversion en hectares", q: "Un hectare (1 ha) correspond exactement à 10 000 m² (un carré de 100 m × 100 m).", correct: true, exp: "Vrai : 1 ha = 100 ares = 10 000 m²." },
        { type: "texte_a_choix", title: "Agroécologie", q: "Complète les démarches durables du programme STAV.", textWithBlanks: "La ___ utilise des insectes auxiliaires contre les ravageurs, et l'___ associe arbres et cultures sur une même parcelle.", choices: [["lutte biologique", "monoculture", "déforestation"], ["agroforesterie", "hydroponie", "urbanisation"]], blanks: [["lutte biologique"], ["agroforesterie"]], exp: "L'agroécologie s'appuie sur les services rendus par les écosystèmes." },
        { type: "drag_and_drop", title: "Fertilité des sols", q: "Associe chaque notion agronomique à son rôle.", items: ["Complexe argilo-humique", "Haie bocagère", "CIPAN"], targets: ["Retient l'eau et les sels minéraux du sol", "Brise-vent et corridor écologique", "Couvert végétal piégeant les nitrates en hiver"], pairs: { "Complexe argilo-humique": "Retient l'eau et les sels minéraux du sol", "Haie bocagère": "Brise-vent et corridor écologique", "CIPAN": "Couvert végétal piégeant les nitrates en hiver" }, exp: "Pédologie et biodiversité sont au cœur de la filière STAV." },
    ]},
    { id: "spectacle", name: "Arts de la Scène & Culture", icon: "🎭", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale"], allowedFilieres: ["s2tmd"], island: "Image/ile/spectacle.svg", lessons: [
        { title: "Catharsis antique", q: "Selon Aristote, comment appelle-t-on la purgation des passions vécue par le spectateur de tragédie ?", opts: ["La catharsis", "La didascalie", "La pantomime", "L'ellipse"], correct: 0, exp: "Dans La Poétique, la tragédie suscite terreur et pitié pour opérer la catharsis." },
        { title: "Côté cour / Côté jardin", q: "Au théâtre, vu depuis la salle (le public), quel côté est le « côté cour » ?", opts: ["La droite", "La gauche", "Le balcon supérieur", "La fosse d'orchestre"], correct: 0, exp: "Repère historique (Tuileries) : Jardin = Gauche, Cour = Droite (vus du public)." },
        { type: "vrai_faux", title: "Les didascalies", q: "Dans une pièce de théâtre, les didascalies sont les indications scéniques destinées à la mise en scène et ne sont pas dites par les acteurs.", correct: true, exp: "Vrai : elles précisent déplacements, intonations, costumes et décors." },
        { type: "texte_a_choix", title: "Théorie musicale", q: "Complète les bases du solfège.", textWithBlanks: "Un ___ hausse une note d'un demi-ton, tandis qu'un ___ l'abaisse d'un demi-ton.", choices: [["dièse (♯)", "bémol (♭)", "soupir"], ["bémol (♭)", "dièse (♯)", "point d'orgue"]], blanks: [["dièse (♯)"], ["bémol (♭)"]], exp: "Le bécarre (♮) annule ensuite l'altération." },
        { type: "drag_and_drop", title: "Figures de la scène", q: "Associe chaque créateur majeur à son art.", items: ["Molière", "Pina Bausch", "Igor Stravinsky"], targets: ["Comédie française du XVIIe siècle", "Tanztheater (danse contemporaine)", "Musique du Sacre du printemps"], pairs: { "Molière": "Comédie française du XVIIe siècle", "Pina Bausch": "Tanztheater (danse contemporaine)", "Igor Stravinsky": "Musique du Sacre du printemps" }, exp: "Théâtre, Danse et Musique dialoguent dans la filière S2TMD." },
    ]},
    { id: "hlp", name: "Humanités & Littérature (HLP)", icon: "📖", band: "lycee", allowedNiveaux: ["1ere", "terminale"], allowedFilieres: ["hlp_llce", "generale"], island: "Image/ile/hlp.svg", lessons: [
        { title: "Rhétorique d'Aristote", q: "Quels sont les trois piliers de la persuasion selon Aristote ?", opts: ["Éthos, Pathos, Logos", "Sujet, Verbe, Complément", "Acte, Scène, Prologue", "Thèse, Somme, Calcul"], correct: 0, exp: "Éthos (crédibilité de l'orateur), Pathos (émotions), Logos (raisonnement logique)." },
        { title: "Humanisme de Montaigne", q: "Quelle célèbre devise résume le doute critique de Michel de Montaigne dans les Essais ?", opts: ["Que sais-je ?", "Je pense donc je suis", "Alea jacta est", "Veni, vidi, vici"], correct: 0, exp: "Montaigne fait graver « Que sais-je ? » sur sa médaille en 1576." },
        { type: "vrai_faux", title: "Maïeutique socratique", q: "La maïeutique de Socrate consiste à questionner son interlocuteur pour l'aider à « accoucher » lui-même de la vérité.", correct: true, exp: "Vrai : Socrate comparait sa méthode philosophique au métier de sage-femme de sa mère." },
        { type: "texte_a_choix", title: "Banalité du mal & Lumières", q: "Complète ces repères majeurs du programme HLP.", textWithBlanks: "La philosophe ___ a forgé le concept de « banalité du mal », tandis que ___ critique les préjugés parisiens dans Les Lettres persanes.", choices: [["Hannah Arendt", "Olympe de Gouges", "George Sand"], ["Montesquieu", "Rabelais", "Baudelaire"]], blanks: [["Hannah Arendt"], ["Montesquieu"]], exp: "Deux auteurs incontournables d'HLP 1ère et Terminale." },
        { type: "drag_and_drop", title: "Œuvres clés HLP", q: "Associe chaque œuvre à son auteur.", items: ["Les Confessions", "Si c'est un homme", "1984"], targets: ["Jean-Jacques Rousseau", "Primo Levi", "George Orwell"], pairs: { "Les Confessions": "Jean-Jacques Rousseau", "Si c'est un homme": "Primo Levi", "1984": "George Orwell" }, exp: "Autobiographie, témoignage historique et dystopie sur le langage." },
    ]},
    { id: "dev_bdd", name: "Développement & BDD", icon: "🖥️", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["bts_sio", "nsi_spe"], island: "Image/ile/dev_bdd.svg", lessons: [
        { title: "Modélisation Merise", q: "Dans la méthode Merise (BTS SIO), quel modèle décrit les entités, associations et cardinalités avant le passage en tables ?", opts: ["Le MCD (Modèle Conceptuel de Données)", "Le TCP/IP", "Le CSS Grid", "Le BIOS"], correct: 0, exp: "MCD → MLD (Modèle Logique) → MPD (script SQL de création des tables)." },
        { title: "Intégrité référentielle SQL", q: "Quelle contrainte SQL garantit qu'une valeur d'une table correspond bien à une clé primaire d'une autre table ?", opts: ["FOREIGN KEY", "ORDER BY", "DISTINCT", "GROUP BY"], correct: 0, exp: "La clé étrangère (FOREIGN KEY) maintient la cohérence relationnelle entre tables." },
        { type: "vrai_faux", title: "Transactions ACID", q: "En SQL, la propriété Atomicité d'une transaction garantit que toutes les opérations réussissent ensemble ou sont toutes annulées (ROLLBACK).", correct: true, exp: "Vrai : ACID = Atomicité, Cohérence, Isolation, Durabilité." },
        { type: "texte_a_choix", title: "Architecture MVC & HTTP", q: "Complète ces standards de développement BTS SIO.", textWithBlanks: "En architecture MVC, le ___ gère les données et règles métier ; sur une API REST, le code HTTP ___ indique une ressource introuvable.", choices: [["Modèle", "Navigateur", "Style CSS"], ["404", "200", "201"]], blanks: [["Modèle"], ["404"]], exp: "MVC sépare les responsabilités ; 200 = OK, 201 = Créé, 404 = Introuvable." },
        { type: "drag_and_drop", title: "Git & Qualité logicielle", q: "Associe chaque outil ou commande à sa fonction.", items: ["git commit", "Test unitaire", "Docker"], targets: ["Enregistre un instantané dans l'historique local", "Vérifie automatiquement une fonction isolée", "Empaquette l'app et ses dépendances en conteneur"], pairs: { "git commit": "Enregistre un instantané dans l'historique local", "Test unitaire": "Vérifie automatiquement une fonction isolée", "Docker": "Empaquette l'app et ses dépendances en conteneur" }, exp: "Les fondamentaux du développeur moderne en BTS SIO SLAM." },
    ]},
    { id: "commerce", name: "Relation Client & Commerce", icon: "🛒", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["bts_mco"], island: "Image/ile/commerce.svg", lessons: [
        { title: "Zone de chalandise", q: "Que désigne la « zone de chalandise » d'un magasin ?", opts: ["L'aire géographique d'où proviennent ses clients actuels et potentiels", "La réserve arrière du point de vente", "La vitrine extérieure", "Le budget publicitaire"], correct: 0, exp: "Elle s'analyse souvent par courbes isochrones (temps d'accès en minutes)." },
        { title: "Argumentation CAP", q: "En vente conseil (BTS MCO), que signifie l'acronyme de la méthode CAP ?", opts: ["Caractéristique, Avantage, Preuve", "Client, Achat, Prix", "Caisse, Accueil, Promotion", "Catalogue, Article, Panier"], correct: 0, exp: "Un argument solide relie une caractéristique technique à un avantage client étayé par une preuve." },
        { type: "vrai_faux", title: "Merchandising en rayon", q: "En linéaire, le niveau des yeux et le niveau des mains sont les zones les plus vendeuses d'un rayon.", correct: true, exp: "Vrai : ce sont les niveaux privilégiés pour les produits à forte marge ou les marques phares." },
        { type: "texte_a_choix", title: "Indicateurs commerciaux", q: "Complète les formules clés d'une unité commerciale.", textWithBlanks: "Le ___ divise le CA par le nombre de clients acheteurs, tandis que le ___ mesure le pourcentage de visiteurs qui achètent.", choices: [["panier moyen", "facing", "NPS"], ["taux de transformation", "stock de sécurité", "loyer"]], blanks: [["panier moyen"], ["taux de transformation"]], exp: "Panier moyen = CA / Acheteurs ; Taux de transfo = (Acheteurs / Visiteurs) × 100." },
        { type: "drag_and_drop", title: "Techniques commerciales", q: "Associe chaque technique BTS MCO à son principe.", items: ["Cross-selling", "Up-selling", "Click & Collect"], targets: ["Proposer un article complémentaire", "Proposer un modèle de gamme supérieure", "Commander en ligne et retirer en magasin"], pairs: { "Cross-selling": "Proposer un article complémentaire", "Up-selling": "Proposer un modèle de gamme supérieure", "Click & Collect": "Commander en ligne et retirer en magasin" }, exp: "Des leviers clés de performance omnicanale en BTS MCO." },
    ]},
    { id: "comptabilite", name: "Comptabilité & Finance", icon: "🧮", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["bts_cg"], island: "Image/ile/comptabilite.svg", lessons: [
        { title: "Principe de la partie double", q: "Quelle égalité fondamentale doit vérifier CHAQUE écriture comptable ?", opts: ["Total Débit = Total Crédit", "Total Débit = 2 × Total Crédit", "TVA = Chiffre d'affaires", "Charges = Capital social"], correct: 0, exp: "La partie double impose que chaque emploi (débit) corresponde à une ressource égale (crédit)." },
        { title: "Classes du PCG", q: "Dans le Plan Comptable Général, quels comptes enregistrent les Charges et les Produits ?", opts: ["Classe 6 (Charges) et Classe 7 (Produits)", "Classe 1 et Classe 2", "Classe 4 et Classe 5", "Classe 8 et Classe 9"], correct: 0, exp: "Classes 1 à 5 = Bilan ; Classes 6 (Charges) et 7 (Produits) = Compte de résultat." },
        { type: "vrai_faux", title: "Équilibre du bilan", q: "Dans un bilan comptable, le Total de l'Actif est toujours strictement égal au Total du Passif.", correct: true, exp: "Vrai : le résultat net (bénéfice ou perte) au passif assure l'équilibre exact Actif = Passif." },
        { type: "texte_a_choix", title: "Comptes de tiers et banque", q: "Identifie les numéros de comptes clés du PCG.", textWithBlanks: "Le compte ___ enregistre les créances Clients, le compte ___ les dettes Fournisseurs et le compte ___ la Banque.", choices: [["411", "707", "101"], ["401", "512", "606"], ["512", "411", "218"]], blanks: [["411"], ["401"], ["512"]], exp: "411 Clients, 401 Fournisseurs, 512 Banques : les numéros les plus utilisés en BTS CG." },
        { type: "drag_and_drop", title: "Notions comptables BTS CG", q: "Associe chaque notion à sa définition.", items: ["TVA à décaisser", "Amortissement linéaire", "Rapprochement bancaire"], targets: ["TVA collectée moins TVA déductible", "Répartition constante du coût d'un bien sur sa durée", "Vérification entre compte 512 et relevé de banque"], pairs: { "TVA à décaisser": "TVA collectée moins TVA déductible", "Amortissement linéaire": "Répartition constante du coût d'un bien sur sa durée", "Rapprochement bancaire": "Vérification entre compte 512 et relevé de banque" }, exp: "Des fondamentaux de comptabilité générale et fiscale." },
    ]},
    { id: "electrotech", name: "Électrotechnique & Énergie", icon: "⚡", band: "lycee", allowedNiveaux: ["2nde", "1ere", "terminale", "bts1", "bts2"], allowedFilieres: ["bac_pro_melec"], island: "Image/ile/electrotech.svg", lessons: [
        { title: "Norme NF C 15-100", q: "Quelle norme française encadre les installations électriques basse tension dans les bâtiments ?", opts: ["NF C 15-100", "ISO 216", "HTTP/3", "NF Z 00-100"], correct: 0, exp: "La norme NF C 15-100 fixe les règles de sécurité, protections et sections de câbles." },
        { title: "Protection différentielle 30 mA", q: "Que protège prioritairement un interrupteur différentiel 30 mA dans un tableau électrique ?", opts: ["Les personnes contre l'électrocution lors d'une fuite de courant à la terre", "Uniquement les ampoules LED", "La vitesse du Wi-Fi", "La pression d'eau chaude"], correct: 0, exp: "Il détecte un déséquilibre phase/neutre > 30 mA et coupe quasi instantanément le circuit." },
        { type: "vrai_faux", title: "Code couleur normalisé", q: "En installation électrique NF C 15-100, le conducteur bleu clair est réservé au Neutre et le vert/jaune à la Terre (PE).", correct: true, exp: "Vrai : le respect strict du code couleur est vital pour la sécurité des intervenants." },
        { type: "texte_a_choix", title: "Réseau triphasé européen", q: "Complète les tensions standard en basse tension.", textWithBlanks: "Sur un réseau européen 50 Hz, la tension simple (phase-neutre) vaut ___ V et la tension composée (entre deux phases) vaut ___ V.", choices: [["230", "12", "110"], ["400", "230", "1000"]], blanks: [["230"], ["400"]], exp: "En triphasé équilibré : U = V × √3 = 230 × 1,732 ≈ 400 V." },
        { type: "drag_and_drop", title: "Appareillage électrique", q: "Associe chaque organe électrique à sa fonction.", items: ["Disjoncteur magnétothermique", "VAT", "Contacteur"], targets: ["Protège la ligne contre surcharges et courts-circuits", "Vérifie l'absence de tension lors d'une consignation", "Commande un circuit de puissance à distance"], pairs: { "Disjoncteur magnétothermique": "Protège la ligne contre surcharges et courts-circuits", "VAT": "Vérifie l'absence de tension lors d'une consignation", "Contacteur": "Commande un circuit de puissance à distance" }, exp: "Des compétences clés du technicien Bac Pro MELEC." },
    ]},
];

if (typeof AdminStore !== 'undefined' && AdminStore.registerDefaults) {
    AdminStore.registerDefaults(RAW_DASH_SUBJECTS);
}

// Cache mémoire des matières étendues par (niveau, filière) — évite de régénérer 36×100 leçons à chaque navigation
const _effectiveSubjectsCache = new Map();

/**
 * Retourne les matières effectives autorisées pour le niveau scolaire et la filière courants,
 * étendues jusqu'à 100 niveaux, avec les spécialités de la filière mises en avant.
 * Délègue strictement à AdminStore.isSubjectAllowedForNiveau(subject, niveau, filiere).
 */
function getEffectiveSubjects(niveau, filiere) {
    const currentNiv = niveau || currentNiveau();
    const currentFil = filiere || currentFiliere();
    const cacheKey = `${currentNiv}::${currentFil}`;
    const hasAdminCustom = (typeof AdminStore !== 'undefined' && typeof AdminStore.hasSubjectCustomizations === 'function')
        ? (() => {
            try { return Boolean(AdminStore.hasSubjectCustomizations()); }
            catch { return false; }
        })()
        : false;

    if (!hasAdminCustom && _effectiveSubjectsCache.has(cacheKey)) {
        return _effectiveSubjectsCache.get(cacheKey);
    }

    const raw = (typeof AdminStore !== 'undefined' && typeof AdminStore.applyOverrides === 'function')
        ? AdminStore.applyOverrides(RAW_DASH_SUBJECTS)
        : RAW_DASH_SUBJECTS;

    const filtered = raw.filter(s => {
        if (typeof AdminStore !== 'undefined' && typeof AdminStore.isSubjectAllowedForNiveau === 'function') {
            return AdminStore.isSubjectAllowedForNiveau(s, currentNiv, currentFil);
        }
        if (s.enabled === false) return false;
        if (Array.isArray(s.allowedNiveaux) && s.allowedNiveaux.length > 0) {
            return s.allowedNiveaux.includes(currentNiv);
        }
        const band = typeof QuestionBank !== 'undefined' ? QuestionBank.bandForNiveau(currentNiv) : 'college';
        const subBand = s.band || (s.id === 'techno' ? 'college' : (s.id === 'nsi' || s.id === 'ses' || s.id === 'philo' ? 'lycee' : 'all'));
        if (subBand === 'college' && band !== 'college') return false;
        if (subBand === 'lycee' && band !== 'lycee') return false;
        return true;
    });

    const isFiliereUsed = (typeof AdminStore !== 'undefined' && typeof AdminStore.isFiliereApplicable === 'function')
        ? AdminStore.isFiliereApplicable(currentNiv)
        : false;

    // Place les spécialités phares de la filière en tête de liste au lycée / BTS pour un accès immédiat
    if (isFiliereUsed && typeof AdminStore !== 'undefined' && typeof AdminStore.isSubjectSpecialtyForFiliere === 'function') {
        filtered.sort((a, b) => {
            const aSpec = AdminStore.isSubjectSpecialtyForFiliere(a, currentFil) ? 1 : 0;
            const bSpec = AdminStore.isSubjectSpecialtyForFiliere(b, currentFil) ? 1 : 0;
            return bSpec - aSpec;
        });
    }

    const extended = filtered.map(s => {
        const out = s._custom ? s : QuestionBank.extend(s, 100, currentNiv);
        out._isSpecialty = isFiliereUsed
            && typeof AdminStore !== 'undefined'
            && typeof AdminStore.isSubjectSpecialtyForFiliere === 'function'
            && AdminStore.isSubjectSpecialtyForFiliere(s, currentFil);
        return out;
    });

    if (!hasAdminCustom) {
        _effectiveSubjectsCache.set(cacheKey, extended);
    }
    return extended;
}

let DASH_SUBJECTS = getEffectiveSubjects();

const SUBJECT_TO_MATIERE = {
    maths:         { name: 'Mathématiques',          icon: 'maths.webp' },
    francais:      { name: 'Français',               icon: 'francais.webp' },
    histoire:      { name: 'Histoire',               icon: 'histoire.webp' },
    geo:           { name: 'Géographie',             icon: 'geo.svg' },
    svt:           { name: 'SVT',                    icon: 'svt.webp' },
    anglais:       { name: 'Anglais',                icon: 'anglais.webp' },
    espagnol:      { name: 'Espagnol',               icon: 'espagnol.svg' },
    physique:      { name: 'Physique',               icon: 'physique.webp' },
    chimie:        { name: 'Chimie',                 icon: 'chimie.svg' },
    techno:        { name: 'Technologie',            icon: 'technologie.webp' },
    arts:          { name: 'Arts & Musique',         icon: 'arts.svg' },
    philo:         { name: 'Philosophie',            icon: 'philo.svg' },
    emc:           { name: 'EMC',                    icon: 'emc.svg' },
    nsi:           { name: 'NSI & Numérique',        icon: 'nsi.svg' },
    ses:           { name: 'SES (Économie)',         icon: 'ses.svg' },
    hggsp:         { name: 'HGGSP (Géopolitique)',   icon: 'hggsp.svg' },
    si:            { name: "Sciences de l'Ingénieur",icon: 'si.svg' },
    msgn:          { name: 'Management & Gestion',   icon: 'msgn.svg' },
    droit_eco:     { name: 'Droit & Économie',       icon: 'droit_eco.svg' },
    mercatique:    { name: 'Mercatique (Marketing)', icon: 'mercatique.svg' },
    i2d:           { name: 'I2D (Innovation & Éco)', icon: 'i2d.svg' },
    sin:           { name: 'SIN (Info & Numérique)', icon: 'sin.svg' },
    cybersecurite: { name: 'Cybersécurité',          icon: 'cybersecurite.svg' },
    reseaux:       { name: 'Réseaux & Systèmes',     icon: 'reseaux.svg' },
    electronique:  { name: 'Électronique & Systèmes',       icon: 'electronique.svg' },
    stss:          { name: 'STSS (Santé & Social)',         icon: 'stss.svg' },
    biotech:       { name: 'Biotechnologies & Labo',        icon: 'biotech.svg' },
    design:        { name: 'Design & Arts Appliqués',       icon: 'design.svg' },
    hotellerie:    { name: 'Hôtellerie & Gastronomie',      icon: 'hotellerie.svg' },
    agronomie:     { name: 'Agronomie & Écologie',          icon: 'agronomie.svg' },
    spectacle:     { name: 'Arts de la Scène & Culture',    icon: 'spectacle.svg' },
    hlp:           { name: 'Humanités & Littérature (HLP)', icon: 'hlp.svg' },
    dev_bdd:       { name: 'Développement & BDD',           icon: 'dev_bdd.svg' },
    commerce:      { name: 'Relation Client & Commerce',    icon: 'commerce.svg' },
    comptabilite:  { name: 'Comptabilité & Finance',        icon: 'comptabilite.svg' },
    electrotech:   { name: 'Électrotechnique & Énergie',    icon: 'electrotech.svg' },
};

/**
 * Résout l'illustration de l'île flottante pour une matière (DASH_SUBJECTS).
 * Priorité : image personnalisée, island SVG/WebP du projet, ou fallback null.
 */
function getSubjectIslandSrc(subject) {
    if (!subject) return null;
    if (subject.image) return subject.image;
    if (subject.island) return subject.island;

    const iconStr = typeof subject.icon === 'string' ? subject.icon.trim() : '';
    if (iconStr && (iconStr.startsWith('http://') || iconStr.startsWith('https://') || iconStr.startsWith('data:') || /\.(png|webp|svg|jpg|jpeg)$/i.test(iconStr))) {
        if (iconStr.startsWith('http') || iconStr.startsWith('data:') || iconStr.startsWith('/') || iconStr.startsWith('Image/')) {
            return iconStr;
        }
        return 'Image/ile/' + iconStr;
    }

    if (subject._iconOverridden) return null;

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
        { id: 'premier_quiz', icon: '🎯', name: 'Premier pas', desc: 'Réussis ta toute première question.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 1' },
        { id: 'sans_faute', icon: '✨', name: 'Sans-faute', desc: 'Réponds juste du premier coup, sans réessayer.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'justAnsweredFirstTry' },
        { id: 'toutes_matieres', icon: '🌐', name: 'Touche-à-tout', desc: 'Termine au moins une leçon dans chaque matière de ton parcours.', category: 'exploration', band: 'all', allowedFilieres: ['all'], condition: 'allSubjectsStarted' },
        { id: 'matiere_complete', icon: '🏆', name: 'Expert(e)', desc: 'Termine au moins 5 leçons d\'une même matière.', category: 'maitrise', band: 'all', allowedFilieres: ['all'], condition: 'oneSubjectAdvanced' },
        { id: 'collectionneur', icon: '🎨', name: 'Collectionneur', desc: 'Possède 3 skins ou articles différents.', category: 'boutique', band: 'all', allowedFilieres: ['all'], condition: 'ownedSkins >= 3' },
        { id: 'niveau_5', icon: '🚀', name: 'Étoile montante', desc: 'Atteins le niveau 5 (400+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 5' },
        { id: 'niveau_10', icon: '👑', name: 'Grand Maître', desc: 'Atteins le niveau 10 (900+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 10' },
        { id: 'riche', icon: '💰', name: 'Bourse pleine', desc: 'Accumule au moins 100 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 100' },
        { id: 'magnat', icon: '🏦', name: 'Magnat d\'Eduquest', desc: 'Accumule au moins 250 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 250' },
        { id: 'alchimiste', icon: '🧪', name: 'Alchimiste', desc: 'Achète ou possède une potion magique.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'hasBooster' },
        { id: 'potion_double_xp', icon: '⚡', name: 'Surtension', desc: 'Utilise une Potion Double XP.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'usedDoubleXp' },
        { id: 'bouclier_etoile', icon: '🛡️', name: 'Invulnérable', desc: 'Utilise un Bouclier d\'Étoile pour protéger un score parfait.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'usedShield' },
        { id: 'maths_fan', icon: '📐', name: 'Arithméticien', desc: 'Atteins le niveau 5 en Mathématiques.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'mathsLevel >= 5' },
        { id: 'francais_fan', icon: '📚', name: 'Littéraire', desc: 'Atteins le niveau 5 en Français.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'francaisLevel >= 5' },
        { id: 'histoire_fan', icon: '📜', name: 'Chroniqueur', desc: 'Atteins le niveau 5 en Histoire.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'histoireLevel >= 5' },
        { id: 'explorateur_geo', icon: '🌍', name: 'Cartographe', desc: 'Atteins le niveau 5 en Géographie.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'geoLevel >= 5' },
        { id: 'polyglotte', icon: '🇬🇧', name: 'Polyglotte', desc: 'Atteins le niveau 5 en Anglais.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'anglaisLevel >= 5' },
        { id: 'citoyen', icon: '⚖️', name: 'Citoyen Éclairé', desc: 'Atteins le niveau 5 en EMC.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'emcLevel >= 5' },
        { id: 'fashion_victim', icon: '✨', name: 'Aura Éclatante', desc: 'Équipe une aura scintillante pour ton avatar.', category: 'personnalisation', band: 'all', allowedFilieres: ['all'], condition: 'auraEquipped' },
        { id: 'theme_custom', icon: '🎭', name: 'Nouveau Décor', desc: 'Applique un thème visuel personnalisé.', category: 'personnalisation', band: 'all', allowedFilieres: ['all'], condition: 'themeEquipped' },
        { id: 'streak_3', icon: '🔥', name: 'Série Ardente', desc: 'Réussis 3 leçons d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 3' },
        { id: 'streak_5', icon: '⚡', name: 'Inarrêtable', desc: 'Atteins une série de 5 victoires d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 5' },
        { id: 'combo_5', icon: '👑', name: 'Maître du Combo', desc: 'Enchaîne 5 bonnes réponses consécutives.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'comboCount >= 5' },
        { id: 'queteur', icon: '📋', name: 'Assidu', desc: 'Réclame une récompense de quête journalière.', category: 'quetes', band: 'all', allowedFilieres: ['all'], condition: 'questClaimed' },
        { id: 'coffre_ouvert', icon: '🎁', name: 'Chasseur de Trésor', desc: 'Ouvre le coffre quotidien bonus.', category: 'quetes', band: 'all', allowedFilieres: ['all'], condition: 'dailyChestOpened' },
        { id: 'technophile', icon: '💻', name: 'Technophile', desc: 'Atteins le niveau 5 en Technologie (Collège).', category: 'matieres', band: 'college', allowedFilieres: ['all'], condition: 'technoLevel >= 5' },
        { id: 'sciences_fan', icon: '🔬', name: 'Scientifique', desc: 'Atteins le niveau 5 en SVT, Physique ou Chimie.', category: 'matieres', band: 'all', allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'st2s'], condition: 'scienceLevel >= 5' },
        { id: 'hispanophone', icon: '🇪🇸', name: 'Hispanophone', desc: 'Atteins le niveau 5 en Espagnol (LV2).', category: 'matieres', band: 'all', allowedFilieres: ['generale', 'stmg', 'st2s'], condition: 'espagnolLevel >= 5' },
        { id: 'artiste_melomane', icon: '🎨', name: 'Esprit Créatif', desc: 'Atteins le niveau 5 en Arts & Musique.', category: 'matieres', band: 'all', allowedFilieres: ['generale'], condition: 'artsLevel >= 5' },
        { id: 'philo_fan', icon: '🏛️', name: 'Penseur Antique', desc: 'Atteins le niveau 5 en Philosophie.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'stmg', 'sti2d', 'st2s'], condition: 'philoLevel >= 5' },
        { id: 'geopoliticien', icon: '🗺️', name: 'Géopoliticien', desc: 'Atteins le niveau 5 en HGGSP (Géopolitique).', category: 'matieres', band: 'lycee', allowedFilieres: ['generale'], condition: 'hggspLevel >= 5' },
        { id: 'economiste_ses', icon: '💹', name: 'Économiste SES', desc: 'Atteins le niveau 5 en SES (Économie & Sociologie).', category: 'matieres', band: 'lycee', allowedFilieres: ['generale'], condition: 'sesLevel >= 5' },
        { id: 'nsi_fan', icon: '💻', name: 'Codeur NSI', desc: 'Atteins le niveau 5 en NSI & Numérique.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel'], condition: 'nsiLevel >= 5' },
        { id: 'ciel_fan', icon: '🛡️', name: 'Expert CIEL', desc: 'Atteins le niveau 5 en Cybersécurité, Réseaux ou Électronique.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe'], condition: 'cielLevel >= 5' },
        { id: 'cyber_gardien', icon: '🔐', name: 'Gardien Cyber', desc: 'Atteins le niveau 5 en Cybersécurité.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe'], condition: 'cyberLevel >= 5' },
        { id: 'architecte_reseau', icon: '🌐', name: 'Architecte Réseau', desc: 'Atteins le niveau 5 en Réseaux & Systèmes.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe'], condition: 'reseauxLevel >= 5' },
        { id: 'maitre_electronique', icon: '🔌', name: 'Maître des Circuits', desc: 'Atteins le niveau 5 en Électronique & Systèmes.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'sti2d'], condition: 'electroniqueLevel >= 5' },
        { id: 'stmg_fan', icon: '📊', name: 'Manager STMG', desc: 'Atteins le niveau 5 en MSGN, Droit-Éco ou Mercatique.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg'], condition: 'stmgLevel >= 5' },
        { id: 'juriste_junior', icon: '⚖️', name: 'Juriste Junior', desc: 'Atteins le niveau 5 en Droit & Économie.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg', 'ciel'], condition: 'droitEcoLevel >= 5' },
        { id: 'as_mercatique', icon: '📈', name: 'As du Marketing', desc: 'Atteins le niveau 5 en Mercatique.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg'], condition: 'mercatiqueLevel >= 5' },
        { id: 'sti2d_fan', icon: '⚙️', name: 'Ingénieur STI2D', desc: 'Atteins le niveau 5 en I2D, SIN ou Sciences de l\'Ingénieur.', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d'], condition: 'sti2dLevel >= 5' },
        { id: 'eco_concepteur', icon: '🌿', name: 'Éco-Concepteur', desc: 'Atteins le niveau 5 en I2D (Innovation & Éco).', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d'], condition: 'i2dLevel >= 5' },
        { id: 'dompteur_signaux', icon: '📡', name: 'Dompteur de Signaux', desc: 'Atteins le niveau 5 en SIN (Info & Numérique).', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d'], condition: 'sinLevel >= 5' },
        { id: 'ingenieur_systeme', icon: '📐', name: 'Ingénieur Système', desc: 'Atteins le niveau 5 en Sciences de l\'Ingénieur.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'sti2d'], condition: 'siLevel >= 5' },
        { id: 'st2s_fan', icon: '🩺', name: 'Spécialiste ST2S', desc: 'Atteins le niveau 5 en STSS.', category: 'matieres', band: 'lycee', allowedFilieres: ['st2s'], condition: 'stssLevel >= 5' },
        { id: 'acteur_sante', icon: '🏥', name: 'Acteur de Santé', desc: 'Atteins le niveau 10 en STSS (Santé & Social).', category: 'matieres', band: 'lycee', allowedFilieres: ['st2s'], condition: 'stssLevel >= 10' },
    ];

function comboTierName(combo) {
    if (!combo || combo <= 1) return 'Multiplicateur standard (+0%)';
    if (combo === 2) return 'Énergie chargée (+20%) ⚡';
    if (combo === 3) return 'Haute tension (+40%) ⚡';
    if (combo === 4) return 'Surtension ! (+60%) ⚡⚡';
    if (combo < 10) return 'Supercharge ! (+100%) 👑';
    return 'Énergie légendaire ! (+150%) 🌌';
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
        if (count === 0 && extra && extra.dashProgress && extra.dashProgress[s.id]) {
            count = extra.dashProgress[s.id];
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
                pass = (extra.streakCount >= 3) || (typeof DB !== 'undefined' && DB.getStreak && DB.getStreak() >= 3);
                break;
            case 'streak_5':
                pass = (extra.streakCount >= 5) || (typeof DB !== 'undefined' && DB.getStreak && DB.getStreak() >= 5);
                break;
            case 'streak_10':
                pass = (extra.streakCount >= 10) || (typeof DB !== 'undefined' && DB.getStreakData && Math.max(DB.getStreakData().count || 0, DB.getStreakData().best || 0) >= 10);
                break;
            case 'streak_20':
                pass = (extra.streakCount >= 20) || (typeof DB !== 'undefined' && DB.getStreakData && Math.max(DB.getStreakData().count || 0, DB.getStreakData().best || 0) >= 20);
                break;
            case 'combo_5':
                pass = (extra.comboCount >= 5) || (extra.maxCombo >= 5) || (typeof DB !== 'undefined' && DB.getStreakData && DB.getStreakData().maxCombo >= 5);
                break;
            case 'combo_10':
                pass = (extra.comboCount >= 10) || (extra.maxCombo >= 10) || (typeof DB !== 'undefined' && DB.getStreakData && DB.getStreakData().maxCombo >= 10);
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
            case 'vingt_cinq_niveaux':
                pass = totalCompleted >= 25;
                break;
            case 'cinquante_niveaux':
                pass = totalCompleted >= 50;
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
            case 'perfectionniste_25':
                pass = threeStarCount >= 25;
                break;
            case 'premier_achat':
                pass = ownedSkins.length > 2 || !!extra.boughtSkin || !!extra.boughtBooster || totalBoostersAcquired > 0;
                break;
            case 'collectionneur':
                pass = ownedSkins.length >= 3;
                break;
            case 'garde_robe_10':
                pass = ownedSkins.length >= 10;
                break;
            case 'musee_20':
                pass = ownedSkins.length >= 20;
                break;
            case 'fashion_victim':
                pass = (equippedAura && equippedAura !== 'aurore') || ownedSkins.length >= 3 || !!extra.auraEquipped || !!extra.boughtSkin;
                break;
            case 'theme_custom':
                pass = (theme && theme !== 'default') || (extra.theme && extra.theme !== 'default') || !!extra.themeEquipped;
                break;
            case 'titre_equipe':
                pass = Boolean(DB.getOption('dash_equippedTitle')) || !!extra.titleEquipped;
                break;
            case 'niveau_5':
                pass = playerLevel >= 5;
                break;
            case 'niveau_10':
                pass = playerLevel >= 10;
                break;
            case 'niveau_15':
                pass = playerLevel >= 15;
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
            case 'tresorier_500':
                pass = coins >= 500;
                break;
            case 'milliardaire_1000':
                pass = coins >= 1000;
                break;
            case 'alchimiste':
            case 'potion_xp':
                pass = hasAnyBooster;
                break;
            case 'potion_double_xp':
                pass = !!extra.usedDoubleXp || extra.usedBooster === 'boost-xp' || ((boostersHistory.used && boostersHistory.used['boost-xp']) > 0);
                break;
            case 'potion_fortune':
                pass = !!extra.usedDoubleCoins || extra.usedBooster === 'boost-coins' || ((boostersHistory.used && boostersHistory.used['boost-coins']) > 0);
                break;
            case 'bouclier_etoile':
            case 'potion_shield':
                pass = !!extra.usedShield || extra.usedBooster === 'boost-shield' || ((boostersHistory.used && boostersHistory.used['boost-shield']) > 0);
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
                pass = (completedPerSubject['svt'] || 0) >= 5 || (completedPerSubject['physique'] || 0) >= 5 || (completedPerSubject['chimie'] || 0) >= 5;
                break;
            case 'philo_fan':
            case 'maitre_philo':
                pass = (completedPerSubject['philo'] || 0) >= 5;
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
            case 'nsi_fan':
                pass = (completedPerSubject['nsi'] || 0) >= 5;
                break;
            case 'stmg_fan':
                pass = (completedPerSubject['msgn'] || 0) >= 5 || (completedPerSubject['droit_eco'] || 0) >= 5 || (completedPerSubject['mercatique'] || 0) >= 5;
                break;
            case 'sti2d_fan':
                pass = (completedPerSubject['i2d'] || 0) >= 5 || (completedPerSubject['sin'] || 0) >= 5 || (completedPerSubject['si'] || 0) >= 5;
                break;
            case 'ciel_fan':
                pass = (completedPerSubject['cybersecurite'] || 0) >= 5 || (completedPerSubject['reseaux'] || 0) >= 5 || (completedPerSubject['electronique'] || 0) >= 5;
                break;
            case 'st2s_fan':
                pass = (completedPerSubject['stss'] || 0) >= 5;
                break;
            case 'hispanophone':
                pass = (completedPerSubject['espagnol'] || 0) >= 5;
                break;
            case 'explorateur_geo':
                pass = (completedPerSubject['geo'] || 0) >= 5;
                break;
            case 'artiste_melomane':
                pass = (completedPerSubject['arts'] || 0) >= 5;
                break;
            case 'geopoliticien':
                pass = (completedPerSubject['hggsp'] || 0) >= 5;
                break;
            case 'economiste_ses':
                pass = (completedPerSubject['ses'] || 0) >= 5;
                break;
            case 'cyber_gardien':
                pass = (completedPerSubject['cybersecurite'] || 0) >= 5;
                break;
            case 'architecte_reseau':
                pass = (completedPerSubject['reseaux'] || 0) >= 5;
                break;
            case 'maitre_electronique':
                pass = (completedPerSubject['electronique'] || 0) >= 5;
                break;
            case 'juriste_junior':
                pass = (completedPerSubject['droit_eco'] || 0) >= 5;
                break;
            case 'as_mercatique':
                pass = (completedPerSubject['mercatique'] || 0) >= 5;
                break;
            case 'eco_concepteur':
                pass = (completedPerSubject['i2d'] || 0) >= 5;
                break;
            case 'dompteur_signaux':
                pass = (completedPerSubject['sin'] || 0) >= 5;
                break;
            case 'ingenieur_systeme':
                pass = (completedPerSubject['si'] || 0) >= 5;
                break;
            case 'acteur_sante':
                pass = (completedPerSubject['stss'] || 0) >= 10;
                break;
            case 'stl_biotech':
                pass = (completedPerSubject['biotech'] || 0) >= 5;
                break;
            case 'stl_expert':
                pass = Math.max(completedPerSubject['biotech'] || 0, completedPerSubject['chimie'] || 0) >= 10;
                break;
            case 'std2a_design':
                pass = (completedPerSubject['design'] || 0) >= 5;
                break;
            case 'sthr_chef':
                pass = (completedPerSubject['hotellerie'] || 0) >= 5;
                break;
            case 'stav_agronome':
                pass = (completedPerSubject['agronomie'] || 0) >= 5;
                break;
            case 's2tmd_virtuose':
                pass = (completedPerSubject['spectacle'] || 0) >= 5;
                break;
            case 'hlp_orateur':
                pass = (completedPerSubject['hlp'] || 0) >= 5;
                break;
            case 'sciences_spe_crack':
                pass = Math.max(completedPerSubject['maths'] || 0, completedPerSubject['physique'] || 0, completedPerSubject['chimie'] || 0, completedPerSubject['svt'] || 0) >= 10;
                break;
            case 'sio_architecte':
                pass = (completedPerSubject['dev_bdd'] || 0) >= 5;
                break;
            case 'mco_negociateur':
                pass = (completedPerSubject['commerce'] || 0) >= 5;
                break;
            case 'cg_auditeur':
                pass = (completedPerSubject['comptabilite'] || 0) >= 5;
                break;
            case 'melec_technicien':
                pass = (completedPerSubject['electrotech'] || 0) >= 5;
                break;
            case 'assp_bienveillant':
                pass = Math.max(completedPerSubject['stss'] || 0, completedPerSubject['biotech'] || 0) >= 5;
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
            else if (cond === 'usedDoubleXp' && (!!extra.usedDoubleXp || extra.usedBooster === 'boost-xp' || (boostersHistory.used && boostersHistory.used['boost-xp'] > 0))) pass = true;
            else if (cond === 'usedDoubleCoins' && (!!extra.usedDoubleCoins || extra.usedBooster === 'boost-coins' || (boostersHistory.used && boostersHistory.used['boost-coins'] > 0))) pass = true;
            else if (cond === 'usedShield' && (!!extra.usedShield || extra.usedBooster === 'boost-shield' || (boostersHistory.used && boostersHistory.used['boost-shield'] > 0))) pass = true;
            else if (cond === 'questClaimed' && !!extra.questClaimed) pass = true;
            else if (cond === 'dailyChestOpened' && !!extra.dailyChestOpened) pass = true;
            else if (cond === 'justAnsweredFirstTry' && (!!extra.justAnsweredFirstTry || extra.starsEarned === 3)) pass = true;
            else if (cond === 'auraEquipped' && ((equippedAura && equippedAura !== 'aurore') || !!extra.auraEquipped || !!extra.boughtSkin)) pass = true;
            else if (cond === 'themeEquipped' && ((theme && theme !== 'default') || (extra.theme && extra.theme !== 'default') || !!extra.themeEquipped)) pass = true;
            else if (cond === 'titleEquipped' && (Boolean(DB.getOption('dash_equippedTitle')) || !!extra.titleEquipped)) pass = true;
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
                    geoLevel: completedPerSubject['geo'] || 0,
                    scienceLevel: Math.max(completedPerSubject['svt'] || 0, completedPerSubject['physique'] || 0, completedPerSubject['chimie'] || 0),
                    sciencesSpeLevel: Math.max(completedPerSubject['maths'] || 0, completedPerSubject['physique'] || 0, completedPerSubject['chimie'] || 0, completedPerSubject['svt'] || 0),
                    philoLevel: completedPerSubject['philo'] || 0,
                    anglaisLevel: completedPerSubject['anglais'] || 0,
                    espagnolLevel: completedPerSubject['espagnol'] || 0,
                    artsLevel: completedPerSubject['arts'] || 0,
                    emcLevel: completedPerSubject['emc'] || 0,
                    technoLevel: completedPerSubject['techno'] || 0,
                    nsiLevel: completedPerSubject['nsi'] || 0,
                    sesLevel: completedPerSubject['ses'] || 0,
                    hggspLevel: completedPerSubject['hggsp'] || 0,
                    siLevel: completedPerSubject['si'] || 0,
                    msgnLevel: completedPerSubject['msgn'] || 0,
                    droitEcoLevel: completedPerSubject['droit_eco'] || 0,
                    mercatiqueLevel: completedPerSubject['mercatique'] || 0,
                    i2dLevel: completedPerSubject['i2d'] || 0,
                    sinLevel: completedPerSubject['sin'] || 0,
                    cyberLevel: completedPerSubject['cybersecurite'] || 0,
                    reseauxLevel: completedPerSubject['reseaux'] || 0,
                    electroniqueLevel: completedPerSubject['electronique'] || 0,
                    stmgLevel: Math.max(completedPerSubject['msgn'] || 0, completedPerSubject['droit_eco'] || 0, completedPerSubject['mercatique'] || 0),
                    sti2dLevel: Math.max(completedPerSubject['i2d'] || 0, completedPerSubject['sin'] || 0, completedPerSubject['si'] || 0),
                    cielLevel: Math.max(completedPerSubject['cybersecurite'] || 0, completedPerSubject['reseaux'] || 0, completedPerSubject['electronique'] || 0),
                    stssLevel: completedPerSubject['stss'] || 0,
                    biotechLevel: completedPerSubject['biotech'] || 0,
                    stlLevel: Math.max(completedPerSubject['biotech'] || 0, completedPerSubject['chimie'] || 0),
                    asspLevel: Math.max(completedPerSubject['stss'] || 0, completedPerSubject['biotech'] || 0),
                    designLevel: completedPerSubject['design'] || 0,
                    hotellerieLevel: completedPerSubject['hotellerie'] || 0,
                    agronomieLevel: completedPerSubject['agronomie'] || 0,
                    spectacleLevel: completedPerSubject['spectacle'] || 0,
                    hlpLevel: completedPerSubject['hlp'] || 0,
                    devBddLevel: completedPerSubject['dev_bdd'] || 0,
                    commerceLevel: completedPerSubject['commerce'] || 0,
                    comptabiliteLevel: completedPerSubject['comptabilite'] || 0,
                    electrotechLevel: completedPerSubject['electrotech'] || 0,
                    hasBooster: hasAnyBooster ? 1 : 0,
                    usedDoubleXp: (extra.usedDoubleXp || extra.usedBooster === 'boost-xp') ? 1 : 0,
                    usedDoubleCoins: (extra.usedDoubleCoins || extra.usedBooster === 'boost-coins') ? 1 : 0,
                    usedShield: (extra.usedShield || extra.usedBooster === 'boost-shield') ? 1 : 0,
                    streakCount: (typeof extra.streakCount === 'number') ? extra.streakCount : ((typeof DB !== 'undefined' && DB.getStreak) ? DB.getStreak() : 0),
                    comboCount: (typeof extra.comboCount === 'number') ? extra.comboCount : ((typeof DB !== 'undefined' && DB.getCombo) ? DB.getCombo() : 0),
                    maxCombo: (typeof extra.maxCombo === 'number') ? extra.maxCombo : ((typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData().maxCombo : 0),
                    totalScore: (typeof extra.totalScore === 'number') ? extra.totalScore : parseInt((typeof DB !== 'undefined' && DB.getOption) ? (DB.getOption('dash_total_score') || '0') : '0', 10)
                };
                // Supporte aussi toute matière personnalisée via <subjectId>Level
                Object.keys(completedPerSubject).forEach(sid => {
                    const k = sid + 'Level';
                    if (!(k in ctx)) ctx[k] = completedPerSubject[sid] || 0;
                });
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
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
            AudioManager.playSfx('unlock');
        }
    }

    return newlyUnlocked;
}
window.checkBadges = checkBadges;

function initDashboard() {
    const dashApp = document.getElementById('dashboard-app');
    if (!dashApp) return; // Pas sur la page dashboard.html → on sort

    function getShopCatalog() {
        return getShopCatalogSafe();
    }

    /* ============ ÉTAT PERSISTÉ ============ */

    /**
     * Charge l'état du dashboard depuis localStorage via DB.
     * Toutes les valeurs sont des strings dans DB, on les parse ici.
     */
    function loadState() {
        const savedSkin = getOption('dash_equippedSkin') || 'aurore';
        const savedAura = getOption('dash_equippedAura');
        const catalog = getShopCatalog();
        const curItem = catalog.find(s => s.id === savedSkin);
        const curCat = curItem ? (curItem.category || 'aura') : 'aura';

        const equippedAura = savedAura || (curCat === 'aura' ? savedSkin : 'aurore');
        const equippedAvatar = getEquippedAvatarId();
        const equippedTheme = getOption('dash_equippedTheme') || 'default';
        document.documentElement.setAttribute('data-theme', equippedTheme);

        let parsedProgress = {};
        try {
            parsedProgress = JSON.parse(getOption('dash_progress') || '{}') || {};
        } catch { parsedProgress = {}; }

        return {
            coins:          parseInt(getOption('dash_coins') || '30', 10),
            xp:             parseInt(getOption('dash_xp') || '0', 10),
            equippedSkin:   savedSkin,
            equippedAura:   equippedAura,
            equippedAvatar: equippedAvatar,
            equippedTitle:  getOption('dash_equippedTitle') || '',
            equippedTheme:  equippedTheme,
            ownedSkins:     getOwnedSkinsSafe(),
            shopCategory:   'all',
            subjectFilter:  'all',
            badgeShowAll:   false,
            badgeFiliereFilter: 'mine', // 'mine' | 'all' | 'universal' | 'college' | <filiereId>
            badgeStatusFilter:  'all',  // 'all' | 'unlocked' | 'locked'
            badgeSort:      'relevance',// 'relevance' | 'unlocked_first' | 'locked_first' | 'filiere' | 'alpha'
            questsCollapsed: getOption('dash_quests_collapsed') === 'true',
            bottomNavHidden: getOption('mobile_bottom_nav_hidden') === 'true',
            view:           'dashboard', // Toujours revenir au dashboard au chargement
            currentSubject: null,
            progress:       parsedProgress,
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
    // Lien direct vers la boutique (ex: depuis le sélecteur d'avatar de la carte)
    if (window.location.hash === '#boutique-avatars' || window.location.hash === '#boutique' || window.location.hash === '#shop') {
        state.view = 'shop';
        state.shopCategory = (window.location.hash === '#boutique-avatars') ? 'avatar' : 'all';
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* ignore */ }
    }
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
        return (item && isSafeAvatarImgSrc(item.img)) ? item.img : null;
    }
    function level() { return Math.floor(state.xp / 100) + 1; }
    function xpInLevel() { return state.xp % 100; }

    function triggerBadgesCheck(extra = {}) {
        const unlocked = checkBadges({ dashProgress: state.progress, ...extra });
        state.badges = DB.getBadges();
        return unlocked;
    }
    // Validation passive immédiate de tous les succès existants au démarrage
    triggerBadgesCheck();

    /* ============ RENDU ============ */

    let _lastDashSyncSig = '';
    function computeDashSyncSig() {
        return [
            currentNiveau(),
            currentFiliere(),
            getOption('dash_xp') || '0',
            getOption('dash_coins') || '30',
            getOption('dash_equippedTheme') || 'default',
            getOption('dash_equippedAvatar') || 'robot',
            getOption('dash_equippedAura') || 'aurore',
        ].join('|');
    }

    /** Point d'entrée du rendu — reconstruit tout le contenu de #dashboard-app */
    function render() {
        document.documentElement.style.setProperty('--dash-skin', skinColor(state.equippedAura));
        document.documentElement.setAttribute('data-theme', state.equippedTheme || 'default');
        if (document.body) {
            document.body.classList.toggle('bnav-collapsed', Boolean(state.bottomNavHidden));
        }
        _lastDashSyncSig = computeDashSyncSig();
        dashApp.innerHTML = `
            ${renderHeader()}
            ${renderHud()}
            ${renderTabs()}
            ${state.view === 'dashboard' ? renderDashboard() : ''}
            ${state.view === 'map' ? renderMap() : ''}
            ${state.view === 'shop' ? renderShop() : ''}
            ${state.view === 'badges' ? renderBadges() : ''}
            <div class="dash-footer-note">EDUQUEST — Contenus alignés sur les programmes officiels.</div>
        `;
        if (state.quiz) renderQuizModal();
    }

    function renderHeader() {
        const user = DB.getCurrentUser();
        const greeting = user ? `<span class="dash-user-greeting">Salut, ${escapeHtml(user.username)} 👋</span>` : '';

        // --- Sélecteur de classe (6ème → Terminale + BTS) ---
        const niveaux = (window.AdminStore && typeof AdminStore.getNiveauxScolaires === 'function')
            ? AdminStore.getNiveauxScolaires()
            : [
                { id: '6eme', label: '6ème' },
                { id: '5eme', label: '5ème' },
                { id: '4eme', label: '4ème' },
                { id: '3eme', label: '3ème' },
                { id: '2nde', label: '2nde' },
                { id: '1ere', label: '1ère' },
                { id: 'terminale', label: 'Terminale' },
                { id: 'bts1', label: 'BTS 1ère année' },
                { id: 'bts2', label: 'BTS 2ème année' },
            ];
        const curNiv = currentNiveau();
        const optionsHtml = niveaux.map(n => {
            const label = n.label || n.name || n.id;
            const isSelected = n.id === curNiv;
            return `<option value="${escapeHtml(n.id)}"${isSelected ? ' selected' : ''}>🎓 ${escapeHtml(label)}</option>`;
        }).join('');

        // --- Sélecteur de filière (Lycée & BTS : Générale, NSI, STMG, STI2D, CIEL, ST2S) ---
        const showFiliere = (typeof AdminStore !== 'undefined' && typeof AdminStore.isFiliereApplicable === 'function')
            ? AdminStore.isFiliereApplicable(curNiv)
            : ['2nde', '1ere', 'terminale', 'bts1', 'bts2'].includes(curNiv);
        let filiereSelectHtml = '';
        if (showFiliere) {
            const filieres = (typeof AdminStore !== 'undefined' && typeof AdminStore.getActiveFilieres === 'function')
                ? AdminStore.getActiveFilieres()
                : (typeof AdminStore !== 'undefined' && typeof AdminStore.getFilieres === 'function'
                    ? AdminStore.getFilieres()
                    : [{ id: 'generale', label: 'Voie Générale', icon: '📚' }]);
            const curFil = currentFiliere();
            const filOpts = filieres.map(f => {
                const selected = f.id === curFil ? ' selected' : '';
                return `<option value="${escapeHtml(f.id)}"${selected}>${escapeHtml(f.icon || '🧭')} ${escapeHtml(f.shortLabel || f.label)}</option>`;
            }).join('');
            filiereSelectHtml = `
                <select class="dash-grade-select dash-filiere-select" id="dashFiliereSelect" ${state.quiz ? 'disabled title="Changement de filière verrouillé pendant un exercice"' : ''} onchange="window._dashChangeFiliere(this.value)" aria-label="Choisir sa filière">
                    ${filOpts}
                </select>`;
        }

        return `<header class="dash-header">
            <div class="dash-header-left">
                <div class="dash-brand"><b>EDU</b><span>QUEST</span></div>
                <div class="dash-header-controls">
                    <select class="dash-grade-select" id="dashGradeSelect" ${state.quiz ? 'disabled title="Changement de classe verrouillé pendant un exercice"' : ''} onchange="window._dashChangeNiveau(this.value)" aria-label="Choisir sa classe">
                        ${optionsHtml}
                    </select>
                    ${filiereSelectHtml}
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
        const statsPillsHtml = renderStreakAndComboPillsHtml(streakData);

        const hudAvatarImg = skinImage(state.equippedAvatar);
        return `<div class="dash-hud">
            <div class="dash-avatar" style="--dash-skin:${escapeHtml(skinColor(state.equippedAura))}">${hudAvatarImg ? `<img src="${escapeHtml(hudAvatarImg)}" alt="Avatar">` : `N${level()}`}</div>
            <div class="dash-hud-mid">
                <div class="dash-hud-level">Niveau ${level()} <span class="mono">· ${pct}/100 XP</span> ${titleBadge}</div>
                <div class="dash-xp-track"><div class="dash-xp-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="dash-hud-right">
                ${statsPillsHtml}
                <div class="dash-coins" title="Pièces d'or disponibles en boutique"><span class="dash-coin-dot"></span>${state.coins}</div>
            </div>
        </div>`;
    }

    function isBadgeForCurrentTrack(badge, curNiv, curFil) {
        if (typeof AdminStore !== 'undefined' && typeof AdminStore.isBadgeRelevantFor === 'function') {
            return AdminStore.isBadgeRelevantFor(badge, curNiv, curFil);
        }
        return true;
    }

    function renderTabs() {
        const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : {};
        const showShop = siteCfg.enableShop !== false;
        const showBadges = siteCfg.enableBadges !== false;

        const curNiv = currentNiveau();
        const curFil = currentFiliere();
        const allCatalog = getBadgesCatalog();
        const myCatalog = allCatalog.filter(b => isBadgeForCurrentTrack(b, curNiv, curFil));
        const unlockedIds = (typeof DB !== 'undefined' && DB.getBadges) ? DB.getBadges() : state.badges;
        const myUnlockedCount = myCatalog.filter(b => unlockedIds.includes(b.id)).length;
        const navHidden = Boolean(state.bottomNavHidden);
        return `
        <!-- Onglets bureau classiques -->
        <nav class="dash-tabs" aria-label="Navigation principale">
            <button class="dash-tab ${state.view === 'dashboard' || state.view === 'map' ? 'active' : ''}" onclick="window._dashGoDashboard()">🏝️ Matières</button>
            ${showShop ? `<button class="dash-tab ${state.view === 'shop' ? 'active' : ''}" onclick="window._dashGoShop()">🛍️ Boutique</button>` : ''}
            ${showBadges ? `<button class="dash-tab ${state.view === 'badges' ? 'active' : ''}" onclick="window._dashGoBadges()">🏆 Succès (${myUnlockedCount}/${myCatalog.length})</button>` : ''}
        </nav>

        <!-- Barre de navigation inférieure ergonomique et repliable pour mobile -->
        <nav class="dash-bottom-nav ${navHidden ? 'is-collapsed' : ''}" aria-label="Navigation mobile" ${navHidden ? 'aria-hidden="true"' : ''}>
            <button type="button" class="dash-bnav-item ${state.view === 'dashboard' || state.view === 'map' ? 'active' : ''}" onclick="window._dashGoDashboard()" aria-label="Matières">
                <span class="dash-bnav-icon">🏝️</span>
                <span class="dash-bnav-label">Matières</span>
            </button>
            ${showShop ? `<button type="button" class="dash-bnav-item ${state.view === 'shop' ? 'active' : ''}" onclick="window._dashGoShop()" aria-label="Boutique">
                <span class="dash-bnav-icon">🛍️</span>
                <span class="dash-bnav-label">Boutique</span>
            </button>` : ''}
            ${showBadges ? `<button type="button" class="dash-bnav-item ${state.view === 'badges' ? 'active' : ''}" onclick="window._dashGoBadges()" aria-label="Succès">
                <span class="dash-bnav-icon">
                    🏆
                    <span class="dash-bnav-badge">${myUnlockedCount}</span>
                </span>
                <span class="dash-bnav-label">Succès</span>
            </button>` : ''}
            <a class="dash-bnav-item" href="index.html#options" aria-label="Options">
                <span class="dash-bnav-icon">⚙️</span>
                <span class="dash-bnav-label">Options</span>
            </a>
            <a class="dash-bnav-item" href="index.html" aria-label="Accueil">
                <span class="dash-bnav-icon">🏠</span>
                <span class="dash-bnav-label">Accueil</span>
            </a>
            <button type="button" class="dash-bnav-item dash-bnav-close-btn" onclick="window._dashToggleBottomNav(true)" aria-label="Fermer le bandeau du bas" title="Fermer la barre du bas">
                <span class="dash-bnav-icon">✕</span>
                <span class="dash-bnav-label">Fermer</span>
            </button>
        </nav>
        ${navHidden ? `<button type="button" class="dash-bnav-reopen-btn" onclick="window._dashToggleBottomNav(false)" aria-label="Afficher le menu du bas">☰ Menu</button>` : ''}`;
    }

    /** Vue "Succès" : filtrée par filière/classe par défaut, avec bouton « Tout voir » et tri complet. */
    function renderBadges() {
        const unlockedIds = (typeof DB !== 'undefined' && DB.getBadges) ? DB.getBadges() : state.badges;
        state.badges = unlockedIds;
        const catalog = getBadgesCatalog();
        const curNiv = currentNiveau();
        const curFil = currentFiliere();
        const isFilUsed = (typeof AdminStore !== 'undefined' && typeof AdminStore.isFiliereApplicable === 'function')
            ? AdminStore.isFiliereApplicable(curNiv)
            : ['2nde', '1ere', 'terminale', 'bts1', 'bts2'].includes(curNiv);
        const nivLabel = (typeof AdminStore !== 'undefined' && typeof AdminStore.levelLabel === 'function')
            ? AdminStore.levelLabel(curNiv)
            : curNiv;
        const filObj = (isFilUsed && typeof AdminStore !== 'undefined' && typeof AdminStore.getFiliere === 'function')
            ? AdminStore.getFiliere(curFil)
            : null;
        const trackLabel = filObj
            ? `${filObj.icon || '🧭'} ${filObj.shortLabel || filObj.label}`
            : `🏫 ${nivLabel}`;

        const myTrackBadges = catalog.filter(b => isBadgeForCurrentTrack(b, curNiv, curFil));
        const myUnlockedCount = myTrackBadges.filter(b => unlockedIds.includes(b.id)).length;
        const globalUnlockedCount = catalog.filter(b => unlockedIds.includes(b.id)).length;

        const showAll = Boolean(state.badgeShowAll);
        const filFilter = state.badgeFiliereFilter || (showAll ? 'all' : 'mine');
        const statusFilter = state.badgeStatusFilter || 'all';
        const sortMode = state.badgeSort || 'relevance';

        // 1. Filtrage par filière / portée
        let list = catalog.filter(b => {
            const allowedFil = Array.isArray(b.allowedFilieres) && b.allowedFilieres.length ? b.allowedFilieres : ['all'];
            const band = b.band || 'all';
            if (filFilter === 'mine') {
                return isBadgeForCurrentTrack(b, curNiv, curFil);
            }
            if (filFilter === 'all') {
                return true;
            }
            if (filFilter === 'universal') {
                return band === 'all' && allowedFil.includes('all');
            }
            if (filFilter === 'college') {
                return band === 'college';
            }
            // Filière spécifique (ex: 'ciel', 'stmg', 'sti2d', 'nsi_spe', 'st2s', 'generale')
            return band !== 'college' && (allowedFil.includes(filFilter) && !allowedFil.includes('all'));
        });

        // 2. Filtrage par statut (débloqué / verrouillé)
        if (statusFilter === 'unlocked') {
            list = list.filter(b => unlockedIds.includes(b.id));
        } else if (statusFilter === 'locked') {
            list = list.filter(b => !unlockedIds.includes(b.id));
        }

        // 3. Tri configurable
        const scopeText = b => (typeof AdminStore !== 'undefined' && typeof AdminStore.getBadgeScopeLabel === 'function')
            ? AdminStore.getBadgeScopeLabel(b)
            : '🌐 Tous';
        const isTrackSpecific = b => {
            const allowed = Array.isArray(b.allowedFilieres) ? b.allowedFilieres : ['all'];
            return !allowed.includes('all') || (b.band && b.band !== 'all');
        };

        list = list.slice().sort((a, b) => {
            const aUn = unlockedIds.includes(a.id) ? 1 : 0;
            const bUn = unlockedIds.includes(b.id) ? 1 : 0;
            if (sortMode === 'unlocked_first') {
                if (bUn !== aUn) return bUn - aUn;
                return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
            }
            if (sortMode === 'locked_first') {
                if (aUn !== bUn) return aUn - bUn;
                return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
            }
            if (sortMode === 'filiere') {
                const cmp = scopeText(a).localeCompare(scopeText(b), 'fr');
                return cmp !== 0 ? cmp : String(a.name || '').localeCompare(String(b.name || ''), 'fr');
            }
            if (sortMode === 'alpha') {
                return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
            }
            // 'relevance' : succès dédiés à ma filière d'abord, puis débloqués, puis universels
            const aMine = isBadgeForCurrentTrack(a, curNiv, curFil) ? 1 : 0;
            const bMine = isBadgeForCurrentTrack(b, curNiv, curFil) ? 1 : 0;
            if (bMine !== aMine) return bMine - aMine;
            const aSpec = (aMine && isTrackSpecific(a)) ? 1 : 0;
            const bSpec = (bMine && isTrackSpecific(b)) ? 1 : 0;
            if (bSpec !== aSpec) return bSpec - aSpec;
            if (bUn !== aUn) return bUn - aUn;
            return 0;
        });

        const allFilieres = (typeof AdminStore !== 'undefined' && typeof AdminStore.getFilieres === 'function')
            ? AdminStore.getFilieres()
            : [];

        const filiereOptionsHtml = [
            `<option value="mine"${filFilter === 'mine' ? ' selected' : ''}>🎯 Ma filière (${escapeHtml(trackLabel)} · ${myTrackBadges.length})</option>`,
            `<option value="all"${filFilter === 'all' ? ' selected' : ''}>👁️ Toutes les filières (${catalog.length})</option>`,
            `<option value="universal"${filFilter === 'universal' ? ' selected' : ''}>🌐 Succès universels uniquement</option>`,
            `<option value="college"${filFilter === 'college' ? ' selected' : ''}>🏫 Collège uniquement</option>`,
            ...allFilieres.map(f => {
                const cnt = catalog.filter(b => b.band !== 'college' && Array.isArray(b.allowedFilieres) && b.allowedFilieres.includes(f.id) && !b.allowedFilieres.includes('all')).length;
                return `<option value="${escapeHtml(f.id)}"${filFilter === f.id ? ' selected' : ''}>${escapeHtml(f.icon || '🧭')} Spé ${escapeHtml(f.shortLabel || f.label)} (${cnt})</option>`;
            }),
        ].join('');

        const cards = list.map(badge => {
            const unlocked = unlockedIds.includes(badge.id);
            const mine = isBadgeForCurrentTrack(badge, curNiv, curFil);
            const scopeLbl = scopeText(badge);
            const isGlobalScope = !isTrackSpecific(badge);
            return `<div class="dash-skin-card dash-badge-card ${unlocked ? 'is-unlocked' : 'locked'} ${!mine ? 'is-other-filiere' : ''}">
                <span class="dash-badge-scope-pill ${isGlobalScope ? 'is-global' : ''}">${escapeHtml(scopeLbl)}</span>
                <div class="dash-badge-icon">${unlocked ? badge.icon : '🔒'}</div>
                <div class="dash-skin-name">${escapeHtml(badge.name)}</div>
                <div class="dash-badge-desc">${escapeHtml(badge.desc)}</div>
                <div class="dash-badge-status" style="margin-top:auto; padding-top:8px; font-size:0.75rem; font-weight:700; color:${unlocked ? '#4ade80' : '#8fa1d0'};">
                    ${unlocked ? '✓ DÉBLOQUÉ' : '🔒 VERROUILLÉ'}
                </div>
            </div>`;
        }).join('');

        const hiddenCount = Math.max(0, catalog.length - myTrackBadges.length);

        return `<section class="dash-section">
            <div class="dash-badges-head">
                <div>
                    <div class="dash-eyebrow">Succès · ${escapeHtml(trackLabel)}</div>
                    <h2 class="dash-section-title">Tes accomplissements (${filFilter === 'all' ? `${globalUnlockedCount}/${catalog.length}` : `${myUnlockedCount}/${myTrackBadges.length}`})</h2>
                    <div class="dash-badges-subtitle">
                        ${filFilter === 'mine'
                            ? `Affichage adapté à ton parcours (${hiddenCount} succès d'autres filières masqués).`
                            : `Affichage étendu : ${list.length} succès affichés sur ${catalog.length} au total.`}
                    </div>
                </div>
                <button type="button" class="dash-badge-filter-btn show-all-btn ${filFilter === 'all' ? 'active' : ''}" id="dashBadgesToggleAllBtn" onclick="window._dashToggleBadgesShowAll(${filFilter === 'all' ? 'false' : 'true'})">
                    ${filFilter === 'all' ? `🎯 Filtrer sur ma filière (${myTrackBadges.length})` : `👁️ Tout voir (${catalog.length})`}
                </button>
            </div>

            <div class="dash-badges-toolbar">
                <div class="dash-badges-modes">
                    <button type="button" class="dash-badge-filter-btn ${statusFilter === 'all' ? 'active' : ''}" onclick="window._dashSetBadgeStatusFilter('all')">Tous</button>
                    <button type="button" class="dash-badge-filter-btn ${statusFilter === 'unlocked' ? 'active' : ''}" onclick="window._dashSetBadgeStatusFilter('unlocked')">✓ Débloqués</button>
                    <button type="button" class="dash-badge-filter-btn ${statusFilter === 'locked' ? 'active' : ''}" onclick="window._dashSetBadgeStatusFilter('locked')">🔒 À débloquer</button>
                </div>
                <div class="dash-badges-controls">
                    <select class="dash-badge-select" id="dashBadgeFiliereSelect" aria-label="Filtrer les succès par filière" onchange="window._dashSetBadgeFiliereFilter(this.value)">
                        ${filiereOptionsHtml}
                    </select>
                    <select class="dash-badge-select" id="dashBadgeSortSelect" aria-label="Trier les succès" onchange="window._dashSetBadgeSort(this.value)">
                        <option value="relevance"${sortMode === 'relevance' ? ' selected' : ''}>Tri : Pertinence filière</option>
                        <option value="unlocked_first"${sortMode === 'unlocked_first' ? ' selected' : ''}>Tri : Débloqués d'abord</option>
                        <option value="locked_first"${sortMode === 'locked_first' ? ' selected' : ''}>Tri : À débloquer d'abord</option>
                        <option value="filiere"${sortMode === 'filiere' ? ' selected' : ''}>Tri : Par filière</option>
                        <option value="alpha"${sortMode === 'alpha' ? ' selected' : ''}>Tri : Alphabétique (A→Z)</option>
                    </select>
                </div>
            </div>

            <div class="dash-skins-grid">
                ${cards || `<div class="dash-badges-empty">Aucun succès ne correspond à ce filtre. <br><button type="button" class="dash-badge-filter-btn" style="margin-top:10px;" onclick="window._dashToggleBadgesShowAll(true)">👁️ Afficher tous les succès</button></div>`}
            </div>
        </section>`;
    }

    function renderDashboard() {
        const curNiv = currentNiveau();
        const curFil = currentFiliere();
        const nivLabel = (typeof AdminStore !== 'undefined' && AdminStore.levelLabel) ? AdminStore.levelLabel(curNiv) : curNiv;
        const isFilUsed = (typeof AdminStore !== 'undefined' && AdminStore.isFiliereApplicable) ? AdminStore.isFiliereApplicable(curNiv) : false;
        const filObj = (isFilUsed && typeof AdminStore !== 'undefined' && AdminStore.getFiliere) ? AdminStore.getFiliere(curFil) : null;
        const filShort = filObj ? (filObj.shortLabel || filObj.label) : '';

        const specCount = DASH_SUBJECTS.filter(s => s._isSpecialty).length;
        const coreCount = DASH_SUBJECTS.length - specCount;
        const activeFilter = (isFilUsed && specCount > 0) ? (state.subjectFilter || 'all') : 'all';

        const visibleSubjects = DASH_SUBJECTS.filter(s => {
            if (activeFilter === 'specialites') return Boolean(s._isSpecialty);
            if (activeFilter === 'tronc') return !s._isSpecialty;
            return true;
        });

        const cards = visibleSubjects.map(s => {
            let done = 0;
            const data = (typeof DB !== 'undefined' && DB.getProgressSync)
                ? DB.getProgressSync(s.name, curNiv)
                : null;
            if (data && data.levels) {
                for (let key in data.levels) {
                    if (data.levels[key].stars > 0) done++;
                }
            }
            if (done === 0) done = state.progress[s.id] || 0;

            const total = s.lessons.length;
            const pct = Math.round((done / total) * 100);
            const islandSrc = getSubjectIslandSrc(s);
            const iconHtml = islandSrc
                ? `<div class="dash-subject-island-wrap">
                     <img src="${escapeHtml(islandSrc)}" alt="${escapeHtml(s.name)}" class="dash-subject-island" loading="lazy">
                   </div>`
                : `<div class="dash-subject-icon">${escapeHtml(s.icon || '📘')}</div>`;
            const specBadge = s._isSpecialty
                ? `<span class="dash-subject-badge" title="Matière phare de la filière ${escapeHtml(filShort)}">★ ${escapeHtml(filShort || 'Spé')}</span>`
                : '';

            return `<div class="dash-subject-card ${s._isSpecialty ? 'is-specialty' : ''}" onclick="window._dashOpenMap('${escapeHtml(s.id)}')" tabindex="0" role="button" aria-label="${escapeHtml(s.name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window._dashOpenMap('${escapeHtml(s.id)}');}">
                ${specBadge}
                <span class="dash-pct mono">${done}/${total}</span>
                ${iconHtml}
                <h3>${escapeHtml(s.name)}</h3>
                <div class="dash-progress-track"><div class="dash-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');

        const filterBarHtml = (isFilUsed && specCount > 0) ? `
            <div class="dash-subject-filters" role="tablist" aria-label="Filtrer les matières">
                <button type="button" class="dash-filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="window._dashSetSubjectFilter('all')">Toutes (${DASH_SUBJECTS.length})</button>
                <button type="button" class="dash-filter-chip ${activeFilter === 'specialites' ? 'active' : ''}" onclick="window._dashSetSubjectFilter('specialites')">★ Spécialités ${escapeHtml(filShort)} (${specCount})</button>
                <button type="button" class="dash-filter-chip ${activeFilter === 'tronc' ? 'active' : ''}" onclick="window._dashSetSubjectFilter('tronc')">Tronc commun (${coreCount})</button>
            </div>` : '';

        const programSummary = filObj
            ? `Programme officiel · <b>${escapeHtml(nivLabel)}</b> · ${escapeHtml(filObj.icon || '')} <b>${escapeHtml(filObj.label)}</b>`
            : `Programme officiel · <b>${escapeHtml(nivLabel)}</b>`;

        return `
        ${renderQuests()}
        <section class="dash-section dash-subjects-section">
            <div class="dash-subjects-head">
                <div>
                    <div class="dash-eyebrow">Ta progression</div>
                    <h2 class="dash-section-title">Choisis une matière à explorer</h2>
                    <div class="dash-curriculum-bar">${programSummary} — ${DASH_SUBJECTS.length} matières</div>
                </div>
                ${filterBarHtml}
            </div>
            <div class="dash-subjects-grid">${cards}</div>
        </section>`;
    }

    /** Tableau des quêtes journalières : compact, repliable et optimisé mobile. */
    function renderQuests() {
        const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : {};
        if (siteCfg.enableQuests === false) return '';
        const data = DailyQuests.get();
        const total = data.quests.length;
        const claimedCount = data.quests.filter(q => q.claimed).length;
        const readyCount = data.quests.filter(q => !q.claimed && DailyQuests.isComplete(q)).length;
        const allClaimed = claimedCount === total;
        const collapsed = Boolean(state.questsCollapsed);
        const R = 26, C = 2 * Math.PI * R; // Anneau SVG

        const cards = data.quests.map((q, i) => {
            const done = DailyQuests.isComplete(q);
            const pct = Math.min(1, q.progress / q.target);
            const status = q.claimed ? 'claimed' : done ? 'ready' : 'active';
            const action = q.claimed
                ? `<div class="quest-stamp">✓ Fait</div>`
                : done
                    ? `<button type="button" class="quest-claim-btn" id="quest-claim-${q.id}" onclick="window._dashClaimQuest('${q.id}', this)">Réclamer</button>`
                    : `<div class="quest-progress-label mono">${q.progress}/${q.target}</div>`;
            return `<article class="quest-card is-${status}" style="--q-color:${q.color}; --q-delay:${i * 55}ms">
                <div class="quest-ring">
                    <svg viewBox="0 0 64 64" aria-hidden="true">
                        <circle class="quest-ring-bg" cx="32" cy="32" r="${R}"></circle>
                        <circle class="quest-ring-fg" cx="32" cy="32" r="${R}"
                            stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(2)}"></circle>
                    </svg>
                    <span class="quest-icon">${q.icon}</span>
                </div>
                <div class="quest-card-body">
                    <h3 class="quest-title">${escapeHtml(q.title)}</h3>
                    <div class="quest-rewards">
                        <span class="quest-chip xp">+${q.xp} XP</span>
                        <span class="quest-chip coin"><span class="dash-coin-dot"></span>${q.coins}</span>
                    </div>
                </div>
                <div class="quest-card-action">${action}</div>
            </article>`;
        }).join('');

        const bonusCoins = (typeof DailyQuests.getBonusCoins === 'function') ? DailyQuests.getBonusCoins() : DailyQuests.BONUS_COINS;
        const chestState = data.bonusClaimed ? 'opened' : allClaimed ? 'ready' : 'locked';
        const chest = `<button type="button" class="quest-chest is-${chestState}" id="quest-bonus-chest"
                ${chestState === 'ready' ? `onclick="window._dashClaimBonus(this)"` : 'disabled'}
                title="${chestState === 'opened' ? 'Coffre ouvert — reviens demain !' : `Réclame toutes les quêtes pour +${bonusCoins} pièces`}">
                <span class="quest-chest-icon">${chestState === 'opened' ? '🎁' : chestState === 'ready' ? '🎁' : '🔒'}</span>
                <span class="quest-chest-text">${chestState === 'opened' ? 'Récupéré' : chestState === 'ready' ? `Ouvrir +${bonusCoins}` : `+${bonusCoins}`}</span>
            </button>`;

        const readyPill = (readyCount > 0 && collapsed)
            ? `<span class="quest-ready-pill">${readyCount} à réclamer</span>`
            : '';

        return `<section class="quest-board ${collapsed ? 'is-collapsed' : ''}" aria-labelledby="quest-board-title">
            <div class="quest-board-head">
                <div class="quest-board-head-main">
                    <div class="quest-board-title-row">
                        <h2 id="quest-board-title" class="quest-board-title">📋 Missions du jour</h2>
                        ${readyPill}
                    </div>
                    <div class="quest-timer">⏳ Renouvellement dans <b>${DailyQuests.timeLeftLabel()}</b></div>
                </div>
                <div class="quest-board-side">
                    <div class="quest-overall">
                        <div class="quest-overall-label mono">${claimedCount}/${total}</div>
                        <div class="quest-overall-track"><div class="quest-overall-fill" style="width:${(claimedCount / total) * 100}%"></div></div>
                    </div>
                    ${chest}
                    <button type="button" class="quest-toggle-btn" onclick="window._dashToggleQuests()" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? 'Afficher les missions quotidiennes' : 'Réduire les missions quotidiennes'}" title="${collapsed ? 'Afficher les missions' : 'Réduire'}">
                        ${collapsed ? '▸' : '▾'}
                    </button>
                </div>
            </div>
            ${collapsed ? '' : `<div class="quest-grid">${cards}</div>`}
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
                    <h2>${escapeHtml(subject.name)}</h2>
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
            const owned = isBooster ? (boosterStock > 0) : isShopItemOwned(s, state.ownedSkins);
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
            if (isSafeAvatarImgSrc(s.img)) {
                visualHtml = `<div class="dash-skin-orb" style="--sc:${escapeHtml(s.color || '#4fd8c4')}"><img src="${escapeHtml(s.img)}" alt="${escapeHtml(s.name)}"></div>`;
            } else if (isTitle) {
                visualHtml = `<div class="dash-shop-title-preview" style="color:${s.color || '#ffd166'}; border: 1px dashed ${s.color || '#ffd166'}88; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px 6px; margin: 0 auto 12px; max-width: 140px; font-weight: 700; font-size: 13px;">${escapeHtml(s.name)}</div>`;
            } else if (isTheme) {
                visualHtml = `<div class="dash-shop-theme-preview" style="display: flex; gap: 4px; justify-content: center; margin: 0 auto 12px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: ${s.color}; box-shadow: 0 0 6px ${s.color};"></div>
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #1a103c;"></div>
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #ffd166;"></div>
                </div>`;
            } else if (isBooster) {
                const boosterGlyphMap = {
                    'boost-shield': '🛡️',
                    'boost-xp': '🧪',
                    'boost-coins': '🪙',
                    'boost-time': '⏳',
                    'boost-combo': '🔥',
                };
                const boosterGlyph = boosterGlyphMap[s.id] || '⚡';
                visualHtml = `<div class="dash-shop-booster-preview" style="width: 48px; height: 48px; line-height: 48px; border-radius: 50%; margin: 0 auto 12px; background: radial-gradient(circle, ${s.color}66, rgba(0,0,0,0.5)); border: 1px solid ${s.color}; font-size: 22px;">${boosterGlyph}</div>`;
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

    // Contrôleur de chronomètre dédié aux quiz du dashboard (fonctionne sur TOUS les exercices & réessais)
    const dashTimer = (typeof QuizTimer !== 'undefined')
        ? QuizTimer.create({
            containerId: 'chrono-bar-container',
            onExpire: () => window._dashSubmitQuiz(GameRules.TIMEOUT_ANSWER),
        })
        : null;

    function stopDashTimer() {
        if (dashTimer) dashTimer.stop();
    }
    function getDashRemainingTime() {
        return dashTimer ? dashTimer.getRemaining() : 0;
    }

    window.addEventListener('pagehide', stopDashTimer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.quiz) {
            window._dashCloseQuiz();
        }
    });

    async function loadDashQuestion(quizObj, { excludeProviderId = null } = {}) {
        const { subjectId, lessonIndex } = quizObj;
        const currentNiv = currentNiveau();
        const dashSubj = DASH_SUBJECTS.find(s => s.id === subjectId);
        const duration = (typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45;
        quizObj.chronoDuration = duration;
        try {
            const fetched = await AiProvider.fetchQuestion(subjectId, lessonIndex, currentNiv, {
                variant: quizObj.variant,
                salt: quizObj.salt,
                subject: dashSubj,
                subjectName: dashSubj ? dashSubj.name : subjectId,
                localLesson: (quizObj.salt === 0 && dashSubj && dashSubj.lessons[lessonIndex]) ? dashSubj.lessons[lessonIndex] : null,
                excludeSignatures: quizObj.failedSignatures || [],
                excludeProviderId,
            });
            if (state.quiz !== quizObj) return;
            quizObj.lesson = fetched.lesson;
            quizObj.questionId = fetched.questionId || null;
            quizObj.source = fetched.source || 'local';
            quizObj.providerId = fetched.providerId || null;
            quizObj.providerName = fetched.providerName || '';
            quizObj.difficultyTier = fetched.difficultyTier || 'standard';
            quizObj.tierInfo = fetched.tierInfo || null;
            quizObj.signature = fetched.signature || (typeof QuestionBank !== 'undefined' && QuestionBank.questionSignature ? QuestionBank.questionSignature(fetched.lesson) : '');
            quizObj.loading = false;
            quizObj.checking = false;
            renderQuizModal();
        } catch (err) {
            console.warn('[dashboard] Erreur récupération question, repli local.', err);
            if (state.quiz !== quizObj) return;
            const fallback = (typeof AdaptiveEngine !== 'undefined' && AdaptiveEngine.pickLocalQuestion)
                ? AdaptiveEngine.pickLocalQuestion({
                    subject: dashSubj,
                    subjectId,
                    levelIndex: lessonIndex,
                    niveau: currentNiv,
                    salt: quizObj.salt,
                    excludeSignatures: quizObj.failedSignatures || [],
                })
                : { lesson: dashSubj && dashSubj.lessons[lessonIndex], signature: '', source: 'local', providerName: 'Banque locale', difficultyTier: 'standard' };
            quizObj.lesson = fallback.lesson;
            quizObj.questionId = null;
            quizObj.source = 'local';
            quizObj.providerName = fallback.providerName || 'Banque locale';
            quizObj.difficultyTier = fallback.difficultyTier || 'standard';
            quizObj.tierInfo = fallback.tierInfo || null;
            quizObj.signature = fallback.signature || '';
            quizObj.loading = false;
            quizObj.checking = false;
            renderQuizModal();
        }
    }

    function renderQuizModal() {
        if (!state.quiz) {
            stopDashTimer();
            const oldOverlay = document.getElementById('dashQuizOverlay');
            if (oldOverlay) oldOverlay.remove();
            return;
        }

        const { subjectId, lessonIndex, submitted, answered, isCorrect, loading, checking, explanation } = state.quiz;
        const subject = DASH_SUBJECTS.find(s => s.id === subjectId);
        let overlay = document.getElementById('dashQuizOverlay');

        if (loading || checking === 'loading') {
            stopDashTimer();
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'dash-overlay';
                overlay.id = 'dashQuizOverlay';
                document.body.appendChild(overlay);
            }
            delete overlay.dataset.quizKey;
            overlay.innerHTML = `<div class="dash-modal">
                <div class="dash-eyebrow">${subject ? escapeHtml(subject.name) : 'Quiz'} · Niveau ${lessonIndex + 1}</div>
                <h3 role="status" aria-live="polite">Génération d'une question adaptée…</h3>
                <div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Annuler</button></div>
            </div>`;
            return;
        }

        const streakData = (typeof DB !== 'undefined' && DB.getStreakData) ? DB.getStreakData() : { count: 0, combo: 0 };
        const comboCount = streakData.combo || 0;
        const multiplier = (typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier(comboCount) : 1.0;
        const comboBarHtml = renderQuizComboBarHtml(streakData);

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

        const chronoEnabled = (typeof QuizTimer !== 'undefined') ? QuizTimer.isEnabled() : (getOption('modeChrono') === 'true');
        const chronoDuration = (typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45;
        const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
            ? AdminStore.getSiteConfig()
            : null;

        let feedback = '';
        if (checking) {
            feedback = `<div class="dash-feedback" role="status" aria-live="polite">Correction en cours…</div>`;
        } else if (answered) {
            const multTag = multiplier > 1.0 ? `<span class="dash-combo-tag">x${multiplier.toFixed(1)}</span> ` : '';
            const expText = explanation || (lesson ? lesson.exp : '') || '';
            feedback = `<div class="dash-feedback ${isCorrect ? 'ok' : 'ko'}">
                <div class="dash-feedback-badge">${isCorrect ? '✓ Bonne réponse ! ' + multTag : '✗ Pas tout à fait... (une nouvelle question te sera proposée)'}</div>
                ${expText ? `
                    <div class="dash-feedback-exp">
                        <div class="dash-feedback-exp-title">📖 Explication &amp; Règle de cours :</div>
                        <div class="dash-feedback-exp-content">${escapeHtml(expText)}</div>
                    </div>
                ` : ''}
            </div>`;
            if (isCorrect) {
                const isFirstSuccess = state.quiz.lessonIndex === (state.progress[subjectId] || 0);
                if (isFirstSuccess) {
                    const preview = GameRules.computeLevelRewards({
                        stars: GameRules.starsFor(state.quiz.attempts, state.quiz.usedShield),
                        multiplier,
                        chronoEnabled,
                        timeRemaining: getDashRemainingTime(),
                        chronoDuration: state.quiz.chronoDuration || chronoDuration,
                        doubleXp: (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(GameRules.DOUBLE_XP_ID)),
                        doubleCoins: (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(GameRules.DOUBLE_COINS_ID || 'boost-coins')),
                        rewards: (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                            ? AdminStore.getRewardsConfig() : null,
                        siteXpMultiplier: siteCfg ? siteCfg.xpMultiplier : 1,
                        siteCoinMultiplier: siteCfg ? siteCfg.coinMultiplier : 1,
                    });
                    feedback += `<div class="dash-reward-line"><span>+${preview.xp} XP ${multiplier > 1.0 ? `<b style="color:#ffa502;">(x${multiplier.toFixed(1)})</b>` : ''}</span><span>+${preview.coins} <span class="dash-coin-dot" style="display:inline-block; width:10px;height:10px; vertical-align:middle;"></span></span><span style="color:#ffbe0b; font-weight:700;">+${preview.score} pts</span></div>`;
                } else {
                    feedback += `<div class="dash-reward-line"><span>Niveau déjà réussi : entraînement sans récompense.</span></div>`;
                }
            }
        }

        const starsWin = isCorrect ? GameRules.starsFor(state.quiz.attempts, state.quiz.usedShield) : 0;
        const actions = !answered
            ? `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Annuler</button></div>`
            : isCorrect
                ? `<div class="dash-modal-actions"><button class="dash-btn-primary" onclick="window._dashFinishQuiz()">Continuer (${'⭐'.repeat(starsWin)})</button></div>`
                : `<div class="dash-modal-actions"><button class="dash-btn-ghost" onclick="window._dashCloseQuiz()">Quitter</button><button class="dash-btn-primary" onclick="window._dashRetryQuiz()">🔄 Réessayer (nouvelle question)</button></div>`;

        const chronoHtml = (chronoEnabled && !answered && !checking && typeof QuizTimer !== 'undefined')
            ? QuizTimer.renderBarHtml('chrono-bar-container', chronoDuration)
            : '';
        const metaStripHtml = `<div class="quiz-meta-strip">${renderQuizMetaStripHtml(state.quiz)}</div>`;

        const quizKey = lesson ? [subjectId, lessonIndex, state.quiz.salt, state.quiz.variant, state.quiz.signature || lesson.q].join('::') : null;

        if (overlay && overlay.dataset.quizKey === quizKey && overlay.querySelector('.dash-quiz-body')) {
            const metaEl = overlay.querySelector('.quiz-meta-strip');
            if (metaEl) metaEl.innerHTML = renderQuizMetaStripHtml(state.quiz);

            const comboEl = overlay.querySelector('.dash-quiz-combo-bar');
            if (comboEl) comboEl.outerHTML = comboBarHtml;

            if (checking || answered) {
                stopDashTimer();
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

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'dash-overlay';
            overlay.id = 'dashQuizOverlay';
            document.body.appendChild(overlay);
        }
        overlay.dataset.quizKey = quizKey || '';
        overlay.innerHTML = `<div class="dash-modal">
            <div class="dash-eyebrow">${escapeHtml(subject ? subject.name : '')} · ${escapeHtml(lesson ? lesson.title : '')}</div>
            ${metaStripHtml}
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
            if (chronoEnabled && dashTimer) {
                let effectiveDuration = chronoDuration;
                const extraTimeId = (typeof GameRules !== 'undefined' && GameRules.EXTRA_TIME_ID) ? GameRules.EXTRA_TIME_ID : 'boost-time';
                const extraSec = (typeof GameRules !== 'undefined' && GameRules.EXTRA_TIME_BONUS_S) ? GameRules.EXTRA_TIME_BONUS_S : 15;
                if (!state.quiz.usedExtraTime && typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(extraTimeId) && DB.useBooster(extraTimeId)) {
                    state.quiz.usedExtraTime = true;
                    effectiveDuration += extraSec;
                    state.quiz.chronoDuration = effectiveDuration;
                    showNotification(`⏳ Sablier Temporel consommé : +${extraSec}s ajoutées au chrono !`, 'info');
                }
                dashTimer.start(effectiveDuration);
            }
        }
    }

    /* ============ ACTIONS (exposées sur window pour les onclick inline) ============ */

    window._dashChangeNiveau = function(val) {
        if (state.quiz) {
            showNotification('Termine ou ferme l\'exercice en cours avant de changer de classe.', 'error');
            return;
        }
        DB.setNiveau(val);
        _effectiveSubjectsCache.clear();
        const curFil = currentFiliere();
        if (typeof getEffectiveSubjects === 'function') {
            DASH_SUBJECTS = getEffectiveSubjects(val, curFil);
        }
        DASH_SUBJECTS.forEach(s => {
            if (!(s.id in state.progress)) state.progress[s.id] = 0;
        });
        state.subjectFilter = 'all';
        const niveaux = (window.AdminStore && typeof AdminStore.getNiveauxScolaires === 'function')
            ? AdminStore.getNiveauxScolaires()
            : [];
        const found = niveaux.find(n => n.id === val);
        const label = found ? (found.label || found.name) : val;
        if (state.view === 'map' && state.currentSubject && !DASH_SUBJECTS.some(s => s.id === state.currentSubject)) {
            state.view = 'dashboard';
            state.currentSubject = null;
            showNotification(`🎓 Programme actualisé (${label}) : retour aux matières autorisées.`, 'info');
        } else {
            showNotification(`🎓 Programme actualisé pour la classe : ${label}`, 'info');
        }
        render();
    };

    window._dashChangeFiliere = function(val) {
        if (state.quiz) {
            showNotification('Termine ou ferme l\'exercice en cours avant de changer de filière.', 'error');
            return;
        }
        if (typeof DB !== 'undefined' && DB.setFiliere) {
            DB.setFiliere(val);
        }
        _effectiveSubjectsCache.clear();
        const curNiv = currentNiveau();
        if (typeof getEffectiveSubjects === 'function') {
            DASH_SUBJECTS = getEffectiveSubjects(curNiv, val);
        }
        DASH_SUBJECTS.forEach(s => {
            if (!(s.id in state.progress)) state.progress[s.id] = 0;
        });
        state.subjectFilter = 'all';
        const filLabel = (typeof AdminStore !== 'undefined' && typeof AdminStore.filiereLabel === 'function')
            ? AdminStore.filiereLabel(val)
            : val;
        if (state.view === 'map' && state.currentSubject && !DASH_SUBJECTS.some(s => s.id === state.currentSubject)) {
            state.view = 'dashboard';
            state.currentSubject = null;
        }
        showNotification(`🧭 Filière actualisée : ${filLabel} (${DASH_SUBJECTS.length} matières)`);
        render();
    };

    window._dashSetSubjectFilter = function(filter) {
        state.subjectFilter = filter || 'all';
        render();
    };

    window._dashToggleBadgesShowAll = function(showAll) {
        state.badgeShowAll = Boolean(showAll);
        state.badgeFiliereFilter = state.badgeShowAll ? 'all' : 'mine';
        render();
    };

    window._dashSetBadgeFiliereFilter = function(val) {
        const clean = val || 'mine';
        state.badgeFiliereFilter = clean;
        state.badgeShowAll = (clean === 'all');
        render();
    };

    window._dashSetBadgeStatusFilter = function(status) {
        state.badgeStatusFilter = status || 'all';
        render();
    };

    window._dashSetBadgeSort = function(sortMode) {
        state.badgeSort = sortMode || 'relevance';
        render();
    };

    window._dashToggleQuests = function() {
        state.questsCollapsed = !state.questsCollapsed;
        saveOption('dash_quests_collapsed', String(state.questsCollapsed));
        render();
    };

    window._dashToggleBottomNav = function(hidden) {
        state.bottomNavHidden = Boolean(hidden);
        saveOption('mobile_bottom_nav_hidden', String(state.bottomNavHidden));
        if (document.body) {
            document.body.classList.toggle('bnav-collapsed', state.bottomNavHidden);
        }
        render();
    };

    function navigateToView(viewName, subjectId = null, push = true) {
        if (state.quiz) {
            stopDashTimer();
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
        stopDashTimer();
        const currentNiv = currentNiveau();
        const persisted = (typeof DB !== 'undefined' && typeof DB.getLevelAttempt === 'function')
            ? DB.getLevelAttempt(subjectId, currentNiv, lessonIndex)
            : { fails: 0, usedShield: false, questionSalt: 0, failedSignatures: [] };

        const initialVariant = persisted.questionSalt > 0
            ? (persisted.questionSalt % 3)
            : Math.floor(Math.random() * 3);

        state.quiz = QuizSession.createAttempt({
            subjectId,
            lessonIndex,
            variant: initialVariant,
            salt: persisted.questionSalt || 0,
            attempts: persisted.fails || 0,
            usedShield: Boolean(persisted.usedShield),
            failedSignatures: Array.isArray(persisted.failedSignatures) ? persisted.failedSignatures.slice() : [],
            loading: true,
            checking: 'loading',
        });
        render();
        await loadDashQuestion(state.quiz);
    };

    window._dashCloseQuiz = function () {
        stopDashTimer();
        state.quiz = null;
        const overlay = document.getElementById('dashQuizOverlay');
        if (overlay) overlay.remove();
        render();
    };

    window._dashRetryQuiz = async function () {
        if (!state.quiz) return;
        stopDashTimer();
        const overlay = document.getElementById('dashQuizOverlay');
        if (overlay) delete overlay.dataset.quizKey;
        const prevProviderId = state.quiz.providerId;
        const nextVariant = QuizSession.nextVariant(state.quiz.variant);
        QuizSession.resetForRetry(state.quiz, nextVariant);
        state.quiz.loading = true;
        renderQuizModal();
        await loadDashQuestion(state.quiz, { excludeProviderId: prevProviderId });
    };

    window._dashSubmitQuiz = async function (rawAnswer) {
        stopDashTimer();
        const quiz = state.quiz;
        if (!quiz) return;
        await QuizSession.submit(quiz, rawAnswer, {
            render: renderQuizModal,
            isStale: () => state.quiz !== quiz,
            subjectId: quiz.subjectId,
            niveau: currentNiveau(),
            levelIndex: quiz.lessonIndex,
            chronoDuration: quiz.chronoDuration || (typeof QuizTimer !== 'undefined' ? QuizTimer.getConfiguredDuration() : 45),
        });
    };

    window._dashFinishQuiz = function () {
        stopDashTimer();
        if (!state.quiz || !state.quiz.isCorrect) return;
        const { subjectId, lessonIndex, attempts } = state.quiz;
        const usedShield = Boolean(state.quiz.usedShield);
        const stars = GameRules.starsFor(attempts, usedShield);

        // Réussite validée → purge du compteur anti-triche pour ce niveau
        if (typeof DB !== 'undefined' && typeof DB.clearLevelAttempt === 'function') {
            DB.clearLevelAttempt(subjectId, currentNiveau(), lessonIndex);
        }

        const streakRes = (typeof DB !== 'undefined' && DB.recordLevelVictory) ? DB.recordLevelVictory() : { streak: 1, combo: 0, multiplier: 1.0 };
        const mult = (streakRes && streakRes.multiplier) || ((typeof DB !== 'undefined' && DB.getMultiplier) ? DB.getMultiplier() : 1.0);
        let xpGained = 0;
        let coinsGained = 0;
        let scoreGained = 0;

        if (lessonIndex === (state.progress[subjectId] || 0)) {
            state.progress[subjectId] = (state.progress[subjectId] || 0) + 1;

            const rewards = (typeof AdminStore !== 'undefined' && typeof AdminStore.getRewardsConfig === 'function')
                ? AdminStore.getRewardsConfig()
                : GameRules.DEFAULT_REWARDS;
            const siteCfg = (typeof AdminStore !== 'undefined' && typeof AdminStore.getSiteConfig === 'function')
                ? AdminStore.getSiteConfig()
                : null;

            let usedDoubleXp = false;
            let usedDoubleCoins = false;
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(GameRules.DOUBLE_XP_ID)) {
                usedDoubleXp = DB.useBooster(GameRules.DOUBLE_XP_ID);
                if (usedDoubleXp) showNotification('🧪 Potion Double XP consommée : XP doublée !', 'success');
            }
            const doubleCoinsId = GameRules.DOUBLE_COINS_ID || 'boost-coins';
            if (typeof DB !== 'undefined' && DB.hasBooster && DB.hasBooster(doubleCoinsId)) {
                usedDoubleCoins = DB.useBooster(doubleCoinsId);
                if (usedDoubleCoins) showNotification('🪙 Élixir de Fortune consommé : pièces doublées !', 'success');
            }

            const gains = GameRules.computeLevelRewards({
                stars,
                multiplier: mult,
                chronoEnabled: (typeof QuizTimer !== 'undefined') ? QuizTimer.isEnabled() : (getOption('modeChrono') === 'true'),
                timeRemaining: getDashRemainingTime(),
                chronoDuration: (state.quiz && state.quiz.chronoDuration) || ((typeof QuizTimer !== 'undefined') ? QuizTimer.getConfiguredDuration() : 45),
                doubleXp: usedDoubleXp,
                doubleCoins: usedDoubleCoins,
                rewards,
                siteXpMultiplier: siteCfg ? siteCfg.xpMultiplier : 1,
                siteCoinMultiplier: siteCfg ? siteCfg.coinMultiplier : 1,
            });
            xpGained = gains.xp;
            coinsGained = gains.coins;
            scoreGained = gains.score;
            const currentScore = parseInt(getOption('dash_total_score') || '0', 10);
            saveOption('dash_total_score', String(currentScore + scoreGained));

            state.xp += xpGained;
            state.coins += coinsGained;
            triggerBadgesCheck({
                justAnsweredFirstTry: stars === 3,
                justCompletedLevel: true,
                starsEarned: stars,
                subjectId,
                usedDoubleXp,
                usedDoubleCoins,
                usedShield,
                usedBooster: usedDoubleXp ? 'boost-xp' : (usedDoubleCoins ? 'boost-coins' : (usedShield ? 'boost-shield' : null)),
                boosterId: usedDoubleXp ? 'boost-xp' : (usedDoubleCoins ? 'boost-coins' : (usedShield ? 'boost-shield' : null)),
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
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
            AudioManager.playSfx('victory');
        }
        DailyQuests.track(GameRules.questDelta({ stars, attempts, xp: xpGained }));

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
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') AudioManager.playSfx('coin');
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
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') AudioManager.playSfx('victory');
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
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') AudioManager.playSfx('coin');
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
            state.equippedAura = id;
            state.equippedSkin = id;
        }
        persistState();
        triggerBadgesCheck({
            boughtSkin: true,
            skinId: id,
            titleEquipped: cat === 'title',
            themeEquipped: cat === 'theme' && id !== 'default',
            auraEquipped: cat === 'aura' && id !== 'aurore',
        });
        render();
        showNotification(`✓ « ${item.name} » débloqué et équipé !`);
    };

    window._dashEquipSkin = function (id) {
        const item = getShopCatalog().find(s => s.id === id);
        if (!item) return;
        const cat = item.category || 'aura';
        if (cat === 'booster') return;
        if (!isShopItemOwned(item, state.ownedSkins)) {
            showNotification('🔒 Débloque d\'abord cet article dans la Boutique !');
            return;
        }
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.playSfx === 'function') {
            AudioManager.playSfx('click');
        }
        if (cat === 'title') {
            state.equippedTitle = (state.equippedTitle === id ? '' : id);
            persistState();
            if (state.equippedTitle) triggerBadgesCheck({ titleEquipped: true });
            showNotification(state.equippedTitle ? `🏷️ Titre « ${item.name} » activé !` : 'Titre retiré.');
        } else if (cat === 'theme') {
            if (id === 'default') {
                state.equippedTheme = 'default';
                document.documentElement.setAttribute('data-theme', 'default');
                persistState();
                showNotification(`🎨 Thème d'origine Astral rétabli !`);
            } else {
                state.equippedTheme = (state.equippedTheme === id ? 'default' : id);
                document.documentElement.setAttribute('data-theme', state.equippedTheme);
                persistState();
                triggerBadgesCheck({ theme: state.equippedTheme, themeEquipped: state.equippedTheme !== 'default' });
                showNotification(state.equippedTheme === 'default'
                    ? `🎨 Thème d'origine Astral rétabli !`
                    : `🎨 Thème « ${item.name} » appliqué !`);
            }
        } else if (cat === 'avatar') {
            state.equippedAvatar = id;
            persistState();
            showNotification(`👤 Avatar « ${item.name} » équipé !`);
        } else if (cat === 'aura') {
            state.equippedAura = id;
            state.equippedSkin = id;
            persistState();
            triggerBadgesCheck({ auraEquipped: id !== 'aurore' });
            showNotification(`✨ Aura « ${item.name} » équipée !`);
        } else {
            state.equippedSkin = id;
            persistState();
            showNotification(`✓ « ${item.name} » équipé !`);
        }
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

    window.addEventListener('pageshow', (e) => {
        applyAllRuntimeSettings();
        const sig = computeDashSyncSig();
        // Sur chargement initial, initDashboard() vient déjà d'effectuer le premier rendu
        // (évite aussi d'écraser une vue ouverte par ancre, ex: #boutique-avatars).
        if (!e.persisted && sig === _lastDashSyncSig) return;
        _effectiveSubjectsCache.clear();
        DASH_SUBJECTS = getEffectiveSubjects();
        const prevView = state.view;
        const prevFilter = state.subjectFilter;
        state = loadState();
        state.view = prevView;
        state.subjectFilter = prevFilter;
        DASH_SUBJECTS.forEach(s => {
            if (!(s.id in state.progress)) state.progress[s.id] = 0;
        });
        render();
    });

    /* ============ PREMIER RENDU ============ */
    persistState();
    render();
}

/* ==========================================================================
   INITIALISATION GLOBALE — Point d'entrée unique
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

    // 0. Apparence globale (thème boutique + couleur interface + couleur/luminosité boutons) & annonce
    applyAppearanceSettings();
    applySiteAnnouncement();

    // 1. Initialisation du gestionnaire audio global (musique continue + zéro réactivation parasite)
    initGlobalMusic();

    // 2. Création des éléments visuels (étoiles + nuages)
    createEnvironment();

    // 3. Mise à jour du numéro de version & des crédits dans le footer
    updateFooterVersion();
    refreshFooterCredits();
    setupCookieConsentFallback();

    // 4. Plein écran automatique si activé dans les options
    applyFullscreenSetting();
    function onFirstInteraction() {
        applyFullscreenSetting();
        document.removeEventListener('click', onFirstInteraction, true);
    }
    document.addEventListener('click', onFirstInteraction, true);

    // 5. Initialisation des fonctionnalités spécifiques à chaque page
    initAccueil();
    initConnexion();
    initOptions();
    initMap();
    initDashboard();

    // Ouverture automatique de la modale des options si demandée via l'URL (#options)
    if (window.location.hash === '#options') {
        const modalOptions = document.getElementById('modalOptions');
        if (modalOptions) {
            _optionsOpenedFromHash = true;
            if (typeof window._openOptionsModal === 'function') {
                window._openOptionsModal();
            } else {
                modalOptions.hidden = false;
            }
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
