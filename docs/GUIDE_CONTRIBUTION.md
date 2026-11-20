# Guide de Contribution & Maintenance — EDUQUEST (v1.29.1)

Ce guide décrit l'ensemble des bonnes pratiques, flux de tests et protocoles d'extension du projet EDUQUEST.

---

## 1. Exécution des tests automatisés

Le projet dispose de deux environnements de tests complémentaires sans aucune dépendance npm externe.

### A. Tests Node.js (CLI)
Exécute la suite complète de **109 tests unitaires** (11 suites) via l'exécuteur natif `node:test` :

```bash
node --test tests/*.test.js
```
*Ou via npm :*
```bash
npm test
```

#### Les 11 suites de tests automatisés :
1. `tests/admin-store.test.js` : Validation des 6 types de questions, cycles scolaires (`band`), classes autorisées, avatars, aperçu procédural, configuration du site et pool Multi-IA.
2. `tests/adaptive-and-multi-ai.test.js` : Anti-triche 3 étoiles persisté, réinitialisation sur échec, moteur adaptatif non-répétitif et sélection aléatoire/cascade Multi-IA.
3. `tests/audio-manager.test.js` : Globalisation musicale, anti-réactivation après coupure manuelle, synchronisation inter-onglets et extinction totale au clic sur Quitter.
4. `tests/cookies.test.js` : Conformité du bandeau RGPD/CNIL, durées d'expiration (12 mois) et granularité du consentement.
5. `tests/daily-quests.test.js` : Déterminisme du PRNG Mulberry32, tirage Fisher-Yates et renouvellement à minuit.
6. `tests/db.test.js` : Isolation des comptes locaux, gestion des consommables, combos, bouclier d'étoile et persistance anti-triche des tentatives.
7. `tests/filieres-and-improvements.test.js` : Isolation `DB.getFiliere`/`setFiliere`, filtrage officiel des **18 filières** et BTS 1/2, intégrité des **36 matières**, anti-répétition sur 16 niveaux consécutifs, validation XML/pré-cache des **36 îles** et **27 avatars**, pilotage admin intégral (97 articles boutique, 14 thèmes CSS, 78 succès filtrés par filière, quêtes, feature flags, export/import) et non-régression (`FACT_BANKS`, `AdminStore.hasSubjectCustomizations`, `QuizEngine`, `boost-combo`).
8. `tests/game-rules-and-session.test.js` : Règles pures, étoiles, boosters (`boost-shield`, `boost-xp`, `boost-coins`, `boost-combo`), combos, multiplicateurs globaux et pipeline de soumission de quiz.
9. `tests/question-bank.test.js` : Déterminisme du générateur procédural, non-répétition et respect strict des programmes Collège / Lycée / BTS.
10. `tests/quiz-engine.test.js` : Rendu et notation des 6 formats de questions avec algorithme Levenshtein.
11. `tests/quiz-timer.test.js` : Chronomètre fiable par horloge murale sur exercices consécutifs, réessais et expiration unique.

### B. Contrôle statique de syntaxe
Valide la syntaxe de l'ensemble des modules JavaScript du projet :

```bash
npm run check
```

### C. Banc de tests en navigateur (`test.html`)
Ouvrez simplement [test.html](../test.html) dans n'importe quel navigateur (y compris en local via le protocole `file://`).
- **Exécution complète des 13 suites QA :** Affichage visuel clair avec temps d'exécution milliseconde par milliseconde et barre de progression.
- **Recherche & Filtres :** Filtrage instantané par catégorie (`Core`, `DB`, `Quêtes`, `Questions`, `Admin`, `Cookies`, `Filières`).
- **Benchmark de performance :** Mesure de la vitesse d'exécution moyenne sur plusieurs itérations consécutives.
- **Banc d'essai interactif :** Modale de test en direct permettant de tester et valider n'importe quelle question manuelle ou procédurale.

---

## 2. Ajouter ou modifier des questions

