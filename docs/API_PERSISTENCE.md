# Guide de Persistance & Schéma des Données — EDUQUEST

EDUQUEST implémente une couche d'accès aux données unifiée (`js/db.js`) capable de fonctionner dans deux modes transparents pour l'application :
1. **Mode Local (par défaut) :** Persistance 100 % hors-ligne dans le `localStorage` du navigateur avec isolation complète par profil d'élève.
2. **Mode API SQL (optionnel) :** Synchronisation réseau vers un backend d'établissement ou un serveur d'école (PHP / Node / Python + MySQL).

---

## 1. Mode Local (LocalStorage)

Toutes les clés sont préfixées par `eduquest_` pour éviter tout conflit avec d'autres applications :

| Clé | Type | Description |
|---|---|---|
| `eduquest_options` | `Object` | Préférences du joueur (volume sonore, plein écran, défi chrono, éco-énergie) |
| `eduquest_niveau` | `String` | Niveau scolaire sélectionné par l'élève (`6eme`, `5eme`, etc.) |
| `eduquest_session` | `Object` | Session active (`{ token, username }`) |
| `eduquest_local_users` | `Array` | Comptes locaux enregistrés (`{ email, username, password, role }`) |
| `eduquest_daily_quests` | `Object` | État des quêtes du jour et coffre bonus quotidien |
| `eduquest_boosters` | `Object` | Inventaire des potions et consommables (Double XP, Bouclier) |
| `eduquest_streak` | `Number` | Nombre de victoires consécutives |
| `eduquest_combo` | `Number` | Enchaînement de réponses justes consécutives |
| `eduquest_admin_data` | `Object` | Configuration globale, matières, leçons, IA et boutique (`AdminStore`) |
| `eduquest_cookie_consent` | `Object` | Choix de consentement RGPD (durée de validité 12 mois) |

### Structure détaillée de `eduquest_admin_data` :
```json
{
  "siteConfig": {
    "siteTitle": "EDUQUEST — Révision Gamifiée",
    "tagline": "Explore les îles du savoir !",
    "chronoQuestionSeconds": 30,
    "xpMultiplier": 1.0,
    "coinsMultiplier": 1.0,
    "soundVolume": 80,
    "musicVolume": 70,
    "allowRegistration": true
  },
  "aiConfig": {
    "generateWebhookUrl": "https://hook.eu2.make.com/...",
    "validateWebhookUrl": "https://hook.eu2.make.com/...",
    "fetchTimeoutMs": 8000,
    "fallbackToOffline": true
  },
  "matieres": [
    {
      "id": "technologie",
      "nom": "Technologie",
      "icon": "⚙️",
      "band": "college",
      "allowedNiveaux": ["6eme", "5eme", "4eme", "3eme"],
      "active": true
    }
  ],
  "matieres_lecons": {
    "mathematiques": [
      {
        "id": "math_6e_01",
        "type": "qcm",
        "q": "Combien font 7 x 8 ?",
        "opts": ["54", "56", "64", "49"],
        "correct": 1
      }
    ]
  },
  "boutique": [ ... ],
  "succes": [ ... ],
  "recompenses": { ... },
  "credits": { ... }
}
```

### Isolation des données par utilisateur
Quand un joueur se connecte avec un compte (`DB.login`), `db.js` ségrègue automatiquement ses clés via un préfixe d'utilisateur :
`eduquest_u_<username>_<clé>`. Ainsi, plusieurs élèves utilisant la même tablette ou le même ordinateur d'une salle de classe ne partagent ni leur progression, ni leurs pièces, ni leurs potions.

---

## 2. Mode API SQL (Mode Serveur)

Pour connecter l'application à un serveur distant :
1. Exécutez le script [schema.sql](file:///schema.sql) sur votre serveur MySQL.
2. Dans [js/db.js](file:///js/db.js), configurez la constante `API_URL` :
   ```javascript
   const API_URL = 'https://votre-domaine-scolaire.fr/api';
   ```

### Spécification des routes attendues par le backend :

#### Authentification & Joueur :
- `POST /auth/login` : `{ email, password }` → `{ token, username, role }`
- `POST /auth/register` : `{ email, username, password }` → `{ token, username }`
- `POST /auth/logout` : `{}` → `{ ok: true }`
- `GET /options` : lit les options de jeu du joueur connecté
- `POST /options` : `{ cle, valeur }`
- `GET /progression/:matiere/:niveau` : récupère les étoiles et niveaux débloqués
- `POST /progression` : `{ matiere, niveau, data }`
- `GET /quests/daily` : récupère l'état des quêtes journalières
- `POST /quests/daily` : met à jour la progression ou réclame une récompense

#### Administration & Configuration :
- `GET /admin/config/site` : récupère la configuration globale du site
- `POST /admin/config/site` : enregistre la configuration globale (`siteConfig`)
- `GET /admin/config/ai` : récupère les réglages de l'IA et Webhooks Make
- `POST /admin/config/ai` : met à jour les webhooks et le timeout réseau
- `GET /admin/subjects` : liste des matières, cycles rattachés et classes autorisées
- `POST /admin/subjects` : mise à jour ou création d'une matière
- `GET /admin/lessons/:matiere` : récupère les leçons manuelles d'une matière
- `POST /admin/lessons/:matiere` : enregistre la liste des leçons d'une matière
