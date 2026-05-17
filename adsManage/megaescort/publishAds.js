const {
    publishAd: publishAdRequest,
    firstNonEmpty,
    asArray,
    normalizeAdType
} = require("./client");

function log(step, message, data) {
    const prefix = `[megaescort:${step}]`;
    if (typeof data === "undefined") {
        console.log(prefix, message);
        return;
    }
    console.log(prefix, message, data);
}

function normalizeCategory(category, fallback = "escort") {
    const value = firstNonEmpty(category).toLowerCase();
    if (value.includes("massaggi")) return "massaggi";
    if (value.includes("trans")) return "trans";
    if (value.includes("uomouomo") || value.includes("uomo uomo") || value.includes("gay")) return "gay";
    if (value.includes("copp")) return "coppia";
    if (value.includes("donnauomo") || value.includes("donna uomo")) return "escort";
    return normalizeAdType(value || fallback);
}

function parseApiNote(note) {
    try {
        const parsed = JSON.parse(note || "{}");
        return parsed.megaescortApi || {};
    } catch {
        return {};
    }
}

function buildTags(adData = {}) {
    const apiNote = parseApiNote(adData.note);
    const tags = { ...(apiNote.tags || {}) };

    if (adData.age) tags["età"] = String(adData.age);
    if (adData.serviceNazionalita) tags["nazionalità"] = String(adData.serviceNazionalita);
    if (adData.serviceSNaturale) tags["seno"] = "naturale";
    if (adData.serviceSRifatto) tags["seno"] = "rifatto";
    if (adData.serviceCMarroni) tags["capelli"] = "marroni";
    if (adData.serviceCNeri) tags["capelli"] = "neri";
    if (adData.serviceCBiondi) tags["capelli"] = "biondi";
    if (adData.serviceCRossi) tags["capelli"] = "rossi";
    if (adData.serviceMagro) tags["corporatura"] = "magra";
    if (adData.serviceFormoso) tags["corporatura"] = "formosa";

    return tags;
}

function buildVetrina(adData = {}) {
    if (!adData.promo?.active && !adData.vetrina) {
        return null;
    }

    if (adData.vetrina) {
        return adData.vetrina;
    }

    const visibility = firstNonEmpty(adData.promo?.visibility, adData.typeAnnuncio);
    const duration = visibility.match(/x(\d+)$/)?.[1];
    const days = duration === "28"
        ? "4W"
        : duration === "7"
        ? "1W"
        : duration === "3"
            ? "3D"
            : "1D";

    return {
        days,
        ...(adData.data ? { start: new Date(adData.data).toISOString() } : {})
    };
}

function buildAdPayload(adData = {}) {
    const apiNote = parseApiNote(adData.note);
    const description = asArray(adData.description || adData.testo);
    const images = asArray(adData.images || adData.pics);
    const ad = {
        name: firstNonEmpty(adData.title, adData.titolo),
        type: normalizeCategory(adData.categorie || adData.categoria || adData.sono),
        phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
        geo: {
            city: firstNonEmpty(adData.city, adData.comune, adData.annunci_city),
            province: firstNonEmpty(adData.province, adData.location, adData.sel_provincia, adData.city, adData.comune),
            ...(firstNonEmpty(adData.zone, apiNote.zone) ? { zone: firstNonEmpty(adData.zone, apiNote.zone) } : {}),
            ...(asArray(apiNote.other_cities || adData.other_cities).length
                ? { other_cities: asArray(apiNote.other_cities || adData.other_cities) }
                : {})
        },
        description,
        status: Number.isFinite(Number(adData.status)) ? Number(adData.status) : 1
    };

    const tags = buildTags(adData);
    if (Object.keys(tags).length) ad.tags = tags;
    if (images.length) ad.images = images;

    const megaId = firstNonEmpty(adData.mega_id, adData.megaId, adData.remotePostID);
    if (megaId) ad.mega_id = megaId;

    const vetrina = buildVetrina(adData);
    return {
        ad,
        ...(vetrina ? { vetrina } : {})
    };
}

async function publishAd(pageOrAdData, maybeAdData, options = {}) {
    const adData = maybeAdData || pageOrAdData || {};
    const apiUser = firstNonEmpty(options.apiUser, adData.email, adData.username);
    const payload = buildAdPayload(adData);

    log("publish", "Publishing Megaescort ad through AdSpeed API", {
        apiUser,
        title: payload.ad.name,
        city: payload.ad.geo.city,
        images: payload.ad.images?.length || 0
    });

    const result = await publishAdRequest(payload, options.apiKey, apiUser, options);

    return {
        ...result,
        ok: result.ok !== false,
        payload: {
            ...payload,
            idpriv: result.megaId
        }
    };
}

module.exports = {
    log,
    buildAdPayload,
    buildTags,
    buildVetrina,
    publishAd
};
