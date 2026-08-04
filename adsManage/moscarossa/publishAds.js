const fs = require("fs");
const path = require("path");

const PUBLISH_URL = "https://www.moscarossa.biz/private/inserimento.php";
const VIEW_URL = "https://www.moscarossa.biz/private/vedi_annuncio_ut.php";
const SCREENSHOT_DIR = path.join("./screenshots", "moscarossa-publish");
const FREE_IMAGE_LIMIT = 3;

const CATEGORY_VALUES = Object.freeze({
    DONNAUOMO: "1",
    ESCORT: "1",
    TRANS: "5",
    UOMODONNA: "2",
    GIGOLO: "2",
    MASSAGGI: "12"
});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeKey(value) {
    return `${value || ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/gi, " ")
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

function mapCategory(value) {
    const raw = `${value || ""}`.trim();
    if (["1", "2", "5", "12"].includes(raw)) return raw;
    const key = normalizeKey(raw).replace(/[^a-z0-9]/g, "").toUpperCase();
    return CATEGORY_VALUES[key] || "1";
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
        const raw = `${source}`;
        const normalized = raw.replace(/\\/g, "/");
        const candidates = [];
        if (path.isAbsolute(raw)) candidates.push(raw);
        candidates.push(path.resolve(process.cwd(), raw));
        candidates.push(path.resolve(__dirname, "..", "..", raw));
        if (/^\/root\/bky\//i.test(normalized)) {
            candidates.push(path.join("E:\\root\\bky", normalized.replace(/^\/root\/bky\//i, "")));
        }

        const existing = candidates.find((candidate) => fs.existsSync(candidate));
        if (!existing) continue;
        const key = existing.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        resolved.push(existing);
        if (resolved.length >= FREE_IMAGE_LIMIT) break;
    }

    return resolved;
}

function buildPublishData(adData = {}) {
    const note = parseNote(adData.note);
    const options = note.moscarossa || {};
    const images = Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : []);
    const typeAnnuncio = `${adData.typeAnnuncio || adData.promo?.visibility || "Free"}`.trim();

    return {
        title: firstNonEmpty(adData.title, adData.titolo),
        description: firstNonEmpty(adData.description, adData.testo),
        category: firstNonEmpty(options.categoryId, mapCategory(firstNonEmpty(adData.categorie, adData.sono, adData.category))),
        contactName: `${firstNonEmpty(adData.name, adData.nickname, adData.contactName)}`.trim().slice(0, 30),
        phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
        whatsapp: isEnabled(adData.whatsapp) || isEnabled(adData.hasWhatapp),
        telegram: isEnabled(adData.telegram) || isEnabled(adData.hasTelegram),
        city: firstNonEmpty(adData.city, adData.annunci_city, adData.comune),
        cityId: firstNonEmpty(options.cityId, adData.cityId, adData.idComune),
        zone: firstNonEmpty(options.zone, adData.location, adData.area, adData.zona),
        zoneId: firstNonEmpty(options.zoneId, adData.zoneId, adData.idZona),
        address: firstNonEmpty(options.address, adData.address, adData.indirizzo),
        zoneDetail: firstNonEmpty(options.zoneDetail, adData.zoneDetail),
        latitude: firstNonEmpty(options.latitude, adData.latitude, adData.latitudine),
        longitude: firstNonEmpty(options.longitude, adData.longitude, adData.longitudine),
        age: firstNonEmpty(adData.age, adData.years),
        website: firstNonEmpty(options.website, adData.website, adData.sito_web),
        airConditioned: isEnabled(options.airConditioned) || isEnabled(adData.airConditioned),
        images,
        picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
        isFree: normalizeKey(typeAnnuncio) === "free"
    };
}

function ensureScreenshotDir() {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    return SCREENSHOT_DIR;
}

async function captureScreenshot(page, label) {
    try {
        if (!page || page.isClosed()) return "";
        const safeLabel = `${label || "step"}`
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase()
            .slice(0, 110) || "step";
        const filePath = path.join(ensureScreenshotDir(), `${safeLabel}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`[moscarossa:screenshot] ${label}: ${filePath}`);
        return filePath;
    } catch (error) {
        console.warn(`[moscarossa:screenshot] Failed to capture ${label}: ${error.message}`);
        return "";
    }
}

