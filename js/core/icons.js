/* =============================================================================
   ICONS.JS — EDUQUEST v1.30.0
   Système unifié d'icônes SVG (Thème Astral & Or — Duotone vectoriel).
   Remplace les emojis hétérogènes par des icônes vectorielles cohérentes,
   nettes sur tous les écrans, 100 % hors-ligne et accessibles.
   Compatible navigateur (window.EduIcons) et Node.js (module.exports).
   ============================================================================= */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.EduIcons = api;
    if (typeof window !== 'undefined') window.EduIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /**
     * Glyphes SVG sur grille 24x24, trait 1.8px, coins arrondis, léger remplissage
     * duotone (currentColor à 16 %) pour une identité cohérente Astral & Or.
     */
    const PATHS = Object.freeze({
        // Navigation & actions principales
        play: '<path d="M5 19L19 5M15 5h4v4" fill="none"/><path d="M12 3l8 8-9 9-4-1-1-4 9-9z" fill="currentColor" fill-opacity="0.16"/><path d="M7 13l4 4M4 20l3-3"/>',
        swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5" fill="currentColor" fill-opacity="0.15"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
        settings: '<circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.22"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        user: '<circle cx="12" cy="8" r="4" fill="currentColor" fill-opacity="0.2"/><path d="M5 20a7 7 0 0 1 14 0" fill="currentColor" fill-opacity="0.12"/>',
        users: '<circle cx="9" cy="8" r="3.5" fill="currentColor" fill-opacity="0.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5A5 5 0 0 1 21 19.5"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        check: '<path d="M5 13l4 4L19 7"/>',
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" fill-opacity="0.16"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
        arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
        exit: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" fill="currentColor" fill-opacity="0.14"/><path d="M15 16l4-4-4-4M19 12H9"/>',
        save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity="0.16"/><path d="M17 21v-7H7v7M7 3v5h8"/>',
        fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
        eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" fill="currentColor" fill-opacity="0.14"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.25"/>',

        // Audio & Media
        volumeOn: '<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" fill-opacity="0.22"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
        volumeLow: '<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" fill-opacity="0.22"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/>',
        volumeOff: '<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" fill-opacity="0.18"/><path d="M22 9l-6 6M16 9l6 6"/>',
        music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor" fill-opacity="0.22"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor" fill-opacity="0.22"/>',
        bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8.5-3 8.5h18s-3-1.5-3-8.5z" fill="currentColor" fill-opacity="0.18"/><path d="M10 20a2 2 0 0 0 4 0"/>',

        // Sécurité, Compte & Légal
        lock: '<rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" fill-opacity="0.2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>',
        shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" fill="currentColor" fill-opacity="0.18"/><path d="M9.5 12l1.8 1.8 3.5-3.8"/>',
        key: '<circle cx="8" cy="15" r="4" fill="currentColor" fill-opacity="0.2"/><path d="M11 12l9-9M17 6l2 2M14.5 8.5l2 2"/>',
        scales: '<path d="M12 3v18M6 21h12M4 7h16"/><path d="M4 7l-2 6a3 3 0 0 0 6 0L6 7M20 7l-2 6a3 3 0 0 0 6 0l-2-6" fill="currentColor" fill-opacity="0.16"/>',
        cookie: '<path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3z" fill="currentColor" fill-opacity="0.18"/><circle cx="8.5" cy="10.5" r="1" fill="currentColor"/><circle cx="11.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><circle cx="8.5" cy="15" r="0.8" fill="currentColor"/>',
        building: '<rect x="4" y="3" width="16" height="18" rx="1.5" fill="currentColor" fill-opacity="0.16"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
        scroll: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity="0.16"/><path d="M8 9h7M8 13h7M8 17h4"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M3 7l9 6 9-6"/>',
        github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" fill="currentColor" fill-opacity="0.14"/>',
        google: '<path d="M20 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h4.5a3.9 3.9 0 0 1-1.7 2.5v2.1h2.7A8 8 0 0 0 20 12.2z" fill="currentColor" fill-opacity="0.24"/><path d="M12 20a8 8 0 1 1 5.4-13.9l-2.3 2.2A4.9 4.9 0 1 0 16.5 14"/>',

        // Jeu, Progression, Récompenses, Quêtes & HUD
        island: '<path d="M3 16c4 4 14 4 18 0l-3-2H6l-3 2z" fill="currentColor" fill-opacity="0.22"/><path d="M6 14c1.5-2.5 10.5-2.5 12 0"/><path d="M12 13V7M12 7c-2-1.5-4.5-1-5.5 1M12 7c2-1.5 4.5-1 5.5 1M12 7c-.8-2.5-2.5-3.5-4-3.5M12 7c.8-2.5 2.5-3.5 4-3.5"/>',
        shop: '<path d="M4 9h16l-1.5 11H5.5L4 9z" fill="currentColor" fill-opacity="0.18"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
        trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" fill="currentColor" fill-opacity="0.22"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/>',
        medal: '<circle cx="12" cy="14" r="5" fill="currentColor" fill-opacity="0.22"/><path d="M8.5 9.5L6 3h4l2 4 2-4h4l-2.5 6.5"/>',
        crown: '<path d="M3 18l1.5-10L9 12l3-7 3 7 4.5-4L21 18H3z" fill="currentColor" fill-opacity="0.22"/>',
        star: '<path d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L12 17l-5.6 3 1.1-6.1L3 9.5l6.2-.9L12 3z" fill="currentColor" fill-opacity="0.25"/>',
        starFilled: '<path d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L12 17l-5.6 3 1.1-6.1L3 9.5l6.2-.9L12 3z" fill="currentColor"/>',
        starEmpty: '<path d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.1L12 17l-5.6 3 1.1-6.1L3 9.5l6.2-.9L12 3z" fill="none" opacity="0.45"/>',
        sparkle: '<path d="M12 2l2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1L12 2z" fill="currentColor" fill-opacity="0.24"/><path d="M19 3l.7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7L19 3z"/>',
        flame: '<path d="M12 2c2.5 3 6 6.2 6 10.5a6 6 0 1 1-12 0c0-2.8 1.5-5.3 3-7 0 2 1 3 2 3.5-.5-2.5.2-5 1-7z" fill="currentColor" fill-opacity="0.26"/>',
        bolt: '<path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" fill="currentColor" fill-opacity="0.26"/>',
        coin: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="12" r="5.5" fill="none" stroke-dasharray="2 2"/><path d="M12 8.5v7M10 10.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5-.9 1.5-2 1.5-2 .7-2 1.5.9 1.5 2 1.5 2-.7 2-1.5"/>',
        gem: '<path d="M6 4h12l4 5-10 12L2 9l4-5z" fill="currentColor" fill-opacity="0.22"/><path d="M2 9h20M12 21L8.5 9 10 4M12 21l3.5-12L14 4"/>',
        gift: '<rect x="3" y="8" width="18" height="4" rx="1" fill="currentColor" fill-opacity="0.22"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" fill="currentColor" fill-opacity="0.14"/><path d="M12 8v13M12 8H8.5a2 2 0 1 1 0-4C11 4 12 8 12 8zm0 0h3.5a2 2 0 1 0 0-4C13 4 12 8 12 8z"/>',
        potion: '<path d="M9 3h6M10 3v5l-5 8.5A3 3 0 0 0 7.6 21h8.8a3 3 0 0 0 2.6-4.5L14 8V3" fill="currentColor" fill-opacity="0.18"/><path d="M6.8 15h10.4"/>',
        hourglass: '<path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3M7 21v-3a5 5 0 0 1 5-5 5 5 0 0 1 5 5v3" fill="currentColor" fill-opacity="0.16"/>',
        timer: '<circle cx="12" cy="13" r="8" fill="currentColor" fill-opacity="0.18"/><path d="M12 9v4l2.5 2M9 3h6M12 3v2"/>',
        target: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.12"/><circle cx="12" cy="12" r="5" fill="currentColor" fill-opacity="0.16"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
        bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8c.7.6 1.2 1.3 1.5 2.2h4c.3-.9.8-1.6 1.5-2.2A6 6 0 0 0 12 3z" fill="currentColor" fill-opacity="0.22"/>',
        tag: '<path d="M3 10V4a1 1 0 0 1 1-1h6l10 10-7 7L3 10z" fill="currentColor" fill-opacity="0.18"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/>',
        clipboard: '<rect x="5" y="4" width="14" height="17" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
        rocket: '<path d="M12 3c4 2 6 6 6 10l-4 3-2 4-2-4-4-3c0-4 2-8 6-10z" fill="currentColor" fill-opacity="0.2"/><circle cx="12" cy="10" r="1.8"/>',
        map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" fill="currentColor" fill-opacity="0.16"/><path d="M9 4v14M15 6v14"/>',
        compass: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><polygon points="15.5,8.5 13.3,13.3 8.5,15.5 10.7,10.7" fill="currentColor" fill-opacity="0.35"/>',
        planet: '<circle cx="12" cy="12" r="6" fill="currentColor" fill-opacity="0.2"/><ellipse cx="12" cy="12" rx="10.5" ry="3.5" transform="rotate(-22 12 12)" fill="none"/>',
        mountain: '<path d="M3 19l6-11 4 6 3-4 5 9H3z" fill="currentColor" fill-opacity="0.2"/>',
        sunrise: '<path d="M12 4v3M4.9 10.9l2.1 2.1M19.1 10.9l-2.1 2.1M3 17h18M6 21h12"/><path d="M8 17a4 4 0 0 1 8 0" fill="currentColor" fill-opacity="0.24"/>',

        // Scolaire, Filières & Matières
        gradCap: '<path d="M2 9l10-5 10 5-10 5L2 9z" fill="currentColor" fill-opacity="0.22"/><path d="M6 11.5v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M21 9.5V16"/>',
        school: '<path d="M3 10l9-6 9 6v10H3V10z" fill="currentColor" fill-opacity="0.16"/><path d="M9 20v-6h6v6M12 4v2"/>',
        book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5z" fill="currentColor" fill-opacity="0.18"/><path d="M4 19a2 2 0 0 1 2-2h14"/>',
        bookOpen: '<path d="M2 5.5c2.5-1 6-1 10 1 4-2 7.5-2 10-1v13c-2.5-1-6-1-10 1-4-2-7.5-2-10-1v-13z" fill="currentColor" fill-opacity="0.16"/><path d="M12 6.5v13"/>',
        palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a1.5 1.5 0 0 1 0-3h3.5A4.5 4.5 0 0 0 21 8.5 5.5 5.5 0 0 0 12 3z" fill="currentColor" fill-opacity="0.18"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7.5" r="1" fill="currentColor"/><circle cx="14.5" cy="7.5" r="1" fill="currentColor"/>',
        sliders: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="11" cy="17" r="2" fill="currentColor"/>',
        sun: '<circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.24"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        battery: '<rect x="3" y="7" width="16" height="10" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M21 10v4M7 10v4M11 10v4"/>',
        code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
        monitor: '<rect x="3" y="4" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M8 20h8M12 16v4"/>',
        chart: '<path d="M4 20h16"/><rect x="6" y="12" width="3" height="8" rx="0.8" fill="currentColor" fill-opacity="0.22"/><rect x="10.5" y="8" width="3" height="12" rx="0.8" fill="currentColor" fill-opacity="0.22"/><rect x="15" y="4" width="3" height="16" rx="0.8" fill="currentColor" fill-opacity="0.22"/>',
        trendUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        microscope: '<path d="M6 20h12M10 20v-3a5 5 0 0 1 5-5"/><path d="M14 4l3 3-5 5-3-3 5-5z" fill="currentColor" fill-opacity="0.22"/><path d="M7 14h6"/>',
        heartPulse: '<path d="M12 20s-7.5-4.8-8.5-9.5A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 3.5C19.5 15.2 12 20 12 20z" fill="currentColor" fill-opacity="0.18"/><path d="M7 12h2.5l1.5-2.5 2 5 1.5-2.5H17"/>',
        hospital: '<rect x="4" y="4" width="16" height="17" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M12 8v6M9 11h6M9 21v-4h6v4"/>',
        leaf: '<path d="M5 19c2-8 7-13 15-14-1 8-6 13-15 14z" fill="currentColor" fill-opacity="0.22"/><path d="M5 19l6-6"/>',
        masks: '<path d="M3 5c3-1 6-1 9 0v6a4.5 4.5 0 0 1-9 0V5z" fill="currentColor" fill-opacity="0.2"/><path d="M12 9c3-1 6-1 9 0v6a4.5 4.5 0 0 1-9 0V9z" fill="currentColor" fill-opacity="0.14"/>',
        utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M16 3v18M16 3a3 3 0 0 1 3 3v4h-3" fill="currentColor" fill-opacity="0.18"/>',
        globe: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none"/><path d="M3.5 9h17M3.5 15h17"/>',
        temple: '<path d="M3 10l9-6 9 6H3z" fill="currentColor" fill-opacity="0.2"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 18h18M2 21h20"/>',
        brain: '<path d="M9.5 4a3.5 3.5 0 0 0-3.5 3.5c0 .4.1.8.2 1.2A3.5 3.5 0 0 0 5 15a3.5 3.5 0 0 0 4.5 4.5V4zM14.5 4A3.5 3.5 0 0 1 18 7.5c0 .4-.1.8-.2 1.2A3.5 3.5 0 0 1 19 15a3.5 3.5 0 0 1-4.5 4.5V4z" fill="currentColor" fill-opacity="0.18"/><path d="M12 4v16"/>',
        bot: '<rect x="4" y="7" width="16" height="12" rx="3" fill="currentColor" fill-opacity="0.18"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/><circle cx="12" cy="3" r="1"/>',
        cart: '<circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/><path d="M3 4h2l2.5 11h10.5l2-8H6.5" fill="currentColor" fill-opacity="0.14"/>',
        calculator: '<rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" fill-opacity="0.16"/><rect x="8" y="6" width="8" height="3.5" rx="0.8" fill="currentColor" fill-opacity="0.25"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/>',
        plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8z" fill="currentColor" fill-opacity="0.2"/><path d="M12 16v5"/>',
        signal: '<path d="M12 12v9M8.5 8.5a5 5 0 0 1 7 0M5.5 5.5a9.5 9.5 0 0 1 13 0"/><circle cx="12" cy="11" r="1.5" fill="currentColor"/>',
        ruler: '<path d="M3 17L17 3l4 4L7 21H3v-4z" fill="currentColor" fill-opacity="0.18"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
        alert: '<path d="M12 3L2.5 19.5h19L12 3z" fill="currentColor" fill-opacity="0.2"/><path d="M12 9v5M12 17h.01"/>',
        megaphone: '<path d="M4 11v3a1 1 0 0 0 1 1h2l3 5h2l-1.5-5H14l6 3V7l-6 3H5a1 1 0 0 0-1 1z" fill="currentColor" fill-opacity="0.18"/>',
        bank: '<path d="M3 9l9-5 9 5H3z" fill="currentColor" fill-opacity="0.2"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 19h18"/>',
        wave: '<path d="M7 11.5V6a1.5 1.5 0 0 1 3 0v4M10 9V4.5a1.5 1.5 0 0 1 3 0V10M13 9V5.5a1.5 1.5 0 0 1 3 0V11M16 10V7.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.8-4.2a1.5 1.5 0 0 1 2.4-1.8L7 11.5z" fill="currentColor" fill-opacity="0.18"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fill-opacity="0.15"/><path d="M15.5 15.5L21 21"/>',
        edit: '<path d="M4 20h4l11-11-4-4L4 16v4z" fill="currentColor" fill-opacity="0.18"/><path d="M13 7l4 4"/>',
        download: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
        flag: '<path d="M5 3v18M5 4h11l-2 4 2 4H5" fill="currentColor" fill-opacity="0.2"/>',
    });

    /**
     * Table de correspondance Emoji -> nom d'icône SVG unifiée.
     * Permet de convertir automatiquement toute icône issue d'AdminStore,
     * des succès, quêtes, filières, personas IA ou boutique en SVG cohérent.
     */
    const EMOJI_MAP = Object.freeze({
        '⚔': 'swords', '⚔️': 'swords',
        '⚙': 'settings', '⚙️': 'settings',
        '👤': 'user', '👥': 'users', '🧙': 'user',
        '✕': 'close', '✖': 'close', '❌': 'close', '✗': 'close',
        '✓': 'check', '✔': 'check', '✅': 'check',
        '🏠': 'home', '☰': 'menu',
        '←': 'arrowLeft', '→': 'arrowRight', '↩': 'exit', '↺': 'refresh', '🔄': 'refresh', '🔁': 'refresh',
        '🚪': 'exit', '💾': 'save', '🖥': 'fullscreen', '🖥️': 'monitor',
        '👁': 'eye', '👁️': 'eye',
        '🔊': 'volumeOn', '🔉': 'volumeLow', '🔇': 'volumeOff',
        '🎵': 'music', '🔔': 'bell',
        '🔒': 'lock', '🔐': 'lock', '🛡️': 'shield', '🛡': 'shield', '🔑': 'key',
        '⚖': 'scales', '⚖️': 'scales', '🍪': 'cookie', '🏢': 'building',
        '📜': 'scroll', '📧': 'mail', '🐙': 'github', '🔵': 'google',
        '🏝️': 'island', '🏝': 'island', '🛍️': 'shop', '🛍': 'shop',
        '🏆': 'trophy', '🏅': 'medal', '👑': 'crown',
        '⭐': 'starFilled', '🌟': 'star', '☆': 'starEmpty',
        '✨': 'sparkle', '✦': 'sparkle', '🌠': 'sparkle', '🎉': 'sparkle',
        '🔥': 'flame', '☄️': 'flame', '🌋': 'flame',
        '⚡': 'bolt', '🪙': 'coin', '💰': 'coin', '💎': 'gem', '🔮': 'gem', '🍷': 'gem',
        '🎁': 'gift', '🧪': 'potion', '🧫': 'potion',
        '⏳': 'hourglass', '⏱': 'timer', '⏱️': 'timer',
        '🎯': 'target', '💡': 'bulb', '🏷️': 'tag', '🏷': 'tag',
        '📋': 'clipboard', '🚀': 'rocket', '🛸': 'rocket',
        '🗺️': 'map', '🗺': 'map', '🧭': 'compass', '🌌': 'planet',
        '🏔️': 'mountain', '🏔': 'mountain', '🌅': 'sunrise',
        '🎓': 'gradCap', '🏫': 'school', '📚': 'book', '📘': 'book', '📖': 'bookOpen',
        '🎨': 'palette', '🎛️': 'sliders', '🎛': 'sliders', '🔅': 'sun', '❄️': 'sparkle',
        '🔋': 'battery', '💻': 'code', '📊': 'chart', '📈': 'trendUp', '💹': 'trendUp',
        '🔬': 'microscope', '🩺': 'heartPulse', '🏥': 'hospital',
        '🌱': 'leaf', '🌿': 'leaf', '🌲': 'leaf', '🌸': 'leaf', '❦': 'leaf',
        '🎭': 'masks', '🍽️': 'utensils', '🍽': 'utensils',
        '🌐': 'globe', '🌍': 'globe', '🌊': 'globe', '⊕': 'globe',
        '🏛️': 'temple', '🏛': 'temple', '⌂': 'temple',
        '🧠': 'brain', '🤖': 'bot', '🛒': 'cart', '🧮': 'calculator',
        '🔌': 'plug', '📡': 'signal', '📐': 'ruler', '∑': 'calculator', '⚛': 'planet',
        '⚠️': 'alert', '⚠': 'alert', '📢': 'megaphone', '🏦': 'bank',
        '👋': 'wave', '🔍': 'search', '✏️': 'edit', '✏': 'edit', '🕹️': 'monitor',
        '🇬🇧': 'flag', '🇪🇸': 'flag', '🇩🇪': 'flag', '▶': 'play',
    });

    /**
     * Génère un <svg> propre et cohérent pour le nom d'icône donné.
     * @param {string} name
     * @param {{ size?: number, className?: string, tone?: string, label?: string }} [opts]
     */
    function svg(name, opts) {
        const o = opts || {};
        const body = PATHS[name] || PATHS.sparkle;
        const size = Number(o.size) > 0 ? Math.round(Number(o.size)) : 18;
        const classes = ['eq-icon'];
        if (o.tone) classes.push('eq-icon--' + String(o.tone).replace(/[^a-z0-9_-]/gi, ''));
        if (o.className) classes.push(String(o.className).replace(/[^a-z0-9 _-]/gi, ''));
        const rawLabel = o.label || o.title || '';
        const aria = rawLabel
            ? `role="img" aria-label="${String(rawLabel).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`
            : 'aria-hidden="true"';
        return `<svg class="${classes.join(' ')}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${aria}>${body}</svg>`;
    }

    /** Résout le nom d'icône depuis un nom interne ou un emoji. */
    function resolveName(iconOrEmoji, fallback) {
        const raw = String(iconOrEmoji || '').trim();
        if (PATHS[raw]) return raw;
        if (EMOJI_MAP[raw]) return EMOJI_MAP[raw];
        // Essaie sans sélecteur de variation FE0F
        const stripped = raw.replace(/\uFE0F/g, '');
        if (EMOJI_MAP[stripped]) return EMOJI_MAP[stripped];
        return (fallback && PATHS[fallback]) ? fallback : 'sparkle';
    }

    /**
     * Rend un emoji ou un nom d'icône en SVG unifié.
     * Si la chaîne est un court sigle alphabétique (ex: "Aa", "En", "Es"),
     * le renvoie proprement dans un badge typographique cohérent.
     */
    function fromEmoji(iconOrEmoji, opts) {
        const raw = String(iconOrEmoji || '').trim();
        if (/^[A-Za-zÀ-ÿ0-9]{1,3}$/.test(raw)) {
            const safe = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<span class="eq-icon-mono" aria-hidden="true">${safe}</span>`;
        }
        return svg(resolveName(raw, opts && opts.fallback), opts);
    }

    /** Rend une rangée d'étoiles SVG (count pleines, max - count vides). */
    function stars(count, max, size) {
        const m = Math.max(1, Math.min(5, Number(max) || 3));
        const c = Math.max(0, Math.min(m, Number(count) || 0));
        const s = Number(size) > 0 ? Math.round(Number(size)) : 14;
        let out = '';
        for (let i = 0; i < m; i++) {
            out += svg(i < c ? 'starFilled' : 'starEmpty', {
                size: s,
                tone: i < c ? 'gold' : 'muted',
                className: i < c ? 'eq-star-filled' : 'eq-star-empty',
            });
        }
        return `<span class="eq-stars-row" aria-hidden="true">${out}</span>`;
    }

    /** Retire un emoji décoratif en préfixe d'un intitulé (ex: "🧪 Potion Double XP" -> "Potion Double XP"). */
    function stripLeadingEmoji(text) {
        const s = String(text || '');
        const trimmed = s.trim();
        for (const key of Object.keys(EMOJI_MAP)) {
            if (trimmed.startsWith(key)) {
                return trimmed.slice(key.length).trim();
            }
        }
        return s;
    }

    /** Extrait le nom d'icône SVG du préfixe emoji d'un intitulé (ou fallback). */
    function iconFromLabel(text, fallback) {
        const trimmed = String(text || '').trim();
        for (const key of Object.keys(EMOJI_MAP)) {
            if (trimmed.startsWith(key)) return EMOJI_MAP[key];
        }
        return (fallback && PATHS[fallback]) ? fallback : 'sparkle';
    }

    function names() {
        return Object.keys(PATHS);
    }

    return Object.freeze({
        PATHS,
        EMOJI_MAP,
        names,
        svg,
        resolveName,
        fromEmoji,
        stars,
        stripLeadingEmoji,
        iconFromLabel,
    });
});
