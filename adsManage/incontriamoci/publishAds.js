const fs = require("fs");
const path = require("path");

const HOME_URL = "https://incontriamoci.xxx/";
const PUBLISH_URL = "https://incontriamoci.xxx/item/new";

const SCREENSHOT_DIR = path.join("./screenshots", "incontriamoci-publish");
const FORM_SELECTOR = "form#item-post";

const CATEGORY_VALUES = {
    DONNAUOMO: "101",
    DONNA_UOMO: "101",
    ESCORT: "101",
    UOMOUOMO: "98",
    UOMO_UOMO: "98",
    GAY: "98",
    TRANS: "104",
    COPPIE: "103",
    SCAMBISTI: "103"
};

const FILTER_VALUES = {
    ethnicity: {
        italiana: "1",
        africana: "2",
        indiana: "3",
        orientale: "4",
        asiatica: "4",
        araba: "5",
        latina: "6",
        caucasica: "7"
    },
    eye: {
        neri: "97",
        nero: "97",
        blue: "98",
        blu: "98",
        verdi: "99",
        verde: "99",
        marroni: "100",
        ambra: "101",
        grigi: "102",
        grigio: "102",
        nocciola: "103"
    },
    hair: {
        biondi: "104",
        biondo: "104",
        castani: "105",
        castano: "105",
        neri: "106",
        nero: "106",
        rossi: "107",
        rosso: "107",
        bianchi: "108",
        bianco: "108",
        grigi: "109",
        grigio: "109"
    },
    body: {
        magro: "110",
        magra: "110",
        atletico: "111",
        atletica: "111",
        formoso: "112",
        formosa: "112"
    },
    particularSigns: {
        fumatrice: "125",
        tatuaggi: "126",
        piercing: "127",
        depilata: "128",
        "seno rifatto": "129",
        "labbra rifatte": "130"
    },
    services: {
        orale: "131",
        anale: "132",
        sadomaso: "133",
        "esperienza fidanzata": "134",
        "attrici porno": "135",
        "eiaculazione sul corpo": "136",
        "massaggio erotico": "137",
        "massaggio tantrico": "138",
        fetish: "139",
        "bacio alla francese": "140",
        "gioco di ruolo": "141",
        trio: "142",
        sexting: "143",
        "video chiamata": "144",
        strapon: "145",
        "strap on": "145",
        mistress: "146"
    },
    serviceFor: {
        uomini: "147",
        donne: "148",
        coppie: "149",
        disabili: "150"
    },
    servicePlace: {
        "visita a domicilio": "151",
        "eventi e feste": "152",
        "albergo motel": "153",
        "albergo / motel": "153",
        "a casa": "154",
        clubs: "155",
        club: "155"
    },
    paymentMethods: {
        "carta di credito": "156",
        contanti: "157",
        cash: "157"
    }
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureScreenshotDir() {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    return SCREENSHOT_DIR;
}

function normalizeKey(value) {
    return `${value || ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
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

function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (`${value ?? ""}`.trim() === "") return [];
    return [value];
}

function mapCategory(value) {
    return CATEGORY_VALUES[`${value || ""}`.trim().toUpperCase()] || CATEGORY_VALUES[normalizeKey(value).replace(/\s+/g, "").toUpperCase()] || `${value || ""}`;
}

function resolveImagePaths(images = [], picsAudit = []) {
    const auditPaths = picsAudit.map((item) => item?.path).filter(Boolean);
    const sources = images.length ? images : auditPaths;
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

function buildTagSelections(adData = {}) {
    const note = parseNote(adData.note);
    const noteTags = note.incontriamoci?.tags || note.trovagnocca?.tags || note.tags || {};

    const tags = {
        ethnicity: firstNonEmpty(
            toArray(noteTags.ethnicity)[0],
            isEnabled(adData.serviceItaliana) ? "Italiana" : "",
            isEnabled(adData.serviceAfricana) ? "Africana" : "",
            isEnabled(adData.serviceIndiana) ? "Indiana" : "",
            isEnabled(adData.serviceAsiatica) ? "Orientale" : "",
            isEnabled(adData.serviceAraba) ? "Araba" : "",
            isEnabled(adData.serviceLatina) ? "Latina" : "",
            isEnabled(adData.serviceCaucasica) ? "Caucasica" : ""
        ),
        nationality: firstNonEmpty(adData.serviceNazionalita, noteTags.nationality, adData.nationality),
        eye: firstNonEmpty(toArray(noteTags.eye)[0]),
        hair: firstNonEmpty(
            toArray(noteTags.hair)[0],
            isEnabled(adData.serviceCBiondi) ? "Biondi" : "",
            isEnabled(adData.serviceCMarroni) ? "Castani" : "",
            isEnabled(adData.serviceCNeri) ? "Neri" : "",
            isEnabled(adData.serviceCRossi) ? "Rossi" : ""
        ),
        body: firstNonEmpty(
            toArray(noteTags.body)[0],
            isEnabled(adData.serviceMagro) ? "Magro" : "",
            isEnabled(adData.serviceFormoso) ? "Formoso" : ""
        ),
        particularSigns: toArray(noteTags.particularSigns),
        services: [
            ...toArray(noteTags.services),
            isEnabled(adData.serviceOrale) ? "Orale" : "",
            isEnabled(adData.serviceAnale) ? "Anale" : "",
            isEnabled(adData.serviceSadomaso) ? "Sadomaso" : "",
            isEnabled(adData.serviceEsperienzaFidanzata) ? "Esperienza fidanzata" : "",
            isEnabled(adData.serviceAttriciPorno) ? "Attrici porno" : "",
            isEnabled(adData.serviceEiaculazioneSulCorpo) ? "Eiaculazione sul corpo" : "",
            isEnabled(adData.serviceMassaggioErotico) ? "Massaggio erotico" : "",
            isEnabled(adData.serviceMassaggioTantrico) ? "Massaggio tantrico" : "",
            isEnabled(adData.serviceFetish) ? "Fetish" : "",
            isEnabled(adData.serviceBacioAllaFrancese) ? "Bacio alla francese" : "",
            isEnabled(adData.serviceGiocoDiRuolo) ? "Gioco di ruolo" : "",
            isEnabled(adData.serviceTrio) ? "Trio" : "",
            isEnabled(adData.serviceSexting) ? "Sexting" : "",
            isEnabled(adData.serviceVideoChiamata) ? "Video chiamata" : ""
        ].filter(Boolean),
        serviceFor: [
            ...toArray(noteTags.serviceFor),
            isEnabled(adData.serviceUomini) ? "Uomini" : "",
            isEnabled(adData.serviceDonne) ? "Donne" : "",
            isEnabled(adData.serviceCoppie) ? "Coppie" : "",
            isEnabled(adData.serviceDisabili) ? "Disabili" : ""
        ].filter(Boolean),
        servicePlace: [
            ...toArray(noteTags.servicePlace),
            isEnabled(adData.serviceVisitaADomicilio) ? "Visita a domicilio" : "",
            isEnabled(adData.serviceEventiEFeste) ? "Eventi e feste" : "",
            isEnabled(adData.serviceAlbergoMotel) ? "Albergo / motel" : "",
            isEnabled(adData.serviceACasa) ? "A casa" : "",
            isEnabled(adData.serviceClubs) ? "Clubs" : ""
        ].filter(Boolean),
        paymentMethods: [
            ...toArray(noteTags.paymentMethods),
            isEnabled(adData.serviceCreditCard) ? "Carta di credito" : "",
            isEnabled(adData.serviceCash) ? "Contanti" : ""
        ].filter(Boolean)
    };

    return tags;
}

function buildPublishData(adData = {}) {
    const note = parseNote(adData.note);
    const contactNote = note.incontriamoci || note.trovagnocca || note;

    return {
        title: firstNonEmpty(adData.title, adData.titolo),
        description: firstNonEmpty(adData.description, adData.testo),
        category: mapCategory(firstNonEmpty(adData.categorie, adData.sono, adData.category)),
        city: firstNonEmpty(adData.city, adData.annunci_city, adData.comune),
        area: firstNonEmpty(adData.area, adData.location, adData.zone, adData.zona),
        address: firstNonEmpty(adData.address, adData.indirizzo, adData.location, adData.city, adData.annunci_city),
        zip: firstNonEmpty(adData.zip, adData.cap),
        phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
        contactName: firstNonEmpty(adData.contactName, adData.nickname, adData.name, adData.title),
        age: firstNonEmpty(adData.age, adData.years),
        website: firstNonEmpty(adData.website, adData.url),
        whatsapp: isEnabled(adData.whatsapp) || isEnabled(adData.hasWhatapp),
        telegram: isEnabled(adData.telegram) || isEnabled(adData.hasTelegram) || Boolean(contactNote.telegram || contactNote.telegramNumber || contactNote.telegramUrl),
        livecam: isEnabled(adData.canLivecam) || isEnabled(adData.hasVideo),
        images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : []),
        picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
        tags: buildTagSelections(adData)
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
        const select = document.querySelector(sel);
        if (!select) return false;
        const normalizedTarget = target.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        const options = Array.from(select.options);
        const option = options.find((item) => item.value === target) ||
            options.find((item) => (item.textContent || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === normalizedTarget) ||
            options.find((item) => (item.textContent || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().includes(normalizedTarget));

        if (!option) return false;
        select.removeAttribute("disabled");
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }, selector, `${valueOrLabel}`);
}

async function setRadioOrCheckboxByValue(page, value) {
    if (`${value ?? ""}`.trim() === "") return false;
    return page.evaluate((targetValue) => {
        const input = Array.from(document.querySelectorAll("input[type='radio'], input[type='checkbox']"))
            .find((node) => node.value === targetValue);
        if (!input) return false;
        input.removeAttribute("disabled");
        input.checked = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }, `${value}`);
}

async function setFilterValue(page, group, value) {
    const mapped = FILTER_VALUES[group]?.[normalizeKey(value)];
    if (!mapped) return false;
    return setRadioOrCheckboxByValue(page, mapped);
}

async function setNationality(page, value) {
    if (`${value ?? ""}`.trim() === "") return false;
    return selectOption(page, "#nationality_filter, select[name='filter[nationality]']", value);
}

async function openPublishPage(page) {
    await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    const hasForm = await page.$(FORM_SELECTOR);
    if (hasForm) return PUBLISH_URL;

    throw new Error(`Incontriamoci publish form not found. Last URL: ${page.url()}`);
}

async function uploadImages(page, images = [], picsAudit = []) {
    const imagePaths = resolveImagePaths(images, picsAudit)
        .filter((filePath) => fs.existsSync(filePath))
        .slice(0, 20);

    if (!imagePaths.length) return 0;

    await setCheckbox(page, "#image_uploader_instance_auth, input[name='image_uploader_instance_auth']", true);
    const input = await page.$("input[type='file'][name='images'], input[type='file'][accept*='image'], input[type='file']");
    if (!input) throw new Error("Incontriamoci image file input not found.");

    await input.uploadFile(...imagePaths);
    await page.waitForFunction((expected) => {
        const successCount = document.querySelectorAll(".qq-upload-success, .qq-file-id, .qq-upload-list li").length;
        return successCount >= expected || expected === 0;
    }, { timeout: 60000 }, Math.min(imagePaths.length, 1)).catch(() => null);

    await delay(1500);
    return imagePaths.length;
}

async function fillFirstStep(page, data) {
    await page.waitForSelector(FORM_SELECTOR, { visible: true, timeout: 30000 });

    await setInput(page, "#title, input[name='title']", data.title);
    await selectOption(page, "#catId, select[name='catId']", data.category);
    await setInput(page, "#description, textarea[name='description']", data.description);
    await uploadImages(page, data.images, data.picsAudit);

    await setInput(page, "#countryCode, input[name='countryCode']", "IT");
    await setInput(page, "#address, input[name='address']", data.address);
    await selectOption(page, "#cityId, select[name='cityId']", data.city);
    await page.waitForFunction(() => {
        const select = document.querySelector("#cityAreaId, select[name='cityAreaId']");
        return !select || !select.disabled || select.options.length > 1;
    }, { timeout: 12000 }).catch(() => null);
    await selectOption(page, "#cityAreaId, select[name='cityAreaId']", data.area);
    await setInput(page, "#zip, input[name='zip']", data.zip);

    await setInput(page, "#telephone, input[name='telephone']", data.phone);
    await setInput(page, "#contactName, input[name='contactName']", data.contactName);
    await setInput(page, "#age, input[name='age']", data.age);
    await setInput(page, "#website, input[name='website']", data.website);

    await setFilterValue(page, "ethnicity", data.tags.ethnicity);
    await setNationality(page, data.tags.nationality);
    await setFilterValue(page, "eye", data.tags.eye);
    await setFilterValue(page, "hair", data.tags.hair);
    await setFilterValue(page, "body", data.tags.body);

    for (const value of data.tags.particularSigns) await setFilterValue(page, "particularSigns", value);
    for (const value of data.tags.services) await setFilterValue(page, "services", value);
    for (const value of data.tags.serviceFor) await setFilterValue(page, "serviceFor", value);
    for (const value of data.tags.servicePlace) await setFilterValue(page, "servicePlace", value);
    for (const value of data.tags.paymentMethods) await setFilterValue(page, "paymentMethods", value);

    await setCheckbox(page, "#canWhatsapp, input[name='canWhatsapp']", data.whatsapp);
    await setCheckbox(page, "#canTelegram, input[name='canTelegram']", data.telegram);
    await setCheckbox(page, "#canLivecam, input[name='canLivecam']", data.livecam);
    await setCheckbox(page, "#publish_item_terms, input[name='publish_item_terms']", true);
}

async function clickContinue(page) {
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate(() => {
            const form = document.querySelector("form#item-post");
            const submit = form?.querySelector("button[type='submit'], input[type='submit']") ||
                Array.from(document.querySelectorAll("button, input[type='submit'], a")).find((node) => /continua/i.test(node.textContent || node.value || ""));
            if (!submit) throw new Error("Incontriamoci CONTINUA button not found.");
            submit.click();
        })
    ]);

    await delay(1500);
}

async function clickPublishFree(page) {
    const clicked = await page.evaluate(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
        const nodes = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
        const publishFree = nodes.find((node) => {
            const text = clean(node.textContent || node.value);
            return /(gratis|gratuito|free)/i.test(text) && /(pubblica|publish|annuncio)/i.test(text);
        }) || nodes.find((node) => /(pubblica|publish)/i.test(clean(node.textContent || node.value)));

        if (!publishFree) return false;
        publishFree.click();
        return true;
    });

    if (!clicked) {
        throw new Error("Incontriamoci free publish button not found after CONTINUA.");
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
    await delay(2000);
}

async function collectResult(page) {
    const result = await page.evaluate(() => {
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
        const idMatch = [window.location.href, ...hrefs, bodyText].join(" ").match(/(?:item|annuncio|ad|manage|edit)[^\d]{0,30}(\d{4,})/i);
        const previewLink = hrefs.find((href) => /\/\d{4,}\//.test(href) && !/user|login|logout/i.test(href)) || "";

        return {
            url: previewLink || window.location.href,
            remoteId: idMatch ? idMatch[1] : "",
            bodyText: bodyText.slice(0, 800),
            success: /pubblicato|pubblicata|success|approvazione|moderazione|grazie/i.test(bodyText)
        };
    });

    return result;
}

function extractRemoteIdFromPremiumUrl(url = "") {
    const match = `${url || ""}`.match(/\/item\/premium\/([^?#]+)(?:[?#]|$)/i);
    return match ? decodeURIComponent(match[1]).replace(/\/+$/, "") : "";
}

async function publishAd(page, adData = {}) {
    const data = buildPublishData(adData);

    console.log("[incontriamoci:publish] Publishing ad", {
        title: data.title,
        city: data.city,
        category: data.category,
        images: data.images.length || data.picsAudit.length
    });

    ensureScreenshotDir();
    await openPublishPage(page);
    await fillFirstStep(page, data);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-first-step-filled.png"), fullPage: true }).catch(() => null);

    await clickContinue(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-after-continue.png"), fullPage: true }).catch(() => null);

    const premiumLink = await page.url();
    const premiumRemoteId = extractRemoteIdFromPremiumUrl(premiumLink);
    if (premiumRemoteId) {
        console.log("[incontriamoci:publish] remoteId from premium page", premiumRemoteId);
    }

    await clickPublishFree(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-after-free-publish.png"), fullPage: true }).catch(() => null);

    const result = await collectResult(page);
    const remoteId = premiumRemoteId || result.remoteId || adData.remotePostID || "";
    const ok = Boolean(result.success || remoteId || result.url !== HOME_URL);

    if (!ok) {
        throw new Error(`Incontriamoci publish did not confirm success: ${JSON.stringify(result)}`);
    }

    return {
        ok,
        url: result.url,
        payload: {
            idpriv: remoteId,
            data
        },
        freePublication: true
    };
}

module.exports = {
    HOME_URL,
    PUBLISH_URL,
    buildPublishData,
    publishAd
};
