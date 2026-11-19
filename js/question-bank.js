/* =============================================================================
   QUESTION-BANK.JS — EDUQUEST v1.26.0
   Banque de questions et générateur procédural adaptés par NIVEAU SCOLAIRE :
   - 6ème, 5ème, 4ème, 3ème (Collège)
   - 2nde, 1ère, Terminale (Lycée)

   RÉSOLUTIONS & AMÉLIORATIONS MAJEURES (v3.0) :
   1. Résolution définitive du "manque de questions" sur 100 niveaux :
      - Intégration de générateurs procéduraux avancés pour chaque matière
        (Maths, Français, Anglais, Géographie, Physique, Chimie, Technologie).
      - Enrichissement massif des banques de questions (>450 questions ciblées).
   2. Différenciation stricte par classe (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale) :
      - Chaque niveau scolaire reçoit des questions conformes aux programmes officiels.
   3. Variété multi-types de questions :
      - QCM (4 choix avec mélange déterministe), Vrai/Faux, Réponse courte.
   4. Absence de répétition consécutive grâce au brassage déterministe par graine.
   ============================================================================= */

const QuestionBank = (() => {

    /* ================= PRNG déterministe (mulberry32) ================= */

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

    /** Normalise l'identifiant du niveau scolaire. */
    function normalizeNiveau(n) {
        const str = String(n || '').toLowerCase().trim();
        if (str === '6' || str.startsWith('6')) return '6eme';
        if (str === '5' || str.startsWith('5')) return '5eme';
        if (str === '4' || str.startsWith('4')) return '4eme';
        if (str === '3' || str.startsWith('3')) return '3eme';
        if (str === '2' || str.startsWith('2') || str.includes('sec')) return '2nde';
        if (str === '1' || str.startsWith('1') || str.includes('prem')) return '1ere';
        if (str.includes('term') || str === 'tle') return 'terminale';
        if (str === 'lycee') return '2nde';
        return '6eme';
    }

    /** Détermine la bande générale (collège / lycée). */
    function bandForNiveau(niveau) {
        const norm = normalizeNiveau(niveau);
        const lyceeGrades = ['2nde', '1ere', 'terminale'];
        return lyceeGrades.includes(norm) ? 'lycee' : 'college';
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

    /** Ré-ordonne de façon déterministe les options des leçons écrites en dur. */
    function reshuffleHandWritten(lesson, subjectId, index) {
        if (lesson.type !== 'qcm' && lesson.type) return lesson;
        if (!lesson.opts) return lesson;
        const rng = seededRng(hashSeed(subjectId + ':fixed:' + index));
        const { opts, correct } = shuffleOptions(lesson.opts, lesson.correct, rng);
        return { ...lesson, opts, correct };
    }

    function uniqueWrongs(correct, candidates, allowNegative) {
        const seen = new Set([correct]);
        const result = [];
        for (const c of candidates) {
            const n = Math.round(c);
            if (Number.isFinite(n) && !seen.has(n) && (allowNegative || n >= 0)) { seen.add(n); result.push(n); }
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

    /** Garantit 3 distracteurs textuels uniques et distincts de la bonne réponse. */
    function uniqueStringWrongs(correctStr, candidates, fallbackPool) {
        const normKey = (s) => String(s ?? '').trim().toLowerCase();
        const seen = new Set([normKey(correctStr)]);
        const result = [];
        const add = (val) => {
            const s = String(val ?? '').trim();
            if (!s) return;
            const k = normKey(s);
            if (!seen.has(k)) {
                seen.add(k);
                result.push(s);
            }
        };
        (candidates || []).forEach(c => { if (result.length < 3) add(c); });
        (fallbackPool || []).forEach(c => { if (result.length < 3) add(c); });
        let idx = 1;
        while (result.length < 3) {
            add('Autre réponse ' + (idx++));
        }
        return result.slice(0, 3);
    }

    /** Mélange déterministe (Fisher-Yates) d'une liste pour tirage sans répétition. */
    function seededShuffle(arr, seedStr) {
        const out = arr.slice();
        const rng = seededRng(hashSeed(seedStr));
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /* ================= 1. Générateurs procéduraux ================= */

    /** Générateur procédural pour les mathématiques */
    function generateMathLesson(index, niveau, variant = 0) {
        const norm = normalizeNiveau(niveau);
        const rng = seededRng(hashSeed('maths:' + norm + ':' + index + ':v' + variant));
        let q = '', correct = 0, wrongCandidates = [], allowNegative = false, exp = '';

        if (norm === '6eme') {
            const kinds = ['add', 'sub', 'mul', 'div', 'fraction_part', 'perimetre', 'aire_rect', 'conversion_m'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            switch (kind) {
                case 'add': {
                    const a = 12 + Math.floor(rng() * 85), b = 14 + Math.floor(rng() * 85);
                    correct = a + b;
                    q = `Combien font ${a} + ${b} ?`;
                    wrongCandidates = [correct + 10, correct - 10, correct + 1, correct - 1];
                    exp = `${a} + ${b} = ${correct}.`;
                    break;
                }
                case 'sub': {
                    const a = 35 + Math.floor(rng() * 65), b = 10 + Math.floor(rng() * (a - 15));
                    correct = a - b;
                    q = `Combien font ${a} - ${b} ?`;
                    wrongCandidates = [correct + 10, correct - 10, correct + 2, correct - 2];
                    exp = `${a} - ${b} = ${correct}.`;
                    break;
                }
                case 'mul': {
                    const a = 3 + Math.floor(rng() * 8), b = 4 + Math.floor(rng() * 8);
                    correct = a * b;
                    q = `Combien font ${a} × ${b} ?`;
                    wrongCandidates = [correct + a, correct - b, correct + 2, correct + 4];
                    exp = `${a} × ${b} = ${correct}.`;
                    break;
                }
                case 'div': {
                    const b = 3 + Math.floor(rng() * 7);
                    correct = 3 + Math.floor(rng() * 8);
                    const a = b * correct;
                    q = `Combien font ${a} ÷ ${b} ?`;
                    wrongCandidates = [correct + 1, correct - 1, correct + 2, correct - 2];
                    exp = `${a} ÷ ${b} = ${correct}.`;
                    break;
                }
                case 'fraction_part': {
                    const base = (2 + Math.floor(rng() * 10)) * 4;
                    correct = base / 4;
                    q = `Combien vaut le quart de ${base} (1/4 de ${base}) ?`;
                    wrongCandidates = [correct * 2, correct + 2, correct - 1, correct + 4];
                    exp = `Le quart de ${base} est ${base} ÷ 4 = ${correct}.`;
                    break;
                }
                case 'perimetre': {
                    const l = 4 + Math.floor(rng() * 7), L = l + 2 + Math.floor(rng() * 6);
                    correct = 2 * (L + l);
                    q = `Quel est le périmètre d'un rectangle de longueur ${L} cm et de largeur ${l} cm ?`;
                    wrongCandidates = [L * l, L + l, correct + 2, correct - 4];
                    exp = `Périmètre = 2 × (${L} + ${l}) = 2 × ${L + l} = ${correct} cm.`;
                    break;
                }
                case 'aire_rect': {
                    const l = 3 + Math.floor(rng() * 6), L = l + 2 + Math.floor(rng() * 5);
                    correct = L * l;
                    q = `Quelle est l'aire d'un rectangle de longueur ${L} cm et de largeur ${l} cm ?`;
                    wrongCandidates = [2 * (L + l), correct + 4, correct - 3, (L + l)];
                    exp = `Aire = Longueur × largeur = ${L} × ${l} = ${correct} cm².`;
                    break;
                }
                case 'conversion_m': {
                    const m = 2 + Math.floor(rng() * 8);
                    correct = m * 100;
                    q = `Combien de centimètres y a-t-il dans ${m} mètres ?`;
                    wrongCandidates = [m * 10, m * 1000, correct + 50, correct - 50];
                    exp = `1 mètre = 100 centimètres, donc ${m} m = ${correct} cm.`;
                    break;
                }
            }
        } else if (norm === '5eme') {
            const kinds = ['relatifs_add', 'relatifs_sub', 'priorites', 'fraction_same', 'aire_triangle', 'angle_triangle', 'symetrie'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'relatifs_add': {
                    const a = -12 + Math.floor(rng() * 10);
                    const b = 4 + Math.floor(rng() * 14);
                    correct = a + b;
                    q = `Calcule : (${a}) + (${b})`;
                    wrongCandidates = [-(a + b), a - b, correct + 1, correct - 2];
                    exp = `(${a}) + (${b}) = ${correct}.`;
                    break;
                }
                case 'relatifs_sub': {
                    const a = 2 + Math.floor(rng() * 10);
                    const b = 5 + Math.floor(rng() * 12);
                    correct = a - b;
                    q = `Calcule : ${a} - ${b}`;
                    wrongCandidates = [b - a, -(a + b), correct + 1, correct - 1];
                    exp = `${a} - ${b} = ${correct}.`;
                    break;
                }
                case 'priorites': {
                    const a = 3 + Math.floor(rng() * 6), b = 2 + Math.floor(rng() * 5), c = 3 + Math.floor(rng() * 6);
                    correct = a + b * c;
                    q = `Calcule avec les priorités : ${a} + ${b} × ${c}`;
                    wrongCandidates = [(a + b) * c, a + b + c, correct - b, correct + 2];
                    exp = `La multiplication est prioritaire : ${b} × ${c} = ${b * c}, puis ${a} + ${b * c} = ${correct}.`;
                    break;
                }
                case 'fraction_same': {
                    const denom = 7 + Math.floor(rng() * 6);
                    const a = 1 + Math.floor(rng() * 3), b = 2 + Math.floor(rng() * 3);
                    correct = a + b;
                    q = `Calcule le numérateur de : ${a}/${denom} + ${b}/${denom} = ?/${denom}`;
                    wrongCandidates = [a * b, correct + 1, correct - 1, denom];
                    exp = `Même dénominateur : on additionne les numérateurs ${a} + ${b} = ${correct}/${denom}.`;
                    break;
                }
                case 'aire_triangle': {
                    const b = (2 + Math.floor(rng() * 5)) * 2, h = 3 + Math.floor(rng() * 6);
                    correct = (b * h) / 2;
                    q = `Quelle est l'aire d'un triangle de base ${b} cm et de hauteur ${h} cm ?`;
                    wrongCandidates = [b * h, b + h, correct + 4, correct - 2];
                    exp = `Aire du triangle = (base × hauteur) ÷ 2 = (${b} × ${h}) ÷ 2 = ${correct} cm².`;
                    break;
                }
                case 'angle_triangle': {
                    const a1 = 35 + Math.floor(rng() * 35), a2 = 40 + Math.floor(rng() * 35);
                    correct = 180 - a1 - a2;
                    q = `Dans un triangle, deux angles mesurent ${a1}° et ${a2}°. Combien mesure le troisième angle ?`;
                    wrongCandidates = [correct + 10, correct - 10, 90, 180 - a1];
                    exp = `La somme des angles d'un triangle vaut 180° : 180 - ${a1} - ${a2} = ${correct}°.`;
                    break;
                }
                case 'symetrie': {
                    correct = 180;
                    q = `La symétrie centrale par rapport à un point O correspond à un demi-tour, soit une rotation de combien de degrés ?`;
                    wrongCandidates = [90, 360, 45];
                    exp = `Un demi-tour complet équivaut à un angle de 180°.`;
                    break;
                }
            }
        } else if (norm === '4eme') {
            const kinds = ['puissances', 'relatifs_mul', 'pythagore', 'distributivite', 'racine_carree', 'vitesse', 'cosinus'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'puissances': {
                    const b = 2 + Math.floor(rng() * 3), expVal = 3 + Math.floor(rng() * 2);
                    correct = Math.pow(b, expVal);
                    q = `Combien font ${b}^${expVal} (${b} puissance ${expVal}) ?`;
                    wrongCandidates = [b * expVal, correct + b, correct - b, Math.pow(expVal, b)];
                    exp = `${b}^${expVal} = ${correct}.`;
                    break;
                }
                case 'relatifs_mul': {
                    const a = -(3 + Math.floor(rng() * 6)), b = -(4 + Math.floor(rng() * 6));
                    correct = a * b;
                    q = `Calcule le produit : (${a}) × (${b})`;
                    wrongCandidates = [-correct, correct + 5, -correct - 5, a + b];
                    exp = `Moins par moins donne plus : (${a}) × (${b}) = ${correct}.`;
                    break;
                }
                case 'pythagore': {
                    const triplets = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
                    const trip = triplets[Math.floor(rng() * triplets.length)];
                    correct = trip[2];
                    q = `Dans un triangle rectangle dont les côtés de l'angle droit mesurent ${trip[0]} cm et ${trip[1]} cm, que vaut l'hypoténuse ?`;
                    wrongCandidates = [trip[0] + trip[1], correct + 1, correct - 1, correct + 3];
                    exp = `D'après Pythagore : hypoténuse² = ${trip[0]}² + ${trip[1]}² = ${trip[2] * trip[2]}, donc hypoténuse = ${correct} cm.`;
                    break;
                }
                case 'distributivite': {
                    const k = 3 + Math.floor(rng() * 6), b = 2 + Math.floor(rng() * 7);
                    correct = k * b;
                    q = `Développe : ${k}(x + ${b}). Quel est le terme constant (le nombre seul) ?`;
                    wrongCandidates = [b, k + b, correct + k, correct - 1];
                    exp = `${k}(x + ${b}) = ${k}x + ${correct}.`;
                    break;
                }
                case 'racine_carree': {
                    const n = 6 + Math.floor(rng() * 9);
                    correct = n;
                    q = `Quelle est la racine carrée de ${n * n} (√${n * n}) ?`;
                    wrongCandidates = [correct + 1, correct - 1, correct + 2, Math.floor((n * n) / 2)];
                    exp = `√${n * n} = ${correct} car ${correct}² = ${n * n}.`;
                    break;
                }
                case 'vitesse': {
                    const v = (5 + Math.floor(rng() * 6)) * 10, t = 2 + Math.floor(rng() * 3);
                    correct = v * t;
                    q = `Une voiture roule à ${v} km/h pendant ${t} heures. Quelle distance parcourt-elle en km ?`;
                    wrongCandidates = [correct + v, correct - v, v + t, Math.round(v / t)];
                    exp = `Distance = vitesse × temps = ${v} × ${t} = ${correct} km.`;
                    break;
                }
                case 'cosinus': {
                    correct = 60;
                    q = `Dans un triangle rectangle, quel angle aigu a pour cosinus exactement 0,5 ?`;
                    wrongCandidates = [30, 45, 90];
                    exp = `cos(60°) = 0,5 (ou 1/2).`;
                    break;
                }
            }
        } else if (norm === '3eme') {
            const kinds = ['equation', 'pourcentage', 'probabilites', 'developpement', 'thales', 'fonction_affine', 'arithmetique'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'equation': {
                    const a = 2 + Math.floor(rng() * 5), sol = 2 + Math.floor(rng() * 9), b = 3 + Math.floor(rng() * 15);
                    const c = a * sol + b;
                    correct = sol;
                    q = `Résous l'équation : ${a}x + ${b} = ${c}. Que vaut x ?`;
                    wrongCandidates = [sol + 1, sol - 1, sol + 2, sol * 2];
                    exp = `${a}x = ${c} - ${b} = ${a * sol}, donc x = ${sol}.`;
                    break;
                }
                case 'pourcentage': {
                    const prix = (4 + Math.floor(rng() * 14)) * 10;
                    const remisePct = [10, 20, 25, 30, 50][Math.floor(rng() * 5)];
                    const remise = Math.round(prix * remisePct / 100);
                    correct = prix - remise;
                    q = `Un article coûte ${prix} €. Avec une remise de ${remisePct} %, quel est son nouveau prix ?`;
                    wrongCandidates = [prix - remisePct, correct + 10, correct - 10, remise];
                    exp = `Remise de ${remisePct} % = ${remise} €. Prix final = ${prix} - ${remise} = ${correct} €.`;
                    break;
                }
                case 'probabilites': {
                    const cases = [
                        { label: 'obtenir un nombre pair sur un dé à 6 faces', good: 3, detail: '2, 4 et 6 (3 issues)' },
                        { label: 'obtenir un multiple de 3 sur un dé à 6 faces', good: 2, detail: '3 et 6 (2 issues)' },
                        { label: 'obtenir un nombre supérieur ou égal à 3 sur un dé à 6 faces', good: 4, detail: '3, 4, 5 et 6 (4 issues)' },
                        { label: 'obtenir un nombre strictement inférieur à 6 sur un dé à 6 faces', good: 5, detail: '1, 2, 3, 4 et 5 (5 issues)' },
                        { label: 'obtenir un diviseur de 6 sur un dé à 6 faces', good: 4, detail: '1, 2, 3 et 6 (4 issues)' },
                    ];
                    const item = cases[Math.floor(rng() * cases.length)];
                    correct = item.good;
                    q = `On lance un dé équilibré à 6 faces. Combien y a-t-il d'issues favorables pour l'événement « ${item.label} » ?`;
                    wrongCandidates = [1, 2, 3, 4, 5, 6].filter(n => n !== correct);
                    exp = `Issues favorables : ${item.detail} sur 6.`;
                    break;
                }
                case 'developpement': {
                    const a = 2 + Math.floor(rng() * 8);
                    correct = a * a;
                    q = `Dans l'identité remarquable (x + ${a})² = x² + ${2 * a}x + a², quel est le terme constant a² ?`;
                    wrongCandidates = [a * 2, correct + 2, correct - 2, a];
                    exp = `(x + ${a})² = x² + ${2 * a}x + ${correct}.`;
                    break;
                }
                case 'thales': {
                    const k = 2 + Math.floor(rng() * 4);
                    const am = 2 + Math.floor(rng() * 4);
                    const an = 2 + Math.floor(rng() * 5);
                    const ab = am * k;
                    const ac = an * k;
                    correct = an;
                    q = `Thalès : AM/AB = AN/AC. Si AM = ${am}, AB = ${ab} et AC = ${ac}, que vaut AN ?`;
                    wrongCandidates = [an + 1, an - 1, an * 2, Math.max(1, ab - am)];
                    exp = `AN = (AM × AC) ÷ AB = (${am} × ${ac}) ÷ ${ab} = ${correct}.`;
                    break;
                }
                case 'fonction_affine': {
                    const a = 2 + Math.floor(rng() * 5), b = 1 + Math.floor(rng() * 8), xVal = 2 + Math.floor(rng() * 6);
                    correct = a * xVal + b;
                    q = `Soit la fonction f(x) = ${a}x + ${b}. Calcule l'image f(${xVal}).`;
                    wrongCandidates = [correct + a, correct - a, a + b + xVal, correct + 1];
                    exp = `f(${xVal}) = ${a} × ${xVal} + ${b} = ${correct}.`;
                    break;
                }
                case 'arithmetique': {
                    const primes = [11, 13, 17, 19, 23, 29, 31, 37];
                    const composites = [9, 15, 21, 25, 27, 33, 35, 39];
                    const pIdx = Math.floor(rng() * primes.length);
                    correct = primes[pIdx];
                    q = `Parmi les nombres suivants, lequel est un nombre premier ?`;
                    wrongCandidates = [composites[pIdx % composites.length], composites[(pIdx + 2) % composites.length], composites[(pIdx + 4) % composites.length]];
                    exp = `${correct} n'a que deux diviseurs positifs : 1 et lui-même.`;
                    break;
                }
            }
        } else if (norm === '2nde') {
            const kinds = ['fonction_image', 'evolution_taux', 'equation_produit', 'milieu_coord', 'simplif_racine', 'vecteur_coord', 'inequation'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'fonction_image': {
                    const a = 1 + Math.floor(rng() * 4);
                    const xVal = 2 + Math.floor(rng() * 4);
                    const c = 1 + Math.floor(rng() * 9);
                    correct = a * xVal * xVal - c;
                    q = `Soit f(x) = ${a === 1 ? '' : a}x² - ${c}. Quelle est l'image de ${xVal} par f ?`;
                    wrongCandidates = [correct + 2, correct - 2, a * xVal - c, a * xVal * xVal + c];
                    exp = `f(${xVal}) = ${a} × (${xVal})² - ${c} = ${a * xVal * xVal} - ${c} = ${correct}.`;
                    break;
                }
                case 'evolution_taux': {
                    const pct = [10, 15, 20, 25, 30, 40][Math.floor(rng() * 6)];
                    const isDrop = (index + variant) % 2 === 1;
                    correct = isDrop ? (100 - pct) : (100 + pct);
                    q = isDrop
                        ? `Une grandeur diminue de ${pct} %. Quel pourcentage de la valeur initiale représente-t-elle désormais ?`
                        : `Une grandeur augmente de ${pct} %. Quel pourcentage de la valeur initiale représente-t-elle désormais ?`;
                    wrongCandidates = [isDrop ? 100 + pct : 100 - pct, pct, correct + 10, correct - 5];
                    exp = isDrop
                        ? `Une baisse de ${pct} % correspond à 100 % - ${pct} % = ${correct} %.`
                        : `Une hausse de ${pct} % correspond à 100 % + ${pct} % = ${correct} %.`;
                    break;
                }
                case 'equation_produit': {
                    const x1 = 2 + Math.floor(rng() * 8);
                    const k = 2 + Math.floor(rng() * 4);
                    correct = x1;
                    q = `Résous l'équation produit-nul : (x - ${x1})(${k}x + ${k * 3}) = 0. Quelle est la solution positive ?`;
                    wrongCandidates = [-x1, x1 + 1, x1 - 1, x1 * 2];
                    exp = `Un produit est nul si l'un de ses facteurs est nul : x - ${x1} = 0 donne x = ${x1} (l'autre solution est -3).`;
                    break;
                }
                case 'milieu_coord': {
                    const xA = -4 + Math.floor(rng() * 8);
                    const delta = (2 + Math.floor(rng() * 6)) * 2;
                    const xB = xA + delta;
                    correct = (xA + xB) / 2;
                    q = `Si A a pour abscisse ${xA} et B a pour abscisse ${xB}, quelle est l'abscisse du milieu de [AB] ?`;
                    wrongCandidates = [xB - xA, correct + 1, correct - 1, xA + xB];
                    exp = `Milieu = (${xA} + ${xB}) ÷ 2 = ${correct}.`;
                    break;
                }
                case 'simplif_racine': {
                    const a = 2 + Math.floor(rng() * 6);
                    const r = [2, 3, 5][Math.floor(rng() * 3)];
                    const n = a * a * r;
                    correct = a;
                    q = `Simplifie √${n} sous la forme a√${r}. Que vaut l'entier a ?`;
                    wrongCandidates = [r, a * a, a + 1, Math.max(1, a - 1)];
                    exp = `√${n} = √(${a * a} × ${r}) = ${a}√${r}, donc a = ${a}.`;
                    break;
                }
                case 'vecteur_coord': {
                    const xA = -3 + Math.floor(rng() * 8), xB = 4 + Math.floor(rng() * 9);
                    correct = xB - xA;
                    q = `Si A a pour abscisse ${xA} et B pour abscisse ${xB}, quelle est la composante x du vecteur AB (xB - xA) ?`;
                    wrongCandidates = [xA - xB, xA + xB, correct + 1, correct - 1];
                    exp = `xB - xA = ${xB} - (${xA}) = ${correct}.`;
                    break;
                }
                case 'inequation': {
                    const a = 2 + Math.floor(rng() * 4);
                    const bound = 2 + Math.floor(rng() * 6);
                    const b = 1 + Math.floor(rng() * 7);
                    const rhs = a * bound - b;
                    correct = bound + 1; // Strictement supérieur : x > bound → plus petit entier = bound + 1
                    q = `Résous l'inéquation : ${a}x - ${b} > ${rhs}. Quel est le plus petit entier x qui vérifie cette inégalité ?`;
                    wrongCandidates = [bound, bound - 1, bound + 2];
                    exp = `${a}x > ${rhs + b} donne x > ${bound}. Le plus petit entier strictement supérieur à ${bound} est ${correct}.`;
                    break;
                }
            }
        } else if (norm === '1ere') {
            const kinds = ['discriminant', 'nombre_racines', 'derivee_poly', 'suite_arith', 'suite_geom', 'produit_scalaire', 'cercle_trigo'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'discriminant': {
                    const a = 1 + Math.floor(rng() * 2);
                    const b = 4 + Math.floor(rng() * 5);
                    const c = 1 + Math.floor(rng() * 5);
                    correct = b * b - 4 * a * c;
                    q = `Pour le trinôme ${a === 1 ? '' : a}x² + ${b}x + ${c}, calcule le discriminant Δ = b² - 4ac.`;
                    wrongCandidates = [b * b + 4 * a * c, correct + 4, correct - 4, b * b - a * c];
                    exp = `Δ = ${b}² - 4 × ${a} × ${c} = ${b * b} - ${4 * a * c} = ${correct}.`;
                    break;
                }
                case 'nombre_racines': {
                    const cases = [
                        { cond: 'strictement positif (Δ > 0)', ans: 2, exp: 'Si Δ > 0, le trinôme admet 2 racines réelles distinctes.' },
                        { cond: 'nul (Δ = 0)', ans: 1, exp: 'Si Δ = 0, le trinôme admet 1 unique racine double.' },
                        { cond: 'strictement négatif (Δ < 0)', ans: 0, exp: 'Si Δ < 0, le trinôme n\'admet aucune racine réelle (0).' },
                    ];
                    const item = cases[Math.floor(rng() * cases.length)];
                    correct = item.ans;
                    q = `Si le discriminant Δ d'un trinôme du second degré est ${item.cond}, combien admet-il de racines réelles ?`;
                    wrongCandidates = [0, 1, 2, 3].filter(n => n !== correct);
                    exp = item.exp;
                    break;
                }
                case 'derivee_poly': {
                    const a = 2 + Math.floor(rng() * 7);
                    const b = 1 + Math.floor(rng() * 8);
                    correct = 2 * a;
                    q = `Soit f(x) = ${a}x² - ${b}x + 1. Quel est le coefficient de x dans la fonction dérivée f'(x) ?`;
                    wrongCandidates = [a, correct + 2, correct - 1, -b];
                    exp = `(ax²)' = 2ax, donc (${a}x²)' = ${correct}x.`;
                    break;
                }
                case 'suite_arith': {
                    const u0 = 2 + Math.floor(rng() * 8);
                    const r = 2 + Math.floor(rng() * 6);
                    const n = 4 + Math.floor(rng() * 5);
                    correct = u0 + n * r;
                    q = `Suite arithmétique : u₀ = ${u0} et raison r = ${r}. Que vaut u_${n} ?`;
                    wrongCandidates = [correct + r, correct - r, u0 + (n - 1) * r, u0 * r + n];
                    exp = `u_${n} = u₀ + ${n} × r = ${u0} + ${n} × ${r} = ${correct}.`;
                    break;
                }
                case 'suite_geom': {
                    const u0 = 2 + Math.floor(rng() * 4);
                    const qVal = 2 + Math.floor(rng() * 3);
                    const n = 2 + Math.floor(rng() * 2);
                    correct = u0 * Math.pow(qVal, n);
                    q = `Suite géométrique : u₀ = ${u0} et raison q = ${qVal}. Que vaut u_${n} ?`;
                    wrongCandidates = [u0 + n * qVal, correct * qVal, Math.round(correct / qVal), correct + u0];
                    exp = `u_${n} = ${u0} × ${qVal}^${n} = ${u0} × ${Math.pow(qVal, n)} = ${correct}.`;
                    break;
                }
                case 'produit_scalaire': {
                    const x1 = 1 + Math.floor(rng() * 5), y1 = 1 + Math.floor(rng() * 5);
                    const x2 = 1 + Math.floor(rng() * 5), y2 = 1 + Math.floor(rng() * 5);
                    correct = x1 * x2 + y1 * y2;
                    q = `Soit u(${x1}; ${y1}) et v(${x2}; ${y2}). Calcule le produit scalaire u · v = xx' + yy'.`;
                    wrongCandidates = [x1 * y2 + y1 * x2, x1 * x2 - y1 * y2, correct + 2, correct - 2];
                    exp = `u · v = ${x1}×${x2} + ${y1}×${y2} = ${x1 * x2} + ${y1 * y2} = ${correct}.`;
                    break;
                }
                case 'cercle_trigo': {
                    const items = [
                        { label: 'sin(π)', ans: 0, exp: 'sin(π) = 0 et cos(π) = -1.' },
                        { label: 'cos(π)', ans: -1, exp: 'Au point d\'angle π, l\'abscisse (cosinus) vaut -1.' },
                        { label: 'cos(0)', ans: 1, exp: 'Au point d\'angle 0, cos(0) = 1 et sin(0) = 0.' },
                        { label: 'sin(π/2)', ans: 1, exp: 'Au sommet du cercle (π/2), l\'ordonnée (sinus) vaut 1.' },
                        { label: 'cos(π/2)', ans: 0, exp: 'Au sommet du cercle (π/2), l\'abscisse (cosinus) vaut 0.' },
                    ];
                    const item = items[Math.floor(rng() * items.length)];
                    correct = item.ans;
                    q = `Sur le cercle trigonométrique, quelle est la valeur exacte de ${item.label} ?`;
                    wrongCandidates = [-1, 0, 1, 2].filter(n => n !== correct);
                    exp = item.exp;
                    break;
                }
            }
        } else {
            // Terminale
            const kinds = ['exponentielle', 'logarithme', 'derivee_exp_ln', 'primitive', 'limite_ref', 'proba_cond', 'loi_binomiale'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'exponentielle': {
                    const k = 2 + Math.floor(rng() * 6);
                    const mode = (index + variant) % 2;
                    if (mode === 0) {
                        correct = k;
                        q = `Quelle est la valeur exacte de ${k} × exp(0) (${k}e⁰) ?`;
                        wrongCandidates = [0, 1, k + 1, -k];
                        exp = `Comme e⁰ = 1, ${k} × e⁰ = ${k}.`;
                    } else {
                        correct = k;
                        q = `Résous dans ℝ : e^(x) = e^(${k}). Que vaut x ?`;
                        wrongCandidates = [0, 1, k + 1, -k];
                        exp = `La fonction exponentielle est strictement croissante : e^x = e^${k} ⇔ x = ${k}.`;
                    }
                    break;
                }
                case 'logarithme': {
                    const k = 1 + Math.floor(rng() * 6);
                    correct = k;
                    q = `Simplifie l'expression : ln(e^${k}). Quelle est sa valeur exacte ?`;
                    wrongCandidates = [0, k + 1, k * 2, -k];
                    exp = `Pour tout réel k, ln(e^k) = k, donc ln(e^${k}) = ${k}.`;
                    break;
                }
                case 'derivee_exp_ln': {
                    const k = 2 + Math.floor(rng() * 7);
                    correct = k;
                    q = `Soit f(x) = e^(${k}x). Dans sa dérivée f'(x) = a·e^(${k}x), que vaut le coefficient a ?`;
                    wrongCandidates = [1, k * 2, k - 1, -k];
                    exp = `(e^(kx))' = k·e^(kx), donc le facteur multiplicatif est ${correct}.`;
                    break;
                }
                case 'primitive': {
                    const n = 2 + Math.floor(rng() * 5);
                    correct = n + 1;
                    q = `Soit f(x) = ${n + 1}x^${n}. Quel est l'exposant de x dans sa primitive F(x) = x^p + C ?`;
                    wrongCandidates = [n, n - 1, n + 2, n * 2];
                    exp = `Une primitive de (n+1)x^n est x^(n+1), donc l'exposant est ${correct}.`;
                    break;
                }
                case 'limite_ref': {
                    const c = 1 + Math.floor(rng() * 8);
                    correct = c;
                    q = `Quelle est la limite de f(x) = ${c} + 1/x lorsque x tend vers +∞ ?`;
                    wrongCandidates = [0, c + 1, c - 1, -c];
                    exp = `Quand x → +∞, 1/x tend vers 0, donc f(x) tend vers ${c}.`;
                    break;
                }
                case 'proba_cond': {
                    const pA = [20, 40, 50, 80][Math.floor(rng() * 4)];
                    const ratioPct = [25, 50, 75][Math.floor(rng() * 3)];
                    const pInter = (pA * ratioPct) / 10000;
                    correct = ratioPct;
                    q = `Si P(A) = ${(pA / 100).toFixed(2).replace('.', ',')} et P(A ∩ B) = ${pInter.toFixed(2).replace('.', ',')}, que vaut P_A(B) en pourcentage ?`;
                    wrongCandidates = [100 - ratioPct, pA, Math.round(pInter * 100), 10];
                    exp = `P_A(B) = P(A ∩ B) / P(A) = ${pInter.toFixed(2)} / ${(pA / 100).toFixed(2)} = ${ratioPct} %.`;
                    break;
                }
                case 'loi_binomiale': {
                    const combos = [
                        { n: 4, k: 2, ans: 6, exp: '4! / (2! × 2!) = 24 / 4 = 6.' },
                        { n: 5, k: 2, ans: 10, exp: '5! / (2! × 3!) = 120 / 12 = 10.' },
                        { n: 5, k: 1, ans: 5, exp: '(1 parmi 5) = 5.' },
                        { n: 6, k: 2, ans: 15, exp: '6! / (2! × 4!) = 30 / 2 = 15.' },
                        { n: 4, k: 3, ans: 4, exp: '(3 parmi 4) = (1 parmi 4) = 4.' },
                    ];
                    const item = combos[Math.floor(rng() * combos.length)];
                    correct = item.ans;
                    q = `Que vaut le coefficient binomial (${item.k} parmi ${item.n}) ?`;
                    wrongCandidates = [item.ans + 2, Math.max(1, item.ans - 2), item.n * item.k, item.n + item.k];
                    exp = item.exp;
                    break;
                }
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
            exp: exp || `La bonne réponse est ${correct}.`,
        };
    }

    /** Générateur procédural de conjugaison et langue pour le français (sans doublons d'options) */
    function generateFrenchLesson(index, norm, variant, rng) {
        const verbs = [
            { inf: "chanter", pres: ["chante", "chantes", "chante", "chantons", "chantez", "chantent"], imp: ["chantais", "chantais", "chantait", "chantions", "chantiez", "chantaient"], fut: ["chanterai", "chanteras", "chantera", "chanterons", "chanterez", "chanteront"] },
            { inf: "finir", pres: ["finis", "finis", "finit", "finissons", "finissez", "finissent"], imp: ["finissais", "finissais", "finissait", "finissions", "finissiez", "finissaient"], fut: ["finirai", "finiras", "finira", "finirons", "finirez", "finiront"] },
            { inf: "aller", pres: ["vais", "vas", "va", "allons", "allez", "vont"], imp: ["allais", "allais", "allait", "allions", "alliez", "allaient"], fut: ["irai", "iras", "ira", "irons", "irez", "iront"] },
            { inf: "faire", pres: ["fais", "fais", "fait", "faisons", "faites", "font"], imp: ["faisais", "faisais", "faisait", "faisions", "faisiez", "faisaient"], fut: ["ferai", "feras", "fera", "ferons", "ferez", "feront"] },
            { inf: "prendre", pres: ["prends", "prends", "prend", "prenons", "prenez", "prennent"], imp: ["prenais", "prenais", "prenait", "prenions", "preniez", "prenaient"], fut: ["prendrai", "prendras", "prendra", "prendrons", "prendrez", "prendront"] },
            { inf: "venir", pres: ["viens", "viens", "vient", "venons", "venez", "viennent"], imp: ["venais", "venais", "venait", "venions", "veniez", "venaient"], fut: ["viendrai", "viendras", "viendra", "viendrons", "viendrez", "viendront"] },
            { inf: "pouvoir", pres: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"], imp: ["pouvais", "pouvais", "pouvait", "pouvions", "pouviez", "pouvaient"], fut: ["pourrai", "pourras", "pourra", "pourrons", "pourrez", "pourront"] },
            { inf: "être", pres: ["suis", "es", "est", "sommes", "êtes", "sont"], imp: ["étais", "étais", "était", "étions", "étiez", "étaient"], fut: ["serai", "seras", "sera", "serons", "serez", "seront"] },
            { inf: "avoir", pres: ["ai", "as", "a", "avons", "avez", "ont"], imp: ["avais", "avais", "avait", "avions", "aviez", "avaient"], fut: ["aurai", "auras", "aura", "aurons", "aurez", "auront"] },
            { inf: "voir", pres: ["vois", "vois", "voit", "voyons", "voyez", "voient"], imp: ["voyais", "voyais", "voyait", "voyions", "voyiez", "voyaient"], fut: ["verrai", "verras", "verra", "verrons", "verrez", "verront"] },
            { inf: "savoir", pres: ["sais", "sais", "sait", "savons", "savez", "savent"], imp: ["savais", "savais", "savait", "savions", "saviez", "savaient"], fut: ["saurai", "sauras", "saura", "saurons", "saurez", "sauront"] },
            { inf: "dire", pres: ["dis", "dis", "dit", "disons", "dites", "disent"], imp: ["disais", "disais", "disait", "disions", "disiez", "disaient"], fut: ["dirai", "diras", "dira", "dirons", "direz", "diront"] },
            { inf: "vouloir", pres: ["veux", "veux", "veut", "voulons", "voulez", "veulent"], imp: ["voulais", "voulais", "voulait", "voulions", "vouliez", "voulaient"], fut: ["voudrai", "voudras", "voudra", "voudrons", "voudrez", "voudront"] },
        ];
        const persons = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
        const pIndex = Math.floor(rng() * persons.length);
        const vObj = verbs[Math.floor(rng() * verbs.length)];
        const tenses = ['présent', 'imparfait', 'futur'];
        const tense = tenses[Math.floor(rng() * tenses.length)];

        let forms = vObj.pres;
        if (tense === 'imparfait') forms = vObj.imp;
        if (tense === 'futur') forms = vObj.fut;

        const correct = forms[pIndex];
        const allVerbForms = [...forms, ...vObj.pres, ...vObj.imp, ...vObj.fut];
        const wrongs = uniqueStringWrongs(correct, forms.filter((_, i) => i !== pIndex), allVerbForms);
        const { opts, correct: correctIdx } = shuffleOptions([correct, ...wrongs], 0, rng);

        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Conjugue le verbe « ${vObj.inf} » au ${tense} avec le pronom « ${persons[pIndex]} » :`,
            opts,
            correct: correctIdx,
            exp: `Au ${tense}, on écrit : ${persons[pIndex]} ${correct}.`
        };
    }

    /** Générateur procédural pour l'anglais (deck déterministe anti-répétition) */
    function generateEnglishLesson(index, norm, variant, rng) {
        const irregulars = [
            { inf: "to speak", pret: "spoke", pp: "spoken", fr: "parler" },
            { inf: "to write", pret: "wrote", pp: "written", fr: "écrire" },
            { inf: "to see", pret: "saw", pp: "seen", fr: "voir" },
            { inf: "to go", pret: "went", pp: "gone", fr: "aller" },
            { inf: "to take", pret: "took", pp: "taken", fr: "prendre" },
            { inf: "to give", pret: "gave", pp: "given", fr: "donner" },
            { inf: "to eat", pret: "ate", pp: "eaten", fr: "manger" },
            { inf: "to drink", pret: "drank", pp: "drunk", fr: "boire" },
            { inf: "to know", pret: "knew", pp: "known", fr: "savoir" },
            { inf: "to think", pret: "thought", pp: "thought", fr: "penser" },
            { inf: "to make", pret: "made", pp: "made", fr: "fabriquer" },
            { inf: "to come", pret: "came", pp: "come", fr: "venir" },
            { inf: "to break", pret: "broke", pp: "broken", fr: "casser" },
            { inf: "to choose", pret: "chose", pp: "chosen", fr: "choisir" },
            { inf: "to drive", pret: "drove", pp: "driven", fr: "conduire" },
            { inf: "to fall", pret: "fell", pp: "fallen", fr: "tomber" },
            { inf: "to fly", pret: "flew", pp: "flown", fr: "voler (dans les airs)" },
            { inf: "to forget", pret: "forgot", pp: "forgotten", fr: "oublier" },
            { inf: "to buy", pret: "bought", pp: "bought", fr: "acheter" },
            { inf: "to teach", pret: "taught", pp: "taught", fr: "enseigner" }
        ];
        const deck = seededShuffle(irregulars, 'en-deck:' + norm + ':v' + variant);
        const slot = Math.floor(index / 2) + variant * 3;
        const item = deck[slot % deck.length];
        const askPastParticiple = (Math.floor(slot / deck.length) + index + variant) % 2 === 1;
        const baseVerb = item.inf.replace('to ', '');
        const otherForms = irregulars.filter(x => x.inf !== item.inf);
        const randomOther1 = otherForms[Math.floor(rng() * otherForms.length)];
        const randomOther2 = otherForms[(Math.floor(rng() * otherForms.length) + 1) % otherForms.length];

        if (askPastParticiple) {
            const correct = item.pp;
            const wrongs = uniqueStringWrongs(correct, [
                item.pret !== correct ? item.pret : baseVerb + 'ed',
                baseVerb + 'ed',
                item.pret + 'en',
                randomOther1.pp,
                randomOther2.pret
            ]);
            const { opts, correct: cIdx } = shuffleOptions([correct, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `What is the past participle of '${item.inf}' (${item.fr})?`,
                opts,
                correct: cIdx,
                exp: `The forms are : ${item.inf} - ${item.pret} - ${item.pp}.`
            };
        } else {
            const correct = item.pret;
            const wrongs = uniqueStringWrongs(correct, [
                item.pp !== correct ? item.pp : baseVerb + 'ed',
                baseVerb + 'ed',
                baseVerb + 't',
                randomOther1.pret,
                randomOther2.pp
            ]);
            const { opts, correct: cIdx } = shuffleOptions([correct, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `What is the simple past (preterite) of '${item.inf}' (${item.fr})?`,
                opts,
                correct: cIdx,
                exp: `The preterite of ${item.inf} is '${item.pret}'.`
            };
        }
    }

    /** Générateur procédural pour la géographie (deck déterministe anti-répétition) */
    function generateGeoLesson(index, norm, variant, rng) {
        const capitals = [
            { country: "l'Italie", cap: "Rome", wrongs: ["Milan", "Venise", "Naples"] },
            { country: "l'Allemagne", cap: "Berlin", wrongs: ["Munich", "Francfort", "Hambourg"] },
            { country: "le Portugal", cap: "Lisbonne", wrongs: ["Porto", "Faro", "Coimbra"] },
            { country: "le Royaume-Uni", cap: "Londres", wrongs: ["Manchester", "Édimbourg", "Liverpool"] },
            { country: "les Pays-Bas", cap: "Amsterdam", wrongs: ["Rotterdam", "La Haye", "Utrecht"] },
            { country: "la Belgique", cap: "Bruxelles", wrongs: ["Anvers", "Gand", "Liège"] },
            { country: "la Grèce", cap: "Athènes", wrongs: ["Thessalonique", "Sparte", "Patras"] },
            { country: "le Canada", cap: "Ottawa", wrongs: ["Montréal", "Toronto", "Vancouver"] },
            { country: "le Japon", cap: "Tokyo", wrongs: ["Kyoto", "Osaka", "Hiroshima"] },
            { country: "l'Australie", cap: "Canberra", wrongs: ["Sydney", "Melbourne", "Brisbane"] },
            { country: "le Brésil", cap: "Brasília", wrongs: ["Rio de Janeiro", "São Paulo", "Salvador"] },
            { country: "l'Égypte", cap: "Le Caire", wrongs: ["Alexandrie", "Louxor", "Gizeh"] },
            { country: "la Suisse", cap: "Berne", wrongs: ["Zurich", "Genève", "Bâle"] },
            { country: "la Turquie", cap: "Ankara", wrongs: ["Istanbul", "Izmir", "Antalya"] },
            { country: "le Maroc", cap: "Rabat", wrongs: ["Casablanca", "Marrakech", "Fès"] },
            { country: "l'Inde", cap: "New Delhi", wrongs: ["Mumbai", "Bangalore", "Calcutta"] },
            { country: "la Pologne", cap: "Varsovie", wrongs: ["Cracovie", "Gdansk", "Wroclaw"] },
            { country: "la Suède", cap: "Stockholm", wrongs: ["Göteborg", "Malmö", "Oslo"] }
        ];
        const deck = seededShuffle(capitals, 'geo-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.cap, item.wrongs);
        const { opts, correct } = shuffleOptions([item.cap, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Quelle est la capitale de ${item.country} ?`,
            opts,
            correct,
            exp: `La capitale de ${item.country} est bien ${item.cap}.`
        };
    }

    /** Générateur procédural pour la physique (sans doublons d'options) */
    function generatePhysicsLesson(index, norm, variant, rng) {
        const kinds = ['ohm', 'puissance', 'cinetique', 'poids'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'ohm') {
            const r = 10 * (1 + Math.floor(rng() * 9)); // 10 à 90 ohms
            const i = 2 + Math.floor(rng() * 5); // 2 à 6 A (évite r*i === r/i)
            const u = r * i;
            const wrongs = uniqueWrongs(u, [u + 10, Math.round(r / i), u * 2, Math.max(1, u - r)], false).map(n => `${n} V`);
            const { opts, correct } = shuffleOptions([`${u} V`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `D'après la loi d'Ohm (U = R × I), quelle est la tension aux bornes d'un dipôle de résistance R = ${r} Ω traversé par un courant de ${i} A ?`,
                opts,
                correct,
                exp: `U = R × I = ${r} × ${i} = ${u} V.`
            };
        } else if (kind === 'puissance') {
            const u = [12, 24, 110, 230][Math.floor(rng() * 4)];
            const i = 2 + Math.floor(rng() * 6);
            const p = u * i;
            const wrongs = uniqueWrongs(p, [Math.max(1, p - u), p + u, Math.round(u / i), p * 2], false).map(n => `${n} W`);
            const { opts, correct } = shuffleOptions([`${p} W`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sous une tension U = ${u} V, un appareil absorbe un courant de ${i} A. Quelle est sa puissance électrique P = U × I ?`,
                opts,
                correct,
                exp: `P = U × I = ${u} × ${i} = ${p} W.`
            };
        } else if (kind === 'poids') {
            const m = 2 + Math.floor(rng() * 15);
            const g = 10; // approximation scolaire standard (10 N/kg)
            const p = m * g;
            const wrongs = uniqueWrongs(p, [m + g, p + 10, Math.max(1, p - 10), m * 2], false).map(n => `${n} N`);
            const { opts, correct } = shuffleOptions([`${p} N`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur Terre (g ≈ 10 N/kg), quel est le poids P = m × g d'un objet de masse m = ${m} kg ?`,
                opts,
                correct,
                exp: `P = m × g = ${m} × 10 = ${p} N.`
            };
        } else {
            const v = (2 + Math.floor(rng() * 8)) * 10; // 20 à 90 km/h
            const t = 2 + Math.floor(rng() * 4); // 2 à 5 h
            const d = v * t;
            const wrongs = uniqueWrongs(d, [d + v, Math.max(1, d - 20), v + t, d * 2], false).map(n => `${n} km`);
            const { opts, correct } = shuffleOptions([`${d} km`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un véhicule roule à une vitesse moyenne de ${v} km/h pendant ${t} heures. Quelle distance parcourt-il ?`,
                opts,
                correct,
                exp: `Distance = vitesse × temps = ${v} × ${t} = ${d} km.`
            };
        }
    }

    /** Générateur procédural pour la chimie (sans doublons d'options) */
    function generateChemistryLesson(index, norm, variant, rng) {
        const elements = [
            { name: "l'Hydrogène", sym: "H", z: 1 },
            { name: "l'Hélium", sym: "He", z: 2 },
            { name: "le Lithium", sym: "Li", z: 3 },
            { name: "le Carbone", sym: "C", z: 6 },
            { name: "l'Azote", sym: "N", z: 7 },
            { name: "l'Oxygène", sym: "O", z: 8 },
            { name: "le Fluor", sym: "F", z: 9 },
            { name: "le Néon", sym: "Ne", z: 10 },
            { name: "le Sodium", sym: "Na", z: 11 },
            { name: "le Magnésium", sym: "Mg", z: 12 },
            { name: "l'Aluminium", sym: "Al", z: 13 },
            { name: "le Soufre", sym: "S", z: 16 },
            { name: "le Chlore", sym: "Cl", z: 17 },
            { name: "le Potassium", sym: "K", z: 19 },
            { name: "le Calcium", sym: "Ca", z: 20 },
            { name: "le Fer", sym: "Fe", z: 26 },
            { name: "le Cuivre", sym: "Cu", z: 29 },
            { name: "le Zinc", sym: "Zn", z: 30 },
            { name: "l'Argent", sym: "Ag", z: 47 },
            { name: "l'Or", sym: "Au", z: 79 }
        ];
        const deck = seededShuffle(elements, 'chem-deck:' + norm + ':v' + variant);
        const slot = Math.floor(index / 2) + variant * 5;
        const el = deck[slot % deck.length];
        const askSymbol = (Math.floor(slot / deck.length) + index + variant) % 2 === 0;

        if (askSymbol) {
            const others = seededShuffle(elements.filter(x => x.sym !== el.sym).map(x => x.sym), 'chem:' + index + ':' + variant);
            const wrongs = uniqueStringWrongs(el.sym, others);
            const { opts, correct } = shuffleOptions([el.sym, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quel est le symbole chimique de ${el.name} ?`,
                opts,
                correct,
                exp: `Le symbole de ${el.name} est ${el.sym}.`
            };
        } else {
            const wrongs = uniqueWrongs(el.z, [el.z + 1, el.z + 2, el.z - 1, el.z + 4], false).filter(n => n > 0);
            while (wrongs.length < 3) wrongs.push(el.z + wrongs.length + 3);
            const { opts, correct } = shuffleOptions([`${el.z}`, ...wrongs.slice(0, 3).map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quel est le numéro atomique Z (nombre de protons) de ${el.name} ?`,
                opts,
                correct,
                exp: `Le numéro atomique Z de ${el.name} est ${el.z}.`
            };
        }
    }

    /** Générateur procédural pour la technologie */
    function generateTechnoLesson(index, norm, variant, rng) {
        const binaries = [
            { bin: "0001", dec: 1 },
            { bin: "0010", dec: 2 },
            { bin: "0011", dec: 3 },
            { bin: "0100", dec: 4 },
            { bin: "0101", dec: 5 },
            { bin: "0110", dec: 6 },
            { bin: "0111", dec: 7 },
            { bin: "1000", dec: 8 },
            { bin: "1001", dec: 9 },
            { bin: "1010", dec: 10 },
            { bin: "1011", dec: 11 },
            { bin: "1100", dec: 12 },
            { bin: "1101", dec: 13 },
            { bin: "1110", dec: 14 },
            { bin: "1111", dec: 15 }
        ];
        const deck = seededShuffle(binaries, 'techno-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 4) % deck.length];
        const wrongs = uniqueWrongs(item.dec, [item.dec + 1, item.dec + 2, item.dec - 1, item.dec + 4], false);
        const { opts, correct } = shuffleOptions([`${item.dec}`, ...wrongs.map(String)], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En binaire sur 4 bits, quelle est la valeur décimale du mot binaire ${item.bin} ?`,
            opts,
            correct,
            exp: `En binaire, ${item.bin} correspond au nombre décimal ${item.dec}.`
        };
    }

    /** Générateur procédural pour l'histoire (dates plausibles, jamais dans le futur) */
    function generateHistoryLesson(index, norm, variant, rng) {
        const events = [
            { event: "la prise de la Bastille", year: 1789, era: "Révolution française" },
            { event: "le sacre de Napoléon Ier empereur", year: 1804, era: "Premier Empire" },
            { event: "l'armistice de la Première Guerre mondiale", year: 1918, era: "Grande Guerre" },
            { event: "l'appel du 18 juin par le général de Gaulle", year: 1940, era: "Seconde Guerre mondiale" },
            { event: "la chute du mur de Berlin", year: 1989, era: "Guerre froide" },
            { event: "la bataille de Marignan (François Ier)", year: 1515, era: "Renaissance" },
            { event: "l'Édit de Nantes par Henri IV", year: 1598, era: "Guerres de religion" },
            { event: "le couronnement de Charlemagne à Rome", year: 800, era: "Moyen Âge" },
            { event: "la bataille d'Alésia (César et Vercingétorix)", year: -52, era: "Antiquité" },
            { event: "la proclamation de la Ve République en France", year: 1958, era: "Époque contemporaine" },
            { event: "l'abolition de l'esclavage en France par Victor Schœlcher", year: 1848, era: "XIXe siècle" },
            { event: "la loi de séparation des Églises et de l'État en France", year: 1905, era: "IIIe République" },
            { event: "le débarquement allié en Normandie", year: 1944, era: "Seconde Guerre mondiale" },
            { event: "les accords d'Évian marquant l'indépendance de l'Algérie", year: 1962, era: "Décolonisation" },
            { event: "la signature du traité de Versailles", year: 1919, era: "Entre-deux-guerres" },
            { event: "l'apparition des premiers systèmes d'écriture en Mésopotamie", year: -3300, era: "Antiquité" },
            { event: "la prise de Constantinople par les Ottomans", year: 1453, era: "Fin du Moyen Âge" },
            { event: "l'arrivée de Christophe Colomb aux Caraïbes", year: 1492, era: "Grandes Découvertes" },
            { event: "l'exécution de Louis XVI sur la guillotine", year: 1793, era: "Révolution française" },
            { event: "la signature du traité de Rome (CEE)", year: 1957, era: "Construction européenne" },
            { event: "la chute de l'Empire romain d'Occident", year: 476, era: "Fin de l'Antiquité" },
            { event: "le sacre d'Hugues Capet, roi des Francs", year: 987, era: "Moyen Âge" },
            { event: "la dissolution officielle de l'URSS", year: 1991, era: "Fin de la Guerre froide" },
            { event: "l'adoption de la Déclaration universelle des droits de l'homme", year: 1948, era: "Après-guerre" },
        ];
        const deck = seededShuffle(events, 'hist-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 7) % deck.length];
        const y = item.year;
        const fmtYear = (n) => n < 0 ? `${Math.abs(n)} av. J.-C.` : `${n}`;
        let offsets;
        if (y < -500) offsets = [-300, 300, -600, 600];
        else if (y < 0) offsets = [-25, 20, -50, 35];
        else if (y < 1500) offsets = [-35, 35, -70, 70];
        else if (y < 1900) offsets = [-12, 12, -25, 25];
        else offsets = [-6, 6, -14, -22, 10];

        const rawWrongs = offsets
            .map(d => y + d)
            .filter(n => n !== y && n !== 0 && n <= 2024)
            .map(fmtYear);
        const correctStr = fmtYear(y);
        const wrongs = uniqueStringWrongs(correctStr, rawWrongs, [fmtYear(y - 10), fmtYear(y - 20), fmtYear(y - 30)]);
        const { opts, correct: cIdx } = shuffleOptions([correctStr, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En quelle année s'est déroulé cet événement historique : ${item.event} ?`,
            opts,
            correct: cIdx,
            exp: `Cet événement (${item.era}) a eu lieu en ${correctStr}.`
        };
    }

    /** Générateur procédural pour NSI & Numérique (Lycée) */
    function generateNsiLesson(index, norm, variant, rng) {
        const kinds = ['bin2dec', 'dec2bin', 'hex2dec', 'python_list', 'bytes'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'bin2dec') {
            const val = 5 + Math.floor(rng() * 58); // 5..62
            const bin = val.toString(2).padStart(6, '0');
            const wrongs = uniqueWrongs(val, [val + 1, val - 1, val + 2, val ^ 4], false);
            const { opts, correct } = shuffleOptions([String(val), ...wrongs.map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quelle est la représentation décimale du nombre binaire ${bin}₂ ?`,
                opts,
                correct,
                exp: `En base 2, ${bin}₂ = ${val} en base 10.`
            };
        }
        if (kind === 'dec2bin') {
            const val = 6 + Math.floor(rng() * 25); // 6..30
            const bin = val.toString(2);
            const wNums = uniqueWrongs(val, [val + 1, val - 1, val + 2, val ^ 2], false);
            const wrongs = uniqueStringWrongs(bin, wNums.map(n => n.toString(2)));
            const { opts, correct } = shuffleOptions([bin, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Comment s'écrit l'entier décimal ${val} en base 2 (binaire) ?`,
                opts,
                correct,
                exp: `${val} en base 10 s'écrit ${bin} en binaire.`
            };
        }
        if (kind === 'hex2dec') {
            const val = 10 + Math.floor(rng() * 50); // 10..59
            const hex = val.toString(16).toUpperCase();
            const wrongs = uniqueWrongs(val, [val + 16, val - 6, val + 1, val - 1], false);
            const { opts, correct } = shuffleOptions([String(val), ...wrongs.map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quelle est la valeur en base 10 du nombre hexadécimal 0x${hex} ?`,
                opts,
                correct,
                exp: `En base 16, 0x${hex} vaut ${val} en décimal.`
            };
        }
        if (kind === 'python_list') {
            const a = 2 + Math.floor(rng() * 5);
            const b = 3 + Math.floor(rng() * 6);
            const c = 4 + Math.floor(rng() * 7);
            const d = 1 + Math.floor(rng() * 8);
            const arr = [a, b, c, d];
            const idx = Math.floor(rng() * arr.length);
            const ans = arr[idx];
            const wrongs = uniqueWrongs(ans, [arr[(idx + 1) % 4], arr[(idx + 2) % 4], ans + 1, idx], false);
            const { opts, correct } = shuffleOptions([String(ans), ...wrongs.map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En Python, avec L = [${arr.join(', ')}], que renvoie l'expression L[${idx}] ?`,
                opts,
                correct,
                exp: `En Python, les indices de liste commencent à 0 : L[${idx}] = ${ans}.`
            };
        }
        const bits = [4, 5, 6, 7, 8][Math.floor(rng() * 5)];
        const count = Math.pow(2, bits);
        const wrongs = uniqueWrongs(count, [count / 2, count * 2, bits * 2, count - 1], false);
        const { opts, correct } = shuffleOptions([String(count), ...wrongs.map(String)], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Combien de valeurs distinctes peut-on coder sur ${bits} bits ?`,
            opts,
            correct,
            exp: `Avec ${bits} bits, on peut coder 2^${bits} = ${count} valeurs distinctes (de 0 à ${count - 1}).`
        };
    }

    /** Générateur procédural pour SES (Lycée) */
    function generateSesLesson(index, norm, variant, rng) {
        const kinds = ['ca', 'va', 'taux_var', 'part_marche'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'ca') {
            const prix = (2 + Math.floor(rng() * 8)) * 5; // 10..45 €
            const qty = (2 + Math.floor(rng() * 9)) * 10; // 20..100
            const ca = prix * qty;
            const wrongs = uniqueWrongs(ca, [ca + prix * 10, Math.max(10, ca - prix * 10), prix + qty, ca * 2], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${ca} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Une entreprise vend ${qty} unités d'un produit au prix unitaire de ${prix} €. Quel est son chiffre d'affaires (CA) ?`,
                opts,
                correct,
                exp: `Chiffre d'affaires = Prix × Quantité = ${prix} × ${qty} = ${ca} €.`
            };
        }
        if (kind === 'va') {
            const ca = (5 + Math.floor(rng() * 10)) * 1000;
            const ci = (1 + Math.floor(rng() * 4)) * 1000;
            const va = ca - ci;
            const wrongs = uniqueWrongs(va, [ca + ci, ci, va + 1000, Math.max(500, va - 1000)], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${va} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Une entreprise réalise ${ca} € de production avec ${ci} € de consommations intermédiaires. Quelle est sa Valeur Ajoutée (VA) ?`,
                opts,
                correct,
                exp: `Valeur Ajoutée = Production − Consommations intermédiaires = ${ca} − ${ci} = ${va} €.`
            };
        }
        if (kind === 'taux_var') {
            const vd = [50, 100, 200, 250, 400][Math.floor(rng() * 5)];
            const pct = [10, 20, 25, 40, 50][Math.floor(rng() * 5)];
            const va = vd + (vd * pct) / 100;
            const wrongs = uniqueWrongs(pct, [pct + 10, Math.max(5, pct - 10), va - vd, pct * 2], false).map(n => `+${n} %`);
            const { opts, correct } = shuffleOptions([`+${pct} %`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un indicateur économique passe de ${vd} à ${va}. Quel est son taux de variation ?`,
                opts,
                correct,
                exp: `Taux de variation = ((${va} − ${vd}) / ${vd}) × 100 = +${pct} %.`
            };
        }
        const total = [200, 400, 500, 1000][Math.floor(rng() * 4)];
        const pct = [10, 15, 20, 25, 30, 40][Math.floor(rng() * 6)];
        const sales = (total * pct) / 100;
        const wrongs = uniqueWrongs(pct, [pct + 5, Math.max(5, pct - 5), 100 - pct, pct * 2], false).map(n => `${n} %`);
        const { opts, correct } = shuffleOptions([`${pct} %`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Sur un marché total de ${total} millions d'euros, une entreprise réalise ${sales} millions d'euros de ventes. Quelle est sa part de marché ?`,
            opts,
            correct,
            exp: `Part de marché = (${sales} / ${total}) × 100 = ${pct} %.`
        };
    }

    /** Générateur procédural pour les SVT (deck déterministe anti-répétition) */
    function generateSvtLesson(index, norm, variant, rng) {
        const organs = [
            { organ: "le cœur", system: "le système cardiovasculaire", role: "propulser le sang dans tout l'organisme", wrongs: ["digérer les aliments", "filtrer l'urine", "produire l'insuline"] },
            { organ: "les poumons", system: "le système respiratoire", role: "assurer les échanges gazeux (O₂ et CO₂)", wrongs: ["sécréter la bile", "broyer les nutriments", "stocker le glycogène"] },
            { organ: "l'estomac", system: "le système digestif", role: "brasser et commencer la digestion chimique des aliments", wrongs: ["transmettre l'influx nerveux", "pomper la lymphe", "produire les anticorps"] },
            { organ: "les reins", system: "le système urinaire", role: "filtrer le sang pour éliminer les déchets sous forme d'urine", wrongs: ["absorber les vitamines", "ventiler les alvéoles", "fabriquer l'hémoglobine"] },
            { organ: "le pancréas", system: "le système endocrinien et digestif", role: "sécréter l'insuline et des enzymes digestives", wrongs: ["purifier l'air inspiré", "coaguler le sang", "produire les globules rouges"] },
            { organ: "l'intestin grêle", system: "le système digestif", role: "absorber la majorité des nutriments vers le sang", wrongs: ["stocker les urines", "synthétiser l'ADN", "oxygéner le sang"] },
            { organ: "le cerveau", system: "le système nerveux central", role: "intégrer les informations et commander les mouvements", wrongs: ["sécréter l'acide gastrique", "neutraliser les bactéries par la bile", "produire le liquide synovial"] },
            { organ: "le foie", system: "le système digestif", role: "produire la bile et réguler le stockage du glucose", wrongs: ["ventiler le thorax", "transmettre les ondes sonores", "fabriquer les spermatozoïdes"] },
            { organ: "la moelle osseuse", system: "le système immunitaire et sanguin", role: "produire les cellules sanguines (hématies, leucocytes, plaquettes)", wrongs: ["digérer les lipides", "contrôler l'équilibre auditif", "éliminer le CO₂ expiré"] },
            { organ: "la rétine", system: "le système sensoriel visuel", role: "convertir la lumière en signaux nerveux transmis au cerveau", wrongs: ["sécréter les larmes", "protéger le tympan", "filtrer le plasma sanguin"] },
            { organ: "la peau", system: "la barrière cutanée", role: "protéger l'organisme et réguler la température corporelle", wrongs: ["stocker la bile", "pomper le sang veineux", "broyer les protéines"] },
            { organ: "les plaquettes sanguines", system: "le système circulatoire", role: "assurer la coagulation du sang lors d'une blessure", wrongs: ["transporter le dioxygène", "produire des hormones sexuelles", "digérer l'amidon"] }
        ];
        const deck = seededShuffle(organs, 'svt-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.role, item.wrongs);
        const { opts, correct } = shuffleOptions([item.role, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Dans le corps humain, quel est le rôle principal de ${item.organ} (${item.system}) ?`,
            opts,
            correct,
            exp: `Le rôle principal de ${item.organ} est de ${item.role}.`
        };
    }

    /** Générateur procédural pour l'EMC (deck déterministe anti-répétition) */
    function generateEmcLesson(index, norm, variant, rng) {
        const items = [
            { num: "15", service: "le SAMU (urgences médicales graves)" },
            { num: "17", service: "Police Secours ou la Gendarmerie" },
            { num: "18", service: "les Sapeurs-Pompiers (incendies, secours)" },
            { num: "112", service: "le numéro d'appel d'urgence européen unique" },
            { num: "3018", service: "la ligne d'écoute gratuite contre le cyberharcèlement scolaire" },
            { num: "119", service: "le numéro national de l'Enfance en Danger" },
            { num: "114", service: "le numéro d'urgence accessible par SMS pour les personnes sourdes ou malentendantes" },
            { num: "115", service: "le SAMU social (hébergement d'urgence)" },
            { num: "3919", service: "la ligne d'écoute dédiée aux femmes victimes de violences" },
            { num: "196", service: "les secours maritimes (CROSS)" }
        ];
        const deck = seededShuffle(items, 'emc-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 3) % deck.length];
        const others = seededShuffle(items.filter(x => x.num !== item.num).map(x => x.num), 'emc-w:' + index + ':' + variant);
        const wrongs = uniqueStringWrongs(item.num, others);
        const { opts, correct } = shuffleOptions([item.num, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En France, quel est le numéro de téléphone d'urgence à composer pour joindre ${item.service} ?`,
            opts,
            correct,
            exp: `Pour joindre ${item.service}, il faut composer le ${item.num}.`
        };
    }

    /** Générateur procédural pour la philosophie (Terminale, deck déterministe anti-répétition) */
    function generatePhiloLesson(index, norm, variant, rng) {
        const quotes = [
            { quote: "« Connais-toi toi-même. »", author: "Socrate", wrongs: ["Aristote", "Épicure", "Nietzsche"] },
            { quote: "« Je pense, donc je suis. » (Cogito, ergo sum)", author: "René Descartes", wrongs: ["Blaise Pascal", "David Hume", "John Locke"] },
            { quote: "« L'homme est un loup pour l'homme. »", author: "Thomas Hobbes", wrongs: ["Jean-Jacques Rousseau", "Emmanuel Kant", "Karl Marx"] },
            { quote: "« L'homme est né libre, et partout il est dans les fers. »", author: "Jean-Jacques Rousseau", wrongs: ["Voltaire", "Montesquieu", "Denis Diderot"] },
            { quote: "« Le cœur a ses raisons que la raison ne connaît point. »", author: "Blaise Pascal", wrongs: ["René Descartes", "Baruch Spinoza", "Michel de Montaigne"] },
            { quote: "« Deviens ce que tu es. »", author: "Friedrich Nietzsche", wrongs: ["Arthur Schopenhauer", "Jean-Paul Sartre", "Gilles Deleuze"] },
            { quote: "« L'existence précède l'essence. »", author: "Jean-Paul Sartre", wrongs: ["Albert Camus", "Michel Foucault", "Simone de Beauvoir"] },
            { quote: "« La liberté des uns s'arrête là où commence celle des autres. »", author: "John Stuart Mill", wrongs: ["Thomas More", "Machiavel", "Hegel"] },
            { quote: "« Sapere aude ! Aie le courage de te servir de ton propre entendement ! »", author: "Emmanuel Kant", wrongs: ["Baruch Spinoza", "Gottfried Leibniz", "Christian Wolff"] },
            { quote: "« L'homme est un animal politique. »", author: "Aristote", wrongs: ["Platon", "Épicure", "Sénèque"] },
            { quote: "« On ne naît pas femme : on le devient. »", author: "Simone de Beauvoir", wrongs: ["Hannah Arendt", "Simone Weil", "Judith Butler"] },
            { quote: "« Science sans conscience n'est que ruine de l'âme. »", author: "François Rabelais", wrongs: ["Michel de Montaigne", "René Descartes", "Francis Bacon"] },
            { quote: "« Le Moi n'est pas maître dans sa propre maison. »", author: "Sigmund Freud", wrongs: ["Carl Jung", "Henri Bergson", "Emmanuel Kant"] },
            { quote: "« Rien de grand ne s'est accompli dans le monde sans passion. »", author: "Georg Wilhelm Friedrich Hegel", wrongs: ["Arthur Schopenhauer", "Baruch Spinoza", "David Hume"] },
            { quote: "« L'obéissance à la loi qu'on s'est prescrite est liberté. »", author: "Jean-Jacques Rousseau", wrongs: ["Thomas Hobbes", "Nicolas Machiavel", "John Locke"] },
            { quote: "« Il faut imaginer Sisyphe heureux. »", author: "Albert Camus", wrongs: ["Jean-Paul Sartre", "Søren Kierkegaard", "Martin Heidegger"] }
        ];
        const deck = seededShuffle(quotes, 'philo-deck:' + norm + ':v' + variant);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.author, item.wrongs);
        const { opts, correct } = shuffleOptions([item.author, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `À quel grand philosophe attribue-t-on la célèbre formule suivante : ${item.quote} ?`,
            opts,
            correct,
            exp: `Cette citation est de ${item.author}.`
        };
    }

    /* ================= 2. Banques de questions étendues ================= */

    const FACT_BANKS = {
        francais: [
            // 6ème
            { q: "Quelle est la classe grammaticale du mot « gentiment » ?", correct: "adverbe", wrongs: ["adjectif", "nom", "verbe"], levels: ['6eme', '5eme'], exp: "Les mots terminés en -ment sont très généralement des adverbes de manière." },
            { q: "Quel est le pluriel du mot « cheval » ?", correct: "chevaux", wrongs: ["chevals", "chevaus", "chevaux s"], levels: ['6eme'], exp: "La plupart des noms en -al font leur pluriel en -aux." },
            { q: "Dans « Le chat noir dort », quelle est la fonction du mot « noir » ?", correct: "épithète", wrongs: ["attribut", "sujet", "complément d'objet"], levels: ['6eme', '5eme'], exp: "« Noir » est directement rattaché au nom qu'il qualifie, c'est une épithète." },
            { q: "Quel est l'antonyme de « généreux » ?", correct: "avare", wrongs: ["joyeux", "courageux", "loyal"], levels: ['6eme'], exp: "Un avare refuse de dépenser ou de partager." },
            { q: "Conjugue « chanter » à la 1ère personne du pluriel au présent de l'indicatif.", correct: "nous chantons", wrongs: ["nous chantions", "nous chanterons", "nous chantez"], levels: ['6eme'], exp: "La terminaison du présent avec 'nous' pour le 1er groupe est -ons." },
            { q: "Quel mot est un déterminant possessif ?", correct: "notre", wrongs: ["nous", "le", "cet"], levels: ['6eme', '5eme'], exp: "« Notre » indique l'appartenance devant un nom." },
            { q: "Quel est le synonyme du mot « périlleux » ?", correct: "dangereux", wrongs: ["agréable", "rapide", "calme"], levels: ['6eme', '5eme'], exp: "Périlleux et dangereux expriment tous deux la présence d'un danger." },
            { type: 'vrai_faux', q: "Le verbe 'courir' appartient au troisième groupe de conjugaison.", correct: true, levels: ['6eme', '5eme'], exp: "Vrai : courir a un participe présent en -ant (courant) sans -issant, il est du 3e groupe." },
            // 5ème
            { q: "Dans « Le chevalier brandit son épée », que représente « son épée » ?", correct: "le COD", wrongs: ["le sujet", "le COI", "un complément de lieu"], levels: ['5eme'], exp: "Il brandit quoi ? son épée (Complément d'Objet Direct)." },
            { q: "À quel temps est conjugué le verbe dans « Il courut vers le château » ?", correct: "au passé simple", wrongs: ["à l'imparfait", "au présent", "au plus-que-parfait"], levels: ['5eme', '4eme'], exp: "« Courut » est la 3e personne du passé simple du verbe courir." },
            { q: "Comment accorde-t-on : « Les fillettes sont ___ » ?", correct: "parties", wrongs: ["parti", "partie", "partis"], levels: ['5eme', '6eme'], exp: "Avec l'auxiliaire être, accord en genre et en nombre avec le sujet féminin pluriel." },
            { q: "Quel mot désigne le compagnon d'armes d'un chevalier au Moyen Âge ?", correct: "un écuyer", wrongs: ["un troubadour", "un serf", "un bailli"], levels: ['5eme'], exp: "L'écuyer portait le bouclier (écu) et assistait le chevalier." },
            { q: "Quelle proposition contient un homophone correctement orthographié ?", correct: "Où vas-tu ?", wrongs: ["Ou vas-tu ?", "Où veux-tu du thé ?", "Ou bien où ?"], levels: ['5eme', '6eme'], exp: "« Où » avec accent indique le lieu." },
            { type: 'vrai_faux', q: "Dans un conte médiéval, un troubadour est un poète et musicien itinérant.", correct: true, levels: ['5eme'], exp: "Vrai : les troubadours composaient des chansons d'amour courtois." },
            // 4ème
            { q: "Dans « La femme qui porte un manteau », quel mot est le pronom relatif ?", correct: "qui", wrongs: ["la", "porte", "un"], levels: ['4eme', '3eme'], exp: "« Qui » introduit la proposition subordonnée relative." },
            { q: "Quelle figure de style compare sans outil de comparaison dans « Cet homme est un lion » ?", correct: "la métaphore", wrongs: ["la comparaison", "la litote", "l'hyperbole"], levels: ['4eme', '3eme'], exp: "Sans 'comme' ou 'tel', l'assimilation directe est une métaphore." },
            { q: "Quel auteur du XIXe siècle est célèbre pour ses nouvelles fantastiques comme « Le Horla » ?", correct: "Guy de Maupassant", wrongs: ["Victor Hugo", "Molière", "Rabelais"], levels: ['4eme'], exp: "Maupassant excelle dans le fantastique psychologique." },
            { q: "À la voix passive, quelle est la phrase correcte pour « Le chat mange la souris » ?", correct: "La souris est mangée par le chat.", wrongs: ["La souris mange le chat.", "Le chat est mangé par la souris.", "La souris a mangé le chat."], levels: ['4eme'], exp: "Le COD devient sujet et le sujet devient complément d'agent." },
            { q: "Quel mode exprime une action incertaine ou soumise à condition ?", correct: "le conditionnel", wrongs: ["l'indicatif", "l'impératif", "l'infinitif"], levels: ['4eme', '3eme'], exp: "Le conditionnel traduit le potentiel, l'irréel ou l'hypothèse." },
            // 3ème (Brevet)
            { q: "Dans le discours indirect au passé, que devient « Je viens » ?", correct: "qu'il venait", wrongs: ["qu'il vient", "qu'il viendra", "qu'il vînt"], levels: ['3eme'], exp: "Concordance des temps : le présent devient de l'imparfait." },
            { q: "Quelle figure de style consiste à répéter un mot en début de vers ou de phrase ?", correct: "l'anaphore", wrongs: ["l'oxymore", "le chiasme", "la métonymie"], levels: ['3eme', '2nde'], exp: "L'anaphore crée un effet de rythme et d'insistance." },
            { q: "Quel connecteur logique introduit une conséquence ?", correct: "donc", wrongs: ["parce que", "mais", "bien que"], levels: ['3eme'], exp: "« Donc » marque la conséquence d'une prémisse." },
            { q: "Quel genre littéraire correspond au récit de la vie d'un auteur écrit par lui-même ?", correct: "l'autobiographie", wrongs: ["la biographie", "l'épopée", "le conte"], levels: ['3eme', '2nde'], exp: "Auto (soi-même) + bio (vie) + graphie (écriture)." },
            { q: "Quelle figure de style oppose deux termes contradictoires dans une même expression (ex: « Une obscure clarté ») ?", correct: "un oxymore", wrongs: ["une hyperbole", "un euphémisme", "une prétérition"], levels: ['3eme', '2nde'], exp: "L'oxymore réunit deux mots de sens opposé côte à côte." },
            // 2nde
            { q: "En versification, comment appelle-t-on un vers de 12 syllabes ?", correct: "un alexandrin", wrongs: ["un décasyllabe", "un octosyllabe", "un hémistiche"], levels: ['2nde', '1ere'], exp: "L'alexandrin est le vers noble de la poésie classique française." },
            { q: "Quel registre cherche à susciter la pitié et l'attendrissement du lecteur ?", correct: "le registre pathétique", wrongs: ["le registre tragique", "le registre polémique", "le registre comique"], levels: ['2nde'], exp: "Du grec pathos (souffrance, émotion forte)." },
            { q: "Quelle figure de style atténue une réalité choquante (ex: « Il nous a quittés » pour « Il est mort ») ?", correct: "un euphémisme", wrongs: ["une litote", "une anaphore", "une prétérition"], levels: ['2nde', '1ere'], exp: "L'euphémisme adoucit l'expression d'une idée pénible." },
            { q: "Dans une pièce de théâtre, comment appelle-t-on les indications scéniques données par l'auteur ?", correct: "les didascalies", wrongs: ["les répliques", "les tirades", "les apartés"], levels: ['2nde', '1ere'], exp: "Les didascalies guident la mise en scène, le ton et les mouvements." },
            // 1ère (Bac de Français)
            { q: "Quel poète est l'auteur du recueil « Les Fleurs du Mal » (1857) ?", correct: "Charles Baudelaire", wrongs: ["Arthur Rimbaud", "Paul Verlaine", "Stéphane Mallarmé"], levels: ['1ere', 'terminale'], exp: "Baudelaire y explore la tension entre Spleen et Idéal." },
            { q: "Quelle figure de style dit le moins pour faire entendre le plus (ex: « Va, je ne te hais point ») ?", correct: "la litote", wrongs: ["l'hyperbole", "la métonymie", "le chiasme"], levels: ['1ere', '2nde'], exp: "La litote renforce le propos en feignant de l'atténuer." },
            { q: "Quel mouvement littéraire du XVIe siècle place l'être humain et le savoir au centre des préoccupations ?", correct: "l'humanisme", wrongs: ["les Lumières", "le romantisme", "le symbolisme"], levels: ['1ere'], exp: "Rabelais et Montaigne sont des figures majeures de l'humanisme." },
            // Terminale
            { q: "Quel écrivain et philosophe a rédigé « L'Étranger » et « Le Mythe de Sisyphe » ?", correct: "Albert Camus", wrongs: ["Jean-Paul Sartre", "André Gide", "Marcel Proust"], levels: ['terminale'], exp: "Camus y développe sa philosophie de l'Absurde." },
            { q: "À quel courant théâtral du XXe siècle associe-t-on Samuel Beckett et Eugène Ionesco ?", correct: "le théâtre de l'absurde", wrongs: ["le drame romantique", "la tragédie classique", "le vaudeville"], levels: ['terminale'], exp: "Ce théâtre dénonce l'incohérence et la vacuité du langage humain." },
            { q: "Quel concept désigne la perte de sens et le dégoût existentiel chez Sartre ?", correct: "la Nausée", wrongs: ["le Spleen", "l'Angoisse pure", "le Mal du siècle"], levels: ['terminale'], exp: "Dans le roman 'La Nausée' (1938), Roquentin ressent l'existence brute des choses." }
        ],

        histoire: [
            // 6ème
            { q: "En quelle année l'écriture apparaît-elle en Mésopotamie (environ) ?", correct: "-3300 av. J.-C.", wrongs: ["-1000 av. J.-C.", "an 0", "-10000 av. J.-C."], levels: ['6eme'], exp: "L'écriture cunéiforme naît en Mésopotamie vers 3300 avant notre ère." },
            { q: "Dans la Grèce antique, quelle cité est considérée comme le berceau de la démocratie ?", correct: "Athènes", wrongs: ["Sparte", "Mycènes", "Troie"], levels: ['6eme'], exp: "Athènes a instauré l'Ecclésia et l'isonomie au Ve siècle av. J.-C." },
            { q: "Quel homme politique athénien a dirigé la cité lors de son apogée au Ve siècle av. J.-C. ?", correct: "Périclès", wrongs: ["Alexandre le Grand", "Homère", "Solon"], levels: ['6eme'], exp: "Le 'siècle de Périclès' correspond à l'apogée démocratique et artistique d'Athènes." },
            { q: "Qui fut le premier empereur romain ?", correct: "Auguste", wrongs: ["Jules César", "Néron", "Marc Aurèle"], levels: ['6eme'], exp: "Octave prend le titre d'Auguste en 27 avant J.-C." },
            { q: "Quel fleuve traverse l'Égypte antique et permettait l'agriculture grâce à ses crues fertilisantes ?", correct: "le Nil", wrongs: ["l'Euphrate", "le Tigre", "le Jourdain"], levels: ['6eme'], exp: "Hérodote disait que 'l'Égypte est un don du Nil'." },
            // 5ème
            { q: "Qui a été sacré empereur à Rome le jour de Noël en l'an 800 ?", correct: "Charlemagne", wrongs: ["Clovis", "Hugues Capet", "Saint Louis"], levels: ['5eme'], exp: "Le pape Léon III a couronné Charlemagne empereur d'Occident." },
            { q: "Quelle ville était la prestigieuse capitale de l'Empire byzantin ?", correct: "Constantinople", wrongs: ["Rome", "Alexandrie", "Antioche"], levels: ['5eme'], exp: "Anciennement Byzance, elle est devenue Istanbul en 1453." },
            { q: "Quel roi de France a remporté la bataille de Bouvines en 1214 ?", correct: "Philippe Auguste", wrongs: ["Louis XIV", "François Ier", "Henri IV"], levels: ['5eme'], exp: "Cette victoire a puissamment consolidé l'autorité royale capétienne." },
            { q: "Quelle héroïne a délivré Orléans en 1429 pendant la guerre de Cent Ans ?", correct: "Jeanne d'Arc", wrongs: ["Aliénor d'Aquitaine", "Catherine de Médicis", "Blanche de Castille"], levels: ['5eme'], exp: "Jeanne d'Arc a conduit le dauphin Charles VII à être sacré à Reims." },
            // 4ème
            { q: "En quelle année la Bastille a-t-elle été prise par le peuple parisien ?", correct: "1789", wrongs: ["1799", "1804", "1792"], levels: ['4eme', '3eme'], exp: "Le 14 juillet 1789 marque l'entrée du peuple dans la Révolution." },
            { q: "Quel roi de France a été exécuté sur la guillotine en janvier 1793 ?", correct: "Louis XVI", wrongs: ["Louis XIV", "Louis XV", "Charles X"], levels: ['4eme'], exp: "Condamné par la Convention nationale, Louis XVI est exécuté place de la Révolution." },
            { q: "Quel philosophe des Lumières a dirigé l'Encyclopédie avec d'Alembert ?", correct: "Denis Diderot", wrongs: ["Voltaire", "Rousseau", "Montesquieu"], levels: ['4eme'], exp: "L'Encyclopédie visait à rassembler et diffuser tous les savoirs de l'époque." },
            { q: "En quelle année Napoléon Bonaparte se fait-il sacrer empereur des Français ?", correct: "1804", wrongs: ["1799", "1815", "1792"], levels: ['4eme', '2nde'], exp: "Le sacre a eu lieu à Notre-Dame de Paris le 2 décembre 1804." },
            { q: "En quelle année la France abolit-elle définitivement l'esclavage grâce à Victor Schœlcher ?", correct: "1848", wrongs: ["1789", "1804", "1871"], levels: ['4eme', '2nde'], exp: "Le décret du gouvernement provisoire de la IIe République date d'avril 1848." },
            // 3ème (Brevet)
            { q: "En quelle année la Première Guerre mondiale a-t-elle débuté ?", correct: "1914", wrongs: ["1916", "1918", "1912"], levels: ['3eme'], exp: "L'attentat de Sarajevo en juin 1914 déclenche l'engrenage des alliances." },
            { q: "Quelle célèbre bataille de 1916 a opposé Français et Allemands dans l'enfer des tranchées ?", correct: "la bataille de Verdun", wrongs: ["la bataille de la Somme", "la bataille de la Marne", "la bataille d'Austerlitz"], levels: ['3eme'], exp: "Verdun a fait plus de 300 000 morts et disparus en 10 mois." },
            { q: "Quel général a lancé l'appel à la résistance depuis Londres le 18 juin 1940 ?", correct: "Charles de Gaulle", wrongs: ["Philippe Pétain", "Jean Moulin", "Gaston Doumergue"], levels: ['3eme'], exp: "Cet appel radio fonde la France libre contre l'armistice de Pétain." },
            { q: "En quelle année le mur de Berlin est-il tombé, annonçant la fin de la guerre froide ?", correct: "1989", wrongs: ["1991", "1975", "1985"], levels: ['3eme', 'terminale'], exp: "Le mur s'ouvre dans la nuit du 9 novembre 1989." },
            { q: "En quelle année la Ve République française a-t-elle été instaurée par De Gaulle ?", correct: "1958", wrongs: ["1944", "1968", "1946"], levels: ['3eme', '1ere'], exp: "La Constitution de 1958 renforce considérablement le pouvoir exécutif." },
            // 2nde
            { q: "Quel navigateur a atteint les îles des Caraïbes en octobre 1492 ?", correct: "Christophe Colomb", wrongs: ["Vasco de Gama", "Fernand de Magellan", "Jacques Cartier"], levels: ['2nde'], exp: "Financé par les rois catholiques d'Espagne, il cherchait la route des Indes." },
            { q: "Quel réformateur allemand a placardé ses 95 thèses à Wittenberg en 1517 ?", correct: "Martin Luther", wrongs: ["Jean Calvin", "Érasme", "Thomas More"], levels: ['2nde'], exp: "Cet événement marque la naissance de la Réforme protestante." },
            { q: "Quel roi français a signé l'Édit de Nantes en 1598 pour clore les guerres de religion ?", correct: "Henri IV", wrongs: ["François Ier", "Louis XIV", "Charles IX"], levels: ['2nde'], exp: "L'édit reconnaissait la liberté de culte aux protestants." },
            // 1ère
            { q: "Quelle loi fondamentale de 1905 institue la séparation des Églises et de l'État en France ?", correct: "la loi de 1905", wrongs: ["le décret d'Allarde", "la loi Jules Ferry", "la constitution de 1875"], levels: ['1ere'], exp: "La République assure la liberté de conscience et ne salarie aucun culte." },
            { q: "Quel événement révolutionnaire parisien de 1871 s'est achevé lors de la 'Semaine sanglante' ?", correct: "la Commune de Paris", wrongs: ["la Fronde", "les Trois Glorieuses", "la Terreur"], levels: ['1ere'], exp: "L'insurrection a été violemment réprimée par le gouvernement de Thiers." },
            { q: "Quel officier juif français a été victime d'une célèbre erreur judiciaire antisémite en 1894 ?", correct: "Alfred Dreyfus", wrongs: ["Jean Jaurès", "Georges Clemenceau", "Émile Zola"], levels: ['1ere'], exp: "Zola a publié 'J'accuse... !' en 1898 pour dénoncer sa condamnation." },
            // Terminale
            { q: "En quelle année les accords d'Évian ont-ils scellé la fin de la guerre d'Algérie ?", correct: "1962", wrongs: ["1954", "1958", "1968"], levels: ['terminale'], exp: "Signés en mars 1962, ils conduisent à l'indépendance de l'Algérie." },
            { q: "Quelle crise majeure d'octobre 1962 a frôlé la guerre nucléaire entre les USA et l'URSS ?", correct: "la crise des missiles de Cuba", wrongs: ["la crise du canal de Suez", "le blocus de Berlin", "la guerre de Corée"], levels: ['terminale'], exp: "Kennedy et Khrouchtchev ont négocié le retrait des missiles soviétiques." },
            { q: "En quelle année l'URSS a-t-elle été officiellement dissoute ?", correct: "1991", wrongs: ["1989", "1985", "1995"], levels: ['terminale'], exp: "Gorbatchev démissionne le 25 décembre 1991, scellant la fin de l'Union soviétique." }
        ],

        geo: [
            // 6ème
            { q: "Combien d'océans principaux compte la planète Terre ?", correct: "5", wrongs: ["3", "7", "4"], levels: ['6eme'], exp: "Pacifique, Atlantique, Indien, Arctique et Austral." },
            { q: "Quelle est la capitale de l'Espagne ?", correct: "Madrid", wrongs: ["Barcelone", "Séville", "Valence"], levels: ['6eme'], exp: "Madrid est la capitale et la plus grande ville d'Espagne." },
            { q: "Quel est le plus grand continent par la superficie et la population ?", correct: "l'Asie", wrongs: ["l'Afrique", "l'Amérique", "l'Europe"], levels: ['6eme'], exp: "L'Asie abrite plus de 4,5 milliards d'habitants." },
            { q: "Quelle chaîne de montagnes abrite le Mont Blanc ?", correct: "les Alpes", wrongs: ["les Pyrénées", "les Vosges", "le Massif central"], levels: ['6eme', '5eme'], exp: "Le Mont Blanc culmine à 4 808 mètres dans les Alpes." },
            { q: "Quel est le plus grand désert chaud de la planète ?", correct: "le Sahara", wrongs: ["le désert de Gobi", "le désert d'Atacama", "le Kalahari"], levels: ['6eme'], exp: "Le Sahara s'étend sur plus de 9 millions de km² en Afrique du Nord." },
            // 5ème
            { q: "Comment appelle-t-on la baisse de la fécondité accompagnée d'une baisse de la mortalité ?", correct: "la transition démographique", wrongs: ["l'exode rural", "la métropolisation", "l'étalement urbain"], levels: ['5eme', '2nde'], exp: "Elle fait passer une population d'un régime démographique traditionnel à moderne." },
            { q: "Quelle ressource vitale est souvent qualifiée d'« or bleu » ?", correct: "l'eau douce", wrongs: ["le pétrole", "le gaz", "le blé"], levels: ['5eme'], exp: "L'eau douce ne représente qu'environ 2,5% de toute l'eau sur Terre." },
            { q: "Quel pays est actuellement le plus peuplé du monde ?", correct: "l'Inde", wrongs: ["la Chine", "les États-Unis", "l'Indonésie"], levels: ['5eme', '2nde'], exp: "L'Inde a dépassé la Chine en 2023 avec plus de 1,4 milliard d'habitants." },
            // 4ème
            { q: "Par quel canal artificiel relie-t-on la Méditerranée à la mer Rouge ?", correct: "le canal de Suez", wrongs: ["le canal de Panama", "le détroit de Gibraltar", "le détroit du Bosphore"], levels: ['4eme', 'terminale'], exp: "Inauguré en 1869, le canal de Suez évite de contourner l'Afrique." },
            { q: "Quel terme désigne la concentration croissante des activités sur les littoraux ?", correct: "la littoralisation", wrongs: ["la désertification", "la continentalisation", "la déforestation"], levels: ['4eme', 'terminale'], exp: "Elle est stimulée par le commerce maritime mondial et le tourisme." },
            { q: "Comment qualifie-t-on une ville géante de plus de 10 millions d'habitants ?", correct: "une mégapole", wrongs: ["une mégalopolis", "un technopôle", "une banlieue"], levels: ['4eme', '1ere'], exp: "Exemples : Tokyo, Delhi, Shanghai, São Paulo, Le Caire." },
            // 3ème (Brevet)
            { q: "Quel est le plus long fleuve de France métropolitaine ?", correct: "la Loire", wrongs: ["la Seine", "le Rhône", "la Garonne"], levels: ['3eme', '6eme'], exp: "La Loire mesure 1 006 km de sa source au mont Gerbier-de-Jonc jusqu'à l'Atlantique." },
            { q: "Quelle île de l'océan Indien est un département et région d'outre-mer (DROM) français ?", correct: "La Réunion", wrongs: ["Madagascar", "Maurice", "Tahiti"], levels: ['3eme'], exp: "La Réunion et Mayotte sont les deux DROM français de l'océan Indien." },
            { q: "Quelle institution européenne siège principalement à Strasbourg ?", correct: "le Parlement européen", wrongs: ["la Commission européenne", "la Cour de justice", "la BCE"], levels: ['3eme'], exp: "Les députés européens s'y réunissent pour les sessions plénières." },
            // 2nde
            { q: "Que mesure l'Indicateur de Développement Humain (IDH) créé par le PNUD ?", correct: "le niveau de santé, d'éducation et de revenu", wrongs: ["uniquement la richesse économique brute", "la superficie forestière", "le taux de chômage seul"], levels: ['2nde'], exp: "L'IDH combine espérance de vie, scolarisation et RNB par habitant." },
            { q: "Quelle énergie n'émet pas directement de CO₂ pendant sa production ?", correct: "l'énergie solaire", wrongs: ["le charbon", "le gaz naturel", "le fioul"], levels: ['2nde'], exp: "Le photovoltaïque transforme directement le rayonnement solaire en électricité." },
            // 1ère
            { q: "Quel grand quartier d'affaires francilien concentre sièges sociaux et gratte-ciels ?", correct: "La Défense", wrongs: ["Montparnasse", "Bercy", "Châtelet"], levels: ['1ere'], exp: "La Défense est le premier quartier d'affaires d'Europe par son parc de bureaux." },
            { q: "Comment appelle-t-on l'arrivée de populations aisées dans des quartiers populaires rénovés ?", correct: "la gentrification", wrongs: ["la périurbanisation", "la ghettoïsation", "l'exode rural"], levels: ['1ere'], exp: "La gentrification modifie la composition sociologique d'un quartier." },
            // Terminale
            { q: "Que signifie le sigle ZEE en droit maritime international ?", correct: "Zone Économique Exclusive", wrongs: ["Zone d'Exploitation Européenne", "Zone Écologique Équilibrée", "Zone d'Échange Exceptionnel"], levels: ['terminale'], exp: "Elle s'étend jusqu'à 200 milles nautiques des côtes." },
            { q: "Par quel détroit stratégique transite un tiers du pétrole maritime mondial ?", correct: "le détroit d'Ormuz", wrongs: ["le détroit de Malacca", "le détroit de Béring", "le détroit de Magellan"], levels: ['terminale'], exp: "Il contrôle l'accès au golfe Persique entre l'Iran et Oman." },
            { q: "Quel canal transocéanique traverse l'Amérique centrale ?", correct: "le canal de Panama", wrongs: ["le canal de Suez", "le canal de Corinthe", "le canal du Midi"], levels: ['terminale'], exp: "Il relie l'océan Atlantique et l'océan Pacifique depuis 1914." }
        ],

        svt: [
            // 6ème
            { q: "Quel organite cellulaire vert permet la photosynthèse chez les végétaux ?", correct: "le chloroplaste", wrongs: ["le ribosome", "la vacuole", "le noyau"], levels: ['6eme', '5eme'], exp: "Le chloroplaste contient la chlorophylle qui capte l'énergie lumineuse." },
            { q: "Quel gaz les feuilles absorbent-elles principalement pour synthétiser leur matière organique ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le dioxygène (O₂)", "l'azote", "l'argon"], levels: ['6eme'], exp: "Le CO₂ est combiné à l'eau grâce à la lumière pour fabriquer du glucose." },
            { q: "Quelle partie de la fleur contient les grains de pollen ?", correct: "l'étamine", wrongs: ["le pistil", "le pétale", "le sépale"], levels: ['6eme'], exp: "L'étamine est l'organe reproducteur mâle de la fleur." },
            { q: "Quel est le premier maillon d'une chaîne alimentaire terrestre ?", correct: "un producteur primaire végétal", wrongs: ["un carnivore", "un décomposeur", "un herbivore"], levels: ['6eme'], exp: "Les végétaux chlorophylliens fabriquent leur matière sans consommer d'autres êtres vivants." },
            // 5ème
            { q: "Quel organe permet aux poissons d'extraire le dioxygène dissous dans l'eau ?", correct: "les branchies", wrongs: ["les poumons", "les trachées", "les opercules"], levels: ['5eme'], exp: "Les lamelles branchiales très vascularisées permettent les échanges gazeux dans l'eau." },
            { q: "Où s'effectue principalement l'absorption des nutriments vers le sang chez l'humain ?", correct: "dans l'intestin grêle", wrongs: ["dans l'estomac", "dans le côlon", "dans le foie"], levels: ['5eme'], exp: "Les villosités de l'intestin grêle offrent une surface d'échange gigantesque." },
            { q: "Quel type de volcanisme émet des coulées de lave fluide sans explosion dévastatrice ?", correct: "le volcanisme effusif", wrongs: ["le volcanisme explosif", "le volcanisme fissural", "le point chaud"], levels: ['5eme'], exp: "Les volcans rouges (comme à Hawaï ou à La Réunion) sont effusifs." },
            // 4ème
            { q: "Quelle cellule spécialisée conduit l'influx nerveux dans l'organisme ?", correct: "le neurone", wrongs: ["l'hématie", "l'adipocyte", "le lymphocyte"], levels: ['4eme'], exp: "Le neurone transmet des signaux électriques le long de son axone." },
            { q: "Comment nomme-t-on la zone de jonction chimique entre deux neurones ?", correct: "la synapse", wrongs: ["l'axone", "la dendrite", "la gaine de myéline"], levels: ['4eme', 'terminale'], exp: "Les neurotransmetteurs franchissent la fente synaptique." },
            { q: "Quelle hormone mâle est sécrétée par les testicules dès la puberté ?", correct: "la testostérone", wrongs: ["l'œstrogène", "la progestérone", "l'insuline"], levels: ['4eme'], exp: "Elle stimule le développement des caractères sexuels secondaires masculins." },
            // 3ème (Brevet)
            { q: "Combien de chromosomes comporte une cellule humaine non reproductrice saine ?", correct: "46 chromosomes", wrongs: ["23 chromosomes", "48 chromosomes", "44 chromosomes"], levels: ['3eme'], exp: "46 chromosomes répartis en 23 paires." },
            { q: "Quelle macromolécule en forme de double hélice porte le code génétique ?", correct: "l'ADN", wrongs: ["l'ARN", "l'ATP", "le glycogène"], levels: ['3eme', '2nde'], exp: "L'acide désoxyribonucléique porte les gènes." },
            { q: "Comment qualifie-t-on un allèle qui s'exprime même s'il n'est présent qu'en un seul exemplaire ?", correct: "dominant", wrongs: ["récessif", "codominant", "muet"], levels: ['3eme', '2nde'], exp: "Un allèle récessif doit être présent sur les deux chromosomes pour s'exprimer." },
            { q: "Quel globule blanc détruit les corps étrangers par phagocytose ?", correct: "le phagocyte (macrophage)", wrongs: ["la plaquette", "l'hématie", "le neurone"], levels: ['3eme'], exp: "La phagocytose est la première ligne de défense immunitaire non spécifique." },
            // 2nde
            { q: "Quel organite cellulaire produit l'ATP par la respiration cellulaire ?", correct: "la mitochondrie", wrongs: ["le lysosome", "l'appareil de Golgi", "le centrosome"], levels: ['2nde', '1ere'], exp: "La mitochondrie est la 'centrale énergétique' de la cellule aérobie." },
            { q: "Quelles bases azotées s'associent dans l'ADN par complémentarité ?", correct: "A avec T, et C avec G", wrongs: ["A avec C, et T avec G", "A avec U, et C avec T", "A avec G, et T avec C"], levels: ['2nde'], exp: "Adénine-Thymine (2 liaisons H) et Cytosine-Guanine (3 liaisons H)." },
            // 1ère
            { q: "Quelle phase de la mitose sépare les chromatides sœurs vers les pôles opposés ?", correct: "l'anaphase", wrongs: ["la prophase", "la métaphase", "la télophase"], levels: ['1ere'], exp: "Les fuseaux mitotiques tractent les chromatides séparées lors de l'anaphase." },
            { q: "Quel type de lymphocytes sécrète des anticorps spécifiques circulants ?", correct: "les lymphocytes B (plasmocytes)", wrongs: ["les lymphocytes T cytotoxiques", "les macrophages", "les hématies"], levels: ['1ere', 'terminale'], exp: "Les plasmocytes sont issus de la différenciation des lymphocytes B activés." },
            // Terminale
            { q: "Quel mécanisme d'échange de fragments entre chromatides survient en prophase I de méiose ?", correct: "le crossing-over", wrongs: ["la mutation ponctuelle", "la dérive génétique", "l'épissage alternatif"], levels: ['terminale'], exp: "Le brassage intrachromosomique multiplie la diversité génétique des gamètes." },
            { q: "Quel réflexe involontaire contracte un muscle en réponse à son propre étirement ?", correct: "le réflexe myotatique", wrongs: ["le réflexe conditionné", "le réflexe cornéen", "le réflexe nociceptif"], levels: ['terminale'], exp: "Le réflexe rotulien en est l'exemple clinique classique." }
        ],

        physique: [
            // 6ème
            { q: "Dans quel état la matière s'adapte au récipient tout en conservant un volume fixe ?", correct: "liquide", wrongs: ["solide", "gazeux", "plasma"], levels: ['6eme'], exp: "Un liquide a un volume propre mais pas de forme propre." },
            { q: "Quel instrument mesure une masse ?", correct: "une balance", wrongs: ["une éprouvette", "un thermomètre", "un dynamomètre"], levels: ['6eme'], exp: "La balance mesure la masse (en g ou kg) ; le dynamomètre mesure une force." },
            { q: "Quel composant délivre la tension dans un circuit électrique autonome ?", correct: "la pile (générateur)", wrongs: ["la lampe", "l'interrupteur", "le fil"], levels: ['6eme'], exp: "Le générateur met en mouvement les charges électriques." },
            // 5ème
            { q: "À quelle température l'eau pure gèle-t-elle à pression atmosphérique normale ?", correct: "0 °C", wrongs: ["100 °C", "-10 °C", "4 °C"], levels: ['5eme'], exp: "0 °C est la température de solidification de l'eau pure à 1 atm." },
            { q: "Comment nomme-t-on un mélange où l'on ne distingue aucun constituant distinct à l'œil nu ?", correct: "un mélange homogène", wrongs: ["un mélange hétérogène", "un corps pur", "une émulsion"], levels: ['5eme'], exp: "L'eau et le sel dissous forment un mélange homogène." },
            { q: "Si une ampoule est dévissée dans un circuit en série, que se passe-t-il ?", correct: "le circuit est ouvert, tout s'éteint", wrongs: ["les autres brillent deux fois plus", "rien ne change", "les fils chauffent"], levels: ['5eme'], exp: "En série, le courant ne dispose que d'une seule boucle." },
            // 4ème
            { q: "Quelle est la vitesse approximative de la lumière dans le vide ?", correct: "300 000 km/s", wrongs: ["150 000 km/s", "3 000 000 km/s", "30 000 km/s"], levels: ['4eme', '3eme'], exp: "Exactement 299 792 458 m/s, soit environ 300 000 km/s." },
            { q: "Quelle formule donne la masse volumique ρ ?", correct: "ρ = m / V", wrongs: ["ρ = m × V", "ρ = V / m", "ρ = m + V"], levels: ['4eme'], exp: "La masse volumique est la masse par unité de volume (ex: kg/m³ ou g/cm³)." },
            // 3ème (Brevet)
            { q: "Quelle loi électrique relie la tension U, la résistance R et l'intensité I ?", correct: "la loi d'Ohm (U = R × I)", wrongs: ["la loi de Newton", "la loi de Joule", "la loi de Coulomb"], levels: ['3eme'], exp: "Découverte par Georg Ohm en 1827." },
            { q: "Quelle unité du Système International mesure la puissance électrique ?", correct: "le watt (W)", wrongs: ["le joule (J)", "le volt (V)", "l'ampère (A)"], levels: ['3eme'], exp: "Le watt honore l'ingénieur écossais James Watt." },
            { q: "Quelle formule donne l'énergie cinétique d'un solide de masse m se déplaçant à vitesse v ?", correct: "Ec = 1/2 m v²", wrongs: ["Ec = m × g × h", "Ec = m × v", "Ec = 1/2 m² v"], levels: ['3eme', '1ere'], exp: "L'énergie cinétique dépend du carré de la vitesse." },
            { q: "Quel instrument mesure l'intensité d'une force en newtons ?", correct: "un dynamomètre", wrongs: ["une balance", "un voltmètre", "un baromètre"], levels: ['3eme'], exp: "Le dynamomètre utilise l'allongement d'un ressort calibré." },
            // 2nde
            { q: "Quelle loi régit la réfraction de la lumière entre deux milieux d'indices n₁ et n₂ ?", correct: "la loi de Snell-Descartes", wrongs: ["la loi de Kepler", "la loi d'Ohm", "la loi de Beer-Lambert"], levels: ['2nde'], exp: "n₁ × sin(i₁) = n₂ × sin(i₂)." },
            { q: "D'après le principe d'inertie, quel est l'état d'un objet si les forces appliquées se compensent ?", correct: "immobile ou en mouvement rectiligne uniforme", wrongs: ["en accélération constante", "sur une orbite circulaire", "au repos absolu sans mouvement possible"], levels: ['2nde', '1ere'], exp: "Première loi de Newton : la vitesse vectorielle reste constante." },
            // 1ère
            { q: "Quelle relation relie longueur d'onde λ, célérité v et fréquence f ?", correct: "λ = v / f", wrongs: ["λ = v × f", "λ = f / v", "λ = v × f²"], levels: ['1ere'], exp: "Puisque T = 1/f, λ = v × T = v / f." },
            { q: "Comment s'exprime l'énergie mécanique totale sans forces de frottement ?", correct: "Em = Ec + Ep", wrongs: ["Em = Ec - Ep", "Em = Ec × Ep", "Em = Ec / Ep"], levels: ['1ere'], exp: "En l'absence de dissipation, Em reste constante au cours du mouvement." },
            // Terminale
            { q: "Quelle formule résume la 2e loi de Newton pour un point matériel de masse constante ?", correct: "ΣF = m × a", wrongs: ["ΣF = m × v", "ΣF = 1/2 m v²", "ΣF = m × g"], levels: ['terminale'], exp: "La résultante des forces extérieures est égale au produit de la masse par l'accélération." },
            { q: "Quel phénomène modifie la fréquence perçue d'une onde lorsque l'émetteur est en mouvement ?", correct: "l'effet Doppler", wrongs: ["l'effet Joule", "l'effet photoélectrique", "l'effet Hall"], levels: ['terminale'], exp: "Le son devient plus aigu à l'approche et plus grave lors de l'éloignement." }
        ],

        chimie: [
            // 6ème
            { q: "Quelle est la formule chimique de la molécule d'eau ?", correct: "H₂O", wrongs: ["CO₂", "O₂", "NaCl"], levels: ['6eme', '5eme'], exp: "Deux atomes d'hydrogène et un atome d'oxygène." },
            { q: "Quel composé blanc bleuit en présence d'eau ?", correct: "le sulfate de cuivre anhydre", wrongs: ["l'eau de chaux", "le papier pH", "le sel fin"], levels: ['6eme'], exp: "C'est le test chimique caractéristique de présence d'eau." },
            // 5ème
            { q: "Quel gaz trouble l'eau de chaux incolore ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le dioxygène", "le diazote", "le méthane"], levels: ['5eme'], exp: "Le CO₂ réagit avec l'hydroxyde de calcium pour former un précipité blanc de calcaire." },
            { q: "Quel pourcentage volumique de diazote (N₂) l'air contient-il environ ?", correct: "environ 78 %", wrongs: ["environ 21 %", "environ 50 %", "environ 1 %"], levels: ['5eme'], exp: "L'air est composé d'environ 78% de N₂, 21% de O₂ et 1% d'autres gaz." },
            // 4ème
            { q: "Combien d'atomes d'hydrogène y a-t-il dans une molécule de méthane (CH₄) ?", correct: "4", wrongs: ["1", "2", "5"], levels: ['4eme'], exp: "1 atome de carbone central lié à 4 atomes d'hydrogène." },
            { q: "Lors de la combustion complète du carbone dans le dioxygène, quel gaz est formé ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le monoxyde de carbone (CO)", "le dihydrogène (H₂)", "l'ozone (O₃)"], levels: ['4eme'], exp: "C + O₂ → CO₂." },
            // 3ème (Brevet)
            { q: "Quel est le pH d'une solution neutre à 25 °C ?", correct: "7", wrongs: ["0", "14", "1"], levels: ['3eme'], exp: "À 25 °C : pH < 7 acide, pH = 7 neutre, pH > 7 basique." },
            { q: "Un atome neutre qui capte un électron devient :", correct: "un anion (ion négatif)", wrongs: ["un cation (ion positif)", "un isotope", "un neutron"], levels: ['3eme'], exp: "Les électrons étant négatifs, leur gain produit une charge globale négative." },
            { q: "Quel ion est responsable de l'acidité d'une solution aqueuse ?", correct: "l'ion hydrogène H⁺ (ou H₃O⁺)", wrongs: ["l'ion hydroxyde HO⁻", "l'ion chlorure Cl⁻", "l'ion sodium Na⁺"], levels: ['3eme'], exp: "Plus la concentration en ions H⁺ est haute, plus le pH est faible." },
            // 2nde
            { q: "Quelle unité fondamentale mesure la quantité de matière en chimie ?", correct: "la mole (mol)", wrongs: ["le gramme (g)", "le litre (L)", "le joule (J)"], levels: ['2nde'], exp: "Une mole contient N_A entités (environ 6,02 × 10²³)." },
            { q: "Quelle est la valeur de la constante d'Avogadro N_A ?", correct: "6,02 × 10²³ mol⁻¹", wrongs: ["6,02 × 10²⁶ mol⁻¹", "1,60 × 10⁻¹⁹ C", "3,00 × 10⁸ m/s"], levels: ['2nde', '1ere'], exp: "Elle relie le monde microscopique atomique au monde macroscopique." },
            { q: "Dans une réaction, comment nomme-t-on le réactif qui s'épuise en premier ?", correct: "le réactif limitant", wrongs: ["le réactif en excès", "le produit final", "le catalyseur"], levels: ['2nde'], exp: "Son épuisement stoppe l'avancement de la réaction." },
            // 1ère
            { q: "Dans une réaction d'oxydoréduction, qu'est-ce qu'un réducteur ?", correct: "une espèce capable de céder un ou plusieurs électrons", wrongs: ["une espèce qui capte des électrons", "une espèce qui libère un proton", "un acide fort"], levels: ['1ere'], exp: "Oxydant = capteur d'électrons ; Réducteur = donneur d'électrons." },
            { q: "Quelle loi relie l'absorbance A d'une solution colorée à sa concentration C ?", correct: "la loi de Beer-Lambert (A = k × C)", wrongs: ["la loi d'Ohm", "la loi de Boyle-Mariotte", "la loi de Lavoisier"], levels: ['1ere'], exp: "À longueur d'onde fixée, l'absorbance est proportionnelle à la concentration." },
            // Terminale
            { q: "Comment est définie la constante d'acidité Ka d'un couple AH / A⁻ ?", correct: "Ka = ([A⁻] × [H₃O⁺]) / [AH]", wrongs: ["Ka = [AH] / [A⁻]", "Ka = [H₃O⁺] × [HO⁻]", "Ka = pH × [A⁻]"], levels: ['terminale'], exp: "Elle quantifie la force de dissociation de l'acide dans l'eau." },
            { q: "Quelle substance accélère une réaction chimique sans apparaître dans son équation bilan ?", correct: "un catalyseur", wrongs: ["un inhibiteur", "un réactif limitant", "un solvant inerte"], levels: ['terminale'], exp: "Le catalyseur abaisse l'énergie d'activation sans être consommé." }
        ],

        techno: [
            // 6ème (Collège uniquement)
            { q: "À quelle famille de matériaux appartiennent le chêne et le pin ?", correct: "les matières organiques (bois)", wrongs: ["les métaux", "les céramiques", "les plastiques"], levels: ['6eme'], exp: "Le bois est issu du règne végétal vivant." },
            { q: "Sur un vélo, quel sous-ensemble transmet l'effort musculaire à la roue motrice ?", correct: "le pédalier, la chaîne et les pignons", wrongs: ["les étriers de frein", "le guidon", "la potence"], levels: ['6eme'], exp: "C'est la chaîne cinématique de transmission par chaîne." },
            { q: "Quelle fonction décrit le besoin principal auquel répond un objet technique ?", correct: "la fonction d'usage", wrongs: ["la fonction d'estime", "la fonction de recyclage", "le cahier des notes"], levels: ['6eme', '5eme'], exp: "La fonction d'usage répond à la question : à quoi sert l'objet ?" },
            { q: "Quel matériau issu de la bauxite est très apprécié pour sa légèreté et sa résistance à la corrosion ?", correct: "l'aluminium", wrongs: ["la fonte", "le granit", "le verre"], levels: ['6eme', '5eme'], exp: "L'aluminium est léger et très utilisé dans les transports." },
            // 5ème
            { q: "Quel type d'ouvrage suspend sa chaussée à de hauts pylônes au moyen de câbles tendus ?", correct: "un pont à haubans", wrongs: ["un pont en arc", "un pont à poutres", "un pont levant"], levels: ['5eme'], exp: "Le viaduc de Millau ou le pont de Normandie sont des ponts à haubans." },
            { q: "Quelle source d'énergie renouvelable est captée par une éolienne ?", correct: "l'énergie cinétique du vent", wrongs: ["l'énergie thermique", "l'énergie solaire directe", "l'énergie marémotrice"], levels: ['5eme'], exp: "Les pales convertissent la force du vent en rotation." },
            { q: "Quel document décrit l'ensemble des contraintes et exigences à respecter pour concevoir un produit ?", correct: "le cahier des charges fonctionnel", wrongs: ["la notice de montage", "la facture d'achat", "le brevet commercial"], levels: ['5eme', '4eme'], exp: "Le cahier des charges définit les fonctions de service et critères attendus." },
            // 4ème
            { q: "Dans un système automatisé, quel organe prélève une grandeur physique de l'environnement ?", correct: "un capteur", wrongs: ["un actionneur", "un moteur", "un vérin"], levels: ['4eme'], exp: "Le capteur transforme une grandeur physique (température, lumière) en signal." },
            { q: "Quel polymère thermoplastique biodégradable est le plus répandu en impression 3D FDM ?", correct: "le PLA", wrongs: ["le PVC", "le téflon", "le plomb"], levels: ['4eme'], exp: "Le PLA est produit à partir d'amidon de maïs ou de canne à sucre." },
            { q: "Dans une chaîne d'énergie, quel bloc transforme l'énergie électrique en mouvement mécanique ?", correct: "le convertisseur (ex: moteur)", wrongs: ["le capteur", "l'interface homme-machine", "la batterie seule"], levels: ['4eme', '3eme'], exp: "Un moteur convertit l'énergie électrique en énergie mécanique." },
            // 3ème (Brevet)
            { q: "Quelle suite finie et ordonnée d'instructions résout un problème pas à pas ?", correct: "un algorithme", wrongs: ["un processeur", "une base de données", "un compilateur"], levels: ['3eme'], exp: "L'algorithme est transcrit dans un langage de programmation." },
            { q: "Quelle technologie sans fil à courte portée connecte clavier, souris ou écouteurs ?", correct: "le Bluetooth", wrongs: ["la 5G", "la fibre optique", "le câble coaxial"], levels: ['3eme'], exp: "Le Bluetooth opère par ondes radio UHF sur la bande 2,4 GHz." },
            { q: "Dans un réseau local, quel équipement achemine les trames de données entre machines connectées ?", correct: "le switch (commutateur)", wrongs: ["la carte son", "l'onduleur", "l'écran"], levels: ['3eme'], exp: "Le switch filtre et distribue les paquets vers le bon port Ethernet." },
            { q: "Dans un logiciel de programmation par blocs (Scratch), quelle structure permet de répéter une série d'instructions ?", correct: "une boucle", wrongs: ["une variable globale", "un capteur ultrason", "une constante"], levels: ['6eme', '5eme', '4eme', '3eme'], exp: "Les boucles évitent de dupliquer des instructions répétitives." },
            { q: "Combien de bits contient exactement un octet ?", correct: "8 bits", wrongs: ["4 bits", "16 bits", "10 bits"], levels: ['4eme', '3eme'], exp: "Un octet est composé de 8 bits prenant chacun la valeur 0 ou 1." },
            { q: "Quelle étape de conception consiste à fabriquer un premier exemplaire fonctionnel pour tester un objet ?", correct: "le prototypage", wrongs: ["le recyclage", "la commercialisation", "l'archivage"], levels: ['3eme', '4eme'], exp: "Le prototype permet de valider les choix techniques avant la production en série." }
        ],

        anglais: [
            // 6ème
            { q: "What is the English word for « chien » ?", correct: "dog", wrongs: ["cat", "bird", "fish"], levels: ['6eme'], exp: "Dog = chien ; Cat = chat ; Bird = oiseau." },
            { q: "Complete : 'She ___ my best friend.'", correct: "is", wrongs: ["are", "am", "be"], levels: ['6eme'], exp: "With third person singular (she), use 'is'." },
            { q: "What is the opposite of 'big' ?", correct: "small", wrongs: ["fast", "loud", "heavy"], levels: ['6eme'], exp: "Big ≠ small ; tall ≠ short." },
            { q: "What day comes right after Tuesday ?", correct: "Wednesday", wrongs: ["Thursday", "Monday", "Friday"], levels: ['6eme'], exp: "Monday, Tuesday, Wednesday, Thursday..." },
            // 5ème
            { q: "Choose the correct present continuous : 'Listen, they ___ right now.'", correct: "are singing", wrongs: ["sing", "is singing", "sings"], levels: ['5eme'], exp: "Subject 'they' + are + verb-ing." },
            { q: "What is the irregular plural of 'child' ?", correct: "children", wrongs: ["childs", "childes", "childrens"], levels: ['5eme'], exp: "One child, two children." },
            { q: "How do you translate « Il est midi » in English ?", correct: "It's midday (or 12 o'clock)", wrongs: ["It's midnight", "It's twelve minutes", "It's noon past"], levels: ['5eme'], exp: "Midday ou noon désigne le milieu du jour (12:00)." },
            // 4ème
            { q: "What is the simple past of the irregular verb 'to see' ?", correct: "saw", wrongs: ["seed", "seen", "seeing"], levels: ['4eme'], exp: "See - saw - seen." },
            { q: "Choose the comparative : 'A plane is ___ than a train.'", correct: "faster", wrongs: ["more fast", "fastest", "as fast"], levels: ['4eme'], exp: "Short adjective (fast) takes -er." },
            { q: "What does the phrasal verb 'to look for' mean in French ?", correct: "chercher", wrongs: ["ressembler à", "surveiller", "regarder devant soi"], levels: ['4eme'], exp: "Look for = chercher ; look after = s'occuper de." },
            // 3ème (Brevet)
            { q: "Complete with present perfect : 'I ___ here for three years.'", correct: "have lived", wrongs: ["lived", "had lived", "am living"], levels: ['3eme'], exp: "For an action started in the past and continuing now with 'for'." },
            { q: "Which modal verb expresses strict prohibition ?", correct: "mustn't", wrongs: ["should", "might", "can"], levels: ['3eme'], exp: "Mustn't = il est interdit de." },
            { q: "What does 'it's raining cats and dogs' mean ?", correct: "il pleut des cordes", wrongs: ["des animaux tombent", "il fait grand soleil", "il y a un orage de grêle"], levels: ['3eme'], exp: "Idiomatic expression meaning heavy rain." },
            // 2nde
            { q: "Complete : 'If it rains tomorrow, we ___ stay inside.'", correct: "will", wrongs: ["would", "were", "did"], levels: ['2nde'], exp: "First conditional : If + present, will + infinitive." },
            { q: "What does the false friend 'actually' mean in French ?", correct: "en réalité / en fait", wrongs: ["actuellement", "en action", "efficacement"], levels: ['2nde'], exp: "'Currently' means actuellement ; 'actually' means en fait." },
            // 1ère
            { q: "Which modal expresses logical certainty : 'He worked 14 hours, he ___ be exhausted.'", correct: "must", wrongs: ["might", "should", "could"], levels: ['1ere'], exp: "Must express high deduction/probability." },
            { q: "What does the linker 'nevertheless' mean ?", correct: "néanmoins / toutefois", wrongs: ["en conséquence", "de plus", "par conséquent"], levels: ['1ere'], exp: "It introduces a contrast or concession." },
            // Terminale
            { q: "Complete third conditional : 'If you had revised, you ___ passed.'", correct: "would have", wrongs: ["will have", "would", "had"], levels: ['terminale'], exp: "Third conditional : If + had + past participle, would have + past participle." },
            { q: "What does the formal verb 'to jeopardize' mean ?", correct: "mettre en péril / compromettre", wrongs: ["justifier", "juger équitablement", "accélérer"], levels: ['terminale'], exp: "To endanger or put at risk." }
        ],

        emc: [
            // 6ème
            { q: "Quel document officiel régit la vie commune, les droits et les devoirs dans un collège ?", correct: "le règlement intérieur", wrongs: ["le carnet de notes", "le code de la route", "le manuel scolaire"], levels: ['6eme'], exp: "Il s'applique à tous les élèves et personnels de l'établissement." },
            { q: "Quel numéro gratuit d'urgence permet de signaler le harcèlement scolaire en France ?", correct: "le 3018", wrongs: ["le 15", "le 18", "le 112"], levels: ['6eme', '5eme'], exp: "Le 3018 est la ligne nationale dédiée aux jeunes victimes ou témoins." },
            { q: "Qui les élèves élisent-ils au premier trimestre pour siéger au conseil de classe ?", correct: "les délégués de classe", wrongs: ["le proviseur", "les surveillants", "le maire"], levels: ['6eme'], exp: "Deux délégués titulaires représentent la classe toute l'année." },
            // 5ème
            { q: "Quel principe garantit les mêmes droits et opportunités sans distinction de sexe ?", correct: "l'égalité filles-garçons", wrongs: ["le suffrage censitaire", "la coutume", "l'immunité"], levels: ['5eme'], exp: "C'est une valeur fondamentale de la République et de l'École." },
            { q: "Quelle action consiste à apporter bénévolement son aide aux personnes fragiles ?", correct: "la solidarité associative", wrongs: ["la rivalité économique", "le travail forcé", "la taxe"], levels: ['5eme'], exp: "La solidarité renforce la cohésion sociale." },
            // 4ème
            { q: "Quel document officiel affiché dans les établissements garantit la neutralité religieuse de l'État ?", correct: "la Charte de la laïcité à l'école", wrongs: ["le Code civil", "le traité de Rome", "la Déclaration de 1789"], levels: ['4eme'], exp: "Elle rappelle que la laïcité protège la liberté de croire ou de ne pas croire." },
            { q: "Quelle limite légale stricte encadre la liberté d'expression ?", correct: "l'interdiction de l'injure, de la diffamation et de la haine", wrongs: ["l'interdiction de critiquer un texte de loi", "l'obligation de voter", "aucune règle"], levels: ['4eme'], exp: "La liberté des uns s'arrête là où commencent les droits d'autrui." },
            // 3ème (Brevet)
            { q: "À quel âge s'acquiert le droit de vote et la majorité civile en France ?", correct: "18 ans", wrongs: ["16 ans", "21 ans", "20 ans"], levels: ['3eme'], exp: "La majorité a été abaissée de 21 à 18 ans en 1974 par Valéry Giscard d'Estaing." },
            { q: "Quelle est la devise officielle de la République française ?", correct: "Liberté, Égalité, Fraternité", wrongs: ["Travail, Famille, Patrie", "Ordre et Progrès", "Force et Honneur"], levels: ['3eme'], exp: "Elle est inscrite à l'article 2 de la Constitution de 1958." },
            { q: "Quelles deux assemblées votent la loi au Parlement français ?", correct: "l'Assemblée nationale et le Sénat", wrongs: ["le Conseil d'État et le Sénat", "les Députés et les Ministres", "la Cour de cassation et la Mairie"], levels: ['3eme'], exp: "Le système parlementaire français est bicaméral." },
            // 2nde
            { q: "Quel principe de justice dispose que nul ne peut être condamné sans texte de loi clair ?", correct: "la légalité des délits et des peines", wrongs: ["la présomption de culpabilité", "le secret d'État", "l'immunité absolue"], levels: ['2nde'], exp: "Principe énoncé dès 1789 dans la Déclaration des Droits de l'Homme." },
            { q: "En quelle année l'Assemblée générale de l'ONU a-t-elle adopté la DUDH ?", correct: "1948", wrongs: ["1789", "1918", "1968"], levels: ['2nde', '1ere'], exp: "Proclamée à Paris le 10 décembre 1948." },
            // 1ère
            { q: "Comment nomme-t-on un citoyen qui révèle de bonne foi des infractions graves dans l'intérêt public ?", correct: "un lanceur d'alerte", wrongs: ["un espion", "un juge d'instruction", "un délateur vénal"], levels: ['1ere'], exp: "La loi protège les lanceurs d'alerte contre les représailles." },
            { q: "Quelle autorité indépendante régule les médias audiovisuels et numériques en France ?", correct: "l'Arcom (ex-CSA)", wrongs: ["la CNIL", "le Défenseur des droits", "l'Insee"], levels: ['1ere'], exp: "L'Arcom veille au pluralisme des courants d'expression sociopolitiques." },
            // Terminale
            { q: "Quelle haute cour veille à la conformité des lois avec la Constitution ?", correct: "le Conseil constitutionnel", wrongs: ["la Cour de cassation", "le Conseil d'État", "la Cour des comptes"], levels: ['terminale'], exp: "Il traite notamment les Questions Prioritaires de Constitutionnalité (QPC)." },
            { q: "Où siège la Cour Pénale Internationale (CPI) ?", correct: "à La Haye (Pays-Bas)", wrongs: ["à Genève (Suisse)", "à New York (USA)", "à Bruxelles (Belgique)"], levels: ['terminale'], exp: "Elle juge les génocides, crimes contre l'humanité et crimes de guerre." }
        ],

        philo: [
            // Terminale uniquement (programme du Baccalauréat)
            { q: "Quel philosophe grec antique affirmait : « Tout ce que je sais, c'est que je ne sais rien » ?", correct: "Socrate", wrongs: ["Aristote", "Épicure", "Héraclite"], levels: ['terminale'], exp: "Socrate utilisait la maïeutique et l'ironie pour inciter chacun à examiner ses préjugés." },
            { q: "Dans le mythe de Platon (La République), que permet l'anneau trouvé par le berger Gygès ?", correct: "de devenir invisible à volonté", wrongs: ["de voler dans les airs", "de lire dans les pensées", "de transformer le plomb en or"], levels: ['terminale'], exp: "Ce mythe interroge si l'on resterait juste si l'on était certain de l'impunité." },
            { q: "Quelle célèbre allégorie de Platon montre des prisonniers enchaînés prenant des ombres pour la réalité ?", correct: "l'allégorie de la caverne", wrongs: ["le mythe de Sisyphe", "le tonneau des Danaïdes", "le fil d'Ariane"], levels: ['terminale'], exp: "Elle illustre le passage difficile de l'opinion sensible vers la connaissance intelligible." },
            { q: "Selon Aristote, par quelle disposition d'esprit débute toute quête philosophique ?", correct: "l'étonnement", wrongs: ["la peur", "l'ambition", "le dégoût"], levels: ['terminale'], exp: "S'étonner pousse l'esprit à rechercher les causes premières." },
            { q: "Quel concept désigne la capacité humaine de faire des choix sans détermination extérieure absolue ?", correct: "le libre arbitre", wrongs: ["le fatalisme", "le déterminisme absolu", "l'instinct"], levels: ['terminale'], exp: "Le libre arbitre fonde la responsabilité morale de nos actes." },
            { q: "Qui a formulé la certitude inaugurale : « Je pense, donc je suis » (Cogito, ergo sum) ?", correct: "René Descartes", wrongs: ["Jean-Jacques Rousseau", "Blaise Pascal", "David Hume"], levels: ['terminale'], exp: "Dans le 'Discours de la méthode' (1637), après l'épreuve du doute méthodique." },
            { q: "Quelle doctrine antique d'Épictète invite à distinguer ce qui dépend de nous de ce qui n'en dépend pas ?", correct: "le stoïcisme", wrongs: ["l'épicurisme", "le scepticisme", "le cynisme"], levels: ['terminale'], exp: "Le stoïcisme recherche l'ataraxie (tranquillité de l'âme) par la maîtrise de ses jugements." },
            { q: "Pour Jean-Jacques Rousseau, dans quel état hypothétique vivait l'homme avant les lois et la société civile ?", correct: "l'état de nature", wrongs: ["l'état de guerre permanente", "le siècle d'or industriel", "la féodalité"], levels: ['terminale'], exp: "Pour Rousseau, l'état de nature est une fiction théorique permettant de penser le contrat social." },
            { q: "Pour Sigmund Freud, quelle instance psychique abrite les désirs et pulsions refoulés ?", correct: "le Ça (l'Inconscient)", wrongs: ["le Surmoi", "le Moi conscient", "la raison pure"], levels: ['terminale'], exp: "Le Ça obéit au principe de plaisir, tandis que le Surmoi représente les interdits intériorisés." },
            { q: "Quel impératif moral kantien exige que la maxime de notre action puisse être universalisée ?", correct: "l'impératif catégorique", wrongs: ["l'impératif hypothétique", "la loi du talion", "l'utilitarisme"], levels: ['terminale'], exp: "Agis de telle sorte que la maxime de ta volonté puisse toujours valoir comme loi universelle." },
            { q: "Quel philosophe existentialiste a écrit : « L'existence précède l'essence » et « L'homme est condamné à être libre » ?", correct: "Jean-Paul Sartre", wrongs: ["Albert Camus", "Michel Foucault", "Arthur Schopenhauer"], levels: ['terminale'], exp: "Pour Sartre, l'humain n'a pas de nature prédéfinie ; il se définit par ses choix et ses actes." },
            { q: "Pour Karl Marx, quel phénomène dépossède le prolétaire du fruit et du sens de son travail ?", correct: "l'aliénation", wrongs: ["la sublimation", "l'émancipation", "l'ataraxie"], levels: ['terminale'], exp: "L'ouvrier devient étranger au produit qu'il fabrique et à sa propre activité créatrice." },
            { q: "Dans « Le Prince », quel penseur florentin analyse le pouvoir politique de manière réaliste et stratégique ?", correct: "Nicolas Machiavel", wrongs: ["Thomas More", "Montesquieu", "Alexis de Tocqueville"], levels: ['terminale'], exp: "Machiavel dissocie l'efficacité politique pragmatique de la morale traditionnelle." },
            { q: "Chez Baruch Spinoza, comment appelle-t-on l'effort par lequel chaque chose tend à persévérer dans son être ?", correct: "le conatus", wrongs: ["le logos", "le noumène", "le cogito"], levels: ['terminale'], exp: "Dans l'Éthique, le conatus est l'essence même de chaque être singulier." },
            { q: "Pour Karl Popper, quel critère distingue une théorie scientifique d'une croyance irréfutable ?", correct: "la réfutabilité (falsifiabilité)", wrongs: ["la popularité", "la certitude absolue", "l'autorité traditionnelle"], levels: ['terminale'], exp: "Une théorie est scientifique si une expérience peut potentiellement la mettre en défaut." },
            { q: "Dans la philosophie d'Épicure, quel est le souverain bien recherché par le sage ?", correct: "l'ataraxie (absence de trouble de l'âme)", wrongs: ["la richesse matérielle", "la gloire politique", "la souffrance ascétique"], levels: ['terminale'], exp: "L'épicurisme prône une vie sobre visant l'absence de douleur corporelle et de trouble psychique." },
            { q: "Selon Hannah Arendt, quelle notion désigne le fait que des crimes extrêmes puissent être commis par des fonctionnaires dépourvus de pensée critique ?", correct: "la banalité du mal", wrongs: ["la volonté de puissance", "la mauvaise foi", "le contrat social"], levels: ['terminale'], exp: "Formulée lors du procès Eichmann (1961), elle souligne le danger de l'absence de jugement." },
            { q: "Chez Jean-Paul Sartre, comment nomme-t-on le mensonge à soi-même par lequel un individu nie sa propre liberté ?", correct: "la mauvaise foi", wrongs: ["l'aliénation", "le refoulement", "le doute hyperbolique"], levels: ['terminale'], exp: "La mauvaise foi consiste à fuir l'angoisse de la liberté derrière des excuses ou un rôle." }
        ],
        nsi: [
            // Lycée uniquement (2nde SNT, 1ere NSI, Terminale NSI)
            { q: "Combien de bits contient exactement un octet (byte) ?", correct: "8 bits", wrongs: ["4 bits", "16 bits", "10 bits"], levels: ['2nde', '1ere', 'terminale'], exp: "Un octet est toujours composé de 8 bits (valeurs 0 ou 1)." },
            { q: "Quel langage est utilisé pour structurer le contenu sémantique d'une page Web ?", correct: "HTML", wrongs: ["CSS", "Python", "SQL"], levels: ['2nde', '1ere'], exp: "HTML (HyperText Markup Language) définit la structure et les balises de la page." },
            { q: "Quelle mémoire volatile rapide perd ses données lorsque l'ordinateur s'éteint ?", correct: "la mémoire vive (RAM)", wrongs: ["la mémoire morte (ROM)", "le disque SSD", "la clé USB"], levels: ['2nde', '1ere'], exp: "La RAM stocke temporairement les programmes et données en cours d'exécution." },
            { q: "En Python, quel type de variable contient une collection ordonnée et modifiable d'éléments entre crochets ?", correct: "une liste (list)", wrongs: ["un tuple", "un dictionnaire", "un entier (int)"], levels: ['2nde', '1ere', 'terminale'], exp: "Une liste s'écrit [1, 2, 3] et est mutable." },
            { q: "En Python, quel type associe des clés uniques à des valeurs entre accolades ?", correct: "un dictionnaire (dict)", wrongs: ["une liste (list)", "un tuple", "un booléen"], levels: ['1ere', 'terminale'], exp: "Exemple : {'nom': 'Ada', 'note': 19}." },
            { q: "Quelle requête SQL permet d'extraire des données d'une table sans les modifier ?", correct: "SELECT", wrongs: ["INSERT", "UPDATE", "DELETE"], levels: ['2nde', '1ere', 'terminale'], exp: "SELECT permet d'interroger la base de données relationnelle." },
            { q: "Quelle est la valeur binaire du nombre décimal 13 ?", correct: "1101", wrongs: ["1011", "1110", "1001"], levels: ['1ere', 'terminale'], exp: "13 = 8 + 4 + 0 + 1, soit 1101 en base 2." },
            { q: "Quel protocole sécurise les échanges Web en chiffrant les communications avec TLS ?", correct: "HTTPS", wrongs: ["HTTP", "FTP", "DNS"], levels: ['2nde', '1ere', 'terminale'], exp: "Le 'S' de HTTPS signifie Secure (port standard 443)." },
            { q: "Dans le modèle Von Neumann, quelle unité décode et orchestre l'exécution des instructions ?", correct: "l'unité de contrôle", wrongs: ["l'unité arithmétique et logique", "la mémoire de masse", "le bus de données"], levels: ['1ere', 'terminale'], exp: "L'unité de contrôle (séquenceur) pilote le cycle instruction (fetch, decode, execute)." },
            { q: "Quelle est la complexité temporelle du tri fusion (merge sort) dans le pire des cas ?", correct: "O(N log N)", wrongs: ["O(N²)", "O(N)", "O(log N)"], levels: ['1ere', 'terminale'], exp: "Le tri fusion applique 'diviser pour régner' en O(N log N)." },
            { q: "Quelle est la complexité temporelle d'une recherche dichotomique dans un tableau trié de taille N ?", correct: "O(log N)", wrongs: ["O(N)", "O(N²)", "O(1)"], levels: ['1ere', 'terminale'], exp: "La zone de recherche est divisée par 2 à chaque comparaison." },
            { q: "En programmation, comment appelle-t-on une fonction qui s'appelle elle-même avec un cas de base ?", correct: "une fonction récursive", wrongs: ["une fonction itérative", "une fonction anonyme", "un générateur"], levels: ['1ere', 'terminale'], exp: "La récursivité décompose un problème en sous-problèmes identiques jusqu'au cas de base." },
            { q: "Dans un arbre binaire de recherche (ABR), pour chaque nœud, les valeurs du sous-arbre gauche sont :", correct: "strictement inférieures à la valeur du nœud", wrongs: ["strictement supérieures", "aléatoires", "toujours nulles"], levels: ['terminale'], exp: "C'est l'invariant structurel d'un arbre binaire de recherche." },
            { q: "Quel protocole réseau traduit un nom de domaine (ex: eduquest.fr) en adresse IP ?", correct: "le DNS (Domain Name System)", wrongs: ["le DHCP", "l'ARP", "le TCP"], levels: ['2nde', '1ere', 'terminale'], exp: "Le DNS est l'annuaire distribué traduisant les noms de domaine en adresses IP." },
            { q: "Quelle structure de données linéaire suit le principe LIFO (Last In, First Out) ?", correct: "une pile (stack)", wrongs: ["une file (queue)", "un graphe", "une table de hachage"], levels: ['terminale'], exp: "Dans une pile, le dernier élément empilé est le premier dépilé." },
            { q: "Quelle structure de données linéaire suit le principe FIFO (First In, First Out) ?", correct: "une file (queue)", wrongs: ["une pile (stack)", "un arbre binaire", "un dictionnaire"], levels: ['terminale'], exp: "Dans une file, le premier élément arrivé est le premier sorti." },
            { q: "Quel modèle de cryptographie utilise une clé publique pour chiffrer et une clé privée pour déchiffrer ?", correct: "le chiffrement asymétrique (ex: RSA)", wrongs: ["le chiffrement symétrique (AES)", "le code de César", "le hachage SHA-256"], levels: ['terminale'], exp: "La clé publique peut être partagée librement sans compromettre le déchiffrement." },
            { q: "Quel protocole de routage cherche le plus court chemin dans un graphe pondéré grâce à l'algorithme de Dijkstra ?", correct: "OSPF", wrongs: ["RIP (comptage de sauts)", "DNS", "HTTP"], levels: ['terminale'], exp: "OSPF utilise le coût des liaisons (bande passante) avec l'algorithme de Dijkstra." }
        ],
        ses: [
            // Lycée uniquement (2nde, 1ere, Terminale)
            { q: "Quelle formule permet de calculer le Chiffre d'Affaires (CA) d'une entreprise ?", correct: "Prix de vente × Quantité vendue", wrongs: ["Prix de vente − Coûts de production", "Bénéfice ÷ Capital", "Recettes + Impôts"], levels: ['2nde', '1ere', 'terminale'], exp: "Le CA représente le montant total des ventes (quantité × prix unitaire)." },
            { q: "Comment appelle-t-on la richesse réelle créée par une entreprise (Production − Consommations intermédiaires) ?", correct: "la Valeur Ajoutée (VA)", wrongs: ["le Bénéfice net", "le Dividende", "le Capital social"], levels: ['2nde', '1ere', 'terminale'], exp: "La VA mesure la valeur économique créée par l'activité propre de l'entreprise." },
            { q: "Selon le modèle de marché concurrentiel, lorsque le prix d'un bien augmente, en règle générale :", correct: "la demande diminue et l'offre augmente", wrongs: ["la demande augmente et l'offre diminue", "l'offre et la demande s'annulent", "la demande devient infinie"], levels: ['2nde', '1ere', 'terminale'], exp: "Loi de l'offre (croissante avec le prix) et de la demande (décroissante avec le prix)." },
            { q: "Comment appelle-t-on l'apprentissage des règles, valeurs et normes sociales dès l'enfance ?", correct: "la socialisation primaire", wrongs: ["la socialisation secondaire", "l'acculturation forcée", "l'émancipation légale"], levels: ['2nde', '1ere', 'terminale'], exp: "La socialisation primaire est transmise dès l'enfance par la famille et l'école." },
            { q: "Que mesure le Produit Intérieur Brut (PIB) d'un pays sur une année ?", correct: "la somme des valeurs ajoutées créées sur le territoire", wrongs: ["le montant total de la dette publique", "le nombre d'entreprises créées", "l'épargne totale des ménages"], levels: ['2nde', '1ere', 'terminale'], exp: "Le PIB agrège les richesses (valeurs ajoutées) produites sur le territoire national." },
            { q: "Comment nomme-t-on un marché sur lequel une seule entreprise fait face à une multitude d'acheteurs ?", correct: "un monopole", wrongs: ["un oligopole", "la concurrence pure et parfaite", "un monopsone"], levels: ['2nde', '1ere'], exp: "En situation de monopole, l'entreprise dispose d'un fort pouvoir de marché (faiseur de prix)." },
            // 1ère
            { q: "Dans un marché de concurrence pure et parfaite (CPP), que signifie l'hypothèse d'atomicité ?", correct: "un grand nombre d'acheteurs et de vendeurs sans pouvoir de marché individuel", wrongs: ["un monopole d'État", "des produits tous différents", "des barrières strictes à l'entrée"], levels: ['1ere', 'terminale'], exp: "Aucun acteur ne peut influencer seul le prix : ils sont 'preneurs de prix' (price takers)." },
            { q: "Comment qualifie-t-on la conséquence involontaire de l'action d'un agent sur un tiers, sans compensation financière (ex: la pollution) ?", correct: "une externalité (négative)", wrongs: ["une asymétrie d'information", "un bien collectif", "un monopole naturel"], levels: ['1ere', 'terminale'], exp: "La pollution est l'exemple type d'externalité négative non prise en compte par le marché." },
            { q: "Quelle institution est en charge de la politique monétaire et de la stabilité des prix dans la zone euro ?", correct: "la Banque Centrale Européenne (BCE)", wrongs: ["le FMI", "la Commission Européenne", "la Banque Mondiale"], levels: ['1ere', 'terminale'], exp: "La BCE pilote les taux directeurs pour maintenir l'inflation autour de 2%." },
            { q: "Quelle notion désigne la situation où un acheteur ou vendeur dispose de plus d'informations que l'autre lors d'une transaction ?", correct: "l'asymétrie d'information", wrongs: ["l'atomicité de marché", "la concurrence parfaite", "la rationalité absolue"], levels: ['1ere', 'terminale'], exp: "Théorisée par Akerlof (marché des voitures d'occasion)." },
            { q: "Comment appelle-t-on un bien non rival et non excluable (ex : l'éclairage public ou la défense nationale) ?", correct: "un bien collectif", wrongs: ["un bien commun", "un bien privatif", "un bien de club"], levels: ['1ere', 'terminale'], exp: "Un bien collectif est financé par l'État en raison du phénomène du passager clandestin." },
            // Terminale
            { q: "Pour Joseph Schumpeter, quel processus révolutionne sans cesse les structures économiques en détruisant les anciennes activités au profit des nouvelles ?", correct: "la destruction créatrice", wrongs: ["la main invisible", "la division internationale du travail", "la théorie du ruissellement"], levels: ['terminale'], exp: "L'entrepreneur innovateur est le moteur de la destruction créatrice." },
            { q: "Selon David Ricardo, quel principe explique l'intérêt pour chaque pays de se spécialiser là où sa productivité relative est la meilleure ?", correct: "la théorie des avantages comparatifs", wrongs: ["le mercantilisme", "le protectionnisme éducateur", "la théorie des débouchés"], levels: ['terminale'], exp: "Ricardo démontre que le commerce international peut bénéficier à tous via les avantages comparatifs." },
            { q: "Quel coefficient compris entre 0 (égalité parfaite) et 1 (inégalité totale) mesure les inégalités de revenus d'une population ?", correct: "le coefficient de Gini", wrongs: ["l'indice de Herfindahl", "le PIB par habitant", "le ratio de Sharpe"], levels: ['terminale'], exp: "L'indice de Gini synthétise la courbe de Lorenz des revenus ou patrimoines." },
            { q: "Pour Karl Marx, sur quelle contradiction fondamentale repose le système capitaliste ?", correct: "la lutte des classes entre bourgeois (possesseurs du capital) et prolétaires", wrongs: ["l'absence de libre-échange", "la surabondance des monnaies", "le manque de formation ouvrière"], levels: ['terminale'], exp: "Pour Marx, l'histoire humaine est structurée par la lutte des classes." },
            { q: "Comment appelle-t-on le paradoxe selon lequel l'amélioration de l'efficacité énergétique peut accroître la consommation totale de ressources ?", correct: "l'effet rebond (paradoxe de Jevons)", wrongs: ["l'effet Veblen", "la tragédie des biens communs", "l'aléa moral"], levels: ['terminale'], exp: "Les gains d'efficacité abaissent le coût d'usage, incitant à consommer davantage." }
        ]
    };

    /** Filtre la banque de questions pour un niveau scolaire donné. */
    function getQuestionsForNiveau(subjectId, niveau) {
        const fullBank = FACT_BANKS[subjectId] || [];
        const norm = normalizeNiveau(niveau);
        const band = bandForNiveau(norm);

        // 1. Filtrage précis par niveau
        const exact = fullBank.filter(q => {
            if (Array.isArray(q.levels)) return q.levels.includes(norm);
            return q.level === norm;
        });
        if (exact.length >= 3) return exact;

        // 2. Filtrage par cycle (collège ou lycée)
        const cycle = fullBank.filter(q => {
            if (Array.isArray(q.levels)) {
                return q.levels.includes(norm) || q.levels.includes(band);
            }
            return q.level === norm || q.level === band;
        });
        if (cycle.length >= 3) return cycle;

        // 3. Repli
        return fullBank;
    }

    /** Calcule une signature normalisée unique d'une question pour éviter les répétitions. */
    function questionSignature(lesson) {
        if (!lesson || typeof lesson !== 'object') return '';
        const raw = [
            lesson.type || 'qcm',
            lesson.q || '',
            lesson.textWithBlanks || '',
        ].join('|');
        return raw
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9|]+/g, ' ')
            .trim();
    }

    /** Générateur unifié avec alternance procédurale / questions de cours sans répétition */
    function generateBankLesson(subjectId, index, niveau, variant = 0) {
        const norm = normalizeNiveau(niveau);
        const rng = seededRng(hashSeed(subjectId + ':' + norm + ':' + index + ':v' + variant));

        // Pour les matières qui ont un générateur procédural, on alterne intelligemment
        // pour offrir une variété élevée sans répétition de questions fixes.
        const useProcedural = (index + variant) % 2 === 1;

        if (useProcedural) {
            if (subjectId === 'francais') return generateFrenchLesson(index, norm, variant, rng);
            if (subjectId === 'anglais') return generateEnglishLesson(index, norm, variant, rng);
            if (subjectId === 'histoire') return generateHistoryLesson(index, norm, variant, rng);
            if (subjectId === 'geo') return generateGeoLesson(index, norm, variant, rng);
            if (subjectId === 'svt') return generateSvtLesson(index, norm, variant, rng);
            if (subjectId === 'physique') return generatePhysicsLesson(index, norm, variant, rng);
            if (subjectId === 'chimie') return generateChemistryLesson(index, norm, variant, rng);
            if (subjectId === 'techno') return generateTechnoLesson(index, norm, variant, rng);
            if (subjectId === 'emc') return generateEmcLesson(index, norm, variant, rng);
            if (subjectId === 'philo') return generatePhiloLesson(index, norm, variant, rng);
            if (subjectId === 'nsi') return generateNsiLesson(index, norm, variant, rng);
            if (subjectId === 'ses') return generateSesLesson(index, norm, variant, rng);
        }

        const bank = getQuestionsForNiveau(subjectId, norm);

        if (!bank || bank.length === 0) {
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: 'Question de révision générale',
                opts: ['A', 'B', 'C', 'D'],
                correct: 0,
                exp: '',
            };
        }

        // Deck déterministe par passe : parcourt toute la banque avant toute répétition
        const slot = Math.floor(index / 2) + variant * 7;
        const pass = Math.floor(slot / bank.length);
        const deck = seededShuffle(bank, `${subjectId}:${norm}:bankdeck:${pass}:v${variant}`);
        const fact = deck[slot % deck.length];

        if (fact.type === 'vrai_faux') {
            const isTrue = fact.correct === true || String(fact.correct).toLowerCase() === 'vrai';
            return {
                type: 'vrai_faux',
                title: 'Niveau ' + (index + 1),
                q: fact.q,
                correct: isTrue,
                hint: fact.hint || '',
                exp: fact.exp || (isTrue ? 'C\'est bien vrai !' : 'C\'est faux !'),
            };
        }

        if (fact.type === 'reponse_courte') {
            return {
                type: 'reponse_courte',
                title: 'Niveau ' + (index + 1),
                q: fact.q,
                accepted: fact.accepted || [String(fact.correct).toLowerCase().trim()],
                hint: fact.hint || '',
                exp: fact.exp || `La réponse attendue était : ${fact.correct}.`,
            };
        }

        // QCM standard garanti sans doublon
        const cleanWrongs = uniqueStringWrongs(fact.correct, fact.wrongs || []);
        const opts0 = [fact.correct, ...cleanWrongs];
        const { opts, correct } = shuffleOptions(opts0, 0, rng);

        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: fact.q,
            opts,
            correct,
            hint: fact.hint || '',
            exp: fact.exp || `La réponse correcte est : ${fact.correct}.`,
        };
    }

    /* ================= API publique ================= */

    return {
        normalizeNiveau,
        bandForNiveau,
        getQuestionsForNiveau,
        questionSignature,

        /**
         * Génère UNE seule leçon pour une matière, un numéro, un niveau et une variante.
         */
        generateOne(subjectId, index, niveau, variant = 0) {
            const norm = normalizeNiveau(niveau);
            return subjectId === 'maths'
                ? generateMathLesson(index, norm, variant)
                : generateBankLesson(subjectId, index, norm, variant);
        },

        /**
         * Étend une matière (objet DASH_SUBJECTS) jusqu'à `totalCount` niveaux,
         * avec un contenu adapté au niveau scolaire (`niveau`) pour les 100 niveaux.
         */
        extend(subject, totalCount, niveau) {
            const norm = normalizeNiveau(niveau);
            const handWritten = (subject.lessons || []).map((lesson, i) => {
                const l0 = reshuffleHandWritten(lesson, subject.id, i);
                if (!l0.variants || l0.variants.length === 0) {
                    const l1 = QuestionBank.generateOne(subject.id, i, norm, 1);
                    const l2 = QuestionBank.generateOne(subject.id, i, norm, 2);
                    l0.variants = [l0, l1, l2];
                }
                return l0;
            });

            const lessons = handWritten.slice();
            for (let i = lessons.length; i < totalCount; i++) {
                const l0 = QuestionBank.generateOne(subject.id, i, norm, 0);
                const l1 = QuestionBank.generateOne(subject.id, i, norm, 1);
                const l2 = QuestionBank.generateOne(subject.id, i, norm, 2);
                l0.variants = [l0, l1, l2];
                lessons.push(l0);
            }
            return { ...subject, lessons };
        },

        /**
         * Récupère une leçon / variante spécifique parmi les 3 du niveau.
         */
        getLesson(subjectOrId, index, niveau, variant = 0) {
            const norm = normalizeNiveau(niveau);
            const subjectId = (typeof subjectOrId === 'string') ? subjectOrId : (subjectOrId ? subjectOrId.id : '');
            const subjectObj = (typeof subjectOrId === 'object' && subjectOrId !== null) ? subjectOrId : null;

            if (subjectObj && subjectObj.lessons && subjectObj.lessons[index]) {
                const lesson = subjectObj.lessons[index];
                if (lesson.variants && Array.isArray(lesson.variants) && lesson.variants.length > 0) {
                    return lesson.variants[variant % lesson.variants.length];
                }
                if (variant === 0) return lesson;
            }

            return QuestionBank.generateOne(subjectId, index, norm, variant);
        },
    };
})();

if (typeof window !== 'undefined') window.QuestionBank = QuestionBank;
if (typeof globalThis !== 'undefined') globalThis.QuestionBank = QuestionBank;
if (typeof module !== 'undefined' && module.exports) module.exports = QuestionBank;

