# EDUQUEST — Révision gamifiée (Collège, Lycée & BTS · v1.28.1)

Application web française d'apprentissage et de révision sous forme d'aventure spatiale et ludique : l'élève choisit sa **classe** (6e → Terminale, BTS 1 & 2) et, dès le lycée, sa **filière** (**Voie Générale, Spécialité NSI, STMG, STI2D, CIEL, ST2S**), explore les **26 îles du savoir** conformes au programme officiel, répond à des quiz variés (6 types interactifs), accomplit des missions quotidiennes, gagne de l'XP, des pièces et **33 succès**, et personnalise son avatar dans une boutique riche en récompenses.

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

## ✨ Fonctionnalités clés (v1.28.1)

- **🧭 6 Filières officielles & Classes 6e → BTS 2 :**
  - **Collège (6e → 3e) :** Mathématiques, Français, Histoire, Géographie, EMC, Anglais, **Espagnol LV2** (dès la 5e), SVT, Physique, Chimie, Technologie, **Arts & Musique**.
  - **Voie Générale (2nde → Terminale) :** Tronc commun + SES, NSI & Numérique, **HGGSP** (1ère/Tle), **Sciences de l'Ingénieur**, Philosophie (Tle).
  - **Spécialité NSI :** NSI & Numérique, **Cybersécurité**, **Réseaux & Systèmes**, Sciences de l'Ingénieur + tronc commun scientifique.
  - **STMG :** **Management & Gestion (MSGN)**, **Droit & Économie**, **Mercatique** (1ère → BTS) + tronc commun.
  - **STI2D :** **I2D (Innovation & Dév. Durable)**, **SIN (Info & Numérique)**, **Électronique & Systèmes**, Sciences de l'Ingénieur, NSI + tronc commun.
  - **CIEL (Bac Pro / BTS 1 & 2) :** **Cybersécurité**, **Réseaux & Systèmes**, **Électronique & Systèmes**, NSI & Numérique, Droit & Économie + Maths appliquées BTS / Physique / Anglais / Français.
  - **ST2S :** **STSS (Santé & Social)**, SVT, Physique, Chimie + tronc commun.
  - **Filtrage intuitif :** Sélecteurs Classe & Filière dans le tableau de bord et les Options, bandeau récapitulatif du programme officiel, onglets rapides (*Toutes / ★ Spécialités / Tronc commun*) et mise en avant des matières phares de la filière.
- **🏝️ 26 Îles flottantes illustrées (100 niveaux chacune) :**
  - Chaque matière dispose de sa propre île flottante (19 SVG vectoriels + 7 WebP) pré-cachée hors-ligne dans `service-worker.js`, d'exercices socles variés et d'une extension procédurale jusqu'à 100 niveaux.
- **🔥 Série vs ⚡ Énergie Combo (zéro ambiguïté) :**
  - **🔥 Série (pastille feu) :** nombre de niveaux réussis consécutivement.
  - **⚡ Énergie Combo (pastille électrique) :** enchaînement de bonnes réponses et multiplicateur dynamique d'XP et de score (**x1.0** à **x2.5**). Un clic sur l'une ou l'autre pastille affiche une explication claire.
- **🤖 Moteur adaptatif local anti-répétition & Pool Multi-IA :**
  - **Anti-répétition renforcée (`js/core/adaptive-engine.js` & `js/question-bank.js`) :** mémoire de **240 questions vues** par matière/classe, rotation FIFO par ancienneté, vivier minimal par cycle (sans jamais mélanger collège et lycée), génération paresseuse (*lazy*) des variantes et reset vers une question différente après chaque échec.
  - **Pool Multi-IA (`js/ai-provider.js`) :** prise en charge optionnelle de plusieurs fournisseurs IA (Make.com, API compatibles OpenAI/Mistral/Groq/Ollama, Google Gemini) avec bascule en cascade et repli local 100 % hors-ligne.
