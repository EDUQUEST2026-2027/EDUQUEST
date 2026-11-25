-- =============================================================================
-- SCHEMA.SQL — EDUQUEST v1.30.0
-- Script de création de la base de données SQL (MySQL / MariaDB / PostgreSQL / SQLite)
-- =============================================================================
--
-- RÔLE :
-- Schéma relationnel complet pour le mode serveur (backend d'établissement).
-- Il prend en charge l'authentification (élèves & administrateurs), les 43 matières
-- officielles (Collège, Lycée & BTS, 18 filières cohérentes par niveau : Générale, Spé NSI,
-- STMG, STI2D, CIEL, ST2S, STL, STD2A, STHR, STAV, S2TMD, HLP/LLCE, Spé Sciences,
-- BTS SIO/MCO/CG, Bac Pro MELEC/ASSP), la configuration intégrale du site et du pool Multi-IA,
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
    derniere_cnx  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_joueurs_email (email(191)),
    INDEX idx_joueurs_token (token(191)),
    INDEX idx_joueurs_role  (role)
);

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
    UNIQUE KEY uq_joueur_cle (joueur_id, cle),
    INDEX idx_parametres_joueur (joueur_id)
);

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
    bande         VARCHAR(50)  NOT NULL DEFAULT 'all', -- 'college', 'lycee', 'all'
    classes_json  JSON         NOT NULL,               -- Ex: '["6eme", "5eme", "4eme", "3eme"]'
    filieres_json JSON         NOT NULL,               -- Ex: '["all"]' ou '["ciel", "nsi_spe"]'
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
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
    FOREIGN KEY (matiere_id) REFERENCES matieres_config(id) ON DELETE CASCADE,
    INDEX idx_lecons_matiere (matiere_id)
);

-- =============================================================================
-- 7. TABLE : progression (Parcours des 43 matières et 100 niveaux)
-- =============================================================================
CREATE TABLE IF NOT EXISTS progression (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id    INT          NOT NULL,
    matiere      VARCHAR(100) NOT NULL,
    niveau       VARCHAR(50)  NOT NULL, -- '6eme' → 'terminale', 'bts1', 'bts2'
    niveau_num   INT          NOT NULL, -- 1 à 100
    etoiles      TINYINT      NOT NULL DEFAULT 0, -- 0 à 3 étoiles
    debloque     BOOLEAN      NOT NULL DEFAULT FALSE,
    termine_le   DATETIME     DEFAULT NULL,
    modifie_le   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_progression (joueur_id, matiere, niveau, niveau_num),
    INDEX idx_progression_joueur  (joueur_id),
    INDEX idx_progression_mat_niv (joueur_id, matiere, niveau)
);

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
    UNIQUE KEY uq_joueur_date (joueur_id, date_quete),
    INDEX idx_quetes_joueur_date (joueur_id, date_quete)
);

