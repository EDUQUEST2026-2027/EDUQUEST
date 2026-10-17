# Architecture Technique — EDUQUEST v1.26.0

## 1. Vue d'ensemble

EDUQUEST est une application web éducative 100 % front-end développée selon les standards Vanilla ES6+ modernes. Elle fonctionne en autonomie complète côté client (hors-ligne via Service Worker et LocalStorage), avec une compatibilité optionnelle vers une API REST MySQL.

```
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
    │  QuestionBank  │              │   AiProvider     │               │  EduCookies    │
    └────────────────┘              └──────────────────┘               └────────────────┘
```

---

## 2. Organisation de l'arborescence

```text
eduquest/
├── index.html                  # Accueil, modale connexion et réglages du joueur
├── dashboard.html              # Tableau de bord élève, choix de classe, matières et boutique
├── map.html                    # Carte interactive d'aventure, parcours des îles et quiz
├── admin.html                  # Console d'administration unifiée (membres, matières, réglages, IA)
├── legal.html                  # Mentions légales, RGPD et gestion des cookies
├── test.html                   # Banc de tests autonome pour navigateur (68 tests, banc interactif, benchmark)
├── service-worker.js           # PWA & mise en cache hors-ligne intégrale
├── manifest.webmanifest        # Manifeste de l'application web progressive
├── robots.txt                  # Directives pour moteurs de recherche et robots IA
├── sitemap.xml                 # Plan du site pour indexation publique
├── llms.txt                    # Documentation pour assistants et agents IA (llmstxt.org)
├── package.json                # Scripts npm test et syntax check
├── schema.sql                  # Schéma de base de données relationnelle MySQL
├── css/
│   ├── global.css              # Variables graphiques, polices, cosmos animé
│   ├── style.css               # Écrans de jeu, modales, responsive mobile
│   ├── quests.css              # Cartes de verre des quêtes, canvas confettis
│   └── admin.css               # Glassmorphism du panneau d'administration
├── js/
│   ├── app.js                  # Contrôleur principal de jeu, HUD, audio et navigation
│   ├── db.js                   # Couche d'accès aux données isolée par compte (LocalStorage/API)
│   ├── quiz-engine.js          # Moteur multi-types (QCM, texte, trou, association) avec Levenshtein
│   ├── question-bank.js        # Banque déterministe 6e-Terminale (100 niveaux/matière)
│   ├── admin-store.js          # Gestion centrale de configuration (niveaux, site, IA, boutique)
│   ├── admin.js                # Contrôleur d'interface d'administration
│   ├── ai-provider.js          # Génération et validation par IA (webhook Make/repli local)
│   ├── cookies.js              # Bandeau de consentement conforme RGPD/CNIL (12 mois)
│   ├── core/
│   │   ├── game-rules.js       # Règles pures (étoiles, bouclier, streak, combo, récompenses)
│   │   └── quiz-session.js     # Cycle de vie et pipeline de validation de question
│   └── features/
│       └── daily-quests.js     # Quêtes journalières déterministes (tirage Fisher-Yates, minuit)
├── fonts/                      # Polices vectorielles hébergées localement (Outfit, Fredoka, Space Grotesk)
├── Image/                      # Logos, avatars et îles flottantes vectorielles optimisées
├── Musique/                    # Pistes audio MP3 d'ambiance
├── docs/                       # Documentation technique approfondie
│   ├── ARCHITECTURE.md         # Architecture technique et flux de données
│   ├── GUIDE_CONTRIBUTION.md   # Guide de maintenance, ajout de questions et tests
│   └── API_PERSISTENCE.md      # Schémas de stockage local et routes API backend
└── tests/                      # Suite de tests unitaires automatisés Node.js
    ├── admin-store.test.js     # Tests de configuration, validation des leçons et IA
    ├── cookies.test.js         # Tests de conformité RGPD et durée d'expiration
    ├── daily-quests.test.js    # Tests du moteur de quêtes journalières et PRNG
    ├── db.test.js              # Tests d'isolation des comptes, combos et boosters
    ├── game-rules-and-session.test.js # Tests des règles pures et pipeline de quiz
    ├── question-bank.test.js   # Tests de déterminisme et bandes scolaires
    ├── quiz-engine.test.js     # Tests des 6 types de questions et algorithme Levenshtein
    └── test-helper.js          # Émulateur léger de LocalStorage pour l'exécution Node.js
```