- **📱 Expérience mobile soignée & accessible :**
  - **Bandeau du bas fermable / rouvrable :** bouton `✕ Fermer` intégré dans la barre mobile (état sauvegardé + espace vertical récupéré) et pilule `☰ Menu` pour la rouvrir en un tap.
  - **Missions quotidiennes compactes et repliables :** rangées horizontales fines sur téléphone + bouton `▾ / ▸` pour plier/déplier le panneau avec badge « X à réclamer ».
  - **Confettis calibrés :** densité allégée sur mobile (~22 particules courtes), plafond strict, anti-spam (`1,8 s`) et respect absolu des options **Particules**, **Mode Éco** et **Animations**.
  - **Marges, alignements & fermeture rapide :** rythme vertical homogène entre sections, cartes alignées, croix `✕` sur toutes les modales et le bandeau cookies, notifications placées en haut sur mobile.
- **🎨 Particules fiabilisées & Paramètres toujours appliqués (PC & Mobile) :**
  - L'option **Particules** contrôle conjointement nuages, étoiles et confettis ; aucun nuage figé quand les animations sont désactivées.
  - Synchronisation automatique des options sur `pageshow`, `focus`, `visibilitychange`, `storage` et à l'ouverture des Options ; couleurs personnalisées prioritaires sur les thèmes boutique.
