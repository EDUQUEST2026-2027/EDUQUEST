/* =============================================================================
   AI-PROVIDER.JS — EDUQUEST v2.7
   Pont entre le jeu et l'agent IA hébergé sur Make (voir MAKE_BLUEPRINT.md).

   TANT QUE LES DEUX URLS CI-DESSOUS SONT VIDES, ce fichier ne fait rien
   d'autre que déléguer à QuestionBank.generateOne() — le jeu se comporte
   exactement comme avant. Dès qu'elles sont renseignées, chaque ouverture
   de niveau appelle l'agent IA pour obtenir une question fraîche, jamais
   vue deux fois à l'identique, avec repli silencieux sur le générateur
   local si Make est injoignable ou trop lent (6s de délai maximum).

   CONTRAT AVEC MAKE (voir MAKE_BLUEPRINT.md pour la construction exacte) :
     POST GENERATE_WEBHOOK_URL   { subjectId, index, niveauBand }
       → { questionId, lesson: {...sans la réponse} }
     POST VALIDATE_WEBHOOK_URL   { questionId, answer }
       → { isCorrect, explanation, answerKey: {...} }
   ============================================================================= */

const AiProvider = (() => {

    // ⚠️ À renseigner une fois les deux scénarios Make publiés.
    const GENERATE_WEBHOOK_URL = ''; // ex: 'https://hook.eu2.make.com/xxxxxxxx'
    const VALIDATE_WEBHOOK_URL = ''; // ex: 'https://hook.eu2.make.com/yyyyyyyy'

    const FETCH_TIMEOUT_MS = 6000;

    function isConfigured() {
        return Boolean(GENERATE_WEBHOOK_URL && VALIDATE_WEBHOOK_URL);
    }

    async function postJSON(url, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Récupère une question pour ce niveau. Essaie l'agent IA si configuré,
     * sinon (ou en cas d'échec réseau) retombe sur le générateur local.
     *
     * @param {object} [opts] Options optionnelles :
     *   - opts.localLesson : leçon à servir telle quelle en mode local
     *     (utilisé par map.html pour conserver ses leçons 1 à 5 écrites à la
     *     main quand l'IA n'est pas configurée — comportement identique à
     *     avant l'arrivée de l'IA).
     * @returns {Promise<{lesson: object, questionId: string|null, source: 'ai'|'local'}>}
     *   questionId est null en mode local : pas de validation serveur à faire,
     *   QuizEngine.grade() peut corriger directement avec la leçon en main.
     */
    async function fetchQuestion(subjectId, index, niveauBand, opts = {}) {
        if (isConfigured()) {
            try {
                const data = await postJSON(GENERATE_WEBHOOK_URL, { subjectId, index, niveauBand });
                if (data && data.lesson) {
                    return { lesson: data.lesson, questionId: data.questionId || null, source: 'ai' };
                }
            } catch (err) {
                console.warn('[AiProvider] Agent IA injoignable, repli sur le générateur local.', err);
            }
        }
        const lesson = (opts && opts.localLesson)
            ? opts.localLesson
            : QuestionBank.generateOne(subjectId, index, niveauBand);
        return { lesson, questionId: null, source: 'local' };
    }

    /**
     * Soumet une réponse et retourne le résultat de correction.
     * En mode IA (questionId non-null), la correction est faite par Make —
     * la bonne réponse n'a jamais transité vers le client avant cet appel.
     * En mode local, ou si Make échoue ponctuellement, on corrige avec
     * QuizEngine à partir de la leçon déjà en mémoire (elle contient la
     * réponse dans ce cas, donc aucune fuite de sécurité).
     * @returns {Promise<{isCorrect: boolean, explanation: string, answerKey: object}>}
     */
    async function submitAnswer(questionId, lesson, rawAnswer) {
        if (questionId && isConfigured()) {
            try {
                const data = await postJSON(VALIDATE_WEBHOOK_URL, { questionId, answer: rawAnswer });
                if (data && typeof data.isCorrect === 'boolean') {
                    return { isCorrect: data.isCorrect, explanation: data.explanation || '', answerKey: data.answerKey || {} };
                }
            } catch (err) {
                console.warn('[AiProvider] Validation IA injoignable, correction locale de secours.', err);
            }
        }
        const isCorrect = QuizEngine.grade(lesson, rawAnswer);
        return { isCorrect, explanation: lesson.exp || '', answerKey: lesson };
    }

    return { isConfigured, fetchQuestion, submitAnswer };
})();
