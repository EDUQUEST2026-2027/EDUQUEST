# EDUQUEST — Révision gamifiée (6e → Terminale)

Application web française d'apprentissage et de révision sous forme d'aventure spatiale et ludique : l'élève choisit sa classe, sa matière, explore les îles du savoir, répond à des quiz interactifs variés (6 types de questions : QCM avec choix mélangés, Vrai/Faux, Réponse courte, Texte à trous avec banque de mots, Texte à choix avec menu déroulant, Association), accomplit des quêtes journalières, gagne de l'XP, des pièces et des succès, et personnalise son avatar dans une boutique riche en récompenses.

100 % front-end (HTML5 / CSS3 / JavaScript Vanilla), sans dépendance externe obligatoire, hautement performante et fonctionnelle 100 % hors-ligne en mode PWA/local.

---

## 🚀 Démarrage rapide

**Option 1 — Double-clic direct :** ouvrez `index.html` dans un navigateur moderne.
Tout fonctionne immédiatement (les comptes, la progression, les quêtes, les articles de la boutique, les récompenses et les options sont stockés dans le `localStorage` du navigateur).

**Option 2 — Serveur local (recommandé pour tester le service worker et le mode PWA) :**

```bash
npx serve .          # ou : python -m http.server 8080
```

Puis ouvrez l'URL affichée (ex. `http://localhost:8080`).

---

## ✨ Fonctionnalités clés

- **🔥 Système de Séries (Streaks) & Combos dynamiques :**
  - **Séries de victoires (`streak`) :** Suivi des victoires consécutives avec badge animé dans le HUD du tableau de bord et l'en-tête de carte. Réinitialisation à zéro en cas d'erreur non protégée par un bouclier.
  - **Combos en chaîne (`combo`) :** Enchaînement de bonnes réponses consécutives avec 6 paliers visuels (Standard, En rythme, En feu, Surtension, Inarrêtable, Légendaire).
  - **Multiplicateur de score & XP :** Bonus progressif de **x1.0** à **x2.5** appliqué au score total et aux points d'expérience.
- **🎲 3 variantes de questions par niveau & renouvellement en cas d'échec :**
  - Chaque niveau dispose de 3 variantes de questions distinctes choisies aléatoirement.
  - En cas d'erreur, le bouton **Réessayer** génère et charge une nouvelle question aléatoire parmi les variantes.
  - L'ordre des choix des QCM est réorganisé aléatoirement entre chaque essai.
- **📝 Nouveaux formats de questions & saisie assistée :**
  - **Texte à choix avec menu déroulant (`texte_a_choix`) :** Menus `<select>` intégrés directement dans le texte.
  - **Banque de mots proposés (`texte_a_trous`) :** Mots suggérés sous forme de badges cliquables pour insérer facilement les réponses.
  - **Tolérance aux fautes d'orthographe :** Algorithme de distance de Levenshtein acceptant les fautes de frappe légères dans les réponses textuelles et textes à trous.
- **🎨 Thème de base dans la boutique & Thèmes personnalisables :** Ré-équipement direct du thème Astral d'origine (offert) à tout moment dans la boutique.
- **📜 Ergonomie & Affichage responsive :** Hauteur maximale et barre de défilement dorée intégrée dans les modales pour éviter tout débordement d'affichage sur smartphone et questions longues.
- **🔄 Navigation fluide :** Navigation entre onglets et retour de carte sans rechargement complet de la page via l'API History (`popstate`) et synchronisation `pageshow`.
- **🧪 Potions & Boosters consommables (Boutique) :**
  - **Potion Double XP :** Multiplie par 2 l'XP gagnée au prochain niveau réussi.
  - **Bouclier d'Étoile :** Préserve le score 3 étoiles ainsi que la série de combos en cas de première erreur.
  - Réachats illimités et historique d'inventaire complet par utilisateur.
