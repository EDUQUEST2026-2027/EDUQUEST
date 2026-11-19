/* =============================================================================
   QUIZ-TIMER.JS — EDUQUEST v1.27.0
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

    /** Retourne true si le mode Défi Chronométré est activé par le joueur. */
    function isEnabled() {
        try {
            const db = root && root.DB;
            if (db && typeof db.getOption === 'function') {
                return db.getOption('modeChrono') === 'true';
            }
        } catch { /* ignore */ }
        return false;
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

    /** Construit le HTML standard et lisible de la barre de chronomètre. */
    function renderBarHtml(idOrPrefix, durationSec) {
        const ids = resolveIds(idOrPrefix);
        const d = Math.max(1, Math.round(Number(durationSec) || getConfiguredDuration()));
        return `
            <div id="${ids.containerId}" class="quiz-chrono-container" role="timer" aria-live="off">
                <div class="quiz-chrono-header">
                    <span>⏱ Mode Défi Chronométré</span>
                    <span id="${ids.textId}" class="quiz-chrono-label">⏱ ${d}s</span>
                </div>
                <div class="quiz-chrono-track">
                    <div id="${ids.barId}" class="quiz-chrono-fill" style="width:100%;"></div>
                </div>
            </div>`;
    }

    /** Met à jour visuellement la barre du chronomètre dans le DOM. */
    function updateBarDom(idOrPrefix, tick) {
        if (typeof document === 'undefined' || !tick) return;
        const ids = resolveIds(idOrPrefix);
        const container = document.getElementById(ids.containerId);
        const bar = document.getElementById(ids.barId);
        const text = document.getElementById(ids.textId);
        if (bar) bar.style.width = tick.percent.toFixed(1) + '%';
        if (text) text.textContent = '⏱ ' + Math.max(0, tick.remaining) + 's';
        if (container) {
            container.classList.toggle('is-warning', Boolean(tick.warning) && !tick.urgent);
            container.classList.toggle('is-urgent', Boolean(tick.urgent));
        }
    }

    return Object.freeze({
        DEFAULT_DURATION_S,
        getConfiguredDuration,
        isEnabled,
        create,
        renderBarHtml,
        updateBarDom,
    });
});
