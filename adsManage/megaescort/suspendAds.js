const { deleteAd: deleteAdRequest, updateAd: updateAdRequest, firstNonEmpty } = require("./client");
const { buildAdPayload, log } = require("./publishAds");

function normalizeRemoteId(remoteId) {
    const value = firstNonEmpty(remoteId);
    if (!value) {
        throw new Error("Megaescort ad id is required.");
    }
    return value;
}

async function deleteAds(remoteId, apiUserOrPlatform, options = {}) {
    const id = normalizeRemoteId(remoteId);
    const apiUser = firstNonEmpty(options.apiUser, apiUserOrPlatform);

    log("delete", "Deleting Megaescort ad through AdSpeed API", { apiUser, id });
    return deleteAdRequest(id, options.apiKey, apiUser, options);
}

async function updateVisibility(remoteId, adData = {}, status, options = {}) {
    const id = normalizeRemoteId(remoteId);
    const apiUser = firstNonEmpty(options.apiUser, adData.email, adData.username);
    const payload = buildAdPayload({
        ...adData,
        remotePostID: id,
        status
    });

    log(status ? "republish" : "suspend", "Updating Megaescort visibility through AdSpeed API", {
        apiUser,
        id,
        status
    });

    const result = await updateAdRequest(id, payload, options.apiKey, apiUser, options);
    return {
        ...result,
        ok: result.ok !== false,
        payload: {
            ...payload,
            idpriv: result.megaId || id
        }
    };
}

async function suspendAds(remoteId, adData = {}, options = {}) {
    return updateVisibility(remoteId, adData, 0, options);
}

async function republishAds(remoteId, adData = {}, options = {}) {
    return updateVisibility(remoteId, adData, 1, options);
}

module.exports = {
    republishAds,
    suspendAds,
    deleteAds
};
