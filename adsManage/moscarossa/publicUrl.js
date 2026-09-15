function normalizeMoscarossaPublicUrl(value, remoteId) {
    const id = `${remoteId || ""}`.trim();
    if (!/^\d{4,9}$/.test(id) || !value) return null;

    try {
        const url = new URL(`${value}`.trim());
        if (url.protocol !== "https:" || !["www.moscarossa.biz", "moscarossa.biz"].includes(url.hostname.toLowerCase())) {
            return null;
        }
        if (!new RegExp(`^/(?:girl|trans|boy|massage)-${id}\\.php$`, "i").test(url.pathname)) {
            return null;
        }
        return `https://www.moscarossa.biz${url.pathname}`;
    } catch (_) {
        return null;
    }
}

function pickMoscarossaPublicUrl(remoteId, ...candidates) {
    for (const candidate of candidates) {
        const publicUrl = normalizeMoscarossaPublicUrl(candidate, remoteId);
        if (publicUrl) return publicUrl;
    }
    return null;
}

module.exports = { normalizeMoscarossaPublicUrl, pickMoscarossaPublicUrl };
