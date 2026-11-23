const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper');

setupTestEnv();

const EduIcons = require('../js/core/icons');
const DB = require('../js/db');
const QuestionBank = require('../js/question-bank');
const AdminStore = require('../js/admin-store');
const AiProvider = require('../js/ai-provider');

describe('SVG & Production Audit Regressions (v1.30.0)', () => {
    beforeEach(() => {
        setupTestEnv();
        globalThis.EduIcons = EduIcons;
        globalThis.DB = DB;
        globalThis.QuestionBank = QuestionBank;
        globalThis.AdminStore = AdminStore;
    });

    it('EduIcons — renders cohesive Astral & Or duotone SVGs, maps emojis, and escapes attributes safely', () => {
        const names = EduIcons.names();
        assert.ok(names.length >= 65, `Expected >= 65 icons, got ${names.length}`);

        for (const name of names) {
            const markup = EduIcons.svg(name, { size: 20, tone: 'gold' });
            assert.ok(markup.startsWith('<svg '), `Icon ${name} must start with <svg`);
            assert.ok(markup.endsWith('</svg>'), `Icon ${name} must end with </svg>`);
            assert.ok(markup.includes('eq-icon--gold'), `Icon ${name} must apply tone class`);
        }

        // Unknown icon falls back to sparkle safely and escapes title
        const safeMarkup = EduIcons.svg('non_existent_icon', { title: '<script>alert(1)</script>' });
        assert.ok(safeMarkup.includes('<svg'));
        assert.ok(!safeMarkup.includes('<script>'));
        assert.ok(safeMarkup.includes('&lt;script&gt;'));

        // Emoji mapping & stripping
        assert.ok(EduIcons.fromEmoji('🏆').includes('<svg'));
        assert.ok(EduIcons.fromEmoji('🔥').includes('<svg'));
        assert.strictEqual(EduIcons.stripLeadingEmoji('🏆 Champion Astral'), 'Champion Astral');
        assert.strictEqual(EduIcons.iconFromLabel('🏆 Champion Astral'), 'trophy');

        // Stars row
        const starsHtml = EduIcons.stars(2, 3);
        assert.ok(starsHtml.includes('eq-stars-row'));
        assert.strictEqual((starsHtml.match(/<svg /g) || []).length, 3);
    });

    it('QuestionBank — procIdx reaches both even and odd branches across procedural generators without float or grammar bugs', () => {
        const subjects = ['maths', 'francais', 'histoire', 'geo', 'svt', 'anglais', 'physique', 'chimie', 'techno', 'technologie', 'philo', 'emc', 'nsi', 'ses'];
        const grades = ['6eme', '4eme', '2nde', 'terminale'];
        const badGrammar = /(?<![\p{L}\p{N}_])(au imparfait|de le |de les |je ai|chevauxs)(?![\p{L}\p{N}_])/iu;
        const floatBug = /\d+\.\d{5,}/;

        for (const sub of subjects) {
            for (const grade of grades) {
                for (let idx = 0; idx < 24; idx++) {
                    const q = QuestionBank.generateOne(sub, idx, grade, 0);
                    assert.ok(q && typeof q.q === 'string' && q.q.length > 5, `${sub} (${grade}) level ${idx} valid question`);
                    assert.ok(!badGrammar.test(q.q), `Grammar defect in ${sub} (${grade}) L${idx}: "${q.q}"`);
                    assert.ok(!floatBug.test(q.q), `Float defect in ${sub} (${grade}) L${idx}: "${q.q}"`);
                    if (Array.isArray(q.opts)) {
                        for (const opt of q.opts) {
                            assert.ok(!floatBug.test(String(opt)), `Float defect in option of ${sub} (${grade}) L${idx}: "${opt}"`);
                        }
                    }
                }
            }
        }
    });

    it('QuestionBank — extend() does not mutate shared hand-written lessons across grades and avoids adjacent duplicates on bank-only subjects', () => {
        const baseLesson = { q: 'Question socle ?', opts: ['Un', 'Deux', 'Trois', 'Quatre'], correct: 0 };
        const rawSub = { id: 'hggsp', name: 'HGGSP', lessons: [baseLesson] };

        const ext1 = QuestionBank.extend(rawSub, 30, '1ere');
        const ext2 = QuestionBank.extend(rawSub, 30, 'terminale');

        // Base lesson object must not have been mutated in place
        assert.deepStrictEqual(baseLesson.opts, ['Un', 'Deux', 'Trois', 'Quatre']);
        assert.strictEqual(baseLesson.correct, 0);

        for (let i = 1; i < ext1.lessons.length; i++) {
            assert.notStrictEqual(
                ext1.lessons[i].q,
                ext1.lessons[i - 1].q,
                `Adjacent duplicate in HGGSP 1ere at level ${i}`
            );
        }
        assert.strictEqual(ext2.lessons.length, 30);
    });

    it('DB — normalizes emails case-insensitively, preserves 0 in addBooster, keeps combo on shield-saved wrong answer, and purges scope on deleteLocalMember', async () => {
        const reg1 = await DB.register('Alice.Test@EduQuest.FR', 'Alice', 'secret123');
        assert.strictEqual(reg1.ok, true);

        // Duplicate registration with different case must be rejected
        const regDup = await DB.register('alice.test@eduquest.fr', 'Alice2', 'secret123');
        assert.strictEqual(regDup.ok, false);

        // Login with uppercase/whitespace works and maps to same user scope
        DB.saveOption('xp', '250');
        DB.addBooster('boost-shield', 2);
        DB.addBooster('boost-shield', 0); // must not add 1!
        assert.strictEqual(DB.getBoosters()['boost-shield'], 2);

        // Shield-saved wrong answer preserves combo
        DB.resetStreak();
        DB.recordCorrectAnswer();
        DB.recordCorrectAnswer();
        const afterShield = DB.recordWrongAnswer(true);
        assert.strictEqual(afterShield.combo, 2);

        // Deleting local member purges all scoped keys (RGPD erasure)
        const delRes = await DB.deleteLocalMember('ALICE.TEST@EDUQUEST.FR');
        assert.strictEqual(delRes.ok, true);

        const dump = globalThis.localStorage._dump();
        const leakedKeys = Object.keys(dump).filter(k => k.includes('alice_test_eduquest_fr'));
        assert.deepStrictEqual(leakedKeys, [], 'All scoped keys for deleted member must be purged');
    });

    it('AdminStore — preserves numeric 0 in rewards/siteConfig, enforces explicit empty allowedNiveaux, rolls back invalid importJson, and redacts API keys on default export', () => {
        // Numeric 0 preservation
        AdminStore.saveRewardsConfig({ firstTryBonusXp: 0, chronoBonusMaxXp: 0, dailyChestCoins: 0 });
        const rewards = AdminStore.getRewardsConfig();
        assert.strictEqual(rewards.firstTryBonusXp, 0);
        assert.strictEqual(rewards.chronoBonusMaxXp, 0);
        assert.strictEqual(rewards.dailyChestCoins, 0);

        AdminStore.saveSiteConfig({ defaultSfxVolume: 0, defaultBgmVolume: 0 });
        const siteCfg = AdminStore.getSiteConfig();
        assert.strictEqual(siteCfg.defaultSfxVolume, 0);
        assert.strictEqual(siteCfg.defaultBgmVolume, 0);

        // Explicit empty allowedNiveaux disables subject for all grades
        AdminStore.saveSubjectMeta('maths', { allowedNiveaux: [] });
        const overridden = AdminStore.applyOverrides([{ id: 'maths', name: 'Mathématiques', lessons: [] }])[0];
        assert.strictEqual(AdminStore.isSubjectAllowedForNiveau(overridden, '6eme'), false);

        // Default export redacts provider apiKey, includeSecrets: true keeps it
        AdminStore.saveAiConfig({
            providers: [{
                id: 'p1',
                name: 'OpenAI Test',
                type: 'openai_compatible',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                apiKey: 'sk-live-secret-token-12345',
                model: 'gpt-4o-mini',
                enabled: true,
            }]
        });
        const redactedExport = JSON.parse(AdminStore.exportJson());
        assert.strictEqual(redactedExport.aiConfig.providers[0].apiKey, '');

        const fullExport = JSON.parse(AdminStore.exportJson({ includeSecrets: true }));
        assert.strictEqual(fullExport.aiConfig.providers[0].apiKey, 'sk-live-secret-token-12345');

        // Atomic rollback on invalid importJson
        const beforeTitle = AdminStore.getSiteConfig().title;
        const badImport = AdminStore.importJson(JSON.stringify({
            v: 1,
            siteConfig: { title: 'Corrupted Title' },
            subjects: {
                overrides: {
                    maths: {
                        lessons: [{ type: 'qcm', q: 'Broken lesson without options', opts: ['only_one'], correct: 5 }]
                    }
                }
            }
        }));
        assert.strictEqual(badImport.ok, false);
        assert.strictEqual(AdminStore.getSiteConfig().title, beforeTitle, 'importJson must roll back completely on validation error');
    });

    it('AiProvider — rejects QCM without valid correct index from direct LLM providers', async () => {
        let origFetch = globalThis.fetch;
        try {
            AdminStore.saveAiConfig({
                providers: [{
                    id: 'openai_bad',
                    name: 'Broken LLM',
                    type: 'openai_compatible',
                    endpoint: 'https://api.example.com/v1/chat/completions',
                    model: 'gpt-test',
                    enabled: true,
                }],
                fallbackToOffline: true,
            });
            globalThis.fetch = async () => ({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                type: 'qcm',
                                q: 'Question IA sans index correct ?',
                                opts: ['A', 'B', 'C', 'D'],
                                correct: null,
                            })
                        }
                    }]
                })
            });

            const res = await AiProvider.fetchQuestion('maths', 0, '6eme');
            assert.strictEqual(res.source, 'local', 'Must reject invalid LLM QCM with correct:null and fall back to local');
            assert.ok(Number.isInteger(res.lesson.correct));
        } finally {
            globalThis.fetch = origFetch;
        }
    });
});