- **📝 6 Types de questions & Indice pédagogique 💡 :** QCM (choix mélangés), Vrai/Faux, Réponse courte (tolérance orthographique Levenshtein), Texte à trous (banque de mots cliquables), Texte à choix déroulant (`<select>`) et Association (Drag & Drop).
- **🔊 Gestionnaire audio global (`js/core/audio-manager.js`) :** musique continue inter-pages (6 pistes locales), coupure manuelle strictement persistée et bruitages Web Audio synthétisés.
- **⏱️ Chronomètre unifié (`js/core/quiz-timer.js`) & Anti-triche étoiles :** compte à rebours fiable à horloge réelle sur tous les exercices et réessais ; erreurs persistées par niveau.
- **🛍️ Boutique (37 articles), 17 avatars & 33 Succès :** halos, personnages historiques et pop-culture, titres, thèmes visuels, potions consommables (Double XP 🧪, Bouclier d'Étoile 🛡️) et badges dédiés aux filières.
- **🔒 Respect de la vie privée & RGPD :** zéro publicité, zéro traceur tiers, bandeau cookies conforme CNIL (`js/cookies.js`) et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture & Organisation des fichiers

```text
├── index.html, dashboard.html, map.html, admin.html, legal.html, test.html
├── service-worker.js, manifest.webmanifest, robots.txt, sitemap.xml, llms.txt, schema.sql, package.json
├── css/    → global.css, style.css, quests.css, admin.css
├── fonts/  → PressStart2P & Silkscreen (.woff2 / .ttf)
├── Image/  → logo.webp, ile/ (26 îles : 19 SVG + 7 WebP), personnages/ (17 avatars : 7 SVG + 10 WebP)
├── Musique/→ music1.mp3 … music6.mp3
├── js/     → app.js, db.js, quiz-engine.js, question-bank.js, admin.js, admin-store.js, ai-provider.js, cookies.js
│   ├── core/     → audio-manager.js, quiz-timer.js, adaptive-engine.js, game-rules.js, quiz-session.js
│   └── features/ → daily-quests.js
├── docs/   → ARCHITECTURE.md, GUIDE_CONTRIBUTION.md, API_PERSISTENCE.md
└── tests/  → 101 tests unitaires Node.js sur 11 suites
```

| Fichier / Dossier | Rôle |
|---|---|
| `index.html` | Accueil : menu principal aligné, modales Options (classe, filière, audio, particules, apparence), Connexion & Quitter |
| `dashboard.html` | Tableau de bord élève : sélecteurs classe & filière, HUD 🔥/⚡, missions repliables, 26 matières, boutique, 33 succès |
| `map.html` | Carte interactive d'une matière : parcours 1 → 100, badge classe/filière en lecture seule, expulsion hors programme, quiz |
| `admin.html` | **Panneau d'administration unifié** : membres, niveaux 6e → BTS 2, 26 matières, leçons, boutique, récompenses, Multi-IA & crédits |
| `legal.html` | Mentions légales, politique de confidentialité RGPD et gestion des cookies |
| `test.html` | **Banc de tests navigateur autonome** : suites QA, benchmark et test interactif |
| `js/app.js` | Contrôleur principal, vues, apparence, particules, HUD 🔥/⚡, boutique, confettis Canvas calibrés |
| `js/db.js` | Persistance isolée par compte (`localStorage` / API SQL optionnelle) : classe, filière, progression, tentatives anti-triche |
| `js/quiz-engine.js` | Rendu et validation des 6 types de questions avec tolérance Levenshtein |
| `js/question-bank.js` | Banque officielle des 26 matières + générateurs procéduraux (dont Maths BTS, STMG, STI2D, CIEL, SI, Espagnol, Arts) |
| `js/core/audio-manager.js` | Audio global continu inter-pages, respect de coupure manuelle, bruitages SFX Web Audio |
| `js/core/quiz-timer.js` | Chronomètre unifié à horloge réelle (`Date.now`) sur tous les exercices et réessais |
| `js/core/adaptive-engine.js` | Moteur adaptatif local : mémoire de 240 questions, rotation FIFO, reset sur échec, paliers de difficulté |
| `js/core/game-rules.js` | Règles de jeu pures partagées (étoiles, bouclier, combos, barèmes, multiplicateurs) |
| `js/core/quiz-session.js` | Pipeline unifié de soumission des quiz, anti-triche et consommation sécurisée des boosters |
| `js/features/daily-quests.js` | Quêtes journalières déterministes (PRNG Mulberry32, tirage Fisher-Yates, renouvellement minuit) |
| `js/ai-provider.js` | Orchestrateur Multi-IA (Make, OpenAI-compatible, Gemini) avec bascule en cascade et repli local |
| `js/admin-store.js` | Catalogue central : 9 niveaux, 6 filières, règles officielles des 26 matières, 37 articles boutique, 33 badges |
| `js/admin.js` | Interface du panneau d'administration |
| `js/cookies.js` | Bandeau de consentement RGPD/CNIL avec fermeture rapide (mémorisation 12 mois) |
| `service-worker.js` | PWA `eduquest-cache-v1.28.1` (73 ressources pré-cachées, 100 % hors-ligne) |
| `schema.sql` | Schéma SQL complet (26 matières avec filières, joueurs, paramètres, progression, quêtes, inventaire) |
| `docs/` | Guides techniques : [Architecture](docs/ARCHITECTURE.md), [Guide de contribution](docs/GUIDE_CONTRIBUTION.md), [Persistance](docs/API_PERSISTENCE.md) |

---

## 🧪 Validation & Tests Automatisés

Le projet inclut **101 tests unitaires** répartis en **11 suites** sans aucune dépendance externe :

```bash
# Exécuter les 101 tests unitaires Node.js
node --test tests/*.test.js

# Contrôle statique de syntaxe des 15 modules JS
node --check js/app.js js/db.js js/quiz-engine.js js/question-bank.js js/admin.js js/admin-store.js js/ai-provider.js js/cookies.js js/core/audio-manager.js js/core/quiz-timer.js js/core/adaptive-engine.js js/core/game-rules.js js/core/quiz-session.js js/features/daily-quests.js service-worker.js
```

*(Les commandes `npm test` et `npm run check` sont également définies dans `package.json`.)*

---

## 🗃️ Persistance SQL (Mode Serveur optionnel)

1. Exécutez `schema.sql` sur votre serveur MySQL/MariaDB.
2. Configurez `API_URL` dans `js/db.js` (voir [docs/API_PERSISTENCE.md](docs/API_PERSISTENCE.md)).
