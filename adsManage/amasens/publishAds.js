const fs = require("fs");
const path = require("path");
const TwoCaptcha = require("@2captcha/captcha-solver");

const PUBLISH_URL = "https://amasens.com/item/new";
const EDIT_URL_BASE = "https://amasens.com/item/edit";
const DELETE_URL_BASE = "https://amasens.com/item/delete";
const FORM_SELECTOR = "form#item-post";
const API_KEY_FILE = path.join(__dirname, "..", "..", "bots", "settings", "2captchaApiKey.txt");
const AMASENS_TURNSTILE_SITEKEY = "0x4AAAAAAAHzmvYWlhA4fgK9";
const SCREENSHOT_DIR = path.join("./screenshots", "amasens-publish");

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

function ensureScreenshotDir() {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    return SCREENSHOT_DIR;
}

async function captureScreenshot(page, label) {
    try {
        const dir = ensureScreenshotDir();
        const safeLabel = `${label || "step"}`
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase()
            .slice(0, 120) || "step";
        const filePath = path.join(dir, `${safeLabel}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`[amasens:screenshot] ${label}: ${filePath}`);
        return filePath;
    } catch (error) {
        console.warn(`[amasens:screenshot] Failed to capture ${label}: ${error.message}`);
        return "";
    }
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

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeTopListDays(value) {
    const days = `${value || "1"}`.match(/\d+/)?.[0] || "1";
    if (["1", "3", "7", "14", "30"].includes(days)) return days;
    return "1";
}

function normalizeTopListFascia(value) {
    const fascia = `${value || ""}`.trim();
    if (["08-12", "12-16", "16-20", "08-20", "20-08"].includes(fascia)) return fascia;

    const normalized = fascia.replace(/\s+/g, "");
    if (/^0?8:00-12:00$/i.test(normalized)) return "08-12";
    if (/^12:00-16:00$/i.test(normalized)) return "12-16";
    if (/^16:00-20:00$/i.test(normalized)) return "16-20";
    if (/^0?8:00-20:00$/i.test(normalized)) return "08-20";
    if (/^20:00-0?8:00$/i.test(normalized)) return "20-08";

    return "08-12";
}

function normalizeTopListRisalite(fascia, value) {
    if (["08-20", "20-08"].includes(`${fascia || ""}`)) return "3";
    const risalite = `${value || "1"}`.match(/\d+/)?.[0] || "1";
    if (["1", "2", "3"].includes(risalite)) return risalite;
    return "1";
}

function buildPromoData(adData = {}) {
    const type = `${adData.typeAnnuncio || adData.promo?.visibility || "Free"}`.trim();
    const normalizedType = type.toLowerCase();
    const period = parseJson(adData.period, {});
    const product = `${period.product || adData.promo?.product || normalizedType}`.toLowerCase();
    const isTopList = normalizedType === "toplist" || product === "toplist" || (normalizedType !== "free" && normalizedType !== "");
    const fascia = normalizeTopListFascia(period.fascia || adData.promo?.fascia || adData.promo?.schedule);

    return {
        type: isTopList ? "TopList" : "Free",
        product: isTopList ? "toplist" : "free",
        giorni: normalizeTopListDays(period.giorni || period.days || adData.promo?.giorni || adData.promo?.days),
        fascia,
        risalite: normalizeTopListRisalite(fascia, period.risalite || adData.promo?.risalite)
    };
}

function normalizeRemoteId(remoteId = "") {
    return `${remoteId || ""}`
        .trim()
        .replace(/^https?:\/\/(?:www\.)?amasens\.com\/item\/(?:edit|premium)\//i, "")
        .replace(/^\/?item\/(?:edit|premium)\//i, "")
        .replace(/^\/+|\/+$/g, "");
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
        picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
        promo: buildPromoData(adData)
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

async function extractAmasensPublishState(page, expected = {}) {
    return page.evaluate((expectedState) => {
        const abs = (value) => {
            try {
                return value ? new URL(value, window.location.href).href : "";
            } catch {
                return "";
            }
        };
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const normalize = (value) => clean(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const remoteFromUrl = (url) => (abs(url).match(/\/item\/(?:edit|premium|delete)\/(\d+\/[a-zA-Z0-9_-]+)/i) || [])[1] || "";
        const publicFromUrl = (url) => /amasens\.com\/(?:escort|trans|massaggi|coppie)\//i.test(abs(url)) ? abs(url) : "";
        const currentRemoteId = remoteFromUrl(window.location.href);
        const currentListingId = currentRemoteId.split("/")[0] || "";
        const expectedItemId = clean(expectedState.itemId || expectedState.listingId);
        const expectedTitle = normalize(expectedState.title);
        const itemId = currentListingId || document.querySelector("#itemId, input[name='itemId']")?.value || expectedItemId || "";
        const cart = document.querySelector("#cart, input[name='cart']")?.value || "";

        const itemCards = Array.from(document.querySelectorAll("#items [id^='item-'], .item[id^='item-']"));
        const targetCard = (itemId ? itemCards.find((card) => card.id === `item-${itemId}`) : null) ||
            (expectedTitle ? itemCards.find((card) => {
                const title = normalize(card.querySelector(".item-title, a[title]")?.textContent || card.querySelector(".item-title, a[title]")?.getAttribute("title"));
                return title && (title === expectedTitle || title.includes(expectedTitle) || expectedTitle.includes(title));
            }) : null) ||
            null;

        if (targetCard) {
            const links = Array.from(targetCard.querySelectorAll("a[href]")).map((node) => abs(node.getAttribute("href"))).filter(Boolean);
            const editUrl = links.find((url) => /\/item\/edit\/\d+\/[a-zA-Z0-9_-]+/i.test(url)) || "";
            const deleteUrl = links.find((url) => /\/item\/delete\/\d+\/[a-zA-Z0-9_-]+/i.test(url)) || "";
            const promoteUrl = links.find((url) => /\/item\/promote\/\d+/i.test(url)) || "";
            const publicUrl = links.find(publicFromUrl) || "";
            const remoteId = currentRemoteId || remoteFromUrl(editUrl) || remoteFromUrl(deleteUrl);
            const listingId = remoteId.split("/")[0] || (targetCard.id.match(/item-(\d+)/) || [])[1] || itemId || "";

            return {
                itemId: itemId || listingId,
                cart,
                remoteId,
                listingId,
                publicUrl,
                managementUrl: editUrl || (remoteId ? `https://amasens.com/item/edit/${remoteId}` : ""),
                deleteUrl,
                promoteUrl,
                currentUrl: window.location.href
            };
        }

        const urls = [
            window.location.href,
            ...Array.from(document.querySelectorAll("a[href], form[action]")).map((node) => node.getAttribute("href") || node.getAttribute("action") || "")
        ].map(abs).filter(Boolean);
        const remoteId = currentRemoteId || urls.map(remoteFromUrl).find(Boolean) || "";
        const publicUrl = urls.find(publicFromUrl) || "";
        const listingId = remoteId.split("/")[0] || itemId || "";

        return {
            itemId,
            cart,
            remoteId,
            listingId,
            publicUrl,
            managementUrl: remoteId ? `https://amasens.com/item/edit/${remoteId}` : "",
            deleteUrl: remoteId ? `https://amasens.com/item/delete/${remoteId}` : "",
            promoteUrl: listingId ? `https://amasens.com/item/promote/${listingId}` : "",
            currentUrl: window.location.href
        };
    }, {
        itemId: expected.itemId || "",
        listingId: expected.listingId || "",
        title: expected.title || ""
    }).catch(() => ({
        itemId: "",
        cart: "",
        remoteId: "",
        listingId: "",
        publicUrl: "",
        managementUrl: "",
        deleteUrl: "",
        promoteUrl: "",
        currentUrl: page.url()
    }));
}

