# Architecture Technique — EDUQUEST v1.28.1

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
    │  GameRules     │              │   DailyQuests    │               │  DB (local/SQL)│
    │  QuizSession   │              │   QuizEngine     │               │  AdminStore    │
    │  AdaptiveEngine│              │   QuestionBank   │               │  EduCookies    │
    │  QuizTimer     │              │   AiProvider     │               │                │
    │  AudioManager  │              │                  │               │                │
    └────────────────┘              └──────────────────┘               └────────────────┘
```

---

## 2. Organisation de l'arborescence

```text
eduquest/
├── index.html                  # Accueil, modales Options (classe, filière, apparence), Connexion & Quitter
├── dashboard.html              # Tableau de bord élève, sélecteurs classe & filière, missions, 26 matières, boutique
├── map.html                    # Carte interactive d'aventure (1 → 100), personnage, badge filière et quiz
├── admin.html                  # Console d'administration unifiée (membres, niveaux 6e→BTS, 26 matières, Multi-IA)
├── legal.html                  # Mentions légales, RGPD et gestion des cookies
├── test.html                   # Banc de tests autonome pour navigateur
├── service-worker.js           # PWA & pré-cache hors-ligne intégral (eduquest-cache-v1.28.1, 73 ressources)
├── manifest.webmanifest        # Manifeste PWA
├── robots.txt                  # Directives moteurs de recherche et robots IA
├── sitemap.xml                 # Plan du site public
├── llms.txt                    # Documentation normalisée pour assistants IA (llmstxt.org)
├── package.json                # Scripts npm test & check (v1.28.1)
├── schema.sql                  # Schéma SQL relationnel (26 matières, filières, progression, quêtes, inventaire)
├── css/
│   ├── global.css              # Design system, cosmos animé, boutons alignés, priorité apparence personnalisée
│   ├── style.css               # Pages de jeu, HUD 🔥/⚡, bandeau mobile fermable, filtres filières, modales
│   ├── quests.css              # Missions quotidiennes compactes & repliables, canvas confettis
│   └── admin.css               # Thème glassmorphism du panneau d'administration
├── js/
│   ├── app.js                  # Contrôleur principal, particules/options synchronisées, HUD 🔥/⚡, confettis calibrés
│   ├── db.js                   # Couche d'accès aux données isolée par compte (niveau, filière, progression, tentatives)
│   ├── quiz-engine.js          # Moteur multi-types (6 formats) avec tolérance orthographique Levenshtein
│   ├── question-bank.js        # Banque officielle des 26 matières (Collège, Lycée, BTS), lazy variants & decks stables
│   ├── admin-store.js          # Catalogue central (9 niveaux, 6 filières, 26 matières, 37 articles, 33 badges, IA)
│   ├── admin.js                # Contrôleur d'interface d'administration
│   ├── ai-provider.js          # Pool Multi-IA (Make, OpenAI-compatible, Gemini) avec bascule et repli adaptatif
│   ├── cookies.js              # Bandeau de consentement conforme RGPD/CNIL avec fermeture rapide (12 mois)
│   ├── core/
│   │   ├── audio-manager.js    # Audio global continu inter-pages, coupure manuelle persistée & bruitages Web Audio
│   │   ├── quiz-timer.js       # Chronomètre unifié (Date.now) sur tous les exercices & réessais
│   │   ├── adaptive-engine.js  # Moteur adaptatif local (240 signatures, rotation FIFO, reset échec, paliers)
│   │   ├── game-rules.js       # Règles pures (étoiles, bouclier, streak, combo, récompenses)
│   │   └── quiz-session.js     # Cycle de vie, anti-triche et pipeline de validation de question
│   └── features/
│       └── daily-quests.js     # Quêtes journalières déterministes (Mulberry32 + Fisher-Yates, minuit)
├── fonts/                      # Polices pixel hébergées localement (PressStart2P, Silkscreen — .woff2 / .ttf)
├── Image/
│   ├── logo.webp               # Logo officiel
│   ├── ile/                    # 26 îles-matières (19 SVG vectoriels + 7 WebP)
│   └── personnages/            # 17 avatars (7 SVG + 10 WebP)
├── Musique/                    # 6 pistes audio MP3 d'ambiance
├── docs/                       # Documentation technique (ARCHITECTURE, GUIDE_CONTRIBUTION, API_PERSISTENCE)
└── tests/                      # 11 suites de tests unitaires Node.js (101 tests)
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
    └── test-helper.js
