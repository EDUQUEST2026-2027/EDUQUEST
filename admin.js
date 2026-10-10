/* =============================================================================
   ADMIN.JS — EDUQUEST v1.21.0
   Interface du panneau d'administration (admin.html).

   PRINCIPE :
   - Accès PROTÉGÉ : le panneau exige un compte avec le rôle « admin ».
   - Onglets :
       • Niveaux scolaires → AdminStore (clé 'eduquest_admin_data')
       • Matières & leçons → AdminStore (surcharges + matières personnalisées)
       • Membres           → comptes locaux (db.js, rôle élève/admin)
       • Réglages          → profil, export/import, reset
   - Toutes les saisies utilisateur sont échappées (esc) avant insertion HTML.
   - Les actions mutent l'état puis re-rendent la vue : aucun framework.

   SÉCURITÉ :
   L'accès est protégé par rôle 'admin' (db.js). Si aucun admin n'existe,
   un formulaire de création est présenté. Si un admin existe mais que la
   session courante n'est pas admin, un formulaire de connexion est présenté.
   ============================================================================= */

(function () {

    'use strict';

    const esc = (typeof AdminStore !== 'undefined') ? AdminStore.esc
        : (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const LESSON_LABELS = {
        qcm: 'QCM',
        vrai_faux: 'Vrai / Faux',
        reponse_courte: 'Réponse courte',
        texte_a_trous: 'Texte à trous',
        drag_and_drop: 'Association',
    };
    const LESSON_ORDER = ['qcm', 'vrai_faux', 'reponse_courte', 'texte_a_trous', 'drag_and_drop'];

    /* ============================== ÉTAT ============================== */

    const S = {
        authed: false,                 // false par défaut : vérifié au démarrage
        gate: 'login',                 // 'login' | 'setup' — formulaire affiché
        tab: 'levels',                 // levels | subjects | members | settings
        subjectId: null,               // matière ouverte (onglet matières)
        subjectList: [],               // liste éditable en cache
        editingLesson: -1,             // -1 = nouvelle leçon, sinon index
        lessonDraft: null,             // leçon en cours d'édition
        levelsDraft: null,             // niveaux en cours d'édition
        members: [],                   // cache des comptes locaux
        err: '',
        modeApi: false,
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
                <div style="text-align:center; margin-top:14px;"><button class="adm-btn" onclick="location.reload()">Recharger</button></div>
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
        const isSetup = S.gate === 'setup';
        const showSetupLink = !isSetup;
        const showLoginLink = isSetup;
        app.innerHTML = `
            <div class="adm-gate">
                <div class="adm-card">
                    <h2>${isSetup ? '🛡️ Créer le premier administrateur' : '🛡️ Accès administrateur'}</h2>
                    <p class="adm-gate-sub">${isSetup
                        ? 'Aucun compte administrateur n\'existe encore. Créez-le pour ouvrir le panneau.'
                        : 'Connectez-vous avec un compte dont le rôle est « admin ».'}</p>

                    ${isSetup ? `
                        <div class="adm-form">
                            <div class="adm-field"><label>Adresse e-mail</label>
                                <input class="adm-input" id="admSetEmail" type="email" autocomplete="username" placeholder="admin@ecole.fr"></div>
                            <div class="adm-field"><label>Pseudo</label>
                                <input class="adm-input" id="admSetPseudo" autocomplete="nickname" placeholder="Administrateur"></div>
                            <div class="adm-field"><label>Mot de passe (6 caractères min.)</label>
                                <input class="adm-input" id="admSetPass" type="password" autocomplete="new-password"></div>
                            <div class="adm-error" id="admSetErr"></div>
                            <button class="adm-btn" onclick="ADM.setupFirst()">Créer et ouvrir le panneau</button>
                        </div>
                    ` : `
                        <div class="adm-form">
                            <div class="adm-field"><label>Adresse e-mail</label>
                                <input class="adm-input" id="admLoginEmail" type="email" autocomplete="username" placeholder="admin@ecole.fr"></div>
                            <div class="adm-field"><label>Mot de passe</label>
                                <input class="adm-input" id="admLoginPass" type="password" autocomplete="current-password"></div>
                            <div class="adm-error" id="admLoginErr"></div>
                            <button class="adm-btn" onclick="ADM.login()">Ouvrir le panneau</button>
                        </div>
                    `}
                    <div class="adm-gate-switch">
                        ${showSetupLink ? 'Aucun administrateur ? <a onclick="ADM.switchGate()">Créer le premier compte admin</a>' : ''}
                        ${showLoginLink ? 'Un compte admin existe déjà ? <a onclick="ADM.switchGate()">Se connecter</a>' : ''}
                    </div>
                </div>
            </div>`;
    }

    function setError(id, msg) {
        const el = document.getElementById(id);
        if (el) el.textContent = msg || '';
    }

    /* ============================== PANNEAU (coquille) ============================== */

    const TABS = [
        { id: 'levels', icon: '🎓', label: 'Niveaux scolaires' },
        { id: 'subjects', icon: '📚', label: 'Matières & leçons' },
        { id: 'shop', icon: '🛍️', label: 'Boutique' },
        { id: 'rewards', icon: '🎁', label: 'Récompenses' },
        { id: 'members', icon: '👥', label: 'Membres' },
        { id: 'credits', icon: '✨', label: 'Crédits' },
        { id: 'settings', icon: '⚙️', label: 'Réglages' },
    ];

    function renderPanel() {
        app.innerHTML = `
            <div class="adm-stats" id="admStats">
                <div class="adm-stat"><b>…</b><span>Comptes</span></div>
                <div class="adm-stat"><b>…</b><span>Admins</span></div>
                <div class="adm-stat"><b>…</b><span>Matières</span></div>
                <div class="adm-stat"><b>…</b><span>Articles Boutique</span></div>
            </div>
            <div class="adm-tabs">
                ${TABS.map(t => `
                    <button class="adm-tab${S.tab === t.id ? ' active' : ''}" onclick="ADM.tab('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
            </div>
            <div id="admTab">${renderTab()}</div>
            <p class="adm-hint" style="margin-top:18px; text-align:center;">
                Rechargez la page du jeu (F5) pour voir vos modifications appliquées.<br>
                <a href="legal.html" target="_blank">Mentions légales, confidentialité &amp; cookies</a>
            </p>`;
        refreshStats();
    }

    function renderTab() {
        if (S.tab === 'levels') return renderLevels();
        if (S.tab === 'subjects') return renderSubjects();
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
        const subs = typeof AdminStore !== 'undefined' ? AdminStore.listEditable(AdminStore.getDefaultSubjects()) : [];
        const shopItems = typeof AdminStore !== 'undefined' ? AdminStore.getShopItems() : [];
        if (!wrap) return;
        const cells = wrap.querySelectorAll('.adm-stat b');
        if (cells.length >= 4) {
            cells[0].textContent = String(members.length);
            cells[1].textContent = String(admins);
            cells[2].textContent = String(subs.length);
            cells[3].textContent = String(shopItems.length);
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
                        <button class="adm-ico-btn" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="ADM.lvlMove(${i},-1)">↑</button>
                        <button class="adm-ico-btn" title="Descendre" ${i === count - 1 ? 'disabled' : ''} onclick="ADM.lvlMove(${i},1)">↓</button>
                        <button class="adm-ico-btn danger" title="Supprimer" ${count <= 1 ? 'disabled' : ''} onclick="ADM.lvlDelete(${i})">🗑</button>
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
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.lvlAdd()">+ Ajouter un niveau</button>
                    <button class="adm-btn adm-btn-ok" onclick="ADM.levelsSave()">💾 Enregistrer</button>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.levelsCancel()">Annuler</button>
                    <button class="adm-btn adm-btn-danger adm-right" onclick="ADM.levelsReset()">Rétablir les niveaux par défaut</button>
                </div>
                <p class="adm-hint">La « bande de contenu » choisit la difficulté des questions générées (collège ou lycée).
                Les niveaux par défaut sont : 6ème → Terminale.</p>
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
        const open = list.find(x => x.id === S.subjectId) || null;

        return `
            <div class="adm-split">
                <div>
                    <div class="adm-card">
                        <h2>Matières</h2>
                        <div class="adm-subject-list">
                            ${list.map(x => `
                                <button class="adm-subject-item${S.subjectId === x.id ? ' active' : ''}" onclick="ADM.openSubject('${x.id}')">
                                    <span class="icon">${esc(x.icon || '📘')}</span>
                                    <span class="name">${esc(x.name || x.id)}</span>
                                    <span class="count">${x.lessons.length}</span>
                                </button>`).join('')}
                        </div>
                        <div style="margin-top:14px; border-top:1px dashed rgba(154,167,216,.2); padding-top:12px;">
                            <div class="adm-form">
                                <div class="adm-field"><label>Nouvelle matière</label>
                                    <input class="adm-input" id="admNewName" placeholder="Nom (ex: Musique)">
                                    <input class="adm-input" id="admNewIcon" placeholder="Icône (emoji, ex: 🎵)" style="margin-top:6px;">
                                    <button class="adm-btn" style="margin-top:6px;" onclick="ADM.createSubject()">+ Créer la matière</button>
                                </div>
                            </div>
                            <p class="adm-hint" style="margin-top:8px;">Les matières personnalisées n'ont que les leçons que
                            vous écrivez (aucune génération automatique).</p>
                        </div>
                    </div>
                </div>
                <div>
                    ${open ? renderSubjectDetail(open) : `
                        <div class="adm-card"><div class="adm-empty">Sélectionnez une matière pour éditer ses leçons.</div></div>`}
                </div>
            </div>`;
    }

    function renderSubjectDetail(sub) {
        // Récupère l'état le plus frais depuis le store (surcharges éventuelles)
        const fresh = subjectList().find(x => x.id === sub.id) || sub;
        const lessons = fresh.lessons || [];
        const isCustom = typeof AdminStore !== 'undefined' && AdminStore.isCustom(sub.id);
        const customized = isCustom || (typeof AdminStore !== 'undefined' && AdminStore.hasOverride(sub.id));

        const lessonRows = lessons.map((l, i) => `
            <div class="adm-lesson-row">
                <div class="head">
                    <span class="num" style="color:var(--gold); font-weight:700;">${i + 1}</span>
                    <span class="t">${esc(l.title || ('Niveau ' + (i + 1)))}</span>
                    <span class="adm-badge adm-badge-type">${esc(typeLabel(l.type))}</span>
                    <span class="q">${esc(clip(l.q || l.textWithBlanks || l.q, 80))}</span>
                    <div class="adm-row-actions">
                        <button class="adm-ico-btn" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="ADM.lessonMove(${i},-1)">↑</button>
                        <button class="adm-ico-btn" title="Descendre" ${i === lessons.length - 1 ? 'disabled' : ''} onclick="ADM.lessonMove(${i},1)">↓</button>
                        <button class="adm-ico-btn" title="Modifier" onclick="ADM.editLesson(${i})">✏️</button>
                        <button class="adm-ico-btn danger" title="Supprimer" onclick="ADM.deleteLesson(${i})">🗑</button>
                    </div>
                </div>
            </div>`).join('');

        const editor = S.editingLesson !== null && S.editingLesson !== undefined && S.editingLesson >= -1
            && S.subjectId === sub.id ? renderLessonEditor(lessons) : '';

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">${esc(fresh.icon || '📘')} ${esc(fresh.name)}</h2>
                    <span class="adm-badge ${isCustom ? 'adm-badge-custom' : 'adm-badge-system'}">${isCustom ? 'Personnalisée' : 'Matière du jeu'}</span>
                </div>
                <div class="adm-note">
                    ${isCustom
                        ? `Matière créée dans le panneau : seuls vos niveaux existent (${lessons.length} leçon(s)). Ajoutez des leçons pour créer de nouveaux niveaux.`
                        : `Les niveaux 1 à ${lessons.length} (écrits à la main${customized ? ', partiellement modifiés' : ''}) sont modifiables ici ; au-delà, le contenu est généré automatiquement (100 niveaux au total).`}
                </div>

                <div class="adm-form-row" style="margin-bottom:14px;">
                    <div class="adm-field"><label>Nom de la matière</label>
                        <input class="adm-input" id="admMetaName" value="${esc(fresh.name)}"></div>
                    <div class="adm-field"><label>Icône (emoji ou symbole)</label>
                        <input class="adm-input" id="admMetaIcon" value="${esc(fresh.icon)}" style="max-width:120px;"></div>
                    <button class="adm-btn" onclick="ADM.saveMeta()">💾 Renommer</button>
                    ${isCustom
                        ? `<button class="adm-btn adm-btn-danger" onclick="ADM.deleteSubject()">Supprimer la matière</button>`
                        : `<button class="adm-btn adm-btn-ghost" onclick="ADM.resetSubject()" title="Retirer toutes les modifications de cette matière">Rétablir l'original</button>`}
                </div>

                ${editor}

                <div class="adm-toolbar">
                    <button class="adm-btn" onclick="ADM.newLesson()">+ Ajouter une leçon (niveau ${lessons.length + 1})</button>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.openSubject('')">‹ Retour à la liste</button>
                </div>

                ${lessons.length ? `<div class="adm-lesson-preview">${lessons.length} leçon(s) — cliquez sur ✏️ pour éditer.</div>` : '<div class="adm-empty">Aucune leçon pour l\'instant.</div>'}
                ${lessonRows}
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
                        <button class="adm-btn adm-btn-ok" onclick="ADM.lessonSave()">💾 Enregistrer la leçon</button>
                        <button class="adm-btn adm-btn-ghost" onclick="ADM.cancelLesson()">Annuler</button>
                    </div>
                </div>
            </div>`;
    }

    function typeFields(type, d) {
        if (type === 'qcm') {
            const opts = Array.isArray(d.opts) ? d.opts.slice(0, 4) : ['', '', '', ''];
            while (opts.length < 4) opts.push('');
            const correct = Number(d.correct);
            return `
                <div class="adm-field"><label>Question</label>
                    <textarea class="adm-textarea" id="admF_q" rows="2">${esc(d.q || '')}</textarea></div>
                <div class="adm-field"><label>Réponses proposées (cochez la bonne)</label>
                    ${opts.map((o, i) => `
                        <div class="adm-opt-row" style="margin-bottom:6px;">
                            <input type="radio" name="admF_correct" value="${i}" id="admC${i}" ${i === correct ? 'checked' : ''} title="Bonne réponse">
                            <input class="adm-input" id="admF_opt${i}" value="${esc(o)}" placeholder="Réponse ${String.fromCharCode(65 + i)}">
                            ${i === correct ? '<span class="adm-correct-tag">✔ bonne réponse</span>' : ''}
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
            lesson.opts = [0, 1, 2, 3].map(i => val('admF_opt' + i).trim());
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
        const filtered = cat === 'all' ? allItems : allItems.filter(it => it.category === cat);

        const editor = S.editingShopItem ? renderShopItemEditor(S.editingShopItem) : '';

        const itemCards = filtered.map((item) => {
            return `
                <div class="adm-shop-card ${item.disabled ? 'disabled' : ''}">
                    <div class="adm-shop-card-head">
                        <div class="adm-shop-orb" style="--sc:${esc(item.color || '#c8a84b')}">
                            ${item.img ? `<img src="${esc(item.img)}" alt="">` : (item.icon || '✨')}
                        </div>
                        <div class="adm-shop-meta">
                            <div class="adm-shop-title">
                                <b>${esc(item.name)}</b>
                                <span class="adm-badge adm-badge-type">${esc(SHOP_CATEGORY_LABELS[item.category] || item.category)}</span>
                            </div>
                            <div class="adm-shop-cost">🪙 ${item.cost === 0 ? 'Offert' : item.cost + ' pièces'}</div>
                        </div>
                    </div>
                    <p class="adm-shop-desc">${esc(item.desc || 'Aucune description')}</p>
                    <div class="adm-shop-actions">
                        <span class="adm-badge ${item.disabled ? 'adm-badge-admin' : 'adm-badge-eleve'}">${item.disabled ? 'Désactivé' : 'Actif'}</span>
                        <div class="adm-row-actions">
                            <button class="adm-ico-btn" title="Modifier" onclick="ADM.editShopItem('${esc(item.id)}')">✏️ Modifier</button>
                            <button class="adm-ico-btn danger" title="Supprimer" onclick="ADM.deleteShopItem('${esc(item.id)}')">🗑️</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="adm-card">
                <div class="adm-toolbar">
                    <h2 style="margin:0;">🛍️ Gestion de la Boutique <small>${allItems.length} article(s)</small></h2>
                    <button class="adm-btn adm-btn-ok adm-right" onclick="ADM.newShopItem()">+ Ajouter un article</button>
                </div>
                <p class="adm-hint">Personnalisez les prix, l'apparence et ajoutez de nouveaux articles (Halos, Avatars, Titres, Thèmes, Boosters) pour motiver les élèves.</p>

                <!-- Filtres de catégories -->
                <div class="adm-shop-filter-tabs">
                    ${Object.keys(SHOP_CATEGORY_LABELS).map(k => `
                        <button class="adm-shop-filter-btn ${cat === k ? 'active' : ''}" onclick="ADM.setShopCategory('${k}')">
                            ${SHOP_CATEGORY_LABELS[k]} (${k === 'all' ? allItems.length : allItems.filter(i => i.category === k).length})
                        </button>
                    `).join('')}
                </div>

                ${editor}

                <div class="adm-shop-grid">
                    ${itemCards || '<div class="adm-empty" style="grid-column: 1/-1;">Aucun article dans cette catégorie.</div>'}
                </div>

                <div class="adm-toolbar" style="margin-top:20px; border-top: 1px dashed rgba(154,167,216,0.2); padding-top: 14px;">
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.resetShopItems()">🔄 Rétablir la boutique par défaut</button>
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
                                <input class="adm-input" type="color" id="admShopColorPicker" value="${item.color || '#c8a84b'}" style="width:50px; padding:2px; height:38px; cursor:pointer;" onchange="document.getElementById('admShopColor').value = this.value; ADM.updateShopPreview();">
                                <input class="adm-input" id="admShopColor" value="${esc(item.color || '#c8a84b')}" placeholder="#4fd8c4" oninput="document.getElementById('admShopColorPicker').value = this.value; ADM.updateShopPreview();">
                            </div>
                        </div>
                        <div class="adm-field">
                            <label>Chemin de l'image (pour avatar, optionnel)</label>
                            <input class="adm-input" id="admShopImg" value="${esc(item.img || '')}" placeholder="ex: Image/personnages/lovelace.webp" oninput="ADM.updateShopPreview()">
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
                            <div class="adm-shop-orb" id="admPreviewOrb" style="--sc:${item.color || '#c8a84b'}; width:50px; height:50px; margin:0;">
                                ${item.img ? `<img id="admPreviewImg" src="${esc(item.img)}" alt="">` : '<span id="admPreviewIcon">✨</span>'}
                            </div>
                            <div>
                                <div id="admPreviewTitle" style="font-weight:700; color:#fff;">${esc(item.name || 'Nom de l\'article')}</div>
                                <div id="admPreviewCost" style="font-size:12px; color:var(--gold);">🪙 ${item.cost === 0 ? 'Offert' : (item.cost || 50) + ' pièces'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="adm-error" id="admShopErr"></div>
                    <div class="adm-toolbar">
                        <button class="adm-btn adm-btn-ok" onclick="ADM.saveShopItem()">💾 Enregistrer l'article</button>
                        <button class="adm-btn adm-btn-ghost" onclick="ADM.cancelShopItem()">Annuler</button>
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
                    <button class="adm-btn adm-btn-ok" onclick="ADM.rewardsSave()">💾 Enregistrer les récompenses</button>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.rewardsReset()">Rétablir les valeurs par défaut</button>
                </div>

                <!-- Outil de crédit rapide pour tests de la boutique -->
                <div class="adm-card" style="border-color: rgba(102,187,106,0.35); margin-top: 16px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--green); margin-bottom:8px;">💰 Outil de test de l'Économie (Portefeuille Local)</h3>
                    <p class="adm-hint" style="margin-bottom:12px;">Ajoutez des pièces ou de l'XP sur cet appareil pour tester immédiatement les achats en boutique.</p>
                    <div class="adm-toolbar">
                        <button class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(0, 100)">+100 Pièces 🪙</button>
                        <button class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(0, 500)">+500 Pièces 🪙</button>
                        <button class="adm-btn adm-btn-ghost" onclick="ADM.grantPlayerReward(100, 0)">+100 XP ⚡</button>
                        <button class="adm-btn adm-btn-danger adm-right" onclick="ADM.grantPlayerReward(0, 0, true)">Réinitialiser à 30 pièces & 0 XP</button>
                    </div>
                </div>

                <!-- Catalogue des Succès / Badges -->
                <div class="adm-card" style="margin-top: 16px;">
                    <h3 style="font-family:'Cinzel',serif; font-size:15px; color:var(--gold-soft); margin-bottom:8px;">🏆 Succès & Badges Disponibles</h3>
                    <div class="adm-table-wrap">
                        <table class="adm-table">
                            <thead><tr><th>Icône</th><th>Nom du Succès</th><th>Description / Condition</th><th>Statut</th></tr></thead>
                            <tbody>
                                <tr><td>🎯</td><td><b>Premier pas</b></td><td>Réussir sa toute première question de quiz</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                                <tr><td>✨</td><td><b>Sans-faute</b></td><td>Répondre juste du premier coup, sans réessayer</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                                <tr><td>🌐</td><td><b>Touche-à-tout</b></td><td>Terminer au moins une leçon dans chaque matière</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                                <tr><td>🏆</td><td><b>Expert(e)</b></td><td>Terminer toutes les leçons d'une même matière</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                                <tr><td>🎨</td><td><b>Collectionneur</b></td><td>Posséder au moins 3 skins différents dans la boutique</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                                <tr><td>🚀</td><td><b>Étoile montante</b></td><td>Atteindre le niveau 5 du joueur (400+ XP)</td><td><span class="adm-badge adm-badge-eleve">Actif</span></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : MEMBRES ============================== */

    function renderMembers() {
        const me = DB.getCurrentUser();
        const rows = S.members.map(m => {
            const isMe = me && m.email === me.email;
            return `
                <tr>
                    <td>${esc(m.username)} ${isMe ? '<span class="adm-badge adm-badge-you">vous</span>' : ''}</td>
                    <td>${esc(m.email)}</td>
                    <td>${fmtDate(m.created)}</td>
                    <td>
                        <select class="adm-select" ${isMe ? 'disabled title="Vous ne pouvez pas changer votre propre rôle"' : ''}
                            onchange="ADM.setRole('${esc(m.email)}', this.value)">
                            <option value="eleve"${m.role !== 'admin' ? ' selected' : ''}>Élève</option>
                            <option value="admin"${m.role === 'admin' ? ' selected' : ''}>Administrateur</option>
                        </select>
                    </td>
                    <td>
                        <div class="adm-row-actions">
                            <button class="adm-ico-btn" title="Changer le pseudo" onclick="ADM.renameMember('${esc(m.email)}','${esc(m.username)}')">✏️</button>
                            <button class="adm-ico-btn" title="Réinitialiser le mot de passe" onclick="ADM.resetPass('${esc(m.email)}')">🔑</button>
                            <button class="adm-ico-btn danger" title="Supprimer le compte" ${isMe ? 'disabled' : ''} onclick="ADM.deleteMember('${esc(m.email)}','${esc(m.username)}')">🗑</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        const roleBadge = m => m.role === 'admin'
            ? '<span class="adm-badge adm-badge-admin">Admin</span>'
            : '<span class="adm-badge adm-badge-eleve">Élève</span>';

        return `
            <div class="adm-card">
                <h2>👥 Membres <small>comptes du jeu (mode local)</small></h2>
                <div class="adm-note">
                    Les comptes permettent aux élèves de se connecter sur cet appareil (login.html). En mode local,
                    la <b>progression est liée à l'appareil</b>, pas au compte — utilisez « Réglages → Réinitialiser
                    la progression » pour repartir de zéro.
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
                        <div><button class="adm-btn" onclick="ADM.addMember()">Créer le compte</button></div>
                    </div>
                </div>
                <div class="adm-table-wrap" style="margin-top:14px;">
                    <table class="adm-table">
                        <thead><tr><th>Pseudo</th><th>E-mail</th><th>Créé le</th><th>Rôle</th><th></th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="5" class="adm-empty">Aucun compte pour l\'instant.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    /* ============================== ONGLET : RÉGLAGES ============================== */

    function renderSettings() {
        return `
            <div class="adm-card">
                <h2>ℹ️ À propos de l'accès</h2>
                <p class="adm-hint" style="margin:0;">
                    Le panneau s'ouvre <b>sans mot de passe</b> pour l'instant : toute personne qui ouvre
                    <b>admin.html</b> (ou clique sur « 🔐 Administration » depuis la page d'accueil) peut
                    modifier les niveaux, les matières et les comptes de ce navigateur. Réactivez une page de
                    connexion (rôle « admin ») avant une mise en ligne.
                </p>
            </div>

            <div class="adm-card">
                <h2>🗄️ Sauvegarde &amp; restauration de la configuration</h2>
                <p class="adm-hint">Exportez la configuration du panneau (niveaux scolaires + matières + leçons)
                pour la conserver ou l'importer sur un autre poste.</p>
                <div class="adm-toolbar">
                    <button class="adm-btn" onclick="ADM.exportConfig()">⬇️ Exporter</button>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.downloadConfig()">💾 Télécharger (.json)</button>
                </div>
                <textarea class="adm-textarea" id="admExportArea" readonly placeholder="Cliquez sur « Exporter » pour afficher le JSON ici…" rows="5"></textarea>
                <div style="margin-top:10px;">
                    <button class="adm-btn" onclick="ADM.importConfig()">⬆️ Importer</button>
                    <textarea class="adm-textarea" id="admImportArea" placeholder="Collez ici un JSON exporté puis cliquez sur Importer…" rows="5"></textarea>
                </div>
            </div>

            <div class="adm-card">
                <h2 style="color:#ffab91;">☢️ Zone sensible</h2>
                <div class="adm-toolbar">
                    <button class="adm-btn adm-btn-danger" onclick="ADM.resetAdminConfig()">Réinitialiser niveaux &amp; matières</button>
                    <button class="adm-btn adm-btn-danger" onclick="ADM.resetProgress()">Réinitialiser la progression (appareil)</button>
                </div>
                <p class="adm-hint" style="margin-top:8px;">
                    « Réinitialiser niveaux &amp; matières » retire toutes les personnalisations du panneau.
                    « Réinitialiser la progression » efface progression, XP, pièces et badges de CET appareil
                    (les comptes sont conservés). Aucune de ces actions n'est réversible.
                </p>
            </div>`;
    }

    /* ============================== ONGLET : CRÉDITS (v1.20) ============================== */

    function renderCredits() {
        const c = AdminStore.getCredits();
        return `
            <div class="adm-card">
                <h2>✨ Crédits du créateur</h2>
                <p class="adm-hint">Ces informations apparaissent dans le <b>pied de page de toutes les
                pages du jeu</b> et dans la <a href="legal.html" target="_blank"><b>page légale</b></a>
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
                    <div class="adm-field"><label>E-mail de contact (optionnel)</label>
                        <input class="adm-input" id="admCrEmail" type="email" maxlength="200" value="${esc(c.contactEmail)}" placeholder="contact@mon-site.fr"></div>
                    <div class="adm-field"><label>Note complémentaire (optionnelle, infobulle du pied de page)</label>
                        <textarea class="adm-textarea" id="admCrNote" rows="2" maxlength="300" placeholder="Ex. : réalisé dans le cadre d'un projet scolaire…">${esc(c.extraNote)}</textarea></div>
                </div>

                <div class="adm-toolbar">
                    <button class="adm-btn adm-btn-ok" onclick="ADM.creditsSave()">💾 Enregistrer les crédits</button>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.creditsReset()">Rétablir les valeurs par défaut</button>
                </div>
                <p class="adm-hint" style="margin-top:8px;">Après enregistrement, rechargez la page du
                jeu (F5) pour voir les crédits à jour dans le pied de page.</p>
            </div>

            <div class="adm-card">
                <h2>⚖️ Informations légales</h2>
                <p class="adm-hint">Le site est accompagné d'une <a href="legal.html" target="_blank">page
                légale</a> alimentée automatiquement par ces crédits, et d'un <b>bandeau de consentement
                aux cookies</b> (RGPD) affiché à la première visite du site.</p>
                <div class="adm-toolbar">
                    <a class="adm-btn adm-btn-ghost" href="legal.html" target="_blank">Ouvrir la page légale</a>
                    <button class="adm-btn adm-btn-ghost" onclick="ADM.openCookieBanner()">🍪 Afficher le bandeau cookies</button>
                </div>
                <p class="adm-hint" id="admCrConsent" style="margin-top:8px;"></p>
            </div>`;
    }

    /* ============================== ACTIONS — NIVEAUX ============================== */

    const ADM = {
        tab(id) { S.tab = id; renderPanel(); },
        switchGate() { S.gate = S.gate === 'login' ? 'setup' : 'login'; S.err = ''; render(); },

        /* ----- Connexion / premier admin ----- */
        async login() {
            setError('admLoginErr', '');
            const email = (document.getElementById('admLoginEmail') || {}).value || '';
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
            S.authed = true;
            render();
            toast('Bienvenue dans le panneau d\'administration.', 'ok');
        },

        async setupFirst() {
            setError('admSetErr', '');
            const email = (document.getElementById('admSetEmail') || {}).value || '';
            const pseudo = (document.getElementById('admSetPseudo') || {}).value || '';
            const pass = (document.getElementById('admSetPass') || {}).value || '';
            if (!email || !pseudo || !pass) { setError('admSetErr', 'Tous les champs sont requis.'); return; }
            const r = await DB.createLocalMember(email, pseudo, pass, 'admin');
            if (!r.ok) { setError('admSetErr', r.error || 'Création impossible.'); return; }
            const login = await DB.login(email, pass);
            if (!login.ok) { setError('admSetErr', 'Compte créé, mais connexion impossible.'); return; }
            S.authed = true;
            render();
            toast('Administrateur créé. Bienvenue !', 'ok');
        },

        logout() {
            DB.logout();
            S.authed = false;
            S.subjectId = null; S.editingLesson = null; S.lessonDraft = null;
            render();
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
            if (!confirm('Rétablir les niveaux scolaires par défaut (6ème → Terminale) ?')) return;
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
            renderTabContent();
        },
        createSubject() {
            const name = (document.getElementById('admNewName') || {}).value || '';
            const icon = (document.getElementById('admNewIcon') || {}).value || '';
            const r = AdminStore.createCustomSubject(name, icon);
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
            const r = AdminStore.saveSubjectMeta(S.subjectId, { name, icon });
            if (!r.ok) { toast(r.error || 'Enregistrement impossible.', 'err'); return; }
            S.subjectList = [];
            renderTabContent();
            toast('Matière mise à jour ✔', 'ok');
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
        lessonType(type) {
            // Conserve les champs communs (titre, question, explication) quand on change de type
            const d = S.lessonDraft || {};
            const common = { title: d.title, exp: d.exp };
            S.lessonDraft = { type };
            if (type === 'qcm') Object.assign(S.lessonDraft, { q: d.q, opts: ['', '', '', ''], correct: 0 }, common);
            else if (type === 'vrai_faux') Object.assign(S.lessonDraft, { q: d.q, correct: true }, common);
            else if (type === 'reponse_courte') Object.assign(S.lessonDraft, { q: d.q, accepted: [''] }, common);
            else if (type === 'texte_a_trous') Object.assign(S.lessonDraft, { textWithBlanks: d.textWithBlanks || '', blanks: [['']] }, common);
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
            const cost = parseInt((document.getElementById('admShopCost') || {}).value || '0', 10);
            const color = (document.getElementById('admShopColor') || {}).value || '#c8a84b';
            const img = (document.getElementById('admShopImg') || {}).value || '';

            const t = document.getElementById('admPreviewTitle');
            const c = document.getElementById('admPreviewCost');
            const orb = document.getElementById('admPreviewOrb');
            if (t) t.textContent = name;
            if (c) c.textContent = '🪙 ' + (cost === 0 ? 'Offert' : cost + ' pièces');
            if (orb) {
                orb.style.setProperty('--sc', color);
                orb.innerHTML = img ? `<img src="${esc(img)}" alt="">` : '<span>✨</span>';
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
        grantPlayerReward(xp, coins, reset = false) {
            let currentXp = parseInt(DB.getOption('dash_xp') || '0', 10);
            let currentCoins = parseInt(DB.getOption('dash_coins') || '30', 10);
            if (reset) {
                currentXp = 0;
                currentCoins = 30;
                DB.saveOption('dash_xp', '0');
                DB.saveOption('dash_coins', '30');
                toast('Portefeuille local réinitialisé à 30 pièces.', 'ok');
            } else {
                currentXp += xp;
                currentCoins += coins;
                DB.saveOption('dash_xp', String(currentXp));
                DB.saveOption('dash_coins', String(currentCoins));
                toast(`Ajouté avec succès : +${xp} XP et +${coins} pièces !`, 'ok');
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
        async updateProfile() {
            const pseudo = (document.getElementById('admMePseudo') || {}).value || '';
            const pass = (document.getElementById('admMePass') || {}).value || '';
            const patch = {};
            if (pseudo) patch.username = pseudo;
            if (pass) patch.password = pass;
            if (!Object.keys(patch).length) { toast('Rien à enregistrer.', 'err'); return; }
            const r = await DB.updateProfile(patch);
            if (!r.ok) { toast(r.error || 'Modification impossible.', 'err'); return; }
            renderPanel();
            toast('Profil mis à jour ✔', 'ok');
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
            S.subjectList = []; S.subjectId = null; S.levelsDraft = null;
            renderPanel();
            toast('Configuration importée ✔', 'ok');
        },
        resetAdminConfig() {
            if (!confirm('Retirer TOUTES les personnalisations (niveaux, matières, leçons) ?')) return;
            if (!confirm('Confirmez : cette action est irréversible.')) return;
            AdminStore.resetAll();
            S.subjectList = []; S.subjectId = null; S.levelsDraft = null;
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
    };

    window.ADM = ADM;

    /* ============================== HELPERS DE RENDU PARTIEL ============================== */

    /** Re-rend uniquement la zone d'onglet (conserve la coquille). */
    function renderTabContent() {
        const zone = document.getElementById('admTab');
        if (zone) zone.innerHTML = renderTab();
        refreshStats();
    }

    /* ============================== DÉMARRAGE ============================== */

    async function boot() {
        // v1.21.0 — Protection par rôle 'admin' via db.js.
        // 1) Vérifier si la session courante est admin
        const currentUser = (typeof DB !== 'undefined') ? DB.getCurrentUser() : null;
        if (currentUser && currentUser.role === 'admin') {
            S.authed = true;
        } else {
            // 2) Pas de session admin — vérifier s'il existe des admins dans la base
            let admins = [];
            try {
                const res = await DB.listLocalMembers();
                admins = (res.ok && res.data) ? res.data.filter(u => u.role === 'admin') : [];
            } catch {}
            S.gate = admins.length === 0 ? 'setup' : 'login';
            S.authed = false;
            render();
            return;
        }

        try {
            await refreshMembers(); // pour l'onglet Membres (mode local)
        } catch { /* accès localStorage possiblement bloqué */ }

        const modeEl = document.getElementById('admMode');
        if (modeEl) {
            modeEl.textContent = DB.useApi ? 'Mode API SQL' : 'Mode local';
            modeEl.className = 'adm-mode' + (DB.useApi ? ' api' : '');
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
