const fs = require("fs");
const path = require("path");
const TwoCaptcha = require("@2captcha/captcha-solver");

const PUBLISH_URL = "https://amasens.com/item/new";
const FORM_SELECTOR = "form#item-post";
const API_KEY_FILE = path.join(__dirname, "..", "..", "bots", "settings", "2captchaApiKey.txt");
const AMASENS_TURNSTILE_SITEKEY = "0x4AAAAAAAHzmvYWlhA4fgK9";

const getCaptchaApiKey = () => {
    if (process.env.TWOCAPTCHA_API_KEY) return process.env.TWOCAPTCHA_API_KEY.trim();
    if (fs.existsSync(API_KEY_FILE)) return fs.readFileSync(API_KEY_FILE, "utf8").trim();
    return "";
};

const CAPTCHA_API_KEY = getCaptchaApiKey();
const solver = CAPTCHA_API_KEY ? new TwoCaptcha.Solver(CAPTCHA_API_KEY) : null;

const CATEGORY_VALUES = {
    DONNAUOMO: "100",
    DONNA_UOMO: "100",
    ESCORT: "100",
    TRANS: "99",
    MASSAGGI: "101",
    MASSAGGI_BENESSERE: "101",
    MASSAGGIBENESSERE: "101",
    COPPIE: "98",
    SCAMBISTI: "98"
};

const CATEGORY_LABELS = {
    DONNAUOMO: ["donna uomo", "donna cerca uomo", "escort"],
    ESCORT: ["escort"],
    TRANS: ["trans", "transessuale"],
    MASSAGGI: ["massaggi", "massaggi benessere"],
    COPPIE: ["coppie", "coppia", "scambisti"]
};

