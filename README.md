# EDUQUEST — Révision gamifiée (Collège, Lycée & BTS · v1.30.0)

Application web française d'apprentissage et de révision sous forme d'aventure spatiale et ludique : l'élève choisit sa **classe** (6e → Terminale, BTS 1 & 2) et, dès le lycée, sa **filière** parmi **18 voies officielles filtrées par niveau d'études** (6 en 2nde, 15 en 1ère/Terminale, 4 en BTS 1 & 2), explore les **43 îles du savoir** conformes au programme officiel (dont **Allemand** dès la 6e jusqu'au BTS 2), répond à des quiz variés (6 types interactifs), accomplit des missions quotidiennes, gagne de l'XP, des pièces et **79 succès**, et personnalise son avatar dans une boutique de **98 articles** (100 % icônes & illustrations **SVG** sur thème unifié *Astral & Or*).

100 % front-end (HTML5 / CSS3 / JavaScript Vanilla), sans dépendance externe obligatoire, optimisée PC & smartphone et fonctionnelle 100 % hors-ligne en mode PWA/local.

---

## 🚀 Démarrage rapide

**Option 1 — Double-clic direct :** ouvrez `index.html` dans un navigateur moderne.
Tout fonctionne immédiatement (comptes, classe, filière, progression, quêtes, boutique, succès et options sont stockés localement dans `localStorage`, isolés par compte).

**Option 2 — Serveur local (recommandé pour tester le Service Worker et la PWA) :**

```bash
npx serve .          # ou : python -m http.server 8080
```

Puis ouvrez l'URL affichée (ex. `http://localhost:8080`).

---

## ✨ Fonctionnalités clés (v1.30.0)

- **🧭 18 Filières officielles strictement cohérentes par niveau & 9 Classes (6e → BTS 2) :**
  - **Collège (6e → 3e — tronc commun, sans filière) :** Mathématiques, Français, Histoire, Géographie, EMC, Anglais, **Allemand (LV1 / bilangue / LV2 dès la 6e)**, **Espagnol LV2** (dès la 5e), SVT, Physique, Chimie, Technologie, **Arts & Musique**.
  - **2nde (6 voies accessibles dès la Seconde) :** **Voie Générale**, **STHR**, **S2TMD**, **CIEL**, **Bac Pro MELEC**, **Bac Pro ASSP**. *(Les spécialités strictement de 1ère/Terminale comme HGGSP, HLP, LLCE, Agronomie, SPCL, Mercatique et les filières BTS pures sont masquées en 2nde.)*
  - **1ère & Terminale (15 voies Lycée Général, Technologique & Pro — zéro filière BTS pure) :**
    - **Voie Générale :** Tronc commun + SES, NSI & Numérique, **HGGSP** (1ère/Tle), **Sciences de l'Ingénieur**, **HLP** (1ère/Tle), **LLCE** (1ère/Tle), Philosophie (Tle).
    - **Spécialité NSI (1ère/Tle) :** NSI & Numérique, **Développement & BDD**, **Cybersécurité**, **Réseaux & Systèmes**, SIN, Sciences de l'Ingénieur + tronc commun scientifique.
    - **HLP / LLCE (1ère/Tle) :** **Humanités & Littérature (HLP)**, **LLCE**, **HGGSP**, Philosophie (Tle), Arts & Musique, langues vivantes (Anglais, **Allemand**, Espagnol).
    - **Spécialités Maths & Sciences (1ère/Tle) :** Mathématiques, Physique, Chimie, SVT, Sciences de l'Ingénieur, **SPCL**, **Biopathologie**, NSI.
    - **STMG (1ère/Tle) :** **Management & Gestion (MSGN)**, **Droit & Économie**, **Mercatique**, **Comptabilité**, **Commerce**, **RH & Comm** + tronc commun.
    - **STI2D (1ère/Tle) :** **I2D (Innovation & Dév. Durable)**, **SIN (Info & Numérique)**, **Architecture & Habitat**, **Électrotechnique**, **Électronique & Systèmes**, Sciences de l'Ingénieur + tronc commun.
    - **ST2S (1ère/Tle) :** **STSS (Santé & Social)**, **Biologie & Physiopathologie (BPH)**, **Biotechnologies**, SVT, Chimie, **PSE** + tronc commun.
    - **STL (1ère/Tle) :** **Biotechnologies & Labo**, **SPCL (Sciences & Chimie de Labo)**, **Biopathologie**, Physique, Chimie, SVT + tronc commun.
    - **STD2A (1ère/Tle) :** **Design & Arts Appliqués**, **Architecture & Habitat**, Arts & Musique, **I2D**, **Arts de la Scène** + tronc commun.
    - **STHR (2nde → Tle) :** **Hôtellerie & Gastronomie**, Management (MSGN), Droit & Économie, Mercatique (1ère/Tle), Commerce, Comptabilité, RH & Comm, PSE + langues vivantes.
    - **STAV (1ère/Tle) :** **Agronomie & Écologie**, SVT, Biotechnologies, Chimie, I2D, Architecture & Habitat, PSE + tronc commun.
    - **S2TMD (2nde → Tle) :** **Arts de la Scène & Culture (Théâtre, Musique & Danse)**, Arts & Musique, Design, HLP/LLCE/HGGSP (1ère/Tle) + tronc commun.
    - **Bac Pro MELEC (2nde → Tle) :** **Électrotechnique & Énergie**, **Électronique & Systèmes**, SIN, Réseaux, Architecture & Habitat, I2D, PSE + tronc commun.
    - **Bac Pro ASSP (2nde → Tle) :** **STSS (Santé & Social)**, **Biologie & Physiopathologie**, **Biotechnologies & Labo**, PSE, SVT, Chimie + tronc commun.
  - **BTS 1 & BTS 2 (4 voies Post-Bac — zéro matière strictement lycée comme Philo, SES, HGGSP, SVT, Chimie ou PSE) :**
    - **CIEL (Bac Pro 2nde→Tle & BTS 1/2) :** **Cybersécurité**, **Réseaux & Systèmes**, **Électronique & Systèmes**, **Développement & BDD**, SIN, NSI, Physique appliquée, Droit & Économie (CEJM) + Maths BTS / Français (CGE) / Anglais / **Allemand** / Espagnol.
    - **BTS SIO (SLAM / SISR) :** **Développement & BDD**, **Cybersécurité**, **Réseaux & Systèmes**, NSI, SIN, Management (CEJM), Droit & Économie (CEJM), RH & Comm + tronc commun BTS.
    - **BTS MCO :** **Relation Client & Commerce**, **Mercatique**, Management (MSGN), Droit & Économie (CEJM), Comptabilité, RH & Comm + tronc commun BTS.
    - **BTS CG :** **Comptabilité & Finance**, Management (MSGN), Droit & Économie (CEJM), Mercatique, SI Comptable & SQL (**Dév/BDD**), Commerce, RH & Comm + tronc commun BTS.
  - **Filtrage intelligent & cohérence automatique :** Sélecteurs Classe & Filière filtrés dynamiquement dans le tableau de bord, les Options et le panneau admin (`AdminStore.getFilieresForNiveau` & `resolveFiliereForNiveau`), onglets rapides (*Toutes / ★ Spécialités / Tronc commun*) et mise en avant automatique des spécialités phares.
- **🏝️ 43 Îles flottantes illustrées 100 % SVG (100 niveaux chacune) :**
  - Chaque matière (dont la nouvelle île **Allemand** — Porte de Brandebourg & bannière dorée `Image/ile/allemand.svg`) dispose de son île **100 % SVG** (*Astral & Or*) pré-cachée hors-ligne dans `service-worker.js`, de leçons socles variées et d'un générateur procédural déterministe jusqu'à 100 niveaux (conjugaison, déclinaisons Accusatif/Datif/Génitif, Perfekt `haben`/`sein`, syntaxe et allemand professionnel BTS pour l'Allemand).
- **🛍️ Boutique riche (98 articles), 27 Avatars SVG, 16 Thèmes & 5 Boosters fonctionnels :**
  - **24 Auras & Halos**, **27 Personnages 100 % SVG**, **26 Titres honorifiques** (équipables et retirables en un clic), **16 Thèmes visuels CSS** (`default` + 15 thèmes `[data-theme="..."]` retirables vers le thème d'origine) et **5 Potions / Boosters** actifs en jeu :
    - 🧪 **Potion Double XP** (`boost-xp`) : double l'XP du prochain niveau réussi.
    - 🛡️ **Bouclier d'Étoile** (`boost-shield`) : absorbe la 1re erreur et préserve série + 3 étoiles.
    - 🪙 **Élixir de Fortune** (`boost-coins`) : double les pièces du prochain niveau réussi.
    - ⏳ **Sablier Temporel** (`boost-time`) : ajoute **+15 s** au chronomètre dès le démarrage d'un quiz.
    - 🔥 **Flamme Éternelle** (`boost-combo`) : protège la série et le combo actifs en cas d'erreur (jamais gaspillée à 0).
- **🏆 79 Succès (Badges) filtrés et triés par filière :**
  - Inclut le succès **Germanophone** (niveau 5 en Allemand) ainsi que les badges universels et par filière, avec bouton *« Tout voir »* et filtres par statut/tri.
- **🔥 Série vs ⚡ Énergie Combo (zéro ambiguïté) :**
  - **🔥 Série (pastille feu) :** nombre de niveaux réussis consécutivement.
  - **⚡ Énergie Combo (pastille électrique) :** enchaînement de bonnes réponses et multiplicateur dynamique d'XP et de score (**x1.0** à **x2.5**).
- **🤖 Moteur adaptatif local anti-répétition & Pool Multi-IA :**
  - **Anti-répétition renforcée (`js/core/adaptive-engine.js` & `js/question-bank.js`) :** mémoire de **240 questions vues** par matière/classe, rotation FIFO par ancienneté, vivier minimal par cycle (sans jamais mélanger collège et lycée), génération paresseuse (*lazy*) des variantes et reset vers une question différente après chaque échec.
  - **Pool Multi-IA (`js/ai-provider.js`) :** prise en charge optionnelle de plusieurs fournisseurs IA (Make.com, API compatibles OpenAI/Mistral/Groq/Ollama, Google Gemini) avec bascule en cascade et repli local 100 % hors-ligne.
- **📱 Expérience PC & mobile soignée, épurée et accessible :**
  - Interface sans bouton plein écran ni réinitialisation accidentelle de progression côté élève (la réinitialisation d'un compte reste exclusivement réservée à la modération dans `admin.html`).
  - Hitboxes de boutons fiabilisées (`pointer-events: none` sur tous les décors), cases Options accessibles au clavier (`Tab` + `Espace`), **bandeau du bas fermable**, **missions quotidiennes repliables**, **confettis calibrés** et croix `✕` sur toutes les modales.
- **📝 6 Types de questions & Indice pédagogique 💡 :** QCM (choix mélangés), Vrai/Faux, Réponse courte (tolérance orthographique Levenshtein), Texte à trous (`___` ou `[___]`, banque de mots cliquables), Texte à choix déroulant (`<select>`) et Association (Drag & Drop en 2 clics avec désélection et retrait de paire).
- **🔊 Gestionnaire audio global (`js/core/audio-manager.js`) :** musique continue inter-pages (6 pistes locales), coupure manuelle strictement persistée, intégration sans chevauchement dans l'en-tête (`map.html`, `legal.html`) et bruitages Web Audio synthétisés.
- **⏱️ Chronomètre unifié (`js/core/quiz-timer.js`) & Anti-triche étoiles :** compte à rebours à horloge réelle (`Date.now`) avec cache DOM optimisé sur tous les exercices et réessais ; erreurs persistées par niveau.
- **🛡️ Pilotage intégral Admin (`admin.html`) :** membres (avec filtrage classe↔filière cohérent), 9 niveaux, 18 filières (avec niveaux autorisés éditables par pilules), 43 matières (préservation des saisies lors des clics sur pilules, aperçu procédural sur niveau valide), boutique (98 articles), 79 succès, pool de 9 quêtes quotidiennes, feature flags globaux, Multi-IA, export/import JSON sécurisé (redaction des clés API par défaut) et crédits.
- **🔒 Respect de la vie privée & RGPD :** zéro publicité, zéro traceur tiers, bandeau cookies conforme CNIL (`js/cookies.js`, réouverture en place sans quitter la page), purge intégrale à la suppression de compte et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture & Organisation des fichiers

```text
├── index.html, dashboard.html, map.html, admin.html, legal.html, test.html
├── service-worker.js, manifest.webmanifest, robots.txt, sitemap.xml, llms.txt, schema.sql, package.json
├── css/    → global.css, style.css, quests.css, admin.css
├── fonts/  → Silkscreen (.woff2 / .ttf)
├── Image/  → logo.svg, ile/ (43 îles 100 % SVG dont allemand.svg), personnages/ (27 avatars 100 % SVG)
├── Musique/→ music1.mp3 … music6.mp3
├── js/     → app.js, db.js, quiz-engine.js, question-bank.js, admin.js, admin-store.js, ai-provider.js, cookies.js
│   ├── core/     → icons.js, audio-manager.js, quiz-timer.js, adaptive-engine.js, game-rules.js, quiz-session.js
│   └── features/ → daily-quests.js
├── docs/   → ARCHITECTURE.md, GUIDE_CONTRIBUTION.md, API_PERSISTENCE.md
└── tests/  → Suite complète de tests unitaires Node.js sur 12 fichiers
```

| Fichier / Dossier | Rôle |
|---|---|
| `index.html` | Accueil : menu principal, modales Options (classe, 18 filières filtrées par niveau, audio, particules, apparence), Connexion & Quitter |
| `dashboard.html` | Tableau de bord élève : sélecteurs classe & filière cohérents, HUD Série/Combo, missions repliables, 43 matières, boutique (98 articles), 79 succès |
| `map.html` | Carte interactive d'une matière : parcours 1 → 100, sélecteur d'avatar, badge classe/filière, expulsion hors programme, quiz |
| `admin.html` | **Panneau d'administration unifié** : membres, 9 niveaux, 18 filières + niveaux autorisés, 43 matières, leçons, boutique, 79 succès, quêtes, Multi-IA & crédits |
| `legal.html` | Mentions légales, politique de confidentialité RGPD et gestion des cookies |
| `test.html` | **Banc de tests navigateur autonome** : 13 suites QA, benchmark et test interactif |
| `js/core/icons.js` | Bibliothèque unifiée de 70+ icônes SVG duotone (*Astral & Or*, `window.EduIcons`) |
| `js/app.js` | Contrôleur principal, vues, apparence, particules, HUD Série/Combo, boutique (équipement/retrait), 79 succès, confettis Canvas calibrés |
| `js/db.js` | Persistance isolée par compte (`localStorage` / API SQL optionnelle) : classe, filière, progression, boosters, tentatives anti-triche |
| `js/quiz-engine.js` | Rendu et validation des 6 types de questions (`___`/`[___]`, Levenshtein, drag & drop réversible sans collision) |
| `js/question-bank.js` | Banque officielle des 43 matières (dont Allemand complet) + générateurs procéduraux déterministes (Collège, Lycée & BTS) |
| `js/core/audio-manager.js` | Audio global continu inter-pages, respect de coupure manuelle, placement adaptatif en en-tête et bruitages SFX Web Audio |
| `js/core/quiz-timer.js` | Chronomètre unifié à horloge réelle (`Date.now`) avec cache DOM optimisé sur tous les exercices et réessais |
| `js/core/adaptive-engine.js` | Moteur adaptatif local : mémoire de 240 questions, rotation FIFO, reset sur échec, paliers de difficulté |
| `js/core/game-rules.js` | Règles de jeu pures partagées (étoiles, 5 boosters, combos, barèmes, multiplicateurs) |
| `js/core/quiz-session.js` | Pipeline unifié de soumission des quiz, anti-triche et consommation sécurisée des boosters |
| `js/features/daily-quests.js` | Quêtes journalières déterministes (PRNG Mulberry32, tirage Fisher-Yates, renouvellement minuit, pool pilotable admin) |
| `js/ai-provider.js` | Orchestrateur Multi-IA (Make, OpenAI-compatible, Gemini) avec bascule en cascade et repli local |
| `js/admin-store.js` | Catalogue central : 9 niveaux, 18 filières + `allowedNiveaux`, règles officielles des 43 matières, 98 articles boutique, 79 badges, 9 quêtes |
| `js/admin.js` | Interface du panneau d'administration (pilotage intégral, cohérence classe↔filière, niveaux par filière) |
| `js/cookies.js` | Bandeau de consentement RGPD/CNIL avec fermeture rapide (mémorisation 12 mois) |
| `service-worker.js` | PWA `eduquest-cache-v1.30.1` (**94 ressources 100 % SVG pré-cachées**, 100 % hors-ligne) |
| `schema.sql` | Schéma SQL complet (MySQL 8.0 / MariaDB / PostgreSQL / SQLite : 43 matières SVG + 18 filières cohérentes) |
| `docs/` | Guides techniques : [Architecture](docs/ARCHITECTURE.md), [Guide de contribution](docs/GUIDE_CONTRIBUTION.md), [Persistance](docs/API_PERSISTENCE.md) |

---

## 🧪 Validation & Tests Automatisés

```bash
# Exécuter la suite complète de tests unitaires Node.js
node --test tests/*.test.js

# Contrôle statique de syntaxe des 16 modules JS
npm run check
```

*(Les commandes `npm test` et `npm run check` sont également définies dans `package.json`.)*

---

## 🗃️ Persistance SQL (Mode Serveur optionnel)

1. Exécutez `schema.sql` sur votre serveur MySQL/MariaDB.
2. Configurez `API_URL` dans `js/db.js` (voir [docs/API_PERSISTENCE.md](docs/API_PERSISTENCE.md)).
