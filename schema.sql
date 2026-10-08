-- =============================================================================
-- SCHEMA.SQL — EDUQUEST v2.0
-- Script de création de la base de données SQL
-- =============================================================================
--
-- RÔLE DE CE FICHIER :
-- Ce fichier contient la structure complète de la base de données du jeu
-- EDUQUEST. Il doit être importé dans votre serveur de base de données
-- avant d'activer le mode API dans db.js.
--
-- COMMENT IMPORTER CE FICHIER :
--   MySQL / MariaDB :
--     mysql -u root -p < schema.sql
--     (ou via phpMyAdmin : Importer → sélectionner ce fichier)
--
--   PostgreSQL :
--     psql -U postgres -d eduquest -f schema.sql
--     (Adapter la syntaxe : remplacer INT AUTO_INCREMENT par SERIAL,
--      DATETIME par TIMESTAMP, etc.)
--
--   SQLite (développement local simple) :
--     sqlite3 eduquest.db < schema.sql
--     (Attention : SQLite ne supporte pas toutes les commandes MySQL)
--
-- STRUCTURE DE LA BASE (3 tables + 2 vues) :
--   joueurs      → Comptes utilisateurs (email, pseudo, mot de passe hashé)
--   parametres   → Options/préférences par joueur (volume, plein écran…)
--   progression  → Avancement par joueur, matière et niveau scolaire
--   v_progression_joueur → Vue : progression détaillée (lecture)
--   v_resume_joueur      → Vue : résumé par matière (statistiques)
--
-- CONNEXION AVEC LE FRONTEND (db.js) :
--   La variable API_URL dans db.js doit pointer vers un backend qui expose
--   ces routes REST et lit/écrit dans cette base de données.
--   Voir db.js pour la liste complète des routes attendues.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Création et sélection de la base de données
-- (MySQL/MariaDB uniquement — commenter ces deux lignes pour PostgreSQL/SQLite)
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS eduquest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- utf8mb4 : support complet de l'Unicode (y compris les emojis des matières)
-- unicode_ci : tri insensible à la casse pour les chaînes françaises
USE eduquest;

-- =============================================================================
-- TABLE : joueurs
-- Stocke un enregistrement par compte utilisateur.
-- =============================================================================
-- Correspondance avec db.js :
--   DB.login(email, password)       → SELECT par email + vérification bcrypt
--   DB.register(email, username, password) → INSERT nouveau joueur
--   DB.logout()                     → UPDATE token = NULL
-- =============================================================================
CREATE TABLE IF NOT EXISTS joueurs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    -- Identifiant unique interne (jamais exposé au joueur)
    -- AUTO_INCREMENT : généré automatiquement par la base (1, 2, 3…)

    email         VARCHAR(255)  NOT NULL UNIQUE,
    -- Email = identifiant de connexion. UNIQUE interdit les doublons.
    -- VARCHAR(255) : taille maximale standard pour les emails

    username      VARCHAR(100)  NOT NULL,
    -- Pseudo affiché dans le jeu (pas nécessairement unique)
    -- Peut être changé ultérieurement sans impacter les autres tables
    -- (les relations utilisent joueur.id, pas username)

    password_hash VARCHAR(255)  NOT NULL,
    -- Mot de passe hashé avec bcrypt (ou argon2) côté serveur backend
    -- ⚠ Ne jamais stocker le mot de passe en clair !
    -- Le hash bcrypt ressemble à : $2y$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

    token         VARCHAR(512)  DEFAULT NULL,
    -- Token de session JWT (JSON Web Token) ou token aléatoire
    -- NULL = joueur déconnecté
    -- Le token est envoyé dans le header Authorization: Bearer <token>
    -- par db.js à chaque requête API (voir apiRequest dans db.js)

    google_id     VARCHAR(255)  DEFAULT NULL,
    -- Identifiant Google OAuth (pour la connexion "Se connecter avec Google")
    -- NULL si le compte n'a pas été lié à Google
    -- À remplir quand la connexion Google OAuth sera implémentée dans db.js

    cree_le       DATETIME      DEFAULT NOW(),
    -- Date et heure de création du compte (remplie automatiquement)

    derniere_cnx  DATETIME      DEFAULT NOW()
    -- Date et heure de la dernière connexion réussie
    -- À mettre à jour dans le backend lors de chaque login réussi
);

