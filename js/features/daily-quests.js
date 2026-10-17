/* =============================================================================
   DAILY-QUESTS.JS — EDUQUEST v1.26 (extrait d'app.js)
   Quêtes journalières : 1 quête de connexion + 3 quêtes tirées chaque jour
   dans QUEST_POOL (tirage déterministe basé sur la date LOCALE), à réclamer
   sur le tableau de bord, puis coffre bonus quand tout est réclamé.

   CHANGEMENTS v1.26 :
   - Tirage Fisher-Yates + Math.imul (l'ancien `sort(() => rand() - 0.5)` était
     biaisé et dépendait de l'algorithme de tri du navigateur : deux élèves
     pouvaient avoir des quêtes différentes le même jour).
   - Stockage isolé par compte (DB.getDailyQuests / saveDailyQuests).
   - scheduleMidnightRefresh() : la page ouverte à minuit se met à jour.
   - Dépendances résolues à l'appel → testable en Node (tests/daily-quests.test.js).

   API (inchangée) : get, track, claim, claimBonus, getBonusCoins, isComplete,
                     timeLeftLabel, todayKey, BONUS_COINS
   ============================================================================= */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.DailyQuests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const VERSION = 2;
    const BONUS_COINS = 50; // Coffre bonus quand toutes les quêtes sont réclamées
    const DEFAULT_COINS = 30; // Solde initial d'un nouveau joueur (cohérent avec app.js)

    const QUEST_POOL = [
        { type: 'xp',       icon: '⚡', title: 'Gagne 30 XP',                      target: 30, xp: 20, coins: 10, color: '#ffb547' },
        { type: 'xp',       icon: '🔥', title: 'Gagne 60 XP',                      target: 60, xp: 35, coins: 15, color: '#ff6b6b' },
        { type: 'levels',   icon: '🏝️', title: 'Réussis 2 niveaux',                target: 2,  xp: 20, coins: 10, color: '#4cc9f0' },
        { type: 'levels',   icon: '🗺️', title: 'Réussis 4 niveaux',                target: 4,  xp: 35, coins: 20, color: '#3ddc97' },
        { type: 'perfect',  icon: '⭐', title: 'Décroche 3 étoiles sur un niveau', target: 1,  xp: 25, coins: 15, color: '#ffd166' },
        { type: 'firstTry', icon: '🎯', title: 'Réponds juste du 1er coup 3 fois', target: 3,  xp: 30, coins: 15, color: '#b388ff' },
    ];

    /* Horloge injectable (tests) */
    let nowFn = () => new Date();
    function _setClock(fn) { nowFn = typeof fn === 'function' ? fn : () => new Date(); }

    const db = () => root.DB;

    function todayKey(date) {
        const d = date || nowFn();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /** PRNG mulberry32 (même famille que question-bank.js). */
    function rngFromString(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        let a = h >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Tirage reproductible de 3 quêtes de types distincts pour une date. */
    function seededPick(dateStr) {
        const rand = rngFromString('eduquest-quests:' + dateStr);
        const pool = QUEST_POOL.slice();
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const picked = [], usedTypes = new Set();
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
        const d = db();
        if (d && d.saveDailyQuests) d.saveDailyQuests(data);
    }

    function get() {
        const today = todayKey();
        const d = db();
        let data = (d && d.getDailyQuests) ? d.getDailyQuests() : null;
        if (!data || data.v !== VERSION || data.date !== today || !Array.isArray(data.quests)) {
            data = generate(today);
            save(data);
        }
        return data;
    }

    const isComplete = q => q.progress >= q.target;

    function getRewardsConfig() {
        const A = root.AdminStore;
        return (A && typeof A.getRewardsConfig === 'function') ? (A.getRewardsConfig() || {}) : {};
    }

    /**
     * Enregistre la progression après un niveau réussi.
     * @param {{levels?:number, perfect?:number, firstTry?:number, xp?:number}} delta
     * @returns {Array} quêtes nouvellement accomplies
     */
    function track(delta) {
        const data = get();
        const newlyDone = [];
        const inc = delta || {};
        data.quests.forEach(q => {
            const n = Math.max(0, Number(inc[q.type]) || 0);
            if (!n || isComplete(q)) return;
            q.progress = Math.min(q.target, q.progress + n);
            if (isComplete(q)) newlyDone.push(q);
        });
        save(data);
        if (newlyDone.length && typeof setTimeout === 'function') {
            setTimeout(() => {
                if (root.Celebrate && root.Celebrate.confetti) root.Celebrate.confetti();
                if (typeof root.showNotification === 'function') {
                    newlyDone.forEach(q => root.showNotification(`🎉 Quête accomplie : ${q.title} — récompense à réclamer !`));
                }
            }, 450);
        }
        return newlyDone;
    }

    function addRewards(xp, coins) {
        const d = db();
        if (!d) return;
        d.saveOption('dash_xp', String((parseInt(d.getOption('dash_xp') || '0', 10) || 0) + xp));
        d.saveOption('dash_coins', String((parseInt(d.getOption('dash_coins') || String(DEFAULT_COINS), 10) || 0) + coins));
    }

    /** Réclame la récompense d'une quête accomplie. Retourne la quête ou null. */
    function claim(id) {
        const data = get();
        const q = data.quests.find(x => x.id === id);
        if (!q || q.claimed || !isComplete(q)) return null;
        q.claimed = true;
        save(data); // on marque AVANT de créditer : pas de double crédit si crash entre les deux
        const mult = Number(getRewardsConfig().questRewardMultiplier) || 1;
        const finalXp = Math.round(q.xp * mult);
        const finalCoins = Math.round(q.coins * mult);
        addRewards(finalXp, finalCoins);
        return { ...q, xp: finalXp, coins: finalCoins };
    }

    function getBonusCoins() {
        return Number(getRewardsConfig().dailyChestCoins) || BONUS_COINS;
    }

    /** Ouvre le coffre bonus (toutes les quêtes réclamées). */
    function claimBonus() {
        const data = get();
        if (data.bonusClaimed || !data.quests.every(q => q.claimed)) return 0;
        const chestCoins = getBonusCoins();
        data.bonusClaimed = true;
        save(data);
        addRewards(0, chestCoins);
        return chestCoins;
    }

    /** Millisecondes avant le prochain minuit local. */
    function msUntilMidnight() {
        const now = nowFn();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return Math.max(0, midnight - now);
    }

    /** Temps restant avant le renouvellement (minuit local), en texte. */
    function timeLeftLabel() {
        const mins = Math.max(0, Math.ceil(msUntilMidnight() / 60000));
        const h = Math.floor(mins / 60), m = mins % 60;
        return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`;
    }

    /** Appelle cb() juste après minuit (puis chaque jour). Retourne un annulateur. */
    function scheduleMidnightRefresh(cb) {
        let timer = null;
        const arm = () => {
            timer = setTimeout(() => { try { cb(get()); } finally { arm(); } }, msUntilMidnight() + 1000);
        };
        arm();
        return () => clearTimeout(timer);
    }

    return {
        get, track, claim, claimBonus, getBonusCoins, isComplete, timeLeftLabel, todayKey,
        msUntilMidnight, scheduleMidnightRefresh, BONUS_COINS,
        // Internes exposés pour les tests
        _seededPick: seededPick, _generate: generate, _setClock, QUEST_POOL,
    };
});
