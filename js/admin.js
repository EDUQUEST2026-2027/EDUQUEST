/* =============================================================================
   ADMIN.JS — EDUQUEST v1.30.0
   Interface du panneau d'administration (admin.html).

   PRINCIPE :
   - Accès PROTÉGÉ : le panneau exige un compte avec le rôle « admin ».
   - Onglets (pilotage intégral) :
       • Niveaux & Filières → 9 niveaux (6e → BTS 2) et 18 filières cohérentes par niveau (AdminStore)
       • Matières & leçons  → 43 matières + personnalisées, 6 types de questions
       • Boutique & Succès  → 98 articles, 79 succès filtrés par filière, 9 quêtes
       • Membres            → comptes locaux (db.js, rôle élève/admin, XP/pièces/filière)
       • Réglages, IA & Crédits → feature flags, Multi-IA, export/import, reset
   - Toutes les saisies utilisateur sont échappées (esc) avant insertion HTML.
   - Les actions mutent l'état puis re-rendent la vue : aucun framework.

   SÉCURITÉ :
   L'accès est protégé par rôle 'admin' (db.js). Si aucun admin n'existe,
   un formulaire de création est présenté. Si un admin existe mais que la
   session courante n'est pas admin, seul le formulaire de connexion est autorisé
   et toutes les actions privilégiées sont bloquées tant que l'admin n'est pas connecté.
   ============================================================================= */

