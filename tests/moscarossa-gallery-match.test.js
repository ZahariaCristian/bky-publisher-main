const assert = require("node:assert/strict");
const { test } = require("node:test");
const { matchGalleryImages, planGalleryUpdate } = require("../adsManage/moscarossa/galleryMatch");

const photo = (value) => ({ pixels: Array(256).fill(value) });

test("keeps matched remote photos and identifies only the changed gallery image", () => {
    const result = matchGalleryImages([photo(10), photo(80), photo(150)],
        [photo(10), photo(50), photo(150)]);
    assert.deepEqual(result.matches.map(({ desiredIndex, remoteIndex }) => [desiredIndex, remoteIndex]),
        [[0, 0], [2, 2]]);
    assert.deepEqual(result.additions, [1]);
    assert.deepEqual(result.removals, [1]);
});

test("rejects ambiguous images instead of deleting an arbitrary remote photo", () => {
    assert.throws(() => matchGalleryImages([photo(10)], [photo(10), photo(11)]),
        /Impossibile distinguere/);
});

test("rejects two selected images that would claim one remote photo", () => {
    assert.throws(() => matchGalleryImages([photo(10), photo(12)], [photo(10)]),
        /stessa foto/);
});

test("replaces a photo in a full gallery by freeing one slot first", () => {
    assert.deepEqual(planGalleryUpdate(20, { additions: [2], removals: [7] }, 20), {
        beforeUpload: [7], afterUpload: []
    });
    assert.deepEqual(planGalleryUpdate(10, { additions: [2], removals: [7] }, 10), {
        beforeUpload: [7], afterUpload: []
    });
});

test("removes all obsolete photos before uploading while leaving matches in place", () => {
    assert.deepEqual(planGalleryUpdate(19, { additions: [0, 3], removals: [4, 8] }, 20), {
        beforeUpload: [4, 8], afterUpload: []
    });
    assert.deepEqual(planGalleryUpdate(5, { additions: [0, 3], removals: [4] }, 20), {
        beforeUpload: [4], afterUpload: []
    });
    assert.deepEqual(planGalleryUpdate(5, { additions: [], removals: [] }, 20), {
        beforeUpload: [], afterUpload: []
    });
});

test("does not touch a remote gallery if the final selection exceeds capacity", () => {
    assert.throws(() => planGalleryUpdate(20, { additions: [0], removals: [] }, 20),
        /galleria finale.*21 foto/);
});
