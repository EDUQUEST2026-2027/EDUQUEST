/* =============================================================================
   QUESTION-BANK.JS — EDUQUEST v1.29.1
   Banque de questions et générateur procédural pour les 36 matières officielles
   et les 9 niveaux scolaires (18 filières au lycée & BTS) :
   - 6ème, 5ème, 4ème, 3ème (Collège)
   - 2nde, 1ère, Terminale, BTS 1ère année, BTS 2ème année (Lycée & Post-Bac)

   CAPACITÉS CLÉS :
   1. Couverture complète des 36 matières jusqu'à 100 niveaux chacune :
      - Banques de faits ciblés par classe (FACT_BANKS) + générateurs procéduraux
        déterministes (Maths collège/lycée/BTS, Français, Anglais, Espagnol, Physique,
        Chimie, Technologie, NSI, SES, STMG, STI2D, CIEL, STL, STD2A, STHR, STAV,
        S2TMD, HLP, BTS SIO/MCO/CG, Bac Pro MELEC/ASSP…).
   2. Différenciation stricte par classe et cycle (jamais de mélange Collège ↔ Lycée).
   3. Variété multi-types : QCM (4 choix mélangés déterministes), Vrai/Faux, Réponse courte.
   4. Absence de répétition consécutive grâce aux decks stables, variantes paresseuses
      (lazy getters) et mémoire adaptative dans js/core/adaptive-engine.js.
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
        const str = String(n || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (str === 'bts2' || (str.includes('bts') && str.includes('2'))) return 'bts2';
        if (str === 'bts1' || str.includes('bts')) return 'bts1';
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
        const lyceeGrades = ['2nde', '1ere', 'terminale', 'bts1', 'bts2'];
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
                    const a = 2 + Math.floor(rng() * 14);
                    const mode = (index + variant) % 3;
                    if (mode === 0) {
                        correct = -a;
                        q = `Sur une droite graduée, quel est le symétrique du nombre ${a} par rapport à l'origine 0 ?`;
                        wrongCandidates = [a, a + 1, -a - 1, 0];
                        exp = `Le symétrique par rapport à 0 est l'opposé : -${a}.`;
                    } else if (mode === 1) {
                        const k = 3 + Math.floor(rng() * 8);
                        correct = k * 2;
                        q = `Si un point A est à ${k} cm du centre de symétrie O, quelle est la distance entre A et son symétrique A' ?`;
                        wrongCandidates = [k, k + 2, k * 3, Math.max(1, k - 1)];
                        exp = `O est le milieu de [AA'], donc AA' = 2 × ${k} = ${correct} cm.`;
                    } else {
                        const xO = 2 + Math.floor(rng() * 8);
                        const xA = xO + 1 + Math.floor(rng() * 6);
                        correct = 2 * xO - xA;
                        q = `Sur une droite graduée, A a pour abscisse ${xA}. Quelle est l'abscisse de son symétrique par rapport au point O(${xO}) ?`;
                        wrongCandidates = [xO + (xA - xO) * 2, -xA, correct + 1, correct - 1];
                        exp = `xA' = 2 × xO - xA = 2 × ${xO} - ${xA} = ${correct}.`;
                    }
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
                    const hyp = (3 + Math.floor(rng() * 8)) * 2;
                    const mode = (index + variant) % 3;
                    if (mode === 0) {
                        correct = hyp / 2;
                        q = `Dans un triangle rectangle, l'hypoténuse vaut ${hyp} cm et un angle aigu mesure 60° (cos 60° = 0,5). Que mesure le côté adjacent ?`;
                        wrongCandidates = [hyp, hyp / 2 + 2, Math.max(1, hyp / 2 - 2), hyp * 2];
                        exp = `Côté adjacent = hypoténuse × cos(60°) = ${hyp} × 0,5 = ${correct} cm.`;
                    } else if (mode === 1) {
                        const adj = 3 + Math.floor(rng() * 9);
                        correct = adj * 2;
                        q = `Dans un triangle rectangle, le côté adjacent à un angle de 60° mesure ${adj} cm (cos 60° = 0,5). Quelle est la longueur de l'hypoténuse ?`;
                        wrongCandidates = [adj, adj + 3, adj * 3, Math.max(1, adj - 1)];
                        exp = `Hypoténuse = adjacent ÷ cos(60°) = ${adj} ÷ 0,5 = ${correct} cm.`;
                    } else {
                        const angles = [
                            { ang: 60, val: '0,5', wrongs: [30, 45, 90] },
                            { ang: 0, val: '1', wrongs: [30, 45, 60] },
                            { ang: 90, val: '0', wrongs: [30, 45, 60] },
                        ];
                        const pick = angles[(index + variant) % angles.length];
                        correct = pick.ang;
                        q = `Quel angle (en degrés) a pour cosinus exactement ${pick.val} ?`;
                        wrongCandidates = pick.wrongs;
                        exp = `cos(${pick.ang}°) = ${pick.val}.`;
                    }
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
        } else if (norm === 'bts1' || norm === 'bts2') {
            // BTS (Maths appliquées : matrices, nombres complexes, modulo, probas, dérivées, intégrales, finances)
            const kinds = ['det_2x2', 'complex_mod', 'modulo_arith', 'esperance_bin', 'derivee_poly_bts', 'integrale_simple', 'taux_evol_bts'];
            const kind = kinds[(index * 3 + variant) % kinds.length];
            allowNegative = true;
            switch (kind) {
                case 'det_2x2': {
                    const a = 1 + Math.floor(rng() * 6), b = 1 + Math.floor(rng() * 5);
                    const c = 1 + Math.floor(rng() * 5), d = 1 + Math.floor(rng() * 6);
                    correct = a * d - b * c;
                    q = `Calcule le déterminant de la matrice 2×2 : [[${a}, ${b}], [${c}, ${d}]] (ad − bc).`;
                    wrongCandidates = [a * d + b * c, a * c - b * d, correct + 2, correct - 2];
                    exp = `det = (${a} × ${d}) − (${b} × ${c}) = ${a * d} − ${b * c} = ${correct}.`;
                    break;
                }
                case 'complex_mod': {
                    const trips = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]];
                    const t = trips[(index + variant + Math.floor(rng() * trips.length)) % trips.length];
                    correct = t[2];
                    q = `Quel est le module |z| du nombre complexe z = ${t[0]} + ${t[1]}i ?`;
                    wrongCandidates = [t[0] + t[1], correct + 1, correct - 1, t[0] * t[1]];
                    exp = `|z| = √(${t[0]}² + ${t[1]}²) = √(${t[0] * t[0] + t[1] * t[1]}) = ${correct}.`;
                    break;
                }
                case 'modulo_arith': {
                    const m = [5, 7, 8, 9, 11, 12][Math.floor(rng() * 6)];
                    const mult = 3 + Math.floor(rng() * 8);
                    const rem = 1 + Math.floor(rng() * (m - 1));
                    const n = mult * m + rem;
                    correct = rem;
                    q = `En arithmétique modulaire (utile en cryptographie), quel est le reste de ${n} mod ${m} ?`;
                    wrongCandidates = [(rem + 1) % m, (rem + 2) % m, Math.max(0, rem - 1), mult];
                    exp = `${n} = ${mult} × ${m} + ${rem}, donc ${n} ≡ ${rem} [mod ${m}].`;
                    break;
                }
                case 'esperance_bin': {
                    const n = [20, 40, 50, 80, 100][Math.floor(rng() * 5)];
                    const pPct = [10, 20, 25, 40, 50][Math.floor(rng() * 5)];
                    correct = Math.round((n * pPct) / 100);
                    q = `Une variable X suit une loi binomiale B(n = ${n} ; p = ${(pPct / 100).toFixed(2).replace('.', ',')}). Quelle est son espérance E(X) = n × p ?`;
                    wrongCandidates = [correct + 5, Math.max(1, correct - 5), n - correct, pPct];
                    exp = `E(X) = n × p = ${n} × ${(pPct / 100).toFixed(2)} = ${correct}.`;
                    break;
                }
                case 'derivee_poly_bts': {
                    const a = 2 + Math.floor(rng() * 5), x0 = 1 + Math.floor(rng() * 4);
                    correct = 3 * a * x0 * x0;
                    q = `Soit f(x) = ${a}x³. Calcule le nombre dérivé f'(${x0}).`;
                    wrongCandidates = [a * x0 * x0, 2 * a * x0, correct + a, Math.max(1, correct - a)];
                    exp = `f'(x) = ${3 * a}x², donc f'(${x0}) = ${3 * a} × ${x0}² = ${correct}.`;
                    break;
                }
                case 'integrale_simple': {
                    const b = 2 + Math.floor(rng() * 6);
                    correct = b * b;
                    q = `Calcule l'intégrale définie ∫₀^${b} (2x) dx.`;
                    wrongCandidates = [2 * b, b * b + b, Math.max(1, b * b - b), b];
                    exp = `Une primitive de 2x est x². [x²]₀^${b} = ${b}² − 0 = ${correct}.`;
                    break;
                }
                case 'taux_evol_bts': {
                    const c0 = [1000, 2000, 4000, 5000][Math.floor(rng() * 4)];
                    const t = [5, 10, 20][Math.floor(rng() * 3)];
                    correct = Math.round(c0 * (1 + t / 100));
                    q = `Un capital de ${c0} € est placé à un taux annuel simple de ${t} %. Quelle valeur atteint-il au bout d'un an ?`;
                    wrongCandidates = [c0 + t, correct + 100, c0 - Math.round(c0 * t / 100), Math.round(c0 * t / 100)];
                    exp = `Capital final = ${c0} × (1 + ${t}/100) = ${correct} €.`;
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

    /** Générateur procédural enrichi pour la technologie (binaire, octets, échelles, énergie) */
    function generateTechnoLesson(index, norm, variant, rng) {
        const kinds = ['bin4', 'octets_bits', 'echelle', 'energie_temps'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'bin4') {
            const val = 1 + ((index * 5 + variant * 3 + Math.floor(rng() * 15)) % 15);
            const bin = val.toString(2).padStart(4, '0');
            const wrongs = uniqueWrongs(val, [val + 1, val + 2, Math.max(0, val - 1), val ^ 4], false);
            const { opts, correct } = shuffleOptions([`${val}`, ...wrongs.map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En binaire sur 4 bits, quelle est la valeur décimale du mot binaire ${bin} ?`,
                opts,
                correct,
                exp: `En binaire, ${bin} correspond au nombre décimal ${val}.`
            };
        }
        if (kind === 'octets_bits') {
            const octets = 2 + Math.floor(rng() * 12);
            const bits = octets * 8;
            const wrongs = uniqueWrongs(bits, [octets * 4, octets * 10, bits + 8, Math.max(8, bits - 8)], false).map(n => `${n} bits`);
            const { opts, correct } = shuffleOptions([`${bits} bits`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un fichier pèse ${octets} octets. Combien de bits cela représente-t-il (1 octet = 8 bits) ?`,
                opts,
                correct,
                exp: `${octets} octets × 8 = ${bits} bits.`
            };
        }
        if (kind === 'echelle') {
            const ech = [10, 20, 50, 100][Math.floor(rng() * 4)];
            const planCm = 2 + Math.floor(rng() * 9);
            const reelCm = planCm * ech;
            const wrongs = uniqueWrongs(reelCm, [reelCm + ech, Math.max(10, reelCm - ech), planCm + ech, reelCm * 2], false).map(n => `${n} cm`);
            const { opts, correct } = shuffleOptions([`${reelCm} cm`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur un plan technique à l'échelle 1/${ech}, une pièce mesure ${planCm} cm. Quelle est sa longueur réelle ?`,
                opts,
                correct,
                exp: `À l'échelle 1/${ech}, on multiplie par ${ech} : ${planCm} × ${ech} = ${reelCm} cm.`
            };
        }
        const pW = [10, 20, 50, 100, 200][Math.floor(rng() * 5)];
        const h = 2 + Math.floor(rng() * 6);
        const wh = pW * h;
        const wrongs = uniqueWrongs(wh, [pW + h, wh + pW, Math.max(10, wh - pW), wh * 2], false).map(n => `${n} Wh`);
        const { opts, correct } = shuffleOptions([`${wh} Wh`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Un appareil électrique d'une puissance de ${pW} W fonctionne pendant ${h} heures. Quelle énergie consomme-t-il (E = P × t) ?`,
            opts,
            correct,
            exp: `E = P × t = ${pW} W × ${h} h = ${wh} Wh.`
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

    /** Générateur procédural pour l'Espagnol (LV2 : conjugaison + vocabulaire) */
    function generateEspagnolLesson(index, norm, variant, rng) {
        if ((index + variant) % 2 === 0) {
            const verbs = [
                { inf: "hablar", fr: "parler", pres: ["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"] },
                { inf: "comer", fr: "manger", pres: ["como", "comes", "come", "comemos", "coméis", "comen"] },
                { inf: "vivir", fr: "vivre", pres: ["vivo", "vives", "vive", "vivimos", "vivís", "viven"] },
                { inf: "ser", fr: "être (essence)", pres: ["soy", "eres", "es", "somos", "sois", "son"] },
                { inf: "estar", fr: "être (état/lieu)", pres: ["estoy", "estás", "está", "estamos", "estáis", "están"] },
                { inf: "tener", fr: "avoir", pres: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"] },
                { inf: "ir", fr: "aller", pres: ["voy", "vas", "va", "vamos", "vais", "van"] },
                { inf: "hacer", fr: "faire", pres: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"] },
                { inf: "poder", fr: "pouvoir", pres: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"] },
                { inf: "querer", fr: "vouloir/aimer", pres: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"] },
            ];
            const pronouns = ["yo", "tú", "él/ella", "nosotros", "vosotros", "ellos/ellas"];
            const v = verbs[(index + variant * 3 + Math.floor(rng() * verbs.length)) % verbs.length];
            const pIdx = Math.floor(rng() * pronouns.length);
            const correct = v.pres[pIdx];
            const wrongs = uniqueStringWrongs(correct, v.pres.filter((_, i) => i !== pIdx));
            const { opts, correct: cIdx } = shuffleOptions([correct, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En espagnol, conjugue le verbe « ${v.inf} » (${v.fr}) au présent avec « ${pronouns[pIdx]} » :`,
                opts,
                correct: cIdx,
                exp: `Au présent de l'indicatif : ${pronouns[pIdx]} ${correct}.`
            };
        }
        const vocab = [
            { es: "el libro", fr: "le livre", wrongs: ["la fenêtre", "la chaise", "le crayon"] },
            { es: "la ventana", fr: "la fenêtre", wrongs: ["la porte", "le mur", "le toit"] },
            { es: "el perro", fr: "le chien", wrongs: ["le chat", "le cheval", "l'oiseau"] },
            { es: "la comida", fr: "la nourriture / le repas", wrongs: ["la boisson", "la cuisine", "la rue"] },
            { es: "el tiempo", fr: "le temps", wrongs: ["l'argent", "le vent", "la pluie"] },
            { es: "la ciudad", fr: "la ville", wrongs: ["le village", "la campagne", "la mer"] },
            { es: "el trabajo", fr: "le travail", wrongs: ["le voyage", "les vacances", "le jeu"] },
            { es: "la escuela", fr: "l'école", wrongs: ["la maison", "le magasin", "la place"] },
            { es: "el amigo", fr: "l'ami", wrongs: ["le frère", "le voisin", "le professeur"] },
            { es: "siempre", fr: "toujours", wrongs: ["jamais", "parfois", "demain"] },
            { es: "nunca", fr: "jamais", wrongs: ["toujours", "souvent", "hier"] },
            { es: "mañana", fr: "demain / le matin", wrongs: ["hier", "maintenant", "ce soir"] },
            { es: "ayer", fr: "hier", wrongs: ["demain", "aujourd'hui", "bientôt"] },
            { es: "sin embargo", fr: "cependant / toutefois", wrongs: ["par conséquent", "en plus", "c'est pourquoi"] },
        ];
        const deck = seededShuffle(vocab, 'es-vocab:' + norm);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.fr, item.wrongs);
        const { opts, correct } = shuffleOptions([item.fr, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Comment traduit-on « ${item.es} » en français ?`,
            opts,
            correct,
            exp: `En espagnol, « ${item.es} » signifie « ${item.fr} ».`
        };
    }

    /** Générateur procédural pour Histoire des Arts & Culture */
    function generateArtsLesson(index, norm, variant, rng) {
        const works = [
            { work: "La Joconde", artist: "Léonard de Vinci", wrongs: ["Michel-Ange", "Raphaël", "Botticelli"] },
            { work: "Guernica (1937)", artist: "Pablo Picasso", wrongs: ["Salvador Dalí", "Joan Miró", "Henri Matisse"] },
            { work: "La Nuit étoilée", artist: "Vincent van Gogh", wrongs: ["Claude Monet", "Paul Cézanne", "Paul Gauguin"] },
            { work: "Impression, soleil levant", artist: "Claude Monet", wrongs: ["Édouard Manet", "Pierre-Auguste Renoir", "Edgar Degas"] },
            { work: "La Liberté guidant le peuple", artist: "Eugène Delacroix", wrongs: ["Théodore Géricault", "Jacques-Louis David", "Gustave Courbet"] },
            { work: "Le Penseur (sculpture)", artist: "Auguste Rodin", wrongs: ["Camille Claudel", "Donatello", "Alberto Giacometti"] },
            { work: "La Persistance de la mémoire (montres molles)", artist: "Salvador Dalí", wrongs: ["René Magritte", "Max Ernst", "Pablo Picasso"] },
            { work: "Le Cri", artist: "Edvard Munch", wrongs: ["Gustav Klimt", "Egon Schiele", "Wassily Kandinsky"] },
            { work: "La Jeune Fille à la perle", artist: "Johannes Vermeer", wrongs: ["Rembrandt", "Frans Hals", "Pierre Paul Rubens"] },
            { work: "Les Quatre Saisons (concertos)", artist: "Antonio Vivaldi", wrongs: ["Jean-Sébastien Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven"] },
            { work: "La Symphonie n° 9 (Hymne à la joie)", artist: "Ludwig van Beethoven", wrongs: ["Franz Schubert", "Frédéric Chopin", "Hector Berlioz"] },
            { work: "Le Radeau de la Méduse", artist: "Théodore Géricault", wrongs: ["Eugène Delacroix", "Jean-Auguste-Dominique Ingres", "Francisco de Goya"] },
            { work: "La Naissance de Vénus", artist: "Sandro Botticelli", wrongs: ["Léonard de Vinci", "Titien", "Caravage"] },
            { work: "Les Nymphéas", artist: "Claude Monet", wrongs: ["Camille Pissarro", "Alfred Sisley", "Georges Seurat"] },
        ];
        const deck = seededShuffle(works, 'arts-deck:' + norm);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.artist, item.wrongs);
        const { opts, correct } = shuffleOptions([item.artist, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Quel artiste célèbre est l'auteur de l'œuvre « ${item.work} » ?`,
            opts,
            correct,
            exp: `« ${item.work} » est une œuvre majeure de ${item.artist}.`
        };
    }

    /** Générateur procédural pour Sciences de l'Ingénieur (SI) */
    function generateSiLesson(index, norm, variant, rng) {
        const kinds = ['rapport_engrenage', 'puissance_meca', 'rendement', 'energie_meca'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'rapport_engrenage') {
            const z1 = [12, 15, 20, 24, 30][Math.floor(rng() * 5)];
            const k = [2, 3, 4][Math.floor(rng() * 3)];
            const z2 = z1 * k;
            const n1 = [600, 900, 1200, 1800][Math.floor(rng() * 4)];
            const n2 = Math.round(n1 / k);
            const wrongs = uniqueWrongs(n2, [n1 * k, n2 + 100, Math.max(50, n2 - 100), n1], false).map(n => `${n} tr/min`);
            const { opts, correct } = shuffleOptions([`${n2} tr/min`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un pignon moteur de ${z1} dents tourne à ${n1} tr/min et entraîne une roue de ${z2} dents. Quelle est la vitesse de sortie N₂ ?`,
                opts,
                correct,
                exp: `Rapport de réduction r = Z₁/Z₂ = ${z1}/${z2} = 1/${k}, donc N₂ = ${n1} / ${k} = ${n2} tr/min.`
            };
        }
        if (kind === 'puissance_meca') {
            const c = 2 + Math.floor(rng() * 10); // N·m
            const w = [10, 20, 30, 50, 100][Math.floor(rng() * 5)]; // rad/s
            const p = c * w;
            const wrongs = uniqueWrongs(p, [p + w, Math.max(10, p - w), c + w, p * 2], false).map(n => `${n} W`);
            const { opts, correct } = shuffleOptions([`${p} W`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un moteur fournit un couple C = ${c} N·m à une vitesse angulaire ω = ${w} rad/s. Quelle est sa puissance mécanique P = C × ω ?`,
                opts,
                correct,
                exp: `P = C × ω = ${c} × ${w} = ${p} W.`
            };
        }
        if (kind === 'rendement') {
            const pAbs = [200, 400, 500, 1000][Math.floor(rng() * 4)];
            const eta = [60, 70, 75, 80, 85, 90][Math.floor(rng() * 6)];
            const pUtile = Math.round((pAbs * eta) / 100);
            const wrongs = uniqueWrongs(eta, [eta + 5, Math.max(10, eta - 10), 100 - eta, Math.min(99, eta + 10)], false).map(n => `${n} %`);
            const { opts, correct } = shuffleOptions([`${eta} %`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un système absorbe ${pAbs} W et restitue ${pUtile} W de puissance utile. Quel est son rendement η = P_utile / P_absorbée ?`,
                opts,
                correct,
                exp: `η = (${pUtile} / ${pAbs}) × 100 = ${eta} %.`
            };
        }
        const f = (2 + Math.floor(rng() * 9)) * 10; // N
        const v = 2 + Math.floor(rng() * 7); // m/s
        const p = f * v;
        const wrongs = uniqueWrongs(p, [p + f, Math.max(10, p - f), f + v, p * 2], false).map(n => `${n} W`);
        const { opts, correct } = shuffleOptions([`${p} W`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En translation, un vérin exerce une force F = ${f} N à vitesse v = ${v} m/s. Quelle est sa puissance P = F × v ?`,
            opts,
            correct,
            exp: `P = F × v = ${f} × ${v} = ${p} W.`
        };
    }

    /** Générateur procédural pour MSGN / Mercatique & Gestion-Finance (STMG / BTS) */
    function generateStmgCalcLesson(index, norm, variant, rng, modeTag) {
        const kinds = ['tva', 'marge', 'seuil_rentabilite', 'taux_marque', 'resultat_net'];
        const kind = kinds[(index + variant + (modeTag === 'msgn' ? 2 : 0)) % kinds.length];

        if (kind === 'tva') {
            const ht = [50, 100, 150, 200, 250, 400, 500][Math.floor(rng() * 7)];
            const taux = [10, 20][Math.floor(rng() * 2)];
            const ttc = Math.round(ht * (1 + taux / 100));
            const wrongs = uniqueWrongs(ttc, [ht + taux, Math.round(ht * (1 - taux / 100)), ttc + 20, Math.round(ht * taux / 100)], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${ttc} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un produit est vendu ${ht} € HT avec une TVA à ${taux} %. Quel est son prix TTC ?`,
                opts,
                correct,
                exp: `Prix TTC = HT × (1 + ${taux}/100) = ${ht} × ${(1 + taux / 100).toFixed(2)} = ${ttc} €.`
            };
        }
        if (kind === 'marge') {
            const pv = [40, 60, 80, 100, 120, 150][Math.floor(rng() * 6)];
            const pa = Math.round(pv * [0.5, 0.6, 0.7][Math.floor(rng() * 3)]);
            const marge = pv - pa;
            const wrongs = uniqueWrongs(marge, [pv + pa, marge + 10, Math.max(5, marge - 10), pa], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${marge} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un commerçant achète un article ${pa} € HT et le revend ${pv} € HT. Quelle est sa marge commerciale unitaire ?`,
                opts,
                correct,
                exp: `Marge commerciale = Prix de vente HT − Coût d'achat HT = ${pv} − ${pa} = ${marge} €.`
            };
        }
        if (kind === 'seuil_rentabilite') {
            const cf = [2000, 3000, 4000, 6000, 8000][Math.floor(rng() * 5)];
            const mcv = [20, 25, 40, 50][Math.floor(rng() * 4)];
            const qte = Math.round(cf / mcv);
            const wrongs = uniqueWrongs(qte, [qte + 20, Math.max(10, qte - 20), qte * 2, Math.round(qte / 2)], false).map(n => `${n} unités`);
            const { opts, correct } = shuffleOptions([`${qte} unités`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Les charges fixes sont de ${cf} € et la marge sur coût variable unitaire est de ${mcv} €. Combien d'unités faut-il vendre pour atteindre le point mort (seuil de rentabilité) ?`,
                opts,
                correct,
                exp: `Point mort en volume = Charges fixes / MCV unitaire = ${cf} / ${mcv} = ${qte} unités.`
            };
        }
        if (kind === 'taux_marque') {
            const pv = [100, 200, 400][Math.floor(rng() * 3)];
            const pct = [20, 25, 30, 40, 50][Math.floor(rng() * 5)];
            const marge = Math.round((pv * pct) / 100);
            const wrongs = uniqueWrongs(pct, [pct + 10, Math.max(5, pct - 10), 100 - pct, pct * 2], false).map(n => `${n} %`);
            const { opts, correct } = shuffleOptions([`${pct} %`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Pour un prix de vente HT de ${pv} € et une marge commerciale de ${marge} €, quel est le taux de marque (Marge / PV HT) ?`,
                opts,
                correct,
                exp: `Taux de marque = (${marge} / ${pv}) × 100 = ${pct} %.`
            };
        }
        const prod = (8 + Math.floor(rng() * 12)) * 1000;
        const chg = (4 + Math.floor(rng() * 4)) * 1000;
        const res = prod - chg;
        const wrongs = uniqueWrongs(res, [prod + chg, res + 1000, Math.max(500, res - 1000), chg], false).map(n => `${n} €`);
        const { opts, correct } = shuffleOptions([`${res} €`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Au compte de résultat, une PME enregistre ${prod} € de produits et ${chg} € de charges. Quel est son résultat (bénéfice) ?`,
            opts,
            correct,
            exp: `Résultat = Produits − Charges = ${prod} − ${chg} = ${res} €.`
        };
    }

    /** Générateur procédural pour I2D (STI2D : énergie, CO2, thermique, rendement) */
    function generateI2dLesson(index, norm, variant, rng) {
        const kinds = ['energie_kwh', 'rendement_pv', 'r_thermique', 'bilan_co2'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'energie_kwh') {
            const pKw = [2, 3, 4, 5, 6][Math.floor(rng() * 5)];
            const h = 2 + Math.floor(rng() * 7);
            const e = pKw * h;
            const wrongs = uniqueWrongs(e, [pKw + h, e + pKw, Math.max(1, e - pKw), e * 2], false).map(n => `${n} kWh`);
            const { opts, correct } = shuffleOptions([`${e} kWh`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Une installation photovoltaïque délivre une puissance moyenne de ${pKw} kW pendant ${h} heures d'ensoleillement. Quelle énergie électrique produit-elle ?`,
                opts,
                correct,
                exp: `E = P × t = ${pKw} kW × ${h} h = ${e} kWh.`
            };
        }
        if (kind === 'rendement_pv') {
            const pRec = [500, 1000, 2000][Math.floor(rng() * 3)];
            const eta = [15, 20, 25][Math.floor(rng() * 3)];
            const pElec = Math.round((pRec * eta) / 100);
            const wrongs = uniqueWrongs(pElec, [pElec + 50, Math.max(50, pElec - 50), pRec - pElec, pElec * 2], false).map(n => `${n} W`);
            const { opts, correct } = shuffleOptions([`${pElec} W`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un panneau solaire de rendement ${eta} % reçoit une puissance lumineuse de ${pRec} W. Quelle puissance électrique utile fournit-il ?`,
                opts,
                correct,
                exp: `P_utile = P_reçue × η = ${pRec} × ${eta / 100} = ${pElec} W.`
            };
        }
        if (kind === 'r_thermique') {
            const eCm = [10, 12, 16, 20][Math.floor(rng() * 4)]; // cm -> 0.10 .. 0.20 m
            const lam = 0.04; // W/(m·K) laine de verre
            const rVal = Math.round((eCm / 100) / lam * 10) / 10; // 2.5, 3, 4, 5
            const rStr = String(rVal).replace('.', ',');
            const wrongs = uniqueStringWrongs(`${rStr} m²·K/W`, [`${String(rVal * 2).replace('.', ',')} m²·K/W`, `${String(Math.max(0.5, rVal - 1)).replace('.', ',')} m²·K/W`, `${String(rVal + 1.5).replace('.', ',')} m²·K/W`]);
            const { opts, correct } = shuffleOptions([`${rStr} m²·K/W`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un isolant d'épaisseur e = ${eCm / 100} m a une conductivité thermique λ = 0,04 W/(m·K). Quelle est sa résistance thermique R = e / λ ?`,
                opts,
                correct,
                exp: `R = e / λ = ${eCm / 100} / 0,04 = ${rStr} m²·K/W.`
            };
        }
        const dist = [100, 200, 300, 500][Math.floor(rng() * 4)];
        const gKm = [100, 120, 150][Math.floor(rng() * 3)];
        const kg = Math.round((dist * gKm) / 1000);
        const wrongs = uniqueWrongs(kg, [kg + 5, Math.max(2, kg - 5), kg * 2, Math.round(kg / 2)], false).map(n => `${n} kg CO₂`);
        const { opts, correct } = shuffleOptions([`${kg} kg CO₂`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Un véhicule émet ${gKm} g de CO₂ par km. Quelle masse de CO₂ (en kg) émet-il sur un trajet de ${dist} km ?`,
            opts,
            correct,
            exp: `${dist} × ${gKm} g = ${dist * gKm} g = ${kg} kg de CO₂.`
        };
    }

    /** Générateur procédural pour SIN (STI2D : CAN, débit, PWM, binaire/logique) */
    function generateSinLesson(index, norm, variant, rng) {
        const kinds = ['can_niveaux', 'pwm_moy', 'debit_temps', 'porte_logique'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'can_niveaux') {
            const bits = [4, 6, 8, 10, 12][Math.floor(rng() * 5)];
            const levels = Math.pow(2, bits);
            const wrongs = uniqueWrongs(levels, [bits * 2, levels / 2, levels * 2, levels - 1], false);
            const { opts, correct } = shuffleOptions([String(levels), ...wrongs.map(String)], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Combien de valeurs numériques distinctes un Convertisseur Analogique-Numérique (CAN) de résolution ${bits} bits peut-il coder ?`,
                opts,
                correct,
                exp: `Un CAN sur N bits code 2^N valeurs : 2^${bits} = ${levels} niveaux.`
            };
        }
        if (kind === 'pwm_moy') {
            const vcc = [5, 10, 12, 20][Math.floor(rng() * 4)];
            const alpha = [25, 50, 75][Math.floor(rng() * 3)];
            const vmoy = (vcc * alpha) / 100;
            const vStr = String(vmoy).replace('.', ',');
            const wrongs = uniqueStringWrongs(`${vStr} V`, [`${String(vcc - vmoy).replace('.', ',')} V`, `${vcc} V`, `${String(vmoy + 1).replace('.', ',')} V`, `0 V`]);
            const { opts, correct } = shuffleOptions([`${vStr} V`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un signal MLI (PWM) d'amplitude ${vcc} V possède un rapport cyclique α = ${alpha} %. Quelle est sa tension moyenne V_moy = α × V_max ?`,
                opts,
                correct,
                exp: `V_moy = ${alpha / 100} × ${vcc} = ${vStr} V.`
            };
        }
        if (kind === 'debit_temps') {
            const mo = [10, 20, 40, 50, 100][Math.floor(rng() * 5)];
            const debitMbps = [8, 16, 40, 80][Math.floor(rng() * 4)]; // Mbit/s -> debitMbps/8 Mo/s
            const moPerSec = debitMbps / 8;
            const sec = Math.round(mo / moPerSec);
            const wrongs = uniqueWrongs(sec, [sec * 2, Math.max(1, Math.round(sec / 2)), sec + 5, mo * debitMbps], false).map(n => `${n} s`);
            const { opts, correct } = shuffleOptions([`${sec} s`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Combien de secondes faut-il pour transférer un fichier de ${mo} Mo avec un débit utile de ${debitMbps} Mbit/s (1 octet = 8 bits) ?`,
                opts,
                correct,
                exp: `${debitMbps} Mbit/s = ${moPerSec} Mo/s, donc t = ${mo} / ${moPerSec} = ${sec} s.`
            };
        }
        const gates = [
            { expr: "1 ET 0", res: "0", exp: "La porte ET (AND) ne vaut 1 que si toutes les entrées valent 1." },
            { expr: "1 ET 1", res: "1", exp: "1 AND 1 = 1." },
            { expr: "0 OU 1", res: "1", exp: "La porte OU (OR) vaut 1 dès qu'au moins une entrée vaut 1." },
            { expr: "0 OU 0", res: "0", exp: "0 OR 0 = 0." },
            { expr: "1 XOR 1", res: "0", exp: "Le OU exclusif (XOR) vaut 1 uniquement si les entrées sont différentes : 1 XOR 1 = 0." },
            { expr: "1 XOR 0", res: "1", exp: "Les deux entrées sont différentes, donc 1 XOR 0 = 1." },
            { expr: "NON(1)", res: "0", exp: "L'inverseur (NOT) inverse l'état logique : NON(1) = 0." },
            { expr: "NON(1 ET 1) (porte NAND)", res: "0", exp: "1 ET 1 = 1, puis NON(1) = 0." },
        ];
        const pick = gates[(index + variant * 3) % gates.length];
        const shuffled = shuffleOptions([pick.res, pick.res === '1' ? '0' : '1', 'Indéterminé', '2'], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En logique booléenne, quelle est la sortie de l'opération : ${pick.expr} ?`,
            opts: shuffled.opts,
            correct: shuffled.correct,
            exp: pick.exp
        };
    }

    /** Générateur procédural pour Cybersécurité (CIEL / NSI / BTS) */
    function generateCyberLesson(index, norm, variant, rng) {
        const scenarios = [
            { q: "Un attaquant injecte `' OR '1'='1` dans un formulaire de connexion pour contourner l'authentification. De quelle attaque s'agit-il ?", ans: "Injection SQL (SQLi)", wrongs: ["Attaque DDoS", "Phishing", "Man-in-the-Middle"], exp: "L'injection SQL exploite une mauvaise validation des entrées utilisateur dans une requête SQL." },
            { q: "Un pirate envoie un e-mail imitant une banque pour dérober les identifiants d'un salarié. Quelle est cette technique ?", ans: "Hameçonnage (Phishing)", wrongs: ["Ransomware", "Injection XSS", "ARP Spoofing"], exp: "Le phishing repose sur l'ingénierie sociale pour tromper la victime." },
            { q: "Un logiciel malveillant chiffre tous les fichiers d'une entreprise et réclame une rançon en cryptomonnaie. Comment l'appelle-t-on ?", ans: "Un rançongiciel (Ransomware)", wrongs: ["Un pare-feu", "Un cheval de Troie bénin", "Un VPN"], exp: "Le ransomware rend les données inaccessibles par chiffrement afin d'extorquer une rançon." },
            { q: "Des milliers de machines infectées (botnet) saturent un serveur web pour le rendre inaccessible. Quel type d'attaque est-ce ?", ans: "Déni de service distribué (DDoS)", wrongs: ["Force brute locale", "Injection XSS", "Écoute passive"], exp: "Le DDoS vise à porter atteinte à la Disponibilité d'un service." },
            { q: "Un attaquant insère du code JavaScript malveillant dans un commentaire affiché sur le navigateur des autres visiteurs. Quelle faille exploite-t-il ?", ans: "Cross-Site Scripting (XSS)", wrongs: ["Buffer Overflow", "DNS Spoofing", "SQL Injection"], exp: "La faille XSS permet d'exécuter du script arbitraire dans le navigateur d'une victime." },
            { q: "Quel pilier de la triade CID (CIA) garantit qu'une donnée n'a pas été modifiée de façon non autorisée ?", ans: "L'Intégrité", wrongs: ["La Confidentialité", "La Disponibilité", "La Portabilité"], exp: "L'intégrité (souvent vérifiée par empreinte SHA-256) assure que la donnée reste intacte." },
            { q: "Quel pilier de la triade CID (CIA) garantit que seules les personnes autorisées peuvent lire une information ?", ans: "La Confidentialité", wrongs: ["La Disponibilité", "La Traçabilité", "L'Intégrité"], exp: "La confidentialité protège contre la divulgation non autorisée (ex : via chiffrement)." },
            { q: "Quel algorithme produit une empreinte à sens unique (hachage cryptographique) sans permettre de retrouver le message d'origine ?", ans: "SHA-256", wrongs: ["AES-256", "RSA", "Base64"], exp: "SHA-256 est une fonction de hachage cryptographique ; Base64 n'est qu'un encodage, AES/RSA sont du chiffrement." },
            { q: "Quelle mesure combine un mot de passe (ce que je sais) et un code temporaire sur téléphone (ce que je possède) ?", ans: "L'authentification multifacteur (MFA / 2FA)", wrongs: ["Le chiffrement symétrique", "La segmentation VLAN", "Le NAT"], exp: "La MFA renforce considérablement la sécurité contre le vol de mot de passe." },
            { q: "Dans le cadre du RGPD, quelle autorité française contrôle la protection des données personnelles ?", ans: "La CNIL", wrongs: ["L'ANSSI", "L'ARCOM", "L'INSEE"], exp: "La CNIL (Commission Nationale de l'Informatique et des Libertés) veille au respect du RGPD." },
            { q: "En France, quelle agence nationale est l'autorité de référence en matière de sécurité des systèmes d'information ?", ans: "L'ANSSI", wrongs: ["La CNIL", "L'ARCEP", "Le CSA"], exp: "L'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) conseille et protège l'État et les OIV." },
            { q: "Quelle règle de sauvegarde recommande 3 copies, 2 supports différents et 1 copie hors site ?", ans: "La règle 3-2-1", wrongs: ["La règle OSI", "Le modèle Zero Trust", "Le principe CIA"], exp: "La stratégie 3-2-1 protège les sauvegardes contre les pannes, incendies et ransomwares." },
        ];
        const deck = seededShuffle(scenarios, 'cyber-deck:' + norm);
        const item = deck[(Math.floor(index / 2) + variant * 5) % deck.length];
        const wrongs = uniqueStringWrongs(item.ans, item.wrongs);
        const { opts, correct } = shuffleOptions([item.ans, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: item.q,
            opts,
            correct,
            exp: item.exp
        };
    }

    /** Générateur procédural pour Réseaux & Systèmes (CIEL / NSI / BTS : ports, CIDR, OSI, Linux) */
    function generateReseauxLesson(index, norm, variant, rng) {
        const kinds = ['ports', 'cidr_hosts', 'osi_layers', 'linux_cmd'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'ports') {
            const ports = [
                { proto: "HTTP (web non chiffré)", port: "80" },
                { proto: "HTTPS (web chiffré TLS)", port: "443" },
                { proto: "SSH (administration distante sécurisée)", port: "22" },
                { proto: "DNS (résolution de noms de domaine)", port: "53" },
                { proto: "FTP (contrôle transfert de fichiers)", port: "21" },
                { proto: "SMTP (envoi de courrier électronique)", port: "25" },
                { proto: "DHCP serveur (attribution d'IP)", port: "67" },
                { proto: "RDP (Bureau à distance Windows)", port: "3389" },
                { proto: "IMAP (réception d'e-mails synchronisée)", port: "143" },
                { proto: "SNMP (supervision réseau)", port: "161" },
            ];
            const deck = seededShuffle(ports, 'net-ports:' + norm);
            const item = deck[(Math.floor(index / 2) + variant * 3) % deck.length];
            const others = seededShuffle(ports.filter(p => p.port !== item.port).map(p => p.port), 'net-p-w:' + index + ':' + variant);
            const wrongs = uniqueStringWrongs(item.port, others);
            const { opts, correct } = shuffleOptions([item.port, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quel est le numéro de port TCP/UDP standard utilisé par le protocole ${item.proto} ?`,
                opts,
                correct,
                exp: `Le port standard de ${item.proto} est le port ${item.port}.`
            };
        }
        if (kind === 'cidr_hosts') {
            const masks = [
                { cidr: "/24", mask: "255.255.255.0", hosts: 254 },
                { cidr: "/25", mask: "255.255.255.128", hosts: 126 },
                { cidr: "/26", mask: "255.255.255.192", hosts: 62 },
                { cidr: "/27", mask: "255.255.255.224", hosts: 30 },
                { cidr: "/28", mask: "255.255.255.240", hosts: 14 },
                { cidr: "/29", mask: "255.255.255.248", hosts: 6 },
                { cidr: "/30", mask: "255.255.255.252", hosts: 2 },
            ];
            const item = masks[(index + variant * 2) % masks.length];
            if ((index + variant) % 2 === 0) {
                const wrongs = uniqueWrongs(item.hosts, [item.hosts + 2, Math.max(1, item.hosts - 2), item.hosts * 2, Math.max(1, Math.floor(item.hosts / 2))], false);
                const { opts, correct } = shuffleOptions([String(item.hosts), ...wrongs.map(String)], 0, rng);
                return {
                    type: 'qcm',
                    title: 'Niveau ' + (index + 1),
                    q: `Dans un sous-réseau IPv4 en notation CIDR ${item.cidr}, combien d'adresses IP d'hôtes utilisables sont disponibles (2^n − 2) ?`,
                    opts,
                    correct,
                    exp: `En ${item.cidr}, il reste ${32 - parseInt(item.cidr.slice(1), 10)} bits hôtes : 2^${32 - parseInt(item.cidr.slice(1), 10)} − 2 = ${item.hosts} hôtes utilisables.`
                };
            }
            const otherMasks = masks.filter(m => m.mask !== item.mask).map(m => m.mask);
            const wrongs = uniqueStringWrongs(item.mask, otherMasks);
            const { opts, correct } = shuffleOptions([item.mask, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Quel masque de sous-réseau décimal pointé correspond au préfixe CIDR ${item.cidr} ?`,
                opts,
                correct,
                exp: `Le préfixe ${item.cidr} correspond au masque ${item.mask}.`
            };
        }
        if (kind === 'osi_layers') {
            const layers = [
                { num: 1, name: "Physique (signaux, câbles, bits)" },
                { num: 2, name: "Liaison de données (trames, MAC, switch)" },
                { num: 3, name: "Réseau (paquets, IP, routage)" },
                { num: 4, name: "Transport (segments, TCP/UDP, ports)" },
                { num: 5, name: "Session (ouverture et maintien de session)" },
                { num: 6, name: "Présentation (encodage, chiffrement, compression)" },
                { num: 7, name: "Application (HTTP, DNS, SMTP, SSH)" },
            ];
            const item = layers[(index + variant * 2) % layers.length];
            const others = layers.filter(l => l.num !== item.num).map(l => l.name);
            const wrongs = uniqueStringWrongs(item.name, seededShuffle(others, 'osi:' + index + ':' + variant));
            const { opts, correct } = shuffleOptions([item.name, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Dans le modèle OSI (7 couches), à quoi correspond la couche n° ${item.num} ?`,
                opts,
                correct,
                exp: `La couche ${item.num} du modèle OSI est la couche ${item.name}.`
            };
        }
        const cmds = [
            { cmd: "ping", desc: "tester la joignabilité d'un hôte via ICMP" },
            { cmd: "chmod", desc: "modifier les permissions (droits rwx) d'un fichier sous Linux" },
            { cmd: "ls -la", desc: "lister tous les fichiers (y compris cachés) avec leurs détails" },
            { cmd: "ip a", desc: "afficher les interfaces réseau et leurs adresses IP sous Linux" },
            { cmd: "traceroute", desc: "afficher la liste des routeurs traversés jusqu'à une destination" },
            { cmd: "grep", desc: "rechercher un motif de texte dans un fichier ou flux" },
            { cmd: "sudo", desc: "exécuter une commande avec les privilèges administrateur (root)" },
            { cmd: "ssh", desc: "ouvrir un terminal distant chiffré sur un serveur" },
        ];
        const pick = cmds[(index + variant * 3) % cmds.length];
        const otherCmds = cmds.filter(c => c.cmd !== pick.cmd).map(c => c.cmd);
        const wrongs = uniqueStringWrongs(pick.cmd, seededShuffle(otherCmds, 'cmd:' + index + ':' + variant));
        const { opts, correct } = shuffleOptions([pick.cmd, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En administration système/réseau Linux, quelle commande permet de ${pick.desc} ?`,
            opts,
            correct,
            exp: `La commande « ${pick.cmd} » sert à ${pick.desc}.`
        };
    }

    /** Générateur procédural pour Électronique & Systèmes Embarqués (CIEL / STI2D / BTS) */
    function generateElectroniqueLesson(index, norm, variant, rng) {
        const kinds = ['res_serie', 'res_parallele', 'led_res', 'pont_diviseur'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'res_serie') {
            const r1 = [100, 150, 220, 330, 470][Math.floor(rng() * 5)];
            const r2 = [100, 220, 330, 470, 680][Math.floor(rng() * 5)];
            const req = r1 + r2;
            const wrongs = uniqueWrongs(req, [Math.abs(r1 - r2) + 50, Math.round((r1 * r2) / (r1 + r2)), req + 100, Math.max(50, req - 100)], false).map(n => `${n} Ω`);
            const { opts, correct } = shuffleOptions([`${req} Ω`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Deux résistances R₁ = ${r1} Ω et R₂ = ${r2} Ω sont montées en SÉRIE. Quelle est la résistance équivalente R_eq ?`,
                opts,
                correct,
                exp: `En série, les résistances s'additionnent : R_eq = ${r1} + ${r2} = ${req} Ω.`
            };
        }
        if (kind === 'res_parallele') {
            const r = [100, 200, 240, 300, 400, 600, 1000][Math.floor(rng() * 7)];
            const req = r / 2;
            const wrongs = uniqueWrongs(req, [r * 2, r, req + 50, Math.max(10, req - 50)], false).map(n => `${n} Ω`);
            const { opts, correct } = shuffleOptions([`${req} Ω`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Deux résistances identiques de ${r} Ω sont montées en PARALLÈLE (dérivation). Quelle est la résistance équivalente ?`,
                opts,
                correct,
                exp: `Deux résistances identiques en parallèle divisent la valeur par 2 : ${r} / 2 = ${req} Ω.`
            };
        }
        if (kind === 'led_res') {
            const vcc = [5, 9, 12][Math.floor(rng() * 3)];
            const vled = 2; // V
            const iMa = [10, 20][Math.floor(rng() * 2)]; // mA
            const rVal = Math.round(((vcc - vled) * 1000) / iMa);
            const wrongs = uniqueWrongs(rVal, [Math.round((vcc * 1000) / iMa), rVal + 100, Math.max(50, rVal - 100), rVal * 2], false).map(n => `${n} Ω`);
            const { opts, correct } = shuffleOptions([`${rVal} Ω`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `On alimente une LED (tension de seuil V_LED = ${vled} V, courant I = ${iMa} mA) sous V_CC = ${vcc} V. Quelle résistance de protection R = (V_CC − V_LED) / I faut-il ?`,
                opts,
                correct,
                exp: `R = (${vcc} − ${vled}) / ${(iMa / 1000)} = ${rVal} Ω.`
            };
        }
        const vin = [6, 10, 12, 16, 20][Math.floor(rng() * 5)];
        const vout = vin / 2;
        const wrongs = uniqueWrongs(vout, [vin, vout + 2, Math.max(1, vout - 2), vin * 2], false).map(n => `${n} V`);
        const { opts, correct } = shuffleOptions([`${vout} V`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Un pont diviseur de tension est composé de deux résistances égales (R₁ = R₂ = 1 kΩ) alimentées par V_in = ${vin} V. Que vaut la tension de sortie V_out ?`,
            opts,
            correct,
            exp: `V_out = V_in × R₂ / (R₁ + R₂) = ${vin} × 1/2 = ${vout} V.`
        };
    }

    /** Générateur procédural pour Biotechnologies & Labo (STL / ASSP) */
    function generateBiotechLesson(index, norm, variant, rng) {
        const kinds = ['dilution', 'microscope', 'pcr_cycles', 'concentration'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'dilution') {
            const c1 = [20, 40, 50, 80, 100][Math.floor(rng() * 5)];
            const f = [2, 4, 5, 10][Math.floor(rng() * 4)];
            const c2 = c1 / f;
            const wrongs = uniqueWrongs(c2, [c1 * f, c2 + 5, Math.max(1, c2 - 2), c1 - f], false).map(n => `${n} g/L`);
            const { opts, correct } = shuffleOptions([`${c2} g/L`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `On dilue d'un facteur ${f} une solution mère de concentration ${c1} g/L. Quelle est la concentration de la solution fille ?`,
                opts,
                correct,
                exp: `La dilution divise la concentration par le facteur de dilution : ${c1} / ${f} = ${c2} g/L.`
            };
        }
        if (kind === 'microscope') {
            const oc = [10, 15][Math.floor(rng() * 2)];
            const obj = [4, 10, 40, 100][Math.floor(rng() * 4)];
            const gross = oc * obj;
            const wrongs = uniqueWrongs(gross, [oc + obj, gross * 2, Math.max(10, Math.round(gross / 2)), gross + 100], false).map(n => `×${n}`);
            const { opts, correct } = shuffleOptions([`×${gross}`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Au microscope optique, on utilise un oculaire ×${oc} avec un objectif ×${obj}. Quel est le grossissement total ?`,
                opts,
                correct,
                exp: `Grossissement total = Oculaire × Objectif = ${oc} × ${obj} = ×${gross}.`
            };
        }
        if (kind === 'pcr_cycles') {
            const cycles = [3, 4, 5, 6, 7][Math.floor(rng() * 5)];
            const copies = Math.pow(2, cycles);
            const wrongs = uniqueWrongs(copies, [cycles * 2, copies / 2, copies * 2, copies + 4], false).map(n => `${n} copies`);
            const { opts, correct } = shuffleOptions([`${copies} copies`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `À partir d'une seule molécule d'ADN double brin, combien obtient-on théoriquement de copies après ${cycles} cycles de PCR (amplification 2ⁿ) ?`,
                opts,
                correct,
                exp: `Chaque cycle de PCR double le nombre de copies : 2^${cycles} = ${copies} copies.`
            };
        }
        const m = [5, 10, 15, 20, 30][Math.floor(rng() * 5)];
        const vMl = [250, 500, 1000][Math.floor(rng() * 3)];
        const cm = (m * 1000) / vMl;
        const wrongs = uniqueWrongs(cm, [cm * 2, Math.max(1, Math.round(cm / 2)), m + vMl, cm + 10], false).map(n => `${n} g/L`);
        const { opts, correct } = shuffleOptions([`${cm} g/L`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `On dissout ${m} g de soluté dans ${vMl} mL d'eau distillée. Quelle est la concentration massique C_m = m / V (en g/L) ?`,
            opts,
            correct,
            exp: `${vMl} mL = ${vMl / 1000} L, donc C_m = ${m} / ${vMl / 1000} = ${cm} g/L.`
        };
    }

    /** Générateur procédural pour Design & Arts Appliqués (STD2A) */
    function generateDesignLesson(index, norm, variant, rng) {
        const kinds = ['echelle', 'complementaire', 'format_a', 'ergonomie'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'echelle') {
            const realCm = [100, 200, 250, 400, 500][Math.floor(rng() * 5)];
            const denom = [10, 20, 50][Math.floor(rng() * 3)];
            const planCm = realCm / denom;
            const pStr = String(planCm).replace('.', ',');
            const wrongs = uniqueStringWrongs(`${pStr} cm`, [`${realCm} cm`, `${String(planCm * 2).replace('.', ',')} cm`, `${String(planCm + 5).replace('.', ',')} cm`, `${denom} cm`]);
            const { opts, correct } = shuffleOptions([`${pStr} cm`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur un plan d'architecture à l'échelle 1:${denom}, quelle longueur représente un mur réel de ${realCm} cm (${realCm / 100} m) ?`,
                opts,
                correct,
                exp: `À l'échelle 1:${denom}, on divise par ${denom} : ${realCm} / ${denom} = ${pStr} cm.`
            };
        }
        if (kind === 'complementaire') {
            const pairs = [
                { a: 'Rouge', b: 'Vert' },
                { a: 'Bleu', b: 'Orange' },
                { a: 'Jaune', b: 'Violet' },
                { a: 'Cyan', b: 'Rouge orangé' },
                { a: 'Magenta', b: 'Vert pomme' },
            ];
            const item = pairs[(index + variant) % pairs.length];
            const others = pairs.filter(p => p.a !== item.a).map(p => p.b);
            const wrongs = uniqueStringWrongs(item.b, others);
            const { opts, correct } = shuffleOptions([item.b, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur le cercle chromatique classique (Itten), quelle est la couleur complémentaire opposée au ${item.a} ?`,
                opts,
                correct,
                exp: `Sur le cercle chromatique, le ${item.a} et le ${item.b} se font face et créent un contraste maximal.`
            };
        }
        if (kind === 'format_a') {
            const formats = [
                { name: 'A4', dim: '210 × 297 mm' },
                { name: 'A3', dim: '297 × 420 mm' },
                { name: 'A5', dim: '148 × 210 mm' },
                { name: 'A2', dim: '420 × 594 mm' },
                { name: 'A1', dim: '594 × 841 mm' },
            ];
            const item = formats[(index + variant) % formats.length];
            const others = formats.filter(f => f.name !== item.name).map(f => f.dim);
            const wrongs = uniqueStringWrongs(item.dim, others);
            const { opts, correct } = shuffleOptions([item.dim, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En design graphique (norme ISO 216), quelles sont les dimensions exactes du format papier ${item.name} ?`,
                opts,
                correct,
                exp: `Le format normalisé ${item.name} mesure ${item.dim} (ratio √2).`
            };
        }
        const dpi = [72, 150, 300][Math.floor(rng() * 3)];
        const inches = [2, 4, 5, 10][Math.floor(rng() * 4)];
        const px = dpi * inches;
        const wrongs = uniqueWrongs(px, [px / 2, px * 2, dpi + inches, px + 100], false).map(n => `${n} px`);
        const { opts, correct } = shuffleOptions([`${px} px`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Une image destinée à l'édition mesure ${inches} pouces de large à une résolution de ${dpi} DPI (pixels par pouce). Quelle est sa largeur en pixels ?`,
            opts,
            correct,
            exp: `Largeur = ${inches} × ${dpi} = ${px} pixels.`
        };
    }

    /** Générateur procédural pour Hôtellerie & Gastronomie (STHR) */
    function generateHotellerieLesson(index, norm, variant, rng) {
        const kinds = ['taux_occ', 'cout_matiere', 'revpar', 'tva_restau'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'taux_occ') {
            const cap = [40, 50, 80, 100, 120][Math.floor(rng() * 5)];
            const pct = [50, 60, 75, 80, 90][Math.floor(rng() * 5)];
            const occ = Math.round((cap * pct) / 100);
            const wrongs = uniqueWrongs(pct, [pct + 10, Math.max(10, pct - 10), 100 - pct, Math.min(95, pct + 15)], false).map(n => `${n} %`);
            const { opts, correct } = shuffleOptions([`${pct} %`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un hôtel dispose de ${cap} chambres et en vend ${occ} ce soir. Quel est son taux d'occupation (TO) ?`,
                opts,
                correct,
                exp: `TO = (Chambres louées / Chambres disponibles) × 100 = (${occ} / ${cap}) × 100 = ${pct} %.`
            };
        }
        if (kind === 'cout_matiere') {
            const cout = [4, 5, 6, 8, 10][Math.floor(rng() * 5)];
            const coeff = [3, 4][Math.floor(rng() * 2)];
            const pv = cout * coeff;
            const wrongs = uniqueWrongs(pv, [cout + coeff, pv + 4, Math.max(4, pv - 4), pv * 2], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${pv} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En restauration, un plat a un coût matière de ${cout} €. Si on applique un coefficient multiplicateur de ${coeff}, quel est son prix de vente ?`,
                opts,
                correct,
                exp: `Prix de vente = Coût matière × Coefficient = ${cout} × ${coeff} = ${pv} €.`
            };
        }
        if (kind === 'revpar') {
            const ca = [4000, 5000, 6000, 8000, 9000][Math.floor(rng() * 5)];
            const ch = [50, 80, 100][Math.floor(rng() * 3)];
            const revpar = ca / ch;
            const rStr = String(revpar).replace('.', ',');
            const wrongs = uniqueStringWrongs(`${rStr} €`, [`${String(revpar + 20).replace('.', ',')} €`, `${String(Math.max(10, revpar - 15)).replace('.', ',')} €`, `${String(revpar * 2).replace('.', ',')} €`, `${ch} €`]);
            const { opts, correct } = shuffleOptions([`${rStr} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un hôtel de ${ch} chambres réalise un CA hébergement de ${ca} € sur la nuit. Que vaut le RevPAR (CA / chambres disponibles) ?`,
                opts,
                correct,
                exp: `RevPAR = ${ca} / ${ch} = ${rStr} € par chambre disponible.`
            };
        }
        const ht = [20, 30, 40, 50, 80, 100][Math.floor(rng() * 6)];
        const ttc = ht * 1.1; // TVA 10% restauration sur place
        const wrongs = uniqueWrongs(ttc, [ht * 1.2, ht + 5, ht * 1.05, ttc + 4], false).map(n => `${n} €`);
        const { opts, correct } = shuffleOptions([`${ttc} €`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En France, un repas consommé sur place (hors alcool) est soumis à une TVA intermédiaire de 10 %. Pour un montant HT de ${ht} €, quel est le prix TTC ?`,
            opts,
            correct,
            exp: `Prix TTC = ${ht} × 1,10 = ${ttc} €.`
        };
    }

    /** Générateur procédural pour Agronomie & Écologie (STAV) */
    function generateAgronomieLesson(index, norm, variant, rng) {
        const kinds = ['rendement', 'surface_ha', 'eau_irrigation', 'ph_sol'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'rendement') {
            const surf = [4, 5, 8, 10, 12][Math.floor(rng() * 5)];
            const rdt = [60, 70, 75, 80, 90][Math.floor(rng() * 5)]; // q/ha
            const totalQ = surf * rdt;
            const totalT = totalQ / 10; // 1 tonne = 10 quintaux
            const wrongs = uniqueWrongs(totalT, [totalQ, totalT + 10, Math.max(5, totalT - 10), surf + rdt], false).map(n => `${n} tonnes`);
            const { opts, correct } = shuffleOptions([`${totalT} tonnes`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Une parcelle de blé de ${surf} hectares obtient un rendement de ${rdt} quintaux/ha (1 tonne = 10 quintaux). Quelle masse totale (en tonnes) est récoltée ?`,
                opts,
                correct,
                exp: `${surf} × ${rdt} = ${totalQ} quintaux = ${totalT} tonnes.`
            };
        }
        if (kind === 'surface_ha') {
            const ha = [2, 3, 5, 8, 12][Math.floor(rng() * 5)];
            const m2 = ha * 10000;
            const wrongs = uniqueWrongs(m2, [ha * 1000, ha * 100, ha * 100000, m2 + 5000], false).map(n => `${n.toLocaleString('fr-FR')} m²`);
            const { opts, correct } = shuffleOptions([`${m2.toLocaleString('fr-FR')} m²`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En agronomie, quelle surface en mètres carrés (m²) correspond à une parcelle de ${ha} hectares (1 ha = 10 000 m²) ?`,
                opts,
                correct,
                exp: `1 hectare = 10 000 m², donc ${ha} ha = ${m2.toLocaleString('fr-FR')} m².`
            };
        }
        if (kind === 'eau_irrigation') {
            const mm = [10, 15, 20, 25, 30][Math.floor(rng() * 5)];
            const m3Ha = mm * 10; // 1 mm = 1 L/m² = 10 m³/ha
            const wrongs = uniqueWrongs(m3Ha, [mm, mm * 100, m3Ha + 50, Math.max(10, m3Ha - 50)], false).map(n => `${n} m³/ha`);
            const { opts, correct } = shuffleOptions([`${m3Ha} m³/ha`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En agroclimatologie, une pluie de 1 mm apporte 10 m³ d'eau par hectare. Quel volume d'eau apporte une pluie de ${mm} mm sur 1 hectare ?`,
                opts,
                correct,
                exp: `${mm} mm × 10 m³/ha = ${m3Ha} m³/ha.`
            };
        }
        const cases = [
            { ph: '5,2', type: 'acide', exp: 'Un sol de pH < 6,5 est acide (un chaulage peut corriger l\'acidité).' },
            { ph: '6,8', type: 'neutre', exp: 'Entre 6,5 et 7,2, le sol est proche de la neutralité, favorable à la majorité des cultures.' },
            { ph: '8,1', type: 'basique (calcaire)', exp: 'Un sol de pH > 7,5 est basique / alcalin, souvent riche en calcaire.' },
            { ph: '4,8', type: 'très acide', exp: 'À pH 4,8, le sol est très acide, ce qui bloque l\'assimilation de certains nutriments.' },
        ];
        const pick = cases[(index + variant) % cases.length];
        const wrongs = uniqueStringWrongs(pick.type, ['acide', 'neutre', 'basique (calcaire)', 'salin saturé', 'très acide']);
        const { opts, correct } = shuffleOptions([pick.type, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `L'analyse pédologique d'une parcelle agricole indique un pH de ${pick.ph}. Comment qualifie-t-on ce sol ?`,
            opts,
            correct,
            exp: pick.exp
        };
    }

    /** Générateur procédural pour Arts de la Scène & Culture (S2TMD) */
    function generateSpectacleLesson(index, norm, variant, rng) {
        const items = [
            { q: "En musique, combien de doubles-croches équivalent à une noire ?", ans: "4", wrongs: ["2", "8", "3"], exp: "1 noire = 2 croches = 4 doubles-croches." },
            { q: "En théorie musicale, une blanche pointée vaut combien de temps en mesure 4/4 ?", ans: "3 temps", wrongs: ["2 temps", "4 temps", "1,5 temps"], exp: "Le point ajoute la moitié de la valeur : 2 + 1 = 3 temps." },
            { q: "Au théâtre français, quel côté de la scène vu depuis la salle correspond au « côté cour » ?", ans: "la droite (vu du public)", wrongs: ["la gauche (vu du public)", "le fond de scène", "l'avant-scène uniquement"], exp: "Moyen mnémotechnique : Jardin = Gauche (J-G), Cour = Droite (C-D), vus depuis la salle." },
            { q: "En danse classique, que signifie le terme « plié » ?", ans: "une flexion contrôlée des genoux", wrongs: ["un saut périlleux", "un tour sur une jambe", "une sortie de scène"], exp: "Le plié est le mouvement fondamental d'amorti et d'élan en danse classique." },
            { q: "Quel intervalle musical sépare Do et Sol (en montant) ?", ans: "une quinte juste", wrongs: ["une tierce majeure", "une quarte juste", "une octave"], exp: "Do-Ré-Mi-Fa-Sol compte 5 degrés : c'est une quinte juste (3,5 tons)." },
            { q: "Quelle règle du théâtre classique impose une action unique, en un seul lieu et en une seule journée ?", ans: "la règle des trois unités", wrongs: ["la règle de l'aparté", "la catharsis comique", "le quatrième mur brisé"], exp: "Action, lieu, temps : formulée par Boileau dans L'Art poétique (1674)." },
            { q: "En musique, quelle nuance indique de jouer « très doux » ?", ans: "pianissimo (pp)", wrongs: ["fortissimo (ff)", "mezzo-forte (mf)", "crescendo"], exp: "pp = pianissimo (très doux), p = piano (doux), f = forte (fort), ff = fortissimo (très fort)." },
            { q: "En danse contemporaine, qui est considérée comme une pionnière américaine de la danse moderne avec sa technique contraction/release ?", ans: "Martha Graham", wrongs: ["Marius Petipa", "Jean-Baptiste Lully", "Molière"], exp: "Martha Graham a révolutionné la danse du XXe siècle avec le travail du centre du corps." },
            { q: "Quel terme désigne une tirade qu'un personnage de théâtre prononce seul en scène pour livrer ses pensées ?", ans: "un monologue", wrongs: ["une didascalie", "un prologue", "un quiproquo"], exp: "Le monologue exprime l'intériorité ou le dilemme d'un personnage." },
            { q: "En musique, combien de demi-tons compte une octave juste (ex : de Do3 à Do4) ?", ans: "12 demi-tons", wrongs: ["7 demi-tons", "8 demi-tons", "10 demi-tons"], exp: "La gamme chromatique tempérée divise l'octave en 12 demi-tons égaux." },
        ];
        const deck = seededShuffle(items, 'spectacle-proc:' + norm + ':v' + variant);
        const pick = deck[(Math.floor(index / 2) + variant * 3) % deck.length];
        const wrongs = uniqueStringWrongs(pick.ans, pick.wrongs);
        const { opts, correct } = shuffleOptions([pick.ans, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: pick.q,
            opts,
            correct,
            exp: pick.exp
        };
    }

    /** Générateur procédural pour Humanités & Littérature (HLP) */
    function generateHlpLesson(index, norm, variant, rng) {
        const items = [
            { q: "Dans la rhétorique d'Aristote, quel pilier de la persuasion s'appuie sur la raison et la logique des arguments ?", ans: "le logos", wrongs: ["le pathos", "l'éthos", "l'hybris"], exp: "Aristote distingue l'éthos (crédibilité de l'orateur), le pathos (émotions) et le logos (raisonnement logique)." },
            { q: "Quel pilier rhétorique d'Aristote consiste à susciter des émotions chez l'auditoire ?", ans: "le pathos", wrongs: ["le logos", "l'éthos", "la maïeutique"], exp: "Le pathos mobilise la pitié, l'indignation ou l'enthousiasme du public." },
            { q: "Quel humaniste de la Renaissance a écrit les « Essais » (1580) avec la devise « Que sais-je ? » ?", ans: "Michel de Montaigne", wrongs: ["Jean-Paul Sartre", "Émile Zola", "Gustave Flaubert"], exp: "Montaigne inaugure l'introspection moderne et l'esprit critique humaniste dans les Essais." },
            { q: "Quelle figure de style consiste à répéter le même mot ou groupe de mots en début de plusieurs phrases ou vers successifs ?", ans: "l'anaphore", wrongs: ["l'oxymore", "la litote", "la périphrase"], exp: "Ex : « Moi président... » ou « Rome, l'unique objet de mon ressentiment... »." },
            { q: "Quel genre littéraire consiste à raconter sa propre vie à la première personne avec un pacte de sincérité (Philippe Lejeune) ?", ans: "l'autobiographie", wrongs: ["l'épopée antique", "le roman policier", "la fable animale"], exp: "Rousseau fonde l'autobiographie moderne avec Les Confessions (1782)." },
            { q: "Dans l'Antiquité grecque, comment appelle-t-on les maîtres de l'éloquence payants critiqués par Platon pour leur relativisme ?", ans: "les sophistes", wrongs: ["les stoïciens", "les épicuriens", "les romantiques"], exp: "Gorgias et Protagoras sont les sophistes les plus célèbres face à Socrate." },
            { q: "Quel courant littéraire et philosophique du XVIIIe siècle défend la raison, la tolérance et la diffusion du savoir (Encyclopédie) ?", ans: "les Lumières", wrongs: ["le surréalisme", "le naturalisme", "la Pléiade"], exp: "Voltaire, Diderot, Montesquieu et Rousseau incarnent le siècle des Lumières." },
            { q: "Comment appelle-t-on la méthode de Socrate consistant à « accoucher les esprits » par le dialogue et les questions ?", ans: "la maïeutique", wrongs: ["la catharsis", "l'allégorie", "la syllogistique"], exp: "Par des questions successives, Socrate amène son interlocuteur à découvrir la vérité par lui-même." },
            { q: "Quelle figure de style rapproche deux termes de sens opposés dans une même expression (ex : « cette obscure clarté ») ?", ans: "l'oxymore", wrongs: ["la métonymie", "l'euphémisme", "l'hyperbole"], exp: "L'oxymore crée une alliance de mots paradoxale et saisissante (Corneille, Le Cid)." },
            { q: "Dans le thème HLP « L'homme et l'animal », quelle expression Descartes utilise-t-il pour décrire les animaux dépourvus de raison ?", ans: "les animaux-machines", wrongs: ["les citoyens naturels", "les âmes rationnelles", "les sujets moraux"], exp: "Descartes oppose la pensée humaine aux automatismes corporels de l'« animal-machine », thèse vivement débattue ensuite." },
        ];
        const deck = seededShuffle(items, 'hlp-proc:' + norm + ':v' + variant);
        const pick = deck[(Math.floor(index / 2) + variant * 3) % deck.length];
        const wrongs = uniqueStringWrongs(pick.ans, pick.wrongs);
        const { opts, correct } = shuffleOptions([pick.ans, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: pick.q,
            opts,
            correct,
            exp: pick.exp
        };
    }

    /** Générateur procédural pour Développement & BDD (BTS SIO) */
    function generateDevBddLesson(index, norm, variant, rng) {
        const kinds = ['sql_clause', 'http_code', 'git_cmd', 'oop_concept'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'sql_clause') {
            const clauses = [
                { clause: 'WHERE', desc: 'filtrer les lignes selon une condition avant agrégation' },
                { clause: 'GROUP BY', desc: 'regrouper les lignes ayant la même valeur pour calculer des agrégats (COUNT, SUM)' },
                { clause: 'ORDER BY', desc: 'trier les résultats par ordre croissant (ASC) ou décroissant (DESC)' },
                { clause: 'INNER JOIN', desc: 'relier deux tables en ne conservant que les correspondances exactes' },
                { clause: 'DISTINCT', desc: 'éliminer les doublons dans les résultats d\'une requête SELECT' },
                { clause: 'HAVING', desc: 'filtrer des groupes après un GROUP BY (ex : HAVING COUNT(*) > 5)' },
            ];
            const pick = clauses[(index + variant * 2) % clauses.length];
            const others = clauses.filter(c => c.clause !== pick.clause).map(c => c.clause);
            const wrongs = uniqueStringWrongs(pick.clause, seededShuffle(others, 'sql:' + index + ':' + variant));
            const { opts, correct } = shuffleOptions([pick.clause, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `En SQL (BTS SIO), quelle clause permet de ${pick.desc} ?`,
                opts,
                correct,
                exp: `La clause SQL « ${pick.clause} » sert à ${pick.desc}.`
            };
        }
        if (kind === 'http_code') {
            const codes = [
                { code: '200 OK', desc: 'la requête a réussi et le serveur renvoie la ressource demandée' },
                { code: '201 Created', desc: 'une nouvelle ressource a bien été créée (après un POST)' },
                { code: '401 Unauthorized', desc: 'l\'utilisateur doit s\'authentifier pour accéder à la ressource' },
                { code: '403 Forbidden', desc: 'le serveur comprend la requête mais refuse l\'accès (droits insuffisants)' },
                { code: '404 Not Found', desc: 'la ressource demandée est introuvable sur le serveur' },
                { code: '500 Internal Server Error', desc: 'une erreur interne inattendue est survenue côté serveur' },
            ];
            const pick = codes[(index + variant * 2) % codes.length];
            const others = codes.filter(c => c.code !== pick.code).map(c => c.code);
            const wrongs = uniqueStringWrongs(pick.code, seededShuffle(others, 'http:' + index + ':' + variant));
            const { opts, correct } = shuffleOptions([pick.code, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Dans une API Web REST, quel code de statut HTTP indique que ${pick.desc} ?`,
                opts,
                correct,
                exp: `Le code HTTP ${pick.code} signifie que ${pick.desc}.`
            };
        }
        if (kind === 'git_cmd') {
            const cmds = [
                { cmd: 'git commit -m "..."', desc: 'enregistrer un instantané validé dans l\'historique local' },
                { cmd: 'git push', desc: 'envoyer les commits locaux vers le dépôt distant' },
                { cmd: 'git pull', desc: 'récupérer et fusionner les modifications du dépôt distant' },
                { cmd: 'git checkout -b', desc: 'créer une nouvelle branche et basculer immédiatement dessus' },
                { cmd: 'git merge', desc: 'fusionner l\'historique d\'une branche dans la branche courante' },
                { cmd: 'git status', desc: 'afficher l\'état des fichiers modifiés, indexés ou non suivis' },
            ];
            const pick = cmds[(index + variant * 2) % cmds.length];
            const others = cmds.filter(c => c.cmd !== pick.cmd).map(c => c.cmd);
            const wrongs = uniqueStringWrongs(pick.cmd, seededShuffle(others, 'git:' + index + ':' + variant));
            const { opts, correct } = shuffleOptions([pick.cmd, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Avec Git, quelle commande permet de ${pick.desc} ?`,
                opts,
                correct,
                exp: `« ${pick.cmd} » sert à ${pick.desc}.`
            };
        }
        const concepts = [
            { name: "l'encapsulation", desc: "protéger les attributs internes d'un objet (private) et n'exposer que des méthodes contrôlées" },
            { name: "l'héritage", desc: "créer une sous-classe qui réutilise et spécialise les attributs et méthodes d'une classe parente" },
            { name: "le polymorphisme", desc: "permettre à une même méthode d'avoir des comportements différents selon la classe de l'objet" },
            { name: "le motif MVC", desc: "séparer l'application en Modèle (données), Vue (affichage) et Contrôleur (logique)" },
        ];
        const pick = concepts[(index + variant) % concepts.length];
        const others = concepts.filter(c => c.name !== pick.name).map(c => c.name);
        const wrongs = uniqueStringWrongs(pick.name, others);
        const { opts, correct } = shuffleOptions([pick.name, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `En programmation orientée objet / architecture logicielle, quel principe consiste à ${pick.desc} ?`,
            opts,
            correct,
            exp: `C'est le principe de ${pick.name}.`
        };
    }

    /** Générateur procédural pour Relation Client & Commerce (BTS MCO) */
    function generateCommerceLesson(index, norm, variant, rng) {
        const kinds = ['panier_moyen', 'taux_transfo', 'marge_comm', 'indice_vente'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'panier_moyen') {
            const clients = [20, 40, 50, 100][Math.floor(rng() * 4)];
            const pm = [15, 25, 30, 45, 60][Math.floor(rng() * 5)];
            const ca = clients * pm;
            const wrongs = uniqueWrongs(pm, [pm + 10, Math.max(5, pm - 10), pm * 2, clients], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${pm} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un magasin réalise un CA journalier de ${ca} € pour ${clients} passages en caisse. Quel est le panier moyen ?`,
                opts,
                correct,
                exp: `Panier moyen = CA / Nombre de clients = ${ca} / ${clients} = ${pm} €.`
            };
        }
        if (kind === 'taux_transfo') {
            const visiteurs = [100, 200, 400, 500][Math.floor(rng() * 4)];
            const taux = [15, 20, 25, 30, 40][Math.floor(rng() * 5)];
            const acheteurs = (visiteurs * taux) / 100;
            const wrongs = uniqueWrongs(taux, [taux + 5, Math.max(5, taux - 5), 100 - taux, taux * 2], false).map(n => `${n} %`);
            const { opts, correct } = shuffleOptions([`${taux} %`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur ${visiteurs} visiteurs entrés dans une boutique, ${acheteurs} effectuent un achat. Quel est le taux de transformation ?`,
                opts,
                correct,
                exp: `Taux de transformation = (${acheteurs} / ${visiteurs}) × 100 = ${taux} %.`
            };
        }
        if (kind === 'marge_comm') {
            const pa = [20, 30, 40, 50, 60][Math.floor(rng() * 5)];
            const pv = pa + [10, 15, 20, 30, 40][Math.floor(rng() * 5)];
            const marge = pv - pa;
            const wrongs = uniqueWrongs(marge, [pv + pa, marge + 5, Math.max(5, marge - 5), pa], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${marge} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un article acheté ${pa} € HT au fournisseur est revendu ${pv} € HT en rayon. Quelle est la marge commerciale unitaire ?`,
                opts,
                correct,
                exp: `Marge commerciale = Prix de vente HT − Prix d'achat HT = ${pv} − ${pa} = ${marge} €.`
            };
        }
        const tickets = [50, 100, 200][Math.floor(rng() * 3)];
        const iv = [2, 3, 4][Math.floor(rng() * 3)];
        const articles = tickets * iv;
        const wrongs = uniqueWrongs(iv, [iv + 1, Math.max(1, iv - 1), iv + 2, tickets], false).map(n => `${n} articles/client`);
        const { opts, correct } = shuffleOptions([`${iv} articles/client`, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Une unité commerciale vend ${articles} articles pour ${tickets} tickets de caisse. Quel est son indice de vente ?`,
            opts,
            correct,
            exp: `Indice de vente = Articles vendus / Nombre de tickets = ${articles} / ${tickets} = ${iv} articles par client.`
        };
    }

    /** Générateur procédural pour Comptabilité & Finance (BTS CG) */
    function generateComptabiliteLesson(index, norm, variant, rng) {
        const kinds = ['tva_20', 'tva_due', 'amortissement', 'resultat_net'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'tva_20') {
            const ht = [50, 100, 150, 200, 300, 500][Math.floor(rng() * 6)];
            const ttc = Math.round(ht * 1.2);
            const wrongs = uniqueWrongs(ttc, [ht + 10, Math.round(ht * 1.1), ttc + 20, ht - 20], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${ttc} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Une facture de vente s'élève à ${ht} € HT avec un taux normal de TVA à 20 %. Quel est le montant TTC ?`,
                opts,
                correct,
                exp: `TTC = HT × 1,20 = ${ht} × 1,20 = ${ttc} € (TVA = ${ttc - ht} €).`
            };
        }
        if (kind === 'tva_due') {
            const collectee = [3000, 4500, 6000, 8000][Math.floor(rng() * 4)];
            const deductible = [1000, 1500, 2000, 2500][Math.floor(rng() * 4)];
            const due = collectee - deductible;
            const wrongs = uniqueWrongs(due, [collectee + deductible, due + 500, Math.max(200, due - 500), deductible], false).map(n => `${n} €`);
            const { opts, correct } = shuffleOptions([`${due} €`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Sur le mois, une entreprise a enregistré ${collectee} € de TVA collectée et ${deductible} € de TVA déductible. Quelle est la TVA à décaisser (à payer à l'État) ?`,
                opts,
                correct,
                exp: `TVA à décaisser = TVA collectée − TVA déductible = ${collectee} − ${deductible} = ${due} €.`
            };
        }
        if (kind === 'amortissement') {
            const val = [4000, 6000, 8000, 10000, 12000][Math.floor(rng() * 5)];
            const duree = [4, 5][Math.floor(rng() * 2)];
            const annuite = val / duree;
            const wrongs = uniqueWrongs(annuite, [annuite * 2, Math.round(annuite / 2), annuite + 500, val - duree], false).map(n => `${n} €/an`);
            const { opts, correct } = shuffleOptions([`${annuite} €/an`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un matériel informatique acquis ${val} € HT est amorti en mode linéaire sur ${duree} ans. Quel est le montant de l'annuité d'amortissement ?`,
                opts,
                correct,
                exp: `Annuité linéaire = Base amortissable / Durée = ${val} / ${duree} = ${annuite} € par an.`
            };
        }
        const produits = [50000, 80000, 120000, 150000][Math.floor(rng() * 4)];
        const charges = [35000, 60000, 95000, 110000][Math.floor(rng() * 4)];
        const res = produits - charges;
        const label = res >= 0 ? `Bénéfice de ${res} €` : `Perte de ${Math.abs(res)} €`;
        const altLabel = res >= 0 ? `Perte de ${res} €` : `Bénéfice de ${Math.abs(res)} €`;
        const wrongs = uniqueStringWrongs(label, [altLabel, `Bénéfice de ${produits + charges} €`, `Bénéfice de ${Math.abs(res) + 10000} €`, `Résultat nul (0 €)`]);
        const { opts, correct } = shuffleOptions([label, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Au compte de résultat, le total des produits (classe 7) est de ${produits} € et le total des charges (classe 6) de ${charges} €. Quel est le résultat net ?`,
            opts,
            correct,
            exp: `Résultat net = Produits − Charges = ${produits} − ${charges} = ${res} € (${label}).`
        };
    }

    /** Générateur procédural pour Électrotechnique & Énergie (Bac Pro MELEC) */
    function generateElectrotechLesson(index, norm, variant, rng) {
        const kinds = ['puissance_mono', 'courant_disj', 'energie_kwh', 'triphase_u'];
        const kind = kinds[(index + variant) % kinds.length];

        if (kind === 'puissance_mono') {
            const i = [4, 5, 8, 10, 16][Math.floor(rng() * 5)];
            const u = 230;
            const p = u * i;
            const wrongs = uniqueWrongs(p, [p + 230, Math.max(100, p - 230), u + i, p * 2], false).map(n => `${n} W`);
            const { opts, correct } = shuffleOptions([`${p} W`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un appareil purement résistif (cos φ = 1) alimenté en monophasé 230 V absorbe un courant de ${i} A. Quelle puissance active P = U × I consomme-t-il ?`,
                opts,
                correct,
                exp: `P = U × I = 230 × ${i} = ${p} W.`
            };
        }
        if (kind === 'courant_disj') {
            const p = [1150, 2300, 3450, 4600][Math.floor(rng() * 4)];
            const i = Math.round(p / 230);
            const wrongs = uniqueWrongs(i, [i * 2, Math.max(1, i - 3), i + 5, i + 10], false).map(n => `${n} A`);
            const { opts, correct } = shuffleOptions([`${i} A`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un radiateur électrique de ${p} W est alimenté sous 230 V monophasé (cos φ = 1). Quelle intensité I = P / U circule dans le circuit ?`,
                opts,
                correct,
                exp: `I = P / U = ${p} / 230 = ${i} A.`
            };
        }
        if (kind === 'energie_kwh') {
            const pKw = [1.5, 2, 3, 4][Math.floor(rng() * 4)];
            const h = [2, 4, 6, 8][Math.floor(rng() * 4)];
            const kwh = pKw * h;
            const wrongs = uniqueWrongs(kwh, [kwh + 2, Math.max(1, kwh - 2), pKw + h, kwh * 2], false).map(n => `${n} kWh`);
            const { opts, correct } = shuffleOptions([`${kwh} kWh`, ...wrongs], 0, rng);
            return {
                type: 'qcm',
                title: 'Niveau ' + (index + 1),
                q: `Un moteur électrique consomme une puissance constante de ${String(pKw).replace('.', ',')} kW pendant ${h} heures. Quelle énergie électrique a-t-il consommée ?`,
                opts,
                correct,
                exp: `E = P × t = ${String(pKw).replace('.', ',')} × ${h} = ${kwh} kWh.`
            };
        }
        const habilitations = [
            { code: 'B0', desc: 'personnel non électricien travaillant dans un voisinage électrique basse tension' },
            { code: 'B1V', desc: 'exécutant électricien habilité aux travaux au voisinage en basse tension' },
            { code: 'BR', desc: 'chargé d\'interventions générales d\'entretien et dépannage en basse tension' },
            { code: 'BC', desc: 'chargé de consignation en basse tension (mise hors tension et VAT)' },
            { code: 'BS', desc: 'chargé d\'interventions élémentaires (remplacement de prise, lampe, fusible)' },
        ];
        const pick = habilitations[(index + variant * 2) % habilitations.length];
        const others = habilitations.filter(h => h.code !== pick.code).map(h => h.code);
        const wrongs = uniqueStringWrongs(pick.code, seededShuffle(others, 'hab:' + index + ':' + variant));
        const { opts, correct } = shuffleOptions([pick.code, ...wrongs], 0, rng);
        return {
            type: 'qcm',
            title: 'Niveau ' + (index + 1),
            q: `Selon la norme NF C 18-510 d'habilitation électrique (MELEC), quel symbole désigne un ${pick.desc} ?`,
            opts,
            correct,
            exp: `L'habilitation ${pick.code} correspond au ${pick.desc}.`
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
            { q: "Quelle proposition contient un homophone correctement orthographié ?", correct: "Où vas-tu ?", wrongs: ["Ou vas-tu ?", "Tu prends du café où du thé ?", "Ou bien où ?"], levels: ['5eme', '6eme'], exp: "« Où » avec accent indique le lieu ; « ou » sans accent exprime le choix." },
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
            { q: "Quel concept désigne la perte de sens et le dégoût existentiel chez Sartre ?", correct: "la Nausée", wrongs: ["le Spleen", "l'Angoisse pure", "le Mal du siècle"], levels: ['terminale'], exp: "Dans le roman 'La Nausée' (1938), Roquentin ressent l'existence brute des choses." },
            // Enrichissements multi-niveaux (programme officiel Collège / Lycée / BTS)
            { q: "Quel écrivain a composé les « Fables » célèbres comme « Le Corbeau et le Renard » ?", correct: "Jean de La Fontaine", wrongs: ["Charles Perrault", "Molière", "Voltaire"], levels: ['6eme', '5eme'], exp: "Jean de La Fontaine publie ses Fables au XVIIe siècle sous Louis XIV." },
            { q: "Dans « Il mange une pomme », quelle est la nature du mot « une » ?", correct: "article indéfini", wrongs: ["article défini", "pronom personnel", "adverbe"], levels: ['6eme'], exp: "Un, une, des sont des articles indéfinis." },
            { q: "Quel dramaturge du XVIIe siècle a écrit « L'Avare » et « Le Malade imaginaire » ?", correct: "Molière", wrongs: ["Jean Racine", "Pierre Corneille", "Beaumarchais"], levels: ['5eme', '4eme', '2nde'], exp: "Molière (Jean-Baptiste Poquelin) est le maître de la comédie classique." },
            { q: "Dans un texte narratif, quel point de vue connaît les pensées de tous les personnages ?", correct: "le point de vue omniscient", wrongs: ["le point de vue interne", "le point de vue externe", "le point de vue neutre"], levels: ['4eme', '3eme', '2nde'], exp: "Le narrateur omniscient sait tout sur tous les personnages et l'intrigue." },
            { q: "Quel romancier du XIXe siècle a écrit « Les Misérables » et « Notre-Dame de Paris » ?", correct: "Victor Hugo", wrongs: ["Émile Zola", "Honoré de Balzac", "Gustave Flaubert"], levels: ['4eme', '3eme'], exp: "Victor Hugo est une figure majeure du romantisme et de l'engagement social." },
            { q: "Quel courant littéraire du XIXe siècle, incarné par Émile Zola, étudie scientifiquement la société et l'hérédité ?", correct: "le naturalisme", wrongs: ["le classicisme", "le surréalisme", "le baroque"], levels: ['2nde', '1ere'], exp: "Zola développe le roman expérimental dans le cycle des Rougon-Macquart." },
            { q: "Quelle figure de style exagère volontairement une réalité (ex : « Mourir de rire ») ?", correct: "l'hyperbole", wrongs: ["la litote", "l'euphémisme", "la métonymie"], levels: ['3eme', '2nde', '1ere'], exp: "L'hyperbole amplifie l'expression pour frapper le lecteur." },
            { q: "Quel poète a composé « Le Dormeur du val » et « Le Bateau ivre » à l'adolescence ?", correct: "Arthur Rimbaud", wrongs: ["Paul Verlaine", "Charles Baudelaire", "Guillaume Apollinaire"], levels: ['1ere', 'terminale'], exp: "Rimbaud renouvelle profondément la poésie moderne dès l'âge de 16 ans." },
            { q: "En rhétorique et culture générale (BTS/Lycée), qu'est-ce qu'une thèse dans un texte argumentatif ?", correct: "l'idée principale défendue par l'auteur", wrongs: ["un exemple illustrant un fait", "le résumé de la conclusion", "une figure d'opposition"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La thèse est soutenue par des arguments illustrés par des exemples." },
            { q: "Dans une synthèse de documents (BTS / Lycée), quel principe méthodologique est impératif ?", correct: "confronter objectivement les documents sans donner son avis personnel", wrongs: ["recopier chaque texte séparément", "ne citer qu'un seul document", "ajouter de longues anecdotes personnelles"], levels: ['terminale', 'bts1', 'bts2'], exp: "La synthèse croise les idées des documents de façon structurée et objective." }
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
            { q: "En quelle année l'URSS a-t-elle été officiellement dissoute ?", correct: "1991", wrongs: ["1989", "1985", "1995"], levels: ['terminale'], exp: "Gorbatchev démissionne le 25 décembre 1991, scellant la fin de l'Union soviétique." },
            // Enrichissements Histoire
            { q: "Dans l'Antiquité, quel grand chef gaulois a mené la coalition contre Jules César à Alésia (-52) ?", correct: "Vercingétorix", wrongs: ["Ambiorix", "Clovis", "Hannibal"], levels: ['6eme'], exp: "Vercingétorix s'est rendu à César après le siège d'Alésia en 52 av. J.-C." },
            { q: "Quel roi de France a fait construire le château de Versailles au XVIIe siècle ?", correct: "Louis XIV", wrongs: ["Louis XVI", "François Ier", "Henri IV"], levels: ['5eme', '4eme', '2nde'], exp: "Le Roi-Soleil a fait de Versailles le centre de la monarchie absolue." },
            { q: "Quelle pandémie meurtrière du XIVe siècle a décimé environ un tiers de la population européenne ?", correct: "la Peste noire", wrongs: ["le choléra", "la grippe espagnole", "la variole"], levels: ['5eme'], exp: "Arrivée en Europe en 1347, la Peste noire a profondément bouleversé le Moyen Âge." },
            { q: "Quel texte fondateur adopté le 26 août 1789 proclame que « les hommes naissent et demeurent libres et égaux en droits » ?", correct: "la Déclaration des droits de l'homme et du citoyen (DDHC)", wrongs: ["le Code civil", "l'Édit de Nantes", "la Constitution de 1958"], levels: ['4eme', '1ere'], exp: "La DDHC est le socle juridique des libertés fondamentales en France." },
            { q: "En quelle année les femmes obtiennent-elles le droit de vote en France ?", correct: "1944", wrongs: ["1918", "1958", "1936"], levels: ['3eme', '1ere', 'terminale'], exp: "L'ordonnance du 21 avril 1944 (CFLN d'Alger) accorde le droit de vote aux femmes." },
            { q: "Quelle loi de 1881-1882 rend l'école primaire gratuite, laïque et obligatoire en France ?", correct: "les lois Jules Ferry", wrongs: ["les accords de Matignon", "la loi Veil", "le décret Crémieux"], levels: ['4eme', '1ere'], exp: "Jules Ferry instaure l'école républicaine gratuite, laïque et obligatoire." },
            { q: "En quelle année le traité de Maastricht a-t-il créé officiellement l'Union européenne ?", correct: "1992", wrongs: ["1957", "1979", "2002"], levels: ['3eme', 'terminale'], exp: "Signé en février 1992, le traité de Maastricht fonde l'UE et prépare l'euro." },
            { q: "Quel événement d'octobre 1929 à New York a déclenché la Grande Dépression mondiale ?", correct: "le krach boursier de Wall Street", wrongs: ["la révolution russe", "la crise de Suez", "le choc pétrolier"], levels: ['3eme', 'terminale'], exp: "Le « Jeudi noir » (24 octobre 1929) précipite une crise économique mondiale." }
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
            { q: "Quel canal transocéanique traverse l'Amérique centrale ?", correct: "le canal de Panama", wrongs: ["le canal de Suez", "le canal de Corinthe", "le canal du Midi"], levels: ['terminale'], exp: "Il relie l'océan Atlantique et l'océan Pacifique depuis 1914." },
            // Enrichissements Géographie
            { q: "Quelle ligne imaginaire divise la Terre en hémisphère Nord et hémisphère Sud ?", correct: "l'équateur", wrongs: ["le méridien de Greenwich", "le tropique du Cancer", "le cercle polaire"], levels: ['6eme', '5eme'], exp: "L'équateur correspond à la latitude 0°." },
            { q: "Comment nomme-t-on le déplacement durable de populations des campagnes vers les villes ?", correct: "l'exode rural", wrongs: ["la périurbanisation", "la littoralisation", "la gentrification"], levels: ['5eme', '4eme', '1ere'], exp: "L'exode rural accompagne l'industrialisation et la croissance urbaine." },
            { q: "Quel type d'espace associe des emplois de haute technologie, des universités et des laboratoires ?", correct: "un technopôle", wrongs: ["une friche industrielle", "un bocage", "une ZEE"], levels: ['4eme', '3eme', '1ere'], exp: "Exemples en France : Sophia Antipolis ou Paris-Saclay." },
            { q: "Quelle façade maritime mondiale relie les ports de Rotterdam, Anvers et Hambourg ?", correct: "la Northern Range", wrongs: ["la Sun Belt", "la Mégalopolis japonaise", "le détroit de Malacca"], levels: ['4eme', 'terminale'], exp: "La Northern Range est la première façade portuaire d'Europe." },
            { q: "Comment appelle-t-on une grande boîte métallique standardisée utilisée pour le transport intermodal maritime et ferroviaire ?", correct: "un conteneur", wrongs: ["un pétrolier", "une barge", "un silo"], levels: ['4eme', 'terminale'], exp: "La conteneurisation a fortement réduit les coûts du commerce mondial." },
            { q: "Combien de régions compte la France métropolitaine depuis la réforme de 2016 ?", correct: "13 régions", wrongs: ["22 régions", "18 régions", "10 régions"], levels: ['3eme', '1ere'], exp: "La France compte 13 régions métropolitaines et 5 régions d'outre-mer (18 au total)." },
            { q: "Quel phénomène désigne l'extension spatiale des banlieues et communes rurales autour d'une métropole ?", correct: "la périurbanisation", wrongs: ["la désertification", "l'insularité", "la délocalisation"], levels: ['3eme', '1ere', '2nde'], exp: "Elle s'accompagne de migrations pendulaires domicile-travail." }
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
            { q: "Quel réflexe involontaire contracte un muscle en réponse à son propre étirement ?", correct: "le réflexe myotatique", wrongs: ["le réflexe conditionné", "le réflexe cornéen", "le réflexe nociceptif"], levels: ['terminale'], exp: "Le réflexe rotulien en est l'exemple clinique classique." },
            // Enrichissements SVT
            { q: "Quel être vivant transforme la matière organique morte du sol en matière minérale ?", correct: "un décomposeur (champignon, bactérie, ver)", wrongs: ["un producteur primaire", "un carnivore apex", "un pollinisateur"], levels: ['6eme', '5eme'], exp: "Les décomposeurs recyclent la matière organique dans l'écosystème." },
            { q: "Quel vaisseau sanguin transporte le sang du cœur vers les organes ?", correct: "une artère", wrongs: ["une veine", "une bronche", "un nerf"], levels: ['5eme', '4eme'], exp: "Les artères partent du cœur ; les veines y ramènent le sang." },
            { q: "Comment nomme-t-on l'enveloppe rigide externe de la Terre fragmentée en plaques tectoniques ?", correct: "la lithosphère", wrongs: ["l'asthénosphère", "le noyau interne", "la troposphère"], levels: ['4eme', '1ere'], exp: "La lithosphère (croûte + manteau supérieur rigide) repose sur l'asthénosphère ductile." },
            { q: "Quelle hormone sécrétée par le pancréas fait baisser le taux de glucose dans le sang (glycémie) ?", correct: "l'insuline", wrongs: ["le glucagon", "l'adrénaline", "la testostérone"], levels: ['2nde', '1ere', 'terminale'], exp: "L'insuline est une hormone hypoglycémiante ; le glucagon est hyperglycémiant." },
            { q: "Quelle technique médicale stimule la mémoire immunitaire pour prévenir une infection grave ?", correct: "la vaccination", wrongs: ["l'antibiothérapie", "la transfusion", "l'anesthésie"], levels: ['3eme', '1ere', 'terminale'], exp: "Le vaccin induit la formation de lymphocytes mémoires spécifiques." },
            { q: "Quel gaz à effet de serre est majoritairement rejeté par la combustion des énergies fossiles ?", correct: "le dioxyde de carbone (CO₂)", wrongs: ["le diazote (N₂)", "le dioxygène (O₂)", "l'hélium (He)"], levels: ['5eme', '2nde', 'terminale'], exp: "L'augmentation du CO₂ atmosphérique renforce l'effet de serre additionnel." }
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
            { q: "Quel phénomène modifie la fréquence perçue d'une onde lorsque l'émetteur est en mouvement ?", correct: "l'effet Doppler", wrongs: ["l'effet Joule", "l'effet photoélectrique", "l'effet Hall"], levels: ['terminale'], exp: "Le son devient plus aigu à l'approche et plus grave lors de l'éloignement." },
            // Enrichissements Physique
            { q: "Quel appareil de mesure se branche en DÉRIVATION pour mesurer une tension électrique ?", correct: "le voltmètre", wrongs: ["l'ampèremètre", "l'ohmmètre", "le wattmètre"], levels: ['5eme', '4eme', '3eme'], exp: "Le voltmètre se branche en dérivation (parallèle) ; l'ampèremètre en série." },
            { q: "Quel appareil se branche en SÉRIE dans un circuit pour mesurer l'intensité du courant ?", correct: "l'ampèremètre", wrongs: ["le voltmètre", "le thermomètre", "le luxmètre"], levels: ['4eme', '3eme'], exp: "L'intensité (en ampères, A) traverse l'ampèremètre monté en série." },
            { q: "Quelle est la vitesse approximative du son dans l'air à 20 °C ?", correct: "340 m/s", wrongs: ["300 000 km/s", "34 m/s", "1 500 m/s"], levels: ['4eme', '3eme', '2nde'], exp: "Le son se propage à environ 340 m/s dans l'air (et ~1 500 m/s dans l'eau)." },
            { q: "Dans quel milieu le son ne peut-il PAS se propager ?", correct: "le vide spatial", wrongs: ["l'eau liquide", "l'acier solide", "l'air sec"], levels: ['6eme', '5eme', '2nde'], exp: "Le son est une onde mécanique qui nécessite un milieu matériel pour se propager." },
            { q: "Quelle unité mesure la fréquence d'un signal périodique (nombre de cycles par seconde) ?", correct: "le hertz (Hz)", wrongs: ["le joule (J)", "le pascal (Pa)", "le tesla (T)"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "f = 1 / T, exprimée en hertz (Hz = s⁻¹)." },
            { q: "Quelle grandeur physique exprimée en joules (J) mesure le transfert thermique ou le travail d'une force ?", correct: "l'énergie", wrongs: ["la puissance", "la pression", "l'intensité"], levels: ['3eme', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Le joule (J) est l'unité SI d'énergie ; le watt (W = J/s) est l'unité de puissance." }
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
            { q: "Quelle substance accélère une réaction chimique sans apparaître dans son équation bilan ?", correct: "un catalyseur", wrongs: ["un inhibiteur", "un réactif limitant", "un solvant inerte"], levels: ['terminale'], exp: "Le catalyseur abaisse l'énergie d'activation sans être consommé." },
            // Enrichissements Chimie
            { q: "Quel est le principe fondamental formulé par Lavoisier lors d'une transformation chimique ?", correct: "la conservation de la masse et des atomes", wrongs: ["la disparition des réactifs", "la création spontanée d'atomes", "l'augmentation systématique du pH"], levels: ['4eme', '3eme', '2nde'], exp: "« Rien ne se perd, rien ne se crée, tout se transforme » : les atomes se conservent." },
            { q: "Quelle technique sépare les constituants d'un mélange hétérogène solide-liquide grâce à un papier poreux ?", correct: "la filtration", wrongs: ["la distillation", "la sublimation", "la fusion"], levels: ['6eme', '5eme'], exp: "Le filtre retient le résidu solide et laisse passer le filtrat liquide." },
            { q: "Quel gaz, représentant environ 21 % de l'air, est indispensable à la respiration et aux combustions ?", correct: "le dioxygène (O₂)", wrongs: ["le diazote (N₂)", "le dioxyde de carbone (CO₂)", "l'argon (Ar)"], levels: ['5eme', '4eme'], exp: "Le dioxygène est le comburant naturel présent dans l'atmosphère." },
            { q: "Quel est le nom de la liaison chimique formée par la mise en commun d'une paire d'électrons entre deux atomes ?", correct: "une liaison covalente", wrongs: ["une liaison gravitationnelle", "une liaison nucléaire", "une liaison thermique"], levels: ['2nde', '1ere', 'terminale'], exp: "Les atomes partagent des électrons de valence pour atteindre une configuration stable." },
            { q: "Quelle famille organique possède le groupe caractéristique hydroxyle (-OH) ?", correct: "les alcools", wrongs: ["les alcanes", "les aldéhydes", "les cétones"], levels: ['1ere', 'terminale'], exp: "Exemples : méthanol (CH₃OH), éthanol (CH₃CH₂OH)." }
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
            { q: "What does the formal verb 'to jeopardize' mean ?", correct: "mettre en péril / compromettre", wrongs: ["justifier", "juger équitablement", "accélérer"], levels: ['terminale'], exp: "To endanger or put at risk." },
            // Enrichissements Anglais (Collège / Lycée / BTS)
            { q: "Choose the right question word : '___ do you live?'", correct: "Where", wrongs: ["Who", "When", "Why"], levels: ['6eme', '5eme'], exp: "'Where' asks about a place (où)." },
            { q: "Translate « J'ai 12 ans » into natural English :", correct: "I am 12 years old", wrongs: ["I have 12 years", "I make 12 years", "I got 12 age"], levels: ['6eme', '5eme'], exp: "In English, age uses the verb 'to be' (I am...)." },
            { q: "Choose the right form : 'They ___ football every Saturday.'", correct: "play", wrongs: ["plays", "playing", "is playing"], levels: ['6eme', '5eme'], exp: "Present simple with 'they' uses the base verb without -s." },
            { q: "Choose the superlative : 'Mount Everest is the ___ mountain in the world.'", correct: "highest", wrongs: ["higher", "most high", "more high"], levels: ['4eme', '3eme'], exp: "Short adjective + -est for the superlative." },
            { q: "Complete with 'since' or 'for' : 'She has worked here ___ 2021.'", correct: "since", wrongs: ["for", "during", "ago"], levels: ['3eme', '2nde'], exp: "'Since' introduces a starting point; 'for' introduces a duration." },
            { q: "What does the expression 'to give up' mean ?", correct: "abandonner", wrongs: ["donner un cadeau", "se lever tôt", "grandir"], levels: ['4eme', '3eme', '2nde'], exp: "Never give up = n'abandonne jamais !" },
            { q: "Choose the passive voice : 'The email ___ sent yesterday.'", correct: "was", wrongs: ["is", "were", "has"], levels: ['2nde', '1ere', 'bts1'], exp: "Past simple passive singular: was + past participle." },
            { q: "In business/technical English, what does 'deadline' mean ?", correct: "date limite / échéance", wrongs: ["ligne électrique coupée", "titre d'un article", "fichier supprimé"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "To meet a deadline = respecter une échéance." },
            { q: "In IT & technical English (BTS/NSI/CIEL), what does 'troubleshooting' mean ?", correct: "dépannage / résolution de panne", wrongs: ["mise à jour matérielle", "création de sauvegarde", "chiffrement de disque"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Troubleshooting is the systematic process of locating and fixing technical issues." }
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
            { q: "Où siège la Cour Pénale Internationale (CPI) ?", correct: "à La Haye (Pays-Bas)", wrongs: ["à Genève (Suisse)", "à New York (USA)", "à Bruxelles (Belgique)"], levels: ['terminale'], exp: "Elle juge les génocides, crimes contre l'humanité et crimes de guerre." },
            // Enrichissements EMC
            { q: "Quel symbole féminin coiffé d'un bonnet phrygien incarne la République française dans les mairies ?", correct: "Marianne", wrongs: ["Jeanne d'Arc", "Athéna", "Olympe"], levels: ['6eme', '5eme', '3eme'], exp: "Marianne symbolise la liberté et les valeurs républicaines." },
            { q: "Quel est l'hymne national officiel de la France ?", correct: "La Marseillaise", wrongs: ["L'Ode à la joie", "Le Chant du Départ", "Le Temps des cerises"], levels: ['6eme', '5eme', '3eme'], exp: "Composée par Rouget de Lisle en 1792, La Marseillaise est inscrite dans la Constitution." },
            { q: "Qui préside le conseil municipal et administre une commune en France ?", correct: "le maire", wrongs: ["le préfet", "le député", "le procureur"], levels: ['6eme', '5eme', '4eme'], exp: "Le maire est élu par le conseil municipal issu du suffrage universel direct." },
            { q: "Comment appelle-t-on le texte fondamental qui organise les pouvoirs publics en France ?", correct: "la Constitution", wrongs: ["le règlement intérieur", "le décret préfectoral", "le code de commerce"], levels: ['4eme', '3eme', '2nde'], exp: "La France vit sous la Constitution de la Ve République (4 octobre 1958)." },
            { q: "Quel principe de la justice signifie qu'une personne accusée est présumée non coupable jusqu'au jugement définitif ?", correct: "la présomption d'innocence", wrongs: ["le double degré de juridiction", "le secret bancaire", "la grâce présidentielle"], levels: ['4eme', '3eme', '2nde', '1ere'], exp: "Inscrit à l'article 9 de la DDHC de 1789." },
            { q: "Quelle autorité protège les données personnelles des citoyens en France ?", correct: "la CNIL", wrongs: ["l'INSEE", "la Banque de France", "l'ADEME"], levels: ['2nde', '1ere', 'terminale'], exp: "La CNIL veille à l'application de la loi Informatique et Libertés et du RGPD." }
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
        ],

        espagnol: [
            // 5ème → Terminale (LV2 programme officiel)
            { q: "En espagnol, comment dit-on « Bonjour » le matin ?", correct: "Buenos días", wrongs: ["Buenas noches", "Hasta luego", "Buenas tardes"], levels: ['5eme', '4eme'], exp: "Buenos días (matin), Buenas tardes (après-midi), Buenas noches (soir/nuit)." },
            { q: "Quel verbe utilise-t-on en espagnol pour indiquer une localisation géographique (ex : Madrid ___ en España) ?", correct: "está (verbe estar)", wrongs: ["es (verbe ser)", "tiene (verbe tener)", "hace (verbe hacer)"], levels: ['5eme', '4eme', '3eme'], exp: "Pour situer un lieu dans l'espace, on emploie toujours ESTAR." },
            { q: "Quel verbe utilise-t-on pour indiquer la nationalité ou la profession (ex : Ella ___ médica) ?", correct: "es (verbe ser)", wrongs: ["está (verbe estar)", "hay (verbe haber)", "va (verbe ir)"], levels: ['5eme', '4eme', '3eme'], exp: "SER exprime une caractéristique essentielle (identité, origine, métier)." },
            { q: "Comment traduit-on « J'aime la musique » en espagnol ?", correct: "Me gusta la música", wrongs: ["Yo gusto la música", "Me gustan la música", "Te gusta la música"], levels: ['5eme', '4eme'], exp: "Gustar s'accorde avec ce qui plaît (singulier → gusta ; pluriel → gustan)." },
            { q: "Comment dit-on « Il y a » en espagnol ?", correct: "Hay", wrongs: ["Está", "Son", "Tiene"], levels: ['5eme', '4eme'], exp: "Hay est la forme impersonnelle invariable du verbe haber." },
            { q: "Quel est l'article défini féminin pluriel en espagnol ?", correct: "las", wrongs: ["los", "la", "el"], levels: ['5eme', '4eme'], exp: "el / la / los / las." },
            { q: "Quelle est la traduction de « Les livres » en espagnol ?", correct: "los libros", wrongs: ["las libros", "el libros", "los libro"], levels: ['5eme', '4eme'], exp: "Libro est masculin, au pluriel : los libros." },
            { q: "Comment forme-t-on le futur proche (« je vais étudier ») en espagnol ?", correct: "Voy a estudiar", wrongs: ["Voy estudiar", "Fui a estudiar", "Estudio a ir"], levels: ['4eme', '3eme'], exp: "IR au présent + préposition A + infinitif." },
            { q: "Comment dit-on « J'ai quinze ans » en espagnol ?", correct: "Tengo quince años", wrongs: ["Soy quince años", "Estoy quince años", "Hago quince años"], levels: ['5eme', '4eme', '3eme'], exp: "L'âge se dit avec le verbe TENER (avoir)." },
            { q: "Quel temps emploie-t-on pour une action passée révolue et datée (ex : Ayer ___ al cine) ?", correct: "le passé simple (fui)", wrongs: ["l'imparfait (iba)", "le présent (voy)", "le futur (iré)"], levels: ['3eme', '2nde'], exp: "Ayer (hier) appelle le prétérit indéfini (passé simple) : fui." },
            { q: "Complète : « Quiero que tú ___ (venir) conmigo. » (subjonctif présent)", correct: "vengas", wrongs: ["vienes", "viniste", "vendrás"], levels: ['3eme', '2nde', '1ere'], exp: "Après querer que (volonté), on emploie le subjonctif présent : vengas." },
            { q: "Quel connecteur espagnol signifie « cependant / néanmoins » ?", correct: "sin embargo", wrongs: ["por eso", "además", "porque"], levels: ['2nde', '1ere', 'terminale'], exp: "Sin embargo / no obstante introduisent une opposition." },
            { q: "Quelle est la capitale du Mexique, premier pays hispanophone par la population ?", correct: "Ciudad de México (Mexico)", wrongs: ["Guadalajara", "Buenos Aires", "Bogotá"], levels: ['4eme', '3eme', '2nde'], exp: "Le Mexique compte plus de 125 millions d'habitants hispanophones." },
            { q: "Quel écrivain espagnol du Siècle d'Or est l'auteur de « Don Quichotte » ?", correct: "Miguel de Cervantes", wrongs: ["Federico García Lorca", "Gabriel García Márquez", "Pablo Neruda"], levels: ['2nde', '1ere', 'terminale'], exp: "Publié en 1605 et 1615, Don Quichotte est le roman fondateur de la littérature moderne." },
            { q: "Quel poète et dramaturge chilien a reçu le prix Nobel de littérature en 1971 ?", correct: "Pablo Neruda", wrongs: ["Jorge Luis Borges", "Octavio Paz", "Lope de Vega"], levels: ['1ere', 'terminale'], exp: "Pablo Neruda est célèbre pour ses poèmes engagés et lyriques (Canto General)." },
            { q: "Quelle préposition emploie-t-on pour exprimer un but (« pour réussir » : ___ aprobar) ?", correct: "para", wrongs: ["por", "desde", "hacia"], levels: ['3eme', '2nde', '1ere', 'terminale'], exp: "PARA indique le but ou la destination ; POR indique la cause ou le moyen." }
        ],

        arts: [
            // Collège (6e-3e) & Lycée Général
            { q: "Quelles sont les trois couleurs primaires en peinture (synthèse soustractive) ?", correct: "magenta (rouge), cyan (bleu) et jaune", wrongs: ["vert, orange et violet", "noir, blanc et gris", "rouge, vert et marron"], levels: ['6eme', '5eme'], exp: "Le mélange de ces primaires permet d'obtenir les couleurs secondaires." },
            { q: "Quelle technique de la Renaissance donne l'illusion de la profondeur grâce à un point de fuite ?", correct: "la perspective linéaire (conique)", wrongs: ["le pointillisme", "le collage", "le clair-obscur seul"], levels: ['5eme', '4eme'], exp: "Théorisée à Florence par Brunelleschi et Alberti au XVe siècle." },
            { q: "Quel courant architectural du Moyen Âge se caractérise par l'arc brisé, la croisée d'ogives et les grands vitraux ?", correct: "l'art gothique", wrongs: ["l'art roman", "le néoclassicisme", "le brutaliste"], levels: ['5eme', '6eme'], exp: "Notre-Dame de Paris et la cathédrale de Chartres sont des chefs-d'œuvre gothiques." },
            { q: "Quel style architectural antérieur au gothique se reconnaît à ses murs épais et ses arcs en plein cintre ?", correct: "l'art roman", wrongs: ["le rococo", "l'Art nouveau", "le cubisme"], levels: ['5eme'], exp: "L'architecture romane domine en Europe aux XIe et XIIe siècles." },
            { q: "En musique, combien de lignes comporte une portée standard ?", correct: "5 lignes", wrongs: ["4 lignes", "6 lignes", "7 lignes"], levels: ['6eme', '5eme'], exp: "Une portée musicale comporte 5 lignes horizontales et 4 interlignes." },
            { q: "Quel mouvement pictural de la fin du XIXe siècle cherche à capter la lumière fugitive en plein air (Monet, Renoir) ?", correct: "l'impressionnisme", wrongs: ["le cubisme", "le surréalisme", "le réalisme socialiste"], levels: ['4eme', '3eme'], exp: "Le nom vient du tableau 'Impression, soleil levant' de Claude Monet (1872)." },
            { q: "Quel mouvement artistique du début du XXe siècle (Picasso, Braque) géométrise les formes et multiplie les points de vue ?", correct: "le cubisme", wrongs: ["le baroque", "le romantisme", "le fauvisme"], levels: ['3eme', '2nde'], exp: "Les Demoiselles d'Avignon (1907) de Picasso annoncent le cubisme." },
            { q: "Quelle toile monumentale de Pablo Picasso (1937) dénonce le bombardement d'une ville basque ?", correct: "Guernica", wrongs: ["Le Déjeuner sur l'herbe", "Les Ménines", "La Danse"], levels: ['3eme', '1ere', 'terminale'], exp: "Exposée au pavillon espagnol de 1937 à Paris, Guernica est un manifeste contre la guerre." },
            { q: "Quel mouvement artistique inspiré des rêves et de l'inconscient a été illustré par Salvador Dalí et René Magritte ?", correct: "le surréalisme", wrongs: ["le classicisme", "le pointillisme", "l'impressionnisme"], levels: ['3eme', '2nde', '1ere'], exp: "André Breton publie le Manifeste du surréalisme en 1924." },
            { q: "Quel réalisateur pionnier a réalisé « Le Voyage dans la Lune » en 1902 ?", correct: "Georges Méliès", wrongs: ["Charlie Chaplin", "Alfred Hitchcock", "Jean-Luc Godard"], levels: ['4eme', '3eme', '2nde'], exp: "Méliès est l'inventeur des premiers effets spéciaux cinématographiques." },
            { q: "Quel architecte moderne a conçu la Villa Savoye et la Cité radieuse de Marseille ?", correct: "Le Corbusier", wrongs: ["Gustave Eiffel", "Baron Haussmann", "Antoni Gaudí"], levels: ['3eme', '2nde', 'terminale'], exp: "Le Corbusier énonce les cinq points de l'architecture moderne (pilotis, toit-terrasse...)." },
            { q: "En photographie et cinéma, quel plan cadre un personnage des épaules jusqu'au sommet du crâne pour souligner l'émotion ?", correct: "le gros plan", wrongs: ["le plan d'ensemble", "le plan général", "le plan américain"], levels: ['4eme', '3eme', '2nde'], exp: "Le gros plan isole un visage ou un détail pour intensifier l'expressivité." },
            { q: "Quel compositeur baroque allemand a écrit les « Concertos brandebourgeois » et la « Toccata et fugue en ré mineur » ?", correct: "Jean-Sébastien Bach", wrongs: ["Wolfgang Amadeus Mozart", "Claude Debussy", "Igor Stravinsky"], levels: ['5eme', '4eme', '1ere'], exp: "Bach (1685-1750) est un maître absolu du contrepoint et de la musique baroque." },
            { q: "Quelle célèbre pyramide de verre inaugurée en 1989 sert d'entrée au musée du Louvre ?", correct: "la Pyramide du Louvre (Ieoh Ming Pei)", wrongs: ["la Pyramide de Khéops", "la Nef du Grand Palais", "le Centre Pompidou"], levels: ['6eme', '3eme', 'terminale'], exp: "Conçue par l'architecte sino-américain I. M. Pei." }
        ],

        hggsp: [
            // 1ère & Terminale Générale (Spécialité HGGSP)
            { q: "En géopolitique, quel concept théorisé par Joseph Nye désigne la capacité d'influence culturelle, diplomatique et médiatique d'un État ?", correct: "le soft power", wrongs: ["le hard power", "le protectionnisme", "l'autarcie"], levels: ['1ere', 'terminale'], exp: "Le soft power séduit et convainc sans recourir à la contrainte militaire ou économique (hard power)." },
            { q: "Que désigne le « smart power » en relations internationales ?", correct: "la combinaison stratégique du hard power et du soft power", wrongs: ["la puissance exclusivement numérique", "le désarmement nucléaire total", "la diplomatie uniquement commerciale"], levels: ['1ere', 'terminale'], exp: "Les grandes puissances associent moyens coercitifs (hard) et influence culturelle (soft)." },
            { q: "Quels sont les cinq membres permanents du Conseil de sécurité de l'ONU disposant du droit de veto ?", correct: "États-Unis, Russie, Chine, France et Royaume-Uni", wrongs: ["États-Unis, Allemagne, Japon, France et Inde", "États-Unis, Chine, Brésil, Russie et Inde", "France, Allemagne, Italie, Espagne et Royaume-Uni"], levels: ['1ere', 'terminale'], exp: "Héritage des vainqueurs de 1945 (P5), seuls détenteurs du veto." },
            { q: "Dans la démocratie athénienne antique, comment s'appelait l'assemblée souveraine de tous les citoyens ?", correct: "l'Ecclésia", wrongs: ["le Sénat", "la Boulè seule", "l'Aréopage"], levels: ['1ere'], exp: "L'Ecclésia votait les lois, la guerre et la paix sur la colline de la Pnyx." },
            { q: "Quel philosophe des Lumières a théorisé la séparation des pouvoirs (législatif, exécutif, judiciaire) dans « De l'esprit des lois » ?", correct: "Montesquieu", wrongs: ["Thomas Hobbes", "Nicolas Machiavel", "Auguste Comte"], levels: ['1ere'], exp: "Pour éviter la tyrannie, « il faut que par la disposition des choses, le pouvoir arrête le pouvoir »." },
            { q: "Quelle frontière historique a séparé l'Europe de l'Ouest et le bloc soviétique durant la Guerre froide ?", correct: "le Rideau de fer", wrongs: ["la ligne Maginot", "le mur d'Hadrien", "la ligne Durand"], levels: ['1ere', 'terminale'], exp: "Expression popularisée par Winston Churchill dans son discours de Fulton en 1946." },
            { q: "Quel accord européen de 1985 a instauré la libre circulation des personnes en supprimant les contrôles aux frontières intérieures ?", correct: "les accords de Schengen", wrongs: ["le traité de Versailles", "la charte de San Francisco", "les accords de Bretton Woods"], levels: ['1ere'], exp: "L'espace Schengen renforce les frontières extérieures (agence Frontex) tout en ouvrant l'intérieur." },
            { q: "Quel traité international de 1967 interdit l'appropriation nationale de la Lune et des corps célestes ?", correct: "le traité de l'Espace", wrongs: ["la convention de Montego Bay", "le protocole de Kyoto", "le traité de l'Antarctique"], levels: ['terminale'], exp: "Il pose le principe d'une utilisation pacifique de l'espace extra-atmosphérique." },
            { q: "Quelle convention internationale de 1982 fixe le droit de la mer (mer territoriale à 12 milles, ZEE à 200 milles) ?", correct: "la convention de Montego Bay", wrongs: ["le traité de Westphalie", "les accords de Paris", "la convention de Genève"], levels: ['terminale'], exp: "Adoptée sous l'égide de l'ONU, elle encadre les droits souverains maritimes et la haute mer." },
            { q: "Dans la théorie de Carl von Clausewitz, quelle formule célèbre définit la nature politique de la guerre ?", correct: "« La guerre est la continuation de la politique par d'autres moyens »", wrongs: ["« La guerre est un état naturel perpétuel sans but »", "« Seul le commerce met fin aux conflits »", "« Les traités abolissent toute rivalité »"], levels: ['terminale'], exp: "Clausewitz analyse la guerre comme un instrument au service d'objectifs politiques." },
            { q: "Quels traités de 1648 mettent fin à la guerre de Trente Ans et fondent le principe de souveraineté des États ?", correct: "les traités de Westphalie", wrongs: ["les traités de Rome", "les accords d'Oslo", "le congrès de Vienne"], levels: ['terminale'], exp: "L'ordre westphalien reconnaît l'égalité souveraine et la non-ingérence entre États." },
            { q: "Quel organisme de l'ONU établit depuis 1972 la liste du patrimoine mondial culturel et naturel de l'humanité ?", correct: "l'UNESCO", wrongs: ["l'OMS", "l'OMC", "le FMI"], levels: ['terminale'], exp: "L'UNESCO protège et valorise les biens reconnus de valeur universelle exceptionnelle." },
            { q: "Quelle notion désigne l'époque géologique actuelle marquée par l'impact majeur des activités humaines sur le climat et la biosphère ?", correct: "l'Anthropocène", wrongs: ["le Jurassique", "le Paléolithique", "la Glaciation"], levels: ['terminale'], exp: "Popularisée par Paul Crutzen, elle souligne la transformation humaine du système Terre." },
            { q: "En quelle année l'Accord de Paris sur le climat (COP21) a-t-il été adopté pour limiter le réchauffement bien en dessous de 2 °C ?", correct: "2015", wrongs: ["1997", "2005", "2020"], levels: ['terminale'], exp: "Adopté par 196 parties lors de la COP21 à Paris en décembre 2015." },
            { q: "Quelle est la spécificité de la « guerre asymétrique » contemporaine ?", correct: "elle oppose une armée étatique régulière à des acteurs non étatiques (guérilla, terrorisme)", wrongs: ["elle se déroule uniquement sur mer", "elle engage deux armées de puissance strictement égale", "elle exclut tout usage de l'information"], levels: ['terminale'], exp: "Les conflits asymétriques échappent au cadre classique clausewitzien de guerre interétatique." },
            { q: "Quel espace numérique immatériel constitue aujourd'hui un cinquième domaine de conflictualité (cyberattaques, désinformation) ?", correct: "le cyberespace", wrongs: ["la stratosphère", "la haute mer", "l'espace Schengen"], levels: ['1ere', 'terminale'], exp: "Le cyberespace est un enjeu majeur de souveraineté, de défense et d'information." },
            { q: "Quel texte adopté par l'Assemblée générale de l'ONU en 1948 affirme les droits fondamentaux de tout être humain ?", correct: "la Déclaration universelle des droits de l'homme (DUDH)", wrongs: ["le traité de Maastricht", "la charte de l'OTAN", "le pacte de Varsovie"], levels: ['1ere', 'terminale'], exp: "Adoptée à Paris le 10 décembre 1948 au palais de Chaillot." },
            { q: "Quel traité de 1959 fait de l'Antarctique un continent démilitarisé consacré exclusivement à la recherche scientifique ?", correct: "le traité de l'Antarctique", wrongs: ["le traité de Rome", "le protocole de Montréal", "les accords de Yalta"], levels: ['terminale'], exp: "Signé à Washington par 12 pays, il gèle toute revendication territoriale sur l'Antarctique." },
            { q: "Quelle route maritime stratégique relie l'océan Indien à la mer de Chine méridionale et concentre près d'un tiers du trafic mondial ?", correct: "le détroit de Malacca", wrongs: ["le détroit de Béring", "le canal de Panama", "le détroit de Magellan"], levels: ['1ere', 'terminale'], exp: "Point de passage clé pour l'approvisionnement énergétique de la Chine et du Japon." },
            { q: "Quel tribunal pénal permanent, créé par le Statut de Rome (1998), juge les individus auteurs de génocide et crimes contre l'humanité ?", correct: "la Cour pénale internationale (CPI)", wrongs: ["le Tribunal de commerce", "la Cour des comptes", "le Conseil constitutionnel"], levels: ['terminale'], exp: "La CPI siège à La Haye (Pays-Bas) et fonctionne depuis 2002." },
            { q: "En géopolitique, que désigne la « liberté de la presse » mesurée chaque année par Reporters sans frontières (RSF) ?", correct: "l'indépendance des journalistes vis-à-vis des pouvoirs politiques et économiques", wrongs: ["la gratuité obligatoire de tous les journaux", "l'interdiction de la presse numérique", "le contrôle étatique des médias"], levels: ['1ere', 'terminale'], exp: "Une presse libre et pluraliste est considérée comme un pilier essentiel de la démocratie." },
            { q: "Quel grand projet chinois d'infrastructures terrestres et maritimes vise à relier la Chine à l'Europe et à l'Afrique depuis 2013 ?", correct: "les Nouvelles Routes de la soie (Belt and Road Initiative)", wrongs: ["le Plan Marshall", "l'espace Schengen", "l'Alliance atlantique"], levels: ['1ere', 'terminale'], exp: "Lancé par Xi Jinping, ce projet combine ports, voies ferrées et influence diplomatique." },
            { q: "Qu'appelle-t-on le « patrimoine immatériel » reconnu par l'UNESCO depuis 2003 ?", correct: "les traditions orales, savoir-faire artisanaux, rituels, musiques et gastronomies", wrongs: ["les immeubles en ruine uniquement", "les réserves d'or des banques centrales", "les satellites en orbite"], levels: ['terminale'], exp: "Exemples en France : le repas gastronomique des Français, les savoir-faire de la baguette." },
            { q: "Quelle loi française de 1905 établit la séparation des Églises et de l'État et garantit la liberté de conscience ?", correct: "la loi de 1905 sur la laïcité", wrongs: ["l'édit de Nantes", "le Concordat de 1801", "le Code civil de 1804"], levels: ['1ere', 'terminale'], exp: "La République assure la liberté de conscience et ne reconnaît, ne salarie ni ne subventionne aucun culte." }
        ],

        si: [
            // 2nde, 1ère, Terminale (Sciences de l'Ingénieur)
            { q: "Dans la modélisation SysML d'un système, quel diagramme recense les exigences (performances, contraintes) du cahier des charges ?", correct: "le diagramme d'exigences (req)", wrongs: ["le diagramme de séquence", "le schéma électrique", "le diagramme de Gantt"], levels: ['2nde', '1ere', 'terminale'], exp: "Le diagramme d'exigences (Requirements Diagram) formalise ce que le système doit satisfaire." },
            { q: "Dans une chaîne d'information, quelle est la séquence logique des trois fonctions principales ?", correct: "Acquérir → Traiter → Communiquer", wrongs: ["Alimenter → Distribuer → Convertir", "Convertir → Transmettre → Stocker", "Mesurer → Freiner → Éclairer"], levels: ['2nde', '1ere', 'terminale'], exp: "La chaîne d'information acquiert (capteurs), traite (microcontrôleur) et communique (ordres/IHM)." },
            { q: "Dans une chaîne d'énergie, quelle est la suite logique des quatre blocs fonctionnels ?", correct: "Alimenter → Distribuer → Convertir → Transmettre", wrongs: ["Acquérir → Traiter → Communiquer → Stocker", "Coder → Décoder → Filtrer → Amplifier", "Concevoir → Produire → Vendre → Recycler"], levels: ['2nde', '1ere', 'terminale'], exp: "Alimenter (batterie), Distribuer (relais/hacheur), Convertir (moteur), Transmettre (réducteur)." },
            { q: "Quel composant de distribution d'énergie permet de faire varier la vitesse d'un moteur à courant continu par découpage ?", correct: "un hacheur (pont en H / PWM)", wrongs: ["une résistance fixe", "un transformateur statique seul", "un interrupteur thermique"], levels: ['1ere', 'terminale'], exp: "Un hacheur module la tension moyenne grâce au rapport cyclique PWM." },
            { q: "Quelle liaison mécanique autorise uniquement une rotation autour d'un axe sans aucune translation ?", correct: "une liaison pivot", wrongs: ["une liaison glissière", "une liaison rotule", "une liaison encastrement"], levels: ['2nde', '1ere', 'terminale'], exp: "La liaison pivot possède 1 degré de liberté (1 rotation)." },
            { q: "Quelle liaison mécanique autorise uniquement une translation le long d'un axe ?", correct: "une liaison glissière", wrongs: ["une liaison pivot", "une liaison hélicoïdale", "une liaison appui plan"], levels: ['2nde', '1ere', 'terminale'], exp: "La liaison glissière possède 1 degré de liberté en translation." },
            { q: "Combien de degrés de liberté possède une liaison encastrement (liaison complète) ?", correct: "0 degré de liberté", wrongs: ["1 degré de liberté", "3 degrés de liberté", "6 degrés de liberté"], levels: ['2nde', '1ere'], exp: "Deux solides encastrés ne peuvent avoir aucun mouvement relatif." },
            { q: "Quel capteur permet de mesurer la vitesse angulaire ou la position d'un arbre moteur ?", correct: "un codeur incrémental (ou potentiomètre)", wrongs: ["une thermistance CTN", "un capteur de CO₂", "un microphone"], levels: ['1ere', 'terminale'], exp: "Le codeur optique génère des impulsions proportionnelles à la rotation." },
            { q: "Que stipule le Principe Fondamental de la Statique (PFS) pour un solide en équilibre ?", correct: "la somme des forces et la somme des moments sont nulles", wrongs: ["la vitesse augmente linéairement", "la masse est égale à la force", "le rendement vaut toujours 1"], levels: ['1ere', 'terminale'], exp: "ΣF = 0 et ΣM = 0 traduisent l'équilibre statique d'un solide." },
            { q: "Dans un système asservi en boucle fermée, quel rôle joue la chaîne de retour (capteur) ?", correct: "mesurer la grandeur réelle pour la comparer à la consigne (erreur)", wrongs: ["couper l'alimentation principale", "remplacer le moteur par une batterie", "supprimer la consigne utilisateur"], levels: ['1ere', 'terminale'], exp: "La boucle fermée corrige automatiquement les perturbations grâce au comparateur et au correcteur." },
            { q: "Quelle grandeur caractérise l'efficacité énergétique d'une chaîne de puissance (toujours comprise entre 0 et 1) ?", correct: "le rendement η = P_sortie / P_entrée", wrongs: ["le couple moteur", "la raideur du ressort", "le module d'Young"], levels: ['2nde', '1ere', 'terminale'], exp: "Les pertes (frottements, effet Joule) font que η < 1 (ou < 100 %)." },
            { q: "Lorsque deux systèmes de rendements η₁ et η₂ sont placés en série, que vaut le rendement global η ?", correct: "η = η₁ × η₂", wrongs: ["η = η₁ + η₂", "η = (η₁ + η₂) / 2", "η = η₁ / η₂"], levels: ['1ere', 'terminale'], exp: "Les rendements en série se multiplient." },
            { q: "En mécanique, quelle grandeur (en N·m) traduit l'action de rotation d'un moteur sur un arbre ?", correct: "le couple moteur (C = P / ω)", wrongs: ["la masse volumique", "la résistance électrique", "la fréquence d'horloge"], levels: ['1ere', 'terminale'], exp: "Puissance mécanique en rotation : P (W) = C (N·m) × ω (rad/s)." },
            { q: "Dans un réducteur à engrenages de rapport r = ω_sortie / ω_entrée < 1, quel est l'effet sur la vitesse et le couple en sortie ?", correct: "la vitesse diminue et le couple augmente (aux pertes près)", wrongs: ["la vitesse et le couple diminuent tous les deux", "la vitesse augmente et le couple augmente", "rien ne change"], levels: ['2nde', '1ere', 'terminale'], exp: "Un réducteur diminue la vitesse angulaire pour multiplier le couple disponible." },
            { q: "En modélisation SysML, quel diagramme représente la structure matérielle interne d'un système et ses flux (énergie, matière, information) ?", correct: "le diagramme de blocs internes (ibd)", wrongs: ["le diagramme de cas d'utilisation (uc)", "le diagramme de Gantt", "le tableau d'amortissement"], levels: ['1ere', 'terminale'], exp: "L'IBD (Internal Block Diagram) détaille les connexions et flux entre les sous-ensembles." },
            { q: "Quel type de capteur fournit une information binaire « tout ou rien » (0 ou 1) comme un interrupteur de fin de course ?", correct: "un capteur logique (TOR)", wrongs: ["un capteur analogique continu", "un thermocouple linéaire", "un spectromètre"], levels: ['2nde', '1ere', 'terminale'], exp: "Un capteur TOR (Tout Ou Rien) ne renvoie que deux états logiques (présence/absence)." },
            { q: "Quelle est l'unité SI de la vitesse angulaire ω utilisée en mécanique des systèmes ?", correct: "le radian par seconde (rad/s)", wrongs: ["le newton par mètre", "le volt par seconde", "le watt par heure"], levels: ['1ere', 'terminale'], exp: "ω = 2π × N / 60 lorsque N est exprimé en tours par minute (tr/min)." },
            { q: "Dans une régulation PID (Proportionnel, Intégral, Dérivé), à quoi sert principalement le terme Intégral (I) ?", correct: "annuler l'erreur statique permanente en régime établi", wrongs: ["couper l'alimentation du capteur", "augmenter volontairement le bruit", "supprimer la boucle de retour"], levels: ['terminale'], exp: "L'action intégrale cumule l'erreur résiduelle jusqu'à atteindre exactement la consigne." }
        ],

        msgn: [
            // STMG & BTS : Management, Sciences de Gestion et Numérique
            { q: "Quelles sont les trois grandes catégories d'organisations étudiées en management STMG ?", correct: "entreprises privées, organisations publiques et organisations de la société civile (associations)", wrongs: ["usines, banques et écoles uniquement", "syndicats, tribunaux et ministères", "start-up, PME et multinationales uniquement"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "On distingue les organisations à but lucratif (entreprises) et non lucratif (publiques / associations)." },
            { q: "Que signifie l'acronyme PESTEL dans le diagnostic stratégique externe d'une organisation ?", correct: "Politique, Économique, Socioculturel, Technologique, Écologique, Légal", wrongs: ["Produit, Export, Salaire, Travail, Épargne, Logistique", "Prix, Emploi, Stock, Taxe, Emprunt, Loi", "Performance, Éthique, Stratégie, Temps, Équipe, Leader"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "PESTEL analyse les 6 dimensions du macro-environnement de l'organisation." },
            { q: "Que regroupe la matrice SWOT (ou FFOM) lors d'un diagnostic stratégique ?", correct: "Forces, Faiblesses (interne) et Opportunités, Menaces (externe)", wrongs: ["Salaires, Ventes, Offres et Taxes", "Fournisseurs, Clients, Banques et État", "Finances, Flux, Objectifs et Marchés"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "SWOT = Strengths, Weaknesses (diagnostic interne) + Opportunities, Threats (diagnostic externe)." },
            { q: "Quelle est la finalité principale d'une entreprise privée classique ?", correct: "réaliser des profits pour assurer sa pérennité", wrongs: ["rendre un service public gratuit", "voter des lois fiscales", "distribuer des subventions d'État"], levels: ['2nde', '1ere'], exp: "Sa finalité est lucrative, bien qu'elle intègre de plus en plus des objectifs RSE." },
            { q: "Que signifie le sigle RSE en management des organisations ?", correct: "Responsabilité Sociétale des Entreprises", wrongs: ["Revenu Social d'Entreprise", "Régime Spécial d'Épargne", "Réseau Stratégique Européen"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La RSE intègre les enjeux sociaux, environnementaux et éthiques dans la stratégie." },
            { q: "Selon Michael Porter, quelle stratégie consiste à proposer une offre unique perçue comme supérieure pour justifier un prix plus élevé ?", correct: "la stratégie de différenciation", wrongs: ["la domination par les coûts", "l'externalisation pure", "le recentrage comptable"], levels: ['terminale', 'bts1', 'bts2'], exp: "Porter distingue la domination par les coûts, la différenciation et la focalisation (niche)." },
            { q: "Quelle est la différence entre le management stratégique et le management opérationnel ?", correct: "le stratégique engage le long terme (direction), l'opérationnel gère le quotidien à court terme", wrongs: ["le stratégique concerne uniquement la comptabilité", "l'opérationnel fixe les lois nationales", "il n'existe aucune différence"], levels: ['1ere', 'terminale'], exp: "Stratégique = long terme, difficilement réversible ; Opérationnel = court terme, pilotage courant." },
            { q: "En gestion des ressources humaines, qu'est-ce que la GPEC (ou GEPP) ?", correct: "la Gestion Prévisionnelle des Emplois et des Compétences", wrongs: ["la Gestion des Prêts et Épargnes Commerciales", "le Groupement Patronal d'Entreprises Civiles", "la Garantie Publique d'Emploi Permanent"], levels: ['1ere', 'terminale', 'bts1'], exp: "Elle anticipe les besoins futurs en emplois et compétences (formation, recrutement)." },
            { q: "Que désigne un PGI (ERP en anglais) dans le système d'information d'une entreprise ?", correct: "un Progiciel de Gestion Intégré unifiant les données (compta, stocks, RH, ventes)", wrongs: ["un Programme de Garantie Individuelle", "un Protocole de Géolocalisation Internet", "un Plan Général d'Investissement"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un PGI (ex : SAP, Odoo) partage une base de données unique entre tous les services." },
            { q: "Selon Rensis Likert, quel style de direction associe activement les salariés aux décisions et favorise la coopération ?", correct: "le style participatif", wrongs: ["le style autoritaire exploiteur", "le style paternaliste strict", "le style autocratique"], levels: ['1ere', 'terminale'], exp: "Likert distingue 4 styles : autoritaire, paternaliste, consultatif et participatif." },
            { q: "Qu'appelle-t-on les « parties prenantes » (stakeholders) d'une organisation ?", correct: "tous les acteurs internes et externes concernés par ses décisions (salariés, clients, fournisseurs, État, riverains)", wrongs: ["uniquement les actionnaires majoritaires", "uniquement les concurrents directs", "uniquement les clients VIP"], levels: ['1ere', 'terminale', 'bts1'], exp: "Théorisé par Freeman : l'organisation interagit avec un écosystème d'acteurs aux intérêts parfois divergents." },
            { q: "Dans la transformation numérique, quel modèle consiste à accéder à des serveurs et logiciels à distance via Internet ?", correct: "le Cloud Computing (informatique en nuage)", wrongs: ["le télégramme numérique", "le stockage papier", "le réseau isolé hors-ligne"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le Cloud (SaaS, PaaS, IaaS) apporte flexibilité, mobilité et scalabilité." },
            { q: "En management, quelle est la différence entre l'efficacité et l'efficience d'une organisation ?", correct: "l'efficacité mesure l'atteinte des objectifs ; l'efficience mesure le rapport entre résultats obtenus et moyens utilisés", wrongs: ["les deux notions sont strictement identiques", "l'efficience ignore totalement les coûts", "l'efficacité concerne uniquement le service informatique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Une organisation est efficiente lorsqu'elle atteint ses objectifs en optimisant ses ressources." },
            { q: "Que signifie la « valeur ajoutée » (VA) créée par une entreprise ?", correct: "la richesse réellement créée : Chiffre d'affaires − Consommations intermédiaires", wrongs: ["le total des dettes bancaires", "la somme des salaires uniquement", "le prix d'achat des matières premières"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La VA est ensuite répartie entre salariés, État, prêteurs, actionnaires et entreprise (autofinancement)." },
            { q: "Qu'est-ce qu'une stratégie d'« externalisation » (outsourcing) en management ?", correct: "confier une activité non stratégique (ex : paie, logistique, nettoyage) à un prestataire externe spécialisé", wrongs: ["acheter tous ses fournisseurs", "fermer l'entreprise à l'international", "embaucher exclusivement des stagiaires"], levels: ['terminale', 'bts1', 'bts2'], exp: "L'externalisation permet de recentrer les ressources sur le cœur de métier et de variabiliser les coûts." },
            { q: "Dans un système d'information, à quoi sert un outil de CRM (GRC en français) ?", correct: "gérer et fidéliser la relation client (historique d'achats, contacts, campagnes ciblées)", wrongs: ["calculer uniquement les bulletins de paie", "configurer les routeurs réseau", "dessiner des plans d'architecture"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "CRM = Customer Relationship Management (Gestion de la Relation Client)." },
            { q: "Que désigne la « flexibilité » d'une production en flux tendus (Juste-à-Temps / Toyotisme) ?", correct: "produire à la commande pour limiter au maximum les stocks et les coûts de stockage", wrongs: ["stocker 5 ans de marchandises d'avance", "produire sans jamais consulter la demande", "arrêter toute automatisation"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le flux tendu (flux tiré par la demande) réduit le BFR et le risque d'invendus." },
            { q: "Selon la pyramide des besoins d'Abraham Maslow, quel besoin se situe à la base avant les besoins de sécurité et d'appartenance ?", correct: "les besoins physiologiques (manger, dormir, se loger)", wrongs: ["le besoin d'accomplissement personnel", "le besoin d'estime sociale", "le besoin de loisirs numériques"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Maslow hiérarchise 5 niveaux : physiologiques, sécurité, appartenance, estime, accomplissement." }
        ],

        droit_eco: [
            // STMG, CIEL (Éco-Gestion) & BTS
            { q: "En droit français, quelle est la norme juridique la plus élevée dans la hiérarchie des normes (pyramide de Kelsen) ?", correct: "la Constitution (bloc de constitutionnalité)", wrongs: ["le règlement intérieur", "le décret ministériel", "la circulaire administrative"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Toutes les lois et règlements doivent respecter la Constitution de 1958." },
            { q: "Quelle juridiction française juge les litiges individuels entre un employeur et un salarié (contrat de travail) ?", correct: "le Conseil de prud'hommes", wrongs: ["le tribunal de commerce", "la cour d'assises", "le tribunal administratif"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le Conseil de prud'hommes est une juridiction paritaire composée de représentants salariés et employeurs." },
            { q: "Quelles sont les trois conditions cumulatives pour qu'un contrat soit légalement valable (Code civil) ?", correct: "consentement libre et éclairé, capacité de contracter et contenu licite et certain", wrongs: ["signature devant notaire, paiement en espèces et présence de témoins", "accord oral uniquement, majorité fiscale et prix libre", "enregistrement en mairie, timbre fiscal et délai d'un mois"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Article 1128 du Code civil : consentement, capacité, contenu licite et certain." },
            { q: "Qu'est-ce que le « lien de subordination juridique » qui caractérise un contrat de travail ?", correct: "le pouvoir de l'employeur de donner des ordres, contrôler l'exécution et sanctionner", wrongs: ["l'obligation d'acheter des actions de l'entreprise", "le lien familial entre associés", "le simple paiement d'une facture prestataire"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "C'est le critère distinctif entre un salarié et un travailleur indépendant." },
            { q: "Quels sont les trois vices du consentement pouvant entraîner la nullité d'un contrat ?", correct: "l'erreur, le dol (tromperie) et la violence", wrongs: ["la négligence, le retard et l'oubli", "la concurrence, la hausse des prix et la pénurie", "la grève, la maladie et la démission"], levels: ['1ere', 'terminale', 'bts1'], exp: "Un consentement vicié par erreur, dol ou violence rend le contrat annulable." },
            { q: "En responsabilité civile, quels trois éléments la victime doit-elle prouver pour obtenir réparation ?", correct: "un fait générateur (faute), un dommage et un lien de causalité", wrongs: ["un casier judiciaire, un contrat écrit et un témoin", "un préjudice fiscal uniquement", "une plainte au tribunal administratif"], levels: ['1ere', 'terminale', 'bts1'], exp: "Fait générateur + Dommage (certain, direct, légitime) + Lien de causalité." },
            { q: "En économie, comment appelle-t-on la hausse générale, durable et auto-entretenue du niveau des prix ?", correct: "l'inflation", wrongs: ["la déflation", "la récession pure", "la dévaluation monétaire"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'inflation réduit le pouvoir d'achat de la monnaie (mesurée par l'IPC de l'INSEE)." },
            { q: "Quelle est la différence entre un CDI et un CDD en droit du travail français ?", correct: "le CDI est la forme normale sans date de fin, le CDD est exceptionnel et limité dans le temps", wrongs: ["le CDD offre toujours un salaire double", "le CDI ne peut jamais être rompu", "le CDD est réservé aux fonctionnaires"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le CDD ne peut être conclu que pour des motifs précis (remplacement, accroissement temporaire d'activité...)." },
            { q: "En droit numérique (CIEL / STMG), quelle durée légale maximale a un consommateur pour se rétracter après un achat en ligne ?", correct: "14 jours calendaires", wrongs: ["24 heures", "3 jours ouvrés", "60 jours"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le Code de la consommation accorde un délai de rétractation de 14 jours pour la vente à distance." },
            { q: "En économie, comment finance-t-on principalement la protection sociale en France (Sécurité sociale) ?", correct: "par les cotisations sociales et des impôts affectés (CSG)", wrongs: ["uniquement par des dons privés", "uniquement par les droits de douane", "par la création de billets"], levels: ['terminale', 'bts1', 'bts2'], exp: "Système mixte combinant cotisations salariales/patronales et CSG." },
            { q: "Quel est le rôle principal de l'Autorité de la concurrence en France ?", correct: "sanctionner les ententes illicites et les abus de position dominante", wrongs: ["fixer le prix de chaque baguette de pain", "gérer les retraites des salariés", "imprimer la monnaie européenne"], levels: ['1ere', 'terminale', 'bts1'], exp: "Elle veille au fonctionnement libre et loyal des marchés au profit des consommateurs." },
            { q: "En droit des affaires, quelle forme juridique protège le patrimoine personnel de l'entrepreneur en limitant sa responsabilité aux apports ?", correct: "une société à responsabilité limitée (SARL / SAS / EURL)", wrongs: ["une association de fait", "une société en nom collectif (SNC)", "un contrat verbal"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La personnalité morale de la SARL/SAS crée un patrimoine social distinct." },
            { q: "Quelle politique économique consiste pour l'État à agir sur les dépenses publiques et les impôts ?", correct: "la politique budgétaire", wrongs: ["la politique monétaire", "la politique douanière", "la politique démographique"], levels: ['terminale', 'bts1', 'bts2'], exp: "L'État gère la politique budgétaire ; la BCE gère la politique monétaire dans la zone euro." },
            { q: "Dans le RGPD, quel droit permet à une personne d'obtenir la suppression de ses données personnelles ?", correct: "le droit à l'effacement (droit à l'oubli)", wrongs: ["le droit de rétention", "le droit de préemption", "le droit d'asile"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le RGPD garantit les droits d'accès, de rectification, d'effacement et de portabilité." },
            { q: "Quel est le rôle d'un brevet déposé auprès de l'INPI en droit de la propriété industrielle ?", correct: "protéger une invention technique pendant 20 ans maximum en accordant un monopole d'exploitation", wrongs: ["protéger uniquement le nom d'une marque", "dispenser l'entreprise de payer ses impôts", "garantir la rentabilité commerciale automatique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le brevet protège une innovation technique (nouvelle, inventive, applicable industriellement) pour 20 ans." },
            { q: "En droit du travail, que garantit le SMIC en France ?", correct: "le salaire horaire minimum légal en dessous duquel aucun salarié ne peut être rémunéré", wrongs: ["un salaire maximum pour les dirigeants", "une prime facultative d'ancienneté", "le montant des allocations chômage"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "SMIC = Salaire Minimum Interprofessionnel de Croissance, revalorisé chaque année." },
            { q: "En droit, quelle est la différence entre une personne physique et une personne morale ?", correct: "la personne physique est un individu humain ; la personne morale est un groupement doté de la personnalité juridique (société, association, État)", wrongs: ["la personne morale n'a jamais le droit de signer de contrat", "la personne physique désigne uniquement les sportifs", "il n'existe aucune distinction juridique"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Une société immatriculée au RCS acquiert la personnalité morale, avec son propre patrimoine." },
            { q: "En économie, comment définit-on le chômage au sens du Bureau International du Travail (BIT) ?", correct: "être sans emploi, disponible pour travailler et rechercher activement un emploi", wrongs: ["ne pas travailler pour quelque raison que ce soit (étudiants, retraités)", "travailler à temps partiel choisi", "être inscrit à la mairie"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les 3 critères cumulatifs du BIT : sans emploi, disponible sous 15 jours, en recherche active." },
            { q: "Quel est l'objectif principal de la Banque Centrale Européenne (BCE) dans la zone euro ?", correct: "maintenir la stabilité des prix (inflation proche de 2 % à moyen terme)", wrongs: ["fixer le budget de chaque lycée européen", "collecter la TVA des commerçants", "embaucher les fonctionnaires nationaux"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La BCE agit via ses taux directeurs pour maîtriser l'inflation." },
            { q: "En droit des contrats, quelle clause interdit à un ancien salarié d'exercer une activité concurrente après son départ (moyennant contrepartie financière) ?", correct: "la clause de non-concurrence", wrongs: ["la clause de mobilité géographique", "la clause d'essai", "la clause de garantie décennale"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Pour être valable, elle doit être limitée dans le temps, l'espace, et assortie d'une indemnité financière." },
            { q: "En économie, que mesure la balance commerciale d'un pays ?", correct: "la différence entre la valeur de ses exportations et celle de ses importations de biens", wrongs: ["le budget de l'État uniquement", "le taux d'épargne des banques", "le nombre de magasins ouverts"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Si Exportations > Importations : excédent commercial ; sinon : déficit commercial." },
            { q: "En droit civil, que signifie la « force obligatoire du contrat » (article 1103 du Code civil) ?", correct: "les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits", wrongs: ["un contrat peut être modifié librement par une seule partie", "seuls les contrats signés par l'État sont obligatoires", "un contrat expire automatiquement après 7 jours"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Chaque partie doit exécuter ses engagements de bonne foi." }
        ],

        mercatique: [
            // STMG & BTS : Mercatique (Marketing) & Gestion-Finance
            { q: "Que désignent les « 4P » du marketing-mix (plan de marchéage) ?", correct: "Produit, Prix, Place (Distribution) et Promotion (Communication)", wrongs: ["Profit, Personnel, Patrimoine et Public", "Plan, Prospection, Prêt et Paiement", "Partenariat, Partage, Pouvoir et Presse"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les 4P structurent la stratégie opérationnelle de mise sur le marché d'une offre." },
            { q: "Quelle stratégie de fixation de prix consiste à lancer un produit innovant à un prix élevé pour viser d'abord les clients peu sensibles au prix ?", correct: "la stratégie d'écrémage", wrongs: ["la stratégie de pénétration", "la stratégie d'alignement", "le dumping illégal"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "À l'inverse, la stratégie de pénétration fixe un prix bas pour conquérir vite de grosses parts de marché." },
            { q: "Quelles sont les quatre grandes phases classiques du cycle de vie d'un produit ?", correct: "Lancement, Croissance, Maturité, Déclin", wrongs: ["Achat, Stockage, Livraison, Retour", "Idée, Brevet, Impôt, Faillite", "Création, Fusion, Cotation, Liquidation"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Chaque phase appelle des décisions différentes sur le prix, la promo et la distribution." },
            { q: "En comptabilité / gestion-finance, que représente l'ACTIF du bilan d'une entreprise ?", correct: "ce que l'entreprise possède (immobilisations, stocks, créances, trésorerie)", wrongs: ["ce que l'entreprise doit aux banques uniquement", "les salaires versés sur l'année", "le montant total de la TVA collectée"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'Actif recense les emplois (biens et créances) ; le Passif recense les ressources (capitaux propres et dettes)." },
            { q: "En gestion-finance, quelle est la formule du Fonds de Roulement Net Global (FRNG) ?", correct: "Ressources stables − Emplois stables", wrongs: ["Actif circulant − Trésorerie", "Chiffre d'affaires − Achats", "Capital social + Dettes fournisseurs"], levels: ['terminale', 'bts1', 'bts2'], exp: "Un FRNG positif signifie que les ressources durables financent intégralement les immobilisations." },
            { q: "Qu'est-ce que le BFR (Besoin en Fonds de Roulement) ?", correct: "le décalage de trésorerie entre encaissements clients et décaissements fournisseurs/stocks", wrongs: ["le bénéfice distribué aux actionnaires", "le budget de publicité annuel", "la valeur des bâtiments"], levels: ['terminale', 'bts1', 'bts2'], exp: "BFR = Stocks + Créances clients − Dettes fournisseurs." },
            { q: "Quelle est la relation fondamentale entre Trésorerie Nette (TN), FRNG et BFR ?", correct: "TN = FRNG − BFR", wrongs: ["TN = FRNG + BFR", "TN = FRNG × BFR", "TN = BFR − FRNG"], levels: ['terminale', 'bts1', 'bts2'], exp: "La trésorerie est positive si le FRNG couvre entièrement le BFR." },
            { q: "En mercatique, que signifie la « segmentation » d'un marché ?", correct: "découper un marché hétérogène en groupes homogènes de consommateurs (segments)", wrongs: ["vendre un produit dans un seul magasin", "supprimer toute publicité télévisée", "baisser les prix de 50 %"], levels: ['1ere', 'terminale', 'bts1'], exp: "La segmentation permet ensuite le ciblage et le positionnement de l'offre." },
            { q: "Qu'appelle-t-on la « distribution omnicanale » ?", correct: "l'intégration fluide de tous les canaux de vente (magasin physique, site web, appli mobile, click & collect)", wrongs: ["la vente exclusivement par catalogue papier", "la vente uniquement en gros aux usines", "un réseau d'un seul point de vente"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le client vit une expérience unifiée entre en ligne et point de vente physique." },
            { q: "Quel est le rôle du « positionnement » marketing d'une marque ?", correct: "la place distinctive et claire qu'elle cherche à occuper dans l'esprit des consommateurs face aux concurrents", wrongs: ["l'adresse GPS de son entrepôt", "son classement comptable au greffe", "la hauteur des rayons en magasin"], levels: ['1ere', 'terminale', 'bts1'], exp: "Le positionnement repose sur une promesse différenciante et crédible." },
            { q: "En analyse financière, comment calcule-t-on le taux de rentabilité économique ou financière ?", correct: "en rapportant un résultat (bénéfice ou EBE) aux capitaux engagés", wrongs: ["en additionnant toutes les factures impayées", "en divisant le nombre de salariés par le prix unitaire", "en soustrayant la TVA du loyer"], levels: ['terminale', 'bts1', 'bts2'], exp: "La rentabilité mesure la capacité des capitaux investis à générer un profit." },
            { q: "Qu'est-ce que l'« amortissement comptable » d'une immobilisation (ex : machine, ordinateur) ?", correct: "la constatation comptable de la perte de valeur irréversible liée à l'usage ou au temps", wrongs: ["le remboursement immédiat d'un client mécontent", "une prime de fin d'année", "le montant d'une amende fiscale"], levels: ['terminale', 'bts1', 'bts2'], exp: "L'amortissement étale le coût d'un bien durable sur sa durée d'utilisation." },
            { q: "En marketing digital, que signifie l'acronyme SEO (Search Engine Optimization) ?", correct: "le référencement naturel d'un site web pour apparaître en tête des résultats de recherche sans payer d'annonces", wrongs: ["l'achat obligatoire d'encarts publicitaires papier", "la suppression des réseaux sociaux", "un logiciel de paie"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le SEO optimise le contenu, la technique et la popularité (backlinks) ; le SEA désigne les annonces payantes." },
            { q: "En gestion-finance, qu'est-ce que le « seuil de rentabilité » (point mort en valeur) d'une entreprise ?", correct: "le chiffre d'affaires à partir duquel les recettes couvrent exactement toutes les charges (résultat = 0)", wrongs: ["le montant maximum du capital social", "la limite de découvert autorisé par la banque", "le prix de vente le plus élevé du marché"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Au-delà du seuil de rentabilité (Charges fixes / Taux de marge sur coût variable), l'entreprise dégage un bénéfice." },
            { q: "En mercatique, que mesure le « taux de conversion » d'un site e-commerce ?", correct: "le pourcentage de visiteurs qui réalisent l'action attendue (achat, inscription, devis)", wrongs: ["le taux de change entre l'euro et le dollar", "la vitesse de chargement du serveur", "le nombre d'articles retournés par la poste"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Taux de conversion = (Nombre de commandes / Nombre de visiteurs) × 100." },
            { q: "En comptabilité, quel document de synthèse récapitule les produits et les charges d'un exercice pour déterminer le bénéfice ou la perte ?", correct: "le compte de résultat", wrongs: ["la fiche de paie", "le bon de livraison", "l'organigramme RH"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Résultat net = Total des produits − Total des charges de l'exercice." },
            { q: "Quelle est la différence entre une stratégie « Push » et une stratégie « Pull » en mercatique ?", correct: "Push pousse le produit vers le distributeur (promotions, force de vente) ; Pull attire le client final par la publicité et la marque", wrongs: ["Push est réservée au web et Pull aux magasins", "Pull consiste à arrêter toute publicité", "les deux stratégies interdisent les remises"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Push = pression commerciale sur le réseau de distribution ; Pull = attraction de la demande finale." },
            { q: "En comptabilité, comment appelle-t-on la taxe sur la consommation collectée par les entreprises pour le compte de l'État ?", correct: "la TVA (Taxe sur la Valeur Ajoutée)", wrongs: ["l'impôt sur le revenu", "la cotisation retraite", "la taxe foncière"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'entreprise reverse à l'État : TVA collectée sur ventes − TVA déductible sur achats." }
        ],

        i2d: [
            // STI2D : Innovation Technologique & Ingénierie-Développement Durable
            { q: "Que signifie le sigle ACV dans une démarche d'éco-conception industrielle (STI2D) ?", correct: "Analyse du Cycle de Vie", wrongs: ["Association des Constructeurs de Véhicules", "Alimentation en Courant Variable", "Aide au Calcul Vectoriel"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'ACV évalue les impacts environnementaux d'un produit de l'extraction des matières jusqu'à sa fin de vie." },
            { q: "Quels sont les trois piliers du Développement Durable ?", correct: "Économique, Social et Environnemental", wrongs: ["Thermique, Mécanique et Numérique", "Local, National et Spatial", "Public, Privé et Associatif"], levels: ['2nde', '1ere', 'terminale'], exp: "Un projet durable doit être économiquement viable, socialement équitable et écologiquement vivable." },
            { q: "En construction durable (AC / I2D), que mesure la conductivité thermique λ (lambda) d'un isolant ?", correct: "sa capacité à conduire la chaleur (plus λ est faible, meilleur est l'isolant)", wrongs: ["sa résistance à la traction mécanique", "sa densité acoustique", "son prix au mètre carré"], levels: ['1ere', 'terminale', 'bts1'], exp: "Un bon isolant thermique (laine de bois, ouate de cellulose) a un λ très bas (≈ 0,035–0,04 W/(m·K))." },
            { q: "En mécanique des structures (ITEC / I2D), quelle sollicitation subit un câble tendu soutenant une charge ?", correct: "la traction", wrongs: ["la compression", "la torsion", "le flambement"], levels: ['1ere', 'terminale', 'bts1'], exp: "La traction tend à allonger le solide sous l'effet de deux forces opposées." },
            { q: "Quelle sollicitation subit un poteau vertical supportant le poids d'un plancher ?", correct: "la compression", wrongs: ["la traction pure", "le cisaillement seul", "l'induction"], levels: ['1ere', 'terminale'], exp: "La compression tend à raccourcir le solide." },
            { q: "Qu'est-ce que l'« économie circulaire » en éco-conception ?", correct: "un modèle limitant les déchets via réemploi, réparation, reconditionnement et recyclage", wrongs: ["un modèle linéaire : extraire, fabriquer, jeter", "la vente uniquement en magasin rond", "l'augmentation volontaire de l'obsolescence"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'économie circulaire s'oppose au modèle linéaire 'extraire-produire-jeter'." },
            { q: "Quel procédé de fabrication additive construit une pièce 3D couche par couche à partir d'un fichier CAO ?", correct: "l'impression 3D (FDM, SLA, frittage laser)", wrongs: ["le tournage par enlèvement de copeaux", "l'emboutissage de tôle", "le pliage hydraulique"], levels: ['2nde', '1ere', 'terminale'], exp: "La fabrication additive limite les chutes de matière par rapport à l'usinage soustractif." },
            { q: "Quelle norme thermique et environnementale encadre aujourd'hui les bâtiments neufs en France ?", correct: "la RE2020 (Réglementation Environnementale 2020)", wrongs: ["la loi d'Ohm 1905", "le protocole HTTP/2", "la norme ISO-8859"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La RE2020 vise la sobriété énergétique, le confort d'été et la baisse de l'empreinte carbone." },
            { q: "Quelle source d'énergie est dite « pilotable » (disponible à la demande) contrairement à l'éolien ou au solaire ?", correct: "l'hydroélectricité de barrage (ou le nucléaire)", wrongs: ["le solaire photovoltaïque sans batterie", "l'éolien offshore sans stockage", "l'énergie des vagues"], levels: ['1ere', 'terminale', 'bts1'], exp: "Un barrage hydraulique peut être ouvert en quelques minutes pour répondre aux pics de consommation." },
            { q: "Dans la caractérisation des matériaux (diagramme d'Ashby), quel paramètre mesure la rigidité élastique d'un matériau ?", correct: "le module d'Young (E, en GPa)", wrongs: ["la masse volumique seule", "la température de fusion", "la résistivité électrique"], levels: ['1ere', 'terminale', 'bts1'], exp: "Plus le module d'Young E est élevé, moins le matériau se déforme sous une contrainte donnée." },
            { q: "Que désigne l'« énergie grise » d'un produit ou matériau de construction ?", correct: "l'énergie totale consommée sur tout son cycle de vie (extraction, fabrication, transport, fin de vie)", wrongs: ["l'électricité produite la nuit uniquement", "l'énergie perdue par un écran en veille", "le gaz naturel liquéfié"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les matériaux biosourcés (bois, chanvre) présentent généralement une faible énergie grise." },
            { q: "Quel est l'objectif d'une pompe à chaleur (PAC) avec un COP (Coefficient de Performance) de 4 ?", correct: "restituer 4 kWh de chaleur pour 1 kWh d'électricité consommé", wrongs: ["consommer 4 fois plus qu'un radiateur électrique", "produire de l'électricité à partir de la pluie", "refroidir un moteur à −40 °C"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La PAC prélève des calories gratuites dans l'air, l'eau ou le sol." },
            { q: "En énergétique du bâtiment (EE / I2D), que représente la résistance thermique R d'une paroi d'épaisseur e et de conductivité λ ?", correct: "R = e / λ (en m²·K/W — plus R est grand, meilleure est l'isolation)", wrongs: ["R = e × λ", "R = λ / e", "R = e + λ"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les résistances thermiques de plusieurs couches successives en série s'additionnent." },
            { q: "Qu'est-ce qu'un matériau composite (ex : fibre de carbone + résine époxy) en ITEC / STI2D ?", correct: "l'association d'au moins deux composants (matrice + renfort) offrant des propriétés supérieures à chacun pris séparément", wrongs: ["un métal pur non allié", "un déchet plastique fondu sans renfort", "un bois brut non traité"], levels: ['1ere', 'terminale', 'bts1'], exp: "La matrice protège et transmet les efforts, les fibres (verre, carbone, lin) assurent la résistance mécanique." },
            { q: "Que désigne un « pont thermique » dans l'enveloppe d'un bâtiment ?", correct: "une zone ponctuelle ou linéaire où l'isolation est interrompue, provoquant des déperditions de chaleur et de la condensation", wrongs: ["une passerelle piétonne chauffée", "un panneau solaire thermique sur le toit", "un radiateur placé sous une fenêtre"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'isolation thermique par l'extérieur (ITE) réduit fortement les ponts thermiques aux jonctions plancher/façade." },
            { q: "Quelle est la fonction d'un onduleur dans une installation solaire photovoltaïque raccordée au réseau ?", correct: "convertir le courant continu (DC) des panneaux en courant alternatif (AC) synchronisé avec le réseau", wrongs: ["stocker l'eau chaude sanitaire", "mesurer la vitesse du vent", "orienter mécaniquement les tuiles"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les cellules photovoltaïques délivrent une tension continue ; l'onduleur produit du 230 V / 50 Hz alternatif." },
            { q: "Dans la démarche d'éco-conception, qu'est-ce que l'« indice de réparabilité » affiché sur les équipements électriques ?", correct: "une note sur 10 informant le consommateur sur la facilité à démonter, réparer et trouver des pièces détachées", wrongs: ["le prix moyen d'une réparation en euros", "la durée de la garantie constructeur en mois", "la puissance électrique en watts"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Instauré par la loi AGEC en France pour lutter contre l'obsolescence programmée." },
            { q: "En énergie renouvelable, que signifie l'acronyme STEP dans le stockage d'électricité à grande échelle ?", correct: "Station de Transfert d'Énergie par Pompage (barrage hydraulique réversible)", wrongs: ["Système Thermique d'Énergie Photovoltaïque", "Station de Transport Électrique Portable", "Secteur Technique d'Éoliennes Privées"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les STEP pompent l'eau vers un bassin supérieur en heures creuses et la turbinent lors des pics de demande." }
        ],

        sin: [
            // STI2D : Systèmes d'Information & Numérique (et Énergie)
            { q: "Dans une chaîne d'acquisition numérique, quel composant convertit une tension analogique continue en nombre binaire ?", correct: "un CAN (Convertisseur Analogique-Numérique / ADC)", wrongs: ["un CNA (DAC)", "un redresseur à diodes", "un fusible thermique"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le CAN échantillonne et quantifie le signal analogique sur N bits." },
            { q: "Selon le théorème de Shannon-Nyquist, à quelle fréquence minimale f_e doit-on échantillonner un signal de fréquence max f_max ?", correct: "f_e ≥ 2 × f_max", wrongs: ["f_e = f_max / 2", "f_e = f_max", "f_e = 10 Hz fixe"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "En dessous de 2 × f_max, il apparaît un repliement de spectre (aliasing)." },
            { q: "Que signifie la modulation MLI (PWM en anglais) très utilisée sur Arduino et microcontrôleurs ?", correct: "Modulation de Largeur d'Impulsion", wrongs: ["Mémoire Locale Intégrée", "Mesure Linéaire d'Intensité", "Moteur à Liaison Induite"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "En faisant varier le rapport cyclique, la PWM pilote finement la luminosité d'une LED ou la vitesse d'un moteur." },
            { q: "Dans un système IoT (Internet des Objets), quel protocole léger à publication/abonnement (Publish/Subscribe) est le plus répandu ?", correct: "MQTT", wrongs: ["FTP", "POP3", "Telnet"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "MQTT utilise un broker central et consomme très peu de bande passante et d'énergie." },
            { q: "Quelle technologie radio longue portée et très basse consommation (LPWAN) est utilisée pour les capteurs IoT de villes intelligentes ?", correct: "LoRa / LoRaWAN", wrongs: ["Bluetooth audio classique", "HDMI", "Ethernet 10G"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "LoRa atteint plusieurs kilomètres de portée avec plusieurs années d'autonomie sur pile." },
            { q: "Quelle est la taille en bits d'une adresse MAC (couche liaison Ethernet / Wi-Fi) ?", correct: "48 bits (6 octets en hexadécimal)", wrongs: ["32 bits", "128 bits", "16 bits"], levels: ['1ere', 'terminale', 'bts1'], exp: "Exemple d'adresse MAC : 00:1A:2B:3C:4D:5E (6 octets = 48 bits)." },
            { q: "En logique combinatoire, quel théorème permet de simplifier NON(A ET B) en (NON A) OU (NON B) ?", correct: "le théorème de De Morgan", wrongs: ["le théorème de Thalès", "la loi de Kirchoff", "le théorème de Pythagore"], levels: ['1ere', 'terminale', 'bts1'], exp: "Lois de De Morgan : !(A·B) = !A + !B et !(A+B) = !A · !B." },
            { q: "Sur un microcontrôleur (ex : Arduino / ESP32), quelle fonction s'exécute UNE seule fois au démarrage pour configurer les broches ?", correct: "setup()", wrongs: ["loop()", "delay()", "analogRead()"], levels: ['2nde', '1ere', 'terminale'], exp: "setup() initialise les entrées/sorties et communications ; loop() tourne en boucle infinie." },
            { q: "Quel bus de communication série à 2 fils (SDA et SCL) permet de relier plusieurs capteurs à un microcontrôleur ?", correct: "le bus I2C", wrongs: ["le câble VGA", "le bus PCIe x16", "le port Jack 3,5 mm"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "I2C utilise une ligne de données (SDA) et une ligne d'horloge (SCL) avec adressage de chaque esclave." },
            { q: "Comment s'appelle le temps nécessaire à un signal numérique pour passer d'un échantillon au suivant (T_e = 1 / f_e) ?", correct: "la période d'échantillonnage", wrongs: ["la bande passante", "l'impédance caractéristique", "le quantum"], levels: ['1ere', 'terminale', 'bts1'], exp: "T_e est l'inverse de la fréquence d'échantillonnage f_e." },
            { q: "Qu'est-ce que le « quantum » q d'un CAN de pleine échelle V_ref sur N bits ?", correct: "le plus petit écart de tension mesurable : q = V_ref / 2^N", wrongs: ["la tension d'alimentation du secteur", "la consommation en watts du capteur", "la vitesse de transmission Ethernet"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Plus N est grand, plus le quantum q est petit et meilleure est la précision." },
            { q: "Quel langage de balisage léger est majoritairement utilisé pour échanger des données structurées entre capteurs IoT et API Web ?", correct: "JSON", wrongs: ["Assembleur x86", "CSS", "BMP"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "JSON (JavaScript Object Notation) est léger, lisible et natif dans tous les langages modernes." },
            { q: "Quel bus série synchrone rapide à 4 fils (MOSI, MISO, SCK, CS/SS) est utilisé pour les écrans OLED ou cartes SD sur microcontrôleur ?", correct: "le bus SPI", wrongs: ["le bus VGA", "le protocole SMTP", "le port PS/2"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "SPI (Serial Peripheral Interface) fonctionne en full-duplex avec une sélection par broche CS (Chip Select)." },
            { q: "Quel bus différentiel robuste très répandu dans l'automobile permet aux calculateurs (ABS, moteur, tableau de bord) de communiquer ?", correct: "le bus CAN (Controller Area Network)", wrongs: ["le bus HDMI", "le protocole POP3", "le câble optique TOSLINK"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le bus CAN résiste très bien aux perturbations électromagnétiques grâce à sa paire différentielle CAN_H / CAN_L." },
            { q: "En codage numérique d'une image RVB (RGB) en 24 bits par pixel, combien de bits codent chaque composante (Rouge, Vert, Bleu) ?", correct: "8 bits par composante (valeurs de 0 à 255)", wrongs: ["24 bits par composante", "2 bits par composante", "16 bits par composante"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "3 canaux × 8 bits = 24 bits/pixel, soit 256³ ≈ 16,7 millions de couleurs possibles." },
            { q: "Quelle est la principale différence entre un format d'image/audio « sans perte » (PNG, FLAC) et « avec perte » (JPEG, MP3) ?", correct: "sans perte restitue exactement les données d'origine ; avec perte supprime des détails peu perceptibles pour réduire fortement la taille", wrongs: ["avec perte double toujours la taille du fichier", "sans perte ne fonctionne que sur téléphone", "il n'existe aucune différence de compression"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La compression avec perte (JPEG/MP3) sacrifie une fraction d'information imperceptible pour gagner de l'espace." },
            { q: "Dans une architecture Web REST, quelle méthode HTTP sert conventionnellement à créer une nouvelle ressource sur le serveur ?", correct: "POST", wrongs: ["GET", "DELETE", "HEAD"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "CRUD en REST : GET (lire), POST (créer), PUT/PATCH (modifier), DELETE (supprimer)." },
            { q: "En logique séquentielle, à quoi sert un graphe d'états (diagramme d'états-transitions / GRAFCET) ?", correct: "décrire les états successifs d'un système automatisé et les conditions (transitions) pour passer d'un état à l'autre", wrongs: ["calculer la masse d'une poutre", "dessiner le logo d'une application", "chiffrer une base de données"], levels: ['1ere', 'terminale', 'bts1'], exp: "Il formalise de façon rigoureuse le comportement séquentiel d'un automate ou microcontrôleur." }
        ],

        cybersecurite: [
            // Bac Pro CIEL, BTS CIEL, Spé NSI
            { q: "Que signifie l'acronyme OWASP en sécurité applicative Web ?", correct: "Open Worldwide Application Security Project (référentiel des failles Web critiques)", wrongs: ["Official Windows Antivirus Security Patch", "Online Wi-Fi Access Standard Protocol", "Open Wireless Architecture System Plan"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'OWASP publie notamment le célèbre classement 'OWASP Top 10' des vulnérabilités Web." },
            { q: "Quelle est la meilleure défense côté code contre les injections SQL ?", correct: "utiliser des requêtes préparées (paramétrées)", wrongs: ["cacher le nom des tables dans le HTML", "désactiver le pare-feu", "stocker les mots de passe en clair"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les requêtes préparées séparent strictement le code SQL des données saisies." },
            { q: "Comment doit-on stocker les mots de passe des utilisateurs dans une base de données sécurisée ?", correct: "hachés avec un sel unique (salt) via un algorithme lent adapté (Argon2, bcrypt)", wrongs: ["en texte clair dans un fichier CSV", "encodés simplement en Base64", "chiffrés avec le code de César"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un hachage salé (Argon2id/bcrypt) empêche les attaques par tables arc-en-ciel et ralentit la force brute." },
            { q: "Quel équipement réseau filtre le trafic entrant et sortant selon des règles (IP, ports, protocoles) ?", correct: "un pare-feu (firewall)", wrongs: ["un répéteur Wi-Fi", "un câble croisé", "un disque dur NAS"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le pare-feu applique une politique de filtrage (liste blanche ou liste noire)." },
            { q: "Que désigne le principe du « moindre privilège » en cybersécurité ?", correct: "n'accorder à chaque utilisateur ou programme que les droits strictement nécessaires à sa tâche", wrongs: ["donner les droits administrateur à tous les employés", "supprimer tous les comptes utilisateurs", "n'utiliser aucun mot de passe"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Il limite considérablement l'impact en cas de compromission d'un compte." },
            { q: "Qu'est-ce qu'une vulnérabilité « Zero-Day » ?", correct: "une faille de sécurité inconnue de l'éditeur et ne disposant pas encore de correctif", wrongs: ["une faille âgée de plus de 10 ans", "un virus qui s'efface à minuit", "une mise à jour officielle Windows"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'éditeur a eu 'zéro jour' pour corriger la faille avant son exploitation." },
            { q: "Que permet un VPN (Virtual Private Network) lors d'une connexion à distance ?", correct: "créer un tunnel chiffré sécurisé à travers un réseau public (Internet)", wrongs: ["augmenter la vitesse physique de la fibre", "remplacer le processeur du PC", "supprimer l'usage d'un système d'exploitation"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Un VPN assure la confidentialité et l'authenticité des échanges sur un réseau non fiable." },
            { q: "Dans une architecture réseau sécurisée, à quoi sert une DMZ (Zone Démilitarisée) ?", correct: "isoler les serveurs exposés à Internet (Web, Mail) du réseau interne (LAN)", wrongs: ["connecter toutes les imprimantes directement à Internet", "désactiver le chiffrement TLS", "partager les mots de passe Wi-Fi"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Si un serveur en DMZ est compromis, le réseau local interne reste protégé par un pare-feu." },
            { q: "Quel est le rôle d'un certificat numérique X.509 délivré par une Autorité de Certification (CA) en HTTPS ?", correct: "authentifier l'identité du serveur et transmettre sa clé publique de façon fiable", wrongs: ["augmenter le stockage du navigateur", "compresser les images PNG", "remplacer le protocole DNS"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La PKI (Infrastructure à Clés Publiques) protège contre les attaques Man-in-the-Middle." },
            { q: "Que signifie l'approche de sécurité « Zero Trust » ?", correct: "ne jamais accorder de confiance implicite, vérifier systématiquement chaque accès même en interne", wrongs: ["faire totalement confiance au réseau local d'entreprise", "ne plus utiliser de certificats", "couper totalement l'accès Internet"], levels: ['terminale', 'bts1', 'bts2'], exp: "« Never trust, always verify » : authentification, micro-segmentation et contrôle continu." },
            { q: "Quelle est la différence entre chiffrement symétrique (AES) et asymétrique (RSA) ?", correct: "symétrique = 1 même clé secrète partagée ; asymétrique = paire clé publique / clé privée", wrongs: ["symétrique est impossible sur ordinateur", "asymétrique n'utilise aucune clé", "symétrique sert uniquement à compresser des vidéos"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "En pratique (TLS), on utilise l'asymétrique pour échanger la clé de session, puis AES pour la vitesse." },
            { q: "Qu'est-ce qu'une attaque de l'homme du milieu (MITM — Man-in-the-Middle) ?", correct: "un attaquant s'intercale secrètement entre deux communicants pour écouter ou modifier les échanges", wrongs: ["une panne électrique du routeur", "un téléchargement trop lent", "une sauvegarde sur disque externe"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'usage de HTTPS/TLS et de SSH empêche l'écoute ou la falsification par un MITM." },
            { q: "Quelle est la différence entre un IDS (Système de Détection d'Intrusion) et un IPS (Système de Prévention d'Intrusion) ?", correct: "l'IDS détecte et alerte passivement ; l'IPS est placé en coupure et peut bloquer automatiquement le trafic malveillant", wrongs: ["l'IDS bloque physiquement les câbles", "l'IPS ne fonctionne que sans réseau", "les deux sont uniquement des antivirus locaux"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "IDS = Intrusion Detection System (sonde) ; IPS = Intrusion Prevention System (blocage actif)." },
            { q: "En sécurité Web (OWASP), que protège un jeton anti-CSRF (Cross-Site Request Forgery) ?", correct: "il empêche un site malveillant de déclencher des actions à l'insu d'un utilisateur déjà authentifié", wrongs: ["il accélère l'affichage des vidéos 4K", "il compresse les feuilles CSS", "il remplace le protocole DNS"], levels: ['terminale', 'bts1', 'bts2'], exp: "Le token CSRF prouve que la requête provient bien du formulaire légitime de l'application." },
            { q: "Que signifie l'acronyme SIEM dans un centre opérationnel de cybersécurité (SOC) ?", correct: "Security Information and Event Management (collecte et corrélation centralisée des journaux/logs de sécurité)", wrongs: ["System Internet Email Manager", "Simple Interface Ethernet Module", "Server Image Encryption Mode"], levels: ['terminale', 'bts1', 'bts2'], exp: "Un SIEM agrège les logs des serveurs, pare-feux et postes pour repérer des attaques corrélées." },
            { q: "Pourquoi la norme Wi-Fi WPA3 est-elle nettement plus sûre que l'ancien WEP ?", correct: "WPA3 utilise un échange de clés moderne (SAE) et un chiffrement fort résistant aux attaques hors-ligne par dictionnaire", wrongs: ["WPA3 ne demande aucun mot de passe", "WEP n'a jamais existé en Wi-Fi", "WPA3 désactive le chiffrement pour être plus rapide"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "WEP est cassable en quelques minutes ; WPA3 (SAE + AES-GCMP) corrige aussi les faiblesses de WPA2-PSK." },
            { q: "Quel est l'objectif d'un test d'intrusion (pentest) réalisé avec l'autorisation écrite d'une entreprise ?", correct: "simuler une cyberattaque encadrée pour découvrir et corriger les vulnérabilités avant des attaquants réels", wrongs: ["détruire définitivement la base de données", "vendre les identifiants sur Internet", "remplacer totalement la sauvegarde 3-2-1"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le pentest (boîte noire, grise ou blanche) aboutit à un rapport de remédiation priorisé." },
            { q: "En sécurité des comptes, qu'est-ce qu'une attaque par « Credential Stuffing » ?", correct: "réutiliser automatiquement des couples e-mail/mot de passe volés sur un site compromis pour tenter de se connecter sur d'autres services", wrongs: ["envoyer un virus par clé USB", "couper la fibre optique d'un datacenter", "chiffrer un disque dur avec BitLocker"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "D'où l'importance absolue d'un mot de passe unique par service (via un gestionnaire) + MFA." }
        ],

        reseaux: [
            // Bac Pro CIEL, BTS CIEL, Spé NSI
            { q: "À quoi sert le protocole DHCP dans un réseau local ?", correct: "attribuer automatiquement une configuration IP (adresse IP, masque, passerelle, DNS) aux hôtes", wrongs: ["chiffrer les pages web", "envoyer des courriels", "traduire un nom de domaine en IP"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Le cycle DORA (Discover, Offer, Request, Acknowledge) configure automatiquement les machines." },
            { q: "Quelle est la différence majeure entre les protocoles de transport TCP et UDP ?", correct: "TCP est connecté et fiable (accusés de réception), UDP est non connecté et plus rapide", wrongs: ["UDP est plus lent et plus fiable que TCP", "TCP fonctionne uniquement en Wi-Fi", "UDP ne possède pas de numéros de ports"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "TCP garantit l'ordre et la livraison (Web, SSH) ; UDP privilégie la faible latence (DNS, VoIP, streaming)." },
            { q: "À quoi sert un VLAN (Virtual Local Area Network) sur un switch administrable ?", correct: "segmenter logiquement un réseau local en plusieurs domaines de diffusion isolés", wrongs: ["augmenter la tension électrique des câbles", "remplacer le système d'exploitation Windows", "convertir du Wi-Fi en Bluetooth"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les VLAN (norme IEEE 802.1Q) améliorent la sécurité et limitent le broadcast." },
            { q: "Quelle est la taille d'une adresse IPv4 et d'une adresse IPv6 respectivement ?", correct: "32 bits pour IPv4 et 128 bits pour IPv6", wrongs: ["16 bits pour IPv4 et 32 bits pour IPv6", "64 bits pour IPv4 et 64 bits pour IPv6", "8 bits pour IPv4 et 48 bits pour IPv6"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "IPv6 (128 bits) résout la pénurie d'adresses IPv4 (~4,3 milliards d'adresses)." },
            { q: "Parmi ces adresses IPv4, laquelle appartient à une plage privée (RFC 1918, non routable sur Internet) ?", correct: "192.168.1.25", wrongs: ["8.8.8.8", "1.1.1.1", "172.32.0.1"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Plages privées RFC 1918 : 10.0.0.0/8, 172.16.0.0/12 (172.16..31) et 192.168.0.0/16." },
            { q: "À quoi sert le mécanisme NAT (Network Address Translation) sur une box ou un routeur ?", correct: "traduire des adresses IP privées internes en une adresse IP publique pour accéder à Internet", wrongs: ["détecter les virus sur un disque dur", "sauvegarder les fichiers sur le Cloud", "attribuer des adresses MAC aléatoires"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le NAT/PAT permet à plusieurs appareils d'un LAN de partager une même IP publique." },
            { q: "Quel protocole permet de découvrir l'adresse MAC correspondant à une adresse IPv4 sur un même réseau local ?", correct: "ARP (Address Resolution Protocol)", wrongs: ["ICMP", "SMTP", "NTP"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "ARP maintient une table de correspondance IP ↔ MAC sur le segment local." },
            { q: "Quelle est la fonction principale d'un routeur (couche 3 du modèle OSI) ?", correct: "interconnecter des réseaux différents et acheminer les paquets IP grâce à sa table de routage", wrongs: ["amplifier uniquement un signal analogique", "remplacer le processeur du serveur", "stocker les bases de données SQL"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le switch commute des trames (couche 2) dans un LAN ; le routeur route des paquets (couche 3) entre réseaux." },
            { q: "Quelle est l'adresse de boucle locale (loopback) standard en IPv4 pour tester sa propre pile réseau ?", correct: "127.0.0.1", wrongs: ["192.168.0.1", "255.255.255.255", "0.0.0.0"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "127.0.0.1 (localhost) renvoie les paquets vers la machine elle-même." },
            { q: "En administration Linux, dans quel répertoire se trouvent les fichiers de configuration système (ex : réseau, SSH, passwd) ?", correct: "/etc", wrongs: ["/tmp", "/home", "/bin"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "/etc contient la configuration globale du système Linux." },
            { q: "En virtualisation / conteneurisation (BTS CIEL), quelle est la principale différence entre un conteneur (Docker) et une VM ?", correct: "le conteneur partage le noyau de l'OS hôte et est donc bien plus léger et rapide qu'une VM", wrongs: ["une VM ne peut exécuter aucun système d'exploitation", "un conteneur nécessite un serveur physique dédié par appli", "il n'y a aucune différence technique"], levels: ['terminale', 'bts1', 'bts2'], exp: "Docker isole les processus dans l'espace utilisateur en partageant le noyau Linux." },
            { q: "Que signifie l'établissement de connexion TCP appelé « Three-Way Handshake » ?", correct: "l'échange en 3 étapes : SYN → SYN-ACK → ACK", wrongs: ["l'envoi de 3 mots de passe successifs", "la connexion simultanée à 3 routeurs", "un téléchargement en 3 fichiers"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Cette poignée de main synchronise les numéros de séquence avant le transfert des données." },
            { q: "Quel protocole de couche 2 empêche les boucles de commutation (tempêtes de broadcast) entre plusieurs switches reliés de façon redondante ?", correct: "STP (Spanning Tree Protocol)", wrongs: ["DNS", "HTTP", "DHCP"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "STP (IEEE 802.1D / RSTP) place automatiquement les liens redondants en blocage tout en assurant la bascule en cas de panne." },
            { q: "En administration Linux, quel outil système (`systemctl`) permet de démarrer, arrêter ou vérifier l'état d'un service (ex : ssh, nginx) ?", correct: "systemd (via la commande systemctl)", wrongs: ["fdisk", "ping", "tar"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Exemple : `systemctl status ssh` ou `sudo systemctl restart nginx`." },
            { q: "Dans le protocole DNS, quel type d'enregistrement associe un nom de domaine à une adresse IPv4 ?", correct: "un enregistrement A (et AAAA pour IPv6)", wrongs: ["un enregistrement MX", "un enregistrement TXT", "un enregistrement PTR uniquement"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "A = IPv4, AAAA = IPv6, CNAME = alias, MX = serveur mail." },
            { q: "À quoi sert un lien « Trunk » (norme 802.1Q) entre deux switches ou entre un switch et un routeur ?", correct: "transporter simultanément le trafic étiqueté (taggé) de plusieurs VLAN sur un seul câble physique", wrongs: ["fournir uniquement du courant 230 V", "bloquer tous les paquets IP", "convertir une adresse IP en nom DNS"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le port Access appartient à 1 VLAN ; le port Trunk véhicule plusieurs VLAN avec balises 802.1Q." },
            { q: "Quel protocole de routage dynamique à état de liens (IGP) utilise l'algorithme de Dijkstra pour calculer le plus court chemin dans un réseau d'entreprise ?", correct: "OSPF", wrongs: ["ARP", "SMTP", "POP3"], levels: ['terminale', 'bts1', 'bts2'], exp: "OSPF (Open Shortest Path First) est largement déployé dans les réseaux d'entreprise ; BGP gère le routage inter-domaines sur Internet." },
            { q: "En stockage serveur, quel niveau RAID réalise une mise en miroir complète (duplication) des données sur deux disques pour la tolérance aux pannes ?", correct: "RAID 1 (mirroring)", wrongs: ["RAID 0 (striping sans redondance)", "FAT32", "VLAN 1"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "En RAID 1, si un disque tombe en panne, les données restent intactes sur le second (attention : le RAID ne remplace pas une sauvegarde)." }
        ],

        electronique: [
            // Bac Pro CIEL, BTS CIEL, STI2D
            { q: "Quel composant électronique ne laisse passer le courant électrique que dans un seul sens (de l'anode vers la cathode) ?", correct: "une diode", wrongs: ["une résistance", "un fil de cuivre", "un condensateur parfait"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Une diode polarisée en direct conduit au-delà de sa tension de seuil (~0,7 V pour le silicium)." },
            { q: "Quelle est la fonction principale d'un condensateur dans un circuit électronique ?", correct: "emmagasiner de l'énergie électrostatique (filtrage, découplage, temporisation)", wrongs: ["transformer un courant continu en lumière", "mesurer une distance par laser", "remplacer un microcontrôleur"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Sa capacité C s'exprime en farads (F) : i = C · du/dt." },
            { q: "Dans un circuit, quel rôle peut jouer un transistor (bipolaire ou MOSFET) ?", correct: "interrupteur commandé (commutation) ou amplificateur de signal", wrongs: ["uniquement stocker des fichiers PDF", "mesurer la pression atmosphérique", "remplacer une batterie lithium"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le transistor est la brique fondamentale de toute l'électronique numérique et de puissance." },
            { q: "Que stipule la loi des nœuds (1ère loi de Kirchhoff) ?", correct: "la somme des intensités qui arrivent à un nœud est égale à la somme des intensités qui en repartent", wrongs: ["la tension est toujours nulle dans un circuit", "les résistances en parallèle s'additionnent", "le courant circule sans générateur"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Conservation de la charge électrique : ΣI_entrants = ΣI_sortants." },
            { q: "Que stipule la loi des mailles (2ème loi de Kirchhoff) ?", correct: "la somme algébrique des tensions le long d'une boucle fermée est nulle", wrongs: ["toutes les résistances d'une maille sont égales", "la puissance est toujours égale à 1 W", "le courant est nul dans une maille"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "En parcourant une maille fermée, la somme des tensions orientées vaut 0 V." },
            { q: "Quel appareil de mesure permet de visualiser l'évolution d'une tension électrique au cours du temps u(t) ?", correct: "un oscilloscope", wrongs: ["un ohmmètre", "un luxmètre", "une pince coupante"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'oscilloscope affiche amplitude, période, fréquence et forme d'onde (sinus, carré, PWM)." },
            { q: "Quelle est l'unité de mesure de l'inductance L d'une bobine ?", correct: "le henry (H)", wrongs: ["le farad (F)", "l'ohm (Ω)", "le siemens (S)"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Résistance → Ω, Capacité → F, Inductance → H." },
            { q: "Dans un circuit imprimé (PCB), que désigne le sigle CMS (SMD en anglais) ?", correct: "Composant Monté en Surface (soudé directement sur les pastilles sans perçage)", wrongs: ["Courant Moyen Sinus", "Carte Mémoire Statique", "Câble Modulaire blindé"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les CMS permettent la miniaturisation et l'assemblage automatisé des cartes électroniques." },
            { q: "Quel bus série asynchrone (TX / RX + GND) est très utilisé pour le débogage sur microcontrôleurs (Arduino, STM32, Raspberry Pi) ?", correct: "UART (liaison série RS232 / TTL)", wrongs: ["VGA", "DisplayPort", "SATA"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "TX (Transmit) d'un appareil se relie au RX (Receive) de l'autre, avec masse commune." },
            { q: "Quelle est la fonction d'une résistance de « pull-up » (tirage au haut) sur une entrée numérique d'un microcontrôleur ?", correct: "fixer un niveau logique défini (HIGH / 1) lorsque le bouton-poussoir est ouvert afin d'éviter un état flottant", wrongs: ["augmenter la tension au-delà de 230 V", "court-circuiter la batterie", "amplifier un signal radio FM"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Sans pull-up ou pull-down, une broche non reliée capte les parasites électromagnétiques." },
            { q: "Que réalise un pont de diodes (pont de Graetz) dans une alimentation électrique ?", correct: "le redressement double alternance d'une tension alternative en tension unidirectionnelle", wrongs: ["la transformation d'un signal continu en audio", "la mesure de la température du transformateur", "le filtrage des adresses IP"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le pont de Graetz redresse le courant alternatif avant le lissage par condensateur et la régulation." },
            { q: "Quelle est la relation entre la fréquence f (en Hz) et la période T (en secondes) d'un signal périodique ?", correct: "f = 1 / T", wrongs: ["f = T²", "f = 2 × T", "f = T + 1"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Par exemple, le secteur européen à 50 Hz a une période T = 1/50 = 0,02 s (20 ms)." },
            { q: "À quoi sert une diode de « roue libre » placée en antiparallèle aux bornes d'une bobine ou d'un relais commandé par un transistor ?", correct: "protéger le transistor contre les surtensions de rupture créées par la bobine à l'ouverture", wrongs: ["inverser le sens de rotation d'une LED", "augmenter la résistance du câble", "mesurer la fréquence du secteur"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Lors de l'ouverture du circuit, la bobine tend à maintenir le courant : la diode offre un chemin sûr de décharge." },
            { q: "Dans un filtre passe-bas RC du premier ordre, quelle est la formule de la fréquence de coupure f_c à −3 dB ?", correct: "f_c = 1 / (2π · R · C)", wrongs: ["f_c = R × C", "f_c = 2π · R · C", "f_c = R / C"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Avec τ = R·C la constante de temps, la pulsation de coupure vaut ω_c = 1/τ donc f_c = 1/(2πRC)." },
            { q: "À quoi sert un amplificateur opérationnel (AOP) monté en « suiveur de tension » (V_s = V_e) ?", correct: "adapter les impédances entre un capteur et la suite du circuit sans prélever de courant", wrongs: ["multiplier la tension par 1000", "redresser une tension alternative", "stocker un programme en mémoire Flash"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le montage suiveur a une impédance d'entrée très grande et une impédance de sortie très faible." },
            { q: "Quelle est la différence principale entre un régulateur de tension linéaire (ex : 7805) et un convertisseur à découpage (Buck / DC-DC) ?", correct: "le convertisseur à découpage (Buck) a un bien meilleur rendement (≈ 85–95 %) et chauffe beaucoup moins qu'un régulateur linéaire", wrongs: ["le régulateur linéaire ne peut pas abaisser une tension", "le convertisseur Buck ne fonctionne qu'en 230 V AC", "le régulateur linéaire a un rendement de 100 %"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un régulateur linéaire dissipe l'excédent de tension en chaleur : P = (V_in − V_out) × I." },
            { q: "Que permet un optocoupleur (photocoupleur) entre une carte microcontrôleur et un circuit de puissance ?", correct: "assurer une isolation galvanique en transmettant le signal par lumière (LED + phototransistor)", wrongs: ["augmenter la fréquence du processeur", "connecter un câble Ethernet fibre", "stocker l'heure système sans pile"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'isolation galvanique protège l'électronique de commande basse tension contre les parasites et surtensions." },
            { q: "À quoi sert un condensateur de « découplage » (souvent 100 nF) placé au plus près des broches d'alimentation d'un circuit intégré ?", correct: "absorber les appels de courant rapides et filtrer les parasites haute fréquence sur l'alimentation", wrongs: ["bloquer totalement la tension continue 5 V", "servir d'antenne Wi-Fi principale", "remplacer le quartz d'horloge"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "C'est une règle d'or du routage PCB pour garantir la stabilité d'un microcontrôleur." }
        ],

        stss: [
            // ST2S : Sciences et Techniques Sanitaires et Sociales
            { q: "Comment l'Organisation Mondiale de la Santé (OMS) définit-elle la santé depuis 1946 ?", correct: "un état complet de bien-être physique, mental et social (et pas seulement l'absence de maladie)", wrongs: ["uniquement l'absence de fièvre ou d'infection", "la capacité à courir un marathon", "le fait de ne jamais consulter un médecin"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La définition de l'OMS est globale : physique, psychique et sociale." },
            { q: "Qu'appelle-t-on un « déterminant de santé » en STSS ?", correct: "un facteur individuel, comportemental, environnemental ou social qui influence l'état de santé", wrongs: ["un médicament remboursé à 100 %", "un diplôme de médecin", "une salle d'opération"], levels: ['1ere', 'terminale', 'bts1'], exp: "Exemples : alimentation, tabac, logement, niveau de revenu, accès aux soins, pollution." },
            { q: "En épidémiologie, quelle est la différence entre prévalence et incidence d'une maladie ?", correct: "prévalence = total des cas existants à un moment ; incidence = nouveaux cas sur une période donnée", wrongs: ["incidence = nombre de médecins ; prévalence = coût des soins", "les deux termes sont strictement synonymes", "prévalence concerne uniquement les maladies rares"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'incidence mesure la vitesse d'apparition ; la prévalence mesure l'ampleur totale dans la population." },
            { q: "En quelle année la Sécurité sociale française a-t-elle été créée par les ordonnances d'après-guerre ?", correct: "1945", wrongs: ["1905", "1958", "1981"], levels: ['1ere', 'terminale', 'bts1'], exp: "Créée en octobre 1945 sur le principe de solidarité nationale (programme du CNR)." },
            { q: "Quels sont les grands risques couverts par les branches de la Sécurité sociale en France ?", correct: "Maladie, Accidents du travail/Maladies pro, Famille, Vieillesse (retraite) et Autonomie", wrongs: ["Uniquement les accidents de voiture", "Uniquement les frais scolaires", "Uniquement l'assurance habitation"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Une 5ème branche dédiée à l'Autonomie (dépendance, handicap) a été créée en 2020." },
            { q: "Quelle est la différence entre prévention primaire, secondaire et tertiaire ?", correct: "primaire = éviter l'apparition ; secondaire = dépister tôt ; tertiaire = limiter les complications et rechutes", wrongs: ["primaire = à l'école primaire uniquement", "secondaire = réservée aux hôpitaux privés", "tertiaire = vaccination infantile"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Vaccination = primaire ; dépistage cancer = secondaire ; rééducation post-AVC = tertiaire." },
            { q: "Quel organisme public pilote et organise la politique de santé publique au niveau régional en France ?", correct: "l'ARS (Agence Régionale de Santé)", wrongs: ["la BCE", "l'ARCOM", "l'INSEE"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les ARS coordonnent l'offre de soins (hôpitaux, médecine de ville) et la prévention en région." },
            { q: "Que signifie la notion de « démocratie sanitaire » consacrée par la loi Kouchner du 4 mars 2002 ?", correct: "l'association des usagers et patients aux décisions de santé et la reconnaissance de leurs droits", wrongs: ["l'élection des médecins au suffrage universel", "la suppression des dossiers médicaux", "le vote annuel du tarif des médicaments par les citoyens"], levels: ['terminale', 'bts1', 'bts2'], exp: "Elle affirme le consentement libre et éclairé, l'accès au dossier médical et la représentation des usagers." },
            { q: "Qu'est-ce qu'une « inégalité sociale de santé » ?", correct: "un écart systématique d'état de santé ou d'espérance de vie lié à la catégorie socioprofessionnelle ou aux revenus", wrongs: ["une différence génétique rare isolée", "un écart lié uniquement au climat", "le prix différent des lunettes de marque"], levels: ['1ere', 'terminale', 'bts1'], exp: "Les cadres ont en moyenne une espérance de vie supérieure à celle des ouvriers en raison des conditions de travail et d'accès aux soins." },
            { q: "Quel dispositif de solidarité nationale assure un revenu minimum aux personnes sans ressources (ou très faibles) en France ?", correct: "le RSA (Revenu de Solidarité Active)", wrongs: ["la TVA", "le PIB", "l'ISF"], levels: ['1ere', 'terminale', 'bts1'], exp: "Le RSA relève de l'aide sociale (logique d'assistance / solidarité nationale)." },
            { q: "En méthodologie STSS, quelle est la différence entre une enquête quantitative et une enquête qualitative ?", correct: "quantitative = données chiffrées sur un grand échantillon ; qualitative = entretiens approfondis pour comprendre les comportements", wrongs: ["quantitative utilise uniquement des dessins", "qualitative interdit toute question orale", "elles donnent toujours exactement les mêmes tableaux"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Questionnaire fermé (quantitatif) vs entretien semi-directif / observation (qualitatif)." },
            { q: "Quel établissement médico-social accueille des personnes âgées dépendantes nécessitant un accompagnement médicalisé ?", correct: "un EHPAD", wrongs: ["une PMI", "un CCAS", "une CAF"], levels: ['1ere', 'terminale', 'bts1'], exp: "EHPAD = Établissement d'Hébergement pour Personnes Âgées Dépendantes." },
            { q: "Quel service départemental assure le suivi médical gratuit des femmes enceintes et des enfants de moins de 6 ans ?", correct: "la PMI (Protection Maternelle et Infantile)", wrongs: ["la CPAM seule", "la Haute Autorité de Santé", "l'EHPAD"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La PMI réalise consultations prénatales, bilans en école maternelle et agrément des assistantes maternelles." },
            { q: "Quel organisme communal accompagne les habitants en difficulté sociale (aides d'urgence, domiciliation, soutien aux seniors) ?", correct: "le CCAS (Centre Communal d'Action Sociale)", wrongs: ["l'OMS", "la Cour de cassation", "l'ANSSI"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Présidé par le maire, le CCAS est l'acteur de proximité de l'action sociale communale." },
            { q: "Quelle est la mission principale de la Haute Autorité de Santé (HAS) en France ?", correct: "évaluer scientifiquement les médicaments/actes médicaux, certifier les hôpitaux et publier des recommandations de bonnes pratiques", wrongs: ["verser les allocations familiales", "construire les autoroutes", "recruter les enseignants du lycée"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La HAS est une autorité publique indépendante garante de la qualité des soins." },
            { q: "Qu'appelle-t-on le « reste à charge » (ticket modérateur) pour un assuré social lors d'une consultation médicale ?", correct: "la part des frais de santé non remboursée par l'Assurance maladie obligatoire (souvent prise en charge par la mutuelle)", wrongs: ["le salaire mensuel du médecin", "le coût d'une ambulance privée uniquement", "une amende en cas d'oubli de carte Vitale"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La complémentaire santé (mutuelle) ou la C2S couvre tout ou partie du ticket modérateur." },
            { q: "Quelle agence nationale assure la veille sanitaire, la surveillance épidémiologique et les campagnes de prévention (tabac, alcool) ?", correct: "Santé publique France", wrongs: ["la Banque de France", "l'ARCOM", "l'ADEME"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Santé publique France pilote la surveillance des épidémies et la promotion de la santé." },
            { q: "Que signifie la « veille sanitaire » dans la gestion d'une crise épidémique ?", correct: "le recueil continu et l'analyse de signaux pour détecter précocement toute menace pour la santé de la population", wrongs: ["la fermeture nocturne des pharmacies", "le nettoyage des salles d'attente", "le stockage des dossiers papier"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La veille sanitaire permet d'alerter et de déclencher rapidement des mesures de protection." },
            { q: "Quel guichet unique départemental évalue les besoins et attribue les droits (AAH, PCH, RQTH) aux personnes en situation de handicap ?", correct: "la MDPH (Maison Départementale des Personnes Handicapées)", wrongs: ["la CAF seule", "la CNIL", "le Conseil d'État"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Créée par la loi handicap du 11 février 2005, la MDPH accompagne les personnes handicapées et leurs familles." },
            { q: "Que signifie le « principe de précaution » inscrit dans la Charte de l'environnement et appliqué en santé environnementale ?", correct: "agir préventivement face à un risque grave et irréversible même en l'absence de certitude scientifique absolue", wrongs: ["attendre que la catastrophe arrive avant de réagir", "interdire toute recherche médicale", "ne jamais informer le public d'un risque"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Il guide la gestion des risques sanitaires et environnementaux émergents." },
            { q: "Quelle est la différence entre la logique d'assurance sociale et la logique d'assistance sociale ?", correct: "l'assurance repose sur des cotisations préalables ; l'assistance repose sur la solidarité nationale sous conditions de ressources (ex : RSA)", wrongs: ["l'assurance est toujours gratuite et sans cotisation", "l'assistance est réservée aux salariés cadres", "les deux financements sont identiques"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La protection sociale française articule assurance (modèle bismarckien) et assistance/universalité (modèle beveridgien)." },
            { q: "En méthodologie de projet sanitaire et social, quelle est la première étape avant de définir des objectifs et des actions ?", correct: "le diagnostic (identification des besoins et des problèmes du public cible)", wrongs: ["l'évaluation finale immédiate", "la clôture budgétaire", "la publication de l'affiche publicitaire"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un projet suit le cycle : Diagnostic → Conception/Objectifs → Mise en œuvre → Évaluation." }
        ],

        biotech: [
            // STL (Biotechnologies & SPCL) & Bac Pro ASSP
            { q: "En microbiologie, à quoi sert la coloration de Gram sur une lame de bactéries ?", correct: "distinguer les bactéries Gram+ (violettes) des Gram− (roses) selon la structure de leur paroi", wrongs: ["mesurer la température de l'étuve", "stériliser une boîte de Pétri", "doser le glucose sanguin"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Les Gram+ retiennent le violet de gentiane grâce à leur épaisse couche de peptidoglycane." },
            { q: "Quelle technique de biologie moléculaire permet d'amplifier rapidement un fragment précis d'ADN en millions de copies ?", correct: "la PCR (Polymerase Chain Reaction)", wrongs: ["la décantation simple", "la distillation fractionnée", "la centrifugation lente"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La PCR alterne dénaturation, hybridation d'amorces et élongation grâce à la Taq polymérase." },
            { q: "En biochimie, quelle loi relie l'absorbance A d'une solution colorée à sa concentration C (A = ε · l · C) ?", correct: "la loi de Beer-Lambert", wrongs: ["la loi d'Ohm", "la loi de gravitation", "la loi de Boyle-Mariotte"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La spectrophotométrie utilise la loi de Beer-Lambert pour réaliser des dosages par étalonnage." },
            { q: "Quel appareil de laboratoire stérilise le matériel et les milieux de culture par vapeur d'eau sous pression (121 °C, 15-20 min) ?", correct: "un autoclave", wrongs: ["un spectrophotomètre", "un pH-mètre", "un vortex"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'autoclave détruit tous les micro-organismes, y compris les spores bactériennes." },
            { q: "Quelle technique sépare des fragments d'ADN ou des protéines selon leur taille sous l'effet d'un champ électrique ?", correct: "l'électrophorèse sur gel", wrongs: ["la filtration sur papier", "la sublimation", "la titration pH-métrique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les fragments les plus petits migrent plus vite à travers les mailles du gel d'agarose." },
            { q: "À quoi sert un poste de sécurité microbiologique (PSM) ou un bec Bunsen en laboratoire STL ?", correct: "travailler en zone stérile (asepsie) pour éviter la contamination des cultures et protéger le manipulateur", wrongs: ["chauffer le déjeuner du laboratoire", "mesurer la masse molaire", "refroidir les échantillons à −80 °C"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'asepsie garantit la pureté des souches microbiennes et la sécurité biologique." },
            { q: "Quelle est la fonction d'une enzyme biologique dans une réaction biochimique ?", correct: "catalyser (accélérer) spécifiquement une réaction sans être consommée", wrongs: ["détruire définitivement l'ADN cellulaire", "bloquer toute réaction métabolique", "servir uniquement de colorant"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Une enzyme abaisse l'énergie d'activation en se liant à son substrat via son site actif." },
            { q: "Quel réactif met classiquement en évidence la présence d'amidon (glucide complexe) par une coloration bleu-noir ?", correct: "le lugol (eau iodée)", wrongs: ["la soude diluée", "le bleu de méthylène seul", "l'éthanol pur"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'iode s'insère dans l'hélice d'amylose de l'amidon, produisant une teinte bleu-violacé caractéristique." },
            { q: "Que signifie un milieu de culture « sélectif » en microbiologie ?", correct: "il contient des inhibiteurs empêchant la croissance de certains germes pour favoriser les bactéries recherchées", wrongs: ["il ne contient aucun nutriment", "il tue toutes les bactéries sans exception", "il s'utilise uniquement à −20 °C"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Exemples : gélose Chapman (haute salinité pour Staphylococcus) ou MacConkey (Gram−)." },
            { q: "En immunologie / diagnostic, quel test utilise des anticorps couplés à une enzyme pour doser un antigène ?", correct: "le test ELISA", wrongs: ["le test de flamme", "le test de Mohr", "le test d'inertie"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "ELISA = Enzyme-Linked Immunosorbent Assay, très utilisé en biologie médicale." },
            { q: "Quel instrument de précision permet de prélever de très petits volumes liquides (de 1 µL à 1000 µL) ?", correct: "une micropipette à piston", wrongs: ["un bécher gradué de 500 mL", "un mortier en porcelaine", "une pissette d'eau"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La micropipette équipée de cônes stériles jetables est l'outil de base en biotechnologies." },
            { q: "En hygiène et ASSP, quelle est la différence entre un antiseptique et un désinfectant ?", correct: "l'antiseptique s'applique sur les tissus vivants (peau) ; le désinfectant sur les surfaces inertes", wrongs: ["le désinfectant se boit en sirop", "l'antiseptique ne s'utilise que sur les sols", "les deux termes sont totalement interdits en hôpital"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "On désinfecte un plan de travail (surface inerte) et on réalise une antisepsie sur la peau." },
            { q: "Qu'est-ce qu'une « colonie bactérienne » visible à l'œil nu sur une gélose en boîte de Pétri ?", correct: "un amas de millions de bactéries identiques issues par division d'une seule cellule initiale (clone)", wrongs: ["une seule bactérie géante", "une bulle d'air dans l'agar", "un cristal de sel pur"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'isolement par stries permet d'obtenir des colonies pures isolées (UFC)." },
            { q: "Quel est l'objectif de la centrifugation différentielle en laboratoire de biologie ?", correct: "séparer les constituants d'un mélange (cellules, organites, surnageant) selon leur densité et taille", wrongs: ["stériliser une solution par UV", "mesurer la conductivité électrique", "synthétiser des lipides"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les éléments les plus denses sédimentent au fond du tube pour former le culot." },
            { q: "En génie génétique, qu'est-ce qu'un plasmide bactérien ?", correct: "une petite molécule d'ADN circulaire extrachromosomique utilisée comme vecteur de clonage", wrongs: ["un ribosome géant", "une paroi de cellulose", "un lipide membranaire"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les plasmides peuvent recevoir un gène d'intérêt (ex : insuline) puis être insérés dans E. coli." },
            { q: "Quelle est la température optimale habituelle d'incubation d'une bactérie mésophile humaine comme E. coli ?", correct: "37 °C", wrongs: ["4 °C", "95 °C", "−18 °C"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les bactéries commensales ou pathogènes humaines se développent de façon optimale à la température corporelle (37 °C)." },
            { q: "En sécurité de laboratoire (STL / ASSP), que signifie le pictogramme SGH représentant un crâne et deux tibias croisés ?", correct: "Toxicité aiguë (produit mortel ou très toxique par ingestion, inhalation ou contact cutané)", wrongs: ["Produit simplement odorant", "Produit biodégradable", "Matière magnétique"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La maîtrise des pictogrammes SGH/CLP et des EPI (blouse, gants, lunettes) est obligatoire au laboratoire." },
            { q: "Que mesure l'unité UFC/mL en contrôle microbiologique des aliments ou de l'eau ?", correct: "le nombre d'Unités Formant Colonie par millilitre d'échantillon", wrongs: ["la concentration en sucre", "le degré d'acidité", "la viscosité du liquide"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le dénombrement en UFC/mL évalue la charge microbienne viable d'un produit." }
        ],

        design: [
            // STD2A : Design & Arts Appliqués
            { q: "Quelle célèbre école allemande fondée en 1919 par Walter Gropius a uni art, artisanat et industrie pour fonder le design moderne ?", correct: "le Bauhaus", wrongs: ["l'Académie de Florence", "l'École de Barbizon", "le Salon des Refusés"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le Bauhaus prônait la simplicité géométrique et le principe « la forme suit la fonction »." },
            { q: "En design produit, que désigne l'« ergonomie » d'un objet (ex : fauteuil, manette, outil) ?", correct: "l'adaptation de l'objet au corps humain, au confort, à la sécurité et à la facilité d'usage", wrongs: ["uniquement son prix de vente en magasin", "sa brillance sous éclairage LED", "le nombre de couleurs de son emballage"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'ergonomie s'appuie sur l'anthropométrie et l'analyse de l'usage réel." },
            { q: "En typographie (design graphique), quelle est la différence entre une police « Serif » et « Sans-Serif » ?", correct: "Serif possède des empattements aux extrémités des lettres (ex : Garamond) ; Sans-Serif n'en a pas (ex : Helvetica)", wrongs: ["Serif s'écrit toujours en rouge", "Sans-Serif ne comporte jamais de majuscules", "il n'existe aucune différence visuelle"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les polices sans empattement (linéales) sont très prisées sur écran pour leur lisibilité." },
            { q: "Quels sont les quatre grands pôles historiques du design étudiés en STD2A ?", correct: "Design de produit, Design d'espace, Design graphique et Design de mode/textile", wrongs: ["Design agricole, militaire, minier et ferroviaire", "Peinture à l'huile, gravure, chant et danse", "Chimie, comptabilité, droit et sport"], levels: ['2nde', '1ere', 'terminale'], exp: "La filière STD2A explore ces quatre domaines complémentaires et leurs démarches de projet." },
            { q: "En imprimerie professionnelle, quel mode colorimétrique à 4 encres utilise-t-on à la place du RVB des écrans ?", correct: "CMJN (Cyan, Magenta, Jaune, Noir)", wrongs: ["HSL", "Hexadécimal seul", "Infrarouge"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "RVB = synthèse additive (lumière/écran) ; CMJN = synthèse soustractive (encres d'impression)." },
            { q: "Quelle est la principale différence entre une image vectorielle (SVG, AI) et une image matricielle/bitmap (JPEG, PNG) ?", correct: "le vectoriel repose sur des courbes mathématiques redimensionnables à l'infini sans perte de netteté", wrongs: ["le vectoriel pixellise dès qu'on zoome", "le bitmap ne gère aucune couleur", "le vectoriel est réservé uniquement aux photographies"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les logos et icônes sont conçus en vectoriel (courbes de Bézier) pour rester nets à toute échelle." },
            { q: "En design d'espace / architecture, quel type de représentation montre un objet en 3D avec des arêtes parallèles sans point de fuite ?", correct: "l'axonométrie (ou perspective isométrique/cavalière)", wrongs: ["la perspective atmosphérique", "la coupe géologique seule", "le croquis d'ambiance flou"], levels: ['1ere', 'terminale', 'bts1'], exp: "L'axonométrie conserve le parallélisme et permet des mesures directes sur les axes." },
            { q: "Que signifie la démarche d'« éco-design » (design soutenable) ?", correct: "concevoir des objets durables, réparables, sobres en matériaux et pensés pour le recyclage", wrongs: ["peindre tous les objets en vert", "utiliser uniquement des matériaux jetables", "doubler le volume des emballages plastiques"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'éco-design intègre l'environnement dès l'esquisse (matériaux biosourcés, démontabilité)." },
            { q: "Quel designer français célèbre a signé le presse-agrumes « Juicy Salif » (1990) et de nombreux objets iconiques ?", correct: "Philippe Starck", wrongs: ["Gustave Eiffel", "Auguste Rodin", "Claude Monet"], levels: ['1ere', 'terminale', 'bts1'], exp: "Philippe Starck est l'une des figures majeures du design industriel contemporain." },
            { q: "En design d'interface (UI/UX), que signifie l'acronyme UX ?", correct: "User Experience (l'expérience globale vécue par l'utilisateur lors de son parcours)", wrongs: ["Ultra X-Ray", "Uniform XML", "Universal Export"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'UX design veille à l'utilité, la fluidité et la satisfaction ; l'UI design soigne l'esthétique visuelle." },
            { q: "Quel mouvement artistique des années 1900 (Hector Guimard, entrées de métro parisien) s'inspire des courbes végétales et organiques ?", correct: "l'Art Nouveau", wrongs: ["le Brutalisme", "le Pop Art", "le Cubisme"], levels: ['1ere', 'terminale', 'bts1'], exp: "L'Art Nouveau privilégie les lignes sinueuses, le fer forgé et les motifs floraux." },
            { q: "Dans la méthode de projet STD2A, à quoi sert une « planche tendances » (moodboard) ?", correct: "rassembler images, couleurs, textures et références pour définir l'univers esthétique du projet", wrongs: ["calculer la TVA de l'atelier", "remplacer totalement le prototype final", "mesurer la résistance d'un mur porteur"], levels: ['2nde', '1ere', 'terminale'], exp: "Le moodboard synthétise la direction artistique et sert d'appui pour dialoguer avec le commanditaire." },
            { q: "Quel architecte franco-suisse a formulé les « cinq points de l'architecture moderne » (pilotis, toit-terrasse, plan libre…) et le Modulor ?", correct: "Le Corbusier", wrongs: ["Baron Haussmann", "Antoine Watteau", "Eugène Delacroix"], levels: ['1ere', 'terminale', 'bts1'], exp: "La Villa Savoye (1931) de Le Corbusier incarne les cinq points de l'architecture moderne." },
            { q: "En design graphique, que désigne la « charte graphique » d'une marque ou institution ?", correct: "le document de référence fixant règles d'usage du logo, palettes de couleurs, typographies et mises en page", wrongs: ["le contrat de bail du bureau", "la liste des clients de la boutique", "le planning des congés"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "La charte graphique assure la cohérence de l'identité visuelle sur tous les supports." },
            { q: "En design produit, quelle étape consiste à réaliser une version physique à l'échelle (carton, mousse, impression 3D) pour tester volumes et prise en main ?", correct: "le maquettage / prototypage", wrongs: ["la facturation finale", "la mise en rayon", "la destruction du cahier des charges"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La maquette permet d'itérer rapidement sur les proportions et l'ergonomie avant industrialisation." },
            { q: "Quel célèbre couple de designers américains a créé la Lounge Chair (1956) en contreplaqué moulé et cuir ?", correct: "Charles et Ray Eames", wrongs: ["Vincent et Théo van Gogh", "Pierre et Marie Curie", "Frères Lumière"], levels: ['1ere', 'terminale', 'bts1'], exp: "Les Eames ont révolutionné le mobilier moderne par le travail du bois cintré et de la fibre de verre." },
            { q: "En design textile / mode, quelle fibre naturelle d'origine végétale est réputée en France pour son faible impact écologique et sa thermorégulation ?", correct: "le lin", wrongs: ["le polyester issu du pétrole", "le nylon synthétique", "l'acrylique"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La France est le premier producteur mondial de lin textile, cultivé sans irrigation artificielle." },
            { q: "Que signifie la notion de « biomimétisme » en design contemporain ?", correct: "s'inspirer des formes, structures ou stratégies du vivant (nature) pour concevoir des solutions innovantes", wrongs: ["copier les créations d'un concurrent", "n'utiliser que du verre transparent", "imprimer des photos d'animaux sur des affiches"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Exemple célèbre : le Velcro inspiré des crochets du fruit de la bardane, ou les façades inspirées des termitières." }
        ],

        hotellerie: [
            // STHR : Hôtellerie & Restauration
            { q: "En hygiène alimentaire (STHR), que signifie la méthode préventive internationale HACCP ?", correct: "Hazard Analysis Critical Control Point (Analyse des dangers et points critiques pour leur maîtrise)", wrongs: ["Hôtel Accueil Cuisine Conseil Professionnel", "Haute Alimentation Certifiée par le Chef Principal", "Hygiène Automatique des Chambres et Couverts"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "La démarche HACCP identifie et maîtrise les dangers biologiques, chimiques et physiques en cuisine." },
            { q: "Selon la réglementation française, à quelle température maximale doit-on conserver les plats cuisinés froids et viandes hachées réfrigérées ?", correct: "+3 °C (voire +2 °C pour la viande hachée fraîche)", wrongs: ["+12 °C", "+18 °C", "+25 °C"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le strict respect de la chaîne du froid bloque la prolifération des bactéries pathogènes." },
            { q: "En liaison chaude en restauration collective, à quelle température minimale un plat chaud doit-il être maintenu jusqu'au service ?", correct: "+63 °C minimum", wrongs: ["+35 °C", "+42 °C", "+20 °C"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Entre +10 °C et +63 °C se situe la zone de danger où les bactéries se multiplient très vite." },
            { q: "Que signifie le principe fondamental de la « marche en avant » dans l'agencement d'une cuisine professionnelle ?", correct: "les produits propres ne croisent jamais les circuits sales (déchets, plonge) de la réception jusqu'au service", wrongs: ["les cuisiniers n'ont jamais le droit de reculer", "les clients entrent par la réserve froide", "on sert toujours le dessert avant l'entrée"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La marche en avant dans l'espace (ou dans le temps) évite toute contamination croisée." },
            { q: "En sciences culinaires, quelle réaction chimique brunit la croûte du pain et la surface d'une viande saisie à haute température en créant des arômes ?", correct: "la réaction de Maillard", wrongs: ["la photosynthèse", "l'électrolyse", "la sublimation"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La réaction de Maillard intervient entre sucres réducteurs et acides aminés dès ~140 °C." },
            { q: "En service de salle, de quel côté sert-on traditionnellement une assiette dressée (service à l'assiette) ?", correct: "par la droite du client", wrongs: ["par la gauche systématiquement", "au-dessus de la tête du client", "toujours par le bout de la table"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Service à l'assiette et boissons : par la droite ; service au plat (à l'anglaise/française) et pain : par la gauche." },
            { q: "En hébergement hôtelier, que signifie l'indicateur « RevPAR » ?", correct: "Revenue Per Available Room (chiffre d'affaires hébergement par chambre disponible)", wrongs: ["Revenu Par Assiette de Restaurant", "Réservation Validée Par Agent Régional", "Retour Énergétique des Villas et Palaces"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "RevPAR = CA Hébergement / Nombre de chambres disponibles (ou Prix Moyen × Taux d'occupation)." },
            { q: "Quel grand chef français du début du XXe siècle a codifié la brigade de cuisine moderne et écrit « Le Guide Culinaire » ?", correct: "Auguste Escoffier", wrongs: ["Antoine Lavoisier", "Victor Hugo", "Gustave Eiffel"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Escoffier (1846-1935) a structuré l'organisation par parties (saucier, garde-manger, pâtissier…)." },
            { q: "En cuisine, comment s'appelle l'émulsion stable obtenue en dispersant de l'huile dans du jaune d'œuf et de la moutarde ?", correct: "une mayonnaise (émulsion huile dans eau)", wrongs: ["une caramélisation", "une fermentation alcoolique", "une décantation"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La lécithine du jaune d'œuf joue le rôle de molécule tensioactive (émulsifiant)." },
            { q: "En hôtellerie, quelle pratique consiste à ajuster dynamiquement le prix des chambres selon la demande, la saison et l'anticipation ?", correct: "le Yield Management (Revenue Management)", wrongs: ["le dumping comptable", "la tarification fixe annuelle", "le troc hôtelier"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le Yield Management maximise le RevPAR en vendant la bonne chambre au bon client au bon moment." },
            { q: "En France, combien d'étoiles compte le classement hôtelier officiel d'Atout France (hors distinction Palace) ?", correct: "de 1 à 5 étoiles", wrongs: ["de 1 à 3 étoiles", "de 1 à 7 étoiles", "de 1 à 10 étoiles"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les hôtels sont classés de 1 à 5 étoiles ; les établissements d'exception 5* peuvent obtenir la distinction « Palace »." },
            { q: "En cuisine, quelle opération rapide consiste à abaisser la température d'un plat cuisiné de +63 °C à moins de +10 °C en moins de 2 heures ?", correct: "le refroidissement rapide (en cellule de refroidissement)", wrongs: ["le flambage", "le braisage", "la décongélation ambiante"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Un refroidissement rapide limite le temps passé dans la zone critique de prolifération microbienne." },
            { q: "Quel terme hôtelier désigne une clientèle qui réserve une chambre sans se présenter ni annuler (no-show) ?", correct: "un no-show (dédit)", wrongs: ["un walk-in", "un check-out tardif", "un surclassement"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "À l'inverse, un « walk-in » est un client arrivant directement à la réception sans réservation." },
            { q: "En gastronomie et œnologie, que garantit le label européen AOP (Appellation d'Origine Protégée) ?", correct: "toutes les étapes de production, transformation et élaboration ont lieu dans une aire géographique délimitée selon un savoir-faire reconnu", wrongs: ["uniquement un prix inférieur à 5 €", "une fabrication industrielle hors Europe", "un emballage en plastique vert"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Exemples célèbres : Comté AOP, Champagne AOC/AOP, Roquefort AOP." },
            { q: "Quel est le rôle du « garde-manger » au sein d'une brigade de cuisine ?", correct: "préparer les entrées froides, salades, terrines et découpes préliminaires de viandes et poissons", wrongs: ["encaisser l'addition en salle", "nettoyer les chambres de l'hôtel", "assurer uniquement le service des vins"], levels: ['2nde', '1ere', 'terminale'], exp: "Chaque chef de partie (saucier, rôtisseur, entremetier, garde-manger, pâtissier) a une spécialité précise." },
            { q: "Combien d'allergènes alimentaires majeurs à déclaration obligatoire la réglementation européenne INCO impose-t-elle d'indiquer aux clients ?", correct: "14 allergènes majeurs", wrongs: ["3 allergènes", "6 allergènes", "40 allergènes"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Gluten, crustacés, œufs, poissons, arachides, soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques." },
            { q: "En technologie culinaire, quelle cuisson « par concentration » consiste à plonger un aliment dans un liquide déjà bouillant ou à le saisir vivement ?", correct: "une cuisson visant à retenir les sucs à l'intérieur (ex : poêler, griller, rôtir)", wrongs: ["une cuisson démarrant à l'eau froide pour faire un bouillon", "une congélation lente", "une marinade à froid"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "On distingue cuisson par concentration (saisir/rôtir), par expansion (bouillon/pot-au-feu) et mixte (braiser)." },
            { q: "En hôtellerie, que désigne la formule « demi-pension » (Half Board) ?", correct: "l'hébergement incluant le petit-déjeuner et un repas principal (déjeuner ou dîner)", wrongs: ["l'hébergement sans aucun repas", "un séjour de seulement 12 heures", "la nuitée plus les 3 repas complets"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "BB = nuit + petit-déjeuner ; Demi-pension = +1 repas ; Pension complète = +2 repas." }
        ],

        agronomie: [
            // STAV : Agronomie, Territoires & Vivant
            { q: "En agronomie, quelle pratique consiste à alterner différentes espèces cultivées sur une même parcelle d'une année sur l'autre ?", correct: "la rotation des cultures", wrongs: ["la monoculture intensive perpétuelle", "le bétonnage agricole", "la déforestation totale"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La rotation limite l'épuisement du sol, casse les cycles des ravageurs et améliore la fertilité." },
            { q: "Quelle famille de plantes (trèfle, luzerne, pois, soja) enrichit naturellement le sol en azote grâce à une symbiose racinaire (Rhizobium) ?", correct: "les légumineuses (Fabacées)", wrongs: ["les conifères", "les cactus désertiques", "les mousses aquatiques"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Les nodosités des légumineuses fixent l'azote atmosphérique N₂, réduisant le besoin d'engrais azotés." },
            { q: "Que désigne le « complexe argilo-humique » (CAH) en science du sol (pédologie) ?", correct: "l'association d'argile et d'humus capable de retenir l'eau et les éléments minéraux (cations) pour les plantes", wrongs: ["un bâtiment de stockage de tracteurs", "une maladie fongique du blé", "une couche de plastique imperméable"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Chargé négativement, le CAH fixe les cations (Ca²⁺, K⁺, Mg²⁺, NH₄⁺) et évite leur lessivage." },
            { q: "Que signifie la « lutte biologique » en agroécologie ?", correct: "utiliser des organismes auxiliaires vivants (ex : coccinelles contre pucerons) pour réguler les ravageurs", wrongs: ["multiplier par dix les pesticides chimiques", "brûler systématiquement les haies", "irriguer à l'eau salée"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La lutte biologique préserve la biodiversité et réduit l'usage de produits phytosanitaires." },
            { q: "Quels sont les trois éléments minéraux majeurs (NPK) essentiels à la nutrition des cultures ?", correct: "Azote (N), Phosphore (P) et Potassium (K)", wrongs: ["Nickel, Plomb et Krypton", "Néon, Platine et Calcium seul", "Mercure, Or et Argent"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "N favorise la croissance foliaire, P l'enracinement/floraison, K la résistance et qualité des fruits." },
            { q: "Quel est l'un des rôles écologiques majeurs des haies bocagères autour des parcelles agricoles ?", correct: "abriter des auxiliaires de culture, freiner le vent (brise-vent) et limiter l'érosion des sols", wrongs: ["assécher complètement les nappes phréatiques", "empêcher totalement la pollinisation", "augmenter le ruissellement de boue"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les haies constituent des corridors écologiques essentiels (trame verte)." },
            { q: "Que désigne l'« eutrophisation » d'un cours d'eau ou d'un littoral (ex : algues vertes) ?", correct: "l'enrichissement excessif en nutriments (nitrates, phosphates) provoquant une prolifération d'algues et un manque d'oxygène", wrongs: ["le gel naturel en hiver", "la filtration par les roseaux", "la disparition totale du sel marin"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le lessivage excessif d'azote et de phosphore perturbe gravement les écosystèmes aquatiques." },
            { q: "Quel cahier des charges interdit les pesticides et engrais chimiques de synthèse ainsi que les OGM en agriculture ?", correct: "l'Agriculture Biologique (label AB / Eurofeuille)", wrongs: ["l'agriculture hors-sol chimique", "le label industriel standard", "la culture hydrocarbure"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "L'agriculture biologique mise sur les équilibres naturels, le compostage et les rotations longues." },
            { q: "En agronomie, qu'est-ce que l'« agroforesterie » ?", correct: "associer des arbres (haies ou alignements) et des cultures ou de l'élevage sur une même parcelle", wrongs: ["couper toutes les forêts pour planter du maïs", "cultiver uniquement sous serre chauffée", "remplacer la terre par du béton"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les arbres apportent ombre, stockage de carbone, matière organique et revenus bois complémentaires." },
            { q: "Quel rôle jouent les vers de terre (lombrics) dans la fertilité d'un sol agricole ?", correct: "ils aèrent le sol par leurs galeries, mélangent matière organique et minérale et favorisent l'infiltration de l'eau", wrongs: ["ils dévorent les racines vivantes des arbres", "ils rendent la terre imperméable", "ils détruisent totalement l'humus"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Les vers de terre anéciques sont de véritables « ingénieurs du sol »." },
            { q: "En gestion de l'eau, quelle technique d'irrigation localisée permet d'économiser le plus d'eau en la délivrant au pied des plantes ?", correct: "le goutte-à-goutte", wrongs: ["l'inondation par submersion totale en plein midi", "le canon enrouleur par grand vent", "l'arrosage sur routes"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le goutte-à-goutte limite drastiquement l'évaporation et le ruissellement." },
            { q: "Qu'est-ce qu'un « couvert végétal d'interculture » (CIPAN) semé entre deux cultures principales ?", correct: "une plante couvrant le sol nu en hiver pour piéger les nitrates, protéger contre l'érosion et apporter de la matière organique", wrongs: ["une bâche en PVC jetable", "un hangar agricole métallique", "un herbicide total"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "CIPAN = Culture Intermédiaire Piège à Nitrates (ex : moutarde, phacélie, vesce)." },
            { q: "En écologie des territoires, que désigne la « Trame Verte et Bleue » (TVB) ?", correct: "un réseau de corridors terrestres (vert) et aquatiques (bleu) permettant aux espèces de se déplacer et se reproduire", wrongs: ["une peinture écologique pour tracteurs", "un itinéraire autoroutier", "une taxe sur les engrais"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La TVB lutte contre la fragmentation des habitats naturels." },
            { q: "En élevage, qu'appelle-t-on le « pâturage tournant dynamique » ?", correct: "déplacer régulièrement le troupeau sur de petites parcelles pour laisser l'herbe repousser au stade optimal", wrongs: ["laisser les animaux enfermés toute l'année", "tondre les prairies à ras chaque matin", "ne jamais changer de pré"], levels: ['1ere', 'terminale', 'bts1'], exp: "Il améliore la valeur nutritive de l'herbe, le bien-être animal et le stockage de carbone dans le sol." },
            { q: "Que signifie la « PAC » dans le contexte de l'agriculture européenne ?", correct: "la Politique Agricole Commune de l'Union européenne", wrongs: ["le Plan d'Arrosage Communal", "la Production Alimentaire Chimique", "le Programme d'Achat de Céréales"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Instaurée en 1962, la PAC soutient les agriculteurs et intègre des écorégimes environnementaux." },
            { q: "Quel est l'intérêt agronomique du « semis direct sous couvert » (agriculture de conservation) ?", correct: "ne plus labourer pour préserver la structure vivante du sol, limiter l'érosion et réduire le carburant consommé", wrongs: ["retourner la terre sur 1 mètre de profondeur", "supprimer toute vie microbienne", "augmenter le tassement des sols"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les 3 piliers : perturbation minimale du sol, couverture permanente, diversité des rotations." },
            { q: "Quel gaz à effet de serre puissant est principalement émis par la fermentation entérique des ruminants et les rizières ?", correct: "le méthane (CH₄)", wrongs: ["le dioxygène (O₂)", "l'hélium (He)", "l'argon (Ar)"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Réduire les émissions de CH₄ et de N₂O est un enjeu majeur de la transition agroécologique." },
            { q: "Que désigne la « biodiversité fonctionnelle » dans un agrosystème ?", correct: "l'ensemble des espèces (pollinisateurs, décomposeurs, prédateurs de ravageurs) rendant des services utiles à la culture", wrongs: ["le nombre de marques de machines agricoles", "une seule variété clonée sur 1000 ha", "le catalogue des engrais de synthèse"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Abeilles, syrphes, carabes, champignons mycorhiziens assurent pollinisation, fertilité et régulation naturelle." }
        ],

        spectacle: [
            // S2TMD : Théâtre, Musique & Danse
            { q: "Au théâtre antique grec, quelle fonction morale Aristote attribue-t-il à la tragédie (purgation des passions par la terreur et la pitié) ?", correct: "la catharsis", wrongs: ["la parodie", "la pantomime", "l'allégorie burlesque"], levels: ['2nde', '1ere', 'terminale'], exp: "Dans la Poétique, Aristote définit la catharsis comme l'épuration émotionnelle vécue par le spectateur." },
            { q: "Dans un texte théâtral, comment appelle-t-on les indications scéniques écrites par l'auteur (gestes, tons, décors, entrées) ?", correct: "les didascalies", wrongs: ["les tirades", "les stichomythies", "les alexandrins"], levels: ['2nde', '1ere', 'terminale'], exp: "Les didascalies (souvent en italique) ne sont pas prononcées mais guident la mise en scène." },
            { q: "Quel grand dramaturge français du XVIIe siècle a écrit « Le Tartuffe », « L'Avare » et « Le Malade imaginaire » ?", correct: "Molière", wrongs: ["Jean Racine", "Pierre Corneille", "Alfred de Musset"], levels: ['2nde', '1ere', 'terminale'], exp: "Molière (1622-1673) a renouvelé la comédie française en mêlant satire sociale et farce." },
            { q: "En musique classique, comment appelle-t-on la forme musicale en trois grandes sections : Exposition, Développement, Réexposition ?", correct: "la forme sonate", wrongs: ["la fugue stricte", "le canon simple", "le choral grégorien"], levels: ['1ere', 'terminale'], exp: "La forme sonate structure classiquement le premier mouvement des symphonies et sonates de Haydn, Mozart et Beethoven." },
            { q: "Quelle grande chorégraphe allemande du XXe siècle est célèbre pour le « Tanztheater » (théâtre dansé), comme « Café Müller » ?", correct: "Pina Bausch", wrongs: ["Marie Taglioni", "Clara Schumann", "George Sand"], levels: ['1ere', 'terminale'], exp: "Pina Bausch mêle danse contemporaine, parole, scénographie expressive et émotions humaines brutes." },
            { q: "En théorie musicale, quel signe placé devant une note l'élève d'un demi-ton ?", correct: "le dièse (♯)", wrongs: ["le bémol (♭)", "le point d'orgue", "le soupir"], levels: ['2nde', '1ere', 'terminale'], exp: "Le dièse (♯) hausse d'un demi-ton, le bémol (♭) abaisse d'un demi-ton, le bécarre (♮) annule." },
            { q: "En théâtre, que désigne la notion de « quatrième mur » théorisée au XVIIIe siècle (Diderot) puis au XIXe siècle ?", correct: "la paroi imaginaire séparant la scène du public, que les acteurs feignent d'ignorer", wrongs: ["le mur du fond où sont accrochés les projecteurs", "un décor en brique obligatoire", "la loge du souffleur"], levels: ['2nde', '1ere', 'terminale'], exp: "« Briser le quatrième mur » consiste pour un acteur à s'adresser directement au public (ex : Brecht, aparté)." },
            { q: "Quel compositeur russe a créé la musique scandaleuse et révolutionnaire du ballet « Le Sacre du printemps » (1913, chorégraphie Nijinski) ?", correct: "Igor Stravinsky", wrongs: ["Antonio Vivaldi", "Jean-Sébastien Bach", "Frédéric Chopin"], levels: ['1ere', 'terminale'], exp: "Créé au Théâtre des Champs-Élysées par les Ballets russes, il marque un tournant du XXe siècle." },
            { q: "En mise en scène théâtrale du XXe siècle, quel dramaturge allemand a théorisé l'« effet de distanciation » (théâtre épique) ?", correct: "Bertolt Brecht", wrongs: ["Sophocle", "William Shakespeare", "Marivaux"], levels: ['1ere', 'terminale'], exp: "Brecht cherche à maintenir l'esprit critique du spectateur plutôt que l'illusion émotionnelle totale." },
            { q: "En danse, qui a fondé l'Académie royale de danse en France en 1661, posant les bases du vocabulaire du ballet classique ?", correct: "Louis XIV", wrongs: ["Napoléon III", "Charlemagne", "François Ier"], levels: ['2nde', '1ere', 'terminale'], exp: "D'où le fait que les termes de danse classique (plié, arabesque, entrechat, pas de deux) soient en français partout dans le monde." },
            { q: "En musique, que signifie le terme italien « polyphonie » ?", correct: "la superposition simultanée de plusieurs voix ou lignes mélodiques indépendantes", wrongs: ["un solo joué par un seul instrument sans accompagnement", "un silence prolongé de 4 mesures", "l'accordage d'un piano"], levels: ['2nde', '1ere', 'terminale'], exp: "Par opposition à la monodie (une seule ligne mélodique), la polyphonie atteint un sommet à la Renaissance et chez Bach." },
            { q: "En analyse dramaturgique, que désigne la « stichomythie » ?", correct: "un échange rapide de répliques très courtes (un vers chacun) traduisant une tension dramatique", wrongs: ["un long monologue lyrique de 80 vers", "la musique d'ouverture", "le salut final des comédiens"], levels: ['1ere', 'terminale'], exp: "Très présente chez Corneille et Racine lors des affrontements verbaux intenses." },
            { q: "En acoustique / musique, quelle caractéristique physique d'une onde sonore détermine la HAUTEUR d'une note (grave ou aiguë) ?", correct: "sa fréquence (en Hertz)", wrongs: ["son amplitude seule", "la couleur de l'instrument", "la vitesse de la lumière"], levels: ['2nde', '1ere', 'terminale'], exp: "Plus la fréquence est élevée, plus la note est aiguë (le La3 de référence = 440 Hz)." },
            { q: "Quel dramaturge du théâtre de l'absurde a écrit « En attendant Godot » (1952) ?", correct: "Samuel Beckett", wrongs: ["Edmond Rostand", "Pierre de Beaumarchais", "Jean Anouilh"], levels: ['1ere', 'terminale'], exp: "Beckett et Ionesco remettent en cause l'intrigue logique et le langage dans le théâtre de l'absurde." },
            { q: "En danse, qu'appelle-t-on la « cinétographie Laban » (Labanotation) ?", correct: "un système graphique de notation permettant d'écrire et conserver les mouvements d'une chorégraphie", wrongs: ["un type de chaussons de pointes", "un projecteur de poursuite", "une danse folklorique médiévale"], levels: ['1ere', 'terminale'], exp: "Créée par Rudolf Laban, elle joue pour la danse un rôle comparable à la partition en musique." },
            { q: "À quel courant musical associe-t-on Claude Debussy et Maurice Ravel au tournant du XXe siècle ?", correct: "l'impressionnisme / symbolisme musical français", wrongs: ["le baroque italien du XVIIe siècle", "le grunge rock", "le dodécaphonisme strict"], levels: ['1ere', 'terminale'], exp: "Debussy explore les timbres, les gammes par tons et les harmonies colorées (Prélude à l'après-midi d'un faune)." },
            { q: "En scénographie, que désigne le « cintre » dans une cage de scène à l'italienne ?", correct: "la partie haute au-dessus de la scène permettant de monter et descendre décors et rideaux grâce aux perches", wrongs: ["le premier rang du balcon", "la billetterie d'entrée", "la fosse d'orchestre"], levels: ['2nde', '1ere', 'terminale'], exp: "Les décors suspendus sont « envoyés aux cintres » pour effectuer des changements rapides." },
            { q: "Quel genre théâtral populaire italien né au XVIe siècle repose sur des personnages masqués types (Arlequin, Pantalon, Colombine) et l'improvisation ?", correct: "la commedia dell'arte", wrongs: ["la tragédie lyrique", "le drame bourgeois", "le vaudeville"], levels: ['2nde', '1ere', 'terminale'], exp: "La commedia dell'arte a profondément influencé Molière et Marivaux." }
        ],

        hlp: [
            // HLP : Humanités, Littérature & Philosophie (1ère & Terminale)
            { q: "Dans le programme de 1ère HLP (« Les pouvoirs de la parole »), quel art antique codifie les techniques pour bien parler et persuader ?", correct: "la rhétorique", wrongs: ["la balistique", "la thermodynamique", "la botanique"], levels: ['1ere', 'terminale'], exp: "Née en Sicile et à Athènes au Ve siècle av. J.-C., la rhétorique est au cœur de la vie démocratique antique." },
            { q: "Dans le dialogue « Gorgias » de Platon, quelle critique principale Socrate adresse-t-il à la rhétorique des sophistes ?", correct: "elle vise la flatterie et la persuasion sans souci de la vérité ni de la justice", wrongs: ["elle est trop silencieuse", "elle utilise trop de mathématiques", "elle interdit les métaphores"], levels: ['1ere', 'terminale'], exp: "Platon oppose la philosophie (recherche du vrai et du bien) à la rhétorique sophistique (simple apparence)." },
            { q: "Dans « Les Essais » (chapitre « Des Cannibales »), quelle critique majeure Michel de Montaigne formule-t-il face à la découverte du Nouveau Monde ?", correct: "il dénonce l'ethnocentrisme européen : « chacun appelle barbarie ce qui n'est pas de son usage »", wrongs: ["il réclame l'esclavage immédiat", "il nie l'existence de l'Amérique", "il affirme la supériorité absolue des guerres de religion"], levels: ['1ere', 'terminale'], exp: "Montaigne adopte un regard critique et relativiste qui fonde l'humanisme moderne." },
            { q: "Quel ouvrage majeur de Jean-Jacques Rousseau (1782) inaugure l'autobiographie moderne avec le projet de « montrer un homme dans toute la vérité de la nature » ?", correct: "Les Confessions", wrongs: ["Candide", "Les Fleurs du mal", "Gargantua"], levels: ['1ere', 'terminale'], exp: "Rousseau y explore la mémoire, la sensibilité et la construction du moi (thème Terminale : La recherche de soi)." },
            { q: "En HLP Terminale (« L'Humanité en question »), quelle notion Hannah Arendt développe-t-elle lors du procès d'Adolf Eichmann (1961) ?", correct: "la banalité du mal (l'absence de pensée critique face aux ordres bureaucratiques)", wrongs: ["la souveraineté divine", "le progrès illimité", "le contrat commercial"], levels: ['terminale'], exp: "Arendt montre comment un fonctionnaire ordinaire peut participer à des crimes de masse en renonçant à penser." },
            { q: "Quel écrivain italien rescapé d'Auschwitz a écrit « Si c'est un homme » (1947) pour témoigner de la déshumanisation concentrationnaire ?", correct: "Primo Levi", wrongs: ["Dante Alighieri", "Nicolas Machiavel", "Italo Calvino"], levels: ['terminale'], exp: "Œuvre centrale du thème HLP « Création, continuités et ruptures » et « Histoire et violence »." },
            { q: "Dans « Les Lettres persanes » (1721), quel procédé Montesquieu utilise-t-il pour critiquer la société française du XVIIIe siècle ?", correct: "le regard étranger naïf (deux voyageurs persans, Usbek et Rica, s'étonnent des coutumes parisiennes)", wrongs: ["le traité de géométrie", "la tragédie en alexandrins", "le dictionnaire médical"], levels: ['1ere', 'terminale'], exp: "Ce décentrement ironique contourne la censure et dévoile l'absurdité de certains préjugés." },
            { q: "En philosophie esthétique (HLP Terminale), selon Emmanuel Kant dans la « Critique de la faculté de juger », le jugement de goût (« ceci est beau ») est :", correct: "désintéressé et prétend à une universalité subjective sans concept", wrongs: ["uniquement lié au prix de l'œuvre", "identique au calcul mathématique", "strictement utile pour manger ou dormir"], levels: ['terminale'], exp: "« Est beau ce qui plaît universellement sans concept », indépendamment de l'intérêt matériel." },
            { q: "Qui a écrit « Le Discours de la servitude volontaire » (vers 1548), s'interrogeant sur la façon dont un peuple entier obéit à un seul tyran ?", correct: "Étienne de La Boétie", wrongs: ["Honoré de Balzac", "Charles Baudelaire", "Albert Camus"], levels: ['1ere', 'terminale'], exp: "L'ami de Montaigne montre que la tyrannie ne tient que par le consentement et l'habitude des sujets." },
            { q: "En littérature et philosophie, que désigne la « sensibilité romantique » au XIXe siècle (Chateaubriand, Musset, Hugo) ?", correct: "l'exaltation du moi, des passions, de la nature miroir de l'âme et de la mélancolie (« mal du siècle »)", wrongs: ["le refus absolu de toute émotion personnelle", "la copie mécanique des règles classiques", "l'apologie de l'industrie lourde"], levels: ['1ere', 'terminale'], exp: "Le romantisme place l'individu, l'imagination et la liberté créatrice au premier plan." },
            { q: "Quel roman dystopique de George Orwell (1949) illustre la manipulation du langage (« novlangue ») par un régime totalitaire ?", correct: "1984", wrongs: ["Le Petit Prince", "Madame Bovary", "Les Misérables"], levels: ['1ere', 'terminale'], exp: "En réduisant le vocabulaire, la « novlangue » vise à rendre la pensée critique littéralement impossible." },
            { q: "Dans le thème HLP « L'humain et ses limites », que désigne le « transhumanisme » ?", correct: "un courant promouvant l'usage des sciences et technologies (IA, génétique, implants) pour augmenter les capacités humaines", wrongs: ["le retour strict à la vie paléolithique", "l'interdiction des bibliothèques", "un mouvement pictural du XVIe siècle"], levels: ['terminale'], exp: "Il soulève d'importants débats éthiques sur la nature humaine, les inégalités et la finitude." },
            { q: "Quelle femme de lettres des Lumières a rédigé en 1791 la « Déclaration des droits de la femme et de la citoyenne » ?", correct: "Olympe de Gouges", wrongs: ["Madame de La Fayette", "Colette", "Marguerite Duras"], levels: ['1ere', 'terminale'], exp: "Elle affirme l'égalité politique et civile des femmes face à la Déclaration de 1789." },
            { q: "Selon Sigmund Freud (HLP Terminale — « Les métamorphoses du moi »), quelle blessure narcissique la psychanalyse inflige-t-elle à l'humanité ?", correct: "« le Moi n'est pas maître dans sa propre maison » (existence de l'inconscient)", wrongs: ["la Terre est plate", "l'homme descend des minéraux", "le langage n'existe pas"], levels: ['terminale'], exp: "Après Copernic (astronomie) et Darwin (biologie), Freud évoque la 3e blessure narcissique (psychologie)." },
            { q: "Dans l'Antiquité, quelle école philosophique (Épictète, Marc Aurèle, Sénèque) enseigne de distinguer ce qui dépend de nous de ce qui n'en dépend pas ?", correct: "le stoïcisme", wrongs: ["le nihilisme", "le positivisme", "le mercantilisme"], levels: ['1ere', 'terminale'], exp: "Le stoïcisme recherche la sérénité (ataraxie) par la maîtrise de ses jugements et l'accord avec la raison." },
            { q: "Dans « Gargantua » (1534), quelle vision humaniste de l'éducation François Rabelais promeut-il face à la scolastique figée ?", correct: "une éducation complète formant le corps, l'esprit critique, les langues et les sciences (« Science sans conscience n'est que ruine de l'âme »)", wrongs: ["l'apprentissage par cœur sans jamais comprendre", "l'interdiction de lire des auteurs grecs", "l'éducation réservée uniquement à l'escrime"], levels: ['1ere', 'terminale'], exp: "Rabelais célèbre la soif de savoir humaniste associée à la responsabilité morale." },
            { q: "Quel poète français du XIXe siècle a inauguré la modernité poétique avec « Les Fleurs du mal » (1857), tirant la beauté du « spleen » et de la ville ?", correct: "Charles Baudelaire", wrongs: ["Jean de La Fontaine", "Pierre de Ronsard", "Joachim du Bellay"], levels: ['1ere', 'terminale'], exp: "Baudelaire explore les correspondances sensibles et la tension entre Spleen et Idéal." },
            { q: "Quelle œuvre d'Aimé Césaire (1939) est un texte fondateur du mouvement de la « négritude » et de la critique anticoloniale ?", correct: "Cahier d'un retour au pays natal", wrongs: ["Le Rouge et le Noir", "Bel-Ami", "L'Assommoir"], levels: ['1ere', 'terminale'], exp: "Césaire y fait de la parole poétique un outil de dignité, de mémoire et d'émancipation." }
        ],

        dev_bdd: [
            // BTS SIO (SLAM & SISR) & Spé NSI
            { q: "En conception de base de données (méthode Merise), que représente le MCD ?", correct: "le Modèle Conceptuel de Données (entités, associations et cardinalités)", wrongs: ["le Module de Calcul Distribué", "la Mémoire Centrale Directe", "le Mode de Chiffrement de Disque"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le MCD se traduit ensuite en MLD (Modèle Logique de Données) puis en MPD (tables SQL)." },
            { q: "Dans une base relationnelle SQL, quel est le rôle d'une clé étrangère (FOREIGN KEY) ?", correct: "référencer la clé primaire d'une autre table et garantir l'intégrité référentielle", wrongs: ["chiffrer les mots de passe", "compresser les images JPEG", "accélérer la carte graphique"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Une clé étrangère interdit de relier une ligne à un identifiant parent inexistant." },
            { q: "En SQL, quelle commande du LDD (Langage de Définition de Données) permet de créer une nouvelle table ?", correct: "CREATE TABLE", wrongs: ["INSERT INTO", "SELECT FROM", "UPDATE SET"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "LDD : CREATE, ALTER, DROP ; LMD : SELECT, INSERT, UPDATE, DELETE." },
            { q: "Que signifie la propriété ACID d'une transaction en base de données relationnelle ?", correct: "Atomicité, Cohérence, Isolation, Durabilité", wrongs: ["Accès, Cloud, Index, Disque", "Algorithme, Code, Interface, Donnée", "Authentification, Cryptage, IP, DNS"], levels: ['bts1', 'bts2', 'terminale'], exp: "Une transaction s'exécute intégralement (COMMIT) ou pas du tout (ROLLBACK) pour garantir la fiabilité des données." },
            { q: "En modélisation UML, quel diagramme représente les classes, leurs attributs, leurs méthodes et les relations d'héritage/association ?", correct: "le diagramme de classes", wrongs: ["le diagramme de Gantt", "le diagramme de réseau physique", "le diagramme thermique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le diagramme de classes est la vue statique centrale d'un projet orienté objet." },
            { q: "Dans une architecture MVC (Modèle-Vue-Contrôleur), quel composant gère l'accès aux données et la logique métier ?", correct: "le Modèle (Model)", wrongs: ["la Vue (View)", "le fichier CSS seul", "le serveur DNS"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Modèle = données/métier ; Vue = interface utilisateur ; Contrôleur = orchestration des requêtes." },
            { q: "Quel est l'objectif principal des « tests unitaires » automatisés dans un projet logiciel BTS SIO ?", correct: "vérifier isolément le bon fonctionnement de chaque fonction ou méthode et prévenir les régressions", wrongs: ["remplacer le serveur de production", "dessiner la maquette graphique", "supprimer la base de données"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Des tests unitaires rapides garantissent qu'une modification ne casse pas un comportement existant." },
            { q: "En développement Web / API, quelle est la différence entre une base SQL (PostgreSQL, MySQL) et une base NoSQL orientée documents (MongoDB) ?", correct: "SQL utilise un schéma relationnel strict en tables ; NoSQL document stocke des objets JSON/BSON à schéma flexible", wrongs: ["NoSQL ne peut stocker que des nombres entiers", "SQL ne fonctionne jamais sur Internet", "NoSQL interdit toute recherche"], levels: ['terminale', 'bts1', 'bts2'], exp: "Le choix dépend de la structure des données, du besoin transactionnel ACID et de la montée en charge." },
            { q: "En gestion de projet agile (Scrum), comment appelle-t-on une itération courte (1 à 4 semaines) produisant un incrément logiciel fonctionnel ?", correct: "un Sprint", wrongs: ["un Firewall", "un Driver", "un Compiler"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Scrum organise le travail en Sprints rythmés par le Product Backlog, le Daily Scrum et la rétrospective." },
            { q: "En SQL, à quoi sert un INDEX sur une colonne très recherchée (ex : email) ?", correct: "accélérer considérablement les requêtes de recherche (SELECT ... WHERE) grâce à une structure de recherche rapide (B-Tree)", wrongs: ["supprimer automatiquement les anciennes lignes", "chiffrer la base en AES-256", "convertir la table en PDF"], levels: ['terminale', 'bts1', 'bts2'], exp: "L'index accélère les lectures au prix d'un léger surcoût en stockage et en écriture." },
            { q: "En JavaScript / développement moderne, à quoi sert le mot-clé « async / await » ?", correct: "écrire du code asynchrone (Promesses, appels fetch) de manière lisible et séquentielle sans bloquer l'interface", wrongs: ["arrêter définitivement le navigateur", "compiler du code C++", "supprimer les variables locales"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "await suspend l'exécution de la fonction async jusqu'à la résolution de la Promise." },
            { q: "En sécurité applicative Web (BTS SIO SLAM), quelle faille consiste à injecter du code JavaScript malveillant qui s'exécute dans le navigateur d'une victime ?", correct: "XSS (Cross-Site Scripting)", wrongs: ["RAID 5", "DHCP Spoofing", "Fragmentation IP"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "On prévient les failles XSS en échappant systématiquement toute donnée utilisateur insérée dans le HTML." },
            { q: "Dans une requête SQL, quelle est la différence entre INNER JOIN et LEFT JOIN ?", correct: "INNER JOIN ne renvoie que les lignes ayant une correspondance dans les 2 tables ; LEFT JOIN garde toutes les lignes de la table de gauche", wrongs: ["LEFT JOIN supprime la table de droite", "INNER JOIN ne fonctionne qu'avec 1 table", "les deux renvoient toujours le même résultat"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Avec LEFT JOIN, les colonnes sans correspondance à droite prennent la valeur NULL." },
            { q: "En POO, à quoi sert le « constructeur » d'une classe (ex : __init__ en Python, constructor en JS/PHP) ?", correct: "initialiser les attributs d'un nouvel objet au moment de son instanciation", wrongs: ["détruire toute la base SQL", "envoyer un e-mail automatique", "trier les fichiers sur le disque"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le constructeur est appelé automatiquement lors de la création d'une instance (new MaClasse())." },
            { q: "En DevOps / CI-CD (BTS SIO), que signifie l'acronyme CI ?", correct: "Continuous Integration (Intégration Continue : compilation et exécution automatique des tests à chaque commit)", wrongs: ["Code Interdit", "Circuit Imprimé", "Copie Manuelle"], levels: ['terminale', 'bts1', 'bts2'], exp: "La CI détecte très tôt les bugs et régressions avant la mise en production (CD)." },
            { q: "À quoi sert un ORM (Object-Relational Mapping, ex : Doctrine, Prisma, Hibernate) ?", correct: "faire correspondre automatiquement les objets du code et les tables de la base de données relationnelle", wrongs: ["remplacer le câble Ethernet", "compresser les vidéos MP4", "gérer les imprimantes réseau"], levels: ['bts1', 'bts2'], exp: "L'ORM simplifie le CRUD et utilise des requêtes paramétrées qui protègent contre les injections SQL." },
            { q: "En normalisation relationnelle (1FN, 2FN, 3FN), quel est le but principal des formes normales ?", correct: "éviter la redondance des données et les anomalies de mise à jour, d'insertion ou de suppression", wrongs: ["dupliquer chaque adresse dans 10 tables", "supprimer toutes les clés primaires", "stocker toute la base dans une seule cellule texte"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Une base bien normalisée (3FN) garantit cohérence, intégrité et maintenabilité." },
            { q: "Que permet la conteneurisation avec Docker dans le déploiement d'applications BTS SIO ?", correct: "empaqueter une application et toutes ses dépendances dans un conteneur portable et reproductible sur n'importe quel serveur", wrongs: ["remplacer le langage HTML", "augmenter la tension du secteur", "supprimer l'authentification des utilisateurs"], levels: ['terminale', 'bts1', 'bts2'], exp: "Docker garantit un environnement identique entre le poste de développement et le serveur de production." }
        ],

        commerce: [
            // BTS MCO : Relation Client, Merchandising & Management d'Unité Commerciale
            { q: "En BTS MCO, que désigne la « zone de chalandise » d'un point de vente ?", correct: "l'aire géographique d'où provient l'essentiel des clients actuels et potentiels du magasin", wrongs: ["l'entrepôt de stockage en arrière-boutique", "le rayon des promotions uniquement", "la salle de pause des vendeurs"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Elle se découpe en zones primaire, secondaire et tertiaire à l'aide de courbes isochrones (temps de trajet)." },
            { q: "En merchandising (marchandisage), quel niveau de présentation en rayon est le plus vendeur pour les produits à forte marge ?", correct: "le niveau des yeux (et des mains)", wrongs: ["le niveau du sol uniquement", "tout en haut hors d'atteinte", "dans la réserve fermée"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les clients repèrent d'abord les produits placés à hauteur des yeux et saisissent facilement ceux à hauteur des mains." },
            { q: "Quelle méthode classique structure un entretien de vente conseil en magasin ?", correct: "la méthode des 4C / SBAM + Découverte (SONCAS) + Argumentation (CAP) + Traitement des objections + Conclusion", wrongs: ["forcer l'achat sans écouter le client", "donner le prix puis quitter le rayon", "ignorer toutes les questions du client"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "SBAM = Sourire, Bonjour, Au revoir, Merci ; découverte des besoins puis argumentation ciblée." },
            { q: "Dans la typologie commerciale SONCAS (ou SONCASE), quelles motivations d'achat sont regroupées ?", correct: "Sécurité, Orgueil, Nouveauté, Confort, Argent, Sympathie (+ Écologie)", wrongs: ["Stock, Ordre, Numéro, Caisse, Achat, Sortie", "Salaire, Objectif, Norme, Contrat, Annexe, Stage", "Soleil, Océan, Neige, Climat, Air, Saison"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Identifier le mobile d'achat dominant du client permet de personnaliser l'argumentaire CAP." },
            { q: "Que signifie la méthode d'argumentation commerciale « CAP » ?", correct: "Caractéristique, Avantage, Preuve", wrongs: ["Coût, Achat, Profit", "Client, Accueil, Paiement", "Catalogue, Affiche, Prix"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "On présente une caractéristique technique, l'avantage concret pour le client et une preuve (démonstration, label, avis)." },
            { q: "En gestion d'unité commerciale, qu'est-ce que la « démarque inconnue » ?", correct: "la perte de stock non expliquée (vols internes/externes, erreurs administratives ou de caisse)", wrongs: ["les articles volontairement soldés à −50 %", "les produits périmés enregistrés et jetés", "les échantillons offerts aux clients"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "À distinguer de la démarque connue (casse, péremption, dons enregistrés)." },
            { q: "Que mesure le « NPS » (Net Promoter Score) en relation client ?", correct: "la propension des clients à recommander la marque ou le magasin à leur entourage", wrongs: ["le nombre de palettes livrées par camion", "le salaire brut des conseillers", "le taux de TVA réduit"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "NPS = % Promoteurs (notes 9-10) − % Détracteurs (notes 0-6)." },
            { q: "En merchandising, comment appelle-t-on une extrémité de rayon très visible utilisée pour mettre en avant des promotions ?", correct: "une tête de gondole (TG)", wrongs: ["un fond de réserve", "un quai de déchargement", "un linéaire mort"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "La tête de gondole booste fortement les achats d'impulsion et les mises en avant saisonnières." },
            { q: "Quelle est la différence entre le « cross-selling » (vente croisée) et l'« up-selling » (montée en gamme) ?", correct: "cross-selling = proposer un produit complémentaire ; up-selling = proposer un modèle supérieur plus performant", wrongs: ["cross-selling consiste à refuser la vente", "up-selling baisse toujours le panier moyen", "les deux techniques sont illégales"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Exemples : coque avec un smartphone (cross-selling) ; modèle 256 Go au lieu de 128 Go (up-selling)." },
            { q: "En retail omnicanal, que désigne le comportement « ROPO » (Research Online, Purchase Offline) ?", correct: "le client se renseigne sur Internet puis vient acheter le produit en magasin physique", wrongs: ["le client achète uniquement par courrier postal", "le magasin refuse tout site web", "le produit est livré sans paiement"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le ROPO (ou web-to-store) souligne l'importance d'un site web bien renseigné pour générer du trafic en boutique." },
            { q: "Dans la gestion de l'assortiment d'un magasin, que désigne la « largeur » de l'assortiment ?", correct: "le nombre de familles de produits (besoins différents) proposées par le point de vente", wrongs: ["la largeur physique en mètres des allées", "le nombre de références au sein d'une seule famille", "le poids des cartons en stock"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Largeur = nombre de familles ; Profondeur = nombre de choix (tailles, marques, modèles) par famille." },
            { q: "Quel indicateur mesure la rapidité avec laquelle un stock est renouvelé sur une période donnée ?", correct: "le coefficient de rotation des stocks", wrongs: ["le taux de transformation", "le panier moyen", "le taux d'absentéisme"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Une forte rotation évite l'immobilisation de trésorerie et le risque d'invendus ou d'obsolescence." },
            { q: "En management d'équipe commerciale (BTS MCO), que signifie un objectif « SMART » ?", correct: "Spécifique, Mesurable, Atteignable, Réaliste, Temporellement défini", wrongs: ["Simple, Manuel, Automatique, Rapide, Total", "Secret, Minimal, Aléatoire, Rare, Tardif", "Saisonnier, Mensuel, Annuel, Régional, Technique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Fixer des objectifs SMART clarifie les attentes et motive efficacement l'équipe de vente." },
            { q: "Que désigne le « facing » (frontale) en gestion de linéaire ?", correct: "le nombre d'exemplaires d'un même produit visibles directement en façade sur la première rangée d'une étagère", wrongs: ["la vitrine extérieure donnant sur la rue", "le badge nominatif du vendeur", "la caméra de vidéosurveillance"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un minimum de 2 à 3 facings (environ 30-50 cm) est souvent nécessaire pour être bien perçu par le client." },
            { q: "En relation client, quelle est la différence entre prospection et fidélisation ?", correct: "la prospection vise à conquérir de nouveaux clients ; la fidélisation vise à retenir et développer les clients existants", wrongs: ["la fidélisation consiste à augmenter les prix pour les anciens clients", "la prospection s'adresse uniquement aux fournisseurs", "il est toujours moins cher de conquérir que de fidéliser"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Fidéliser un client existant coûte généralement 5 à 7 fois moins cher que d'en acquérir un nouveau." },
            { q: "Dans la loi française, qu'est-ce que le « prix psychologique » (ou prix d'acceptabilité) ?", correct: "le prix jugé acceptable par le plus grand nombre de consommateurs (ni trop cher, ni trop bas pour la qualité perçue)", wrongs: ["un prix fixé arbitrairement par l'État", "le prix minimum égal à zéro", "un prix qui change toutes les secondes"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Il s'estime par enquête auprès d'un échantillon de clients (seuil de qualité minimale et seuil de prix maximal)." },
            { q: "En droit commercial (BTS MCO), qu'est-ce que la garantie légale de conformité dont bénéficie le consommateur sur un bien neuf ?", correct: "une garantie obligatoire de 2 ans permettant réparation, remplacement ou remboursement si le produit présente un défaut", wrongs: ["une assurance payante facultative de 3 mois", "une remise de 10 % sur le prochain achat", "uniquement valable pour les entreprises B2B"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La garantie légale de conformité (Code de la consommation) protège gratuitement le consommateur pendant 2 ans." },
            { q: "Que signifie le modèle commercial « Click & Collect » ?", correct: "le client commande et paie en ligne puis retire rapidement son achat en point de vente", wrongs: ["le client paie uniquement par chèque postal", "le magasin livre uniquement par avion", "le vendeur démarche en porte-à-porte"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le Click & Collect génère du trafic additionnel en magasin et évite les frais de livraison." }
        ],

        comptabilite: [
            // BTS CG : Comptabilité, Fiscalité & Contrôle de Gestion
            { q: "En comptabilité générale française (PCG), quel est le principe fondamental de la « partie double » ?", correct: "toute écriture comptable implique au moins un compte débité et un compte crédité pour un montant total strictement égal", wrongs: ["on enregistre chaque facture deux fois pour doubler le bénéfice", "seules les dépenses en espèces sont comptabilisées", "le débit doit toujours être supérieur au crédit"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Pour chaque opération : Total Débit = Total Crédit, garantissant l'équilibre permanent de la balance et du bilan." },
            { q: "Dans le Plan Comptable Général (PCG), à quoi correspondent les comptes de classe 6 et de classe 7 ?", correct: "Classe 6 = Charges (dépenses/achats) ; Classe 7 = Produits (ventes/recettes)", wrongs: ["Classe 6 = Immobilisations ; Classe 7 = Capital social", "Classe 6 = Clients ; Classe 7 = Banques", "Classe 6 = Impôts uniquement ; Classe 7 = Salaires"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Classes 1 à 5 = comptes de bilan ; Classes 6 et 7 = comptes de gestion (compte de résultat)." },
            { q: "Dans le bilan comptable, quelle est la relation d'équilibre permanente entre l'Actif et le Passif ?", correct: "Total Actif = Total Passif", wrongs: ["Total Actif = 2 × Total Passif", "Total Actif − Total Passif = Chiffre d'affaires", "Total Passif est toujours égal à zéro"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "L'Actif (emplois) est financé intégralement par le Passif (ressources : capitaux propres + dettes)." },
            { q: "Dans le Plan Comptable Général, quels numéros identifient respectivement le compte « Clients » et le compte « Fournisseurs » ?", correct: "411 (Clients) et 401 (Fournisseurs)", wrongs: ["512 et 530", "101 et 164", "707 et 607"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Classe 4 = comptes de tiers : 401 Fournisseurs, 411 Clients, 445 État TVA." },
            { q: "Quel est le numéro de compte du PCG utilisé pour enregistrer les opérations sur le compte bancaire de l'entreprise ?", correct: "512 (Banques)", wrongs: ["401 (Fournisseurs)", "607 (Achats de marchandises)", "218 (Matériel)"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Classe 5 = comptes financiers : 512 Banques, 530 Caisse." },
            { q: "En comptabilité française, que désigne la « classe 2 » du Plan Comptable Général ?", correct: "les comptes d'immobilisations (biens durables destinés à rester dans l'entreprise plus d'un an)", wrongs: ["les ventes de marchandises", "les dettes sociales", "les stocks de matières premières"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Classe 2 : immobilisations incorporelles (20), corporelles (21 : terrains, matériel) et financières (26-27)." },
            { q: "En analyse financière (BTS CG), que représente l'EBE (Excédent Brut d'Exploitation) dans les Soldes Intermédiaires de Gestion ?", correct: "la performance économique pure de l'exploitation avant dotations aux amortissements, charges financières et impôts", wrongs: ["le montant de la caisse en pièces", "le total des emprunts bancaires", "le montant total de la TVA déductible"], levels: ['terminale', 'bts1', 'bts2'], exp: "EBE = Valeur Ajoutée + Subventions d'exploitation − Impôts & taxes − Charges de personnel." },
            { q: "En fiscalité française, quel est le taux normal de TVA applicable par défaut à la majorité des biens et services ?", correct: "20 %", wrongs: ["5,5 %", "10 %", "33 %"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "En France métropolitaine : taux normal 20 %, intermédiaire 10 %, réduit 5,5 %, particulier 2,1 %." },
            { q: "Qu'est-ce qu'une « provision pour risques et charges » ou une « dépréciation » en travaux d'inventaire (principe de prudence) ?", correct: "la constatation comptable d'une perte probable ou d'une baisse de valeur non définitive (ex : créance douteuse)", wrongs: ["un bonus de chiffre d'affaires garanti", "une vente payée en avance", "un remboursement d'emprunt"], levels: ['terminale', 'bts1', 'bts2'], exp: "Le principe de prudence impose d'enregistrer les pertes probables dès qu'elles sont connues, mais jamais les gains latents." },
            { q: "En contrôle de gestion (méthode des coûts complets), quelle est la différence entre charges directes et charges indirectes ?", correct: "les charges directes s'affectent sans ambiguïté à un produit ; les charges indirectes nécessitent une clé de répartition (centres d'analyse)", wrongs: ["les charges indirectes ne sont jamais payées", "les charges directes concernent uniquement l'électricité générale", "les deux sont exclues du coût de revient"], levels: ['terminale', 'bts1', 'bts2'], exp: "Matières premières = directes ; loyer de l'usine ou administration = indirectes." },
            { q: "Que permet de vérifier l'état de « rapprochement bancaire » ?", correct: "la concordance entre le compte 512 (Banque) tenu par l'entreprise et le relevé envoyé par la banque", wrongs: ["le niveau de stock de l'entrepôt", "la conformité RGPD du site web", "le nombre de congés payés"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Il explique les décalages de dates (chèques non encore encaissés, frais bancaires non comptabilisés)." },
            { q: "Qu'est-ce que la CAF (Capacité d'Autofinancement) d'une entreprise ?", correct: "le flux potentiel de trésorerie dégagé par l'activité qui permet d'investir, rembourser les dettes ou verser des dividendes", wrongs: ["uniquement la Caisse d'Allocations Familiales", "le total des factures clients impayées", "le coût d'achat des fournitures de bureau"], levels: ['terminale', 'bts1', 'bts2'], exp: "La CAF se calcule soit à partir de l'EBE (méthode soustractive), soit du Résultat net (méthode additive)." },
            { q: "Sur une facture commerciale, dans quel ordre calcule-t-on successivement les réductions commerciales (remise, rabais) et l'escompte financier ?", correct: "d'abord les réductions commerciales (Net commercial), puis l'escompte (Net financier), puis la TVA", wrongs: ["d'abord la TVA puis les remises", "on additionne simplement tous les pourcentages", "l'escompte s'applique après le TTC"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les réductions s'appliquent en cascade : Brut → Net commercial → Net financier → + TVA = Net à payer TTC." },
            { q: "Quel document comptable obligatoire enregistre chronologiquement, jour par jour, toutes les opérations de l'entreprise ?", correct: "le livre-journal", wrongs: ["la brochure marketing", "le cahier de présence", "le catalogue fournisseurs"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le livre-journal et le grand-livre (classement par compte) sont les piliers de la tenue comptable." },
            { q: "En comptabilité analytique, comment calcule-t-on la « marge sur coût variable » (MCV) ?", correct: "MCV = Chiffre d'affaires − Coûts variables", wrongs: ["MCV = Chiffre d'affaires − Coûts fixes", "MCV = Coûts fixes + Coûts variables", "MCV = TVA collectée − TVA déductible"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La MCV doit couvrir les charges fixes ; si MCV > Charges fixes, l'entreprise est rentable." },
            { q: "En gestion de la paie (BTS CG), quelle est la différence entre le salaire brut et le salaire net à payer avant impôt ?", correct: "Salaire net = Salaire brut − Cotisations sociales salariales", wrongs: ["Salaire net = Salaire brut + Cotisations patronales", "Salaire brut est toujours inférieur au salaire net", "Salaire net = Salaire brut × 1,20"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Les cotisations salariales (retraite, CSG/CRDS, prévoyance) sont précomptées sur le brut." },
            { q: "Quelle est la principale différence entre un « avoir » (facture d'avoir) et une facture de « doit » ?", correct: "la facture de doit constate la créance du vendeur ; la facture d'avoir constate une somme due au client (retour, rabais après coup)", wrongs: ["l'avoir double le prix initial", "la facture de doit n'est jamais comptabilisée", "l'avoir est interdit en France"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "L'avoir vient en diminution de la facture initiale (retour de marchandise, erreur de prix, RRR accordé)." },
            { q: "En comptabilité de clôture, quel principe exige de rattacher à un exercice uniquement les charges et produits qui le concernent ?", correct: "le principe d'indépendance des exercices", wrongs: ["le principe d'opacité financière", "le principe de libre estimation", "le principe de double facturation"], levels: ['terminale', 'bts1', 'bts2'], exp: "On utilise pour cela les comptes de régularisation (CCA, PCA, FNP, FAE) en fin d'exercice." }
        ],

        electrotech: [
            // Bac Pro MELEC : Électrotechnique, Installations & Énergie
            { q: "En France, quelle norme régit la conception, la réalisation et la sécurité des installations électriques basse tension dans les bâtiments ?", correct: "la norme NF C 15-100", wrongs: ["la norme ISO 9001", "le protocole IEEE 802.11", "la norme NF C 10-000"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "La NF C 15-100 fixe les calibres des disjoncteurs, sections de câbles, protections différentielles et volumes de salle de bain." },
            { q: "Quel est le rôle vital d'un interrupteur différentiel haute sensibilité 30 mA dans un tableau électrique domestique ?", correct: "protéger les personnes contre les risques d'électrocution en coupant le courant dès qu'une fuite à la terre dépasse 30 mA", wrongs: ["augmenter la tension du réseau à 400 V", "mesurer la consommation en kWh", "remplacer la prise de terre"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Il compare le courant entrant (phase) et sortant (neutre) et déclenche instantanément en cas de défaut d'isolement." },
            { q: "Selon le code couleur normalisé des conducteurs électriques (NF C 15-100), quelles couleurs sont STRICTEMENT réservées au Neutre et à la Terre (PE) ?", correct: "Bleu clair pour le Neutre et Vert/Jaune pour la Terre (PE)", wrongs: ["Rouge pour la Terre et Noir pour le Neutre", "Marron pour le Neutre et Bleu pour la Phase", "Blanc pour la Terre et Gris pour le Neutre"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Bleu = Neutre, Vert/Jaune = conducteur de protection (Terre), Rouge/Marron/Noir = Phase." },
            { q: "En sécurité électrique (MELEC), quelles sont les étapes clés d'une « consignation électrique » avant travaux hors tension ?", correct: "Séparation, Condamnation (cadenas), Identification, Vérification d'Absence de Tension (VAT), Mise à la terre/court-circuit si requis", wrongs: ["Couper la lumière et toucher les fils à mains nues", "Mettre des gants en laine sans couper le disjoncteur", "Débrancher uniquement le téléviseur"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "La VAT (Vérification d'Absence de Tension) se fait avec un vérificateur normé testé juste avant et juste après." },
            { q: "Sur un réseau triphasé européen standard 230 V / 400 V, quelle est la relation entre tension composée U (entre phases) et tension simple V (phase-neutre) ?", correct: "U = V × √3 (soit 230 × 1,732 ≈ 400 V)", wrongs: ["U = V × 3", "U = V / 2", "U = V + 100"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "En triphasé équilibré 50 Hz : tension simple V = 230 V, tension composée U = 400 V." },
            { q: "En installation domestique (NF C 15-100), quelle section de câble cuivre et quel calibre max de disjoncteur protègent un circuit d'éclairage standard ?", correct: "1,5 mm² protégé par un disjoncteur de 16 A maximum (souvent 10 A)", wrongs: ["6 mm² avec 40 A", "0,5 mm² avec 32 A", "10 mm² avec 63 A"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Éclairage : 1,5 mm² (max 16 A) ; prises courantes : 1,5 mm² (16 A) ou 2,5 mm² (20 A) ; plaques cuisson : 6 mm² (32 A)." },
            { q: "Quel est le rôle d'un disjoncteur magnétothermique sur un départ électrique ?", correct: "protéger la ligne et les câbles contre les surcharges (thermique) et les courts-circuits (magnétique)", wrongs: ["transformer du courant continu en alternatif", "produire de la chaleur en hiver", "mesurer la vitesse d'un moteur"], levels: ['2nde', '1ere', 'terminale', 'bts1', 'bts2'], exp: "Le bilame thermique déclenche sur surcharge prolongée ; la bobine magnétique déclenche instantanément sur court-circuit." },
            { q: "Dans un moteur asynchrone triphasé, comment inverse-t-on simplement le sens de rotation ?", correct: "en inversant deux des trois phases d'alimentation (ex : L1 et L2)", wrongs: ["en inversant les trois phases simultanément", "en débranchant le fil de terre", "en doublant la section du câble"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Permuter deux phases inverse le sens du champ magnétique tournant dans le stator." },
            { q: "En électrotechnique, que signifie le facteur de puissance cos φ d'une installation en courant alternatif ?", correct: "le rapport entre la puissance active P (en W) et la puissance apparente S (en VA) : cos φ = P / S", wrongs: ["la température du transformateur", "le prix du kilowattheure", "la longueur du câble en mètres"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Un cos φ proche de 1 (grâce à des batteries de condensateurs) évite le surdimensionnement des câbles et pénalités réactives." },
            { q: "Quelles sont les deux configurations possibles de couplage des enroulements d'un moteur triphasé sur sa plaque à bornes ?", correct: "le couplage Étoile (Y) et le couplage Triangle (Δ)", wrongs: ["le couplage Carré et le couplage Ovale", "le couplage Série-LED et Parallel-USB", "le couplage Vertical et Oblique"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Le choix Étoile ou Triangle dépend de la tension du réseau et des tensions indiquées sur la plaque signalétique du moteur." },
            { q: "À quoi sert un « contacteur de puissance » associé à un relais thermique dans une armoire industrielle ?", correct: "commander à distance la mise en marche/arrêt d'un moteur (via une bobine basse tension) tout en le protégeant des surcharges", wrongs: ["remplacer le câble d'alimentation", "mesurer le pH de l'eau", "connecter un écran HDMI"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le circuit de commande (ex : 24 V) actionne la bobine du contacteur qui ferme les contacts de puissance (400 V)." },
            { q: "Dans la distribution publique en France (logements), quel régime de neutre (schéma de liaison à la terre) est utilisé ?", correct: "le régime TT (Neutre du transformateur à la Terre, Masses de l'installation à la Terre)", wrongs: ["le régime IT médical", "le régime sans terre", "le régime haute fréquence"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "En régime TT, le dispositif différentiel (DDR) est obligatoire pour couper dès le premier défaut d'isolement." },
            { q: "Que signifie l'indice de protection « IP65 » inscrit sur un boîtier électrique étanche ?", correct: "6 = totalement étanche aux poussières ; 5 = protégé contre les jets d'eau de toutes directions", wrongs: ["supporte 65 volts maximum", "pèse exactement 65 grammes", "garanti 65 ans"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "1er chiffre (0-6) = protection contre corps solides/poussières ; 2e chiffre (0-9) = protection contre liquides/eau." },
            { q: "En domotique et gestion technique du bâtiment (MELEC), quel bus filaire standard européen pilote éclairage, chauffage et volets ?", correct: "KNX", wrongs: ["VGA", "PS/2", "POP3"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "KNX est le standard ouvert international de l'automatisation des bâtiments (GTB/GTC)." },
            { q: "Quel est le rôle d'un « variateur de vitesse » (variateur de fréquence) sur un moteur asynchrone triphasé ?", correct: "faire varier la fréquence et la tension d'alimentation pour piloter finement la vitesse de rotation et économiser l'énergie", wrongs: ["bloquer le rotor mécaniquement", "augmenter la résistance de la terre", "remplacer le disjoncteur général"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "La vitesse de synchronisme vaut n_s = f / p : moduler la fréquence f adapte précisément la vitesse du moteur." },
            { q: "À quoi sert un « parafoudre » installé dans un tableau électrique (TGBT) ?", correct: "écouler vers la terre les surtensions transitoires dues à la foudre ou aux manœuvres réseau pour protéger les appareils", wrongs: ["attirer la foudre sur la maison", "produire de l'électricité solaire", "couper le chauffage la nuit"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Le parafoudre est obligatoire dans certaines zones à fort niveau kéraunique (orages fréquents)." },
            { q: "Quelle est la formule de la puissance active P en régime triphasé équilibré ?", correct: "P = √3 × U × I × cos φ", wrongs: ["P = U + I", "P = U / (I × √3)", "P = 3 × R × U"], levels: ['1ere', 'terminale', 'bts1', 'bts2'], exp: "Avec U la tension composée entre phases (400 V), I le courant de ligne et cos φ le facteur de puissance." },
            { q: "En sécurité électrique domestique (salle d'eau, NF C 15-100), que désigne le « volume 0 » ?", correct: "l'intérieur même de la baignoire ou du receveur de douche (aucun appareil 230 V autorisé)", wrongs: ["le couloir devant la porte", "le grenier au-dessus de la salle de bain", "la zone située à 3 mètres de la douche"], levels: ['2nde', '1ere', 'terminale', 'bts1'], exp: "Dans le volume 0, seuls des équipements TBTS 12 V max IPX7 conçus pour immersion sont admis." }
        ]
    };

    /**
     * Filtre la banque de questions pour un niveau scolaire donné.
     * Garantit un vivier riche (≥ 18 questions quand disponible) en priorisant
     * strictement la classe exacte puis le même cycle (collège ou lycée) afin
     * d'éliminer les répétitions rapides sans jamais mélanger collège et lycée.
     */
    function getQuestionsForNiveau(subjectId, niveau) {
        const fullBank = FACT_BANKS[subjectId] || [];
        const norm = normalizeNiveau(niveau);
        const band = bandForNiveau(norm);
        const collegeSet = new Set(['6eme', '5eme', '4eme', '3eme']);
        const lyceeSet = new Set(['2nde', '1ere', 'terminale', 'bts1', 'bts2']);
        const sameCycleSet = band === 'lycee' ? lyceeSet : collegeSet;

        const hasLevel = (q, target) => Array.isArray(q.levels) ? q.levels.includes(target) : q.level === target;
        const inSameCycle = (q) => {
            if (Array.isArray(q.levels)) {
                return q.levels.some(l => l === band || sameCycleSet.has(l));
            }
            return q.level === band || sameCycleSet.has(q.level);
        };

        // 1. Questions correspondant exactement à la classe
        const exact = fullBank.filter(q => hasLevel(q, norm));
        if (exact.length >= 18) return exact;

        // 2. Compléter avec les questions du même cycle (jamais l'autre cycle !) pour éviter les boucles de 3 questions
        const sameCycleExtras = fullBank.filter(q => !hasLevel(q, norm) && inSameCycle(q));
        const combined = exact.concat(sameCycleExtras);
        if (combined.length >= 4) return combined;

        // 3. Repli si la matière n'a pas de découpage fin pour ce cycle
        return combined.length > 0 ? combined : fullBank;
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
            if (subjectId === 'espagnol') return generateEspagnolLesson(index, norm, variant, rng);
            if (subjectId === 'arts') return generateArtsLesson(index, norm, variant, rng);
            if (subjectId === 'histoire') return generateHistoryLesson(index, norm, variant, rng);
            if (subjectId === 'geo') return generateGeoLesson(index, norm, variant, rng);
            if (subjectId === 'svt') return generateSvtLesson(index, norm, variant, rng);
            if (subjectId === 'physique') return generatePhysicsLesson(index, norm, variant, rng);
            if (subjectId === 'chimie') return generateChemistryLesson(index, norm, variant, rng);
            if (subjectId === 'techno' || subjectId === 'technologie') return generateTechnoLesson(index, norm, variant, rng);
            if (subjectId === 'emc') return generateEmcLesson(index, norm, variant, rng);
            if (subjectId === 'philo') return generatePhiloLesson(index, norm, variant, rng);
            if (subjectId === 'nsi') return generateNsiLesson(index, norm, variant, rng);
            if (subjectId === 'ses') return generateSesLesson(index, norm, variant, rng);
            if (subjectId === 'si') return generateSiLesson(index, norm, variant, rng);
            if (subjectId === 'msgn') return generateStmgCalcLesson(index, norm, variant, rng, 'msgn');
            if (subjectId === 'mercatique') return generateStmgCalcLesson(index, norm, variant, rng, 'mercatique');
            if (subjectId === 'i2d') return generateI2dLesson(index, norm, variant, rng);
            if (subjectId === 'sin') return generateSinLesson(index, norm, variant, rng);
            if (subjectId === 'cybersecurite') return generateCyberLesson(index, norm, variant, rng);
            if (subjectId === 'reseaux') return generateReseauxLesson(index, norm, variant, rng);
            if (subjectId === 'electronique') return generateElectroniqueLesson(index, norm, variant, rng);
            if (subjectId === 'biotech') return generateBiotechLesson(index, norm, variant, rng);
            if (subjectId === 'design') return generateDesignLesson(index, norm, variant, rng);
            if (subjectId === 'hotellerie') return generateHotellerieLesson(index, norm, variant, rng);
            if (subjectId === 'agronomie') return generateAgronomieLesson(index, norm, variant, rng);
            if (subjectId === 'spectacle') return generateSpectacleLesson(index, norm, variant, rng);
            if (subjectId === 'hlp') return generateHlpLesson(index, norm, variant, rng);
            if (subjectId === 'dev_bdd') return generateDevBddLesson(index, norm, variant, rng);
            if (subjectId === 'commerce') return generateCommerceLesson(index, norm, variant, rng);
            if (subjectId === 'comptabilite') return generateComptabiliteLesson(index, norm, variant, rng);
            if (subjectId === 'electrotech') return generateElectrotechLesson(index, norm, variant, rng);
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

        // Deck déterministe stable par passe : parcourt TOUTE la banque avant toute répétition,
        // et décale proprement par variante (sans re-mélanger de façon aléatoire qui cause des collisions entre v0/v1/v2)
        const stride = bank.length > 5 ? 5 : 1;
        const slot = Math.floor(index / 2) + variant * stride;
        const pass = Math.floor(slot / bank.length);
        const deck = seededShuffle(bank, `${subjectId}:${norm}:bankdeck:${pass}`);
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

    /** Génère une variante distincte de toutes les questions déjà présentes dans `forbiddenSet`. */
    function generateDistinctVariant(subjectId, idx, norm, startVar, forbiddenSet) {
        let candidate = QuestionBank.generateOne(subjectId, idx, norm, startVar);
        if (!forbiddenSet || !candidate || !candidate.q || !forbiddenSet.has(candidate.q)) {
            return candidate;
        }
        for (let step = 1; step <= 24; step++) {
            const tryIdx = step <= 12 ? idx : (idx + step);
            const tryVar = startVar + step * 3;
            const next = QuestionBank.generateOne(subjectId, tryIdx, norm, tryVar);
            if (next && next.q && !forbiddenSet.has(next.q)) {
                return { ...next, title: 'Niveau ' + (idx + 1) };
            }
        }
        return candidate;
    }

    /** Attache des variantes paresseuses (lazy) garanties distinctes : 3x plus rapide au démarrage, 100 % rétrocompatible. */
    function attachLazyVariants(lesson, subjectId, index, norm) {
        if (lesson.variants && lesson.variants.length > 0) return lesson;
        let cachedVariants = null;
        Object.defineProperty(lesson, 'variants', {
            enumerable: true,
            configurable: true,
            get() {
                if (!cachedVariants) {
                    const localSet = new Set(lesson && lesson.q ? [lesson.q] : []);
                    const l1 = generateDistinctVariant(subjectId, index, norm, 1, localSet);
                    if (l1 && l1.q) localSet.add(l1.q);
                    const l2 = generateDistinctVariant(subjectId, index, norm, 2, localSet);
                    cachedVariants = [lesson, l1, l2];
                }
                return cachedVariants;
            },
            set(val) {
                cachedVariants = val;
            }
        });
        return lesson;
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
         * avec un contenu adapté au niveau scolaire (`niveau`) pour les 100 niveaux,
         * tout en évitant la répétition des questions d'un niveau ou d'une variante à l'autre.
         * Optimisé via variantes paresseuses (génération à la demande).
         */
        extend(subject, totalCount, niveau) {
            const norm = normalizeNiveau(niveau);
            const usedLevelQuestions = new Set();

            const handWritten = (subject.lessons || []).map((lesson, i) => {
                const l0 = reshuffleHandWritten(lesson, subject.id, i);
                if (l0 && l0.q) usedLevelQuestions.add(l0.q);
                return attachLazyVariants(l0, subject.id, i, norm);
            });

            const lessons = handWritten.slice();
            for (let i = lessons.length; i < totalCount; i++) {
                const l0 = generateDistinctVariant(subject.id, i, norm, 0, usedLevelQuestions);
                if (l0 && l0.q) usedLevelQuestions.add(l0.q);
                attachLazyVariants(l0, subject.id, i, norm);
                lessons.push(l0);
            }
            return { ...subject, lessons };
        },

        /**
         * Récupère une leçon / variante spécifique du niveau.
         * Si `variant >= variants.length`, génère dynamiquement une nouvelle variante inédite.
         */
        getLesson(subjectOrId, index, niveau, variant = 0) {
            const norm = normalizeNiveau(niveau);
            const subjectId = (typeof subjectOrId === 'string') ? subjectOrId : (subjectOrId ? subjectOrId.id : '');
            const subjectObj = (typeof subjectOrId === 'object' && subjectOrId !== null) ? subjectOrId : null;

            if (subjectObj && subjectObj.lessons && subjectObj.lessons[index]) {
                const lesson = subjectObj.lessons[index];
                if (lesson.variants && Array.isArray(lesson.variants) && lesson.variants.length > 0 && variant >= 0 && variant < lesson.variants.length) {
                    return lesson.variants[variant];
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

