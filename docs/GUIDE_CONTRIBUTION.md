# Guide de Contribution & Maintenance — EDUQUEST

Ce guide décrit l'ensemble des bonnes pratiques, flux de tests et protocoles d'extension du projet EDUQUEST.

---

## 1. Exécution des tests automatisés

Le projet dispose de deux environnements de tests complémentaires sans aucune dépendance npm externe.

### A. Tests Node.js (CLI)
Exécute la suite complète de **tests unitaires** (10 suites) via l'exécuteur natif `node:test` :

```bash
node --test tests/*.test.js
```
*Ou via npm :*
```bash
npm test
```

#### Les 10 suites de tests automatisés :
1. `tests/admin-store.test.js` : Validation des 6 types de questions, cycles scolaires (`band`), classes autorisées (dont règles strictes Collège/Lycée/Terminale), aperçu procédural, configuration du site et pool Multi-IA.
2. `tests/adaptive-and-multi-ai.test.js` : Anti-triche 3 étoiles persisté, réinitialisation sur échec, moteur adaptatif non-répétitif et sélection aléatoire/cascade Multi-IA.
3. `tests/audio-manager.test.js` : Globalisation musicale, anti-réactivation après coupure manuelle, synchronisation inter-onglets et extinction totale au clic sur Quitter.
4. `tests/cookies.test.js` : Conformité du bandeau RGPD/CNIL, durées d'expiration (12 mois) et granularité du consentement.
5. `tests/daily-quests.test.js` : Déterminisme du PRNG Mulberry32, tirage Fisher-Yates et renouvellement à minuit.
6. `tests/db.test.js` : Isolation des comptes locaux, gestion des consommables, combos, bouclier d'étoile et persistance anti-triche des tentatives.
7. `tests/game-rules-and-session.test.js` : Règles pures, étoiles, bouclier, combos, multiplicateurs globaux et pipeline de soumission de quiz.
8. `tests/question-bank.test.js` : Déterminisme du générateur procédural, non-répétition et respect strict des programmes Collège / Lycée / Terminale.
9. `tests/quiz-engine.test.js` : Rendu et notation des 6 formats de questions avec algorithme Levenshtein.
10. `tests/quiz-timer.test.js` : Chronomètre fiable par horloge murale sur exercices consécutifs, réessais et expiration unique.

### B. Contrôle statique de syntaxe
Valide la syntaxe de l'ensemble des modules JavaScript du projet :

```bash
npm run check
```

### C. Banc de tests en navigateur (`test.html`)
Ouvrez simplement [test.html](file:///test.html) dans n'importe quel navigateur (y compris en local via le protocole `file://`).
- **Exécution complète des tests :** Affichage visuel clair avec temps d'exécution milliseconde par milliseconde et barre de progression.
- **Recherche & Filtres :** Filtrage instantané par catégorie (`Core`, `DB`, `Quêtes`, `Questions`, `Admin`, `Cookies`).
- **Benchmark de performance :** Mesure de la vitesse d'exécution moyenne sur plusieurs itérations consécutives.
- **Banc d'essai interactif :** Modale de test en direct permettant de tester et valider n'importe quelle question manuelle ou procédurale.

---

## 2. Ajouter ou modifier des questions

Les questions sont structurées dans `js/question-bank.js` et peuvent également être créées et modifiées dynamiquement depuis le panneau d'administration (`admin.html`).

Chaque matière dispose :
1. De leçons socles écrites à la main pour les premiers niveaux.
2. D'un générateur procédural déterministe (`generateProceduralQuestion`) capable d'étendre la matière jusqu'au niveau 100 de façon reproductible.
3. De variantes aléatoires tirées selon le niveau d'étude choisi.

### Formats de questions supportés par `QuizEngine` et validés par `AdminStore` :
1. **QCM (`type: 'qcm'`) :**
   ```javascript
   {
       q: "Quelle est la capitale de la France ?",
       opts: ["Paris", "Lyon", "Marseille", "Bordeaux"],
       correct: 0,
       hint: "C'est la ville lumière."
   }
   ```
2. **Vrai / Faux (`type: 'vrai_faux'`) :**
   ```javascript
   {
       q: "L'eau bout à 100 °C à la pression atmosphérique standard.",
       correct: true,
       hint: "Pense au niveau de la mer."
   }
   ```
3. **Réponse courte (`type: 'reponse_courte'`) :**
   ```javascript
   {
       q: "Quel est le participe passé du verbe peindre ?",
       accepted: ["peint", "Peint"]
   }
   ```
4. **Texte à trous (`type: 'texte_a_trous'`) :**
   ```javascript
   {
       type: "texte_a_trous",
       q: "Complète la formule :",
       textWithBlanks: "E = m * ___^2",
       blanks: [["c", "C"]],
       distractors: ["v", "a", "t"]
   }
   ```
5. **Texte avec menu déroulant (`type: 'texte_a_choix'`) :**
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
       q: "Associe chaque auteur à son œuvre :",
       items: ["Victor Hugo", "Molière"],
       targets: ["Les Misérables", "Le Tartuffe"],
       pairs: { "Victor Hugo": "Les Misérables", "Molière": "Le Tartuffe" }
   }
   ```

---

## 3. Règles de propreté et bonnes pratiques

- **Zéro dépendance intrusive :** Ne pas introduire de bibliothèques tierces volumineuses ou de CDN externes ; tout le code doit fonctionner hors-ligne.
- **Sécurité XSS :** Tout texte dynamique injecté via `innerHTML` doit impérativement être échappé avec `QuizEngine.esc()` ou `escapeHtml()`.
- **Isolation des utilisateurs :** Toute persistance de progression ou d'options doit être cloisonnée par compte utilisateur via les méthodes fournies par `DB`.
- **Compatibilité UMD :** Tout nouveau module Core ou utilitaire doit être exportable à la fois dans le navigateur (`window.*`) et dans Node.js (`module.exports`).
