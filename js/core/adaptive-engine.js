/**
 * ADAPTIVE-ENGINE.JS — EDUQUEST v1.29.1
 * Moteur d'apprentissage adaptatif & anti-répétition (UMD)
 *
 * - Mémorise par élève, matière et classe l'historique des questions déjà vues
 *   afin d'éviter les répétitions sur les exercices consécutifs et d'une session à l'autre.
 * - Garantit la réinitialisation vers une NOUVELLE question lors d'un échec ou d'un retry.
 * - Ajuste dynamiquement le palier de difficulté (Consolidation / Standard / Approfondissement)
 *   selon les performances récentes de l'élève.
 * - Fournit la liste des questions récentes (`avoidQuestions`) au pool Multi-IA.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let QB = null;
        try { QB = require('../question-bank.js'); } catch (_) { /* optional */ }
        module.exports = factory(QB);
    } else {
        root.AdaptiveEngine = factory(root.QuestionBank || null);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (NodeQuestionBank) {
    'use strict';

    const MAX_SEEN_SIGNATURES = 240;
    const MAX_RECENT_QUESTIONS = 30;
    const MAX_RECENT_RESULTS = 8;

    const TIER_META = {
        remediation: {
            id: 'remediation',
            label: 'Consolidation',
            shortLabel: 'Consolidation',
            icon: '🌱',
            description: 'Questions de renforcement pour bien ancrer les bases.',
        },
        standard: {
            id: 'standard',
            label: 'Standard',
            shortLabel: 'Standard',
            icon: '⚡',
            description: 'Progression équilibrée adaptée à ta classe.',
        },
        approfondissement: {
            id: 'approfondissement',
            label: 'Approfondissement',
            shortLabel: 'Défi +',
            icon: '🚀',
            description: 'Défis renforcés grâce à ta belle série de réussites !',
        },
    };

    let memoryFallbackState = {};

    function getQB() {
        if (typeof globalThis !== 'undefined' && globalThis.QuestionBank) return globalThis.QuestionBank;
        if (typeof window !== 'undefined' && window.QuestionBank) return window.QuestionBank;
        return NodeQuestionBank;
    }

    function getDB() {
        if (typeof globalThis !== 'undefined' && globalThis.DB) return globalThis.DB;
        if (typeof window !== 'undefined' && window.DB) return window.DB;
        return null;
    }

    function normalizeNiveau(niveau) {
        const qb = getQB();
        if (qb && typeof qb.normalizeNiveau === 'function') return qb.normalizeNiveau(niveau);
        const s = String(niveau || '6eme').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (s === 'bts2' || (s.includes('bts') && s.includes('2'))) return 'bts2';
        if (s === 'bts1' || s.includes('bts')) return 'bts1';
        if (s.includes('term')) return 'terminale';
        if (s.includes('1')) return '1ere';
        if (s.includes('2') || s.includes('sec')) return '2nde';
        if (s.includes('3')) return '3eme';
        if (s.includes('4')) return '4eme';
        if (s.includes('5')) return '5eme';
        return '6eme';
    }

    function signatureOf(lesson) {
        if (!lesson || typeof lesson !== 'object') return '';
        const qb = getQB();
        if (qb && typeof qb.questionSignature === 'function') {
            return qb.questionSignature(lesson);
        }
        return [lesson.type || 'qcm', lesson.q || '', lesson.textWithBlanks || '']
            .join('|')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9|]+/g, ' ')
            .trim();
    }

    function loadAllState() {
        const db = getDB();
        if (db && typeof db.getAdaptiveState === 'function') {
            try {
                const raw = db.getAdaptiveState();
                return (raw && typeof raw === 'object') ? raw : {};
            } catch (_) { /* fallback below */ }
        }
        return memoryFallbackState;
    }

    function saveAllState(state) {
        const db = getDB();
        if (db && typeof db.saveAdaptiveState === 'function') {
            try {
                db.saveAdaptiveState(state);
                return;
            } catch (_) { /* fallback below */ }
        }
        memoryFallbackState = state;
    }

    function bucketKey(subjectId, niveau) {
        return `${String(subjectId || 'general').toLowerCase()}::${normalizeNiveau(niveau)}`;
    }

    function ensureBucket(state, subjectId, niveau) {
        const key = bucketKey(subjectId, niveau);
        const raw = state[key];
        const b = (raw && typeof raw === 'object') ? raw : {};
        return {
            key,
            seenSignatures: Array.isArray(b.seenSignatures) ? b.seenSignatures.slice(-MAX_SEEN_SIGNATURES) : [],
            recentQuestions: Array.isArray(b.recentQuestions) ? b.recentQuestions.slice(-MAX_RECENT_QUESTIONS) : [],
            recentResults: Array.isArray(b.recentResults) ? b.recentResults.slice(-MAX_RECENT_RESULTS) : [],
            consecutiveWins: Number(b.consecutiveWins) || 0,
            consecutiveFails: Number(b.consecutiveFails) || 0,
            tier: TIER_META[b.tier] ? b.tier : 'standard',
        };
    }

    function computeTier(bucket) {
        const recent = bucket.recentResults || [];
        if (bucket.consecutiveFails >= 2) return 'remediation';
        if (recent.length >= 4) {
            const wins = recent.filter(r => r && r.ok).length;
            const rate = wins / recent.length;
            if (rate < 0.5) return 'remediation';
            const firstTryWins = recent.filter(r => r && r.ok && r.firstTry).length;
            if (bucket.consecutiveWins >= 3 || (firstTryWins / recent.length) >= 0.85) {
                return 'approfondissement';
            }
        }
        if (bucket.consecutiveWins >= 3) return 'approfondissement';
        return 'standard';
    }

    function getTierInfo(subjectId, niveau) {
        const state = loadAllState();
        const bucket = ensureBucket(state, subjectId, niveau);
        const tier = computeTier(bucket);
        return { ...TIER_META[tier], consecutiveWins: bucket.consecutiveWins, consecutiveFails: bucket.consecutiveFails };
    }

    function _markSeenOnState(state, bucket, lesson, precomputedSig) {
        if (!lesson) return '';
        const sig = precomputedSig || signatureOf(lesson);
        if (!sig) return '';

        bucket.seenSignatures = bucket.seenSignatures.filter(s => s !== sig);
        bucket.seenSignatures.push(sig);
        if (bucket.seenSignatures.length > MAX_SEEN_SIGNATURES) {
            bucket.seenSignatures = bucket.seenSignatures.slice(-MAX_SEEN_SIGNATURES);
        }

        const promptText = String(lesson.q || lesson.textWithBlanks || '').trim();
        if (promptText) {
            bucket.recentQuestions = bucket.recentQuestions.filter(q => q !== promptText);
            bucket.recentQuestions.push(promptText);
            if (bucket.recentQuestions.length > MAX_RECENT_QUESTIONS) {
                bucket.recentQuestions = bucket.recentQuestions.slice(-MAX_RECENT_QUESTIONS);
            }
        }

        state[bucket.key] = {
            seenSignatures: bucket.seenSignatures,
            recentQuestions: bucket.recentQuestions,
            recentResults: bucket.recentResults,
            consecutiveWins: bucket.consecutiveWins,
            consecutiveFails: bucket.consecutiveFails,
            tier: bucket.tier,
        };
        saveAllState(state);
        return sig;
    }

    function markSeen(subjectId, niveau, lesson) {
        if (!lesson) return '';
        const sig = signatureOf(lesson);
        if (!sig) return '';
        const state = loadAllState();
        const bucket = ensureBucket(state, subjectId, niveau);
        return _markSeenOnState(state, bucket, lesson, sig);
    }

    function recordOutcome(subjectId, niveau, { isCorrect = false, firstTry = false } = {}) {
        const state = loadAllState();
        const bucket = ensureBucket(state, subjectId, niveau);

        bucket.recentResults.push({ ok: !!isCorrect, firstTry: !!firstTry, at: Date.now() });
        if (bucket.recentResults.length > MAX_RECENT_RESULTS) {
            bucket.recentResults = bucket.recentResults.slice(-MAX_RECENT_RESULTS);
        }

        if (isCorrect) {
            bucket.consecutiveWins += 1;
            bucket.consecutiveFails = 0;
        } else {
            bucket.consecutiveFails += 1;
            bucket.consecutiveWins = 0;
        }
        bucket.tier = computeTier(bucket);

        state[bucket.key] = {
            seenSignatures: bucket.seenSignatures,
            recentQuestions: bucket.recentQuestions,
            recentResults: bucket.recentResults,
            consecutiveWins: bucket.consecutiveWins,
            consecutiveFails: bucket.consecutiveFails,
            tier: bucket.tier,
        };
        saveAllState(state);
        return { ...TIER_META[bucket.tier], consecutiveWins: bucket.consecutiveWins, consecutiveFails: bucket.consecutiveFails };
    }

    function getAvoidQuestions(subjectId, niveau, limit = 12) {
        const state = loadAllState();
        const bucket = ensureBucket(state, subjectId, niveau);
        return bucket.recentQuestions.slice(-Math.max(1, limit));
    }

    function getSeenSignatures(subjectId, niveau) {
        const state = loadAllState();
        const bucket = ensureBucket(state, subjectId, niveau);
        return bucket.seenSignatures.slice();
    }

    /**
     * Sélectionne une question locale adaptative et non répétitive.
     * - Si `salt > 0` (ex: après un échec), évite strictement la question précédente et les questions déjà vues.
     * - Ajuste l'indice/la variante selon le palier adaptatif de l'élève.
     */
    function pickLocalQuestion({
        subject = null,
        subjectId = '',
        levelIndex = 0,
        niveau = '6eme',
        salt = 0,
        excludeSignatures = [],
        adaptiveMode = true,
    } = {}) {
        const qb = getQB();
        const sid = String(subjectId || (subject && subject.id) || 'maths').toLowerCase();
        const norm = normalizeNiveau(niveau);
        const state = loadAllState();
        const bucket = ensureBucket(state, sid, norm);
        const tier = adaptiveMode ? computeTier(bucket) : 'standard';
        const tierInfo = { ...TIER_META[tier], consecutiveWins: bucket.consecutiveWins, consecutiveFails: bucket.consecutiveFails };

        const hardExcluded = new Set((excludeSignatures || []).filter(Boolean));
        const seenSet = new Set(bucket.seenSignatures || []);
        const veryRecentSet = new Set((bucket.seenSignatures || []).slice(-6));

        const baseIdx = Math.max(0, Number(levelIndex) || 0);
        const cleanSalt = Math.max(0, Number(salt) || 0);

        const wrapLesson = (lesson, precomputedSig) => {
            const sig = _markSeenOnState(state, bucket, lesson, precomputedSig);
            return {
                lesson: { ...lesson, title: lesson.title || ('Niveau ' + (baseIdx + 1)) },
                signature: sig,
                difficultyTier: tier,
                tierInfo,
                source: 'local',
                providerId: 'local-adaptive',
                providerName: adaptiveMode ? `Moteur adaptatif (${tierInfo.shortLabel})` : 'Banque locale',
            };
        };

        // 1. Premier essai (salt === 0) : si une leçon artisanale/admin existe et n'est ni exclue ni déjà vue, on la privilégie
        if (cleanSalt === 0 && subject && Array.isArray(subject.lessons) && subject.lessons[baseIdx]) {
            const hand = subject.lessons[baseIdx];
            const handSig = signatureOf(hand);
            if (handSig && !hardExcluded.has(handSig) && !seenSet.has(handSig)) {
                return wrapLesson(hand, handSig);
            }
        }

        // Décalage d'indice selon le palier adaptatif
        let tierIndexShift = 0;
        if (adaptiveMode) {
            if (tier === 'remediation') tierIndexShift = baseIdx > 0 ? -1 : 0;
            else if (tier === 'approfondissement') tierIndexShift = 3;
        }

        // Construit le vivier à la volée avec sortie rapide dès qu'un candidat inédit optimal est trouvé (Passe 1 intégrée)
        const candidates = []; // { lesson, sig }
        let fallbackUnseen = null;

        const considerCandidate = (cand, preSig) => {
            const sig = preSig || signatureOf(cand);
            if (!sig) return null;
            candidates.push({ lesson: cand, sig });
            if (hardExcluded.has(sig) || seenSet.has(sig)) return null;
            if (tier === 'remediation') {
                if (cand.type === 'qcm' || cand.type === 'vrai_faux') {
                    return wrapLesson(cand, sig);
                }
                if (!fallbackUnseen) fallbackUnseen = { lesson: cand, sig };
                return null;
            }
            return wrapLesson(cand, sig);
        };

        if (qb && typeof qb.generateOne === 'function') {
            // Inclure les variantes déjà attachées à la leçon si présentes
            if (subject && Array.isArray(subject.lessons) && subject.lessons[baseIdx]) {
                const baseLesson = subject.lessons[baseIdx];
                if (Array.isArray(baseLesson.variants)) {
                    for (const v of baseLesson.variants) {
                        if (v) {
                            const hit = considerCandidate(v);
                            if (hit) return hit;
                        }
                    }
                }
            }

            // Explorer jusqu'à 96 candidats distincts (s'arrête dès le premier inédit optimal)
            const candidateSigs = new Set(candidates.map(c => c.sig));
            for (let attempt = 0; attempt < 96; attempt++) {
                const variant = cleanSalt + (attempt % 7) + (tier === 'approfondissement' ? 2 : 0);
                const idxOffset = attempt < 6 ? attempt : (attempt * 3 + Math.floor(attempt / 5));
                const targetIdx = Math.max(0, baseIdx + tierIndexShift + idxOffset);
                const generated = qb.generateOne(sid, targetIdx, norm, variant);
                if (generated) {
                    const gSig = signatureOf(generated);
                    if (gSig && !candidateSigs.has(gSig)) {
                        candidateSigs.add(gSig);
                        const cand = {
                            ...generated,
                            title: 'Niveau ' + (baseIdx + 1),
                        };
                        const hit = considerCandidate(cand, gSig);
                        if (hit) return hit;
                    }
                }
            }
        } else if (subject && Array.isArray(subject.lessons) && subject.lessons[baseIdx]) {
            return wrapLesson(subject.lessons[baseIdx]);
        }

        if (fallbackUnseen) return wrapLesson(fallbackUnseen.lesson, fallbackUnseen.sig);

        // Index O(1) des signatures déjà vues pour les passes 2 et 3
        const seenPosMap = new Map();
        for (let i = 0; i < bucket.seenSignatures.length; i++) {
            seenPosMap.set(bucket.seenSignatures[i], i);
        }

        // Passe 2 : si tout le vivier a déjà été vu, choisir la question vue le PLUS ANCIENNEMENT (FIFO)
        // en évitant strictement hardExcluded et les plus récentes.
        let oldestCand = null;
        let oldestPos = Infinity;
        for (const item of candidates) {
            if (hardExcluded.has(item.sig) || veryRecentSet.has(item.sig)) continue;
            const pos = seenPosMap.has(item.sig) ? seenPosMap.get(item.sig) : -1;
            if (pos < oldestPos) {
                oldestPos = pos;
                oldestCand = item;
            }
        }
        if (oldestCand) return wrapLesson(oldestCand.lesson, oldestCand.sig);

        // Passe 3 : dernier recours — la plus ancienne différente de hardExcluded
        let fallbackOldest = null;
        let fallbackPos = Infinity;
        for (const item of candidates) {
            if (!hardExcluded.has(item.sig)) {
                const pos = seenPosMap.has(item.sig) ? seenPosMap.get(item.sig) : -1;
                if (pos < fallbackPos) {
                    fallbackPos = pos;
                    fallbackOldest = item;
                }
            }
        }
        if (fallbackOldest) return wrapLesson(fallbackOldest.lesson, fallbackOldest.sig);

        // Ultime repli
        const finalLesson = (candidates[0] && candidates[0].lesson) || {
            type: 'qcm',
            title: 'Niveau ' + (baseIdx + 1),
            q: 'Question de révision',
            opts: ['A', 'B', 'C', 'D'],
            correct: 0,
            exp: '',
        };
        return wrapLesson(finalLesson);
    }

    function resetBucket(subjectId, niveau) {
        const state = loadAllState();
        delete state[bucketKey(subjectId, niveau)];
        saveAllState(state);
    }

    function resetAll() {
        memoryFallbackState = {};
        saveAllState({});
    }

    return {
        TIER_META,
        signatureOf,
        getTierInfo,
        markSeen,
        recordOutcome,
        getAvoidQuestions,
        getSeenSignatures,
        pickLocalQuestion,
        resetBucket,
        resetAll,
    };
});
