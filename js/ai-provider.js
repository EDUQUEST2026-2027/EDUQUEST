/* =============================================================================
   AI-PROVIDER.JS — EDUQUEST v1.27.0
   Orchestrateur Multi-IA & Repli Adaptatif Local.

   CAPACITÉS :
   1. Pool Multi-IA : accepte plusieurs fournisseurs IA simultanément
      (Make webhooks, API compatibles OpenAI/Mistral/Groq/Ollama, Google Gemini)
      configurables dans admin.html.
   2. Sélection aléatoire pondérée (ou round-robin) par question, avec rotation
      automatique entre les IA et bascule en cascade en cas de panne ou timeout.
   3. Anti-répétition & Adaptation : transmet aux IA le palier adaptatif
      (Consolidation / Standard / Approfondissement) et la liste des questions
      récentes à éviter (`avoidQuestions`). Valide strictement le JSON retourné.
   4. Repli 100 % hors-ligne : délègue automatiquement à AdaptiveEngine +
      QuestionBank dès qu'aucune IA distante n'est configurée ou joignable.
   ============================================================================= */

(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AiProvider = api;
    if (typeof window !== 'undefined') window.AiProvider = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const GENERATE_WEBHOOK_URL = '';
    const VALIDATE_WEBHOOK_URL = '';
    const FETCH_TIMEOUT_MS = 8000;

    let roundRobinCursor = 0;
    const validationEndpointsByQuestionId = new Map();

    function getAdminStore() {
        if (typeof AdminStore !== 'undefined') return AdminStore;
        if (root && root.AdminStore) return root.AdminStore;
        return null;
    }

    function getQuestionBank() {
        if (typeof QuestionBank !== 'undefined') return QuestionBank;
        if (root && root.QuestionBank) return root.QuestionBank;
        return null;
    }

    function getAdaptiveEngine() {
        if (typeof AdaptiveEngine !== 'undefined') return AdaptiveEngine;
        if (root && root.AdaptiveEngine) return root.AdaptiveEngine;
        return null;
    }

    function getQuizEngine() {
        if (typeof QuizEngine !== 'undefined') return QuizEngine;
        if (root && root.QuizEngine) return root.QuizEngine;
        return null;
    }

    function getConfig() {
        const store = getAdminStore();
        if (store && typeof store.getAiConfig === 'function') {
            const conf = store.getAiConfig();
            if (conf) {
                return {
                    generateWebhookUrl: conf.generateWebhookUrl || GENERATE_WEBHOOK_URL,
                    validateWebhookUrl: conf.validateWebhookUrl || VALIDATE_WEBHOOK_URL,
                    providers: Array.isArray(conf.providers) ? conf.providers : [],
                    adaptiveMode: conf.adaptiveMode !== false,
                    selectionStrategy: conf.selectionStrategy === 'round_robin' ? 'round_robin' : 'random',
                    timeout: conf.fetchTimeoutMs || conf.timeoutMs || FETCH_TIMEOUT_MS,
                    fallbackToOffline: conf.fallbackToOffline !== false,
                };
            }
        }
        return {
            generateWebhookUrl: GENERATE_WEBHOOK_URL,
            validateWebhookUrl: VALIDATE_WEBHOOK_URL,
            providers: [],
            adaptiveMode: true,
            selectionStrategy: 'random',
            timeout: FETCH_TIMEOUT_MS,
            fallbackToOffline: true,
        };
    }

    /** Retourne la liste des fournisseurs IA distants réellement exploitables. */
    function getActiveProviders() {
        const conf = getConfig();
        const active = [];
        const seenEndpoints = new Set();

        for (const p of conf.providers) {
            if (!p || p.enabled === false) continue;
            if (p.type === 'gemini') {
                const ep = p.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model || 'gemini-2.0-flash')}:generateContent`;
                if (!p.apiKey && !p.endpoint) continue;
                active.push({ ...p, endpoint: ep });
                seenEndpoints.add(ep);
            } else if (p.endpoint) {
                active.push({ ...p });
                seenEndpoints.add(p.endpoint);
            }
        }

        // Rétrocompatibilité avec les champs legacy Make.com
        if (conf.generateWebhookUrl && !seenEndpoints.has(conf.generateWebhookUrl)) {
            active.push({
                id: 'make-legacy',
                name: 'Agent IA Make',
                type: 'make_webhook',
                endpoint: conf.generateWebhookUrl,
                validateEndpoint: conf.validateWebhookUrl || '',
                enabled: true,
                weight: 1,
            });
        }
        return active;
    }

    function isConfigured() {
        return getActiveProviders().length > 0;
    }

    /**
     * Ordonne les fournisseurs actifs selon la stratégie ('random' pondéré ou 'round_robin'),
     * en plaçant `excludeProviderId` en fin de file pour encourager la diversité sur un retry.
     */
    function selectProvidersOrder(providers, strategy = 'random', excludeProviderId = null, rng = Math.random) {
        if (!Array.isArray(providers) || providers.length === 0) return [];
        if (providers.length === 1) return providers.slice();

        const preferred = excludeProviderId
            ? providers.filter(p => p.id !== excludeProviderId)
            : providers.slice();
        const deferred = excludeProviderId
            ? providers.filter(p => p.id === excludeProviderId)
            : [];

        const orderPool = (pool) => {
            if (strategy === 'round_robin') {
                const start = roundRobinCursor % pool.length;
                roundRobinCursor = (roundRobinCursor + 1) % pool.length;
                return pool.slice(start).concat(pool.slice(0, start));
            }
            // Tirage aléatoire pondéré sans remise
            const remaining = pool.slice();
            const picked = [];
            while (remaining.length > 0) {
                const totalWeight = remaining.reduce((acc, p) => acc + Math.max(1, Number(p.weight) || 1), 0);
                let r = rng() * totalWeight;
                let chosenIdx = 0;
                for (let i = 0; i < remaining.length; i++) {
                    r -= Math.max(1, Number(remaining[i].weight) || 1);
                    if (r <= 0) {
                        chosenIdx = i;
                        break;
                    }
                }
                picked.push(remaining.splice(chosenIdx, 1)[0]);
            }
            return picked;
        };

        return orderPool(preferred).concat(deferred);
    }

    async function postJSON(url, body, timeoutMs = FETCH_TIMEOUT_MS, extraHeaders = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders),
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function extractJsonObject(rawText) {
        if (!rawText) return null;
        if (typeof rawText === 'object') return rawText;
        const txt = String(rawText).trim();
        const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1].trim() : txt;
        try {
            return JSON.parse(candidate);
        } catch (_) {
            const first = candidate.indexOf('{');
            const last = candidate.lastIndexOf('}');
            if (first !== -1 && last > first) {
                try { return JSON.parse(candidate.slice(first, last + 1)); } catch (_) { return null; }
            }
            return null;
        }
    }

    function buildPromptPayload(ctx) {
        const tierLabels = {
            remediation: 'Consolidation (question accessible, notions fondamentales)',
            standard: 'Standard (niveau attendu du programme officiel)',
            approfondissement: 'Approfondissement (question stimulante de défi)',
        };
        const avoidBlock = (ctx.avoidQuestions && ctx.avoidQuestions.length > 0)
            ? `\nQuestions déjà posées à NE PAS répéter ni reformuler :\n- ${ctx.avoidQuestions.slice(-10).join('\n- ')}`
            : '';

        const system = [
            'Tu es un enseignant français expert pour le jeu éducatif EDUQUEST.',
            'Génère UNE question pédagogique rigoureuse, exacte et adaptée au programme scolaire français.',
            'Réponds UNIQUEMENT par un objet JSON valide sans aucun texte autour.',
            'Format QCM attendu : {"type":"qcm","q":"...","opts":["A","B","C","D"],"correct":0,"exp":"Explication claire en 1-2 phrases."}',
            'Les 4 options doivent être toutes distinctes et plausibles, et "correct" est l’indice entier (0..3) de l’unique bonne réponse.',
        ].join(' ');

        const user = [
            `Matière : ${ctx.subjectName || ctx.subjectId}`,
            `Classe : ${ctx.niveau} (${ctx.niveauBand})`,
            `Niveau de jeu : ${ctx.index + 1}`,
            `Difficulté adaptative : ${tierLabels[ctx.difficultyTier] || tierLabels.standard}`,
            avoidBlock,
        ].filter(Boolean).join('\n');

        return { system, user };
    }

    function validateReturnedLesson(lesson, levelIndex) {
        if (!lesson || typeof lesson !== 'object') return null;
        const store = getAdminStore();
        const normalized = (store && typeof store.normalizeLesson === 'function')
            ? store.normalizeLesson({ ...lesson, title: lesson.title || ('Niveau ' + (levelIndex + 1)) })
            : { ...lesson, type: lesson.type || 'qcm', title: lesson.title || ('Niveau ' + (levelIndex + 1)) };

        // Cas Make sécurisé où la bonne réponse reste côté serveur (questionId fourni, pas de `correct`)
        if (normalized.type === 'qcm' && Array.isArray(normalized.opts) && normalized.opts.length >= 2 && normalized.q && normalized.correct == null) {
            return normalized;
        }

        if (store && typeof store.validateLesson === 'function') {
            const err = store.validateLesson(normalized);
            if (err) return null;
            return normalized;
        }

        // Validation minimale de secours
        if (normalized.type === 'qcm') {
            if (!normalized.q || !Array.isArray(normalized.opts) || normalized.opts.length < 2) return null;
            if (new Set(normalized.opts.map(o => String(o).trim())).size !== normalized.opts.length) return null;
            const c = Number(normalized.correct);
            if (!Number.isInteger(c) || c < 0 || c >= normalized.opts.length) return null;
            return normalized;
        }
        return normalized.q || normalized.textWithBlanks ? normalized : null;
    }

    async function invokeSingleProvider(provider, ctx, timeoutMs) {
        if (provider.type === 'make_webhook') {
            const data = await postJSON(provider.endpoint, {
                subjectId: ctx.subjectId,
                subjectName: ctx.subjectName,
                index: ctx.index,
                niveau: ctx.niveau,
                niveauBand: ctx.niveauBand,
                difficultyTier: ctx.difficultyTier,
                avoidQuestions: ctx.avoidQuestions,
                salt: ctx.salt,
            }, timeoutMs);
            const rawLesson = (data && data.lesson) ? data.lesson : data;
            const lesson = validateReturnedLesson(rawLesson, ctx.index);
            if (!lesson) throw new Error('Leçon Make invalide');
            const questionId = (data && data.questionId) ? String(data.questionId) : null;
            if (questionId && provider.validateEndpoint) {
                validationEndpointsByQuestionId.set(questionId, provider.validateEndpoint);
            }
            return { lesson, questionId };
        }

        if (provider.type === 'openai_compatible') {
            const { system, user } = buildPromptPayload(ctx);
            const headers = {};
            if (provider.apiKey) headers.Authorization = 'Bearer ' + provider.apiKey;
            const data = await postJSON(provider.endpoint, {
                model: provider.model || 'gpt-4o-mini',
                temperature: 0.75,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }, timeoutMs, headers);
            const content = data?.choices?.[0]?.message?.content;
            const parsed = extractJsonObject(content);
            const lesson = validateReturnedLesson(parsed && parsed.lesson ? parsed.lesson : parsed, ctx.index);
            if (!lesson) throw new Error('Réponse OpenAI-compatible invalide');
            return { lesson, questionId: null };
        }

        if (provider.type === 'gemini') {
            const { system, user } = buildPromptPayload(ctx);
            const headers = {};
            if (provider.apiKey) headers['x-goog-api-key'] = provider.apiKey;
            const data = await postJSON(provider.endpoint, {
                system_instruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: user }] }],
                generationConfig: {
                    temperature: 0.75,
                    responseMimeType: 'application/json',
                },
            }, timeoutMs, headers);
            const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJsonObject(content);
            const lesson = validateReturnedLesson(parsed && parsed.lesson ? parsed.lesson : parsed, ctx.index);
            if (!lesson) throw new Error('Réponse Gemini invalide');
            return { lesson, questionId: null };
        }

        throw new Error('Type de fournisseur IA inconnu : ' + provider.type);
    }

    /**
     * Récupère une question pour ce niveau.
     * - Si un ou plusieurs fournisseurs IA sont configurés : sélectionne aléatoirement
     *   (ou en round-robin) parmi le pool, avec bascule en cascade en cas d'échec.
     * - Sinon (ou en cas d'échec réseau) : délègue au moteur adaptatif local
     *   (AdaptiveEngine + QuestionBank), garantissant non-répétition et réinitialisation sur échec.
     */
    async function fetchQuestion(subjectId, index, niveauOrBand, opts = {}) {
        const qb = getQuestionBank();
        const ae = getAdaptiveEngine();
        const conf = getConfig();

        const norm = (qb && qb.normalizeNiveau) ? qb.normalizeNiveau(niveauOrBand) : (niveauOrBand || '6eme');
        const niveauBand = (qb && qb.bandForNiveau) ? qb.bandForNiveau(norm) : 'college';
        const salt = Math.max(0, Number(opts.salt != null ? opts.salt : opts.variant) || 0);
        const excludeSignatures = Array.isArray(opts.excludeSignatures) ? opts.excludeSignatures.filter(Boolean) : [];
        const excludedSet = new Set(excludeSignatures);

        const tierInfo = (ae && typeof ae.getTierInfo === 'function')
            ? ae.getTierInfo(subjectId, norm)
            : { id: 'standard', label: 'Standard', shortLabel: 'Standard', icon: '⚡' };
        const avoidQuestions = (ae && typeof ae.getAvoidQuestions === 'function')
            ? ae.getAvoidQuestions(subjectId, norm, 12)
            : [];

        const activeProviders = getActiveProviders();
        if (activeProviders.length > 0 && opts.forceLocal !== true) {
            const ordered = selectProvidersOrder(activeProviders, conf.selectionStrategy, opts.excludeProviderId || null);
            const ctx = {
                subjectId,
                subjectName: opts.subjectName || (opts.subject && opts.subject.name) || subjectId,
                index,
                niveau: norm,
                niveauBand,
                difficultyTier: conf.adaptiveMode ? tierInfo.id : 'standard',
                avoidQuestions,
                salt,
            };

            for (const provider of ordered) {
                try {
                    const result = await invokeSingleProvider(provider, ctx, conf.timeout);
                    const sig = (ae && typeof ae.signatureOf === 'function')
                        ? ae.signatureOf(result.lesson)
                        : ((qb && qb.questionSignature) ? qb.questionSignature(result.lesson) : '');
                    if (sig && excludedSet.has(sig)) {
                        throw new Error('Question IA déjà exclue (doublon évité)');
                    }
                    if (ae && typeof ae.markSeen === 'function') {
                        ae.markSeen(subjectId, norm, result.lesson);
                    }
                    return {
                        lesson: result.lesson,
                        questionId: result.questionId,
                        source: 'ai',
                        providerId: provider.id,
                        providerName: provider.name || 'IA distante',
                        difficultyTier: ctx.difficultyTier,
                        tierInfo,
                        signature: sig,
                    };
                } catch (err) {
                    console.warn(`[AiProvider] Fournisseur "${provider.name || provider.id}" indisponible, bascule suivante.`, err);
                }
            }
        }

        // Repli local adaptatif & non-répétitif
        if (ae && typeof ae.pickLocalQuestion === 'function') {
            const subjectForAdaptive = opts.subject || (opts.localLesson ? { id: subjectId, lessons: { [index]: opts.localLesson } } : null);
            // Si une leçon locale explicite est fournie pour le 1er essai et non exclue, la respecter si inédite
            if (opts.localLesson && salt === 0) {
                const localSig = ae.signatureOf(opts.localLesson);
                if (localSig && !excludedSet.has(localSig) && !ae.getSeenSignatures(subjectId, norm).includes(localSig)) {
                    ae.markSeen(subjectId, norm, opts.localLesson);
                    return {
                        lesson: opts.localLesson,
                        questionId: null,
                        source: 'local',
                        providerId: 'local-adaptive',
                        providerName: conf.adaptiveMode ? `Moteur adaptatif (${tierInfo.shortLabel})` : 'Banque locale',
                        difficultyTier: conf.adaptiveMode ? tierInfo.id : 'standard',
                        tierInfo,
                        signature: localSig,
                    };
                }
            }
            const picked = ae.pickLocalQuestion({
                subject: subjectForAdaptive,
                subjectId,
                levelIndex: index,
                niveau: norm,
                salt,
                excludeSignatures,
                adaptiveMode: conf.adaptiveMode,
            });
            return {
                lesson: picked.lesson,
                questionId: null,
                source: 'local',
                providerId: picked.providerId,
                providerName: picked.providerName,
                difficultyTier: picked.difficultyTier,
                tierInfo: picked.tierInfo,
                signature: picked.signature,
            };
        }

        // Ultime repli direct sur QuestionBank (ex: test isolé sans AdaptiveEngine)
        const variant = salt;
        const lesson = (opts && opts.localLesson && variant === 0)
            ? opts.localLesson
            : (qb ? qb.getLesson(opts.subject || subjectId, index, norm, variant) : null);
        const sig = (qb && qb.questionSignature && lesson) ? qb.questionSignature(lesson) : '';
        return {
            lesson,
            questionId: null,
            source: 'local',
            providerId: 'local-bank',
            providerName: 'Banque locale',
            difficultyTier: 'standard',
            tierInfo,
            signature: sig,
        };
    }

    /**
     * Soumet une réponse et retourne le résultat de correction.
     */
    async function submitAnswer(questionId, lesson, rawAnswer) {
        const conf = getConfig();
        const validateUrl = (questionId && validationEndpointsByQuestionId.get(questionId)) || conf.validateWebhookUrl;
        if (questionId && validateUrl) {
            try {
                const data = await postJSON(validateUrl, { questionId, answer: rawAnswer }, conf.timeout);
                if (data && typeof data.isCorrect === 'boolean') {
                    return { isCorrect: data.isCorrect, explanation: data.explanation || '', answerKey: data.answerKey || {} };
                }
            } catch (err) {
                console.warn('[AiProvider] Validation IA injoignable, correction locale de secours.', err);
            }
        }
        const qe = getQuizEngine();
        const isCorrect = qe ? qe.grade(lesson, rawAnswer) : false;
        return { isCorrect, explanation: (lesson && lesson.exp) || '', answerKey: lesson || {} };
    }

    /** Teste un fournisseur IA précis depuis admin.html. */
    async function testProvider(provider, sampleCtx = {}) {
        const conf = getConfig();
        const ctx = {
            subjectId: sampleCtx.subjectId || 'maths',
            subjectName: sampleCtx.subjectName || 'Mathématiques',
            index: 0,
            niveau: sampleCtx.niveau || '6eme',
            niveauBand: 'college',
            difficultyTier: 'standard',
            avoidQuestions: [],
            salt: Date.now() % 1000,
        };
        const started = Date.now();
        try {
            const res = await invokeSingleProvider(provider, ctx, conf.timeout);
            return { ok: true, latencyMs: Date.now() - started, lesson: res.lesson };
        } catch (err) {
            return { ok: false, latencyMs: Date.now() - started, error: err && err.message ? err.message : String(err) };
        }
    }

    return {
        isConfigured,
        getActiveProviders,
        selectProvidersOrder,
        fetchQuestion,
        submitAnswer,
        testProvider,
    };
});
