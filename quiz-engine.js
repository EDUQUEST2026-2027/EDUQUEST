/* =============================================================================
   QUIZ-ENGINE.JS — EDUQUEST v2.1
   Moteur de rendu et de correction pour les questions du dashboard.

   RÔLE :
   Ce fichier isole tout ce qui dépend du TYPE de question (QCM, Vrai/Faux,
   Réponse courte, Texte à trous, Association) du reste du dashboard
   (app.js → initDashboard). Ajouter un nouveau type de question ne demande
   de toucher qu'à ce fichier : enregistrer un nouveau moteur dans
   QUESTION_ENGINES, rien d'autre à changer côté dashboard.

   TYPES SUPPORTÉS (valeur du champ `type` d'une leçon) :
     'qcm'            → question.opts (array), question.correct (index)
     'vrai_faux'      → question.correct (booléen : true = Vrai, false = Faux)
     'reponse_courte' → question.accepted (array de réponses acceptées)
     'texte_a_trous'  → question.textWithBlanks (string, "___" = un trou),
                         question.blanks (array de tableaux de réponses acceptées, un par trou)
     'drag_and_drop'  → question.items (array), question.targets (array),
                         question.pairs (objet { item: target })
                         Implémenté en "cliquer pour associer" plutôt qu'en
                         glisser-déposer natif : plus fiable au clavier/tactile
                         (tablette de classe), sans perdre le principe pédagogique
                         d'association.

   Une leçon sans champ `type` est traitée comme 'qcm' (rétrocompatibilité
   avec les leçons déjà écrites dans DASH_SUBJECTS).

   UTILISATION (depuis app.js) :
     QuizEngine.renderBody(question, quizState)   → HTML de la zone interactive
     QuizEngine.bind(container, question, quizState, onSubmit) → attache les événements
     QuizEngine.grade(question, submittedAnswer)  → true/false
   ============================================================================= */

