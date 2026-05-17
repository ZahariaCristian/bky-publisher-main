const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const TwoCaptcha = require("@2captcha/captcha-solver")
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { PROXY } = require("../../const");
const {
    loadCookies,
    openPublishPage,
    uploadImagesFromFolder
} = require("./uploadImages");
puppeteer.use(StealthPlugin());

const { USER_AGENT, INSERT_API, COMUNE_LOOKUP_API, TOPLIST_API, PUBLISH_INCONTRII_URL, PUBLISH_MASSAGGI_URL, TOPLIST_GIORINI, TOPLIST_ORARIO, TOPLIST_TLPRODOTTO } = require('./const')

function log(step, message, data) {
    const prefix = `[publishAds:${step}]`;
    if (typeof data === "undefined") {
        console.log(prefix, message);
        return;
    }

    console.log(prefix, message, data);
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

function sanitizeMaxLength(value, maxLength) {
    const normalized = firstNonEmpty(value);
    if (!normalized) {
        return "";
    }

    return normalized.length <= maxLength ? normalized : "";
}

function normalizeTypeAnnuncio(typeAnnuncio) {
    return firstNonEmpty(typeAnnuncio).replace(/\s+/g, "");
}

function normalizeToplistPeriod(period) {
    return firstNonEmpty(period)
        .replace(/\s+/g, "")
        .replace(/^00:00-/, "24:00-")
        .replace(/-00:00$/, "-24:00");
}

function isFreeTypeAnnuncio(typeAnnuncio) {
    return normalizeTypeAnnuncio(typeAnnuncio).toLowerCase() === "free";
}

function resolveToplistProduct(typeAnnuncio, period) {
    const normalizedType = normalizeTypeAnnuncio(typeAnnuncio);
    const normalizedPeriod = normalizeToplistPeriod(period);
    const requestedKey = `${normalizedType}_${normalizedPeriod}`;

    if (TOPLIST_TLPRODOTTO[requestedKey]) {
        return {
            key: requestedKey,
            productValue: TOPLIST_TLPRODOTTO[requestedKey],
            typeAnnuncio: normalizedType,
            period: normalizedPeriod
        };
    }

    const matchedKey = Object.keys(TOPLIST_TLPRODOTTO).find(
        (candidate) => candidate.toLowerCase() === requestedKey.toLowerCase()
    );

    return {
        key: matchedKey || requestedKey,
        productValue: matchedKey ? TOPLIST_TLPRODOTTO[matchedKey] : "",
        typeAnnuncio: normalizedType,
        period: normalizedPeriod
    };
}

function parseToplistType(typeAnnuncio) {
    const match = normalizeTypeAnnuncio(typeAnnuncio).match(/^(\d+)x(\d+)$/);
    if (!match) {
        return null;
    }

    return {
        risalite: match[1],
        duration: match[2]
    };
}

function resolveToplistSelection(typeAnnuncio, period) {
    const normalizedPackage = resolveToplistProduct(typeAnnuncio, period);
    const toplistType = parseToplistType(normalizedPackage.typeAnnuncio);
    const hourCode = TOPLIST_ORARIO[normalizedPackage.period] || "";
    const dayCode = toplistType ? (TOPLIST_GIORINI[toplistType.duration] || "") : "";

    return {
        ...normalizedPackage,
        risalite: toplistType?.risalite || "",
        duration: toplistType?.duration || "",
        hourCode,
        dayCode
    };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function readPublishContext(page) {
    return page.evaluate(() => {
        const readValue = (selector) => {
            const node = document.querySelector(selector);
            if (!node) {
                return "";
            }

            return node.value || node.getAttribute("value") || "";
        };
        const checkedValues = (selector) => {
            return Array.from(document.querySelectorAll(selector))
                .filter((node) => node.checked)
                .map((node) => node.value || "on");
        };

        return {
            idpriv: readValue('input[name="idpriv"]'),
            idprivsign: readValue('input[name="idprivsign"]'),
            sezione: readValue('input[name="sezione"]'),
            cercoamoreincontri: checkedValues('input[name="cercoamoreincontri"]'),
            categoria: readValue('input[name="categoria"]'),
            trans: readValue('input[name="trans"]'),
            comune: readValue('input[name="comune"]'),
            sel_provincia: readValue('select[name="sel_provincia"]') || readValue('input[name="sel_provincia"]'),
            sel_comune: readValue('select[name="sel_comune"]') || readValue('input[name="sel_comune"]'),
            tiporeply: readValue('input[name="tiporeply"]') || readValue('select[name="tiporeply"]'),
            privacyValues: checkedValues('input[name="consenso_privacy"]'),
            consensoEsplicito: checkedValues('input[name="consensoesplicito"]'),
            consensoEsplicitoA: checkedValues('input[name="consensoesplicitoa"]'),
            consensoEsplicitoB: checkedValues('input[name="consensoesplicitob"]'),
            reCaptcha: readValue('input[name="g-recaptcha-response"]')
        };
    });
}

async function resolveLocationData(page, comuneQuery, publishContext = {}) {
    const normalizedQuery = firstNonEmpty(comuneQuery, publishContext.comune);

    if (!normalizedQuery) {
        return {
            comune: firstNonEmpty(publishContext.comune),
            sel_provincia: firstNonEmpty(publishContext.sel_provincia),
            sel_comune: firstNonEmpty(publishContext.sel_comune),
            suggestion: null
        };
    }

    log("location", "Resolving location from Bakeca API", normalizedQuery);

    const response = await page.evaluate(
        async ({ url, query }) => {
            const targetUrl = `${url}?query=${encodeURIComponent(query)}`;
            const response = await fetch(targetUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                    Accept: "application/json, text/plain, */*"
                }
            });

            const text = await response.text();
            let parsed = null;

            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = null;
            }

            return {
                status: response.status,
                ok: response.ok,
                text,
                parsed
            };
        },
        {
            url: COMUNE_LOOKUP_API,
            query: normalizedQuery
        }
    );

    log("location", "Location API response", response);

    const firstSuggestion = response.parsed?.suggestions?.[0] || null;

    return {
        comune: firstNonEmpty(firstSuggestion?.description, normalizedQuery, publishContext.comune),
        sel_provincia: firstNonEmpty(firstSuggestion?.provincia, publishContext.sel_provincia),
        sel_comune: firstNonEmpty(firstSuggestion?.comune, publishContext.sel_comune),
        suggestion: firstSuggestion
    };
}

