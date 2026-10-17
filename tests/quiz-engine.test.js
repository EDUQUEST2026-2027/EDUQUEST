const test = require('node:test');
const assert = require('node:assert/strict');
const QuizEngine = require('../js/quiz-engine.js');

test('QuizEngine - Normalisation & Algorithme Levenshtein', async (t) => {
    await t.test('Normalisation de chaîne', () => {
        assert.equal(QuizEngine.normalize('  ÉlÉpHaNt  '), 'elephant');
        assert.equal(QuizEngine.normalize('Lumière   Céleste'), 'lumiere celeste');
    });

    await t.test('Calcul de distance de Levenshtein', () => {
        assert.equal(QuizEngine.levenshtein('chat', 'chat'), 0);
        assert.equal(QuizEngine.levenshtein('chat', 'char'), 1);
        assert.equal(QuizEngine.levenshtein('pythagore', 'pitagore'), 2);
        assert.equal(QuizEngine.levenshtein('', 'abc'), 3);
        assert.equal(QuizEngine.levenshtein('abc', ''), 3);
    });

    await t.test('Tolérance Fuzzy Match selon la longueur', () => {
        // Moins de 4 lettres : tolérance 0
        assert.equal(QuizEngine.isFuzzyMatch('eau', 'eau'), true);
        assert.equal(QuizEngine.isFuzzyMatch('eau', 'eaux'), false);

        // 4 à 6 lettres : 1 faute tolérée
        assert.equal(QuizEngine.isFuzzyMatch('arbre', 'arbrs'), true);
        assert.equal(QuizEngine.isFuzzyMatch('paris', 'pariz'), true);
        assert.equal(QuizEngine.isFuzzyMatch('paris', 'poriz'), false); // 2 fautes

        // 7 lettres et plus : 2 fautes tolérées
        assert.equal(QuizEngine.isFuzzyMatch('triangle', 'tryangle'), true);
        assert.equal(QuizEngine.isFuzzyMatch('triangle', 'trianglo'), true);
        assert.equal(QuizEngine.isFuzzyMatch('triangle', 'tryanglo'), true); // 2 fautes
        assert.equal(QuizEngine.isFuzzyMatch('triangle', 'tryznglo'), false); // 3 fautes
    });

    await t.test('Échappement HTML (protection XSS)', () => {
        const raw = '<script>alert("xss")</script>&"\'';
        const escaped = QuizEngine.esc(raw);
        assert.ok(!escaped.includes('<script>'));
        assert.ok(escaped.includes('&lt;script&gt;'));
        assert.ok(escaped.includes('&quot;'));
        assert.ok(escaped.includes('&#39;'));
    });
});

test('QuizEngine - Notation des différents types de questions', async (t) => {
    await t.test('Type QCM', () => {
        const q = { type: 'qcm', q: 'Quelle est la capitale ?', opts: ['Lyon', 'Paris', 'Marseille'], correct: 1 };
        assert.equal(QuizEngine.grade(q, 1), true);
        assert.equal(QuizEngine.grade(q, 0), false);
        assert.equal(QuizEngine.grade(q, 2), false);
    });

    await t.test('Type Vrai / Faux', () => {
        const q = { type: 'vrai_faux', q: 'La Terre est ronde.', correct: true };
        assert.equal(QuizEngine.grade(q, true), true);
        assert.equal(QuizEngine.grade(q, false), false);
    });

    await t.test('Type Réponse Courte avec tolérance', () => {
        const q = {
            type: 'reponse_courte',
            q: 'Qui a peint la Joconde ?',
            accepted: ['Léonard de Vinci', 'Leonard de Vinci', 'De Vinci']
        };
        assert.equal(QuizEngine.grade(q, 'Léonard de Vinci'), true);
        assert.equal(QuizEngine.grade(q, 'leonard de vinci'), true); // casse et accent
        assert.equal(QuizEngine.grade(q, 'de vinci'), true);
        assert.equal(QuizEngine.grade(q, 'leonard de vincy'), true); // 1 faute
        assert.equal(QuizEngine.grade(q, 'Michel-Ange'), false);
    });

    await t.test('Type Texte à trous', () => {
        const q = {
            type: 'texte_a_trous',
            textWithBlanks: 'Le carré de ___ est égal à ___.',
            blanks: [['3', 'trois'], ['9', 'neuf']]
        };
        assert.equal(QuizEngine.grade(q, ['3', '9']), true);
        assert.equal(QuizEngine.grade(q, ['trois', 'neuf']), true);
        assert.equal(QuizEngine.grade(q, ['trois', '8']), false);
        assert.equal(QuizEngine.grade(q, ['4', '9']), false);
    });

    await t.test('Type Association (Drag & Drop)', () => {
        const q = {
            type: 'drag_and_drop',
            items: ['France', 'Italie', 'Espagne'],
            targets: ['Madrid', 'Paris', 'Rome'],
            pairs: { 'France': 'Paris', 'Italie': 'Rome', 'Espagne': 'Madrid' }
        };
        // indices cibles : Madrid = 0, Paris = 1, Rome = 2
        // France (item 0) -> Paris (target 1)
        // Italie (item 1) -> Rome (target 2)
        // Espagne (item 2) -> Madrid (target 0)
        assert.equal(QuizEngine.grade(q, { 0: 1, 1: 2, 2: 0 }), true);
        assert.equal(QuizEngine.grade(q, { 0: 0, 1: 2, 2: 1 }), false);
    });
});