Les questions sont structurées dans `js/question-bank.js` (`FACT_BANKS` + générateurs procéduraux) et peuvent également être créées et modifiées dynamiquement depuis le panneau d'administration (`admin.html`).

Chaque matière officielle (36 au total) dispose :
1. De leçons socles écrites à la main dans `RAW_DASH_SUBJECTS` (`js/app.js`) pour les premiers niveaux.
2. D'un générateur procédural déterministe (`QuestionBank.generateOne`) capable d'étendre la matière jusqu'au niveau 100 de façon reproductible.
3. De variantes aléatoires tirées en *lazy getter* selon le niveau d'étude choisi.

### Formats de questions supportés par `QuizEngine` et validés par `AdminStore` :
1. **QCM (`type: 'qcm'`) :**
   ```javascript
   {
       q: "Quelle est la capitale de la France ?",
       opts: ["Paris", "Lyon", "Marseille", "Bordeaux"],
       correct: 0,
       exp: "Paris est la capitale de la France."
   }
   ```
2. **Vrai / Faux (`type: 'vrai_faux'`) :**
   ```javascript
   {
       type: "vrai_faux",
       q: "L'eau bout à 100 °C à la pression atmosphérique standard.",
       correct: true,
       exp: "Vrai : à 1 atm (niveau de la mer), l'eau bout à 100 °C."
   }
   ```
3. **Réponse courte (`type: 'reponse_courte'`) :**
   ```javascript
   {
       type: "reponse_courte",
       q: "Quel est le participe passé du verbe peindre ?",
       accepted: ["peint", "Peint"]
   }
   ```
4. **Texte à trous (`type: 'texte_a_trous'`) :** *(accepte `___`, `____` ou `[___]`)*
   ```javascript
   {
       type: "texte_a_trous",
       q: "Complète la formule :",
       textWithBlanks: "E = m * ___^2",
       blanks: [["c", "C"]],
       distractors: ["v", "a", "t"]
   }
   ```
5. **Texte avec menu déroulant (`type: 'texte_a_choix'`) :** *(accepte `___`, `____` ou `[___]`)*
   ```javascript
   {
       type: "texte_a_choix",
       q: "Sélectionne le bon connecteur logique :",
       textWithBlanks: "Il pleut, ___ je prends mon parapluie.",
       choices: [["donc", "mais", "car", "or"]],
       blanks: [["donc"]]
   }
   ```
6. **Association / Paires (`type: 'drag_and_drop'`) :**
   ```javascript
   {
       type: "drag_and_drop",
       q: "Associe chaque auteur à son œuvre :",
       items: ["Victor Hugo", "Molière"],
       targets: ["Les Misérables", "Le Tartuffe"],
       pairs: { "Victor Hugo": "Les Misérables", "Molière": "Le Tartuffe" }
   }
   ```

---

## 3. Règles de propreté et bonnes pratiques

- **Zéro dépendance intrusive :** Ne pas introduire de bibliothèques tierces volumineuses ou de CDN externes obligatoires ; tout le code doit fonctionner 100 % hors-ligne.
- **Sécurité XSS :** Tout texte dynamique injecté via `innerHTML` doit impérativement être échappé avec `QuizEngine.esc()`, `AdminStore.esc()` ou `escapeHtml()`.
- **Isolation des utilisateurs :** Toute persistance de progression, filière, boosters ou options doit être cloisonnée par compte utilisateur via les méthodes fournies par `DB`.
- **Compatibilité UMD :** Tout nouveau module Core ou utilitaire doit être exportable à la fois dans le navigateur (`window.*`) et dans Node.js (`module.exports`).
- **Cohérence PWA & Catalogue :** Tout nouvel asset (`Image/ile/*.svg`, `Image/personnages/*.svg`) doit être ajouté dans `service-worker.js` (`PRECACHE_URLS`) et dans `OFFICIAL_ISLANDS` (`js/admin.js`) ou `DASH_SKINS` (`js/app.js`) + `css/style.css`.
