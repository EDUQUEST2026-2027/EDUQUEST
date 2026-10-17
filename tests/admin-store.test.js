const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const QuestionBank = require('../js/question-bank.js');
global.QuestionBank = QuestionBank;
const AdminStore = require('../js/admin-store.js');
AdminStore.registerDefaults([
    { id: 'maths', name: 'Mathématiques', icon: '📐', lessons: [{ type: 'qcm', q: '1+1', opts: ['2', '3'], correct: 0 }] }
]);

test('AdminStore - Validation des leçons et types de questions', async (t) => {
    await t.test('QCM valide', () => {
        const err = AdminStore.validateLesson({
            type: 'qcm',
            q: 'Combien font 2+2 ?',
            opts: ['1', '2', '3', '4'],
            correct: 3,
        });
        assert.equal(err, null);
    });

    await t.test('QCM invalide (réponses en double)', () => {
        const err = AdminStore.validateLesson({
            type: 'qcm',
            q: 'Question ?',
            opts: ['A', 'A'],
            correct: 0,
        });
        assert.notEqual(err, null);
    });

    await t.test('Vrai / Faux valide', () => {
        const err = AdminStore.validateLesson({
            type: 'vrai_faux',
            q: 'La Terre est ronde.',
            correct: true,
        });
        assert.equal(err, null);
    });

    await t.test('Réponse courte valide et invalide', () => {
        const valid = AdminStore.validateLesson({
            type: 'reponse_courte',
            q: 'Capitale ?',
            accepted: ['Paris', 'paris'],
        });
        assert.equal(valid, null);

        const invalid = AdminStore.validateLesson({
            type: 'reponse_courte',
            q: 'Capitale ?',
            accepted: [],
        });
        assert.notEqual(invalid, null);
    });

    await t.test('Texte à trous valide et comptage', () => {
        const valid = AdminStore.validateLesson({
            type: 'texte_a_trous',
            textWithBlanks: 'Le soleil se lève à l\'___ et se couche à l\'___.',
            blanks: [['est'], ['ouest']],
        });
        assert.equal(valid, null);

        const mismatch = AdminStore.validateLesson({
            type: 'texte_a_trous',
            textWithBlanks: 'Un trou : ___',
            blanks: [['rep1'], ['rep2']],
        });
        assert.notEqual(mismatch, null);
    });

    await t.test('Association valide', () => {
        const valid = AdminStore.validateLesson({
            type: 'drag_and_drop',
            q: 'Associe les paires',
            items: ['A', 'B'],
            targets: ['1', '2'],
            pairs: { A: '1', B: '2' },
        });
        assert.equal(valid, null);
    });

    await t.test('Texte à choix déroulant valide', () => {
        const valid = AdminStore.validateLesson({
            type: 'texte_a_choix',
            textWithBlanks: 'Il fait beau [___] je sors.',
            choices: [['donc', 'mais', 'car']],
            correct: [0],
        });
        assert.equal(valid, null);
    });
});

