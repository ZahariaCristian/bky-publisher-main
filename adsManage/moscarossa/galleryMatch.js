"use strict";

// Compare small browser-decoded RGB thumbnails. Moscarossa recompresses
// uploaded photos, so byte hashes cannot identify an existing remote image.
function imageDistance(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) ||
        left.length !== right.length || left.length === 0) return Infinity;
    return left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) /
        (left.length * 255);
}

function matchGalleryImages(desired, remote, { maximumDistance = 0.06, ambiguityMargin = 0.02 } = {}) {
    const pairs = [];
    for (let desiredIndex = 0; desiredIndex < desired.length; desiredIndex += 1) {
        const distances = remote.map((photo, remoteIndex) => ({
            remoteIndex,
            distance: imageDistance(desired[desiredIndex].pixels, photo.pixels)
        })).sort((a, b) => a.distance - b.distance);
        if (distances[0]?.distance <= maximumDistance &&
            distances[1]?.distance <= maximumDistance &&
            distances[1].distance - distances[0].distance < ambiguityMargin) {
            throw new Error(`Impossibile distinguere con sicurezza la foto Moscarossa selezionata ${desiredIndex + 1} da più foto remote.`);
        }
        if (distances[0]?.distance <= maximumDistance) {
            pairs.push({ desiredIndex, ...distances[0] });
        }
    }

    const claimedRemote = new Set();
    for (const pair of pairs) {
        if (claimedRemote.has(pair.remoteIndex)) {
            throw new Error("Più foto selezionate corrispondono alla stessa foto Moscarossa remota.");
        }
        claimedRemote.add(pair.remoteIndex);
    }
    return {
        matches: pairs,
        additions: desired.map((_, index) => index).filter((index) => !pairs.some((pair) => pair.desiredIndex === index)),
        removals: remote.map((_, index) => index).filter((index) => !claimedRemote.has(index))
    };
}

module.exports = { imageDistance, matchGalleryImages };
