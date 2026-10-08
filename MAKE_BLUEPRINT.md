# EDUQUEST — Générer les niveaux avec un agent IA sur Make

## Pourquoi ce document

Aujourd'hui, `question-bank.js` génère les niveaux 6 à 100 de façon **déterministe** : rouvrir le niveau 47 en maths donne toujours le même calcul. C'est voulu pour la cohérence de la progression, mais ça a un défaut réel que tu pointes : un élève peut donner la réponse à un camarade qui tombera sur exactement la même question.

La solution : un **agent IA hébergé sur Make** qui génère chaque question à la demande, au moment où l'élève ouvre le niveau — jamais deux fois exactement la même question, et la bonne réponse ne transite jamais vers le navigateur avant que l'élève ait répondu.

Ce document te donne :
1. L'architecture (2 scénarios Make)
2. Les instructions pas-à-pas pour les construire
3. Le prompt exact à donner à l'IA
4. Le code déjà prêt côté jeu (`ai-provider.js`), qui **fonctionne dès aujourd'hui en mode local** et bascule automatiquement sur Make dès que tu renseignes les deux URLs de webhook.

## 1. Vue d'ensemble

```
Élève ouvre un niveau
        │
        ▼
┌─────────────────────┐   POST {subjectId, index, niveauBand}
│  ai-provider.js       │ ─────────────────────────────────────▶  Scénario Make #1
│  (dans le navigateur) │                                          "Generate Level"
└─────────────────────┘ ◀─────────────────────────────────────
        │                 { questionId, lesson SANS la réponse }
        │
   Élève répond
        │
        ▼
┌─────────────────────┐   POST {questionId, answer}
│  ai-provider.js       │ ─────────────────────────────────────▶  Scénario Make #2
└─────────────────────┘                                          "Validate Answer"
        ▲                ◀─────────────────────────────────────
        │                 { isCorrect, explanation, answerKey }
   Affiche le résultat
```

Le point clé : le scénario #1 **génère et stocke** la question complète (avec la réponse) dans un Data Store Make, mais ne renvoie au navigateur que la version sans réponse. Le scénario #2 va relire ce Data Store pour corriger — la bonne réponse ne quitte jamais Make avant que l'élève ait répondu.

## 2. Construire le scénario #1 — "EDUQUEST – Generate Level"

### Module 1 : Webhooks → Custom webhook
- Crée un nouveau webhook, note son URL (ex. `https://hook.eu2.make.com/abc123`).
- Corps JSON attendu :
  ```json
  { "subjectId": "maths", "index": 47, "niveauBand": "college" }
  ```
- `subjectId` : un des 9 identifiants déjà utilisés côté jeu (`maths`, `francais`, `physique`, `svt`, `techno`, `anglais`, `histoire`, `geo`, `emc`).
- `niveauBand` : `"college"` ou `"lycee"` (déjà calculé côté jeu par `QuestionBank.bandForNiveau`).

### Module 2 : un générateur d'aléa (Tools → Set variable)
Crée une variable `nonce` = une fonction Make du type `random()` ou `uuid()`. Ce nonce est injecté dans le prompt pour forcer l'IA à varier sa réponse à chaque appel, même pour le même sujet — sans lui, un modèle a tendance à re-proposer ses exemples "par défaut" (ex. toujours "la capitale de la France").

