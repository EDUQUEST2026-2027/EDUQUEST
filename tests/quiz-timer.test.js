const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../js/db.js');
const AdminStore = require('../js/admin-store.js');
const QuizTimer = require('../js/core/quiz-timer.js');

test('QuizTimer - Chronomètre unifié sur tous les exercices et réessais', async (t) => {
    t.beforeEach(() => {
        localStorage.clear();
        AdminStore.resetAll();
    });

    await t.test('Lit la durée configurée depuis AdminStore.siteConfig.quizTimerSeconds', () => {
        assert.equal(QuizTimer.getConfiguredDuration(), 45);
        AdminStore.saveSiteConfig({ quizTimerSeconds: 60 });
        assert.equal(QuizTimer.getConfiguredDuration(), 60);
    });

    await t.test('Détecte correctement l\'état d\'activation du mode chrono via DB et AdminStore', () => {
        // Actif par défaut selon AdminStore.siteConfig.chronoEnabledByDefault (true)
        assert.equal(QuizTimer.isEnabled(), true);

        // Pilotage admin : désactiver par défaut pour les nouveaux joueurs
        AdminStore.saveSiteConfig({ chronoEnabledByDefault: false });
        assert.equal(QuizTimer.isEnabled(), false);

        // Préférence explicite du joueur
        DB.saveOption('modeChrono', 'true');
        assert.equal(QuizTimer.isEnabled(), true);
        DB.saveOption('modeChrono', 'false');
        assert.equal(QuizTimer.isEnabled(), false);

        // Désactivation globale en admin (enableChrono = false) prime sur le choix client
        DB.saveOption('modeChrono', 'true');
        AdminStore.saveSiteConfig({ enableChrono: false });
        assert.equal(QuizTimer.isEnabled(), false);
    });

    await t.test('Démarre, s\'arrête et redémarre proprement sur Exercice 1, Exercice 2, Exercice 3 et Réessai', async () => {
        let expires = 0;
        const timer = QuizTimer.create({
            containerId: 'test-chrono',
            onExpire: () => { expires++; },
        });

        // Exercice 1
        timer.start(30);
        assert.equal(timer.isRunning(), true);
        assert.ok(timer.getRemaining() >= 29 && timer.getRemaining() <= 30);
        timer.stop();
        assert.equal(timer.isRunning(), false);

        // Exercice 2
        timer.start(45);
        assert.equal(timer.isRunning(), true);
        assert.ok(timer.getRemaining() >= 44 && timer.getRemaining() <= 45);
        timer.stop();

        // Exercice 3 + Réessai immédiat sans fuite d'intervalle
        timer.start(20);
        assert.equal(timer.isRunning(), true);
        timer.start(15); // Redémarrage direct (retry)
        assert.equal(timer.isRunning(), true);
        assert.ok(timer.getRemaining() >= 14 && timer.getRemaining() <= 15);
        timer.stop();
        assert.equal(expires, 0, 'stop() doit empêcher tout déclenchement de onExpire');
    });

    await t.test('Déclenche onExpire exactement UNE fois à l\'expiration', async () => {
        let expireCount = 0;
        let ticks = 0;
        const timer = QuizTimer.create({
            containerId: 'test-chrono-expire',
            onTick: () => { ticks++; },
            onExpire: () => { expireCount++; },
        });

        // Démarre un chrono court de 0.35s pour tester l'expiration réelle
        timer.start(0.35);
        await new Promise(r => setTimeout(r, 650));
        assert.equal(expireCount, 1, 'onExpire doit se déclencher exactement 1 fois');
        assert.equal(timer.isRunning(), false);
        assert.equal(timer.getRemaining(), 0);
        assert.ok(ticks >= 1, 'onTick doit être appelé au moins une fois');
    });

    await t.test('renderBarHtml génère un composant lisible avec icône SVG et temps initial', () => {
        const html = QuizTimer.renderBarHtml('chrono-bar-container', 45);
        assert.ok(html.includes('id="chrono-bar-container"'));
        assert.ok(html.includes('<svg'));
        assert.ok(html.includes('45s'));
        assert.ok(html.includes('quiz-chrono-track'));
    });
});
