const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Mock minimal de localStorage & window pour environnement Node
const store = new Map();
global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
};
global.window = global;

const DB = require(path.join(ROOT, 'js', 'db.js'));
const AdminStore = require(path.join(ROOT, 'js', 'admin-store.js'));
const QuestionBank = require(path.join(ROOT, 'js', 'question-bank.js'));
const AdaptiveEngine = require(path.join(ROOT, 'js', 'core', 'adaptive-engine.js'));

const ALL_26_SUBJECTS = [
    'maths', 'francais', 'histoire', 'geo', 'emc', 'anglais', 'espagnol',
    'svt', 'physique', 'chimie', 'techno', 'arts', 'philo', 'nsi', 'ses',
    'hggsp', 'si', 'msgn', 'droit_eco', 'mercatique', 'i2d', 'sin',
    'cybersecurite', 'reseaux', 'electronique', 'stss',
];

function resetStorage() {
    store.clear();
    if (typeof AdminStore.invalidateCache === 'function') AdminStore.invalidateCache();
}

test.describe('Filières (STMG, CIEL, STI2D, NSI, ST2S, Générale) & Programme officiel', () => {
    test('DB.getFiliere / DB.setFiliere persiste la filière et l\'isole par compte', async () => {
        resetStorage();
        assert.equal(DB.getFiliere(), 'generale');
        DB.setFiliere('ciel');
        assert.equal(DB.getFiliere(), 'ciel');

        const r1 = await DB.register('alice@test.fr', 'Alice', 'secret123');
        assert.equal(r1.ok, true);
        assert.equal(DB.getFiliere(), 'generale');
        DB.setFiliere('stmg');
        assert.equal(DB.getFiliere(), 'stmg');

        await DB.logout();
        assert.equal(DB.getFiliere(), 'ciel', 'Le compte invité garde sa propre filière');
    });

    test('Collège (6e → 3e) : programme officiel strict et Espagnol dès la 5ème', () => {
        resetStorage();
        const forbiddenAtCollege = [
            'nsi', 'ses', 'philo', 'hggsp', 'si', 'msgn', 'droit_eco',
            'mercatique', 'i2d', 'sin', 'cybersecurite', 'reseaux', 'electronique', 'stss',
        ];
        for (const niv of ['6eme', '5eme', '4eme', '3eme']) {
            assert.equal(AdminStore.isFiliereApplicable(niv), false);
            assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'techno' }, niv, 'ciel'), true);
            assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'arts' }, niv, 'generale'), true);
            for (const subId of forbiddenAtCollege) {
                assert.equal(
                    AdminStore.isSubjectAllowedForNiveau({ id: subId }, niv, 'ciel'),
                    false,
                    `${subId} doit être interdit en ${niv} même si filière=ciel`
                );
            }
        }
        // Espagnol LV2 commence en 5ème (programme officiel)
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'espagnol' }, '6eme'), false);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'espagnol' }, '5eme'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'espagnol' }, '3eme'), true);
    });

    test('Lycée & BTS : matières dédiées par filière (STMG, STI2D, CIEL, NSI, ST2S, Générale)', () => {
        resetStorage();
        assert.equal(AdminStore.isFiliereApplicable('2nde'), true);
        assert.equal(AdminStore.isFiliereApplicable('1ere'), true);
        assert.equal(AdminStore.isFiliereApplicable('terminale'), true);
        assert.equal(AdminStore.isFiliereApplicable('bts1'), true);
        assert.equal(AdminStore.isFiliereApplicable('bts2'), true);

        // STMG en Terminale
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'msgn' }, 'terminale', 'stmg'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'droit_eco' }, 'terminale', 'stmg'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'mercatique' }, 'terminale', 'stmg'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'philo' }, 'terminale', 'stmg'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'cybersecurite' }, 'terminale', 'stmg'), false);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'i2d' }, 'terminale', 'stmg'), false);

        // STI2D en 1ère
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'i2d' }, '1ere', 'sti2d'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'sin' }, '1ere', 'sti2d'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'electronique' }, '1ere', 'sti2d'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'si' }, '1ere', 'sti2d'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'msgn' }, '1ere', 'sti2d'), false);

        // CIEL en BTS 1ère année
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'cybersecurite' }, 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'reseaux' }, 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'electronique' }, 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'nsi' }, 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'droit_eco' }, 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'techno' }, 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'philo' }, 'bts1', 'ciel'), false);

        // NSI Spécialité en Terminale
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'nsi' }, 'terminale', 'nsi_spe'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'cybersecurite' }, 'terminale', 'nsi_spe'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'reseaux' }, 'terminale', 'nsi_spe'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'stss' }, 'terminale', 'nsi_spe'), false);

        // ST2S en 1ère
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'stss' }, '1ere', 'st2s'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'svt' }, '1ere', 'st2s'), true);
        assert.equal(AdminStore.isSubjectAllowedForNiveau({ id: 'sin' }, '1ere', 'st2s'), false);

        // Spécialités phares identifiées
        assert.equal(AdminStore.isSubjectSpecialtyForFiliere({ id: 'cybersecurite' }, 'ciel'), true);
        assert.equal(AdminStore.isSubjectSpecialtyForFiliere({ id: 'msgn' }, 'stmg'), true);
        assert.equal(AdminStore.isSubjectSpecialtyForFiliere({ id: 'maths' }, 'ciel'), false);
    });
});

