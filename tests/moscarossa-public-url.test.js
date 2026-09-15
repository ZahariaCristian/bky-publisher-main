const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalizeMoscarossaPublicUrl, pickMoscarossaPublicUrl } = require("../adsManage/moscarossa/publicUrl");
const { readMoscarossaPublicUrl } = require("../adsManage/moscarossa/publishAds");

function mockSourcePage(state = {}) {
    const viewPage = {
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
            if (state.evaluateError) throw state.evaluateError;
            return state.result || {
                url: this.navigationUrl,
                login: false,
                href: "https://www.moscarossa.biz/girl-1159998.php"
            };
        },
        async close() { this.closed = true; }
    };
    return {
        sourcePage: {
            browserContext: () => ({ newPage: async () => viewPage }),
            evaluate: async () => "Mozilla/5.0 Test"
        },
        viewPage
    };
}

test("accepts a matching public ad URL and strips tracking parameters", () => {
    assert.equal(normalizeMoscarossaPublicUrl("https://www.moscarossa.biz/girl-1159998.php?ref=1#top", "1159998"),
        "https://www.moscarossa.biz/girl-1159998.php");
    assert.equal(normalizeMoscarossaPublicUrl("https://moscarossa.biz/trans-1159998.php", "1159998"),
        "https://www.moscarossa.biz/trans-1159998.php");
});

test("never saves editor, management, promotion, foreign or mismatched URLs", () => {
    for (const url of [
        "https://www.moscarossa.biz/private/inserimento.php?id_accompa=1159998#f",
        "https://www.moscarossa.biz/private/vedi_annuncio_ut.php?id_accompa=1159998",
        "https://www.moscarossa.biz/private/promuovi.php?id_accompa=1159998",
        "https://not-moscarossa.biz/girl-1159998.php",
        "https://www.moscarossa.biz/girl-1159904.php"
    ]) {
        assert.equal(normalizeMoscarossaPublicUrl(url, "1159998"), null, url);
    }
    assert.equal(pickMoscarossaPublicUrl("1159998",
        "https://www.moscarossa.biz/private/inserimento.php?id_accompa=1159998#f",
        "https://www.moscarossa.biz/girl-1159998.php"),
    "https://www.moscarossa.biz/girl-1159998.php");
});

test("reads the publication anchor from the matching saved-ad page", async () => {
    const source = mockSourcePage();
    assert.equal(await readMoscarossaPublicUrl(source.sourcePage, "1159998"),
        "https://www.moscarossa.biz/girl-1159998.php");
    assert.equal(source.viewPage.navigationUrl,
        "https://www.moscarossa.biz/private/vedi_annuncio_ut.php?id_accompa=1159998");
    assert.equal(source.viewPage.closed, true);
});

test("uses a loaded saved-ad DOM after a navigation timeout", async () => {
    const source = mockSourcePage({ navigationError: new Error("Navigation timeout of 15000 ms exceeded") });
    assert.equal(await readMoscarossaPublicUrl(source.sourcePage, "1159998"),
        "https://www.moscarossa.biz/girl-1159998.php");
    assert.equal(source.viewPage.closed, true);
});

test("treats unavailable or wrong saved-ad pages as a missing link, not an edit failure", async () => {
    const wrongPage = mockSourcePage({ result: {
        url: "https://www.moscarossa.biz/private/vedi_annuncio_ut.php?id_accompa=1159904",
        login: false,
        href: "https://www.moscarossa.biz/girl-1159998.php"
    } });
    assert.equal(await readMoscarossaPublicUrl(wrongPage.sourcePage, "1159998"), null);
    const unavailable = mockSourcePage({ evaluateError: new Error("Runtime.callFunctionOn timed out") });
    assert.equal(await readMoscarossaPublicUrl(unavailable.sourcePage, "1159998"), null);
    assert.equal(unavailable.viewPage.closed, true);
});
