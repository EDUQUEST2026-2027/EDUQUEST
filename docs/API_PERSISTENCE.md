# Guide de Persistance & Schéma des Données — EDUQUEST (v1.30.0)

EDUQUEST implémente une couche d'accès aux données unifiée (`js/db.js`) capable de fonctionner dans deux modes transparents pour l'application :
1. **Mode Local (par défaut) :** Persistance 100 % hors-ligne dans le `localStorage` du navigateur avec isolation complète par profil d'élève.
2. **Mode API SQL (optionnel) :** Synchronisation réseau vers un backend d'établissement ou un serveur d'école (PHP / Node / Python + MySQL).

---

## 1. Mode Local (LocalStorage)

Toutes les clés sont préfixées par `eduquest_` pour éviter tout conflit avec d'autres applications. Les clés marquées `<scope>` sont cloisonnées par compte (`guest` pour un invité, ou identifiant normalisé du joueur connecté) :

| Clé | Type | Description |
|---|---|---|
| `eduquest_opts_<scope>` *(et `eduquest_options` invité)* | `Object` | Préférences du joueur (audio, particules, animations, apparence, mode chrono, éco-énergie, XP/pièces/skins/thème/avatar/titre équipés, état replié missions/menu bas mobile) |
| `eduquest_niveau_<scope>` *(et `eduquest_niveau` invité)* | `String` | Niveau scolaire sélectionné par l'élève (`6eme` → `terminale`, `bts1`, `bts2`) |
| `eduquest_filiere_<scope>` *(et `eduquest_filiere` invité)* | `String` | Filière scolaire sélectionnée au lycée/BTS parmi les 18 filières officielles (`generale`, `nsi_spe`, `stmg`, `sti2d`, `ciel`, `st2s`, `stl`, `std2a`, `sthr`, `stav`, `s2tmd`, `hlp_llce`, `sciences_spe`, `bts_sio`, `bts_mco`, `bts_cg`, `bac_pro_melec`, `bac_pro_assp`) |
| `eduquest_prog_<scope>_<matiere>_<niveau>` | `Object` | Progression détaillée par matière et par classe (`{ levels: { "1": { unlocked, stars }, ... } }`) |
| `eduquest_session` | `Object` | Session active (`{ token, username, email, role }`) |
| `eduquest_local_users` | `Array` | Comptes locaux enregistrés (`{ email, username, password, role, created }`) — mots de passe hachés SHA-256 (`sh_*`) |
| `eduquest_quests_<scope>` *(et `eduquest_daily_quests`)* | `Object` | État des quêtes du jour et coffre bonus quotidien |
| `eduquest_boosters_<scope>` | `Object` | Stock de potions consommables (`boost-xp`, `boost-shield`, `boost-coins`, `boost-time`, `boost-combo`) |
| `eduquest_boosters_history_<scope>` | `Object` | Historique des potions acquises et utilisées (`{ acquired: {}, used: {} }`) pour les succès |
| `eduquest_streak_<scope>` | `Object` | Série de victoires et combo (`{ count, best, combo, maxCombo, lastPlayedDate }`) |
| `eduquest_attempts_<scope>` | `Object` | Suivi anti-triche par niveau (erreurs persistées, bouclier consommé, sel de réinitialisation, signatures ratées) |
| `eduquest_adaptive_<scope>` | `Object` | Historique anti-répétition (jusqu'à 240 signatures FIFO) et palier adaptatif par matière et par classe |
| `eduquest_audio_manual_mute` | `String` | État de coupure audio manuelle (`'true'` / `'false'`) empêchant toute réactivation parasite |
| `eduquest_current_track` / `eduquest_music_time` | `String` | Piste musicale et position temporelle pour la continuité inter-pages |
| `eduquest_admin_data` | `Object` | Configuration globale, niveaux, filières, matières, leçons, boutique, succès, quêtes, pool Multi-IA et crédits (`AdminStore`) |
| `eduquest_cookie_consent` | `Object` | Choix de consentement RGPD/CNIL (durée de validité 12 mois) |

### Structure réelle de `eduquest_admin_data` (`AdminStore`, format `v: 1`) :
```json
{
  "v": 1,
  "levels": null,
  "filieres": null,
  "subjects": {
    "overrides": {
      "maths": {
        "name": "Mathématiques",
        "band": "all",
        "allowedNiveaux": ["6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "terminale", "bts1", "bts2"],
        "allowedFilieres": ["all"],
        "specialtyFilieres": ["sciences_spe"],
        "enabled": true,
        "lessons": []
      }
    },
    "customs": []
  },
  "shop": {
    "overrides": {},
    "customs": []
  },
  "badges": {
    "overrides": {},
    "customs": []
  },
  "quests": null,
  "rewards": {
    "xpBase": 15,
    "coinsBase": 10,
    "chronoBonusMaxXp": 15,
    "dailyChestCoins": 50,
    "firstTryBonusXp": 10,
    "questRewardMultiplier": 1
  },
  "siteConfig": {
    "title": "EDUQUEST",
    "tagline": "Le jeu de révision Collège, Lycée & BTS",
    "announcement": "",
    "defaultNiveau": "6eme",
    "defaultFiliere": "generale",
    "quizTimerSeconds": 45,
    "xpMultiplier": 1.0,
    "coinMultiplier": 1.0,
    "defaultSfxVolume": 60,
    "defaultBgmVolume": 35,
    "soundEnabledByDefault": true,
    "allowRegistration": true,
    "enableShop": true,
    "enableQuests": true,
    "enableBadges": true,
    "enableChrono": true,
    "enableParticlesByDefault": true,
    "enableConfetti": true,
    "maintenanceMode": false,
    "maintenanceMessage": ""
  },
  "aiConfig": {
    "generateWebhookUrl": "",
    "validateWebhookUrl": "",
    "providers": [],
    "adaptiveMode": true,
    "selectionStrategy": "random",
    "fetchTimeoutMs": 8000,
    "fallbackToOffline": true
  },
  "credits": {}
}
```

### Isolation des données par utilisateur
Lorsqu'un joueur se connecte (`DB.login`), `db.js` cloisonne automatiquement toutes ses données via son identifiant de portée (`_userScope()`). Ainsi, plusieurs élèves utilisant la même tablette ou le même poste en salle informatique ne partagent ni leur classe, ni leur filière, ni leur progression, ni leurs pièces, ni leurs boosters, ni leurs succès.

---

## 2. Mode API SQL (Mode Serveur)

Pour connecter l'application à un serveur distant :
1. Exécutez le script [schema.sql](../schema.sql) sur votre serveur MySQL/MariaDB (ou adaptez-le pour PostgreSQL / SQLite).
2. Dans [js/db.js](../js/db.js), configurez la constante `API_URL` :
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
- `GET /admin/config/site` : récupère la configuration globale du site (`siteConfig`)
- `POST /admin/config/site` : enregistre la configuration globale (`siteConfig`)
- `GET /admin/config/ai` : récupère les réglages de l'IA et Webhooks Make (`aiConfig`)
- `POST /admin/config/ai` : met à jour le pool Multi-IA, les webhooks et le timeout réseau
- `GET /admin/subjects` : liste des 36 matières officielles (+ personnalisées), cycles, classes et filières autorisées
- `POST /admin/subjects` : mise à jour ou création d'une matière
- `GET /admin/lessons/:matiere` : récupère les leçons manuelles d'une matière
- `POST /admin/lessons/:matiere` : enregistre la liste des leçons d'une matière
