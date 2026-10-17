-- =============================================================================
-- SCHEMA.SQL — EDUQUEST v1.26.0
-- Script de création de la base de données SQL (MySQL / MariaDB / PostgreSQL / SQLite)
-- =============================================================================
--
-- RÔLE :
-- Schéma relationnel complet pour le mode serveur (backend d'établissement).
-- Il prend en charge l'authentification (élèves & administrateurs), les 13 matières
-- et leurs rattachements de cycles/classes, la configuration intégrale du site et de l'IA,
-- les leçons manuelles, les options, quêtes journalières et l'inventaire boutique.
--
-- COMPATIBILITÉ MOTEURS :
--   - MySQL 8.0+ / MariaDB 10.5+ : syntaxe native directe
--   - PostgreSQL 12+ : remplacer INT AUTO_INCREMENT par SERIAL, DATETIME par TIMESTAMP, JSON par JSONB
--   - SQLite 3+ : remplacer INT AUTO_INCREMENT par INTEGER PRIMARY KEY AUTOINCREMENT
--
-- CONNEXION AVEC LE FRONTEND (js/db.js) :
--   Pour activer la synchronisation SQL, configurez API_URL dans js/db.js :
--   const API_URL = 'https://votre-domaine-scolaire.fr/api';
-- =============================================================================

CREATE DATABASE IF NOT EXISTS eduquest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eduquest;

-- =============================================================================
-- 1. TABLE : joueurs (Comptes élèves et administrateurs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS joueurs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    username      VARCHAR(100)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL DEFAULT 'eleve', -- 'eleve' ou 'admin'
    xp            INT           NOT NULL DEFAULT 0,
    coins         INT           NOT NULL DEFAULT 30,      -- Solde initial (30 pièces)
    streak        INT           NOT NULL DEFAULT 0,       -- Séries de victoires en cours
    max_streak    INT           NOT NULL DEFAULT 0,       -- Meilleure série historique
    token         VARCHAR(512)  DEFAULT NULL,             -- Token JWT de session active
    google_id     VARCHAR(255)  DEFAULT NULL,             -- ID OAuth Google (optionnel)
    cree_le       DATETIME      DEFAULT CURRENT_TIMESTAMP,
    derniere_cnx  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_joueurs_email ON joueurs(email);
CREATE INDEX IF NOT EXISTS idx_joueurs_token ON joueurs(token);
CREATE INDEX IF NOT EXISTS idx_joueurs_role  ON joueurs(role);

-- =============================================================================
-- 2. TABLE : parametres (Options et préférences par joueur)
-- =============================================================================
CREATE TABLE IF NOT EXISTS parametres (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id   INT          NOT NULL,
    cle         VARCHAR(100) NOT NULL,
    valeur      VARCHAR(500) NOT NULL,
    modifie_le  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_joueur_cle (joueur_id, cle)
);

CREATE INDEX IF NOT EXISTS idx_parametres_joueur ON parametres(joueur_id);

-- =============================================================================
-- 3. TABLE : configuration_site (Paramètres généraux du site gérés par l'admin)
-- =============================================================================
CREATE TABLE IF NOT EXISTS configuration_site (
    cle         VARCHAR(100) PRIMARY KEY,
    valeur      TEXT         NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    modifie_le  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. TABLE : configuration_ia (Webhooks Make.com et paramètres d'agents IA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS configuration_ia (
    cle         VARCHAR(100) PRIMARY KEY,
    valeur      TEXT         NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    modifie_le  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. TABLE : matieres_config (Configuration des matières et niveaux scolaires)
-- =============================================================================
CREATE TABLE IF NOT EXISTS matieres_config (
    id           VARCHAR(50)  PRIMARY KEY,
    nom          VARCHAR(100) NOT NULL,
    icone        VARCHAR(100) NOT NULL,
    bande        VARCHAR(50)  NOT NULL DEFAULT 'tous', -- 'college', 'lycee', 'primaire', 'superieur', 'tous'
    classes_json JSON         NOT NULL,                -- Ex: '["6eme", "5eme", "4eme", "3eme"]'
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    est_custom   BOOLEAN      NOT NULL DEFAULT FALSE,
    description  TEXT         DEFAULT NULL,
    modifie_le   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. TABLE : lecons_manuelles (Questions personnalisées saisies par l'enseignant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lecons_manuelles (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    matiere_id     VARCHAR(50)  NOT NULL,
    niveau_scolaire VARCHAR(50) DEFAULT NULL,          -- Ex: '6eme', 'college', 'tous'
    ordre          INT          NOT NULL DEFAULT 1,
    type           VARCHAR(50)  NOT NULL DEFAULT 'qcm', -- 'qcm', 'vrai_faux', 'reponse_courte', 'texte_a_trous', 'texte_a_choix', 'drag_and_drop'
    titre          VARCHAR(255) NOT NULL,
    contenu_json   JSON         NOT NULL,               -- Structure complète de la question
    cree_le        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    modifie_le     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (matiere_id) REFERENCES matieres_config(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lecons_matiere ON lecons_manuelles(matiere_id);

-- =============================================================================
-- 7. TABLE : progression (Parcours des 13 matières et 100 niveaux)
-- =============================================================================
CREATE TABLE IF NOT EXISTS progression (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id    INT          NOT NULL,
    matiere      VARCHAR(100) NOT NULL,
    niveau       VARCHAR(50)  NOT NULL, -- '6eme' → 'terminale'
    niveau_num   INT          NOT NULL, -- 1 à 100
    etoiles      TINYINT      NOT NULL DEFAULT 0, -- 0 à 3 étoiles
    debloque     BOOLEAN      NOT NULL DEFAULT FALSE,
    termine_le   DATETIME     DEFAULT NULL,
    modifie_le   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_progression (joueur_id, matiere, niveau, niveau_num)
);

CREATE INDEX IF NOT EXISTS idx_progression_joueur  ON progression(joueur_id);
CREATE INDEX IF NOT EXISTS idx_progression_mat_niv ON progression(joueur_id, matiere, niveau);

-- =============================================================================
-- 8. TABLE : quetes_journalieres (Suivi des quêtes quotidiennes à minuit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS quetes_journalieres (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id     INT      NOT NULL,
    date_quete    DATE     NOT NULL, -- YYYY-MM-DD (fuseau local)
    quetes_json   JSON     NOT NULL, -- État des 4 quêtes (connexion + 3 tirées)
    bonus_reclame BOOLEAN  NOT NULL DEFAULT FALSE, -- Coffre bonus (+50 pièces)
    modifie_le    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_joueur_date (joueur_id, date_quete)
);

CREATE INDEX IF NOT EXISTS idx_quetes_joueur_date ON quetes_journalieres(joueur_id, date_quete);

-- =============================================================================
-- 9. TABLE : inventaire (Consommables, Halos, Avatars, Titres et Thèmes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventaire (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id  INT          NOT NULL,
    item_id    VARCHAR(100) NOT NULL, -- Ex: 'boost-shield', 'boost-xp', 'einstein', 'halo-aurora'
    categorie  VARCHAR(50)  NOT NULL DEFAULT 'booster', -- 'booster', 'avatar', 'halo', 'titre', 'theme'
    quantite   INT          NOT NULL DEFAULT 1,
    equipe     BOOLEAN      NOT NULL DEFAULT FALSE,
    obtenu_le  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_joueur_item (joueur_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventaire_joueur ON inventaire(joueur_id);

-- =============================================================================
-- 10. VUES ANALYTIQUES
-- =============================================================================

-- Vue 1 : Progression détaillée par joueur
CREATE OR REPLACE VIEW v_progression_joueur AS
SELECT
    j.id AS joueur_id,
    j.username,
    j.email,
    p.matiere,
    p.niveau,
    p.niveau_num,
    p.etoiles,
    p.debloque,
    p.termine_le
FROM progression p
JOIN joueurs j ON j.id = p.joueur_id
ORDER BY j.username, p.matiere, p.niveau, p.niveau_num;

-- Vue 2 : Résumé des compétences par joueur et par matière
CREATE OR REPLACE VIEW v_resume_joueur AS
SELECT
    j.id AS joueur_id,
    j.username,
    p.matiere,
    p.niveau,
    COUNT(p.id)     AS niveaux_total,
    SUM(p.etoiles)  AS etoiles_total,
    SUM(p.debloque) AS niveaux_debloques
FROM progression p
JOIN joueurs j ON j.id = p.joueur_id
GROUP BY j.id, j.username, p.matiere, p.niveau;

-- Vue 3 : Classement général des élèves (XP, étoiles et séries de victoires)
CREATE OR REPLACE VIEW v_classement_general AS
SELECT
    j.id AS joueur_id,
    j.username,
    j.role,
    j.xp,
    j.coins,
    j.streak,
    j.max_streak,
    COALESCE(SUM(p.etoiles), 0) AS total_etoiles,
    COUNT(CASE WHEN p.etoiles = 3 THEN 1 END) AS total_parfaits
FROM joueurs j
LEFT JOIN progression p ON p.joueur_id = j.id
WHERE j.role = 'eleve'
GROUP BY j.id, j.username, j.role, j.xp, j.coins, j.streak, j.max_streak
ORDER BY j.xp DESC, total_etoiles DESC;

-- =============================================================================
-- 11. DONNÉES DE DÉMONSTRATION & AMORÇAGE
-- =============================================================================

-- Joueur élève de test
INSERT IGNORE INTO joueurs (id, email, username, password_hash, role, xp, coins, streak, max_streak)
VALUES (1, 'eleve@eduquest.fr', 'ÉlèveExplorateur', '$2y$10$examplehashplaceholder1234567890', 'eleve', 120, 45, 3, 5);

-- Administrateur de test
INSERT IGNORE INTO joueurs (id, email, username, password_hash, role, xp, coins, streak, max_streak)
VALUES (2, 'admin@eduquest.fr', 'ProfesseurAdmin', '$2y$10$examplehashplaceholder1234567890', 'admin', 0, 500, 0, 0);

-- Options par défaut de l'élève
INSERT IGNORE INTO parametres (joueur_id, cle, valeur) VALUES
    (1, 'volumeMusique',     '75'),
    (1, 'volumeEffets',      '80'),
    (1, 'sonsActifs',        'true'),
    (1, 'musiqueActive',     'true'),
    (1, 'effetsActifs',      'true'),
    (1, 'particules',        'true'),
    (1, 'animationsActives', 'true'),
    (1, 'ecoMode',           'false'),
    (1, 'modeChrono',        'false'),
    (1, 'pleinEcran',        'false'),
    (1, 'niveau_actuel',     '6eme');

-- Configuration globale du site (synchronisée avec AdminStore.getSiteConfig)
INSERT IGNORE INTO configuration_site (cle, valeur, description) VALUES
    ('siteTitle',            'EDUQUEST — Révision Gamifiée',       'Titre principal affiché dans l’en-tête'),
    ('tagline',              'Explore les îles du savoir !',       'Slogan affiché sur la page d’accueil'),
    ('chronoQuestionSeconds','30',                                 'Durée en secondes du défi chronométré'),
    ('xpMultiplier',         '1.0',                                'Multiplicateur global d’expérience'),
    ('coinsMultiplier',      '1.0',                                'Multiplicateur global de pièces'),
    ('soundVolume',          '80',                                 'Volume par défaut des effets sonores'),
    ('musicVolume',          '70',                                 'Volume par défaut de la musique d’ambiance'),
    ('allowRegistration',    'true',                               'Autoriser l’auto-inscription des élèves');

-- Configuration de l’IA et Webhooks Make.com (synchronisée avec AdminStore.getAiConfig)
INSERT IGNORE INTO configuration_ia (cle, valeur, description) VALUES
    ('generateWebhookUrl',   '',                                   'Webhook Make pour la génération de questions par IA'),
    ('validateWebhookUrl',   '',                                   'Webhook Make pour la validation de réponses ouvertes'),
    ('fetchTimeoutMs',       '8000',                               'Délai d’attente réseau maximal en millisecondes'),
    ('fallbackToOffline',    'true',                               'Basculer automatiquement sur la banque locale en cas d’erreur');

-- Configuration des 13 matières de base avec leurs cycles et classes autorisées
INSERT IGNORE INTO matieres_config (id, nom, icone, bande, classes_json, active, est_custom, description) VALUES
    ('mathematiques', 'Mathématiques', '📐', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Algèbre, géométrie et logique'),
    ('francais',      'Français',      '📖', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Grammaire, littérature et orthographe'),
    ('histoire',      'Histoire',      '🏛️', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Grandes époques et repères historiques'),
    ('geo',           'Géographie',    '🌍', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Territoires, mondialisation et cartes'),
    ('svt',           'SVT',           '🧬', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Sciences de la Vie et de la Terre'),
    ('anglais',       'Anglais',       '🇬🇧', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Vocabulaire, verbes irréguliers et grammaire'),
    ('physique',      'Physique',      '⚡', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Électricité, mécanique et optique'),
    ('chimie',        'Chimie',        '🧪', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Atomes, molécules et réactions chimiques'),
    ('technologie',   'Technologie',   '⚙️', 'college', '["6eme","5eme","4eme","3eme"]',                           TRUE, FALSE, 'Algorithmique, capteurs et réseaux du collège'),
    ('nsi',           'NSI Numérique', '💻', 'lycee',   '["2nde","1ere","terminale"]',                             TRUE, FALSE, 'Informatique, Python, web et bases de données'),
    ('ses',           'SES Économie',  '📊', 'lycee',   '["2nde","1ere","terminale"]',                             TRUE, FALSE, 'Économie, sociologie et sciences politiques'),
    ('philo',         'Philosophie',   '🧠', 'lycee',   '["terminale"]',                                            TRUE, FALSE, 'Concepts et réflexions de Terminale'),
    ('emc',           'EMC Citoyen',   '⚖️', 'tous',    '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]', TRUE, FALSE, 'Enseignement Moral et Civique');

-- Inventaire initial de l'élève
INSERT IGNORE INTO inventaire (joueur_id, item_id, categorie, quantite, equipe) VALUES
    (1, 'boost-shield', 'booster', 1, FALSE),
    (1, 'boost-xp',     'booster', 1, FALSE),
    (1, 'robot',        'avatar',  1, TRUE);

-- Déblocage du niveau 1 en Mathématiques pour la 6ème
INSERT IGNORE INTO progression (joueur_id, matiere, niveau, niveau_num, etoiles, debloque) VALUES
    (1, 'mathematiques', '6eme', 1, 0, TRUE);
