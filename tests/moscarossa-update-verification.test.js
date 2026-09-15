const assert = require("node:assert/strict");
const { test } = require("node:test");
const { verifyPersistedMoscarossaCity } = require("../adsManage/moscarossa/publishAds");

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