### Module 3 : l'appel IA (module "Anthropic Claude" de Make, ou HTTP → Make a request si le module natif n'est pas disponible sur ton plan)
Configure l'appel avec :
- **Modèle** : Claude (Sonnet suffit largement pour ce type de génération courte).
- **Température** : 0.9 (favorise la variété — trop bas, l'IA répète les mêmes exemples).
- **System prompt** (à copier tel quel) :

```
Tu es un générateur de questions pédagogiques pour EDUQUEST, une application
française de révision gamifiée pour les élèves de la 6e à la Terminale.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans balises markdown, sans
  texte avant ou après.
- Le contenu doit être factuellement exact. En cas de doute sur un fait,
  choisis un fait plus simple mais certain plutôt qu'un fait précis mais
  incertain.
- Adapte la difficulté au niveau demandé : "college" = 6e à 3e (notions de
  base), "lycee" = 2nde à Terminale (notions plus avancées, vocabulaire plus
  précis).
- Varie systématiquement le sujet précis de la question par rapport aux
  exemples évidents du domaine — utilise le nonce fourni comme graine
  d'inspiration pour changer d'angle à chaque génération.
- Le format doit correspondre EXACTEMENT à l'un des 5 schémas ci-dessous,
  selon le type choisi.

SCHÉMAS AUTORISÉS (choisis-en un, adapté à la matière) :

qcm:
{ "type": "qcm", "title": "<titre court>", "q": "<question>",
  "opts": ["<choix1>","<choix2>","<choix3>","<choix4>"],
  "correctIndex": <0 à 3>, "exp": "<explication brève>" }

vrai_faux:
{ "type": "vrai_faux", "title": "<titre court>", "q": "<affirmation>",
  "correct": <true ou false>, "exp": "<explication brève>" }

reponse_courte:
{ "type": "reponse_courte", "title": "<titre court>", "q": "<question>",
  "accepted": ["<réponse1>","<variante orthographique éventuelle>"],
  "exp": "<explication brève>" }

texte_a_trous:
{ "type": "texte_a_trous", "title": "<titre court>",
  "q": "Complète la phrase.",
  "textWithBlanks": "<phrase avec ___ pour chaque trou>",
  "blanks": [["<réponse trou 1>"], ["<réponse trou 2>"]],
  "exp": "<explication brève>" }

drag_and_drop:
{ "type": "drag_and_drop", "title": "<titre court>", "q": "<consigne>",
  "items": ["<item1>","<item2>","<item3>"],
  "targets": ["<cible1>","<cible2>","<cible3>"],
  "pairs": { "<item1>": "<cible correspondante>", "<item2>": "<cible correspondante>" },
  "exp": "<explication brève>" }
```

- **User prompt** (avec les variables Make entre `{{ }}`) :
```
Matière : {{subjectId}}
Niveau : {{niveauBand}}
Numéro de niveau (juste pour info, n'influence pas le contenu) : {{index}}
Graine de variété (change ton angle d'approche à chaque fois) : {{nonce}}

Génère une seule question, au format JSON demandé dans les instructions système.
```

### Module 4 : Tools → Parse JSON
- Parse la réponse texte de l'IA avec le schéma correspondant aux 5 formats ci-dessus (Make génère automatiquement un schéma si tu lui donnes un exemple de chaque type).
- Ajoute un module **Router** juste après : une branche "JSON valide" (continue), une branche "erreur de parsing" (relance le module IA une seconde fois avec un rappel du format, ou retombe sur une question de secours fixe — voir note en fin de document).

### Module 5 : Data Stores → Add/replace a record
- Crée un Data Store `eduquest_questions` avec les colonnes : `question_id` (clé), `subject_id`, `niveau_band`, `payload` (JSON complet, AVEC la réponse), `created_at`.
- `question_id` = un nouvel `uuid()`.
- `payload` = l'objet JSON complet parsé au module 4.

### Module 6 : Tools → Compose a string / Set variable — retirer la réponse
Construit un objet `public_lesson` qui reprend tous les champs SAUF ceux qui révèlent la réponse, selon le type (`type` vient du JSON généré) :
| Type | Champs à garder | Champs à retirer |
|---|---|---|
| `qcm` | `type, title, q, opts` | `correctIndex` |
| `vrai_faux` | `type, title, q` | `correct` |
| `reponse_courte` | `type, title, q` | `accepted` |
| `texte_a_trous` | `type, title, q, textWithBlanks`, + `blankCount` (longueur de `blanks`) | `blanks` |
| `drag_and_drop` | `type, title, q, items, targets` | `pairs` |

Un Router (comme au module 4) avec une branche par type est la façon la plus simple de faire ce tri dans l'interface Make.

### Module 7 : Webhooks → Webhook response
```json
{ "questionId": "{{question_id}}", "lesson": {{public_lesson}} }
```

## 3. Construire le scénario #2 — "EDUQUEST – Validate Answer"

### Module 1 : Webhooks → Custom webhook
Corps attendu :
```json
{ "questionId": "abc-123", "answer": <dépend du type — voir quiz-engine.js> }
```

### Module 2 : Data Stores → Get a record
Recherche `question_id` = `{{questionId}}` dans `eduquest_questions`. Récupère `payload` (avec la réponse) et `subject_id`.

### Module 3 : Router — un cas par `payload.type`
Cinq branches, une logique de comparaison par type (fonctions Make natives, pas besoin d'IA ici — c'est plus fiable) :
- `qcm` : `{{answer}} = {{payload.correctIndex}}`
- `vrai_faux` : `{{answer}} = {{payload.correct}}`
- `reponse_courte` : normalise (minuscule, sans accents, `trim`) et compare à chaque élément de `payload.accepted`
- `texte_a_trous` : compare chaque élément de `answer` (tableau) à `payload.blanks[i]`
- `drag_and_drop` : compare l'objet `answer` à `payload.pairs`

### Module 4 : Tools → Set variable
Construit `answerKey`, la partie de `payload` à renvoyer maintenant que l'élève a répondu (permet au jeu de surligner la bonne réponse) :
- `qcm` → `{ "correct": payload.correctIndex }`
- `vrai_faux` → `{ "correct": payload.correct }`
- `texte_a_trous` → `{ "blanks": payload.blanks }`
- `drag_and_drop` → `{ "pairs": payload.pairs }`
- `reponse_courte` → `{}` (pas de surlignage positionnel nécessaire)

### Module 5 : Webhooks → Webhook response
```json
{ "isCorrect": <bool>, "explanation": "{{payload.exp}}", "answerKey": {{answerKey}} }
```

### (Optionnel) Module 6 : Data Stores → Delete a record
Supprime l'entrée après usage — évite d'accumuler indéfiniment des questions consommées. À faire seulement une fois que tu as vérifié que tout fonctionne, pour ne pas perdre de données en débogant.

## 4. Note sur le coût et la fiabilité

- Un appel IA par niveau ouvert a un coût (tokens Anthropic) — négligeable à l'usage d'une classe, mais à surveiller si le trafic grossit. Le mode local (déjà en place) reste le filet de sécurité : si Make est indisponible ou lent, le jeu continue de fonctionner avec `question-bank.js`.
- Prévois une question de secours fixe (une par matière) à renvoyer si le Router du module 4 (scénario #1) tombe deux fois de suite sur du JSON invalide — pour ne jamais laisser un élève face à une modale vide.
- Le nonce ne garantit pas une variété parfaite (un LLM peut quand même répéter ses exemples les plus évidents) : si tu observes trop de répétitions à l'usage, on pourra enrichir le prompt avec un historique des dernières questions posées pour cette matière (stocké dans un second Data Store), à exclure explicitement.

## 5. Ce qui est déjà prêt côté jeu

Le fichier `ai-provider.js` (livré avec ce zip) sait déjà parler à ces deux webhooks. Tant que tu n'as pas renseigné leurs URLs dedans, le jeu utilise uniquement `question-bank.js` en local — **rien ne change dans le comportement actuel**. Dès que tu colles les deux URLs, le mode IA prend le relais automatiquement, avec repli silencieux sur le mode local si jamais Make met plus de 6 secondes à répondre ou renvoie une erreur.

Depuis la v1.18, **le dashboard ET la carte (map.html) passent tous les deux par ce même flux** : la question est générée côté serveur quand l'IA est configurée (et corrigée côté serveur via le scénario #2 — la bonne réponse n'arrive jamais dans le navigateur avant la soumission), et en mode local la carte conserve ses leçons 1 à 5 écrites à la main. Un seul point d'entrée, deux pages, même sécurité.

Voir les deux constantes en haut de `ai-provider.js` :
```js
const GENERATE_WEBHOOK_URL = ''; // ← colle ici l'URL du scénario #1
const VALIDATE_WEBHOOK_URL = ''; // ← colle ici l'URL du scénario #2
```

## 6. Ce qui n'est pas encore branché

- Le flux `map.html` (la carte de progression) utilise encore uniquement `question-bank.js` en local — seul le dashboard (`dashboard.html`) appelle `ai-provider.js` pour l'instant. Une fois que tu auras testé et validé les deux scénarios Make depuis le dashboard, je peux faire le même branchement sur `map.html`.
- Aucun mécanisme n'empêche encore une IA de reproduire deux fois la même question à quelques niveaux d'écart pour un même élève (seulement d'éviter que deux élèves différents tombent sur la même chose au même niveau). Si c'est important pour toi, on ajoutera un historique par élève au scénario Make.
