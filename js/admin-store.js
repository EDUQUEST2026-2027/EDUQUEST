/* =============================================================================
   ADMIN-STORE.JS — EDUQUEST v1.30.0
   Couche de configuration centrale du panneau d'administration (admin.html).

   RÔLE :
   Ce fichier stocke, valide et synchronise l'ensemble des personnalisations
   administratives sans altérer le moteur de jeu :
     - Niveaux & Filières → 9 classes (6e → BTS 2) et 18 filières officielles.
     - Matières & Leçons  → 43 matières officielles (cycle, classes, filières,
                            spécialités), leçons manuelles & aperçus procéduraux.
     - Configuration site → Titre, slogan, chrono, multiplicateurs XP/pièces,
                            feature flags, maintenance et sons.
     - Configuration IA   → Pool multi-IA (Make, OpenAI-compatible, Gemini), mode
                            adaptatif et webhooks de génération/validation.
     - Boutique, Succès & Quêtes → 98 articles, 79 succès filtrés par filière et 9 quêtes.

   PERSISTANCE :
   Tout est unifié sous la clé localStorage 'eduquest_admin_data' et synchronisable
   avec les tables SQL du serveur (configuration_site, configuration_ia, matieres_config).
   ============================================================================= */

const AdminStore = (() => {

    /* -----------------------------------------------------------------------
       CONSTANTES
       ----------------------------------------------------------------------- */

    // Clé localStorage unique pour toute la configuration administrateur
    const LS_KEY = 'eduquest_admin_data';

    const ALL_NIVEAUX = ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale', 'bts1', 'bts2'];
    const COLLEGE_ONLY = ['6eme', '5eme', '4eme', '3eme'];
    const COLLEGE_LYCEE = ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'terminale'];
    const FROM_5EME_TO_BTS = ['5eme', '4eme', '3eme', '2nde', '1ere', 'terminale', 'bts1', 'bts2'];
    const LYCEE_ONLY = ['2nde', '1ere', 'terminale'];
    const LYCEE_1ERE_TLE = ['1ere', 'terminale'];
    const LYCEE_BTS = ['2nde', '1ere', 'terminale', 'bts1', 'bts2'];
    const BTS_ONLY = ['bts1', 'bts2'];

    // Filières / voies officielles (Lycée Général, Technologique, Professionnel & Post-Bac BTS — 18 filières)
    // Chaque filière précise ses niveaux d'études autorisés (cohérence stricte 2nde / 1ère-Tle / BTS).
    const DEFAULT_FILIERES = [
        { id: 'generale', label: 'Voie Générale', shortLabel: 'Générale', icon: '📚', enabled: true, allowedNiveaux: LYCEE_ONLY, desc: 'Tronc commun et spécialités du lycée général (SES, NSI, HGGSP, SI, HLP, LLCE, Sciences & Arts)' },
        { id: 'nsi_spe', label: 'Spécialité NSI & Numérique', shortLabel: 'Spé NSI', icon: '💻', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Parcours informatique, algorithmique, développement/BDD, réseaux, cybersécurité, SIN et SI (1ère/Tle)' },
        { id: 'stmg', label: 'STMG (Management & Gestion)', shortLabel: 'STMG', icon: '📊', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Management (MSGN), Droit & Économie, Mercatique, Gestion-Finance (Comptabilité), RH & Comm et SIG' },
        { id: 'sti2d', label: 'STI2D (Industrie & Dév. Durable)', shortLabel: 'STI2D', icon: '⚙️', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'I2D (ITEC), SIN, Architecture & Habitat (AC), Énergie & Électrotechnique (EE), Électronique et SI' },
        { id: 'ciel', label: 'CIEL (Cyber, Réseaux & Électronique)', shortLabel: 'CIEL', icon: '🛡️', enabled: true, allowedNiveaux: LYCEE_BTS, desc: 'Bac Pro & BTS CIEL : Cybersécurité, Réseaux & Systèmes, Électronique, SIN, Dév/BDD, NSI, Droit IT & PSE' },
        { id: 'st2s', label: 'ST2S (Santé & Social)', shortLabel: 'ST2S', icon: '🩺', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Sciences Sanitaires & Sociales (STSS), Biologie & Physiopathologie (BPH), Biotechnologies, Chimie, SVT & PSE' },
        // --- 12 FILIÈRES OFFICIELLES COMPLÉMENTAIRES (TECHNO, GÉNÉRAL, PRO & BTS) ---
        { id: 'stl', label: 'STL (Sciences & Tech. de Laboratoire)', shortLabel: 'STL', icon: '🧫', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Biotechnologies, Sciences & Chimie de Labo (SPCL), Biochimie, Biopathologie, Physique-Chimie et SVT' },
        { id: 'std2a', label: 'STD2A (Design & Arts Appliqués)', shortLabel: 'STD2A', icon: '🎨', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Design & Arts Appliqués, Architecture & Habitat, Arts & Musique, Éco-conception (I2D), Scénographie et Culture' },
        { id: 'sthr', label: 'STHR (Hôtellerie & Restauration)', shortLabel: 'STHR', icon: '🍽️', enabled: true, allowedNiveaux: LYCEE_ONLY, desc: 'Hôtellerie & Gastronomie, Management (MSGN), Mercatique, Commerce, RH & Comm, Comptabilité, PSE et Langues' },
        { id: 'stav', label: 'STAV (Agronomie & Vivant)', shortLabel: 'STAV', icon: '🌱', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Agronomie & Écologie, SVT, Biotechnologies, Chimie, PSE, Éco-technologies (I2D), Aménagement et Gestion' },
        { id: 's2tmd', label: 'S2TMD (Théâtre, Musique & Danse)', shortLabel: 'S2TMD', icon: '🎭', enabled: true, allowedNiveaux: LYCEE_ONLY, desc: 'Arts de la Scène & Culture, Arts & Musique, Design & Scénographie, Humanités (HLP), LLCE et Géopolitique' },
        { id: 'hlp_llce', label: 'Humanités, Lettres & Langues (HLP)', shortLabel: 'HLP/LLCE', icon: '📖', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Humanités, Littérature & Philosophie (HLP), Langues & Cultures (LLCE), Géopolitique (HGGSP), Arts et Sciences humaines' },
        { id: 'sciences_spe', label: 'Spécialités Maths & Sciences (PC/SVT)', shortLabel: 'Spé Sciences', icon: '🔬', enabled: true, allowedNiveaux: LYCEE_1ERE_TLE, desc: 'Parcours scientifique complet : Mathématiques, Physique, Chimie, SVT, SI, Labo (SPCL), Biopathologie et NSI' },
        { id: 'bts_sio', label: 'BTS SIO (Services Informatiques)', shortLabel: 'BTS SIO', icon: '🖥️', enabled: true, allowedNiveaux: BTS_ONLY, desc: 'Options SLAM & SISR : Développement & BDD, Réseaux & Systèmes, Cybersécurité, NSI, SIN, CEJM (Droit-Éco & MSGN)' },
        { id: 'bts_mco', label: 'BTS MCO (Management Commercial)', shortLabel: 'BTS MCO', icon: '🛒', enabled: true, allowedNiveaux: BTS_ONLY, desc: 'Relation Client & Commerce, Mercatique, Management (MSGN), RH & Comm, Comptabilité-Gestion, CEJM (Droit-Éco) & Langues' },
        { id: 'bts_cg', label: 'BTS CG (Comptabilité & Gestion)', shortLabel: 'BTS CG', icon: '🧮', enabled: true, allowedNiveaux: BTS_ONLY, desc: 'Comptabilité, Fiscalité & Contrôle de gestion, CEJM (Droit-Éco & MSGN), SI Comptable & SQL (Dév/BDD), RH & Paie' },
        { id: 'bac_pro_melec', label: 'Bac Pro MELEC (Électricité & Connecté)', shortLabel: 'MELEC', icon: '⚡', enabled: true, allowedNiveaux: LYCEE_ONLY, desc: 'Électrotechnique (NF C 15-100), Électronique, SIN & Domotique, Réseaux connectés, Habitat (AC), I2D et PSE' },
        { id: 'bac_pro_assp', label: 'Bac Pro ASSP (Soins & Accompagnement)', shortLabel: 'ASSP', icon: '🏥', enabled: true, allowedNiveaux: LYCEE_ONLY, desc: 'STSS (Médico-Social), Biologie & Physiopathologie (BPH & Soins), Biotechnologies & Hygiène, PSE, SVT et Chimie' },
    ];

    // Règles pédagogiques conformes au programme officiel (Collège, Lycée & BTS, par filière — 43 matières)
    // - Technologie : Collège uniquement (6e → 3e)
    // - Allemand (LV1/bilangue/LV2) : dès la 6ème jusqu'au BTS 2
    // - Espagnol LV2 : dès la 5ème (5e → BTS 2)
    // - SES : Lycée Général uniquement (2nde → Terminale) — jamais au collège ni en BTS
    // - HGGSP, HLP, LLCE : Spécialités de 1ère & Terminale uniquement
    // - Philosophie : Terminale Générale & Technologique uniquement — jamais au collège ni en BTS
    // - Matières de spécialité & filières alignées sur les cycles exacts (Lycée vs BTS).
    const SUBJECT_DEFAULT_RULES = {
        maths: { band: 'all', allowedNiveaux: ALL_NIVEAUX, allowedFilieres: ['all'], specialtyFilieres: ['sciences_spe'] },
        francais: { band: 'all', allowedNiveaux: ALL_NIVEAUX, allowedFilieres: ['all'], specialtyFilieres: ['hlp_llce'] },
        histoire: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['all'], specialtyFilieres: [] },
        geo: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['all'], specialtyFilieres: [] },
        emc: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['all'], specialtyFilieres: [] },
        anglais: { band: 'all', allowedNiveaux: ALL_NIVEAUX, allowedFilieres: ['all'], specialtyFilieres: ['hlp_llce'] },
        allemand: { band: 'all', allowedNiveaux: ALL_NIVEAUX, allowedFilieres: ['all'], specialtyFilieres: ['hlp_llce'] },
        espagnol: { band: 'all', allowedNiveaux: FROM_5EME_TO_BTS, allowedFilieres: ['all'], specialtyFilieres: ['hlp_llce'] },
        svt: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['generale', 'st2s', 'stl', 'sthr', 'stav', 's2tmd', 'hlp_llce', 'sciences_spe', 'bac_pro_assp'], specialtyFilieres: ['st2s', 'stav', 'sciences_spe', 'bac_pro_assp', 'stl'] },
        physique: { band: 'all', allowedNiveaux: ALL_NIVEAUX, allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'st2s', 'stl', 'std2a', 'stav', 's2tmd', 'hlp_llce', 'sciences_spe', 'bac_pro_melec', 'bac_pro_assp'], specialtyFilieres: ['stl', 'sciences_spe', 'ciel'] },
        chimie: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'st2s', 'stl', 'std2a', 'sthr', 'stav', 'hlp_llce', 'sciences_spe', 'bac_pro_melec', 'bac_pro_assp'], specialtyFilieres: ['stl', 'sciences_spe', 'st2s', 'stav'] },
        techno: { band: 'college', allowedNiveaux: COLLEGE_ONLY, allowedFilieres: ['all'], specialtyFilieres: [] },
        arts: { band: 'all', allowedNiveaux: COLLEGE_LYCEE, allowedFilieres: ['generale', 'ciel', 'std2a', 's2tmd', 'hlp_llce', 'bac_pro_melec', 'bac_pro_assp'], specialtyFilieres: ['std2a', 's2tmd'] },
        philo: { band: 'lycee', allowedNiveaux: ['terminale'], allowedFilieres: ['generale', 'nsi_spe', 'stmg', 'sti2d', 'st2s', 'stl', 'std2a', 'sthr', 'stav', 's2tmd', 'hlp_llce', 'sciences_spe'], specialtyFilieres: ['hlp_llce', 'generale'] },
        nsi: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'sciences_spe', 'bts_sio'], specialtyFilieres: ['nsi_spe', 'ciel', 'bts_sio'] },
        ses: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['generale', 'hlp_llce'], specialtyFilieres: ['generale'] },
        hggsp: { band: 'lycee', allowedNiveaux: LYCEE_1ERE_TLE, allowedFilieres: ['generale', 'hlp_llce', 's2tmd'], specialtyFilieres: ['generale', 'hlp_llce'] },
        si: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'sciences_spe', 'bac_pro_melec'], specialtyFilieres: ['nsi_spe', 'sti2d', 'generale', 'sciences_spe'] },
        msgn: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['stmg', 'sthr', 'stav', 'bts_sio', 'bts_mco', 'bts_cg'], specialtyFilieres: ['stmg', 'sthr', 'bts_mco', 'bts_cg', 'bts_sio'] },
        droit_eco: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['stmg', 'ciel', 'sthr', 'stav', 'bts_sio', 'bts_mco', 'bts_cg', 'bac_pro_melec', 'bac_pro_assp'], specialtyFilieres: ['stmg', 'ciel', 'bts_sio', 'bts_mco', 'bts_cg'] },
        mercatique: { band: 'lycee', allowedNiveaux: ['1ere', 'terminale', 'bts1', 'bts2'], allowedFilieres: ['stmg', 'sthr', 'bts_mco', 'bts_cg'], specialtyFilieres: ['stmg', 'sthr', 'bts_mco'] },
        i2d: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['sti2d', 'std2a', 'stav', 'bac_pro_melec'], specialtyFilieres: ['sti2d', 'std2a'] },
        sin: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['sti2d', 'nsi_spe', 'ciel', 'bts_sio', 'bac_pro_melec'], specialtyFilieres: ['sti2d', 'nsi_spe', 'ciel', 'bac_pro_melec'] },
        cybersecurite: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['ciel', 'nsi_spe', 'bts_sio'], specialtyFilieres: ['ciel', 'nsi_spe', 'bts_sio'] },
        reseaux: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['ciel', 'nsi_spe', 'bts_sio', 'bac_pro_melec'], specialtyFilieres: ['ciel', 'nsi_spe', 'bts_sio', 'bac_pro_melec'] },
        electronique: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['ciel', 'sti2d', 'nsi_spe', 'bac_pro_melec'], specialtyFilieres: ['ciel', 'sti2d', 'bac_pro_melec'] },
        stss: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['st2s', 'bac_pro_assp'], specialtyFilieres: ['st2s', 'bac_pro_assp'] },
        // --- 16 MATIÈRES DÉDIÉES AUX FILIÈRES TECHNO, GÉNÉRALES, PRO & BTS ---
        biotech: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['stl', 'st2s', 'sthr', 'stav', 'sciences_spe', 'bac_pro_assp'], specialtyFilieres: ['stl', 'st2s', 'stav', 'bac_pro_assp'] },
        design: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['std2a', 's2tmd'], specialtyFilieres: ['std2a', 's2tmd'] },
        hotellerie: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['sthr'], specialtyFilieres: ['sthr'] },
        agronomie: { band: 'lycee', allowedNiveaux: LYCEE_1ERE_TLE, allowedFilieres: ['stav'], specialtyFilieres: ['stav'] },
        spectacle: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['s2tmd', 'std2a', 'hlp_llce'], specialtyFilieres: ['s2tmd', 'std2a'] },
        hlp: { band: 'lycee', allowedNiveaux: LYCEE_1ERE_TLE, allowedFilieres: ['hlp_llce', 'generale', 's2tmd', 'std2a'], specialtyFilieres: ['hlp_llce', 'generale', 's2tmd'] },
        dev_bdd: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['bts_sio', 'nsi_spe', 'ciel', 'stmg', 'bts_cg'], specialtyFilieres: ['bts_sio', 'nsi_spe', 'ciel', 'bts_cg'] },
        commerce: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['bts_mco', 'stmg', 'sthr', 'bts_cg'], specialtyFilieres: ['bts_mco', 'stmg', 'sthr'] },
        comptabilite: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['bts_cg', 'stmg', 'bts_mco', 'sthr'], specialtyFilieres: ['bts_cg', 'stmg', 'bts_mco'] },
        electrotech: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['bac_pro_melec', 'sti2d'], specialtyFilieres: ['bac_pro_melec', 'sti2d'] },
        biopathologie: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['st2s', 'bac_pro_assp', 'stl', 'sciences_spe'], specialtyFilieres: ['st2s', 'bac_pro_assp', 'stl'] },
        spcl: { band: 'lycee', allowedNiveaux: LYCEE_1ERE_TLE, allowedFilieres: ['stl', 'sciences_spe', 'st2s', 'stav', 'sti2d'], specialtyFilieres: ['stl', 'sciences_spe'] },
        rh_comm: { band: 'lycee', allowedNiveaux: LYCEE_BTS, allowedFilieres: ['stmg', 'bts_mco', 'bts_cg', 'sthr', 'bts_sio'], specialtyFilieres: ['stmg', 'bts_mco', 'bts_cg', 'sthr'] },
        architecture_habitat: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['sti2d', 'std2a', 'bac_pro_melec', 'stav', 'sciences_spe'], specialtyFilieres: ['sti2d', 'std2a', 'bac_pro_melec'] },
        llce: { band: 'lycee', allowedNiveaux: LYCEE_1ERE_TLE, allowedFilieres: ['hlp_llce', 'generale', 's2tmd', 'std2a', 'sthr'], specialtyFilieres: ['hlp_llce', 'generale', 's2tmd'] },
        pse: { band: 'lycee', allowedNiveaux: LYCEE_ONLY, allowedFilieres: ['bac_pro_assp', 'bac_pro_melec', 'ciel', 'sthr', 'stav', 'st2s', 'stl'], specialtyFilieres: ['bac_pro_assp', 'bac_pro_melec', 'ciel', 'sthr', 'stav'] },
    };

    // Niveaux scolaires par défaut (6ème → Terminale + BTS 1/2)
    const DEFAULT_LEVELS = [
        { id: '6eme', label: '6ème', band: 'college' },
        { id: '5eme', label: '5ème', band: 'college' },
        { id: '4eme', label: '4ème', band: 'college' },
        { id: '3eme', label: '3ème', band: 'college' },
        { id: '2nde', label: '2nde', band: 'lycee' },
        { id: '1ere', label: '1ère', band: 'lycee' },
        { id: 'terminale', label: 'Terminale', band: 'lycee' },
        { id: 'bts1', label: 'BTS 1ère année', band: 'lycee' },
        { id: 'bts2', label: 'BTS 2ème année', band: 'lycee' },
    ];

    // Types de leçons pris en charge par quiz-engine.js
    const LESSON_TYPES = ['qcm', 'vrai_faux', 'reponse_courte', 'texte_a_trous', 'texte_a_choix', 'drag_and_drop'];

    // Catalogue des articles par défaut de la boutique (98 articles : 24 Halos, 27 Personnages SVG, 26 Titres, 16 Thèmes, 5 Boosters)
    const DEFAULT_SHOP_ITEMS = [
        // --- HALOS & AURAS (24) ---
        { id: 'aurore', name: 'Aurore Boréale', category: 'aura', color: '#4fd8c4', cost: 0, desc: 'Lueur polaire chatoyante offerte à tous les élèves.' },
        { id: 'or', name: 'Comète Dorée', category: 'aura', color: '#c8a84b', cost: 60, desc: 'Rayonnement étincelant d\'or pur.' },
        { id: 'ametiste', name: 'Nova Améthyste', category: 'aura', color: '#b685f5', cost: 90, desc: 'Éclats mystiques de cristaux violets.' },
        { id: 'rose', name: 'Étoile Rose', category: 'aura', color: '#f58fc2', cost: 130, desc: 'Halo scintillant rose poudré.' },
        { id: 'braise', name: 'Braise Cosmique', category: 'aura', color: '#f5714f', cost: 170, desc: 'Ferveur ardente et braises solaires.' },
        { id: 'neon', name: 'Éclair Néon', category: 'aura', color: '#00ffcc', cost: 250, desc: 'Impulsion électrique cyberpunk hyper-lumineuse.' },
        { id: 'magma', name: 'Flamboiement Magma', category: 'aura', color: '#ff3300', cost: 300, desc: 'Puissance volcanique incandescente.' },
        { id: 'nebuleuse', name: 'Nébuleuse Profonde', category: 'aura', color: '#8a2be2', cost: 350, desc: 'Vortex stellaire aux teintes cosmiques.' },
        { id: 'supernova', name: 'Supernova Suprême', category: 'aura', color: '#ffd700', cost: 450, desc: 'Explosion d\'énergie céleste aveuglante.' },
        { id: 'dragon-aura', name: 'Flamme du Dragon', category: 'aura', color: '#00e5ff', cost: 600, desc: 'Aura mythique d\'azur et de flammes spectrales.' },
        { id: 'halo-cyber-grid', name: 'Bouclier Quantique', category: 'aura', color: '#00f5d4', cost: 280, desc: 'Halo cybernétique inspiré des filières CIEL & NSI.' },
        { id: 'halo-sante', name: 'Lueur Vitale', category: 'aura', color: '#34d399', cost: 220, desc: 'Rayonnement émeraude apaisant et énergisant.' },
        { id: 'aura-solaire', name: 'Éclipse Solaire', category: 'aura', color: '#ff9e00', cost: 140, desc: 'Couronne ambrée inspirée d\'une éclipse totale.' },
        { id: 'aura-glacier', name: 'Cristal Boréal', category: 'aura', color: '#7dd3fc', cost: 160, desc: 'Éclat givré d\'azur pur venu du cercle polaire.' },
        { id: 'aura-emeraude', name: 'Éclat d\'Émeraude', category: 'aura', color: '#10b981', cost: 190, desc: 'Halo verdoyant d\'une gemme forestière rare.' },
        { id: 'aura-rubis', name: 'Flamme Rubis', category: 'aura', color: '#f43f5e', cost: 210, desc: 'Lueur carmin intense vibrant d\'énergie.' },
        { id: 'aura-saphir', name: 'Abysses Saphir', category: 'aura', color: '#3b82f6', cost: 230, desc: 'Profondeur océanique au bleu électrique.' },
        { id: 'aura-sakura', name: 'Pétales Sakura', category: 'aura', color: '#fda4af', cost: 240, desc: 'Brise printanière rose cerisier tout en douceur.' },
        { id: 'aura-plasma', name: 'Arc Plasma', category: 'aura', color: '#e879f9', cost: 270, desc: 'Décharge magnétique violette haute fréquence.' },
        { id: 'aura-obsidian', name: 'Écho d\'Obsidienne', category: 'aura', color: '#6366f1', cost: 320, desc: 'Halo indigo sombre aux reflets métalliques.' },
        { id: 'aura-prisme', name: 'Prisme Spectral', category: 'aura', color: '#2dd4bf', cost: 380, desc: 'Réfraction cristalline aux nuances turquoise.' },
        { id: 'aura-phoenix', name: 'Plume de Phénix', category: 'aura', color: '#fb923c', cost: 420, desc: 'Aura solaire renaissant toujours plus brillante.' },
        { id: 'aura-galaxie', name: 'Anneau de Saturne', category: 'aura', color: '#c084fc', cost: 500, desc: 'Orbite cosmique de poussières d\'étoiles violettes.' },
        { id: 'aura-celeste', name: 'Couronne Astrale', category: 'aura', color: '#fde047', cost: 750, desc: 'Halo légendaire des plus grands champions d\'EDUQUEST.' },

        // --- PERSONNAGES & AVATARS (27 — 100 % SVG) ---
        { id: 'robot', name: 'Robot Assistant', category: 'avatar', color: '#8fb8c9', img: 'Image/personnages/robot.svg', cost: 0, desc: 'Le fidèle compagnon d\'aventure mécanique.' },
        { id: 'david-martinez', name: 'David Martinez', category: 'avatar', color: '#ffea00', img: 'Image/personnages/david-martinez.svg', cost: 0, desc: 'Légende de Night City équipée de la veste d\'Edgerunner et du Sandevistan.' },
        { id: 'fall-guys', name: 'Champion Fall Guys', category: 'avatar', color: '#ff3e9d', img: 'Image/personnages/fall-guys.svg', cost: 150, desc: 'Haricot rose bondissant coiffé de la couronne de la victoire.' },
        { id: 'hope-fortnite', name: 'Hope (Fortnite)', category: 'avatar', color: '#2563eb', img: 'Image/personnages/hope-fortnite.svg', cost: 200, desc: 'Rebelle de l\'Ordre munie de son bonnet à oreilles de chat et de ses lunettes roses.' },
        { id: 'kasane-teto', name: 'Kasane Teto', category: 'avatar', color: '#e11d48', img: 'Image/personnages/kasane-teto.svg', cost: 250, desc: 'Diva virtuelle UTAU/SynthV aux célèbres couettes rouges en forets.' },
        { id: 'helldiver', name: 'Helldiver', category: 'avatar', color: '#ffd60a', img: 'Image/personnages/helldiver.svg', cost: 300, desc: 'Soldat d\'élite de la Super-Terre répandant la Démocratie Gérée !' },
        { id: 'space-marine', name: 'Space Marine', category: 'avatar', color: '#1d4ed8', img: 'Image/personnages/space-marine.svg', cost: 350, desc: 'Ange de la Mort Astartes en armure énergétique Ultramarine.' },
        { id: 'doom-guy', name: 'Doom Slayer', category: 'avatar', color: '#4f772d', img: 'Image/personnages/doom-guy.svg', cost: 400, desc: 'Guerrier implacable en armure Praetor. Rip and Tear !' },
        { id: 'einstein', name: 'Albert Einstein', category: 'avatar', color: '#7fb3d5', img: 'Image/personnages/einstein.svg', cost: 150, desc: 'Le génie de la physique et de la relativité.' },
        { id: 'marie-curie', name: 'Marie Curie', category: 'avatar', color: '#6bca82', img: 'Image/personnages/marie-curie.svg', cost: 150, desc: 'Pionnière de la radioactivité et double Prix Nobel.' },
        { id: 'christophe-colomb', name: 'Christophe Colomb', category: 'avatar', color: '#c8a84b', img: 'Image/personnages/christophe-colomb.svg', cost: 200, desc: 'Grand navigateur et explorateur des océans.' },
        { id: 'lovelace', name: 'Ada Lovelace', category: 'avatar', color: '#ff66b2', img: 'Image/personnages/lovelace.svg', cost: 250, desc: 'Première programmeuse informatique de l\'Histoire.' },
        { id: 'pythagore', name: 'Pythagore', category: 'avatar', color: '#ffd166', img: 'Image/personnages/pythagore.svg', cost: 300, desc: 'Maître des triangles, des nombres et de l\'harmonie.' },
        { id: 'davinci', name: 'Léonard de Vinci', category: 'avatar', color: '#a8dadc', img: 'Image/personnages/davinci.svg', cost: 350, desc: 'Polymathe universel, artiste et inventeur de génie.' },
        { id: 'hugo', name: 'Victor Hugo', category: 'avatar', color: '#457b9d', img: 'Image/personnages/hugo.svg', cost: 350, desc: 'Géant de la littérature française et de la poésie.' },
        { id: 'astronaute', name: 'Astronaute Céleste', category: 'avatar', color: '#f1faee', img: 'Image/personnages/astronaute.svg', cost: 400, desc: 'Pionnier du cosmos bravant le vide interstellaire.' },
        { id: 'mage', name: 'Archimage du Savoir', category: 'avatar', color: '#9d4edd', img: 'Image/personnages/mage.svg', cost: 500, desc: 'Gardien des grimoires anciens et des secrets du monde.' },
        { id: 'nikola-tesla', name: 'Nikola Tesla', category: 'avatar', color: '#38bdf8', img: 'Image/personnages/nikola-tesla.svg', cost: 220, desc: 'Inventeur visionnaire du courant alternatif et des éclairs électriques.' },
        { id: 'pasteur', name: 'Louis Pasteur', category: 'avatar', color: '#4ade80', img: 'Image/personnages/pasteur.svg', cost: 220, desc: 'Fondateur de la microbiologie moderne et pionnier de la vaccination.' },
        { id: 'rosalind-franklin', name: 'Rosalind Franklin', category: 'avatar', color: '#34d399', img: 'Image/personnages/rosalind-franklin.svg', cost: 240, desc: 'Biophysicienne clé de la découverte de la double hélice d\'ADN.' },
        { id: 'galilee', name: 'Galilée', category: 'avatar', color: '#60a5fa', img: 'Image/personnages/galilee.svg', cost: 240, desc: 'Astronome et physicien pionnier de la méthode scientifique.' },
        { id: 'alan-turing', name: 'Alan Turing', category: 'avatar', color: '#22d3ee', img: 'Image/personnages/alan-turing.svg', cost: 260, desc: 'Père fondateur de l\'informatique, de la cryptanalyse et de l\'IA.' },
        { id: 'hypatie', name: 'Hypatie d\'Alexandrie', category: 'avatar', color: '#c084fc', img: 'Image/personnages/hypatie.svg', cost: 260, desc: 'Grande mathématicienne, astronome et philosophe de l\'Antiquité.' },
        { id: 'cleopatre', name: 'Cléopâtre VII', category: 'avatar', color: '#fbbf24', img: 'Image/personnages/cleopatre.svg', cost: 280, desc: 'Reine érudite d\'Alexandrie, diplomate et polyglotte légendaire.' },
        { id: 'samourai-cyber', name: 'Ronin Cyber', category: 'avatar', color: '#f43f5e', img: 'Image/personnages/samourai-cyber.svg', cost: 360, desc: 'Épéiste néon maître de la concentration et des réflexes.' },
        { id: 'alchimiste-etoile', name: 'Alchimiste Stellaire', category: 'avatar', color: '#a855f7', img: 'Image/personnages/alchimiste-etoile.svg', cost: 420, desc: 'Maître des potions cosmiques et des formules secrètes.' },
        { id: 'chevalier-astral', name: 'Chevalier Astral', category: 'avatar', color: '#facc15', img: 'Image/personnages/chevalier-astral.svg', cost: 550, desc: 'Gardien en armure dorée des archipels du savoir.' },

        // --- TITRES HONORIFIQUES (26) ---
        { id: 'titre-apprenti', name: '📜 Apprenti Curieux', category: 'title', color: '#64dfdf', cost: 50, desc: 'Titre honorifique affiché fièrement sur ton profil.' },
        { id: 'titre-chrono', name: '⚡ Maître du Temps', category: 'title', color: '#ffbe0b', cost: 120, desc: 'Titre réservé aux as de la rapidité en mode chrono.' },
        { id: 'titre-explorateur', name: '🌌 Explorateur Cosmique', category: 'title', color: '#7209b7', cost: 200, desc: 'Titre des grands arpenteurs des îles du savoir.' },
        { id: 'titre-erudit', name: '👑 Érudit Suprême', category: 'title', color: '#f72585', cost: 500, desc: 'La plus haute distinction académique d\'EDUQUEST.' },
        { id: 'titre-cyber', name: '🛡️ Cyber-Défenseur', category: 'title', color: '#38bdf8', cost: 160, desc: 'Distinction des experts en Cybersécurité et Réseaux (CIEL).' },
        { id: 'titre-codeur', name: '💻 Architecte du Code', category: 'title', color: '#22d3ee', cost: 160, desc: 'Titre décerné aux bâtisseurs d\'algorithmes (NSI & CIEL).' },
        { id: 'titre-stratege', name: '📊 Stratège STMG', category: 'title', color: '#fbbf24', cost: 160, desc: 'Titre des décideurs en Management, Droit et Mercatique.' },
        { id: 'titre-ingenieur', name: '⚙️ Ingénieur Éco-Tech', category: 'title', color: '#34d399', cost: 160, desc: 'Distinction des innovateurs en STI2D & Sciences de l\'Ingénieur.' },
        { id: 'titre-soignant', name: '🩺 Acteur Santé & Social', category: 'title', color: '#f472b6', cost: 160, desc: 'Titre dédié aux spécialistes des Sciences Sanitaires et Sociales.' },
        { id: 'titre-geopolitique', name: '🌐 Diplomate & Analyste', category: 'title', color: '#a78bfa', cost: 160, desc: 'Titre des passionnés d\'Histoire, Géopolitique et SES.' },
        { id: 'titre-labo', name: '🧫 Maître du Labo (STL)', category: 'title', color: '#34d399', cost: 160, desc: 'Titre des spécialistes en Biotechnologies et Sciences de Labo.' },
        { id: 'titre-designer', name: '🎨 Créateur Design (STD2A)', category: 'title', color: '#f472b6', cost: 160, desc: 'Titre des visionnaires du Design et des Arts Appliqués.' },
        { id: 'titre-chef', name: '🍽️ Chef Étoilé (STHR)', category: 'title', color: '#fb923c', cost: 160, desc: 'Distinction des talents de l\'Hôtellerie et de la Gastronomie.' },
        { id: 'titre-agronome', name: '🌱 Gardien du Vivant (STAV)', category: 'title', color: '#4ade80', cost: 160, desc: 'Titre des experts en Agronomie et Écologie durable.' },
        { id: 'titre-scene', name: '🎭 Virtuose de Scène (S2TMD)', category: 'title', color: '#c084fc', cost: 160, desc: 'Titre des artistes du Théâtre, de la Musique et de la Danse.' },
        { id: 'titre-humaniste', name: '📖 Humaniste Éclairé (HLP)', category: 'title', color: '#fde047', cost: 160, desc: 'Distinction des esprits brillants en Humanités et Lettres.' },
        { id: 'titre-scientifique', name: '🔬 Esprit Scientifique', category: 'title', color: '#38bdf8', cost: 160, desc: 'Titre des passionnés de Maths, Physique, Chimie et SVT.' },
        { id: 'titre-dev-sio', name: '🖥️ Développeur SIO', category: 'title', color: '#22d3ee', cost: 180, desc: 'Distinction des bâtisseurs d\'applications et bases de données (BTS SIO).' },
        { id: 'titre-manager-mco', name: '🛒 As du Commerce (MCO)', category: 'title', color: '#f59e0b', cost: 180, desc: 'Titre des champions de la relation client et du merchandising.' },
        { id: 'titre-expert-cg', name: '🧮 Expert Finance (CG)', category: 'title', color: '#60a5fa', cost: 180, desc: 'Titre des maîtres du bilan, de la TVA et du contrôle de gestion.' },
        { id: 'titre-elec-melec', name: '⚡ Maître Énergie (MELEC)', category: 'title', color: '#facc15', cost: 180, desc: 'Distinction des techniciens en électrotechnique et réseaux connectés.' },
        { id: 'titre-accompagnant', name: '🏥 Héros du Soin (ASSP)', category: 'title', color: '#fb7185', cost: 180, desc: 'Titre honorant l\'accompagnement et les soins à la personne.' },
        { id: 'titre-sans-faute', name: '💎 Perfectionniste', category: 'title', color: '#67e8f9', cost: 250, desc: 'Pour ceux qui visent systématiquement les 3 étoiles.' },
        { id: 'titre-stratege-combo', name: '🔥 Roi du Combo', category: 'title', color: '#ff6b6b', cost: 300, desc: 'Titre des virtuoses des longues séries de bonnes réponses.' },
        { id: 'titre-polyvalent', name: '🧭 Polymathe Universel', category: 'title', color: '#a78bfa', cost: 450, desc: 'Récompense la maîtrise pluridisciplinaire sur toutes les îles.' },
        { id: 'titre-legende', name: '🌠 Légende d\'Eduquest', category: 'title', color: '#ffd700', cost: 650, desc: 'Titre mythique réservé aux vétérans de la galaxie du savoir.' },

        // --- THÈMES & EFFETS (16) ---
        { id: 'default', name: '🌌 Thème Astral (Origine)', category: 'theme', color: '#c8a84b', cost: 0, desc: 'Le décor cosmique classique d\'EDUQUEST, offert par défaut.' },
        { id: 'theme-cyber', name: '🌐 Thème Cyber Néon', category: 'theme', color: '#00f5d4', cost: 180, desc: 'Ambiance futuriste aux teintes cyan et magenta.' },
        { id: 'theme-galaxie', name: '🌌 Thème Abysses Stellaires', category: 'theme', color: '#7b2cbf', cost: 220, desc: 'Fond spatial étoilé et nébuleuses profondes.' },
        { id: 'theme-or', name: '✨ Thème Palais Doré', category: 'theme', color: '#e0a96d', cost: 300, desc: 'Cadre impérial et dorures antiques.' },
        { id: 'theme-emeraude', name: '🌿 Thème Émeraude Tech', category: 'theme', color: '#10b981', cost: 200, desc: 'Palette éco-technologique vert émeraude et ardoise sombre.' },
        { id: 'theme-matrix', name: '🖥️ Thème Terminal Matrix', category: 'theme', color: '#22c55e', cost: 240, desc: 'Esthétique console développeur noir profond et vert phosphore.' },
        { id: 'theme-ocean', name: '🌊 Thème Abysse Océanique', category: 'theme', color: '#06b6d4', cost: 200, desc: 'Profondeurs marines bioluminescentes bleu-turquoise.' },
        { id: 'theme-aurore', name: '❄️ Thème Aurore Boréale', category: 'theme', color: '#38bdf8', cost: 210, desc: 'Ciel polaire bleu glacier et reflets boréaux.' },
        { id: 'theme-foret', name: '🌲 Thème Forêt Enchantée', category: 'theme', color: '#22c55e', cost: 210, desc: 'Clairière nocturne émeraude aux lucioles dorées.' },
        { id: 'theme-volcan', name: '🌋 Thème Forge Volcanique', category: 'theme', color: '#f97316', cost: 230, desc: 'Lave incandescente, basalte sombre et braises ardentes.' },
        { id: 'theme-sakura', name: '🌸 Thème Nuit Sakura', category: 'theme', color: '#f472b6', cost: 240, desc: 'Nuit japonaise veloutée aux fleurs de cerisier rose.' },
        { id: 'theme-amethyste', name: '🔮 Thème Cristal Améthyste', category: 'theme', color: '#a855f7', cost: 250, desc: 'Sanctuaire de quartz violet aux éclats mystiques.' },
        { id: 'theme-rubis', name: '🍷 Thème Rubis Crépusculaire', category: 'theme', color: '#e56b6f', cost: 250, desc: 'Éclat pourpre profond et reflets rubis nocturnes.' },
        { id: 'theme-parchemin', name: '📜 Thème Bibliothèque Antique', category: 'theme', color: '#d97706', cost: 260, desc: 'Ambiance grimoires anciens, boiseries et ambre chaud.' },
        { id: 'theme-retro', name: '🕹️ Thème Synthwave 80s', category: 'theme', color: '#ec4899', cost: 280, desc: 'Horizon rétro-futuriste néon rose, violet et cyan.' },
        { id: 'theme-celeste', name: '✨ Thème Sanctuaire Solaire', category: 'theme', color: '#facc15', cost: 360, desc: 'Voûte étoilée azur royal et éclats solaires.' },

        // --- BOOSTERS CONSOMMABLES (5) ---
        { id: 'boost-xp', name: '🧪 Potion Double XP', category: 'booster', color: '#38b000', cost: 75, desc: 'Double l\'XP gagnée au prochain niveau réussi !' },
        { id: 'boost-shield', name: '🛡️ Bouclier d\'Étoile', category: 'booster', color: '#0077b6', cost: 100, desc: 'Préserve tes 3 étoiles même en cas de première erreur.' },
        { id: 'boost-coins', name: '🪙 Élixir de Fortune (Pièces ×2)', category: 'booster', color: '#f59e0b', cost: 80, desc: 'Double les pièces d\'or gagnées au prochain niveau réussi !' },
        { id: 'boost-time', name: '⏳ Sablier Temporel (+15s)', category: 'booster', color: '#38bdf8', cost: 65, desc: 'Ajoute automatiquement +15 secondes au chrono en Mode Défi Chronométré.' },
        { id: 'boost-combo', name: '🔥 Flamme Éternelle (Garde-Série)', category: 'booster', color: '#f97316', cost: 95, desc: 'Sauvegarde ta série 🔥 et ton combo ⚡ même en cas d\'erreur (hors bouclier).' },
    ];

    // Pool par défaut des Quêtes Quotidiennes (pilotable depuis le panneau admin)
    const DEFAULT_QUEST_POOL = [
        { type: 'xp', icon: '⚡', title: 'Gagne 30 XP', target: 30, xp: 20, coins: 10, color: '#ffb547', enabled: true },
        { type: 'xp', icon: '🔥', title: 'Gagne 60 XP', target: 60, xp: 35, coins: 15, color: '#ff6b6b', enabled: true },
        { type: 'xp', icon: '🌟', title: 'Gagne 90 XP dans la journée', target: 90, xp: 45, coins: 25, color: '#f59e0b', enabled: true },
        { type: 'levels', icon: '🏝️', title: 'Réussis 2 niveaux', target: 2, xp: 20, coins: 10, color: '#4cc9f0', enabled: true },
        { type: 'levels', icon: '🗺️', title: 'Réussis 4 niveaux', target: 4, xp: 35, coins: 20, color: '#3ddc97', enabled: true },
        { type: 'levels', icon: '🧭', title: 'Explore et réussis 6 niveaux', target: 6, xp: 50, coins: 30, color: '#38bdf8', enabled: true },
        { type: 'perfect', icon: '⭐', title: 'Décroche 3 étoiles sur un niveau', target: 1, xp: 25, coins: 15, color: '#ffd166', enabled: true },
        { type: 'perfect', icon: '🏅', title: 'Décroche 3 étoiles sur 2 niveaux', target: 2, xp: 40, coins: 25, color: '#eab308', enabled: true },
        { type: 'firstTry', icon: '🎯', title: 'Réponds juste du 1er coup 3 fois', target: 3, xp: 30, coins: 15, color: '#b388ff', enabled: true },
    ];

    // Configuration par défaut des récompenses
    const DEFAULT_REWARDS = {
        xpBase: 15,              // XP par quiz réussi
        coinsBase: 10,           // Pièces par quiz réussi
        chronoBonusMaxXp: 15,    // Bonus max de rapidité en mode Chrono
        dailyChestCoins: 50,     // Récompense du coffre bonus quotidien
        firstTryBonusXp: 10,     // Bonus premier essai
        questRewardMultiplier: 1,// Multiplicateur récompenses des quêtes
    };

    // Configuration par défaut globale du site (v1.29.2 — pilotage intégral client depuis admin)
    const DEFAULT_SITE_CONFIG = {
        title: 'EDUQUEST',
        siteTitle: 'EDUQUEST',
        tagline: 'Le jeu de révision Collège, Lycée & BTS',
        announcement: '',
        exitTitle: "✨ Merci d'avoir joué à notre jeu ! ✨",
        exitSubtitle: 'À bientôt pour de nouvelles aventures !',
        dashboardFooterNote: 'EDUQUEST — Contenus alignés sur les programmes officiels.',
        defaultNiveau: '6eme',
        defaultFiliere: 'generale',
        quizTimerSeconds: 45,          // Durée standard en secondes du compte à rebours chrono
        xpMultiplier: 1.0,             // Multiplicateur global d'XP
        coinMultiplier: 1.0,           // Multiplicateur global de pièces
        coinsMultiplier: 1.0,
        sfxVolume: 0.6,
        musicVolume: 0.35,
        defaultBgmVolume: 35,          // Volume musique par défaut (0-100)
        defaultSfxVolume: 60,          // Volume effets sonores par défaut (0-100)
        soundEnabledByDefault: true,   // Son actif par défaut
        allowRegistration: true,       // Autoriser de nouveaux élèves à créer un compte
        enableShop: true,              // Activer l'onglet Boutique
        enableQuests: true,            // Activer le bloc Missions quotidiennes
        enableBadges: true,            // Activer l'onglet Succès
        enableChrono: true,            // Autoriser le Mode Défi Chronométré
        chronoEnabledByDefault: true,  // Activer le Mode Défi Chronométré par défaut
        strictStarsAntiCheat: true,    // Conserver le plafond d'étoiles (2★/1★) après erreur même en rejouant
        strictCollegeSubjects: true,   // Bloquer SES & Philosophie au collège même contre surcharges/matières custom
        confirmBeforeQuit: true,       // Afficher la modale de confirmation avant de quitter
        logoutOnQuit: true,            // Déconnecter la session active lors du clic sur Quitter
        hideGradeDuringQuiz: true,     // Masquer le sélecteur classe/filière pendant un exercice en cours
        showExpulsionTransition: true, // Afficher la transition animée d'expulsion lors d'un changement de classe
        showAudioToggleButton: true,   // Afficher le bouton flottant global 🔊/🔇 sur l'interface client
        showHintsInQuiz: true,         // Afficher le bouton d'indice pédagogique dans les exercices
        allowClientAppearance: true,   // Autoriser les élèves à personnaliser l'apparence dans Options
        defaultTheme: 'default',       // Thème visuel par défaut du site
        defaultUiPreset: 'default',    // Préréglage couleur d'interface par défaut
        defaultUiColor: '#0d1f3a',     // Couleur d'interface par défaut
        defaultUiAccent: '#c8a84b',    // Couleur d'accent par défaut
        defaultBtnPreset: 'default',   // Préréglage couleur des boutons par défaut
        defaultBtnColor: '#24354f',    // Couleur des boutons par défaut
        defaultBtnBrightness: 80,      // Luminosité des boutons par défaut (45..110 %)
        enableParticlesByDefault: true,// Particules étoilées actives par défaut
        enableConfetti: true,          // Confettis de célébration actifs globalement
        maintenanceMode: false,        // Mode bandeau d'alerte / examen
        maintenanceMessage: '',
    };

    // Lot de personas IA pédagogiques locales par défaut (pilotable depuis le panneau admin)
    const DEFAULT_LOCAL_AI_PERSONAS = [
        { id: 'ai-athena', name: 'IA Athéna', role: 'Analytique & Académique', icon: '🧠', color: '#4cc9f0', variantOffset: 0, hintPrefix: 'Analyse méthodique (Athéna) : ', enabled: true },
        { id: 'ai-socrate', name: 'IA Socrate', role: 'Maïeutique & Guidée', icon: '🏛️', color: '#ffd166', variantOffset: 1, hintPrefix: 'Piste de réflexion (Socrate) : ', enabled: true },
        { id: 'ai-chronos', name: 'IA Chronos', role: 'Défi & Réflexes', icon: '⚡', color: '#ff9f43', variantOffset: 2, hintPrefix: 'Astuce rapide (Chronos) : ', enabled: true },
        { id: 'ai-davinci', name: 'IA Da Vinci', role: 'Créative & Contextuelle', icon: '🎨', color: '#b388ff', variantOffset: 3, hintPrefix: 'Intuition visuelle (Da Vinci) : ', enabled: true },
        { id: 'ai-turing', name: 'IA Turing', role: 'Algorithmique & Adaptative', icon: '💻', color: '#3ddc97', variantOffset: 4, hintPrefix: 'Décomposition logique (Turing) : ', enabled: true },
    ];

    // Configuration par défaut de l'intégration IA (Multi-IA + Make.com + Adaptatif + Personas locales)
    const DEFAULT_AI_CONFIG = {
        generateWebhookUrl: '',        // Webhook POST de génération (Make, rétrocompatible)
        validateWebhookUrl: '',        // Webhook POST de validation (Make, rétrocompatible)
        providers: [],                 // Pool multi-IA [{ id, name, type, endpoint, validateEndpoint, apiKey, model, enabled, weight }]
        adaptiveMode: true,            // Active la difficulté adaptative et la non-répétition
        selectionStrategy: 'random',   // 'random' | 'round_robin'
        fetchTimeoutMs: 8000,          // Délai avant repli local en millisecondes
        timeoutMs: 8000,
        fallbackToOffline: true,       // Repli automatique sur AdaptiveEngine/QuestionBank si indisponible
        fallbackToLocal: true,
        enableLocalPersonas: true,     // Activer le lot de personas IA locales (Athéna, Socrate, Chronos, Da Vinci, Turing)
        showAiBadgeInQuiz: true,       // Afficher le badge IA / Moteur adaptatif dans les quiz
        localPersonas: null,           // null → DEFAULT_LOCAL_AI_PERSONAS ; tableau personnalisé si édité en admin
    };

    // Catalogue des 79 succès / badges par défaut d'EDUQUEST (filtrables par filière & cycle)
    const DEFAULT_BADGES = [
        // --- SUCCÈS UNIVERSELS (TOUTES FILIÈRES & TOUS CYCLES) ---
        { id: 'premier_quiz', icon: '🎯', name: 'Premier pas', desc: 'Réussis ta toute première question.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 1' },
        { id: 'sans_faute', icon: '✨', name: 'Sans-faute', desc: 'Réponds juste du premier coup, sans réessayer.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'justAnsweredFirstTry' },
        { id: 'toutes_matieres', icon: '🌐', name: 'Touche-à-tout', desc: 'Termine au moins une leçon dans chaque matière de ton parcours.', category: 'exploration', band: 'all', allowedFilieres: ['all'], condition: 'allSubjectsStarted' },
        { id: 'matiere_complete', icon: '🏆', name: 'Expert(e)', desc: 'Termine au moins 5 leçons d\'une même matière.', category: 'maitrise', band: 'all', allowedFilieres: ['all'], condition: 'oneSubjectAdvanced' },
        { id: 'collectionneur', icon: '🎨', name: 'Collectionneur', desc: 'Possède 3 skins ou articles différents.', category: 'boutique', band: 'all', allowedFilieres: ['all'], condition: 'ownedSkins >= 3' },
        { id: 'niveau_5', icon: '🚀', name: 'Étoile montante', desc: 'Atteins le niveau 5 (400+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 5' },
        { id: 'niveau_10', icon: '👑', name: 'Grand Maître', desc: 'Atteins le niveau 10 (900+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 10' },
        { id: 'riche', icon: '💰', name: 'Bourse pleine', desc: 'Accumule au moins 100 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 100' },
        { id: 'magnat', icon: '🏦', name: 'Magnat d\'Eduquest', desc: 'Accumule au moins 250 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 250' },
        { id: 'alchimiste', icon: '🧪', name: 'Alchimiste', desc: 'Achète ou possède une potion magique.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'hasBooster' },
        { id: 'potion_double_xp', icon: '⚡', name: 'Surtension', desc: 'Utilise une Potion Double XP.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'usedDoubleXp' },
        { id: 'bouclier_etoile', icon: '🛡️', name: 'Invulnérable', desc: 'Utilise un Bouclier d\'Étoile pour protéger un score parfait.', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'usedShield' },
        { id: 'maths_fan', icon: '📐', name: 'Arithméticien', desc: 'Atteins le niveau 5 en Mathématiques.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'mathsLevel >= 5' },
        { id: 'francais_fan', icon: '📚', name: 'Littéraire', desc: 'Atteins le niveau 5 en Français.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'francaisLevel >= 5' },
        { id: 'histoire_fan', icon: '📜', name: 'Chroniqueur', desc: 'Atteins le niveau 5 en Histoire.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'histoireLevel >= 5' },
        { id: 'explorateur_geo', icon: '🌍', name: 'Cartographe', desc: 'Atteins le niveau 5 en Géographie.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'geoLevel >= 5' },
        { id: 'polyglotte', icon: '🇬🇧', name: 'Polyglotte', desc: 'Atteins le niveau 5 en Anglais.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'anglaisLevel >= 5' },
        { id: 'citoyen', icon: '⚖️', name: 'Citoyen Éclairé', desc: 'Atteins le niveau 5 en EMC.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'emcLevel >= 5' },
        { id: 'fashion_victim', icon: '✨', name: 'Aura Éclatante', desc: 'Équipe une aura scintillante pour ton avatar.', category: 'personnalisation', band: 'all', allowedFilieres: ['all'], condition: 'auraEquipped' },
        { id: 'theme_custom', icon: '🎭', name: 'Nouveau Décor', desc: 'Applique un thème visuel personnalisé.', category: 'personnalisation', band: 'all', allowedFilieres: ['all'], condition: 'themeEquipped' },
        { id: 'streak_3', icon: '🔥', name: 'Série Ardente', desc: 'Réussis 3 leçons d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 3' },
        { id: 'streak_5', icon: '⚡', name: 'Inarrêtable', desc: 'Atteins une série de 5 victoires d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 5' },
        { id: 'combo_5', icon: '👑', name: 'Maître du Combo', desc: 'Enchaîne 5 bonnes réponses consécutives.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'comboCount >= 5' },
        { id: 'queteur', icon: '📋', name: 'Assidu', desc: 'Réclame une récompense de quête journalière.', category: 'quetes', band: 'all', allowedFilieres: ['all'], condition: 'questClaimed' },
        { id: 'coffre_ouvert', icon: '🎁', name: 'Chasseur de Trésor', desc: 'Ouvre le coffre quotidien bonus.', category: 'quetes', band: 'all', allowedFilieres: ['all'], condition: 'dailyChestOpened' },

        // --- NOUVEAUX SUCCÈS UNIVERSELS (PROGRESSION, ÉTOILES, SÉRIES, ÉCONOMIE, COLLECTION & POTIONS) ---
        { id: 'cinq_niveaux', icon: '🗺️', name: 'Explorateur Confirmé', desc: 'Termine 5 niveaux au total.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 5' },
        { id: 'dix_niveaux', icon: '🧭', name: 'Aventurier Aguerri', desc: 'Termine 10 niveaux au total.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 10' },
        { id: 'vingt_cinq_niveaux', icon: '🏔️', name: 'Conquérant des Îles', desc: 'Termine 25 niveaux au total.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 25' },
        { id: 'cinquante_niveaux', icon: '🚀', name: 'Commandant Galactique', desc: 'Termine 50 niveaux au total.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 50' },
        { id: 'cent_niveaux', icon: '🌟', name: 'Centurion du Savoir', desc: 'Termine 100 niveaux au total.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'totalCompleted >= 100' },
        { id: 'trois_etoiles', icon: '⭐', name: 'Première Constellation', desc: 'Obtiens 3 étoiles sur un niveau.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'threeStarCount >= 1' },
        { id: 'grand_maitre', icon: '🌠', name: 'Pluie d\'Étoiles', desc: 'Décroche 3 étoiles sur 10 niveaux différents.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'threeStarCount >= 10' },
        { id: 'perfectionniste_25', icon: '💎', name: 'Perfectionniste d\'Élite', desc: 'Décroche 3 étoiles sur 25 niveaux différents.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'threeStarCount >= 25' },
        { id: 'streak_10', icon: '🔥', name: 'Flamme Inextinguible', desc: 'Enchaîne 10 victoires d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 10' },
        { id: 'streak_20', icon: '☄️', name: 'Météore Imparable', desc: 'Enchaîne 20 victoires d\'affilée.', category: 'progression', band: 'all', allowedFilieres: ['all'], condition: 'streakCount >= 20' },
        { id: 'combo_10', icon: '⚡', name: 'Supercharge Légendaire', desc: 'Enchaîne 10 bonnes réponses consécutives.', category: 'precision', band: 'all', allowedFilieres: ['all'], condition: 'maxCombo >= 10' },
        { id: 'niveau_15', icon: '🛸', name: 'Navigateur Stellaire', desc: 'Atteins le niveau 15 (1 400+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 15' },
        { id: 'niveau_20', icon: '🌌', name: 'Légende Cosmique', desc: 'Atteins le niveau 20 (1 900+ XP).', category: 'niveau', band: 'all', allowedFilieres: ['all'], condition: 'playerLevel >= 20' },
        { id: 'tresorier_500', icon: '💎', name: 'Trésorier Royal', desc: 'Accumule au moins 500 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 500' },
        { id: 'milliardaire_1000', icon: '👑', name: 'Empereur d\'Or', desc: 'Accumule au moins 1 000 pièces d\'or.', category: 'economie', band: 'all', allowedFilieres: ['all'], condition: 'coins >= 1000' },
        { id: 'garde_robe_10', icon: '🛍️', name: 'Grand Collectionneur', desc: 'Possède au moins 10 articles différents de la boutique.', category: 'boutique', band: 'all', allowedFilieres: ['all'], condition: 'ownedSkins >= 10' },
        { id: 'musee_20', icon: '🏛️', name: 'Conservateur du Musée', desc: 'Possède au moins 20 articles différents de la boutique.', category: 'boutique', band: 'all', allowedFilieres: ['all'], condition: 'ownedSkins >= 20' },
        { id: 'titre_equipe', icon: '🏷️', name: 'Porteur de Titre', desc: 'Équipe un titre honorifique sur ton profil.', category: 'personnalisation', band: 'all', allowedFilieres: ['all'], condition: 'titleEquipped' },
        { id: 'potion_fortune', icon: '🪙', name: 'Alchimiste Fortuné', desc: 'Utilise un Élixir de Fortune (Pièces ×2).', category: 'potions', band: 'all', allowedFilieres: ['all'], condition: 'usedDoubleCoins' },

        // --- SUCCÈS COLLÈGE / TRANSVERSE SCIENTIFIQUE & LANGUES ---
        { id: 'technophile', icon: '💻', name: 'Technophile', desc: 'Atteins le niveau 5 en Technologie (Collège).', category: 'matieres', band: 'college', allowedFilieres: ['all'], condition: 'technoLevel >= 5' },
        { id: 'sciences_fan', icon: '🔬', name: 'Scientifique', desc: 'Atteins le niveau 5 en SVT, Physique ou Chimie.', category: 'matieres', band: 'all', allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'st2s', 'stl', 'stav', 'sciences_spe', 'bac_pro_melec', 'bac_pro_assp'], condition: 'scienceLevel >= 5' },
        { id: 'hispanophone', icon: '🇪🇸', name: 'Hispanophone', desc: 'Atteins le niveau 5 en Espagnol (LV2).', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'espagnolLevel >= 5' },
        { id: 'germanophone', icon: '🇩🇪', name: 'Germanophone', desc: 'Atteins le niveau 5 en Allemand.', category: 'matieres', band: 'all', allowedFilieres: ['all'], condition: 'allemandLevel >= 5' },
        { id: 'artiste_melomane', icon: '🎨', name: 'Esprit Créatif', desc: 'Atteins le niveau 5 en Arts & Musique.', category: 'matieres', band: 'all', allowedFilieres: ['generale', 'std2a', 's2tmd', 'hlp_llce'], condition: 'artsLevel >= 5' },

        // --- SUCCÈS LYCÉE GÉNÉRAL, HUMANITÉS & SCIENCES ---
        { id: 'philo_fan', icon: '🏛️', name: 'Penseur Antique', desc: 'Atteins le niveau 5 en Philosophie.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'stmg', 'sti2d', 'st2s', 'stl', 'std2a', 'sthr', 'stav', 's2tmd', 'hlp_llce', 'sciences_spe'], condition: 'philoLevel >= 5' },
        { id: 'geopoliticien', icon: '🗺️', name: 'Géopoliticien', desc: 'Atteins le niveau 5 en HGGSP (Géopolitique).', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'hlp_llce'], condition: 'hggspLevel >= 5' },
        { id: 'economiste_ses', icon: '💹', name: 'Économiste SES', desc: 'Atteins le niveau 5 en SES (Économie & Sociologie).', category: 'matieres', band: 'lycee', allowedFilieres: ['generale'], condition: 'sesLevel >= 5' },
        { id: 'hlp_orateur', icon: '📖', name: 'Orateur HLP', desc: 'Atteins le niveau 5 en Humanités & Littérature (HLP).', category: 'matieres', band: 'lycee', allowedFilieres: ['hlp_llce', 'generale'], condition: 'hlpLevel >= 5' },
        { id: 'sciences_spe_crack', icon: '🔬', name: 'Prodige des Sciences', desc: 'Atteins le niveau 10 en Maths, Physique, Chimie ou SVT.', category: 'matieres', band: 'lycee', allowedFilieres: ['sciences_spe', 'generale'], condition: 'sciencesSpeLevel >= 10' },

        // --- SUCCÈS SPÉCIALITÉ NSI & NUMÉRIQUE ---
        { id: 'nsi_fan', icon: '💻', name: 'Codeur NSI', desc: 'Atteins le niveau 5 en NSI & Numérique.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'ciel', 'bts_sio'], condition: 'nsiLevel >= 5' },

        // --- SUCCÈS FILIÈRE CIEL & BTS SIO (CYBER, RÉSEAUX, DEV & ÉLECTRONIQUE) ---
        { id: 'ciel_fan', icon: '🛡️', name: 'Expert CIEL', desc: 'Atteins le niveau 5 en Cybersécurité, Réseaux ou Électronique.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe', 'bts_sio'], condition: 'cielLevel >= 5' },
        { id: 'cyber_gardien', icon: '🔐', name: 'Gardien Cyber', desc: 'Atteins le niveau 5 en Cybersécurité.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe', 'bts_sio'], condition: 'cyberLevel >= 5' },
        { id: 'architecte_reseau', icon: '🌐', name: 'Architecte Réseau', desc: 'Atteins le niveau 5 en Réseaux & Systèmes.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'nsi_spe', 'bts_sio'], condition: 'reseauxLevel >= 5' },
        { id: 'maitre_electronique', icon: '🔌', name: 'Maître des Circuits', desc: 'Atteins le niveau 5 en Électronique & Systèmes.', category: 'matieres', band: 'lycee', allowedFilieres: ['ciel', 'sti2d', 'bac_pro_melec'], condition: 'electroniqueLevel >= 5' },
        { id: 'sio_architecte', icon: '🖥️', name: 'Développeur BTS SIO', desc: 'Atteins le niveau 5 en Développement & Bases de Données.', category: 'matieres', band: 'lycee', allowedFilieres: ['bts_sio', 'nsi_spe'], condition: 'devBddLevel >= 5' },

        // --- SUCCÈS FILIÈRES STMG, BTS MCO & BTS CG ---
        { id: 'stmg_fan', icon: '📊', name: 'Manager STMG', desc: 'Atteins le niveau 5 en MSGN, Droit-Éco ou Mercatique.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg'], condition: 'stmgLevel >= 5' },
        { id: 'juriste_junior', icon: '⚖️', name: 'Juriste Junior', desc: 'Atteins le niveau 5 en Droit & Économie.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg', 'ciel', 'sthr', 'bts_sio', 'bts_mco', 'bts_cg'], condition: 'droitEcoLevel >= 5' },
        { id: 'as_mercatique', icon: '📈', name: 'As du Marketing', desc: 'Atteins le niveau 5 en Mercatique.', category: 'matieres', band: 'lycee', allowedFilieres: ['stmg', 'bts_mco', 'sthr'], condition: 'mercatiqueLevel >= 5' },
        { id: 'mco_negociateur', icon: '🛒', name: 'Manager BTS MCO', desc: 'Atteins le niveau 5 en Relation Client & Commerce.', category: 'matieres', band: 'lycee', allowedFilieres: ['bts_mco'], condition: 'commerceLevel >= 5' },
        { id: 'cg_auditeur', icon: '🧮', name: 'Auditeur BTS CG', desc: 'Atteins le niveau 5 en Comptabilité & Finance.', category: 'matieres', band: 'lycee', allowedFilieres: ['bts_cg'], condition: 'comptabiliteLevel >= 5' },

        // --- SUCCÈS FILIÈRES STI2D, SI & BAC PRO MELEC ---
        { id: 'sti2d_fan', icon: '⚙️', name: 'Ingénieur STI2D', desc: 'Atteins le niveau 5 en I2D, SIN ou Sciences de l\'Ingénieur.', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d'], condition: 'sti2dLevel >= 5' },
        { id: 'eco_concepteur', icon: '🌿', name: 'Éco-Concepteur', desc: 'Atteins le niveau 5 en I2D (Innovation & Éco).', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d'], condition: 'i2dLevel >= 5' },
        { id: 'dompteur_signaux', icon: '📡', name: 'Dompteur de Signaux', desc: 'Atteins le niveau 5 en SIN (Info & Numérique).', category: 'matieres', band: 'lycee', allowedFilieres: ['sti2d', 'bac_pro_melec'], condition: 'sinLevel >= 5' },
        { id: 'ingenieur_systeme', icon: '📐', name: 'Ingénieur Système', desc: 'Atteins le niveau 5 en Sciences de l\'Ingénieur.', category: 'matieres', band: 'lycee', allowedFilieres: ['generale', 'nsi_spe', 'sti2d', 'sciences_spe'], condition: 'siLevel >= 5' },
        { id: 'melec_technicien', icon: '⚡', name: 'Expert MELEC', desc: 'Atteins le niveau 5 en Électrotechnique & Énergie.', category: 'matieres', band: 'lycee', allowedFilieres: ['bac_pro_melec'], condition: 'electrotechLevel >= 5' },

        // --- SUCCÈS FILIÈRES ST2S, STL, ASSP, STD2A, STHR, STAV & S2TMD ---
        { id: 'st2s_fan', icon: '🩺', name: 'Spécialiste ST2S', desc: 'Atteins le niveau 5 en STSS.', category: 'matieres', band: 'lycee', allowedFilieres: ['st2s'], condition: 'stssLevel >= 5' },
        { id: 'acteur_sante', icon: '🏥', name: 'Acteur de Santé', desc: 'Atteins le niveau 10 en STSS (Santé & Social).', category: 'matieres', band: 'lycee', allowedFilieres: ['st2s'], condition: 'stssLevel >= 10' },
        { id: 'stl_biotech', icon: '🧫', name: 'Bio-Laborantin', desc: 'Atteins le niveau 5 en Biotechnologies & Labo.', category: 'matieres', band: 'lycee', allowedFilieres: ['stl', 'bac_pro_assp'], condition: 'biotechLevel >= 5' },
        { id: 'stl_expert', icon: '🧪', name: 'Chimiste de Labo (STL)', desc: 'Atteins le niveau 10 en Biotechnologies ou Chimie.', category: 'matieres', band: 'lycee', allowedFilieres: ['stl'], condition: 'stlLevel >= 10' },
        { id: 'assp_bienveillant', icon: '🏥', name: 'Professionnel ASSP', desc: 'Atteins le niveau 5 en STSS ou Biotechnologies (ASSP).', category: 'matieres', band: 'lycee', allowedFilieres: ['bac_pro_assp'], condition: 'asspLevel >= 5' },
        { id: 'std2a_design', icon: '🎨', name: 'Designer STD2A', desc: 'Atteins le niveau 5 en Design & Arts Appliqués.', category: 'matieres', band: 'lycee', allowedFilieres: ['std2a'], condition: 'designLevel >= 5' },
        { id: 'sthr_chef', icon: '🍽️', name: 'Maître Hôtelier (STHR)', desc: 'Atteins le niveau 5 en Hôtellerie & Gastronomie.', category: 'matieres', band: 'lycee', allowedFilieres: ['sthr'], condition: 'hotellerieLevel >= 5' },
        { id: 'stav_agronome', icon: '🌱', name: 'Éco-Agronome (STAV)', desc: 'Atteins le niveau 5 en Agronomie & Écologie.', category: 'matieres', band: 'lycee', allowedFilieres: ['stav'], condition: 'agronomieLevel >= 5' },
        { id: 's2tmd_virtuose', icon: '🎭', name: 'Virtuose S2TMD', desc: 'Atteins le niveau 5 en Arts de la Scène & Culture.', category: 'matieres', band: 'lycee', allowedFilieres: ['s2tmd'], condition: 'spectacleLevel >= 5' },
    ];

    /* -----------------------------------------------------------------------
       ÉTAT INTERNE
       ----------------------------------------------------------------------- */

    let cache = null;                 // Config chargée en mémoire
    let defaults = null;              // Matières par défaut (enregistrées par app.js)

    /** Lecture brute de la config depuis localStorage. */
    function _read() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
        catch { return null; }
    }

    /** Écriture de la config (avec cache). */
    function _write(d) {
        cache = d;
        try { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
        catch { /* quota dépassé : on reste en mémoire pour la session */ }
    }

    /** Retourne la config courante (crée la structure par défaut si absente). */
    function _data() {
        if (cache) return cache;
        const d = _read();
        if (d && d.v === 1 && d.subjects && Array.isArray(d.subjects.customs)) {
            if (!d.shop) d.shop = { overrides: {}, customs: [] };
            if (!d.rewards) d.rewards = null;
            if (!d.badges) d.badges = { overrides: {}, customs: [] };
            if (!d.siteConfig) d.siteConfig = null;
            if (!d.aiConfig) d.aiConfig = null;
            if (d.filieres === undefined) d.filieres = null;
            if (d.quests === undefined) d.quests = null;
            cache = d;
        } else {
            cache = {
                v: 1,
                siteConfig: null,
                aiConfig: null,
                levels: null,
                filieres: null,
                quests: null,
                subjects: { overrides: {}, customs: [] },
                credits: {},
                shop: { overrides: {}, customs: [] },
                rewards: null,
                badges: { overrides: {}, customs: [] },
            };
        }
        return cache;
    }

    function _save() { _write(_data()); }

    /** Clone profond (évite toute mutation accidentelle des objets stockés). */
    function _clone(x) { return JSON.parse(JSON.stringify(x)); }

    /* -----------------------------------------------------------------------
       UTILITAIRES PUBLICS
       ----------------------------------------------------------------------- */

    /** Échappe une chaîne pour insertion HTML sécurisée. */
    /** Valide une couleur hexadécimale #rrggbb. */
    function _safeHex(val, fallback) {
        const s = typeof val === 'string' ? val.trim() : '';
        return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
    }

    /** Valide un chemin/URL d'image sûr (rejette javascript:, vbscript:, data:text/html, //). */
    function _safeMediaUrl(val) {
        const s = typeof val === 'string' ? val.trim() : '';
        if (!s) return '';
        if (/^(javascript|vbscript|file):/i.test(s) || s.startsWith('//')) return '';
        if (/^data:/i.test(s)) {
            return /^data:image\/(png|webp|jpeg|jpg|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(s) ? s : '';
        }
        return s;
    }

    /** Parse un entier en préservant 0 (contrairement à `parseInt(v) || def`). */
    function _parseIntPreserveZero(val, fallback, min, max) {
        if (val === '' || val === null || val === undefined) return fallback;
        const n = parseInt(val, 10);
        if (!Number.isFinite(n)) return fallback;
        let out = n;
        if (typeof min === 'number') out = Math.max(min, out);
        if (typeof max === 'number') out = Math.min(max, out);
        return out;
    }

    /** Parse un flottant en préservant 0. */
    function _parseFloatPreserveZero(val, fallback, min, max) {
        if (val === '' || val === null || val === undefined) return fallback;
        const n = parseFloat(val);
        if (!Number.isFinite(n)) return fallback;
        let out = n;
        if (typeof min === 'number') out = Math.max(min, out);
        if (typeof max === 'number') out = Math.min(max, out);
        return out;
    }

    /** Valide une URL de site web ou dépôt (accepte https://, http://, ou domaine nu). */
    function _isSafeWebUrl(val) {
        const s = String(val || '').trim();
        if (!s) return true;
        if (/^(javascript|vbscript|data|file):/i.test(s) || s.startsWith('//')) return false;
        if (/^https?:\/\/[^\s]+$/i.test(s)) return true;
        // Autorise un domaine nu du type "mon-site.fr" ou "eduquest.fr/aide" sans schéma dangereux
        return !s.includes(':') && /^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(s);
    }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Transforme un nom en identifiant stable (slug), ex. « Sciences de la Terre » → « sciences-de-la-terre ». */
    function slug(name) {
        const s = String(name || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return s || 'matiere';
    }

    /** Propose un identifiant unique pour une nouvelle matière (sans collision). */
    function suggestSubjectId(name, takenIds) {
        const taken = new Set(takenIds || []);
        let base = slug(name);
        let id = base;
        let i = 2;
        while (taken.has(id)) id = base + '-' + (i++);
        return id;
    }

    /**
     * Valide une leçon selon son type. Retourne un message d'erreur (string)
     * ou null si la leçon est valide.
     * Type absent = QCM (compatibilité avec le format historique du jeu).
     */
    function validateLesson(lesson) {
        if (!lesson || typeof lesson !== 'object') return 'Leçon invalide.';
        const type = lesson.type || 'qcm';
        if (!LESSON_TYPES.includes(type)) return 'Type de question inconnu : ' + type;
        const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

        if (type === 'qcm') {
            if (!nonEmpty(lesson.q)) return 'La question (QCM) ne peut pas être vide.';
            if (!Array.isArray(lesson.opts) || lesson.opts.length < 2) return 'Un QCM doit proposer au moins 2 réponses.';
            if (lesson.opts.some(o => !nonEmpty(o))) return 'Les réponses proposées ne peuvent pas être vides.';
            if (new Set(lesson.opts.map(o => o.trim())).size !== lesson.opts.length) return 'Deux réponses proposées sont identiques.';
            const correct = Number(lesson.correct);
            if (!Number.isInteger(correct) || correct < 0 || correct >= lesson.opts.length)
                return 'La bonne réponse (QCM) doit pointer vers une des réponses proposées.';
            return null;
        }
        if (type === 'vrai_faux') {
            if (!nonEmpty(lesson.q)) return 'L’affirmation (Vrai/Faux) ne peut pas être vide.';
            if (typeof lesson.correct !== 'boolean') return 'La réponse (Vrai/Faux) doit être Vrai ou Faux.';
            return null;
        }
        if (type === 'reponse_courte') {
            if (!nonEmpty(lesson.q)) return 'La question (réponse courte) ne peut pas être vide.';
            if (!Array.isArray(lesson.accepted) || lesson.accepted.length === 0 || lesson.accepted.some(a => !nonEmpty(a)))
                return 'Précisez au moins une réponse acceptée (réponse courte).';
            return null;
        }
        if (type === 'texte_a_trous' || type === 'texte_a_choix') {
            if (!nonEmpty(lesson.textWithBlanks)) return 'La phrase à compléter ne peut pas être vide.';
            const count = (lesson.textWithBlanks.match(/_{3,}|\[_{3,}\]/g) || []).length;
            if (count === 0) return 'La phrase doit contenir au moins un trou (___).';
            if (type === 'texte_a_choix') {
                if (Array.isArray(lesson.choices) && lesson.choices.length > 0) {
                    if (lesson.choices.length !== count) {
                        return 'Il faut exactement ' + count + ' liste(s) de choix (une par trou ___ ).';
                    }
                    if (lesson.choices.some(c => !Array.isArray(c) || c.length === 0 || c.some(opt => !nonEmpty(opt)))) {
                        return 'Chaque menu déroulant doit contenir au moins un choix non vide.';
                    }
                    return null;
                }
            }
            if (!Array.isArray(lesson.blanks) || lesson.blanks.length !== count)
                return 'Il faut exactement ' + count + ' groupe(s) de réponses (un par trou ___ ).';
            if (lesson.blanks.some(b => !Array.isArray(b) || b.length === 0 || b.some(a => !nonEmpty(a))))
                return 'Chaque trou doit accepter au moins une réponse.';
            return null;
        }
        // drag_and_drop (association)
        if (!nonEmpty(lesson.q)) return 'La consigne (association) ne peut pas être vide.';
        if (!Array.isArray(lesson.items) || lesson.items.length < 2) return 'Il faut au moins 2 éléments à associer.';
        if (!Array.isArray(lesson.targets) || lesson.targets.length < 2) return 'Il faut au moins 2 cibles d’association.';
        if (lesson.items.some(i => !nonEmpty(i)) || lesson.targets.some(t => !nonEmpty(t)))
            return 'Les éléments et cibles ne peuvent pas être vides.';
        if (lesson.items.length !== lesson.targets.length)
            return 'Le nombre d’éléments doit être égal au nombre de cibles (association par position).';
        if (new Set(lesson.items.map(i => i.trim())).size !== lesson.items.length) return 'Deux éléments sont identiques.';
        if (new Set(lesson.targets.map(t => t.trim())).size !== lesson.targets.length) return 'Deux cibles sont identiques.';
        return null;
    }

    /** Ramène une leçon à sa forme canonique (type explicite, champs utiles). */
    function normalizeLesson(lesson) {
        const l = { ...(lesson || {}) };
        l.type = l.type || 'qcm';
        l.title = (typeof l.title === 'string' && l.title.trim()) ? l.title.trim() : '';
        l.q = typeof l.q === 'string' ? l.q.trim() : '';
        l.exp = typeof l.exp === 'string' ? l.exp.trim() : '';
        if (l.type === 'qcm') {
            l.opts = (l.opts || []).map(o => String(o).trim());
            l.correct = Number(l.correct);
        } else if (l.type === 'vrai_faux') {
            delete l.opts; delete l.correctIndex;
        } else if (l.type === 'reponse_courte') {
            l.accepted = (l.accepted || []).map(a => String(a).trim());
        } else if (l.type === 'texte_a_trous') {
            l.textWithBlanks = l.textWithBlanks || '';
            l.blanks = (l.blanks || []).map(b => (Array.isArray(b) ? b : [b]).map(a => String(a).trim()));
        } else if (l.type === 'texte_a_choix') {
            l.textWithBlanks = l.textWithBlanks || '';
            l.blanks = (l.blanks || []).map(b => (Array.isArray(b) ? b : [b]).map(a => String(a).trim()));
            l.choices = Array.isArray(l.choices)
                ? l.choices.map(c => Array.isArray(c) ? c.map(x => String(x).trim()) : String(c).trim())
                : [];
        } else if (l.type === 'drag_and_drop') {
            l.items = (l.items || []).map(i => String(i).trim());
            l.targets = (l.targets || []).map(t => String(t).trim());
            if (!l.pairs || typeof l.pairs !== 'object' || Object.keys(l.pairs).length === 0) {
                const rebuilt = {};
                l.items.forEach((it, idx) => {
                    if (it && l.targets[idx]) rebuilt[it] = l.targets[idx];
                });
                l.pairs = rebuilt;
            }
        }
        return l;
    }

    /* -----------------------------------------------------------------------
       NIVEAUX SCOLAIRES
       ----------------------------------------------------------------------- */

    function _rawLevels() {
        const stored = _data().levels;
        return (Array.isArray(stored) && stored.length > 0) ? stored : DEFAULT_LEVELS;
    }

    /** Liste effective des niveaux scolaires (config admin OU valeurs par défaut). */
    function getLevels() {
        return _rawLevels().map(l => ({
            id: l.id,
            label: l.label || l.name || l.id,
            name: l.label || l.name || l.id,
            band: l.band || 'college'
        }));
    }

    /** true si l'administrateur a personnalisé la liste des niveaux. */
    function levelsModified() {
        return _data().levels !== null;
    }

    /** Bande de contenu ('college' | 'lycee') d'un id de niveau, ou null. */
    function levelBand(niveauId) {
        if (!niveauId) return null;
        const found = _rawLevels().find(l => l.id === niveauId);
        return found ? (found.band === 'lycee' ? 'lycee' : 'college') : null;
    }

    /** Label affiché d'un id de niveau (ou l'id si inconnu). */
    function levelLabel(niveauId) {
        if (!niveauId) return '';
        const found = _rawLevels().find(l => l.id === niveauId);
        return found ? (found.label || found.name || found.id) : niveauId;
    }

    /** Valide et enregistre la liste des niveaux scolaires. */
    function _validateLevels(list) {
        if (!Array.isArray(list) || list.length === 0) return { ok: false, error: 'Il faut au moins un niveau scolaire.' };
        const ids = new Set();
        const clean = [];
        for (const l of list) {
            const rawId = (l && typeof l.id === 'string') ? l.id.trim() : '';
            if (!rawId || !/^[a-z0-9_-]+$/i.test(rawId))
                return { ok: false, error: 'Identifiant de niveau invalide (lettres, chiffres, tirets uniquement).' };
            const normId = rawId.toLowerCase();
            if (ids.has(normId)) return { ok: false, error: 'Identifiant en double : ' + rawId };
            ids.add(normId);
            if (typeof l.label !== 'string' || !l.label.trim()) return { ok: false, error: 'Libellé de niveau vide.' };
            if (l.band !== 'college' && l.band !== 'lycee') return { ok: false, error: 'Bande invalide pour ' + rawId + '.' };
            clean.push({ id: rawId, label: l.label.trim(), band: l.band });
        }
        return { ok: true, clean };
    }

    function saveLevels(list) {
        const res = _validateLevels(list);
        if (!res.ok) return res;
        _data().levels = res.clean;
        _save();
        return { ok: true };
    }

    /** Revient aux niveaux scolaires par défaut. */
    function resetLevels() {
        _data().levels = null;
        _save();
    }

    /* -----------------------------------------------------------------------
       CRÉDITS DU CRÉATEUR
       -----------------------------------------------------------------------
       Textes affichés sur toutes les pages (footer) et utilisés par la page
       légale (legal.html). Modifiables depuis le panneau d'administration.
       ----------------------------------------------------------------------- */

    // Valeurs par défaut : l'objet gardé en mémoire est écrasé par les valeurs
    // personnalisées, mais resetCredits() restaure ces références d'origine.
    const DEFAULT_TEAM_MEMBERS = [
        { id: 'clement-amisse', name: 'Clément Amisse', role: 'Créateur & Développeur', bio: 'Conception, développement et architecture globale d’EDUQUEST.', avatar: 'Image/team/clement-amisse.jpg', github: '', links: '' },
        { id: 'raphael-grados', name: 'Raphaël Grados', role: 'Créateur & Développeur', bio: 'Architecture pédagogique, intégration technique et filières.', avatar: '', github: '', links: '' },
        { id: 'sacha-siegel', name: 'Sacha Siegel', role: 'Créateur & Concepteur', bio: 'Conception des mécaniques de jeu, logique et parcours.', avatar: '', github: '', links: '' },
        { id: 'francois-lucas', name: 'François Lucas', role: 'Créateur & Concepteur', bio: 'Conception des contenus, questions et équilibrage.', avatar: '', github: '', links: '' },
        { id: 'lucas-delferriere', name: 'Lucas Delferriere', role: 'Créateur & Concepteur', bio: 'Design interactif, expérience utilisateur et contenus.', avatar: '', github: '', links: '' },
        { id: 'theo-piou', name: 'Théo Piou', role: 'Créateur & Concepteur', bio: 'Conception pédagogique, multimédia et immersion.', avatar: '', github: '', links: '' },
        { id: 'aimane-toure', name: 'Aimane Toure', role: 'Créateur & Concepteur', bio: 'Gestion des banques de données et validation des épreuves.', avatar: '', github: '', links: '' }
    ];

    const DEFAULT_CREDITS = {
        studioName: 'EDUQUEST',
        tagline: 'Apprendre en s\u2019amusant',
        creatorName: 'Clément Amisse, Raphaël Grados, Sacha Siegel, François Lucas, Lucas Delferriere, Théo Piou & Aimane Toure',
        contactEmail: '',
        website: '',
        githubUrl: 'https://github.com/EDUQUEST2026-2027/EDUQUEST',
        extraNote: 'Site conçu et développé avec passion pour la réussite scolaire de la 6e au BTS.',
        team: DEFAULT_TEAM_MEMBERS,
    };

    const CREDIT_TEXT_FIELDS = ['studioName', 'tagline', 'creatorName', 'contactEmail', 'website', 'githubUrl', 'extraNote'];

    function cloneDefaults() { return _clone(DEFAULT_CREDITS); }

    /** Crédits effectifs (personnalisés par-dessus les valeurs par défaut). */
    function getCredits() {
        const stored = _data().credits || {};
        const teamMerged = Array.isArray(stored.team) && stored.team.length > 0
            ? _clone(stored.team)
            : _clone(DEFAULT_TEAM_MEMBERS);
        return Object.assign({}, DEFAULT_CREDITS, stored, { team: teamMerged });
    }

    /** true si au moins un champ de crédit a été personnalisé. */
    function creditsModified() {
        const c = _data().credits;
        return Boolean(c) && Object.keys(c).length > 0;
    }

    /**
     * Valide et enregistre les crédits. Les champs inconnus sont ignorés,
     * les champs omis conservent leur valeur existante et les URLs dangereuses sont rejetées.
     */
    function _validateCredits(values, baseCredits) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Donn\u00e9es de cr\u00e9dits invalides.' };
        const clean = Object.assign({}, baseCredits || {});
        for (const key of CREDIT_TEXT_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(values, key)) {
                const v = String(values[key] == null ? '' : values[key]).trim();
                if (v.length > 300) return { ok: false, error: 'Le champ « ' + key + ' » ne peut pas d\u00e9passer 300 caract\u00e8res.' };
                if ((key === 'website' || key === 'githubUrl') && !_isSafeWebUrl(v)) {
                    return { ok: false, error: 'URL invalide ou non sécurisée pour « ' + key + ' ».' };
                }
                clean[key] = v;
            }
        }
        if (Array.isArray(values.team)) {
            const cleanTeam = [];
            for (const member of values.team) {
                if (!member || typeof member !== 'object') continue;
                const id = String(member.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
                    || ('m-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
                const name = String(member.name || '').trim();
                if (!name) continue;
                const role = String(member.role || 'Créateur').trim().slice(0, 100);
                const bio = String(member.bio || '').trim().slice(0, 300);
                const avatar = _safeMediaUrl(member.avatar || '');
                const rawGh = String(member.github || '').trim().slice(0, 200);
                const rawLink = String(member.links || '').trim().slice(0, 200);
                const github = rawGh && _isSafeWebUrl(rawGh) ? rawGh : '';
                const links = rawLink && _isSafeWebUrl(rawLink) ? rawLink : '';
                cleanTeam.push({ id, name: name.slice(0, 100), role, bio, avatar, github, links });
            }
            if (cleanTeam.length > 0) {
                clean.team = cleanTeam;
            }
        }
        return { ok: true, clean };
    }

    function saveCredits(values) {
        const res = _validateCredits(values, _data().credits);
        if (!res.ok) return res;
        _data().credits = res.clean;
        _save();
        return { ok: true, credits: getCredits() };
    }

    /** Restaure les crédits par défaut. */
    function resetCredits() {
        _data().credits = {};
        _save();
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : RÈGLES DE CYCLE & REGISTRE DES DÉFAUTS (enregistré par app.js)
       ----------------------------------------------------------------------- */

    /** Cycle par défaut ('college' | 'lycee' | 'all') d'une matière. */
    function defaultBandForSubject(subjectOrId) {
        const id = typeof subjectOrId === 'string' ? subjectOrId : (subjectOrId && subjectOrId.id) || '';
        const explicitBand = (subjectOrId && typeof subjectOrId === 'object' && (subjectOrId.band === 'college' || subjectOrId.band === 'lycee' || subjectOrId.band === 'all'))
            ? subjectOrId.band
            : null;
        if (explicitBand) return explicitBand;
        if (SUBJECT_DEFAULT_RULES[id]) return SUBJECT_DEFAULT_RULES[id].band;
        return 'all';
    }

    /** Classes autorisées par défaut pour une matière (strictement cohérent Collège / Lycée). */
    function defaultAllowedNiveauxForSubject(subject) {
        const levels = _rawLevels();
        if (!subject) return levels.map(l => l.id);
        if (Array.isArray(subject.allowedNiveaux) && subject.allowedNiveaux.length > 0) {
            return subject.allowedNiveaux.slice();
        }
        const id = typeof subject === 'string' ? subject : subject.id;
        if (SUBJECT_DEFAULT_RULES[id]) {
            const ruleLevels = SUBJECT_DEFAULT_RULES[id].allowedNiveaux;
            const existingIds = new Set(levels.map(l => l.id));
            const matching = ruleLevels.filter(nid => existingIds.has(nid));
            if (matching.length > 0) return matching;
        }
        const band = defaultBandForSubject(subject);
        if (band === 'all') return levels.map(l => l.id);
        return levels.filter(l => (l.band || 'college') === band).map(l => l.id);
    }

    function _rawFilieres() {
        const stored = _data().filieres;
        return (Array.isArray(stored) && stored.length > 0) ? stored : DEFAULT_FILIERES;
    }

    function _defaultAllowedNiveauxForFiliereId(filiereId) {
        const clean = String(filiereId || '').trim().toLowerCase();
        const def = DEFAULT_FILIERES.find(d => d.id === clean);
        if (def && Array.isArray(def.allowedNiveaux) && def.allowedNiveaux.length > 0) {
            return def.allowedNiveaux.slice();
        }
        return LYCEE_BTS.slice();
    }

    function _normalizeFiliereAllowedNiveaux(rawNiv, filiereId) {
        if (Array.isArray(rawNiv) && rawNiv.length > 0) {
            const validIds = new Set(_rawLevels().map(l => l.id));
            const filtered = [...new Set(rawNiv.map(n => String(n || '').trim()).filter(n => n && (validIds.size === 0 || validIds.has(n))))];
            if (filtered.length > 0) return filtered;
        }
        return _defaultAllowedNiveauxForFiliereId(filiereId);
    }

    /** Retourne la liste complète des filières (config admin ou valeurs par défaut). */
    function getFilieres() {
        return _rawFilieres().map(f => {
            const id = String(f.id || '').trim().toLowerCase();
            return {
                id,
                label: String(f.label || f.id || '').trim(),
                shortLabel: String(f.shortLabel || f.label || f.id || '').trim(),
                icon: String(f.icon || '🧭').trim() || '🧭',
                enabled: f.enabled !== false,
                allowedNiveaux: _normalizeFiliereAllowedNiveaux(f.allowedNiveaux, id),
                desc: String(f.desc || '').trim(),
            };
        });
    }

    /** Retourne uniquement les filières actives (pour les sélecteurs du jeu). */
    function getActiveFilieres() {
        const active = getFilieres().filter(f => f.enabled !== false);
        return active.length > 0 ? active : getFilieres().slice(0, 1);
    }

    /** Indique si une filière est autorisée pour un niveau d'étude donné (ex: BTS uniquement en bts1/bts2). */
    function isFiliereAllowedForNiveau(filiereOrId, niveauId) {
        if (!isFiliereApplicable(niveauId)) return false;
        const norm = (typeof QuestionBank !== 'undefined' && typeof QuestionBank.normalizeNiveau === 'function')
            ? QuestionBank.normalizeNiveau(niveauId)
            : String(niveauId || '2nde').toLowerCase().trim();
        const fil = (filiereOrId && typeof filiereOrId === 'object')
            ? filiereOrId
            : getFilieres().find(f => f.id === String(filiereOrId || '').toLowerCase().trim());
        if (!fil) return false;
        const allowed = Array.isArray(fil.allowedNiveaux) && fil.allowedNiveaux.length > 0
            ? fil.allowedNiveaux
            : _defaultAllowedNiveauxForFiliereId(fil.id);
        return allowed.includes(norm);
    }

    /** Retourne les filières actives autorisées pour un niveau d'étude donné (Lycée 2nde, 1ère/Tle, ou BTS 1/2). */
    function getFilieresForNiveau(niveauId, { includeDisabled = false } = {}) {
        if (!isFiliereApplicable(niveauId)) return [];
        const base = includeDisabled ? getFilieres() : getActiveFilieres();
        const matching = base.filter(f => isFiliereAllowedForNiveau(f, niveauId));
        return matching.length > 0 ? matching : base;
    }

    /** Résout une filière cohérente pour un niveau donné (bascule intelligemment lors d'un changement Lycée ↔ BTS ou 2nde ↔ 1ère). */
    function resolveFiliereForNiveau(filiereId, niveauId) {
        const clean = String(filiereId || '').toLowerCase().trim();
        if (!isFiliereApplicable(niveauId)) return clean || 'generale';
        const allowed = getFilieresForNiveau(niveauId);
        if (clean && allowed.some(f => f.id === clean)) return clean;
        const norm = (typeof QuestionBank !== 'undefined' && typeof QuestionBank.normalizeNiveau === 'function')
            ? QuestionBank.normalizeNiveau(niveauId)
            : String(niveauId || '2nde').toLowerCase().trim();
        // Passerelles pédagogiques naturelles lors du changement de cycle
        const bridges = {
            bts1: { nsi_spe: 'bts_sio', stmg: 'bts_mco', generale: 'bts_sio', sti2d: 'ciel', bac_pro_melec: 'ciel' },
            bts2: { nsi_spe: 'bts_sio', stmg: 'bts_mco', generale: 'bts_sio', sti2d: 'ciel', bac_pro_melec: 'ciel' },
            '2nde': { nsi_spe: 'generale', hlp_llce: 'generale', sciences_spe: 'generale', stmg: 'generale', sti2d: 'generale', st2s: 'generale', stl: 'generale', std2a: 'generale', stav: 'generale', bts_sio: 'generale', bts_mco: 'generale', bts_cg: 'generale' },
            '1ere': { bts_sio: 'nsi_spe', bts_mco: 'stmg', bts_cg: 'stmg' },
            terminale: { bts_sio: 'nsi_spe', bts_mco: 'stmg', bts_cg: 'stmg' },
        };
        const target = bridges[norm] && bridges[norm][clean];
        if (target && allowed.some(f => f.id === target)) return target;
        if (allowed.some(f => f.id === 'generale')) return 'generale';
        return allowed.length > 0 ? allowed[0].id : (clean || 'generale');
    }

    /** true si l'administrateur a personnalisé les filières. */
    function filieresModified() {
        return Array.isArray(_data().filieres) && _data().filieres.length > 0;
    }

    /** Valide et enregistre la liste des filières. */
    function saveFilieres(list) {
        if (!Array.isArray(list) || list.length === 0) {
            return { ok: false, error: 'Il faut au moins une filière.' };
        }
        const ids = new Set();
        const clean = [];
        for (const f of list) {
            const id = String(f && f.id || '').trim().toLowerCase();
            if (!id || !/^[a-z0-9_-]+$/i.test(id) || id === 'all') {
                return { ok: false, error: 'Identifiant de filière invalide (lettres, chiffres, tirets uniquement, ≠ "all").' };
            }
            if (ids.has(id)) return { ok: false, error: 'Identifiant de filière en double : ' + id };
            ids.add(id);
            const label = String(f.label || '').trim();
            if (!label) return { ok: false, error: 'Libellé de filière vide pour ' + id + '.' };
            clean.push({
                id,
                label,
                shortLabel: String(f.shortLabel || label).trim() || label,
                icon: String(f.icon || '🧭').trim() || '🧭',
                enabled: f.enabled !== false,
                allowedNiveaux: _normalizeFiliereAllowedNiveaux(f.allowedNiveaux, id),
                desc: String(f.desc || '').trim(),
            });
        }
        if (!clean.some(f => f.enabled !== false)) {
            return { ok: false, error: 'Au moins une filière doit rester active.' };
        }
        _data().filieres = clean;
        _save();
        return { ok: true, filieres: getFilieres() };
    }

    /** Rétablit les filières officielles par défaut. */
    function resetFilieres() {
        _data().filieres = null;
        _save();
        return { ok: true, filieres: getFilieres() };
    }

    function getFiliere(filiereId) {
        const clean = String(filiereId || 'generale').toLowerCase().trim();
        const list = getFilieres();
        return list.find(f => f.id === clean) || list.find(f => f.enabled !== false) || list[0];
    }

    function filiereLabel(filiereId) {
        const f = getFiliere(filiereId);
        return f ? f.label : 'Voie Générale';
    }

    /** Indique si la sélection de filière s'applique à ce niveau (Lycée & BTS uniquement, pas au Collège). */
    function isFiliereApplicable(niveauId) {
        const norm = (typeof QuestionBank !== 'undefined' && typeof QuestionBank.normalizeNiveau === 'function')
            ? QuestionBank.normalizeNiveau(niveauId)
            : String(niveauId || '6eme').toLowerCase().trim();
        const b = levelBand(norm) || (['2nde', '1ere', 'terminale', 'bts1', 'bts2'].includes(norm) ? 'lycee' : 'college');
        return b === 'lycee';
    }

    /** Retourne les filières autorisées pour une matière ('all' ou tableau d'ids). */
    function defaultAllowedFilieresForSubject(subject) {
        if (!subject) return ['all'];
        if (Array.isArray(subject.allowedFilieres) && subject.allowedFilieres.length > 0) {
            return subject.allowedFilieres.slice();
        }
        const id = typeof subject === 'string' ? subject : subject.id;
        if (SUBJECT_DEFAULT_RULES[id] && Array.isArray(SUBJECT_DEFAULT_RULES[id].allowedFilieres)) {
            return SUBJECT_DEFAULT_RULES[id].allowedFilieres.slice();
        }
        return ['all'];
    }

    /** Indique si une matière est une spécialité phare de la filière sélectionnée. */
    function isSubjectSpecialtyForFiliere(subject, filiereId) {
        if (!subject || !filiereId) return false;
        const f = String(filiereId).toLowerCase().trim();
        const specs = Array.isArray(subject.specialtyFilieres)
            ? subject.specialtyFilieres
            : (SUBJECT_DEFAULT_RULES[subject.id] ? (SUBJECT_DEFAULT_RULES[subject.id].specialtyFilieres || []) : []);
        return specs.includes(f);
    }

    /** Détecte les matières SES / Philosophie (strictement interdites au collège si strictCollegeSubjects actif). */
    function _isStrictLyceeSubject(subject) {
        if (!subject) return false;
        const id = String(subject.id || '').toLowerCase().trim();
        const name = String(subject.name || '').toLowerCase().trim();
        return id === 'ses' || id === 'philo'
            || /^(ses|philo|philosophie)\b/i.test(id)
            || /^(ses|philo|philosophie)\b/i.test(name);
    }

    const COLLEGE_LEVEL_IDS = ['6eme', '5eme', '4eme', '3eme'];

    /**
     * Source unique de vérité : retourne true si et seulement si `subject`
     * est active et autorisée pour la classe `niveauId` (et la filière `filiereId`
     * lorsque le niveau est au lycée ou en BTS).
     * Garantit notamment l'absence totale de SES, Philosophie, NSI et matières
     * de filières au collège, de Technologie au lycée, et de Philosophie avant la Terminale.
     */
    function isSubjectAllowedForNiveau(subject, niveauId, filiereId) {
        if (!subject || subject.enabled === false) return false;
        const norm = (typeof QuestionBank !== 'undefined' && typeof QuestionBank.normalizeNiveau === 'function')
            ? QuestionBank.normalizeNiveau(niveauId)
            : String(niveauId || '6eme').toLowerCase().trim();
        const storedSiteCfg = _data().siteConfig;
        const strictCollege = !storedSiteCfg || storedSiteCfg.strictCollegeSubjects !== false;
        const isCollegeLevel = COLLEGE_LEVEL_IDS.includes(norm) || levelBand(norm) === 'college';
        if (strictCollege && isCollegeLevel && _isStrictLyceeSubject(subject)) {
            return false;
        }
        // Respecte un choix explicite vide (ex: « Tout décocher » dans l'admin)
        if (subject._allowedNiveauxExplicit && Array.isArray(subject.allowedNiveaux) && subject.allowedNiveaux.length === 0) {
            return false;
        }
        const allowed = Array.isArray(subject.allowedNiveaux) && subject.allowedNiveaux.length > 0
            ? subject.allowedNiveaux
            : defaultAllowedNiveauxForSubject(subject);
        let levelOk = false;
        if (allowed.length > 0) {
            levelOk = allowed.includes(norm);
        } else {
            const band = defaultBandForSubject(subject);
            if (band === 'all') {
                levelOk = true;
            } else {
                const nBand = levelBand(norm) || ((['2nde', '1ere', 'terminale', 'bts1', 'bts2'].includes(norm)) ? 'lycee' : 'college');
                levelOk = (band === nBand);
            }
        }
        if (!levelOk) return false;

        // Au lycée / BTS : filtrage selon la filière choisie (par défaut filière résolue pour le niveau)
        if (isFiliereApplicable(norm)) {
            const effectiveFiliere = filiereId
                ? (String(filiereId).toLowerCase().trim() || resolveFiliereForNiveau('generale', norm))
                : resolveFiliereForNiveau('generale', norm);
            const allowedFil = defaultAllowedFilieresForSubject(subject);
            if (allowedFil.length > 0 && !allowedFil.includes('all')) {
                return allowedFil.includes(effectiveFiliere);
            }
        }
        return true;
    }

    /**
     * Enregistre une copie des matières par défaut (RAW_DASH_SUBJECTS).
     * Appelé une seule fois par app.js au chargement. Ces matières ne sont
     * pas dupliquées dans localStorage : seule leur surcharge est stockée.
     */
    function registerDefaults(rawSubjects) {
        if (defaults || !Array.isArray(rawSubjects)) return;
        defaults = {};
        rawSubjects.forEach(s => {
            const rule = SUBJECT_DEFAULT_RULES[s.id];
            const band = s.band || (rule ? rule.band : 'all');
            const allowedNiveaux = (Array.isArray(s.allowedNiveaux) && s.allowedNiveaux.length > 0)
                ? _clone(s.allowedNiveaux)
                : (rule ? _clone(rule.allowedNiveaux) : []);
            const allowedFilieres = (Array.isArray(s.allowedFilieres) && s.allowedFilieres.length > 0)
                ? _clone(s.allowedFilieres)
                : (rule && Array.isArray(rule.allowedFilieres) ? _clone(rule.allowedFilieres) : ['all']);
            defaults[s.id] = {
                id: s.id,
                name: s.name,
                icon: s.icon,
                island: s.island || '',
                band,
                allowedNiveaux,
                allowedFilieres,
                enabled: s.enabled !== false,
                description: s.description || '',
                lessons: _clone(s.lessons || []),
            };
        });
    }

    /** Matières par défaut enregistrées (pour le panneau d'administration). */
    function getDefaultSubjects() {
        return defaults ? Object.keys(defaults).map(id => _clone(defaults[id])) : [];
    }

    function getDefaultSubject(id) {
        return defaults && defaults[id] ? _clone(defaults[id]) : null;
    }

    function isCustom(id) {
        return _data().subjects.customs.some(c => c.id === id);
    }

    /** true si une surcharge (nom/icône/leçons/niveaux) existe pour cette matière. */
    function hasOverride(id) {
        return Object.prototype.hasOwnProperty.call(_data().subjects.overrides, id);
    }

    /** true si au moins une matière personnalisée ou surcharge de matière existe. */
    function hasSubjectCustomizations() {
        const s = _data().subjects;
        if (!s) return false;
        return (Array.isArray(s.customs) && s.customs.length > 0)
            || (Boolean(s.overrides) && Object.keys(s.overrides).length > 0);
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : APPLICATION DES SURCHARGES (appelé par app.js)
       ----------------------------------------------------------------------- */

    /**
     * Applique les personnalisations administrateur sur la liste brute des
     * matières et retourne la liste effective (ordre préservé, matières
     * personnalisées ajoutées à la fin).
     * Les matières personnalisées sont marquées `_custom: true` : app.js ne
     * leur applique PAS QuestionBank.extend (pas de banque de contenu propre),
     * leurs leçons sont exactement celles écrites dans le panneau.
     */
    function applyOverrides(rawSubjects) {
        const data = _data();
        const strictCollege = getSiteConfig().strictCollegeSubjects !== false;
        const enforceStrictCollege = (sub) => {
            if (!strictCollege || !_isStrictLyceeSubject(sub)) return sub;
            sub.band = 'lycee';
            if (Array.isArray(sub.allowedNiveaux) && sub.allowedNiveaux.length > 0) {
                sub.allowedNiveaux = sub.allowedNiveaux.filter(n => !COLLEGE_LEVEL_IDS.includes(n));
            }
            return sub;
        };
        const result = (Array.isArray(rawSubjects) ? rawSubjects : []).map(raw => {
            const rule = SUBJECT_DEFAULT_RULES[raw.id];
            const out = _clone(raw);
            if (!out.band) out.band = rule ? rule.band : 'all';
            if ((!Array.isArray(out.allowedNiveaux) || out.allowedNiveaux.length === 0) && rule) {
                out.allowedNiveaux = _clone(rule.allowedNiveaux);
            }
            if ((!Array.isArray(out.allowedFilieres) || out.allowedFilieres.length === 0) && rule && Array.isArray(rule.allowedFilieres)) {
                out.allowedFilieres = _clone(rule.allowedFilieres);
            }
            if ((!Array.isArray(out.specialtyFilieres) || out.specialtyFilieres.length === 0) && rule && Array.isArray(rule.specialtyFilieres)) {
                out.specialtyFilieres = _clone(rule.specialtyFilieres);
            }
            const ov = data.subjects.overrides[raw.id];
            if (!ov) return enforceStrictCollege(out);
            if (typeof ov.name === 'string' && ov.name.trim()) out.name = ov.name.trim();
            if (typeof ov.icon === 'string' && ov.icon.trim()) {
                const cleanIcon = ov.icon.trim();
                const rawIsland = typeof raw.island === 'string' ? raw.island.trim() : '';
                out.icon = cleanIcon;
                if (cleanIcon !== rawIsland) {
                    out.island = '';
                    out._iconOverridden = true;
                }
            }
            if (ov.band) out.band = ov.band;
            if (Array.isArray(ov.allowedNiveaux)) {
                out.allowedNiveaux = _clone(ov.allowedNiveaux);
                out._allowedNiveauxExplicit = true;
            }
            if (Array.isArray(ov.allowedFilieres) && ov.allowedFilieres.length > 0) {
                out.allowedFilieres = _clone(ov.allowedFilieres);
            }
            if (Array.isArray(ov.specialtyFilieres)) {
                out.specialtyFilieres = _clone(ov.specialtyFilieres);
            }
            if (typeof ov.enabled === 'boolean') out.enabled = ov.enabled;
            if (typeof ov.description === 'string') out.description = ov.description;
            if (Array.isArray(ov.lessons) && ov.lessons.length) out.lessons = _clone(ov.lessons);
            return enforceStrictCollege(out);
        });
        data.subjects.customs.forEach(c => {
            result.push(enforceStrictCollege({
                id: c.id,
                name: c.name,
                icon: c.icon,
                band: c.band || 'all',
                allowedNiveaux: _clone(c.allowedNiveaux || []),
                allowedFilieres: (Array.isArray(c.allowedFilieres) && c.allowedFilieres.length > 0) ? _clone(c.allowedFilieres) : ['all'],
                specialtyFilieres: Array.isArray(c.specialtyFilieres) ? _clone(c.specialtyFilieres) : [],
                enabled: c.enabled !== false,
                description: c.description || '',
                lessons: _clone(c.lessons),
                _custom: true,
            }));
        });
        return result;
    }

    /* -----------------------------------------------------------------------
       MATIÈRES : OPÉRATIONS DU PANNEAU
       ----------------------------------------------------------------------- */

    /**
     * Liste « éditable » : matières par défaut + personnalisées, chacune avec
     * ses leçons effectives (surchargées si l'admin les a modifiées).
     */
    function listEditable(rawSubjects) {
        const data = _data();
        const out = (Array.isArray(rawSubjects) ? rawSubjects : []).map(raw => {
            const ov = data.subjects.overrides[raw.id];
            const rule = SUBJECT_DEFAULT_RULES[raw.id];
            const defBand = raw.band || (rule ? rule.band : 'all');
            const defAllowed = (Array.isArray(raw.allowedNiveaux) && raw.allowedNiveaux.length > 0)
                ? _clone(raw.allowedNiveaux)
                : (rule ? _clone(rule.allowedNiveaux) : []);
            const effectiveAllowed = (ov && Array.isArray(ov.allowedNiveaux))
                ? _clone(ov.allowedNiveaux)
                : defAllowed;
            const effectiveSpec = (ov && Array.isArray(ov.specialtyFilieres))
                ? _clone(ov.specialtyFilieres)
                : (Array.isArray(raw.specialtyFilieres) && raw.specialtyFilieres.length > 0
                    ? _clone(raw.specialtyFilieres)
                    : (rule && Array.isArray(rule.specialtyFilieres) ? _clone(rule.specialtyFilieres) : []));
            const rawIsland = typeof raw.island === 'string' ? raw.island.trim() : '';
            const ovIcon = (ov && typeof ov.icon === 'string') ? ov.icon.trim() : '';
            return {
                id: raw.id,
                name: ov && ov.name ? ov.name : raw.name,
                icon: ovIcon || raw.icon,
                island: (ovIcon && ovIcon !== rawIsland) ? '' : rawIsland,
                band: ov && ov.band ? ov.band : defBand,
                allowedNiveaux: effectiveAllowed,
                _allowedNiveauxExplicit: Boolean(ov && Array.isArray(ov.allowedNiveaux)),
                allowedFilieres: (ov && Array.isArray(ov.allowedFilieres) && ov.allowedFilieres.length > 0)
                    ? _clone(ov.allowedFilieres)
                    : (Array.isArray(raw.allowedFilieres) && raw.allowedFilieres.length > 0
                        ? _clone(raw.allowedFilieres)
                        : (rule && Array.isArray(rule.allowedFilieres) ? _clone(rule.allowedFilieres) : ['all'])),
                specialtyFilieres: effectiveSpec,
                enabled: ov && typeof ov.enabled === 'boolean' ? ov.enabled : (raw.enabled !== false),
                description: ov && typeof ov.description === 'string' ? ov.description : (raw.description || ''),
                isCustom: false,
                customized: Boolean(ov),
                lessons: ov && Array.isArray(ov.lessons) && ov.lessons.length ? _clone(ov.lessons) : _clone(raw.lessons || []),
            };
        });
        data.subjects.customs.forEach(c => {
            out.push({
                id: c.id,
                name: c.name,
                icon: c.icon,
                band: c.band || 'all',
                allowedNiveaux: _clone(c.allowedNiveaux || []),
                allowedFilieres: (Array.isArray(c.allowedFilieres) && c.allowedFilieres.length > 0) ? _clone(c.allowedFilieres) : ['all'],
                specialtyFilieres: Array.isArray(c.specialtyFilieres) ? _clone(c.specialtyFilieres) : [],
                enabled: c.enabled !== false,
                description: c.description || '',
                isCustom: true,
                customized: true,
                lessons: _clone(c.lessons),
            });
        });
        return out;
    }

    /** Applique un renommage / changement d'icône / cycle / niveaux / filières / visibilité. */
    function saveSubjectMeta(id, patch = {}) {
        if (!id) return { ok: false, error: 'Identifiant de matière manquant.' };
        const data = _data();
        const nameV = typeof patch.name === 'string' ? patch.name.trim() : '';
        const iconV = typeof patch.icon === 'string' ? patch.icon.trim() : '';
        const bandV = (patch.band === 'college' || patch.band === 'lycee' || patch.band === 'all') ? patch.band : undefined;
        const allowedNiveaux = Array.isArray(patch.allowedNiveaux) ? patch.allowedNiveaux.map(String) : undefined;
        const allowedFilieres = Array.isArray(patch.allowedFilieres)
            ? (patch.allowedFilieres.length > 0 ? patch.allowedFilieres.map(f => String(f).toLowerCase().trim()).filter(Boolean) : ['all'])
            : undefined;
        const specialtyFilieres = Array.isArray(patch.specialtyFilieres)
            ? patch.specialtyFilieres.map(f => String(f).toLowerCase().trim()).filter(f => f && f !== 'all')
            : undefined;
        const enabled = typeof patch.enabled === 'boolean' ? patch.enabled : undefined;
        const descV = typeof patch.description === 'string' ? patch.description.trim() : undefined;

        const custom = data.subjects.customs.find(c => c.id === id);
        if (custom) {
            if (nameV) custom.name = nameV;
            if (iconV) custom.icon = iconV;
            if (bandV !== undefined) custom.band = bandV;
            if (allowedNiveaux !== undefined) custom.allowedNiveaux = allowedNiveaux;
            if (allowedFilieres !== undefined) custom.allowedFilieres = allowedFilieres;
            if (specialtyFilieres !== undefined) custom.specialtyFilieres = specialtyFilieres;
            if (enabled !== undefined) custom.enabled = enabled;
            if (descV !== undefined) custom.description = descV;
            _save();
            return { ok: true, subject: _clone(custom) };
        }
        // Matière système → on travaille dans les surcharges
        const ov = data.subjects.overrides[id] || (data.subjects.overrides[id] = {});
        if (nameV) ov.name = nameV;
        if (iconV) ov.icon = iconV;
        if (bandV !== undefined) ov.band = bandV;
        if (allowedNiveaux !== undefined) ov.allowedNiveaux = allowedNiveaux;
        if (allowedFilieres !== undefined) ov.allowedFilieres = allowedFilieres;
        if (specialtyFilieres !== undefined) ov.specialtyFilieres = specialtyFilieres;
        if (enabled !== undefined) ov.enabled = enabled;
        if (descV !== undefined) ov.description = descV;
        _save();
        return { ok: true, override: _clone(ov) };
    }

    /** Enregistre la liste complète des leçons d'une matière (système ou personnalisée). */
    function saveLessons(id, lessons) {
        if (!Array.isArray(lessons) || lessons.length === 0) return { ok: false, error: 'Il faut au moins une leçon.' };
        const clean = lessons.map(l => normalizeLesson(l));
        for (let i = 0; i < clean.length; i++) {
            const err = validateLesson(clean[i]);
            if (err) return { ok: false, error: 'Leçon ' + (i + 1) + ' : ' + err };
        }
        const data = _data();
        const custom = data.subjects.customs.find(c => c.id === id);
        if (custom) {
            custom.lessons = clean;
        } else {
            const ov = data.subjects.overrides[id] || (data.subjects.overrides[id] = {});
            ov.lessons = clean;
        }
        _save();
        return { ok: true, lessons: clean };
    }

    /** Crée une matière personnalisée (avec son cycle d'études, ses niveaux, ses filières et sa première leçon). */
    function createCustomSubject(name, icon, firstLesson, meta = {}) {
        const nameV = typeof name === 'string' ? name.trim() : '';
        if (!nameV) return { ok: false, error: 'Donnez un nom à la matière.' };
        const data = _data();
        const taken = Object.keys(data.subjects.overrides)
            .concat(data.subjects.customs.map(c => c.id))
            .concat(defaults ? Object.keys(defaults) : []);
        const id = suggestSubjectId(nameV, taken);
        const lesson = firstLesson || {
            type: 'qcm',
            title: 'Niveau 1',
            q: 'Modifiez cette question depuis le panneau d’administration.',
            opts: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'],
            correct: 0,
            exp: '',
        };
        const clean = normalizeLesson(lesson);
        const err = validateLesson(clean);
        if (err) return { ok: false, error: err };

        const band = (meta && (meta.band === 'college' || meta.band === 'lycee')) ? meta.band : 'all';
        const allowedNiveaux = (meta && Array.isArray(meta.allowedNiveaux)) ? meta.allowedNiveaux : [];
        const allowedFilieres = (meta && Array.isArray(meta.allowedFilieres) && meta.allowedFilieres.length > 0)
            ? meta.allowedFilieres.map(f => String(f).toLowerCase().trim()).filter(Boolean)
            : ['all'];
        const specialtyFilieres = (meta && Array.isArray(meta.specialtyFilieres))
            ? meta.specialtyFilieres.map(f => String(f).toLowerCase().trim()).filter(f => f && f !== 'all')
            : [];
        const enabled = (meta && typeof meta.enabled === 'boolean') ? meta.enabled : true;
        const description = (meta && typeof meta.description === 'string') ? meta.description.trim() : '';

        data.subjects.customs.push({
            id,
            name: nameV,
            icon: (icon || '📘').trim(),
            band,
            allowedNiveaux,
            allowedFilieres,
            specialtyFilieres,
            enabled,
            description,
            lessons: [clean]
        });
        _save();
        return { ok: true, id };
    }

    /** Supprime une matière personnalisée (définitif). */
    function deleteCustomSubject(id) {
        const data = _data();
        const idx = data.subjects.customs.findIndex(c => c.id === id);
        if (idx === -1) return { ok: false, error: 'Matière personnalisée introuvable.' };
        data.subjects.customs.splice(idx, 1);
        _save();
        return { ok: true };
    }

    /** Retire TOUTES les surcharges d'une matière système (retour à l'original). */
    function resetSubject(id) {
        if (isCustom(id)) return { ok: false, error: 'Utilisez la suppression pour une matière personnalisée.' };
        const data = _data();
        delete data.subjects.overrides[id];
        _save();
        return { ok: true };
    }

    /* -----------------------------------------------------------------------
       BOUTIQUE (GESTION DES ARTICLES)
       ----------------------------------------------------------------------- */

    /** Liste effective des articles de la boutique (défauts + surcharges + customs). */
    function getShopItems() {
        const data = _data();
        const overrides = (data.shop && data.shop.overrides) ? data.shop.overrides : {};
        const customs = (data.shop && Array.isArray(data.shop.customs)) ? data.shop.customs : [];

        const merged = [];
        for (let i = 0; i < DEFAULT_SHOP_ITEMS.length; i++) {
            const def = DEFAULT_SHOP_ITEMS[i];
            const ov = overrides[def.id];
            if (!ov) {
                merged.push({ ...def });
            } else if (!ov.deleted) {
                merged.push({ ...def, ...ov });
            }
        }

        for (let i = 0; i < customs.length; i++) {
            const c = customs[i];
            if (!c.deleted) {
                merged.push({ ...c, _custom: true });
            }
        }

        return merged;
    }

    function getShopItem(id) {
        return getShopItems().find(item => item.id === id) || null;
    }

    /** Valide et sauvegarde un article de boutique (système ou personnalisé). */
    function saveShopItem(item) {
        if (!item || typeof item !== 'object') return { ok: false, error: 'Article invalide.' };
        const id = String(item.id || '').trim();
        const name = String(item.name || '').trim();
        const category = ['aura', 'avatar', 'title', 'theme', 'booster'].includes(item.category) ? item.category : 'aura';
        const cost = _parseIntPreserveZero(item.cost, 0, 0, 999999);
        const color = _safeHex(item.color, '#c8a84b');
        const img = _safeMediaUrl(item.img);
        const desc = item.desc ? String(item.desc).trim() : '';
        const disabled = Boolean(item.disabled);

        if (!name) return { ok: false, error: 'Le nom de l\'article est obligatoire.' };
        if (id && !/^[a-z0-9_-]+$/i.test(id)) {
            return { ok: false, error: 'Identifiant d\'article invalide (lettres, chiffres, tirets uniquement).' };
        }

        const data = _data();
        if (!data.shop) data.shop = { overrides: {}, customs: [] };

        const isDefault = DEFAULT_SHOP_ITEMS.some(d => d.id === id);
        let savedId = id;
        if (isDefault) {
            data.shop.overrides[id] = { id, name, category, cost, color, img, desc, disabled, deleted: false };
        } else {
            let cleanId = id || slug(name);
            if (!id && DEFAULT_SHOP_ITEMS.some(d => d.id === cleanId)) {
                const taken = DEFAULT_SHOP_ITEMS.map(d => d.id).concat(data.shop.customs.map(c => c.id));
                cleanId = suggestSubjectId(cleanId, taken);
            }
            savedId = cleanId;
            const idx = data.shop.customs.findIndex(c => c.id === cleanId);
            const entry = { id: cleanId, name, category, cost, color, img, desc, disabled, deleted: false, _custom: true };
            if (idx >= 0) {
                data.shop.customs[idx] = entry;
            } else {
                data.shop.customs.push(entry);
            }
        }
        _save();
        return { ok: true, item: getShopItem(savedId) };
    }

    /** Supprime un article personnalisé ou masque un article système. */
    function deleteShopItem(id) {
        if (!id) return { ok: false, error: 'Identifiant manquant.' };
        const data = _data();
        if (!data.shop) data.shop = { overrides: {}, customs: [] };

        const isDefault = DEFAULT_SHOP_ITEMS.some(d => d.id === id);
        if (isDefault) {
            data.shop.overrides[id] = { deleted: true };
        } else {
            const idx = data.shop.customs.findIndex(c => c.id === id);
            if (idx >= 0) data.shop.customs.splice(idx, 1);
        }
        _save();
        return { ok: true };
    }

    /** Réinitialise la boutique aux articles par défaut. */
    function resetShopItems() {
        const data = _data();
        data.shop = { overrides: {}, customs: [] };
        _save();
    }

    /* -----------------------------------------------------------------------
       RÉCOMPENSES & PROGRESSION
       ----------------------------------------------------------------------- */

    /** Configuration effective des récompenses (personnalisée ou par défaut). */
    function getRewardsConfig() {
        const data = _data();
        return Object.assign({}, DEFAULT_REWARDS, data.rewards || {});
    }

    /** Sauvegarde la configuration des récompenses (préserve les valeurs 0 légitimes). */
    function saveRewardsConfig(values) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Configuration invalide.' };
        const clean = {
            xpBase: _parseIntPreserveZero(values.xpBase, DEFAULT_REWARDS.xpBase, 1, 5000),
            coinsBase: _parseIntPreserveZero(values.coinsBase, DEFAULT_REWARDS.coinsBase, 0, 5000),
            chronoBonusMaxXp: _parseIntPreserveZero(values.chronoBonusMaxXp, DEFAULT_REWARDS.chronoBonusMaxXp, 0, 5000),
            dailyChestCoins: _parseIntPreserveZero(values.dailyChestCoins, DEFAULT_REWARDS.dailyChestCoins, 0, 10000),
            firstTryBonusXp: _parseIntPreserveZero(values.firstTryBonusXp, DEFAULT_REWARDS.firstTryBonusXp, 0, 5000),
            questRewardMultiplier: _parseFloatPreserveZero(values.questRewardMultiplier, 1, 0.1, 20),
        };
        const data = _data();
        data.rewards = clean;
        _save();
        return { ok: true, rewards: getRewardsConfig() };
    }

    /** Réinitialise les récompenses aux valeurs par défaut. */
    function resetRewardsConfig() {
        const data = _data();
        data.rewards = null;
        _save();
    }

    /* -----------------------------------------------------------------------
       QUÊTES QUOTIDIENNES (POOL PILOTABLE DEPUIS L'ADMIN)
       ----------------------------------------------------------------------- */

    const VALID_QUEST_TYPES = ['xp', 'levels', 'perfect', 'firstTry'];

    /** Retourne le pool de quêtes quotidiennes (personnalisé ou par défaut). */
    function getQuestPool() {
        const stored = _data().quests;
        const list = (Array.isArray(stored) && stored.length > 0) ? stored : DEFAULT_QUEST_POOL;
        return list.map(q => ({
            type: VALID_QUEST_TYPES.includes(q.type) ? q.type : 'levels',
            icon: String(q.icon || '🎯').trim() || '🎯',
            title: String(q.title || 'Mission du jour').trim(),
            target: Math.max(1, parseInt(q.target, 10) || 1),
            xp: Math.max(0, parseInt(q.xp, 10) || 0),
            coins: Math.max(0, parseInt(q.coins, 10) || 0),
            color: String(q.color || '#4cc9f0').trim() || '#4cc9f0',
            enabled: q.enabled !== false,
        }));
    }

    /** Sauvegarde le pool personnalisé de quêtes quotidiennes. */
    function saveQuestPool(list) {
        if (!Array.isArray(list) || list.length === 0) {
            return { ok: false, error: 'Le pool doit contenir au moins une quête.' };
        }
        const clean = [];
        for (const q of list) {
            const title = String(q && q.title || '').trim();
            if (!title) return { ok: false, error: 'Chaque quête doit avoir un titre.' };
            const type = VALID_QUEST_TYPES.includes(q.type) ? q.type : 'levels';
            clean.push({
                type,
                icon: String(q.icon || '🎯').trim() || '🎯',
                title,
                target: Math.max(1, parseInt(q.target, 10) || 1),
                xp: Math.max(0, parseInt(q.xp, 10) || 0),
                coins: Math.max(0, parseInt(q.coins, 10) || 0),
                color: String(q.color || '#4cc9f0').trim() || '#4cc9f0',
                enabled: q.enabled !== false,
            });
        }
        if (!clean.some(q => q.enabled !== false)) {
            return { ok: false, error: 'Au moins une quête doit rester active.' };
        }
        _data().quests = clean;
        _save();
        return { ok: true, quests: getQuestPool() };
    }

    /** Rétablit le pool de quêtes par défaut. */
    function resetQuestPool() {
        _data().quests = null;
        _save();
        return { ok: true, quests: getQuestPool() };
    }

    /* -----------------------------------------------------------------------
       GESTION DES SUCCÈS (BADGES) & FILTRAGE PAR FILIÈRE
       ----------------------------------------------------------------------- */

    function _normalizeBadgeFilieres(val) {
        if (!Array.isArray(val) || val.length === 0) return ['all'];
        const clean = val.map(f => String(f || '').toLowerCase().trim()).filter(Boolean);
        if (clean.length === 0 || clean.includes('all')) return ['all'];
        return Array.from(new Set(clean));
    }

    function _normalizeBadgeBand(val) {
        return (val === 'college' || val === 'lycee') ? val : 'all';
    }

    function getBadges() {
        const data = _data();
        const store = data.badges || { overrides: {}, customs: [] };
        const overrides = store.overrides || {};
        const list = [];
        for (let i = 0; i < DEFAULT_BADGES.length; i++) {
            const b = DEFAULT_BADGES[i];
            const ov = overrides[b.id];
            if (ov && ov._deleted) continue;
            const merged = ov ? { ...b, ...ov } : { ...b };
            merged.band = _normalizeBadgeBand(merged.band);
            merged.allowedFilieres = _normalizeBadgeFilieres(merged.allowedFilieres);
            list.push(merged);
        }

        if (Array.isArray(store.customs)) {
            for (let i = 0; i < store.customs.length; i++) {
                const c = store.customs[i];
                if (!c._deleted) {
                    const item = { ...c };
                    item.band = _normalizeBadgeBand(item.band);
                    item.allowedFilieres = _normalizeBadgeFilieres(item.allowedFilieres);
                    list.push(item);
                }
            }
        }
        return list;
    }

    function getBadge(id) {
        return getBadges().find(b => b.id === id) || null;
    }

    /**
     * Source unique de vérité : retourne true si un succès correspond au parcours
     * de l'élève (classe `niveauId` + filière `filiereId`).
     * Ex : un élève CIEL voit les succès universels + CIEL, mais pas les succès STSS/STMG.
     */
    function isBadgeRelevantFor(badge, niveauId, filiereId) {
        if (!badge) return false;
        const band = _normalizeBadgeBand(badge.band);
        const allowedFil = _normalizeBadgeFilieres(badge.allowedFilieres);
        const isLyceeOrBts = isFiliereApplicable(niveauId || '6eme');

        if (band === 'college' && isLyceeOrBts) return false;
        if (band === 'lycee' && !isLyceeOrBts) return false;

        if (isLyceeOrBts) {
            const curFil = String(filiereId || 'generale').toLowerCase().trim() || 'generale';
            if (!allowedFil.includes('all') && !allowedFil.includes(curFil)) {
                return false;
            }
        }
        return true;
    }

    /** Libellé court et lisible de la portée filière/cycle d'un succès (ex: "🛡️ CIEL", "🌐 Tous"). */
    function getBadgeScopeLabel(badge) {
        if (!badge) return '🌐 Tous';
        const band = _normalizeBadgeBand(badge.band);
        const allowedFil = _normalizeBadgeFilieres(badge.allowedFilieres);
        if (band === 'college') return '🏫 Collège';
        if (allowedFil.includes('all')) {
            return band === 'lycee' ? '🏛️ Lycée & BTS' : '🌐 Tous';
        }
        const filieres = _rawFilieres();
        const labels = allowedFil.map(fid => {
            const f = filieres.find(x => String(x.id || '').trim().toLowerCase() === fid);
            return f ? `${f.icon || ''} ${f.shortLabel || f.label}`.trim() : fid.toUpperCase();
        });
        if (labels.length <= 2) return labels.join(' · ');
        return `${labels[0]} +${labels.length - 1}`;
    }

    function saveBadge(badge) {
        if (!badge || !badge.id) return { ok: false, error: 'Identifiant requis.' };
        const data = _data();
        if (!data.badges) data.badges = { overrides: {}, customs: [] };

        const band = _normalizeBadgeBand(badge.band);
        const allowedFilieres = _normalizeBadgeFilieres(badge.allowedFilieres);

        const isDef = DEFAULT_BADGES.some(b => b.id === badge.id);
        if (isDef) {
            data.badges.overrides[badge.id] = {
                name: badge.name,
                desc: badge.desc,
                icon: badge.icon,
                category: badge.category || 'progression',
                band,
                allowedFilieres,
                condition: badge.condition || '',
                _deleted: false,
            };
        } else {
            const idx = data.badges.customs.findIndex(c => c.id === badge.id);
            const item = {
                id: badge.id,
                name: badge.name || 'Succès',
                desc: badge.desc || '',
                icon: badge.icon || '🏆',
                category: badge.category || 'personnalise',
                band,
                allowedFilieres,
                condition: badge.condition || '',
                _custom: true,
                _deleted: false,
            };
            if (idx >= 0) data.badges.customs[idx] = item;
            else data.badges.customs.push(item);
        }
        _save();
        return { ok: true, badge: getBadge(badge.id) };
    }

    function deleteBadge(id) {
        const data = _data();
        if (!data.badges) data.badges = { overrides: {}, customs: [] };
        const isDef = DEFAULT_BADGES.some(b => b.id === id);
        if (isDef) {
            data.badges.overrides[id] = { _deleted: true };
        } else {
            data.badges.customs = data.badges.customs.filter(c => c.id !== id);
        }
        _save();
        return { ok: true };
    }

    function resetBadges() {
        const data = _data();
        data.badges = { overrides: {}, customs: [] };
        _save();
        return { ok: true };
    }

    /* -----------------------------------------------------------------------
       CONFIGURATION GLOBALE DU SITE & IA
       ----------------------------------------------------------------------- */

    /** Configuration effective du site (paramètres généraux, chrono, multiplicateurs, modules). */
    function getSiteConfig() {
        const data = _data();
        return Object.assign({}, DEFAULT_SITE_CONFIG, data.siteConfig || {});
    }

    /** Sauvegarde la configuration globale du site. */
    function saveSiteConfig(values) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Configuration invalide.' };
        const cur = getSiteConfig();
        const boolOpt = (key, fallback) => (typeof values[key] === 'boolean' ? values[key] : (cur[key] !== undefined ? Boolean(cur[key]) : fallback));
        const hexOpt = (key, fallback) => {
            const v = typeof values[key] === 'string' ? values[key].trim() : '';
            if (/^#[0-9a-f]{6}$/i.test(v)) return v;
            return (typeof cur[key] === 'string' && /^#[0-9a-f]{6}$/i.test(cur[key])) ? cur[key] : fallback;
        };

        const title = (typeof values.title === 'string' && values.title.trim()) ? values.title.trim()
            : (typeof values.siteTitle === 'string' && values.siteTitle.trim()) ? values.siteTitle.trim() : cur.title;
        const tagline = (typeof values.tagline === 'string') ? values.tagline.trim() : cur.tagline;
        const announcement = (typeof values.announcement === 'string') ? values.announcement.trim() : (cur.announcement || '');
        const exitTitle = (typeof values.exitTitle === 'string' && values.exitTitle.trim()) ? values.exitTitle.trim() : (cur.exitTitle || DEFAULT_SITE_CONFIG.exitTitle);
        const exitSubtitle = (typeof values.exitSubtitle === 'string' && values.exitSubtitle.trim()) ? values.exitSubtitle.trim() : (cur.exitSubtitle || DEFAULT_SITE_CONFIG.exitSubtitle);
        const dashboardFooterNote = (typeof values.dashboardFooterNote === 'string') ? values.dashboardFooterNote.trim() : (cur.dashboardFooterNote || DEFAULT_SITE_CONFIG.dashboardFooterNote);
        const defaultNiveau = (typeof values.defaultNiveau === 'string' && values.defaultNiveau.trim()) ? values.defaultNiveau.trim() : (cur.defaultNiveau || '6eme');
        const defaultFiliere = (typeof values.defaultFiliere === 'string' && values.defaultFiliere.trim()) ? values.defaultFiliere.trim().toLowerCase() : (cur.defaultFiliere || 'generale');
        const timerSec = values.quizTimerSeconds != null
            ? _parseIntPreserveZero(values.quizTimerSeconds, cur.quizTimerSeconds, 0, 600)
            : cur.quizTimerSeconds;
        const xpMult = values.xpMultiplier != null
            ? _parseFloatPreserveZero(values.xpMultiplier, cur.xpMultiplier, 0.1, 20)
            : cur.xpMultiplier;
        const coinMult = values.coinMultiplier != null
            ? _parseFloatPreserveZero(values.coinMultiplier, cur.coinMultiplier, 0.1, 20)
            : values.coinsMultiplier != null
                ? _parseFloatPreserveZero(values.coinsMultiplier, cur.coinMultiplier, 0.1, 20)
                : cur.coinMultiplier;
        const sfx = values.sfxVolume != null
            ? _parseFloatPreserveZero(values.sfxVolume, cur.sfxVolume, 0, 1)
            : values.defaultSfxVolume != null
                ? _parseIntPreserveZero(values.defaultSfxVolume, 60, 0, 100) / 100
                : cur.sfxVolume;
        const mus = values.musicVolume != null
            ? _parseFloatPreserveZero(values.musicVolume, cur.musicVolume, 0, 1)
            : values.defaultBgmVolume != null
                ? _parseIntPreserveZero(values.defaultBgmVolume, 35, 0, 100) / 100
                : cur.musicVolume;
        const defaultBtnBrightness = values.defaultBtnBrightness != null
            ? _parseIntPreserveZero(values.defaultBtnBrightness, 80, 45, 110)
            : (cur.defaultBtnBrightness != null ? cur.defaultBtnBrightness : 80);
        const defaultTheme = (typeof values.defaultTheme === 'string' && values.defaultTheme.trim()) ? values.defaultTheme.trim() : (cur.defaultTheme || 'default');
        const defaultUiPreset = (typeof values.defaultUiPreset === 'string' && values.defaultUiPreset.trim()) ? values.defaultUiPreset.trim() : (cur.defaultUiPreset || 'default');
        const defaultBtnPreset = (typeof values.defaultBtnPreset === 'string' && values.defaultBtnPreset.trim()) ? values.defaultBtnPreset.trim() : (cur.defaultBtnPreset || 'default');
        const maintenanceMessage = (typeof values.maintenanceMessage === 'string') ? values.maintenanceMessage.trim() : (cur.maintenanceMessage || '');

        const clean = {
            title,
            siteTitle: title,
            tagline,
            announcement,
            exitTitle,
            exitSubtitle,
            dashboardFooterNote,
            defaultNiveau,
            defaultFiliere,
            quizTimerSeconds: timerSec,
            xpMultiplier: xpMult,
            coinMultiplier: coinMult,
            coinsMultiplier: coinMult,
            sfxVolume: sfx,
            musicVolume: mus,
            defaultSfxVolume: Math.round(sfx * 100),
            defaultBgmVolume: Math.round(mus * 100),
            soundEnabledByDefault: boolOpt('soundEnabledByDefault', true),
            allowRegistration: boolOpt('allowRegistration', true),
            enableShop: boolOpt('enableShop', true),
            enableQuests: boolOpt('enableQuests', true),
            enableBadges: boolOpt('enableBadges', true),
            enableChrono: boolOpt('enableChrono', true),
            chronoEnabledByDefault: boolOpt('chronoEnabledByDefault', true),
            strictStarsAntiCheat: boolOpt('strictStarsAntiCheat', true),
            strictCollegeSubjects: boolOpt('strictCollegeSubjects', true),
            confirmBeforeQuit: boolOpt('confirmBeforeQuit', true),
            logoutOnQuit: boolOpt('logoutOnQuit', true),
            hideGradeDuringQuiz: boolOpt('hideGradeDuringQuiz', true),
            showExpulsionTransition: boolOpt('showExpulsionTransition', true),
            showAudioToggleButton: boolOpt('showAudioToggleButton', true),
            showHintsInQuiz: boolOpt('showHintsInQuiz', true),
            allowClientAppearance: boolOpt('allowClientAppearance', true),
            defaultTheme,
            defaultUiPreset,
            defaultUiColor: hexOpt('defaultUiColor', '#0d1f3a'),
            defaultUiAccent: hexOpt('defaultUiAccent', '#c8a84b'),
            defaultBtnPreset,
            defaultBtnColor: hexOpt('defaultBtnColor', '#24354f'),
            defaultBtnBrightness,
            enableParticlesByDefault: boolOpt('enableParticlesByDefault', true),
            enableConfetti: boolOpt('enableConfetti', true),
            maintenanceMode: boolOpt('maintenanceMode', false),
            maintenanceMessage,
        };
        const data = _data();
        data.siteConfig = clean;
        _save();
        return { ok: true, siteConfig: getSiteConfig() };
    }

    /** Rétablit la configuration globale par défaut. */
    function resetSiteConfig() {
        const data = _data();
        data.siteConfig = null;
        _save();
        return { ok: true, siteConfig: getSiteConfig() };
    }

    /** Normalise un fournisseur du pool multi-IA. */
    function _normalizeAiProvider(p, idx = 0) {
        if (!p || typeof p !== 'object') return null;
        const type = ['make_webhook', 'openai_compatible', 'gemini'].includes(p.type) ? p.type : 'make_webhook';
        const endpoint = String(p.endpoint || '').trim();
        const validateEndpoint = String(p.validateEndpoint || '').trim();
        const name = String(p.name || `IA #${idx + 1}`).trim() || `IA #${idx + 1}`;
        const id = String(p.id || slug(name) || `ia-${idx + 1}`).trim();
        const apiKey = String(p.apiKey || '').trim();
        const model = String(p.model || '').trim();
        const enabled = p.enabled !== false;
        const weight = Math.max(1, Math.min(10, parseInt(p.weight, 10) || 1));
        return { id, name, type, endpoint, validateEndpoint, apiKey, model, enabled, weight };
    }

    /** Normalise une persona IA pédagogique locale (pilotable depuis le panneau admin). */
    function _normalizeLocalPersona(p, idx = 0) {
        if (!p || typeof p !== 'object') return null;
        const name = String(p.name || `IA Locale #${idx + 1}`).trim() || `IA Locale #${idx + 1}`;
        const id = String(p.id || slug(name) || `ai-local-${idx + 1}`).trim();
        const role = String(p.role || 'Adaptative').trim();
        const icon = String(p.icon || '🤖').trim() || '🤖';
        const color = (typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color.trim())) ? p.color.trim() : '#4cc9f0';
        const hintPrefix = typeof p.hintPrefix === 'string' ? p.hintPrefix : '';
        const variantOffset = _parseIntPreserveZero(p.variantOffset, idx, 0, 999);
        const enabled = p.enabled !== false;
        return { id, name, role, icon, color, hintPrefix, variantOffset, enabled };
    }

    /** Configuration effective de l'intégration IA (Multi-IA + Make + Adaptatif + Personas locales). */
    function getAiConfig() {
        const data = _data();
        const merged = Object.assign(_clone(DEFAULT_AI_CONFIG), data.aiConfig || {});
        merged.providers = Array.isArray(merged.providers)
            ? merged.providers.map((p, i) => _normalizeAiProvider(p, i)).filter(Boolean)
            : [];
        merged.adaptiveMode = merged.adaptiveMode !== false;
        merged.selectionStrategy = (merged.selectionStrategy === 'round_robin') ? 'round_robin' : 'random';
        merged.enableLocalPersonas = merged.enableLocalPersonas !== false;
        merged.showAiBadgeInQuiz = merged.showAiBadgeInQuiz !== false;
        const rawPersonas = Array.isArray(merged.localPersonas) && merged.localPersonas.length > 0
            ? merged.localPersonas
            : DEFAULT_LOCAL_AI_PERSONAS;
        merged.localPersonas = rawPersonas.map((p, i) => _normalizeLocalPersona(p, i)).filter(Boolean);
        return merged;
    }

    /** Sauvegarde la configuration de l'IA (pool multi-IA, webhooks Make.com, mode adaptatif, personas locales et délai). */
    function saveAiConfig(values) {
        if (!values || typeof values !== 'object') return { ok: false, error: 'Configuration invalide.' };
        const cur = getAiConfig();
        const timeout = values.fetchTimeoutMs != null ? Math.max(1000, parseInt(values.fetchTimeoutMs, 10) || 8000)
            : values.timeoutMs != null ? Math.max(1000, parseInt(values.timeoutMs, 10) || 8000) : cur.fetchTimeoutMs;
        const fallback = typeof values.fallbackToOffline === 'boolean' ? values.fallbackToOffline
            : typeof values.fallbackToLocal === 'boolean' ? values.fallbackToLocal : cur.fallbackToOffline;
        const adaptiveMode = typeof values.adaptiveMode === 'boolean' ? values.adaptiveMode : cur.adaptiveMode;
        const selectionStrategy = (values.selectionStrategy === 'round_robin' || values.selectionStrategy === 'random')
            ? values.selectionStrategy
            : cur.selectionStrategy;
        const providers = Array.isArray(values.providers)
            ? values.providers.map((p, i) => _normalizeAiProvider(p, i)).filter(Boolean)
            : cur.providers;
        const enableLocalPersonas = typeof values.enableLocalPersonas === 'boolean'
            ? values.enableLocalPersonas
            : (cur.enableLocalPersonas !== false);
        const showAiBadgeInQuiz = typeof values.showAiBadgeInQuiz === 'boolean'
            ? values.showAiBadgeInQuiz
            : (cur.showAiBadgeInQuiz !== false);
        const storedRawPersonas = (_data().aiConfig && Object.prototype.hasOwnProperty.call(_data().aiConfig, 'localPersonas'))
            ? _data().aiConfig.localPersonas
            : null;
        const localPersonas = Array.isArray(values.localPersonas)
            ? values.localPersonas.map((p, i) => _normalizeLocalPersona(p, i)).filter(Boolean)
            : (values.localPersonas === null ? null : storedRawPersonas);

        const clean = {
            generateWebhookUrl: (typeof values.generateWebhookUrl === 'string') ? values.generateWebhookUrl.trim() : (cur.generateWebhookUrl || ''),
            validateWebhookUrl: (typeof values.validateWebhookUrl === 'string') ? values.validateWebhookUrl.trim() : (cur.validateWebhookUrl || ''),
            providers,
            adaptiveMode,
            selectionStrategy,
            fetchTimeoutMs: timeout,
            timeoutMs: timeout,
            fallbackToOffline: fallback,
            fallbackToLocal: fallback,
            enableLocalPersonas,
            showAiBadgeInQuiz,
            localPersonas,
        };
        const data = _data();
        data.aiConfig = clean;
        _save();
        return { ok: true, aiConfig: getAiConfig() };
    }

    /** Rétablit la configuration de l'IA par défaut. */
    function resetAiConfig() {
        const data = _data();
        data.aiConfig = null;
        _save();
        return { ok: true, aiConfig: getAiConfig() };
    }

    /**
     * Récupère la liste des questions pour une matière et un niveau d'étude donné.
     * Pour une matière système, combine les leçons manuelles écrites et des
     * aperçus procéduraux adaptés à la classe choisie.
     */
    function getSubjectQuestionsForGrade(subjectId, niveau = '6eme', variant = 0, count = 8) {
        const all = listEditable(getDefaultSubjects());
        const sub = all.find(s => s.id === subjectId);
        if (!sub) return { manual: [], generated: [] };
        const manual = (sub.lessons || []).map((l, idx) => ({ ...l, levelIndex: idx + 1, source: 'manual' }));
        const generated = [];
        if (!sub.isCustom && typeof QuestionBank !== 'undefined' && typeof QuestionBank.generateOne === 'function') {
            const norm = QuestionBank.normalizeNiveau ? QuestionBank.normalizeNiveau(niveau) : niveau;
            const limit = Math.min(20, Math.max(1, parseInt(count, 10) || 8));
            for (let i = 0; i < limit; i++) {
                const q = QuestionBank.generateOne(subjectId, i, norm, variant);
                generated.push({ ...q, levelIndex: i + 1, source: 'procedural', grade: norm, variant });
            }
        }
        return { manual, generated };
    }

    /* -----------------------------------------------------------------------
       EXPORT / IMPORT / RÉINITIALISATION
       ----------------------------------------------------------------------- */

    /**
     * Exporte la configuration administrateur complète.
     * Par sécurité, les clés API (providers[].apiKey) sont masquées par défaut
     * sauf si { includeSecrets: true } est explicitement demandé.
     */
    function exportJson(options) {
        const includeSecrets = Boolean(options && options.includeSecrets === true);
        const snapshot = _clone(_data());
        if (!includeSecrets && snapshot && snapshot.aiConfig && Array.isArray(snapshot.aiConfig.providers)) {
            snapshot.aiConfig.providers = snapshot.aiConfig.providers.map(p => (
                p && typeof p === 'object' ? { ...p, apiKey: '' } : p
            ));
        }
        return JSON.stringify(snapshot, null, 2);
    }

    /** Importe une configuration exportée de manière atomique (validation complète AVANT toute écriture). */
    function importJson(text) {
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { return { ok: false, error: 'JSON invalide.' }; }
        if (!parsed || parsed.v !== 1 || !parsed.subjects || typeof parsed.subjects !== 'object') {
            return { ok: false, error: 'Fichier de configuration non reconnu.' };
        }
        if (parsed.levels !== null && parsed.levels !== undefined && !Array.isArray(parsed.levels)) {
            return { ok: false, error: 'Structure « levels » invalide.' };
        }

        // 1) Préparer un candidat atomique sans muter l'état courant
        const candidate = _clone(_data());

        if (Array.isArray(parsed.levels)) {
            const r = _validateLevels(parsed.levels);
            if (!r.ok) return r;
            candidate.levels = r.clean;
        } else if (parsed.levels === null) {
            candidate.levels = null;
        }

        const overrides = (parsed.subjects.overrides && typeof parsed.subjects.overrides === 'object' && !Array.isArray(parsed.subjects.overrides))
            ? parsed.subjects.overrides : {};
        const customs = Array.isArray(parsed.subjects.customs) ? parsed.subjects.customs : [];
        for (const c of customs) {
            if (!c || !c.id || !c.name || !Array.isArray(c.lessons) || c.lessons.length === 0)
                return { ok: false, error: 'Matière personnalisée invalide dans le fichier importé.' };
            for (const l of c.lessons) {
                const err = validateLesson(l);
                if (err) return { ok: false, error: 'Leçon invalide dans « ' + c.name + ' » : ' + err };
            }
        }
        for (const id of Object.keys(overrides)) {
            const ov = overrides[id];
            if (!ov || typeof ov !== 'object') return { ok: false, error: 'Surcharge invalide pour « ' + id + ' ».' };
            if (Array.isArray(ov.lessons)) {
                for (const l of ov.lessons) {
                    const err = validateLesson(l);
                    if (err) return { ok: false, error: 'Leçon invalide dans « ' + id + ' » : ' + err };
                }
            }
        }
        candidate.subjects = { overrides: _clone(overrides), customs: _clone(customs) };

        if (parsed.filieres !== undefined) {
            if (Array.isArray(parsed.filieres)) {
                if (parsed.filieres.length === 0) return { ok: false, error: 'Il faut au moins une filière.' };
                const fIds = new Set();
                const fClean = [];
                for (const f of parsed.filieres) {
                    const fid = String(f && f.id || '').trim().toLowerCase();
                    if (!fid || !/^[a-z0-9_-]+$/i.test(fid) || fid === 'all') {
                        return { ok: false, error: 'Identifiant de filière invalide dans l\'import : ' + fid };
                    }
                    if (fIds.has(fid)) return { ok: false, error: 'Identifiant de filière en double : ' + fid };
                    fIds.add(fid);
                    const lbl = String(f.label || '').trim();
                    if (!lbl) return { ok: false, error: 'Libellé de filière vide pour ' + fid + '.' };
                    fClean.push({
                        id: fid,
                        label: lbl,
                        shortLabel: String(f.shortLabel || lbl).trim() || lbl,
                        icon: String(f.icon || '🧭').trim() || '🧭',
                        enabled: f.enabled !== false,
                        allowedNiveaux: _normalizeFiliereAllowedNiveaux(f.allowedNiveaux, fid),
                        desc: String(f.desc || '').trim(),
                    });
                }
                if (!fClean.some(f => f.enabled !== false)) {
                    return { ok: false, error: 'Au moins une filière doit rester active.' };
                }
                candidate.filieres = fClean;
            } else {
                candidate.filieres = null;
            }
        }

        if (parsed.quests !== undefined) {
            if (Array.isArray(parsed.quests)) {
                if (parsed.quests.length === 0) return { ok: false, error: 'Le pool doit contenir au moins une quête.' };
                const qClean = [];
                for (const q of parsed.quests) {
                    const title = String(q && q.title || '').trim();
                    if (!title) return { ok: false, error: 'Chaque quête doit avoir un titre.' };
                    qClean.push({
                        type: VALID_QUEST_TYPES.includes(q.type) ? q.type : 'levels',
                        icon: String(q.icon || '🎯').trim() || '🎯',
                        title,
                        target: _parseIntPreserveZero(q.target, 1, 1, 10000),
                        xp: _parseIntPreserveZero(q.xp, 0, 0, 10000),
                        coins: _parseIntPreserveZero(q.coins, 0, 0, 10000),
                        color: _safeHex(q.color, '#4cc9f0'),
                        enabled: q.enabled !== false,
                    });
                }
                if (!qClean.some(q => q.enabled !== false)) {
                    return { ok: false, error: 'Au moins une quête doit rester active.' };
                }
                candidate.quests = qClean;
            } else {
                candidate.quests = null;
            }
        }

        if (parsed.credits && typeof parsed.credits === 'object') {
            const cr = _validateCredits(parsed.credits, {});
            if (!cr.ok) return cr;
            candidate.credits = cr.clean;
        }

        if (parsed.badges && typeof parsed.badges === 'object') {
            candidate.badges = {
                overrides: (parsed.badges.overrides && typeof parsed.badges.overrides === 'object') ? _clone(parsed.badges.overrides) : {},
                customs: Array.isArray(parsed.badges.customs) ? _clone(parsed.badges.customs) : [],
            };
        }
        if (parsed.shop && typeof parsed.shop === 'object') {
            const shopOv = (parsed.shop.overrides && typeof parsed.shop.overrides === 'object') ? _clone(parsed.shop.overrides) : {};
            Object.keys(shopOv).forEach(k => {
                if (shopOv[k] && typeof shopOv[k] === 'object') {
                    if (shopOv[k].color) shopOv[k].color = _safeHex(shopOv[k].color, '#c8a84b');
                    if (shopOv[k].img) shopOv[k].img = _safeMediaUrl(shopOv[k].img);
                }
            });
            const shopCust = Array.isArray(parsed.shop.customs)
                ? parsed.shop.customs.map(c => (c && typeof c === 'object' ? { ...c, color: _safeHex(c.color, '#c8a84b'), img: _safeMediaUrl(c.img) } : null)).filter(Boolean)
                : [];
            candidate.shop = { overrides: shopOv, customs: shopCust };
        }
        if (parsed.rewards && typeof parsed.rewards === 'object') {
            candidate.rewards = {
                xpBase: _parseIntPreserveZero(parsed.rewards.xpBase, DEFAULT_REWARDS.xpBase, 1, 5000),
                coinsBase: _parseIntPreserveZero(parsed.rewards.coinsBase, DEFAULT_REWARDS.coinsBase, 0, 5000),
                chronoBonusMaxXp: _parseIntPreserveZero(parsed.rewards.chronoBonusMaxXp, DEFAULT_REWARDS.chronoBonusMaxXp, 0, 5000),
                dailyChestCoins: _parseIntPreserveZero(parsed.rewards.dailyChestCoins, DEFAULT_REWARDS.dailyChestCoins, 0, 10000),
                firstTryBonusXp: _parseIntPreserveZero(parsed.rewards.firstTryBonusXp, DEFAULT_REWARDS.firstTryBonusXp, 0, 5000),
                questRewardMultiplier: _parseFloatPreserveZero(parsed.rewards.questRewardMultiplier, 1, 0.1, 20),
            };
        }

        // 2) Validation réussie à 100 % → commit atomique
        cache = candidate;
        if (parsed.siteConfig && typeof parsed.siteConfig === 'object') {
            saveSiteConfig(parsed.siteConfig);
        }
        if (parsed.aiConfig && typeof parsed.aiConfig === 'object') {
            saveAiConfig(parsed.aiConfig);
        }
        _save();
        return { ok: true };
    }

    /** Supprime toute la configuration administrateur (niveaux + filières + matières + boutique + récompenses + succès + quêtes). */
    function resetAll() {
        cache = null;
        try { localStorage.removeItem(LS_KEY); } catch { }
    }

    /**
     * Réinitialise les données de jeu locales de CET APPAREIL (progression,
     * options, badges, pièces, XP, niveau choisi) — les comptes membres sont
     * conservés. Retourne le nombre de clés supprimées.
     */
    function clearLocalGameData() {
        const remove = [];
        const preserved = new Set([
            'eduquest_local_users', 'eduquest_session', 'eduquest_admin_data', 'eduquest_cookie_consent',
            'eduquest_admin_lockout', 'eduquest_admin_security', 'eduquest_admin_audit'
        ]);
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || preserved.has(key)) continue;
                if (
                    key === 'eduquest_options' || key === 'eduquest_niveau' || key === 'eduquest_filiere' || key === 'eduquest_daily_quests' ||
                    key === 'eduquest_audio_manual_mute' || key === 'eduquest_audio_state' ||
                    key === 'eduquest_current_track' || key === 'eduquest_music_time' ||
                    key.startsWith('eduquest_opts_') || key.startsWith('eduquest_prog_') ||
                    key.startsWith('eduquest_niveau_') || key.startsWith('eduquest_filiere_') || key.startsWith('eduquest_quests_') ||
                    key.startsWith('eduquest_boosters_') || key.startsWith('eduquest_streak_') ||
                    key.startsWith('eduquest_attempts_') || key.startsWith('eduquest_adaptive_') ||
                    /^eduquest_.*_progress$/.test(key)
                ) {
                    remove.push(key);
                }
            }
            remove.forEach(k => localStorage.removeItem(k));
        } catch { }
        return remove.length;
    }

    /* -----------------------------------------------------------------------
       EXPORT PUBLIC
       ----------------------------------------------------------------------- */

    return {
        // Constantes utiles à l'interface
        DEFAULT_LEVELS: _clone(DEFAULT_LEVELS),
        DEFAULT_FILIERES: _clone(DEFAULT_FILIERES),
        DEFAULT_SHOP_ITEMS: _clone(DEFAULT_SHOP_ITEMS),
        DEFAULT_QUEST_POOL: _clone(DEFAULT_QUEST_POOL),
        DEFAULT_REWARDS: _clone(DEFAULT_REWARDS),
        DEFAULT_SITE_CONFIG: _clone(DEFAULT_SITE_CONFIG),
        DEFAULT_AI_CONFIG: _clone(DEFAULT_AI_CONFIG),
        DEFAULT_LOCAL_AI_PERSONAS: _clone(DEFAULT_LOCAL_AI_PERSONAS),
        SUBJECT_DEFAULT_RULES: _clone(SUBJECT_DEFAULT_RULES),
        LESSON_TYPES: LESSON_TYPES.slice(),

        // Utilitaires
        esc,
        slug,
        suggestSubjectId,
        validateLesson,
        normalizeLesson,
        defaultBandForSubject,
        defaultAllowedNiveauxForSubject,
        defaultAllowedFilieresForSubject,
        isSubjectAllowedForNiveau,
        isSubjectSpecialtyForFiliere,

        // Filières / voies d'études
        getFilieres,
        getActiveFilieres,
        getFilieresForNiveau,
        isFiliereAllowedForNiveau,
        resolveFiliereForNiveau,
        filieresModified,
        saveFilieres,
        resetFilieres,
        getFiliere,
        filiereLabel,
        isFiliereApplicable,

        // Niveaux scolaires
        getLevels,
        getNiveauxScolaires: getLevels, // Alias pour app.js / dashboard
        levelsModified,
        levelBand,
        levelLabel,
        saveLevels,
        resetLevels,

        // Crédits du créateur & équipe
        getCredits,
        creditsModified,
        saveCredits,
        resetCredits,
        DEFAULT_CREDITS: cloneDefaults(),
        DEFAULT_TEAM_MEMBERS: _clone(DEFAULT_TEAM_MEMBERS),

        // Registre des défauts (app.js)
        registerDefaults,
        getDefaultSubjects,
        getDefaultSubject,

        // Application / édition des matières
        applyOverrides,
        isCustom,
        hasOverride,
        hasSubjectCustomizations,
        listEditable,
        saveSubjectMeta,
        saveLessons,
        createCustomSubject,
        deleteCustomSubject,
        resetSubject,
        getSubjectQuestionsForGrade,

        // Boutique & Récompenses & Quêtes quotidiennes
        getShopItems,
        getShopItem,
        saveShopItem,
        deleteShopItem,
        resetShopItems,
        getRewardsConfig,
        saveRewardsConfig,
        resetRewardsConfig,
        getQuestPool,
        saveQuestPool,
        resetQuestPool,

        // Configuration Globale du Site & IA
        getSiteConfig,
        saveSiteConfig,
        resetSiteConfig,
        getAiConfig,
        saveAiConfig,
        resetAiConfig,

        // Succès / Badges (avec filtrage par filière)
        DEFAULT_BADGES: _clone(DEFAULT_BADGES),
        getBadges,
        getBadge,
        isBadgeRelevantFor,
        getBadgeScopeLabel,
        saveBadge,
        deleteBadge,
        resetBadges,

        // Export / import / réinitialisation
        exportJson,
        importJson,
        resetAll,
        clearLocalGameData,
        invalidateCache: () => { cache = null; },
    };
})();

if (typeof window !== 'undefined') window.AdminStore = AdminStore;
if (typeof globalThis !== 'undefined') globalThis.AdminStore = AdminStore;
if (typeof module !== 'undefined' && module.exports) module.exports = AdminStore;
