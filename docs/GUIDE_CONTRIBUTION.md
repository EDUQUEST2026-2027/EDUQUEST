# Guide de Contribution & Maintenance — EDUQUEST

Ce guide décrit l'ensemble des bonnes pratiques, flux de tests et protocoles d'extension du projet EDUQUEST.

---

## 1. Exécution des tests automatisés

Le projet dispose de deux environnements de tests complémentaires sans aucune dépendance npm externe.

### A. Tests Node.js (CLI)
Exécute la suite complète de 45 tests unitaires via le exécuteur natif `node:test` :

```bash
npm test
```
*Ou directement :*
```bash
node --test tests/*.test.js
```

### B. Contrôle statique de syntaxe
Valide la syntaxe de l'ensemble des 11 modules JavaScript :

```bash
npm run check
```

### C. Banc de tests en navigateur (`test.html`)
Ouvrez simplement `test.html` dans n'importe quel navigateur (y compris en local via le protocole `file://`).
- Interface visuelle complète avec indicateurs colorés, temps d'exécution milliseconde par milliseconde et barre de progression.
- Teste l'intégration réelle des modules dans l'environnement DOM du navigateur.

---

## 2. Ajouter ou modifier des questions

Les questions sont structurées dans `js/question-bank.js`. Chaque matière dispose :
1. De leçons socles écrites à la main pour les premiers niveaux.
2. D'un générateur procédural déterministe (`generateProceduralQuestion`) capable d'étendre la matière jusqu'au niveau 100 de façon reproductible.

### Formats de questions supportés par `QuizEngine` :
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
       q: "Complète la formule :",
       textWithBlanks: "E = m * ___^2",
       blanks: [["c", "C"]],
       wordBank: ["c", "v", "a", "t"]
   }
   ```
5. **Texte avec menu déroulant (`type: 'texte_a_choix'`) :**
   ```javascript
   {
       q: "Sélectionne le bon connecteur logique :",
       textWithBlanks: "Il pleut, [___] je prends mon parapluie.",
       choices: [["donc", "mais", "car", "or"]],
       correct: [0]
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

## 3. Règles de propreté du code

- **Zéro dépendance intrusive :** Ne pas introduire de bibliothèques tierces volumineuses ou de CDN externes ; tout le code doit fonctionner hors-ligne.
- **Sécurité XSS :** Tout texte dynamique injecté via `innerHTML` doit impérativement être échappé avec `QuizEngine.esc()` ou `escapeHtml()`.
- **Isolation des utilisateurs :** Toute persistance de progression ou d'options doit être cloisonnée par compte utilisateur via les méthodes fournies par `DB`.
