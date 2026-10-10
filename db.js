const DB = (() => {
    // La persistance utilise STRICTEMENT sessionStorage. 
    // Ainsi, quand on ferme l'onglet/le navigateur, toutes les données sont effacées,
    // garantissant une session temporaire éphémère sans aucune récupération de données ni cookies.

    const loadMemory = () => {
        try {
            const stored = sessionStorage.getItem('eduquest_memory');
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error("Erreur de chargement de la session", e);
        }
        return {
            options: {},
            progress: {},
            niveau: '6eme',
            musicTrack: 0,
            musicTime: 0,
            badges: [],
            quests: null
        };
    };

    let memory = loadMemory();

    const saveMemory = () => {
        try {
            sessionStorage.setItem('eduquest_memory', JSON.stringify(memory));
        } catch (e) {
            console.error("Erreur de sauvegarde de la session", e);
        }
    };

    const normKey = (mat, niv) => {
        const m = String(mat || '').trim().toLowerCase();
        const n = String(niv || memory.niveau || '6eme').trim().toLowerCase();
        return `${m}_${n}`;
    };

    return {
        // --- Options du jeu ---
        getOption: (k, def) => memory.options.hasOwnProperty(k) ? memory.options[k] : def,
        saveOption: (k, v) => { memory.options[k] = v; saveMemory(); },
        getOptionAsync: async (k, def) => memory.options.hasOwnProperty(k) ? memory.options[k] : def,
        saveOptionAsync: async (k, v) => { memory.options[k] = v; saveMemory(); return { ok: true }; },
        syncOptionsFromServer: async () => { },

        // --- Progression par matière ---
        loadProgress: async (mat, niv) => {
            const k = normKey(mat, niv);
            return memory.progress[k] || memory.progress[`${mat}_${niv}`] || null;
        },
        saveProgress: async (mat, niv, data) => {
            const k = normKey(mat, niv);
            memory.progress[k] = data;
            memory.progress[`${mat}_${niv}`] = data;
            saveMemory();
        },
        getProgress: (mat, niv) => {
            const k = normKey(mat, niv);
            return memory.progress[k] || memory.progress[`${mat}_${niv}`] || null;
        },

        // --- Niveau scolaire ---
        getNiveau: () => memory.niveau || '6eme',
        setNiveau: (val) => { memory.niveau = val; saveMemory(); },

        // --- Quêtes journalières (Session temporaire) ---
        getDailyQuests: () => memory.quests || null,
        saveDailyQuests: (questsObj) => { memory.quests = questsObj; saveMemory(); },

        // --- Authentification (Désactivée - Pas de connexion ni de compte) ---
        login: async () => ({ ok: false, error: 'Comptes et connexion désactivés (session temporaire sans collecte).' }),
        register: async () => ({ ok: false, error: 'Comptes et connexion désactivés (session temporaire sans collecte).' }),
        logout: () => { },
        getCurrentUser: () => null,
        isLoggedIn: () => false,

        // --- Musique ---
        getMusicState: () => ({ track: memory.musicTrack, time: memory.musicTime }),
        setMusicState: (track, time) => { memory.musicTrack = track; memory.musicTime = time; saveMemory(); },

        // --- Badges (succès) ---
        getBadges: () => memory.badges || [],
        unlockBadge: (id) => {
            if (!memory.badges) memory.badges = [];
            if (!memory.badges.includes(id)) { memory.badges.push(id); saveMemory(); }
        },

        // --- Membres locaux / Panneau d'administration ---
        listLocalMembers: async () => [],
        createLocalMember: async () => ({ ok: false, error: 'Désactivé' }),
        updateLocalMember: async () => ({ ok: false, error: 'Désactivé' }),
        deleteLocalMember: async () => ({ ok: false, error: 'Désactivé' }),
        updateProfile: async () => ({ ok: false, error: 'Désactivé' }),

        // --- Configuration API désactivée ---
        get useApi() { return false; },
        get apiUrl() { return null; },
    };
})();

if (typeof window !== 'undefined') {
    window.DB = DB;
}
