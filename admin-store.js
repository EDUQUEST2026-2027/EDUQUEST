/* =============================================================================
   ADMIN-STORE.JS — EDUQUEST v1.19
   Couche de configuration du panneau d'administration (admin.html).

   RÔLE :
   Ce fichier stocke, valide et applique les personnalisations faites depuis
   le panneau d'administration SANS modifier le code du jeu :
     - Niveaux scolaires  → liste des classes (6ème → Terminale par défaut),
                            modifiable (ajout/renommage/bande collège-lycée).
     - Matières & leçons  → surcharge du nom/icône d'une matière existante,
                            création de matières personnalisées, édition des
                            leçons (niveaux) écrites à la main.

   FONCTIONNEMENT :
   Tout est stocké sous UNE SEULE clé localStorage : 'eduquest_admin_data'.
   - Les valeurs par défaut (7 niveaux scolaires) vivent dans ce fichier.
   - Les leçons par défaut des matières ne sont PAS dupliquées ici : elles
     sont « enregistrées » à l'exécution par app.js (registerDefaults) puis
     servies telles quelles tant que l'administrateur n'a pas écrit sa propre
     version (surcharge par matière, clé 'overrides').
   - app.js appelle AdminStore.applyOverrides(RAW_DASH_SUBJECTS) pour
     construire DASH_SUBJECTS avec les personnalisations appliquées.

   DÉPENDANCE : aucune (localStorage uniquement). À charger AVANT app.js.
   ============================================================================= */

