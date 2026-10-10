# EDUQUEST — Révision gamifiée (6e → Terminale) (v1.23.0)

EDUQUEST est une application web éducative française de révision gamifiée, accessible, open-source et respectueuse de la vie privée.

L'élève explore des îles de savoirs, choisit son niveau scolaire (6e à Terminale), répond à des quiz interactifs variés (QCM, vrai/faux, réponse courte, texte à trous, association), gagne de l'XP et des pièces, débloque des succès et personnalise son héros (avatars illustrés, titres honorifiques, thèmes, boosters).

**100 % front-end (HTML5 / Vanilla CSS / JavaScript ES6+), aucune dépendance externe requise, 100 % fonctionnel hors-ligne.**

---

## 🛡️ Confidentialité & Sessions Temporaires (Zéro Donnée / Zéro Cookie)

- **Aucune récupération de données** : Aucune télémétrie, aucune transmission à des serveurs tiers, aucun pistage.
- **Sessions 100 % temporaires (`sessionStorage`)** : Toutes les données de la partie en cours (progression, pièces, XP, quêtes journalières, options) sont conservées uniquement pendant la session active de l'onglet et sont **automatiquement et définitivement supprimées à la fermeture du navigateur ou de l'onglet**.
- **Aucune connexion ni compte requis** : Expérience immédiate sans identifiant, sans mot de passe et sans formulaires de connexion.
- **Zéro cookie** : Aucun cookie technique, publicitaire ou analytique n'est utilisé (`document.cookie` n'est jamais sollicité).

---

## 🚀 Nouvelles Fonctionnalités (v1.23.0)

- **📜 Quêtes Quotidiennes Dynamiques (`DailyQuests` & `quests.css`)** : Missions renouvelées quotidiennement sous forme de cartes modernes avec anneaux de progression SVG circulaires, bouton « Réclamer » pour toucher XP et pièces, et **coffre bonus du jour (+50 pièces)**.
- **🎉 Moteur de Célébrations & Confettis Natifs (`Celebrate`)** : Système de confettis Canvas autonome et fluide (aucun CDN, 100 % hors-ligne) célébrant les réussites de niveaux, quêtes et coffres.
- **⏱️ Mode Défi Chronométré (30s)** : Option activable avec barre de compte à rebours dynamique dans les quiz et **bonus d'XP de rapidité**.
- **🛍️ Boutique Élargie (25+ articles) & 10 Personnages WebP** :
  - **Avatars illustrés** : *Astronaute, Léonard de Vinci, Victor Hugo, Ada Lovelace, Archimage, Pythagore, Albert Einstein, Marie Curie, Christophe Colomb, Robot*.
  - **Halos élémentaires** : *Aurore, Or, Améthyste, Rose, Braise, Néon, Magma*.
  - **Titres honorifiques** affichés en badge sur le HUD du joueur (*Apprenti Curieux, Maître du Temps, Explorateur Cosmique, Érudit Suprême*).
  - **Thèmes & Boosters** (*Thème Cyber Néon, Abysses Stellaires, Palais Doré, Potion Double XP, Bouclier d'Étoile*).
  - Filtres par catégorie (*Tous, Halos, Personnages, Titres, Thèmes, Boosters*).
- **🎓 Sélecteur de Niveau Scolaire & Synchronisation Temps Réel** : Sélecteur de classe directement dans l'en-tête du tableau de bord et synchronisation parfaite de l'avancement avec `map.html`.

---

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil, lancement rapide et modale des options de jeu |
| `dashboard.html` | Tableau de bord central : quêtes quotidiennes, progression par matière, boutique et succès |
| `map.html` | Carte d'aventure (100 niveaux par matière) avec chemin sinueux SVG et personnage animé |
| `legal.html` | Mentions légales et politique de confidentialité (garantie zéro donnée & zéro cookie) |
| `global.css` | Design system, tokens de couleurs, typographie et composants partagés |
| `style.css` | Styles du jeu, tableau de bord, boutique, quiz et HUD |
| `quests.css` | Feuilles de style dédiées aux quêtes quotidiennes (cartes et anneaux SVG) |
| `app.js` | Moteur principal : contrôleur des pages, `DailyQuests`, `Celebrate`, boutique et quiz |
| `db.js` | Couche de stockage temporaire en session (`sessionStorage`), options et progression |
| `admin-store.js` | Catalogue de la boutique (25+ items), configuration des récompenses et crédits |
| `quiz-engine.js` | Moteur interactif des 5 types de questions (QCM, Vrai/Faux, réponse courte, texte à trous, association) |
| `question-bank.js` | Générateur déterministe (PRNG) des niveaux 6 à 100 par matière |
| `ai-provider.js` | Adaptateur IA (scénarios Make) avec repli local instantané |
| `service-worker.js` | Mise en cache PWA pour un fonctionnement 100 % hors-ligne |
| `manifest.webmanifest` | Manifeste PWA pour installation sur écran d'accueil |
| `robots.txt` / `llms.txt` | Directives d'indexation et documentation pour agents IA |

---

## 💻 Démarrage

Double-cliquez simplement sur `index.html` dans votre navigateur ou lancez un serveur local :

```bash
npx serve .
```
