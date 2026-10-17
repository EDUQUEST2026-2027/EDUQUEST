/* =============================================================================
   GAME-RULES.JS — EDUQUEST v1.26
   Règles de jeu PURES (aucun DOM, aucun stockage) partagées par la carte
   (map.html) et le tableau de bord (dashboard.html).

   POURQUOI CE FICHIER :
   Avant la v1.26, le calcul des étoiles, du Bouclier d'Étoile et des
   récompenses était dupliqué (et divergent) entre initMap et initDashboard :
     - la carte donnait 1 étoile avec bouclier au 3e essai, le dashboard 3 ;
     - un 2e bouclier pouvait être consommé sur la même question ;
     - un bouclier pouvait être débité « après coup » pendant un simple rendu.
   Toutes les règles vivent désormais ici, une seule fois, et sont testées
   (voir tests/game-rules-and-session.test.js).

   CHARGEMENT : script classique (double-clic sur index.html OK) ou
   require() Node pour les tests. Expose window.GameRules / globalThis.GameRules.
   ============================================================================= */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GameRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /** Durée d'une question en mode chrono (secondes). */
    const QUIZ_DURATION_S = 30;

    /** Valeur sentinelle soumise quand le chrono expire. */
    const TIMEOUT_ANSWER = 'TEMPS_ECOULE';

    /** Barème par défaut (surchargé par AdminStore.getRewardsConfig()). */
    const DEFAULT_REWARDS = Object.freeze({
        xpBase: 15,
        coinsBase: 10,
        chronoBonusMaxXp: 15,
        dailyChestCoins: 50,
        firstTryBonusXp: 10,
        questRewardMultiplier: 1,
    });

    const SHIELD_ID = 'boost-shield';
    const DOUBLE_XP_ID = 'boost-xp';

    /** Multiplicateur combo → x1.0 … x2.5 (même table que DB.getMultiplier). */
    function getMultiplier(combo) {
        const c = Number(combo) || 0;
        if (c <= 1) return 1.0;
        if (c === 2) return 1.2;
        if (c === 3) return 1.4;
        if (c === 4) return 1.6;
        if (c < 10) return 2.0;
        return 2.5;
    }

    /**
     * Le Bouclier d'Étoile absorbe UNIQUEMENT la première erreur d'une
     * question, et une seule fois par question.
     * @param {{attempts:number, usedShield?:boolean}} attempt  état APRÈS
     *        incrément du compteur (1re erreur ⇒ attempts === 1)
     * @param {boolean} hasShield  le joueur possède au moins un bouclier
     */
    function shouldShieldAbsorb(attempt, hasShield) {
        if (!attempt || !hasShield) return false;
        return !attempt.usedShield && attempt.attempts === 1;
    }

    /** Nombre d'essais « comptés » : l'erreur absorbée par le bouclier ne compte pas. */
    function effectiveAttempts(attempts, usedShield) {
        const a = Math.max(1, Number(attempts) || 1);
        return Math.max(1, a - (usedShield ? 1 : 0));
    }

    /** 3 étoiles du 1er coup, 2 au 2e, 1 au-delà (bouclier = 1 erreur pardonnée). */
    function starsFor(attempts, usedShield) {
        const e = effectiveAttempts(attempts, usedShield);
        if (e === 1) return 3;
        if (e === 2) return 2;
        return 1;
    }

    /** Bonus XP chrono proportionnel au temps restant. */
    function chronoBonus(rewards, chronoEnabled, timeRemaining) {
        if (!chronoEnabled) return 0;
        const t = Math.max(0, Math.min(QUIZ_DURATION_S, Number(timeRemaining) || 0));
        if (t <= 0) return 0;
        const max = Number((rewards || DEFAULT_REWARDS).chronoBonusMaxXp) || 0;
        return Math.floor(max * (t / QUIZ_DURATION_S));
    }

    /** Fusionne un barème partiel (admin) avec les valeurs par défaut. */
    function normalizeRewards(rewards) {
        const r = Object.assign({}, DEFAULT_REWARDS, rewards || {});
        Object.keys(DEFAULT_REWARDS).forEach(k => {
            const n = Number(r[k]);
            r[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_REWARDS[k];
        });
        return r;
    }

    /**
     * Calcule les gains d'un niveau réussi (1re réussite uniquement : c'est
     * à l'appelant de décider s'il crédite).
     * @param {object} p
     * @param {number} p.stars            1..3
     * @param {number} [p.multiplier=1]   multiplicateur combo
     * @param {boolean} [p.chronoEnabled]
     * @param {number} [p.timeRemaining]
     * @param {boolean} [p.doubleXp]      potion Double XP consommée
     * @param {object} [p.rewards]        barème admin
     */
    function computeLevelRewards(p) {
        const params = p || {};
        const rewards = normalizeRewards(params.rewards);
        const stars = Math.max(1, Math.min(3, Number(params.stars) || 1));
        const mult = Number(params.multiplier) > 0 ? Number(params.multiplier) : 1;
        const chrono = chronoBonus(rewards, params.chronoEnabled, params.timeRemaining);
        const perfectBonus = stars === 3 ? rewards.firstTryBonusXp : 0;
        let baseXp = rewards.xpBase + chrono + perfectBonus;
        if (params.doubleXp) baseXp *= 2;
        return {
            stars,
            xp: Math.round(baseXp * mult),
            coins: rewards.coinsBase,
            score: Math.round(100 * stars * mult),
            chronoBonus: chrono,
            perfectBonus,
            multiplier: mult,
        };
    }

    /**
     * Incréments de quêtes journalières pour un niveau réussi.
     * « firstTry » = vraiment juste du premier coup (le bouclier ne compte pas).
     */
    function questDelta({ stars, attempts, xp }) {
        return {
            levels: 1,
            xp: Math.max(0, Number(xp) || 0),
            perfect: stars === 3 ? 1 : 0,
            firstTry: attempts === 1 ? 1 : 0,
        };
    }

    return Object.freeze({
        QUIZ_DURATION_S,
        TIMEOUT_ANSWER,
        DEFAULT_REWARDS,
        SHIELD_ID,
        DOUBLE_XP_ID,
        getMultiplier,
        shouldShieldAbsorb,
        effectiveAttempts,
        starsFor,
        chronoBonus,
        normalizeRewards,
        computeLevelRewards,
        questDelta,
    });
});