async function buildPublishPayload(adData, publishContext, imageIds, locationData = {}) {
    const coverId = imageIds[0] || "";
    console.log(adData.cercoamoreincontri, "adData cercoamoreincontri");
    const payload = {
        titolo: adData.titolo,
        testo: adData.testo,
        cercoamoreincontri: adData.cercoamoreincontri || "",
        // trans: firstNonEmpty(adData.trans, publishContext.trans),
        copertina_img: firstNonEmpty(adData.copertina_img, coverId),
        allegato_img: imageIds,
        comune: locationData.comune || 'Roma',
        sel_provincia: locationData.sel_provincia || 'roma',
        sel_comune: locationData.sel_comune || '058091',
        cap: firstNonEmpty(adData.cap, ""),
        geo_indirizzo: firstNonEmpty(adData.geo_indirizzo, ""),
        localita: firstNonEmpty(adData.localita, ""),
        nome: firstNonEmpty(adData.nome, ""),
        cognome: firstNonEmpty(adData.cognome, ""),
        email: adData.email,
        contattotelefonico: adData.contattotelefonico,
        contattotelefonico2: firstNonEmpty(adData.contattotelefonico2, ""),
        tiporeply: firstNonEmpty(adData.tiporeply, publishContext.tiporeply, "4"),
        consenso_privacy: 'consenso_privacy',
        // consenso_privacy: adData.consenso_privacy || publishContext.privacyValues,
        // consensoesplicito: adData.consensoesplicito || publishContext.consensoEsplicito,
        // consensoesplicitoa: adData.consensoesplicitoa || publishContext.consensoEsplicitoA,
        // consensoesplicitob: adData.consensoesplicitob || publishContext.consensoEsplicitoB,
        idpriv: firstNonEmpty(adData.idpriv, publishContext.idpriv),
        idprivsign: firstNonEmpty(adData.idprivsign, publishContext.idprivsign),
        sezione: firstNonEmpty(adData.sezione, publishContext.sezione),
        categoria: firstNonEmpty(adData.categoria, publishContext.categoria, "incontri-amore"),
        civico: firstNonEmpty(adData.civico, ""),
        indirizzo: firstNonEmpty(adData.indirizzo, ""),
        lat: firstNonEmpty(adData.lat, ""),
        lng: firstNonEmpty(adData.lng, ""),
    };

    return payload;
}

function parseInsertResponse(rawText) {
    let parsed = null;

    try {
        parsed = JSON.parse(rawText);
    } catch {
        parsed = null;
    }

    return {
        rawText,
        parsed,
        ok: Boolean(parsed?.success)
    };
}

