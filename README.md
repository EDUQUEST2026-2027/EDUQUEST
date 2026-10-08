# EDUQUEST — Révision gamifiée (6e → Terminale)

EDUQUEST, un site éducatif accessible et open-source.

Application web française de révision sous forme de jeu : l'élève choisit une
matière, un niveau, répond à des questions de 5 types différents, gagne XP,
pièces et badges, et progresse sur une carte d'îles.

100 % front-end (HTML/CSS/JS), aucune dépendance à installer, fonctionne
hors-ligne en mode local.

---

## 🚀 Démarrage rapide

**Option 1 — double-clic :** ouvrez `index.html` dans un navigateur moderne.
Tout fonctionne immédiatement (comptes, progression et options sont stockés
dans le `sessionStorage` du navigateur).

**Option 2 — petit serveur local (recommandé pour tester le mode API) :**

```bash
cd eduquest-advanced
npx serve .          # ou : python -m http.server 8080
```

Puis ouvrez l'URL affichée (ex. `http://localhost:3000`).

## 🧪 Lancer les tests

91 tests automatisés (Node pur, zéro dépendance) couvrent la banque de
questions, la correction des 5 types de questions, le déterminisme des
générations, la protection XSS du rendu et la couche de configuration du
panneau d'administration (`AdminStore` : niveaux, surcharges, validation des
leçons, export/import, nettoyage des données de jeu) :

```bash
npm test          # ou : node tests/run-tests.js
```

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil (menu → jouer / dashboard / connexion) |
| `admin.html` + `admin.js` + `admin.css` | **Panneau d'administration** : membres, niveaux scolaires, matières et leçons, sans toucher au code |
| `admin-store.js` | Couche de configuration du panneau (niveaux, surcharges de matières/leçons, **crédits de créateur**, export/import) — chargée avant `app.js` sur toutes les pages |
| `jouer.html` | Carte du monde : 9 îles-matières (PNG + SVG), sélecteur de niveau |
| `dashboard.html` | Tableau de bord élève : matières, badges, skins, stats |
| `login.html` | Comptes (local ou SQL) et préférences |
| `app.js` | Cerveau unique : routage par page, HUD, quiz, progression, dashboard (applique les surcharges `AdminStore`) |
| `db.js` | Couche de données : `localStorage` par défaut, API SQL optionnelle |
| `quiz-engine.js` | Moteur de quiz : rendu, events et **correction** des 5 types (QCM, vrai/faux, réponse courte, texte à trous, association) |
| `question-bank.js` | Génération **déterministe** (PRNG semé) des niveaux 6 → 100 |
| `ai-provider.js` | Adaptateur IA : interroge Make s'il est configuré, sinon repli local transparent |
| `schema.sql` | Schéma MySQL de la version serveur (activée via `API_URL` dans `db.js`) |
| `cookies.js` | **Bandeau de consentement cookies (RGPD/CNIL)** : accepter / refuser / personnaliser, choix mémorisé 12 mois (`eduquest_cookie_consent`) |
| `legal.html` | **Mentions légales + politique de confidentialité + politique cookies** (crédits alimentés par `AdminStore.getCredits()`) |
| `global.css` / `style.css` | Thème global et styles de page (+ couche « polish » design) |
| `MAKE_BLUEPRINT.md` | Guide pas-à-pas pour brancher l'agent IA sur Make |
| `tests/run-tests.js` | Harnais de tests (voir ci-dessus) |

Ordre de chargement des `<script>` sur chaque page : **question-bank.js →
quiz-engine.js → ai-provider.js → db.js → app.js** (app.js consomme les quatre
précédents ; ne pas réordonner).

## 🛡️ Panneau d'administration (membres, niveaux, contenus)

Depuis **`admin.html`** (lien discret « 🔐 Administration » en bas à gauche
de `index.html`), un administrateur peut tout gérer sans éditer le code :

- **👥 Membres** — créer des comptes, changer pseudo ou mot de passe,
  promouvoir/rétrograder un membre (rôle `eleve` / `admin`), supprimer un
  compte.
- **🎓 Niveaux scolaires** — ajouter, renommer, réordonner ou supprimer des
  classes (6ème → Terminale par défaut) et choisir la bande de contenu
  (collège / lycée). Les niveaux ajoutés apparaissent sur `jouer.html`.
- **📚 Matières & leçons** — renommer une matière ou changer son icône,
  créer des matières personnalisées, éditer chaque leçon des niveaux écrits
  à la main (5 types de questions : QCM, Vrai/Faux, réponse courte, texte à
  trous, association), en ajouter, supprimer ou réordonner.
- **✨ Crédits** — personnaliser le nom du studio, la baseline, le nom du
  créateur, l'e-mail de contact, le site web et une note libre. Ces textes
  s'affichent en bas de toutes les pages et alimentent automatiquement la
  page `legal.html` (bouton « Rétablir les valeurs par défaut » inclus).
- **⚙️ Réglages** — modifier son profil, exporter/importer la configuration
  (JSON), réinitialiser niveaux/matières ou la progression de l'appareil.

