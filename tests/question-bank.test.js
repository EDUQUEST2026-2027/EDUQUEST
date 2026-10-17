const test = require('node:test');
const assert = require('node:assert/strict');
const QuestionBank = require('../js/question-bank.js');

test('QuestionBank - Déterminisme du PRNG et Bandes Scolaires', async (t) => {
    await t.test('Respect strict des bandes scolaires', () => {
        const collegeGrades = ['6eme', '5eme', '4eme', '3eme', '6ème', '5e'];
        const lyceeGrades = ['2nde', '1ere', 'terminale', 'seconde', 'premiere', 'term'];

        collegeGrades.forEach(g => {
            assert.equal(QuestionBank.bandForNiveau(g), 'college', `Devrait être collège pour ${g}`);
        });

        lyceeGrades.forEach(g => {
            assert.equal(QuestionBank.bandForNiveau(g), 'lycee', `Devrait être lycée pour ${g}`);
        });
    });

    await t.test('Déterminisme absolu de la génération procédurale', () => {
        // La même requête doit retourner exactement la même question avec les mêmes options
        const q1 = QuestionBank.generateOne('maths', 15, '4eme', 0);
        const q2 = QuestionBank.generateOne('maths', 15, '4eme', 0);

        assert.equal(q1.q, q2.q);
        assert.deepEqual(q1.opts, q2.opts);
        assert.equal(q1.correct, q2.correct);

        // Une variante différente doit générer une question différente
        const qVar = QuestionBank.generateOne('maths', 15, '4eme', 1);
        assert.notDeepEqual(q1, qVar);
    });

    await t.test('Génération de 100 niveaux sans crash pour diverses matières', () => {
        const subjects = ['maths', 'francais', 'histoire', 'anglais', 'svt'];
        const grades = ['6eme', '3eme', 'terminale'];

        for (const sub of subjects) {
            for (const gr of grades) {
                for (let i = 0; i < 20; i++) { // test échantillonné sur 20 niveaux par matière/classe
                    const lesson = QuestionBank.generateOne(sub, i, gr, 0);
                    assert.ok(lesson, `La leçon ${sub} niveau ${i} pour ${gr} doit être définie`);
                    assert.ok(typeof lesson.q === 'string' && lesson.q.length > 0, 'La question ne doit pas être vide');
                    
                    if (lesson.opts) {
                        assert.ok(Array.isArray(lesson.opts), 'opts doit être un tableau');
                        assert.ok(lesson.opts.length >= 2, 'Il doit y avoir au moins 2 choix');
                        assert.ok(lesson.correct >= 0 && lesson.correct < lesson.opts.length, 'correctIndex doit être valide');
                    }
                }
            }
        }
    });

    await t.test('Extension d\'une matière à 100 niveaux complets', () => {
        const dummySubject = {
            id: 'sciences',
            name: 'Sciences',
            lessons: [
                { q: 'Question fixe 1', opts: ['A', 'B'], correct: 0 },
                { q: 'Question fixe 2', opts: ['X', 'Y'], correct: 1 }
            ]
        };

        const extended = QuestionBank.extend(dummySubject, 100, '5eme');
        assert.equal(extended.lessons.length, 100);
        assert.ok(extended.lessons[0].variants.length >= 3);
        assert.ok(extended.lessons[99].variants.length >= 3);
    });
});
