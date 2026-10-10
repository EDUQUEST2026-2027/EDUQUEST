/* =============================================================================
   QUESTION-BANK.JS — EDUQUEST v2.4
   Génère jusqu'à 100 niveaux par matière (au lieu des 5 écrits à la main),
   et corrige un vrai problème du prototype précédent : la bonne réponse
   était presque toujours en 1ère position dans les QCM.

   COMMENT ÇA MARCHE :
   - Les 5 leçons écrites à la main (dans DASH_SUBJECTS, app.js) sont
     conservées telles quelles pour les niveaux 1 à 5 — elles restent les
     seules à utiliser les types Vrai/Faux, réponse courte, texte à trous
     et association.
   - Les niveaux 6 à 100 sont générés :
       - Mathématiques : calcul procédural (opérandes aléatoires, jamais
         deux fois le même problème) — variété quasi illimitée.        - Les 9 autres matières : tirées d'une banque d'environ 20 questions
         réelles par matière, avec distracteurs et position de la bonne
         réponse mélangés à chaque cycle — un même fait peut donc revenir
         plus tard avec un ordre de réponses différent (comme beaucoup
         d'applications de révision par répétition espacée).
   - TOUS les QCM (y compris les 5 écrits à la main) passent par un mélange
     déterministe (seeded) des choix : rouvrir un niveau redonne toujours
     le même ordre, mais cet ordre n'est presque jamais [bonne réponse en 1er].

   Ce fichier n'a pas de dépendance : il expose window.QuestionBank.
   ============================================================================= */

