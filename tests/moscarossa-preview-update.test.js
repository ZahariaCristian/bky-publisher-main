const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const { updateAd, preparePreviewImage } = require("../adsManage/moscarossa/publishAds");

test("uses the selected gallery preview rather than another available image", async () => {
    const unavailable = `${__filename}.missing`;
    let requested = "";
    const preview = await preparePreviewImage({ picsAudit: [
        { path: __filename, galleryId: 100, phone: "1234567890", isAnteprima: false },
        { path: unavailable, galleryId: 200, phone: "1234567890", isAnteprima: true }
    ] }, "1159998", {
        websiteBaseUrl: "http://127.0.0.1:3001",
        httpGet: async (url) => {
            requested = url;
            return { headers: { "content-type": "image/jpeg" }, data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };
        }
    });
    try {
        assert.equal(new URL(requested).searchParams.get("id"), "200");
        assert.equal(fs.readFileSync(preview.path).length, 4);
    } finally {
        await preview.cleanup();
    }
    assert.equal(fs.existsSync(preview.path), false);
});

test("keeps the selected local preview without fetching it again", async () => {
    const preview = await preparePreviewImage({ picsAudit: [
        { path: __filename, galleryId: 200, phone: "1234567890", isAnteprima: true }
    ] }, "1159998", {
        httpGet: async () => { throw new Error("unexpected website request"); }
    });
    assert.equal(preview.path, __filename);
    await preview.cleanup();
});

test("reports a missing selected photo before editing when it cannot be fetched", async () => {
    await assert.rejects(preparePreviewImage({ picsAudit: [
        { path: `${__filename}.missing`, galleryId: 200, phone: "1234567890", isAnteprima: true }
    ] }, "1159998", {
        httpGet: async () => { throw Object.assign(new Error("Not Found"), { response: { status: 404 } }); }
    }), /foto locale assente.*recupero galleria 200.*404/);
});

test("rejects a non-image website response", async () => {
    await assert.rejects(preparePreviewImage({ picsAudit: [
        { path: `${__filename}.missing`, galleryId: 200, phone: "1234567890", isAnteprima: true }
    ] }, "1159998", {
        httpGet: async () => ({ headers: { "content-type": "text/html" }, data: Buffer.from("login") })
    }), /non ha restituito una foto valida/);
});

test("does not open the editor when a pending preview has no usable image source", async () => {
    let openedEditor = false;
    const page = { goto: async () => { openedEditor = true; } };
    await assert.rejects(updateAd(page, "1159998", {
        errorReason: "MOSCAROSSA_PREVIEW_PENDING",
        picsAudit: [{ path: `${__filename}.missing`, isAnteprima: true }]
    }), /la foto selezionata non esiste sul disco del publisher/);
    assert.equal(openedEditor, false);
});
