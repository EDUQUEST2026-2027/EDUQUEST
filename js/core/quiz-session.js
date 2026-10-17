/* =============================================================================
   QUIZ-SESSION.JS — EDUQUEST v1.26
   Soumission d'une réponse UNIFIÉE pour la carte (map.html) et le tableau de
   bord (dashboard.html). Remplace la logique dupliquée de _mapSubmitQuiz et
   _dashSubmitQuiz : correction (AiProvider → QuizEngine), combo, Bouclier
   d'Étoile — en un seul endroit.

   Dépendances résolues À L'APPEL (pas au chargement) via `deps` ou globalThis :
     AiProvider.submitAnswer, DB.{hasBooster,useBooster,recordCorrectAnswer,
     recordWrongAnswer}, GameRules, showNotification (optionnelle).
   → testable en Node avec des doublures (tests/quiz-session.test.js).
   ============================================================================= */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.QuizSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const TIMEOUT_EXPLANATION = 'Temps écoulé ! Tu as dépassé les 30 secondes accordées.';

    function resolve(deps) {
        const d = deps || {};
        return {
            ai: d.AiProvider || root.AiProvider,
            db: d.DB || root.DB,
            rules: d.GameRules || root.GameRules,
            notify: d.notify || (typeof root.showNotification === 'function' ? root.showNotification : null),
        };
    }

    /** Crée l'état d'une tentative (même forme sur la carte et le dashboard). */
    function createAttempt(extra) {
        return Object.assign({
            attempts: 0,
            variant: 0,
            submitted: null,
            answered: false,
            isCorrect: false,
            checking: false,
            lesson: null,
            questionId: null,
            explanation: '',
            usedShield: false,
        }, extra || {});
    }

    /**
     * Soumet une réponse.
     * @param {object} attempt  état mutable de la tentative (createAttempt)
     * @param {*} rawAnswer     réponse brute (ou GameRules.TIMEOUT_ANSWER)
     * @param {object} hooks
     * @param {Function} hooks.render   re-rendu de l'UI (appelé 2 fois)
     * @param {Function} hooks.isStale  true si la modale a été fermée/remplacée
     * @param {object} [deps]           injection pour les tests
     * @returns {Promise<{isCorrect:boolean, shieldAbsorbed:boolean}|null>}
     *          null si la tentative est devenue obsolète pendant la correction
     */
    async function submit(attempt, rawAnswer, hooks, deps) {
        const { ai, db, rules, notify } = resolve(deps);
        const h = hooks || {};
        const render = typeof h.render === 'function' ? h.render : () => {};
        const isStale = typeof h.isStale === 'function' ? h.isStale : () => false;

        // Anti double-soumission (double clic, Entrée + clic, chrono + clic)
        if (attempt.checking === true || attempt.answered) return null;

        attempt.submitted = rawAnswer;
        attempt.attempts += 1;
        attempt.checking = true;
        render();

        let result;
        try {
            result = await ai.submitAnswer(attempt.questionId, attempt.lesson, rawAnswer);
        } catch (err) {
            console.warn('[QuizSession] Correction impossible, réponse considérée fausse.', err);
            result = { isCorrect: false, explanation: '', answerKey: {} };
        }
        if (isStale()) return null;

        const isTimeout = rules && rawAnswer === rules.TIMEOUT_ANSWER;
        attempt.checking = false;
        attempt.answered = true;
        attempt.isCorrect = Boolean(result && result.isCorrect) && !isTimeout;
        attempt.explanation = isTimeout ? TIMEOUT_EXPLANATION : ((result && result.explanation) || '');
        attempt.lesson = Object.assign({}, attempt.lesson, (result && result.answerKey) || {});

        let shieldAbsorbed = false;
        if (attempt.isCorrect) {
            if (db && db.recordCorrectAnswer) db.recordCorrectAnswer();
        } else {
            const shieldId = rules ? rules.SHIELD_ID : 'boost-shield';
            const hasShield = Boolean(db && db.hasBooster && db.hasBooster(shieldId));
            if (rules && rules.shouldShieldAbsorb(attempt, hasShield) && db.useBooster(shieldId)) {
                attempt.usedShield = true;
                shieldAbsorbed = true;
                if (notify) notify('🛡️ Bouclier d\'Étoile consommé : série et 3 étoiles protégées !', 'info');
            }
            if (db && db.recordWrongAnswer) db.recordWrongAnswer(shieldAbsorbed);
        }
        render();
        return { isCorrect: attempt.isCorrect, shieldAbsorbed };
    }

    /** Prépare la tentative pour un nouvel essai (après une erreur). */
    function resetForRetry(attempt, nextVariant) {
        attempt.variant = nextVariant;
        attempt.submitted = null;
        attempt.answered = false;
        attempt.isCorrect = false;
        attempt.checking = 'loading';
        attempt.explanation = '';
        return attempt;
    }

    /** Variante suivante, toujours différente de la courante (3 variantes). */
    function nextVariant(current, rand) {
        const r = typeof rand === 'function' ? rand : Math.random;
        return ((Number(current) || 0) + 1 + Math.floor(r() * 2)) % 3;
    }

    return Object.freeze({ createAttempt, submit, resetForRetry, nextVariant, TIMEOUT_EXPLANATION });
});