**Accès :** ouvrez `admin.html` (ou cliquez sur « 🔐 Administration » en bas
de `index.html`) — le panneau s'ouvre **directement, sans page de connexion**
pour l'instant. Les modifications sont appliquées immédiatement : il suffit
de recharger la page du jeu pour les voir (les matières personnalisées
apparaissent dans le tableau de bord ; `jouer.html` conserve ses
cartes-îles d'origine).

> ⚠️ L'accès est volontairement ouvert (aucun mot de passe demandé) : toute
> personne qui ouvre le panneau peut modifier la configuration de ce
> navigateur. Les fonctions de connexion par rôle (`admin.js`,
> `renderGate`/`login`) existent et peuvent être réactivées, ou utilisez le
> mode API SQL (`db.js` + `schema.sql`) où les rôles sont gérés côté serveur
> — indispensable avant toute mise en ligne.

## 🤖 Activer le mode IA (questions générées à la demande)

Par défaut, les questions viennent de la banque locale (déterministe).
Pour qu'un agent IA sur [Make](https://make.com) génère chaque question
(unique par élève, correction côté serveur — la bonne réponse ne transite
jamais dans le navigateur) :

1. Suivez **`MAKE_BLUEPRINT.md`** pour créer les deux scénarios
   (*Generate Level* + *Validate Answer*).
2. Collez les deux URLs dans `ai-provider.js` :

```js
const GENERATE_WEBHOOK_URL = 'https://hook.eu2.make.com/xxxxxxxx';
const VALIDATE_WEBHOOK_URL = 'https://hook.eu2.make.com/yyyyyyyy';
```

Le basculement est automatique et **sans risque** : si Make ne répond pas ou
répond mal, le jeu repasse silencieusement en mode local. Tant que les URLs
sont vides, le comportement est exactement celui du mode local.

## 🗃️ Activer la persistance SQL

`db.js` fonctionne en `localStorage` par défaut. Pour brancher le schéma
MySQL (`schema.sql`) : décommentez `API_URL` dans `db.js` et pointez-la vers
un backend implémentant l'API décrite dans les commentaires du fichier
(`/auth/*`, `/users/*`, `/progress/*`, …).

## 🔒 Sécurité — ce qui est fait, ce qui reste

- ✅ **XSS neutralisé** : tout le contenu de question rendu en HTML (énoncés,
  options, items, cibles, badges, explications) passe par l'échappement
  `esc()`/`escapeHtml()`. Vérifié par des tests (`npm test`).
- ✅ **Mode IA sûr par conception** : la correction se fait côté serveur
  (scénario #2), la bonne réponse n'arrive jamais dans le navigateur avant la
  réponse de l'élève.
- ⚠️ **Comptes locaux en clair** : le mode localStorage n'est PAS sécurisé
  (pseudonyme/progression manipulables via la console). C'est acceptable pour
  une démo ou un usage en classe non connectée ; pour toute mise en ligne,
  activez le mode SQL/API (`db.js` + `schema.sql`).

## ⚖️ Conformité — cookies & informations légales

Le site est conforme aux obligations d'information et de consentement
(RGPD / loi Informatique et Libertés / recommandations CNIL) :

- **Bandeau de consentement** (`cookies.js`, présent sur les 8 pages) :
  au premier passage, l'utilisateur choisit **Tout accepter**,
  **Continuer sans accepter** ou **Personnaliser** (mesure d'audience et
  marketing, désactivés par défaut). Le choix est mémorisé 12 mois dans
  `localStorage` (`eduquest_cookie_consent`) et peut être modifié à tout
  moment via le lien « Cookies » en bas de page (ou « Gérer mes cookies »
  sur `legal.html`).
- **Page `legal.html`** : mentions légales (éditeur, hébergeur, contact),
  politique de confidentialité (données stockées, finalités, durée,
  droits RGPD) et politique cookies (catégories, consentement, retrait).
  Les crédits affichés (éditeur, contact, site) sont alimentés par
  l'onglet **Crédits** du panneau d'administration.
- **Traceurs optionnels** : aucun n'est actif par défaut ; les cases
  correspondantes du bandeau servent d'emplacement prêt pour un futur
  outil de mesure d'audience (à ne brancher qu'après consentement).

> ℹ️ Le document `legal.html` est un modèle sérieux mais générique : avant
> mise en ligne, complétez l'éditeur (via le panneau, onglet Crédits),
> l'hébergeur et les coordonnées du responsable de traitement, et faites
> valider le tout si vous traitez des données sensibles.

## 🎨 Personnaliser le design

- **Responsive mobile (v1.21)** : toutes les pages (niveaux, matières, quiz,
  dashboard) **et le panneau d'administration** sont utilisables sur téléphone
  (testé à 360/390px de large). Les correctifs mobiles sont regroupés à la fin
  de `global.css`, de `style.css` (bloc « DERNIER MOT RESPONSIVE ») et de
  `admin.css` — y ajouter tout nouveau correctif pour qu'il prenne le dessus.
- Thème et variables de couleurs : début de `global.css` (tokens CSS).
- Couche « polish » (animations, cartes, boutons, modales) : bloc
  `POLISH — DESIGN` à la fin de `style.css` et `global.css`.
- Le logo et les images (`Image/`, `fonts/`, `Musique/`) ne sont pas touchés
  par cette couche.

## 📦 Contenu du paquet

Pages jouables (`index/jouer/dashboard/login/options`), panneau
d'administration (`admin.html`) avec gestion des crédits, page légale
(`legal.html`), bandeau de consentement cookies (`cookies.js`), moteur de
quiz, banque de questions (6e → Terminale, 10 matières au dashboard — dont
la Chimie, matière à part entière — et 9 îles sur la carte du monde), tests
automatisés, documentation (README + MAKE_BLUEPRINT), schéma SQL. Dossier
`Exemple/` = ancien prototype conservé pour référence, non chargé par le jeu.
