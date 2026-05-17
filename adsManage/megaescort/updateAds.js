const { updateAd: updateAdRequest, firstNonEmpty } = require("./client");
const { buildAdPayload, log } = require("./publishAds");

async function updateAd(pageOrRemoteId, maybeAdData, maybeOptions = {}) {
    const remoteId = typeof pageOrRemoteId === "string" || typeof pageOrRemoteId === "number"
        ? String(pageOrRemoteId)
        : firstNonEmpty(maybeAdData?.remotePostID, maybeAdData?.mega_id, maybeAdData?.megaId);
    const adData = maybeAdData || {};
    const options = maybeOptions || {};
    const apiUser = firstNonEmpty(options.apiUser, adData.email, adData.username);

    if (!remoteId) {
        throw new Error("Megaescort remotePostID is required for update.");
    }

    const payload = buildAdPayload({ ...adData, remotePostID: remoteId });
    log("update", "Updating Megaescort ad through AdSpeed API", {
        apiUser,
        remoteId,
        title: payload.ad.name
    });

    const result = await updateAdRequest(remoteId, payload, options.apiKey, apiUser, options);
    return {
        ...result,
        ok: result.ok !== false,
        payload: {
            ...payload,
            idpriv: result.megaId || remoteId
        }
    };
}

module.exports = {
    updateAd
};
