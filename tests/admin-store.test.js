const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const AdminStore = require('../js/admin-store.js');

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
});