test.describe('QuestionBank — Intégrité complète des 26 matières (Collège, Lycée & BTS)', () => {
    test('Chaque matière génère 25 niveaux valides sans doublon d\'options ni index invalide', () => {
        const sampleLevelBySubject = {
            techno: '4eme',
            philo: 'terminale',
            hggsp: '1ere',
            mercatique: 'terminale',
            msgn: '1ere',
            droit_eco: 'terminale',
            i2d: '1ere',
            sin: 'terminale',
            cybersecurite: 'bts1',
            reseaux: 'bts2',
            electronique: 'bts1',
            stss: '1ere',
            nsi: 'terminale',
            ses: '1ere',
            si: 'terminale',
            espagnol: '4eme',
            arts: '5eme',
        };

        for (const subjectId of ALL_26_SUBJECTS) {
            const niv = sampleLevelBySubject[subjectId] || '3eme';
            for (let lvl = 0; lvl < 25; lvl++) {
                const lesson = QuestionBank.generateOne(subjectId, lvl, niv, 0);
                assert.ok(lesson && typeof lesson.q === 'string' && lesson.q.trim().length > 5,
                    `${subjectId}[${lvl}] (${niv}) doit avoir un énoncé valide`);
                assert.ok(typeof lesson.exp === 'string' && lesson.exp.trim().length > 3,
                    `${subjectId}[${lvl}] (${niv}) doit avoir une explication`);
                if (lesson.type === 'vrai_faux') {
                    assert.equal(typeof lesson.correct, 'boolean');
                } else {
                    assert.ok(Array.isArray(lesson.opts) && lesson.opts.length >= 2,
                        `${subjectId}[${lvl}] (${niv}) doit avoir des options`);
                    assert.ok(lesson.correct >= 0 && lesson.correct < lesson.opts.length,
                        `${subjectId}[${lvl}] (${niv}) index correct hors bornes`);
                    const uniq = new Set(lesson.opts.map(o => String(o).trim().toLowerCase()));
                    assert.equal(uniq.size, lesson.opts.length,
                        `${subjectId}[${lvl}] (${niv}) contient des options en double: ${JSON.stringify(lesson.opts)}`);
                }
            }
        }

        // Vérifie aussi les maths BTS1 & BTS2
        for (const btsNiv of ['bts1', 'bts2']) {
            for (let lvl = 0; lvl < 15; lvl++) {
                const lesson = QuestionBank.generateOne('maths', lvl, btsNiv, 0);
                assert.ok(lesson && lesson.q && lesson.opts && lesson.opts.length === 4);
                assert.ok(lesson.correct >= 0 && lesson.correct < 4);
            }
        }
    });
});