- **🏛️ Matières enrichies (13 matières) & cycle adapté :**
  - **Technologie :** Réservée aux niveaux collège (6e, 5e, 4e, 3e) avec algorithmique, capteurs, matériaux et réseaux.
  - **NSI & Numérique :** Dédiée aux niveaux lycée (2nde SNT, 1ère & Terminale NSI) avec programmation Python, SQL, protocoles réseaux, complexité et arbres binaires, accompagnée de son îlot flottant cybernétique vectoriel (`nsi.svg`).
  - **SES (Sciences Économiques & Sociales) :** Marché, création monétaire, PIB, socialisation et commerce international, avec son îlot boursier doré vectoriel (`ses.svg`).
  - **Philosophie & EMC :** Îlots dédiés (`philo.svg`, `emc.svg`) et questions de réflexion éthique, citoyenne et républicaine.
  - **Chimie dédiée :** Scission définitive avec questions et banque propres.
- **🏝️ Îles flottantes & personnalisation graphique :** Remplacement des symboles textuels par de véritables îles flottantes animées, support d'upload d'illustrations locales (avec compression Canvas automatique) et choix d'icônes dans le panneau d'administration.
- **💡 Bouton Indice & Explications pédagogiques enrichies :** Bouton 💡 dans les quiz révélant une aide de cours contextualisée, et explications détaillées de la règle pour chaque question.
- **📱 Ergonomie smartphone & Bottom Navigation :** Barre de navigation basse (Bottom Nav) sur mobile (Matières, Boutique, Succès, Options, Accueil), zones tactiles confortables (≥48px) et suppression de tout chevauchement d'éléments.
- **🎨 Contrôle des animations :** Option dédiée permettant de désactiver les ondulations, pulsations et mouvements d'interface pour le confort visuel ou l'accessibilité.
- **🐙 Projet Open-Source & Crédits GitHub :** Lien direct et éditable vers le dépôt officiel GitHub intégré au pied de page, à la modale d'options, aux crédits et aux mentions légales.
- **🗺️ Carte des îles & progression dynamique :** Chaque matière propose un parcours d'îles avec niveaux interactifs (de 1 à 100), hitbox étendue pour un confort tactile optimal, étoiles de maîtrise et déplacement animé du personnage.
- **🎓 Sélecteur de niveau d'étude intégré :** Choix direct et persistant de la classe (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale ou classes personnalisées) dans l'en-tête du tableau de bord (`dashboard.html`).
- **🎯 Types de questions interactives :** QCM classique, Vrai/Faux, Réponse courte, Texte à trous, Texte à choix déroulant et Association de paires (propulsé par `quiz-engine.js`).
- **⏱️ Mode Défi Chronométré :** Compte à rebours dynamique réglable dans les options de jeu avec multiplicateur d'XP bonus récompensant la vivacité d'esprit.
- **📜 Quêtes journalières & Coffre mystère quotidien :**
  - Renouvellement automatique chaque jour à minuit (heure locale).
  - Présentation moderne sous forme de cartes en verre avec anneaux de progression SVG circulaires.
  - Boutons de réclamation interactifs avec récompenses immédiates (XP + pièces).
  - Coffre bonus quotidien (+50 pièces) débloqué une fois toutes les quêtes accomplies.
- **🛍️ Boutique étendue & Personnalisation (25+ articles) :**
  - **Auras & Halos lumineux :** Aurore Boréale, Comète Dorée, Nova Améthyste, Étoile Rose, Braise Cosmique, Éclair Néon.
  - **Personnages & Avatars historiques :** Ada Lovelace, Pythagore, Léonard de Vinci, Victor Hugo, Astronaute Cosmique, Archimage des Étoiles.
  - **Titres honorifiques exclusifs :** Apprenti des Étoiles, Explorateur Céleste, Maître du Savoir, Érudit Cosmique, Titan de la Connaissance.
  - **Thèmes cosmiques & Potions magiques.**
