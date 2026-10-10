# EDUQUEST — Révision gamifiée (6e → Terminale)

Application web française d'apprentissage et de révision sous forme d'aventure ludique : l'élève choisit sa classe, sa matière, explore les îles du savoir, répond à des quiz variés (5 types de questions), accomplit des quêtes journalières, gagne XP, pièces et succès, et personnalise son avatar.

100 % front-end (HTML/CSS/JS), sans dépendance externe obligatoire, fonctionnelle hors-ligne en mode PWA/local.

---

## 🚀 Démarrage rapide

**Option 1 — Double-clic :** ouvrez `index.html` dans un navigateur moderne.
Tout fonctionne immédiatement (les comptes, la progression, les quêtes et les options sont stockés dans le `localStorage` du navigateur).

**Option 2 — Serveur local (recommandé pour tester le service worker et le mode API) :**

```bash
npx serve .          # ou : python -m http.server 8080
```

Puis ouvrez l'URL affichée (ex. `http://localhost:8080`).

---

## ✨ Fonctionnalités clés

- **🗺️ Carte des îles & progression :** Chaque matière propose un parcours d'îles avec niveaux interactifs (de 1 à 100), étoiles de maîtrise et déplacement animé du personnage.
- **🎯 5 types de questions :** QCM classique, Vrai/Faux, Réponse courte, Texte à trous et Association de paires (propulsé par `quiz-engine.js`).
- **📜 Quêtes journalières & Coffre bonus :**
  - Renouvellement automatique chaque jour à minuit (heure locale).
  - Présentation moderne sous forme de cartes avec anneaux de progression circulaires en SVG.
  - Boutons de réclamation interactifs avec rétribution immédiate (XP + pièces).
  - Coffre bonus quotidien (+50 pièces) débloqué une fois toutes les quêtes accomplies.
- **🎉 Célébrations & Confettis natifs :** Moteur de confettis Canvas autonome (`Celebrate`), 100 % hors-ligne sans CDN, célébrant les réussites de niveaux, l'accomplissement des quêtes et l'ouverture du coffre.
- **⏱️ Mode Défi Chronométré :** Minuteur réglable dans les options récompensant la rapidité de réponse par un bonus d'XP.
- **🛍️ Boutique & Personnalisation :** Déblocage de skins et halos d'avatar (Aurore, Braise, Abysses, Cyber, Émeraude, Galaxie...) contre des pièces gagnées en jeu.
- **🏆 Succès & Badges :** Catalogue de succès récompensant les accomplissements (premier quiz, sans faute, paliers de niveau...).
- **🤖 Mode IA optionnel :** Génération et correction dynamique des questions via scénarios Make (`ai-provider.js`), avec repli local transparent.
- **🔒 Respect de la vie privée & RGPD :** Sans publicité, sans traceur tiers intrusif, bandeau de cookies conforme CNIL (`cookies.js`) et mentions légales complètes (`legal.html`).

---

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil : menu principal, modale de connexion/inscription, options de jeu (audio, plein écran, chronomètre, etc.) |
| `dashboard.html` | Tableau de bord élève : missions quotidiennes, sélection des matières, boutique de skins, succès débloqués |
| `map.html` | Carte interactive d'une matière : parcours des îles, niveaux jouables, modale de quiz interactif |
| `admin.html` + `admin.js` + `admin.css` | **Panneau d'administration** : gestion des membres, des niveaux scolaires, des matières/leçons et des crédits |
| `admin-store.js` | Couche de configuration du panneau (niveaux, surcharges matières/leçons, crédits, import/export) |
| `app.js` | Logique principale de jeu : contrôleur de pages, quêtes quotidiennes (`DailyQuests`), confettis (`Celebrate`), HUD, progression |
| `quests.css` | Styles dédiés au tableau de quêtes journalières (cartes de verre, anneaux SVG) et au canvas plein écran des confettis |
| `db.js` | Couche d'accès aux données : persistance locale (`localStorage`) ou synchronisation API backend MySQL |
| `quiz-engine.js` | Moteur de rendu et de validation des 5 types de questions |
| `question-bank.js` | Banque de questions et générateur déterministe (PRNG semé) pour les niveaux 6 à 100 par matière |
| `ai-provider.js` | Adaptateur IA : communication avec Make/webhooks pour génération/correction de questions à la volée |
| `global.css` / `style.css` | Tokens graphiques, univers spatial animé, cartes, fenêtres modales et responsive mobile |
| `service-worker.js` | PWA et mise en cache hors-ligne des ressources de l'application |
| `cookies.js` | Bandeau de consentement RGPD (mémorisation du choix 12 mois) |
| `legal.html` | Mentions légales, politique de confidentialité et gestion des cookies |
| `schema.sql` | Schéma MySQL pour le déploiement avec serveur backend optionnel |

---

## 🛡️ Panneau d'administration

Accessible depuis le lien « 🔐 Administration » en bas de page ou directement via `admin.html` :

- **👥 Membres :** Création, modification de mot de passe, attribution des rôles (`eleve` / `admin`) ou suppression de comptes locaux.
- **🎓 Niveaux scolaires :** Ajout, modification et réorganisation des classes (6ème, 5ème, ..., Terminale).
- **📚 Matières & Leçons :** Personnalisation des intitulés, des icônes et création de questions personnalisées (parmi les 5 types disponibles).
- **✨ Crédits :** Personnalisation des mentions de l'éditeur, coordonnées et crédits affichés en pied de page et sur `legal.html`.
- **⚙️ Sauvegarde :** Export et import de la configuration au format JSON.

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

Par défaut, l'application fonctionne intégralement dans le navigateur.
Pour activer la sauvegarde centralisée sur une base de données MySQL :
1. Déployez le script `schema.sql` sur votre serveur MySQL.
2. Décommentez et configurez la variable `API_URL` dans `db.js` vers votre API backend.

---

## 🧪 Validation & Tests

Vérification de la syntaxe et intégrité de l'ensemble des modules JavaScript du projet :

```bash
npm test          # ou : node --check app.js db.js quiz-engine.js question-bank.js admin.js admin-store.js
```

---

## 📱 Compatibilité & Responsive

- Optimisé pour écrans d'ordinateurs, tablettes et smartphones (responsive jusqu'à 360px de largeur).
- Support du mode plein écran via l'API Fullscreen du navigateur.
- Prise en charge des préférences d'accessibilité (`prefers-reduced-motion` pour neutraliser les animations et confettis si demandé par l'utilisateur).
- Mode économie d'énergie disponible dans les options.
