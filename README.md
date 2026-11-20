# EDUQUEST — Révision gamifiée (Collège, Lycée & BTS · v1.29.1)

Application web française d'apprentissage et de révision sous forme d'aventure spatiale et ludique : l'élève choisit sa **classe** (6e → Terminale, BTS 1 & 2) et, dès le lycée, sa **filière** parmi **18 voies officielles** (Générale, Spécialités NSI / HLP-LLCE / Maths-Sciences, STMG, STI2D, CIEL, ST2S, STL, STD2A, STHR, STAV, S2TMD, BTS SIO / MCO / CG, Bac Pro MELEC / ASSP), explore les **36 îles du savoir** conformes au programme officiel, répond à des quiz variés (6 types interactifs), accomplit des missions quotidiennes, gagne de l'XP, des pièces et **78 succès**, et personnalise son avatar dans une boutique de **97 articles**.

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

## ✨ Fonctionnalités clés (v1.29.1)

- **🧭 18 Filières officielles & 9 Classes (6e → BTS 2) :**
  - **Collège (6e → 3e) :** Mathématiques, Français, Histoire, Géographie, EMC, Anglais, **Espagnol LV2** (dès la 5e), SVT, Physique, Chimie, Technologie, **Arts & Musique**.
  - **Voies Générales :**
    - **Voie Générale :** Tronc commun + SES, NSI & Numérique, **HGGSP** (1ère/Tle), **Sciences de l'Ingénieur**, **HLP** (1ère/Tle), Philosophie (Tle).
    - **Spécialité NSI :** NSI & Numérique, **Développement & BDD**, **Cybersécurité**, **Réseaux & Systèmes**, Sciences de l'Ingénieur + tronc commun scientifique.
    - **HLP / LLCE (Humanités, Lettres & Langues) :** **Humanités & Littérature (HLP)**, **HGGSP**, Philosophie, Arts & Musique, langues vivantes.
    - **Spécialités Maths & Sciences (PC/SVT) :** Mathématiques, Physique, Chimie, SVT, Sciences de l'Ingénieur.
  - **Séries Technologiques :**
    - **STMG :** **Management & Gestion (MSGN)**, **Droit & Économie**, **Mercatique** (1ère → BTS) + tronc commun.
    - **STI2D :** **I2D (Innovation & Dév. Durable)**, **SIN (Info & Numérique)**, **Électronique & Systèmes**, Sciences de l'Ingénieur, NSI + tronc commun.
    - **ST2S :** **STSS (Santé & Social)**, SVT, Physique, Chimie + tronc commun.
    - **STL :** **Biotechnologies & Labo**, Physique, Chimie, SVT + tronc commun.
    - **STD2A :** **Design & Arts Appliqués**, Arts & Musique, Physique-Chimie + tronc commun.
    - **STHR :** **Hôtellerie & Gastronomie**, Management (MSGN), Droit & Économie, Mercatique + tronc commun.
    - **STAV :** **Agronomie & Écologie**, SVT, Physique, Chimie + tronc commun.
    - **S2TMD :** **Arts de la Scène & Culture (Théâtre, Musique & Danse)**, Arts & Musique + tronc commun.
  - **Voies Professionnelles & BTS (Post-Bac) :**
    - **CIEL (Bac Pro / BTS 1 & 2) :** **Cybersécurité**, **Réseaux & Systèmes**, **Électronique & Systèmes**, NSI & Numérique, Droit & Économie + Maths BTS / Physique / Anglais / Français.
    - **BTS SIO (SLAM / SISR) :** **Développement & BDD**, **Cybersécurité**, **Réseaux & Systèmes**, NSI, Management, Droit & Économie + tronc commun BTS.
    - **BTS MCO :** **Relation Client & Commerce**, **Mercatique**, Management (MSGN), Droit & Économie + tronc commun BTS.
    - **BTS CG :** **Comptabilité & Finance**, Management (MSGN), Droit & Économie + tronc commun BTS.
    - **Bac Pro MELEC :** **Électrotechnique & Énergie**, **Électronique & Systèmes**, SIN, Physique + tronc commun.
    - **Bac Pro ASSP :** **STSS (Santé & Social)**, **Biotechnologies & Labo**, SVT, Chimie + tronc commun.
  - **Filtrage intuitif :** Sélecteurs Classe & Filière dans le tableau de bord et les Options, bandeau récapitulatif du programme officiel, onglets rapides (*Toutes / ★ Spécialités / Tronc commun*) et mise en avant automatique des spécialités phares.
- **🏝️ 36 Îles flottantes illustrées (100 niveaux chacune) :**
  - Chaque matière dispose de sa propre île flottante (**29 SVG vectoriels + 7 WebP**) pré-cachée hors-ligne dans `service-worker.js`, d'exercices socles variés et d'une extension procédurale jusqu'à 100 niveaux.
