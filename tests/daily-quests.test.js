const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../db.js');
globalThis.DB = DB;
const DailyQuests = require('../js/features/daily-quests.js');

test('DailyQuests - Déterminisme du tirage et structure', async (t) => {
    await t.test('Tirage Fisher-Yates déterministe pour une même date', () => {
        const pick1 = DailyQuests._seededPick('2026-10-17');
        const pick2 = DailyQuests._seededPick('2026-10-17');
        assert.equal(pick1.length, 3);
        assert.equal(pick2.length, 3);
        assert.deepEqual(pick1, pick2, 'Deux tirages pour la même date doivent être strictement identiques');

        // Vérifie l'unicité des types de quêtes
        const types = new Set(pick1.map(q => q.type));
        assert.equal(types.size, 3, 'Les 3 quêtes tirées doivent avoir des types distincts');
    });

    await t.test('Structure complète générée', () => {
        const generated = DailyQuests._generate('2026-10-17');
        assert.equal(generated.date, '2026-10-17');
        assert.equal(generated.bonusClaimed, false);
        assert.equal(generated.quests.length, 4);

        // La première quête est toujours le login du jour, pré-validée
        const loginQuest = generated.quests[0];
        assert.equal(loginQuest.id, 'q_login');
        assert.equal(loginQuest.type, 'login');
        assert.equal(loginQuest.progress, 1);
        assert.equal(loginQuest.target, 1);
        assert.equal(loginQuest.claimed, false);
        assert.equal(DailyQuests.isComplete(loginQuest), true);

        // Les 3 autres quêtes ont un progrès initial à 0
        for (let i = 1; i < 4; i++) {
            const q = generated.quests[i];
            assert.equal(q.progress, 0);
            assert.equal(q.claimed, false);
            assert.equal(DailyQuests.isComplete(q), false);
        }
    });
});

test('DailyQuests - Cycle de vie, progression et réclamations', async (t) => {
    setupTestEnv();
    globalThis.DB = DB;
    delete globalThis.AdminStore;

    // Fixe l'horloge au 17 Octobre 2026
    DailyQuests._setClock(() => new Date(2026, 9, 17, 10, 0, 0));

    await t.test('Initialisation et persistance dans DB', () => {
        const questsData = DailyQuests.get();
        assert.equal(questsData.date, '2026-10-17');
        assert.equal(questsData.quests.length, 4);

        // Deuxième appel réutilise les données persistées
        const cachedData = DailyQuests.get();
        assert.deepEqual(cachedData, questsData);
    });

    await t.test('Réclamation de la quête de connexion', () => {
        const initialXp = parseInt(DB.getOption('dash_xp') || '0', 10);
        const initialCoins = parseInt(DB.getOption('dash_coins') || '30', 10);

        const claimed = DailyQuests.claim('q_login');
        assert.ok(claimed, 'La quête de connexion doit être réclamable');
        assert.equal(claimed.claimed, true);

        const newXp = parseInt(DB.getOption('dash_xp') || '0', 10);
        const newCoins = parseInt(DB.getOption('dash_coins') || '30', 10);
        assert.equal(newXp, initialXp + claimed.xp);
        assert.equal(newCoins, initialCoins + claimed.coins);

        // Tentative de double-réclamation
        const doubleClaim = DailyQuests.claim('q_login');
        assert.equal(doubleClaim, null, 'Une quête déjà réclamée ne peut plus être réclamée');
        assert.equal(parseInt(DB.getOption('dash_xp') || '0', 10), newXp, 'L\'XP ne doit pas augmenter lors d\'un double-claim');
    });

    await t.test('Progression via track() sans dépassement', () => {
        const dataBefore = DailyQuests.get();
        const nonLoginQuests = dataBefore.quests.slice(1);

        // Simule un delta qui fait progresser toutes les quêtes au maximum
        const delta = {
            xp: 100,
            levels: 10,
            perfect: 5,
            firstTry: 10,
        };

        const newlyDone = DailyQuests.track(delta);
        assert.ok(newlyDone.length > 0, 'Les quêtes doivent être signalées comme accomplies');

        const dataAfter = DailyQuests.get();
        dataAfter.quests.forEach(q => {
            assert.ok(q.progress <= q.target, `Le progrès (${q.progress}) ne doit pas dépasser target (${q.target})`);
            assert.equal(DailyQuests.isComplete(q), true, 'Toutes les quêtes doivent être complètes');
        });

        // Un second track ne signale pas de quêtes déjà complètes
        const secondTrack = DailyQuests.track(delta);
        assert.equal(secondTrack.length, 0, 'Une quête déjà complète ne doit pas être renvoyée dans newlyDone');
    });

    await t.test('Coffre bonus débloqué uniquement après 100% de réclamation', () => {
        // Tentative d'ouvrir le coffre alors que les 3 quêtes secondaires ne sont pas encore réclamées
        const earlyChest = DailyQuests.claimBonus();
        assert.equal(earlyChest, 0, 'Le coffre ne peut pas être réclamé avant que toutes les quêtes soient réclamées');

        // Réclame les 3 quêtes secondaires
        const data = DailyQuests.get();
        for (let i = 1; i < data.quests.length; i++) {
            const q = data.quests[i];
            const claimed = DailyQuests.claim(q.id);
            assert.ok(claimed, `La quête ${q.id} doit pouvoir être réclamée`);
        }

        // Toutes les quêtes sont réclamées : réclame le coffre bonus
        const coinsBefore = parseInt(DB.getOption('dash_coins') || '30', 10);
        const chestCoins = DailyQuests.claimBonus();
        assert.equal(chestCoins, DailyQuests.BONUS_COINS, `Le coffre bonus doit rapporter ${DailyQuests.BONUS_COINS} pièces`);
        const coinsAfter = parseInt(DB.getOption('dash_coins') || '30', 10);
        assert.equal(coinsAfter, coinsBefore + chestCoins);

        // Tentative de réclamer à nouveau le coffre bonus
        const secondChest = DailyQuests.claimBonus();
        assert.equal(secondChest, 0, 'Le coffre bonus ne peut être réclamé qu\'une seule fois par jour');
    });
});

