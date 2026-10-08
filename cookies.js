/* =============================================================================
   COOKIES.JS — EDUQUEST v1.20
   Bandeau de consentement aux cookies (RGPD / CNIL) + mémorisation du choix.

   RÔLE :
   - Au premier chargement d'une page du site, affiche un bandeau permettant
     de TOUT ACCEPTER, CONTINUER SANS ACCEPTER (refus) ou PERSONNALISER les
     cookies optionnels. Le refus est aussi simple que l'acceptation (CNIL).
   - Le choix est enregistré dans localStorage ('eduquest_cookie_consent') et
     n'est plus redemandé pendant 12 mois (ou jusqu'à effacement des données).
   - 100% autonome : aucune dépendance (pas besoin de db.js / app.js / CSS
     externe) — fonctionne sur toutes les pages, styles injectés en JS.

   CATÉGORIES DE TRACEURS :
   - Strictement nécessaires (toujours actives, exemptées de consentement) :
     session de connexion, préférences du jeu, progression, configuration
     administrateur, mémorisation de ce choix de consentement.
   - Optionnelles (désactivées par défaut) : mesure d'audience, marketing.
     Aucun traceur de ces catégories n'est présent dans le code aujourd'hui ;
     le mécanisme est prêt si l'application en ajoute un jour. Avant d'en
     ajouter un, il faut vérifier `EduCookies.getConsent().analytics`.

   API GLOBALE (`EduCookies`, aussi disponible via window.EduCookies) :
     EduCookies.getConsent()               → { choice, analytics, marketing, ts } | null
     EduCookies.setConsent(choice, prefs)  → enregistre + retourne le consentement
     EduCookies.showBanner()               → (ré)affiche le bandeau
     EduCookies.closeBanner()              → masque le bandeau
     EduCookies.isOpen()                   → true si le bandeau est visible

   ÉVÉNEMENTS :
     'eduquest:consent'       (document) — émis à chaque enregistrement d'un choix
     'eduquest:cookie-reopen' (window)   — rouvre le bandeau (utilisé par le
                                           panneau d'administration)
   ============================================================================= */

