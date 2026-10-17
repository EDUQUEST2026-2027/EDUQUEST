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
├── index.html                  # Accueil, modale connexion et réglages
├── dashboard.html              # Tableau de bord joueur, matières et boutique
├── map.html                    # Carte interactive d'aventure et quiz
├── admin.html                  # Console d'administration
├── legal.html                  # Mentions légales, RGPD et cookies
├── test.html                   # Banc de tests autonome pour navigateur
├── service-worker.js           # PWA & mise en cache hors-ligne
├── manifest.webmanifest        # Manifeste PWA
├── robots.txt                  # Directives moteurs de recherche & robots IA
├── sitemap.xml                 # Plan du site pour indexation publique
├── llms.txt                    # Documentation pour assistants & agents IA
├── package.json                # Scripts npm test et check
├── schema.sql                  # Schéma de base de données MySQL
├── css/
│   ├── global.css              # Variables graphiques, polices, cosmos animé
│   ├── style.css               # Écrans de jeu, modales, responsive mobile
│   ├── quests.css              # Cartes de verre des quêtes, canvas confettis
│   └── admin.css               # Glassmorphism du panneau d'administration
├── js/
│   ├── app.js                  # Contrôleur principal et navigation
│   ├── db.js                   # Couche d'abstraction des données (LocalStorage/API)
│   ├── quiz-engine.js          # Moteur multi-types (QCM, texte, trou, association)
│   ├── question-bank.js        # Banque déterministe 6e-Terminale (100 niveaux/matière)
│   ├── admin-store.js          # Configuration globale et catalogue boutique/badges
│   ├── admin.js                # Contrôleur d'interface d'administration
│   ├── ai-provider.js          # Génération et validation par IA (webhook Make/repli)
│   ├── cookies.js              # Bandeau de consentement conforme RGPD/CNIL
│   ├── core/
│   │   ├── game-rules.js       # Règles pures (étoiles, bouclier, streak, combo)
│   │   └── quiz-session.js     # Cycle de vie et pipeline de validation de question
│   └── features/
│       └── daily-quests.js     # Quêtes journalières déterministes (minuit)
├── fonts/                      # Polices vectorielles hébergées localement
├── Image/                      # Logos, avatars et îles flottantes (WebP optimisés)
├── Musique/                    # Pistes audio MP3 d'ambiance
├── docs/                       # Documentation technique approfondie
└── tests/                      # Suite de tests unitaires automatisés Node.js
```

---

## 3. Modules Core UMD (Universal Module Definition)

Les modules situés dans `js/core/` et `js/features/` sont écrits sous forme de fabriques UMD universelles :
- **Dans le navigateur :** ils s'exportent automatiquement sur l'objet global `window` (`window.GameRules`, `window.QuizSession`, `window.DailyQuests`).
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
