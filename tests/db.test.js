const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../db.js');

test('DB - Gestion des Boosters et Consommables', async (t) => {
    setupTestEnv();

    await t.test('Ajout et consommation de potions', () => {
        assert.equal(DB.hasBooster('boost-shield'), false);
        assert.equal(DB.getBoosters()['boost-shield'] || 0, 0);

        // Ajoute 2 boucliers
        DB.addBooster('boost-shield', 2);
        assert.equal(DB.hasBooster('boost-shield'), true);
        assert.equal(DB.getBoosters()['boost-shield'], 2);

        // Historique d'acquisition
        const history1 = DB.getBoostersHistory();
        assert.equal(history1.acquired['boost-shield'], 2);
        assert.equal(history1.used['boost-shield'] || 0, 0);

        // Consomme 1 bouclier
        const used = DB.useBooster('boost-shield');
        assert.equal(used, true);
        assert.equal(DB.getBoosters()['boost-shield'], 1);

        const history2 = DB.getBoostersHistory();
        assert.equal(history2.used['boost-shield'], 1);

        // Consomme le 2e
        assert.equal(DB.useBooster('boost-shield'), true);
        assert.equal(DB.hasBooster('boost-shield'), false);

        // Tentative de consommer sans stock
        assert.equal(DB.useBooster('boost-shield'), false);
    });
});

test('DB - Système de Combos, Streak et Protection', async (t) => {
    setupTestEnv();

    await t.test('Progression de combo et multiplicateur', () => {
        DB.resetStreak();
        assert.equal(DB.getCombo(), 0);
        assert.equal(DB.getMultiplier(), 1.0);

        DB.recordCorrectAnswer(); // combo 1
        assert.equal(DB.getCombo(), 1);
        assert.equal(DB.getMultiplier(), 1.0);

        DB.recordCorrectAnswer(); // combo 2
        assert.equal(DB.getCombo(), 2);
        assert.equal(DB.getMultiplier(), 1.2);

        DB.recordCorrectAnswer(); // combo 3
        assert.equal(DB.getCombo(), 3);
        assert.equal(DB.getMultiplier(), 1.4);
    });

    await t.test('Erreur protégée par bouclier conserve le combo', () => {
        const res = DB.recordWrongAnswer(true);
        assert.equal(res.shieldSaved, true);
        assert.ok(DB.getCombo() >= 1, 'Le combo ne doit pas être remis à zéro avec bouclier');
    });

    await t.test('Erreur non protégée réinitialise combo et streak', () => {
        const res = DB.recordWrongAnswer(false);
        assert.equal(res.shieldSaved, false);
        assert.equal(DB.getCombo(), 0);
        assert.equal(DB.getStreak(), 0);
    });

    await t.test('Victoire de niveau incrémente le streak', () => {
        DB.resetStreak();
        const v1 = DB.recordLevelVictory();
        assert.equal(v1.streak, 1);
        const v2 = DB.recordLevelVictory();
        assert.equal(v2.streak, 2);
    });
});

test('DB - Isolation des Données entre Utilisateurs Locaux', async (t) => {
    setupTestEnv();

    await t.test('Isolation des options et progression entre deux comptes', async () => {
        // Enregistre élève A
        await DB.register('alice@ecole.fr', 'Alice', 'secret123');
        assert.equal(DB.getCurrentUser().username, 'Alice');
        DB.setNiveau('4eme');
        DB.saveOption('dash_xp', '150');
        await DB.saveProgress('maths', '4eme', { levels: { 1: { unlocked: true, stars: 3 } } });
        DB.saveDailyQuests({ user: 'alice', date: '2026-10-17' });

        // Déconnexion
        await DB.logout();
        assert.equal(DB.getCurrentUser(), null);

        // Connexion élève B
        await DB.register('bob@ecole.fr', 'Bob', 'secret456');
        assert.equal(DB.getCurrentUser().username, 'Bob');

        // Vérifie que Bob ne voit pas les données d'Alice
        assert.equal(DB.getOption('dash_xp'), null);
        assert.equal(DB.getNiveau(), null);
        const bobProgress = await DB.loadProgress('maths', '4eme');
        assert.equal(bobProgress, null);
        assert.equal(DB.getDailyQuests(), null);

        // Bob enregistre ses propres données
        DB.setNiveau('3eme');
        DB.saveOption('dash_xp', '40');

        // Reconnexion Alice
        await DB.logout();
        await DB.login('alice@ecole.fr', 'secret123');
        assert.equal(DB.getCurrentUser().username, 'Alice');
        assert.equal(DB.getOption('dash_xp'), '150');
        assert.equal(DB.getNiveau(), '4eme');
        const aliceProgress = await DB.loadProgress('maths', '4eme');
        assert.equal(aliceProgress.levels[1].stars, 3);
        assert.equal(DB.getDailyQuests().user, 'alice');
    });
});
