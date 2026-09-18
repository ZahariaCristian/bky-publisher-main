const assert = require("node:assert/strict");
const { test } = require("node:test");
const { updateAd, verifyPersistedMoscarossaCity, moscarossaExpirationTimestamp,
    parseMoscarossaAdExpiration } =
    require("../adsManage/moscarossa/publishAds");

function mockSourcePage(states) {
    let next = 0;
    const createdPages = [];
    const context = {
        async newPage() {
            const state = states[next++] || {};
            const page = {
                closed: false,
                navigationUrl: "",
                setDefaultTimeout() {},
                setDefaultNavigationTimeout() {},
                async setUserAgent() {},
                async goto(url) {
                    this.navigationUrl = url;
                    if (state.navigationError) throw state.navigationError;
                    return { status: () => state.status || 200 };
                },
                async evaluate() {
                    return state.persisted || null;
                },
                async close() { this.closed = true; }
            };
            createdPages.push(page);
            return page;
        }
    };
    return {
        page: {
            browserContext: () => context,
            evaluate: async () => "Mozilla/5.0 Test"
        },
        createdPages
    };
}

const selectedCity = { value: "4688", text: "Cuneo (CN)" };

test("confirms the persisted city on a separate editor page", async () => {
    const source = mockSourcePage([{
        persisted: {
            hasForm: true, login: false, remoteId: "1159998",
            cityId: "4688", city: "Cuneo (CN)"
        }
    }]);
    const result = await verifyPersistedMoscarossaCity(source.page, "1159998", selectedCity);
    assert.deepEqual(result, { verified: true, city: "Cuneo (CN)", cityId: "4688" });
    assert.equal(source.createdPages[0].closed, true);
    assert.equal(source.createdPages[0].navigationUrl,
        "https://www.moscarossa.biz/private/inserimento.php?id_accompa=1159998#f");
});

test("accepts a usable editor DOM after navigation timeout", async () => {
    const source = mockSourcePage([{
        navigationError: new Error("Navigation timeout of 15000 ms exceeded"),
        persisted: {
            hasForm: true, login: false, remoteId: "1159998",
            cityId: "4688", city: "Cuneo (CN)"
        }
    }]);
    const result = await verifyPersistedMoscarossaCity(source.page, "1159998", selectedCity);
    assert.equal(result.verified, true);
    assert.equal(source.createdPages[0].closed, true);
});

test("does not misclassify verification-page outages as a rejected edit", async () => {
    const source = mockSourcePage([
        { navigationError: new Error("Navigation timeout of 15000 ms exceeded") },
        { navigationError: new Error("Navigation timeout of 15000 ms exceeded") }
    ]);
    const result = await verifyPersistedMoscarossaCity(source.page, "1159998", selectedCity);
    assert.deepEqual(result, { verified: false, city: "Cuneo (CN)", cityId: "4688" });
    assert.equal(source.createdPages.length, 2);
    assert.ok(source.createdPages.every((page) => page.closed));
});

test("retries verification on a new page after an unusable timeout", async () => {
    const source = mockSourcePage([
        { navigationError: new Error("Navigation timeout of 15000 ms exceeded") },
        { persisted: {
            hasForm: true, login: false, remoteId: "1159998",
            cityId: "4688", city: "Cuneo (CN)"
        } }
    ]);
    const result = await verifyPersistedMoscarossaCity(source.page, "1159998", selectedCity);
    assert.equal(result.verified, true);
    assert.equal(source.createdPages.length, 2);
    assert.ok(source.createdPages.every((page) => page.closed));
});

test("rejects a confirmed persisted city mismatch", async () => {
    const source = mockSourcePage([{
        persisted: {
            hasForm: true, login: false, remoteId: "1159998",
            cityId: "5385", city: "Bari (BA)"
        }
    }]);
    await assert.rejects(
        verifyPersistedMoscarossaCity(source.page, "1159998", selectedCity),
        /non ha salvato il Comune richiesto/
    );
    assert.equal(source.createdPages[0].closed, true);
});

test("skips an expired EDIT without opening the Moscarossa editor", async () => {
    let openedEditor = false;
    const expiresAt = Date.now() - 1000;
    const result = await updateAd({ goto: async () => { openedEditor = true; } }, "1159998", {
        id: 63,
        adExpiresAt: `${expiresAt}`,
        urlBK: "https://www.moscarossa.biz/girl-1159998.php"
    });
    assert.equal(openedEditor, false);
    assert.equal(result.skipped, true);
    assert.equal(result.state, "OK");
    assert.equal(result.reasonCode, "MOSCAROSSA_EXPIRED");
    assert.equal(result.adExpiresAt, expiresAt);
});

test("does not treat a promotion countdown as advertisement expiration", () => {
    assert.equal(moscarossaExpirationTimestamp({ remoteExpiresAt: `${Date.now() - 1000}` }), null);
});

test("parses the Moscarossa Online fino al date at the end of the Rome day", () => {
    assert.equal(
        new Date(parseMoscarossaAdExpiration("Annuncio Pubblicato Online fino al 08/10/26")).toISOString(),
        "2026-10-08T21:59:59.999Z"
    );
    assert.equal(parseMoscarossaAdExpiration("PREMIUM fino al 18-09-2026 alle 19:00"), null);
});

test("keeps gallery synchronization pending when the editor fails before mutation", async () => {
    const page = {
        goto: async () => { throw new Error("editor unavailable"); },
        isClosed: () => true
    };
    await assert.rejects(updateAd(page, "1159998", {
        typeAnnuncio: "Premium",
        errorReason: "MOSCAROSSA_GALLERY_PENDING",
        data: new Date(),
        images: [__filename]
    }), /MOSCAROSSA_GALLERY_PENDING: editor unavailable/);
});