(function () {

    'use strict';

    const esc = (typeof AdminStore !== 'undefined') ? AdminStore.esc
        : (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const safeHex = (c, fb = '#c8a84b') => {
        const s = typeof c === 'string' ? c.trim() : '';
        return /^#[0-9a-f]{6}$/i.test(s) ? s : fb;
    };

    const isSafeImgUrl = (raw) => {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!s) return false;
        if (/^(javascript|vbscript|file):/i.test(s) || s.startsWith('//')) return false;
        if (/^data:/i.test(s)) {
            return /^data:image\/(png|webp|jpeg|jpg|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(s);
        }
        return s.startsWith('https://') || s.startsWith('http://') || s.startsWith('Image/') || s.startsWith('/Image/')
            || /^[a-z0-9_-]+\.(png|webp|svg|jpg|jpeg)$/i.test(s);
    };

    const ico = (name, size = 16, tone = '') => (window.EduIcons ? window.EduIcons.svg(name, { size, tone }) : '');
    const emoIco = (emoji, size = 18, tone = '') => (window.EduIcons ? window.EduIcons.fromEmoji(emoji, { size, tone }) : esc(emoji || ''));

    const LESSON_LABELS = {
        qcm: 'QCM',
        vrai_faux: 'Vrai / Faux',
        reponse_courte: 'Réponse courte',
        texte_a_trous: 'Texte à trous',
        texte_a_choix: 'Texte à choix',
        drag_and_drop: 'Association',
    };
    const LESSON_ORDER = ['qcm', 'vrai_faux', 'reponse_courte', 'texte_a_trous', 'texte_a_choix', 'drag_and_drop'];

    const OFFICIAL_ISLANDS = [
        { value: 'Image/ile/maths.svg', label: 'Île des Mathématiques' },
        { value: 'Image/ile/francais.svg', label: 'Île du Français' },
        { value: 'Image/ile/histoire.svg', label: 'Île de l\'Histoire' },
        { value: 'Image/ile/geo.svg', label: 'Île de la Géographie' },
        { value: 'Image/ile/svt.svg', label: 'Île des SVT' },
        { value: 'Image/ile/anglais.svg', label: 'Île d\'Anglais' },
        { value: 'Image/ile/allemand.svg', label: 'Île d\'Allemand (LV1 / LV2 / BTS)' },
        { value: 'Image/ile/physique.svg', label: 'Île de Physique' },
        { value: 'Image/ile/chimie.svg', label: 'Île de Chimie' },
        { value: 'Image/ile/technologie.svg', label: 'Île de Technologie' },
        { value: 'Image/ile/philo.svg', label: 'Île de Philosophie' },
        { value: 'Image/ile/emc.svg', label: 'Île d\'EMC' },
        { value: 'Image/ile/nsi.svg', label: 'Île de NSI & Numérique' },
        { value: 'Image/ile/ses.svg', label: 'Île de SES (Économie)' },
        { value: 'Image/ile/espagnol.svg', label: 'Île d\'Espagnol (LV2)' },
        { value: 'Image/ile/arts.svg', label: 'Île d\'Histoire des Arts' },
        { value: 'Image/ile/hggsp.svg', label: 'Île de HGGSP (Géopolitique)' },
        { value: 'Image/ile/si.svg', label: 'Île des Sciences de l\'Ingénieur' },
        { value: 'Image/ile/msgn.svg', label: 'Île de Management & Gestion (MSGN)' },
        { value: 'Image/ile/droit_eco.svg', label: 'Île de Droit & Économie' },
        { value: 'Image/ile/mercatique.svg', label: 'Île de Mercatique & Gestion-Finance' },
        { value: 'Image/ile/i2d.svg', label: 'Île d\'Innovation & Dév. Durable (I2D)' },
        { value: 'Image/ile/sin.svg', label: 'Île de Systèmes d\'Info & Énergie (SIN)' },
        { value: 'Image/ile/cybersecurite.svg', label: 'Île de Cybersécurité (CIEL)' },
        { value: 'Image/ile/reseaux.svg', label: 'Île de Réseaux & Systèmes (CIEL)' },
        { value: 'Image/ile/electronique.svg', label: 'Île d\'Électronique & Embarqué (CIEL)' },
        { value: 'Image/ile/stss.svg', label: 'Île de Sciences Sanitaires & Sociales (STSS)' },
        { value: 'Image/ile/biotech.svg', label: 'Île de Biotechnologies & Labo (STL / ASSP)' },
        { value: 'Image/ile/design.svg', label: 'Île de Design & Arts Appliqués (STD2A)' },
        { value: 'Image/ile/hotellerie.svg', label: 'Île d\'Hôtellerie & Restauration (STHR)' },
        { value: 'Image/ile/agronomie.svg', label: 'Île d\'Agronomie & Vivant (STAV)' },
        { value: 'Image/ile/spectacle.svg', label: 'Île des Arts de la Scène & Culture (S2TMD)' },
        { value: 'Image/ile/hlp.svg', label: 'Île d\'Humanités & Littérature (HLP)' },
        { value: 'Image/ile/dev_bdd.svg', label: 'Île de Développement & BDD (BTS SIO)' },
        { value: 'Image/ile/commerce.svg', label: 'Île de Relation Client & Commerce (BTS MCO)' },
        { value: 'Image/ile/comptabilite.svg', label: 'Île de Comptabilité & Finance (BTS CG)' },
        { value: 'Image/ile/electrotech.svg', label: 'Île d\'Électrotechnique & Énergie (MELEC)' },
        { value: 'Image/ile/biopathologie.svg', label: 'Île de Biologie & Physiopathologie (ST2S / ASSP / STL)' },
        { value: 'Image/ile/spcl.svg', label: 'Île de Sciences & Chimie de Labo (SPCL / STL)' },
        { value: 'Image/ile/rh_comm.svg', label: 'Île de RH & Communication (STMG / MCO / CG)' },
        { value: 'Image/ile/architecture_habitat.svg', label: 'Île d\'Architecture & Habitat Durable (STI2D / STD2A / MELEC)' },
        { value: 'Image/ile/llce.svg', label: 'Île de Langues & Cultures Étrangères (LLCE)' },
        { value: 'Image/ile/pse.svg', label: 'Île de Prévention, Santé & Environnement (PSE)' },
    ];

    function renderSubjectIcon(icon, altText = '', extraClass = '') {
        const raw = typeof icon === 'string' ? icon.trim() : '';
        if (isSafeImgUrl(raw)) {
            let src = raw;
            if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:') && !src.startsWith('/') && !src.startsWith('Image/')) {
                src = 'Image/ile/' + src;
            }
            return `<img src="${esc(src)}" alt="${esc(altText)}" class="adm-subj-img ${esc(extraClass)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none';">`;
        }
        return `<span class="adm-subj-emoji ${esc(extraClass)}">${emoIco(raw || 'book', 22, 'gold')}</span>`;
    }

    /* ============================== ÉTAT ============================== */

    const S = {
        authed: false,                 // false par défaut : vérifié au démarrage
        hasAnyAdmin: false,            // true dès qu'au moins un compte admin existe (bloque setupFirst)
        gate: 'login',                 // 'login' | 'setup' — formulaire affiché
        tab: 'levels',                 // levels | subjects | members | settings
        subjectId: null,               // matière ouverte (onglet matières)
        subjectList: [],               // liste éditable en cache
        editingLesson: null,           // null = fermé, -1 = nouvelle leçon, >= 0 = index
        lessonDraft: null,             // leçon en cours d'édition
        levelsDraft: null,             // niveaux en cours d'édition
        filieresDraft: null,           // filières en cours d'édition
        questsDraft: null,             // pool de quêtes quotidiennes en cours d'édition
        subjectSearch: '',             // filtre de recherche dans la liste des matières
        badgeFiliereFilter: 'all',     // filtre de filière dans l'onglet Succès
        members: [],                   // cache des comptes locaux
        modeApi: false,
        studyGrade: '6eme',            // niveau d'étude sélectionné pour prévisualiser/tester
        questionVariant: 0,            // graine / index de variante aléatoire
        subjectSubTab: 'manual',       // 'manual' | 'procedural'
        testModalQuestion: null,       // question en cours de test interactif
        testModalAnswer: null,         // réponse saisie par l'administrateur
        testModalResult: null,         // résultat de correction { isCorrect, exp, correctStr }
    };

    const app = document.getElementById('admApp');

    /* ============================== UTILITAIRES ============================== */

    function toast(msg, kind) {
        const el = document.getElementById('admToast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'adm-toast show' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => { el.className = 'adm-toast'; }, 3200);
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR');
    }

    function typeLabel(t) { return LESSON_LABELS[t] || 'QCM'; }

    /** Réduit un texte long pour les listes. */
    function clip(s, n) {
        const str = String(s ?? '');
        return str.length > (n || 70) ? str.slice(0, (n || 70) - 1) + '…' : str;
    }

    /** Convertit des lignes « a, b » en tableau de réponses. */
    function linesToList(text) {
        return String(text || '')
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);
    }

    /* ============================== RENDU GLOBAL ============================== */

    function render() {
        try {
            if (!S.authed) { renderGate(); return; }
            renderPanel();
        } catch (err) {
            // Affiche l'erreur à l'écran plutôt qu'une page blanche
            console.error('[AdminPanel] Erreur de rendu :', err);
            app.innerHTML = `<div class="adm-gate"><div class="adm-card">
                <h2>Erreur d'affichage</h2>
                <p class="adm-error">${esc(err && err.message ? err.message : String(err))}</p>
                <p class="adm-hint">Ouvrez la console (F12) pour plus de détails, puis rechargez la page.</p>
                <div style="text-align:center; margin-top:14px;"><button type="button" class="adm-btn" onclick="location.reload()">Recharger</button></div>
            </div></div>`;
        }
    }

    function renderApiNotice() {
        app.innerHTML = `
            <div class="adm-gate">
                <div class="adm-card">
                    <h2>Mode API SQL détecté</h2>
                    <p class="adm-gate-sub">Ce panneau gère la configuration locale (niveaux, matières, leçons) et les comptes « mode local ».</p>
                    <div class="adm-note warn">
                        <b>db.js</b> est configuré avec une API (<code>API_URL</code> décommentée) : les comptes et la
                        progression sont gérés par votre backend SQL. L'administration des membres s'effectue alors
                        côté serveur (routes <code>/auth</code>, <code>/users</code>…), pas ici.
                    </div>
                    <p class="adm-hint">Ce panneau est conçu pour le <b>mode local</b> (comptes et progression dans le
                    navigateur). Pour personnaliser niveaux, matières et contenus depuis l'interface avec un backend,
                    repassez temporairement en mode local (<code>API_URL = null</code> dans <code>db.js</code>),
                    exportez votre configuration, puis réactivez le mode API : les réglages seront conservés.</p>
                    <div style="margin-top:18px; text-align:center;">
                        <a class="adm-btn" href="index.html">← Retour au jeu</a>
                    </div>
                </div>
            </div>`;
    }

    /* ============================== CONNEXION / PREMIER ADMIN ============================== */

    function renderGate() {
        const isSetup = S.gate === 'setup' && !S.hasAnyAdmin;
        const showSetupLink = !isSetup && !S.hasAnyAdmin;
        const showLoginLink = isSetup;
        app.innerHTML = `
            <div class="adm-gate">
                <div class="adm-card">
                    <h2>${ico('shield', 20, 'gold')} ${isSetup ? 'Créer le premier administrateur' : 'Accès administrateur'}</h2>
                    <p class="adm-gate-sub">${isSetup
                ? 'Aucun compte administrateur n\'existe encore. Créez-le pour ouvrir le panneau.'
                : 'Connectez-vous avec un compte dont le rôle est « admin ».'}</p>

                    ${isSetup ? `
                        <form class="adm-form" onsubmit="event.preventDefault(); ADM.setupFirst();">
                            <div class="adm-field"><label>Adresse e-mail</label>
                                <input class="adm-input" id="admSetEmail" type="email" autocomplete="username" placeholder="admin@ecole.fr" required></div>
                            <div class="adm-field"><label>Pseudo</label>
                                <input class="adm-input" id="admSetPseudo" autocomplete="nickname" placeholder="Administrateur" required></div>
                            <div class="adm-field"><label>Mot de passe (6 caractères min.)</label>
                                <input class="adm-input" id="admSetPass" type="password" autocomplete="new-password" minlength="6" required></div>
                            <div class="adm-error" id="admSetErr"></div>
                            <button type="submit" class="adm-btn">Créer et ouvrir le panneau</button>
                        </form>
                    ` : `
                        <form class="adm-form" onsubmit="event.preventDefault(); ADM.login();">
                            <div class="adm-field"><label>Adresse e-mail</label>
                                <input class="adm-input" id="admLoginEmail" type="email" autocomplete="username" placeholder="admin@ecole.fr" required></div>
                            <div class="adm-field"><label>Mot de passe</label>
                                <input class="adm-input" id="admLoginPass" type="password" autocomplete="current-password" required></div>
                            <div class="adm-error" id="admLoginErr"></div>
                            <button type="submit" class="adm-btn">Ouvrir le panneau</button>
                        </form>
                    `}
                    ${(showSetupLink || showLoginLink) ? `
                    <div class="adm-gate-switch">
                        ${showSetupLink ? 'Aucun administrateur ? <a href="#" onclick="event.preventDefault(); ADM.switchGate();">Créer le premier compte admin</a>' : ''}
                        ${showLoginLink ? 'Un compte admin existe déjà ? <a href="#" onclick="event.preventDefault(); ADM.switchGate();">Se connecter</a>' : ''}
                    </div>` : ''}
                </div>
            </div>`;
    }

    function setError(id, msg) {
        const el = document.getElementById(id);
        if (el) el.textContent = msg || '';
    }

    /* ============================== PANNEAU (coquille) ============================== */

    const TABS = [
        { id: 'levels', icon: 'gradCap', label: 'Niveaux' },
        { id: 'filieres', icon: 'compass', label: 'Filières' },
        { id: 'subjects', icon: 'book', label: 'Matières & leçons' },
        { id: 'badges', icon: 'trophy', label: 'Succès' },
        { id: 'shop', icon: 'shop', label: 'Boutique' },
        { id: 'rewards', icon: 'gift', label: 'Récompenses & Quêtes' },
        { id: 'members', icon: 'users', label: 'Membres' },
        { id: 'credits', icon: 'sparkle', label: 'Crédits' },
        { id: 'settings', icon: 'settings', label: 'Réglages' },
    ];

    function renderPanel() {
        const me = (typeof DB !== 'undefined' && DB.getCurrentUser) ? DB.getCurrentUser() : null;
        app.innerHTML = `
            <div class="adm-stats" id="admStats">
                <div class="adm-stat"><b>…</b><span>Comptes</span></div>
                <div class="adm-stat"><b>…</b><span>Admins</span></div>
                <div class="adm-stat"><b>…</b><span>Filières</span></div>
                <div class="adm-stat"><b>…</b><span>Matières</span></div>
                <div class="adm-stat"><b>…</b><span>Boutique</span></div>
                <div class="adm-stat"><b>…</b><span>Succès</span></div>
            </div>
            <div class="adm-tabs" role="tablist">
                ${TABS.map(t => `
                    <button type="button" role="tab" aria-selected="${S.tab === t.id ? 'true' : 'false'}" class="adm-tab${S.tab === t.id ? ' active' : ''}" onclick="ADM.tab('${t.id}')">${ico(t.icon, 16)} ${t.label}</button>`).join('')}
                <button type="button" class="adm-tab adm-tab-logout" style="margin-left:auto;" onclick="ADM.logout()" title="Déconnecter ${esc(me && me.username ? me.username : 'l\'administrateur')}">${ico('exit', 15)} Déconnexion</button>
            </div>
            <div id="admTab">${renderTab()}</div>
            <div id="admModalWrap">${S.testModalQuestion ? renderTestModal() : ''}</div>
            <p class="adm-hint" style="margin-top:18px; text-align:center;">
                Rechargez la page du jeu (F5) pour voir vos modifications appliquées.<br>
                <a href="legal.html" target="_blank" rel="noopener noreferrer">Mentions légales, confidentialité &amp; cookies</a>
            </p>`;
        refreshStats();
    }

    function renderTab() {
        if (S.tab === 'levels') return renderLevels();
        if (S.tab === 'filieres') return renderFilieres();
        if (S.tab === 'subjects') return renderSubjects();
        if (S.tab === 'badges') return renderBadges();
        if (S.tab === 'shop') return renderShop();
        if (S.tab === 'rewards') return renderRewards();
        if (S.tab === 'members') return renderMembers();
        if (S.tab === 'credits') return renderCredits();
        if (S.tab === 'settings') return renderSettings();
        return '';
    }

    async function refreshStats() {
        const wrap = document.getElementById('admStats');
        if (!wrap) return;
        let members = [], admins = 0;
        try {
            const r = await DB.listLocalMembers();
            if (r.ok) { members = r.data; admins = members.filter(m => m.role === 'admin').length; }
        } catch { /* stats optionnelles */ }
        const filieres = (typeof AdminStore !== 'undefined' && AdminStore.getFilieres) ? AdminStore.getFilieres() : [];
        const subs = typeof AdminStore !== 'undefined' ? AdminStore.listEditable(AdminStore.getDefaultSubjects()) : [];
        const shopItems = typeof AdminStore !== 'undefined' ? AdminStore.getShopItems() : [];
        const badges = typeof AdminStore !== 'undefined' ? AdminStore.getBadges() : [];
        if (!wrap || !wrap.isConnected) return;
        const cells = wrap.querySelectorAll('.adm-stat b');
        if (cells.length >= 6) {
            cells[0].textContent = String(members.length);
            cells[1].textContent = String(admins);
            cells[2].textContent = `${filieres.filter(f => f.enabled !== false).length}/${filieres.length}`;
            cells[3].textContent = String(subs.length);
            cells[4].textContent = String(shopItems.length);
            cells[5].textContent = String(badges.length);
        }
    }

    /* ============================== ONGLET : NIVEAUX SCOLAIRES ============================== */

    function renderLevels() {
        if (!S.levelsDraft) S.levelsDraft = AdminStore.getLevels();
        const draft = S.levelsDraft;
        const count = draft.length;
        const rows = draft.map((l, i) => `
            <tr>
                <td class="num">${i + 1}</td>
                <td><input class="adm-input" value="${esc(l.id)}" placeholder="identifiant (ex: ce2)"
                        oninput="ADM.lvl(${i},'id',this.value)"></td>
                <td><input class="adm-input" value="${esc(l.label)}" placeholder="Libellé (ex: CE2)"
                        oninput="ADM.lvl(${i},'label',this.value)"></td>
                <td>
                    <select class="adm-select" onchange="ADM.lvl(${i},'band',this.value)">
                        <option value="college"${l.band === 'college' ? ' selected' : ''}>Collège</option>
                        <option value="lycee"${l.band === 'lycee' ? ' selected' : ''}>Lycée</option>
                    </select>
                </td>
                <td>
                    <div class="adm-row-actions">
                        <button type="button" class="adm-ico-btn" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="ADM.lvlMove(${i},-1)">↑</button>
                        <button type="button" class="adm-ico-btn" title="Descendre" ${i === count - 1 ? 'disabled' : ''} onclick="ADM.lvlMove(${i},1)">↓</button>
                        <button type="button" class="adm-ico-btn danger" title="Supprimer" ${count <= 1 ? 'disabled' : ''} onclick="ADM.lvlDelete(${i})">🗑</button>
                    </div>
                </td>
            </tr>`).join('');

        return `
            <div class="adm-card">
                <h2>🎓 Niveaux scolaires <small>${count} niveau(x) affiché(s) sur la page « jouer »</small></h2>
                <div class="adm-note warn">
                    ⚠️ L'<b>identifiant</b> sert de clé de progression (ex : « 6eme ») : le renommer crée une
                    nouvelle progression pour les joueurs. Ajoutez ici les classes de votre établissement
                    (CP, CM1, Seconde…), puis cliquez sur « Enregistrer ».
                </div>
                <div class="adm-table-wrap">
                    <table class="adm-table">
                        <thead><tr><th class="num">#</th><th>Identifiant</th><th>Libellé affiché</th><th>Bande de contenu</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="adm-toolbar" style="margin-top:16px;">
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.lvlAdd()">+ Ajouter un niveau</button>
                    <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.levelsSave()">💾 Enregistrer</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.levelsCancel()">Annuler</button>
                    <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.levelsReset()">Rétablir les niveaux par défaut</button>
                </div>
                <p class="adm-hint">La « bande de contenu » choisit la difficulté des questions générées (collège ou lycée / BTS).
                Les niveaux par défaut sont : 6ème → Terminale, BTS 1ère année et BTS 2ème année.</p>
            </div>`;
    }

    /* ============================== ONGLET : FILIÈRES ============================== */

    function renderFilieres() {
        if (!S.filieresDraft) S.filieresDraft = AdminStore.getFilieres();
        const draft = S.filieresDraft;
        const count = draft.length;
        const allSubs = subjectList();
        const allBadges = AdminStore.getBadges();
        const lyceeLevels = AdminStore.getLevels().filter(l => l.band === 'lycee');

        const rows = draft.map((f, i) => {
            const allowedNivs = (Array.isArray(f.allowedNiveaux) && f.allowedNiveaux.length)
                ? f.allowedNiveaux
                : lyceeLevels.map(l => l.id);
            const sampleNiv = allowedNivs[0] || 'terminale';
            const subCount = allSubs.filter(s => {
                const af = AdminStore.defaultAllowedFilieresForSubject(s);
                return af.includes('all') || af.includes(f.id);
            }).length;
            const badgeCount = allBadges.filter(b => AdminStore.isBadgeRelevantFor(b, sampleNiv, f.id)).length;
            const nivPills = lyceeLevels.map(l => {
                const checked = allowedNivs.includes(l.id);
                const shortLbl = l.id === 'bts1' ? 'BTS 1' : l.id === 'bts2' ? 'BTS 2' : (l.id === 'terminale' ? 'Tle' : (l.label || l.id));
                return `<button type="button" class="adm-grade-pill ${checked ? 'checked' : ''}" style="padding:2px 7px; font-size:0.74rem;" data-idx="${i}" data-niv="${esc(l.id)}" onclick="ADM.filToggleNiveau(Number(this.dataset.idx), this.dataset.niv)" title="${esc(l.label || l.id)}">${checked ? '✓' : '○'} ${esc(shortLbl)}</button>`;
            }).join('');
            return `
                <tr style="${f.enabled === false ? 'opacity:0.55;' : ''}">
                    <td class="num">${i + 1}</td>
                    <td style="width:62px;"><input class="adm-input" value="${esc(f.icon || '🧭')}" oninput="ADM.fil(${i},'icon',this.value)" style="text-align:center;"></td>
                    <td><input class="adm-input" value="${esc(f.id)}" placeholder="ex: ciel, sio" oninput="ADM.fil(${i},'id',this.value)"></td>
                    <td><input class="adm-input" value="${esc(f.label)}" placeholder="Nom complet" oninput="ADM.fil(${i},'label',this.value)"></td>
                    <td><input class="adm-input" value="${esc(f.shortLabel || '')}" placeholder="Badge court" oninput="ADM.fil(${i},'shortLabel',this.value)"></td>
                    <td><div class="adm-grade-pills" style="gap:4px;">${nivPills}</div></td>
                    <td><input class="adm-input" value="${esc(f.desc || '')}" placeholder="Description" oninput="ADM.fil(${i},'desc',this.value)"></td>
                    <td style="text-align:center; white-space:nowrap;">
                        <span class="adm-badge adm-badge-type" title="Matières accessibles">${subCount} mat.</span>
                        <span class="adm-badge adm-badge-system" title="Succès visibles dans cette filière">${badgeCount} 🏆</span>
                    </td>
                    <td style="text-align:center;">
                        <input type="checkbox" ${f.enabled !== false ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;" title="Activer/désactiver cette filière" onchange="ADM.fil(${i},'enabled',this.checked)">
                    </td>
                    <td>
                        <div class="adm-row-actions">
                            <button type="button" class="adm-ico-btn" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="ADM.filMove(${i},-1)">↑</button>
                            <button type="button" class="adm-ico-btn" title="Descendre" ${i === count - 1 ? 'disabled' : ''} onclick="ADM.filMove(${i},1)">↓</button>
                            <button type="button" class="adm-ico-btn danger" title="Supprimer" ${count <= 1 ? 'disabled' : ''} onclick="ADM.filDelete(${i})">🗑</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="adm-card">
                <h2>🧭 Filières &amp; Voies d'études <small>${draft.filter(f => f.enabled !== false).length} active(s) sur ${count}</small></h2>
                <div class="adm-note">
                    Pilotez ici les filières proposées aux élèves du <b>Lycée (2de → Terminale)</b> et de <b>BTS (1ère &amp; 2ème année)</b> ainsi que leurs <b>niveaux d'études autorisés</b> (ex. BTS SIO/MCO/CG uniquement en BTS 1-2 ; spécialités de 1ère/Tle uniquement en 1ère/Tle).
                </div>
                <div class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th class="num">#</th>
                                <th>Icône</th>
                                <th>Identifiant</th>
                                <th>Libellé complet</th>
                                <th>Badge court</th>
                                <th>Niveaux autorisés</th>
                                <th>Description</th>
                                <th>Contenu</th>
                                <th>Active</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="adm-toolbar" style="margin-top:16px;">
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.filAdd()">+ Ajouter une filière</button>
                    <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.filieresSave()">💾 Enregistrer les filières</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.filieresCancel()">Annuler</button>
                    <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.filieresReset()">Rétablir les filières officielles</button>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : MATIÈRES & LEÇONS ============================== */

    function subjectList() {
        if (!S.subjectList.length && typeof AdminStore !== 'undefined') {
            S.subjectList = AdminStore.listEditable(AdminStore.getDefaultSubjects());
        }
        return S.subjectList;
    }

    function renderSubjects() {
        const list = subjectList();
        const search = String(S.subjectSearch || '').trim().toLowerCase();
        const filteredList = search
            ? list.filter(x => (x.name || '').toLowerCase().includes(search) || (x.id || '').toLowerCase().includes(search))
            : list;
        const open = list.find(x => x.id === S.subjectId) || null;
        const allFilieres = (typeof AdminStore !== 'undefined' && AdminStore.getFilieres) ? AdminStore.getFilieres() : [];

        return `
            <div class="adm-split">
                <div>
                    <div class="adm-card">
                        <h2>Matières <small>${list.length}</small></h2>
                        <input class="adm-input adm-search-bar" id="admSubjectSearch" value="${esc(S.subjectSearch || '')}" placeholder="🔍 Filtrer les matières (ex: CIEL, maths, cyber…)" oninput="ADM.setSubjectSearch(this.value)">
                        <div class="adm-subject-list">
                            ${filteredList.map(x => {
                                const bandLabel = x.band === 'college' ? 'Collège' : x.band === 'lycee' ? 'Lycée/BTS' : 'Tous';
                                const af = Array.isArray(x.allowedFilieres) && x.allowedFilieres.length ? x.allowedFilieres : ['all'];
                                const filTag = af.includes('all') ? '' : `<span class="adm-badge adm-badge-system" style="padding:1px 6px; font-size:0.7rem;">${esc(af.slice(0, 2).join(', ').toUpperCase())}${af.length > 2 ? '+' : ''}</span>`;
                                return `
                                <button type="button" class="adm-subject-item${S.subjectId === x.id ? ' active' : ''}" data-id="${esc(x.id)}" onclick="ADM.openSubject(this.dataset.id)">
                                    <span class="icon">${renderSubjectIcon(x.island || x.icon, x.name)}</span>
                                    <span class="name">
                                        <span style="display:block; font-weight:600;">${esc(x.name || x.id)}</span>
                                        <span style="display:inline-flex; gap:4px; margin-top:2px; font-size:0.75rem; flex-wrap:wrap;">
                                            <span class="adm-badge adm-badge-type" style="padding:1px 6px; font-size:0.72rem;">${bandLabel}</span>
                                            ${filTag}
                                            ${x.enabled === false ? '<span class="adm-badge danger" style="padding:1px 6px; font-size:0.72rem;">Masquée</span>' : ''}
                                        </span>
                                    </span>
                                    <span class="count" title="${x.lessons.length} leçon(s) écrite(s)">${x.lessons.length}</span>
                                </button>`;
                            }).join('') || '<div class="adm-empty">Aucune matière ne correspond à cette recherche.</div>'}
                        </div>
                        <div style="margin-top:14px; border-top:1px dashed rgba(154,167,216,.2); padding-top:12px;">
                            <div class="adm-form" style="display:flex; flex-direction:column; gap:8px;">
                                <div class="adm-field">
                                    <label>Nom de la nouvelle matière</label>
                                    <input class="adm-input" id="admNewName" placeholder="Ex: Musique, BTS SIO, Droit…">
                                </div>
                                <div class="adm-field">
                                    <label>Cycle d'enseignement</label>
                                    <select class="adm-select" id="admNewBand">
                                        <option value="all">🌐 Tous cycles (Collège, Lycée &amp; BTS)</option>
                                        <option value="college">🏫 Collège uniquement (6e → 3e)</option>
                                        <option value="lycee">🏛️ Lycée &amp; BTS uniquement (2de → BTS 2)</option>
                                    </select>
                                </div>
                                <div class="adm-field">
                                    <label>Filière cible (Lycée &amp; BTS)</label>
                                    <select class="adm-select" id="admNewFiliere">
                                        <option value="all">🌐 Toutes les filières</option>
                                        ${allFilieres.map(f => `<option value="${esc(f.id)}">${esc(f.icon || '🧭')} ${esc(f.label)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="adm-field">
                                    <label>Illustration / Île officielle</label>
                                    <select class="adm-select" id="admNewIslandSelect" onchange="ADM.onSubjectIslandSelect(this.value, 'admNewIcon', 'admNewPreview')">
                                        <option value="">— Emoji ou URL personnalisée —</option>
                                        ${OFFICIAL_ISLANDS.map(isl => `<option value="${isl.value}">${isl.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="adm-field">
                                    <label>Icône (URL, fichier ou emoji)</label>
                                    <div style="display:flex; gap:6px; align-items:center;">
                                        <input class="adm-input" id="admNewIcon" placeholder="ex: 🎵 ou Image/ile/..." oninput="ADM.updateSubjectIconPreview('admNewIcon', 'admNewPreview')">
                                        <label class="adm-ico-btn" style="cursor:pointer; display:flex; align-items:center; padding:6px 9px;" title="Charger une image depuis votre PC">
                                            📁<input type="file" accept="image/*" style="display:none;" onchange="ADM.handleSubjectImageUpload(this, 'admNewIcon', 'admNewPreview')">
                                        </label>
                                        <div id="admNewPreview" class="adm-subj-preview" style="width:36px; height:36px; min-width:36px;">
                                            <span>📘</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" class="adm-btn adm-btn-ok" style="margin-top:4px;" onclick="ADM.createSubject()">+ Créer la matière</button>
                            </div>
                            <p class="adm-hint" style="margin-top:8px;">Les matières personnalisées créées apparaissent immédiatement dans le jeu selon leur cycle et leurs classes autorisées.</p>
                        </div>
                    </div>
                </div>
                <div>
                    ${open ? renderSubjectDetail(open) : `
                        <div class="adm-card"><div class="adm-empty">Sélectionnez une matière pour éditer ses leçons et son niveau d'étude.</div></div>`}
                </div>
            </div>`;
    }

    function renderSubjectDetail(sub) {
        // Récupère l'état le plus frais depuis le store (surcharges éventuelles)
        const fresh = subjectList().find(x => x.id === sub.id) || sub;
        const lessons = fresh.lessons || [];
        const isCustom = typeof AdminStore !== 'undefined' && AdminStore.isCustom(sub.id);
        const levels = typeof AdminStore !== 'undefined' ? AdminStore.getLevels() : [];

        // Niveaux autorisés effectifs (respecte un tableau explicitement vide via « Tout décocher »)
        const effectiveAllowed = (fresh._allowedNiveauxExplicit && Array.isArray(fresh.allowedNiveaux))
            ? fresh.allowedNiveaux
            : ((typeof AdminStore !== 'undefined' && AdminStore.defaultAllowedNiveauxForSubject)
                ? AdminStore.defaultAllowedNiveauxForSubject(fresh)
                : (Array.isArray(fresh.allowedNiveaux) ? fresh.allowedNiveaux : []));

        // Sous-onglet actif : 'manual' | 'procedural'
        const subTab = S.subjectSubTab || 'manual';

        // Lignes de leçons manuelles avec bouton de test
        const lessonRows = lessons.map((l, i) => `
            <div class="adm-lesson-row">
                <div class="head">
                    <span class="num" style="color:var(--gold); font-weight:700;">${i + 1}</span>
                    <span class="t">${esc(l.title || ('Niveau ' + (i + 1)))}</span>
                    <span class="adm-badge adm-badge-type">${esc(typeLabel(l.type))}</span>
                    <span class="q">${esc(clip(l.q || l.textWithBlanks || '', 75))}</span>
                    <div class="adm-row-actions">
                        <button type="button" class="adm-ico-btn" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="ADM.lessonMove(${i},-1)">↑</button>
                        <button type="button" class="adm-ico-btn" title="Descendre" ${i === lessons.length - 1 ? 'disabled' : ''} onclick="ADM.lessonMove(${i},1)">↓</button>
                        <button type="button" class="adm-ico-btn" title="Tester cette leçon" onclick="ADM.testLesson(${i})">${ico('potion', 15, 'cyan')}</button>
                        <button type="button" class="adm-ico-btn" title="Modifier" onclick="ADM.editLesson(${i})">${ico('edit', 15)}</button>
                        <button type="button" class="adm-ico-btn danger" title="Supprimer" onclick="ADM.deleteLesson(${i})">${ico('close', 15, 'danger')}</button>
                    </div>
                </div>
            </div>`).join('');

        const editor = S.editingLesson !== null && S.editingLesson !== undefined && S.editingLesson >= -1
            && S.subjectId === sub.id ? renderLessonEditor(lessons) : '';

        const currentIcon = fresh.island || fresh.icon || '';
        const matchingIsland = OFFICIAL_ISLANDS.find(isl => isl.value === currentIcon || (currentIcon && currentIcon.endsWith(isl.value.replace('Image/ile/', ''))));

        // Questions procédurales : calculées uniquement lorsque le sous-onglet « procedural » est actif (gain de perf)
        const gradeQuestions = (subTab === 'procedural' && typeof AdminStore !== 'undefined')
            ? AdminStore.getSubjectQuestionsForGrade(fresh.id, S.studyGrade, S.questionVariant, 8)
            : { manual: [], generated: [] };

        const proceduralCards = (gradeQuestions.generated || []).map((q, idx) => {
            const type = q.type || 'qcm';
            let previewChoices = '';
            if (type === 'qcm' && Array.isArray(q.opts)) {
                previewChoices = `
                    <div class="adm-q-choices">
                        ${q.opts.map((opt, i) => `
                            <div class="adm-q-choice ${i === Number(q.correct) ? 'is-correct' : ''}">
                                ${String.fromCharCode(65 + i)}. ${esc(opt)} ${i === Number(q.correct) ? '✔' : ''}
                            </div>
                        `).join('')}
                    </div>`;
            } else if (type === 'vrai_faux') {
                previewChoices = `
                    <div class="adm-q-choices">
                        <div class="adm-q-choice ${q.correct === true ? 'is-correct' : ''}">Vrai ${q.correct === true ? '✔' : ''}</div>
                        <div class="adm-q-choice ${q.correct === false ? 'is-correct' : ''}">Faux ${q.correct === false ? '✔' : ''}</div>
                    </div>`;
            } else if (type === 'reponse_courte') {
                previewChoices = `<div class="adm-hint" style="margin-bottom:6px;">Réponse(s) acceptée(s) : <b>${esc((q.accepted || []).join(', '))}</b></div>`;
            } else if (type === 'texte_a_trous' || type === 'texte_a_choix') {
                previewChoices = `<div class="adm-hint" style="margin-bottom:6px;">Trou(s) : <b>${esc((q.blanks || []).map(b => (Array.isArray(b) ? b : [b]).join('/')).join(', '))}</b></div>`;
            }

            return `
                <div class="adm-q-card">
                    <div class="adm-q-head">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="adm-badge" style="background:rgba(200,168,75,0.2); color:var(--gold-soft); font-weight:700;">Question ${idx + 1}</span>
                            <span class="adm-badge adm-badge-type">${esc(typeLabel(type))}</span>
                            <span class="adm-badge" style="background:rgba(95,212,230,0.15); color:var(--cyan);">${esc(S.studyGrade.toUpperCase())}</span>
                        </div>
                        <div class="adm-row-actions">
                            <button type="button" class="adm-btn adm-btn-ok" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.importProceduralQuestion(${idx})">📋 Importer en leçon manuelle</button>
                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.testProceduralQuestion(${idx})">🧪 Tester</button>
                        </div>
                    </div>
                    <div class="adm-q-text">${esc(q.q || q.title || 'Question')}</div>
                    ${previewChoices}
                    ${q.exp ? `<div class="adm-q-exp">💡 Explication : ${esc(q.exp)}</div>` : ''}
                </div>`;
        }).join('');

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0; display:flex; align-items:center; gap:10px;">
                        ${renderSubjectIcon(fresh.island || fresh.icon, fresh.name, 'adm-title-img')} ${esc(fresh.name)}
                    </h2>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span class="adm-badge ${isCustom ? 'adm-badge-custom' : 'adm-badge-system'}">${isCustom ? 'Matière personnalisée' : 'Matière du jeu'}</span>
                        <span class="adm-badge ${fresh.enabled !== false ? 'adm-badge-type' : 'danger'}">${fresh.enabled !== false ? 'Visible' : 'Masquée'}</span>
                    </div>
                </div>

                <div class="adm-note">
                    ${isCustom
                ? `Matière personnalisée : vous pouvez choisir à quels niveaux d'étude et cycles elle est rattachée (${lessons.length} leçon(s) manuelle(s)).`
                : `Matière officielle : adaptable par niveau d'étude (${esc(fresh.band || 'all')}). Vous pouvez surcharger les premières leçons manuellement ou laisser le générateur adapter le contenu automatiquement.`}
                </div>

                <!-- FORMULAIRE MÉTA-DONNÉES & CYCLE D'ÉTUDE -->
                <div class="adm-form" style="margin-bottom:14px; background:rgba(255,255,255,0.02); border:1px solid rgba(200,168,75,0.18); border-radius:10px; padding:14px;">
                    <div class="adm-grid-2" style="margin-bottom:10px;">
                        <div class="adm-field">
                            <label>Nom de la matière</label>
                            <input class="adm-input" id="admMetaName" value="${esc(fresh.name)}">
                        </div>
                        <div class="adm-field">
                            <label>Cycle d'enseignement rattaché</label>
                            <select class="adm-select" id="admMetaBand" onchange="ADM.onBandChange(this.value)">
                                <option value="all"${(fresh.band || 'all') === 'all' ? ' selected' : ''}>🌐 Tous niveaux (Collège, Lycée &amp; BTS)</option>
                                <option value="college"${fresh.band === 'college' ? ' selected' : ''}>🏫 Collège uniquement (6e → 3e)</option>
                                <option value="lycee"${fresh.band === 'lycee' ? ' selected' : ''}>🏛️ Lycée &amp; BTS uniquement (2de → Tle / BTS)</option>
                            </select>
                        </div>
                    </div>

                    <!-- NIVEAUX SCOLAIRES AUTORISÉS (CLASSES) -->
                    <div class="adm-field" style="margin-bottom:10px;">
                        <label style="display:flex; justify-content:space-between; align-items:center;">
                            <span>Niveaux d'étude autorisés pour cette matière :</span>
                            <span style="font-size:0.8rem; font-weight:normal; color:var(--muted);">
                                ${effectiveAllowed.length} classe(s) sélectionnée(s)
                            </span>
                        </label>
                        <div class="adm-grade-pills">
                            ${levels.map(l => {
                                const isChecked = effectiveAllowed.includes(l.id);
                                return `<button type="button" class="adm-grade-pill ${isChecked ? 'checked' : ''}" data-id="${esc(l.id)}" onclick="ADM.toggleSubjectGrade(this.dataset.id)">
                                    ${isChecked ? '✓' : '○'} ${esc(l.label || l.id)}
                                </button>`;
                            }).join('')}
                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:3px 8px; font-size:0.75rem;" onclick="ADM.setAllSubjectGrades(true)">Tout cocher</button>
                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:3px 8px; font-size:0.75rem;" onclick="ADM.setAllSubjectGrades(false)">Tout décocher</button>
                        </div>
                        <p class="adm-hint" style="margin-top:4px;">Seuls les élèves connectés dans les classes cochées auront accès à cette matière.</p>
                    </div>

                    <!-- FILIÈRES AUTORISÉES & SPÉCIALITÉS (LYCÉE & BTS) -->
                    <div class="adm-field" style="margin-bottom:10px;">
                        <label style="display:flex; justify-content:space-between; align-items:center;">
                            <span>Filières autorisées (Lycée &amp; BTS) :</span>
                            <span style="font-size:0.8rem; font-weight:normal; color:var(--muted);">
                                ${(() => {
                                    const af = AdminStore.defaultAllowedFilieresForSubject(fresh);
                                    return af.includes('all') ? 'Toutes les filières' : af.length + ' filière(s) sélectionnée(s)';
                                })()}
                            </span>
                        </label>
                        <div class="adm-grade-pills">
                            ${(() => {
                                const allFil = AdminStore.getFilieres();
                                const af = AdminStore.defaultAllowedFilieresForSubject(fresh);
                                const isAll = af.includes('all');
                                const allBtn = `<button type="button" class="adm-grade-pill ${isAll ? 'checked' : ''}" onclick="ADM.toggleSubjectFiliere('all')">${isAll ? '✓' : '○'} Toutes les filières</button>`;
                                const filBtns = allFil.map(f => {
                                    const checked = !isAll && af.includes(f.id);
                                    return `<button type="button" class="adm-grade-pill ${checked ? 'checked' : ''}" data-id="${esc(f.id)}" onclick="ADM.toggleSubjectFiliere(this.dataset.id)">${checked ? '✓' : '○'} ${emoIco(f.icon || 'compass', 14)} ${esc(f.shortLabel || f.label)}</button>`;
                                }).join('');
                                return allBtn + filBtns;
                            })()}
                        </div>
                        <label style="margin-top:8px;">Marquer comme « Spécialité phare » pour :</label>
                        <div class="adm-grade-pills">
                            ${(() => {
                                const allFil = AdminStore.getFilieres();
                                const specs = Array.isArray(fresh.specialtyFilieres) ? fresh.specialtyFilieres : [];
                                return allFil.map(f => {
                                    const isSpec = specs.includes(f.id);
                                    return `<button type="button" class="adm-grade-pill adm-filiere-pill ${isSpec ? 'checked is-specialty' : ''}" data-id="${esc(f.id)}" onclick="ADM.toggleSubjectSpecialty(this.dataset.id)">${isSpec ? ico('starFilled', 13, 'gold') : ico('starEmpty', 13, 'muted')} ${esc(f.shortLabel || f.label)}</button>`;
                                }).join('');
                            })()}
                        </div>
                        <p class="adm-hint" style="margin-top:4px;">Contrôle dans quelles filières (CIEL, STMG, STI2D, NSI, ST2S, Générale…) cette matière s'affiche et si elle porte le badge Spécialité.</p>
                    </div>

                    <div class="adm-form-row" style="align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                        <div class="adm-field" style="flex:1; min-width:200px;">
                            <label>Illustration / Île officielle</label>
                            <select class="adm-select" id="admMetaIslandSelect" onchange="ADM.onSubjectIslandSelect(this.value, 'admMetaIcon', 'admMetaPreview')">
                                <option value="">— Emoji ou URL personnalisée —</option>
                                ${OFFICIAL_ISLANDS.map(isl => `<option value="${esc(isl.value)}"${matchingIsland && matchingIsland.value === isl.value ? ' selected' : ''}>${esc(isl.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="adm-field" style="flex:1; min-width:180px;">
                            <label>Icône (URL, fichier ou emoji)</label>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <input class="adm-input" id="admMetaIcon" value="${esc(fresh.island || fresh.icon)}" placeholder="Ex: Image/ile/maths.svg" oninput="ADM.updateSubjectIconPreview('admMetaIcon', 'admMetaPreview')">
                                <label class="adm-ico-btn" style="cursor:pointer; display:flex; align-items:center; padding:6px 9px;" title="Charger une image locale (PNG, SVG, WebP, JPG)">
                                    📁<input type="file" accept="image/*" style="display:none;" onchange="ADM.handleSubjectImageUpload(this, 'admMetaIcon', 'admMetaPreview')">
                                </label>
                            </div>
                        </div>
                        <div class="adm-field" style="width:auto;">
                            <label style="text-align:center;">Aperçu</label>
                            <div id="admMetaPreview" class="adm-subj-preview">
                                ${renderSubjectIcon(fresh.island || fresh.icon, fresh.name)}
                            </div>
                        </div>
                    </div>

                    <div class="adm-grid-2" style="margin-bottom:10px;">
                        <div class="adm-field">
                            <label>Description pédagogique (optionnelle)</label>
                            <input class="adm-input" id="admMetaDesc" value="${esc(fresh.description || '')}" placeholder="Ex: Notions clés, exercices et défis pour progresser">
                        </div>
                        <div class="adm-field" style="display:flex; align-items:center; gap:8px; margin-top:22px;">
                            <input type="checkbox" id="admMetaEnabled" ${fresh.enabled !== false ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                            <label for="admMetaEnabled" style="margin:0; cursor:pointer; font-weight:600;">Matière active et visible sur le dashboard élève</label>
                        </div>
                    </div>

                    <div class="adm-toolbar">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.saveMeta()">💾 Enregistrer les réglages de la matière</button>
                        ${isCustom
                ? `<button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.deleteSubject()">Supprimer la matière</button>`
                : `<button type="button" class="adm-btn adm-btn-ghost adm-right" onclick="ADM.resetSubject()" title="Retirer toutes les modifications de cette matière">Rétablir l'original</button>`}
                    </div>
                </div>

                <!-- SOUS-ONGLETS DE CONTENU : LEÇONS MANUELLES vs QUESTIONS PAR NIVEAU / ALÉATOIRE -->
                <div class="adm-subtabs">
                    <button type="button" class="adm-subtab ${subTab !== 'procedural' ? 'active' : ''}" onclick="ADM.setSubjectSubTab('manual')">
                        📝 Leçons manuelles (${lessons.length})
                    </button>
                    <button type="button" class="adm-subtab ${subTab === 'procedural' ? 'active' : ''}" onclick="ADM.setSubjectSubTab('procedural')">
                        🎲 Questions par niveau d'étude &amp; Aléatoire
                    </button>
                </div>

                ${subTab === 'manual' ? `
                    <!-- VUE 1 : LEÇONS MANUELLES -->
                    ${editor}
                    <div class="adm-toolbar" style="margin-top:10px;">
                        <button type="button" class="adm-btn" onclick="ADM.newLesson()">+ Ajouter une leçon (niveau ${lessons.length + 1})</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.openSubject('')">‹ Retour à la liste</button>
                    </div>
                    ${lessons.length ? `<div class="adm-lesson-preview">${lessons.length} leçon(s) manuelle(s) — cliquez sur ✏️ pour éditer ou 🧪 pour tester.</div>` : '<div class="adm-empty">Aucune leçon manuelle écrite pour l\'instant.</div>'}
                    ${lessonRows}
                ` : `
                    <!-- VUE 2 : QUESTIONS PAR NIVEAU & GÉNÉRATEUR ALÉATOIRE -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(95,212,230,0.25); border-radius:10px; padding:14px; margin-top:10px;">
                        <div class="adm-grid-2" style="align-items:center;">
                            <div class="adm-field">
                                <label>Niveau d'étude à prévisualiser :</label>
                                <select class="adm-select" id="admStudyGradeSelect" onchange="ADM.changeStudyGrade(this.value)">
                                    ${levels.map(l => `<option value="${esc(l.id)}"${S.studyGrade === l.id ? ' selected' : ''}>${esc(l.label || l.id)} (${l.band === 'lycee' ? 'Lycée' : 'Collège'})</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; gap:8px; align-items:flex-end;">
                                <div style="flex:1;">
                                    <label>Variante aléatoire active :</label>
                                    <div style="font-size:0.95rem; font-weight:700; color:var(--gold-soft); padding:8px 0;">
                                        🎲 Graine / Variante n° ${S.questionVariant}
                                    </div>
                                </div>
                                <button type="button" class="adm-btn adm-btn-ok" style="white-space:nowrap;" onclick="ADM.nextQuestionVariant()">🎲 Tirer une autre variante</button>
                                <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetQuestionVariant()">🔄 Réinitialiser</button>
                            </div>
                        </div>
                        <p class="adm-hint" style="margin-top:8px;">
                            Ces questions sont adaptées en temps réel au niveau d'étude choisi (<b>${esc(S.studyGrade.toUpperCase())}</b>) et à la variante aléatoire active.
                            Vous pouvez tester n'importe quelle question en direct (🧪) ou l'importer en 1 clic (📋) dans vos leçons manuelles pour la retravailler !
                        </p>
                    </div>

                    <div class="adm-procedural-list">
                        ${isCustom ? `
                            <div class="adm-empty">
                                Les matières personnalisées créées par l'enseignant utilisent uniquement vos leçons manuelles.<br>
                                <button type="button" class="adm-btn adm-btn-ok" style="margin-top:10px;" onclick="ADM.setSubjectSubTab('manual')">Ajouter une leçon manuelle</button>
                            </div>
                        ` : (proceduralCards || '<div class="adm-empty">Aucune question disponible pour ce niveau.</div>')}
                    </div>
                `}
            </div>`;
    }

    function renderTestModal() {
        const q = S.testModalQuestion;
        if (!q) return '';
        const res = S.testModalResult;
        const type = q.type || 'qcm';

        let interactiveHtml = '';
        if (type === 'qcm') {
            const opts = Array.isArray(q.opts) ? q.opts : [];
            interactiveHtml = `
                <div class="adm-test-options" style="display:flex; flex-direction:column; gap:8px; margin:16px 0;">
                    ${opts.map((opt, i) => {
                        const sel = S.testModalAnswer === i;
                        return `<button type="button" class="adm-btn ${sel ? 'adm-btn-ok' : 'adm-btn-ghost'}" style="text-align:left; justify-content:flex-start;" onclick="ADM.selectTestAnswer(${i})">
                            <b style="min-width:24px;">${String.fromCharCode(65 + i)}.</b> ${esc(opt)}
                        </button>`;
                    }).join('')}
                </div>`;
        } else if (type === 'vrai_faux') {
            interactiveHtml = `
                <div style="display:flex; gap:12px; margin:16px 0;">
                    <button type="button" class="adm-btn ${S.testModalAnswer === true ? 'adm-btn-ok' : 'adm-btn-ghost'}" style="flex:1;" onclick="ADM.selectTestAnswer(true)">
                        ✓ Vrai
                    </button>
                    <button type="button" class="adm-btn ${S.testModalAnswer === false ? 'adm-btn-ok' : 'adm-btn-ghost'}" style="flex:1;" onclick="ADM.selectTestAnswer(false)">
                        ✗ Faux
                    </button>
                </div>`;
        } else if (type === 'reponse_courte') {
            interactiveHtml = `
                <div style="margin:16px 0;">
                    <label class="adm-hint" style="display:block; margin-bottom:6px;">Saisissez votre réponse :</label>
                    <input class="adm-input" id="admTestShortInput" value="${esc(S.testModalAnswer || '')}" placeholder="Tapez votre réponse ici..." oninput="ADM.setTestTextAnswer(this.value)" style="font-size:1.05rem; padding:10px 14px;">
                </div>`;
        } else if (type === 'texte_a_choix' && Array.isArray(q.choices) && q.choices.length > 0) {
            const text = q.textWithBlanks || q.q || '';
            const curAns = Array.isArray(S.testModalAnswer) ? S.testModalAnswer : q.choices.map(() => '');
            interactiveHtml = `
                <div style="margin:16px 0; font-size:1.05rem; line-height:1.6;">
                    <p style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">${esc(text)}</p>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                        ${q.choices.map((opts, idx) => `
                            <div style="display:flex; align-items:center; gap:10px;">
                                <label class="adm-hint" style="min-width:70px;">Trou #${idx + 1} :</label>
                                <select class="adm-select" onchange="ADM.setTestBlankChoice(${idx}, this.value)">
                                    <option value="">— Choisir —</option>
                                    ${(Array.isArray(opts) ? opts : [opts]).map(opt => `<option value="${esc(opt)}"${curAns[idx] === opt ? ' selected' : ''}>${esc(opt)}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        } else if (type === 'texte_a_trous' || type === 'texte_a_choix') {
            const text = q.textWithBlanks || q.q || '';
            interactiveHtml = `
                <div style="margin:16px 0; font-size:1.05rem; line-height:1.6;">
                    <p style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">${esc(text)}</p>
                    <label class="adm-hint" style="display:block; margin:8px 0 4px;">Saisissez les mots choisis (séparés par une virgule) :</label>
                    <input class="adm-input" id="admTestBlanksInput" value="${esc(Array.isArray(S.testModalAnswer) ? S.testModalAnswer.join(', ') : (S.testModalAnswer || ''))}" placeholder="ex: mot1, mot2..." oninput="ADM.setTestTextAnswer(this.value.split(',').map(s=>s.trim()))">
                </div>`;
        } else { // drag_and_drop interactif
            const items = Array.isArray(q.items) ? q.items : [];
            const targets = Array.isArray(q.targets) ? q.targets : [];
            const curMap = (S.testModalAnswer && typeof S.testModalAnswer === 'object' && !Array.isArray(S.testModalAnswer))
                ? S.testModalAnswer : {};
            interactiveHtml = `
                <div style="margin:16px 0;">
                    <p class="adm-hint" style="margin-bottom:8px;">Associez chaque élément à sa cible correspondante :</p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${items.map((it, idx) => `
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:center;">
                                <div style="padding:8px; background:rgba(255,255,255,0.05); border-radius:6px;"><b>${idx + 1}.</b> ${esc(it)}</div>
                                <select class="adm-select" data-item="${esc(it)}" onchange="ADM.setTestDragAnswer(this.dataset.item, this.value)">
                                    <option value="">— Sélectionner une cible —</option>
                                    ${targets.map(tg => `<option value="${esc(tg)}"${curMap[it] === tg ? ' selected' : ''}>${esc(tg)}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }

        let resultBanner = '';
        if (res) {
            if (res.isCorrect) {
                resultBanner = `
                    <div class="adm-note ok" style="margin-top:14px; border-left-color:var(--green); background:rgba(102,187,106,0.15);">
                        <div style="color:#a5d6a7; font-weight:700; font-size:1.05rem;">🎉 Réponse correcte !</div>
                        ${res.exp ? `<p style="margin:6px 0 0; color:#dcedc8; font-size:0.9rem;">💡 ${esc(res.exp)}</p>` : ''}
                    </div>`;
            } else {
                resultBanner = `
                    <div class="adm-note warn" style="margin-top:14px;">
                        <div style="color:#ffb74d; font-weight:700; font-size:1.05rem;">❌ Réponse incorrecte</div>
                        <p style="margin:6px 0 0; font-size:0.95rem;">Attendu : <b>${esc(res.correctStr || '')}</b></p>
                        ${res.exp ? `<p style="margin:6px 0 0; font-size:0.85rem; color:#8fa1d0;">💡 ${esc(res.exp)}</p>` : ''}
                    </div>`;
            }
        }

        return `
            <div class="adm-modal-backdrop" onclick="if(event.target===this)ADM.closeTestModal()">
                <div class="adm-modal-card">
                    <div class="adm-modal-header">
                        <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                            🧪 Test interactif de la question
                            <span class="adm-badge adm-badge-type">${esc(typeLabel(type))}</span>
                        </h3>
                        <button type="button" class="adm-ico-btn" onclick="ADM.closeTestModal()" title="Fermer">✕</button>
                    </div>
                    <div style="margin-top:14px;">
                        <p style="font-size:1.15rem; font-weight:600; color:#fff; margin-bottom:12px; line-height:1.4;">
                            ${esc(q.q || q.title || 'Question')}
                        </p>
                        ${interactiveHtml}
                        ${resultBanner}
                        <div class="adm-toolbar" style="margin-top:16px; border-top:1px dashed rgba(154,167,216,0.2); padding-top:12px;">
                            <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.submitTestAnswer()">Valider la réponse</button>
                            <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.closeTestModal()">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    /* ----- Éditeur d'une leçon ----- */

    function renderLessonEditor(lessons) {
        const isNew = S.editingLesson === -1;
        const d = S.lessonDraft || { type: 'qcm', title: '', q: '', opts: ['', '', '', ''], correct: 0, exp: '' };
        const type = d.type || 'qcm';
        const opts = Array.isArray(d.opts) ? d.opts.slice(0, 4) : ['', '', '', ''];
        while (opts.length < 4) opts.push('');

        const typeSelect = `
            <div class="adm-field" style="max-width:220px;">
                <label>Type de question</label>
                <select class="adm-select" id="admF_type" onchange="ADM.lessonType(this.value)">
                    ${LESSON_ORDER.map(t => `<option value="${t}"${t === type ? ' selected' : ''}>${typeLabel(t)}</option>`).join('')}
                </select>
            </div>`;

        const commonFields = `
            <div class="adm-field"><label>Titre du niveau (facultatif)</label>
                <input class="adm-input" id="admF_title" value="${esc(d.title || '')}" placeholder="Ex: La Révolution française"></div>
            ${typeFields(type, d)}
            <div class="adm-field"><label>Explication (affichée après la réponse)</label>
                <textarea class="adm-textarea" id="admF_exp" rows="2">${esc(d.exp || '')}</textarea></div>`;

        return `
            <div class="adm-editor">
                <h3>${isNew ? '➕ Nouvelle leçon' : '✏️ Modifier la leçon ' + (S.editingLesson + 1)}</h3>
                <div class="adm-form">
                    ${typeSelect}
                    ${commonFields}
                    <div class="adm-error" id="admLessonErr"></div>
                    <div class="adm-toolbar">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.lessonSave()">💾 Enregistrer la leçon</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.cancelLesson()">Annuler</button>
                    </div>
                </div>
            </div>`;
    }

    function typeFields(type, d) {
        if (type === 'qcm') {
            const rawOpts = Array.isArray(d.opts) && d.opts.length >= 2 ? d.opts.slice(0, 6) : ['', '', '', ''];
            const opts = rawOpts.slice();
            while (opts.length < 4) opts.push('');
            const correct = Number.isInteger(Number(d.correct)) ? Number(d.correct) : 0;
            return `
                <div class="adm-field"><label>Question</label>
                    <textarea class="adm-textarea" id="admF_q" rows="2">${esc(d.q || '')}</textarea></div>
                <div class="adm-field"><label>Réponses proposées (cochez la bonne)</label>
                    ${opts.map((o, i) => `
                        <div class="adm-opt-row" style="margin-bottom:6px;">
                            <input type="radio" name="admF_correct" value="${i}" id="admC${i}" ${i === correct ? 'checked' : ''} title="Bonne réponse" onchange="ADM.updateQcmCorrectTag(${i})">
                            <input class="adm-input" id="admF_opt${i}" data-qcm-opt="1" value="${esc(o)}" placeholder="Réponse ${String.fromCharCode(65 + i)}">
                            <span class="adm-correct-tag" id="admCTag${i}" style="${i === correct ? '' : 'display:none;'}">✔ bonne réponse</span>
                        </div>`).join('')}
                </div>`;
        }
        if (type === 'vrai_faux') {
            return `
                <div class="adm-field"><label>Affirmation (vrai ou faux)</label>
                    <textarea class="adm-textarea" id="admF_q" rows="2">${esc(d.q || '')}</textarea></div>
                <div class="adm-field" style="max-width:180px;"><label>Réponse attendue</label>
                    <select class="adm-select" id="admF_vf">
                        <option value="true"${d.correct === true ? ' selected' : ''}>Vrai</option>
                        <option value="false"${d.correct === false ? ' selected' : ''}>Faux</option>
                    </select></div>`;
        }
        if (type === 'reponse_courte') {
            return `
                <div class="adm-field"><label>Question</label>
                    <textarea class="adm-textarea" id="admF_q" rows="2">${esc(d.q || '')}</textarea></div>
                <div class="adm-field"><label>Réponses acceptées (une par ligne)</label>
                    <textarea class="adm-textarea" id="admF_acc" rows="3">${esc((d.accepted || []).join('\n'))}</textarea></div>`;
        }
        if (type === 'texte_a_trous') {
            return `
                <div class="adm-field"><label>Phrase à compléter (chaque trou = ___ )</label>
                    <textarea class="adm-textarea" id="admF_txt" rows="2">${esc(d.textWithBlanks || '')}</textarea></div>
                <div class="adm-field"><label>Réponses des trous (une ligne par trou, alternatives séparées par des virgules)</label>
                    <textarea class="adm-textarea" id="admF_blanks" rows="3">${esc((d.blanks || []).map(b => (b || []).join(', ')).join('\n'))}</textarea></div>`;
        }
        if (type === 'texte_a_choix') {
            return `
                <div class="adm-field"><label>Consigne</label>
                    <input class="adm-input" id="admF_q" value="${esc(d.q || '')}" placeholder="Ex: Complète la phrase avec les bons mots."></div>
                <div class="adm-field"><label>Phrase à compléter (chaque menu déroulant = ___ )</label>
                    <textarea class="adm-textarea" id="admF_txt" rows="2">${esc(d.textWithBlanks || '')}</textarea></div>
                <div class="adm-field"><label>Bonnes réponses attendues (une ligne par trou)</label>
                    <textarea class="adm-textarea" id="admF_blanks" rows="2">${esc((d.blanks || []).map(b => (Array.isArray(b) ? b : [b]).join(', ')).join('\n'))}</textarea></div>
                <div class="adm-field"><label>Choix proposés dans chaque menu (une ligne par trou, options séparées par des virgules)</label>
                    <textarea class="adm-textarea" id="admF_choices" rows="3">${esc((d.choices || []).map(c => (Array.isArray(c) ? c : [c]).join(', ')).join('\n'))}</textarea></div>`;
        }
        // drag_and_drop
        return `
            <div class="adm-field"><label>Consigne</label>
                <textarea class="adm-textarea" id="admF_q" rows="2">${esc(d.q || '')}</textarea></div>
            <div class="adm-grid-2">
                <div class="adm-field"><label>Éléments à associer (un par ligne)</label>
                    <textarea class="adm-textarea" id="admF_items" rows="4">${esc((d.items || []).join('\n'))}</textarea></div>
                <div class="adm-field"><label>Cibles (un par ligne, même ordre)</label>
                    <textarea class="adm-textarea" id="admF_targets" rows="4">${esc((d.targets || []).join('\n'))}</textarea></div>
            </div>
            <p class="adm-hint">Les paires sont formées par position : 1er élément ↔ 1ère cible, etc.</p>`;
    }

    /** Lit le formulaire d'édition et reconstruit la leçon canonique. */
    function readLessonForm() {
        const type = (document.getElementById('admF_type') || {}).value || 'qcm';
        const val = (id) => (document.getElementById(id) || {}).value ?? '';
        const lesson = { type, title: val('admF_title').trim() };
        if (type === 'qcm') {
            lesson.q = val('admF_q').trim();
            const optInputs = Array.from(document.querySelectorAll('input[data-qcm-opt="1"]'));
            lesson.opts = optInputs.length > 0
                ? optInputs.map(el => String(el.value || '').trim()).filter((v, idx, arr) => v !== '' || idx < 2 || arr.slice(idx + 1).some(Boolean))
                : [0, 1, 2, 3].map(i => val('admF_opt' + i).trim());
            const radio = document.querySelector('input[name="admF_correct"]:checked');
            lesson.correct = radio ? Number(radio.value) : 0;
            lesson.exp = val('admF_exp').trim();
        } else if (type === 'vrai_faux') {
            lesson.q = val('admF_q').trim();
            lesson.correct = val('admF_vf') === 'true';
            lesson.exp = val('admF_exp').trim();
        } else if (type === 'reponse_courte') {
            lesson.q = val('admF_q').trim();
            lesson.accepted = linesToList(val('admF_acc'));
            lesson.exp = val('admF_exp').trim();
        } else if (type === 'texte_a_trous') {
            lesson.textWithBlanks = val('admF_txt').trim();
            lesson.blanks = linesToList(val('admF_blanks')).map(line =>
                line.split(',').map(s => s.trim()).filter(Boolean));
            lesson.exp = val('admF_exp').trim();
        } else if (type === 'texte_a_choix') {
            lesson.q = val('admF_q').trim() || 'Complète la phrase avec les choix proposés.';
            lesson.textWithBlanks = val('admF_txt').trim();
            lesson.blanks = linesToList(val('admF_blanks')).map(line =>
                line.split(',').map(s => s.trim()).filter(Boolean));
            lesson.choices = linesToList(val('admF_choices')).map(line =>
                line.split(',').map(s => s.trim()).filter(Boolean));
            lesson.exp = val('admF_exp').trim();
        } else { // drag_and_drop
            lesson.q = val('admF_q').trim();
            lesson.items = linesToList(val('admF_items'));
            lesson.targets = linesToList(val('admF_targets'));
            const pairs = {};
            lesson.items.forEach((it, i) => { if (lesson.targets[i]) pairs[it] = lesson.targets[i]; });
            lesson.pairs = pairs;
            lesson.exp = val('admF_exp').trim();
        }
        return lesson;
    }

    /* ============================== ONGLET : SUCCÈS ============================== */

    const BADGE_CATEGORY_LABELS = {
        all: '🌟 Tous',
        progression: '🎯 Progression',
        precision: '✨ Précision',
        exploration: '🌐 Exploration',
        maitrise: '🏆 Maîtrise',
        boutique: '🎨 Boutique',
        niveau: '🚀 Niveau & XP',
        economie: '💰 Économie',
        potions: '🧪 Potions',
        matieres: '📚 Matières',
        personnalisation: '✨ Personnalisation',
        quetes: '📋 Quêtes',
    };

    function renderBadges() {
        const cat = S.badgeCategory || 'all';
        const filFilter = S.badgeFiliereFilter || 'all';
        const allBadges = (typeof AdminStore !== 'undefined') ? AdminStore.getBadges() : [];
        const allFilieres = (typeof AdminStore !== 'undefined' && AdminStore.getFilieres) ? AdminStore.getFilieres() : [];

        const matchesFiliere = (b) => {
            if (filFilter === 'all') return true;
            const af = Array.isArray(b.allowedFilieres) && b.allowedFilieres.length ? b.allowedFilieres : ['all'];
            const band = b.band || 'all';
            if (filFilter === 'universal') return band === 'all' && af.includes('all');
            if (filFilter === 'college') return band === 'college';
            return band !== 'college' && af.includes(filFilter) && !af.includes('all');
        };

        const filtered = allBadges.filter(b =>
            (cat === 'all' || (b.category || 'progression') === cat) && matchesFiliere(b)
        );
        const unlockedList = (typeof DB !== 'undefined') ? DB.getBadges() : [];

        const editor = S.editingBadge ? renderBadgeEditor(S.editingBadge) : '';

        const badgeCards = filtered.map(b => {
            const isUnlocked = unlockedList.includes(b.id);
            const scopeLbl = (typeof AdminStore !== 'undefined' && AdminStore.getBadgeScopeLabel)
                ? AdminStore.getBadgeScopeLabel(b)
                : '🌐 Tous';
            return `
                <div class="adm-shop-card ${b.disabled ? 'disabled' : ''}">
                    <div class="adm-shop-card-head">
                        <div class="adm-shop-orb" style="font-size: 1.8rem; background: rgba(200,168,75,0.15);">
                            ${emoIco(b.icon || 'trophy', 26, 'gold')}
                        </div>
                        <div class="adm-shop-meta">
                            <div class="adm-shop-title">
                                <b>${esc(b.name)}</b>
                                <span class="adm-badge adm-badge-type">${esc(BADGE_CATEGORY_LABELS[b.category] || b.category)}</span>
                            </div>
                            <div class="adm-shop-cost" style="font-size:0.85rem; color:#8fa1d0;">ID: <code>${esc(b.id)}</code></div>
                            <span class="adm-badge-filiere-tag">${esc(scopeLbl)}</span>
                        </div>
                    </div>
                    <p class="adm-shop-desc">${esc(b.desc || 'Aucune description')}</p>
                    <div class="adm-shop-actions">
                        <button type="button" class="adm-btn ${isUnlocked ? 'adm-btn-ok' : 'adm-btn-ghost'}" style="padding:4px 10px; font-size:0.85rem;" data-id="${esc(b.id)}" onclick="ADM.toggleBadgeUnlock(this.dataset.id)">
                            ${isUnlocked ? ico('check', 14, 'emerald') + ' Débloqué (Test)' : ico('lock', 14, 'muted') + ' Verrouillé'}
                        </button>
                        <div class="adm-row-actions">
                            <button type="button" class="adm-ico-btn" title="Modifier" data-id="${esc(b.id)}" onclick="ADM.editBadge(this.dataset.id)">${ico('edit', 14)} Modifier</button>
                            <button type="button" class="adm-ico-btn danger" title="Supprimer" data-id="${esc(b.id)}" onclick="ADM.deleteBadge(this.dataset.id)">${ico('close', 14, 'danger')}</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">🏆 Gestion des Succès &amp; Badges <small>${filtered.length}/${allBadges.length} affiché(s)</small></h2>
                    <div class="adm-right" style="display:flex; gap:8px;">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.newBadge()">+ Ajouter un succès</button>
                    </div>
                </div>
                <p class="adm-hint">Pilotez chaque succès et sa <b>filière cible</b> (CIEL, STMG, STI2D, NSI, ST2S, Générale, Collège ou Universel). Les élèves ne voient par défaut que les succès de leur filière, avec un bouton « Tout voir » sur leur tableau de bord.</p>

                <!-- Filtres par Filière -->
                <div class="adm-shop-filter-tabs" style="margin-bottom:8px;">
                    <button type="button" class="adm-shop-filter-btn ${filFilter === 'all' ? 'active' : ''}" onclick="ADM.setBadgeFiliereFilter('all')">👁️ Toutes filières (${allBadges.length})</button>
                    <button type="button" class="adm-shop-filter-btn ${filFilter === 'universal' ? 'active' : ''}" onclick="ADM.setBadgeFiliereFilter('universal')">🌐 Universels</button>
                    <button type="button" class="adm-shop-filter-btn ${filFilter === 'college' ? 'active' : ''}" onclick="ADM.setBadgeFiliereFilter('college')">🏫 Collège</button>
                    ${allFilieres.map(f => {
                        const cnt = allBadges.filter(b => b.band !== 'college' && Array.isArray(b.allowedFilieres) && b.allowedFilieres.includes(f.id) && !b.allowedFilieres.includes('all')).length;
                        return `<button type="button" class="adm-shop-filter-btn ${filFilter === f.id ? 'active' : ''}" data-id="${esc(f.id)}" onclick="ADM.setBadgeFiliereFilter(this.dataset.id)">${emoIco(f.icon || 'compass', 14)} ${esc(f.shortLabel || f.label)} (${cnt})</button>`;
                    }).join('')}
                </div>

                <!-- Filtres par Catégorie -->
                <div class="adm-shop-filter-tabs">
                    ${Object.keys(BADGE_CATEGORY_LABELS).map(k => `
                        <button type="button" class="adm-shop-filter-btn ${cat === k ? 'active' : ''}" onclick="ADM.setBadgeCategory('${k}')">
                            ${BADGE_CATEGORY_LABELS[k]} (${k === 'all' ? allBadges.filter(matchesFiliere).length : allBadges.filter(i => (i.category || 'progression') === k && matchesFiliere(i)).length})
                        </button>
                    `).join('')}
                </div>

                ${editor}

                <div class="adm-shop-grid">
                    ${badgeCards || '<div class="adm-empty" style="grid-column: 1/-1;">Aucun succès ne correspond à ces filtres.</div>'}
                </div>

                <div class="adm-toolbar" style="margin-top:20px; border-top: 1px dashed rgba(154,167,216,0.2); padding-top: 14px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.unlockAllBadges()">✨ Tout débloquer (test compte)</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetUserBadges()">🔒 Réinitialiser mes succès</button>
                    <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.resetBadgesCatalog()">🔄 Rétablir le catalogue de succès par défaut</button>
                </div>
            </div>`;
    }

    function renderBadgeEditor(badge) {
        const isNew = Boolean(badge._isNew);
        const allFilieres = (typeof AdminStore !== 'undefined' && AdminStore.getFilieres) ? AdminStore.getFilieres() : [];
        const curFil = Array.isArray(badge.allowedFilieres) && badge.allowedFilieres.length ? badge.allowedFilieres : ['all'];
        const isAllFil = curFil.includes('all');
        const curBand = badge.band || 'all';

        return `
            <div class="adm-editor" style="margin: 16px 0;">
                <h3>${isNew ? '➕ Nouveau succès' : '✏️ Modifier le succès « ' + esc(badge.name) + ' »'}</h3>
                <div class="adm-form">
                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Identifiant unique (slug)</label>
                            <input class="adm-input" id="admBadgeId" value="${esc(badge.id || '')}" ${isNew ? '' : 'readonly'} placeholder="ex: mon_succes">
                        </div>
                        <div class="adm-field">
                            <label>Nom du succès</label>
                            <input class="adm-input" id="admBadgeName" value="${esc(badge.name || '')}" placeholder="ex: Maître des Quiz">
                        </div>
                    </div>

                    <div class="adm-grid-3">
                        <div class="adm-field">
                            <label>Icône / Émoji</label>
                            <input class="adm-input" id="admBadgeIcon" value="${esc(badge.icon || '🏆')}" placeholder="ex: 🏆 ou 🎯" style="max-width:120px;">
                        </div>
                        <div class="adm-field">
                            <label>Catégorie</label>
                            <select class="adm-select" id="admBadgeCat">
                                ${Object.keys(BADGE_CATEGORY_LABELS).filter(k => k !== 'all').map(k => `
                                    <option value="${k}" ${(badge.category || 'progression') === k ? 'selected' : ''}>${BADGE_CATEGORY_LABELS[k]}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="adm-field">
                            <label>Cycle scolaire cible</label>
                            <select class="adm-select" id="admBadgeBand">
                                <option value="all"${curBand === 'all' ? ' selected' : ''}>🌐 Tous cycles (Collège, Lycée &amp; BTS)</option>
                                <option value="college"${curBand === 'college' ? ' selected' : ''}>🏫 Collège uniquement (6e → 3e)</option>
                                <option value="lycee"${curBand === 'lycee' ? ' selected' : ''}>🏛️ Lycée &amp; BTS uniquement</option>
                            </select>
                        </div>
                    </div>

                    <div class="adm-field">
                        <label>Filières visibles (Lycée &amp; BTS)</label>
                        <div class="adm-grade-pills" id="admBadgeFilieresWrap">
                            <button type="button" class="adm-grade-pill ${isAllFil ? 'checked' : ''}" onclick="ADM.toggleEditBadgeFiliere('all')">${isAllFil ? '✓' : '○'} 🌐 Toutes les filières</button>
                            ${allFilieres.map(f => {
                                const checked = !isAllFil && curFil.includes(f.id);
                                return `<button type="button" class="adm-grade-pill ${checked ? 'checked' : ''}" data-id="${esc(f.id)}" onclick="ADM.toggleEditBadgeFiliere(this.dataset.id)">${checked ? '✓' : '○'} ${emoIco(f.icon || 'compass', 14)} ${esc(f.shortLabel || f.label)}</button>`;
                            }).join('')}
                        </div>
                        <span class="adm-hint">Ex : cochez uniquement « CIEL » pour que les élèves STSS ou STMG ne voient pas ce succès par défaut.</span>
                    </div>

                    <div class="adm-field">
                        <label>Description (condition montrée au joueur)</label>
                        <input class="adm-input" id="admBadgeDesc" value="${esc(badge.desc || '')}" placeholder="ex: Réussis 10 quiz sans faire d'erreur.">
                    </div>

                    <div class="adm-field">
                        <label>Condition technique (évaluée automatiquement)</label>
                        <input class="adm-input" id="admBadgeCond" value="${esc(badge.condition || '')}" placeholder="ex: cyberLevel >= 5, stmgLevel >= 5, totalCompleted >= 10, streakCount >= 5">
                        <span class="adm-hint">Variables disponibles : <code>totalCompleted</code>, <code>playerLevel</code>, <code>coins</code>, <code>streakCount</code>, <code>comboCount</code>, <code>mathsLevel</code>, <code>cyberLevel</code>, <code>reseauxLevel</code>, <code>electroniqueLevel</code>, <code>stmgLevel</code>, <code>sti2dLevel</code>, <code>stssLevel</code>, <code>nsiLevel</code>, <code>hggspLevel</code>, <code>&lt;idMatiere&gt;Level</code>…</span>
                    </div>

                    <div class="adm-form-actions" style="margin-top:14px; display:flex; gap:10px;">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.saveBadge()">💾 Enregistrer le succès</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.cancelBadgeEdit()">Annuler</button>
                    </div>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : BOUTIQUE ============================== */

    const SHOP_CATEGORY_LABELS = {
        all: '🌟 Tous',
        aura: '🔮 Auras & Halos',
        avatar: '👤 Personnages',
        title: '📜 Titres',
        theme: '🎨 Thèmes',
        booster: '⚡ Boosters',
    };

    function renderShop() {
        const cat = S.shopCategory || 'all';
        const allItems = (typeof AdminStore !== 'undefined') ? AdminStore.getShopItems() : [];
        const catCounts = { all: allItems.length };
        for (let i = 0; i < allItems.length; i++) {
            const c = allItems[i].category;
            catCounts[c] = (catCounts[c] || 0) + 1;
        }
        const filtered = cat === 'all' ? allItems : allItems.filter(it => it.category === cat);

        const editor = S.editingShopItem ? renderShopItemEditor(S.editingShopItem) : '';

        const itemCards = filtered.map((item) => {
            const safeColor = safeHex(item.color, '#c8a84b');
            const safeImg = isSafeImgUrl(item.img) ? item.img.trim() : '';
            const itemCost = Math.max(0, Number(item.cost) || 0);
            return `
                <div class="adm-shop-card ${item.disabled ? 'disabled' : ''}">
                    <div class="adm-shop-card-head">
                        <div class="adm-shop-orb" style="--sc:${safeColor}">
                            ${safeImg ? `<img src="${esc(safeImg)}" alt="" loading="lazy" decoding="async">` : emoIco(item.icon || 'sparkle', 22, 'gold')}
                        </div>
                        <div class="adm-shop-meta">
                            <div class="adm-shop-title">
                                <b>${esc(item.name)}</b>
                                <span class="adm-badge adm-badge-type">${esc(SHOP_CATEGORY_LABELS[item.category] || item.category)}</span>
                            </div>
                            <div class="adm-shop-cost">${ico('coin', 14, 'gold')} ${itemCost === 0 ? 'Offert' : itemCost + ' pièces'}</div>
                        </div>
                    </div>
                    <p class="adm-shop-desc">${esc(item.desc || 'Aucune description')}</p>
                    <div class="adm-shop-actions">
                        <span class="adm-badge ${item.disabled ? 'adm-badge-admin' : 'adm-badge-eleve'}">${item.disabled ? 'Désactivé' : 'Actif'}</span>
                        <div class="adm-row-actions">
                            <button type="button" class="adm-ico-btn" title="Modifier" data-id="${esc(item.id)}" onclick="ADM.editShopItem(this.dataset.id)">${ico('edit', 14)} Modifier</button>
                            <button type="button" class="adm-ico-btn danger" title="Supprimer" data-id="${esc(item.id)}" onclick="ADM.deleteShopItem(this.dataset.id)">${ico('close', 14, 'danger')}</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">🛍️ Gestion de la Boutique <small>${allItems.length} article(s)</small></h2>
                    <button type="button" class="adm-btn adm-btn-ok adm-right" onclick="ADM.newShopItem()">+ Ajouter un article</button>
                </div>
                <p class="adm-hint">Personnalisez les prix, l'apparence et ajoutez de nouveaux articles (Halos, Avatars, Titres, Thèmes, Boosters) pour motiver les élèves.</p>

                <!-- Filtres de catégories -->
                <div class="adm-shop-filter-tabs">
                    ${Object.keys(SHOP_CATEGORY_LABELS).map(k => `
                        <button type="button" class="adm-shop-filter-btn ${cat === k ? 'active' : ''}" onclick="ADM.setShopCategory('${k}')">
                            ${SHOP_CATEGORY_LABELS[k]} (${catCounts[k] || 0})
                        </button>
                    `).join('')}
                </div>

                ${editor}

                <div class="adm-shop-grid">
                    ${itemCards || '<div class="adm-empty" style="grid-column: 1/-1;">Aucun article dans cette catégorie.</div>'}
                </div>

                <div class="adm-toolbar" style="margin-top:20px; border-top: 1px dashed rgba(154,167,216,0.2); padding-top: 14px;">
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetShopItems()">🔄 Rétablir la boutique par défaut</button>
                </div>
            </div>`;
    }

    function renderShopItemEditor(item) {
        const isNew = Boolean(item._isNew);
        return `
            <div class="adm-editor" style="margin: 16px 0;">
                <h3>${isNew ? '➕ Nouvel article de boutique' : '✏️ Modifier l\'article « ' + esc(item.name) + ' »'}</h3>
                <div class="adm-form">
                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Identifiant unique (slug)</label>
                            <input class="adm-input" id="admShopId" value="${esc(item.id || '')}" ${isNew ? '' : 'readonly'} placeholder="ex: super-halo">
                        </div>
                        <div class="adm-field">
                            <label>Nom affiché</label>
                            <input class="adm-input" id="admShopName" value="${esc(item.name || '')}" placeholder="ex: Dragon Flamboyant" oninput="ADM.updateShopPreview()">
                        </div>
                    </div>

                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Catégorie</label>
                            <select class="adm-select" id="admShopCategory" onchange="ADM.updateShopPreview()">
                                <option value="aura" ${item.category === 'aura' ? 'selected' : ''}>🔮 Aura / Halo</option>
                                <option value="avatar" ${item.category === 'avatar' ? 'selected' : ''}>👤 Personnage / Avatar</option>
                                <option value="title" ${item.category === 'title' ? 'selected' : ''}>📜 Titre honorifique</option>
                                <option value="theme" ${item.category === 'theme' ? 'selected' : ''}>🎨 Thème & Effet</option>
                                <option value="booster" ${item.category === 'booster' ? 'selected' : ''}>⚡ Booster d'XP / Bouclier</option>
                            </select>
                        </div>
                        <div class="adm-field">
                            <label>Prix (en pièces d'or)</label>
                            <input class="adm-input" type="number" id="admShopCost" min="0" value="${item.cost ?? 50}" placeholder="0 = Offert" oninput="ADM.updateShopPreview()">
                        </div>
                    </div>

                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Couleur du Halo / Aura (Hex)</label>
                            <div style="display:flex; gap:8px;">
                                <input class="adm-input" type="color" id="admShopColorPicker" value="${safeHex(item.color, '#c8a84b')}" style="width:50px; padding:2px; height:38px; cursor:pointer;" onchange="document.getElementById('admShopColor').value = this.value; ADM.updateShopPreview();">
                                <input class="adm-input" id="admShopColor" value="${esc(safeHex(item.color, '#c8a84b'))}" placeholder="#4fd8c4" oninput="if(/^#[0-9a-f]{6}$/i.test(this.value.trim()))document.getElementById('admShopColorPicker').value = this.value.trim(); ADM.updateShopPreview();">
                            </div>
                        </div>
                        <div class="adm-field">
                            <label>Chemin de l'image (pour avatar, optionnel)</label>
                            <input class="adm-input" id="admShopImg" value="${esc(item.img || '')}" placeholder="ex: Image/personnages/lovelace.svg" oninput="ADM.updateShopPreview()">
                        </div>
                    </div>

                    <div class="adm-field">
                        <label>Description & Effet en jeu</label>
                        <textarea class="adm-textarea" id="admShopDesc" rows="2" placeholder="Description de l'article visible dans la boutique...">${esc(item.desc || '')}</textarea>
                    </div>

                    <div class="adm-field" style="max-width:260px;">
                        <label class="checkbox-container" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="admShopDisabled" ${item.disabled ? 'checked' : ''}>
                            <span style="font-size:14px; color:var(--ink);">Désactiver cet article</span>
                        </label>
                    </div>

                    <!-- Live preview card -->
                    <div style="margin: 10px 0; padding: 12px; background: rgba(7,11,26,0.5); border-radius: 10px; border: 1px dashed rgba(200,168,75,0.3);">
                        <div style="font-size:12px; color:var(--muted); margin-bottom:6px; text-transform:uppercase;">Aperçu dans la boutique :</div>
                        <div id="admShopLivePreview" style="display:inline-flex; align-items:center; gap:14px; background: rgba(13,19,48,0.9); padding:12px 18px; border-radius:12px; border:1px solid rgba(200,168,75,0.4);">
                            <div class="adm-shop-orb" id="admPreviewOrb" style="--sc:${safeHex(item.color, '#c8a84b')}; width:50px; height:50px; margin:0;">
                                ${isSafeImgUrl(item.img) ? `<img id="admPreviewImg" src="${esc(item.img.trim())}" alt="" loading="lazy" decoding="async">` : `<span id="admPreviewIcon">${ico('sparkle', 20, 'gold')}</span>`}
                            </div>
                            <div>
                                <div id="admPreviewTitle" style="font-weight:700; color:#fff;">${esc(item.name || 'Nom de l\'article')}</div>
                                <div id="admPreviewCost" style="font-size:12px; color:var(--gold);">${ico('coin', 13, 'gold')} ${(Number(item.cost) || 0) === 0 ? 'Offert' : (Number(item.cost) || 50) + ' pièces'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="adm-error" id="admShopErr"></div>
                    <div class="adm-toolbar">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.saveShopItem()">💾 Enregistrer l'article</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.cancelShopItem()">Annuler</button>
                    </div>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : RÉCOMPENSES ============================== */

    function renderRewards() {
        const r = (typeof AdminStore !== 'undefined') ? AdminStore.getRewardsConfig() : { xpBase: 15, coinsBase: 10, chronoBonusMaxXp: 15, dailyChestCoins: 50, firstTryBonusXp: 10, questRewardMultiplier: 1 };

        return `
            <div class="adm-card">
                <h2>🎁 Gestion des Récompenses & de l'Économie</h2>
                <p class="adm-hint">Réglez la générosité des gains en XP, en pièces et les bonus accordés aux élèves pour chaque action de jeu.</p>

                <div class="adm-card" style="border-color: rgba(95,212,230,0.35); margin-top: 14px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--cyan); margin-bottom:12px;">🎯 Récompenses de base des Quiz</h3>
                    <div class="adm-form">
                        <div class="adm-grid-2">
                            <div class="adm-field">
                                <label>XP de base par niveau réussi</label>
                                <input class="adm-input" type="number" id="admRwXpBase" min="1" max="500" value="${r.xpBase}">
                                <span class="adm-hint">Par défaut : 15 XP.</span>
                            </div>
                            <div class="adm-field">
                                <label>Pièces gagnées par niveau réussi</label>
                                <input class="adm-input" type="number" id="admRwCoinsBase" min="0" max="500" value="${r.coinsBase}">
                                <span class="adm-hint">Par défaut : 10 pièces.</span>
                            </div>
                        </div>
                        <div class="adm-grid-2">
                            <div class="adm-field">
                                <label>Bonus max Mode Défi Chronométré (XP)</label>
                                <input class="adm-input" type="number" id="admRwChronoXp" min="0" max="500" value="${r.chronoBonusMaxXp}">
                                <span class="adm-hint">Calculé au prorata des secondes restantes (0s → 0 XP, 30s → max XP).</span>
                            </div>
                            <div class="adm-field">
                                <label>Bonus premier coup sans faute (XP)</label>
                                <input class="adm-input" type="number" id="admRwFirstTryXp" min="0" max="500" value="${r.firstTryBonusXp}">
                                <span class="adm-hint">Bonus accordé si la bonne réponse est trouvée dès le premier essai.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="adm-card" style="border-color: rgba(200,168,75,0.35); margin-top: 16px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--gold-soft); margin-bottom:12px;">📜 Quêtes Quotidiennes & Coffre Bonus</h3>
                    <div class="adm-form">
                        <div class="adm-grid-2">
                            <div class="adm-field">
                                <label>Pièces du coffre bonus quotidien</label>
                                <input class="adm-input" type="number" id="admRwDailyChest" min="0" max="1000" value="${r.dailyChestCoins}">
                                <span class="adm-hint">Débloqué lorsque toutes les 3 quêtes du jour sont accomplies.</span>
                            </div>
                            <div class="adm-field">
                                <label>Multiplicateur des récompenses de quêtes</label>
                                <input class="adm-input" type="number" step="0.1" min="0.1" max="5.0" id="admRwQuestMult" value="${r.questRewardMultiplier}">
                                <span class="adm-hint">Ex: 1.5 pour +50% de gains sur toutes les quêtes journalières.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="adm-toolbar" style="margin-top:16px;">
                    <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.rewardsSave()">💾 Enregistrer les récompenses</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.rewardsReset()">Rétablir les valeurs par défaut</button>
                </div>

                <!-- Éditeur complet du Pool de Quêtes Quotidiennes -->
                <div class="adm-card" style="border-color: rgba(95,212,230,0.35); margin-top: 16px;">
                    <div class="adm-toolbar">
                        <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--cyan); margin:0;">📋 Pool des Quêtes Quotidiennes (${(S.questsDraft || AdminStore.getQuestPool()).length})</h3>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.refreshTodayQuests()">🔄 Régénérer les quêtes du jour</button>
                    </div>
                    <p class="adm-hint" style="margin:6px 0 10px;">Personnalisez les missions tirées chaque matin à minuit (3 types distincts tirés + la quête de connexion).</p>
                    ${(() => {
                        if (!S.questsDraft) S.questsDraft = AdminStore.getQuestPool();
                        const qList = S.questsDraft;
                        return `
                        <div class="adm-table-wrap">
                            <table class="adm-table">
                                <thead>
                                    <tr>
                                        <th>Icône</th>
                                        <th>Titre</th>
                                        <th>Type</th>
                                        <th>Objectif</th>
                                        <th>XP</th>
                                        <th>Pièces</th>
                                        <th>Active</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${qList.map((q, qi) => `
                                        <tr style="${q.enabled === false ? 'opacity:0.55;' : ''}">
                                            <td style="width:62px;"><input class="adm-input" value="${esc(q.icon || '🎯')}" style="text-align:center;" oninput="ADM.qField(${qi},'icon',this.value)"></td>
                                            <td><input class="adm-input" value="${esc(q.title)}" oninput="ADM.qField(${qi},'title',this.value)"></td>
                                            <td>
                                                <select class="adm-select" onchange="ADM.qField(${qi},'type',this.value)">
                                                    <option value="xp"${q.type === 'xp' ? ' selected' : ''}>⚡ XP gagnée</option>
                                                    <option value="levels"${q.type === 'levels' ? ' selected' : ''}>🏝️ Niveaux réussis</option>
                                                    <option value="perfect"${q.type === 'perfect' ? ' selected' : ''}>⭐ Score 3 étoiles</option>
                                                    <option value="firstTry"${q.type === 'firstTry' ? ' selected' : ''}>🎯 1er coup juste</option>
                                                </select>
                                            </td>
                                            <td style="width:82px;"><input class="adm-input" type="number" min="1" max="500" value="${q.target}" oninput="ADM.qField(${qi},'target',this.value)"></td>
                                            <td style="width:76px;"><input class="adm-input" type="number" min="0" max="500" value="${q.xp}" oninput="ADM.qField(${qi},'xp',this.value)"></td>
                                            <td style="width:76px;"><input class="adm-input" type="number" min="0" max="500" value="${q.coins}" oninput="ADM.qField(${qi},'coins',this.value)"></td>
                                            <td style="text-align:center;"><input type="checkbox" ${q.enabled !== false ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;" onchange="ADM.qField(${qi},'enabled',this.checked)"></td>
                                            <td><button type="button" class="adm-ico-btn danger" ${qList.length <= 1 ? 'disabled' : ''} onclick="ADM.qDelete(${qi})" title="Supprimer">🗑</button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="adm-toolbar" style="margin-top:12px;">
                            <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.qAdd()">+ Ajouter une quête</button>
                            <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.questsSave()">💾 Enregistrer le pool de quêtes</button>
                            <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.questsReset()">Rétablir les quêtes par défaut</button>
                        </div>`;
                    })()}
                </div>

                <!-- Outil de crédit rapide pour tests de la boutique -->
                <div class="adm-card" style="border-color: rgba(102,187,106,0.35); margin-top: 16px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--green); margin-bottom:8px;">💰 Outil de test de l'Économie (Portefeuille Local)</h3>
                    <p class="adm-hint" style="margin-bottom:12px;">Ajoutez des pièces ou de l'XP sur cet appareil pour tester immédiatement les achats en boutique.</p>
                    <div class="adm-toolbar">
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(0, 100)">+100 Pièces 🪙</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(0, 500)">+500 Pièces 🪙</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(100, 0)">+100 XP ⚡</button>
                        <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.grantPlayerReward(0, 0, true)">Réinitialiser à 30 pièces & 0 XP</button>
                    </div>
                </div>

                <!-- Catalogue dynamique des Succès / Badges -->
                <div class="adm-card" style="margin-top: 16px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--gold-soft); margin-bottom:8px;">🏆 Succès &amp; Badges Disponibles (${(typeof AdminStore !== 'undefined' && AdminStore.getBadges) ? AdminStore.getBadges().length : 0})</h3>
                    <div class="adm-table-wrap">
                        <table class="adm-table">
                            <thead><tr><th>Icône</th><th>Nom du Succès</th><th>Portée / Filière</th><th>Description / Condition</th></tr></thead>
                            <tbody>
                                ${((typeof AdminStore !== 'undefined' && AdminStore.getBadges) ? AdminStore.getBadges() : []).map(b => `
                                    <tr>
                                        <td>${esc(b.icon || '🏆')}</td>
                                        <td><b>${esc(b.name)}</b></td>
                                        <td><span class="adm-badge adm-badge-type">${esc(AdminStore.getBadgeScopeLabel ? AdminStore.getBadgeScopeLabel(b) : '🌐 Tous')}</span></td>
                                        <td>${esc(b.desc || b.condition || '')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : MEMBRES ============================== */

    function renderMembers() {
        const me = DB.getCurrentUser();
        const levels = AdminStore.getLevels();
        const filieres = AdminStore.getFilieres();

        const rows = S.members.map(m => {
            const isMe = me && m.email === me.email;
            const curNiv = m.niveau || '6eme';
            const filApplicable = AdminStore.isFiliereApplicable(curNiv);
            const memberFilieres = filApplicable && typeof AdminStore.getFilieresForNiveau === 'function'
                ? AdminStore.getFilieresForNiveau(curNiv)
                : filieres;
            const curFil = filApplicable && typeof AdminStore.resolveFiliereForNiveau === 'function'
                ? AdminStore.resolveFiliereForNiveau(m.filiere || 'generale', curNiv)
                : (m.filiere || 'generale');
            return `
                <tr>
                    <td>
                        <b>${esc(m.username)}</b> ${isMe ? '<span class="adm-badge adm-badge-you">vous</span>' : ''}
                        <div style="font-size:0.78rem; color:var(--muted);">${esc(m.email)}</div>
                    </td>
                    <td>
                        <select class="adm-select adm-member-inline-select" data-email="${esc(m.email)}" onchange="ADM.setMemberGrade(this.dataset.email, this.value)" title="Classe de cet élève">
                            ${levels.map(l => `<option value="${esc(l.id)}"${curNiv === l.id ? ' selected' : ''}>${esc(l.label)}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        ${filApplicable ? `
                        <select class="adm-select adm-member-inline-select" data-email="${esc(m.email)}" onchange="ADM.setMemberFiliere(this.dataset.email, this.value)" title="Filière de cet élève (filtrée selon sa classe)">
                            ${memberFilieres.map(f => `<option value="${esc(f.id)}"${curFil === f.id ? ' selected' : ''}>${esc(f.shortLabel || f.label)}</option>`).join('')}
                        </select>` : '<span class="adm-hint">Collège</span>'}
                    </td>
                    <td style="white-space:nowrap; font-size:0.86rem;">
                        <div>${ico('bolt', 13, 'cyan')} <b>${Number(m.xp) || 0}</b> XP · ${ico('coin', 13, 'gold')} <b>${Number(m.coins ?? 30) || 0}</b></div>
                        <div style="color:var(--muted); font-size:0.78rem;">${ico('trophy', 12, 'gold')} ${Number(m.badgesCount) || 0} succès · ${fmtDate(m.created)}</div>
                    </td>
                    <td>
                        <select class="adm-select adm-member-inline-select" ${isMe ? 'disabled title="Vous ne pouvez pas changer votre propre rôle"' : ''}
                            data-email="${esc(m.email)}" onchange="ADM.setRole(this.dataset.email, this.value)">
                            <option value="eleve"${m.role !== 'admin' ? ' selected' : ''}>Élève</option>
                            <option value="admin"${m.role === 'admin' ? ' selected' : ''}>Administrateur</option>
                        </select>
                    </td>
                    <td>
                        <div class="adm-row-actions">
                            <button type="button" class="adm-ico-btn" title="Offrir +100 pièces & +50 XP" data-email="${esc(m.email)}" onclick="ADM.bonusMember(this.dataset.email)">${ico('gift', 14, 'gold')}</button>
                            <button type="button" class="adm-ico-btn" title="Changer le pseudo" data-email="${esc(m.email)}" data-name="${esc(m.username)}" onclick="ADM.renameMember(this.dataset.email, this.dataset.name)">${ico('edit', 14)}</button>
                            <button type="button" class="adm-ico-btn" title="Réinitialiser le mot de passe" data-email="${esc(m.email)}" onclick="ADM.resetPass(this.dataset.email)">${ico('key', 14, 'cyan')}</button>
                            <button type="button" class="adm-ico-btn" title="Réinitialiser la progression" data-email="${esc(m.email)}" data-name="${esc(m.username)}" onclick="ADM.resetMemberProgress(this.dataset.email, this.dataset.name)">${ico('refresh', 14)}</button>
                            <button type="button" class="adm-ico-btn danger" title="Supprimer le compte" ${isMe ? 'disabled' : ''} data-email="${esc(m.email)}" data-name="${esc(m.username)}" onclick="ADM.deleteMember(this.dataset.email, this.dataset.name)">${ico('close', 14, 'danger')}</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="adm-card">
                <h2>👥 Membres <small>${S.members.length} compte(s) — pilotage classe, filière &amp; progression</small></h2>
                <div class="adm-note">
                    Les comptes permettent aux élèves de se connecter sur cet appareil (modale Se Connecter). Pilotez ici directement la <b>classe</b>, la <b>filière</b>, le <b>rôle</b>, les <b>récompenses</b> et la <b>progression</b> de chaque élève.
                </div>
                <div class="adm-card" style="border-color:rgba(200,168,75,.35);">
                    <h3 style="font-family:'Cinzel',serif; font-size:14px; color:var(--gold-soft); margin-bottom:10px;">➕ Créer un compte</h3>
                    <div class="adm-form">
                        <div class="adm-form-row">
                            <div class="adm-field"><label>E-mail</label><input class="adm-input" id="admNewEmail" type="email" placeholder="eleve@ecole.fr"></div>
                            <div class="adm-field"><label>Pseudo</label><input class="adm-input" id="admNewPseudo" placeholder="Camille"></div>
                            <div class="adm-field"><label>Mot de passe (6 min.)</label><input class="adm-input" id="admNewPass" type="password"></div>
                            <div class="adm-field" style="max-width:150px;"><label>Rôle</label>
                                <select class="adm-select" id="admNewRole">
                                    <option value="eleve">Élève</option>
                                    <option value="admin">Administrateur</option>
                                </select></div>
                        </div>
                        <div><button type="button" class="adm-btn" onclick="ADM.addMember()">Créer le compte</button></div>
                    </div>
                </div>
                <div class="adm-table-wrap" style="margin-top:14px;">
                    <table class="adm-table">
                        <thead><tr><th>Élève / E-mail</th><th>Classe</th><th>Filière</th><th>Progression</th><th>Rôle</th><th>Actions</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="6" class="adm-empty">Aucun compte pour l\'instant.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : RÉGLAGES ============================== */

    function renderSettings() {
        const siteCfg = (typeof AdminStore !== 'undefined') ? AdminStore.getSiteConfig() : {};
        const aiCfg = (typeof AdminStore !== 'undefined') ? AdminStore.getAiConfig() : {};
        const levels = (typeof AdminStore !== 'undefined' && AdminStore.getLevels) ? AdminStore.getLevels() : [];
        const filieres = (typeof AdminStore !== 'undefined' && AdminStore.getFilieres) ? AdminStore.getFilieres() : [];
        const shopThemes = (typeof AdminStore !== 'undefined' && AdminStore.getShopItems)
            ? AdminStore.getShopItems().filter(i => i.category === 'theme')
            : [{ id: 'default', name: '🌌 Thème Astral (Origine)' }];
        const localPersonas = Array.isArray(aiCfg.localPersonas) ? aiCfg.localPersonas : [];
        const defBright = siteCfg.defaultBtnBrightness != null ? siteCfg.defaultBtnBrightness : 80;

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">${ico('settings', 18, 'gold')} Configuration Générale &amp; Pilotage Intégral de l'Interface Client</h2>
                    <span class="adm-badge adm-badge-system">v1.30.0</span>
                </div>
                <p class="adm-hint">Pilotez ici l'intégralité de l'interface client : identité, textes, parcours par défaut, chronomètre, anti-triche 3★, verrouillage collège, bouton Quitter, apparence par défaut, modules actifs et mode examen.</p>

                <div class="adm-form" style="margin-top:14px;">
                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Nom de la plateforme / Titre du site</label>
                            <input class="adm-input" id="admSiteTitle" value="${esc(siteCfg.title || 'EDUQUEST')}" placeholder="EDUQUEST">
                        </div>
                        <div class="adm-field">
                            <label>Slogan (Tagline)</label>
                            <input class="adm-input" id="admSiteTagline" value="${esc(siteCfg.tagline || 'Le jeu de révision Collège, Lycée & BTS')}" placeholder="Le jeu de révision Collège, Lycée & BTS">
                        </div>
                    </div>

                    <div class="adm-field">
                        <label>Annonce d'accueil / Message d'information (affiché sur l'accueil &amp; le dashboard)</label>
                        <input class="adm-input" id="admSiteAnnouncement" value="${esc(siteCfg.announcement || '')}" placeholder="Ex: Bienvenue pour la rentrée ! Nouveaux quiz CIEL & STMG disponibles.">
                    </div>

                    <div class="adm-grid-3">
                        <div class="adm-field">
                            <label>Titre écran de sortie (Quitter)</label>
                            <input class="adm-input" id="admSiteExitTitle" value="${esc(siteCfg.exitTitle || "✨ Merci d'avoir joué à notre jeu ! ✨")}">
                        </div>
                        <div class="adm-field">
                            <label>Sous-titre écran de sortie</label>
                            <input class="adm-input" id="admSiteExitSubtitle" value="${esc(siteCfg.exitSubtitle || 'À bientôt pour de nouvelles aventures !')}">
                        </div>
                        <div class="adm-field">
                            <label>Pied de page du Dashboard</label>
                            <input class="adm-input" id="admSiteDashFooter" value="${esc(siteCfg.dashboardFooterNote || 'EDUQUEST — Contenus alignés sur les programmes officiels.')}">
                        </div>
                    </div>

                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Classe par défaut des nouveaux élèves</label>
                            <select class="adm-select" id="admSiteDefaultNiveau" onchange="ADM.onSettingsDefaultNiveauChange(this.value)">
                                ${levels.map(l => `<option value="${esc(l.id)}"${(siteCfg.defaultNiveau || '6eme') === l.id ? ' selected' : ''}>🎓 ${esc(l.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="adm-field">
                            <label>Filière par défaut (Lycée &amp; BTS)</label>
                            ${(() => {
                                const defNiv = siteCfg.defaultNiveau || '6eme';
                                const filOpts = (AdminStore.isFiliereApplicable(defNiv) && typeof AdminStore.getFilieresForNiveau === 'function')
                                    ? AdminStore.getFilieresForNiveau(defNiv)
                                    : filieres;
                                const defFil = (AdminStore.isFiliereApplicable(defNiv) && typeof AdminStore.resolveFiliereForNiveau === 'function')
                                    ? AdminStore.resolveFiliereForNiveau(siteCfg.defaultFiliere || 'generale', defNiv)
                                    : (siteCfg.defaultFiliere || 'generale');
                                return `<select class="adm-select" id="admSiteDefaultFiliere">
                                    ${filOpts.map(f => `<option value="${esc(f.id)}"${defFil === f.id ? ' selected' : ''}>${esc(f.icon || '🧭')} ${esc(f.label)}</option>`).join('')}
                                </select>`;
                            })()}
                        </div>
                    </div>

                    <div class="adm-grid-3">
                        <div class="adm-field">
                            <label>Chronomètre de quiz (secondes)</label>
                            <input class="adm-input" type="number" id="admSiteTimer" min="10" max="300" value="${siteCfg.quizTimerSeconds || 45}">
                        </div>
                        <div class="adm-field">
                            <label>Multiplicateur global d'XP</label>
                            <input class="adm-input" type="number" step="0.1" min="0.1" max="10" id="admSiteXpMult" value="${siteCfg.xpMultiplier || 1}">
                        </div>
                        <div class="adm-field">
                            <label>Multiplicateur global de pièces 🪙</label>
                            <input class="adm-input" type="number" step="0.1" min="0.1" max="10" id="admSiteCoinMult" value="${siteCfg.coinMultiplier || 1}">
                        </div>
                    </div>

                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Volume des effets sonores par défaut (%)</label>
                            <input class="adm-input" type="range" id="admSiteSfxVol" min="0" max="100" value="${Math.round((siteCfg.sfxVolume ?? 0.6) * 100)}" oninput="document.getElementById('admSiteSfxVal').textContent=this.value+'%'">
                            <span id="admSiteSfxVal" class="adm-hint">${Math.round((siteCfg.sfxVolume ?? 0.6) * 100)}%</span>
                        </div>
                        <div class="adm-field">
                            <label>Volume de la musique d'ambiance par défaut (%)</label>
                            <input class="adm-input" type="range" id="admSiteMusVol" min="0" max="100" value="${Math.round((siteCfg.musicVolume ?? 0.35) * 100)}" oninput="document.getElementById('admSiteMusVal').textContent=this.value+'%'">
                            <span id="admSiteMusVal" class="adm-hint">${Math.round((siteCfg.musicVolume ?? 0.35) * 100)}%</span>
                        </div>
                    </div>

                    <div class="adm-field">
                        <label>Activation des modules, règles de jeu &amp; comportements de l'interface client</label>
                        <div class="adm-feature-grid">
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteAllowReg" ${siteCfg.allowRegistration !== false ? 'checked' : ''}> 👥 Autoriser l'auto-inscription</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteSoundDef" ${siteCfg.soundEnabledByDefault !== false ? 'checked' : ''}> 🔊 Son actif à la 1ère visite</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteShowAudioBtn" ${siteCfg.showAudioToggleButton !== false ? 'checked' : ''}> 🎛️ Bouton flottant Audio 🔊/🔇</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableShop" ${siteCfg.enableShop !== false ? 'checked' : ''}> 🛍️ Activer la Boutique</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableQuests" ${siteCfg.enableQuests !== false ? 'checked' : ''}> 📋 Activer les Missions du jour</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableBadges" ${siteCfg.enableBadges !== false ? 'checked' : ''}> 🏆 Activer les Succès</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableChrono" ${siteCfg.enableChrono !== false ? 'checked' : ''}> ⏱️ Autoriser le Mode Chrono</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteChronoDef" ${siteCfg.chronoEnabledByDefault !== false ? 'checked' : ''}> ⏱️ Chrono activé par défaut</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteShowHints" ${siteCfg.showHintsInQuiz !== false ? 'checked' : ''}> 💡 Indices actifs dans les quiz</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteStrictStars" ${siteCfg.strictStarsAntiCheat !== false ? 'checked' : ''}> 🛡️ Anti-triche 3★ strict (même en rejeu)</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteStrictCollege" ${siteCfg.strictCollegeSubjects !== false ? 'checked' : ''}> 🎓 Verrou strict Collège (bloquer SES/Philo)</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteHideGradeQuiz" ${siteCfg.hideGradeDuringQuiz !== false ? 'checked' : ''}> 🔒 Masquer la classe pendant un quiz</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteExpulsion" ${siteCfg.showExpulsionTransition !== false ? 'checked' : ''}> 🧭 Transition animée d'expulsion</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteConfirmQuit" ${siteCfg.confirmBeforeQuit !== false ? 'checked' : ''}> ❓ Confirmation avant Quitter</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteLogoutQuit" ${siteCfg.logoutOnQuit !== false ? 'checked' : ''}> 🚪 Déconnecter la session sur Quitter</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableParticles" ${siteCfg.enableParticlesByDefault !== false ? 'checked' : ''}> ✨ Particules actives par défaut</label>
                            <label class="adm-feature-toggle"><input type="checkbox" id="admSiteEnableConfetti" ${siteCfg.enableConfetti !== false ? 'checked' : ''}> 🎉 Confettis de célébration</label>
                        </div>
                    </div>

                    <!-- Pilotage Apparence Client par défaut & verrouillage -->
                    <div class="adm-card" style="border-color: rgba(168,85,247,0.3); margin: 8px 0;">
                        <div class="adm-toolbar" style="margin-bottom:8px;">
                            <h3 style="font-family:'Cinzel',serif; font-size:14px; color:#d8b4fe; margin:0;">🎨 Apparence Client par Défaut &amp; Verrouillage</h3>
                            <label class="adm-feature-toggle" style="padding:4px 10px;">
                                <input type="checkbox" id="admSiteAllowClientApp" ${siteCfg.allowClientAppearance !== false ? 'checked' : ''}>
                                Autoriser les élèves à modifier l'apparence (Options)
                            </label>
                        </div>
                        <p class="adm-hint" style="margin-bottom:10px;">Si vous décochez l'autorisation ci-dessus, tous les clients héritent automatiquement et strictement de l'apparence définie ci-dessous.</p>
                        <div class="adm-grid-3">
                            <div class="adm-field">
                                <label>Thème visuel par défaut</label>
                                <select class="adm-select" id="admSiteDefTheme">
                                    ${shopThemes.map(t => `<option value="${esc(t.id)}"${(siteCfg.defaultTheme || 'default') === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="adm-field">
                                <label>Préréglage interface par défaut</label>
                                <select class="adm-select" id="admSiteDefUiPreset">
                                    <option value="default"${(siteCfg.defaultUiPreset || 'default') === 'default' ? ' selected' : ''}>Thème actif (Défaut)</option>
                                    <option value="custom"${siteCfg.defaultUiPreset && siteCfg.defaultUiPreset !== 'default' ? ' selected' : ''}>Couleur personnalisée ci-contre</option>
                                </select>
                            </div>
                            <div class="adm-field">
                                <label>Préréglage boutons par défaut</label>
                                <select class="adm-select" id="admSiteDefBtnPreset">
                                    <option value="default"${(siteCfg.defaultBtnPreset || 'default') === 'default' ? ' selected' : ''}>Acier nocturne (Défaut)</option>
                                    <option value="custom"${siteCfg.defaultBtnPreset && siteCfg.defaultBtnPreset !== 'default' ? ' selected' : ''}>Couleur personnalisée ci-contre</option>
                                </select>
                            </div>
                        </div>
                        <div class="adm-grid-3" style="margin-top:8px;">
                            <div class="adm-field">
                                <label>Couleur interface / Accent</label>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <input type="color" id="admSiteDefUiColor" value="${esc(siteCfg.defaultUiColor || '#0d1f3a')}" title="Teinte d'arrière-plan">
                                    <input type="color" id="admSiteDefUiAccent" value="${esc(siteCfg.defaultUiAccent || '#c8a84b')}" title="Couleur d'accent">
                                </div>
                            </div>
                            <div class="adm-field">
                                <label>Couleur des boutons</label>
                                <input type="color" id="admSiteDefBtnColor" value="${esc(siteCfg.defaultBtnColor || '#24354f')}">
                            </div>
                            <div class="adm-field">
                                <label>Luminosité des boutons par défaut (%)</label>
                                <input class="adm-input" type="range" id="admSiteDefBtnBright" min="45" max="110" value="${defBright}" oninput="document.getElementById('admSiteDefBtnBrightVal').textContent=this.value+'%'">
                                <span id="admSiteDefBtnBrightVal" class="adm-hint">${defBright}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-grid-2" style="background:rgba(200,168,75,0.06); border:1px solid rgba(200,168,75,0.24); border-radius:10px; padding:12px;">
                        <label class="adm-feature-toggle" style="border:none; background:transparent; padding:0;">
                            <input type="checkbox" id="admSiteMaintMode" ${siteCfg.maintenanceMode ? 'checked' : ''}>
                            ⚠️ Activer le bandeau Maintenance / Mode Examen
                        </label>
                        <div class="adm-field">
                            <label>Message du bandeau Maintenance / Examen</label>
                            <input class="adm-input" id="admSiteMaintMsg" value="${esc(siteCfg.maintenanceMessage || '')}" placeholder="Ex: Session d'évaluation en cours — mode révision encadré.">
                        </div>
                    </div>

                    <div class="adm-toolbar" style="margin-top:14px;">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.saveSiteSettings()">💾 Enregistrer la configuration du site</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetSiteSettings()">Rétablir les valeurs de jeu par défaut</button>
                    </div>
                </div>
            </div>

            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">🤖 Pool Multi-IA, Mode Adaptatif &amp; Personas Locales</h2>
                    <span class="adm-badge adm-badge-type">${(aiCfg.providers || []).filter(p => p.enabled !== false).length} API + ${localPersonas.filter(p => p.enabled !== false).length} personas</span>
                </div>
                <p class="adm-hint">Configurez un <b>lot de plusieurs IA externes</b> (Make.com, OpenAI/Mistral/Groq/Ollama, Google Gemini) et/ou pilotez le <b>lot de personas IA pédagogiques locales</b> (Athéna, Socrate, Chronos, Da Vinci, Turing) utilisées en mode hors-ligne ou en repli adaptatif sans répétition.</p>

                <div class="adm-form" style="margin-top:14px;">
                    <div class="adm-grid-2">
                        <div class="adm-field" style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="admAiAdaptive" ${aiCfg.adaptiveMode !== false ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                            <label for="admAiAdaptive" style="margin:0; cursor:pointer;">Activer l'adaptation dynamique (Consolidation / Standard / Défi +)</label>
                        </div>
                        <div class="adm-field">
                            <label>Stratégie de sélection dans le pool Multi-IA</label>
                            <select class="adm-select" id="admAiStrategy">
                                <option value="random"${(aiCfg.selectionStrategy || 'random') === 'random' ? ' selected' : ''}>🎲 Aléatoire pondéré par question (recommandé)</option>
                                <option value="round_robin"${aiCfg.selectionStrategy === 'round_robin' ? ' selected' : ''}>🔄 Rotation circulaire (Round-Robin)</option>
                            </select>
                        </div>
                    </div>

                    <div class="adm-feature-grid" style="margin-bottom:10px;">
                        <label class="adm-feature-toggle"><input type="checkbox" id="admAiLocalPersonas" ${aiCfg.enableLocalPersonas !== false ? 'checked' : ''}> 🎭 Activer les personas IA locales (mode autonome / repli)</label>
                        <label class="adm-feature-toggle"><input type="checkbox" id="admAiShowBadge" ${aiCfg.showAiBadgeInQuiz !== false ? 'checked' : ''}> 🏷️ Afficher le badge IA / Moteur adaptatif dans les quiz</label>
                    </div>

                    <!-- Gestionnaire des personas IA locales -->
                    <div class="adm-card" style="border-color: rgba(179,136,255,0.3); margin: 8px 0 14px;">
                        <div class="adm-toolbar" style="margin-bottom:8px;">
                            <h3 style="font-family:'Cinzel',serif; font-size:14px; color:#e0c3fc; margin:0;">🎭 Personas IA Locales (rotation aléatoire &amp; changement après erreur)</h3>
                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.resetLocalPersonas()">↺ Rétablir les 5 personas</button>
                        </div>
                        <div class="adm-ai-pool" id="admLocalPersonasList">
                            ${localPersonas.map((p, idx) => `
                                <div class="adm-ai-provider-card ${p.enabled === false ? 'is-disabled' : ''}" style="border-left: 3px solid ${esc(p.color || '#4cc9f0')};">
                                    <div class="adm-ai-provider-head">
                                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                            <span>${esc(p.icon || '🤖')}</span>
                                            <b>${esc(p.name)}</b>
                                            <span class="adm-ai-provider-type">${esc(p.role || 'Adaptative')}</span>
                                            ${p.hintPrefix ? `<span class="adm-hint">Indice : « ${esc(p.hintPrefix)} »</span>` : ''}
                                        </div>
                                        <div style="display:flex; gap:6px;">
                                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.toggleLocalPersona(${idx})">${p.enabled === false ? '▶ Activer' : '⏸ Pause'}</button>
                                            <button type="button" class="adm-btn adm-btn-danger" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.deleteLocalPersona(${idx})">🗑</button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="adm-grid-3" style="margin-top:10px;">
                            <div class="adm-field">
                                <label>Nom de la persona</label>
                                <input class="adm-input" id="admNewPersonaName" placeholder="Ex: IA Hypatie">
                            </div>
                            <div class="adm-field">
                                <label>Rôle affiché dans le quiz</label>
                                <input class="adm-input" id="admNewPersonaRole" placeholder="Ex: Géométrie & Logique">
                            </div>
                            <div class="adm-field">
                                <label>Icône &amp; Couleur</label>
                                <div style="display:flex; gap:6px;">
                                    <input class="adm-input" id="admNewPersonaIcon" value="✨" style="width:62px; text-align:center;">
                                    <input type="color" id="admNewPersonaColor" value="#4cc9f0">
                                </div>
                            </div>
                        </div>
                        <div class="adm-grid-2" style="margin-top:8px;">
                            <div class="adm-field">
                                <label>Préfixe d'indice pédagogique (optionnel)</label>
                                <input class="adm-input" id="admNewPersonaHint" placeholder="Ex: Conseil d'Hypatie : ">
                            </div>
                            <div class="adm-field" style="display:flex; align-items:flex-end;">
                                <button type="button" class="adm-btn" onclick="ADM.addLocalPersona()">➕ Ajouter cette persona locale</button>
                            </div>
                        </div>
                    </div>

                    <div class="adm-ai-pool" id="admAiPoolList">
                        ${(aiCfg.providers || []).length === 0
                            ? `<div class="adm-note">Aucun fournisseur IA externe ajouté dans le pool. Ajoutez-en ci-dessous (ou laissez vide pour utiliser le moteur adaptatif 100 % hors-ligne).</div>`
                            : (aiCfg.providers || []).map((p, idx) => `
                                <div class="adm-ai-provider-card ${p.enabled === false ? 'is-disabled' : ''}">
                                    <div class="adm-ai-provider-head">
                                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                            <b>${esc(p.name)}</b>
                                            <span class="adm-ai-provider-type">${esc(p.type)}</span>
                                            ${p.model ? `<span class="adm-hint">Modèle : ${esc(p.model)}</span>` : ''}
                                            <span class="adm-hint">Poids : ${p.weight || 1}</span>
                                        </div>
                                        <div style="display:flex; gap:6px;">
                                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.toggleAiProvider(${idx})">${p.enabled === false ? '▶ Activer' : '⏸ Pause'}</button>
                                            <button type="button" class="adm-btn adm-btn-ghost" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.testSingleAiProvider(${idx})">🧪 Tester</button>
                                            <button type="button" class="adm-btn adm-btn-danger" style="padding:4px 10px; font-size:0.8rem;" onclick="ADM.deleteAiProvider(${idx})">🗑</button>
                                        </div>
                                    </div>
                                    <div class="adm-hint" style="word-break:break-all;">Endpoint : <code>${esc(p.endpoint || '(Gemini par défaut)')}</code></div>
                                </div>
                            `).join('')
                        }
                    </div>

                    <!-- Formulaire d'ajout d'une IA dans le pool -->
                    <div class="adm-card" style="border-color: rgba(95,212,230,0.3); margin: 8px 0 14px;">
                        <h3 style="font-family:'Cinzel',serif; font-size:14px; color:var(--cyan); margin-bottom:10px;">➕ Ajouter une IA au pool aléatoire</h3>
                        <div class="adm-grid-3">
                            <div class="adm-field">
                                <label>Nom affiché</label>
                                <input class="adm-input" id="admNewAiName" placeholder="Ex: Gemini Flash / Mistral">
                            </div>
                            <div class="adm-field">
                                <label>Type de connecteur</label>
                                <select class="adm-select" id="admNewAiType">
                                    <option value="make_webhook">Webhook Make.com (POST JSON)</option>
                                    <option value="openai_compatible">OpenAI / Groq / Mistral / Ollama</option>
                                    <option value="gemini">Google Gemini API</option>
                                </select>
                            </div>
                            <div class="adm-field">
                                <label>Poids aléatoire (1–10)</label>
                                <input class="adm-input" type="number" id="admNewAiWeight" min="1" max="10" value="1">
                            </div>
                        </div>
                        <div class="adm-grid-2" style="margin-top:8px;">
                            <div class="adm-field">
                                <label>URL de l'endpoint</label>
                                <input class="adm-input" id="admNewAiEndpoint" placeholder="https://api.openai.com/v1/chat/completions ou Make hook">
                            </div>
                            <div class="adm-field">
                                <label>Modèle (optionnel pour Make)</label>
                                <input class="adm-input" id="admNewAiModel" placeholder="Ex: gpt-4o-mini, gemini-2.0-flash, mistral-small">
                            </div>
                        </div>
                        <div class="adm-grid-2" style="margin-top:8px;">
                            <div class="adm-field">
                                <label>Clé API (optionnel, stockée en local uniquement)</label>
                                <input class="adm-input" type="password" id="admNewAiKey" placeholder="sk-... ou AIza...">
                            </div>
                            <div class="adm-field">
                                <label>Webhook validation (Make uniquement, optionnel)</label>
                                <input class="adm-input" id="admNewAiValidateUrl" placeholder="https://hook.eu1.make.com/...">
                            </div>
                        </div>
                        <div style="margin-top:10px;">
                            <button type="button" class="adm-btn" onclick="ADM.addAiProvider()">➕ Ajouter cette IA au pool</button>
                        </div>
                    </div>

                    <div class="adm-field">
                        <label>Webhook principal Make — génération (rétrocompatible)</label>
                        <input class="adm-input" id="admAiGenUrl" value="${esc(aiCfg.generateWebhookUrl || '')}" placeholder="https://hook.eu1.make.com/...">
                    </div>
                    <div class="adm-field">
                        <label>Webhook principal Make — validation (rétrocompatible)</label>
                        <input class="adm-input" id="admAiValUrl" value="${esc(aiCfg.validateWebhookUrl || '')}" placeholder="https://hook.eu1.make.com/...">
                    </div>
                    <div class="adm-grid-2">
                        <div class="adm-field">
                            <label>Timeout des requêtes IA (ms)</label>
                            <input class="adm-input" type="number" id="admAiTimeout" min="1000" max="30000" step="500" value="${aiCfg.fetchTimeoutMs || 8000}">
                        </div>
                        <div class="adm-field" style="display:flex; align-items:center; gap:8px; margin-top:22px;">
                            <input type="checkbox" id="admAiFallback" ${aiCfg.fallbackToOffline !== false ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                            <label for="admAiFallback" style="margin:0; cursor:pointer;">Repli automatique sur le moteur adaptatif local</label>
                        </div>
                    </div>

                    <div class="adm-toolbar" style="margin-top:14px;">
                        <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.saveAiSettings()">💾 Enregistrer la configuration Multi-IA</button>
                        <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.testAiSettings()">🧪 Tester le pool IA</button>
                        <button type="button" class="adm-btn adm-btn-ghost adm-right" onclick="ADM.resetAiSettings()">Rétablir par défaut</button>
                    </div>
                    <div id="admAiTestResult" style="margin-top:10px;"></div>
                </div>
            </div>

            <div class="adm-card">
                <h2>🗄️ Sauvegarde &amp; Restauration Intégrale du Site</h2>
                <p class="adm-hint">Exportez l'intégralité des données du site (niveaux scolaires, matières, leçons manuelles, boutique, succès, récompenses économiques, crédits, configuration du site et IA) en un seul fichier JSON universel.</p>
                <div class="adm-toolbar">
                    <button type="button" class="adm-btn" onclick="ADM.exportConfig()">⬇️ Exporter toute la configuration</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.downloadConfig()">💾 Télécharger (.json)</button>
                </div>
                <textarea class="adm-textarea" id="admExportArea" readonly placeholder="Cliquez sur « Exporter toute la configuration » pour afficher le JSON ici…" rows="5"></textarea>
                <div style="margin-top:12px;">
                    <button type="button" class="adm-btn" onclick="ADM.importConfig()">⬆️ Importer la configuration</button>
                    <textarea class="adm-textarea" id="admImportArea" placeholder="Collez ici un JSON exporté puis cliquez sur « Importer la configuration »…" rows="5" style="margin-top:6px;"></textarea>
                </div>
            </div>

            <div class="adm-card">
                <h2 style="color:#ffab91;">☢️ Zone sensible &amp; Réinitialisations</h2>
                <p class="adm-hint">Réinitialisez des modules individuels ou effacez les caches locaux de cet appareil.</p>
                <div class="adm-toolbar" style="flex-wrap:wrap; gap:8px;">
                    <button type="button" class="adm-btn adm-btn-danger" onclick="ADM.resetAdminConfig()">Réinitialiser TOUT le panneau</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.levelsReset()">Niveaux par défaut</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.filieresReset()">Filières par défaut</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetShopItems()">Boutique par défaut</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.resetBadgesCatalog()">Succès par défaut</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.questsReset()">Quêtes par défaut</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.rewardsReset()">Récompenses par défaut</button>
                    <button type="button" class="adm-btn adm-btn-danger adm-right" onclick="ADM.resetProgress()">Effacer la progression joueur (appareil)</button>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : CRÉDITS (v1.20) ============================== */

    function renderCredits() {
        const c = AdminStore.getCredits();
        return `
            <div class="adm-card">
                <h2>✨ Crédits du créateur</h2>
                <p class="adm-hint">Ces informations apparaissent dans le <b>pied de page de toutes les
                pages du jeu</b> et dans la <a href="legal.html" target="_blank" rel="noopener noreferrer"><b>page légale</b></a>
                (mentions légales, confidentialité, cookies). Laissez un champ vide pour masquer
                l'élément correspondant.</p>

                <div class="adm-form">
                    <div class="adm-field"><label>Nom du studio / du projet</label>
                        <input class="adm-input" id="admCrStudio" maxlength="120" value="${esc(c.studioName)}" placeholder="EDUQUEST"></div>
                    <div class="adm-field"><label>Accroche (tagline)</label>
                        <input class="adm-input" id="admCrTagline" maxlength="120" value="${esc(c.tagline)}" placeholder="Apprendre en s'amusant"></div>
                    <div class="adm-field"><label>Créateur / équipe (affiché « Créé par … »)</label>
                        <input class="adm-input" id="admCrCreator" maxlength="120" value="${esc(c.creatorName)}" placeholder="Votre nom ou votre équipe"></div>
                    <div class="adm-field"><label>Site web (optionnel)</label>
                        <input class="adm-input" id="admCrWebsite" maxlength="200" value="${esc(c.website)}" placeholder="mon-site.fr"></div>
                    <div class="adm-field"><label>Dépôt GitHub du projet (optionnel)</label>
                        <input class="adm-input" id="admCrGithub" maxlength="200" value="${esc(c.githubUrl || '')}" placeholder="https://github.com/EDUQUEST2026-2027/EDUQUEST"></div>
                    <div class="adm-field"><label>E-mail de contact (optionnel)</label>
                        <input class="adm-input" id="admCrEmail" type="email" maxlength="200" value="${esc(c.contactEmail)}" placeholder="contact@mon-site.fr"></div>
                    <div class="adm-field"><label>Note complémentaire (optionnelle, infobulle du pied de page)</label>
                        <textarea class="adm-textarea" id="admCrNote" rows="2" maxlength="300" placeholder="Ex. : réalisé dans le cadre d'un projet scolaire…">${esc(c.extraNote)}</textarea></div>
                </div>

                <div class="adm-toolbar">
                    <button type="button" class="adm-btn adm-btn-ok" onclick="ADM.creditsSave()">💾 Enregistrer les crédits</button>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.creditsReset()">Rétablir les valeurs par défaut</button>
                </div>
                <p class="adm-hint" style="margin-top:8px;">Après enregistrement, rechargez la page du
                jeu (F5) pour voir les crédits à jour dans le pied de page.</p>
            </div>

            <div class="adm-card">
                <h2>${ico('scales', 18, 'gold')} Informations légales</h2>
                <p class="adm-hint">Le site est accompagné d'une <a href="legal.html" target="_blank" rel="noopener noreferrer">page
                légale</a> alimentée automatiquement par ces crédits, et d'un <b>bandeau de consentement
                aux cookies</b> (RGPD) affiché à la première visite du site.</p>
                <div class="adm-toolbar">
                    <a class="adm-btn adm-btn-ghost" href="legal.html" target="_blank" rel="noopener noreferrer">Ouvrir la page légale</a>
                    <button type="button" class="adm-btn adm-btn-ghost" onclick="ADM.openCookieBanner()">${ico('cookie', 15, 'gold')} Afficher le bandeau cookies</button>
                </div>
                <p class="adm-hint" id="admCrConsent" style="margin-top:8px;">${(() => {
                    const st = window.EduCookies ? window.EduCookies.getConsent() : null;
                    return !st
                        ? 'Aucun choix enregistré sur ce navigateur : le bandeau s\'affichera automatiquement à la prochaine visite.'
                        : 'Choix enregistré : « ' + esc(st.choice) + ' »' + (st.ts ? ' le ' + fmtDate(st.ts) : '') + '.';
                })()}</p>
            </div>`;
    }

    /* ============================== ACTIONS — NIVEAUX ============================== */

    function updateModeBadge() {
        const modeEl = document.getElementById('admMode');
        if (modeEl && typeof DB !== 'undefined') {
            modeEl.textContent = DB.useApi ? 'Mode API SQL' : 'Mode local';
            modeEl.className = 'adm-mode' + (DB.useApi ? ' api' : '');
        }
    }

    const ADM = {
        async tab(id) {
            S.tab = id;
            if (id === 'members') {
                try { await refreshMembers(); } catch { }
            }
            renderPanel();
        },
        switchGate() {
            if (S.hasAnyAdmin) {
                S.gate = 'login';
            } else {
                S.gate = S.gate === 'login' ? 'setup' : 'login';
            }
            render();
        },

        /* ----- Connexion / premier admin ----- */
        async login() {
            setError('admLoginErr', '');
            const email = ((document.getElementById('admLoginEmail') || {}).value || '').trim();
            const pass = (document.getElementById('admLoginPass') || {}).value || '';
            if (!email || !pass) { setError('admLoginErr', 'Renseignez l\'e-mail et le mot de passe.'); return; }
            const r = await DB.login(email, pass);
            if (!r.ok) { setError('admLoginErr', r.error || 'Connexion impossible.'); return; }
            const me = DB.getCurrentUser();
            if (!me || me.role !== 'admin') {
                await DB.logout();
                setError('admLoginErr', 'Ce compte n\'est pas administrateur (rôle « admin » requis).');
                return;
            }
            S.hasAnyAdmin = true;
            S.authed = true;
            try { await refreshMembers(); } catch { }
            updateModeBadge();
            render();
            toast('Bienvenue dans le panneau d\'administration.', 'ok');
        },

        async setupFirst() {
            setError('admSetErr', '');
            // Vérification de sécurité côté base : interdit la création si un admin existe déjà
            try {
                const check = await DB.listLocalMembers();
                const existingAdmins = (check && check.ok && Array.isArray(check.data))
                    ? check.data.filter(u => u.role === 'admin') : [];
                if (existingAdmins.length > 0) {
                    S.hasAnyAdmin = true;
                    S.gate = 'login';
                    render();
                    setError('admLoginErr', 'Un compte administrateur existe déjà. Veuillez vous connecter.');
                    return;
                }
            } catch { }
            const email = ((document.getElementById('admSetEmail') || {}).value || '').trim();
            const pseudo = ((document.getElementById('admSetPseudo') || {}).value || '').trim();
            const pass = (document.getElementById('admSetPass') || {}).value || '';
            if (!email || !pseudo || !pass) { setError('admSetErr', 'Tous les champs sont requis.'); return; }
            const r = await DB.createLocalMember(email, pseudo, pass, 'admin');
            if (!r.ok) { setError('admSetErr', r.error || 'Création impossible.'); return; }
            const login = await DB.login(email, pass);
            if (!login.ok) { setError('admSetErr', 'Compte créé, mais connexion impossible.'); return; }
            S.hasAnyAdmin = true;
            S.authed = true;
            try { await refreshMembers(); } catch { }
            updateModeBadge();
            render();
            toast('Administrateur créé. Bienvenue !', 'ok');
        },

        async logout() {
            try { await DB.logout(); } catch { }
            S.authed = false;
            S.members = [];
            S.subjectId = null;
            S.editingLesson = null;
            S.lessonDraft = null;
            S.editingBadge = null;
            S.editingShopItem = null;
            S.testModalQuestion = null;
            S.levelsDraft = null;
            S.filieresDraft = null;
            S.questsDraft = null;
            S.gate = S.hasAnyAdmin ? 'login' : 'setup';
            render();
            toast('Session administrateur déconnectée.', 'ok');
        },

        /* ----- Niveaux scolaires ----- */
        lvl(i, key, value) { if (S.levelsDraft && S.levelsDraft[i]) S.levelsDraft[i][key] = value; },
        lvlAdd() { S.levelsDraft = S.levelsDraft || []; S.levelsDraft.push({ id: '', label: '', band: 'college' }); renderTabContent(); },
        lvlDelete(i) {
            if (!S.levelsDraft) return;
            if (S.levelsDraft.length <= 1) { toast('Il faut au moins un niveau scolaire.', 'err'); return; }
            S.levelsDraft.splice(i, 1);
            renderTabContent();
        },
        lvlMove(i, dir) {
            const j = i + dir;
            if (!S.levelsDraft || j < 0 || j >= S.levelsDraft.length) return;
            const tmp = S.levelsDraft[i]; S.levelsDraft[i] = S.levelsDraft[j]; S.levelsDraft[j] = tmp;
            renderTabContent();
        },
        levelsSave() {
            const r = AdminStore.saveLevels(S.levelsDraft);
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            S.levelsDraft = null;
            renderTabContent();
            toast('Niveaux scolaires enregistrés ✔', 'ok');
        },
        levelsCancel() { S.levelsDraft = null; renderTabContent(); },
        levelsReset() {
            if (!confirm('Rétablir les niveaux scolaires par défaut (6ème → Terminale + BTS 1/2) ?')) return;
            AdminStore.resetLevels();
            S.levelsDraft = null;
            renderTabContent();
            toast('Niveaux par défaut rétablis.', 'ok');
        },

        /* ----- Matières ----- */
        openSubject(id) {
            S.subjectId = id || null;
            S.editingLesson = null;
            S.lessonDraft = null;
            S.subjectList = [];
            if (S.subjectId && typeof AdminStore !== 'undefined') {
                const opened = subjectList().find(x => x.id === S.subjectId);
                if (opened) {
                    const allowed = (typeof AdminStore.defaultAllowedNiveauxForSubject === 'function')
                        ? AdminStore.defaultAllowedNiveauxForSubject(opened)
                        : (Array.isArray(opened.allowedNiveaux) ? opened.allowedNiveaux : []);
                    if (allowed.length > 0 && !allowed.includes(S.studyGrade)) {
                        S.studyGrade = allowed[0];
                    }
                }
            }
            renderTabContent();
        },
        onSubjectIslandSelect(val, inputId, previewId) {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = val;
            }
            this.updateSubjectIconPreview(inputId, previewId);
        },
        updateSubjectIconPreview(inputId, previewId) {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            if (!preview) return;
            const val = input ? input.value : '';
            preview.innerHTML = renderSubjectIcon(val);
        },
        handleSubjectImageUpload(fileInput, targetInputId, previewId) {
            if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file.type || !file.type.startsWith('image/')) {
                toast('Veuillez sélectionner un fichier image valide.', 'err');
                return;
            }
            if (file.size > 1500 * 1024) {
                toast('Image trop volumineuse (max 1,5 Mo).', 'err');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const rawDataUrl = e.target.result;
                const img = new Image();
                img.onload = () => {
                    try {
                        const maxDim = 160;
                        let w = img.naturalWidth || img.width || maxDim;
                        let h = img.naturalHeight || img.height || maxDim;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.max(1, Math.round((h * maxDim) / w));
                                w = maxDim;
                            } else {
                                w = Math.max(1, Math.round((w * maxDim) / h));
                                h = maxDim;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/webp', 0.88);
                        if (optimizedDataUrl.length > 220000) {
                            toast('Image encodée trop lourde pour le stockage local.', 'err');
                            return;
                        }
                        const targetInput = document.getElementById(targetInputId);
                        if (targetInput) targetInput.value = optimizedDataUrl;
                        ADM.updateSubjectIconPreview(targetInputId, previewId);
                        toast('Image chargée et optimisée ✔', 'ok');
                    } catch {
                        if (typeof rawDataUrl === 'string' && rawDataUrl.length <= 220000 && isSafeImgUrl(rawDataUrl)) {
                            const targetInput = document.getElementById(targetInputId);
                            if (targetInput) targetInput.value = rawDataUrl;
                            ADM.updateSubjectIconPreview(targetInputId, previewId);
                            toast('Image chargée ✔', 'ok');
                        } else {
                            toast('Impossible d\'optimiser cette image (taille dépassée).', 'err');
                        }
                    }
                };
                img.onerror = () => {
                    toast('Fichier image illisible ou corrompu.', 'err');
                };
                img.src = rawDataUrl;
            };
            reader.readAsDataURL(file);
        },
        /* ----- Filières & Voies d'études ----- */
        fil(i, field, val) {
            if (!S.filieresDraft || !S.filieresDraft[i]) return;
            S.filieresDraft[i][field] = val;
        },
        filToggleNiveau(i, nivId) {
            if (!S.filieresDraft || !S.filieresDraft[i] || !nivId) return;
            const lyceeLevels = AdminStore.getLevels().filter(l => l.band === 'lycee').map(l => l.id);
            let cur = (Array.isArray(S.filieresDraft[i].allowedNiveaux) && S.filieresDraft[i].allowedNiveaux.length)
                ? S.filieresDraft[i].allowedNiveaux.slice()
                : lyceeLevels.slice();
            if (cur.includes(nivId)) {
                if (cur.length <= 1) {
                    toast('Une filière doit être associée à au moins un niveau d\'étude.', 'err');
                    return;
                }
                cur = cur.filter(x => x !== nivId);
            } else {
                cur.push(nivId);
            }
            S.filieresDraft[i].allowedNiveaux = cur;
            renderTabContent();
        },
        filAdd() {
            if (!S.filieresDraft) S.filieresDraft = AdminStore.getFilieres();
            const existingIds = new Set(S.filieresDraft.map(f => String(f.id || '').toLowerCase()));
            let n = S.filieresDraft.length + 1;
            while (existingIds.has('filiere_' + n)) n++;
            S.filieresDraft.push({
                id: 'filiere_' + n,
                label: 'Nouvelle filière',
                shortLabel: 'Nouvelle',
                icon: '🧭',
                enabled: true,
                allowedNiveaux: ['2nde', '1ere', 'terminale'],
                desc: '',
            });
            renderTabContent();
        },
        filMove(i, dir) {
            if (!S.filieresDraft) return;
            const j = i + dir;
            if (j < 0 || j >= S.filieresDraft.length) return;
            const tmp = S.filieresDraft[i]; S.filieresDraft[i] = S.filieresDraft[j]; S.filieresDraft[j] = tmp;
            renderTabContent();
        },
        filDelete(i) {
            if (!S.filieresDraft || S.filieresDraft.length <= 1) return;
            S.filieresDraft.splice(i, 1);
            renderTabContent();
        },
        filieresSave() {
            if (!S.filieresDraft) return;
            const r = AdminStore.saveFilieres(S.filieresDraft);
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            S.filieresDraft = null;
            renderTabContent();
            toast('Filières enregistrées ✔', 'ok');
        },
        filieresCancel() {
            S.filieresDraft = null;
            renderTabContent();
        },
        filieresReset() {
            const count = (typeof AdminStore !== 'undefined' && Array.isArray(AdminStore.DEFAULT_FILIERES)) ? AdminStore.DEFAULT_FILIERES.length : 18;
            if (!confirm(`Rétablir les ${count} filières officielles par défaut ?`)) return;
            AdminStore.resetFilieres();
            S.filieresDraft = null;
            renderTabContent();
            toast('Filières officielles rétablies.', 'ok');
        },

        setSubjectSearch(val) {
            S.subjectSearch = String(val || '');
            const focusPos = (document.getElementById('admSubjectSearch') || {}).selectionStart;
            renderTabContent();
            const inp = document.getElementById('admSubjectSearch');
            if (inp) {
                inp.focus();
                if (typeof focusPos === 'number') {
                    try { inp.setSelectionRange(focusPos, focusPos); } catch { }
                }
            }
        },
        createSubject() {
            const name = (document.getElementById('admNewName') || {}).value || '';
            const icon = (document.getElementById('admNewIcon') || {}).value || '';
            const band = (document.getElementById('admNewBand') || {}).value || 'all';
            const fil = (document.getElementById('admNewFiliere') || {}).value || 'all';
            const allowedFilieres = fil === 'all' ? ['all'] : [fil];
            const specialtyFilieres = fil === 'all' ? [] : [fil];
            const r = AdminStore.createCustomSubject(name, icon, null, { band, allowedFilieres, specialtyFilieres });
            if (!r.ok) { toast(r.error || 'Création impossible.', 'err'); return; }
            S.subjectList = [];
            S.subjectId = r.id;
            renderTabContent();
            toast('Matière « ' + name + ' » créée. Ajoutez vos leçons.', 'ok');
        },
        saveMeta() {
            if (!S.subjectId) return;
            const name = (document.getElementById('admMetaName') || {}).value || '';
            const icon = (document.getElementById('admMetaIcon') || {}).value || '';
            const band = (document.getElementById('admMetaBand') || {}).value || 'all';
            const enabled = Boolean((document.getElementById('admMetaEnabled') || {}).checked);
            const description = (document.getElementById('admMetaDesc') || {}).value || '';

            const sub = subjectList().find(x => x.id === S.subjectId);
            const allowedNiveaux = sub ? (sub.allowedNiveaux || []) : [];
            const allowedFilieres = sub ? (sub.allowedFilieres || ['all']) : ['all'];
            const specialtyFilieres = sub ? (sub.specialtyFilieres || []) : [];

            const r = AdminStore.saveSubjectMeta(S.subjectId, { name, icon, band, enabled, description, allowedNiveaux, allowedFilieres, specialtyFilieres });
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            S.subjectList = [];
            renderTabContent();
            toast('Matière, classes et filières enregistrées ✔', 'ok');
        },
        _readSubjectMetaInputs() {
            const patch = {};
            const nameEl = document.getElementById('admMetaName');
            const iconEl = document.getElementById('admMetaIcon');
            const descEl = document.getElementById('admMetaDesc');
            const enabledEl = document.getElementById('admMetaEnabled');
            if (nameEl && nameEl.value.trim()) patch.name = nameEl.value;
            if (iconEl) patch.icon = iconEl.value;
            if (descEl) patch.description = descEl.value;
            if (enabledEl) patch.enabled = Boolean(enabledEl.checked);
            return patch;
        },
        toggleSubjectFiliere(filId) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            let current = AdminStore.defaultAllowedFilieresForSubject(sub);
            if (filId === 'all') {
                current = ['all'];
            } else {
                if (current.includes('all')) {
                    current = [filId];
                } else if (current.includes(filId)) {
                    current = current.filter(id => id !== filId);
                    if (current.length === 0) current = ['all'];
                } else {
                    current.push(filId);
                }
            }
            sub.allowedFilieres = current;
            AdminStore.saveSubjectMeta(S.subjectId, { ...ADM._readSubjectMetaInputs(), allowedFilieres: current });
            S.subjectList = [];
            renderTabContent();
        },
        toggleSubjectSpecialty(filId) {
            if (!S.subjectId || !filId || filId === 'all') return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            let specs = Array.isArray(sub.specialtyFilieres) ? sub.specialtyFilieres.slice() : [];
            if (specs.includes(filId)) {
                specs = specs.filter(id => id !== filId);
            } else {
                specs.push(filId);
            }
            sub.specialtyFilieres = specs;
            AdminStore.saveSubjectMeta(S.subjectId, { ...ADM._readSubjectMetaInputs(), specialtyFilieres: specs });
            S.subjectList = [];
            renderTabContent();
        },
        onBandChange(band) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            sub.band = band;
            const allLevels = AdminStore.getLevels();
            if (band === 'college') {
                sub.allowedNiveaux = allLevels.filter(l => l.band === 'college').map(l => l.id);
            } else if (band === 'lycee') {
                sub.allowedNiveaux = allLevels.filter(l => l.band === 'lycee').map(l => l.id);
            } else {
                sub.allowedNiveaux = allLevels.map(l => l.id);
            }
            AdminStore.saveSubjectMeta(S.subjectId, { ...ADM._readSubjectMetaInputs(), band, allowedNiveaux: sub.allowedNiveaux });
            S.subjectList = [];
            renderTabContent();
            toast('Cycle mis à jour : ' + (band === 'college' ? 'Collège' : band === 'lycee' ? 'Lycée' : 'Tous cycles'), 'ok');
        },
        toggleSubjectGrade(gradeId) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            let current = (sub._allowedNiveauxExplicit && Array.isArray(sub.allowedNiveaux))
                ? sub.allowedNiveaux.slice()
                : ((typeof AdminStore !== 'undefined' && typeof AdminStore.defaultAllowedNiveauxForSubject === 'function')
                    ? AdminStore.defaultAllowedNiveauxForSubject(sub)
                    : (Array.isArray(sub.allowedNiveaux) && sub.allowedNiveaux.length ? sub.allowedNiveaux.slice() : AdminStore.getLevels().map(l => l.id)));
            if (current.includes(gradeId)) {
                current = current.filter(id => id !== gradeId);
            } else {
                current.push(gradeId);
            }
            sub.allowedNiveaux = current;
            AdminStore.saveSubjectMeta(S.subjectId, { ...ADM._readSubjectMetaInputs(), allowedNiveaux: current });
            S.subjectList = [];
            renderTabContent();
        },
        setAllSubjectGrades(checked) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            const allLevels = AdminStore.getLevels();
            const current = checked ? allLevels.map(l => l.id) : [];
            sub.allowedNiveaux = current;
            AdminStore.saveSubjectMeta(S.subjectId, { ...ADM._readSubjectMetaInputs(), allowedNiveaux: current });
            S.subjectList = [];
            renderTabContent();
        },
        setSubjectSubTab(tab) {
            S.subjectSubTab = tab;
            renderTabContent();
        },
        changeStudyGrade(grade) {
            S.studyGrade = grade;
            renderTabContent();
        },
        nextQuestionVariant() {
            S.questionVariant = (S.questionVariant || 0) + 1;
            renderTabContent();
            toast('Nouvelle variante n° ' + S.questionVariant + ' générée 🎲', 'ok');
        },
        resetQuestionVariant() {
            S.questionVariant = 0;
            renderTabContent();
            toast('Variante aléatoire réinitialisée.', 'ok');
        },
        importProceduralQuestion(idx) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            const generated = (AdminStore.getSubjectQuestionsForGrade(sub.id, S.studyGrade, S.questionVariant, 8) || {}).generated || [];
            const q = generated[idx];
            if (!q) { toast('Question introuvable.', 'err'); return; }
            const lessons = JSON.parse(JSON.stringify(sub.lessons || []));
            const clean = AdminStore.normalizeLesson({
                type: q.type || 'qcm',
                title: q.title || `Niveau ${lessons.length + 1} (${S.studyGrade.toUpperCase()})`,
                q: q.q || '',
                opts: q.opts,
                correct: q.correct,
                accepted: q.accepted,
                textWithBlanks: q.textWithBlanks,
                blanks: q.blanks,
                choices: q.choices,
                items: q.items,
                targets: q.targets,
                pairs: q.pairs,
                exp: q.exp || '',
            });
            lessons.push(clean);
            const r = AdminStore.saveLessons(sub.id, lessons);
            if (!r.ok) { toast(r.error || 'Erreur lors de l\'import.', 'err'); return; }
            S.subjectList = [];
            S.subjectSubTab = 'manual';
            renderTabContent();
            toast('Question importée avec succès comme leçon manuelle (niveau ' + lessons.length + ') ✔', 'ok');
        },
        testLesson(i) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub || !sub.lessons[i]) return;
            S.testModalQuestion = JSON.parse(JSON.stringify(sub.lessons[i]));
            S.testModalAnswer = null;
            S.testModalResult = null;
            renderTabContent();
        },
        testProceduralQuestion(idx) {
            if (!S.subjectId) return;
            const generated = (AdminStore.getSubjectQuestionsForGrade(S.subjectId, S.studyGrade, S.questionVariant, 8) || {}).generated || [];
            const q = generated[idx];
            if (!q) return;
            S.testModalQuestion = JSON.parse(JSON.stringify(q));
            S.testModalAnswer = null;
            S.testModalResult = null;
            renderTabContent();
        },
        closeTestModal() {
            S.testModalQuestion = null;
            S.testModalAnswer = null;
            S.testModalResult = null;
            renderTabContent();
        },
        selectTestAnswer(ans) {
            S.testModalAnswer = ans;
            renderTabContent();
        },
        setTestTextAnswer(ans) {
            S.testModalAnswer = ans;
        },
        setTestBlankChoice(idx, val) {
            if (!Array.isArray(S.testModalAnswer)) {
                const len = (S.testModalQuestion && Array.isArray(S.testModalQuestion.choices)) ? S.testModalQuestion.choices.length : (idx + 1);
                S.testModalAnswer = new Array(len).fill('');
            }
            S.testModalAnswer[idx] = val;
        },
        setTestDragAnswer(itemKey, targetVal) {
            if (!S.testModalAnswer || typeof S.testModalAnswer !== 'object' || Array.isArray(S.testModalAnswer)) {
                S.testModalAnswer = {};
            }
            S.testModalAnswer[itemKey] = targetVal;
        },
        submitTestAnswer() {
            const q = S.testModalQuestion;
            if (!q) return;
            const type = q.type || 'qcm';
            const isEmpty = S.testModalAnswer === null || S.testModalAnswer === undefined || S.testModalAnswer === ''
                || (type === 'drag_and_drop' && (typeof S.testModalAnswer !== 'object' || Object.keys(S.testModalAnswer).length === 0));
            if (isEmpty) {
                toast('Veuillez sélectionner ou saisir une réponse.', 'err');
                return;
            }
            let isCorrect = false;
            let correctStr = '';

            if (typeof QuizEngine !== 'undefined' && typeof QuizEngine.grade === 'function') {
                isCorrect = QuizEngine.grade(q, S.testModalAnswer);
            } else {
                if (type === 'qcm') isCorrect = Number(S.testModalAnswer) === Number(q.correct);
                else if (type === 'vrai_faux') isCorrect = Boolean(S.testModalAnswer) === Boolean(q.correct);
                else if (type === 'reponse_courte') {
                    const acc = (q.accepted || []).map(s => String(s).trim().toLowerCase());
                    isCorrect = acc.includes(String(S.testModalAnswer).trim().toLowerCase());
                } else if (type === 'drag_and_drop' && Array.isArray(q.items) && Array.isArray(q.targets)) {
                    isCorrect = q.items.length > 0 && q.items.every((it, idx) => S.testModalAnswer[it] === (q.pairs && q.pairs[it] ? q.pairs[it] : q.targets[idx]));
                } else {
                    isCorrect = false;
                }
            }

            if (type === 'qcm') {
                const opts = Array.isArray(q.opts) ? q.opts : [];
                const cIdx = Number(q.correct);
                correctStr = opts[cIdx] ? `${String.fromCharCode(65 + cIdx)}. ${opts[cIdx]}` : `Option ${String.fromCharCode(65 + cIdx)}`;
            } else if (type === 'vrai_faux') {
                correctStr = q.correct === true ? 'Vrai' : 'Faux';
            } else if (type === 'reponse_courte') {
                correctStr = (q.accepted || []).join(' ou ');
            } else if (type === 'texte_a_trous' || type === 'texte_a_choix') {
                correctStr = (q.blanks || []).map(b => (Array.isArray(b) ? b : [b]).join('/')).join(', ');
            } else {
                const items = Array.isArray(q.items) ? q.items : [];
                const targets = Array.isArray(q.targets) ? q.targets : [];
                correctStr = items.map((it, idx) => `${it} → ${(q.pairs && q.pairs[it]) || targets[idx] || ''}`).join(' ; ');
            }

            S.testModalResult = {
                isCorrect,
                correctStr,
                exp: q.exp || '',
            };
            renderTabContent();
        },
        deleteSubject() {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            if (!confirm('Supprimer définitivement la matière « ' + sub.name + ' » et ses leçons ?')) return;
            const r = AdminStore.deleteCustomSubject(S.subjectId);
            if (!r.ok) { toast(r.error || 'Suppression impossible.', 'err'); return; }
            S.subjectId = null; S.subjectList = [];
            renderTabContent();
            toast('Matière supprimée.', 'ok');
        },
        resetSubject() {
            if (!S.subjectId) return;
            if (!confirm('Retirer toutes les modifications (nom, icône, leçons) de cette matière ?')) return;
            AdminStore.resetSubject(S.subjectId);
            S.subjectList = [];
            S.editingLesson = null; S.lessonDraft = null;
            renderTabContent();
            toast('Matière rétablie à l\'original.', 'ok');
        },

        /* ----- Leçons ----- */
        newLesson() {
            if (!S.subjectId) return;
            S.editingLesson = -1;
            S.lessonDraft = { type: 'qcm', title: '', q: '', opts: ['', '', '', ''], correct: 0, exp: '' };
            renderTabContent();
        },
        editLesson(i) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub || !sub.lessons[i]) return;
            S.editingLesson = i;
            S.lessonDraft = JSON.parse(JSON.stringify(sub.lessons[i]));
            S.lessonDraft.type = S.lessonDraft.type || 'qcm';
            renderTabContent();
        },
        cancelLesson() { S.editingLesson = null; S.lessonDraft = null; renderTabContent(); },
        updateQcmCorrectTag(selectedIdx) {
            document.querySelectorAll('.adm-correct-tag').forEach((el, i) => {
                el.style.display = (i === Number(selectedIdx)) ? '' : 'none';
            });
        },
        lessonType(type) {
            // Préserve les champs déjà saisis dans le DOM avant changement de type
            const cur = readLessonForm();
            const d = Object.assign({}, S.lessonDraft || {}, {
                title: cur.title || (S.lessonDraft && S.lessonDraft.title) || '',
                q: cur.q || (S.lessonDraft && S.lessonDraft.q) || '',
                exp: cur.exp || (S.lessonDraft && S.lessonDraft.exp) || '',
                textWithBlanks: cur.textWithBlanks || (S.lessonDraft && S.lessonDraft.textWithBlanks) || '',
            });
            const common = { title: d.title, exp: d.exp };
            S.lessonDraft = { type };
            if (type === 'qcm') Object.assign(S.lessonDraft, { q: d.q, opts: ['', '', '', ''], correct: 0 }, common);
            else if (type === 'vrai_faux') Object.assign(S.lessonDraft, { q: d.q, correct: true }, common);
            else if (type === 'reponse_courte') Object.assign(S.lessonDraft, { q: d.q, accepted: [''] }, common);
            else if (type === 'texte_a_trous') Object.assign(S.lessonDraft, { textWithBlanks: d.textWithBlanks || '', blanks: [['']] }, common);
            else if (type === 'texte_a_choix') Object.assign(S.lessonDraft, { q: d.q || '', textWithBlanks: d.textWithBlanks || '', blanks: [['']], choices: [['', '']] }, common);
            else Object.assign(S.lessonDraft, { q: d.q, items: ['', ''], targets: ['', ''] }, common);
            renderTabContent();
        },
        lessonSave() {
            if (!S.subjectId) return;
            const lesson = readLessonForm();
            const err = AdminStore.validateLesson(lesson);
            if (err) { setError('admLessonErr', err); return; }
            const clean = AdminStore.normalizeLesson(lesson);
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            const lessons = JSON.parse(JSON.stringify(sub.lessons || []));
            if (S.editingLesson === -1) lessons.push(clean);
            else lessons[S.editingLesson] = clean;
            const r = AdminStore.saveLessons(S.subjectId, lessons);
            if (!r.ok) { setError('admLessonErr', r.error || 'Enregistrement impossible.'); return; }
            S.subjectList = [];
            S.editingLesson = null; S.lessonDraft = null;
            renderTabContent();
            toast('Leçon enregistrée ✔', 'ok');
        },
        deleteLesson(i) {
            if (!S.subjectId) return;
            if (!confirm('Supprimer la leçon ' + (i + 1) + ' ?')) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            const lessons = JSON.parse(JSON.stringify(sub.lessons || []));
            if (lessons.length <= 1) { toast('Une matière doit garder au moins une leçon.', 'err'); return; }
            lessons.splice(i, 1);
            const r = AdminStore.saveLessons(S.subjectId, lessons);
            if (!r.ok) { toast(r.error || 'Suppression impossible.', 'err'); return; }
            S.subjectList = [];
            S.editingLesson = null; S.lessonDraft = null;
            renderTabContent();
            toast('Leçon supprimée.', 'ok');
        },
        lessonMove(i, dir) {
            if (!S.subjectId) return;
            const sub = subjectList().find(x => x.id === S.subjectId);
            if (!sub) return;
            const lessons = JSON.parse(JSON.stringify(sub.lessons || []));
            const j = i + dir;
            if (j < 0 || j >= lessons.length) return;
            const tmp = lessons[i]; lessons[i] = lessons[j]; lessons[j] = tmp;
            const r = AdminStore.saveLessons(S.subjectId, lessons);
            if (!r.ok) { toast(r.error || 'Déplacement impossible.', 'err'); return; }
            S.subjectList = [];
            if (S.editingLesson === i) S.editingLesson = j;
            else if (S.editingLesson === j) S.editingLesson = i;
            renderTabContent();
        },

        /* ----- Boutique ----- */
        setShopCategory(cat) {
            S.shopCategory = cat;
            renderTabContent();
        },
        newShopItem() {
            S.editingShopItem = {
                _isNew: true,
                id: '',
                name: '',
                category: S.shopCategory && S.shopCategory !== 'all' ? S.shopCategory : 'aura',
                cost: 100,
                color: '#c8a84b',
                img: '',
                desc: '',
                disabled: false
            };
            renderTabContent();
        },
        editShopItem(id) {
            const item = AdminStore.getShopItem(id);
            if (!item) return;
            S.editingShopItem = JSON.parse(JSON.stringify(item));
            renderTabContent();
        },
        cancelShopItem() {
            S.editingShopItem = null;
            renderTabContent();
        },
        updateShopPreview() {
            const name = (document.getElementById('admShopName') || {}).value || 'Nom de l\'article';
            const rawCost = parseInt((document.getElementById('admShopCost') || {}).value || '0', 10);
            const cost = Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : 0;
            const color = safeHex((document.getElementById('admShopColor') || {}).value, '#c8a84b');
            const img = ((document.getElementById('admShopImg') || {}).value || '').trim();

            const t = document.getElementById('admPreviewTitle');
            const c = document.getElementById('admPreviewCost');
            const orb = document.getElementById('admPreviewOrb');
            if (t) t.textContent = name;
            if (c) c.innerHTML = `${ico('coin', 13, 'gold')} ` + (cost === 0 ? 'Offert' : cost + ' pièces');
            if (orb) {
                orb.style.setProperty('--sc', color);
                orb.innerHTML = isSafeImgUrl(img) ? `<img src="${esc(img)}" alt="">` : `<span>${ico('sparkle', 20, 'gold')}</span>`;
            }
        },
        saveShopItem() {
            const id = (document.getElementById('admShopId') || {}).value || '';
            const name = (document.getElementById('admShopName') || {}).value || '';
            const category = (document.getElementById('admShopCategory') || {}).value || 'aura';
            const cost = parseInt((document.getElementById('admShopCost') || {}).value || '0', 10);
            const color = (document.getElementById('admShopColor') || {}).value || '#c8a84b';
            const img = (document.getElementById('admShopImg') || {}).value || '';
            const desc = (document.getElementById('admShopDesc') || {}).value || '';
            const disabled = Boolean((document.getElementById('admShopDisabled') || {}).checked);

            const r = AdminStore.saveShopItem({ id, name, category, cost, color, img, desc, disabled });
            if (!r.ok) {
                setError('admShopErr', r.error || 'Erreur d\'enregistrement.');
                return;
            }
            S.editingShopItem = null;
            renderTabContent();
            toast('Article « ' + name + ' » enregistré ✔', 'ok');
        },
        deleteShopItem(id) {
            const item = AdminStore.getShopItem(id);
            if (!item) return;
            if (!confirm('Supprimer ou masquer l\'article « ' + item.name + ' » de la boutique ?')) return;
            AdminStore.deleteShopItem(id);
            if (S.editingShopItem && S.editingShopItem.id === id) S.editingShopItem = null;
            renderTabContent();
            toast('Article supprimé de la boutique.', 'ok');
        },
        resetShopItems() {
            if (!confirm('Rétablir tous les articles par défaut de la boutique ?')) return;
            AdminStore.resetShopItems();
            S.editingShopItem = null;
            renderTabContent();
            toast('Boutique réinitialisée aux articles d\'origine.', 'ok');
        },

        /* ----- Récompenses & Économie ----- */
        rewardsSave() {
            const xpBase = parseInt((document.getElementById('admRwXpBase') || {}).value, 10);
            const coinsBase = parseInt((document.getElementById('admRwCoinsBase') || {}).value, 10);
            const chronoBonusMaxXp = parseInt((document.getElementById('admRwChronoXp') || {}).value, 10);
            const dailyChestCoins = parseInt((document.getElementById('admRwDailyChest') || {}).value, 10);
            const firstTryBonusXp = parseInt((document.getElementById('admRwFirstTryXp') || {}).value, 10);
            const questRewardMultiplier = parseFloat((document.getElementById('admRwQuestMult') || {}).value);

            const r = AdminStore.saveRewardsConfig({
                xpBase, coinsBase, chronoBonusMaxXp, dailyChestCoins, firstTryBonusXp, questRewardMultiplier
            });
            if (!r.ok) {
                toast(r.error || 'Erreur lors de la sauvegarde des récompenses.', 'err');
                return;
            }
            renderTabContent();
            toast('Récompenses et paramètres économiques enregistrés ✔', 'ok');
        },
        rewardsReset() {
            if (!confirm('Rétablir les récompenses par défaut ?')) return;
            AdminStore.resetRewardsConfig();
            renderTabContent();
            toast('Récompenses rétablies par défaut.', 'ok');
        },
        async grantPlayerReward(xp, coins, reset = false) {
            let currentXp = parseInt(DB.getOption('dash_xp') || '0', 10);
            if (!Number.isFinite(currentXp)) currentXp = 0;
            let currentCoins = parseInt(DB.getOption('dash_coins') || '30', 10);
            if (!Number.isFinite(currentCoins)) currentCoins = 30;
            if (reset) {
                currentXp = 0;
                currentCoins = 30;
                DB.saveOption('dash_xp', '0');
                DB.saveOption('dash_coins', '30');
                toast('Portefeuille local réinitialisé à 30 pièces.', 'ok');
            } else {
                const addXp = Number.isFinite(Number(xp)) ? Number(xp) : 0;
                const addCoins = Number.isFinite(Number(coins)) ? Number(coins) : 0;
                currentXp += addXp;
                currentCoins += addCoins;
                DB.saveOption('dash_xp', String(currentXp));
                DB.saveOption('dash_coins', String(currentCoins));
                toast(`Ajouté avec succès : +${addXp} XP et +${addCoins} pièces !`, 'ok');
            }
            try { await refreshMembers(); } catch { }
        },

        /* ----- Pool des Quêtes Quotidiennes ----- */
        qField(idx, field, val) {
            if (!S.questsDraft || !S.questsDraft[idx]) return;
            if (field === 'target' || field === 'xp' || field === 'coins') {
                S.questsDraft[idx][field] = Math.max(0, parseInt(val, 10) || 0);
            } else {
                S.questsDraft[idx][field] = val;
            }
        },
        qAdd() {
            if (!S.questsDraft) S.questsDraft = AdminStore.getQuestPool();
            S.questsDraft.push({
                type: 'levels',
                icon: '🎯',
                title: 'Nouvelle mission quotidienne',
                target: 3,
                xp: 25,
                coins: 15,
                color: '#4cc9f0',
                enabled: true,
            });
            renderTabContent();
        },
        qDelete(idx) {
            if (!S.questsDraft || S.questsDraft.length <= 1) return;
            S.questsDraft.splice(idx, 1);
            renderTabContent();
        },
        questsSave() {
            if (!S.questsDraft) return;
            const r = AdminStore.saveQuestPool(S.questsDraft);
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            S.questsDraft = null;
            renderTabContent();
            toast('Pool de quêtes quotidiennes enregistré ✔', 'ok');
        },
        questsReset() {
            if (!confirm('Rétablir le pool de quêtes quotidiennes par défaut ?')) return;
            AdminStore.resetQuestPool();
            S.questsDraft = null;
            renderTabContent();
            toast('Pool de quêtes rétabli par défaut.', 'ok');
        },
        refreshTodayQuests() {
            if (typeof DailyQuests !== 'undefined' && typeof DailyQuests.resetToday === 'function') {
                DailyQuests.resetToday();
                toast('Quêtes du jour régénérées immédiatement ✔', 'ok');
            } else {
                toast('Module DailyQuests indisponible.', 'err');
            }
        },

        /* ----- Membres ----- */
        async addMember() {
            const email = (document.getElementById('admNewEmail') || {}).value || '';
            const pseudo = (document.getElementById('admNewPseudo') || {}).value || '';
            const pass = (document.getElementById('admNewPass') || {}).value || '';
            const role = (document.getElementById('admNewRole') || {}).value || 'eleve';
            const r = await DB.createLocalMember(email, pseudo, pass, role);
            if (!r.ok) { toast(r.error || 'Création impossible.', 'err'); return; }
            await refreshMembers();
            renderTabContent();
            toast('Compte « ' + pseudo + ' » créé ✔', 'ok');
        },
        async setRole(email, role) {
            const r = await DB.updateLocalMember(email, { role });
            if (!r.ok) { toast(r.error || 'Changement impossible.', 'err'); }
            else { toast('Rôle mis à jour ✔', 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async setMemberGrade(email, niveau) {
            const member = S.members.find(x => x.email === email);
            const payload = { niveau };
            if (AdminStore.isFiliereApplicable(niveau) && typeof AdminStore.resolveFiliereForNiveau === 'function') {
                payload.filiere = AdminStore.resolveFiliereForNiveau((member && member.filiere) || 'generale', niveau);
            }
            const r = DB.updateLocalMemberData(email, payload);
            if (!r.ok) { toast(r.error || 'Modification impossible.', 'err'); }
            else { toast('Classe mise à jour : ' + AdminStore.levelLabel(niveau) + ' ✔', 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async setMemberFiliere(email, filiere) {
            const r = DB.updateLocalMemberData(email, { filiere });
            if (!r.ok) { toast(r.error || 'Modification impossible.', 'err'); }
            else { toast('Filière mise à jour : ' + AdminStore.filiereLabel(filiere) + ' ✔', 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async bonusMember(email) {
            const st = DB.getLocalMemberStats(email);
            const r = DB.updateLocalMemberData(email, { xp: (st.xp || 0) + 50, coins: (st.coins ?? 30) + 100 });
            if (!r.ok) { toast(r.error || 'Attribution impossible.', 'err'); }
            else { toast('+50 XP et +100 pièces offerts ✔', 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async resetMemberProgress(email, username) {
            if (!confirm(`Réinitialiser toute la progression (XP, pièces, niveaux, succès) du compte « ${username} » ?`)) return;
            const r = DB.updateLocalMemberData(email, { resetProgress: true });
            if (!r.ok) { toast(r.error || 'Réinitialisation impossible.', 'err'); }
            else { toast(`Progression de « ${username} » réinitialisée.`, 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async renameMember(email, currentName) {
            const name = prompt('Nouveau pseudo pour « ' + currentName + ' » :', currentName);
            if (name === null) return;
            const me = DB.getCurrentUser();
            const r = me && me.email === email
                ? await DB.updateProfile({ username: name })
                : await DB.updateLocalMember(email, { username: name });
            if (!r.ok) { toast(r.error || 'Modification impossible.', 'err'); }
            else { toast('Pseudo mis à jour ✔', 'ok'); }
            await refreshMembers();
            renderTabContent();
        },
        async resetPass(email) {
            const pw = prompt('Nouveau mot de passe pour ' + email + ' (6 caractères minimum) :');
            if (!pw) return;
            const me = DB.getCurrentUser();
            const r = me && me.email === email
                ? await DB.updateProfile({ password: pw })
                : await DB.updateLocalMember(email, { password: pw });
            if (!r.ok) { toast(r.error || 'Modification impossible.', 'err'); }
            else { toast('Mot de passe réinitialisé ✔', 'ok'); }
        },
        async deleteMember(email, username) {
            if (!confirm('Supprimer définitivement le compte « ' + username + ' » (' + email + ') ?')) return;
            const r = await DB.deleteLocalMember(email);
            if (!r.ok) { toast(r.error || 'Suppression impossible.', 'err'); return; }
            await refreshMembers();
            renderTabContent();
            toast('Compte supprimé.', 'ok');
        },

        /* ----- Réglages ----- */
        onSettingsDefaultNiveauChange(niveau) {
            const sel = document.getElementById('admSiteDefaultFiliere');
            if (!sel || typeof AdminStore === 'undefined') return;
            const filOpts = (AdminStore.isFiliereApplicable(niveau) && typeof AdminStore.getFilieresForNiveau === 'function')
                ? AdminStore.getFilieresForNiveau(niveau)
                : AdminStore.getFilieres();
            const curVal = sel.value || 'generale';
            const resolved = (AdminStore.isFiliereApplicable(niveau) && typeof AdminStore.resolveFiliereForNiveau === 'function')
                ? AdminStore.resolveFiliereForNiveau(curVal, niveau)
                : curVal;
            sel.innerHTML = filOpts.map(f => `<option value="${esc(f.id)}"${resolved === f.id ? ' selected' : ''}>${esc(f.icon || '🧭')} ${esc(f.label)}</option>`).join('');
            if (filOpts.length && !filOpts.some(f => f.id === sel.value)) {
                sel.value = filOpts[0].id;
            }
        },
        saveSiteSettings() {
            const title = (document.getElementById('admSiteTitle') || {}).value;
            const tagline = (document.getElementById('admSiteTagline') || {}).value;
            const announcement = (document.getElementById('admSiteAnnouncement') || {}).value;
            const exitTitle = (document.getElementById('admSiteExitTitle') || {}).value;
            const exitSubtitle = (document.getElementById('admSiteExitSubtitle') || {}).value;
            const dashboardFooterNote = (document.getElementById('admSiteDashFooter') || {}).value;
            const defaultNiveau = (document.getElementById('admSiteDefaultNiveau') || {}).value || '6eme';
            const rawDefaultFiliere = (document.getElementById('admSiteDefaultFiliere') || {}).value || 'generale';
            const defaultFiliere = (AdminStore.isFiliereApplicable(defaultNiveau) && typeof AdminStore.resolveFiliereForNiveau === 'function')
                ? AdminStore.resolveFiliereForNiveau(rawDefaultFiliere, defaultNiveau)
                : rawDefaultFiliere;
            const quizTimerSeconds = parseInt((document.getElementById('admSiteTimer') || {}).value, 10);
            const xpMultiplier = parseFloat((document.getElementById('admSiteXpMult') || {}).value);
            const coinMultiplier = parseFloat((document.getElementById('admSiteCoinMult') || {}).value);
            const sfxVol = parseInt((document.getElementById('admSiteSfxVol') || {}).value, 10);
            const musVol = parseInt((document.getElementById('admSiteMusVol') || {}).value, 10);
            const allowRegistration = Boolean((document.getElementById('admSiteAllowReg') || {}).checked);
            const soundEnabledByDefault = Boolean((document.getElementById('admSiteSoundDef') || {}).checked);
            const showAudioToggleButton = Boolean((document.getElementById('admSiteShowAudioBtn') || {}).checked);
            const enableShop = Boolean((document.getElementById('admSiteEnableShop') || {}).checked);
            const enableQuests = Boolean((document.getElementById('admSiteEnableQuests') || {}).checked);
            const enableBadges = Boolean((document.getElementById('admSiteEnableBadges') || {}).checked);
            const enableChrono = Boolean((document.getElementById('admSiteEnableChrono') || {}).checked);
            const chronoEnabledByDefault = Boolean((document.getElementById('admSiteChronoDef') || {}).checked);
            const showHintsInQuiz = Boolean((document.getElementById('admSiteShowHints') || {}).checked);
            const strictStarsAntiCheat = Boolean((document.getElementById('admSiteStrictStars') || {}).checked);
            const strictCollegeSubjects = Boolean((document.getElementById('admSiteStrictCollege') || {}).checked);
            const hideGradeDuringQuiz = Boolean((document.getElementById('admSiteHideGradeQuiz') || {}).checked);
            const showExpulsionTransition = Boolean((document.getElementById('admSiteExpulsion') || {}).checked);
            const confirmBeforeQuit = Boolean((document.getElementById('admSiteConfirmQuit') || {}).checked);
            const logoutOnQuit = Boolean((document.getElementById('admSiteLogoutQuit') || {}).checked);
            const enableParticlesByDefault = Boolean((document.getElementById('admSiteEnableParticles') || {}).checked);
            const enableConfetti = Boolean((document.getElementById('admSiteEnableConfetti') || {}).checked);
            const allowClientAppearance = Boolean((document.getElementById('admSiteAllowClientApp') || {}).checked);
            const defaultTheme = (document.getElementById('admSiteDefTheme') || {}).value || 'default';
            const defaultUiPreset = (document.getElementById('admSiteDefUiPreset') || {}).value || 'default';
            const defaultUiColor = (document.getElementById('admSiteDefUiColor') || {}).value || '#0d1f3a';
            const defaultUiAccent = (document.getElementById('admSiteDefUiAccent') || {}).value || '#c8a84b';
            const defaultBtnPreset = (document.getElementById('admSiteDefBtnPreset') || {}).value || 'default';
            const defaultBtnColor = (document.getElementById('admSiteDefBtnColor') || {}).value || '#24354f';
            const defaultBtnBrightness = parseInt((document.getElementById('admSiteDefBtnBright') || {}).value, 10);
            const maintenanceMode = Boolean((document.getElementById('admSiteMaintMode') || {}).checked);
            const maintenanceMessage = (document.getElementById('admSiteMaintMsg') || {}).value || '';

            const r = AdminStore.saveSiteConfig({
                title, tagline, announcement, exitTitle, exitSubtitle, dashboardFooterNote,
                defaultNiveau, defaultFiliere,
                quizTimerSeconds, xpMultiplier, coinMultiplier,
                sfxVolume: isNaN(sfxVol) ? 0.6 : sfxVol / 100,
                musicVolume: isNaN(musVol) ? 0.35 : musVol / 100,
                allowRegistration, soundEnabledByDefault, showAudioToggleButton,
                enableShop, enableQuests, enableBadges, enableChrono, chronoEnabledByDefault,
                showHintsInQuiz, strictStarsAntiCheat, strictCollegeSubjects,
                hideGradeDuringQuiz, showExpulsionTransition, confirmBeforeQuit, logoutOnQuit,
                enableParticlesByDefault, enableConfetti,
                allowClientAppearance, defaultTheme, defaultUiPreset, defaultUiColor, defaultUiAccent,
                defaultBtnPreset, defaultBtnColor, defaultBtnBrightness,
                maintenanceMode, maintenanceMessage
            });
            if (!r.ok) { toast(r.error || 'Erreur lors de la sauvegarde.', 'err'); return; }
            renderTabContent();
            toast('Configuration intégrale du site enregistrée ✔', 'ok');
        },
        resetSiteSettings() {
            if (!confirm('Rétablir la configuration générale par défaut du site ?')) return;
            AdminStore.resetSiteConfig();
            renderTabContent();
            toast('Configuration du site réinitialisée par défaut.', 'ok');
        },
        saveAiSettings() {
            const generateWebhookUrl = (document.getElementById('admAiGenUrl') || {}).value;
            const validateWebhookUrl = (document.getElementById('admAiValUrl') || {}).value;
            const fetchTimeoutMs = parseInt((document.getElementById('admAiTimeout') || {}).value, 10);
            const fallbackToOffline = Boolean((document.getElementById('admAiFallback') || {}).checked);
            const adaptiveMode = Boolean((document.getElementById('admAiAdaptive') || {}).checked);
            const selectionStrategy = (document.getElementById('admAiStrategy') || {}).value || 'random';
            const enableLocalPersonas = Boolean((document.getElementById('admAiLocalPersonas') || {}).checked);
            const showAiBadgeInQuiz = Boolean((document.getElementById('admAiShowBadge') || {}).checked);

            const r = AdminStore.saveAiConfig({
                generateWebhookUrl, validateWebhookUrl, fetchTimeoutMs, fallbackToOffline,
                adaptiveMode, selectionStrategy, enableLocalPersonas, showAiBadgeInQuiz,
            });
            if (!r.ok) { toast(r.error || 'Erreur lors de la sauvegarde de l\'IA.', 'err'); return; }
            renderTabContent();
            toast('Configuration Multi-IA, Adaptatif & Personas enregistrée ✔', 'ok');
        },
        addLocalPersona() {
            const name = ((document.getElementById('admNewPersonaName') || {}).value || '').trim();
            const role = ((document.getElementById('admNewPersonaRole') || {}).value || '').trim() || 'Adaptative';
            const icon = ((document.getElementById('admNewPersonaIcon') || {}).value || '').trim() || '✨';
            const color = ((document.getElementById('admNewPersonaColor') || {}).value || '').trim() || '#4cc9f0';
            const hintPrefix = (document.getElementById('admNewPersonaHint') || {}).value || '';
            if (!name) { toast('Donnez un nom à cette persona IA.', 'err'); return; }
            const cur = AdminStore.getAiConfig();
            const personas = (cur.localPersonas || []).slice();
            personas.push({
                id: 'ai-' + AdminStore.slug(name) + '-' + (Date.now() % 1000),
                name, role, icon, color, hintPrefix, variantOffset: personas.length, enabled: true,
            });
            const r = AdminStore.saveAiConfig({ localPersonas: personas });
            if (!r.ok) { toast(r.error || 'Ajout impossible.', 'err'); return; }
            renderTabContent();
            toast(`Persona « ${name} » ajoutée au lot local ✔`, 'ok');
        },
        toggleLocalPersona(idx) {
            const cur = AdminStore.getAiConfig();
            const personas = (cur.localPersonas || []).slice();
            if (!personas[idx]) return;
            personas[idx].enabled = personas[idx].enabled === false;
            AdminStore.saveAiConfig({ localPersonas: personas });
            renderTabContent();
            toast(personas[idx].enabled ? `Persona « ${personas[idx].name} » activée.` : `Persona « ${personas[idx].name} » mise en pause.`, 'ok');
        },
        deleteLocalPersona(idx) {
            const cur = AdminStore.getAiConfig();
            const personas = (cur.localPersonas || []).slice();
            if (!personas[idx]) return;
            const removed = personas.splice(idx, 1)[0];
            AdminStore.saveAiConfig({ localPersonas: personas.length > 0 ? personas : null });
            renderTabContent();
            toast(`Persona « ${removed.name} » retirée.`, 'ok');
        },
        resetLocalPersonas() {
            AdminStore.saveAiConfig({ localPersonas: null });
            renderTabContent();
            toast('Les 5 personas IA locales par défaut ont été rétablies.', 'ok');
        },
        addAiProvider() {
            const name = ((document.getElementById('admNewAiName') || {}).value || '').trim();
            const type = (document.getElementById('admNewAiType') || {}).value || 'make_webhook';
            const endpoint = ((document.getElementById('admNewAiEndpoint') || {}).value || '').trim();
            const validateEndpoint = ((document.getElementById('admNewAiValidateUrl') || {}).value || '').trim();
            const model = ((document.getElementById('admNewAiModel') || {}).value || '').trim();
            const apiKey = ((document.getElementById('admNewAiKey') || {}).value || '').trim();
            const weight = Math.max(1, Math.min(10, parseInt((document.getElementById('admNewAiWeight') || {}).value, 10) || 1));

            if (!name) { toast('Donnez un nom à ce fournisseur IA.', 'err'); return; }
            if (type !== 'gemini' && !endpoint) { toast('Renseignez l\'URL de l\'endpoint.', 'err'); return; }
            if (type === 'gemini' && !apiKey && !endpoint) { toast('Renseignez la clé API Gemini ou une URL personnalisée.', 'err'); return; }

            const cur = AdminStore.getAiConfig();
            const providers = (cur.providers || []).slice();
            providers.push({
                id: AdminStore.slug(name) + '-' + (Date.now() % 10000),
                name, type, endpoint, validateEndpoint, model, apiKey, weight, enabled: true,
            });
            const r = AdminStore.saveAiConfig({ providers });
            if (!r.ok) { toast(r.error || 'Ajout impossible.', 'err'); return; }
            renderTabContent();
            toast(`IA « ${name} » ajoutée au pool aléatoire ✔`, 'ok');
        },
        toggleAiProvider(idx) {
            const cur = AdminStore.getAiConfig();
            const providers = (cur.providers || []).slice();
            if (!providers[idx]) return;
            providers[idx].enabled = providers[idx].enabled === false;
            AdminStore.saveAiConfig({ providers });
            renderTabContent();
            toast(providers[idx].enabled ? `IA « ${providers[idx].name} » activée.` : `IA « ${providers[idx].name} » mise en pause.`, 'ok');
        },
        deleteAiProvider(idx) {
            const cur = AdminStore.getAiConfig();
            const providers = (cur.providers || []).slice();
            if (!providers[idx]) return;
            const removed = providers.splice(idx, 1)[0];
            AdminStore.saveAiConfig({ providers });
            renderTabContent();
            toast(`IA « ${removed.name} » retirée du pool.`, 'ok');
        },
        async testSingleAiProvider(idx) {
            const cur = AdminStore.getAiConfig();
            const p = (cur.providers || [])[idx];
            if (!p) return;
            const resEl = document.getElementById('admAiTestResult');
            if (resEl) resEl.innerHTML = `<div class="adm-note">Test de « ${esc(p.name)} » en cours…</div>`;
            if (typeof AiProvider !== 'undefined' && typeof AiProvider.testProvider === 'function') {
                const res = await AiProvider.testProvider(p);
                if (resEl) {
                    resEl.innerHTML = res.ok
                        ? `<div class="adm-note ok">✓ « ${esc(p.name)} » opérationnelle (${res.latencyMs}ms) — Exemple : <i>${esc(res.lesson.q)}</i></div>`
                        : `<div class="adm-note warn">⚠️ « ${esc(p.name)} » en échec (${res.latencyMs}ms) : ${esc(res.error)}</div>`;
                }
            }
        },
        resetAiSettings() {
            if (!confirm('Rétablir la configuration IA par défaut ?')) return;
            AdminStore.resetAiConfig();
            renderTabContent();
            toast('Configuration IA réinitialisée par défaut.', 'ok');
        },
        async testAiSettings() {
            const resEl = document.getElementById('admAiTestResult');
            if (resEl) resEl.innerHTML = '<div class="adm-note">Test du pool Multi-IA en cours…</div>';
            const active = (typeof AiProvider !== 'undefined' && typeof AiProvider.getActiveProviders === 'function')
                ? AiProvider.getActiveProviders()
                : [];
            if (active.length === 0) {
                if (resEl) resEl.innerHTML = '<div class="adm-note ok">✓ Mode autonome actif : aucune IA externe configurée, le moteur adaptatif local fonctionne 100 % hors-ligne sans répétition.</div>';
                return;
            }
            if (typeof AiProvider !== 'undefined' && typeof AiProvider.fetchQuestion === 'function') {
                try {
                    const start = Date.now();
                    const testRes = await AiProvider.fetchQuestion('maths', 0, '6eme');
                    const elapsed = Date.now() - start;
                    if (resEl) {
                        if (testRes && testRes.source === 'ai') {
                            resEl.innerHTML = `<div class="adm-note ok">✓ Pool Multi-IA opérationnel ! Réponse reçue via <b>${esc(testRes.providerName || 'IA')}</b> en ${elapsed}ms.</div>`;
                        } else {
                            resEl.innerHTML = `<div class="adm-note warn">⚠️ Fournisseurs distants injoignables (${elapsed}ms). Le moteur adaptatif local prend automatiquement le relais.</div>`;
                        }
                    }
                } catch (e) {
                    if (resEl) resEl.innerHTML = `<div class="adm-note warn">⚠️ Échec connexion IA : ${esc(e.message || String(e))} — Repli adaptatif local actif.</div>`;
                }
            } else {
                if (resEl) resEl.innerHTML = '<div class="adm-note ok">✓ Configuration locale active (moteur adaptatif disponible).</div>';
            }
        },
        exportConfig() {
            const area = document.getElementById('admExportArea');
            if (!area) return;
            area.value = AdminStore.exportJson();
            area.style.display = 'block';
            toast('Configuration exportée (copiez le JSON ou téléchargez le fichier).', 'ok');
        },
        downloadConfig() {
            const json = AdminStore.exportJson();
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'eduquest-admin-config.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
            toast('Fichier téléchargé.', 'ok');
        },
        importConfig() {
            const area = document.getElementById('admImportArea');
            if (!area || !area.value.trim()) { toast('Collez d\'abord un JSON exporté.', 'err'); return; }
            const r = AdminStore.importJson(area.value);
            if (!r.ok) { toast(r.error || 'Import impossible.', 'err'); return; }
            area.value = '';
            S.subjectList = []; S.subjectId = null; S.levelsDraft = null; S.filieresDraft = null; S.questsDraft = null;
            renderPanel();
            toast('Configuration importée ✔', 'ok');
        },
        resetAdminConfig() {
            if (!confirm('Retirer TOUTES les personnalisations (niveaux, filières, matières, leçons, boutique, quêtes, succès) ?')) return;
            if (!confirm('Confirmez : cette action est irréversible.')) return;
            AdminStore.resetAll();
            S.subjectList = []; S.subjectId = null; S.editingLesson = null; S.lessonDraft = null;
            S.editingBadge = null; S.editingShopItem = null; S.levelsDraft = null; S.filieresDraft = null; S.questsDraft = null;
            renderPanel();
            toast('Configuration administrateur réinitialisée.', 'ok');
        },
        resetProgress() {
            if (!confirm('Effacer la progression, les XP, les pièces et les badges de cet appareil ? Les comptes sont conservés.')) return;
            if (!confirm('Confirmez : cette action est irréversible.')) return;
            const n = AdminStore.clearLocalGameData();
            toast(n + ' donnée(s) de jeu supprimée(s).', 'ok');
        },

        /* ----- Crédits (v1.20) ----- */
        creditsSave() {
            const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const r = AdminStore.saveCredits({
                studioName: val('admCrStudio'),
                tagline: val('admCrTagline'),
                creatorName: val('admCrCreator'),
                website: val('admCrWebsite'),
                githubUrl: val('admCrGithub'),
                contactEmail: val('admCrEmail'),
                extraNote: val('admCrNote'),
            });
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            renderTabContent();
            toast('Crédits enregistrés ✔ — rechargez le jeu (F5) pour le pied de page.', 'ok');
        },
        creditsReset() {
            if (!confirm('Restaurer les crédits par défaut ?')) return;
            AdminStore.resetCredits();
            renderTabContent();
            toast('Crédits réinitialisés.', 'ok');
        },
        openCookieBanner() {
            const zone = document.getElementById('admCrConsent');
            if (zone) {
                const st = window.EduCookies ? EduCookies.getConsent() : null;
                zone.textContent = !st
                    ? 'Aucun choix enregistré sur ce navigateur : le bandeau s\'affichera automatiquement à la prochaine visite.'
                    : 'Choix enregistré : « ' + st.choice + ' »' + (st.ts ? ' le ' + fmtDate(st.ts) : '') + '.';
            }
            if (window.EduCookies) EduCookies.showBanner();
            else toast('cookies.js n\'est pas chargé sur cette page.', 'err');
        },

        // Succès / Badges
        setBadgeCategory(cat) {
            S.badgeCategory = cat;
            renderTabContent();
        },
        setBadgeFiliereFilter(fil) {
            S.badgeFiliereFilter = fil || 'all';
            renderTabContent();
        },
        newBadge() {
            const defaultFil = (S.badgeFiliereFilter && !['all', 'universal', 'college'].includes(S.badgeFiliereFilter))
                ? [S.badgeFiliereFilter]
                : ['all'];
            const defaultBand = S.badgeFiliereFilter === 'college' ? 'college'
                : (defaultFil[0] !== 'all' ? 'lycee' : 'all');
            S.editingBadge = {
                id: 'succes_' + Date.now(),
                name: '',
                desc: '',
                icon: '🏆',
                category: 'progression',
                band: defaultBand,
                allowedFilieres: defaultFil,
                condition: '',
                _isNew: true,
            };
            renderTabContent();
        },
        editBadge(id) {
            const b = AdminStore.getBadge(id);
            if (!b) return;
            S.editingBadge = {
                ...b,
                band: b.band || 'all',
                allowedFilieres: Array.isArray(b.allowedFilieres) && b.allowedFilieres.length ? b.allowedFilieres.slice() : ['all'],
                _isNew: false,
            };
            renderTabContent();
        },
        toggleEditBadgeFiliere(filId) {
            if (!S.editingBadge) return;
            // Préserve les champs déjà saisis dans le formulaire avant re-rendu
            S.editingBadge.id = (document.getElementById('admBadgeId')?.value || S.editingBadge.id || '').trim();
            S.editingBadge.name = (document.getElementById('admBadgeName')?.value ?? S.editingBadge.name);
            S.editingBadge.icon = (document.getElementById('admBadgeIcon')?.value ?? S.editingBadge.icon);
            S.editingBadge.category = (document.getElementById('admBadgeCat')?.value || S.editingBadge.category || 'progression');
            S.editingBadge.band = (document.getElementById('admBadgeBand')?.value || S.editingBadge.band || 'all');
            S.editingBadge.desc = (document.getElementById('admBadgeDesc')?.value ?? S.editingBadge.desc);
            S.editingBadge.condition = (document.getElementById('admBadgeCond')?.value ?? S.editingBadge.condition);

            let cur = Array.isArray(S.editingBadge.allowedFilieres) ? S.editingBadge.allowedFilieres.slice() : ['all'];
            if (filId === 'all') {
                cur = ['all'];
            } else {
                if (cur.includes('all')) {
                    cur = [filId];
                } else if (cur.includes(filId)) {
                    cur = cur.filter(x => x !== filId);
                    if (cur.length === 0) cur = ['all'];
                } else {
                    cur.push(filId);
                }
            }
            S.editingBadge.allowedFilieres = cur;
            renderTabContent();
        },
        cancelBadgeEdit() {
            S.editingBadge = null;
            renderTabContent();
        },
        saveBadge() {
            const id = (document.getElementById('admBadgeId')?.value || '').trim();
            const name = (document.getElementById('admBadgeName')?.value || '').trim();
            const icon = (document.getElementById('admBadgeIcon')?.value || '').trim() || '🏆';
            const cat = document.getElementById('admBadgeCat')?.value || 'progression';
            const band = document.getElementById('admBadgeBand')?.value || 'all';
            const desc = (document.getElementById('admBadgeDesc')?.value || '').trim();
            const condition = (document.getElementById('admBadgeCond')?.value || '').trim();
            const allowedFilieres = (S.editingBadge && Array.isArray(S.editingBadge.allowedFilieres) && S.editingBadge.allowedFilieres.length)
                ? S.editingBadge.allowedFilieres.slice()
                : ['all'];
            if (!id || !name) {
                toast('Identifiant et nom requis.', 'err');
                return;
            }
            AdminStore.saveBadge({ id, name, icon, category: cat, band, allowedFilieres, desc, condition });
            S.editingBadge = null;
            renderTabContent();
            toast('Succès et filière cible enregistrés ✔', 'ok');
        },
        deleteBadge(id) {
            if (!confirm(`Supprimer le succès « ${id} » ?`)) return;
            AdminStore.deleteBadge(id);
            renderTabContent();
            toast('Succès supprimé.', 'ok');
        },
        toggleBadgeUnlock(id) {
            const unlocked = DB.getBadges();
            if (unlocked.includes(id)) {
                DB.lockBadge(id);
                toast(`Succès « ${id} » verrouillé.`, 'ok');
            } else {
                DB.unlockBadge(id);
                toast(`Succès « ${id} » débloqué !`, 'ok');
            }
            renderTabContent();
        },
        unlockAllBadges() {
            const all = AdminStore.getBadges().map(b => b.id);
            DB.setBadges(all);
            renderTabContent();
            toast('Tous les succès ont été débloqués pour ce compte !', 'ok');
        },
        resetUserBadges() {
            if (!confirm('Réinitialiser tous les succès de votre compte ?')) return;
            DB.resetBadges();
            renderTabContent();
            toast('Succès de votre compte réinitialisés.', 'ok');
        },
        resetBadgesCatalog() {
            if (!confirm('Rétablir la liste des succès par défaut ?')) return;
            AdminStore.resetBadges();
            renderTabContent();
            toast('Catalogue de succès réinitialisé par défaut.', 'ok');
        },
    };

    const PUBLIC_ADM_ACTIONS = new Set(['login', 'setupFirst', 'switchGate']);
    const safeADM = {};
    Object.keys(ADM).forEach((key) => {
        const fn = ADM[key];
        safeADM[key] = (typeof fn === 'function' && !PUBLIC_ADM_ACTIONS.has(key))
            ? function (...args) {
                if (!S.authed) {
                    toast('Authentification administrateur requise.', 'err');
                    return;
                }
                return fn.apply(this, args);
            }
            : fn;
    });
    window.ADM = safeADM;

    /* ============================== HELPERS DE RENDU PARTIEL ============================== */

    /** Re-rend uniquement la zone d'onglet (conserve la coquille). */
    function renderTabContent() {
        const zone = document.getElementById('admTab');
        if (zone) zone.innerHTML = renderTab();
        const modalWrap = document.getElementById('admModalWrap');
        if (modalWrap) modalWrap.innerHTML = S.testModalQuestion ? renderTestModal() : '';
        refreshStats();
    }

    /* ============================== DÉMARRAGE ============================== */

    async function boot() {
        updateModeBadge();
        if (typeof DB !== 'undefined' && DB.useApi) {
            const curApiUser = DB.getCurrentUser();
            if (!curApiUser || curApiUser.role !== 'admin') {
                S.authed = false;
                renderApiNotice();
                return;
            }
        }

        // Toujours vérifier l'existence d'un compte administrateur avant tout affichage
        let admins = [];
        try {
            const res = await DB.listLocalMembers();
            if (res && res.ok && Array.isArray(res.data)) {
                S.members = res.data;
                admins = res.data.filter(u => u.role === 'admin');
            }
        } catch { }
        S.hasAnyAdmin = admins.length > 0;

        // 1) Vérifier si la session courante est admin
        const currentUser = (typeof DB !== 'undefined') ? DB.getCurrentUser() : null;
        if (currentUser && currentUser.role === 'admin') {
            S.authed = true;
            S.hasAnyAdmin = true;
        } else {
            S.gate = S.hasAnyAdmin ? 'login' : 'setup';
            S.authed = false;
            render();
            return;
        }

        render();
    }

    async function refreshMembers() {
        const r = await DB.listLocalMembers();
        S.members = r.ok ? (r.data || []) : [];
        return S.members;
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
