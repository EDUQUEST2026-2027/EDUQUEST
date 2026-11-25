/**
 * TESTS UNITAIRES — CRÉDITS DES CRÉATEURS (credits.test.js)
 * Vérifie l'intégrité de la liste des 7 créateurs, la persistance dans AdminStore,
 * la validation de sécurité des URLs/avatars et la présence des assets sur disque.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const AdminStore = require('../js/admin-store.js');

describe('Crédits des Créateurs & Gestion des photos d\'équipe', () => {
    beforeEach(() => {
        setupTestEnv();
        AdminStore.resetCredits();
    });

    it('Fournit par défaut les 7 créateurs d\'EDUQUEST avec leurs rôles, bios et photo de Clément Amisse', () => {
        const credits = AdminStore.getCredits();
        assert.ok(credits, 'L\'objet credits existe');
        assert.ok(Array.isArray(credits.team), 'credits.team est un tableau');
        assert.strictEqual(credits.team.length, 7, 'Il y a bien 7 créateurs par défaut');

        const names = credits.team.map(m => m.name);
        assert.ok(names.includes('Clément Amisse'), 'Clément Amisse présent');
        assert.ok(names.includes('Raphaël Grados'), 'Raphaël Grados présent');
        assert.ok(names.includes('Sacha Siegel'), 'Sacha Siegel présent');
        assert.ok(names.includes('François Lucas'), 'François Lucas présent');
        assert.ok(names.includes('Lucas Delferriere'), 'Lucas Delferriere présent');
        assert.ok(names.includes('Théo Piou'), 'Théo Piou présent');
        assert.ok(names.includes('Aimane Toure'), 'Aimane Toure présent');

        const clement = credits.team.find(m => m.id === 'clement-amisse');
        assert.strictEqual(clement.avatar, 'Image/team/clement-amisse.jpg');
        const imgPath = path.resolve(__dirname, '..', clement.avatar);
        assert.ok(fs.existsSync(imgPath), 'Image/team/clement-amisse.jpg doit exister sur disque');
    });

    it('Permet d\'ajouter et modifier une image/avatar pour chaque membre dans AdminStore', () => {
        const initial = AdminStore.getCredits();
        const updatedTeam = initial.team.map((m, idx) => ({
            ...m,
            avatar: `Image/personnages/createur-${idx + 1}.png`,
            bio: `Bio personnalisée pour ${m.name}`,
            github: `https://github.com/eduquest-${idx + 1}`,
        }));

        const res = AdminStore.saveCredits({
            ...initial,
            team: updatedTeam,
        });

        assert.strictEqual(res.ok, true, 'La sauvegarde doit réussir');

        const fresh = AdminStore.getCredits();
        assert.strictEqual(fresh.team[0].avatar, 'Image/personnages/createur-1.png');
        assert.strictEqual(fresh.team[0].bio, 'Bio personnalisée pour Clément Amisse');
        assert.strictEqual(fresh.team[0].github, 'https://github.com/eduquest-1');
        assert.strictEqual(fresh.team[6].avatar, 'Image/personnages/createur-7.png');
    });

    it('Filtre les URLs dangereuses (javascript:, data:text/html) sur les avatars et liens créateurs', () => {
        const res = AdminStore.saveCredits({
            team: [{
                id: 'sec-test',
                name: 'Test Sécurité',
                role: 'Dev',
                avatar: 'javascript:alert(1)',
                github: 'javascript:alert(2)',
                links: 'data:text/html,<script>alert(3)</script>',
            }],
        });
        assert.strictEqual(res.ok, true);
        const saved = AdminStore.getCredits().team[0];
        assert.strictEqual(saved.avatar, '');
        assert.strictEqual(saved.github, '');
        assert.strictEqual(saved.links, '');
    });

    it('Restaure la liste et configuration des 7 créateurs après resetCredits()', () => {
        AdminStore.saveCredits({
            studioName: 'Studio Modifié',
            team: [{ id: 'test', name: 'Testeur Unique', role: 'Dev', avatar: '', bio: '' }],
        });

        let current = AdminStore.getCredits();
        assert.strictEqual(current.team.length, 1);

        AdminStore.resetCredits();
        current = AdminStore.getCredits();
        assert.strictEqual(current.team.length, 7, 'Les 7 créateurs sont rétablis');
        assert.strictEqual(current.studioName, 'EDUQUEST');
    });
});