async function submitPublishRequest(page, payload, requestUrl = INSERT_API) {
    const allegatoFiles = (payload.allegato_files || [])
        .filter((filePath) => filePath && fs.existsSync(filePath))
        .map((filePath) => ({
            name: path.basename(filePath),
            type: /\.(jpe?g)$/i.test(filePath)
                ? "image/jpeg"
                : /\.png$/i.test(filePath)
                    ? "image/png"
                    : /\.gif$/i.test(filePath)
                        ? "image/gif"
                        : /\.webp$/i.test(filePath)
                            ? "image/webp"
                            : "application/octet-stream",
            base64: fs.readFileSync(filePath).toString("base64")
        }));

    log("submit", "Submitting ad payload", payload);
    log("submit", "Submitting files", allegatoFiles.map((file) => ({
        name: file.name,
        type: file.type
    })));

    const response = await page.evaluate(
        async ({ url, payloadData, files }) => {
            const form = new FormData();

            const appendValue = (key, value) => {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (item !== "" && item != null) {
                            form.append(`${key}[]`, item);
                        }
                    }
                    return;
                }

                if (value !== "" && value != null) {
                    form.append(key, value);
                }
            };

            Object.entries(payloadData).forEach(([key, value]) => {
                if (key === "allegato_files") {
                    return;
                }

                if (Array.isArray(value)) {
                    appendValue(key, value);
                    return;
                }

                form.append(key, value == null ? "" : value);
            });

            for (const file of files) {
                const binary = atob(file.base64);
                const bytes = new Uint8Array(binary.length);

                for (let i = 0; i < binary.length; i += 1) {
                    bytes[i] = binary.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: file.type });
                form.append("allegato", blob, file.name);
            }

            const response = await fetch(url, {
                method: "POST",
                body: form,
                credentials: "include",
                headers: {
                    Accept: "*/*"
                }
            });

            const text = await response.text();

            return {
                status: response.status,
                ok: response.ok,
                rawText: text
            };
        },
        {
            url: requestUrl,
            payloadData: payload,
            files: allegatoFiles
        }
    );

    const parsedResponse = {
        ...response,
        ...parseInsertResponse(response.rawText)
    };

    log("submit", "Insert API response", parsedResponse);
    return parsedResponse;
}

async function fillPublishForm(page, payload) {
    log("form", "Filling publish form in browser");

    await page.evaluate((payloadData) => {
        const asArray = (value) => {
            if (Array.isArray(value)) {
                return value.filter((item) => item !== "" && item != null);
            }

            if (value === "" || value == null) {
                return [];
            }

            return [value];
        };

        const setValue = (selector, value) => {
            const node = document.querySelector(selector);
            if (!node) {
                return;
            }

            node.value = value == null ? "" : value;
            node.dispatchEvent(new Event("input", { bubbles: true }));
            node.dispatchEvent(new Event("change", { bubbles: true }));
        };

        const setRadioValue = (name, value) => {
            if (value == null || value === "") {
                return;
            }

            const nodes = Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
            if (!nodes.length) {
                return;
            }

            nodes.forEach((node) => {
                node.checked = node.value === value;
                node.dispatchEvent(new Event("change", { bubbles: true }));
            });
        };

        const removeExistingHidden = (name) => {
            document
                .querySelectorAll(`input[type="hidden"][name="${name}"], input[type="hidden"][name="${name}[]"]`)
                .forEach((node) => node.remove());
        };

        const appendHidden = (name, value) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = value;
            document.body.appendChild(input);
        };

        const setCheckboxGroup = (name, values) => {
            const wanted = asArray(values);
            const nodes = Array.from(document.querySelectorAll(`input[name="${name}"]`));
            if (!nodes.length) {
                return;
            }

            nodes.forEach((node) => {
                const shouldCheck = wanted.includes(node.value) || (node.value === "" && wanted.includes("on"));
                node.checked = shouldCheck;
                node.dispatchEvent(new Event("change", { bubbles: true }));
            });
        };

        setValue('input[name="titolo"]', payloadData.titolo);
        setValue('textarea[name="testo"]', payloadData.testo);
        setValue('input[name="comune"]', payloadData.comune);
        setValue('input[name="geo_indirizzo"]', payloadData.geo_indirizzo);
        setValue('select[name="email"]', payloadData.email);
        setValue('input[name="contattotelefonico"]', payloadData.contattotelefonico);
        setValue('input[name="cap"]', payloadData.cap);
        setValue('input[name="civico"]', payloadData.civico);
        setValue('input[name="indirizzo"]', payloadData.indirizzo);
        setValue('input[name="lat"]', payloadData.lat);
        setValue('input[name="lng"]', payloadData.lng);
        setValue('input[name="idpriv"]', payloadData.idpriv);
        setValue('input[name="idprivsign"]', payloadData.idprivsign);
        setValue('input[name="sezione"]', payloadData.sezione);
        setValue('input[name="categoria"]', payloadData.categoria);
        setValue('input[name="copertina_img"]', payloadData.copertina_img);

        setValue('input[name="sel_provincia"]', payloadData.sel_provincia);
        setValue('input[name="sel_comune"]', payloadData.sel_comune);
        // setValue('input[name="g-recaptcha-response"]', payloadData['g-recaptcha-response']);

        if (Object.prototype.hasOwnProperty.call(payloadData, "localita")) {
            setValue('input[name="localita"]', payloadData.localita);
        }

        if (Object.prototype.hasOwnProperty.call(payloadData, "nome")) {
            setValue('input[name="nome"]', payloadData.nome);
        }

        if (Object.prototype.hasOwnProperty.call(payloadData, "cognome")) {
            setValue('input[name="cognome"]', payloadData.cognome);
        }

        if (Object.prototype.hasOwnProperty.call(payloadData, "contattotelefonico2")) {
            setValue('input[name="contattotelefonico2"]', payloadData.contattotelefonico2);
        }

        setRadioValue("cercoamoreincontri", payloadData.cercoamoreincontri);
        setRadioValue("tiporeply", payloadData.tiporeply);

        setCheckboxGroup("consenso_privacy", payloadData.consenso_privacy);
        setCheckboxGroup("consensoesplicito", payloadData.consensoesplicito);
        setCheckboxGroup("consensoesplicitoa", payloadData.consensoesplicitoa);
        setCheckboxGroup("consensoesplicitob", payloadData.consensoesplicitob);

        removeExistingHidden("allegato_img");
        asArray(payloadData.allegato_img).forEach((id) => appendHidden("allegato_img[]", id));

        if (payloadData.copertina_img) {
            appendHidden("copertina_img", payloadData.copertina_img);
        }
    }, payload);

    log("form", "Publish form filled");
}