- **🛍️ Boutique riche (97 articles), 27 Avatars, 15 Thèmes & 5 Boosters fonctionnels :**
  - **24 Auras & Halos**, **27 Personnages** (17 SVG vectoriels + 10 WebP : savants, figures historiques & pop-culture), **26 Titres honorifiques**, **15 Thèmes visuels CSS** (`default` + 14 thèmes `[data-theme="..."]`) et **5 Potions / Boosters** actifs en jeu :
    - 🧪 **Potion Double XP** (`boost-xp`) : double l'XP du prochain niveau réussi.
    - 🛡️ **Bouclier d'Étoile** (`boost-shield`) : absorbe la 1re erreur et préserve série + 3 étoiles.
    - 🪙 **Élixir de Fortune** (`boost-coins`) : double les pièces du prochain niveau réussi.
    - ⏳ **Sablier Temporel** (`boost-time`) : ajoute **+15 s** au chronomètre dès le démarrage d'un quiz.
    - 🔥 **Flamme Éternelle** (`boost-combo`) : protège la série et le combo actifs en cas d'erreur (jamais gaspillée à 0).
- **🏆 78 Succès (Badges) filtrés et triés par filière :**
  - Chaque élève voit par défaut les succès universels et ceux de sa classe/filière, avec un bouton *« Tout voir »* et des filtres par statut/tri.
- **🔥 Série vs ⚡ Énergie Combo (zéro ambiguïté) :**
  - **🔥 Série (pastille feu) :** nombre de niveaux réussis consécutivement.
  - **⚡ Énergie Combo (pastille électrique) :** enchaînement de bonnes réponses et multiplicateur dynamique d'XP et de score (**x1.0** à **x2.5**).
- **🤖 Moteur adaptatif local anti-répétition & Pool Multi-IA :**
  - **Anti-répétition renforcée (`js/core/adaptive-engine.js` & `js/question-bank.js`) :** mémoire de **240 questions vues** par matière/classe, rotation FIFO par ancienneté, vivier minimal par cycle (sans jamais mélanger collège et lycée), génération paresseuse (*lazy*) des variantes et reset vers une question différente après chaque échec.
  - **Pool Multi-IA (`js/ai-provider.js`) :** prise en charge optionnelle de plusieurs fournisseurs IA (Make.com, API compatibles OpenAI/Mistral/Groq/Ollama, Google Gemini) avec bascule en cascade et repli local 100 % hors-ligne.
- **📱 Expérience mobile soignée & accessible :**
  - **Bandeau du bas fermable / rouvrable**, **missions quotidiennes compactes et repliables**, **confettis calibrés** (anti-spam `1,8 s` + respect des options *Particules*, *Mode Éco* et *Animations*), croix `✕` sur toutes les modales et le bandeau cookies.
- **📝 6 Types de questions & Indice pédagogique 💡 :** QCM (choix mélangés), Vrai/Faux, Réponse courte (tolérance orthographique Levenshtein), Texte à trous (`___` ou `[___]`, banque de mots cliquables), Texte à choix déroulant (`<select>`) et Association (Drag & Drop en 2 clics sans collision de cibles).
- **🔊 Gestionnaire audio global (`js/core/audio-manager.js`) :** musique continue inter-pages (6 pistes locales), coupure manuelle strictement persistée et bruitages Web Audio synthétisés.
- **⏱️ Chronomètre unifié (`js/core/quiz-timer.js`) & Anti-triche étoiles :** compte à rebours fiable à horloge réelle (`Date.now`) sur tous les exercices et réessais ; erreurs persistées par niveau.
- **🛡️ Pilotage intégral Admin (`admin.html`) :** membres, 9 niveaux, 18 filières, 36 matières, leçons manuelles & aperçu procédural, boutique (97 articles), 78 succès, pool de 9 quêtes quotidiennes, feature flags globaux (maintenance, boutique, quêtes, badges, chrono, confettis), Multi-IA, export/import JSON et crédits.
- **🔒 Respect de la vie privée & RGPD :** zéro publicité, zéro traceur tiers, bandeau cookies conforme CNIL (`js/cookies.js`) et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture & Organisation des fichiers

```text
├── index.html, dashboard.html, map.html, admin.html, legal.html, test.html
├── service-worker.js, manifest.webmanifest, robots.txt, sitemap.xml, llms.txt, schema.sql, package.json
├── css/    → global.css, style.css, quests.css, admin.css
├── fonts/  → PressStart2P & Silkscreen (.woff2 / .ttf)
├── Image/  → logo.webp, ile/ (36 îles : 29 SVG + 7 WebP), personnages/ (27 avatars : 17 SVG + 10 WebP)
├── Musique/→ music1.mp3 … music6.mp3
├── js/     → app.js, db.js, quiz-engine.js, question-bank.js, admin.js, admin-store.js, ai-provider.js, cookies.js
│   ├── core/     → audio-manager.js, quiz-timer.js, adaptive-engine.js, game-rules.js, quiz-session.js
│   └── features/ → daily-quests.js
├── docs/   → ARCHITECTURE.md, GUIDE_CONTRIBUTION.md, API_PERSISTENCE.md
└── tests/  → 109 tests unitaires Node.js sur 11 suites
```