const PROVINCE_REGIONS = {
    AGRIGENTO: "Sicilia",
    ALESSANDRIA: "Piemonte",
    ANCONA: "Marche",
    AOSTA: "Valle d'Aosta",
    AREZZO: "Toscana",
    ASCOLI_PICENO: "Marche",
    ASTI: "Piemonte",
    AVELLINO: "Campania",
    BARI: "Puglia",
    BARLETTA_ANDRIA_TRANI: "Puglia",
    BELLUNO: "Veneto",
    BENEVENTO: "Campania",
    BERGAMO: "Lombardia",
    BIELLA: "Piemonte",
    BOLOGNA: "Emilia-Romagna",
    BOLZANO: "Trentino-Alto Adige",
    BRESCIA: "Lombardia",
    BRINDISI: "Puglia",
    CAGLIARI: "Sardegna",
    CALTANISSETTA: "Sicilia",
    CAMPOBASSO: "Molise",
    CASERTA: "Campania",
    CATANIA: "Sicilia",
    CATANZARO: "Calabria",
    CHIETI: "Abruzzo",
    COMO: "Lombardia",
    COSENZA: "Calabria",
    CREMONA: "Lombardia",
    CROTONE: "Calabria",
    CUNEO: "Piemonte",
    ENNA: "Sicilia",
    FERMO: "Marche",
    FERRARA: "Emilia-Romagna",
    FIRENZE: "Toscana",
    FOGGIA: "Puglia",
    FORLI_CESENA: "Emilia-Romagna",
    FROSINONE: "Lazio",
    GENOVA: "Liguria",
    GORIZIA: "Friuli-Venezia Giulia",
    GROSSETO: "Toscana",
    IMPERIA: "Liguria",
    ISERNIA: "Molise",
    LA_SPEZIA: "Liguria",
    L_AQUILA: "Abruzzo",
    LATINA: "Lazio",
    LECCE: "Puglia",
    LECCO: "Lombardia",
    LIVORNO: "Toscana",
    LODI: "Lombardia",
    LUCCA: "Toscana",
    MACERATA: "Marche",
    MANTOVA: "Lombardia",
    MASSA_CARRARA: "Toscana",
    MATERA: "Basilicata",
    MESSINA: "Sicilia",
    MILANO: "Lombardia",
    MODENA: "Emilia-Romagna",
    MONZA_BRIANZA: "Lombardia",
    NAPOLI: "Campania",
    NOVARA: "Piemonte",
    NUORO: "Sardegna",
    ORISTANO: "Sardegna",
    PADOVA: "Veneto",
    PALERMO: "Sicilia",
    PARMA: "Emilia-Romagna",
    PAVIA: "Lombardia",
    PERUGIA: "Umbria",
    PESARO_URBINO: "Marche",
    PESCARA: "Abruzzo",
    PIACENZA: "Emilia-Romagna",
    PISA: "Toscana",
    PISTOIA: "Toscana",
    PORDENONE: "Friuli-Venezia Giulia",
    POTENZA: "Basilicata",
    PRATO: "Toscana",
    RAGUSA: "Sicilia",
    RAVENNA: "Emilia-Romagna",
    REGGIO_CALABRIA: "Calabria",
    REGGIO_EMILIA: "Emilia-Romagna",
    RIETI: "Lazio",
    RIMINI: "Emilia-Romagna",
    ROMA: "Lazio",
    ROVIGO: "Veneto",
    SALERNO: "Campania",
    SASSARI: "Sardegna",
    SAVONA: "Liguria",
    SIENA: "Toscana",
    SIRACUSA: "Sicilia",
    SONDRIO: "Lombardia",
    SUD_SARDEGNA: "Sardegna",
    TARANTO: "Puglia",
    TERAMO: "Abruzzo",
    TERNI: "Umbria",
    TORINO: "Piemonte",
    TRAPANI: "Sicilia",
    TRENTO: "Trentino-Alto Adige",
    TREVISO: "Veneto",
    TRIESTE: "Friuli-Venezia Giulia",
    UDINE: "Friuli-Venezia Giulia",
    VARESE: "Lombardia",
    VENEZIA: "Veneto",
    VERBANO_CUSIO_OSSOLA: "Piemonte",
    VERCELLI: "Piemonte",
    VERONA: "Veneto",
    VIBO_VALENTIA: "Calabria",
    VICENZA: "Veneto",
    VITERBO: "Lazio"
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(value) {
    return `${value || ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " ")
        .replace(/[^a-z0-9]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function provinceKey(value) {
    return normalizeKey(value).replace(/\s+/g, "_").toUpperCase();
}

function firstNonEmpty(...values) {
    return values.find((value) => `${value ?? ""}`.trim() !== "") || "";
}

function isEnabled(value) {
    return value === true || value === 1 || value === "1" || `${value || ""}`.toLowerCase() === "true";
}

function parseNote(note) {
    if (!note) return {};
    if (typeof note === "object") return note;
    try {
        return JSON.parse(note);
    } catch {
        return {};
    }
}

function mapCategory(value) {
    const raw = `${value || ""}`.trim();
    const key = normalizeKey(raw).replace(/[^a-z0-9]/g, "").toUpperCase();
    return CATEGORY_VALUES[raw.toUpperCase()] || CATEGORY_VALUES[key] || raw;
}

function categoryAliases(value) {
    const raw = `${value || ""}`.trim();
    const key = normalizeKey(raw).replace(/[^a-z0-9]/g, "").toUpperCase();
    const canonicalKey = CATEGORY_VALUES[key] ? key : Object.keys(CATEGORY_VALUES)
        .find((candidate) => CATEGORY_VALUES[candidate] === raw);
    return [raw, ...(CATEGORY_LABELS[canonicalKey] || [])].filter(Boolean);
}

function resolveImagePaths(images = [], picsAudit = []) {
    const auditPaths = [...picsAudit]
        .sort((left, right) => Number(right?.isAnteprima === true) - Number(left?.isAnteprima === true))
        .map((item) => item?.path)
        .filter(Boolean);
    const sources = auditPaths.length ? auditPaths : images;
    const resolved = [];
    const seen = new Set();

    for (const source of sources.filter(Boolean)) {
        const candidates = [];
        const raw = `${source}`;
        const normalized = raw.replace(/\\/g, "/");

        if (path.isAbsolute(raw)) candidates.push(raw);
        candidates.push(path.resolve(process.cwd(), raw));
        candidates.push(path.resolve(__dirname, "..", "..", raw));

        if (/^\/root\/bky\//i.test(normalized)) {
            candidates.push(path.join("E:\\root\\bky", normalized.replace(/^\/root\/bky\//i, "")));
        }

        const existing = candidates.find((candidate) => fs.existsSync(candidate));
        const filePath = existing || candidates[0];
        const key = filePath.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            resolved.push(filePath);
        }
    }

    return resolved;
}

function buildPublishData(adData = {}) {
    const note = parseNote(adData.note);
    const contactNote = note.amasens || note.incontriamoci || note.trovagnocca || note;
    const contactName = firstNonEmpty(adData.name, adData.contactName, adData.nickname);
    const city = firstNonEmpty(adData.city, adData.annunci_city, adData.comune);

    return {
        title: firstNonEmpty(adData.title, adData.titolo),
        description: firstNonEmpty(adData.description, adData.testo),
        category: mapCategory(firstNonEmpty(adData.categorie, adData.sono, adData.category)),
        region: firstNonEmpty(adData.region, adData.regione, PROVINCE_REGIONS[provinceKey(city)]),
        city,
        area: firstNonEmpty(adData.area, adData.location, adData.zone, adData.zona, city),
        address: firstNonEmpty(adData.address, adData.indirizzo, adData.location, adData.city, adData.annunci_city),
        phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
        contactName: `${contactName || ""}`.trim().slice(0, 35),
        age: firstNonEmpty(adData.age, adData.years),
        website: firstNonEmpty(adData.website, adData.url, adData.sito_web),
        whatsapp: isEnabled(adData.whatsapp) || isEnabled(adData.hasWhatapp),
        telegram: isEnabled(adData.telegram) || isEnabled(adData.hasTelegram) || Boolean(contactNote.telegram || contactNote.telegramNumber || contactNote.telegramUrl),
        livecam: isEnabled(adData.canLivecam) || isEnabled(adData.hasVideo),
        images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : []),
        picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : []
    };
}

async function setInput(page, selector, value) {
    if (`${value ?? ""}`.trim() === "") return false;
    const exists = await page.$(selector);
    if (!exists) return false;

    await page.evaluate((sel, inputValue) => {
        const node = document.querySelector(sel);
        if (!node) return;
        node.removeAttribute("readonly");
        node.removeAttribute("disabled");
        node.value = inputValue;
        node.setAttribute("value", inputValue);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector, `${value}`);

    return true;
}

async function setCheckbox(page, selector, checked = true) {
    const exists = await page.$(selector);
    if (!exists) return false;

    await page.evaluate((sel, shouldCheck) => {
        const node = document.querySelector(sel);
        if (!node) return;
        node.removeAttribute("disabled");
        node.checked = Boolean(shouldCheck);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector, checked);

    return true;
}

async function selectOption(page, selector, valueOrLabel) {
    if (`${valueOrLabel ?? ""}`.trim() === "") return false;
    const exists = await page.$(selector);
    if (!exists) return false;

    return page.evaluate((sel, target) => {
        const normalize = (input) => `${input || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const select = document.querySelector(sel);
        if (!select) return false;
        const normalizedTarget = normalize(target);
        const options = Array.from(select.options);
        const option = options.find((item) => item.value === target) ||
            options.find((item) => normalize(item.textContent) === normalizedTarget) ||
            options.find((item) => normalize(item.textContent).includes(normalizedTarget) || normalizedTarget.includes(normalize(item.textContent)));

        if (!option || !option.value) return false;
        select.removeAttribute("disabled");
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }, selector, `${valueOrLabel}`);
}

