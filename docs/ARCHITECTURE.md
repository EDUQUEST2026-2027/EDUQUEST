# Architecture Technique — EDUQUEST v1.30.0

## 1. Vue d'ensemble

EDUQUEST est une application web éducative 100 % front-end développée en Vanilla ES6+. Elle fonctionne de manière totalement autonome hors-ligne (PWA Service Worker + `localStorage` isolé par compte), avec compatibilité optionnelle vers une API REST SQL.

```text
┌─────────────────────────────────────────────────────────────┐
│                       Pages Web (HTML5)                     │
│  index.html · dashboard.html · map.html · admin.html · ... │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       ┌───────▼────────┐             ┌────────▼───────┐
       │     Styles     │             │    Modules     │
       │  css/global    │             │   JavaScript   │
       │  css/style     │             │     (ES6+)     │
       │  css/quests    │             └────────┬───────┘
       │  css/admin     │                      │
       └────────────────┘                      │
            ┌──────────────────────────────────┴────────────────────────────────┐
            │                                                                   │
    ┌───────▼────────┐              ┌──────────────────┐               ┌────────▼───────┐
    │  Moteur Core   │              │   Fonctionnalités│               │  Persistance   │
    │  EduIcons (SVG)│              │   DailyQuests    │               │  DB (local/SQL)│
    │  GameRules     │              │   QuizEngine     │               │  AdminStore    │
    │  QuizSession   │              │   QuestionBank   │               │  EduCookies    │
    │  AdaptiveEngine│              │   AiProvider     │               │                │
    │  QuizTimer     │              │                  │               │                │
    │  AudioManager  │              │                  │               │                │
    └────────────────┘              └──────────────────┘               └────────────────┘
```

---

## 2. Organisation de l'arborescence

```text
eduquest/
├── index.html                  # Accueil, modales Options (classe, 18 filières filtrées par niveau, apparence), Connexion & Quitter
├── dashboard.html              # Tableau de bord élève, sélecteurs classe & filière, missions, 43 matières, boutique (98), succès (79)
├── map.html                    # Carte interactive d'aventure (1 → 100), personnage, badge filière et quiz
├── admin.html                  # Console d'administration unifiée (membres, 9 niveaux, 18 filières + niveaux, 43 matières, boutique, succès, Multi-IA)
├── legal.html                  # Mentions légales, RGPD et gestion des cookies
├── test.html                   # Banc de tests autonome pour navigateur (13 suites QA)
├── service-worker.js           # PWA & pré-cache hors-ligne intégral (eduquest-cache-v1.30.1, 94 ressources 100 % SVG)
├── manifest.webmanifest        # Manifeste PWA (icône vectorielle Image/logo.svg)
├── robots.txt                  # Directives moteurs de recherche et robots IA
├── sitemap.xml                 # Plan du site public
├── llms.txt                    # Documentation normalisée pour assistants IA (llmstxt.org)
├── package.json                # Scripts npm test & check (v1.30.0)
├── schema.sql                  # Schéma SQL relationnel (43 matières SVG, 18 filières, progression, quêtes, inventaire)
├── css/
│   ├── global.css              # Design system, cosmos animé, 16 thèmes visuels (15 custom + défaut), icônes SVG .eq-icon, fiabilisation hitboxes
│   ├── style.css               # Pages de jeu, 27 classes avatars SVG, HUD Série/Combo, bandeau mobile fermable, filtres, modales, checkboxes accessibles
│   ├── quests.css              # Missions quotidiennes compactes & repliables, anneau SVG isolé (.quest-ring > svg), canvas confettis
│   └── admin.css               # Thème glassmorphism du panneau d'administration & responsive mobile
├── js/
│   ├── app.js                  # Contrôleur principal, particules/options synchronisées, HUD SVG, boutique (dont retrait titre/thème), 79 succès, confettis calibrés
│   ├── db.js                   # Couche d'accès aux données isolée par compte (niveau, filière, progression, boosters, purge RGPD)
│   ├── quiz-engine.js          # Moteur multi-types (6 formats, ___/[___], Levenshtein, drag & drop réversible sans collision, icônes SVG)
│   ├── question-bank.js        # Banque officielle des 43 matières dont Allemand (Collège, Lycée, BTS), lazy variants & decks stables sans biais de parité
│   ├── admin-store.js          # Catalogue central (9 niveaux, 18 filières + allowedNiveaux, 43 matières, 98 articles, 79 badges, 9 quêtes, IA)
│   ├── admin.js                # Contrôleur d'interface d'administration (pilotage intégral, cohérence classe↔filière, aperçu procédural sur niveau valide)
│   ├── ai-provider.js          # Pool Multi-IA (Make, OpenAI-compatible, Gemini) avec bascule et repli adaptatif
│   ├── cookies.js              # Bandeau de consentement conforme RGPD/CNIL avec fermeture rapide (12 mois)
│   ├── core/
│   │   ├── icons.js            # Bibliothèque vectorielle unifiée EduIcons (70+ icônes SVG duotones Astral & Or)
│   │   ├── audio-manager.js    # Audio global continu inter-pages, placement adaptatif en en-tête, coupure manuelle persistée & bruitages Web Audio
│   │   ├── quiz-timer.js       # Chronomètre unifié (Date.now) avec cache DOM sur tous les exercices & réessais
│   │   ├── adaptive-engine.js  # Moteur adaptatif local (240 signatures, rotation FIFO, reset échec, paliers)
│   │   ├── game-rules.js       # Règles pures (étoiles, 5 boosters, streak, combo, récompenses)
│   │   └── quiz-session.js     # Cycle de vie, anti-triche et pipeline de validation de question
│   └── features/
│       └── daily-quests.js     # Quêtes journalières déterministes (Mulberry32 + Fisher-Yates, minuit)
├── fonts/                      # Police pixel hébergée localement (Silkscreen — .woff2 / .ttf)
├── Image/
│   ├── logo.svg                # Blason officiel vectoriel SVG Astral & Or
│   ├── ile/                    # 43 îles-matières 100 % SVG vectoriels (dont allemand.svg — thème Astral & Or)
│   └── personnages/            # 27 avatars 100 % SVG vectoriels (thème Astral & Or)
├── Musique/                    # 6 pistes audio MP3 d'ambiance
├── docs/                       # Documentation technique (ARCHITECTURE, GUIDE_CONTRIBUTION, API_PERSISTENCE)
└── tests/                      # 12 suites de tests unitaires Node.js
    ├── adaptive-and-multi-ai.test.js
    ├── admin-store.test.js
    ├── audio-manager.test.js
    ├── cookies.test.js
    ├── daily-quests.test.js
    ├── db.test.js
    ├── filieres-and-improvements.test.js
    ├── game-rules-and-session.test.js
    ├── question-bank.test.js
    ├── quiz-engine.test.js
    ├── quiz-timer.test.js
    ├── svg-and-audit.test.js
    └── test-helper.js
```