- **🏆 Succès & Badges déblocables :** Système de trophées récompensant chaque grand palier (premier quiz, sans faute, score parfait, séries de victoires, maître du combo, maître des îles...).
- **🎉 Célébrations & Confettis natifs :** Moteur de confettis Canvas autonome (`Celebrate`), 100 % hors-ligne sans CDN, célébrant les 3 étoiles, les montées de niveau, la réussite des quêtes et l'ouverture du coffre.
- **🤖 Mode IA optionnel :** Génération et correction dynamique des questions via scénarios Make (`ai-provider.js`), avec repli local transparent.
- **🔒 Respect de la vie privée & RGPD :** Zéro publicité, zéro traceur tiers intrusif, bandeau de cookies conforme CNIL (`cookies.js`) et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture & Organisation des fichiers

```text
├── index.html, dashboard.html, map.html, admin.html, legal.html, test.html
├── service-worker.js, manifest.webmanifest, robots.txt, sitemap.xml, llms.txt, schema.sql
├── css/   → global.css, style.css, quests.css, admin.css
├── js/    → app.js, db.js, quiz-engine.js, question-bank.js, admin.js, admin-store.js, ai-provider.js, cookies.js
│   ├── core/     → game-rules.js, quiz-session.js
│   └── features/ → daily-quests.js
├── docs/  → ARCHITECTURE.md, GUIDE_CONTRIBUTION.md, API_PERSISTENCE.md
└── tests/ → daily-quests, db, game-rules-and-session, question-bank, quiz-engine (.test.js)
```