const QuizEngine = (() => {

    /**
     * Échappe les caractères HTML spéciaux avant toute insertion dans du
     * innerHTML. Indispensable pour le contenu des leçons : en mode IA, les
     * questions viennent d'un agent externe (Make/LLM) et ne peuvent plus
     * être considérées comme du contenu de confiance (risque XSS).
     * (Doublon local de escapeHtml() de app.js, chargé après ce fichier.)
     */
    function esc(str) {
        const div = document.createElement('div');
        div.textContent = String(str ?? '');
        return div.innerHTML;
    }

    /** Normalise une chaîne pour comparaison (accents, casse, espaces). */
    function normalize(str) {
        return String(str ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' '); // tolère les espaces doubles/irréguliers
    }

    /* ================= QCM ================= */

    function renderQCM(question) {
        return question.opts.map((opt, i) =>
            `<button class="dash-option-btn" data-choice="${i}">${esc(opt)}</button>`
        ).join('');
    }
    function bindQCM(container, question, quizState, onSubmit) {
        container.querySelectorAll('[data-choice]').forEach(btn => {
            btn.addEventListener('click', () => onSubmit(parseInt(btn.dataset.choice)));
        });
    }
    function gradeQCM(question, submitted) {
        return submitted === question.correct;
    }
    function revealQCM(container, question, submitted) {
        container.querySelectorAll('[data-choice]').forEach(btn => {
            const i = parseInt(btn.dataset.choice);
            btn.disabled = true;
            if (i === question.correct) btn.classList.add('correct');
            else if (i === submitted) btn.classList.add('wrong');
        });
    }

    /* ================= VRAI / FAUX ================= */
    /* Réutilise le même gabarit visuel que le QCM (2 gros boutons), avec un
       intitulé fixe plutôt que des opts fournies par la leçon. */

    function renderVraiFaux() {
        return `
            <button class="dash-option-btn dash-vf-btn" data-choice="true">✓ Vrai</button>
            <button class="dash-option-btn dash-vf-btn" data-choice="false">✗ Faux</button>`;
    }
    function bindVraiFaux(container, question, quizState, onSubmit) {
        container.querySelectorAll('[data-choice]').forEach(btn => {
            btn.addEventListener('click', () => onSubmit(btn.dataset.choice === 'true'));
        });
    }
    function gradeVraiFaux(question, submitted) {
        return submitted === question.correct;
    }
    function revealVraiFaux(container, question, submitted) {
        container.querySelectorAll('[data-choice]').forEach(btn => {
            const value = btn.dataset.choice === 'true';
            btn.disabled = true;
            if (value === question.correct) btn.classList.add('correct');
            else if (value === submitted) btn.classList.add('wrong');
        });
    }

    /* ================= RÉPONSE COURTE ================= */

    function renderReponseCourte() {
        return `
            <input type="text" class="dash-short-input" placeholder="Ta réponse…" autocomplete="off">
            <button class="dash-btn-primary dash-short-submit" type="button">Valider</button>`;
    }
    function bindReponseCourte(container, question, quizState, onSubmit) {
        const input = container.querySelector('.dash-short-input');
        const submit = () => { if (input.value.trim()) onSubmit(input.value.trim()); };
        container.querySelector('.dash-short-submit').addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        input.focus();
    }
    function gradeReponseCourte(question, submitted) {
        return question.accepted.some(a => normalize(a) === normalize(submitted));
    }
    function revealReponseCourte(container, question, submitted) {
        const input = container.querySelector('.dash-short-input');
        if (input) input.disabled = true;
        const submitBtn = container.querySelector('.dash-short-submit');
        if (submitBtn) submitBtn.disabled = true;
    }

    /* ================= TEXTE À TROUS ================= */

    function renderTexteATrous(question) {
        let blankIndex = 0;
        // On échappe d'abord la phrase (le contenu peut venir de l'IA), puis
        // on remplace les ___ par les champs — les balises insérées ensuite
        // sont donc les seules présentes dans le HTML final.
        const sentence = esc(question.textWithBlanks).replace(/___/g, () =>
            `<input type="text" class="dash-blank-input" data-blank="${blankIndex++}" autocomplete="off">`
        );
        return `
            <p class="dash-blanks-sentence">${sentence}</p>
            <button class="dash-btn-primary dash-blanks-submit" type="button">Valider</button>`;
    }
    function bindTexteATrous(container, question, quizState, onSubmit) {
        const inputs = [...container.querySelectorAll('.dash-blank-input')];
        const submit = () => onSubmit(inputs.map(i => i.value.trim()));
        container.querySelector('.dash-blanks-submit').addEventListener('click', submit);
        inputs.forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
        if (inputs[0]) inputs[0].focus();
    }
    function gradeTexteATrous(question, submitted) {
        const given = Array.isArray(submitted) ? submitted : [];
        return question.blanks.every((accepted, i) => accepted.some(a => normalize(a) === normalize(given[i])));
    }
    function revealTexteATrous(container, question, submitted) {
        const given = Array.isArray(submitted) ? submitted : [];
        container.querySelectorAll('.dash-blank-input').forEach((input, i) => {
            input.disabled = true;
            const isCorrect = question.blanks[i].some(a => normalize(a) === normalize(given[i]));
            input.classList.add(isCorrect ? 'correct' : 'wrong');
            if (!isCorrect) input.title = 'Attendu : ' + question.blanks[i][0];
        });
        const submitBtn = container.querySelector('.dash-blanks-submit');
        if (submitBtn) submitBtn.disabled = true;
    }

    /* ================= ASSOCIATION (« drag & drop ») ================= */
    /* Interaction en 2 clics : on sélectionne un item, puis la cible à
       laquelle on veut l'associer. Un badge affiche les paires déjà faites. */

    function renderDragAndDrop(question) {
        const items = question.items.map((it, i) =>
            `<button class="dash-dd-chip" data-item="${i}">${esc(it)}</button>`).join('');
        const targets = question.targets.map((t, i) =>
            `<button class="dash-dd-target" data-target="${i}">${esc(t)}<span class="dash-dd-drop"></span></button>`).join('');
        return `
            <div class="dash-dd-hint">Clique un élément, puis la case à laquelle il correspond.</div>
            <div class="dash-dd-row">${items}</div>
            <div class="dash-dd-row">${targets}</div>
            <button class="dash-btn-primary dash-dd-submit" type="button" disabled>Valider</button>`;
    }
    function bindDragAndDrop(container, question, quizState, onSubmit) {
        const pairs = {}; // { itemIndex: targetIndex }
        let selectedItem = null;
        const submitBtn = container.querySelector('.dash-dd-submit');

        function refresh() {
            container.querySelectorAll('.dash-dd-chip').forEach(chip => {
                const i = chip.dataset.item;
                chip.classList.toggle('selected', selectedItem === i);
                chip.classList.toggle('placed', i in pairs);
            });
            submitBtn.disabled = Object.keys(pairs).length < question.items.length;
        }

        container.querySelectorAll('.dash-dd-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                selectedItem = chip.dataset.item;
                refresh();
            });
        });
        container.querySelectorAll('.dash-dd-target').forEach(target => {
            target.addEventListener('click', () => {
                if (selectedItem === null) return;
                pairs[selectedItem] = target.dataset.target;
                const dropZone = target.querySelector('.dash-dd-drop');
                if (dropZone) dropZone.textContent = question.items[selectedItem]; // textContent → pas d'échappement nécessaire
                selectedItem = null;
                refresh();
            });
        });
        submitBtn.addEventListener('click', () => onSubmit(pairs));
    }
    function gradeDragAndDrop(question, submitted) {
        const given = submitted && typeof submitted === 'object' ? submitted : {};
        return question.items.every((item, i) => {
            const expectedTargetIndex = question.targets.indexOf(question.pairs[item]);
            return Number(given[i]) === expectedTargetIndex;
        });
    }
    function revealDragAndDrop(container, question, submitted) {
        container.querySelectorAll('.dash-dd-chip, .dash-dd-target, .dash-dd-submit').forEach(el => el.disabled = true);
    }

    /* ================= REGISTRE ================= */

    const QUESTION_ENGINES = {
        qcm: { render: renderQCM, bind: bindQCM, grade: gradeQCM, reveal: revealQCM },
        vrai_faux: { render: renderVraiFaux, bind: bindVraiFaux, grade: gradeVraiFaux, reveal: revealVraiFaux },
        reponse_courte: { render: renderReponseCourte, bind: bindReponseCourte, grade: gradeReponseCourte, reveal: revealReponseCourte },
        texte_a_trous: { render: renderTexteATrous, bind: bindTexteATrous, grade: gradeTexteATrous, reveal: revealTexteATrous },
        drag_and_drop: { render: renderDragAndDrop, bind: bindDragAndDrop, grade: gradeDragAndDrop, reveal: revealDragAndDrop },
    };

    function engineFor(question) {
        return QUESTION_ENGINES[question.type] || QUESTION_ENGINES.qcm;
    }

    return {
        /** HTML de la zone interactive (à insérer dans la modale). */
        renderBody(question) {
            return engineFor(question).render(question);
        },
        /** Attache les événements ; appelle onSubmit(answer) quand l'élève valide. */
        bind(container, question, quizState, onSubmit) {
            engineFor(question).bind(container, question, quizState, onSubmit);
        },
        /** Corrige une réponse soumise. */
        grade(question, submitted) {
            return engineFor(question).grade(question, submitted);
        },
        /** Désactive les contrôles et colore correct/incorrect après correction. */
        reveal(container, question, submitted) {
            engineFor(question).reveal(container, question, submitted);
        },
    };
})();

if (typeof window !== 'undefined') {
    window.QuizEngine = QuizEngine;
}