---

## 3. Modules Core UMD & Règles pédagogiques

Les modules situés dans `js/core/`, `js/features/`, `js/db.js`, `js/question-bank.js`, `js/quiz-engine.js` et `js/admin-store.js` sont compatibles navigateur (`window.*`) et Node.js (`module.exports`) pour exécuter l'ensemble des tests unitaires sans navigateur.

### `js/core/icons.js` — Système d'icônes vectorielles SVG (`EduIcons`)
- Plus de **70 icônes SVG duotones** au format `viewBox="0 0 24 24"`, dessinées dans le thème **Astral & Or** (`currentColor` + calque secondaire d'accent).
- Fonctions publiques : `EduIcons.svg(name, opts)`, `EduIcons.fromEmoji(emoji, opts)`, `EduIcons.stars(earned, total, opts)`, `EduIcons.stripLeadingEmoji(text)` et `EduIcons.iconFromLabel(text, fallback, opts)`.

### `js/admin-store.js` — Programmes officiels, Filières, Boutique & Succès
- **9 niveaux par défaut :** `6eme`, `5eme`, `4eme`, `3eme` (cycle `college`), `2nde`, `1ere`, `terminale`, `bts1`, `bts2` (cycle `lycee`).
- **18 filières avec niveaux autorisés stricts (`allowedNiveaux`, `isFiliereAllowedForNiveau`, `getFilieresForNiveau`, `resolveFiliereForNiveau`) :**
  - **2nde (6 filières) :** `generale`, `sthr`, `s2tmd`, `ciel`, `bac_pro_melec`, `bac_pro_assp`.
  - **1ère & Terminale (15 filières) :** les 6 de 2nde + `nsi_spe`, `stmg`, `sti2d`, `st2s`, `stl`, `std2a`, `stav`, `hlp_llce`, `sciences_spe`.
  - **BTS 1 & BTS 2 (4 filières) :** `ciel`, `bts_sio`, `bts_mco`, `bts_cg`.
- **43 matières officielles (`SUBJECT_DEFAULT_RULES`, dont `allemand`) :** filtrage strict par classe et filière via `isSubjectAllowedForNiveau(subject, niveauId, filiereId)` (ex. Technologie uniquement au collège, Allemand dès la 6ème jusqu'au BTS 2, Espagnol dès la 5ème, HGGSP/HLP/LLCE/Agronomie/SPCL uniquement en 1ère/Terminale, Philosophie uniquement en Terminale, 11 à 21 matières par filière sur ses niveaux autorisés).
- **`isSubjectSpecialtyForFiliere(subject, filiereId)` :** met en avant les spécialités phares de la filière en tête de grille sur `dashboard.html`.
- **`hasSubjectCustomizations()` & `invalidateCache()` :** permettent à `app.js` de contourner `_effectiveSubjectsCache` dès que l'administrateur ajoute ou surcharge une matière, y compris en temps réel entre onglets (`storage`).
- **Boutique (98 articles, 16 thèmes visuels) & Succès (79 badges, dont `germanophone`) :** catalogue central surchageable, avec filtrage automatique des succès par cycle/filière via `isBadgeRelevantFor(badge, niveauId, filiereId)`.

### `js/core/adaptive-engine.js` & `js/question-bank.js` — Anti-répétition & Performance
- Mémoire persistée par `(matière, classe)` jusqu'à **240 signatures** (`MAX_SEEN_SIGNATURES = 240`) et rotation FIFO sur les questions les plus anciennement vues si le vivier est épuisé.
- `getQuestionsForNiveau()` complète les petites banques strictement au sein du **même cycle** (jamais Collège ↔ Lycée) pour garantir un vivier riche sur chacune des 43 matières.
- `QuestionBank.extend()` génère les variantes de leçons en *lazy getter* et `app.js` met en cache les matières étendues par `(classe, filière)` (`_effectiveSubjectsCache`).

### `js/core/game-rules.js`, `quiz-session.js`, `quiz-timer.js` & `audio-manager.js`
- Calcul pur des étoiles (`starsFor`), absorption unique du **Bouclier d'Étoile** (`boost-shield`), protection conditionnelle par **Flamme Éternelle** (`boost-combo`, consommée uniquement si série/combo > 0), bonus **+15 s** du **Sablier Temporel** (`boost-time`), doublement des gains (**Double XP** `boost-xp` & **Élixir de Fortune** `boost-coins`).
- Multiplicateur Combo (`x1.0` à `x2.5`) distinct de la Série de victoires (`🔥 Série` vs `⚡ Combo`).
- Anti-double soumission dans `QuizSession.submit()`, persistance anti-triche des erreurs par niveau dans `DB`.
- Continuité audio multi-pages avec coupure manuelle persistée et extinction totale au clic sur Quitter (`AudioManager.stopAll()`).

---

## 4. Flux de validation d'un quiz

```text
Ouverture d'un exercice (dashboard.html ou map.html)
         │
         ├── Si modeChrono actif + boost-time en stock → +15 s ajoutées (Sablier Temporel)
         ▼
Élève valide sa réponse
         │
         ▼
QuizEngine.grade(question, userInput)
         │
         ▼
QuizSession.submit(attempt, rawAnswer, ctx)
    ├── Protection anti-double soumission (checking = true)
    ├── En cas d'erreur :
    │     ├── Absorption éventuelle du Bouclier d'Étoile (boost-shield, 1ère erreur)
    │     ├── Sinon, si combo/série > 0 : protection par Flamme Éternelle (boost-combo)
    │     └── Persistance anti-triche (DB.recordLevelFailure) & palier AdaptiveEngine
    └── En cas de succès : mise à jour du Combo (⚡) via DB.recordCorrectAnswer()
         │
         ▼
Validation du niveau (unlockNextAndSave / _dashFinishQuiz)
    ├── Incrémentation de la Série (🔥) via DB.recordLevelVictory()
    ├── Consommation éventuelle de Double XP (boost-xp) et Élixir de Fortune (boost-coins)
    ├── Calcul des gains XP / Pièces / Score via GameRules.computeLevelRewards()
    ├── Avancement des DailyQuests & vérification des 79 succès (checkBadges)
    └── Célébration Celebrate.confetti() (calibrée mobile + cooldown 1,8 s + respect options)
```