async function collectToplistPageSnapshot(page) {
    return page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll("form"));
        const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
        return {
            pageUrl: window.location.href,
            pageTitle: document.title,
            hasConfirmButton: Boolean(document.querySelector("#conferma_pagamento")),
            hasOrderSummary: /RIEPILOGO ORDINE/i.test(bodyText),
            hasCancelOrderLink: Array.from(document.querySelectorAll("a")).some((node) => {
                const text = (node.textContent || "").trim();
                const href = node.getAttribute("href") || "";
                return /ANNULLA ORDINE/i.test(text) || href.includes("/annulla-ordine/");
            }),
            forms: forms.map((node) => ({
                action: node.action || node.getAttribute("action") || "",
                method: node.method || node.getAttribute("method") || "",
                fieldNames: Array.from(node.querySelectorAll("input, select, textarea"))
                    .map((field) => field.getAttribute("name") || field.getAttribute("id") || field.tagName)
                    .filter(Boolean)
            })),
            buttons: Array.from(document.querySelectorAll("button, a"))
                .slice(0, 20)
                .map((node) => ({
                    tag: node.tagName,
                    text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
                    href: node.getAttribute("href") || "",
                    type: node.getAttribute("type") || "",
                    id: node.getAttribute("id") || ""
                }))
                .filter((node) => node.text || node.href || node.id),
            bodyTextSnippet: bodyText.slice(0, 1000)
        };
    }).catch(async () => {
        let pageTitle = "";
        try {
            pageTitle = await page.title();
        } catch (error) {
            pageTitle = "";
        }

        return {
            pageUrl: page.url(),
            pageTitle,
            hasConfirmButton: false,
            hasOrderSummary: false,
            hasCancelOrderLink: false,
            forms: [],
            buttons: [],
            bodyTextSnippet: ""
        };
    });
}

