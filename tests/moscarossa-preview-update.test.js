const assert = require("node:assert/strict");
const { test } = require("node:test");
const { updatePublishedPreview } = require("../adsManage/moscarossa/publishAds");

function mockPreviewPage({ hasUpload = true, afterBody = "Anteprima salvata", afterUrl } = {}) {
    const url = "https://www.moscarossa.biz/private/intro_sel_anteprima.php?id_accompa=1159998";
    const events = [];
    let evaluation = 0;
    const child = {
        isClosed: () => true,
        setDefaultTimeout() {},
        setDefaultNavigationTimeout() {},
        async goto(target) {
            events.push(["open", target]);
            return { status: () => 200 };
        },
        async evaluate() {
            evaluation += 1;
            if (evaluation === 1) return { url, login: false, image: "old-image.jpg", hasUpload };
            if (evaluation === 2) return true;
            return { url: afterUrl || url, login: false, image: "new-image.jpg", body: afterBody };
        },
        async $(selector) {
            events.push(["input", selector]);
            return { async uploadFile(file) { events.push(["upload", file]); } };
        },
        async waitForFunction() {},
        async waitForNavigation() { return null; },
        async close() { events.push(["close"]); }
    };
    return { page: { browserContext: () => ({ newPage: async () => child }) }, events };
}

test("updates a pending Moscarossa preview through the dedicated page", async () => {
    const { page, events } = mockPreviewPage();
    const result = await updatePublishedPreview(page, "1159998", { images: [__filename] });
    assert.equal(result.ok, true);
    assert.equal(events[0][1],
        "https://www.moscarossa.biz/private/intro_sel_anteprima.php?id_accompa=1159998");
    assert.equal(events.some(([event]) => event === "upload"), true);
    assert.equal(events.at(-1)[0], "close");
});

test("does not claim success when the preview page lacks an upload control", async () => {
    const { page } = mockPreviewPage({ hasUpload: false });
    await assert.rejects(updatePublishedPreview(page, "1159998", { images: [__filename] }),
        /non espone un campo foto riconoscibile/);
});

test("does not treat an image displayed in the browser as proof of a saved preview", async () => {
    const { page } = mockPreviewPage({ afterBody: "Seleziona una foto" });
    await assert.rejects(updatePublishedPreview(page, "1159998", { images: [__filename] }),
        /non ha confermato la nuova anteprima/);
});