```

---

## 3. Modules Core UMD & Règles pédagogiques

Les modules situés dans `js/core/`, `js/features/`, `js/db.js`, `js/question-bank.js`, `js/quiz-engine.js` et `js/admin-store.js` sont compatibles navigateur (`window.*`) et Node.js (`module.exports`) pour exécuter les 101 tests sans navigateur.

### `js/admin-store.js` — Programmes officiels & Filières
- **9 niveaux par défaut :** `6eme`, `5eme`, `4eme`, `3eme` (cycle `college`), `2nde`, `1ere`, `terminale`, `bts1`, `bts2` (cycle `lycee`).
- **6 filières applicables dès la 2nde (`isFiliereApplicable`) :** `generale`, `nsi_spe`, `stmg`, `sti2d`, `ciel`, `st2s`.
- **`isSubjectAllowedForNiveau(subject, niveauId, filiereId)` :** applique strictement les programmes officiels (ex. Technologie uniquement au collège, Espagnol dès la 5ème, Philosophie uniquement en Terminale, spécialités filières uniquement au lycée/BTS correspondant).
- **`isSubjectSpecialtyForFiliere(subject, filiereId)` :** met en avant les matières phares de la filière en tête de grille sur `dashboard.html`.

### `js/core/adaptive-engine.js` & `js/question-bank.js` — Anti-répétition & Performance
- Mémoire persistée par `(matière, classe)` jusqu'à **240 signatures** (`MAX_SEEN_SIGNATURES = 240`) et rotation FIFO sur les questions les plus anciennement vues si le vivier est épuisé.
- `getQuestionsForNiveau()` complète les petites banques strictement au sein du **même cycle** (jamais Collège ↔ Lycée) pour garantir un vivier riche (≥ 20 questions uniques sur chacune des 26 matières).
- `QuestionBank.extend()` génère les variantes de leçons en *lazy getter* et `app.js` met en cache les matières étendues par `(classe, filière)` (`_effectiveSubjectsCache`).

### `js/core/game-rules.js`, `quiz-session.js`, `quiz-timer.js` & `audio-manager.js`
- Calcul pur des étoiles (`starsFor`), absorption unique du Bouclier d'Étoile (`shouldShieldAbsorb`), multiplicateur Combo (`x1.0` à `x2.5`) distinct de la Série de victoires (`🔥 Série` vs `⚡ Combo`).
- Anti-double soumission dans `QuizSession.submit()`, persistance anti-triche des erreurs par niveau dans `DB`.
- Continuité audio multi-pages avec coupure manuelle persistée et extinction totale au clic sur Quitter (`AudioManager.stopAll()`).

---

## 4. Flux de validation d'un quiz

```text
Élève valide sa réponse
         │
         ▼
QuizEngine.grade(question, userInput)
         │
         ▼
QuizSession.submit(attempt, rawAnswer, ctx)
    ├── Protection anti-double soumission (checking = true)
    ├── Absorption éventuelle du Bouclier d'Étoile (1ère erreur uniquement)
    ├── Mise à jour anti-triche persistée (DB.recordLevelFailure) & palier AdaptiveEngine
    └── Mise à jour du Combo (⚡) via DB.recordAnswer()
         │
         ▼
Validation du niveau (unlockNextAndSave / _dashFinishQuiz)
    ├── Incrémentation de la Série (🔥) via DB.recordLevelVictory()
    ├── Calcul des gains XP / Pièces / Score via GameRules.computeLevelRewards()
    ├── Avancement des DailyQuests & vérification des 33 badges (checkBadges)
    └── Célébration Celebrate.confetti() (calibrée mobile + cooldown 1,8s + respect options)
```
