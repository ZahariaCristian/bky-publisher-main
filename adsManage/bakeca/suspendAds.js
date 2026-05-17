const { SUSPEND_AD_URL, DELETE_AD_URL, PUBLISH_AD_URL } = require('./const');

function normalizeIdPriv(remoteId) {
    return String(remoteId || "").trim();
}

async function runBakecaAdAction(page, remoteId, baseUrl, actionType) {
    if (!page || typeof page.evaluate !== "function") {
        throw new Error("Bakeca page instance is required");
    }

    const idPriv = normalizeIdPriv(remoteId);
    if (!idPriv) {
        throw new Error("Bakeca idPriv is required");
    }

    const targetUrl = `${baseUrl}${encodeURIComponent(idPriv)}`;

    return page.evaluate(
        async ({ adIdPriv, actionUrl, targetAction }) => {
            const buildHtmlSnippet = (text) => {
                return String(text || "")
                    .replace(/<script[\s\S]*?<\/script>/gi, " ")
                    .replace(/<style[\s\S]*?<\/style>/gi, " ")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 1000);
            };

            const actionResponse = await fetch(actionUrl, {
                method: "GET",
                credentials: "include",
                redirect: "follow",
                headers: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                }
            });
            const actionText = await actionResponse.text();
            const bodyTextSnippet = buildHtmlSnippet(actionText);
            const responseUrl = (actionResponse.url || "").toLowerCase();
            const bodyTextUpper = bodyTextSnippet.toUpperCase();

            let ok = false;
            if (targetAction === "delete") {
                ok = Boolean(actionResponse.ok)
                    && !bodyTextUpper.includes("HTTP ERROR")
                    && !responseUrl.includes("/login")
                    && (
                        responseUrl.includes("/miabakeca/annuncio/elencoutente/")
                        || responseUrl.includes("/annuncio/elencoutente/")
                        || (
                            !responseUrl.includes(`/inserimento/elimina/idpriv/${adIdPriv.toLowerCase()}`)
                            && !responseUrl.includes(`/gestione/annuncio/idpriv/${adIdPriv.toLowerCase()}`)
                        )
                    );
            } else {
                ok = Boolean(actionResponse.ok)
                    && !bodyTextUpper.includes("HTTP ERROR")
                    && (
                        bodyTextUpper.includes("STATO ANNUNCIO")
                        || bodyTextUpper.includes("SOSPESO")
                        || responseUrl.includes(`/gestione/annuncio/idpriv/${adIdPriv.toLowerCase()}`)
                        || responseUrl.includes("/miabakeca/annuncio/elencoutente/")
                    );
            }

            return {
                ok,
                actionType: targetAction,
                idPriv: adIdPriv,
                status: actionResponse.status,
                actionUrl,
                pageUrl: actionResponse.url,
                bodyTextSnippet,
                error: ok ? undefined : `Bakeca ${targetAction} returned HTTP ${actionResponse.status}`
            };
        },
        {
            adIdPriv: idPriv,
            actionUrl: targetUrl,
            targetAction: actionType
        }
    );
}

async function republishAds(page, remoteId) {
    return runBakecaAdAction(page, remoteId, PUBLISH_AD_URL, "publish");
}

async function suspendAds(page, remoteId) {
    return runBakecaAdAction(page, remoteId, SUSPEND_AD_URL, "suspend");
}

async function deleteAds(page, remoteId) {
    return runBakecaAdAction(page, remoteId, DELETE_AD_URL, "delete");
}

module.exports = {
    republishAds,
    suspendAds,
    deleteAds,
    PUBLISH_AD_URL,
    SUSPEND_AD_URL,
    DELETE_AD_URL
};
