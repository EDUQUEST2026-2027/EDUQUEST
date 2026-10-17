const test = require('node:test');
const assert = require('node:assert/strict');
const GameRules = require('../js/core/game-rules.js');
const QuizSession = require('../js/core/quiz-session.js');

test('GameRules - Calcul des Étoiles et Règle du Bouclier', async (t) => {
    await t.test('Calcul des étoiles sans bouclier', () => {
        assert.equal(GameRules.starsFor(1, false), 3, '1er essai = 3 étoiles');
        assert.equal(GameRules.starsFor(2, false), 2, '2e essai = 2 étoiles');
        assert.equal(GameRules.starsFor(3, false), 1, '3e essai = 1 étoile');
        assert.equal(GameRules.starsFor(5, false), 1, '5e essai = 1 étoile');
    });

    await t.test('Calcul des étoiles avec bouclier d\'étoile consommé', () => {
        // Le bouclier efface la première erreur (effectiveAttempts = attempts - 1)
        assert.equal(GameRules.starsFor(2, true), 3, '2 essais avec bouclier = 3 étoiles préservées');
        assert.equal(GameRules.starsFor(3, true), 2, '3 essais avec bouclier = 2 étoiles');
        assert.equal(GameRules.starsFor(4, true), 1, '4 essais avec bouclier = 1 étoile');
    });

    await t.test('Condition d\'absorption du bouclier (1 seule fois par question)', () => {
        // 1ère erreur : attempt.attempts === 1 et usedShield === false
        assert.equal(GameRules.shouldShieldAbsorb({ attempts: 1, usedShield: false }, true), true);
        
        // Pas de bouclier en stock
        assert.equal(GameRules.shouldShieldAbsorb({ attempts: 1, usedShield: false }, false), false);

        // Déjà consommé sur cette question
        assert.equal(GameRules.shouldShieldAbsorb({ attempts: 1, usedShield: true }, true), false);

        // 2e erreur sur la même question : ne doit PAS consommer un 2e bouclier
        assert.equal(GameRules.shouldShieldAbsorb({ attempts: 2, usedShield: false }, true), false);
    });

    await t.test('Multiplicateurs de Combo', () => {
        assert.equal(GameRules.getMultiplier(0), 1.0);
        assert.equal(GameRules.getMultiplier(1), 1.0);
        assert.equal(GameRules.getMultiplier(2), 1.2);
        assert.equal(GameRules.getMultiplier(3), 1.4);
        assert.equal(GameRules.getMultiplier(4), 1.6);
        assert.equal(GameRules.getMultiplier(5), 2.0);
        assert.equal(GameRules.getMultiplier(9), 2.0);
        assert.equal(GameRules.getMultiplier(10), 2.5);
        assert.equal(GameRules.getMultiplier(15), 2.5);
    });

    await t.test('Calcul complet des récompenses de niveau', () => {
        const gains = GameRules.computeLevelRewards({
            stars: 3,
            multiplier: 1.2,
            chronoEnabled: true,
            timeRemaining: 20,
            doubleXp: true,
            rewards: { xpBase: 15, coinsBase: 10, chronoBonusMaxXp: 15, firstTryBonusXp: 10 }
        });

        // chrono bonus = Math.floor(15 * 20/30) = 10
        // perfect bonus = 10
        // base = 15 + 10 + 10 = 35
        // double xp = 35 * 2 = 70
        // final xp = Math.round(70 * 1.2) = 84
        assert.equal(gains.chronoBonus, 10);
        assert.equal(gains.perfectBonus, 10);
        assert.equal(gains.xp, 84);
        assert.equal(gains.coins, 10);
        assert.equal(gains.score, Math.round(300 * 1.2)); // 360
    });
});

test('QuizSession - Pipeline unifié de soumission et consommation de boosters', async (t) => {
    await t.test('Soumission réussie du premier coup', async () => {
        const attempt = QuizSession.createAttempt({
            lesson: { q: 'Question test' },
            questionId: 'q_test_1'
        });

        let correctRecorded = false;
        const mockDeps = {
            AiProvider: {
                submitAnswer: async () => ({ isCorrect: true, explanation: 'Bravo !' })
            },
            DB: {
                recordCorrectAnswer: () => { correctRecorded = true; },
                hasBooster: () => false,
                useBooster: () => false,
            },
            GameRules,
            notify: () => {}
        };

        const res = await QuizSession.submit(attempt, 'Ma réponse', {}, mockDeps);
        assert.equal(res.isCorrect, true);
        assert.equal(attempt.attempts, 1);
        assert.equal(attempt.isCorrect, true);
        assert.equal(attempt.usedShield, false);
        assert.equal(correctRecorded, true);
    });

    await t.test('Première erreur protégée par le bouclier d\'étoile', async () => {
        const attempt = QuizSession.createAttempt({
            lesson: { q: 'Question difficile' },
            questionId: 'q_diff_1'
        });

        let boosterStock = 1;
        let shieldUsedInDb = false;
        let wrongRecordedWithShield = null;

        const mockDeps = {
            AiProvider: {
                submitAnswer: async () => ({ isCorrect: false, explanation: 'Faux' })
            },
            DB: {
                hasBooster: (id) => id === 'boost-shield' && boosterStock > 0,
                useBooster: (id) => {
                    if (id === 'boost-shield' && boosterStock > 0) {
                        boosterStock--;
                        shieldUsedInDb = true;
                        return true;
                    }
                    return false;
                },
                recordWrongAnswer: (shieldSaved) => {
                    wrongRecordedWithShield = shieldSaved;
                }
            },
            GameRules,
            notify: () => {}
        };

        // 1er essai raté avec bouclier en stock
        const res1 = await QuizSession.submit(attempt, 'Mauvaise', {}, mockDeps);
        assert.equal(res1.isCorrect, false);
        assert.equal(res1.shieldAbsorbed, true);
        assert.equal(attempt.usedShield, true);
        assert.equal(shieldUsedInDb, true);
        assert.equal(boosterStock, 0);
        assert.equal(wrongRecordedWithShield, true);

        // 2e essai raté : reset checking/answered pour simuler la tentative
        attempt.checking = false;
        attempt.answered = false;
        const res2 = await QuizSession.submit(attempt, 'Encore faux', {}, mockDeps);
        assert.equal(res2.isCorrect, false);
        assert.equal(res2.shieldAbsorbed, false);
        assert.equal(wrongRecordedWithShield, false, 'Le 2e échec ne doit pas être protégé');
    });

    await t.test('Protection anti double-soumission concurrente', async () => {
        const attempt = QuizSession.createAttempt();
        attempt.checking = true; // en cours d'évaluation

        const res = await QuizSession.submit(attempt, 'Clic rapide', {}, {
            AiProvider: {},
            DB: {},
            GameRules
        });
        assert.equal(res, null, 'Doit ignorer la soumission si checking est true');
    });
});
