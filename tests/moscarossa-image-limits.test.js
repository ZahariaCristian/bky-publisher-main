const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const {
    buildPublishData,
    parseFreePhotoLimit,
    validateUploadImagePaths,
    verifyFreePhotoAllowance
} = require("../adsManage/moscarossa/publishAds");

test("publisher plan limits match Moscarossa timeslot limits", () => {
    const limits = { Free: 5, Premium: 10, Top: 10, Red: 15, Gold: 20 };
    for (const [typeAnnuncio, expected] of Object.entries(limits)) {
        assert.equal(buildPublishData({ typeAnnuncio }).imageLimit, expected);
    }
});

test("upload rejects selections exceeding the plan instead of truncating them", () => {
    assert.throws(() => validateUploadImagePaths(Array(6).fill(__filename), [], 5),
        /6 immagini selezionate, massimo 5/);
});

test("upload rejects missing selected files instead of publishing fewer images", () => {
    assert.throws(() => validateUploadImagePaths([`${__filename}.missing`], [], 5),
        /1 immagini selezionate ma solo 0 file locali disponibili/);
    const files = validateUploadImagePaths([__filename, path.join(__dirname, "moscarossa-public-url.test.js")], [], 5);
    assert.equal(files.length, 2);
});

test("extracts account-specific Free photo allowance from promotion text", () => {
    assert.equal(parseFreePhotoLimit("Massimo 3 foto, richiedi la verifica delle foto per aumentare il limite a 5"), 3);
    assert.equal(parseFreePhotoLimit("Maximum 5 photos"), 5);
    assert.equal(parseFreePhotoLimit("PREMIUM 10 foto TOP 10 foto"), null);
});

test("Free publication pauses before activation if account allows fewer photos", async () => {
    const page = { evaluate: async () => "Massimo 3 foto, richiedi la verifica delle foto per aumentare il limite a 5" };
    await assert.rejects(verifyFreePhotoAllowance(page, "1159998", 5, 5), (error) => {
        assert.equal(error.reasonCode, "MOSCAROSSA_PHOTO_LIMIT");
        assert.equal(error.remoteId, "1159998");
        assert.equal(error.scheduleState, "ALERT");
        return true;
    });
});

test("Free publication pauses when remote photos are incomplete or unconfirmed", async () => {
    const page = { evaluate: async () => "Massimo 5 foto" };
    await assert.rejects(verifyFreePhotoAllowance(page, "1159998", 5, 3),
        (error) => error.reasonCode === "MOSCAROSSA_IMAGES_INCOMPLETE");
    await assert.rejects(verifyFreePhotoAllowance(page, "1159998", 5, null),
        (error) => error.reasonCode === "MOSCAROSSA_IMAGE_COUNT_UNKNOWN");
    await verifyFreePhotoAllowance(page, "1159998", 5, 5);
});