-- Index pour accélérer les recherches par email (utilisé à chaque connexion)
CREATE INDEX IF NOT EXISTS idx_joueurs_email ON joueurs(email);

-- Index pour accélérer la vérification des tokens (utilisé à chaque requête API)
CREATE INDEX IF NOT EXISTS idx_joueurs_token ON joueurs(token);

-- =============================================================================
-- TABLE : parametres
-- Stocke les préférences du jeu pour chaque joueur, sous forme clé → valeur.
-- Un enregistrement par option par joueur.
-- =============================================================================
-- Correspondance avec db.js :
--   DB.getOption(name)                   → SELECT valeur WHERE joueur_id=... AND cle=name
--   DB.saveOption(name, value)           → INSERT ... ON DUPLICATE KEY UPDATE valeur=...
--   DB.syncOptionsFromServer()           → SELECT * WHERE joueur_id=...
-- =============================================================================
-- Exemples de données pour un joueur :
--   joueur_id=1, cle='volumeMusique', valeur='75'
--   joueur_id=1, cle='pleinEcran',   valeur='false'
--   joueur_id=1, cle='sonsActifs',   valeur='true'
-- =============================================================================
CREATE TABLE IF NOT EXISTS parametres (
    id          INT AUTO_INCREMENT PRIMARY KEY,

    joueur_id   INT          NOT NULL,
    -- Référence au joueur propriétaire de cette option
    -- Doit correspondre à un id existant dans la table joueurs

    cle         VARCHAR(100) NOT NULL,
    -- Nom de l'option. Correspond exactement aux noms utilisés dans db.js/app.js :
    --   'volumeMusique'  → volume de la musique (0 à 100)
    --   'volumeEffets'   → volume des effets sonores (0 à 100)
    --   'sonsActifs'     → son global activé ('true'/'false')
    --   'musiqueActive'  → musique de fond activée ('true'/'false')
    --   'effetsActifs'   → effets sonores activés ('true'/'false')
    --   'pleinEcran'     → mode plein écran ('true'/'false')
    --   'particules'     → nuages et particules affichés ('true'/'false')
    --   'vsync'          → V-Sync visuelle ('true'/'false')
    --   'niveau_actuel'  → niveau scolaire sélectionné ('6eme', '5eme'…)

    valeur      VARCHAR(500) NOT NULL,
    -- Valeur de l'option, TOUJOURS stockée comme chaîne de caractères
    -- Les booléens sont 'true' ou 'false', les nombres sont '75', '100', etc.

    modifie_le  DATETIME     DEFAULT NOW(),
    -- Date de dernière modification de cette option

    -- Clé étrangère : si le joueur est supprimé, ses options sont supprimées aussi
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,

    -- Contrainte d'unicité : un joueur ne peut avoir qu'une valeur par clé
    -- ON DUPLICATE KEY UPDATE (MySQL) permet de faire un "upsert" (insert ou update)
    UNIQUE KEY uq_joueur_cle (joueur_id, cle)
);

-- Index pour charger rapidement toutes les options d'un joueur
CREATE INDEX IF NOT EXISTS idx_parametres_joueur ON parametres(joueur_id);