async function submitToplistOrder(page, selection, fallbackUrl) {
    const confirmButton = await page.$("#conferma_pagamento");

    if (confirmButton) {
        const confirmationFormState = await page.evaluate((toplistSelection) => {
            const {
                productValue: resolvedProductValue
            } = toplistSelection;

            const form = document.querySelector("#conferma_pagamento")?.closest("form")
                || document.querySelector(".b-j-pagamento-toplist form")
                || document.querySelector("form");

            if (!form) {
                return {
                    action: window.location.href,
                    payload: {},
                    formEntries: []
                };
            }

            const getFieldValue = (name, fallback = "") => {
                const checked = form.querySelector(`[name="${name}"]:checked`);
                if (checked?.value) {
                    return String(checked.value);
                }

                const input = form.querySelector(`[name="${name}"]`);
                if (input?.value) {
                    return String(input.value);
                }

                return String(fallback);
            };

            const payload = {
                metodopagamento: getFieldValue("metodopagamento", "CR"),
                id_annuncio: getFieldValue("id_annuncio"),
                toplist_order_id: getFieldValue("toplist_order_id"),
                toplist_tlprodotto: getFieldValue("toplist_tlprodotto", resolvedProductValue)
            };

            return {
                action: window.location.href,
                payload,
                formEntries: Object.entries(payload)
            };
        }, selection);

        const previousUrl = page.url();
        const activationTransition = Promise.race([
            page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: 30000
            }).then(() => "navigation").catch(() => null),
            page.waitForFunction((initialUrl) => {
                const bodyText = (document.body?.innerText || "").toUpperCase();
                return window.location.href !== initialUrl
                    || !document.querySelector("#conferma_pagamento")
                    || !bodyText.includes("RIEPILOGO ORDINE");
            }, {
                timeout: 30000
            }, previousUrl).then(() => "state-change").catch(() => null)
        ]);

        try {
            await page.click("#conferma_pagamento");
        } catch (error) {
            await page.evaluate(() => {
                const button = document.querySelector("#conferma_pagamento");
                if (!button) {
                    throw new Error("Toplist activation button not found");
                }

                button.dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                }));
            });
        }

        const activationResult = await activationTransition;
        await delay(500);

        let pageSnapshot = await collectToplistPageSnapshot(page);
        let stillOnConfirmationPage = pageSnapshot.hasConfirmButton && pageSnapshot.hasOrderSummary;
        let activationSucceeded = Boolean(activationResult)
            && !stillOnConfirmationPage
            && !pageSnapshot.pageUrl.startsWith("chrome-error://")
            && !/HTTP ERROR/i.test(pageSnapshot.bodyTextSnippet || "");

        if (!activationSucceeded) {
            const apiResponse = await page.evaluate(async ({ defaultUrl, payload }) => {
                if (!payload || !payload.id_annuncio || !payload.toplist_order_id || !payload.toplist_tlprodotto) {
                    throw new Error("Toplist confirmation payload is incomplete");
                }

                const body = new URLSearchParams();
                Object.entries(payload).forEach(([name, value]) => {
                    body.set(name, String(value ?? ""));
                });

                const response = await fetch(defaultUrl, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "*/*",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: body.toString()
                });

                const rawText = await response.text();

                return {
                    ok: response.ok,
                    status: response.status,
                    responseUrl: response.url,
                    rawText,
                    contentType: response.headers.get("content-type") || ""
                };
            }, {
                defaultUrl: fallbackUrl,
                payload: confirmationFormState.payload
            });

            await delay(500);

            pageSnapshot = await collectToplistPageSnapshot(page);
            stillOnConfirmationPage = pageSnapshot.hasConfirmButton && pageSnapshot.hasOrderSummary;
            activationSucceeded = Boolean(apiResponse?.ok)
                && Number(apiResponse?.status) < 400
                && !/HTTP ERROR/i.test(apiResponse?.rawText || "");

            if (activationSucceeded) {
                return {
                    ok: true,
                    status: apiResponse.status,
                    action: fallbackUrl,
                    method: "XHR_POST",
                    formEntries: confirmationFormState.formEntries || [],
                    activationResult: "xhr",
                    responseUrl: apiResponse.responseUrl,
                    responseContentType: apiResponse.contentType,
                    ...pageSnapshot,
                    rawText: apiResponse.rawText
                };
            }

            return {
                ok: false,
                status: Number(apiResponse?.status) || 0,
                action: fallbackUrl || confirmationFormState.action || previousUrl,
                method: "XHR_POST",
                formEntries: confirmationFormState.formEntries || [],
                activationResult: activationResult || "timeout",
                error: apiResponse?.status ? `Toplist API returned HTTP ${apiResponse.status}` : "Toplist activation request failed",
                responseUrl: apiResponse?.responseUrl || "",
                responseContentType: apiResponse?.contentType || "",
                ...pageSnapshot,
                rawText: apiResponse?.rawText || ""
            };
        }

        return {
            ok: activationSucceeded,
            status: activationSucceeded ? 200 : 0,
            action: fallbackUrl || confirmationFormState.action || previousUrl,
            method: "CLICK",
            formEntries: confirmationFormState.formEntries || [],
            activationResult: activationResult || "timeout",
            error: activationSucceeded ? undefined : "Toplist activation did not leave confirmation page",
            ...pageSnapshot,
            rawText: ""
        };
    }

    return page.evaluate(
        async ({ toplistSelection, defaultUrl }) => {
            const {
                productValue: resolvedProductValue,
                risalite: resolvedRisalite,
                hourCode: resolvedHourCode,
                dayCode: resolvedDayCode
            } = toplistSelection;
            const forms = Array.from(document.querySelectorAll("form"));
            const form = forms.find((node) => {
                const action = node.action || node.getAttribute("action") || "";
                return node.querySelector('[name="toplist_order_id"]')
                    || action.includes("gestione-ordine-toplist")
                    || node.querySelector('[name="metodopagamento"]')
                    || (
                        node.querySelector('[name="id_annuncio"]')
                        && node.querySelector('[name="metodopagamento"]')
                    )
                    || (
                        node.querySelector('[name="toplist_tlprodotto"]')
                        && node.querySelector('[name="idpriv"]')
                    );
            });

            if (!form) {
                return {
                    ok: false,
                    status: 0,
                    action: defaultUrl,
                    error: "Toplist submit form not found",
                    pageUrl: window.location.href,
                    pageTitle: document.title,
                    forms: forms.map((node) => ({
                        action: node.action || node.getAttribute("action") || "",
                        method: node.method || node.getAttribute("method") || "",
                        fieldNames: Array.from(node.querySelectorAll("input, select, textarea"))
                            .map((field) => field.getAttribute("name") || field.getAttribute("id") || field.tagName)
                            .filter(Boolean)
                    })),
                    buttons: Array.from(document.querySelectorAll("button, a"))
                        .slice(0, 20)
                        .map((node) => ({
                            tag: node.tagName,
                            text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
                            href: node.getAttribute("href") || "",
                            type: node.getAttribute("type") || "",
                            onclick: node.getAttribute("@click") || node.getAttribute("x-on:click") || ""
                        }))
                        .filter((node) => node.text || node.href),
                    bodyTextSnippet: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 1000),
                    formEntries: [],
                    rawText: ""
                };
            }

            const formData = new FormData(form);
            formData.set("toplist_tlprodotto", String(resolvedProductValue));
            formData.set("toplist_risalite", String(resolvedRisalite));
            formData.set("toplist_orario", String(resolvedHourCode));
            formData.set("toplist_giorni", String(resolvedDayCode));
            formData.set("toplist_prodotto", String(resolvedRisalite));

            if (!formData.get("metodopagamento")) {
                formData.set("metodopagamento", "CR");
            }

            const formEntries = Array.from(formData.entries()).map(([key, value]) => [
                key,
                typeof value === "string" ? value : (value?.name || "[blob]")
            ]);

            const action = form.action || form.getAttribute("action") || defaultUrl;
            const method = (form.method || form.getAttribute("method") || "POST").toUpperCase();
            let requestUrl = action;
            const fetchOptions = {
                method,
                credentials: "include",
                headers: {
                    Accept: "*/*"
                }
            };

            if (method === "GET" || method === "HEAD") {
                const url = new URL(action, window.location.origin);
                for (const [key, value] of formData.entries()) {
                    if (typeof value === "string") {
                        url.searchParams.set(key, value);
                    }
                }
                requestUrl = url.toString();
            } else {
                fetchOptions.body = formData;
            }

            const response = await fetch(requestUrl, fetchOptions);

            const text = await response.text();

            return {
                ok: response.ok,
                status: response.status,
                action: requestUrl,
                method,
                formEntries,
                rawText: text
            };
        },
        {
            toplistSelection: selection,
            defaultUrl: fallbackUrl
        }
    );
}

