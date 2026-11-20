/* =============================================================================
   QUIZ-SESSION.JS — EDUQUEST v1.29.1
   Soumission d'une réponse UNIFIÉE pour la carte (map.html) et le tableau de
   bord (dashboard.html). Gère la correction (AiProvider → QuizEngine), le combo,
   le Bouclier d'Étoile, la persistance anti-triche des erreurs et la mise à jour
   du moteur adaptatif — en un seul endroit.
   ============================================================================= */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.QuizSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const TIMEOUT_EXPLANATION = 'Temps écoulé ! Tu as dépassé les 30 secondes accordées.';

    function formatTimeoutExplanation(durationSec) {
        const d = Number(durationSec);
        if (Number.isFinite(d) && d > 0) {
            return `Temps écoulé ! Tu as dépassé les ${Math.round(d)} secondes accordées.`;
        }
        return TIMEOUT_EXPLANATION;
    }

    function resolve(deps) {
        const d = deps || {};
        return {
            ai: d.AiProvider || root.AiProvider,
            db: d.DB || root.DB,
            rules: d.GameRules || root.GameRules,
            adaptive: d.AdaptiveEngine || root.AdaptiveEngine,
            audio: d.AudioManager || root.AudioManager,
            notify: d.notify || (typeof root.showNotification === 'function' ? root.showNotification : null),
        };
    }

    /** Crée l'état d'une tentative (même forme sur la carte et le dashboard). */
    function createAttempt(extra) {
        return Object.assign({
            attempts: 0,
            variant: 0,
            salt: 0,
            submitted: null,
            answered: false,
            isCorrect: false,
            checking: false,
            lesson: null,
            questionId: null,
            explanation: '',
            usedShield: false,
            signature: '',
            failedSignatures: [],
            source: 'local',
            providerId: null,
            providerName: '',
            difficultyTier: 'standard',
            tierInfo: null,
            chronoDuration: 0,
        }, extra || {});
    }

    /**
     * Soumet une réponse.
     * @param {object} attempt  état mutable de la tentative (createAttempt)
     * @param {*} rawAnswer     réponse brute (ou GameRules.TIMEOUT_ANSWER)
     * @param {object} hooks
     * @param {Function} hooks.render     re-rendu de l'UI (appelé 2 fois)
     * @param {Function} hooks.isStale    true si la modale a été fermée/remplacée
     * @param {string}  [hooks.subjectId] identifiant de matière (pour anti-triche & adaptatif)
     * @param {string}  [hooks.niveau]    classe scolaire courante
     * @param {number}  [hooks.levelIndex] indice du niveau (0..99)
     * @param {number}  [hooks.chronoDuration] durée du chrono pour le message de dépassement
     * @param {object} [deps]             injection pour les tests
     * @returns {Promise<{isCorrect:boolean, shieldAbsorbed:boolean}|null>}
     */
    async function submit(attempt, rawAnswer, hooks, deps) {
        const { ai, db, rules, adaptive, audio, notify } = resolve(deps);
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
        const duration = h.chronoDuration || attempt.chronoDuration || 0;
        attempt.explanation = isTimeout
            ? formatTimeoutExplanation(duration)
            : ((result && result.explanation) || '');
        attempt.lesson = Object.assign({}, attempt.lesson, (result && result.answerKey) || {});

        let shieldAbsorbed = false;
        if (attempt.isCorrect) {
            if (db && db.recordCorrectAnswer) db.recordCorrectAnswer();
            if (audio && typeof audio.playSfx === 'function') audio.playSfx('correct');
        } else {
            // Mémorise la signature ratée pour empêcher son retour au réessai
            if (attempt.signature) {
                if (!Array.isArray(attempt.failedSignatures)) attempt.failedSignatures = [];
                if (!attempt.failedSignatures.includes(attempt.signature)) {
                    attempt.failedSignatures.push(attempt.signature);
                }
            }
            const shieldId = rules ? rules.SHIELD_ID : 'boost-shield';
            const comboGuardId = (rules && rules.COMBO_GUARD_ID) ? rules.COMBO_GUARD_ID : 'boost-combo';
            const hasShield = Boolean(db && db.hasBooster && db.hasBooster(shieldId));
            const streakSnap = (db && typeof db.getStreakData === 'function') ? db.getStreakData() : null;
            const hasStreakToProtect = !streakSnap || (streakSnap.combo || 0) > 0 || (streakSnap.count || 0) > 0;
            let comboGuardUsed = false;
            if (rules && rules.shouldShieldAbsorb(attempt, hasShield) && db.useBooster(shieldId)) {
                attempt.usedShield = true;
                shieldAbsorbed = true;
                if (notify) notify('🛡️ Bouclier d\'Étoile consommé : série et 3 étoiles protégées !', 'info');
            } else if (hasStreakToProtect && db && db.hasBooster && db.hasBooster(comboGuardId) && db.useBooster(comboGuardId)) {
                attempt.usedComboGuard = true;
                comboGuardUsed = true;
                if (notify) notify('🔥 Flamme Éternelle consommée : ta série et ton combo sont sauvegardés !', 'info');
            }
            if (db && db.recordWrongAnswer) db.recordWrongAnswer(shieldAbsorbed || comboGuardUsed);

            // Persistance anti-triche immédiate : quitter / recharger la page ne remet pas les étoiles à 3
            if (db && typeof db.recordLevelFailure === 'function' && h.subjectId && h.levelIndex != null) {
                const persisted = db.recordLevelFailure(h.subjectId, h.niveau || '6eme', h.levelIndex, {
                    shieldAbsorbed,
                    failedSignature: attempt.signature || '',
                });
                if (persisted && typeof persisted.questionSalt === 'number') {
                    attempt.salt = persisted.questionSalt;
                }
            }
            if (audio && typeof audio.playSfx === 'function') audio.playSfx('wrong');
        }

        // Mise à jour du moteur adaptatif (Consolidation / Standard / Approfondissement)
        if (adaptive && typeof adaptive.recordOutcome === 'function' && h.subjectId) {
            attempt.tierInfo = adaptive.recordOutcome(h.subjectId, h.niveau || '6eme', {
                isCorrect: attempt.isCorrect,
                firstTry: attempt.isCorrect && attempt.attempts === 1,
            });
            if (attempt.tierInfo && attempt.tierInfo.id) {
                attempt.difficultyTier = attempt.tierInfo.id;
            }
        }

        render();
        return { isCorrect: attempt.isCorrect, shieldAbsorbed };
    }

    /** Prépare la tentative pour un nouvel essai (après une erreur : nouvelle question garantie). */
    function resetForRetry(attempt, nextVariant) {
        attempt.variant = nextVariant;
        attempt.salt = (Number(attempt.salt) || 0) + 1;
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

    return Object.freeze({
        createAttempt,
        submit,
        resetForRetry,
        nextVariant,
        formatTimeoutExplanation,
        TIMEOUT_EXPLANATION,
    });
});