async function selectCategory(page, value) {
    const aliases = categoryAliases(value);
    const selected = await page.evaluate((selector, targetValue, targetAliases) => {
        const normalize = (input) => `${input || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const select = document.querySelector(selector);
        if (!select) return { ok: false, reason: "category select not found", options: [] };

        const options = Array.from(select.options);
        const normalizedAliases = targetAliases.map(normalize).filter(Boolean);
        const option = options.find((item) => item.value === targetValue) || options.find((item) => {
            const label = normalize(item.textContent);
            return normalizedAliases.some((alias) => label === alias || label.includes(alias) || alias.includes(label));
        });

        if (!option || !option.value) {
            return {
                ok: false,
                reason: `no category option matched ${targetValue}`,
                options: options.map((item) => ({ value: item.value, text: (item.textContent || "").trim() }))
            };
        }

        select.removeAttribute("disabled");
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: select.value === option.value, value: option.value, text: (option.textContent || "").trim() };
    }, "#catId, select[name='catId']", `${value || ""}`, aliases);

    if (!selected.ok) {
        throw new Error(`Amasens category selection failed: ${JSON.stringify(selected)}`);
    }

    console.log("[amasens:publish] Category selected", selected);
    return selected;
}

async function selectLocation(page, data) {
    const regionSelected = await selectOption(page, "#regionId, select[name='regionId']", data.region);
    if (!regionSelected) {
        throw new Error(`Amasens region selection failed: ${JSON.stringify({ region: data.region, city: data.city })}`);
    }

    await page.waitForFunction(() => {
        const select = document.querySelector("#cityId, select[name='cityId']");
        return select && !select.disabled && select.options.length > 1;
    }, { timeout: 15000 }).catch(() => null);

    const citySelected = await selectOption(page, "#cityId, select[name='cityId']", data.city);
    if (!citySelected) {
        const options = await page.evaluate(() => Array.from(document.querySelectorAll("#cityId option, select[name='cityId'] option"))
            .map((item) => ({ value: item.value, text: (item.textContent || "").trim() }))).catch(() => []);
        throw new Error(`Amasens province selection failed: ${JSON.stringify({ city: data.city, options })}`);
    }

    await page.waitForFunction(() => {
        const select = document.querySelector("#cityAreaId, select[name='cityAreaId']");
        return select && !select.disabled && select.options.length > 1;
    }, { timeout: 15000 }).catch(() => null);

    await selectOption(page, "#cityAreaId, select[name='cityAreaId']", data.area);
}

async function uploadImages(page, images = [], picsAudit = []) {
    const imagePaths = resolveImagePaths(images, picsAudit)
        .filter((filePath) => fs.existsSync(filePath))
        .slice(0, 20);

    if (!imagePaths.length) return 0;

    await setCheckbox(page, "#image_uploader_instance_auth, input[name='image_uploader_instance_auth']", true);
    await page.waitForSelector(".qq-upload-button input[type='file'], input[type='file'][name='images'], input[type='file']", {
        timeout: 15000
    }).catch(() => null);

    const input = await page.$(".qq-upload-button input[type='file'], input[type='file'][name='images'], input[type='file'][accept*='image'], input[type='file']");
    if (!input) {
        const diagnostics = await page.evaluate(() => ({
            url: window.location.href,
            fileInputs: Array.from(document.querySelectorAll("input[type='file']")).map((node) => ({
                name: node.name,
                accept: node.accept,
                visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
            })),
            bodyText: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500)
        })).catch(() => ({}));
        throw new Error(`Amasens image file input not found: ${JSON.stringify(diagnostics)}`);
    }

    await input.uploadFile(...imagePaths);

    await page.waitForFunction((expected) => {
        const successCount = document.querySelectorAll(".qq-upload-success, .qq-file-id, .qq-upload-list li").length;
        return successCount >= expected || expected === 0;
    }, { timeout: 60000 }, Math.min(imagePaths.length, 1)).catch(() => null);

    await delay(1500);
    return imagePaths.length;
}

async function solveTurnstileIfPresent(page) {
    const captcha = await page.evaluate(() => {
        const visible = (node) => {
            if (!node) return false;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const widgets = Array.from(document.querySelectorAll(
            ".turnstile_captcha_field, .cf-turnstile, [data-sitekey], iframe[src*='challenges.cloudflare.com']"
        ));
        const widget = widgets.find(visible) || widgets[0] || null;
        const responseInput = document.querySelector("[name='cf-turnstile-response']");
        if (!widget && !responseInput) return { present: false };

        const iframe = document.querySelector("iframe[src*='challenges.cloudflare.com']");
        const iframeSrc = iframe?.getAttribute("src") || "";
        const sitekeyFromFrame = (iframeSrc.match(/\/(0x[a-zA-Z0-9_-]{10,})\//) || [])[1] ||
            (iframeSrc.match(/[?&]sitekey=(0x[a-zA-Z0-9_-]+)/i) || [])[1] || "";
        const sitekey = widget?.getAttribute("data-sitekey") ||
            widget?.querySelector("[data-sitekey]")?.getAttribute("data-sitekey") ||
            sitekeyFromFrame;

        return {
            present: true,
            sitekey,
            iframeSrc,
            hasResponseInput: Boolean(responseInput),
            responseValue: responseInput?.value || "",
            url: window.location.href
        };
    });

    if (!captcha.present) return false;
    if (captcha.responseValue) {
        console.log("[amasens:publish] Turnstile already has a response token.");
        return true;
    }
    if (!solver) {
        throw new Error("2Captcha API key not configured for Amasens publish Turnstile.");
    }
    const sitekey = captcha.sitekey || AMASENS_TURNSTILE_SITEKEY;
    if (!sitekey) {
        throw new Error(`Amasens Turnstile sitekey not found: ${JSON.stringify(captcha)}`);
    }

    console.log("[amasens:publish] Solving Turnstile captcha", {
        sitekey,
        source: captcha.sitekey ? "dom" : "fallback",
        url: captcha.url
    });
    const solution = await solver.cloudflareTurnstile({
        pageurl: captcha.url || page.url() || PUBLISH_URL,
        sitekey
    });
    const token = solution?.data || solution?.request || solution;
    if (!token || typeof token !== "string") {
        throw new Error("2Captcha did not return a valid Amasens Turnstile token.");
    }

    await page.evaluate((captchaToken) => {
        const responseFields = Array.from(document.querySelectorAll("[name='cf-turnstile-response']"));
        if (!responseFields.length) {
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.name = "cf-turnstile-response";
            document.querySelector("form#item-post")?.appendChild(hidden);
            responseFields.push(hidden);
        }

        responseFields.forEach((field) => {
            field.value = captchaToken;
            field.setAttribute("value", captchaToken);
            field.textContent = captchaToken;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
        });

        window.__amasensTurnstileToken = captchaToken;
    }, token);

    console.log("[amasens:publish] Turnstile captcha solved.");
    return true;
}

async function openPublishPage(page) {
    await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    const hasForm = await page.$(FORM_SELECTOR);
    if (hasForm) return PUBLISH_URL;

    throw new Error(`Amasens publish form not found. Last URL: ${page.url()}`);
}

async function fillFirstStep(page, data) {
    await page.waitForSelector(FORM_SELECTOR, { visible: true, timeout: 30000 });

    await setInput(page, "#title, input[name='title']", data.title);
    await selectCategory(page, data.category);
    await setInput(page, "#description, textarea[name='description']", data.description);
    await uploadImages(page, data.images, data.picsAudit);
    await setInput(page, "#address, input[name='address']", data.address);
    await selectLocation(page, data);
    await setInput(page, "#telephone, input[name='telephone']", data.phone);
    await setInput(page, "#contactName, input[name='contactName']", data.contactName);
    await setInput(page, "#age, input[name='age']", data.age);
    await setInput(page, "#sito_web, input[name='sito_web']", data.website);
    await setCheckbox(page, "#canWhatsapp, input[name='canWhatsapp']", data.whatsapp);
    await setCheckbox(page, "#canTelegram, input[name='canTelegram']", data.telegram);
    await setCheckbox(page, "#canLivecam, input[name='canLivecam']", data.livecam);
    await setCheckbox(page, "#terms, input[name='terms']", true);
    await solveTurnstileIfPresent(page);
}

async function clickContinue(page) {
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate(() => {
            const form = document.querySelector("form#item-post");
            const submit = form?.querySelector("button[type='submit'], input[type='submit']") ||
                Array.from(document.querySelectorAll("button, input[type='submit'], a")).find((node) => /continua/i.test(node.textContent || node.value || ""));
            if (!submit) throw new Error("Amasens CONTINUA button not found.");
            submit.click();
        })
    ]);

    await delay(1500);

    const validation = await page.evaluate(() => {
        const form = document.querySelector("form#item-post");
        const invalidFields = Array.from(document.querySelectorAll(":invalid")).map((node) => node.name || node.id || node.tagName);
        const validationText = Array.from(document.querySelectorAll(".help-block, .invalid-feedback, .error, .has-error, .alert"))
            .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, 10);
        return {
            stillOnFirstStep: Boolean(form),
            invalidFields,
            validationText,
            url: window.location.href
        };
    });

    if (validation.stillOnFirstStep) {
        throw new Error(`Amasens first step validation failed: ${JSON.stringify(validation)}`);
    }
}

async function clickPublishFree(page) {
    const identifiers = await page.evaluate(() => ({
        itemId: document.querySelector("#itemId, input[name='itemId']")?.value || "",
        url: window.location.href
    })).catch(() => ({ itemId: "", url: page.url() }));

    const clicked = await page.evaluate(() => {
        const form = document.querySelector("#frmpublish");
        const button = form?.querySelector("button[name='submitFree'], button[type='submit'], input[type='submit']") ||
            Array.from(document.querySelectorAll("button, input[type='submit'], a")).find((node) => {
                const text = `${node.textContent || node.value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
                return /pubblica/.test(text) && /gratis/.test(text);
            });
        if (!button) return false;
        button.click();
        return true;
    });

    if (!clicked) {
        throw new Error("Amasens free publish button not found after CONTINUA.");
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    await delay(2000);
    return identifiers;
}