const AdminStore = (() => {

    /* -----------------------------------------------------------------------
       CONSTANTES
       ----------------------------------------------------------------------- */

    // Clé localStorage unique pour toute la configuration administrateur
    const LS_KEY = 'eduquest_admin_data';

    // Niveaux scolaires par défaut (identiques à jouer.html) : id stable
    // (utilisé dans DB.setNiveau et les clés de progression), label affiché,
    // bande de contenu collège/lycée (voir QuestionBank.bandForNiveau).
    const DEFAULT_LEVELS = [
        { id: '6eme',      label: '6ème',      band: 'college' },
        { id: '5eme',      label: '5ème',      band: 'college' },
        { id: '4eme',      label: '4ème',      band: 'college' },
        { id: '3eme',      label: '3ème',      band: 'college' },
        { id: '2nde',      label: '2nde',      band: 'lycee' },
        { id: '1ere',      label: '1ère',      band: 'lycee' },
        { id: 'terminale', label: 'Terminale', band: 'lycee' },
    ];

    // Types de leçons pris en charge par quiz-engine.js
    const LESSON_TYPES = ['qcm', 'vrai_faux', 'reponse_courte', 'texte_a_trous', 'drag_and_drop'];

    // Catalogue des articles par défaut de la boutique (Halos, Personnages, Titres, Thèmes, Boosters)
    const DEFAULT_SHOP_ITEMS = [
        // --- HALOS & AURAS ---
        { id: 'aurore', name: 'Aurore Boréale', category: 'aura', color: '#4fd8c4', cost: 0, desc: 'Lueur polaire chatoyante offerte à tous les élèves.' },
        { id: 'or', name: 'Comète Dorée', category: 'aura', color: '#c8a84b', cost: 60, desc: 'Rayonnement étincelant d\'or pur.' },
        { id: 'ametiste', name: 'Nova Améthyste', category: 'aura', color: '#b685f5', cost: 90, desc: 'Éclats mystiques de cristaux violets.' },
        { id: 'rose', name: 'Étoile Rose', category: 'aura', color: '#f58fc2', cost: 130, desc: 'Halo scintillant rose poudré.' },
        { id: 'braise', name: 'Braise Cosmique', category: 'aura', color: '#f5714f', cost: 170, desc: 'Ferveur ardente et braises solaires.' },
        { id: 'neon', name: 'Éclair Néon', category: 'aura', color: '#00ffcc', cost: 250, desc: 'Impulsion électrique cyberpunk hyper-lumineuse.' },
        { id: 'magma', name: 'Flamboiement Magma', category: 'aura', color: '#ff3300', cost: 300, desc: 'Puissance volcanique incandescente.' },
        { id: 'nebuleuse', name: 'Nébuleuse Profonde', category: 'aura', color: '#8a2be2', cost: 350, desc: 'Vortex stellaire aux teintes cosmiques.' },
        { id: 'supernova', name: 'Supernova Suprême', category: 'aura', color: '#ffd700', cost: 450, desc: 'Explosion d\'énergie céleste aveuglante.' },
        { id: 'dragon-aura', name: 'Flamme du Dragon', category: 'aura', color: '#00e5ff', cost: 600, desc: 'Aura mythique d\'azur et de flammes spectrales.' },

        // --- PERSONNAGES & AVATARS ---
        { id: 'robot', name: 'Robot Assistant', category: 'avatar', color: '#8fb8c9', img: 'Image/personnages/robot.webp', cost: 0, desc: 'Le fidèle compagnon d\'aventure mécanique.' },
        { id: 'einstein', name: 'Albert Einstein', category: 'avatar', color: '#7fb3d5', img: 'Image/personnages/einstein.webp', cost: 150, desc: 'Le génie de la physique et de la relativité.' },
        { id: 'marie-curie', name: 'Marie Curie', category: 'avatar', color: '#6bca82', img: 'Image/personnages/marie-curie.webp', cost: 150, desc: 'Pionnière de la radioactivité et double Prix Nobel.' },
        { id: 'christophe-colomb', name: 'Christophe Colomb', category: 'avatar', color: '#c8a84b', img: 'Image/personnages/christophe-colomb.webp', cost: 200, desc: 'Grand navigateur et explorateur des océans.' },
        { id: 'lovelace', name: 'Ada Lovelace', category: 'avatar', color: '#ff66b2', img: 'Image/personnages/lovelace.webp', cost: 250, desc: 'Première programmeuse informatique de l\'Histoire.' },
        { id: 'pythagore', name: 'Pythagore', category: 'avatar', color: '#ffd166', img: 'Image/personnages/pythagore.webp', cost: 300, desc: 'Maître des triangles, des nombres et de l\'harmonie.' },
        { id: 'davinci', name: 'Léonard de Vinci', category: 'avatar', color: '#a8dadc', img: 'Image/personnages/davinci.webp', cost: 350, desc: 'Polymathe universel, artiste et inventeur de génie.' },
        { id: 'hugo', name: 'Victor Hugo', category: 'avatar', color: '#457b9d', img: 'Image/personnages/hugo.webp', cost: 350, desc: 'Géant de la littérature française et de la poésie.' },
        { id: 'astronaute', name: 'Astronaute Céleste', category: 'avatar', color: '#f1faee', img: 'Image/personnages/astronaute.webp', cost: 400, desc: 'Pionnier du cosmos bravant le vide interstellaire.' },
        { id: 'mage', name: 'Archimage du Savoir', category: 'avatar', color: '#9d4edd', img: 'Image/personnages/mage.webp', cost: 500, desc: 'Gardien des grimoires anciens et des secrets du monde.' },

        // --- TITRES HONORIFIQUES ---
        { id: 'titre-apprenti', name: '📜 Apprenti Curieux', category: 'title', color: '#64dfdf', cost: 50, desc: 'Titre honorifique affiché fièrement sur ton profil.' },
        { id: 'titre-chrono', name: '⚡ Maître du Temps', category: 'title', color: '#ffbe0b', cost: 120, desc: 'Titre réservé aux as de la rapidité en mode chrono.' },
        { id: 'titre-explorateur', name: '🌌 Explorateur Cosmique', category: 'title', color: '#7209b7', cost: 200, desc: 'Titre des grands arpenteurs des îles du savoir.' },
        { id: 'titre-erudit', name: '👑 Érudit Suprême', category: 'title', color: '#f72585', cost: 500, desc: 'La plus haute distinction académique d\'EDUQUEST.' },

        // --- THÈMES & EFFETS ---
        { id: 'theme-cyber', name: '🌐 Thème Cyber Néon', category: 'theme', color: '#00f5d4', cost: 180, desc: 'Ambiance futuriste aux teintes cyan et magenta.' },
        { id: 'theme-galaxie', name: '🌌 Thème Abysses Stellaires', category: 'theme', color: '#7b2cbf', cost: 220, desc: 'Fond spatial étoilé et nébuleuses profondes.' },
        { id: 'theme-or', name: '✨ Thème Palais Doré', category: 'theme', color: '#e0a96d', cost: 300, desc: 'Cadre impérial et dorures antiques.' },

        // --- BOOSTERS ---
        { id: 'boost-xp', name: '🧪 Potion Double XP', category: 'booster', color: '#38b000', cost: 75, desc: 'Double l\'XP gagnée au prochain niveau réussi !' },
        { id: 'boost-shield', name: '🛡️ Bouclier d\'Étoile', category: 'booster', color: '#0077b6', cost: 100, desc: 'Préserve tes 3 étoiles même en cas de première erreur.' },
    ];

    // Configuration par défaut des récompenses
    const DEFAULT_REWARDS = {
        xpBase: 15,              // XP par quiz réussi
        coinsBase: 10,           // Pièces par quiz réussi
        chronoBonusMaxXp: 15,    // Bonus max de rapidité en mode Chrono
        dailyChestCoins: 50,     // Récompense du coffre bonus quotidien
        firstTryBonusXp: 10,     // Bonus premier essai
        questRewardMultiplier: 1,// Multiplicateur récompenses des quêtes
    };

    /* -----------------------------------------------------------------------
       ÉTAT INTERNE
       ----------------------------------------------------------------------- */

    let cache = null;                 // Config chargée en mémoire
    let defaults = null;              // Matières par défaut (enregistrées par app.js)

    /** Lecture brute de la config depuis localStorage. */
    function _read() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
        catch { return null; }
    }

    /** Écriture de la config (avec cache). */
    function _write(d) {
        cache = d;
        try { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
        catch { /* quota dépassé : on reste en mémoire pour la session */ }
    }

    /** Retourne la config courante (crée la structure par défaut si absente). */
    function _data() {
        if (cache) return cache;
        const d = _read();
        if (d && d.v === 1 && d.subjects && Array.isArray(d.subjects.customs)) {
            if (!d.shop) d.shop = { overrides: {}, customs: [] };
            if (!d.rewards) d.rewards = null;
            cache = d;
        } else {
            cache = {
                v: 1,
                levels: null,
                subjects: { overrides: {}, customs: [] },
                credits: {},
                shop: { overrides: {}, customs: [] },
                rewards: null,
            };
        }
        return cache;
    }

    function _save() { _write(_data()); }

    /** Clone profond (évite toute mutation accidentelle des objets stockés). */
    function _clone(x) { return JSON.parse(JSON.stringify(x)); }

    /* -----------------------------------------------------------------------
       UTILITAIRES PUBLICS
       ----------------------------------------------------------------------- */

    /** Échappe une chaîne pour insertion HTML sécurisée. */
    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Transforme un nom en identifiant stable (slug), ex. « Sciences de la Terre » → « sciences-de-la-terre ». */
    function slug(name) {
        const s = String(name || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return s || 'matiere';
    }

    /** Propose un identifiant unique pour une nouvelle matière (sans collision). */
    function suggestSubjectId(name, takenIds) {
        const taken = new Set(takenIds || []);
        let base = slug(name);
        let id = base;
        let i = 2;
        while (taken.has(id)) id = base + '-' + (i++);
        return id;
    }

    /**
     * Valide une leçon selon son type. Retourne un message d'erreur (string)
     * ou null si la leçon est valide.
     * Type absent = QCM (compatibilité avec le format historique du jeu).
     */
    function validateLesson(lesson) {
        if (!lesson || typeof lesson !== 'object') return 'Leçon invalide.';
        const type = lesson.type || 'qcm';
        if (!LESSON_TYPES.includes(type)) return 'Type de question inconnu : ' + type;
        const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

        if (type === 'qcm') {
            if (!nonEmpty(lesson.q)) return 'La question (QCM) ne peut pas être vide.';
            if (!Array.isArray(lesson.opts) || lesson.opts.length < 2) return 'Un QCM doit proposer au moins 2 réponses.';
            if (lesson.opts.some(o => !nonEmpty(o))) return 'Les réponses proposées ne peuvent pas être vides.';
            if (new Set(lesson.opts.map(o => o.trim())).size !== lesson.opts.length) return 'Deux réponses proposées sont identiques.';
            const correct = Number(lesson.correct);
            if (!Number.isInteger(correct) || correct < 0 || correct >= lesson.opts.length)
                return 'La bonne réponse (QCM) doit pointer vers une des réponses proposées.';
            return null;
        }
        if (type === 'vrai_faux') {
            if (!nonEmpty(lesson.q)) return 'L’affirmation (Vrai/Faux) ne peut pas être vide.';
            if (typeof lesson.correct !== 'boolean') return 'La réponse (Vrai/Faux) doit être Vrai ou Faux.';
            return null;
        }
        if (type === 'reponse_courte') {
            if (!nonEmpty(lesson.q)) return 'La question (réponse courte) ne peut pas être vide.';
            if (!Array.isArray(lesson.accepted) || lesson.accepted.length === 0 || lesson.accepted.some(a => !nonEmpty(a)))
                return 'Précisez au moins une réponse acceptée (réponse courte).';
            return null;
        }
        if (type === 'texte_a_trous') {
            if (!nonEmpty(lesson.textWithBlanks)) return 'La phrase à compléter ne peut pas être vide.';
            const count = (lesson.textWithBlanks.match(/_{3,}/g) || []).length;
            if (count === 0) return 'La phrase doit contenir au moins un trou (___).';
            if (!Array.isArray(lesson.blanks) || lesson.blanks.length !== count)
                return 'Il faut exactement ' + count + ' groupe(s) de réponses (un par trou ___ ).';
            if (lesson.blanks.some(b => !Array.isArray(b) || b.length === 0 || b.some(a => !nonEmpty(a))))
                return 'Chaque trou doit accepter au moins une réponse.';
            return null;
        }
        // drag_and_drop (association)
        if (!nonEmpty(lesson.q)) return 'La consigne (association) ne peut pas être vide.';
        if (!Array.isArray(lesson.items) || lesson.items.length < 2) return 'Il faut au moins 2 éléments à associer.';
        if (!Array.isArray(lesson.targets) || lesson.targets.length < 2) return 'Il faut au moins 2 cibles d’association.';
        if (lesson.items.some(i => !nonEmpty(i)) || lesson.targets.some(t => !nonEmpty(t)))
            return 'Les éléments et cibles ne peuvent pas être vides.';
        if (lesson.items.length !== lesson.targets.length)
            return 'Le nombre d’éléments doit être égal au nombre de cibles (association par position).';
        if (new Set(lesson.items).size !== lesson.items.length) return 'Deux éléments sont identiques.';
        if (new Set(lesson.targets).size !== lesson.targets.length) return 'Deux cibles sont identiques.';
        return null;
    }

    /** Ramène une leçon à sa forme canonique (type explicite, champs utiles). */
    function normalizeLesson(lesson) {
        const l = { ...(lesson || {}) };
        l.type = l.type || 'qcm';
        l.title = (typeof l.title === 'string' && l.title.trim()) ? l.title.trim() : '';
        l.q = typeof l.q === 'string' ? l.q.trim() : '';
        l.exp = typeof l.exp === 'string' ? l.exp.trim() : '';
        if (l.type === 'qcm') {
            l.opts = (l.opts || []).map(o => String(o).trim());
            l.correct = Number(l.correct);
        } else if (l.type === 'vrai_faux') {
            delete l.opts; delete l.correctIndex;
        } else if (l.type === 'reponse_courte') {
            l.accepted = (l.accepted || []).map(a => String(a).trim());
        } else if (l.type === 'texte_a_trous') {
            l.textWithBlanks = l.textWithBlanks || '';
            l.blanks = (l.blanks || []).map(b => (Array.isArray(b) ? b : [b]).map(a => String(a).trim()));
        } else if (l.type === 'drag_and_drop') {
            l.items = (l.items || []).map(i => String(i).trim());
            l.targets = (l.targets || []).map(t => String(t).trim());
            l.pairs = l.pairs || {};
        }
        return l;
    }

    /* -----------------------------------------------------------------------
       NIVEAUX SCOLAIRES
       ----------------------------------------------------------------------- */

    /** Liste effective des niveaux scolaires (config admin OU valeurs par défaut). */
    function getLevels() {
        const stored = _data().levels;
        const list = stored ? _clone(stored) : _clone(DEFAULT_LEVELS);
        return list.map(l => ({
            id: l.id,
            label: l.label || l.name || l.id,
            name: l.label || l.name || l.id,
            band: l.band || 'college'
        }));
    }

    /** true si l'administrateur a personnalisé la liste des niveaux. */
    function levelsModified() {
        return _data().levels !== null;
    }

    /** Bande de contenu ('college' | 'lycee') d'un id de niveau, ou null. */
    function levelBand(niveauId) {
        if (!niveauId) return null;
        const found = getLevels().find(l => l.id === niveauId);
        return found ? (found.band === 'lycee' ? 'lycee' : 'college') : null;
    }

    /** Label affiché d'un id de niveau (ou l'id si inconnu). */
    function levelLabel(niveauId) {
        if (!niveauId) return '';
        const found = getLevels().find(l => l.id === niveauId);
        return found ? (found.label || found.name || found.id) : niveauId;
    }

    /** Valide et enregistre la liste des niveaux scolaires. */
    function saveLevels(list) {
        if (!Array.isArray(list) || list.length === 0) return { ok: false, error: 'Il faut au moins un niveau scolaire.' };
        const ids = new Set();
        const labels = new Set();
        for (const l of list) {
            if (!l || typeof l.id !== 'string' || !l.id.trim() || !/^[a-z0-9_-]+$/i.test(l.id))
                return { ok: false, error: 'Identifiant de niveau invalide (lettres, chiffres, tirets uniquement).' };
            if (ids.has(l.id)) return { ok: false, error: 'Identifiant en double : ' + l.id };
            ids.add(l.id);
            if (typeof l.label !== 'string' || !l.label.trim()) return { ok: false, error: 'Libellé de niveau vide.' };
            labels.add(l.label.trim());
            if (l.band !== 'college' && l.band !== 'lycee') return { ok: false, error: 'Bande invalide pour ' + l.id + '.' };
        }
        _data().levels = list.map(l => ({ id: l.id.trim(), label: l.label.trim(), band: l.band }));
        _save();
        return { ok: true };
    }

    /** Revient aux niveaux scolaires par défaut. */
    function resetLevels() {
        _data().levels = null;
        _save();
    }

    /* -----------------------------------------------------------------------
       CRÉDITS DU CRÉATEUR
       -----------------------------------------------------------------------
       Textes affichés sur toutes les pages (footer) et utilisés par la page
       légale (legal.html). Modifiables depuis le panneau d'administration.
       ----------------------------------------------------------------------- */

    // Valeurs par défaut : l'objet gardé en mémoire est écrasé par les valeurs
    // personnalisées, mais resetCredits() restaure ces références d'origine.
    const DEFAULT_CREDITS = {
        studioName: 'EDUQUEST',
        tagline: 'Apprendre en s\u2019amusant',
        creatorName: 'L\u2019\u00e9quipe EDUQUEST',
        contactEmail: '',
        website: '',
        extraNote: '',
    };

    const CREDIT_TEXT_FIELDS = ['studioName', 'tagline', 'creatorName', 'contactEmail', 'website', 'extraNote'];

    function cloneDefaults() { return _clone(DEFAULT_CREDITS); }

    /** Crédits effectifs (personnalisés par-dessus les valeurs par défaut). */
    function getCredits() {
        return Object.assign(cloneDefaults(), (_data().credits || {}));
    }

    /** true si au moins un champ de crédit a été personnalisé. */
    function creditsModified() {
        const c = _data().credits;
        return Boolean(c) && Object.keys(c).length > 0;
    }

    /**
     * Valide et enregistre les crédits. Les champs inconnus sont ignorés,
     * les champs connus sont trimés ; '' remet un champ à sa valeur par défaut.
     */
    function saveCredits(values) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Donn\u00e9es de cr\u00e9dits invalides.' };
        const clean = {};
        for (const key of CREDIT_TEXT_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(values, key)) {
                const v = String(values[key] == null ? '' : values[key]).trim();
                if (v.length > 300) return { ok: false, error: 'Le champ « ' + key + ' » ne peut pas d\u00e9passer 300 caract\u00e8res.' };
                clean[key] = v;
            }
        }
        _data().credits = clean;
        _save();
        return { ok: true, credits: getCredits() };
    }

    /** Restaure les crédits par défaut. */
    function resetCredits() {
        _data().credits = {};
        _save();
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : REGISTRE DES DÉFAUTS (enregistré par app.js)
       ----------------------------------------------------------------------- */

    /**
     * Enregistre une copie des matières par défaut (RAW_DASH_SUBJECTS).
     * Appelé une seule fois par app.js au chargement. Ces matières ne sont
     * pas dupliquées dans localStorage : seule leur surcharge est stockée.
     */
    function registerDefaults(rawSubjects) {
        if (defaults || !Array.isArray(rawSubjects)) return;
        defaults = {};
        rawSubjects.forEach(s => {
            defaults[s.id] = {
                id: s.id,
                name: s.name,
                icon: s.icon,
                lessons: _clone(s.lessons || []),
            };
        });
    }

    /** Matières par défaut enregistrées (pour le panneau d'administration). */
    function getDefaultSubjects() {
        return defaults ? Object.keys(defaults).map(id => _clone(defaults[id])) : [];
    }

    function getDefaultSubject(id) {
        return defaults && defaults[id] ? _clone(defaults[id]) : null;
    }

    function isCustom(id) {
        return _data().subjects.customs.some(c => c.id === id);
    }

    /** true si une surcharge (nom/icône/leçons) existe pour cette matière. */
    function hasOverride(id) {
        return Object.prototype.hasOwnProperty.call(_data().subjects.overrides, id);
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : APPLICATION DES SURCHARGES (appelé par app.js)
       ----------------------------------------------------------------------- */

    /**
     * Applique les personnalisations administrateur sur la liste brute des
     * matières et retourne la liste effective (ordre préservé, matières
     * personnalisées ajoutées à la fin).
     * Les matières personnalisées sont marquées `_custom: true` : app.js ne
     * leur applique PAS QuestionBank.extend (pas de banque de contenu propre),
     * leurs leçons sont exactement celles écrites dans le panneau.
     */
    function applyOverrides(rawSubjects) {
        const data = _data();
        const result = rawSubjects.map(raw => {
            const ov = data.subjects.overrides[raw.id];
            if (!ov) return raw; // matière non personnalisée → telle quelle
            const out = _clone(raw);
            if (typeof ov.name === 'string' && ov.name.trim()) out.name = ov.name.trim();
            if (typeof ov.icon === 'string' && ov.icon.trim()) out.icon = ov.icon.trim();
            if (Array.isArray(ov.lessons) && ov.lessons.length) out.lessons = _clone(ov.lessons);
            return out;
        });
        data.subjects.customs.forEach(c => {
            result.push({
                id: c.id,
                name: c.name,
                icon: c.icon,
                lessons: _clone(c.lessons),
                _custom: true,
            });
        });
        return result;
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : OPÉRATIONS DU PANNEAU
       ----------------------------------------------------------------------- */

    /**
     * Liste « éditable » : matières par défaut + personnalisées, chacune avec
     * ses leçons effectives (surchargées si l'admin les a modifiées). Chaque
     * entrée : { id, name, icon, isCustom, customized, lessons }.
     */
    function listEditable(rawSubjects) {
        const data = _data();
        const out = (Array.isArray(rawSubjects) ? rawSubjects : []).map(raw => {
            const ov = data.subjects.overrides[raw.id];
            return {
                id: raw.id,
                name: ov && ov.name ? ov.name : raw.name,
                icon: ov && ov.icon ? ov.icon : raw.icon,
                isCustom: false,
                customized: Boolean(ov),
                lessons: ov && Array.isArray(ov.lessons) && ov.lessons.length ? _clone(ov.lessons) : _clone(raw.lessons || []),
            };
        });
        data.subjects.customs.forEach(c => {
            out.push({
                id: c.id,
                name: c.name,
                icon: c.icon,
                isCustom: true,
                customized: true,
                lessons: _clone(c.lessons),
            });
        });
        return out;
    }

    /** Applique un renommage / changement d'icône (matière système ou personnalisée). */
    function saveSubjectMeta(id, { name, icon } = {}) {
        if (!id) return { ok: false, error: 'Identifiant de matière manquant.' };
        const data = _data();
        const nameV = typeof name === 'string' ? name.trim() : '';
        const iconV = typeof icon === 'string' ? icon.trim() : '';
        if (nameV === '' && iconV === '') return { ok: false, error: 'Renseignez au moins un nom ou une icône.' };

        const custom = data.subjects.customs.find(c => c.id === id);
        if (custom) {
            if (nameV) custom.name = nameV;
            if (iconV) custom.icon = iconV;
            _save();
            return { ok: true };
        }
        // Matière système → on travaille dans les surcharges
        const ov = data.subjects.overrides[id] || (data.subjects.overrides[id] = {});
        if (nameV) ov.name = nameV;
        if (iconV) ov.icon = iconV;
        _save();
        return { ok: true };
    }

    /** Enregistre la liste complète des leçons d'une matière (système ou personnalisée). */
    function saveLessons(id, lessons) {
        if (!Array.isArray(lessons) || lessons.length === 0) return { ok: false, error: 'Il faut au moins une leçon.' };
        const clean = lessons.map(l => normalizeLesson(l));
        for (let i = 0; i < clean.length; i++) {
            const err = validateLesson(clean[i]);
            if (err) return { ok: false, error: 'Leçon ' + (i + 1) + ' : ' + err };
        }
        const data = _data();
        const custom = data.subjects.customs.find(c => c.id === id);
        if (custom) {
            custom.lessons = clean;
        } else {
            const ov = data.subjects.overrides[id] || (data.subjects.overrides[id] = {});
            ov.lessons = clean;
        }
        _save();
        return { ok: true, lessons: clean };
    }

    /** Crée une matière personnalisée (avec une première leçon vide à compléter). */
    function createCustomSubject(name, icon, firstLesson) {
        const nameV = typeof name === 'string' ? name.trim() : '';
        if (!nameV) return { ok: false, error: 'Donnez un nom à la matière.' };
        const data = _data();
        const taken = Object.keys(data.subjects.overrides)
            .concat(data.subjects.customs.map(c => c.id))
            .concat(defaults ? Object.keys(defaults) : []);
        const id = suggestSubjectId(nameV, taken);
        const lesson = firstLesson || {
            type: 'qcm',
            title: 'Niveau 1',
            q: 'Modifiez cette question depuis le panneau d’administration.',
            opts: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'],
            correct: 0,
            exp: '',
        };
        const clean = normalizeLesson(lesson);
        const err = validateLesson(clean);
        if (err) return { ok: false, error: err };
        data.subjects.customs.push({ id, name: nameV, icon: (icon || '📘').trim(), lessons: [clean] });
        _save();
        return { ok: true, id };
    }

    /** Supprime une matière personnalisée (définitif). */
    function deleteCustomSubject(id) {
        const data = _data();
        const idx = data.subjects.customs.findIndex(c => c.id === id);
        if (idx === -1) return { ok: false, error: 'Matière personnalisée introuvable.' };
        data.subjects.customs.splice(idx, 1);
        _save();
        return { ok: true };
    }

    /** Retire TOUTES les surcharges d'une matière système (retour à l'original). */
    function resetSubject(id) {
        if (isCustom(id)) return { ok: false, error: 'Utilisez la suppression pour une matière personnalisée.' };
        const data = _data();
        delete data.subjects.overrides[id];
        _save();
        return { ok: true };
    }

    /* -----------------------------------------------------------------------
       BOUTIQUE (GESTION DES ARTICLES)
       ----------------------------------------------------------------------- */

    /** Liste effective des articles de la boutique (défauts + surcharges + customs). */
    function getShopItems() {
        const data = _data();
        const overrides = (data.shop && data.shop.overrides) ? data.shop.overrides : {};
        const customs = (data.shop && Array.isArray(data.shop.customs)) ? data.shop.customs : [];

        const merged = DEFAULT_SHOP_ITEMS.map(def => {
            const ov = overrides[def.id];
            if (!ov) return _clone(def);
            if (ov.deleted) return null; // Article système masqué/supprimé
            return Object.assign(_clone(def), ov);
        }).filter(Boolean);

        customs.forEach(c => {
            if (!c.deleted) {
                merged.push(Object.assign(_clone(c), { _custom: true }));
            }
        });

        return merged;
    }

    function getShopItem(id) {
        return getShopItems().find(item => item.id === id) || null;
    }

    /** Valide et sauvegarde un article de boutique (système ou personnalisé). */
    function saveShopItem(item) {
        if (!item || typeof item !== 'object') return { ok: false, error: 'Article invalide.' };
        const id = String(item.id || '').trim();
        const name = String(item.name || '').trim();
        const category = ['aura', 'avatar', 'title', 'theme', 'booster'].includes(item.category) ? item.category : 'aura';
        const cost = Math.max(0, parseInt(item.cost || 0, 10) || 0);
        const color = String(item.color || '#c8a84b').trim();
        const img = item.img ? String(item.img).trim() : '';
        const desc = item.desc ? String(item.desc).trim() : '';
        const disabled = Boolean(item.disabled);

        if (!name) return { ok: false, error: 'Le nom de l\'article est obligatoire.' };

        const data = _data();
        if (!data.shop) data.shop = { overrides: {}, customs: [] };

        const isDefault = DEFAULT_SHOP_ITEMS.some(d => d.id === id);
        if (isDefault) {
            data.shop.overrides[id] = { id, name, category, cost, color, img, desc, disabled, deleted: false };
        } else {
            const cleanId = id || slug(name);
            const idx = data.shop.customs.findIndex(c => c.id === cleanId);
            const entry = { id: cleanId, name, category, cost, color, img, desc, disabled, deleted: false, _custom: true };
            if (idx >= 0) {
                data.shop.customs[idx] = entry;
            } else {
                data.shop.customs.push(entry);
            }
        }
        _save();
        return { ok: true, item: getShopItem(id) };
    }

    /** Supprime un article personnalisé ou masque un article système. */
    function deleteShopItem(id) {
        if (!id) return { ok: false, error: 'Identifiant manquant.' };
        const data = _data();
        if (!data.shop) data.shop = { overrides: {}, customs: [] };

        const isDefault = DEFAULT_SHOP_ITEMS.some(d => d.id === id);
        if (isDefault) {
            data.shop.overrides[id] = { deleted: true };
        } else {
            const idx = data.shop.customs.findIndex(c => c.id === id);
            if (idx >= 0) data.shop.customs.splice(idx, 1);
        }
        _save();
        return { ok: true };
    }

    /** Réinitialise la boutique aux articles par défaut. */
    function resetShopItems() {
        const data = _data();
        data.shop = { overrides: {}, customs: [] };
        _save();
    }

    /* -----------------------------------------------------------------------
       RÉCOMPENSES & PROGRESSION
       ----------------------------------------------------------------------- */

    /** Configuration effective des récompenses (personnalisée ou par défaut). */
    function getRewardsConfig() {
        const data = _data();
        return Object.assign(_clone(DEFAULT_REWARDS), data.rewards || {});
    }

    /** Sauvegarde la configuration des récompenses. */
    function saveRewardsConfig(values) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Configuration invalide.' };
        const clean = {
            xpBase: Math.max(1, parseInt(values.xpBase, 10) || DEFAULT_REWARDS.xpBase),
            coinsBase: Math.max(0, parseInt(values.coinsBase, 10) || DEFAULT_REWARDS.coinsBase),
            chronoBonusMaxXp: Math.max(0, parseInt(values.chronoBonusMaxXp, 10) || DEFAULT_REWARDS.chronoBonusMaxXp),
            dailyChestCoins: Math.max(0, parseInt(values.dailyChestCoins, 10) || DEFAULT_REWARDS.dailyChestCoins),
            firstTryBonusXp: Math.max(0, parseInt(values.firstTryBonusXp, 10) || DEFAULT_REWARDS.firstTryBonusXp),
            questRewardMultiplier: Math.max(0.1, parseFloat(values.questRewardMultiplier) || 1),
        };
        const data = _data();
        data.rewards = clean;
        _save();
        return { ok: true, rewards: getRewardsConfig() };
    }

    /** Réinitialise les récompenses aux valeurs par défaut. */
    function resetRewardsConfig() {
        const data = _data();
        data.rewards = null;
        _save();
    }

    /* -----------------------------------------------------------------------
       EXPORT / IMPORT / RÉINITIALISATION
       ----------------------------------------------------------------------- */

    /** Exporte la configuration administrateur complète (niveaux + matières + crédits + boutique + récompenses). */
    function exportJson() {
        return JSON.stringify(_data(), null, 2);
    }

    /** Importe une configuration exportée (valide la structure avant remplacement). */
    function importJson(text) {
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { return { ok: false, error: 'JSON invalide.' }; }
        if (!parsed || parsed.v !== 1 || !parsed.subjects) return { ok: false, error: 'Fichier de configuration non reconnu.' };
        if (parsed.levels !== null && !Array.isArray(parsed.levels)) return { ok: false, error: 'Structure « levels » invalide.' };
        if (parsed.levels) {
            const r = saveLevels(parsed.levels);
            if (!r.ok) return r;
        } else {
            _data().levels = null;
        }
        const overrides = (parsed.subjects.overrides && typeof parsed.subjects.overrides === 'object') ? parsed.subjects.overrides : {};
        const customs = Array.isArray(parsed.subjects.customs) ? parsed.subjects.customs : [];
        for (const c of customs) {
            if (!c || !c.id || !c.name || !Array.isArray(c.lessons) || c.lessons.length === 0)
                return { ok: false, error: 'Matière personnalisée invalide dans le fichier importé.' };
            for (const l of c.lessons) {
                const err = validateLesson(l);
                if (err) return { ok: false, error: 'Leçon invalide dans « ' + c.name + ' » : ' + err };
            }
        }
        for (const id of Object.keys(overrides)) {
            const ov = overrides[id];
            if (!ov || typeof ov !== 'object') return { ok: false, error: 'Surcharge invalide pour « ' + id + ' ».' };
            if (Array.isArray(ov.lessons)) {
                for (const l of ov.lessons) {
                    const err = validateLesson(l);
                    if (err) return { ok: false, error: 'Leçon invalide dans « ' + id + ' » : ' + err };
                }
            }
        }
        _data().subjects = { overrides: _clone(overrides), customs: _clone(customs) };
        if (parsed.credits && typeof parsed.credits === 'object') {
            const r = saveCredits(parsed.credits);
            if (!r.ok) return r;
        }
        if (parsed.shop && typeof parsed.shop === 'object') {
            _data().shop = _clone(parsed.shop);
        }
        if (parsed.rewards && typeof parsed.rewards === 'object') {
            _data().rewards = _clone(parsed.rewards);
        }
        _save();
        return { ok: true };
    }

    /** Supprime toute la configuration administrateur (niveaux + matières + boutique + récompenses). */
    function resetAll() {
        cache = null;
        try { localStorage.removeItem(LS_KEY); } catch {}
    }

    /**
     * Réinitialise les données de jeu locales de CET APPAREIL (progression,
     * options, badges, pièces, XP, niveau choisi) — les comptes membres sont
     * conservés. Retourne le nombre de clés supprimées.
     */
    function clearLocalGameData() {
        const remove = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (key === 'eduquest_options' || key === 'eduquest_niveau' || /^eduquest_.*_progress$/.test(key)) {
                    remove.push(key);
                }
            }
            remove.forEach(k => localStorage.removeItem(k));
        } catch {}
        return remove.length;
    }

    /* -----------------------------------------------------------------------
       EXPORT PUBLIC
       ----------------------------------------------------------------------- */

    return {
        // Constantes utiles à l'interface
        DEFAULT_LEVELS: _clone(DEFAULT_LEVELS),
        DEFAULT_SHOP_ITEMS: _clone(DEFAULT_SHOP_ITEMS),
        DEFAULT_REWARDS: _clone(DEFAULT_REWARDS),
        LESSON_TYPES: LESSON_TYPES.slice(),

        // Utilitaires
        esc,
        slug,
        suggestSubjectId,
        validateLesson,
        normalizeLesson,

        // Niveaux scolaires
        getLevels,
        getNiveauxScolaires: getLevels, // Alias pour app.js / dashboard
        levelsModified,
        levelBand,
        levelLabel,
        saveLevels,
        resetLevels,

        // Crédits du créateur
        getCredits,
        creditsModified,
        saveCredits,
        resetCredits,
        DEFAULT_CREDITS: cloneDefaults(),

        // Registre des défauts (app.js)
        registerDefaults,
        getDefaultSubjects,
        getDefaultSubject,

        // Application / édition des matières
        applyOverrides,
        isCustom,
        hasOverride,
        listEditable,
        saveSubjectMeta,
        saveLessons,
        createCustomSubject,
        deleteCustomSubject,
        resetSubject,

        // Boutique & Récompenses
        getShopItems,
        getShopItem,
        saveShopItem,
        deleteShopItem,
        resetShopItems,
        getRewardsConfig,
        saveRewardsConfig,
        resetRewardsConfig,

        // Export / import / réinitialisation
        exportJson,
        importJson,
        resetAll,
        clearLocalGameData,
    };
})();

// Rendu accessible aux autres scripts (app.js, admin.js…) :
if (typeof window !== 'undefined') {
    window.AdminStore = AdminStore;
}