async function ensureToplistOrderPage(page, { idpriv, risalite, selection }) {
    const hasOrderForm = async () => {
        return page.evaluate(() => {
            const forms = Array.from(document.querySelectorAll("form"));
            return forms.some((node) => {
                const action = node.action || node.getAttribute("action") || "";
                return Boolean(
                    node.querySelector('[name="toplist_order_id"]')
                    || action.includes("gestione-ordine-toplist")
                    || node.querySelector('[name="metodopagamento"]')
                    || (
                        node.querySelector('[name="id_annuncio"]')
                        && node.querySelector('[name="metodopagamento"]')
                    )
                    || (
                        node.querySelector('[name="toplist_tlprodotto"]')
                        && node.querySelector('[name="idpriv"]')
                    )
                );
            });
        }).catch(() => false);
    };

    const hasToplistSelectionForm = async () => {
        return page.evaluate(() => {
            return Boolean(
                document.querySelector('form[x-data="ToplistPanelComponent"]')
            );
        }).catch(() => false);
    };

    const hasPublishGate = async () => {
        return page.evaluate(() => {
            const textIncludes = (value) => (document.body?.innerText || "").toUpperCase().includes(value);
            const controls = Array.from(document.querySelectorAll("button, a, input[type='submit']"));
            const hasPublishControl = controls.some((node) => {
                const text = (node.textContent || node.getAttribute("value") || "").trim().toUpperCase();
                const href = (node.getAttribute("href") || "").toLowerCase();
                return text.includes("PUBBLICA") || href.includes("/pubblica/annuncio/idPriv/".toLowerCase());
            });
            const hasDisabledPromote = controls.some((node) => {
                const text = (node.textContent || node.getAttribute("value") || "").trim().toUpperCase();
                return text.includes("PROMUOVI") && (node.disabled || node.getAttribute("disabled") !== null);
            });

            return Boolean(
                hasPublishControl
                || hasDisabledPromote
                || textIncludes("STATO ANNUNCIO:")
                || textIncludes("SOSPESO")
            );
        }).catch(() => false);
    };

    const publishAdForToplist = async () => {
        const publishUrl = `https://www.bakeca.it/pubblica/annuncio/idPriv/${idpriv}`;
        await page.goto(publishUrl, {
            waitUntil: "networkidle2",
            timeout: 30000
        });
    };

    const waitForRelevantToplistUi = async (timeoutMs = 10000) => {
        await page.waitForFunction(() => {
            const forms = Array.from(document.querySelectorAll("form"));
            const hasOrder = forms.some((node) => {
                const action = node.action || node.getAttribute("action") || "";
                return Boolean(
                    node.querySelector('[name="toplist_order_id"]')
                    || action.includes("gestione-ordine-toplist")
                    || node.querySelector('[name="metodopagamento"]')
                    || (
                        node.querySelector('[name="id_annuncio"]')
                        && node.querySelector('[name="metodopagamento"]')
                    )
                    || (
                        node.querySelector('[name="toplist_tlprodotto"]')
                        && node.querySelector('[name="idpriv"]')
                    )
                );
            });

            return hasOrder || Boolean(document.querySelector('form[x-data="ToplistPanelComponent"]'));
        }, { timeout: timeoutMs }).catch(() => null);
    };

    const collectDiagnostics = async () => {
        let currentUrl = "";
        let currentTitle = "";
        let diagnostics = {
            forms: [],
            buttons: [],
            bodyTextSnippet: ""
        };

        try {
            currentUrl = page.url();
        } catch { }

        try {
            currentTitle = await page.title();
        } catch { }

        try {
            diagnostics = await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll("form")).map((node) => ({
                    action: node.action || node.getAttribute("action") || "",
                    method: node.method || node.getAttribute("method") || "",
                    fieldNames: Array.from(node.querySelectorAll("input, select, textarea"))
                        .map((field) => field.getAttribute("name") || field.getAttribute("id") || field.tagName)
                        .filter(Boolean)
                }));

                const buttons = Array.from(document.querySelectorAll("button, a"))
                    .slice(0, 20)
                    .map((node) => ({
                        tag: node.tagName,
                        text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
                        href: node.getAttribute("href") || "",
                        type: node.getAttribute("type") || "",
                        onclick: node.getAttribute("@click") || node.getAttribute("x-on:click") || ""
                    }))
                    .filter((node) => node.text || node.href);

                return {
                    forms,
                    buttons,
                    bodyTextSnippet: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 1000)
                };
            });
        } catch { }

        return {
            source: "unresolved",
            url: currentUrl,
            title: currentTitle,
            ...diagnostics
        };
    };

    if (await hasOrderForm()) {
        return { source: "current" };
    }

    const directToplistUrl = `https://www.bakeca.it/gestione/annuncio/idPriv/${idpriv}/opentoplist/${risalite}/fromrenew/true`;
    await page.goto(directToplistUrl, {
        waitUntil: "networkidle2",
        timeout: 30000
    });

    await waitForRelevantToplistUi();

    if (await hasOrderForm()) {
        return { source: "direct" };
    }

    if (selection && await hasToplistSelectionForm()) {
        await submitStaticToplistSelection(page, selection);
        await waitForRelevantToplistUi(5000);
        if (await hasOrderForm()) {
            return { source: "direct-resubmitted" };
        }
    }

    if (await hasPublishGate()) {
        await publishAdForToplist();
        await page.goto(directToplistUrl, {
            waitUntil: "networkidle2",
            timeout: 30000
        });
        await waitForRelevantToplistUi(10000);

        if (await hasOrderForm()) {
            return { source: "published-then-direct" };
        }

        if (selection && await hasToplistSelectionForm()) {
            await submitStaticToplistSelection(page, selection);
            await waitForRelevantToplistUi(5000);
            if (await hasOrderForm()) {
                return { source: "published-then-direct-resubmitted" };
            }
        }
    }

    return collectDiagnostics();
}