test.describe('Anti-répétition renforcée (AdaptiveEngine + QuestionBank)', () => {
    test('Aucune question répétée sur 16 niveaux consécutifs pour les matières autrefois répétitives et les nouvelles filières', () => {
        const cases = [
            ['anglais', '5eme'],
            ['geo', '4eme'],
            ['svt', '4eme'],
            ['chimie', '3eme'],
            ['emc', '6eme'],
            ['maths', '5eme'],
            ['maths', '4eme'],
            ['cybersecurite', 'bts1'],
            ['reseaux', 'bts2'],
            ['electronique', 'terminale'],
            ['msgn', '1ere'],
            ['droit_eco', 'terminale'],
            ['mercatique', 'terminale'],
            ['i2d', '1ere'],
            ['sin', 'terminale'],
            ['espagnol', '3eme'],
            ['hggsp', 'terminale'],
            ['si', '1ere'],
            ['stss', 'terminale'],
            ['arts', '6eme'],
        ];

        for (const [subjectId, niveau] of cases) {
            resetStorage();
            const seen = new Set();
            for (let lvl = 0; lvl < 16; lvl++) {
                const picked = AdaptiveEngine.pickLocalQuestion({
                    subjectId,
                    levelIndex: lvl,
                    niveau,
                    salt: 0,
                });
                assert.ok(picked && picked.lesson && picked.signature, `${subjectId}/${niveau} lvl ${lvl} invalide`);
                assert.equal(
                    seen.has(picked.signature),
                    false,
                    `Question répétée trop tôt pour ${subjectId} (${niveau}) au niveau ${lvl}: ${picked.lesson.q}`
                );
                seen.add(picked.signature);
                AdaptiveEngine.markSeen(subjectId, niveau, picked.signature);
            }
        }
    });
});

test.describe('Assets, PWA Service Worker & HTML — Cohérence v1.28.1', () => {
    test('Toutes les 26 îles (dont les 13 nouvelles SVG) et tous les avatars existent, sont non vides, valides XML et pré-cachés', () => {
        const swContent = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
        const allIslands = [
            'maths.webp', 'francais.webp', 'histoire.webp', 'geo.svg', 'svt.webp',
            'anglais.webp', 'physique.webp', 'chimie.svg', 'technologie.webp',
            'philo.svg', 'emc.svg', 'nsi.svg', 'ses.svg',
            'espagnol.svg', 'arts.svg', 'hggsp.svg', 'si.svg',
            'msgn.svg', 'droit_eco.svg', 'mercatique.svg',
            'i2d.svg', 'sin.svg', 'cybersecurite.svg',
            'reseaux.svg', 'electronique.svg', 'stss.svg',
        ];
        for (const file of allIslands) {
            const fullPath = path.join(ROOT, 'Image', 'ile', file);
            assert.equal(fs.existsSync(fullPath), true, `Fichier manquant : Image/ile/${file}`);
            const stat = fs.statSync(fullPath);
            assert.ok(stat.size >= 500, `Fichier icône vide ou corrompu : Image/ile/${file} (${stat.size} octets)`);
            assert.equal(swContent.includes(`Image/ile/${file}`), true, `Non pré-caché dans service-worker.js : ${file}`);
            if (file.endsWith('.svg')) {
                const raw = fs.readFileSync(fullPath, 'utf8');
                const noComments = raw.replace(/<!--[\s\S]*?-->/g, '');
                const openSvgCount = (noComments.match(/<svg\b/g) || []).length;
                const closeSvgCount = (noComments.match(/<\/svg>/g) || []).length;
                assert.equal(openSvgCount, 1, `Nombre de balises <svg> invalide (${openSvgCount}) dans ${file}`);
                assert.equal(closeSvgCount, 1, `Nombre de balises </svg> invalide (${closeSvgCount}) dans ${file}`);
                assert.ok(noComments.includes('http://www.w3.org/2000/svg'), `xmlns SVG manquant : ${file}`);
                const badAmp = noComments.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
                assert.equal(badAmp, null, `Esperluette XML non échappée dans ${file}`);
            }
        }

        // Vérifie aussi tous les avatars dans Image/personnages/
        const charsDir = path.join(ROOT, 'Image', 'personnages');
        for (const file of fs.readdirSync(charsDir)) {
            const fullPath = path.join(charsDir, file);
            const stat = fs.statSync(fullPath);
            assert.ok(stat.size >= 500, `Avatar vide ou corrompu : Image/personnages/${file} (${stat.size} octets)`);
            if (file.endsWith('.svg')) {
                const raw = fs.readFileSync(fullPath, 'utf8');
                const noComments = raw.replace(/<!--[\s\S]*?-->/g, '');
                const openSvgCount = (noComments.match(/<svg\b/g) || []).length;
                const closeSvgCount = (noComments.match(/<\/svg>/g) || []).length;
                assert.equal(openSvgCount, 1, `Nombre de balises <svg> invalide (${openSvgCount}) dans avatar ${file}`);
                assert.equal(closeSvgCount, 1, `Nombre de balises </svg> invalide (${closeSvgCount}) dans avatar ${file}`);
                assert.ok(noComments.includes('http://www.w3.org/2000/svg'), `xmlns SVG manquant dans avatar : ${file}`);
                const badAmp = noComments.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g);
                assert.equal(badAmp, null, `Esperluette XML non échappée dans avatar ${file}`);
            }
        }
    });

    test('index.html contient le sélecteur de filière, BTS et les boutons de fermeture rapide ✕', () => {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        assert.ok(html.includes('id="optionsFiliereSelect"'));
        assert.ok(html.includes('id="closeOptionsX"'));
        assert.ok(html.includes('id="closeLoginX"'));
        assert.ok(html.includes('value="bts1"'));
        assert.ok(html.includes('value="bts2"'));
    });
});