-- =============================================================================
-- TABLE : progression
-- Stocke l'avancement d'un joueur pour chaque niveau de chaque matière.
-- Un enregistrement par niveau (1 à 6) par matière par niveau scolaire par joueur.
-- =============================================================================
-- Correspondance avec db.js :
--   DB.loadProgress(matiere, niveau)           → SELECT * WHERE joueur_id=... AND matiere=... AND niveau=...
--   DB.saveProgress(matiere, niveau, data)     → INSERT/UPDATE chaque niveau
-- =============================================================================
-- Exemple de données pour un joueur en 6ème en Mathématiques :
--   joueur_id=1, matiere='mathématiques', niveau='6eme', niveau_num=1, etoiles=3, debloque=TRUE
--   joueur_id=1, matiere='mathématiques', niveau='6eme', niveau_num=2, etoiles=1, debloque=TRUE
--   joueur_id=1, matiere='mathématiques', niveau='6eme', niveau_num=3, etoiles=0, debloque=TRUE
--   joueur_id=1, matiere='mathématiques', niveau='6eme', niveau_num=4, etoiles=0, debloque=FALSE
-- =============================================================================
CREATE TABLE IF NOT EXISTS progression (
    id           INT AUTO_INCREMENT PRIMARY KEY,

    joueur_id    INT          NOT NULL,
    -- Référence au joueur (relation avec la table joueurs)

    matiere      VARCHAR(100) NOT NULL,
    -- Nom de la matière en minuscules sans accents de préférence.
    -- Correspondance avec les URL de map.html :
    --   map.html?matiere=Mathématiques → stocker 'mathématiques'
    --   map.html?matiere=Français      → stocker 'français'
    --   map.html?matiere=Histoire      → stocker 'histoire'
    --   map.html?matiere=SVT           → stocker 'svt'
    --   map.html?matiere=Anglais       → stocker 'anglais'
    --   map.html?matiere=Physique      → stocker 'physique'

    niveau       VARCHAR(50)  NOT NULL,
    -- Niveau scolaire (ex: '6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale')
    -- Correspond à la valeur sauvegardée par DB.setNiveau() dans db.js

    niveau_num   INT          NOT NULL,
    -- Numéro du niveau dans la matière (de 1 à TOTAL_LEVELS = 6)
    -- Correspond à l'attribut data-level des boutons .level-dot dans map.html

    etoiles      TINYINT      DEFAULT 0,
    -- Nombre d'étoiles gagnées sur ce niveau (0, 1, 2 ou 3)
    -- 0 = pas encore terminé ou niveau verrouillé
    -- TINYINT : entier sur 1 octet (suffisant pour 0-3)

    debloque     BOOLEAN      DEFAULT FALSE,
    -- true si le niveau est accessible au joueur, false sinon
    -- Le niveau 1 est toujours débloqué à la création.
    -- Les autres sont débloqués quand le niveau précédent est terminé (voir app.js)

    termine_le   DATETIME     DEFAULT NULL,
    -- Date de première complétion du niveau (null si jamais terminé)
    -- À renseigner dans le backend lors de la première obtention d'étoiles

    modifie_le   DATETIME     DEFAULT NOW(),
    -- Date de dernière modification (mise à jour automatique recommandée)

    -- Clé étrangère avec suppression en cascade
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,

    -- Contrainte d'unicité : un seul enregistrement par combinaison joueur/matière/niveau/numéro
    UNIQUE KEY uq_progression (joueur_id, matiere, niveau, niveau_num)
);

-- Index pour charger rapidement toute la progression d'un joueur
CREATE INDEX IF NOT EXISTS idx_progression_joueur  ON progression(joueur_id);

-- Index optimisé pour la requête la plus fréquente (GET /progression/:matiere/:niveau)
CREATE INDEX IF NOT EXISTS idx_progression_mat_niv ON progression(joueur_id, matiere, niveau);

-- =============================================================================
-- VUES — Requêtes précalculées pour simplifier les lectures côté serveur
-- Les vues ne stockent pas de données, elles sont recalculées à chaque appel.
-- =============================================================================

-- Vue : progression complète et lisible de tous les joueurs (toutes matières)
-- Utile pour un tableau de bord administrateur ou un système de classement
CREATE OR REPLACE VIEW v_progression_joueur AS
SELECT
    j.username,       -- Pseudo du joueur
    j.email,          -- Email du joueur
    p.matiere,        -- Matière concernée
    p.niveau,         -- Niveau scolaire
    p.niveau_num,     -- Numéro du niveau dans la matière
    p.etoiles,        -- Étoiles gagnées
    p.debloque,       -- Niveau accessible ?
    p.termine_le      -- Date de complétion
