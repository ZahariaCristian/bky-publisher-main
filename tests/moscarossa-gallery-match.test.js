const assert = require("node:assert/strict");
const { test } = require("node:test");
const { matchGalleryImages } = require("../adsManage/moscarossa/galleryMatch");

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
