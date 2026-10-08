const DB = (() => {
    let memory = {
        options: {},
        progress: {},
        niveau: '6eme',
        musicTrack: 0,
        musicTime: 0,
        badges: []
    };

    return {
        // --- Options du jeu ---
        getOption: (k, def) => memory.options.hasOwnProperty(k) ? memory.options[k] : def,
        saveOption: (k, v) => { memory.options[k] = v; },
        getOptionAsync: async (k, def) => memory.options.hasOwnProperty(k) ? memory.options[k] : def,
        saveOptionAsync: async (k, v) => { memory.options[k] = v; return {ok: true}; },
        syncOptionsFromServer: async () => {},

        // --- Progression par matière ---
        loadProgress: async (mat, niv) => memory.progress[`${mat}_${niv}`] || null,
        saveProgress: async (mat, niv, data) => { memory.progress[`${mat}_${niv}`] = data; },

        // --- Niveau scolaire ---
        getNiveau: () => memory.niveau,
        setNiveau: (val) => { memory.niveau = val; },

        // --- Authentification ---
        login: async () => ({ok: false, error: 'Comptes désactivés.'}),
        register: async () => ({ok: false, error: 'Comptes désactivés.'}),
        logout: () => {},
        getCurrentUser: () => null,
        isLoggedIn: () => false,

        // --- Musique ---
        getMusicState: () => ({ track: memory.musicTrack, time: memory.musicTime }),
        setMusicState: (track, time) => { memory.musicTrack = track; memory.musicTime = time; },

        // --- Badges (succès) ---
        getBadges: () => memory.badges,
        unlockBadge: (id) => { if (!memory.badges.includes(id)) memory.badges.push(id); },

        // --- Membres / comptes locaux (panneau d'administration) ---
        listLocalMembers: async () => [],
        createLocalMember: async () => ({ok: false, error: 'Désactivé'}),
        updateLocalMember: async () => ({ok: false, error: 'Désactivé'}),
        deleteLocalMember: async () => ({ok: false, error: 'Désactivé'}),
        updateProfile: async () => ({ok: false, error: 'Désactivé'}),

        // --- Informations de configuration (lecture seule) ---
        get useApi() { return false; },
        get apiUrl() { return null; },
    };
})();