async function submitStaticToplistSelection(page, selection) {
    const {
        formSelector,
        idpriv,
        risalite,
        hourCode,
        dayCode,
        productValue
    } = selection;

    await page.waitForSelector(formSelector, { timeout: 30000 });

    await page.evaluate((payload) => {
        const {
            formSelector: targetFormSelector,
            idpriv: targetIdpriv,
            risalite: targetRisalite,
            hourCode: targetHourCode,
            dayCode: targetDayCode,
            productValue: targetProductValue
        } = payload;

        const form = document.querySelector(targetFormSelector);
        if (!form) {
            throw new Error(`Toplist form not found: ${targetFormSelector}`);
        }

        const ensureHiddenInput = (name, value) => {
            let input = form.querySelector(`input[name="${name}"]`);
            if (!input) {
                input = document.createElement("input");
                input.type = "hidden";
                input.name = name;
                form.appendChild(input);
            }

            input.value = String(value);
            input.setAttribute("value", String(value));
            return input;
        };

        const setRadioValue = (name, value) => {
            const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
            if (!input) {
                return false;
            }

            input.disabled = false;
            input.removeAttribute("disabled");
            input.checked = true;
            input.setAttribute("checked", "checked");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                composed: true
            }));
            return true;
        };

        setRadioValue("toplist_risalite", targetRisalite);
        setRadioValue("toplist_orario", targetHourCode);
        setRadioValue("toplist_giorni", targetDayCode);

        ensureHiddenInput("idpriv", targetIdpriv);
        ensureHiddenInput("toplist_prodotto", targetRisalite);
        ensureHiddenInput("toplist_risalite", targetRisalite);
        ensureHiddenInput("toplist_orario", targetHourCode);
        ensureHiddenInput("toplist_giorni", targetDayCode);
        ensureHiddenInput("toplist_tlprodotto", targetProductValue);
    }, selection);

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
        page.evaluate((targetFormSelector) => {
            const form = document.querySelector(targetFormSelector);
            if (!form) {
                throw new Error(`Toplist form not found: ${targetFormSelector}`);
            }

            form.submit();
        }, formSelector)
    ]);
}