test.describe('Succès triés/filtrés par filière & Pilotage intégral Admin (v1.29.0)', () => {
    test('Un élève CIEL voit les succès CIEL & universels mais pas les succès STSS, STMG, STI2D-only ni Collège', () => {
        resetStorage();
        const badges = AdminStore.getBadges();
        assert.ok(badges.length >= 46, `Catalogue enrichi attendu (>=46), reçu ${badges.length}`);

        const byId = id => badges.find(b => b.id === id);

        // En BTS 1 CIEL :
        assert.equal(AdminStore.isBadgeRelevantFor(byId('premier_quiz'), 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('ciel_fan'), 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('cyber_gardien'), 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('architecte_reseau'), 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('maitre_electronique'), 'bts1', 'ciel'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('juriste_junior'), 'bts1', 'ciel'), true);

        // Ne doit PAS voir les succès STSS/ST2S, STMG-only, STI2D-only, Générale-only, ni Collège
        assert.equal(AdminStore.isBadgeRelevantFor(byId('st2s_fan'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('acteur_sante'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('stmg_fan'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('as_mercatique'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('eco_concepteur'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('geopoliticien'), 'bts1', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('technophile'), 'bts1', 'ciel'), false);

        // Inversement en Terminale ST2S : voit ST2S mais pas CIEL ni STMG
        assert.equal(AdminStore.isBadgeRelevantFor(byId('st2s_fan'), 'terminale', 'st2s'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('acteur_sante'), 'terminale', 'st2s'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('cyber_gardien'), 'terminale', 'st2s'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('stmg_fan'), 'terminale', 'st2s'), false);

        // Au Collège (4ème) : voit Technologie & universels, mais aucun succès Lycée/BTS
        assert.equal(AdminStore.isBadgeRelevantFor(byId('technophile'), '4eme', 'generale'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('premier_quiz'), '4eme', 'generale'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('cyber_gardien'), '4eme', 'ciel'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('st2s_fan'), '4eme', 'st2s'), false);
        assert.equal(AdminStore.isBadgeRelevantFor(byId('philo_fan'), '4eme', 'generale'), false);
    });

    test('Pilotage admin : Filières, Matières (allowedFilieres/specialty), Succès ciblés, Quêtes, Feature Flags & Export/Import', () => {
        resetStorage();

        // 1. Gestion complète des filières (ajout + désactivation)
        const baseFil = AdminStore.getFilieres();
        assert.equal(baseFil.length, 6);
        const editedFil = baseFil.map(f => f.id === 'st2s' ? { ...f, enabled: false } : f);
        editedFil.push({ id: 'sio', label: 'BTS SIO', shortLabel: 'SIO', icon: '🖥️', enabled: true, desc: 'Services Informatiques aux Organisations' });
        const filRes = AdminStore.saveFilieres(editedFil);
        assert.equal(filRes.ok, true);
        assert.equal(AdminStore.getFilieres().length, 7);
        assert.equal(AdminStore.getActiveFilieres().some(f => f.id === 'st2s'), false);
        assert.equal(AdminStore.getActiveFilieres().some(f => f.id === 'sio'), true);

        // 2. Pilotage filières & spécialités d'une matière
        const metaRes = AdminStore.saveSubjectMeta('reseaux', {
            allowedFilieres: ['ciel', 'nsi_spe', 'sio'],
            specialtyFilieres: ['ciel', 'sio'],
        });
        assert.equal(metaRes.ok, true);
        const applied = AdminStore.applyOverrides([{ id: 'reseaux', name: 'Réseaux & Systèmes' }]);
        assert.equal(AdminStore.isSubjectAllowedForNiveau(applied[0], 'bts1', 'sio'), true);
        assert.equal(AdminStore.isSubjectSpecialtyForFiliere(applied[0], 'sio'), true);

        // 3. Création d'un succès ciblé sur la nouvelle filière SIO
        const bRes = AdminStore.saveBadge({
            id: 'sio_expert',
            name: 'Expert SIO',
            icon: '🖥️',
            category: 'matieres',
            band: 'lycee',
            allowedFilieres: ['sio'],
            desc: 'Maîtrise le parcours BTS SIO.',
            condition: 'reseauxLevel >= 5',
        });
        assert.equal(bRes.ok, true);
        assert.equal(AdminStore.isBadgeRelevantFor(bRes.badge, 'bts1', 'sio'), true);
        assert.equal(AdminStore.isBadgeRelevantFor(bRes.badge, 'bts1', 'stmg'), false);

        // 4. Pilotage du pool de quêtes quotidiennes
        assert.ok(AdminStore.getQuestPool().length >= 9);
        const qRes = AdminStore.saveQuestPool([
            { type: 'xp', icon: '⚡', title: 'Défi Admin 50 XP', target: 50, xp: 40, coins: 25, color: '#ffb547', enabled: true },
        ]);
        assert.equal(qRes.ok, true);
        assert.equal(AdminStore.getQuestPool().length, 1);

        // 5. Pilotage des feature flags globaux dans siteConfig
        const scRes = AdminStore.saveSiteConfig({
            defaultNiveau: 'bts1',
            defaultFiliere: 'ciel',
            enableShop: false,
            enableQuests: false,
            enableConfetti: false,
            maintenanceMode: true,
            maintenanceMessage: 'Mode évaluation blanc',
        });
        assert.equal(scRes.ok, true);
        const cfg = AdminStore.getSiteConfig();
        assert.equal(cfg.defaultNiveau, 'bts1');
        assert.equal(cfg.defaultFiliere, 'ciel');
        assert.equal(cfg.enableShop, false);
        assert.equal(cfg.enableQuests, false);
        assert.equal(cfg.enableConfetti, false);
        assert.equal(cfg.maintenanceMode, true);

        // 6. Export / Import intégral préserve filières, quêtes, succès et siteConfig
        const exported = AdminStore.exportJson();
        AdminStore.resetAll();
        assert.equal(AdminStore.getFilieres().length, 6);
        const imp = AdminStore.importJson(exported);
        assert.equal(imp.ok, true);
        assert.equal(AdminStore.getFilieres().length, 7);
        assert.equal(AdminStore.getQuestPool().length, 1);
        assert.ok(AdminStore.getBadge('sio_expert'));
        assert.equal(AdminStore.getSiteConfig().defaultFiliere, 'ciel');

        // 7. Boutique enrichie (47 articles par défaut)
        AdminStore.resetAll();
        assert.ok(AdminStore.getShopItems().length >= 47);
    });

    test('Pilotage admin des comptes locaux : classe, filière, XP, pièces et réinitialisation', async () => {
        resetStorage();
        const created = await DB.createLocalMember('eleve.ciel@ecole.fr', 'Lucas', 'secret123', 'eleve');
        assert.equal(created.ok, true);

        const upd = DB.updateLocalMemberData('eleve.ciel@ecole.fr', {
            niveau: 'bts1',
            filiere: 'ciel',
            xp: 250,
            coins: 180,
        });
        assert.equal(upd.ok, true);
        assert.equal(upd.stats.niveau, 'bts1');
        assert.equal(upd.stats.filiere, 'ciel');
        assert.equal(upd.stats.xp, 250);
        assert.equal(upd.stats.coins, 180);

        const list = await DB.listLocalMembers();
        assert.equal(list.ok, true);
        const lucas = list.data.find(m => m.email === 'eleve.ciel@ecole.fr');
        assert.equal(lucas.niveau, 'bts1');
        assert.equal(lucas.filiere, 'ciel');
        assert.equal(lucas.xp, 250);

        const rst = DB.updateLocalMemberData('eleve.ciel@ecole.fr', { resetProgress: true });
        assert.equal(rst.ok, true);
        assert.equal(rst.stats.xp, 0);
        assert.equal(rst.stats.coins, 30);
    });
});