const QuestionBank = (() => {

    /* ================= PRNG déterministe (mulberry32) ================= */
    /* Même principe qu'un vrai générateur de contenu IA : chaque niveau a
       un identifiant stable (matière + numéro), donc rouvrir un niveau
       donne toujours la même question — indispensable pour que la
       progression ait un sens. */

    function hashSeed(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h >>> 0;
    }

    function seededRng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Mélange les options d'un QCM et recalcule l'index de la bonne réponse. */
    function shuffleOptions(opts, correctIndex, rng) {
        const order = opts.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return {
            opts: order.map(i => opts[i]),
            correct: order.indexOf(correctIndex),
        };
    }

    /**
     * Ré-ordonne les choix d'une leçon QCM déjà écrite (hand-written),
     * de façon déterministe selon son identifiant. Ne change rien aux
     * leçons d'un autre type (vrai_faux, reponse_courte, etc.).
     */
    function reshuffleHandWritten(lesson, subjectId, index) {
        if (lesson.type !== 'qcm' && lesson.type) return lesson; // qcm par défaut si type absent
        if (!lesson.opts) return lesson;
        const rng = seededRng(hashSeed(subjectId + ':fixed:' + index));
        const { opts, correct } = shuffleOptions(lesson.opts, lesson.correct, rng);
        return { ...lesson, opts, correct };
    }

    /* ================= Génération procédurale — Mathématiques ================= */

    /**
     * Convertit un niveau scolaire précis (paramètre stocké par DB.setNiveau,
     * ex. '6eme', '2nde') en une bande de difficulté à deux crans. On ne
     * cherche pas à distinguer les 7 niveaux un par un — trop de contenu à
     * garantir factuellement juste — mais au moins collège / lycée doivent
     * donner une expérience visiblement différente.
     */
    function bandForNiveau(niveau) {
        const lyceeGrades = ['2nde', '1ere', 'terminale'];
        return lyceeGrades.includes(niveau) ? 'lycee' : 'college';
    }

    function uniqueWrongs(correct, candidates, allowNegative) {
        const seen = new Set([correct]);
        const result = [];
        for (const c of candidates) {
            const n = Math.round(c);
            if (!seen.has(n) && (allowNegative || n >= 0)) { seen.add(n); result.push(n); }
            if (result.length === 3) break;
        }
        let delta = 1;
        while (result.length < 3) {
            const n = correct + delta;
            if (!seen.has(n) && (allowNegative || n >= 0)) { seen.add(n); result.push(n); }
            delta = delta > 0 ? -delta : -delta + 1;
        }
        return result;
    }

    function generateMathLesson(index, band) {
        const rng = seededRng(hashSeed('maths:' + band + ':' + index));
        const kindsCollege = ['add', 'sub', 'mul', 'div', 'pct', 'square'];
        const kindsLycee = ['equation', 'cube', 'sqrt', 'mul_large', 'pct_hard', 'neg_sub'];
        const kinds = band === 'lycee' ? kindsLycee : kindsCollege;
        const kind = kinds[index % kinds.length];
        let q, correct, wrongCandidates, allowNegative = false;

        switch (kind) {
            case 'add': {
                const a = 10 + Math.floor(rng() * 90), b = 10 + Math.floor(rng() * 90);
                correct = a + b;
                q = `Combien font ${a} + ${b} ?`;
                wrongCandidates = [correct + 1, correct - 1, correct + 10, correct - 10];
                break;
            }
            case 'sub': {
                const a = 20 + Math.floor(rng() * 80);
                const b = 1 + Math.floor(rng() * (a - 1));
                correct = a - b;
                q = `Combien font ${a} - ${b} ?`;
                wrongCandidates = [correct + 1, correct - 1, correct + 5, correct - 5];
                break;
            }
            case 'mul': {
                const a = 2 + Math.floor(rng() * 11), b = 2 + Math.floor(rng() * 11);
                correct = a * b;
                q = `Combien font ${a} × ${b} ?`;
                wrongCandidates = [correct + a, correct - b, correct + 1, correct - 1];
                break;
            }
            case 'div': {
                const b = 2 + Math.floor(rng() * 9);
                correct = 2 + Math.floor(rng() * 12);
                const a = b * correct;
                q = `Combien font ${a} ÷ ${b} ?`;
                wrongCandidates = [correct + 1, correct - 1, correct + 2, correct - 2];
                break;
            }
            case 'pct': {
                const pct = [10, 20, 25, 50, 75][Math.floor(rng() * 5)];
                const base = (2 + Math.floor(rng() * 20)) * 4; // multiple de 4 → résultat entier
                correct = Math.round(base * pct / 100);
                q = `Combien font ${pct}% de ${base} ?`;
                wrongCandidates = [correct + base * 0.1, correct - base * 0.1, correct + 5, correct - 5];
                break;
            }
            case 'square': {
                const n = 2 + Math.floor(rng() * 14);
                correct = n * n;
                q = `Combien font ${n}² ?`;
                wrongCandidates = [correct + n, correct - n, correct + 2, correct - 2];
                break;
            }

            /* --- Niveau lycée : opérations plus avancées --- */
            case 'equation': {
                const a = 2 + Math.floor(rng() * 8);
                const xTrue = 1 + Math.floor(rng() * 20);
                const b = 1 + Math.floor(rng() * 50);
                const c = a * xTrue + b;
                correct = xTrue;
                q = `Résous : ${a}x + ${b} = ${c}. Que vaut x ?`;
                wrongCandidates = [correct + 1, correct - 1, correct + 2, correct - 2];
                break;
            }
            case 'cube': {
                const n = 2 + Math.floor(rng() * 8);
                correct = n * n * n;
                q = `Combien font ${n}³ ?`;
                wrongCandidates = [correct + n * n, correct - n, correct + n, correct - n * n];
                break;
            }
            case 'sqrt': {
                const n = 4 + Math.floor(rng() * 17);
                const square = n * n;
                correct = n;
                q = `Quelle est la racine carrée de ${square} ?`;
                wrongCandidates = [correct + 1, correct - 1, correct + 2, correct - 2];
                break;
            }
            case 'mul_large': {
                const a = 12 + Math.floor(rng() * 18), b = 11 + Math.floor(rng() * 15);
                correct = a * b;
                q = `Combien font ${a} × ${b} ?`;
                wrongCandidates = [correct + a, correct - b, correct + 10, correct - 10];
                break;
            }
            case 'pct_hard': {
                const pct = [12, 15, 35, 60, 80][Math.floor(rng() * 5)];
                const base = 20 + Math.floor(rng() * 180);
                correct = Math.round(base * pct / 100);
                q = `Combien font ${pct}% de ${base} ? (arrondis à l'entier)`;
                wrongCandidates = [correct + 1, correct - 1, correct + 5, correct - 5];
                break;
            }
            case 'neg_sub': {
                const a = 1 + Math.floor(rng() * 15);
                const b = a + 1 + Math.floor(rng() * 30);
                correct = a - b; // négatif
                q = `Combien font ${a} - ${b} ?`;
                wrongCandidates = [correct + 1, correct - 1, -correct, correct + 5];
                allowNegative = true;
                break;
            }
        }

        const wrongs = uniqueWrongs(correct, wrongCandidates, allowNegative);
        const opts0 = [String(correct), ...wrongs.map(String)];
        const { opts, correct: correctIndex } = shuffleOptions(opts0, 0, rng);

        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q,
            opts,
            correct: correctIndex,
            exp: `La bonne réponse est ${correct}.`,
        };
    }

    /* ================= Banques de questions — 9 autres matières ================= */
    /* Chaque entrée : { q, correct, wrongs: [3 distracteurs] }. Les banques
       font ~20 questions réelles ; au-delà du niveau 24 (5 leçons + 20
       banque - 1), les questions reviennent avec un ordre de réponses
       différent plutôt que de se répéter à l'identique. */

    const FACT_BANKS = {
        francais: [
            { q: "Quel est le synonyme de « joyeux » ?", correct: "content", wrongs: ["triste", "fatigué", "en colère"], level: 'college' },
            { q: "Quel est l'antonyme de « grand » ?", correct: "petit", wrongs: ["large", "haut", "fort"], level: 'college' },
            { q: "Quelle est la nature du mot « rapidement » ?", correct: "adverbe", wrongs: ["adjectif", "nom", "verbe"], level: 'college' },
            { q: "Quel est le pluriel de « cheval » ?", correct: "chevaux", wrongs: ["chevals", "chevaus", "chevaux s"], level: 'college' },
            { q: "Conjugue « finir » à la 3e personne du singulier au présent.", correct: "il finit", wrongs: ["il finis", "il finissait", "il finira"], level: 'college' },
            { q: "Quel est le synonyme de « rapide » ?", correct: "prompt", wrongs: ["lent", "calme", "lourd"], level: 'lycee' },
            { q: "Quel est l'antonyme de « commencer » ?", correct: "finir", wrongs: ["débuter", "continuer", "ouvrir"], level: 'college' },
            { q: "Quelle est la nature du mot « le » dans « le chat » ?", correct: "déterminant", wrongs: ["pronom", "adjectif", "nom"], level: 'college' },
            { q: "Quel est le féminin de « acteur » ?", correct: "actrice", wrongs: ["acteure", "actriz", "actoresse"], level: 'college' },
            { q: "Quel est le participe passé du verbe « prendre » ?", correct: "pris", wrongs: ["prendu", "pri", "prenu"], level: 'college' },
            { q: "Quel est le synonyme de « maison » ?", correct: "demeure", wrongs: ["jardin", "route", "forêt"], level: 'lycee' },
            { q: "Quelle est la nature du mot « et » ?", correct: "conjonction de coordination", wrongs: ["préposition", "adverbe", "interjection"], level: 'college' },
            { q: "Quel est l'antonyme de « lumière » ?", correct: "obscurité", wrongs: ["chaleur", "silence", "vide"], level: 'college' },
            { q: "Comment conjugue-t-on « être » à la 1ère personne du pluriel au présent ?", correct: "nous sommes", wrongs: ["nous êtes", "nous sont", "nous étions"], level: 'college' },
            { q: "Quel est le pluriel de « journal » ?", correct: "journaux", wrongs: ["journals", "journaus", "journales"], level: 'college' },
            { q: "Quel est le synonyme de « regarder » ?", correct: "observer", wrongs: ["écouter", "sentir", "toucher"], level: 'college' },
            { q: "Quelle est la nature du mot « bleu » dans « le ciel bleu » ?", correct: "adjectif", wrongs: ["nom", "adverbe", "verbe"], level: 'college' },
            { q: "Quel est l'antonyme de « facile » ?", correct: "difficile", wrongs: ["simple", "rapide", "clair"], level: 'college' },
            { q: "Quel est le participe passé du verbe « voir » ?", correct: "vu", wrongs: ["vis", "voyé", "veu"], level: 'college' },
            { q: "Comment écrit-on « ils mangent » au futur simple ?", correct: "ils mangeront", wrongs: ["ils mangerent", "ils mangaient", "ils mangeraient"], level: 'lycee' },
        ],
        histoire: [
            { q: "En quelle année a eu lieu la prise de la Bastille ?", correct: "1789", wrongs: ["1799", "1804", "1815"], level: 'college' },
            { q: "Qui était empereur des Français en 1810 ?", correct: "Napoléon Ier", wrongs: ["Louis XVI", "Charlemagne", "Napoléon III"], level: 'college' },
            { q: "En quelle année la Seconde Guerre mondiale s'est-elle terminée ?", correct: "1945", wrongs: ["1939", "1918", "1950"], level: 'college' },
            { q: "Quel roi est guillotiné en 1793 ?", correct: "Louis XVI", wrongs: ["Louis XIV", "Henri IV", "Louis XV"], level: 'college' },
            { q: "En quelle année le mur de Berlin est-il tombé ?", correct: "1989", wrongs: ["1991", "1975", "1961"], level: 'college' },
            { q: "Qui a été sacré empereur en l'an 800 ?", correct: "Charlemagne", wrongs: ["Clovis", "Napoléon", "Jules César"], level: 'college' },
            { q: "En quelle année a débuté la Première Guerre mondiale ?", correct: "1914", wrongs: ["1916", "1918", "1912"], level: 'college' },
            { q: "Quel traité met fin à la Première Guerre mondiale ?", correct: "le traité de Versailles", wrongs: ["le traité de Rome", "le traité de Vienne", "le traité de Nantes"], level: 'lycee' },
            { q: "En quelle année la France abolit-elle définitivement l'esclavage ?", correct: "1848", wrongs: ["1789", "1804", "1815"], level: 'lycee' },
            { q: "Qui était roi de France au moment de la Révolution de 1789 ?", correct: "Louis XVI", wrongs: ["Louis XV", "Louis XIV", "Charles X"], level: 'college' },
            { q: "En quelle année Christophe Colomb atteint-il l'Amérique ?", correct: "1492", wrongs: ["1500", "1450", "1520"], level: 'college' },
            { q: "Quel général devient Premier consul en 1799 ?", correct: "Napoléon Bonaparte", wrongs: ["Robespierre", "Danton", "Lafayette"], level: 'lycee' },
            { q: "En quelle année la France devient-elle une République pour la première fois ?", correct: "1792", wrongs: ["1789", "1804", "1848"], level: 'lycee' },
            { q: "Quel événement déclenche la Première Guerre mondiale ?", correct: "l'assassinat de l'archiduc François-Ferdinand", wrongs: ["la crise de 1929", "le traité de Versailles", "la révolution russe"], level: 'lycee' },
            { q: "En quelle année l'Algérie obtient-elle son indépendance ?", correct: "1962", wrongs: ["1954", "1958", "1970"], level: 'lycee' },
            { q: "Qui dirige la France libre pendant la Seconde Guerre mondiale ?", correct: "Charles de Gaulle", wrongs: ["Philippe Pétain", "Georges Clemenceau", "Jean Moulin"], level: 'college' },
            { q: "En quelle année a eu lieu le débarquement de Normandie ?", correct: "1944", wrongs: ["1943", "1945", "1942"], level: 'college' },
            { q: "Quelle réforme majeure Jules Ferry met-il en place dans les années 1880 ?", correct: "l'école gratuite, laïque et obligatoire", wrongs: ["le suffrage universel", "la sécurité sociale", "les congés payés"], level: 'lycee' },
            { q: "En quelle année les femmes obtiennent-elles le droit de vote en France ?", correct: "1944", wrongs: ["1918", "1958", "1936"], level: 'college' },
            { q: "Quel pharaon a fait construire la grande pyramide de Gizeh ?", correct: "Khéops", wrongs: ["Toutânkhamon", "Ramsès II", "Akhenaton"], level: 'college' },
        ],
        geo: [
            { q: "Quelle est la capitale de l'Espagne ?", correct: "Madrid", wrongs: ["Barcelone", "Lisbonne", "Séville"], level: 'college' },
            { q: "Quel est le plus long fleuve de France ?", correct: "la Loire", wrongs: ["la Seine", "le Rhône", "la Garonne"], level: 'college' },
            { q: "Quelle est la capitale de l'Italie ?", correct: "Rome", wrongs: ["Milan", "Naples", "Venise"], level: 'college' },
            { q: "Quel est le plus haut sommet d'Europe occidentale ?", correct: "le Mont Blanc", wrongs: ["le Cervin", "le Mont Rose", "l'Etna"], level: 'college' },
            { q: "Quelle est la capitale de l'Allemagne ?", correct: "Berlin", wrongs: ["Munich", "Hambourg", "Francfort"], level: 'college' },
            { q: "Quel océan borde la côte ouest de la France ?", correct: "l'océan Atlantique", wrongs: ["l'océan Pacifique", "la mer Méditerranée", "la mer du Nord"], level: 'college' },
            { q: "Quelle est la capitale du Japon ?", correct: "Tokyo", wrongs: ["Kyoto", "Osaka", "Séoul"], level: 'college' },
            { q: "Quel est le plus grand désert chaud du monde ?", correct: "le Sahara", wrongs: ["le désert de Gobi", "le Kalahari", "le désert d'Atacama"], level: 'college' },
            { q: "Quelle est la capitale du Canada ?", correct: "Ottawa", wrongs: ["Toronto", "Montréal", "Vancouver"], level: 'college' },
            { q: "Quel pays a la plus grande population du monde ?", correct: "l'Inde", wrongs: ["la Chine", "les États-Unis", "l'Indonésie"], level: 'lycee' },
            { q: "Quelle est la capitale du Portugal ?", correct: "Lisbonne", wrongs: ["Porto", "Madrid", "Séville"], level: 'college' },
            { q: "Quel est le plus grand pays du monde par la superficie ?", correct: "la Russie", wrongs: ["le Canada", "la Chine", "les États-Unis"], level: 'college' },
            { q: "Quelle chaîne de montagnes sépare traditionnellement l'Europe de l'Asie ?", correct: "l'Oural", wrongs: ["les Alpes", "les Carpates", "le Caucase"], level: 'lycee' },
            { q: "Quelle est la capitale de la Grèce ?", correct: "Athènes", wrongs: ["Thessalonique", "Sparte", "Corinthe"], level: 'college' },
            { q: "Quel est le plus grand océan du monde ?", correct: "l'océan Pacifique", wrongs: ["l'océan Atlantique", "l'océan Indien", "l'océan Arctique"], level: 'college' },
            { q: "Quelle est la capitale du Royaume-Uni ?", correct: "Londres", wrongs: ["Manchester", "Édimbourg", "Liverpool"], level: 'college' },
            { q: "Quel fleuve traverse l'Égypte ?", correct: "le Nil", wrongs: ["le Congo", "le Niger", "le Zambèze"], level: 'college' },
            { q: "Quelle est la capitale de la Belgique ?", correct: "Bruxelles", wrongs: ["Anvers", "Liège", "Gand"], level: 'college' },
            { q: "Quel continent est le plus peuplé ?", correct: "l'Asie", wrongs: ["l'Afrique", "l'Europe", "l'Amérique"], level: 'lycee' },
            { q: "Quelle est la capitale de la Suisse ?", correct: "Berne", wrongs: ["Genève", "Zurich", "Lausanne"], level: 'college' },
        ],
        svt: [
            { q: "Quel organe pompe le sang dans le corps humain ?", correct: "le cœur", wrongs: ["le foie", "le poumon", "le rein"], level: 'college' },
            { q: "Quel gaz les plantes rejettent-elles lors de la photosynthèse ?", correct: "l'oxygène", wrongs: ["le CO₂", "l'azote", "l'hydrogène"], level: 'college' },
            { q: "Combien de chromosomes possède une cellule humaine normale ?", correct: "46", wrongs: ["23", "44", "48"], level: 'lycee' },
            { q: "Quel organe filtre le sang pour produire l'urine ?", correct: "le rein", wrongs: ["le foie", "l'estomac", "le pancréas"], level: 'college' },
            { q: "Quelle est l'unité de base du vivant ?", correct: "la cellule", wrongs: ["l'atome", "le tissu", "l'organe"], level: 'college' },
            { q: "Quel type de dents sert à couper les aliments ?", correct: "les incisives", wrongs: ["les molaires", "les canines", "les prémolaires"], level: 'college' },
            { q: "Quel organe produit l'insuline ?", correct: "le pancréas", wrongs: ["le foie", "la rate", "la thyroïde"], level: 'lycee' },
            { q: "Quel gaz respirons-nous pour vivre ?", correct: "le dioxygène", wrongs: ["le dioxyde de carbone", "l'azote", "l'hydrogène"], level: 'college' },
            { q: "Quelle molécule porte l'information génétique ?", correct: "l'ADN", wrongs: ["l'ARN", "le glucose", "la protéine"], level: 'lycee' },
            { q: "Quel est le rôle des globules rouges ?", correct: "transporter l'oxygène", wrongs: ["combattre les infections", "coaguler le sang", "digérer les aliments"], level: 'college' },
            { q: "Quel organe est responsable de la respiration ?", correct: "les poumons", wrongs: ["le cœur", "le foie", "l'estomac"], level: 'college' },
            { q: "Quelle partie de la plante absorbe l'eau du sol ?", correct: "les racines", wrongs: ["les feuilles", "les fleurs", "les tiges"], level: 'college' },
            { q: "Combien de temps dure en moyenne une grossesse humaine ?", correct: "9 mois", wrongs: ["6 mois", "12 mois", "3 mois"], level: 'college' },
            { q: "Quel est le plus grand organe du corps humain ?", correct: "la peau", wrongs: ["le foie", "le cœur", "le cerveau"], level: 'college' },
            { q: "Quel processus permet aux plantes de produire leur propre nourriture ?", correct: "la photosynthèse", wrongs: ["la respiration", "la digestion", "la transpiration"], level: 'college' },
            { q: "Quel organe stocke la bile ?", correct: "la vésicule biliaire", wrongs: ["le pancréas", "la rate", "le rein"], level: 'lycee' },
            { q: "Combien de cavités possède le cœur humain ?", correct: "4", wrongs: ["2", "3", "6"], level: 'lycee' },
            { q: "Quel type d'organisme se nourrit uniquement de plantes ?", correct: "un herbivore", wrongs: ["un carnivore", "un omnivore", "un décomposeur"], level: 'college' },
            { q: "Quelle glande régule le métabolisme via des hormones ?", correct: "la thyroïde", wrongs: ["le pancréas", "la rate", "le thymus"], level: 'lycee' },
            { q: "Quel est le rôle des globules blancs ?", correct: "défendre l'organisme contre les infections", wrongs: ["transporter l'oxygène", "transporter les nutriments", "coaguler le sang"], level: 'college' },
        ],
        physique: [
            { q: "Quelle est l'unité de mesure de la force ?", correct: "le newton", wrongs: ["le joule", "le watt", "le pascal"], level: 'college' },
            { q: "Quel est le symbole chimique de l'or ?", correct: "Au", wrongs: ["Ag", "Fe", "Or"], level: 'college' },
            { q: "À quelle température l'eau bout-elle au niveau de la mer ?", correct: "100°C", wrongs: ["90°C", "120°C", "80°C"], level: 'college' },
            { q: "Quelle est l'unité de mesure de l'énergie ?", correct: "le joule", wrongs: ["le newton", "le volt", "l'ampère"], level: 'lycee' },
            { q: "Quel est le symbole chimique du fer ?", correct: "Fe", wrongs: ["Fr", "Fi", "F"], level: 'college' },
            { q: "Quelle particule porte une charge négative ?", correct: "l'électron", wrongs: ["le proton", "le neutron", "le photon"], level: 'lycee' },
            { q: "Quelle est l'unité de mesure de la puissance électrique ?", correct: "le watt", wrongs: ["le volt", "l'ampère", "l'ohm"], level: 'college' },
            { q: "Quel est le symbole chimique du sodium ?", correct: "Na", wrongs: ["So", "Sd", "S"], level: 'college' },
            { q: "Comment appelle-t-on le passage de l'état liquide à l'état gazeux ?", correct: "la vaporisation", wrongs: ["la fusion", "la solidification", "la condensation"], level: 'lycee' },
            { q: "Quelle est la vitesse de la lumière dans le vide (arrondie) ?", correct: "300 000 km/s", wrongs: ["150 000 km/s", "1 000 000 km/s", "30 000 km/s"], level: 'lycee' },
            { q: "Quel est le symbole chimique de l'oxygène ?", correct: "O", wrongs: ["Ox", "Og", "On"], level: 'college' },
            { q: "Quelle loi relie tension, intensité et résistance ?", correct: "la loi d'Ohm", wrongs: ["la loi de Newton", "la loi de Coulomb", "la loi de Joule"], level: 'lycee' },
            { q: "Quelle est l'unité de mesure de la masse dans le Système international ?", correct: "le kilogramme", wrongs: ["le gramme", "le newton", "le litre"], level: 'college' },
            { q: "Quel est le pH d'une solution neutre ?", correct: "7", wrongs: ["0", "14", "1"], level: 'lycee' },
            { q: "Comment appelle-t-on un mélange d'eau et d'huile ?", correct: "un mélange hétérogène", wrongs: ["un mélange homogène", "une solution", "un corps pur"], level: 'college' },
            { q: "Quelle est l'unité de mesure de la tension électrique ?", correct: "le volt", wrongs: ["l'ampère", "le watt", "l'ohm"], level: 'college' },
            { q: "Quel est le symbole chimique du carbone ?", correct: "C", wrongs: ["Ca", "Cb", "Co"], level: 'college' },
            { q: "Quelle force nous maintient au sol ?", correct: "la gravité", wrongs: ["le magnétisme", "la pression", "la friction"], level: 'college' },
            { q: "Combien d'états physiques principaux la matière possède-t-elle ?", correct: "3", wrongs: ["2", "4", "5"], level: 'college' },
            { q: "Quel est le symbole chimique de l'hydrogène ?", correct: "H", wrongs: ["He", "Hy", "Hg"], level: 'college' },
        ],
        techno: [
            { q: "Quel langage est principalement utilisé pour structurer une page web ?", correct: "HTML", wrongs: ["CSS", "Python", "SQL"], level: 'college' },
            { q: "Que désigne l'abréviation « CPU » ?", correct: "l'unité centrale de traitement", wrongs: ["la mémoire vive", "la carte graphique", "le disque dur"], level: 'college' },
            { q: "Quel composant stocke les données de façon permanente dans un ordinateur ?", correct: "le disque dur", wrongs: ["la RAM", "le processeur", "la carte mère"], level: 'college' },
            { q: "Quelle boucle répète des instructions tant qu'une condition est vraie ?", correct: "la boucle « tant que »", wrongs: ["la boucle « pour »", "la condition « si »", "la fonction"], level: 'lycee' },
            { q: "Quel matériau est souvent utilisé en impression 3D ?", correct: "le PLA", wrongs: ["le verre", "le béton", "le cuivre"], level: 'college' },
            { q: "Que mesure un capteur de température ?", correct: "la chaleur ambiante", wrongs: ["la lumière", "la pression", "le son"], level: 'college' },
            { q: "Quelle unité mesure la puissance d'un appareil électrique ?", correct: "le watt", wrongs: ["le volt", "l'ampère", "l'ohm"], level: 'college' },
            { q: "À quoi sert concrètement le Wi-Fi ?", correct: "une connexion réseau sans fil", wrongs: ["un câble réseau", "un type de processeur", "un logiciel antivirus"], level: 'college' },
            { q: "Quel composant limite le courant dans un circuit électronique ?", correct: "une résistance", wrongs: ["une LED", "un condensateur", "un transistor"], level: 'lycee' },
            { q: "Quel type d'énergie provient du soleil ?", correct: "l'énergie solaire", wrongs: ["l'énergie fossile", "l'énergie nucléaire", "l'énergie géothermique"], level: 'college' },
            { q: "Quel type de logiciel permet de modéliser un objet en 3D avant fabrication ?", correct: "un logiciel de CAO", wrongs: ["un tableur", "un navigateur web", "un antivirus"], level: 'lycee' },
            { q: "Quelle grandeur un ampèremètre mesure-t-il ?", correct: "l'intensité du courant", wrongs: ["la tension", "la puissance", "la résistance"], level: 'lycee' },
            { q: "Quel matériau conduit bien l'électricité ?", correct: "le cuivre", wrongs: ["le bois", "le plastique", "le verre"], level: 'college' },
            { q: "Que désigne « API » en informatique ?", correct: "une interface de programmation", wrongs: ["un type de processeur", "un langage de programmation", "un fichier image"], level: 'lycee' },
            { q: "Quel composant convertit l'énergie électrique en mouvement ?", correct: "un moteur", wrongs: ["une résistance", "une LED", "un capteur"], level: 'college' },
            { q: "Quelle est l'unité de la fréquence d'un processeur ?", correct: "le hertz", wrongs: ["le watt", "le bit", "l'octet"], level: 'lycee' },
            { q: "Quel type de mémoire perd ses données à l'extinction de l'ordinateur ?", correct: "la RAM", wrongs: ["le disque dur", "la mémoire flash", "le SSD"], level: 'lycee' },
            { q: "Quel outil permet d'assembler des composants électroniques par la chaleur ?", correct: "un fer à souder", wrongs: ["une perceuse", "une pince", "un tournevis"], level: 'college' },
            { q: "Quelle énergie renouvelable utilise le vent ?", correct: "l'énergie éolienne", wrongs: ["l'énergie solaire", "l'énergie hydraulique", "l'énergie fossile"], level: 'college' },
            { q: "Que désigne un « octet » en informatique ?", correct: "un groupe de 8 bits", wrongs: ["un groupe de 4 bits", "un groupe de 16 bits", "un groupe de 2 bits"], level: 'college' },
        ],
        anglais: [
            { q: "What is the English word for « chat » ?", correct: "cat", wrongs: ["dog", "bird", "fish"], level: 'college' },
            { q: "Complete: 'She ___ to school every day.'", correct: "goes", wrongs: ["go", "going", "gone"], level: 'college' },
            { q: "What does 'to look forward to' mean?", correct: "attendre avec impatience", wrongs: ["regarder devant soi", "chercher quelque chose", "reculer"], level: 'lycee' },
            { q: "What is the plural of 'child'?", correct: "children", wrongs: ["childs", "childes", "childrens"], level: 'college' },
            { q: "Complete: 'I ___ never been to Paris.'", correct: "have", wrongs: ["has", "had", "having"], level: 'lycee' },
            { q: "What is the English word for « pomme » ?", correct: "apple", wrongs: ["orange", "banana", "grape"], level: 'college' },
            { q: "Choose the correct comparative: 'This is ___ than that.'", correct: "better", wrongs: ["gooder", "more good", "best"], level: 'college' },
            { q: "What is the past tense of 'go'?", correct: "went", wrongs: ["goed", "gone", "going"], level: 'college' },
            { q: "What does 'exhausted' mean?", correct: "épuisé", wrongs: ["content", "en colère", "confus"], level: 'lycee' },
            { q: "Complete: 'They ___ watching TV right now.'", correct: "are", wrongs: ["is", "am", "be"], level: 'college' },
            { q: "What is the English word for « fenêtre » ?", correct: "window", wrongs: ["door", "wall", "roof"], level: 'college' },
            { q: "Which modal expresses obligation?", correct: "must", wrongs: ["might", "could", "would"], level: 'lycee' },
            { q: "What is the opposite of 'fast'?", correct: "slow", wrongs: ["quick", "big", "loud"], level: 'college' },
            { q: "Complete: 'If it rains, I ___ stay home.'", correct: "will", wrongs: ["would", "was", "did"], level: 'lycee' },
            { q: "What does 'to give up' mean?", correct: "abandonner", wrongs: ["donner", "continuer", "gagner"], level: 'lycee' },
            { q: "What is the English word for « voiture » ?", correct: "car", wrongs: ["bike", "train", "boat"], level: 'college' },
            { q: "Choose the correct form: 'Yesterday, she ___ (watch) a film.'", correct: "watched", wrongs: ["watch", "watching", "watches"], level: 'college' },
            { q: "What is the superlative of 'good'?", correct: "the best", wrongs: ["the better", "the goodest", "the most good"], level: 'college' },
            { q: "What does 'a piece of cake' mean idiomatically?", correct: "quelque chose de très facile", wrongs: ["un dessert", "quelque chose de difficile", "une surprise"], level: 'lycee' },
            { q: "Complete: 'There ___ many books on the shelf.'", correct: "are", wrongs: ["is", "was", "be"], level: 'college' },
        ],
        emc: [
            { q: "Quel âge faut-il avoir pour voter en France ?", correct: "18 ans", wrongs: ["16 ans", "21 ans", "25 ans"], level: 'college' },
            { q: "Quelle est la devise de la France ?", correct: "Liberté, Égalité, Fraternité", wrongs: ["Unité, Travail, Progrès", "Ordre et Progrès", "Dieu et mon droit"], level: 'college' },
            { q: "Qui est élu au suffrage universel direct en France ?", correct: "le Président de la République", wrongs: ["le Premier ministre", "les préfets", "les juges"], level: 'college' },
            { q: "Que signifie « laïcité » ?", correct: "la séparation entre l'État et les religions", wrongs: ["l'obligation de pratiquer une religion", "l'interdiction de toute religion", "la religion d'État"], level: 'lycee' },
            { q: "Combien de pouvoirs distincts compose la séparation des pouvoirs ?", correct: "3", wrongs: ["2", "4", "5"], level: 'lycee' },
            { q: "Quel document proclame les droits fondamentaux en 1789 ?", correct: "la Déclaration des droits de l'homme et du citoyen", wrongs: ["la Constitution de 1958", "le Code civil", "la Charte de l'environnement"], level: 'lycee' },
            { q: "Qui vote les lois en France ?", correct: "le Parlement", wrongs: ["le Président seul", "le Conseil constitutionnel", "le gouvernement seul"], level: 'lycee' },
            { q: "Quel principe garantit qu'on est innocent jusqu'à preuve du contraire ?", correct: "la présomption d'innocence", wrongs: ["la légitime défense", "la prescription", "le droit de grève"], level: 'lycee' },
            { q: "Quelle institution veille au respect de la Constitution ?", correct: "le Conseil constitutionnel", wrongs: ["le Sénat", "la Cour des comptes", "la Mairie"], level: 'lycee' },
            { q: "Quel est le rôle du Premier ministre en France ?", correct: "diriger le gouvernement", wrongs: ["représenter la France à l'étranger", "juger les criminels", "voter le budget seul"], level: 'lycee' },
            { q: "En quelle année le droit de vote des femmes est-il instauré en France ?", correct: "1944", wrongs: ["1918", "1958", "1981"], level: 'college' },
            { q: "Quel symbole représente la République française ?", correct: "Marianne", wrongs: ["le coq (officieux)", "la tour Eiffel", "le drapeau seul"], level: 'college' },
            { q: "Que garantit la liberté d'expression ?", correct: "le droit d'exprimer ses opinions", wrongs: ["le droit de tout dire sans limite", "le droit de vote", "le droit à la propriété"], level: 'college' },
            { q: "Quelle charte protège l'environnement dans la Constitution française ?", correct: "la Charte de l'environnement", wrongs: ["la Déclaration de 1789", "le Code civil", "la loi de 1905"], level: 'lycee' },
            { q: "Environ combien de sénateurs compte le Sénat français ?", correct: "environ 350", wrongs: ["environ 100", "environ 577", "environ 900"], level: 'lycee' },
            { q: "Quel âge faut-il pour être candidat à l'élection présidentielle en France ?", correct: "18 ans", wrongs: ["23 ans", "30 ans", "35 ans"], level: 'lycee' },
            { q: "Quelle loi de 1905 instaure la séparation des Églises et de l'État ?", correct: "la loi de séparation des Églises et de l'État", wrongs: ["la loi Jules Ferry", "la loi sur la presse", "le Code civil"], level: 'lycee' },
            { q: "Qui compose l'Assemblée nationale ?", correct: "des députés élus", wrongs: ["des sénateurs élus", "des ministres nommés", "des juges"], level: 'lycee' },
            { q: "Quel principe interdit de discriminer selon l'origine, le sexe ou la religion ?", correct: "le principe d'égalité", wrongs: ["le principe de laïcité", "le principe de fraternité", "le principe de souveraineté"], level: 'college' },
            { q: "Combien de temps dure un mandat présidentiel en France depuis 2000 ?", correct: "5 ans", wrongs: ["7 ans", "4 ans", "6 ans"], level: 'college' },
        ],
        chimie: [
            { q: "Quelle est la formule chimique de l'eau ?", correct: "H₂O", wrongs: ["CO₂", "O₂", "NaCl"], level: 'college' },
            { q: "Quel est le symbole chimique du cuivre ?", correct: "Cu", wrongs: ["C", "Co", "Cv"], level: 'college' },
            { q: "Combien d'atomes contient une molécule de méthane (CH₄) ?", correct: "5", wrongs: ["4", "2", "1"], level: 'college' },
            { q: "Que se produit-il quand on mélange du vinaigre et du bicarbonate de soude ?", correct: "un dégagement de gaz (CO₂)", wrongs: ["une explosion", "un métal liquide", "rien du tout"], level: 'college' },
            { q: "Quel gaz entretient la combustion ?", correct: "le dioxygène", wrongs: ["l'azote", "le dioxyde de carbone", "l'hélium"], level: 'college' },
            { q: "Le fer rouille au contact de quoi ?", correct: "de l'oxygène et de l'eau", wrongs: ["du seul azote", "du dioxyde de carbone sec", "du sel seul"], level: 'college' },
            { q: "Quelle couleur prend le tournesol (indicateur) dans un acide ?", correct: "rouge", wrongs: ["bleu", "vert", "jaune"], level: 'college' },
            { q: "Comment appelle-t-on un corps qui ne peut pas être décomposé par une réaction chimique ?", correct: "un élément chimique", wrongs: ["un mélange", "un composé", "une solution"], level: 'college' },
            { q: "Dans quel état se trouve le mercure à température ambiante ?", correct: "liquide", wrongs: ["solide", "gazeux", "plasma"], level: 'college' },
            { q: "À quelle famille appartiennent l'hélium et le néon ?", correct: "les gaz rares (gaz nobles)", wrongs: ["les halogènes", "les métaux alcalins", "les métalloïdes"], level: 'college' },
            { q: "Quelle est l'unité de la quantité de matière en chimie ?", correct: "la mole", wrongs: ["le gramme", "le litre", "le newton"], level: 'lycee' },
            { q: "Combien d'entités contient une mole (nombre d'Avogadro) ?", correct: "environ 6,02 × 10²³", wrongs: ["environ 6,02 × 10²⁶", "exactement 1 000", "environ 3,14 × 10²³"], level: 'lycee' },
            { q: "Que dit la loi de conservation de la masse (Lavoisier) ?", correct: "la masse des réactifs égale celle des produits", wrongs: ["la masse augmente toujours", "la masse diminue toujours", "la masse dépend du volume"], level: 'lycee' },
            { q: "Un atome devient un ion négatif (anion) quand il...…", correct: "gagne des électrons", wrongs: ["perd des électrons", "gagne des protons", "perd des neutrons"], level: 'lycee' },
            { q: "Qu'est-ce qu'un catalyseur ?", correct: "une substance qui accélère une réaction sans être consommée", wrongs: ["une substance consommée par la réaction", "un produit de la réaction", "un réactif lent"], level: 'lycee' },
            { q: "Que caractérise une réaction exothermique ?", correct: "elle dégage de la chaleur", wrongs: ["elle absorbe de la chaleur", "elle émet uniquement de la lumière", "elle ne produit aucun changement"], level: 'lycee' },
            { q: "Un pH supérieur à 7 indique une solution...…", correct: "basique", wrongs: ["acide", "neutre", "saturée"], level: 'lycee' },
            { q: "Quelle est la masse molaire de l'eau (H₂O), en g/mol ?", correct: "18", wrongs: ["10", "36", "22"], level: 'lycee' },
            { q: "Que forment généralement un métal et un non-métal en réagissant ?", correct: "un composé ionique (sel)", wrongs: ["un gaz noble", "un alliage", "une molécule organique"], level: 'lycee' },
            { q: "Quelle technique sépare les constituants d'un mélange selon leur affinité avec un solvant ?", correct: "la chromatographie", wrongs: ["la distillation", "la centrifugation", "la décantation simple"], level: 'lycee' },
        ],
    };

    function generateBankLesson(subjectId, index, band) {
        const fullBank = FACT_BANKS[subjectId];
        const filtered = fullBank.filter(f => f.level === band);
        // Repli sur la banque complète si le filtre est trop restrictif
        // (ne devrait pas arriver ici vu la taille des banques, mais évite
        // un crash si jamais une matière avait très peu de contenu lycée).
        const bank = filtered.length >= 5 ? filtered : fullBank;
        const rng = seededRng(hashSeed(subjectId + ':' + band + ':' + index));
        const fact = bank[index % bank.length];
        const opts0 = [fact.correct, ...fact.wrongs];
        const { opts, correct } = shuffleOptions(opts0, 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: fact.q,
            opts,
            correct,
            exp: `Réponse : ${fact.correct}.`,
        };
    }

    /* ================= API publique ================= */

    return {
        bandForNiveau,
        /**
         * Étend une matière (objet DASH_SUBJECTS) jusqu'à `totalCount` niveaux,
         * avec un contenu adapté à `niveauBand` ('college' ou 'lycee') pour
         * les niveaux générés (6 à `totalCount`). Les leçons déjà présentes
         * (écrites à la main) sont conservées et ré-ordonnées (QCM uniquement).
         */
        extend(subject, totalCount, niveauBand) {
            const band = niveauBand === 'lycee' ? 'lycee' : 'college';
            const handWritten = subject.lessons.map((lesson, i) => reshuffleHandWritten(lesson, subject.id, i));
            const lessons = handWritten.slice();
            for (let i = lessons.length; i < totalCount; i++) {
                lessons.push(subject.id === 'maths' ? generateMathLesson(i, band) : generateBankLesson(subject.id, i, band));
            }
            return { ...subject, lessons };
        },
        /**
         * Génère UNE seule leçon (pas toute la matière) pour `index` donné.
         * Utilisé comme repli hors-ligne par ai-provider.js quand l'agent IA
         * (Make) est injoignable — voir MAKE_BLUEPRINT.md.
         */
        generateOne(subjectId, index, niveauBand) {
            const band = niveauBand === 'lycee' ? 'lycee' : 'college';
            return subjectId === 'maths' ? generateMathLesson(index, band) : generateBankLesson(subjectId, index, band);
        },
    };
})();

if (typeof window !== 'undefined') {
    window.QuestionBank = QuestionBank;
}