async function publishAd(page, adData) {
    const publishContext = await readPublishContext(page);
    log("context", "Publish context from page", publishContext);

    const locationData = await resolveLocationData(page, adData.comune, publishContext);
    log("location", "Resolved location data", locationData);

    const uploadResults = await uploadImagesFromFolder(page, adData.images, adData.imageLimit || 3, publishContext.idpriv || "NEW");
    log("images", "Upload results", uploadResults);
    let imageIds = []
    const failedUploads = uploadResults.filter((item) => !item.success || !item.content?.idUnico);
    if (failedUploads.length > 0) {
        console.log(`Image upload failed for ${failedUploads.length} file(s).`);
    }
    // imageIds = uploadResults.map((item) => item.content.idUnico);
    imageIds = uploadResults
        .filter(item => item.success && item.content?.idUnico)
        .map(item => item.content.idUnico);

    const payload = await buildPublishPayload(adData, publishContext, imageIds, locationData);
    payload.allegato_img = imageIds;
    payload.allegato_files = uploadResults.map((item) => item.filePath).filter(Boolean);
    const normalizedPackage = resolveToplistSelection(adData.typeAnnuncio, adData.period);
    const freePublication = isFreeTypeAnnuncio(adData.typeAnnuncio);

    await fillPublishForm(page, payload);
    const submitResult = await submitPublishRequest(page, payload);
    let topListResponse = {}
    let publishOk = submitResult.ok;
    if (submitResult.ok) {//Publish ads
        console.log(adData.typeAnnuncio, 'typeAnnuncio in PublishAd')
        if (freePublication) {
            await page.goto(`https://www.bakeca.it/pubblica/annuncio/idPriv/${payload.idpriv}`, {
                waitUntil: "domcontentloaded",
                timeout: 10000
            });
        } else {
            console.log(payload.idpriv, 'idpriv');
            const url = `https://www.bakeca.it/inserimento/anteprima/idPriv/${payload.idpriv}`;
            const {
                key,
                productValue,
                risalite,
                hourCode,
                dayCode
            } = normalizedPackage;

            if (!payload.idpriv) {
                throw new Error('payload.idpriv is missing');
            }

            if (!productValue) {
                throw new Error(`TOPLIST_TLPRODOTTO value not found for key: ${key}`);
            }

            if (!risalite || !hourCode || !dayCode) {
                throw new Error(`Toplist selection codes not found for key: ${key}`);
            }

            const formSelector = 'form[x-data="ToplistPanelComponent"]';

            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await submitStaticToplistSelection(page, {
                formSelector,
                idpriv: payload.idpriv,
                risalite,
                hourCode,
                dayCode,
                productValue
            });

            const orderPageState = await ensureToplistOrderPage(page, {
                idpriv: payload.idpriv,
                risalite,
                selection: {
                    formSelector,
                    idpriv: payload.idpriv,
                    risalite,
                    hourCode,
                    dayCode,
                    productValue
                }
            });

            await delay(500);

            topListResponse = await submitToplistOrder(page, {
                productValue,
                risalite,
                hourCode,
                dayCode
            }, TOPLIST_API);
            topListResponse.orderPageState = orderPageState;
            publishOk = Boolean(topListResponse?.ok);

            const parsedResponse = {
                ...topListResponse,
            };

            log("submit", "TopList API response", parsedResponse);
            console.log("[publishAds:submit] TopList API response JSON", JSON.stringify(parsedResponse, null, 2));
        }
    }

    return {
        ok: publishOk,
        // uploadResults,
        // imageIds,
        payload,
        submitResult,
        topListResponse,
        normalizedPackage,
        freePublication
    };
}

module.exports = {
    log,
    buildPublishPayload,
    publishAd,
    readPublishContext,
    resolveLocationData,
    submitPublishRequest,
}
