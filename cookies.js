const EduCookies = (() => {
    'use strict';
    const API = {
        getConsent: () => ({ choice: 'accepted', analytics: false, marketing: false, ts: new Date().toISOString() }),
        setConsent: () => {},
        showBanner: () => {},
        closeBanner: () => {},
        isOpen: () => false,
    };
    window.EduCookies = API;
    return API;
})();
if (typeof window !== 'undefined') {
    window.EduCookies = EduCookies;
}
