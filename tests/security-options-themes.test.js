/**
 * TESTS UNITAIRES — SÉCURITÉ ADMIN, OPTIONS SUR PLACE & THÈMES BOUTIQUE→OPTIONS
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const DB = require('../js/db.js');
const AdminStore = require('../js/admin-store.js');

const ROOT = path.resolve(__dirname, '..');

describe('Sécurité du panneau d\'administration (PBKDF2, Anti-usurpation, Verrouillage, PIN)', () => {
    beforeEach(() => {
        setupTestEnv();
        DB.lockAdminPanelSession();
        DB.clearAdminLoginFailures();
        DB.clearAdminAuditLog();
        DB.disableAdminPin();
    });

    it('Valide la robustesse des mots de passe administrateur', () => {
        assert.equal(DB.validateAdminPassword('123456').ok, false);
        assert.equal(DB.validateAdminPassword('abcdefgh').ok, false);
        assert.equal(DB.validateAdminPassword('12345678').ok, false);
        assert.equal(DB.validateAdminPassword('Admin123').ok, false);
        assert.equal(DB.validateAdminPassword('ProfQuest2026!').ok, true);
    });

    it('Stocke les mots de passe en PBKDF2-SHA256 salé et migre les anciens hash au login', async () => {
        const reg = await DB.createLocalMember('admin@lycee.fr', 'ProfAdmin', 'SuperAdmin2026!', 'admin');
        assert.equal(reg.ok, true);

        const rawUsers = JSON.parse(localStorage.getItem('eduquest_local_users'));
        assert.ok(rawUsers[0].password.startsWith('pbkdf2_'), `Hash PBKDF2 attendu, reçu: ${rawUsers[0].password}`);
        assert.notEqual(rawUsers[0].password, 'SuperAdmin2026!');

        const login = await DB.login('admin@lycee.fr', 'SuperAdmin2026!');
        assert.equal(login.ok, true);
        assert.equal(login.role, 'admin');

        // Migration transparente depuis un ancien hash 32-bit lh_
        const legacyHash = (() => {
            let h = 0;
            const s = 'LegacyPass99';
            for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
            return 'lh_' + Math.abs(h).toString(16);
        })();
        rawUsers.push({ email: 'old@lycee.fr', username: 'Ancien', password: legacyHash, role: 'eleve' });
        localStorage.setItem('eduquest_local_users', JSON.stringify(rawUsers));

        const legLogin = await DB.login('old@lycee.fr', 'LegacyPass99');
        assert.equal(legLogin.ok, true);
        const migrated = JSON.parse(localStorage.getItem('eduquest_local_users')).find(u => u.email === 'old@lycee.fr');
        assert.ok(migrated.password.startsWith('pbkdf2_'), 'Ancien hash doit être migré automatiquement vers PBKDF2');
    });

    it('Rejette toute tentative d\'usurpation de session admin via localStorage', async () => {
        await DB.createLocalMember('prof@ecole.fr', 'Prof', 'SecurePass2026', 'admin');
        await DB.register('eleve@ecole.fr', 'Eleve', 'eleve123');

        // Un élève tente de falsifier eduquest_session avec role:"admin"
        localStorage.setItem('eduquest_session', JSON.stringify({
            token: 'fake_token',
            username: 'Hacker',
            email: 'prof@ecole.fr',
            role: 'admin',
            adminProof: 'forged_proof',
        }));
        assert.equal(DB.verifyAdminSession().ok, false, 'Une preuve admin falsifiée doit être rejetée');

        // Connexion légitime de l'admin
        const login = await DB.login('prof@ecole.fr', 'SecurePass2026');
        assert.equal(login.ok, true);
        assert.equal(DB.verifyAdminSession().ok, true);

        // Sans déverrouillage sessionStorage, checkAdminPanelSession() reste verrouillé
        assert.equal(DB.checkAdminPanelSession().ok, false);
        assert.equal(DB.openAdminPanelSession().ok, true);
        assert.equal(DB.checkAdminPanelSession().ok, true);

        // Verrouillage manuel coupe l'accès panneau
        DB.lockAdminPanelSession();
        assert.equal(DB.checkAdminPanelSession().ok, false);
    });

    it('Applique un blocage anti-force brute progressif après 5 échecs', () => {
        for (let i = 1; i < 5; i++) {
            const st = DB.recordAdminLoginFailure('admin@ecole.fr');
            assert.equal(st.locked, false);
            assert.equal(st.attempts, i);
        }
        const lockedSt = DB.recordAdminLoginFailure('admin@ecole.fr');
        assert.equal(lockedSt.locked, true);
        assert.ok(lockedSt.remainingMs > 50000 && lockedSt.remainingMs <= 60000);
        assert.equal(lockedSt.strikes, 1);

        DB.clearAdminLoginFailures();
        assert.equal(DB.getAdminLockoutStatus().locked, false);
    });

    it('Gère le code PIN secondaire hashé et préserve la sécurité lors de clearLocalGameData()', async () => {
        assert.equal(DB.getAdminSecurityConfig().pinEnabled, false);
        assert.equal((await DB.setAdminPin('12')).ok, false, 'PIN trop court refusé');
        assert.equal((await DB.setAdminPin('4829')).ok, true);

        const cfg = DB.getAdminSecurityConfig();
        assert.equal(cfg.pinEnabled, true);
        assert.equal('pinHash' in cfg, false, 'Le hash du PIN ne doit jamais être exposé dans getAdminSecurityConfig()');

        assert.equal((await DB.verifyAdminPin('0000')).ok, false);
        assert.equal((await DB.verifyAdminPin('4829')).ok, true);

        // clearLocalGameData() ne doit pas effacer le PIN ni le journal d'audit
        AdminStore.clearLocalGameData();
        assert.equal(DB.getAdminSecurityConfig().pinEnabled, true);
        assert.ok(DB.getAdminAuditLog().length > 0);
    });
});

describe('Options sur place (zéro redirection accueil) & Thèmes Boutique → Options', () => {
    it('Aucun lien de navigation ne renvoie plus vers index.html#options dans les pages de jeu', () => {
        const dashHtml = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
        const mapHtml = fs.readFileSync(path.join(ROOT, 'map.html'), 'utf8');
        const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

        assert.equal(dashHtml.includes('index.html#options'), false, 'dashboard.html ne doit plus renvoyer vers index.html#options');
        assert.equal(mapHtml.includes('index.html#options'), false, 'map.html ne doit plus renvoyer vers index.html#options');
        assert.equal(appJs.includes('href="index.html#options"'), false, 'La barre mobile de app.js ne doit plus renvoyer vers index.html#options');
        assert.ok(dashHtml.includes('_openOptionsModal'), 'dashboard.html doit ouvrir les Options sur place');
        assert.ok(mapHtml.includes('_openOptionsModal'), 'map.html doit ouvrir les Options sur place');
        assert.ok(appJs.includes('function ensureOptionsModal()'), 'app.js doit monter #modalOptions dynamiquement sur dashboard et map');
    });

    it('Les thèmes de la boutique sont verrouillés par défaut sauf Astral et se débloquent à l\'achat', () => {
        const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
        const swJs = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');

        assert.ok(indexHtml.includes('id="optionsThemeGrid"'), 'index.html doit contenir la grille des thèmes débloqués');
        assert.equal(indexHtml.includes('id="uiColorPresets"'), false, 'Les anciens préréglages gratuits qui doublonnaient la boutique doivent être retirés');
        assert.ok(appJs.includes('renderOptionsThemes'), 'app.js doit rendre les thèmes débloqués/verrouillés dans Options');
        assert.ok(appJs.includes('window._dashOpenThemeShop'), 'app.js doit exposer le raccourci vers Boutique → Thèmes');

        const themes = AdminStore.getShopItems().filter(i => i.category === 'theme');
        assert.ok(themes.length >= 16, `Au moins 16 thèmes attendus, trouvé ${themes.length}`);
        const astral = themes.find(t => t.id === 'default');
        const cyber = themes.find(t => t.id === 'theme-cyber');
        assert.equal(astral.cost, 0);
        assert.ok(cyber.cost > 0);

        // Vérifie que credits.html et la photo de Clément Amisse sont bien précachés
        assert.ok(swJs.includes("'credits.html'"), 'credits.html doit être précaché dans service-worker.js');
        assert.ok(swJs.includes("'Image/team/clement-amisse.jpg'"), 'Image/team/clement-amisse.jpg doit être précaché dans service-worker.js');
    });
});
