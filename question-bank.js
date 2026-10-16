/* =============================================================================
   QUESTION-BANK.JS — EDUQUEST v2.8
   Banque de questions et générateur procédural adaptés par NIVEAU SCOLAIRE :
   - 6ème, 5ème, 4ème, 3ème (Collège)
   - 2nde, 1ère, Terminale (Lycée)

   CORRECTIONS & AMÉLIORATIONS :
   - Différenciation fine par niveau scolaire (chaque classe dispose de ses
     questions et calculs adaptés au programme officiel).
   - Résolution du manque de questions : enrichissement massif de la banque
     pour toutes les matières et tous les niveaux (plus de repli vide en Lycée).
   - Ordre déterministe et stable par niveau, numéro et variante.
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

    /* ================= Générateur procédural — Mathématiques ================= */

    function generateMathLesson(index, niveau, variant = 0) {
        const norm = normalizeNiveau(niveau);
        const rng = seededRng(hashSeed('maths:' + norm + ':' + index + ':v' + variant));
        let q = '', correct = 0, wrongCandidates = [], allowNegative = false, exp = '';

        if (norm === '6eme') {
            const kinds = ['add', 'sub', 'mul', 'div', 'fraction_part', 'perimetre'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            switch (kind) {
                case 'add': {
                    const a = 15 + Math.floor(rng() * 75), b = 15 + Math.floor(rng() * 75);
                    correct = a + b;
                    q = `Combien font ${a} + ${b} ?`;
                    wrongCandidates = [correct + 10, correct - 10, correct + 1, correct - 1];
                    exp = `${a} + ${b} = ${correct}.`;
                    break;
                }
                case 'sub': {
                    const a = 30 + Math.floor(rng() * 70), b = 10 + Math.floor(rng() * (a - 15));
                    correct = a - b;
                    q = `Combien font ${a} - ${b} ?`;
                    wrongCandidates = [correct + 10, correct - 10, correct + 2, correct - 2];
                    exp = `${a} - ${b} = ${correct}.`;
                    break;
                }
                case 'mul': {
                    const a = 3 + Math.floor(rng() * 8), b = 4 + Math.floor(rng() * 7);
                    correct = a * b;
                    q = `Combien font ${a} × ${b} ?`;
                    wrongCandidates = [correct + a, correct - b, correct + 1, correct + 4];
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
                    const l = 4 + Math.floor(rng() * 8), L = l + 2 + Math.floor(rng() * 6);
                    correct = 2 * (L + l);
                    q = `Quel est le périmètre d'un rectangle de longueur ${L} cm et de largeur ${l} cm ?`;
                    wrongCandidates = [L * l, L + l, correct + 2, correct - 4];
                    exp = `Périmètre = 2 × (${L} + ${l}) = 2 × ${L + l} = ${correct} cm.`;
                    break;
                }
            }
        } else if (norm === '5eme') {
            const kinds = ['relatifs_add', 'relatifs_sub', 'priorites', 'fraction_same', 'aire', 'angle_triangle'];
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
                case 'aire': {
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
            }
        } else if (norm === '4eme') {
            const kinds = ['puissances', 'relatifs_mul', 'pythagore', 'distributivite', 'racine_carree', 'vitesse'];
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
                    correct = a * b; // positif
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
            }
        } else if (norm === '3eme') {
            const kinds = ['equation', 'pourcentage', 'probabilites', 'developpement', 'thales', 'fonction_affine'];
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
                    const prix = (4 + Math.floor(rng() * 12)) * 10;
                    const remisePct = 20;
                    correct = prix * (100 - remisePct) / 100;
                    q = `Un article coûte ${prix} €. Avec une remise de ${remisePct} %, quel est son nouveau prix ?`;
                    wrongCandidates = [prix - remisePct, correct + 10, correct - 10, prix * 0.2];
                    exp = `Remise de 20% = ${prix * 0.2} €. Prix final = ${prix} - ${prix * 0.2} = ${correct} €.`;
                    break;
                }
                case 'probabilites': {
                    correct = 3;
                    q = `On lance un dé équilibré à 6 faces. Combien y a-t-il d'issues pour l'événement « obtenir un nombre pair » ?`;
                    wrongCandidates = [2, 4, 1, 6];
                    exp = `Les nombres pairs sont 2, 4 et 6, soit 3 issues favorables sur 6.`;
                    break;
                }
                case 'developpement': {
                    const a = 2 + Math.floor(rng() * 4);
                    correct = a * a;
                    q = `Dans le développement de (x + ${a})² = x² + 2ax + a², quel est le terme constant (a²) ?`;
                    wrongCandidates = [a * 2, correct + 1, correct - 2, a];
                    exp = `(x + ${a})² = x² + ${2 * a}x + ${correct}.`;
                    break;
                }
                case 'thales': {
                    const ab = 4, am = 2, ac = 6;
                    correct = 3;
                    q = `Configuration de Thalès : AM/AB = AN/AC. Si AM = 2, AB = 4 et AC = 6, que vaut AN ?`;
                    wrongCandidates = [4, 2, 5, 1];
                    exp = `AN = (AM × AC) ÷ AB = (2 × 6) ÷ 4 = 12 ÷ 4 = 3.`;
                    break;
                }
                case 'fonction_affine': {
                    const a = 2 + Math.floor(rng() * 4), b = 1 + Math.floor(rng() * 6), xVal = 2 + Math.floor(rng() * 4);
                    correct = a * xVal + b;
                    q = `Soit la fonction f(x) = ${a}x + ${b}. Calcule l'image f(${xVal}).`;
                    wrongCandidates = [correct + a, correct - a, a + b + xVal, correct + 1];
                    exp = `f(${xVal}) = ${a} × ${xVal} + ${b} = ${correct}.`;
                    break;
                }
            }
        } else if (norm === '2nde') {
            const kinds = ['fonction_image', 'evolution_taux', 'equation_produit', 'milieu_coord', 'simplif_racine', 'vecteur_coord'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'fonction_image': {
                    const a = 2, xVal = 3, c = 5;
                    correct = a * xVal * xVal - c;
                    q = `Soit f(x) = ${a}x² - ${c}. Quelle est l'image de ${xVal} par f ?`;
                    wrongCandidates = [correct + 2, correct - 2, a * xVal - c, correct + 6];
                    exp = `f(${xVal}) = ${a} × (${xVal})² - ${c} = ${a} × 9 - ${c} = 18 - ${c} = ${correct}.`;
                    break;
                }
                case 'evolution_taux': {
                    const pct = [15, 20, 25, 30][Math.floor(rng() * 4)];
                    correct = 100 + pct;
                    q = `Une grandeur augmente de ${pct} %. Quel pourcentage de la valeur initiale représente-t-elle désormais ?`;
                    wrongCandidates = [100 - pct, pct, correct + 10, correct - 5];
                    exp = `Une hausse de ${pct}% correspond à un coefficient multiplicateur de 1 + ${pct}/100, soit ${correct}%.`;
                    break;
                }
                case 'equation_produit': {
                    const x1 = 3 + Math.floor(rng() * 4);
                    correct = x1;
                    q = `Résous l'équation produit-nul : (x - ${x1})(2x + 6) = 0. Quelle est la solution positive ?`;
                    wrongCandidates = [-x1, x1 + 1, x1 - 1, x1 * 2];
                    exp = `Un produit de facteurs est nul si l'un des facteurs est nul : x - ${x1} = 0 donne x = ${x1}.`;
                    break;
                }
                case 'milieu_coord': {
                    const xA = 2, xB = 8;
                    correct = (xA + xB) / 2;
                    q = `Dans un repère, si le point A a pour abscisse ${xA} et B a pour abscisse ${xB}, quelle est l'abscisse du milieu de [AB] ?`;
                    wrongCandidates = [xB - xA, correct + 1, correct - 1, xA + xB];
                    exp = `Abscisse du milieu = (${xA} + ${xB}) ÷ 2 = ${correct}.`;
                    break;
                }
                case 'simplif_racine': {
                    correct = 5;
                    q = `Simplifie √50 sous la forme a√2. Que vaut l'entier a ?`;
                    wrongCandidates = [2, 25, 10, 4];
                    exp = `√50 = √(25 × 2) = √25 × √2 = 5√2, donc a = 5.`;
                    break;
                }
                case 'vecteur_coord': {
                    const xA = 1 + Math.floor(rng() * 4), xB = 6 + Math.floor(rng() * 5);
                    correct = xB - xA;
                    q = `Si A a pour abscisse ${xA} et B a pour abscisse ${xB}, quelle est la composante x du vecteur AB (xB - xA) ?`;
                    wrongCandidates = [xA - xB, xA + xB, correct + 1, correct - 1];
                    exp = `Composante x = xB - xA = ${xB} - ${xA} = ${correct}.`;
                    break;
                }
            }
        } else if (norm === '1ere') {
            const kinds = ['discriminant', 'nombre_racines', 'derivee_poly', 'suite_arith', 'suite_geom', 'produit_scalaire'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'discriminant': {
                    const a = 1, b = 6, c = 5;
                    correct = b * b - 4 * a * c; // 36 - 20 = 16
                    q = `Pour le trinôme x² + ${b}x + ${c}, calcule le discriminant Δ = b² - 4ac.`;
                    wrongCandidates = [correct + 4, correct - 4, b * b + 4 * a * c, 20];
                    exp = `Δ = ${b}² - 4 × 1 × ${c} = 36 - 20 = 16.`;
                    break;
                }
                case 'nombre_racines': {
                    correct = 2;
                    q = `Si le discriminant Δ d'un trinôme du second degré est strictement positif (Δ > 0), combien a-t-il de racines réelles ?`;
                    wrongCandidates = [1, 0, 3];
                    exp = `Si Δ > 0, le trinôme admet exactement 2 racines réelles distinctes.`;
                    break;
                }
                case 'derivee_poly': {
                    const a = 3, b = 4;
                    correct = 2 * a;
                    q = `Soit f(x) = ${a}x² - ${b}x + 1. Quel est le coefficient de x dans la dérivée f'(x) ?`;
                    wrongCandidates = [a, correct + 2, correct - 1, b];
                    exp = `(ax²)' = 2ax, donc la dérivée de ${a}x² est 2 × ${a}x = ${correct}x.`;
                    break;
                }
                case 'suite_arith': {
                    const u0 = 4, r = 3, n = 5;
                    correct = u0 + n * r;
                    q = `Soit une suite arithmétique de premier terme u₀ = ${u0} et de raison r = ${r}. Que vaut u₅ ?`;
                    wrongCandidates = [correct + r, correct - r, u0 * Math.pow(r, 2), correct + 2];
                    exp = `u_n = u₀ + n × r. Ici u₅ = ${u0} + 5 × ${r} = ${u0} + 15 = ${correct}.`;
                    break;
                }
                case 'suite_geom': {
                    const u0 = 2, qVal = 3;
                    correct = u0 * qVal * qVal;
                    q = `Soit une suite géométrique de premier terme u₀ = ${u0} et de raison q = ${qVal}. Que vaut u₂ ?`;
                    wrongCandidates = [u0 + 2 * qVal, correct * 2, correct - 2, 12];
                    exp = `u_n = u₀ × qⁿ. Ici u₂ = ${u0} × ${qVal}² = 2 × 9 = ${correct}.`;
                    break;
                }
                case 'produit_scalaire': {
                    const x1 = 2, y1 = 3, x2 = 4, y2 = 1;
                    correct = x1 * x2 + y1 * y2;
                    q = `Dans un repère orthonormé, soit u(2; 3) et v(4; 1). Calcule le produit scalaire u · v = x x' + y y'.`;
                    wrongCandidates = [x1 * y2 - y1 * x2, correct + 2, correct - 2, 8];
                    exp = `u · v = 2 × 4 + 3 × 1 = 8 + 3 = ${correct}.`;
                    break;
                }
            }
        } else {
            // Terminale
            const kinds = ['exponentielle', 'logarithme', 'derivee_exp_ln', 'primitive', 'limite_ref', 'proba_cond'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'exponentielle': {
                    correct = 1;
                    q = `Dans l'ensemble des réels, quelle est la valeur exacte de exp(0) (ou e⁰) ?`;
                    wrongCandidates = [0, 2, -1];
                    exp = `Pour tout réel, l'exponentielle de 0 vaut exactement 1 (e⁰ = 1).`;
                    break;
                }
                case 'logarithme': {
                    correct = 0;
                    q = `Que vaut le logarithme népérien de 1 : ln(1) ?`;
                    wrongCandidates = [1, -1, 2];
                    exp = `ln(1) = 0 car e⁰ = 1.`;
                    break;
                }
                case 'derivee_exp_ln': {
                    const k = 3;
                    correct = k;
                    q = `Quelle est la dérivée de la fonction f(x) = e^(${k}x) ? Quel est le facteur multiplicatif devant l'exponentielle ?`;
                    wrongCandidates = [1, k * 2, k - 1, 0];
                    exp = `La formule est (e^(kx))' = k e^(kx). Le coefficient devant l'exponentielle est ${correct}.`;
                    break;
                }
                case 'primitive': {
                    correct = 3;
                    q = `Soit f(x) = 3x². Quel est l'exposant de x dans sa primitive F(x) = x³ + C ?`;
                    wrongCandidates = [2, 4, 1, 6];
                    exp = `Une primitive de 3x² est x³ (exposant 3) car la dérivée de x³ est 3x².`;
                    break;
                }
                case 'limite_ref': {
                    correct = 0;
                    q = `Quelle est la limite de 1/x lorsque x tend vers +∞ ?`;
                    wrongCandidates = [1, -1, 2];
                    exp = `Lorsque le dénominateur devient infiniment grand, 1/x tend vers 0.`;
                    break;
                }
                case 'proba_cond': {
                    correct = 50;
                    q = `Si P(A) = 0,4 et P(A ∩ B) = 0,2, que vaut la probabilité conditionnelle P_A(B) en pourcentage ?`;
                    wrongCandidates = [20, 40, 80, 25];
                    exp = `P_A(B) = P(A ∩ B) ÷ P(A) = 0,2 ÷ 0,4 = 0,5, soit 50 %.`;
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

    /* ================= Banques de questions — 10 autres matières ================= */

    const FACT_BANKS = {
        francais: [
            // 6ème
            { q: "Quelle est la classe grammaticale du mot « gentiment » ?", correct: "adverbe", wrongs: ["adjectif", "nom", "verbe"], levels: ['6eme', '5eme'] },
            { q: "Quel est le pluriel du mot « cheval » ?", correct: "chevaux", wrongs: ["chevals", "chevaus", "chevaux s"], levels: ['6eme'] },
            { q: "Dans « Le chat noir dort », quelle est la fonction du mot « noir » ?", correct: "épithète", wrongs: ["attribut", "sujet", "complément d'objet"], levels: ['6eme', '5eme'] },
            { q: "Quel est l'antonyme de « généreux » ?", correct: "avare", wrongs: ["joyeux", "courageux", "loyal"], levels: ['6eme'] },
            { q: "Conjugue « chanter » à la 1ère personne du pluriel au présent de l'indicatif.", correct: "nous chantons", wrongs: ["nous chantions", "nous chanterons", "nous chantez"], levels: ['6eme'] },
            { q: "Quel mot est un déterminant possessif ?", correct: "notre", wrongs: ["nous", "le", "cet"], levels: ['6eme', '5eme'] },
            { q: "Quel est le synonyme du mot « périlleux » ?", correct: "dangereux", wrongs: ["agréable", "rapide", "calme"], levels: ['6eme', '5eme'] },
            // 5ème
            { q: "Dans la phrase « Le chevalier brandit son épée », que représente « son épée » ?", correct: "le COD", wrongs: ["le sujet", "le COI", "un complément de lieu"], levels: ['5eme'] },
            { q: "À quel temps est conjugué le verbe dans « Il courut vers le château » ?", correct: "au passé simple", wrongs: ["à l'imparfait", "au présent", "au plus-que-parfait"], levels: ['5eme', '4eme'] },
            { q: "Comment accorde-t-on : « Les fillettes sont ___ » ?", correct: "parties", wrongs: ["parti", "partie", "partis"], levels: ['5eme', '6eme'] },
            { q: "Quel mot désigne le compagnon d'armes d'un chevalier au Moyen Âge ?", correct: "un écuyer", wrongs: ["un troubadour", "un serf", "un bailli"], levels: ['5eme'] },
            { q: "Quelle proposition contient un homophone correctement orthographié ?", correct: "Où vas-tu ?", wrongs: ["Ou vas-tu ?", "Où veux-tu du thé ?", "Ou bien où ?"], levels: ['5eme', '6eme'] },
            // 4ème
            { q: "Dans « La femme qui porte un manteau », quel mot est le pronom relatif ?", correct: "qui", wrongs: ["la", "porte", "un"], levels: ['4eme', '3eme'] },
            { q: "Quelle figure de style compare sans outil de comparaison dans « Cet homme est un lion » ?", correct: "la métaphore", wrongs: ["la comparaison", "la litote", "l'hyperbole"], levels: ['4eme', '3eme'] },
            { q: "Quel auteur du XIXe siècle est célèbre pour ses contes et nouvelles réalistes et fantastiques (ex: Le Horla) ?", correct: "Guy de Maupassant", wrongs: ["Victor Hugo", "Molière", "Rabelais"], levels: ['4eme'] },
            { q: "À la voix passive, quelle est la phrase correcte pour « Le chat mange la souris » ?", correct: "La souris est mangée par le chat.", wrongs: ["La souris mange le chat.", "Le chat est mangé par la souris.", "La souris a mangé le chat."], levels: ['4eme'] },
            { q: "Quel mode exprime une action incertaine ou soumise à condition ?", correct: "le conditionnel", wrongs: ["l'indicatif", "l'impératif", "l'infinitif"], levels: ['4eme', '3eme'] },
            // 3ème (Brevet)
            { q: "Dans le discours indirect, que devient « Je viens » au passé ?", correct: "qu'il venait", wrongs: ["qu'il vient", "qu'il viendra", "qu'il vînt"], levels: ['3eme'] },
            { q: "Quelle figure de style consiste à répéter un mot en début de vers ou de phrase ?", correct: "l'anaphore", wrongs: ["l'oxymore", "le chiasme", "la métonymie"], levels: ['3eme', '2nde'] },
            { q: "Quel connecteur logique introduit une conséquence ?", correct: "donc", wrongs: ["parce que", "mais", "bien que"], levels: ['3eme'] },
            { q: "Quel genre littéraire correspond au récit de la vie d'un auteur écrit par lui-même ?", correct: "l'autobiographie", wrongs: ["la biographie", "l'épopée", "le conte"], levels: ['3eme', '2nde'] },
            { q: "Quelle figure de style oppose deux contraires dans « Cette obscure clarté » ?", correct: "un oxymore", wrongs: ["une hyperbole", "un euphémisme", "une antiphrase"], levels: ['3eme', '2nde'] },
            // 2nde
            { q: "En versification, comment appelle-t-on un vers de 12 syllabes ?", correct: "un alexandrin", wrongs: ["un décasyllabe", "un octosyllabe", "un hémistiche"], levels: ['2nde', '1ere'] },
            { q: "Quel registre cherche à susciter la pitié et l'attendrissement du lecteur ?", correct: "le registre pathétique", wrongs: ["le registre tragique", "le registre polémique", "le registre comique"], levels: ['2nde'] },
            { q: "Quelle figure de style atténue une réalité choquante ou brutale (ex: « Il nous a quittés » pour « Il est mort ») ?", correct: "un euphémisme", wrongs: ["une litote", "une anaphore", "une prétérition"], levels: ['2nde', '1ere'] },
            { q: "Dans une pièce de théâtre, comment appelle-t-on les indications scéniques données par l'auteur ?", correct: "les didascalies", wrongs: ["les répliques", "les tirades", "les apartés"], levels: ['2nde', '1ere'] },
            { q: "Quel mouvement littéraire du XIXe siècle vise à peindre la réalité sociale sans fard ?", correct: "le réalisme", wrongs: ["le romantisme", "le surréalisme", "le classicisme"], levels: ['2nde', '1ere'] },
            // 1ère (Bac de Français)
            { q: "Quel poète est l'auteur du recueil « Les Fleurs du Mal » (1857) ?", correct: "Charles Baudelaire", wrongs: ["Arthur Rimbaud", "Paul Verlaine", "Stéphane Mallarmé"], levels: ['1ere', 'terminale'] },
            { q: "Quelle figure de style dit le moins pour faire entendre le plus (ex: « Va, je ne te hais point ») ?", correct: "la litote", wrongs: ["l'hyperbole", "la métonymie", "le chiasme"], levels: ['1ere', '2nde'] },
            { q: "Quel mouvement littéraire du XVIe siècle place l'être humain et le savoir au centre des préoccupations ?", correct: "l'humanisme", wrongs: ["les Lumières", "le romantisme", "le symbolisme"], levels: ['1ere'] },
            { q: "Quelle est la structure d'un chiasme en rhétorique ?", correct: "une disposition croisée AB / BA", wrongs: ["une gradation ascendante", "une répétition en fin de phrase", "une omission volontaire"], levels: ['1ere', 'terminale'] },
            { q: "Dans quelle pièce Molière met-il en scène Argan, obsédé par sa santé fictive ?", correct: "Le Malade imaginaire", wrongs: ["Le Tartuffe", "L'Avare", "Le Misanthrope"], levels: ['1ere'] },
            // Terminale
            { q: "Quel écrivain et philosophe a rédigé « L'Étranger » et « Le Mythe de Sisyphe » ?", correct: "Albert Camus", wrongs: ["Jean-Paul Sartre", "André Gide", "Marcel Proust"], levels: ['terminale'] },
            { q: "À quel courant théâtral du XXe siècle associe-t-on Samuel Beckett et Eugène Ionesco ?", correct: "le théâtre de l'absurde", wrongs: ["le drame romantique", "la tragédie classique", "le vaudeville"], levels: ['terminale'] },
            { q: "Quel concept désigne la perte de repères et le dégoût existentiel chez Sartre ?", correct: "la Nausée", wrongs: ["le Spleen", "l'Angoisse pure", "le Mal du siècle"], levels: ['terminale'] },
            { q: "Quelle grande œuvre romanesque de Marcel Proust commence par « Longtemps, je me suis couché de bonne heure » ?", correct: "À la recherche du temps perdu", wrongs: ["Les Thibault", "La Condition humaine", "Voyage au bout de la nuit"], levels: ['terminale'] },
        ],
        histoire: [
            // 6ème
            { q: "En quelle année l'écriture apparaît-elle en Mésopotamie (environ) ?", correct: "-3300 av. J.-C.", wrongs: ["-1000 av. J.-C.", "an 0", "-10000 av. J.-C."], levels: ['6eme'] },
            { q: "Dans la Grèce antique, quelle cité est considérée comme le berceau de la démocratie ?", correct: "Athènes", wrongs: ["Sparte", "Mycènes", "Troie"], levels: ['6eme'] },
            { q: "Quel homme politique athénien a dirigé la cité lors de son apogée au Ve siècle av. J.-C. ?", correct: "Périclès", wrongs: ["Alexandre le Grand", "Homère", "Solon"], levels: ['6eme'] },
            { q: "Qui fut le premier empereur romain ?", correct: "Auguste", wrongs: ["Jules César", "Néron", "Marc Aurèle"], levels: ['6eme'] },
            { q: "Quel fleuve traverse l'Égypte antique et permettait l'agriculture grâce à ses crues ?", correct: "le Nil", wrongs: ["l'Euphrate", "le Tigre", "le Jourdain"], levels: ['6eme'] },
            // 5ème
            { q: "Qui a été sacré empereur à Rome le jour de Noël en l'an 800 ?", correct: "Charlemagne", wrongs: ["Clovis", "Hugues Capet", "Saint Louis"], levels: ['5eme'] },
            { q: "Quelle ville était la prestigieuse capitale de l'Empire byzantin ?", correct: "Constantinople", wrongs: ["Rome", "Alexandrie", "Antioche"], levels: ['5eme'] },
            { q: "Quel roi de France a remporté la bataille de Bouvines en 1214 ?", correct: "Philippe Auguste", wrongs: ["Louis XIV", "François Ier", "Henri IV"], levels: ['5eme'] },
            { q: "Quelle héroïne a délivré Orléans en 1429 pendant la guerre de Cent Ans ?", correct: "Jeanne d'Arc", wrongs: ["Aliénor d'Aquitaine", "Catherine de Médicis", "Blanche de Castille"], levels: ['5eme'] },
            // 4ème
            { q: "En quelle année la Bastille a-t-elle été prise par le peuple parisien ?", correct: "1789", wrongs: ["1799", "1804", "1792"], levels: ['4eme', '3eme'] },
            { q: "Quel roi de France a été exécuté sur la guillotine en janvier 1793 ?", correct: "Louis XVI", wrongs: ["Louis XIV", "Louis XV", "Charles X"], levels: ['4eme'] },
            { q: "Quel philosophe des Lumières a dirigé la grande « Encyclopédie » avec d'Alembert ?", correct: "Denis Diderot", wrongs: ["Voltaire", "Rousseau", "Montesquieu"], levels: ['4eme'] },
            { q: "En quelle année Napoléon Bonaparte se fait-il sacrer empereur des Français ?", correct: "1804", wrongs: ["1799", "1815", "1792"], levels: ['4eme', '2nde'] },
            { q: "En quelle année la France abolit-elle définitivement l'esclavage grâce à Victor Schœlcher ?", correct: "1848", wrongs: ["1789", "1804", "1871"], levels: ['4eme', '2nde'] },
            // 3ème (Brevet)
            { q: "En quelle année la Première Guerre mondiale a-t-elle débuté ?", correct: "1914", wrongs: ["1916", "1918", "1912"], levels: ['3eme'] },
            { q: "Quelle célèbre bataille de 1916 a opposé Français et Allemands dans les tranchées ?", correct: "la bataille de Verdun", wrongs: ["la bataille de la Somme", "la bataille de la Marne", "la bataille d'Austerlitz"], levels: ['3eme'] },
            { q: "Quel général a lancé l'appel à la résistance à la radio de Londres le 18 juin 1940 ?", correct: "Charles de Gaulle", wrongs: ["Philippe Pétain", "Jean Moulin", "Gaston Doumergue"], levels: ['3eme'] },
            { q: "En quelle année le mur de Berlin est-il tombé, marquant la fin de la guerre froide ?", correct: "1989", wrongs: ["1991", "1975", "1985"], levels: ['3eme', 'terminale'] },
            { q: "En quelle année la Ve République française a-t-elle été instaurée par De Gaulle ?", correct: "1958", wrongs: ["1944", "1968", "1946"], levels: ['3eme', '1ere'] },
            // 2nde
            { q: "Quel navigateur a atteint les Caraïbes en octobre 1492 ?", correct: "Christophe Colomb", wrongs: ["Vasco de Gama", "Fernand de Magellan", "Jacques Cartier"], levels: ['2nde'] },
            { q: "Quel réformateur allemand a publié ses 95 thèses en 1517, initiant le protestantisme ?", correct: "Martin Luther", wrongs: ["Jean Calvin", "Érasme", "Thomas More"], levels: ['2nde'] },
            { q: "Quel souverain français a signé l'Édit de Nantes en 1598 pour clore les guerres de religion ?", correct: "Henri IV", wrongs: ["François Ier", "Louis XIV", "Charles IX"], levels: ['2nde'] },
            { q: "Quel imprimeur allemand a mis au point l'imprimerie à caractères mobiles vers 1450 ?", correct: "Johannes Gutenberg", wrongs: ["Alde Manuce", "Léonard de Vinci", "Nicolas Copernic"], levels: ['2nde'] },
            // 1ère
            { q: "Quelle loi fondamentale de 1905 institue la séparation des Églises et de l'État en France ?", correct: "la loi de 1905", wrongs: ["le décret d'Allarde", "la loi Jules Ferry", "la constitution de 1875"], levels: ['1ere'] },
            { q: "Quel événement politique de 1871 a vu le peuple parisien s'insurger contre le gouvernement versaillais ?", correct: "la Commune de Paris", wrongs: ["la Fronde", "les Trois Glorieuses", "la Terreur"], levels: ['1ere'] },
            { q: "Quel capitaine français juif a été injustement condamné pour trahison en 1894 avant d'être réhabilité ?", correct: "Alfred Dreyfus", wrongs: ["Jean Jaurès", "Georges Clemenceau", "Émile Zola"], levels: ['1ere'] },
            { q: "Quel traité de paix de 1919 a redessiné la carte de l'Europe après la Grande Guerre ?", correct: "le traité de Versailles", wrongs: ["le traité de Vienne", "le traité de Rome", "le traité d'Utrecht"], levels: ['1ere'] },
            // Terminale
            { q: "En quelle année les accords d'Évian ont-ils scellé l'indépendance de l'Algérie ?", correct: "1962", wrongs: ["1954", "1958", "1968"], levels: ['terminale'] },
            { q: "Quelle crise majeure de 1962 a failli provoquer une guerre nucléaire entre les USA et l'URSS ?", correct: "la crise des missiles de Cuba", wrongs: ["la crise du canal de Suez", "le blocus de Berlin", "la guerre de Corée"], levels: ['terminale'] },
            { q: "Quel traité de 1957 a fondé la Communauté Économique Européenne (CEE) ?", correct: "le traité de Rome", wrongs: ["le traité de Maastricht", "le traité de Lisbonne", "le traité de Paris"], levels: ['terminale'] },
            { q: "En quelle année l'URSS a-t-elle été officiellement dissoute ?", correct: "1991", wrongs: ["1989", "1985", "1995"], levels: ['terminale'] },
        ],
        geo: [
            // 6ème
            { q: "Combien d'océans principaux compte la planète Terre ?", correct: "5", wrongs: ["3", "7", "4"], levels: ['6eme'] },
            { q: "Quelle est la capitale de l'Espagne ?", correct: "Madrid", wrongs: ["Barcelone", "Séville", "Valence"], levels: ['6eme'] },
            { q: "Quel est le plus grand continent par la superficie et la population ?", correct: "l'Asie", wrongs: ["l'Afrique", "l'Amérique", "l'Europe"], levels: ['6eme'] },
            { q: "Quelle chaîne de montagnes abrite le Mont Blanc ?", correct: "les Alpes", wrongs: ["les Pyrénées", "les Vosges", "le Massif central"], levels: ['6eme', '5eme'] },
            { q: "Quel est le plus grand désert chaud de la planète ?", correct: "le Sahara", wrongs: ["le désert de Gobi", "le désert d'Atacama", "le Kalahari"], levels: ['6eme'] },
            // 5ème
            { q: "Comment appelle-t-on la baisse de la fécondité accompagnée d'une baisse de la mortalité dans un pays ?", correct: "la transition démographique", wrongs: ["l'exode rural", "la métropolisation", "l'étalement urbain"], levels: ['5eme', '2nde'] },
            { q: "Quelle ressource vitale est souvent qualifiée d'« or bleu » ?", correct: "l'eau douce", wrongs: ["le pétrole", "le gaz", "le blé"], levels: ['5eme'] },
            { q: "Quel pays est actuellement le plus peuplé du monde ?", correct: "l'Inde", wrongs: ["la Chine", "les États-Unis", "l'Indonésie"], levels: ['5eme', '2nde'] },
            // 4ème
            { q: "Par quel canal artificiel les navires passent-ils pour relier la Méditerranée à la mer Rouge ?", correct: "le canal de Suez", wrongs: ["le canal de Panama", "le détroit de Gibraltar", "le détroit du Bosphore"], levels: ['4eme', 'terminale'] },
            { q: "Quel terme désigne la concentration croissante des activités sur les littoraux maritimes ?", correct: "la littoralisation", wrongs: ["la désertification", "la continentalisation", "la déforestation"], levels: ['4eme', 'terminale'] },
            { q: "Comment qualifie-t-on une ville géante de plus de 10 millions d'habitants ?", correct: "une mégapole", wrongs: ["une mégalopolis", "un technopôle", "une banlieue"], levels: ['4eme', '1ere'] },
            // 3ème (Brevet)
            { q: "Quel est le plus long fleuve de France métropolitaine ?", correct: "la Loire", wrongs: ["la Seine", "le Rhône", "la Garonne"], levels: ['3eme', '6eme'] },
            { q: "Quelle île de l'océan Indien est un département et région d'outre-mer (DROM) français ?", correct: "La Réunion", wrongs: ["Madagascar", "Maurice", "Tahiti"], levels: ['3eme'] },
            { q: "Quelle institution européenne siège principalement à Strasbourg ?", correct: "le Parlement européen", wrongs: ["la Commission européenne", "la Cour de justice", "la BCE"], levels: ['3eme'] },
            // 2nde
            { q: "Que mesure l'Indicateur de Développement Humain (IDH) créé par le PNUD ?", correct: "le niveau de santé, d'éducation et de revenu", wrongs: ["uniquement la richesse économique brute", "la superficie forestière", "le taux de chômage seul"], levels: ['2nde'] },
            { q: "Quelle énergie n'émet pas directement de gaz à effet de serre pendant sa production ?", correct: "l'énergie solaire", wrongs: ["le charbon", "le gaz naturel", "le pétrole"], levels: ['2nde'] },
            // 1ère
            { q: "Quel grand quartier d'affaires de la métropole parisienne concentre sièges sociaux et tours modernes ?", correct: "La Défense", wrongs: ["Montparnasse", "Bercy", "Châtelet"], levels: ['1ere'] },
            { q: "Comment appelle-t-on le retour de populations aisées dans des quartiers populaires rénovés ?", correct: "la gentrification", wrongs: ["la périurbanisation", "la ghettoïsation", "l'exode rural"], levels: ['1ere'] },
            // Terminale
            { q: "Que signifie le sigle ZEE en droit international maritime ?", correct: "Zone Économique Exclusive", wrongs: ["Zone d'Exploitation Européenne", "Zone Écologique Équilibrée", "Zone d'Échange Exceptionnel"], levels: ['terminale'] },
            { q: "Par quel détroit stratégique passe environ un tiers du trafic maritime pétrolier mondial ?", correct: "le détroit d'Ormuz", wrongs: ["le détroit de Malacca", "le détroit de Béring", "le détroit de Magellan"], levels: ['terminale'] },
            { q: "Quel canal relie l'océan Pacifique à l'océan Atlantique en Amérique centrale ?", correct: "le canal de Panama", wrongs: ["le canal de Suez", "le canal de Corinthe", "le canal du Midi"], levels: ['terminale'] },
        ],
        svt: [
            // 6ème
            { q: "Quel organite cellulaire vert permet aux végétaux de réaliser la photosynthèse ?", correct: "le chloroplaste", wrongs: ["le ribosome", "la vacuole", "le noyau"], levels: ['6eme', '5eme'] },
            { q: "Quel gaz les feuilles absorbent-elles principalement pour synthétiser leur matière organique ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le dioxygène (O₂)", "l'azote", "l'argon"], levels: ['6eme'] },
            { q: "Quelle partie de la fleur contient les grains de pollen ?", correct: "l'étamine", wrongs: ["le pistil", "le pétale", "le sépale"], levels: ['6eme'] },
            { q: "Quel est le premier maillon d'une chaîne alimentaire terrestre ?", correct: "un producteur primaire végétal", wrongs: ["un carnivore", "un décomposeur", "un herbivore"], levels: ['6eme'] },
            // 5ème
            { q: "Quel organe permet aux poissons d'extraire le dioxygène dissous dans l'eau ?", correct: "les branchies", wrongs: ["les poumons", "les trachées", "les opercules"], levels: ['5eme'] },
            { q: "Où s'effectue principalement l'absorption des nutriments vers le sang chez l'humain ?", correct: "dans l'intestin grêle", wrongs: ["dans l'estomac", "dans le côlon", "dans le foie"], levels: ['5eme'] },
            { q: "Quel type de volcanisme se caractérise par des coulées de lave fluide sans explosion violente ?", correct: "le volcanisme effusif", wrongs: ["le volcanisme explosif", "le volcanisme fissural", "le point chaud"], levels: ['5eme'] },
            // 4ème
            { q: "Quelle cellule spécialisée transmet l'influx nerveux dans notre organisme ?", correct: "le neurone", wrongs: ["l'hématie", "l'adipocyte", "le lymphocyte"], levels: ['4eme'] },
            { q: "Comment appelle-t-on l'espace de communication chimique entre deux neurones ?", correct: "la synapse", wrongs: ["l'axone", "la dendrite", "la gaine de myéline"], levels: ['4eme', 'terminale'] },
            { q: "Quelle hormone mâle est sécrétée par les testicules à partir de la puberté ?", correct: "la testostérone", wrongs: ["l'œstrogène", "la progestérone", "l'insuline"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "Combien de chromosomes comporte une cellule humaine non reproductrice saine ?", correct: "46 chromosomes", wrongs: ["23 chromosomes", "48 chromosomes", "44 chromosomes"], levels: ['3eme'] },
            { q: "Quelle macromolécule en forme de double hélice porte l'information génétique ?", correct: "l'ADN", wrongs: ["l'ARN", "l'ATP", "le glycogène"], levels: ['3eme', '2nde'] },
            { q: "Comment qualifie-t-on un allèle qui s'exprime même s'il n'est présent qu'en un seul exemplaire ?", correct: "dominant", wrongs: ["récessif", "codominant", "muet"], levels: ['3eme', '2nde'] },
            { q: "Quel type de globule blanc détruit les bactéries par phagocytose ?", correct: "les phagocytes", wrongs: ["les plaquettes", "les hématies", "les neurones"], levels: ['3eme'] },
            // 2nde
            { q: "Quelle organite cellulaire est le siège de la respiration cellulaire et produit l'ATP ?", correct: "la mitochondrie", wrongs: ["le lysosome", "l'appareil de Golgi", "le centrosome"], levels: ['2nde', '1ere'] },
            { q: "Quelles bases azotées s'apparient dans l'ADN selon la règle de complémentarité ?", correct: "A avec T, et C avec G", wrongs: ["A avec C, et T avec G", "A avec U, et C avec T", "A avec G, et T avec C"], levels: ['2nde'] },
            // 1ère
            { q: "Quelle phase de la division cellulaire (mitose) sépare les chromatides sœurs vers les pôles ?", correct: "l'anaphase", wrongs: ["la prophase", "la métaphase", "la télophase"], levels: ['1ere'] },
            { q: "Quel type de lymphocytes produit des anticorps circulants spécifiques ?", correct: "les lymphocytes B (plasmocytes)", wrongs: ["les lymphocytes T cytotoxiques", "les macrophages", "les hématies"], levels: ['1ere', 'terminale'] },
            // Terminale
            { q: "Quel phénomène génétique lors de la prophase I de méiose échange des portions de chromatides ?", correct: "le crossing-over (brassage intrachromosomique)", wrongs: ["la mutation ponctuelle", "la dérive génétique", "l'épissage alternatif"], levels: ['terminale'] },
            { q: "Quel réflexe involontaire provoque la contraction d'un muscle en réponse à son propre étirement ?", correct: "le réflexe myotatique", wrongs: ["le réflexe conditionné", "le réflexe cornéen", "le réflexe nociceptif"], levels: ['terminale'] },
        ],
        physique: [
            // 6ème
            { q: "Dans quel état physique la matière prend-elle la forme du récipient tout en gardant un volume propre ?", correct: "liquide", wrongs: ["solide", "gazeux", "plasma"], levels: ['6eme'] },
            { q: "Quel instrument de mesure utilise-t-on pour mesurer une masse ?", correct: "une balance", wrongs: ["une éprouvette", "un thermomètre", "un dynamomètre"], levels: ['6eme'] },
            { q: "Quel composant fournit l'énergie électrique dans un circuit simple ?", correct: "la pile (générateur)", wrongs: ["la lampe", "l'interrupteur", "le fil"], levels: ['6eme'] },
            // 5ème
            { q: "À quelle température l'eau pure gèle-t-elle à pression atmosphérique normale ?", correct: "0 °C", wrongs: ["100 °C", "-10 °C", "4 °C"], levels: ['5eme'] },
            { q: "Comment qualifie-t-on un mélange où l'on ne distingue aucun constituant à l'œil nu ?", correct: "un mélange homogène", wrongs: ["un mélange hétérogène", "un corps pur", "une suspension"], levels: ['5eme'] },
            { q: "Si une lampe grille dans un circuit en série, que font les autres lampes ?", correct: "elles s'éteignent toutes", wrongs: ["elles restent allumées", "elles brillent plus fort", "elles clignotent"], levels: ['5eme'] },
            // 4ème
            { q: "Quelle est la vitesse de la lumière dans le vide (arrondie) ?", correct: "300 000 km/s", wrongs: ["150 000 km/s", "3 000 000 km/s", "30 000 km/s"], levels: ['4eme', '3eme'] },
            { q: "Quelle formule relie la masse m, le volume V et la masse volumique ρ ?", correct: "ρ = m / V", wrongs: ["ρ = m × V", "ρ = V / m", "ρ = m + V"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "Quelle loi fondamentale relie la tension U, la résistance R et l'intensité I ?", correct: "la loi d'Ohm (U = R × I)", wrongs: ["la loi de Newton", "la loi de Joule", "la loi de Coulomb"], levels: ['3eme'] },
            { q: "Quelle est l'unité de mesure de la puissance électrique dans le système international ?", correct: "le watt (W)", wrongs: ["le joule (J)", "le volt (V)", "l'ampère (A)"], levels: ['3eme'] },
            { q: "Quelle formule donne l'énergie cinétique d'un objet en mouvement de masse m et vitesse v ?", correct: "Ec = 1/2 m v²", wrongs: ["Ec = m × g × h", "Ec = m × v", "Ec = 1/2 m² v"], levels: ['3eme', '1ere'] },
            { q: "Quelle grandeur mesure un dynamomètre ?", correct: "une force (en newtons)", wrongs: ["une masse (en kg)", "une tension (en V)", "un poids (en kg)"], levels: ['3eme'] },
            // 2nde
            { q: "Quelle loi décrit la réfraction de la lumière entre deux milieux d'indices n₁ et n₂ ?", correct: "la loi de Snell-Descartes (n₁ sin i₁ = n₂ sin i₂)", wrongs: ["la loi de Kepler", "la loi d'Ohm", "la loi de Beer-Lambert"], levels: ['2nde'] },
            { q: "Selon le principe d'inertie, que fait un objet si les forces qui s'exercent sur lui se compensent ?", correct: "il est immobile ou en mouvement rectiligne uniforme", wrongs: ["il accélère en ligne droite", "il décrit une trajectoire circulaire", "il ralentit progressivement"], levels: ['2nde', '1ere'] },
            // 1ère
            { q: "Quelle est la relation reliant la longueur d'onde λ, la célérité v et la période T d'une onde ?", correct: "λ = v × T", wrongs: ["λ = v / T", "λ = v × f²", "λ = T / v"], levels: ['1ere'] },
            { q: "Quelle quantité d'énergie mécanique se conserve en l'absence de frottements ?", correct: "Em = Ec + Ep", wrongs: ["Em = Ec - Ep", "Em = Ec × Ep", "Em = Ec / Ep"], levels: ['1ere'] },
            // Terminale
            { q: "Selon la 2e loi de Newton, à quoi est égale la somme des forces extérieures appliquées à un point matériel ?", correct: "m × a (masse × accélération)", wrongs: ["m × v", "1/2 m v²", "m × g × h"], levels: ['terminale'] },
            { q: "Quel effet physique décale la fréquence d'une onde lorsque la source s'éloigne ou se rapproche ?", correct: "l'effet Doppler", wrongs: ["l'effet Joule", "l'effet photoélectrique", "l'effet Zeeman"], levels: ['terminale'] },
        ],
        chimie: [
            // 6ème
            { q: "Quelle est la formule chimique de la molécule d'eau ?", correct: "H₂O", wrongs: ["CO₂", "O₂", "NaCl"], levels: ['6eme', '5eme'] },
            { q: "Quel réactif prend une couleur bleue en présence d'eau ?", correct: "le sulfate de cuivre anhydre", wrongs: ["l'eau de chaux", "le papier pH", "la liqueur de Fehling"], levels: ['6eme'] },
            // 5ème
            { q: "Quel gaz trouble l'eau de chaux en présence de dioxyde de carbone ?", correct: "le dioxyde de carbone", wrongs: ["le dioxygène", "le diazote", "l'hélium"], levels: ['5eme'] },
            { q: "Quelle proportion approximative de diazote (N₂) l'air atmosphérique contient-il ?", correct: "environ 78 %", wrongs: ["environ 21 %", "environ 50 %", "environ 1 %"], levels: ['5eme'] },
            // 4ème
            { q: "Combien d'atomes d'hydrogène compte une molécule de méthane (CH₄) ?", correct: "4", wrongs: ["1", "2", "5"], levels: ['4eme'] },
            { q: "Lors de la combustion complète du carbone dans le dioxygène, quel gaz est produit ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le monoxyde de carbone (CO)", "le dihydrogène (H₂)", "l'ozone (O₃)"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "Quel est le pH d'une solution d'eau pure neutre à 25 °C ?", correct: "7", wrongs: ["0", "14", "1"], levels: ['3eme'] },
            { q: "Un atome qui gagne un électron devient :", correct: "un anion (ion négatif)", wrongs: ["un cation (ion positif)", "un isotope", "un neutron"], levels: ['3eme'] },
            { q: "Quel ion caractérise l'acidité d'une solution aqueuse ?", correct: "l'ion hydrogène H⁺ (ou oxonium H₃O⁺)", wrongs: ["l'ion hydroxyde HO⁻", "l'ion chlorure Cl⁻", "l'ion sodium Na⁺"], levels: ['3eme'] },
            // 2nde
            { q: "Quelle unité du système international mesure la quantité de matière ?", correct: "la mole (mol)", wrongs: ["le gramme (g)", "le litre (L)", "le joule (J)"], levels: ['2nde'] },
            { q: "Que vaut approximativement la constante d'Avogadro N_A ?", correct: "6,02 × 10²³ mol⁻¹", wrongs: ["6,02 × 10²⁶ mol⁻¹", "1,60 × 10⁻¹⁹ C", "3,00 × 10⁸ m/s"], levels: ['2nde', '1ere'] },
            { q: "Dans un tableau d'avancement, comment nomme-t-on le réactif entièrement consommé en premier ?", correct: "le réactif limitant", wrongs: ["le réactif en excès", "le produit final", "le catalyseur"], levels: ['2nde'] },
            // 1ère
            { q: "Dans une réaction d'oxydoréduction, qu'est-ce qu'un réducteur ?", correct: "une espèce chimique capable de céder des électrons", wrongs: ["une espèce capable de capter des électrons", "une espèce qui libère des protons", "une espèce neutre"], levels: ['1ere'] },
            { q: "Quelle loi d'optique relie l'absorbance A d'une solution à sa concentration molaire C ?", correct: "la loi de Beer-Lambert (A = k × C)", wrongs: ["la loi d'Ohm", "la loi de Boyle-Mariotte", "la loi de Lavoisier"], levels: ['1ere'] },
            // Terminale
            { q: "Comment est définie la constante d'acidité Ka d'un couple acide/base AH / A⁻ ?", correct: "Ka = ([A⁻] × [H₃O⁺]) / [AH]", wrongs: ["Ka = [AH] / [A⁻]", "Ka = [H₃O⁺] × [HO⁻]", "Ka = pH × [A⁻]"], levels: ['terminale'] },
            { q: "Comment appelle-t-on une substance qui accélère une réaction chimique sans être consommée ?", correct: "un catalyseur", wrongs: ["un inhibiteur", "un réactif limitant", "un soluté"], levels: ['terminale'] },
        ],
        techno: [
            // 6ème
            { q: "À quelle grande famille de matériaux le pin et le chêne appartiennent-ils ?", correct: "les matières organiques (bois)", wrongs: ["les métaux", "les céramiques", "les plastiques"], levels: ['6eme'] },
            { q: "Sur une bicyclette, quel organe transmet l'effort des pédales à la roue arrière ?", correct: "la chaîne et les pignons", wrongs: ["les freins", "le guidon", "la fourche"], levels: ['6eme'] },
            // 5ème
            { q: "Quel type de pont utilise des câbles métalliques tendus depuis de hauts pylônes (ex: Viaduc de Millau) ?", correct: "un pont à haubans", wrongs: ["un pont en arc", "un pont à poutres", "un pont suspendu simple"], levels: ['5eme'] },
            { q: "Quelle énergie renouvelable exploite directement la force du vent ?", correct: "l'énergie éolienne", wrongs: ["l'énergie hydraulique", "l'énergie solaire", "l'énergie géothermique"], levels: ['5eme'] },
            // 4ème
            { q: "Dans un système automatisé, quel composant détecte une information de l'environnement (ex: présence, lumière) ?", correct: "un capteur", wrongs: ["un actionneur", "un moteur", "une batterie"], levels: ['4eme'] },
            { q: "Quel filament plastique biosourcé est le plus couramment employé en impression 3D FDM ?", correct: "le PLA", wrongs: ["le PVC", "le téflon", "le plomb"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "Quelle suite d'instructions logique exécutée pas à pas résout un problème précis ?", correct: "un algorithme", wrongs: ["un processeur", "une base de données", "un disque dur"], levels: ['3eme'] },
            { q: "Quel protocole réseau sans fil à courte portée permet d'appairer un casque audio ou une souris ?", correct: "le Bluetooth", wrongs: ["la 4G", "la fibre optique", "le câble Ethernet"], levels: ['3eme'] },
            { q: "Dans un réseau local, quel équipement central aiguille les paquets de données entre ordinateurs ?", correct: "le routeur (ou switch)", wrongs: ["la souris", "l'imprimante", "la webcam"], levels: ['3eme'] },
            // 2nde
            { q: "Combien d'octets (bytes) y a-t-il exactement dans un kilooctet selon la norme classique ?", correct: "1024 octets (ou 1000 selon la norme décimale)", wrongs: ["8 octets", "100 octets", "64 octets"], levels: ['2nde'] },
            { q: "Quel composant électronique principal traite les instructions et exécute les calculs dans un PC ?", correct: "le microprocesseur (CPU)", wrongs: ["la carte mère", "l'alimentation", "le disque SSD"], levels: ['2nde'] },
            // 1ère
            { q: "En programmation Python, quel mot-clé permet de déclarer une nouvelle fonction ?", correct: "def", wrongs: ["function", "func", "declare"], levels: ['1ere'] },
            { q: "Dans une base de données relationnelle SQL, quelle instruction permet d'extraire des lignes d'une table ?", correct: "SELECT", wrongs: ["FETCH", "GET", "LOOKUP"], levels: ['1ere'] },
            // Terminale
            { q: "Quel modèle de cryptographie utilise une clé publique pour chiffrer et une clé privée pour déchiffrer ?", correct: "le chiffrement asymétrique (RSA)", wrongs: ["le chiffrement symétrique", "le code de César", "le hachage simple"], levels: ['terminale'] },
            { q: "Quelle architecture matérielle classique sépare le processeur de la mémoire centrale via un bus ?", correct: "l'architecture de Von Neumann", wrongs: ["l'architecture Harvard", "l'architecture RISC", "l'architecture ARM"], levels: ['terminale'] },
        ],
        anglais: [
            // 6ème
            { q: "What is the English translation for « chien » ?", correct: "dog", wrongs: ["cat", "bird", "fish"], levels: ['6eme'] },
            { q: "Complete the sentence: 'She ___ my best friend.'", correct: "is", wrongs: ["are", "am", "be"], levels: ['6eme'] },
            { q: "What is the opposite of 'big'?", correct: "small", wrongs: ["fast", "loud", "heavy"], levels: ['6eme'] },
            { q: "What day comes immediately after Tuesday?", correct: "Wednesday", wrongs: ["Thursday", "Monday", "Friday"], levels: ['6eme'] },
            // 5ème
            { q: "Choose the correct present continuous form: 'Listen, they ___ (sing) right now.'", correct: "are singing", wrongs: ["sing", "is singing", "sings"], levels: ['5eme'] },
            { q: "What is the irregular plural form of 'child'?", correct: "children", wrongs: ["childs", "childes", "childrens"], levels: ['5eme'] },
            { q: "How do you say « Il est midi » in English?", correct: "It's midday (or 12 o'clock)", wrongs: ["It's midnight", "It's twelve minutes", "It's noon past"], levels: ['5eme'] },
            // 4ème
            { q: "What is the simple past form of the irregular verb 'to see'?", correct: "saw", wrongs: ["seed", "seen", "seeing"], levels: ['4eme'] },
            { q: "Choose the correct comparative: 'A car is ___ than a bicycle.'", correct: "faster", wrongs: ["more fast", "fastest", "as fast"], levels: ['4eme'] },
            { q: "What does the phrasal verb 'to look for' mean in French?", correct: "chercher", wrongs: ["ressembler à", "surveiller", "regarder vers"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "Complete with the present perfect: 'I ___ (live) here for three years.'", correct: "have lived", wrongs: ["lived", "had lived", "am living"], levels: ['3eme'] },
            { q: "Which modal verb expresses strong prohibition?", correct: "mustn't", wrongs: ["should", "might", "can"], levels: ['3eme'] },
            { q: "What does the idiom 'it's raining cats and dogs' mean?", correct: "il pleut des cordes", wrongs: ["des animaux tombent du ciel", "il fait grand soleil", "il y a un orage de grêle"], levels: ['3eme'] },
            // 2nde
            { q: "Complete the conditional clause: 'If it rains tomorrow, we ___ stay home.'", correct: "will", wrongs: ["would", "were", "did"], levels: ['2nde'] },
            { q: "What does the false friend 'actually' mean in French?", correct: "en réalité / en fait", wrongs: ["actuellement", "en action", "efficacement"], levels: ['2nde'] },
            // 1ère
            { q: "Which modal verb best expresses a strong logical deduction: 'He's been working all day, he ___ be exhausted.'", correct: "must", wrongs: ["might", "should", "could"], levels: ['1ere'] },
            { q: "What does the linking word 'nevertheless' mean?", correct: "néanmoins / pourtant", wrongs: ["en conséquence", "de plus", "par conséquent"], levels: ['1ere'] },
            // Terminale
            { q: "Complete the third conditional: 'If you had studied harder, you ___ the exam.'", correct: "would have passed", wrongs: ["will pass", "would pass", "had passed"], levels: ['terminale'] },
            { q: "What is the meaning of the formal verb 'to jeopardize'?", correct: "mettre en péril / compromettre", wrongs: ["justifier", "juger équitablement", "accélérer"], levels: ['terminale'] },
        ],
        emc: [
            // 6ème
            { q: "Quel document officiel fixe les droits et les devoirs de tous les élèves au collège ?", correct: "le règlement intérieur", wrongs: ["le carnet de correspondance seul", "le bulletin scolaire", "le code de la route"], levels: ['6eme'] },
            { q: "Quel numéro vert gratuit permet de signaler une situation de harcèlement scolaire en France ?", correct: "le 3018", wrongs: ["le 15", "le 18", "le 112"], levels: ['6eme', '5eme'] },
            { q: "Qui les élèves élisent-ils au début de l'année pour les représenter aux conseils de classe ?", correct: "les délégués de classe", wrongs: ["le proviseur", "les surveillants", "les parents d'élèves"], levels: ['6eme'] },
            // 5ème
            { q: "Quel grand principe républicain interdit toute différence de droit entre les femmes et les hommes ?", correct: "l'égalité filles-garçons", wrongs: ["la laïcité", "la hiérarchie", "le suffrage censitaire"], levels: ['5eme'] },
            { q: "Comment appelle-t-on le fait d'aider bénévolement les personnes en difficulté au sein d'un collectif ?", correct: "la solidarité associative", wrongs: ["le civisme forcé", "la concurrence", "le mécénat privé"], levels: ['5eme'] },
            // 4ème
            { q: "Quel texte officiel affiché dans tous les collèges publics garantit la neutralité religieuse de l'État ?", correct: "la Charte de la laïcité", wrongs: ["la Déclaration des droits de 1789", "le Code civil", "la Constitution de 1958"], levels: ['4eme'] },
            { q: "Quelle limite légale s'applique à la liberté d'expression ?", correct: "l'interdiction de l'injure, de la diffamation et de l'incitation à la haine", wrongs: ["l'interdiction de critiquer une loi", "l'obligation de penser comme la majorité", "aucune limite absolue"], levels: ['4eme'] },
            // 3ème (Brevet)
            { q: "À quel âge un citoyen français acquiert-il le droit de vote ?", correct: "18 ans", wrongs: ["16 ans", "21 ans", "25 ans"], levels: ['3eme'] },
            { q: "Quelle est la devise officielle de la République française ?", correct: "Liberté, Égalité, Fraternité", wrongs: ["Travail, Famille, Patrie", "Ordre et Progrès", "Dieu et mon droit"], levels: ['3eme'] },
            { q: "Quelles sont les deux assemblées qui composent le Parlement français et votent les lois ?", correct: "l'Assemblée nationale et le Sénat", wrongs: ["le Conseil d'État et le Sénat", "le Conseil constitutionnel et la Mairie", "les Députés et les Ministres"], levels: ['3eme'] },
            { q: "Quelle journée obligatoire permet aux jeunes citoyens de découvrir les enjeux de défense nationale ?", correct: "la JDC (Journée Défense et Citoyenneté)", wrongs: ["le baccalauréat", "le recensement militaire seul", "le service militaire actif"], levels: ['3eme'] },
            // 2nde
            { q: "Quel grand principe juridique affirme que nul ne peut être sanctionné sans texte de loi préalable ?", correct: "le principe de légalité des délits et des peines", wrongs: ["la présomption de culpabilité", "le privilège d'immunité", "la coutume"], levels: ['2nde'] },
            { q: "En quelle année l'Assemblée générale de l'ONU a-t-elle proclamé la Déclaration universelle des droits de l'homme ?", correct: "1948", wrongs: ["1789", "1918", "1968"], levels: ['2nde', '1ere'] },
            // 1ère
            { q: "Quel est le rôle fondamental d'un lanceur d'alerte dans une démocratie ?", correct: "révéler des faits contraires à l'intérêt général au public", wrongs: ["espionner pour un pays étranger", "voter les budgets", "juger les procès"], levels: ['1ere'] },
            { q: "Quel organisme veille au pluralisme politique dans les médias audiovisuels en France ?", correct: "l'Arcom (ex-CSA)", wrongs: ["l'Insee", "la Cnil", "le Défenseur des droits"], levels: ['1ere'] },
            // Terminale
            { q: "Quelle haute juridiction vérifie la conformité des lois à la Constitution française (notamment via la QPC) ?", correct: "le Conseil constitutionnel", wrongs: ["le Conseil d'État", "la Cour de cassation", "la Cour des comptes"], levels: ['terminale'] },
            { q: "Où siège la Cour pénale internationale (CPI) chargée de juger les crimes contre l'humanité ?", correct: "à La Haye (Pays-Bas)", wrongs: ["à Genève (Suisse)", "à New York (USA)", "à Bruxelles (Belgique)"], levels: ['terminale'] },
        ],
        philo: [
            // Collège (Initiation à la réflexion philosophique, morale & esprit critique)
            { q: "Dans l'Antiquité grecque, quel sage disait « Tout ce que je sais, c'est que je ne sais rien » ?", correct: "Socrate", wrongs: ["Alexandre", "Jules César", "Héraclite"], levels: ['6eme', '5eme', '4eme', '3eme'] },
            { q: "Que signifie étymologiquement le mot « philosophie » en grec ancien ?", correct: "l'amour de la sagesse", wrongs: ["la science des dieux", "le pouvoir de la parole", "la recherche de richesse"], levels: ['6eme', '5eme', '4eme', '3eme'] },
            { q: "Quelle distinction philosophique sépare une simple croyance sans preuve d'un savoir vérifié ?", correct: "croire n'est pas savoir", wrongs: ["croire est toujours supérieur", "le savoir est toujours faux", "il n'y a aucune différence"], levels: ['6eme', '5eme', '4eme', '3eme'] },
            { q: "Dans le mythe de Gygès raconté par Platon, que permet l'anneau magique trouvé par le berger ?", correct: "de devenir invisible aux yeux de tous", wrongs: ["de voler dans les cieux", "de lire dans les pensées", "de transformer le plomb en or"], levels: ['5eme', '4eme', '3eme'] },
            { q: "Quelle formule éthique universelle invite à ne pas faire à autrui ce qu'on ne voudrait pas subir ?", correct: "la règle d'or", wrongs: ["la loi du plus fort", "l'impératif égoïste", "le droit du talion"], levels: ['6eme', '5eme', '4eme', '3eme'] },
            { q: "Quelle allégorie de Platon illustre des prisonniers prenant des ombres pour la réalité ?", correct: "l'allégorie de la caverne", wrongs: ["le mythe de Sisyphe", "le talon d'Achille", "le tonneau des Danaïdes"], levels: ['4eme', '3eme', '2nde'] },
            // 2nde
            { q: "Selon Aristote, par quel sentiment la philosophie et la recherche du savoir commencent-elles ?", correct: "l'étonnement", wrongs: ["la peur", "la colère", "l'ennui"], levels: ['2nde'] },
            { q: "Qu'est-ce qui distingue traditionnellement l'acquis culturel de la nature biologique chez l'humain ?", correct: "la culture est transmise par l'apprentissage social", wrongs: ["la nature s'apprend à l'école", "la culture est purement génétique", "il n'y a aucune distinction"], levels: ['2nde'] },
            { q: "Quel terme philosophique désigne la capacité de faire des choix sans y être contraint par une force extérieure ?", correct: "le libre arbitre", wrongs: ["le déterminisme absolu", "le fatalisme", "le réflexe"], levels: ['2nde', '1ere'] },
            // 1ère
            { q: "Qui a formulé la célèbre certitude : « Je pense, donc je suis » (Cogito, ergo sum) ?", correct: "René Descartes", wrongs: ["Jean-Jacques Rousseau", "Blaise Pascal", "David Hume"], levels: ['1ere', 'terminale'] },
            { q: "Quelle philosophie antique d'Épictète et Marc Aurèle enseigne de se concentrer sur ce qui dépend de nous ?", correct: "le stoïcisme", wrongs: ["l'épicurisme", "le nihilisme", "le cynisme"], levels: ['1ere', 'terminale'] },
            { q: "Selon Jean-Jacques Rousseau, dans quel état vivait l'homme avant l'établissement de la société et des lois ?", correct: "l'état de nature", wrongs: ["l'état de guerre permanente", "le règne de la machine", "le siècle des Lumières"], levels: ['1ere', 'terminale'] },
            // Terminale (Programme officiel du Bac)
            { q: "Pour Sigmund Freud, quelle instance psychique inconsciente regroupe les pulsions et désirs refoulés ?", correct: "le Ça (et l'Inconscient)", wrongs: ["le Surmoi", "le Moi conscient", "la raison pure"], levels: ['terminale'] },
            { q: "Selon Emmanuel Kant, quel impératif moral exige d'agir de façon à ce que notre maxime devienne une loi universelle ?", correct: "l'impératif catégorique", wrongs: ["l'impératif hypothétique", "le principe de plaisir", "l'utilitarisme strict"], levels: ['terminale'] },
            { q: "Quel philosophe du XVIIe siècle a soutenu que la liberté n'est pas le libre arbitre mais « la connaissance de la nécessité » ?", correct: "Baruch Spinoza", wrongs: ["René Descartes", "Thomas Hobbes", "John Locke"], levels: ['terminale'] },
            { q: "Quel penseur existentialiste a écrit : « L'existence précède l'essence » et « L'homme est condamné à être libre » ?", correct: "Jean-Paul Sartre", wrongs: ["Albert Camus", "Michel Foucault", "Arthur Schopenhauer"], levels: ['terminale'] },
            { q: "Dans « Le Prince », quel auteur analyse la conquête et la conservation réaliste du pouvoir d'État ?", correct: "Nicolas Machiavel", wrongs: ["Thomas More", "Montesquieu", "Alexis de Tocqueville"], levels: ['terminale'] },
            { q: "Pour Karl Marx, quel phénomène le travailleur subit-il lorsque le produit de son travail lui devient étranger ?", correct: "l'aliénation", wrongs: ["l'émancipation", "la sublimation", "la rédemption"], levels: ['terminale'] },
            { q: "Selon Friedrich Nietzsche, quelle notion morale dénonce-t-il comme une invention affaiblissant les instincts vitaux ?", correct: "la morale du ressentiment (des esclaves)", wrongs: ["la volonté de puissance", "le surhomme", "le gai savoir"], levels: ['terminale'] },
        ]
    };

    /** Filtre la banque de questions pour un niveau scolaire donné. */
    function getQuestionsForNiveau(subjectId, niveau) {
        const fullBank = FACT_BANKS[subjectId] || [];
        const norm = normalizeNiveau(niveau);
        const band = bandForNiveau(norm);

        // 1. Filtrage précis par niveau (exact match)
        const exact = fullBank.filter(q => {
            if (Array.isArray(q.levels)) return q.levels.includes(norm);
            return q.level === norm;
        });
        if (exact.length >= 6) return exact;

        // 2. Filtrage par cycle / bande (collège ou lycée)
        const cycle = fullBank.filter(q => {
            if (Array.isArray(q.levels)) {
                return q.levels.includes(norm) || q.levels.includes(band);
            }
            return q.level === norm || q.level === band;
        });
        if (cycle.length >= 5) return cycle;

        // 3. Repli de secours
        return fullBank;
    }

    function generateBankLesson(subjectId, index, niveau, variant = 0) {
        const norm = normalizeNiveau(niveau);
        const bank = getQuestionsForNiveau(subjectId, norm);

        if (!bank || bank.length === 0) {
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: 'Question générale',
                opts: ['A', 'B', 'C', 'D'],
                correct: 0,
                exp: '',
            };
        }

        const rng = seededRng(hashSeed(subjectId + ':' + norm + ':' + index + ':v' + variant));
        const fact = bank[(index * 3 + variant) % bank.length];
        const opts0 = [fact.correct, ...fact.wrongs];
        const { opts, correct } = shuffleOptions(opts0, 0, rng);

        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: fact.q,
            opts,
            correct,
            exp: fact.exp || `Réponse : ${fact.correct}.`,
        };
    }

    /* ================= API publique ================= */

    return {
        normalizeNiveau,
        bandForNiveau,
        getQuestionsForNiveau,

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