---

## 3. Modules Core UMD (Universal Module Definition)

Les modules situés dans `js/core/`, `js/features/` et `js/admin-store.js` sont écrits sous forme de fabriques UMD universelles :
- **Dans le navigateur :** ils s'exportent automatiquement sur l'objet global `window` (`window.GameRules`, `window.QuizSession`, `window.DailyQuests`, `window.AdminStore`).
- **Dans Node.js :** ils s'exportent via `module.exports` pour permettre des tests unitaires rapides et étanches sans simulateur DOM lourd.

### `js/core/game-rules.js`
- **Rôle :** Fonctions pures régissant les calculs de scores, barèmes et récompenses.
- **Fonctions clés :**
  - `starsFor(attempts, usedShield)` : calcul des étoiles (3 du premier coup, 2 au deuxième, 1 au-delà ; erreur absorbée si bouclier).
  - `shouldShieldAbsorb(attempt, hasShield)` : détermine si le bouclier d'étoile intervient (une seule fois par question, à la première erreur).
  - `getMultiplier(combo)` : paliers multiplicateurs (x1.0 à x2.5).
  - `computeLevelRewards(params)` : calcule l'XP, les pièces et le score en tenant compte des bonus combo, chrono et potions Double XP.

### `js/core/quiz-session.js`
- **Rôle :** Pipeline unifié d'évaluation d'une réponse.
- **Garanties :**
  - Protection stricte contre les doubles soumissions concurrentes (`checking: true`).
  - Débit unique et sécurisé du consommable Bouclier d'Étoile.
  - Sauvegarde et dispatch unifié vers la couche `DB`.

### `js/features/daily-quests.js`
- **Rôle :** Moteur déterministe des quêtes du jour.
- **Garanties :**
  - Même tirage de 3 quêtes pour tous les élèves à une date donnée grâce au générateur PRNG Mulberry32 combiné à l'algorithme Fisher-Yates.
  - Progression et réclamation persistées et strictement isolées par compte joueur dans `DB`.
  - Renouvellement automatique à minuit (`scheduleMidnightRefresh`).

### `js/admin-store.js`
- **Rôle :** Couche de configuration et de catalogue pour l'administration et le jeu.
- **Composants gérés :**
  - **Matières & Niveaux d'étude :** Rattachement des cycles (`band`) et classes autorisées (`allowedNiveaux`), avec méthode `isMatiereAllowedForNiveau(matiereId, niveauId)`.
  - **Questions & Leçons :** Accès unifié aux questions manuelles et procédurales via `getQuestionsForMatiere(matiereId, niveauId)`, tirage de variantes procédurales via `generateVariant(matiereId, niveauId, variantIndex)`.
  - **Configuration du site :** Titre, slogan, chrono par défaut, multiplicateurs XP & pièces, volumes sonores et inscription.
  - **Configuration IA :** Webhooks Make.com pour la génération et validation, timeout réseau et repli hors-ligne.
  - **Validation stricte :** Valideurs structurels pour les 6 types de questions (`validateLesson`).

---

## 4. Flux de validation d'un quiz

```text
Élève valide sa réponse
         │
         ▼
QuizEngine.score(type, userInput, question)
         │
         ▼
QuizSession.submitAnswer(params)
    ├── Vérification anti-concurrence (lock)
    ├── Détection et application du Bouclier d'Étoile (si première erreur)
    ├── Calcul des étoiles via GameRules.starsFor()
    └── Mise à jour du combo / streak via DB.recordAnswer()
         │
         ▼
Mise à jour du HUD & Affichage des récompenses
    ├── Gains XP et Pièces via GameRules.computeLevelRewards()
    ├── Avancement des DailyQuests (ex: terminer un quiz)
    └── Déclenchement des confettis en cas de victoire 3 étoiles
```