FROM progression p
JOIN joueurs j ON j.id = p.joueur_id  -- Jointure pour avoir le username/email
ORDER BY j.username, p.matiere, p.niveau, p.niveau_num;

-- Vue : résumé statistique par joueur et par matière
-- Utile pour afficher le profil d'un joueur avec ses scores globaux
CREATE OR REPLACE VIEW v_resume_joueur AS
SELECT
    j.username,                          -- Pseudo du joueur
    p.matiere,                           -- Matière
    p.niveau,                            -- Niveau scolaire
    COUNT(p.id)       AS niveaux_total,  -- Nombre total de niveaux dans la matière
    SUM(p.etoiles)    AS etoiles_total,  -- Total des étoiles gagnées dans la matière
    SUM(p.debloque)   AS niveaux_debloques  -- Combien de niveaux sont accessibles
FROM progression p
JOIN joueurs j ON j.id = p.joueur_id
GROUP BY j.id, p.matiere, p.niveau;     -- Un résumé par joueur + matière + niveau scolaire

-- =============================================================================
-- DONNÉES DE TEST — À SUPPRIMER AVANT LA MISE EN PRODUCTION
-- Ces données permettent de tester le site sans créer de vrai compte.
-- =============================================================================

-- Joueur de test avec un compte fictif
-- ⚠ Le password_hash ici est un placeholder ! En vrai, il faudra :
--    1. Prendre un vrai mot de passe (ex: "test1234")
--    2. Le hasher avec bcrypt côté serveur (ex PHP: password_hash("test1234", PASSWORD_BCRYPT))
--    3. Remplacer la valeur ci-dessous par le hash généré
INSERT IGNORE INTO joueurs (email, username, password_hash)
VALUES ('test@eduquest.fr', 'JoueurTest', '$2y$10$examplehashplaceholder1234567890');
-- INSERT IGNORE : ne fait rien si l'email existe déjà (évite les erreurs à la réimportation)

-- Options par défaut pour le joueur de test (id=1)
-- Ces valeurs correspondent aux valeurs par défaut de l'interface dans app.js
INSERT IGNORE INTO parametres (joueur_id, cle, valeur) VALUES
    (1, 'volumeMusique', '75'),    -- Volume musique : 75%
    (1, 'volumeEffets',  '80'),    -- Volume effets : 80%
    (1, 'sonsActifs',    'true'),  -- Sons globaux : activé
    (1, 'musiqueActive', 'true'),  -- Musique : activée
    (1, 'effetsActifs',  'true'),  -- Effets sonores : activés
    (1, 'particules',    'true'),  -- Nuages et particules : affichés
    (1, 'pleinEcran',    'false'), -- Plein écran : désactivé
    (1, 'vsync',         'false'), -- V-Sync : désactivée
    (1, 'niveau_actuel', '6eme'); -- Niveau scolaire : 6ème

-- Progression initiale pour le joueur de test en Mathématiques, 6ème
-- Seul le niveau 1 est débloqué (les 2-6 sont verrouillés)
-- Cela correspond à un joueur qui vient de commencer la matière
INSERT IGNORE INTO progression (joueur_id, matiere, niveau, niveau_num, etoiles, debloque) VALUES
    (1, 'mathematiques', '6eme', 1, 0, TRUE),   -- Niveau 1 : débloqué, pas encore fait
    (1, 'mathematiques', '6eme', 2, 0, FALSE),  -- Niveau 2 : verrouillé
    (1, 'mathematiques', '6eme', 3, 0, FALSE),  -- Niveau 3 : verrouillé
    (1, 'mathematiques', '6eme', 4, 0, FALSE),  -- Niveau 4 : verrouillé
    (1, 'mathematiques', '6eme', 5, 0, FALSE),  -- Niveau 5 : verrouillé
    (1, 'mathematiques', '6eme', 6, 0, FALSE);  -- Niveau 6 : verrouillé
