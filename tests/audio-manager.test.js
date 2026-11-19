const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../js/db.js');
const AudioManager = require('../js/core/audio-manager.js');

test('AudioManager - Contrôle global & anti-réactivation aléatoire', async (t) => {
    t.beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        AudioManager._resetForTest();
    });

    await t.test('Autorise la lecture par défaut lorsque sonsActifs et musiqueActive sont actifs', () => {
        DB.saveOption('sonsActifs', 'true');
        DB.saveOption('musiqueActive', 'true');
        assert.equal(AudioManager.canPlayMusic(), true);
    });

    await t.test('Coupe strictement la musique quand sonsActifs ou musiqueActive est false', () => {
        DB.saveOption('sonsActifs', 'false');
        DB.saveOption('musiqueActive', 'true');
        assert.equal(AudioManager.canPlayMusic(), false, 'sonsActifs=false doit couper la musique');

        DB.saveOption('sonsActifs', 'true');
        DB.saveOption('musiqueActive', 'false');
        assert.equal(AudioManager.canPlayMusic(), false, 'musiqueActive=false doit couper la musique');
    });

    await t.test('La coupure manuelle (mute) persiste et empêche toute réactivation parasite', () => {
        DB.saveOption('sonsActifs', 'true');
        DB.saveOption('musiqueActive', 'true');
        assert.equal(AudioManager.canPlayMusic(), true);

        AudioManager.setManualMute(true);
        assert.equal(AudioManager.isManualMuted(), true);
        assert.equal(AudioManager.canPlayMusic(), false, 'Le mute manuel doit interdire toute lecture');

        // Une synchro passive (non initiée par l\'utilisateur) ne doit JAMAIS réactiver la musique
        AudioManager.syncWithOptions(false);
        assert.equal(AudioManager.canPlayMusic(), false);

        // Réactivation explicite par l\'utilisateur
        AudioManager.setManualMute(false);
        assert.equal(AudioManager.isManualMuted(), false);
        assert.equal(AudioManager.canPlayMusic(), true);
    });

    await t.test('stopAll() coupe définitivement l\'audio pour le bouton Quitter', () => {
        DB.saveOption('sonsActifs', 'true');
        DB.saveOption('musiqueActive', 'true');
        AudioManager.stopAll();
        assert.equal(AudioManager.canPlayMusic(), false, 'Après stopAll(), la musique ne peut plus repartir');
    });

    await t.test('La playlist contient les 6 pistes attendues', () => {
        assert.equal(AudioManager.PLAYLIST.length, 6);
        assert.equal(AudioManager.PLAYLIST[0], 'Musique/music1.mp3');
        assert.equal(AudioManager.PLAYLIST[5], 'Musique/music6.mp3');
    });
});