| Fichier / Dossier | Rôle |
|---|---|
| `index.html` | Accueil : menu principal aligné, modales Options (classe, 18 filières, audio, particules, apparence), Connexion & Quitter |
| `dashboard.html` | Tableau de bord élève : sélecteurs classe & filière, HUD 🔥/⚡, missions repliables, 36 matières, boutique (97 articles), 78 succès |
| `map.html` | Carte interactive d'une matière : parcours 1 → 100, sélecteur d'avatar, badge classe/filière, expulsion hors programme, quiz |
| `admin.html` | **Panneau d'administration unifié** : membres, 9 niveaux, 18 filières, 36 matières, leçons, boutique, 78 succès, quêtes, Multi-IA & crédits |
| `legal.html` | Mentions légales, politique de confidentialité RGPD et gestion des cookies |
| `test.html` | **Banc de tests navigateur autonome** : 13 suites QA, benchmark et test interactif |
| `js/app.js` | Contrôleur principal, vues, apparence, particules, HUD 🔥/⚡, boutique, 78 succès, confettis Canvas calibrés |
| `js/db.js` | Persistance isolée par compte (`localStorage` / API SQL optionnelle) : classe, filière, progression, boosters, tentatives anti-triche |
| `js/quiz-engine.js` | Rendu et validation des 6 types de questions (`___`/`[___]`, Levenshtein, drag & drop sans collision) |
| `js/question-bank.js` | Banque officielle des 36 matières + générateurs procéduraux (dont Maths BTS, STMG, STI2D, CIEL, STL, STD2A, STHR, STAV, S2TMD, HLP, SIO, MCO, CG, MELEC, ASSP) |
| `js/core/audio-manager.js` | Audio global continu inter-pages, respect de coupure manuelle, bruitages SFX Web Audio |
| `js/core/quiz-timer.js` | Chronomètre unifié à horloge réelle (`Date.now`) sur tous les exercices et réessais |
| `js/core/adaptive-engine.js` | Moteur adaptatif local : mémoire de 240 questions, rotation FIFO, reset sur échec, paliers de difficulté |
| `js/core/game-rules.js` | Règles de jeu pures partagées (étoiles, 5 boosters, combos, barèmes, multiplicateurs) |
| `js/core/quiz-session.js` | Pipeline unifié de soumission des quiz, anti-triche et consommation sécurisée des boosters |
| `js/features/daily-quests.js` | Quêtes journalières déterministes (PRNG Mulberry32, tirage Fisher-Yates, renouvellement minuit, pool pilotable admin) |
| `js/ai-provider.js` | Orchestrateur Multi-IA (Make, OpenAI-compatible, Gemini) avec bascule en cascade et repli local |
| `js/admin-store.js` | Catalogue central : 9 niveaux, 18 filières, règles officielles des 36 matières, 97 articles boutique, 78 badges, 9 quêtes |
| `js/admin.js` | Interface du panneau d'administration (pilotage intégral) |
| `js/cookies.js` | Bandeau de consentement RGPD/CNIL avec fermeture rapide (mémorisation 12 mois) |
| `service-worker.js` | PWA `eduquest-cache-v1.29.1` (**93 ressources pré-cachées**, 100 % hors-ligne) |
| `schema.sql` | Schéma SQL complet (36 matières avec 18 filières, joueurs, paramètres, progression, quêtes, inventaire) |
| `docs/` | Guides techniques : [Architecture](docs/ARCHITECTURE.md), [Guide de contribution](docs/GUIDE_CONTRIBUTION.md), [Persistance](docs/API_PERSISTENCE.md) |

---

## 🧪 Validation & Tests Automatisés

Le projet inclut **109 tests unitaires** répartis en **11 suites** sans aucune dépendance externe :

```bash
# Exécuter les 109 tests unitaires Node.js
node --test tests/*.test.js

# Contrôle statique de syntaxe des 15 modules JS
node --check js/app.js js/db.js js/quiz-engine.js js/question-bank.js js/admin.js js/admin-store.js js/ai-provider.js js/cookies.js js/core/audio-manager.js js/core/quiz-timer.js js/core/adaptive-engine.js js/core/game-rules.js js/core/quiz-session.js js/features/daily-quests.js service-worker.js
```

*(Les commandes `npm test` et `npm run check` sont également définies dans `package.json`.)*

---

## 🗃️ Persistance SQL (Mode Serveur optionnel)

1. Exécutez `schema.sql` sur votre serveur MySQL/MariaDB.
2. Configurez `API_URL` dans `js/db.js` (voir [docs/API_PERSISTENCE.md](docs/API_PERSISTENCE.md)).
