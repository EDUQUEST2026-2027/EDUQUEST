/* =============================================================================
   TEST-HELPER.JS — Mock d'environnement pour tests Node.js
   Fournit une implémentation légère et isolée de localStorage, crypto, document
   pour exécuter les tests sans aucune dépendance npm.
   ============================================================================= */

function createLocalStorageMock() {
    let store = {};
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        clear() {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key(i) {
            return Object.keys(store)[i] || null;
        },
        _dump() {
            return { ...store };
        }
    };
}

function setupTestEnv() {
    if (typeof globalThis.localStorage === 'undefined') {
        globalThis.localStorage = createLocalStorageMock();
    } else {
        globalThis.localStorage.clear();
    }
}

module.exports = {
    createLocalStorageMock,
    setupTestEnv,
};
