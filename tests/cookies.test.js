const test = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv } = require('./test-helper.js');

setupTestEnv();
const EduCookies = require('../js/cookies.js');

test('EduCookies - Consentement RGPD et validité', async (t) => {
    localStorage.clear();

    await t.test('Consentement absent au départ', () => {
        const consent = EduCookies.getConsent();
        assert.equal(consent, null);
    });

    await t.test('Enregistrement du refus (traceurs optionnels désactivés)', () => {
        const c = EduCookies.setConsent('refused', { analytics: true, marketing: true });
        assert.equal(c.choice, 'refused');
        assert.equal(c.analytics, false, 'Refus désactive obligatoirement analytics');
        assert.equal(c.marketing, false, 'Refus désactive obligatoirement marketing');
    });

    await t.test('Enregistrement de l\'acceptation', () => {
        const c = EduCookies.setConsent('accepted');
        assert.equal(c.choice, 'accepted');
        assert.equal(c.analytics, true);
        assert.equal(c.marketing, true);
        assert.ok(c.ts);
    });

    await t.test('Consentement personnalisé', () => {
        const c = EduCookies.setConsent('custom', { analytics: true, marketing: false });
        assert.equal(c.choice, 'custom');
        assert.equal(c.analytics, true);
        assert.equal(c.marketing, false);
    });

    await t.test('Expiration après 12 mois', () => {
        // Simule un consentement vieux de 400 jours
        const oldDate = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
        localStorage.setItem('eduquest_cookie_consent', JSON.stringify({
            choice: 'accepted',
            analytics: true,
            marketing: true,
            ts: oldDate
        }));

        const consent = EduCookies.getConsent();
        assert.equal(consent, null, 'Le consentement de plus de 12 mois doit être périmé');
    });
});