test('AdminStore - Matières personnalisées et surcharges', async (t) => {
    AdminStore.resetAll();

    await t.test('Création de matière personnalisée', () => {
        const res = AdminStore.createCustomSubject('Astronomie Avancée', '🔭');
        assert.equal(res.ok, true);
        assert.ok(res.id.startsWith('astronomie-avancee'));
        assert.equal(AdminStore.isCustom(res.id), true);
    });

    await t.test('Gestion des niveaux scolaires et bandes', () => {
        assert.equal(AdminStore.levelBand('6eme'), 'college');
        assert.equal(AdminStore.levelBand('terminale'), 'lycee');
        assert.equal(AdminStore.levelLabel('6eme'), '6ème');
    });

    await t.test('Export et Import JSON', () => {
        const json = AdminStore.exportJson();
        assert.ok(json.length > 50);
        const imported = AdminStore.importJson(json);
        assert.equal(imported.ok, true);
    });

    await t.test('Nettoyage des données de jeu locales sans impacter les comptes', () => {
        localStorage.setItem('eduquest_options', '{}');
        localStorage.setItem('eduquest_opts_u_eleve', '{}');
        localStorage.setItem('eduquest_local_users', '[{"email":"test@test.fr"}]');

        const deleted = AdminStore.clearLocalGameData();
        assert.ok(deleted >= 2);
        assert.notEqual(localStorage.getItem('eduquest_local_users'), null, 'Les comptes doivent être préservés');
    });

    await t.test('Configuration globale du site (get, save, reset)', () => {
        const def = AdminStore.getSiteConfig();
        assert.equal(def.title, 'EDUQUEST');
        assert.equal(def.quizTimerSeconds, 45);

        const saved = AdminStore.saveSiteConfig({
            title: 'Collège & Lycée Quest',
            quizTimerSeconds: 60,
            xpMultiplier: 1.5,
            coinMultiplier: 2.0,
            allowRegistration: false,
        });
        assert.equal(saved.ok, true);

        const updated = AdminStore.getSiteConfig();
        assert.equal(updated.title, 'Collège & Lycée Quest');
        assert.equal(updated.quizTimerSeconds, 60);
        assert.equal(updated.xpMultiplier, 1.5);
        assert.equal(updated.coinMultiplier, 2.0);
        assert.equal(updated.allowRegistration, false);

        AdminStore.resetSiteConfig();
        const restored = AdminStore.getSiteConfig();
        assert.equal(restored.title, 'EDUQUEST');
        assert.equal(restored.quizTimerSeconds, 45);
    });

    await t.test('Configuration de l\'IA et Webhooks Make (get, save, reset)', () => {
        const defAi = AdminStore.getAiConfig();
        assert.equal(defAi.fetchTimeoutMs, 8000);

        const savedAi = AdminStore.saveAiConfig({
            generateWebhookUrl: 'https://hook.eu1.make.com/gen-test',
            validateWebhookUrl: 'https://hook.eu1.make.com/val-test',
            fetchTimeoutMs: 5000,
            fallbackToOffline: true,
        });
        assert.equal(savedAi.ok, true);

        const updatedAi = AdminStore.getAiConfig();
        assert.equal(updatedAi.generateWebhookUrl, 'https://hook.eu1.make.com/gen-test');
        assert.equal(updatedAi.validateWebhookUrl, 'https://hook.eu1.make.com/val-test');
        assert.equal(updatedAi.fetchTimeoutMs, 5000);

        AdminStore.resetAiConfig();
        const restoredAi = AdminStore.getAiConfig();
        assert.equal(restoredAi.generateWebhookUrl, '');
        assert.equal(restoredAi.fetchTimeoutMs, 8000);
    });

    await t.test('Gestion des cycles et niveaux autorisés par matière', () => {
        const subRes = AdminStore.createCustomSubject('Sciences Numériques', '💻', null, {
            band: 'lycee',
            allowedNiveaux: ['2de', '1re', 'tle'],
            enabled: true,
            description: 'Option informatique lycée',
        });
        assert.equal(subRes.ok, true);
        const subId = subRes.id;

        // Modification des métadonnées
        const modRes = AdminStore.saveSubjectMeta(subId, {
            band: 'college',
            allowedNiveaux: ['4eme', '3eme'],
            enabled: false,
            description: 'Initiation collège',
        });
        assert.equal(modRes.ok, true);

        const list = AdminStore.listEditable([]);
        const found = list.find(s => s.id === subId);
        assert.ok(found);
        assert.equal(found.band, 'college');
        assert.deepEqual(found.allowedNiveaux, ['4eme', '3eme']);
        assert.equal(found.enabled, false);
        assert.equal(found.description, 'Initiation collège');
    });

    await t.test('Questions par niveau d\'étude et générateur de variantes', () => {
        const questions6e = AdminStore.getSubjectQuestionsForGrade('maths', '6eme', 0, 4);
        assert.ok(Array.isArray(questions6e.generated));
        assert.ok(questions6e.generated.length > 0);

        const questionsTle = AdminStore.getSubjectQuestionsForGrade('maths', 'terminale', 1, 4);
        assert.ok(Array.isArray(questionsTle.generated));
        assert.ok(questionsTle.generated.length > 0);
    });
});