| Fichier / Dossier | Rôle |
|---|---|
| `index.html` | Page d'accueil : menu principal, modales Options & Connexion, univers spatial |
| `dashboard.html` | Tableau de bord élève : sélection de classe, missions quotidiennes, sélection des 13 matières, boutique, succès |
| `map.html` | Carte interactive d'une matière : parcours des îles, niveaux jouables (1 à 100), modale de quiz avec combo et timer chrono |
| `admin.html` | **Panneau d'administration unifié** : interface d'administration avec navigation par onglets |
| `legal.html` | Mentions légales, politique de confidentialité RGPD et gestion des cookies |
| `test.html` | **Banc de tests navigateur autonome** : interface d'évaluation complète avec retour visuel immédiat |
| `css/` | Feuilles de style modulaires : `global.css`, `style.css`, `quests.css` et `admin.css` |
| `js/app.js` | Contrôleur principal de jeu : gestionnaire de vues, audio, HUD, boutique, confettis Canvas |
| `js/db.js` | Couche d'accès aux données : persistance locale isolée par utilisateur (`localStorage`) ou API SQL optionnelle |
| `js/quiz-engine.js` | Moteur de rendu et de validation des 6 types de questions avec tolérance orthographique Levenshtein |
| `js/question-bank.js` | Banque de questions et générateur procédural déterministe (PRNG mulberry32) pour les niveaux 6 à 100 par matière |
| `js/core/game-rules.js` | Règles de jeu pures partagées (calcul d'étoiles, règles du bouclier, combos, barèmes) |
| `js/core/quiz-session.js` | Pipeline unifié de soumission des quiz et consommation sécurisée des boosters |
| `js/features/daily-quests.js` | Moteur de quêtes journalières déterministes (tirage Fisher-Yates, renouvellement minuit) |
| `js/ai-provider.js` | Adaptateur IA : communication avec Make/webhooks pour génération/correction à la volée avec repli local |
| `js/admin-store.js` | Configuration centrale du panneau d'administration (niveaux, leçons, boutique, récompenses) |
| `js/admin.js` | Moteur et interface utilisateur du panneau d'administration |
| `js/cookies.js` | Bandeau de consentement RGPD conforme CNIL (mémorisation du choix 12 mois) |
| `service-worker.js` | PWA et mise en cache hors-ligne intégrale de l'application (v1.26.0) |
| `schema.sql` | Schéma MySQL pour le déploiement avec serveur backend optionnel |
| `docs/` | Guides techniques approfondis : [Architecture](docs/ARCHITECTURE.md), [Guide de contribution](docs/GUIDE_CONTRIBUTION.md), [Persistance des données](docs/API_PERSISTENCE.md) |

---

## 🛡️ Panneau d'administration

Accessible depuis le lien « 🔐 Administration » en bas de page ou directement via `admin.html` :

- **👥 Membres :** Création, modification de mot de passe, attribution des rôles (`eleve` / `admin`) ou suppression de comptes locaux avec sessions isolées.
- **🎓 Niveaux scolaires :** Ajout, modification, réorganisation et suppression des niveaux/classes (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale, classes personnalisées).
- **📚 Matières & Leçons :** Personnalisation des intitulés, des icônes et création de questions personnalisées (parmi les 6 types disponibles).
- **🛍️ Boutique :** Création et gestion complète des articles (halos, personnages, titres, thèmes, boosters), prix en pièces, visuels et descriptions.
- **🏆 Succès & Badges :** Édition, activation et attribution/retrait manuel des badges et succès élèves.
- **🎁 Récompenses :** Configuration des barèmes de gains (XP et pièces pour leçons réussies, 3 étoiles, quêtes quotidiennes, coffre bonus, premier sans faute, multiplicateur chrono).
- **✨ Crédits :** Personnalisation des mentions de l'éditeur, coordonnées et crédits affichés en pied de page et sur `legal.html`.
- **💾 Sauvegarde & Export :** Export et import complet de la configuration au format JSON avec validation d'intégrité.

---

## 🤖 Activer le mode IA (Questions à la demande)

Par défaut, les questions proviennent de la banque intégrée déterministe (`js/question-bank.js`).

Pour connecter un agent IA génératif (ex. via Make ou webhook direct) :
1. Renseignez vos endpoints webhooks dans `js/ai-provider.js` :

```javascript
const GENERATE_WEBHOOK_URL = 'https://hook.eu2.make.com/xxxxxxxx';
const VALIDATE_WEBHOOK_URL = 'https://hook.eu2.make.com/yyyyyyyy';
```

En cas de perte de connexion ou d'erreur réseau, l'application bascule automatiquement et de manière transparente sur la banque locale.

---

## 🗃️ Persistance SQL (Mode Serveur)

Par défaut, l'application fonctionne intégralement dans le navigateur (`localStorage`).
Pour activer la sauvegarde centralisée sur une base de données MySQL :
1. Déployez le script `schema.sql` sur votre serveur MySQL.
2. Décommentez et configurez la variable `API_URL` dans `js/db.js` vers votre API backend (voir [Guide de Persistance](docs/API_PERSISTENCE.md)).

---

## 🧪 Validation & Tests Automatisés

Le projet dispose d'une couverture de tests complète (45 tests unitaires) sans dépendance externe :

### 1. Tests unitaires Node.js (CLI)
```bash
npm test
```
*Vérifie le déterminisme du PRNG, les bandes scolaires 6e-Terminale, les paliers de combo, la protection du bouclier, les quêtes journalières et les algorithmes de correction Levenshtein.*

### 2. Contrôle de syntaxe JavaScript
```bash
npm run check
```

### 3. Banc de tests visuel en navigateur
Ouvrez simplement `test.html` dans un navigateur pour exécuter la suite de tests en environnement web réel.

---

## 📱 Compatibilité & Responsive

- Optimisé pour écrans d'ordinateurs, tablettes et smartphones (responsive jusqu'à 360px de largeur).
- Support du mode plein écran via l'API Fullscreen du navigateur.
- Prise en charge des préférences d'accessibilité (`prefers-reduced-motion` pour neutraliser les animations et confettis si demandé par l'utilisateur).
- Mode économie d'énergie disponible dans les options de jeu.