-- =============================================================================
-- 9. TABLE : inventaire (Consommables, Halos, Avatars, Titres et Thèmes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventaire (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    joueur_id  INT          NOT NULL,
    item_id    VARCHAR(100) NOT NULL, -- Ex: 'boost-shield', 'boost-xp', 'boost-coins', 'boost-time', 'boost-combo', 'einstein', 'aurore'
    categorie  VARCHAR(50)  NOT NULL DEFAULT 'booster', -- 'booster', 'avatar', 'halo', 'titre', 'theme'
    quantite   INT          NOT NULL DEFAULT 1,
    equipe     BOOLEAN      NOT NULL DEFAULT FALSE,
    obtenu_le  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_joueur_item (joueur_id, item_id),
    INDEX idx_inventaire_joueur (joueur_id)
);

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
    (1, 'btnBrightness',     '80'),
    (1, 'niveau_actuel',     '6eme'),
    (1, 'filiere_actuelle',  'generale');

-- Configuration globale du site (synchronisée avec AdminStore.getSiteConfig)
INSERT IGNORE INTO configuration_site (cle, valeur, description) VALUES
    ('title',                'EDUQUEST',                           'Titre principal affiché dans l’en-tête'),
    ('dashboardFooterNote',  'EDUQUEST — Contenus alignés sur les programmes officiels.', 'Note de pied de page du tableau de bord'),
    ('defaultNiveau',        '6eme',                               'Classe scolaire par défaut'),
    ('defaultFiliere',       'generale',                           'Filière par défaut au lycée / BTS'),
    ('quizTimerSeconds',     '45',                                 'Durée en secondes du défi chronométré'),
    ('xpMultiplier',         '1.0',                                'Multiplicateur global d’expérience'),
    ('coinMultiplier',       '1.0',                                'Multiplicateur global de pièces'),
    ('defaultSfxVolume',     '60',                                 'Volume par défaut des effets sonores'),
    ('defaultBgmVolume',     '35',                                 'Volume par défaut de la musique d’ambiance'),
    ('allowRegistration',    'true',                               'Autoriser l’auto-inscription des élèves'),
    ('enableShop',           'true',                               'Activer la boutique (98 articles)'),
    ('enableQuests',         'true',                               'Activer les missions quotidiennes'),
    ('enableBadges',         'true',                               'Activer les succès (79 badges)'),
    ('enableChrono',         'true',                               'Autoriser le mode chronométré'),
    ('enableConfetti',       'true',                               'Activer les célébrations confettis'),
    ('maintenanceMode',      'false',                              'Mode maintenance / examen');

-- Configuration de l’IA et Webhooks Make.com (synchronisée avec AdminStore.getAiConfig)
INSERT IGNORE INTO configuration_ia (cle, valeur, description) VALUES
    ('generateWebhookUrl',   '',                                   'Webhook Make pour la génération de questions par IA'),
    ('validateWebhookUrl',   '',                                   'Webhook Make pour la validation de réponses ouvertes'),
    ('fetchTimeoutMs',       '8000',                               'Délai d’attente réseau maximal en millisecondes'),
    ('adaptiveMode',         'true',                               'Activer le moteur adaptatif et la non-répétition'),
    ('selectionStrategy',    'random',                             'Stratégie de sélection Multi-IA (random ou round_robin)'),
    ('providers',            '[]',                                 'Pool JSON de fournisseurs IA (Make, OpenAI-compatible, Gemini)'),
    ('fallbackToOffline',    'true',                               'Basculer automatiquement sur la banque locale en cas d’erreur');

-- Configuration des 43 matières officielles (Collège, Lycée & BTS sur 18 filières — 100 % SVG Astral & Or)
INSERT IGNORE INTO matieres_config (id, nom, icone, bande, classes_json, filieres_json, active, est_custom, description) VALUES
    ('maths',                'Mathématiques',                    'Image/ile/maths.svg',                'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]', '["all"]',                                                                                                        TRUE, FALSE, 'Algèbre, géométrie, analyse, probabilités et maths appliquées BTS'),
    ('francais',             'Français',                         'Image/ile/francais.svg',             'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]', '["all"]',                                                                                                        TRUE, FALSE, 'Grammaire, littérature, orthographe et culture générale (CGE BTS)'),
    ('histoire',             'Histoire',                         'Image/ile/histoire.svg',             'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["all"]',                                                                                                        TRUE, FALSE, 'Grandes époques et repères historiques'),
    ('geo',                  'Géographie',                       'Image/ile/geo.svg',                  'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["all"]',                                                                                                        TRUE, FALSE, 'Territoires, mondialisation, climat et cartes'),
    ('emc',                  'EMC',                              'Image/ile/emc.svg',                  'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["all"]',                                                                                                        TRUE, FALSE, 'Enseignement Moral et Civique, institutions et valeurs'),
    ('anglais',              'Anglais',                          'Image/ile/anglais.svg',              'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]', '["all"]',                                                                                                        TRUE, FALSE, 'Vocabulaire, temps verbaux, grammaire et anglais technique'),
    ('allemand',             'Allemand',                         'Image/ile/allemand.svg',             'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]', '["all"]',                                                                                                        TRUE, FALSE, 'Langue vivante (LV1/bilangue/LV2/BTS) : déclinaisons, syntaxe, lexique et culture D-A-CH'),
    ('espagnol',             'Espagnol',                         'Image/ile/espagnol.svg',             'all',     '["5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]',        '["all"]',                                                                                                        TRUE, FALSE, 'Langue vivante 2 dès la 5ème : grammaire, lexique et culture hispanique'),
    ('svt',                  'SVT',                              'Image/ile/svt.svg',                  'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["generale","st2s","stl","sthr","stav","s2tmd","hlp_llce","sciences_spe","bac_pro_assp"]',                       TRUE, FALSE, 'Sciences de la Vie et de la Terre'),
    ('physique',             'Physique',                         'Image/ile/physique.svg',             'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale","bts1","bts2"]', '["generale","nsi_spe","sti2d","ciel","st2s","stl","std2a","stav","s2tmd","hlp_llce","sciences_spe","bac_pro_melec","bac_pro_assp"]', TRUE, FALSE, 'Électricité, mécanique, énergie, optique et physique appliquée BTS CIEL'),
    ('chimie',               'Chimie',                           'Image/ile/chimie.svg',               'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["generale","nsi_spe","sti2d","ciel","st2s","stl","std2a","sthr","stav","hlp_llce","sciences_spe","bac_pro_melec","bac_pro_assp"]', TRUE, FALSE, 'Atomes, molécules, pH et réactions chimiques'),
    ('techno',               'Technologie',                      'Image/ile/technologie.svg',          'college', '["6eme","5eme","4eme","3eme"]',                                         '["all"]',                                                                                                        TRUE, FALSE, 'Algorithmique, capteurs, matériaux et réseaux du collège'),
    ('arts',                 'Arts & Musique',                   'Image/ile/arts.svg',                 'all',     '["6eme","5eme","4eme","3eme","2nde","1ere","terminale"]',               '["generale","ciel","std2a","s2tmd","hlp_llce","bac_pro_melec","bac_pro_assp"]',                                  TRUE, FALSE, 'Histoire des arts, perspective, couleurs et culture musicale'),
    ('philo',                'Philosophie',                      'Image/ile/philo.svg',                'lycee',   '["terminale"]',                                                         '["generale","nsi_spe","stmg","sti2d","st2s","stl","std2a","sthr","stav","s2tmd","hlp_llce","sciences_spe"]',     TRUE, FALSE, 'Concepts, auteurs et grandes notions de Terminale'),
    ('nsi',                  'NSI & Numérique',                  'Image/ile/nsi.svg',                  'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["generale","nsi_spe","sti2d","ciel","sciences_spe","bts_sio"]',                                                 TRUE, FALSE, 'Informatique, Python, algorithmique, Web, SQL et architectures'),
    ('ses',                  'SES (Économie)',                   'Image/ile/ses.svg',                  'lycee',   '["2nde","1ere","terminale"]',                                           '["generale","hlp_llce"]',                                                                                        TRUE, FALSE, 'Économie, sociologie et sciences politiques (Lycée Général)'),
    ('hggsp',                'HGGSP (Géopolitique)',             'Image/ile/hggsp.svg',                'lycee',   '["1ere","terminale"]',                                                  '["generale","hlp_llce","s2tmd"]',                                                                                TRUE, FALSE, 'Histoire-géographie, géopolitique et sciences politiques (1ère / Terminale)'),
    ('si',                   'Sciences de l\'Ingénieur',         'Image/ile/si.svg',                   'lycee',   '["2nde","1ere","terminale"]',                                           '["generale","nsi_spe","sti2d","sciences_spe","bac_pro_melec"]',                                                  TRUE, FALSE, 'SysML, chaînes d\'énergie et d\'information, mécanique'),
    ('msgn',                 'Management & Gestion',             'Image/ile/msgn.svg',                 'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["stmg","sthr","stav","bts_sio","bts_mco","bts_cg"]',                                                            TRUE, FALSE, 'Management, sciences de gestion et numérique (STMG / STHR / BTS)'),
    ('droit_eco',            'Droit & Économie',                 'Image/ile/droit_eco.svg',            'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["stmg","ciel","sthr","stav","bts_sio","bts_mco","bts_cg","bac_pro_melec","bac_pro_assp"]',                      TRUE, FALSE, 'Droit des contrats, travail, RGPD, CEJM et macroéconomie'),
    ('mercatique',           'Mercatique (Marketing)',           'Image/ile/mercatique.svg',           'lycee',   '["1ere","terminale","bts1","bts2"]',                                    '["stmg","sthr","bts_mco","bts_cg"]',                                                                             TRUE, FALSE, 'Marketing mix (4P), segmentation, gestion et analyse financière'),
    ('i2d',                  'I2D (Innovation & Éco)',           'Image/ile/i2d.svg',                  'lycee',   '["2nde","1ere","terminale"]',                                           '["sti2d","std2a","stav","bac_pro_melec"]',                                                                       TRUE, FALSE, 'Éco-conception, ACV, matériaux, thermique et développement durable'),
    ('sin',                  'SIN (Info & Numérique)',           'Image/ile/sin.svg',                  'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["sti2d","nsi_spe","ciel","bts_sio","bac_pro_melec"]',                                                           TRUE, FALSE, 'Signaux numériques, CAN, PWM, logique booléenne et IoT'),
    ('cybersecurite',        'Cybersécurité',                    'Image/ile/cybersecurite.svg',        'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["ciel","nsi_spe","bts_sio"]',                                                                                   TRUE, FALSE, 'Triade CIA, OWASP, cryptographie, RGPD/ANSSI et défense réseau'),
    ('reseaux',              'Réseaux & Systèmes',               'Image/ile/reseaux.svg',              'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["ciel","nsi_spe","bts_sio","bac_pro_melec"]',                                                                   TRUE, FALSE, 'Modèle OSI, TCP/IP, CIDR, routage, ports et administration Linux'),
    ('electronique',         'Électronique & Systèmes',          'Image/ile/electronique.svg',         'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["ciel","sti2d","nsi_spe","bac_pro_melec"]',                                                                     TRUE, FALSE, 'Loi d\'Ohm, Kirchhoff, diodes, transistors, PCB et embarqué'),
    ('stss',                 'STSS (Santé & Social)',            'Image/ile/stss.svg',                 'lycee',   '["2nde","1ere","terminale"]',                                           '["st2s","bac_pro_assp"]',                                                                                        TRUE, FALSE, 'Santé publique, épidémiologie, prévention et protection sociale'),
    ('biotech',              'Biotechnologies & Labo',           'Image/ile/biotech.svg',              'lycee',   '["2nde","1ere","terminale"]',                                           '["stl","st2s","sthr","stav","sciences_spe","bac_pro_assp"]',                                                     TRUE, FALSE, 'Microbiologie, biochimie, PCR, spectrophotométrie et hygiène de laboratoire'),
    ('design',               'Design & Arts Appliqués',          'Image/ile/design.svg',               'lycee',   '["2nde","1ere","terminale"]',                                           '["std2a","s2tmd"]',                                                                                              TRUE, FALSE, 'Design produit, espace, graphisme, ergonomie, typographie et matériaux'),
    ('hotellerie',           'Hôtellerie & Gastronomie',         'Image/ile/hotellerie.svg',           'lycee',   '["2nde","1ere","terminale"]',                                           '["sthr"]',                                                                                                       TRUE, FALSE, 'Sciences culinaires, hygiène HACCP, service, œnologie et hébergement'),
    ('agronomie',            'Agronomie & Écologie',             'Image/ile/agronomie.svg',            'lycee',   '["1ere","terminale"]',                                                  '["stav"]',                                                                                                       TRUE, FALSE, 'Pédologie, agroécologie, biodiversité, gestion de l\'eau et territoires'),
    ('spectacle',            'Arts de la Scène & Culture',       'Image/ile/spectacle.svg',            'lycee',   '["2nde","1ere","terminale"]',                                           '["s2tmd","std2a","hlp_llce"]',                                                                                   TRUE, FALSE, 'Dramaturgie, histoire du théâtre, musicologie, chorégraphie et scénographie'),
    ('hlp',                  'Humanités & Littérature (HLP)',    'Image/ile/hlp.svg',                  'lycee',   '["1ere","terminale"]',                                                  '["hlp_llce","generale","s2tmd","std2a"]',                                                                        TRUE, FALSE, 'Pouvoirs de la parole, représentations du monde, recherche de soi et humanité'),
    ('dev_bdd',              'Développement & BDD',              'Image/ile/dev_bdd.svg',              'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["bts_sio","nsi_spe","ciel","stmg","bts_cg"]',                                                                   TRUE, FALSE, 'SQL avancé, modélisation Merise/UML, POO, API REST, Git et tests logiciels'),
    ('commerce',             'Relation Client & Commerce',       'Image/ile/commerce.svg',             'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["bts_mco","stmg","sthr","bts_cg"]',                                                                             TRUE, FALSE, 'Merchandising, négociation, fidélisation omnicanale et pilotage d\'unité commerciale'),
    ('comptabilite',         'Comptabilité & Finance',           'Image/ile/comptabilite.svg',         'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["bts_cg","stmg","bts_mco","sthr"]',                                                                             TRUE, FALSE, 'Plan comptable général, partie double, TVA, SIG, amortissements et bilan'),
    ('electrotech',          'Électrotechnique & Énergie',       'Image/ile/electrotech.svg',          'lycee',   '["2nde","1ere","terminale"]',                                           '["bac_pro_melec","sti2d"]',                                                                                      TRUE, FALSE, 'Norme NF C 15-100, habilitation électrique, régimes de neutre, triphasé et moteurs'),
    ('biopathologie',        'Biologie & Physiopathologie',      'Image/ile/biopathologie.svg',        'lycee',   '["2nde","1ere","terminale"]',                                           '["st2s","bac_pro_assp","stl","sciences_spe"]',                                                                   TRUE, FALSE, 'Anatomie, physiopathologie humaine, imagerie médicale, terminologie et soins'),
    ('spcl',                 'Sciences & Chimie de Labo',        'Image/ile/spcl.svg',                 'lycee',   '["1ere","terminale"]',                                                  '["stl","sciences_spe","st2s","stav","sti2d"]',                                                                   TRUE, FALSE, 'Titrages, chromatographie, synthèse organique, optique et métrologie de laboratoire'),
    ('rh_comm',              'RH & Communication',               'Image/ile/rh_comm.svg',              'lycee',   '["2nde","1ere","terminale","bts1","bts2"]',                             '["stmg","bts_mco","bts_cg","sthr","bts_sio"]',                                                                   TRUE, FALSE, 'Recrutement, GEPP, motivation, QVCT, dialogue social CSE et communication'),
    ('architecture_habitat', 'Architecture & Habitat Durable',   'Image/ile/architecture_habitat.svg', 'lycee',   '["2nde","1ere","terminale"]',                                           '["sti2d","std2a","bac_pro_melec","stav","sciences_spe"]',                                                        TRUE, FALSE, 'Thermique du bâtiment, RE2020, BIM, structures béton armé et habitat bioclimatique'),
    ('llce',                 'Langues & Cultures (LLCE)',        'Image/ile/llce.svg',                 'lycee',   '["1ere","terminale"]',                                                  '["hlp_llce","generale","s2tmd","std2a","sthr"]',                                                                 TRUE, FALSE, 'Littératures et civilisations des mondes anglophone, germanophone et hispanophone'),
    ('pse',                  'Prévention, Santé & Environnement','Image/ile/pse.svg',                  'lycee',   '["2nde","1ere","terminale"]',                                           '["bac_pro_assp","bac_pro_melec","ciel","sthr","stav","st2s","stl"]',                                             TRUE, FALSE, 'Secourisme SST, DUERP, prévention des risques professionnels, santé et environnement');

-- Inventaire initial de l'élève
INSERT IGNORE INTO inventaire (joueur_id, item_id, categorie, quantite, equipe) VALUES
    (1, 'boost-shield', 'booster', 1, FALSE),
    (1, 'boost-xp',     'booster', 1, FALSE),
    (1, 'robot',        'avatar',  1, TRUE);

-- Déblocage du niveau 1 en Mathématiques pour la 6ème
INSERT IGNORE INTO progression (joueur_id, matiere, niveau, niveau_num, etoiles, debloque) VALUES
    (1, 'maths', '6eme', 1, 0, TRUE);
