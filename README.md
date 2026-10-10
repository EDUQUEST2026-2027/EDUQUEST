# EDUQUEST — Révision gamifiée (6e → Terminale)

Application web française d'apprentissage et de révision sous forme d'aventure spatiale et ludique : l'élève choisit sa classe, sa matière, explore les îles du savoir, répond à des quiz interactifs variés (5 types de questions), accomplit des quêtes journalières, gagne de l'XP, des pièces et des succès, et personnalise son avatar dans une boutique riche en récompenses.

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

- **🗺️ Carte des îles & progression dynamique :** Chaque matière propose un parcours d'îles avec niveaux interactifs (de 1 à 100), étoiles de maîtrise et déplacement animé du personnage.
- **🎓 Sélecteur de niveau d'étude intégré :** Choix direct et persistant de la classe (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale ou classes personnalisées) dans l'en-tête du tableau de bord (`dashboard.html`).
- **🎯 5 types de questions interactives :** QCM classique, Vrai/Faux, Réponse courte, Texte à trous et Association de paires (propulsé par `quiz-engine.js`).
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
  - **Thèmes cosmiques & Boosters de progression.**
- **🏆 Succès & Badges déblocables :** Système de trophées récompensant chaque grand palier (premier quiz, sans faute, score parfait, maître des îles...).
- **🎉 Célébrations & Confettis natifs :** Moteur de confettis Canvas autonome (`Celebrate`), 100 % hors-ligne sans CDN, célébrant les montées de niveau, la réussite des quêtes et l'ouverture du coffre.
- **🤖 Mode IA optionnel :** Génération et correction dynamique des questions via scénarios Make (`ai-provider.js`), avec repli local transparent.
- **🔒 Respect de la vie privée & RGPD :** Zéro publicité, zéro traceur tiers intrusif, bandeau de cookies conforme CNIL (`cookies.js`) et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil : menu principal, modale de connexion/inscription, options de jeu (audio, mode chrono, éco-énergie, plein écran) |
| `dashboard.html` | Tableau de bord élève : sélecteur de classe, missions quotidiennes, sélection des matières, boutique complète, succès |
| `map.html` | Carte interactive d'une matière : parcours des îles, niveaux jouables, modale de quiz avec timer chrono optionnel |
| `admin.html` | **Panneau d'administration unifié** : interface d'administration avec navigation par onglets |
| `admin.js` | Moteur du panneau d'administration : CRUD complet membres, niveaux, matières, boutique, récompenses et crédits |
| `admin-store.js` | Couche de persistance et configuration centrale du panneau d'administration |
| `admin.css` | Design system moderne pour l'administration (dark glassmorphism, responsive, feedback visuel) |
| `app.js` | Logique principale de jeu : contrôleur de pages, quêtes quotidiennes (`DailyQuests`), confettis (`Celebrate`), HUD, boutique |
| `quests.css` | Styles dédiés au tableau de quêtes journalières (cartes de verre, anneaux SVG) et au canvas plein écran des confettis |
| `db.js` | Couche d'accès aux données : persistance locale (`localStorage`) ou synchronisation API backend MySQL |
| `quiz-engine.js` | Moteur de rendu et de validation des 5 types de questions |
| `question-bank.js` | Banque de questions et générateur déterministe (PRNG semé) pour les niveaux 6 à 100 par matière |
| `ai-provider.js` | Adaptateur IA : communication avec Make/webhooks pour génération/correction de questions à la volée |
| `global.css` / `style.css` | Tokens graphiques, univers spatial animé, cartes, fenêtres modales et responsive mobile |
| `service-worker.js` | PWA et mise en cache hors-ligne des ressources de l'application (v1.23.0) |
| `cookies.js` | Bandeau de consentement RGPD (mémorisation du choix 12 mois) |
| `legal.html` | Mentions légales, politique de confidentialité et gestion des cookies |
| `llms.txt` | Fiche documentaire pour agents IA et grands modèles de langage |
| `robots.txt` | Règles d'indexation pour moteurs de recherche et robots IA |
| `schema.sql` | Schéma MySQL pour le déploiement avec serveur backend optionnel |

---

## 🛡️ Panneau d'administration

Accessible depuis le lien « 🔐 Administration » en bas de page ou directement via `admin.html` :

- **👥 Membres :** Création, modification de mot de passe, attribution des rôles (`eleve` / `admin`) ou suppression de comptes locaux.
- **🎓 Niveaux scolaires :** Ajout, modification, réorganisation et suppression des niveaux/classes (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale, classes personnalisées).
- **📚 Matières & Leçons :** Personnalisation des intitulés, des icônes et création de questions personnalisées (parmi les 5 types disponibles).
- **🛍️ Boutique :** Création et gestion complète des articles (halos, personnages, titres, thèmes, boosters), prix en pièces, visuels et descriptions.
- **🎁 Récompenses :** Configuration des barèmes de gains (XP et pièces pour leçons réussies, 3 étoiles, quêtes quotidiennes, coffre bonus, premier sans faute, multiplicateur chrono).
- **✨ Crédits :** Personnalisation des mentions de l'éditeur, coordonnées et crédits affichés en pied de page et sur `legal.html`.
- **💾 Sauvegarde & Export :** Export et import complet de la configuration au format JSON avec validation d'intégrité.

---

## 🤖 Activer le mode IA (Questions à la demande)

Par défaut, les questions proviennent de la banque intégrée déterministe (`question-bank.js`).

Pour connecter un agent IA génératif (ex. via Make ou webhook direct) :
1. Renseignez vos endpoints webhooks dans `ai-provider.js` :

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
2. Décommentez et configurez la variable `API_URL` dans `db.js` vers votre API backend.

---

## 🧪 Validation & Tests

Vérification de la syntaxe et de l'intégrité de l'ensemble des modules JavaScript du projet :

```bash
node --check app.js db.js quiz-engine.js question-bank.js admin.js admin-store.js
```

---

## 📱 Compatibilité & Responsive

- Optimisé pour écrans d'ordinateurs, tablettes et smartphones (responsive jusqu'à 360px de largeur).
- Support du mode plein écran via l'API Fullscreen du navigateur.
- Prise en charge des préférences d'accessibilité (`prefers-reduced-motion` pour neutraliser les animations et confettis si demandé par l'utilisateur).
- Mode économie d'énergie disponible dans les options de jeu.