const EduCookies = (() => {
    'use strict';

    /* -----------------------------------------------------------------------
       CONSTANTES
       ----------------------------------------------------------------------- */

    // Clé localStorage du consentement (12 mois, recommandation CNIL)
    const LS_KEY = 'eduquest_cookie_consent';
    const CHOICES = ['accepted', 'refused', 'custom'];

    /* -----------------------------------------------------------------------
       STYLES (injectés une seule fois — le bandeau n'a besoin d'aucun CSS)
       ----------------------------------------------------------------------- */

    const CSS = `
.eqck-root{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;
  justify-content:center;padding:12px 14px calc(12px + env(safe-area-inset-bottom));
  pointer-events:none;}
.eqck-card{pointer-events:auto;width:min(680px,100%);background:rgba(13,19,48,.96);
  border:1px solid rgba(200,168,75,.45);border-radius:16px;
  box-shadow:0 18px 50px rgba(0,0,0,.55);padding:18px 20px;color:#e9edff;
  font-family:'Rajdhani','Segoe UI',system-ui,sans-serif;font-size:15px;line-height:1.5;
  backdrop-filter:blur(8px);}
.eqck-title{font-family:Cinzel,Georgia,serif;font-weight:700;letter-spacing:1px;
  color:#e6cf8a;font-size:16px;margin-bottom:6px;}
.eqck-text{margin:0 0 12px;color:#c9d3f5;}
.eqck-text a{color:#5fd4e6;}
.eqck-text b{color:#e9edff;}
.eqck-actions{display:flex;flex-wrap:wrap;gap:10px;}
.eqck-btn{font-family:Cinzel,Georgia,serif;font-size:13px;letter-spacing:.5px;
  border-radius:10px;padding:9px 16px;cursor:pointer;
  border:1px solid rgba(200,168,75,.7);
  background:linear-gradient(160deg,#e6cf8a,#c8a84b);color:#1c1607;}
.eqck-btn:hover{filter:brightness(1.08);}
.eqck-btn.refuse{background:transparent;color:#e9edff;border-color:rgba(154,167,216,.5);}
.eqck-btn.refuse:hover{border-color:#e6cf8a;color:#e6cf8a;}
.eqck-btn.ghost{background:transparent;color:#9aa7d8;border-color:rgba(154,167,216,.35);}
.eqck-btn.ghost:hover{color:#e6cf8a;border-color:rgba(200,168,75,.6);}
.eqck-toggles{margin:0 0 12px;display:grid;gap:8px;}
.eqck-toggle{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
  border:1px solid rgba(154,167,216,.25);border-radius:10px;background:rgba(26,37,82,.5);}
.eqck-toggle input{margin-top:3px;accent-color:#c8a84b;width:16px;height:16px;}
.eqck-toggle b{display:block;font-size:14px;}
.eqck-toggle span{font-size:13px;color:#9aa7d8;}
.eqck-toggle.locked{opacity:.75;}
@media (max-width:520px){.eqck-actions .eqck-btn{flex:1 1 auto;text-align:center;}}
`;

    function injectStyles() {
        if (document.getElementById('eqck-style')) return;
        const style = document.createElement('style');
        style.id = 'eqck-style';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    /* -----------------------------------------------------------------------
       LECTURE / ÉCRITURE DU CONSENTEMENT
       ----------------------------------------------------------------------- */

    /** Retourne le consentement enregistré, ou null si aucun choix valide. */
    function readConsent() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return null;
            const c = JSON.parse(raw);
            if (!c || CHOICES.indexOf(c.choice) === -1) return null;
            return {
                choice: c.choice,
                analytics: Boolean(c.analytics),
                marketing: Boolean(c.marketing),
                ts: c.ts || null,
            };
        } catch { return null; } // JSON corrompu ou stockage bloqué → on redemande
    }

    /**
     * Enregistre un consentement.
     * choice : 'accepted' (tout) | 'refused' (nécessaires uniquement) | 'custom'
     * prefs  : { analytics: boolean, marketing: boolean }
     * Émet l'événement document 'eduquest:consent' avec le détail du choix.
     */
    function writeConsent(choice, prefs) {
        if (CHOICES.indexOf(choice) === -1) choice = 'custom';
        const p = prefs && typeof prefs === 'object' ? prefs : {};
        // Cohérence garantie quel que soit l'appelant : « refused » n'active
        // jamais de traceur optionnel, « accepted » les active tous.
        let analytics = Boolean(p.analytics);
        let marketing = Boolean(p.marketing);
        if (choice === 'refused') { analytics = false; marketing = false; }
        else if (choice === 'accepted') { analytics = true; marketing = true; }
        const consent = {
            v: 1,
            choice: choice,
            analytics: analytics,
            marketing: marketing,
            ts: new Date().toISOString(),
        };
        try { localStorage.setItem(LS_KEY, JSON.stringify(consent)); } catch { /* stockage bloqué */ }
        try {
            document.dispatchEvent(new CustomEvent('eduquest:consent', { detail: consent }));
        } catch { /* environnement sans CustomEvent (tests) */ }
        return consent;
    }

    /* -----------------------------------------------------------------------
       BANDEAU
       ----------------------------------------------------------------------- */

    let els = null; // racine actuellement affichée

    function mainHtml() {
        return `
            <div class="eqck-title">🍪 Cookies &amp; confidentialité</div>
            <p class="eqck-text">
                Ce site fonctionne <b>sans cookie publicitaire</b> : seules des données
                <b>strictement nécessaires</b> sont enregistrées sur votre appareil
                (session de connexion, préférences, progression), et <b>rien n'est envoyé
                à un serveur</b>. Vous pouvez accepter les cookies optionnels
                (mesure d'audience), les refuser, ou choisir catégorie par catégorie.
                <a href="legal.html" target="_blank" rel="noopener">Politique de confidentialité</a>
            </p>
            <div class="eqck-actions">
                <button type="button" class="eqck-btn" id="eqckAccept">Tout accepter</button>
                <button type="button" class="eqck-btn refuse" id="eqckRefuse">Continuer sans accepter</button>
                <button type="button" class="eqck-btn ghost" id="eqckCustom">Personnaliser</button>
            </div>`;
    }

    function customizeHtml(saved) {
        const analytics = Boolean(saved && saved.analytics);
        const marketing = Boolean(saved && saved.marketing);
        return `
            <div class="eqck-title">🍪 Vos préférences cookies</div>
            <div class="eqck-toggles">
                <label class="eqck-toggle locked">
                    <input type="checkbox" checked disabled>
                    <span><b>Strictement nécessaires</b><span>Session, préférences, progression et
                    configuration du site. Toujours actives : le site ne peut pas fonctionner sans.
                    Aucune donnée n'est transmise à un serveur.</span></span>
                </label>
                <label class="eqck-toggle">
                    <input type="checkbox" id="eqckAnalytics" ${analytics ? 'checked' : ''}>
                    <span><b>Mesure d'audience</b><span>Statistiques de visite anonymes.
                    Désactivé par défaut — aucun traceur actif actuellement.</span></span>
                </label>
                <label class="eqck-toggle">
                    <input type="checkbox" id="eqckMarketing" ${marketing ? 'checked' : ''}>
                    <span><b>Marketing / publicité</b><span>Contenus ou publicités personnalisés.
                    Désactivé par défaut — aucun traceur actif actuellement.</span></span>
                </label>
            </div>
            <div class="eqck-actions">
                <button type="button" class="eqck-btn" id="eqckSave">Enregistrer mes choix</button>
                <button type="button" class="eqck-btn refuse" id="eqckRefuse2">Tout refuser</button>
                <button type="button" class="eqck-btn ghost" id="eqckBack">‹ Retour</button>
            </div>`;
    }

    function bindBanner(root, view) {
        const q = (sel) => root.querySelector(sel);
        const on = (sel, fn) => { const el = q(sel); if (el) el.addEventListener('click', fn); };

        if (view === 'main') {
            on('#eqckAccept', () => { writeConsent('accepted', { analytics: true, marketing: true }); closeBanner(); });
            on('#eqckRefuse', () => { writeConsent('refused', { analytics: false, marketing: false }); closeBanner(); });
            on('#eqckCustom', () => openBanner({ view: 'custom' }));
        } else {
            on('#eqckSave', () => {
                const a = q('#eqckAnalytics');
                const m = q('#eqckMarketing');
                writeConsent('custom', { analytics: Boolean(a && a.checked), marketing: Boolean(m && m.checked) });
                closeBanner();
            });
            on('#eqckRefuse2', () => { writeConsent('refused', { analytics: false, marketing: false }); closeBanner(); });
            on('#eqckBack', () => openBanner(null));
        }
    }

    /** Construit et affiche le bandeau. opts.view === 'custom' → vue préférences. */
    function openBanner(opts) {
        closeBanner();
        if (!document.body) return;
        injectStyles();

        const view = opts && opts.view === 'custom' ? 'custom' : 'main';
        const saved = view === 'custom' ? (readConsent() || {}) : null;

        const root = document.createElement('div');
        root.className = 'eqck-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Consentement aux cookies');
        // IMPORTANT : le contenu doit être enveloppé dans .eqck-card — c'est
        // cette carte qui rétablit pointer-events:auto (le root parent, lui,
        // est pointer-events:none pour ne pas bloquer la page). Sans ce
        // wrapper, les boutons héritent de pointer-events:none et deviennent
        // inclicables → le bandeau semble « bloqué » sur la page.
        root.innerHTML = '<div class="eqck-card">' + (view === 'custom' ? customizeHtml(saved) : mainHtml()) + '</div>';
        bindBanner(root, view);

        els = { root, view };
        document.body.appendChild(root);
    }

    function closeBanner() {
        if (els && els.root && els.root.remove) els.root.remove();
        els = null;
    }

    /* -----------------------------------------------------------------------
       API PUBLIQUE + DÉMARRAGE
       ----------------------------------------------------------------------- */

    const API = {
        getConsent: readConsent,
        setConsent: writeConsent,
        showBanner: openBanner,
        closeBanner: closeBanner,
        isOpen: () => Boolean(els),
    };
    window.EduCookies = API;

    // Rouverture du bandeau sur demande (panneau d'administration, page légale)
    window.addEventListener('eduquest:cookie-reopen', () => openBanner(null));

    function init() {
        // Bandeau automatique uniquement si aucun choix valide n'est enregistré
        if (!readConsent()) setTimeout(() => openBanner(null), 600);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return API;
})();

// Accessible aussi via window (modules / chargements particuliers)
if (typeof window !== 'undefined') {
    window.EduCookies = EduCookies;
}
