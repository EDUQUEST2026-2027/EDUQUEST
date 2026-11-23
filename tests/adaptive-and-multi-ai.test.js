const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../js/db.js');
const AdminStore = require('../js/admin-store.js');
const QuestionBank = require('../js/question-bank.js');
const QuizEngine = require('../js/quiz-engine.js');
const AdaptiveEngine = require('../js/core/adaptive-engine.js');
const AiProvider = require('../js/ai-provider.js');
const GameRules = require('../js/core/game-rules.js');
const QuizSession = require('../js/core/quiz-session.js');

test('Curriculum Collège / Lycée — Exclusion stricte de SES, Philosophie et NSI au collège', async (t) => {
    t.beforeEach(() => {
        localStorage.clear();
        AdminStore.resetAll();
    });

    await t.test('SES, Philosophie et NSI sont strictement interdits en 6e, 5e, 4e et 3e', () => {
        const subjects = [
            { id: 'maths', name: 'Mathématiques' },
            { id: 'techno', name: 'Technologie' },
            { id: 'philo', name: 'Philosophie' },
            { id: 'ses', name: 'SES (Économie)' },
            { id: 'nsi', name: 'NSI & Numérique' },
        ];
        const effective = AdminStore.applyOverrides(subjects);

        for (const grade of ['6eme', '5eme', '4eme', '3eme']) {
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'maths'), grade), true, `Maths autorisée en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'techno'), grade), true, `Techno autorisée en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'ses'), grade), false, `SES INTERDITE en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'philo'), grade), false, `Philo INTERDITE en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'nsi'), grade), false, `NSI INTERDITE en ${grade}`);
        }
    });

    await t.test('2nde & 1ère : SES et NSI présents, Philosophie et Technologie absents ; Terminale : Philosophie présente', () => {
        const subjects = [
            { id: 'techno', name: 'Technologie' },
            { id: 'philo', name: 'Philosophie' },
            { id: 'ses', name: 'SES (Économie)' },
            { id: 'nsi', name: 'NSI & Numérique' },
        ];
        const effective = AdminStore.applyOverrides(subjects);

        for (const grade of ['2nde', '1ere']) {
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'ses'), grade), true, `SES autorisée en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'nsi'), grade), true, `NSI autorisée en ${grade}`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'philo'), grade), false, `Philo réservée à la Terminale (pas en ${grade})`);
            assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'techno'), grade), false, `Techno réservée au Collège (pas en ${grade})`);
        }

        assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'philo'), 'terminale'), true, 'Philo autorisée en Terminale');
        assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'ses'), 'terminale'), true, 'SES autorisée en Terminale');
        assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'nsi'), 'terminale'), true, 'NSI autorisée en Terminale');
        assert.equal(AdminStore.isSubjectAllowedForNiveau(effective.find(s => s.id === 'techno'), 'terminale'), false, 'Techno interdite en Terminale');
    });
});

test('Anti-triche Étoiles & Réinitialisation sur échec (DB + QuizSession)', async (t) => {
    t.beforeEach(() => {
        localStorage.clear();
        AdaptiveEngine.resetAll();
    });

    await t.test('Une erreur persistée empêche d\'obtenir 3 étoiles après retour de page ou rechargement', async () => {
        // 1. Premier essai raté sur Maths niveau 0 en 6ème
        const attempt1 = QuizSession.createAttempt({
            lesson: { type: 'qcm', q: 'Combien font 2 + 2 ?', opts: ['3', '4', '5', '6'], correct: 1, exp: '2 + 2 = 4' },
            signature: 'qcm|combien font 2 2|',
        });

        await QuizSession.submit(attempt1, 0, {
            subjectId: 'maths',
            niveau: '6eme',
            levelIndex: 0,
        }, { AiProvider, DB, GameRules, AdaptiveEngine });

        assert.equal(attempt1.isCorrect, false);

        // 2. L'élève quitte / fait retour navigateur / recharge la page et rouvre le niveau 0
        const persisted = DB.getLevelAttempt('maths', '6eme', 0);
        assert.equal(persisted.fails, 1, 'L\'erreur doit être persistée dans DB');
        assert.ok(persisted.questionSalt >= 1, 'Le sel de question doit incrémenter pour forcer une nouvelle question');
        assert.ok(persisted.failedSignatures.includes('qcm|combien font 2 2|'));

        // 3. Deuxième visite : l'élève réussit la nouvelle question du premier coup de cette visite
        const attempt2 = QuizSession.createAttempt({
            attempts: persisted.fails,
            usedShield: persisted.usedShield,
            salt: persisted.questionSalt,
            failedSignatures: persisted.failedSignatures.slice(),
            lesson: { type: 'qcm', q: 'Combien font 3 + 5 ?', opts: ['7', '8', '9', '10'], correct: 1, exp: '3 + 5 = 8' },
            signature: 'qcm|combien font 3 5|',
        });

        await QuizSession.submit(attempt2, 1, {
            subjectId: 'maths',
            niveau: '6eme',
            levelIndex: 0,
        }, { AiProvider, DB, GameRules, AdaptiveEngine });

        assert.equal(attempt2.isCorrect, true);
        assert.equal(attempt2.attempts, 2, 'Tentative cumulée = 1 échec persisté + 1 réussite = 2');
        assert.equal(GameRules.starsFor(attempt2.attempts, attempt2.usedShield), 2, 'Doit donner 2 étoiles MAXIMUM, JAMAIS 3 !');

        // 4. Nettoyage après victoire validée
        DB.clearLevelAttempt('maths', '6eme', 0);
        assert.equal(DB.getLevelAttempt('maths', '6eme', 0).fails, 0);
    });
});

test('AdaptiveEngine — Anti-répétition, reset sur échec & difficulté adaptative', async (t) => {
    t.beforeEach(() => {
        localStorage.clear();
        AdaptiveEngine.resetAll();
    });

    await t.test('Ne répète pas les questions sur 12 niveaux consécutifs', () => {
        const seen = new Set();
        for (let i = 0; i < 12; i++) {
            const res = AdaptiveEngine.pickLocalQuestion({
                subjectId: 'histoire',
                levelIndex: i,
                niveau: '3eme',
                salt: 0,
            });
            assert.ok(res.lesson && res.lesson.q, `Question valide pour niveau ${i + 1}`);
            assert.equal(seen.has(res.signature), false, `Pas de répétition au niveau ${i + 1}: ${res.lesson.q}`);
            seen.add(res.signature);
        }
    });

    await t.test('Réinitialise vers une question différente après un échec (excludeSignatures)', () => {
        const first = AdaptiveEngine.pickLocalQuestion({
            subjectId: 'maths',
            levelIndex: 0,
            niveau: '6eme',
            salt: 0,
        });
        const retry = AdaptiveEngine.pickLocalQuestion({
            subjectId: 'maths',
            levelIndex: 0,
            niveau: '6eme',
            salt: 1,
            excludeSignatures: [first.signature],
        });
        assert.notEqual(retry.signature, first.signature, 'Le réessai après échec doit proposer une nouvelle question');
    });

    await t.test('Ajuste le palier adaptatif selon les réussites et les échecs', () => {
        assert.equal(AdaptiveEngine.getTierInfo('maths', '4eme').id, 'standard');

        // 2 échecs consécutifs → Consolidation (remediation)
        AdaptiveEngine.recordOutcome('maths', '4eme', { isCorrect: false, firstTry: false });
        AdaptiveEngine.recordOutcome('maths', '4eme', { isCorrect: false, firstTry: false });
        assert.equal(AdaptiveEngine.getTierInfo('maths', '4eme').id, 'remediation');

        // 3 réussites consécutives → Approfondissement
        AdaptiveEngine.recordOutcome('maths', '4eme', { isCorrect: true, firstTry: true });
        AdaptiveEngine.recordOutcome('maths', '4eme', { isCorrect: true, firstTry: true });
        AdaptiveEngine.recordOutcome('maths', '4eme', { isCorrect: true, firstTry: true });
        assert.equal(AdaptiveEngine.getTierInfo('maths', '4eme').id, 'approfondissement');
    });
});

test('Multi-IA Pool (AiProvider) — Sélection aléatoire, bascule en cascade et repli local', async (t) => {
    const origFetch = global.fetch;

    t.beforeEach(() => {
        localStorage.clear();
        AdminStore.resetAll();
        AdaptiveEngine.resetAll();
    });

    t.afterEach(() => {
        global.fetch = origFetch;
    });

    await t.test('Sélectionne aléatoirement dans un pool de plusieurs IA et bascule en cascade si la 1ère échoue', async () => {
        AdminStore.saveAiConfig({
            adaptiveMode: true,
            selectionStrategy: 'random',
            providers: [
                { id: 'ia-broken', name: 'IA en panne', type: 'make_webhook', endpoint: 'https://broken.invalid/hook', enabled: true, weight: 5 },
                { id: 'ia-openai', name: 'Mistral Test', type: 'openai_compatible', endpoint: 'https://ok.invalid/v1/chat', model: 'mistral-small', enabled: true, weight: 1 },
            ],
        });

        let calledUrls = [];
        global.fetch = async (url) => {
            calledUrls.push(url);
            if (url.includes('broken.invalid')) {
                return { ok: false, status: 503, json: async () => ({}) };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                type: 'qcm',
                                q: 'Question générée par Mistral Test : combien font 9 × 7 ?',
                                opts: ['56', '63', '64', '72'],
                                correct: 1,
                                exp: '9 × 7 = 63.',
                            }),
                        },
                    }],
                }),
            };
        };

        const res = await AiProvider.fetchQuestion('maths', 0, '6eme');
        assert.equal(res.source, 'ai');
        assert.equal(res.providerId, 'ia-openai');
        assert.equal(res.providerName, 'Mistral Test');
        assert.equal(res.lesson.opts[res.lesson.correct], '63');
        assert.ok(calledUrls.some(u => u.includes('ok.invalid')));
    });

    await t.test('Retombe silencieusement sur AdaptiveEngine local si toutes les IA du pool échouent', async () => {
        AdminStore.saveAiConfig({
            providers: [
                { id: 'ia-1', name: 'IA 1', type: 'make_webhook', endpoint: 'https://down1.invalid', enabled: true },
                { id: 'ia-2', name: 'IA 2', type: 'gemini', endpoint: 'https://down2.invalid', apiKey: 'fake', enabled: true },
            ],
        });
        global.fetch = async () => { throw new Error('Network offline'); };

        const res = await AiProvider.fetchQuestion('svt', 2, '5eme');
        assert.equal(res.source, 'local');
        assert.ok(res.lesson && res.lesson.q);
    });

    await t.test('Lot de personas IA locales pilotable en admin : rotation après échec, désactivation et personnalisation', async () => {
        const pool = AiProvider.getAiPool();
        assert.equal(pool.length, 5, '5 personas locales par défaut attendues');

        const firstAi = AiProvider.pickRandomAi();
        assert.ok(firstAi && firstAi.id);
        const reset = AiProvider.resetLevelQuestions('maths', 1, '6eme');
        assert.ok(reset.aiAgent && reset.aiAgent.id !== firstAi.id, 'Doit changer de persona après un échec');

        const localFetch = await AiProvider.fetchQuestion('maths', 2, '5eme');
        assert.equal(localFetch.source, 'local');
        assert.ok(localFetch.aiAgent && localFetch.lesson.aiAgent, 'La leçon locale doit être enrichie par une persona active');

        // Personnalisation depuis AdminStore
        AdminStore.saveAiConfig({
            enableLocalPersonas: true,
            localPersonas: [
                { id: 'ai-hypatie', name: 'IA Hypatie', role: 'Géométrie', icon: '📐', color: '#4cc9f0', hintPrefix: 'Hypatie : ', enabled: true },
            ],
        });
        const customFetch = await AiProvider.fetchQuestion('maths', 3, '4eme');
        assert.equal(customFetch.aiAgent.id, 'ai-hypatie');
        assert.equal(customFetch.lesson.aiAgent.name, 'IA Hypatie');

        // Désactivation complète des personas depuis AdminStore
        AdminStore.saveAiConfig({ enableLocalPersonas: false });
        const noPersonaFetch = await AiProvider.fetchQuestion('maths', 4, '4eme');
        assert.equal(noPersonaFetch.aiAgent, null);
        assert.equal(noPersonaFetch.lesson.aiAgent, undefined);
    });
});

test('QuestionBank — Intégrité des QCM (aucune option dupliquée, aucune date future en histoire)', async () => {
    const subjects = ['maths', 'francais', 'anglais', 'histoire', 'geo', 'svt', 'physique', 'chimie', 'techno', 'emc', 'philo', 'nsi', 'ses'];
    const grades = ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale'];

    for (const sub of subjects) {
        const subGrades = sub === 'philo' ? ['terminale'] : (sub === 'nsi' || sub === 'ses') ? ['2nde', '1ere', 'terminale'] : grades;
        for (const grade of subGrades) {
            for (let i = 0; i < 12; i++) {
                const q = QuestionBank.generateOne(sub, i, grade, i % 3);
                assert.ok(q && q.q, `${sub}/${grade}/#${i} doit avoir une question`);
                if (q.type === 'qcm') {
                    assert.ok(Array.isArray(q.opts) && q.opts.length >= 2);
                    const unique = new Set(q.opts.map(o => String(o).trim().toLowerCase()));
                    assert.equal(unique.size, q.opts.length, `Options dupliquées dans ${sub}/${grade}/#${i} : ${JSON.stringify(q.opts)}`);
                    assert.ok(q.correct >= 0 && q.correct < q.opts.length);
                    if (sub === 'histoire') {
                        for (const opt of q.opts) {
                            if (/^\d{4}$/.test(opt)) {
                                assert.ok(parseInt(opt, 10) <= 2024, `Année future détectée en histoire : ${opt}`);
                            }
                        }
                    }
                }
            }
        }
    }
});
