/* =============================================================================
   AUDIO-MANAGER.JS — EDUQUEST v1.29.1
   Gestionnaire audio global (musique de fond continue + bruitages Web Audio).

   CORRECTIFS MAJEURS (v1.27.0) :
   1. Musique globale sur TOUT le site (menu principal, choix des matières sur
      dashboard.html, choix des niveaux sur map.html, quiz et mentions légales)
      avec tentative de reprise immédiate au chargement de page + restauration
      exacte de la piste et du timecode (loadedmetadata).
   2. Fin définitive de la réactivation aléatoire lors d'une coupure manuelle
      (par l'onglet, les contrôles média du navigateur, le bouton muet ou les
      paramètres) :
      - Source unique de vérité canPlayMusic() (relit toujours DB en direct).
      - Détection de pause externe (contrôles média / onglet) : mémorisée,
        aucun clic ultérieur ni fin de piste ne réactive la musique tout seul.
      - Gestion propre de visibilitychange / pagehide / beforeunload / storage.
      - Aucune réactivation sur changement de cases sans rapport (effetsActifs).
   3. Bruitages légers synthétisés via Web Audio API (100 % hors-ligne, zéro
      fichier externe), respectant sonsActifs, effetsActifs et volumeEffets.
   4. Bouton flottant discret 🔊 / 🔇 global, synchronisé avec les Paramètres.
   ============================================================================= */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AudioManager = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const PLAYLIST = [
        'Musique/music1.mp3',
        'Musique/music2.mp3',
        'Musique/music3.mp3',
        'Musique/music4.mp3',
        'Musique/music5.mp3',
        'Musique/music6.mp3',
    ];

    const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const MANUAL_MUTE_KEY = 'eduquest_audio_manual_mute';

    let audioEl = null;
    let currentTrack = 0;
    let isPlaying = false;
    let internalPause = false;
    let internalPauseTimer = null;
    let lastSavedTrack = -1;
    let lastSavedTime = -1;
    let userPausedByBrowser = false;
    let wasPlayingBeforeHide = false;
    let gestureListenersAttached = false;
    let globalListenersAttached = false;
    let saveTimer = null;
    let initialized = false;
    let stoppedByQuit = false;
    let sfxCtx = null;

    /* ================= LECTURE DES OPTIONS EN DIRECT ================= */

    function getSiteAudioDefaults() {
        try {
            const store = root && root.AdminStore;
            if (store && typeof store.getSiteConfig === 'function') {
                const cfg = store.getSiteConfig();
                if (cfg) {
                    return {
                        soundEnabled: cfg.soundEnabledByDefault !== false,
                        musicVol: typeof cfg.defaultBgmVolume === 'number'
                            ? cfg.defaultBgmVolume
                            : (typeof cfg.musicVolume === 'number' ? Math.round(cfg.musicVolume * 100) : 75),
                        sfxVol: typeof cfg.defaultSfxVolume === 'number'
                            ? cfg.defaultSfxVolume
                            : (typeof cfg.sfxVolume === 'number' ? Math.round(cfg.sfxVolume * 100) : 80),
                    };
                }
            }
        } catch { /* ignore */ }
        return { soundEnabled: true, musicVol: 75, sfxVol: 80 };
    }

    function readOption(key) {
        try {
            const db = root && root.DB;
            if (db && typeof db.getOption === 'function') return db.getOption(key);
        } catch { /* ignore */ }
        return null;
    }

    function writeOption(key, val) {
        try {
            const db = root && root.DB;
            if (db && typeof db.saveOption === 'function') db.saveOption(key, val);
        } catch { /* ignore */ }
    }

    function isGlobalSoundEnabled() {
        const val = readOption('sonsActifs');
        if (val !== null) return val !== 'false';
        return getSiteAudioDefaults().soundEnabled;
    }

    function isMusicOptionEnabled() {
        const val = readOption('musiqueActive');
        if (val !== null) return val !== 'false';
        return true;
    }

    function isSfxOptionEnabled() {
        const val = readOption('effetsActifs');
        if (val !== null) return val !== 'false';
        return true;
    }

    function getMusicVolume() {
        const saved = readOption('volumeMusique');
        const pct = saved !== null ? parseInt(saved, 10) : getSiteAudioDefaults().musicVol;
        const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 75;
        return clamped / 100;
    }

    function getSfxVolume() {
        const saved = readOption('volumeEffets');
        const pct = saved !== null ? parseInt(saved, 10) : getSiteAudioDefaults().sfxVol;
        const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 80;
        return clamped / 100;
    }

    function isManuallyMuted() {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(MANUAL_MUTE_KEY) === 'true';
            }
        } catch { /* ignore */ }
        return false;
    }

    function setManuallyMuted(muted) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(MANUAL_MUTE_KEY, muted ? 'true' : 'false');
            }
        } catch { /* ignore */ }
    }

    function isDocumentHidden() {
        return typeof document !== 'undefined' && Boolean(document.hidden);
    }

    /** Source unique de vérité : la musique est-elle autorisée à jouer maintenant ? */
    function canPlayMusic() {
        return (
            !stoppedByQuit &&
            isGlobalSoundEnabled() &&
            isMusicOptionEnabled() &&
            !isManuallyMuted() &&
            !userPausedByBrowser &&
            !isDocumentHidden()
        );
    }

    /* ================= PERSISTANCE TIMECODE ================= */

    function saveState(force) {
        if (!audioEl) return;
        try {
            const db = root && root.DB;
            if (db && typeof db.setMusicState === 'function') {
                const t = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
                if (!force && currentTrack === lastSavedTrack && Math.abs(t - lastSavedTime) < 0.5) return;
                lastSavedTrack = currentTrack;
                lastSavedTime = t;
                db.setMusicState(currentTrack, t);
            }
        } catch { /* ignore */ }
    }

    function restoreTrackAndTime() {
        if (!audioEl) return;
        let saved = { track: 0, time: 0 };
        try {
            const db = root && root.DB;
            if (db && typeof db.getMusicState === 'function') {
                saved = db.getMusicState() || saved;
            }
        } catch { /* ignore */ }

        currentTrack = Number.isInteger(saved.track) && saved.track >= 0 && saved.track < PLAYLIST.length
            ? saved.track
            : 0;

        const targetTime = Number.isFinite(saved.time) && saved.time > 0 ? saved.time : 0;
        const src = PLAYLIST[currentTrack];
        if (!audioEl.src || !audioEl.src.endsWith(src)) {
            audioEl.src = src;
        }

        const applyTime = () => {
            if (!audioEl || targetTime <= 0) return;
            try {
                const maxTime = Number.isFinite(audioEl.duration) && audioEl.duration > 1
                    ? Math.max(0, audioEl.duration - 0.5)
                    : targetTime;
                audioEl.currentTime = Math.min(targetTime, maxTime);
            } catch { /* ignore seek before metadata */ }
        };

        if (audioEl.readyState >= 1) {
            applyTime();
        } else {
            audioEl.addEventListener('loadedmetadata', applyTime, { once: true });
        }
    }

    /* ================= CONTRÔLE DE LECTURE ================= */

    function detachGestureListeners() {
        if (!gestureListenersAttached || typeof document === 'undefined') return;
        GESTURE_EVENTS.forEach(ev => {
            document.removeEventListener(ev, onUserGesture, ev === 'touchstart' ? { capture: true, passive: true } : true);
        });
        gestureListenersAttached = false;
    }

    function attachGestureListeners() {
        if (gestureListenersAttached || typeof document === 'undefined') return;
        if (!canPlayMusic()) return;
        GESTURE_EVENTS.forEach(ev => {
            document.addEventListener(ev, onUserGesture, ev === 'touchstart' ? { capture: true, passive: true } : true);
        });
        gestureListenersAttached = true;
    }

    function onUserGesture() {
        if (!canPlayMusic()) {
            detachGestureListeners();
            return;
        }
        attemptPlay(false);
    }

    function isQuickToggleAllowedByAdmin() {
        try {
            const store = root && root.AdminStore;
            if (store && typeof store.getSiteConfig === 'function') {
                const cfg = store.getSiteConfig();
                if (cfg && cfg.showAudioToggleButton === false) return false;
            }
        } catch { /* ignore */ }
        return true;
    }

    function updateQuickToggleUI() {
        if (typeof document === 'undefined') return;
        const btn = document.getElementById('eduquest-audio-toggle');
        if (!btn) return;
        const showBtn = isQuickToggleAllowedByAdmin();
        btn.hidden = !showBtn;
        btn.style.display = showBtn ? '' : 'none';
        const active = isGlobalSoundEnabled() && isMusicOptionEnabled() && !isManuallyMuted() && !userPausedByBrowser;
        btn.classList.toggle('is-muted', !active);
        btn.classList.toggle('is-playing', active && isPlaying);
        const icons = root && root.EduIcons;
        if (icons && typeof icons.svg === 'function') {
            btn.innerHTML = icons.svg(active ? 'volumeOn' : 'volumeOff', { size: 20, tone: active ? 'gold' : 'muted' });
        } else {
            btn.innerHTML = active
                ? '<svg class="eq-icon eq-icon--gold" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" fill-opacity="0.22"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
                : '<svg class="eq-icon eq-icon--muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" fill-opacity="0.18"/><path d="M22 9l-6 6M16 9l6 6"/></svg>';
        }
        btn.title = active
            ? 'Couper la musique (actif sur tout le site)'
            : 'Réactiver la musique';
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-pressed', String(!active));
    }

    function pauseInternal(preserveIntent) {
        if (!audioEl) return;
        if (isPlaying) saveState(true);
        internalPause = true;
        if (internalPauseTimer) {
            clearTimeout(internalPauseTimer);
            internalPauseTimer = null;
        }
        try { audioEl.pause(); } catch { /* ignore */ }
        isPlaying = false;
        if (!preserveIntent) detachGestureListeners();
        internalPauseTimer = setTimeout(() => {
            internalPause = false;
            internalPauseTimer = null;
        }, 0);
        updateQuickToggleUI();
    }

    function attemptPlay(resetTrackTime) {
        if (!audioEl) return Promise.resolve(false);
        if (!canPlayMusic()) {
            pauseInternal(false);
            return Promise.resolve(false);
        }

        audioEl.volume = getMusicVolume();
        if (!audioEl.src) {
            restoreTrackAndTime();
        }
        if (resetTrackTime) {
            try { audioEl.currentTime = 0; } catch { /* ignore */ }
        }

        let playPromise;
        try {
            playPromise = audioEl.play();
        } catch {
            isPlaying = false;
            attachGestureListeners();
            updateQuickToggleUI();
            return Promise.resolve(false);
        }

        if (playPromise && typeof playPromise.then === 'function') {
            return playPromise.then(() => {
                // Re-vérifier qu'entre-temps l'utilisateur n'a pas coupé le son
                if (!canPlayMusic()) {
                    pauseInternal(false);
                    return false;
                }
                isPlaying = true;
                detachGestureListeners();
                updateQuickToggleUI();
                return true;
            }).catch(() => {
                isPlaying = false;
                if (canPlayMusic()) attachGestureListeners();
                updateQuickToggleUI();
                return false;
            });
        }

        isPlaying = true;
        detachGestureListeners();
        updateQuickToggleUI();
        return Promise.resolve(true);
    }

    function playTrack(index) {
        if (!audioEl) return Promise.resolve(false);
        if (index < 0 || index >= PLAYLIST.length) index = 0;
        currentTrack = index;
        audioEl.src = PLAYLIST[currentTrack];
        try { audioEl.currentTime = 0; } catch { /* ignore */ }
        saveState();
        if (!canPlayMusic()) {
            pauseInternal(false);
            return Promise.resolve(false);
        }
        return attemptPlay(true);
    }

    /** Synchronise l'état audio avec les options sauvegardées dans DB. */
    function syncWithOptions(fromUserAction) {
        if (!audioEl) return;
        audioEl.volume = getMusicVolume();
        if (fromUserAction) {
            // L'utilisateur vient explicitement de toucher aux réglages sonores
            if (isGlobalSoundEnabled() && isMusicOptionEnabled()) {
                userPausedByBrowser = false;
                setManuallyMuted(false);
            }
        }
        if (canPlayMusic()) {
            if (!isPlaying) attemptPlay(false);
        } else {
            pauseInternal(false);
        }
        updateQuickToggleUI();
    }

    /** Bascule rapide muet / son actif (bouton global sur toutes les pages). */
    function toggleQuickMute() {
        const currentlyActive = isGlobalSoundEnabled() && isMusicOptionEnabled() && !isManuallyMuted() && !userPausedByBrowser;
        if (currentlyActive) {
            setManuallyMuted(true);
            userPausedByBrowser = false;
            pauseInternal(false);
            return false;
        }
        // Réactivation explicite par l'utilisateur
        setManuallyMuted(false);
        userPausedByBrowser = false;
        if (!isGlobalSoundEnabled()) writeOption('sonsActifs', 'true');
        if (!isMusicOptionEnabled()) writeOption('musiqueActive', 'true');
        attemptPlay(false);
        return true;
    }

    /** Arrêt complet (ex : clic sur Quitter) — bloque toute reprise audio. */
    function stopAll() {
        stoppedByQuit = true;
        wasPlayingBeforeHide = false;
        detachGestureListeners();
        if (saveTimer) {
            clearInterval(saveTimer);
            saveTimer = null;
        }
        pauseInternal(false);
    }

    /** Modifie le volume musique en direct (0..100). */
    function setMusicVolumePercent(pct) {
        const clamped = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
        if (audioEl) audioEl.volume = clamped / 100;
    }

    /** Modifie le volume effets sonores en direct (0..100). */
    function setSfxVolumePercent(pct) {
        const clamped = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
        writeOption('volumeEffets', String(clamped));
    }

    /* ================= BRUITAGES SYNTHÉTISÉS (WEB AUDIO API) ================= */

    function playSfx(kind) {
        if (!isGlobalSoundEnabled() || !isSfxOptionEnabled() || isManuallyMuted() || isDocumentHidden()) return false;
        const vol = getSfxVolume();
        if (vol <= 0) return false;

        const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AudioCtx) return false;

        try {
            if (!sfxCtx) sfxCtx = new AudioCtx();
            if (sfxCtx.state === 'suspended') sfxCtx.resume().catch(() => { });

            const now = sfxCtx.currentTime;
            const peak = Math.min(0.25, vol * 0.22);

            const tone = (freq, startOffset, duration, type) => {
                const osc = sfxCtx.createOscillator();
                const g = sfxCtx.createGain();
                osc.type = type || 'sine';
                osc.frequency.setValueAtTime(freq, now + startOffset);
                g.gain.setValueAtTime(0.0001, now + startOffset);
                g.gain.exponentialRampToValueAtTime(peak, now + startOffset + 0.015);
                g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
                osc.connect(g);
                g.connect(sfxCtx.destination);
                osc.onended = () => {
                    try { osc.disconnect(); g.disconnect(); } catch { /* ignore */ }
                };
                osc.start(now + startOffset);
                osc.stop(now + startOffset + duration + 0.02);
            };

            if (kind === 'correct') {
                tone(523.25, 0, 0.14, 'triangle');
                tone(659.25, 0.09, 0.16, 'triangle');
                tone(783.99, 0.18, 0.24, 'triangle');
            } else if (kind === 'wrong') {
                tone(260, 0, 0.18, 'sawtooth');
                tone(195, 0.13, 0.24, 'sawtooth');
            } else if (kind === 'victory' || kind === 'unlock') {
                tone(523.25, 0, 0.12, 'triangle');
                tone(659.25, 0.1, 0.12, 'triangle');
                tone(783.99, 0.2, 0.14, 'triangle');
                tone(1046.5, 0.32, 0.3, 'triangle');
            } else if (kind === 'coin') {
                tone(987.77, 0, 0.08, 'sine');
                tone(1318.51, 0.07, 0.18, 'sine');
            } else {
                tone(440, 0, 0.06, 'sine');
            }
            return true;
        } catch {
            return false;
        }
    }

    /* ================= BOUTON FLOTTANT GLOBAL ================= */

    function mountQuickToggle() {
        if (typeof document === 'undefined' || !document.body) return;
        // Ne pas injecter sur admin.html ou test.html
        if (document.getElementById('admApp') || document.getElementById('suites-container')) return;
        if (document.getElementById('eduquest-audio-toggle')) {
            updateQuickToggleUI();
            return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'eduquest-audio-toggle';
        btn.className = 'audio-toggle-fab';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowActive = toggleQuickMute();
            // Synchroniser aussi les checkboxes Options si ouvertes sur index.html
            const sonsCb = document.getElementById('sonsActifs');
            const musCb = document.getElementById('musiqueActive');
            if (nowActive) {
                if (sonsCb) sonsCb.checked = true;
                if (musCb) {
                    musCb.disabled = false;
                    musCb.checked = true;
                    const c = musCb.closest('.checkbox-container');
                    if (c) c.classList.remove('disabled');
                }
            }
            updateQuickToggleUI();
        });

        // Sur map.html ou legal.html : insérer proprement dans les actions d'en-tête si présent (évite tout chevauchement)
        const headerSlot = document.querySelector('.map-header > div:last-child') || document.querySelector('.adm-top-right');
        if (headerSlot) {
            btn.classList.add('in-header');
            headerSlot.insertBefore(btn, headerSlot.firstChild);
        } else {
            document.body.appendChild(btn);
        }
        updateQuickToggleUI();
    }

    /* ================= INITIALISATION ================= */

    function init(customAudio) {
        if (initialized && !customAudio) return;
        initialized = true;
        stoppedByQuit = false;

        audioEl = customAudio || (typeof Audio !== 'undefined' ? new Audio() : null);
        if (!audioEl) return;

        const allowedNow = canPlayMusic();
        audioEl.loop = false;
        audioEl.preload = allowedNow ? 'metadata' : 'none';
        audioEl.volume = getMusicVolume();
        if (allowedNow) {
            restoreTrackAndTime();
        }

        // Fin de piste → piste suivante UNIQUEMENT si la musique est toujours autorisée
        audioEl.addEventListener('ended', () => {
            if (!canPlayMusic()) {
                isPlaying = false;
                updateQuickToggleUI();
                return;
            }
            const next = (currentTrack + 1) % PLAYLIST.length;
            playTrack(next);
        });

        // Détection de pause manuelle externe (contrôles média navigateur / onglet / OS)
        audioEl.addEventListener('pause', () => {
            if (internalPause || audioEl.ended) return;
            isPlaying = false;
            if (!isDocumentHidden()) {
                userPausedByBrowser = true;
                detachGestureListeners();
                saveState();
                updateQuickToggleUI();
            }
        });

        audioEl.addEventListener('play', () => {
            // Si le navigateur reprend de lui-même alors que l'utilisateur a coupé le son, on bloque
            if (!isGlobalSoundEnabled() || !isMusicOptionEnabled() || isManuallyMuted()) {
                pauseInternal(false);
                return;
            }
            userPausedByBrowser = false;
            isPlaying = true;
            detachGestureListeners();
            updateQuickToggleUI();
        });

        if (!globalListenersAttached) {
            globalListenersAttached = true;
            if (typeof document !== 'undefined') {
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        wasPlayingBeforeHide = isPlaying;
                        if (isPlaying) pauseInternal(true);
                    } else {
                        // Ne reprendre QUE si elle jouait avant masquage ET reste autorisée
                        if (wasPlayingBeforeHide && canPlayMusic()) {
                            attemptPlay(false);
                        }
                        wasPlayingBeforeHide = false;
                        updateQuickToggleUI();
                    }
                });
            }

            if (typeof window !== 'undefined') {
                const onLeave = () => { if (isPlaying) saveState(); };
                window.addEventListener('pagehide', onLeave);
                window.addEventListener('beforeunload', onLeave);

                // Synchronisation multi-onglets (si coupé dans un autre onglet)
                window.addEventListener('storage', (e) => {
                    if (!e || !e.key) return;
                    if (e.key === MANUAL_MUTE_KEY || e.key.startsWith('eduquest_opts_') || e.key === 'eduquest_options') {
                        syncWithOptions(false);
                    }
                });
            }
        }

        // Sauvegarde périodique de la position (continuité fluide entre index → dashboard → map)
        if (saveTimer) clearInterval(saveTimer);
        saveTimer = setInterval(() => {
            if (isPlaying && !isDocumentHidden()) saveState(false);
        }, 2500);
        if (saveTimer && typeof saveTimer.unref === 'function') saveTimer.unref();

        mountQuickToggle();

        // Tentative de démarrage immédiat sur CHAQUE page (accueil, matières, niveaux, quiz)
        if (canPlayMusic()) {
            attemptPlay(false);
        } else {
            updateQuickToggleUI();
        }
    }

    /** Réinitialisation interne pour tests unitaires. */
    function _resetForTests() {
        stopAll();
        audioEl = null;
        currentTrack = 0;
        isPlaying = false;
        internalPause = false;
        userPausedByBrowser = false;
        wasPlayingBeforeHide = false;
        gestureListenersAttached = false;
        initialized = false;
        stoppedByQuit = false;
    }

    return {
        PLAYLIST,
        init,
        playTrack,
        attemptPlay,
        syncWithOptions,
        toggleQuickMute,
        stopAll,
        setMusicVolumePercent,
        setMusicVolume: setMusicVolumePercent,
        setSfxVolumePercent,
        setSfxVolume: setSfxVolumePercent,
        setManualMute: setManuallyMuted,
        isManualMuted: isManuallyMuted,
        playSfx,
        canPlayMusic,
        isPlaying: () => isPlaying,
        isManuallyMuted,
        isUserPausedByBrowser: () => userPausedByBrowser,
        getCurrentTrack: () => currentTrack,
        getAudioElement: () => audioEl,
        _resetForTests,
        _resetForTest: _resetForTests,
    };
});