async function setInput(page, selector, value) {
    if (`${value ?? ""}`.trim() === "") return false;
    if (!(await page.$(selector))) return false;
    await page.evaluate((fieldSelector, inputValue) => {
        const input = document.querySelector(fieldSelector);
        if (!input) return;
        input.removeAttribute("readonly");
        input.removeAttribute("disabled");
        input.value = inputValue;
        input.setAttribute("value", inputValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector, `${value}`);
    return true;
}

async function setCheckbox(page, selector, checked) {
    if (!(await page.$(selector))) return false;
    await page.evaluate((fieldSelector, desired) => {
        const input = document.querySelector(fieldSelector);
        if (!input) return;
        input.removeAttribute("disabled");
        input.checked = Boolean(desired);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector, Boolean(checked));
    return true;
}

async function selectNativeOption(page, selector, value) {
    const raw = `${value || ""}`.trim();
    if (!raw || !(await page.$(selector))) return false;
    return page.evaluate((fieldSelector, target) => {
        const normalize = (input) => `${input || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const select = document.querySelector(fieldSelector);
        if (!select) return false;
        const normalizedTarget = normalize(target);
        const option = Array.from(select.options).find((candidate) =>
            `${candidate.value}` === `${target}` || normalize(candidate.textContent) === normalizedTarget
        );
        if (!option) return false;
        select.value = option.value;
        option.selected = true;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        if (window.jQuery) window.jQuery(select).trigger("change");
        return { value: option.value, text: `${option.textContent || ""}`.trim() };
    }, selector, raw);
}

async function selectMoscarossaCity(page, city, cityId = "") {
    if (cityId) {
        const direct = await page.evaluate((targetId, label) => {
            const select = document.querySelector("#id_comune");
            if (!select) return false;
            let option = Array.from(select.options).find((candidate) => `${candidate.value}` === `${targetId}`);
            if (!option) {
                option = new Option(label, targetId, true, true);
                select.appendChild(option);
            }
            select.value = `${targetId}`;
            option.selected = true;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            if (window.jQuery) window.jQuery(select).trigger("change");
            return { value: option.value, text: `${option.textContent || ""}`.trim() };
        }, `${cityId}`, `${city}`);
        if (direct) return direct;
    }

    const selectionSelector = "#id_comune + .select2 .select2-selection, [aria-labelledby='select2-id_comune-container']";
    await page.waitForSelector(selectionSelector, { visible: true, timeout: 30000 });
    await page.click(selectionSelector);
    const searchSelector = ".select2-container--open .select2-search__field";
    const search = await page.waitForSelector(searchSelector, { visible: true, timeout: 15000 });
    await search.type(`${city}`, { delay: 80 });

    await page.waitForFunction(() => Array.from(document.querySelectorAll(
        ".select2-container--open .select2-results__option"
    )).some((option) => !/ricerca|caricamento|nessun risultato/i.test(option.textContent || "")), { timeout: 30000 });

    const resultHandles = await page.$$(".select2-container--open .select2-results__option");
    const candidates = [];
    for (const handle of resultHandles) {
        const text = await page.evaluate((node) => `${node.textContent || ""}`.replace(/\s+/g, " ").trim(), handle);
        if (text && !/ricerca|caricamento|nessun risultato/i.test(text)) candidates.push({ handle, text });
    }
    const target = normalizeKey(city);
    const match = candidates.find((candidate) => normalizeKey(candidate.text) === target) ||
        candidates.find((candidate) => normalizeKey(candidate.text).startsWith(`${target} `)) ||
        candidates.find((candidate) => normalizeKey(candidate.text).includes(target));

    if (!match) {
        throw new Error(`Moscarossa Comune "${city}" non trovato. Opzioni: ${candidates.map((item) => item.text).slice(0, 12).join(" | ")}`);
    }

    await match.handle.click();
    await page.waitForFunction(() => {
        const select = document.querySelector("#id_comune");
        return select && select.value && select.value !== "0";
    }, { timeout: 15000 });

    return page.evaluate(() => {
        const select = document.querySelector("#id_comune");
        return { value: select?.value || "", text: `${select?.selectedOptions?.[0]?.textContent || ""}`.trim() };
    });
}

async function uploadImages(page, images, picsAudit) {
    const imagePaths = resolveImagePaths(images, picsAudit);
    if (!imagePaths.length) {
        console.log("[moscarossa:images] No images selected for free publication.");
        return [];
    }

    const input = await page.waitForSelector("input.fileuploader_upload[name='files[]']", { timeout: 30000 });
    await input.uploadFile(...imagePaths);
    await page.waitForFunction((expected) => {
        const inputNode = document.querySelector("input.fileuploader_upload[name='files[]']");
        return Number(inputNode?.files?.length || 0) >= expected;
    }, { timeout: 20000 }, imagePaths.length);
    await delay(1500);
    console.log(`[moscarossa:images] Prepared ${imagePaths.length} free-ad image(s).`);
    return imagePaths;
}

async function collectValidation(page) {
    return page.evaluate(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const messages = Array.from(document.querySelectorAll(
            ".msgBox .content, .alert-danger, .error, .invalid-feedback, [role='alert']"
        )).map((node) => clean(node.textContent)).filter(Boolean);
        const invalidFields = Array.from(document.querySelectorAll(":invalid"))
            .map((node) => node.name || node.id || node.getAttribute("placeholder"))
            .filter(Boolean);
        return { messages: Array.from(new Set(messages)).slice(0, 12), invalidFields, url: location.href };
    });
}

async function fillFirstStep(page, data) {
    const required = {
        category: data.category,
        contactName: data.contactName,
        description: data.description,
        phone: data.phone,
        city: data.city
    };
    const missing = Object.entries(required).filter(([, value]) => !`${value || ""}`.trim()).map(([key]) => key);
    if (missing.length) throw new Error(`Moscarossa dati obbligatori mancanti: ${missing.join(", ")}`);

    const category = await selectNativeOption(page, "#id_categoria", data.category);
    if (!category) throw new Error(`Moscarossa categoria non trovata: ${data.category}`);
    await setInput(page, "input[name='nome']", data.contactName);
    await setInput(page, "textarea[name='titolo']", data.title);
    await setInput(page, "#descrizione", data.description);
    await setInput(page, "#presenza_telefono", data.phone);
    await setCheckbox(page, "input[name='wa']", data.whatsapp);
    await setCheckbox(page, "input[name='tg']", data.telegram);

    const selectedCity = await selectMoscarossaCity(page, data.city, data.cityId);
    console.log("[moscarossa:location] Comune selected", selectedCity);
    await delay(1200);
    if (data.zoneId || data.zone) {
        const zone = await selectNativeOption(page, "#id_zona", data.zoneId || data.zone);
        console.log("[moscarossa:location] Zone selection", zone || "not available; optional field skipped");
    }

    await setInput(page, "#indirizzo", data.address);
    await setInput(page, "#dettaglio_zona", data.zoneDetail || data.zone);
    await setInput(page, "#latitudine", data.latitude);
    await setInput(page, "#longitudine", data.longitude);
    await setInput(page, "input[name='eta']", data.age);
    await setInput(page, "input[name='link_sito']", data.website);
    await setCheckbox(page, "#specifiche_25", data.airConditioned);
    await uploadImages(page, data.images, data.picsAudit);
    await setCheckbox(page, "#regolamento", true);
}

async function continueToPromotion(page) {
    const continueButton = await page.waitForSelector(".buttonNext", { visible: true, timeout: 30000 });
    await continueButton.click();
    try {
        await page.waitForSelector("#button_pubblica_gratis", { visible: true, timeout: 90000 });
    } catch {
        const validation = await collectValidation(page);
        throw new Error(`Moscarossa primo passaggio non completato: ${JSON.stringify(validation)}`);
    }

    const remoteId = await page.evaluate(() => {
        const fields = Array.from(document.querySelectorAll("input[name='id_accompa']"));
        return `${fields.find((field) => field.value)?.value || ""}`.trim();
    });
    if (!remoteId) throw new Error("Moscarossa non ha restituito id_accompa dopo Continua.");
    return remoteId;
}

async function clickPublishFree(page, remoteId) {
    const button = await page.waitForSelector("#button_pubblica_gratis", { visible: true, timeout: 30000 });
    const responsePromise = page.waitForResponse(
        (response) => /\/private\/promuovi_free\.php(?:\?|$)/i.test(response.url()),
        { timeout: 60000 }
    );
    await button.click();
    const response = await responsePromise;
    const responseBody = await response.text().catch(() => "");
    await delay(750);

    const result = await page.evaluate(() => {
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && !node.classList.contains("d-none");
        };
        const phoneLayers = Array.from(document.querySelectorAll(".div_verifica_telefono"));
        return {
            content: `${document.querySelector("#div_dopo_free")?.innerText || ""}`.replace(/\s+/g, " ").trim(),
            phoneVerificationVisible: phoneLayers.some(visible),
            originalButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis")),
            updateFreeButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis_aggiorna"))
        };
    });

    const combined = `${responseBody} ${result.content}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const negative = /errore|non (?:puoi|possibile|consentito)|impossibile|verifica(?:re|zione).*telefon|codice sms|annuncio non visible|accesso negato/i;
    const positive = /pubblicat|annuncio (?:online|attiv|visibile)|complimenti|aggiorna annuncio gratis/i;

    if (result.phoneVerificationVisible || /verifica(?:re|zione).*telefon|codice sms/i.test(combined)) {
        throw new Error("Moscarossa richiede la verifica SMS del telefono prima della pubblicazione gratuita.");
    }
    if (response.status() < 200 || response.status() >= 300) {
        throw new Error(`Moscarossa pubblicazione gratuita HTTP ${response.status()}: ${combined.slice(0, 500)}`);
    }
    if (negative.test(combined)) {
        throw new Error(`Moscarossa ha rifiutato la pubblicazione gratuita: ${combined.slice(0, 700)}`);
    }

    const accepted = positive.test(combined) || result.updateFreeButtonPresent ||
        (!result.originalButtonPresent && combined.length > 0);
    if (!accepted) {
        throw new Error(`Risposta Moscarossa non riconosciuta dopo PUBBLICA GRATIS: ${combined.slice(0, 700)}`);
    }

    return {
        ok: true,
        remoteId,
        response: combined.slice(0, 700)
    };
}

async function publishAd(page, adData = {}) {
    const data = buildPublishData(adData);
    if (!data.isFree) {
        throw new Error("Il workflow Moscarossa attuale supporta solo PUBBLICA GRATIS.");
    }

    console.log("[moscarossa:publish] Publishing free ad", {
        title: data.title,
        category: data.category,
        city: data.city,
        images: resolveImagePaths(data.images, data.picsAudit).length
    });

    try {
        await page.goto(PUBLISH_URL, { waitUntil: "networkidle2", timeout: 60000 });
        if (/login-escort/i.test(page.url()) || await page.$("#form_login")) {
            throw new Error(`Moscarossa session expired; redirected to login. URL: ${page.url()}`);
        }
        await page.waitForSelector("#dati_annuncio", { visible: true, timeout: 30000 });
        await captureScreenshot(page, "01-open-publish-page");
        await fillFirstStep(page, data);
        await captureScreenshot(page, "02-first-step-filled");

        const remoteId = await continueToPromotion(page);
        await captureScreenshot(page, "03-free-promotion-step");
        const freeResult = await clickPublishFree(page, remoteId);
        await captureScreenshot(page, "04-free-published");

        const url = `${VIEW_URL}?id_accompa=${encodeURIComponent(remoteId)}`;
        console.log("[moscarossa:publish] Free publication completed", { remoteId, url });
        return {
            ok: true,
            payload: { idpriv: remoteId, id_accompa: remoteId },
            url,
            creditsConsumed: 0,
            freePublication: true,
            response: freeResult.response
        };
    } catch (error) {
        await captureScreenshot(page, `error-${error.message}`);
        throw error;
    }
}

module.exports = {
    buildPublishData,
    captureScreenshot,
    clickPublishFree,
    publishAd,
    resolveImagePaths
};
