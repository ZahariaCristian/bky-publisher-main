const { buildPublishData, publishAd } = require("./publishAds");

const UPDATE_URL_BASE = "https://www.trovagnocca.com/dmc/account#/ads-post";

function extractRemoteAdId(remoteId) {
  const value = `${remoteId || ""}`;
  const editMatch = value.match(/ads-post\/(\d+)/i);
  if (editMatch) return editMatch[1];

  const manageMatch = value.match(/ads\/manage\/(\d+)/i);
  if (manageMatch) return manageMatch[1];

  const numericMatch = value.match(/\b(\d{4,})\b/);
  return numericMatch ? numericMatch[1] : "";
}

function buildUpdateUrl(remoteId) {
  const id = extractRemoteAdId(remoteId);
  if (!id) {
    throw new Error(`Trovagnocca remote ad id missing or invalid for update: ${remoteId}`);
  }

  return `${UPDATE_URL_BASE}/${id}`;
}

async function updateAd(page, adData = {}, options = {}) {
  const remoteId =
    options.remoteId ||
    adData.remotePostID ||
    adData.idpriv ||
    adData.remoteId ||
    adData.id;
  const updateUrl = buildUpdateUrl(remoteId);

  const result = await publishAd(page, adData, {
    ...options,
    postUrl: updateUrl
  });

  return {
    ...result,
    url: result.url || updateUrl,
    payload: {
      ...(result.payload || {}),
      idpriv: extractRemoteAdId(remoteId),
      data: result.payload?.data || buildPublishData(adData)
    }
  };
}

module.exports = {
  UPDATE_URL_BASE,
  buildUpdateUrl,
  extractRemoteAdId,
  updateAd
};