function mergePublishState(...states) {
    return states.reduce((merged, state = {}) => ({
        itemId: state.itemId || merged.itemId || "",
        cart: state.cart || merged.cart || "",
        remoteId: state.remoteId || merged.remoteId || "",
        listingId: state.listingId || merged.listingId || "",
        publicUrl: state.publicUrl || merged.publicUrl || "",
        managementUrl: state.managementUrl || merged.managementUrl || "",
        deleteUrl: state.deleteUrl || merged.deleteUrl || "",
        promoteUrl: state.promoteUrl || merged.promoteUrl || "",
        currentUrl: state.currentUrl || merged.currentUrl || ""
    }), {});
}

async function extractAmasensTopListPublicState(page, expected = {}) {
    return page.evaluate((expectedState) => {
        const abs = (value) => {
            try {
                return value ? new URL(value, window.location.href).href : "";
            } catch {
                return "";
            }
        };
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const normalize = (value) => clean(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const publicFromUrl = (url) => /amasens\.com\/(?:escort|trans|massaggi|coppie)\//i.test(abs(url)) ? abs(url) : "";
        const currentUrl = window.location.href;
        const hashListingId = (currentUrl.match(/#top-list-(\d+)/i) || [])[1] || "";
        const listingId = clean(expectedState.listingId || expectedState.itemId || hashListingId);
        const expectedTitle = normalize(expectedState.title);
        const cards = Array.from(document.querySelectorAll("#items [id^='item-'], .item[id^='item-']"));
        const targetCard = (listingId ? cards.find((card) => card.id === `item-${listingId}`) : null) ||
            (expectedTitle ? cards.find((card) => {
                const titleNode = card.querySelector(".item-title, a[title]");
                const title = normalize(titleNode?.textContent || titleNode?.getAttribute("title"));
                return title && (title === expectedTitle || title.includes(expectedTitle) || expectedTitle.includes(title));
            }) : null);

        if (!targetCard) {
            return {
                listingId,
                publicUrl: "",
                finalListUrl: currentUrl,
                found: false
            };
        }

        const titleUrl = publicFromUrl(targetCard.querySelector("a.item-title[href], .item-title[href]")?.getAttribute("href") || "");
        const coverOnclick = targetCard.querySelector(".item-cover-bg[onclick], .item-cover button[onclick], button[onclick]")?.getAttribute("onclick") || "";
        const coverUrl = publicFromUrl((coverOnclick.match(/window\.open\(['"]([^'"]+)/i) || [])[1] || "");
        const anyLinkUrl = Array.from(targetCard.querySelectorAll("a[href]"))
            .map((node) => publicFromUrl(node.getAttribute("href") || ""))
            .find(Boolean) || "";
        const publicUrl = titleUrl || coverUrl || anyLinkUrl;
        const cardListingId = (targetCard.id.match(/item-(\d+)/) || [])[1] || listingId;

        return {
            itemId: cardListingId,
            listingId: cardListingId,
            publicUrl,
            finalListUrl: currentUrl,
            found: Boolean(publicUrl)
        };
    }, {
        itemId: expected.itemId || "",
        listingId: expected.listingId || "",
        title: expected.title || ""
    }).catch(() => ({
        itemId: expected.itemId || "",
        listingId: expected.listingId || "",
        publicUrl: "",
        finalListUrl: page.url(),
        found: false
    }));
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
    if (hasForm) {
        await captureScreenshot(page, "01-open-publish-page");
        return PUBLISH_URL;
    }

    await captureScreenshot(page, "error-publish-form-not-found");
    throw new Error(`Amasens publish form not found. Last URL: ${page.url()}`);
}

async function openEditPage(page, remoteId) {
    const normalizedRemoteId = normalizeRemoteId(remoteId);
    if (!normalizedRemoteId || !/^\d+\/[a-zA-Z0-9_-]+$/.test(normalizedRemoteId)) {
        throw new Error(`Amasens edit requires full remotePostID like 882802/YZtNPDEQ. Current value: ${remoteId || ""}`);
    }

    const editUrl = `${EDIT_URL_BASE}/${normalizedRemoteId}`;
    await page.goto(editUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    const hasForm = await page.$(FORM_SELECTOR);
    if (hasForm) {
        await captureScreenshot(page, "update-01-edit-page");
        return editUrl;
    }

    await captureScreenshot(page, "error-edit-form-not-found");
    throw new Error(`Amasens edit form not found. Last URL: ${page.url()}`);
}

async function deleteAd(page, remoteId) {
    const normalizedRemoteId = normalizeRemoteId(remoteId);
    if (!normalizedRemoteId || !/^\d+\/[a-zA-Z0-9_-]+$/.test(normalizedRemoteId)) {
        throw new Error(`Amasens delete requires full remotePostID like 882802/YZtNPDEQ. Current value: ${remoteId || ""}`);
    }

    const deleteUrl = `${DELETE_URL_BASE}/${normalizedRemoteId}`;
    try {
        await page.goto(deleteUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
        await delay(1000);
        await captureScreenshot(page, "delete-01-open-delete-page");

        const clickedConfirmation = await page.evaluate(() => {
            const visible = (node) => {
                if (!node) return false;
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            };
            const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], a"))
                .filter(visible);
            const button = candidates.find((node) => {
                const text = `${node.textContent || node.value || ""}`.replace(/\s+/g, " ").trim();
                const href = `${node.getAttribute("href") || ""}`;
                return /elimina|cancella|rimuovi|conferma|delete|remove|yes|si\b/i.test(text) ||
                    /\/item\/delete\//i.test(href);
            });
            if (!button) return false;
            button.click();
            return true;
        }).catch(() => false);

        if (clickedConfirmation) {
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
            await delay(1500);
            await captureScreenshot(page, "delete-02-after-confirm");
        }

        const result = await page.evaluate(() => {
            const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
            const bodyText = clean(document.body?.innerText || "");
            const url = window.location.href;
            const successText = /(eliminat|cancellat|rimosso|rimosso|annuncio[^.]{0,80}eliminato|delete|deleted|success|successo)/i.test(bodyText);
            const errorText = /(errore|error|non autorizzato|unauthorized|login|accedi|permesso|permission)/i.test(bodyText);
            const redirectedToLogin = /\/user\/login/i.test(url) || /\baccedi\b/i.test(bodyText);
            return {
                url,
                bodyText: bodyText.slice(0, 1000),
                successText,
                errorText,
                redirectedToLogin
            };
        });

        const ok = Boolean(result.successText || (!result.redirectedToLogin && !result.errorText));
        if (!ok) {
            await captureScreenshot(page, "error-delete-failed");
            throw new Error(`Amasens delete failed: ${JSON.stringify(result)}`);
        }

        return {
            ok: true,
            id: normalizedRemoteId,
            url: result.url,
            action: "delete",
            diagnostics: result
        };
    } catch (error) {
        await captureScreenshot(page, `error-delete-${error.message || "failed"}`);
        throw error;
    }
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
    await captureScreenshot(page, "02-first-step-filled");
}

async function clickUpdateSubmit(page) {
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate(() => {
            const form = document.querySelector("form#item-post");
            const submit = form?.querySelector("button[type='submit'], input[type='submit']") ||
                Array.from(document.querySelectorAll("button, input[type='submit'], a")).find((node) => {
                    const text = `${node.textContent || node.value || ""}`.replace(/\s+/g, " ").trim();
                    return /continua|salva|modifica|aggiorna/i.test(text);
                });
            if (!submit) throw new Error("Amasens update submit button not found.");
            submit.click();
        })
    ]);

    await delay(1800);
    await captureScreenshot(page, "update-03-after-submit");

    const validation = await page.evaluate(() => {
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        const form = document.querySelector("form#item-post");
        const invalidFields = Array.from(document.querySelectorAll(":invalid")).map((node) => node.name || node.id || node.tagName);
        const validationText = Array.from(document.querySelectorAll(".help-block, .invalid-feedback, .error, .has-error, .alert"))
            .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, 10);
        const successVisible = /annuncio[^.]{0,80}(modificat|aggiornat|salvat)|modifiche[^.]{0,80}salvate|congratulazioni/i.test(bodyText);
        return {
            stillOnEditForm: Boolean(form),
            successVisible,
            invalidFields,
            validationText,
            url: window.location.href,
            bodyText: bodyText.slice(0, 1000)
        };
    });

    if (validation.stillOnEditForm && !validation.successVisible) {
        await captureScreenshot(page, "error-update-validation");
        throw new Error(`Amasens update validation failed: ${JSON.stringify(validation)}`);
    }

    return validation;
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
    await captureScreenshot(page, "03-after-continue");

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
        await captureScreenshot(page, "error-first-step-validation");
        throw new Error(`Amasens first step validation failed: ${JSON.stringify(validation)}`);
    }
}

async function clickPublishFree(page, data = {}) {
    const identifiers = await extractAmasensPublishState(page, { title: data.title });

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
        await captureScreenshot(page, "error-free-publish-button-not-found");
        throw new Error("Amasens free publish button not found after CONTINUA.");
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    await delay(2000);
    await captureScreenshot(page, "04-after-publish-click");
    return mergePublishState(identifiers, await extractAmasensPublishState(page, {
        itemId: identifiers.itemId,
        listingId: identifiers.listingId,
        title: data.title
    }));
}

async function selectPromoOption(page, selector, value, label) {
    const selected = await selectOption(page, selector, value);
    if (!selected) {
        const options = await page.evaluate((sel) => Array.from(document.querySelectorAll(`${sel} option`))
            .map((item) => ({ value: item.value, text: (item.textContent || "").replace(/\s+/g, " ").trim() })), selector).catch(() => []);
        throw new Error(`Amasens ${label} selection failed: ${JSON.stringify({ value, options })}`);
    }
}

async function clickPayWithCredits(page, expected = {}) {
    const hasCreditsPayment = await page.$("#frmPublishWithCredits, #submitWithCredits, #publish-with-credits")
        .then(Boolean)
        .catch(() => false);
    if (!hasCreditsPayment) {
        return {
            clicked: false,
            credits: 0,
            state: await extractAmasensPublishState(page, expected)
        };
    }

    await captureScreenshot(page, "06-payment-page");

    const paymentState = await page.evaluate(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const creditsText = clean(document.querySelector("#publish-with-credits strong")?.textContent || "");
        const credits = Number((creditsText.match(/\d+(?:[.,]\d+)?/) || [])[0]?.replace(",", ".") || 0);
        const totalText = clean(document.querySelector("#total-wrapper #total-price, #total-price")?.textContent || "");
        const errors = Array.from(document.querySelectorAll(".alert-danger, .payment-errors, .error"))
            .map((node) => clean(node.textContent))
            .filter(Boolean);
        return {
            credits,
            totalText,
            errors,
            url: window.location.href,
            hasButton: Boolean(document.querySelector("#submitWithCredits, #frmPublishWithCredits button[type='submit']"))
        };
    }).catch(() => ({ credits: 0, totalText: "", errors: [], url: page.url(), hasButton: false }));

    if (!paymentState.hasButton || paymentState.errors.length) {
        await captureScreenshot(page, "error-credits-payment-not-available");
        throw new Error(`Amasens credits payment is not available: ${JSON.stringify(paymentState)}`);
    }

    const clicked = await page.evaluate(() => {
        const button = document.querySelector("#submitWithCredits, #frmPublishWithCredits button[type='submit']");
        if (!button) return false;
        button.click();
        return true;
    });

    if (!clicked) {
        await captureScreenshot(page, "error-credits-payment-button-not-found");
        throw new Error("Amasens credits payment button not found.");
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await page.waitForFunction((expectedId) => {
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        const hasExpectedTopList = expectedId && (
            window.location.hash === `#top-list-${expectedId}` ||
            Boolean(document.querySelector(`#item-${expectedId}`))
        );
        if (hasExpectedTopList) return true;
        return /le mie inserzioni|annunci|congratulazioni|toplist|pubblicato|acquistato|saldo crediti/i.test(bodyText) ||
            /\/user\/items/i.test(window.location.href);
    }, { timeout: 45000 }, expected.listingId || expected.itemId || "").catch(() => null);
    await delay(2500);
    await captureScreenshot(page, "07-after-credits-payment");
    const state = await extractAmasensPublishState(page, expected);
    const topListPublicState = await extractAmasensTopListPublicState(page, {
        itemId: state.itemId || expected.itemId,
        listingId: state.listingId || expected.listingId,
        title: expected.title
    });

    return {
        clicked: true,
        credits: paymentState.credits,
        state: mergePublishState(state, topListPublicState, {
            currentUrl: topListPublicState.finalListUrl || state.currentUrl
        })
    };
}

async function clickPublishTopList(page, promo, data = {}) {
    const beforeState = await extractAmasensPublishState(page, { title: data.title });
    await page.waitForSelector("#itemPremiumForm, #toplist-giorni", { visible: true, timeout: 30000 });

    await selectPromoOption(page, "#toplist-giorni, select[name='toplist-giorni']", promo.giorni, "TopList giorni");
    await selectPromoOption(page, "#toplist-fascia, select[name='toplist-fascia']", promo.fascia, "TopList fascia");
    await selectPromoOption(page, "#toplist-risalite, select[name='toplist-risalite']", promo.risalite, "TopList risalite");

    await page.waitForFunction(() => {
        const button = document.querySelector("#submitPremiumBtn, button[name='submitPremium']");
        return button && !button.disabled && !button.classList.contains("disabled");
    }, { timeout: 30000 }).catch(() => null);

    await captureScreenshot(page, "04-toplist-settings-selected");

    const clicked = await page.evaluate(() => {
        const button = document.querySelector("#submitPremiumBtn, button[name='submitPremium']");
        if (!button || button.disabled) return false;
        button.click();
        return true;
    });

    if (!clicked) {
        const diagnostics = await page.evaluate(() => {
            const button = document.querySelector("#submitPremiumBtn, button[name='submitPremium']");
            return {
                buttonFound: Boolean(button),
                disabled: Boolean(button?.disabled),
                className: button?.className || "",
                buttonText: (button?.textContent || "").replace(/\s+/g, " ").trim(),
                totalPrice: (document.querySelector("#total-price")?.textContent || "").replace(/\s+/g, " ").trim(),
                url: window.location.href
            };
        }).catch(() => ({}));
        await captureScreenshot(page, "error-toplist-publish-button-not-enabled");
        throw new Error(`Amasens TopList publish button not enabled: ${JSON.stringify(diagnostics)}`);
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    await page.waitForFunction(() => {
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        return /congratulazioni|toplist|pubblicato|acquistato|saldo crediti/i.test(bodyText) || !window.location.href.includes("/item/premium/");
    }, { timeout: 30000 }).catch(() => null);
    await delay(2500);
    await captureScreenshot(page, "05-after-toplist-publish-click");
    const expected = {
        itemId: beforeState.itemId,
        listingId: beforeState.listingId,
        title: data.title
    };
    const creditsPayment = await clickPayWithCredits(page, expected);

    return {
        ...mergePublishState(beforeState, creditsPayment.state, await extractAmasensPublishState(page, expected)),
        creditsConsumed: creditsPayment.credits || 0,
        paidWithCredits: creditsPayment.clicked
    };
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
        await captureScreenshot(page, "error-publish-not-confirmed");
        throw new Error(`Amasens publish did not confirm success: ${JSON.stringify(result)}`);
    }

    await captureScreenshot(page, "05-confirmed");
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
        images: data.images.length,
        promo: data.promo
    });

    try {
        await openPublishPage(page);
        await fillFirstStep(page, data);
        await clickContinue(page);
        const identifiers = data.promo.type === "TopList"
            ? await clickPublishTopList(page, data.promo, data)
            : await clickPublishFree(page, data);
        const expectedId = identifiers.remoteId || identifiers.itemId || identifiers.listingId;
        const published = await confirmPublished(page, expectedId);
        const finalState = mergePublishState({ remoteId: published.remoteId }, identifiers, await extractAmasensPublishState(page, {
            itemId: identifiers.itemId,
            listingId: identifiers.listingId,
            title: data.title
        }), {
            publicUrl: /\/(?:escort|trans|massaggi|coppie)\//i.test(published.url || "") ? published.url : "",
            currentUrl: published.url
        });
        const remoteId = finalState.remoteId || finalState.itemId || finalState.listingId;
        const publishedUrl = published.url || finalState.currentUrl || "";
        const resultUrl = finalState.publicUrl ||
            (/\/item\/(?:new|premium|edit)\b/i.test(publishedUrl) ? "" : publishedUrl);

        return {
            ok: true,
            url: resultUrl,
            creditsConsumed: data.promo.type === "TopList" ? (identifiers.creditsConsumed || 1) : 0,
            payload: {
                idpriv: remoteId,
                itemId: remoteId,
                listingId: finalState.listingId || finalState.itemId || "",
                managementUrl: finalState.managementUrl || "",
                deleteUrl: finalState.deleteUrl || "",
                promoteUrl: finalState.promoteUrl || "",
                publicUrl: finalState.publicUrl || ""
            }
        };
    } catch (error) {
        await captureScreenshot(page, `error-${error.message || "publish-failed"}`);
        throw error;
    }
}

async function updateAd(page, remoteId, adData = {}) {
    const normalizedRemoteId = normalizeRemoteId(remoteId || adData.remotePostID);
    const data = buildPublishData(adData);
    console.log("[amasens:update] Updating ad", {
        remoteId: normalizedRemoteId,
        title: data.title,
        city: data.city,
        region: data.region,
        area: data.area,
        category: data.category,
        images: data.images.length
    });

    try {
        await openEditPage(page, normalizedRemoteId);
        await fillFirstStep(page, data);
        await captureScreenshot(page, "update-02-form-filled");
        const updated = await clickUpdateSubmit(page);
        const finalState = mergePublishState(
            { remoteId: normalizedRemoteId, listingId: normalizedRemoteId.split("/")[0], managementUrl: `${EDIT_URL_BASE}/${normalizedRemoteId}` },
            await extractAmasensPublishState(page),
            {
                currentUrl: updated.url
            }
        );
        const publishedUrl = finalState.currentUrl || "";
        const resultUrl = finalState.publicUrl ||
            (/\/item\/(?:new|premium|edit)\b/i.test(publishedUrl) ? "" : publishedUrl);

        return {
            ok: true,
            url: resultUrl,
            creditsConsumed: 0,
            payload: {
                idpriv: finalState.remoteId || normalizedRemoteId,
                itemId: finalState.remoteId || normalizedRemoteId,
                listingId: finalState.listingId || normalizedRemoteId.split("/")[0] || "",
                managementUrl: finalState.managementUrl || `${EDIT_URL_BASE}/${normalizedRemoteId}`,
                publicUrl: finalState.publicUrl || ""
            }
        };
    } catch (error) {
        await captureScreenshot(page, `error-update-${error.message || "failed"}`);
        throw error;
    }
}

module.exports = {
    buildPublishData,
    publishAd,
    updateAd,
    deleteAd
};
