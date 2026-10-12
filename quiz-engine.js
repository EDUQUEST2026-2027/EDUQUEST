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

    /** Calcule la distance de Levenshtein pour tolérer les fautes de frappe légères. */
    function levenshtein(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        const v0 = new Array(b.length + 1);
        const v1 = new Array(b.length + 1);
        for (let i = 0; i <= b.length; i++) v0[i] = i;
        for (let i = 0; i < a.length; i++) {
            v1[0] = i + 1;
            for (let j = 0; j < b.length; j++) {
                const cost = a[i] === b[j] ? 0 : 1;
                v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
            }
            for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
        }
        return v0[b.length];
    }

    /** Comparaison tolérante : normalisation accents/casse + distance de Levenshtein. */
    function isFuzzyMatch(expected, given) {
        const e = normalize(expected);
        const g = normalize(given);
        if (e === g) return true;
        if (!g || !e) return false;
        // Permissivité : 1 faute acceptée pour 4 à 6 lettres, 2 pour 7 lettres et plus
        const maxDist = e.length >= 7 ? 2 : (e.length >= 4 ? 1 : 0);
        return levenshtein(e, g) <= maxDist;
    }

    /** Mélange aléatoire d'un tableau (Fisher-Yates). */
    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* ================= QCM ================= */

    function renderQCM(question) {
        // Mélange les choix entre chaque essai tout en gardant l'index d'origine (data-choice)
        const choices = (question.opts || []).map((opt, origIndex) => ({ opt, origIndex }));
        const shuffled = shuffleArray(choices);
        return shuffled.map(c =>
            `<button class="dash-option-btn" data-choice="${c.origIndex}">${esc(c.opt)}</button>`
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
        return question.accepted.some(a => isFuzzyMatch(a, submitted));
    }
    function revealReponseCourte(container, question, submitted) {
        const input = container.querySelector('.dash-short-input');
        if (input) input.disabled = true;
        const submitBtn = container.querySelector('.dash-short-submit');
        if (submitBtn) submitBtn.disabled = true;
    }

    /* ================= TEXTE À TROUS & TEXTE À CHOIX (MENU DÉROULANT) ================= */

    function renderTexteATrous(question) {
        let blankIndex = 0;
        const isDropdown = question.type === 'texte_a_choix' || question.type === 'texte_menu_deroulant' || Boolean(question.useSelect || question.choices);

        const sentence = esc(question.textWithBlanks).replace(/___/g, () => {
            const bIdx = blankIndex++;
            if (isDropdown) {
                const candidates = (question.choices && question.choices[bIdx])
                    ? question.choices[bIdx]
                    : (question.blanks ? Array.from(new Set(question.blanks.flat())) : []);
                const shuffled = shuffleArray(candidates);
                const optsHtml = shuffled.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
                return `<select class="dash-blank-input dash-blank-select" data-blank="${bIdx}"><option value="">— Choisir —</option>${optsHtml}</select>`;
            }
            return `<input type="text" class="dash-blank-input" data-blank="${bIdx}" autocomplete="off" placeholder="…">`;
        });

        // Boîte de mots proposés pour le texte à trous textuel
        let wordBankHtml = '';
        if (!isDropdown && question.blanks) {
            const rawWords = Array.from(new Set(
                question.blanks.flat().concat(question.distractors || [])
            )).filter(Boolean);
            if (rawWords.length > 0) {
                const shuffledWords = shuffleArray(rawWords);
                wordBankHtml = `
                    <div class="dash-wordbank-container">
                        <span class="dash-wordbank-label">💡 Mots proposés (clique pour insérer) :</span>
                        <div class="dash-wordbank-chips">
                            ${shuffledWords.map(w => `<button type="button" class="dash-word-chip" data-word="${esc(w)}">${esc(w)}</button>`).join('')}
                        </div>
                    </div>`;
            }
        }

        return `
            <p class="dash-blanks-sentence">${sentence}</p>
            ${wordBankHtml}
            <button class="dash-btn-primary dash-blanks-submit" type="button">Valider</button>`;
    }

    function bindTexteATrous(container, question, quizState, onSubmit) {
        const inputs = [...container.querySelectorAll('.dash-blank-input')];
        let lastFocusedInput = inputs[0] || null;

        inputs.forEach(inp => {
            inp.addEventListener('focus', () => { lastFocusedInput = inp; });
        });

        // Clic sur un mot proposé : insère dans le champ actif ou le prochain vide
        container.querySelectorAll('.dash-word-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const word = chip.dataset.word;
                let targetInput = lastFocusedInput;
                if (!targetInput || targetInput.value) {
                    targetInput = inputs.find(i => !i.value) || targetInput;
                }
                if (targetInput) {
                    targetInput.value = word;
                    const nextInput = inputs.find(i => !i.value);
                    if (nextInput) {
                        nextInput.focus();
                        lastFocusedInput = nextInput;
                    }
                }
            });
        });

        const submit = () => onSubmit(inputs.map(i => i.value.trim()));
        container.querySelector('.dash-blanks-submit').addEventListener('click', submit);
        inputs.forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
        if (inputs[0]) inputs[0].focus();
    }

    function gradeTexteATrous(question, submitted) {
        const given = Array.isArray(submitted) ? submitted : [];
        return question.blanks.every((accepted, i) =>
            accepted.some(a => isFuzzyMatch(a, given[i]))
        );
    }

    function revealTexteATrous(container, question, submitted) {
        const given = Array.isArray(submitted) ? submitted : [];
        container.querySelectorAll('.dash-blank-input').forEach((input, i) => {
            input.disabled = true;
            const isCorrect = question.blanks[i].some(a => isFuzzyMatch(a, given[i]));
            input.classList.add(isCorrect ? 'correct' : 'wrong');
            if (!isCorrect) input.title = 'Attendu : ' + question.blanks[i][0];
        });
        container.querySelectorAll('.dash-word-chip').forEach(btn => btn.disabled = true);
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
        qcm:            { render: renderQCM,            bind: bindQCM,            grade: gradeQCM,            reveal: revealQCM },
        vrai_faux:      { render: renderVraiFaux,        bind: bindVraiFaux,       grade: gradeVraiFaux,       reveal: revealVraiFaux },
        reponse_courte: { render: renderReponseCourte,   bind: bindReponseCourte,  grade: gradeReponseCourte,  reveal: revealReponseCourte },
        texte_a_trous:  { render: renderTexteATrous,     bind: bindTexteATrous,    grade: gradeTexteATrous,    reveal: revealTexteATrous },
        drag_and_drop:  { render: renderDragAndDrop,     bind: bindDragAndDrop,    grade: gradeDragAndDrop,    reveal: revealDragAndDrop },
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
