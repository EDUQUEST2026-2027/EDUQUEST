/* =============================================================================
   QUIZ-TIMER.JS — EDUQUEST v1.29.1
   Gestionnaire unifié et fiable du chronomètre des exercices.

   POURQUOI CE MODULE :
   Corrige définitivement le bug où le chronomètre ne fonctionnait que pour le
   premier exercice (conflits de timers globaux, DOM obsolète sur exercice 2+,
   durée codée en dur à 30s ignorant la config admin, fuites sur fermeture).

   GARANTIES :
   - Horloge réelle (Date.now) : aucune dérive même si l'onglet ralentit.
   - Redémarrage propre garanti à chaque exercice (niveau 1 à 100) et à chaque essai.
   - Déclenchement UNIQUE de onExpire() à 0s.
   - Durée dynamique depuis AdminStore.getSiteConfig().quizTimerSeconds (repli 30s).
   - Export UMD : window.QuizTimer (navigateur) & module.exports (Node tests).
   ============================================================================= */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.QuizTimer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const DEFAULT_DURATION_S = 30;
    const TICK_MS = 200;

    /** Retourne la durée configurée du chronomètre (en secondes). */
    function getConfiguredDuration() {
        try {
            const store = root && root.AdminStore;
            if (store && typeof store.getSiteConfig === 'function') {
                const cfg = store.getSiteConfig();
                if (cfg && Number(cfg.quizTimerSeconds) >= 5) {
                    return Math.round(Number(cfg.quizTimerSeconds));
                }
            }
        } catch { /* stockage bloqué */ }
        const rules = root && root.GameRules;
        return (rules && Number(rules.QUIZ_DURATION_S) > 0) ? Number(rules.QUIZ_DURATION_S) : DEFAULT_DURATION_S;
    }

    /** Retourne true si le mode Défi Chronométré est autorisé globalement par l'admin. */
    function isAllowedByAdmin() {
        try {
            const store = root && root.AdminStore;
            if (store && typeof store.getSiteConfig === 'function') {
                const cfg = store.getSiteConfig();
                if (cfg && cfg.enableChrono === false) return false;
            }
        } catch { /* ignore */ }
        return true;
    }

    /** Retourne true si le mode Défi Chronométré est activé par défaut (pilotable en admin). */
    function isEnabledByDefault() {
        try {
            const store = root && root.AdminStore;
            if (store && typeof store.getSiteConfig === 'function') {
                const cfg = store.getSiteConfig();
                if (cfg && typeof cfg.chronoEnabledByDefault === 'boolean') {
                    return cfg.chronoEnabledByDefault;
                }
            }
        } catch { /* ignore */ }
        return true;
    }

    /** Retourne true si le mode Défi Chronométré est actif pour le joueur. */
    function isEnabled() {
        if (!isAllowedByAdmin()) return false;
        try {
            const db = root && root.DB;
            if (db && typeof db.getOption === 'function') {
                const opt = db.getOption('modeChrono');
                if (opt === 'true') return true;
                if (opt === 'false') return false;
            }
        } catch { /* ignore */ }
        return isEnabledByDefault();
    }

    /** Résout les IDs DOM à partir d'un containerId exact ou d'un préfixe. */
    function resolveIds(idOrPrefix) {
        const raw = String(idOrPrefix || 'chrono-bar-container');
        if (raw.endsWith('-container')) {
            const base = raw.slice(0, -'-container'.length);
            return {
                containerId: raw,
                barId: base,
                textId: base + '-time-text',
            };
        }
        return {
            containerId: raw + '-chrono-bar-container',
            barId: raw + '-chrono-bar',
            textId: raw + '-chrono-time-text',
        };
    }

    /** Crée une instance de chronomètre autonome et réutilisable pour une modale. */
    function create(opts) {
        const o = opts || {};
        const nowFn = typeof o.now === 'function' ? o.now : () => Date.now();
        const setInt = typeof o.setInterval === 'function' ? o.setInterval : setInterval;
        const clearInt = typeof o.clearInterval === 'function' ? o.clearInterval : clearInterval;
        const defaultContainerId = o.containerId || null;
        const defaultOnTick = typeof o.onTick === 'function' ? o.onTick : null;
        const defaultOnExpire = typeof o.onExpire === 'function' ? o.onExpire : null;

        let handle = null;
        let durationSec = DEFAULT_DURATION_S;
        let startTimeMs = 0;
        let remainingSec = DEFAULT_DURATION_S;
        let running = false;
        let expired = false;
        let sessionToken = 0;

        function stop() {
            sessionToken++;
            if (handle !== null) {
                clearInt(handle);
                handle = null;
            }
            running = false;
        }

        function start(duration, onTickArg, onExpireArg) {
            stop();
            const token = ++sessionToken;
            const tickCb = typeof onTickArg === 'function' ? onTickArg : defaultOnTick;
            const expireCb = typeof onExpireArg === 'function' ? onExpireArg : defaultOnExpire;
            const numDur = Number(duration);
            durationSec = (Number.isFinite(numDur) && numDur > 0)
                ? (numDur >= 1 ? Math.round(numDur) : numDur)
                : getConfiguredDuration();
            remainingSec = Math.ceil(durationSec);
            startTimeMs = nowFn();
            running = true;
            expired = false;

            const emit = () => {
                if (token !== sessionToken || !running) return;
                const elapsedSec = Math.max(0, (nowFn() - startTimeMs) / 1000);
                const exactLeft = Math.max(0, durationSec - elapsedSec);
                remainingSec = Math.ceil(exactLeft);
                const pct = durationSec > 0 ? Math.max(0, Math.min(100, (exactLeft / durationSec) * 100)) : 0;

                const tickPayload = {
                    remaining: remainingSec,
                    exactRemaining: exactLeft,
                    duration: durationSec,
                    percent: pct,
                    urgent: remainingSec <= 5,
                    warning: remainingSec <= Math.max(10, Math.round(durationSec * 0.35)),
                };

                if (defaultContainerId) {
                    updateBarDom(defaultContainerId, tickPayload);
                }
                if (typeof tickCb === 'function') {
                    tickCb(tickPayload);
                }

                if (exactLeft <= 0 && !expired) {
                    expired = true;
                    stop();
                    if (typeof expireCb === 'function') {
                        expireCb({ duration: durationSec });
                    }
                }
            };

            // Premier rendu immédiat (évite le flash ou une barre figée)
            emit();
            if (running) {
                handle = setInt(emit, TICK_MS);
            }
            return durationSec;
        }

        return {
            start,
            stop,
            isRunning: () => running,
            getRemaining: () => remainingSec,
            getDuration: () => durationSec,
            hasExpired: () => expired,
        };
    }

    const TIMER_SVG = '<svg class="eq-icon eq-icon--cyan" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="currentColor" fill-opacity="0.18"/><path d="M12 9v4l2.5 2M9 3h6M12 3v2"/></svg>';

    /** Construit le HTML standard et lisible de la barre de chronomètre. */
    function renderBarHtml(idOrPrefix, durationSec) {
        const ids = resolveIds(idOrPrefix);
        const d = Math.max(1, Math.round(Number(durationSec) || getConfiguredDuration()));
        const icon = (root && root.EduIcons && typeof root.EduIcons.svg === 'function')
            ? root.EduIcons.svg('timer', { size: 15, tone: 'cyan' })
            : TIMER_SVG;
        return `
            <div id="${ids.containerId}" class="quiz-chrono-container" role="timer" aria-live="off">
                <div class="quiz-chrono-header">
                    <span class="quiz-chrono-title">${icon} Mode Défi Chronométré</span>
                    <span id="${ids.textId}" class="quiz-chrono-label">${icon}<span class="quiz-chrono-sec">${d}s</span></span>
                </div>
                <div class="quiz-chrono-track">
                    <div id="${ids.barId}" class="quiz-chrono-fill" style="width:100%;"></div>
                </div>
            </div>`;
    }

    const _domRefCache = new Map();

    /** Met à jour visuellement la barre du chronomètre dans le DOM (avec cache de nœuds connectés). */
    function updateBarDom(idOrPrefix, tick) {
        if (typeof document === 'undefined' || !tick) return;
        const key = String(idOrPrefix || 'chrono-bar-container');
        let refs = _domRefCache.get(key);
        if (!refs || !refs.container || !refs.container.isConnected) {
            const ids = resolveIds(key);
            const container = document.getElementById(ids.containerId);
            const bar = document.getElementById(ids.barId);
            const text = document.getElementById(ids.textId);
            const secEl = text ? text.querySelector('.quiz-chrono-sec') : null;
            refs = { container, bar, text, secEl };
            if (container && container.isConnected) _domRefCache.set(key, refs);
            else _domRefCache.delete(key);
        }
        const { container, bar, text, secEl } = refs;
        if (bar) bar.style.width = tick.percent.toFixed(1) + '%';
        if (secEl) secEl.textContent = Math.max(0, tick.remaining) + 's';
        else if (text) text.textContent = Math.max(0, tick.remaining) + 's';
        if (container) {
            container.classList.toggle('is-warning', Boolean(tick.warning) && !tick.urgent);
            container.classList.toggle('is-urgent', Boolean(tick.urgent));
        }
    }

    return Object.freeze({
        DEFAULT_DURATION_S,
        getConfiguredDuration,
        isAllowedByAdmin,
        isEnabledByDefault,
        isEnabled,
        create,
        renderBarHtml,
        updateBarDom,
    });
});