test('DailyQuests - Renouvellement lors du changement de jour', async (t) => {
    setupTestEnv();
    globalThis.DB = DB;

    // Jour 1 : 17 Octobre 2026
    DailyQuests._setClock(() => new Date(2026, 9, 17, 14, 0, 0));
    const day1 = DailyQuests.get();
    assert.equal(day1.date, '2026-10-17');
    DailyQuests.claim('q_login');

    // Avancement de l'horloge au lendemain : 18 Octobre 2026
    DailyQuests._setClock(() => new Date(2026, 9, 18, 8, 30, 0));
    const day2 = DailyQuests.get();
    assert.equal(day2.date, '2026-10-18');
    assert.equal(day2.bonusClaimed, false);
    assert.equal(day2.quests[0].claimed, false, 'La quête de connexion du nouveau jour doit être à nouveau disponible');
});

test('DailyQuests - Multiplicateur AdminStore et configuration dynamique', async (t) => {
    setupTestEnv();
    globalThis.DB = DB;

    // Mock AdminStore avec un multiplicateur de quête x2 et coffre à 100 coins
    globalThis.AdminStore = {
        getRewardsConfig: () => ({
            questRewardMultiplier: 2,
            dailyChestCoins: 100,
        })
    };

    DailyQuests._setClock(() => new Date(2026, 9, 17, 11, 0, 0));
    const data = DailyQuests.get();
    const loginQuest = data.quests[0];
    const initialCoins = parseInt(DB.getOption('dash_coins') || '30', 10);

    const claimed = DailyQuests.claim(loginQuest.id);
    assert.equal(claimed.coins, loginQuest.coins * 2, 'Le multiplicateur x2 doit être appliqué aux pièces');
    assert.equal(claimed.xp, loginQuest.xp * 2, 'Le multiplicateur x2 doit être appliqué à l\'XP');
    assert.equal(parseInt(DB.getOption('dash_coins') || '30', 10), initialCoins + loginQuest.coins * 2);

    assert.equal(DailyQuests.getBonusCoins(), 100, 'La valeur du coffre bonus configurée dans AdminStore doit être respectée');

    delete globalThis.AdminStore;
});