async function confirmPublished(page, expectedItemId = "") {
    const result = await page.evaluate((id) => {
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        const url = window.location.href;
        const success = /congratulazioni|annuncio[^.]{0,80}pubblicato|pubblicato con successo/i.test(bodyText) ||
            (!/non e ancora stato pubblicato|non è ancora stato pubblicato/i.test(bodyText) && !url.includes("/item/new"));
        const idFromUrl = (url.match(/\/(?:item|annuncio|escort|trans|massaggi|coppie)[^#?]*[#/=-](\d+)/i) || [])[1] || "";
        return {
            success,
            url,
            remoteId: id || idFromUrl,
            bodyText: bodyText.slice(0, 1000)
        };
    }, expectedItemId);

    if (!result.success) {
        throw new Error(`Amasens publish did not confirm success: ${JSON.stringify(result)}`);
    }

    return result;
}

async function publishAd(page, adData = {}) {
    const data = buildPublishData(adData);
    console.log("[amasens:publish] Publishing ad", {
        title: data.title,
        city: data.city,
        region: data.region,
        area: data.area,
        category: data.category,
        images: data.images.length
    });

    await openPublishPage(page);
    await fillFirstStep(page, data);
    await clickContinue(page);
    const identifiers = await clickPublishFree(page);
    const published = await confirmPublished(page, identifiers.itemId);

    return {
        ok: true,
        url: published.url,
        creditsConsumed: 0,
        payload: {
            idpriv: published.remoteId || identifiers.itemId,
            itemId: published.remoteId || identifiers.itemId
        }
    };
}

module.exports = {
    buildPublishData,
    publishAd
};
