const fs = require("fs");
const path = require("path");

const PUBLISH_URL = "https://www.moscarossa.biz/private/inserimento.php";
const VIEW_URL = "https://www.moscarossa.biz/private/vedi_annuncio_ut.php";
const PHONE_VERIFICATION_URL = "https://www.moscarossa.biz/private/ajax_verifica_telefono.php";
const SCREENSHOT_DIR = path.join("./screenshots", "moscarossa-publish");
const FREE_IMAGE_LIMIT = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const NATIVE_UPLOAD_INPUT_ID = "bky-moscarossa-native-images";
const PROMOTION_PLANS = Object.freeze({
    free: { name: "Free", id: "0", imageLimit: 5 },
    premium: { name: "Premium", id: "1", imageLimit: 10 },
    top: { name: "Top", id: "2", imageLimit: 10 },
    red: { name: "Red", id: "6", imageLimit: 15 },
    gold: { name: "Gold", id: "7", imageLimit: 20 }
});
const PROMOTION_DURATIONS = new Set([1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 25, 30]);

class MoscarossaWorkflowPendingError extends Error {
    constructor(message, { remoteId = "", reasonCode = "MOSCAROSSA_WAITING_ACTION" } = {}) {
        super(message);
        this.name = "MoscarossaWorkflowPendingError";
        this.remoteId = `${remoteId || ""}`;
        this.scheduleState = "ALERT";
        this.reasonCode = reasonCode;
        this.url = this.remoteId
            ? `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(this.remoteId)}`
            : "";
    }
}

const CATEGORY_VALUES = Object.freeze({
    DONNAUOMO: "1",
    ESCORT: "1",
    TRANS: "5",
    UOMODONNA: "2",
    GIGOLO: "2",
    MASSAGGI: "12"
});
const MOSCAROSSA_TARIFF_IDS = new Set(["185", "186", "187", "188", "189", "190", "191", "192", "193", "194", "195"]);
const MOSCAROSSA_SERVICE_IDS = new Set([
    "184", "214", "108", "110", "109", "98", "204", "196", "203", "202", "197", "99", "162", "101",
    "213", "102", "114", "212", "198", "103", "104", "105", "201", "205", "199", "200", "97", "111",
    "112", "222", "106", "215", "107"
]);
const MOSCAROSSA_SELECT_IDS = new Set(["2", "3", "5", "6", "7", "8", "9", "10", "11", "13", "14", "17", "22"]);
const MOSCAROSSA_MULTI_IDS = new Set(["12", "16"]);
const MOSCAROSSA_MULTI_OPTIONS = Object.freeze({
    "12": new Set(["55", "54", "56", "57", "59", "48", "63", "60", "62", "47", "50", "64", "58", "65", "51", "66", "52", "68", "69", "53", "221", "49", "67", "61"]),
    "16": new Set(["218", "219", "167", "220", "113", "217", "216"])
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

function normalizePromotion(value) {
    const key = normalizeKey(value || "Free").replace(/\s+/g, "");
    return PROMOTION_PLANS[key] || PROMOTION_PLANS.free;
}

function parsePromotionPeriod(period, planName) {
    let parsed = {};
    try {
        parsed = typeof period === "string" ? JSON.parse(period || "{}") : (period || {});
    } catch {
        parsed = {};
    }
    const details = parsed.moscarossa || parsed;
    const requestedDays = Number.parseInt(details.days || details.duration || parsed.days || period, 10);
    return {
        plan: normalizePromotion(details.plan || planName),
        days: PROMOTION_DURATIONS.has(requestedDays) ? requestedDays : 1
    };
}

function normalizeMoscarossaDetails(input = {}) {
    const details = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const validNumeric = (value) => /^\d{1,7}$/.test(`${value ?? ""}`.trim()) ? `${value}`.trim() : "";
    const validId = (value) => /^\d{1,4}$/.test(`${value || ""}`) ? `${value}` : "";
    const normalized = { tariffs: {}, services: {}, selects: {}, multiSelects: {} };

    Object.entries(details.tariffs || {}).forEach(([id, value]) => {
        const price = validNumeric(value);
        if (MOSCAROSSA_TARIFF_IDS.has(`${id}`) && price) normalized.tariffs[id] = price;
    });
    Object.entries(details.services || {}).forEach(([id, value]) => {
        if (!MOSCAROSSA_SERVICE_IDS.has(`${id}`)) return;
        const enabled = value === true || isEnabled(value?.enabled);
        if (!enabled) return;
        normalized.services[id] = { enabled: true, supplement: validNumeric(value?.supplement) };
    });
    Object.entries(details.selects || {}).forEach(([groupId, value]) => {
        const optionId = validId(value);
        if (MOSCAROSSA_SELECT_IDS.has(`${groupId}`) && optionId) normalized.selects[groupId] = optionId;
    });
    Object.entries(details.multiSelects || {}).forEach(([groupId, values]) => {
        if (!MOSCAROSSA_MULTI_IDS.has(`${groupId}`) || !Array.isArray(values)) return;
        const selected = [...new Set(values.map(validId).filter((value) => MOSCAROSSA_MULTI_OPTIONS[groupId]?.has(value)))];
        if (selected.length) normalized.multiSelects[groupId] = selected;
    });
    return normalized;
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
    const promotion = parsePromotionPeriod(adData.period || adData.schedule, typeAnnuncio);

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
        details: normalizeMoscarossaDetails(options.details),
        images,
        picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
        promotion: promotion.plan.name,
        promotionId: promotion.plan.id,
        promotionDays: promotion.days,
        imageLimit: promotion.plan.imageLimit,
        isFree: promotion.plan.name === "Free",
        availableCredit: Number(adData.availableCredit)
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

async function typePhone(page, value) {
    const phone = `${value || ""}`.trim();
    const input = await page.waitForSelector("#presenza_telefono", { visible: true, timeout: 30000 });
    await input.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await input.type(phone, { delay: 75 });
    await page.waitForFunction(
        (expected) => document.querySelector("#presenza_telefono")?.value === expected,
        { timeout: 10000 },
        phone
    );
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

async function extractRemoteId(page, fallback = "") {
    const remoteId = await page.evaluate(() => {
        const valid = (value) => /^\d{4,}$/.test(`${value || ""}`.trim()) ? `${value}`.trim() : "";
        const urlId = valid(new URL(location.href).searchParams.get("id_accompa"));
        if (urlId) return urlId;

        const fields = Array.from(document.querySelectorAll(
            "input[name='id_accompa'], [data-id-accompa], [data-id_accompa]"
        ));
        for (const field of fields) {
            const candidate = valid(
                field.value || field.dataset?.idAccompa || field.getAttribute("data-id_accompa")
            );
            if (candidate) return candidate;
        }

        const candidates = Array.from(document.querySelectorAll("a[href], [onclick], [data-id]"));
        for (const node of candidates) {
            const source = [
                node.getAttribute("href"),
                node.getAttribute("onclick"),
                node.getAttribute("data-id")
            ].filter(Boolean).join(" ");
            const explicit = source.match(/id_accompa(?:=|[^0-9]{1,12})(\d{4,})/i)?.[1];
            if (explicit) return explicit;
        }
        return "";
    }).catch(() => "");

    return remoteId || (/^\d{4,}$/.test(`${fallback || ""}`) ? `${fallback}` : "");
}

async function reuseExistingAdForPhone(page, phone) {
    await page.evaluate(() => {
        const input = document.querySelector("#presenza_telefono");
        if (!input) return;
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        input.dispatchEvent(new Event("focusout", { bubbles: true }));
    });

    const promptFound = await page.waitForFunction((targetPhone) => {
        const normalize = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
        };
        return Array.from(document.querySelectorAll("button, a, [role='button'], .btn"))
            .some((node) => visible(node) &&
                /continua con questo annuncio|continue with this ad/.test(normalize(node.textContent))
            );
    }, { timeout: 6000 }, `${phone}`.replace(/\D/g, "")).then(() => true).catch(() => false);

    if (!promptFound) return { reusedExisting: false, remoteId: "" };

    const selected = await page.evaluate((targetPhone) => {
        const normalize = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
        };
        const buttons = Array.from(document.querySelectorAll("button, a, [role='button'], .btn"))
            .filter((node) => visible(node) &&
                /continua con questo annuncio|continue with this ad/.test(normalize(node.textContent))
            );
        const containsTargetPhone = (node) => {
            let parent = node;
            for (let depth = 0; parent && depth < 7; depth += 1, parent = parent.parentElement) {
                if (normalize(parent.textContent).replace(/\D/g, "").includes(targetPhone)) return true;
            }
            return false;
        };
        const button = buttons.find(containsTargetPhone) || buttons[0];
        if (!button) return null;

        const container = button.closest("form, .modal, [role='dialog'], .swal2-popup, .bootbox, .panel, .card") || button.parentElement;
        const href = `${button.getAttribute("href") || ""}`;
        const onclick = `${button.getAttribute("onclick") || ""}`;
        const directId = `${button.getAttribute("data-id-accompa") ||
            button.getAttribute("data-id_accompa") || button.getAttribute("data-id") ||
            container?.querySelector("input[name='id_accompa']")?.value || ""}`.trim();
        const remoteId = (/^\d{4,9}$/.test(directId) ? directId : "") ||
            href.match(/id_accompa(?:=|[^0-9]{1,12})(\d{4,9})/i)?.[1] ||
            onclick.match(/(?:continua|continue|carica|load|modifica|edit)[^(]*\(\s*['\"]?(\d{4,9})/i)?.[1] || "";
        button.click();
        return { remoteId, text: normalize(button.textContent) };
    }, `${phone}`.replace(/\D/g, ""));

    if (!selected) return { reusedExisting: false, remoteId: "" };
    await delay(1800);
    const remoteId = await extractRemoteId(page, selected.remoteId);
    console.log("[moscarossa:existing] Reusing existing ad", { remoteId: remoteId || "pending detection" });
    return { reusedExisting: true, remoteId };
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

async function uploadImages(page, images, picsAudit, imageLimit = FREE_IMAGE_LIMIT) {
    const imagePaths = resolveImagePaths(images, picsAudit).slice(0, imageLimit);
    if (!imagePaths.length) {
        console.log("[moscarossa:images] No images selected for free publication.");
        return [];
    }

    const fileAudit = imagePaths.map((filePath) => {
        const stats = fs.statSync(filePath);
        return { path: filePath, bytes: stats.size, megabytes: Number((stats.size / 1024 / 1024).toFixed(2)) };
    });
    console.log("[moscarossa:images] Upload candidates", fileAudit.map((file) => ({
        file: path.basename(file.path),
        megabytes: file.megabytes
    })));
    const oversized = fileAudit.filter((file) => file.bytes > MAX_IMAGE_BYTES);
    if (oversized.length) {
        throw new Error(
            `Moscarossa accetta immagini fino a 5 MB. File troppo grandi: ${oversized.map((file) => `${path.basename(file.path)} (${file.megabytes} MB)`).join(", ")}`
        );
    }

    const empty = fileAudit.filter((file) => file.bytes === 0);
    if (empty.length) {
        throw new Error(`Moscarossa immagini vuote: ${empty.map((file) => path.basename(file.path)).join(", ")}`);
    }

    // Moscarossa enhances its visible file input with a thumbnail plugin. Sending
    // files to that element fires expensive synchronous handlers and can leave the
    // renderer unable to answer DOM.setFileInputFiles. Use a listener-free native
    // input in the same form: FormData still receives files[] normally, without
    // running the client-side preview plugin.
    const prepared = await page.evaluate((nativeInputId) => {
        const pluginInput = document.querySelector("input.fileuploader_upload[name='files[]']");
        const form = pluginInput?.closest("form") || document.querySelector("#dati_annuncio");
        if (!pluginInput || !form) return false;

        document.getElementById(nativeInputId)?.remove();
        pluginInput.removeAttribute("name");
        pluginInput.disabled = true;

        const nativeInput = document.createElement("input");
        nativeInput.type = "file";
        nativeInput.id = nativeInputId;
        nativeInput.name = "files[]";
        nativeInput.multiple = true;
        nativeInput.hidden = true;
        form.enctype = "multipart/form-data";
        form.appendChild(nativeInput);
        return true;
    }, NATIVE_UPLOAD_INPUT_ID);

    if (!prepared) throw new Error("Moscarossa input immagini non trovato nel modulo di pubblicazione.");

    const input = await page.waitForSelector(`#${NATIVE_UPLOAD_INPUT_ID}`, { timeout: 30000 });
    console.log(`[moscarossa:images] Assigning ${imagePaths.length} image(s) to native form input.`);
    await input.uploadFile(...imagePaths);

    const assignedFiles = await page.evaluate((nativeInputId) => {
        const files = Array.from(document.getElementById(nativeInputId)?.files || []);
        return files.map((file) => ({ name: file.name, size: file.size }));
    }, NATIVE_UPLOAD_INPUT_ID);
    if (assignedFiles.length !== imagePaths.length) {
        throw new Error(
            `Moscarossa ha ricevuto ${assignedFiles.length} immagini su ${imagePaths.length} nel modulo.`
        );
    }

    console.log(`[moscarossa:images] Prepared ${imagePaths.length} free-ad image(s).`);
    return imagePaths;
}

async function fillMoscarossaDetails(page, details = {}) {
    for (const [id, value] of Object.entries(details.tariffs || {})) {
        await setInput(page, `#sottospecifica_${id}`, value);
    }
    for (const [id, service] of Object.entries(details.services || {})) {
        await setCheckbox(page, `#check_${id}`, service.enabled);
        if (service.enabled && service.supplement) {
            await setInput(page, `#valore_check_${id}`, service.supplement);
        }
    }
    for (const [groupId, optionId] of Object.entries(details.selects || {})) {
        await selectNativeOption(page, `#specifiche_${groupId}`, optionId);
    }
    for (const values of Object.values(details.multiSelects || {})) {
        for (const optionId of values) {
            await setCheckbox(page, `#sottospecifica_${optionId}`, true);
        }
    }
    console.log("[moscarossa:details] Ulteriori specifiche compilate", {
        tariffs: Object.keys(details.tariffs || {}).length,
        services: Object.keys(details.services || {}).length,
        selects: Object.keys(details.selects || {}).length,
        multi: Object.values(details.multiSelects || {}).reduce((total, values) => total + values.length, 0)
    });
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

    // The telephone field can open Moscarossa's "existing ad" chooser. Handle
    // that branch before filling the rest because selecting an ad hydrates and
    // replaces the form values.
    await typePhone(page, data.phone);
    const existingAd = await reuseExistingAdForPhone(page, data.phone);

    const category = await selectNativeOption(page, "#id_categoria", data.category);
    if (!category) throw new Error(`Moscarossa categoria non trovata: ${data.category}`);
    await setInput(page, "input[name='nome']", data.contactName);
    await setInput(page, "textarea[name='titolo']", data.title);
    await setInput(page, "#descrizione", data.description);
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
    await fillMoscarossaDetails(page, data.details);
    if (existingAd.reusedExisting) {
        console.log("[moscarossa:images] Existing Moscarossa images preserved; new-ad upload skipped.");
    } else {
        await uploadImages(page, data.images, data.picsAudit, data.imageLimit);
    }
    await setCheckbox(page, "#regolamento", true);
    return existingAd;
}

async function findAndOpenPromotion(page, remoteId) {
    if (await page.$("#button_pubblica_gratis, #button_pubblica_gratis_aggiorna, .button_pubblica_gratis")) {
        return true;
    }

    const promotionControl = await page.evaluate(() => {
        const normalize = (value) => `${value || ""}`
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ").trim().toLowerCase();
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
        };
        const candidates = Array.from(document.querySelectorAll("a[href], button, [role='button'], .btn"))
            .filter(visible)
            .map((node) => {
                const text = normalize(node.textContent);
                const href = `${node.getAttribute("href") || ""}`;
                let score = 0;
                if (/promuovi\.php/i.test(href)) score += 100;
                if (/attiva una promozione|activate a promotion/.test(text)) score += 80;
                if (/^promuovi!?$|^promote!?$/.test(text)) score += 60;
                return { node, text, href, score };
            })
            .filter((candidate) => candidate.score > 0)
            .sort((left, right) => right.score - left.score);
        if (!candidates.length) return null;
        candidates[0].node.click();
        return { text: candidates[0].text, href: candidates[0].href };
    });

    if (!promotionControl) {
        if (!remoteId) return false;
        const promotionUrl = `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(remoteId)}`;
        console.log("[moscarossa:promotion] Promotion control not found; opening saved ad promotion URL", promotionUrl);
        await page.goto(promotionUrl, { waitUntil: "networkidle2", timeout: 60000 });
    } else {
        console.log("[moscarossa:promotion] Opening promotion", promotionControl);
    }

    return page.waitForSelector(
        "#button_pubblica_gratis, #button_pubblica_gratis_aggiorna, .button_pubblica_gratis",
        { visible: true, timeout: 60000 }
    ).then(() => true).catch(() => false);
}

async function continueToPromotion(page, existingAd = {}) {
    const continueButton = await page.waitForSelector(".buttonNext", { visible: true, timeout: 30000 });
    await continueButton.click();

    const firstStepCompleted = await page.waitForFunction(() => {
        const url = location.href.toLowerCase();
        if (/\/private\/(?:promuovi|vedi_annuncio_ut)\.php/.test(url)) return true;
        if (document.querySelector("#button_pubblica_gratis, #button_pubblica_gratis_aggiorna, .button_pubblica_gratis")) return true;
        const text = `${document.body?.innerText || ""}`.replace(/\s+/g, " ").toLowerCase();
        return /attiva una promozione|activate a promotion|promuovi!|promote!/.test(text);
    }, { timeout: 90000 }).then(() => true).catch(() => false);

    if (!firstStepCompleted) {
        const validation = await collectValidation(page);
        throw new Error(`Moscarossa primo passaggio non completato: ${JSON.stringify(validation)}`);
    }

    const remoteId = await extractRemoteId(page, existingAd.remoteId);
    if (!remoteId) throw new Error("Moscarossa non ha restituito id_accompa dopo Continua.");

    const promotionOpened = await findAndOpenPromotion(page, remoteId);
    if (!promotionOpened) {
        const validation = await collectValidation(page);
        const bodyText = await page.evaluate(() => `${document.body?.innerText || ""}`.replace(/\s+/g, " ").trim());
        if (/un solo annuncio ogni 10 giorni|only one free ad/i.test(bodyText)) {
            throw new MoscarossaWorkflowPendingError(
                "Moscarossa Free non disponibile: il limite dell'annuncio gratuito non consente una nuova attivazione.",
                { remoteId, reasonCode: "MOSCAROSSA_FREE_LIMIT" }
            );
        }
        throw new Error(`Pagina promozione Moscarossa non disponibile: ${JSON.stringify(validation)}`);
    }
    return remoteId;
}

async function clickPublishFree(page, remoteId) {
    const button = await page.waitForSelector(
        "#button_pubblica_gratis, #button_pubblica_gratis_aggiorna, .button_pubblica_gratis",
        { visible: true, timeout: 30000 }
    );
    const responsePromise = page.waitForResponse(
        (response) => /\/private\/promuovi_free\.php(?:\?|$)/i.test(response.url()),
        { timeout: 60000 }
    );
    await button.click();
    const response = await responsePromise;
    const responseBody = await response.text().catch(() => "");
    await delay(750);

    const result = await page.evaluate((expectedRemoteId) => {
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && !node.classList.contains("d-none");
        };
        const phoneLayers = Array.from(document.querySelectorAll(".div_verifica_telefono"));
        const publicLink = Array.from(document.querySelectorAll("a[href*='/girl-']"))
            .map((link) => link.href)
            .find((href) => href.includes(`/girl-${expectedRemoteId}.php`)) || "";
        return {
            content: `${document.querySelector("#div_dopo_free")?.innerText || ""}`.replace(/\s+/g, " ").trim(),
            phoneVerificationVisible: phoneLayers.some(visible),
            originalButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis")),
            updateFreeButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis_aggiorna")),
            publicLink
        };
    }, remoteId);

    const combined = `${responseBody} ${result.content}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const negative = /errore|non (?:puoi|possibile|consentito)|impossibile|verifica(?:re|zione).*telefon|codice sms|annuncio non visible|accesso negato/i;
    const positive = /pubblicat|annuncio (?:online|attiv|visibile)|complimenti|aggiorna annuncio gratis/i;

    if (result.phoneVerificationVisible || /verifica(?:re|zione).*telefon|codice sms/i.test(combined)) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa richiede la verifica SMS del telefono. Verifica il numero e riprendi lo stesso annuncio.",
            { remoteId, reasonCode: "MOSCAROSSA_WAITING_SMS" }
        );
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

    const responsePublicId = responseBody.match(/(?:https?:\/\/www\.moscarossa\.biz)?\/girl-(\d+)\.php/i)?.[1] || "";
    const publicUrl = result.publicLink ||
        `https://www.moscarossa.biz/girl-${responsePublicId || remoteId}.php`;
    return {
        ok: true,
        remoteId,
        publicUrl,
        response: combined.slice(0, 700)
    };
}

async function activatePaidPromotion(page, remoteId, data) {
    const planId = `${data.promotionId || ""}`;
    const days = Number.parseInt(data.promotionDays, 10);
    if (!["1", "2", "6", "7"].includes(planId) || !PROMOTION_DURATIONS.has(days)) {
        throw new Error(`Promozione Moscarossa non valida: ${data.promotion} / ${days} giorni.`);
    }

    const prepared = await page.evaluate((targetPlanId, targetDays) => {
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
        };
        const smsRequired = visible(document.querySelector("#div_richiesta_verifica_sms"));
        const form = document.querySelector("#form_promozione");
        const plan = document.querySelector("#select_promozione");
        if (!form || !plan) return { ok: false, smsRequired, reason: "form-not-found" };

        const option = Array.from(plan.options).find((item) => `${item.value}` === `${targetPlanId}`);
        if (!option) return { ok: false, smsRequired, reason: "plan-not-found" };
        plan.value = `${targetPlanId}`;
        plan.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof window.preselect_promo === "function") {
            window.preselect_promo(Number(targetPlanId), Number(targetDays));
        }
        return { ok: true, smsRequired, plan: `${option.textContent || ""}`.trim() };
    }, planId, days);

    if (prepared.smsRequired) {
        throw new MoscarossaWorkflowPendingError(
            `Moscarossa richiede la verifica SMS prima di attivare ${data.promotion}.`,
            { remoteId, reasonCode: "MOSCAROSSA_WAITING_SMS" }
        );
    }
    if (!prepared.ok) {
        throw new Error(`Modulo promozione Moscarossa non disponibile: ${prepared.reason}.`);
    }

    await page.waitForFunction((targetPlanId, targetDays) => {
        const plan = document.querySelector("#select_promozione");
        const duration = document.querySelector("#select_giorni");
        const price = document.querySelector("#prezzo b");
        return `${plan?.value || ""}` === `${targetPlanId}` &&
            `${duration?.value || ""}` === `${targetDays}` && Boolean(price?.textContent?.trim());
    }, { timeout: 30000 }, planId, days).catch(() => {});

    const quote = await page.evaluate((targetPlanId, targetDays) => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const matchingCell = Array.from(document.querySelectorAll("[onclick*='preselect_promo']"))
            .find((node) => {
                const source = `${node.getAttribute("onclick") || ""}`;
                const match = source.match(/preselect_promo\(\s*(\d+)\s*,\s*(\d+)/i);
                return match && match[1] === `${targetPlanId}` && match[2] === `${targetDays}`;
            });
        const priceText = clean(document.querySelector("#prezzo b")?.textContent) || clean(matchingCell?.textContent);
        const price = Number.parseInt(priceText.replace(/[^0-9]/g, ""), 10);
        const duration = document.querySelector("#select_giorni");
        if (duration && `${duration.value}` !== `${targetDays}`) {
            let option = Array.from(duration.options).find((item) => `${item.value}` === `${targetDays}`);
            if (!option) {
                option = new Option(`${targetDays} giorni`, `${targetDays}`, true, true);
                duration.appendChild(option);
            }
            duration.value = `${targetDays}`;
            duration.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const showcase = document.querySelector("#check_vetrina");
        const diamond = document.querySelector("#check_diamond");
        if (showcase) showcase.checked = false;
        if (diamond) diamond.checked = false;
        return { price: Number.isFinite(price) ? price : 0, priceText, url: location.href };
    }, planId, days);

    if (!quote.price) {
        throw new Error(`Moscarossa non ha restituito il prezzo per ${data.promotion}, ${days} giorni.`);
    }
    if (Number.isFinite(data.availableCredit) && data.availableCredit < quote.price) {
        throw new Error(
            `Crediti Moscarossa insufficienti: servono ${quote.price}, disponibili ${data.availableCredit}.`
        );
    }

    console.log("[moscarossa:promotion] Activating paid plan", {
        remoteId,
        plan: data.promotion,
        planId,
        days,
        price: quote.price,
        availableCredit: Number.isFinite(data.availableCredit) ? data.availableCredit : "unknown"
    });
    await captureScreenshot(page, `04-${data.promotion}-${days}-days-selected`);

    const navigation = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 }).catch(() => null);
    await page.evaluate(() => {
        const form = document.querySelector("#form_promozione");
        if (!form) throw new Error("Moscarossa promotion form disappeared before submit.");
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
    });
    const response = await navigation;
    await delay(1000);

    const result = await page.evaluate((expectedRemoteId, expectedPlan) => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const links = Array.from(document.querySelectorAll("a[href]"))
            .map((link) => link.href)
            .filter((href) => new RegExp(`/(?:girl|trans|boy|massage)-${expectedRemoteId}\\.php`, "i").test(href));
        return {
            body: clean(document.body?.innerText).slice(0, 3000),
            url: location.href,
            publicUrl: links[0] || "",
            stillOnPromotionForm: Boolean(document.querySelector("#form_promozione")),
            planVisible: new RegExp(expectedPlan, "i").test(clean(document.body?.innerText))
        };
    }, remoteId, data.promotion);

    const negative = /crediti insufficienti|credito insufficiente|pagamento rifiutato|si e verificato un errore|operazione non riuscita|accesso negato/i;
    if (/login-escort/i.test(result.url)) {
        const error = new Error("Moscarossa session expired while activating the paid promotion.");
        error.statusCode = 401;
        throw error;
    }
    if (response && (response.status() < 200 || response.status() >= 400)) {
        throw new Error(`Moscarossa promozione HTTP ${response.status()}: ${result.body.slice(0, 600)}`);
    }
    if (negative.test(result.body)) {
        throw new Error(`Moscarossa ha rifiutato la promozione: ${result.body.slice(0, 700)}`);
    }

    const positive = /promozione.{0,80}(?:attiv|acquist|success)|annuncio.{0,80}(?:promoss|pubblicat)|operazione.{0,40}(?:complet|success)|scade il/i;
    const accepted = Boolean(result.publicUrl) || positive.test(result.body) ||
        (!result.stillOnPromotionForm && !/\/promuovi2?\.php/i.test(result.url));
    if (!accepted) {
        throw new Error(
            `Risposta Moscarossa non riconosciuta dopo l'attivazione ${data.promotion}: ${result.body.slice(0, 700)}`
        );
    }

    const publicUrl = result.publicUrl || `https://www.moscarossa.biz/girl-${remoteId}.php`;
    return {
        ok: true,
        remoteId,
        publicUrl,
        plan: data.promotion,
        days,
        creditsConsumed: quote.price,
        response: result.body.slice(0, 700)
    };
}

async function activateSelectedPromotion(page, remoteId, data) {
    return data.isFree
        ? clickPublishFree(page, remoteId)
        : activatePaidPromotion(page, remoteId, data);
}

async function postPhoneVerification(page, fields) {
    const result = await page.evaluate(async (endpoint, payload) => {
        const body = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
            if (`${value ?? ""}` !== "") body.set(key, `${value}`);
        });
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: body.toString()
        });
        return { status: response.status, body: (await response.text()).trim(), url: response.url };
    }, PHONE_VERIFICATION_URL, fields);

    if (/login-escort/i.test(result.url) || result.status === 401 || result.status === 403) {
        const error = new Error("Moscarossa session expired during phone verification.");
        error.statusCode = 401;
        throw error;
    }
    if (result.status < 200 || result.status >= 300) {
        const error = new Error(`Moscarossa phone verification HTTP ${result.status}.`);
        error.statusCode = result.status || 502;
        throw error;
    }
    return result.body;
}

async function openPhoneVerificationAd(page, { phone, remoteId = "" } = {}) {
    let resolvedRemoteId = /^\d{4,9}$/.test(`${remoteId || ""}`) ? `${remoteId}` : "";

    if (!resolvedRemoteId) {
        await page.goto(PUBLISH_URL, { waitUntil: "networkidle2", timeout: 60000 });
        if (/login-escort/i.test(page.url()) || await page.$("#form_login")) {
            const error = new Error("Moscarossa session expired before phone verification.");
            error.statusCode = 401;
            throw error;
        }
        await page.waitForSelector("#dati_annuncio", { visible: true, timeout: 30000 });
        await typePhone(page, phone);
        const existingAd = await reuseExistingAdForPhone(page, phone);
        resolvedRemoteId = await extractRemoteId(page, existingAd.remoteId);
        if (!existingAd.reusedExisting || !resolvedRemoteId) {
            const error = new Error(
                "Moscarossa non ha ancora un annuncio associato a questo telefono. " +
                "Salva e avvia prima la pubblicazione; quando Moscarossa richiede l'SMS potrai verificarlo senza perdere l'annuncio."
            );
            error.statusCode = 409;
            error.reasonCode = "MOSCAROSSA_REQUIRES_DRAFT";
            throw error;
        }
    }

    const promotionUrl = `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(resolvedRemoteId)}`;
    await page.goto(promotionUrl, { waitUntil: "networkidle2", timeout: 60000 });
    if (/login-escort/i.test(page.url()) || await page.$("#form_login")) {
        const error = new Error("Moscarossa session expired before phone verification.");
        error.statusCode = 401;
        throw error;
    }
    return resolvedRemoteId;
}

async function sendPhoneVerificationCode(page, { phone, remoteId = "" } = {}) {
    const normalizedPhone = `${phone || ""}`.replace(/\D/g, "");
    if (!/^\d{6,15}$/.test(normalizedPhone)) {
        const error = new Error("Numero di telefono Moscarossa non valido.");
        error.statusCode = 400;
        throw error;
    }
    let resolvedRemoteId = "";
    try {
        resolvedRemoteId = await openPhoneVerificationAd(page, { phone: normalizedPhone, remoteId });
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId}-01-promotion-page`);
        const response = await postPhoneVerification(page, {
            telefono: normalizedPhone,
            inviare: "1",
            id_accompa: resolvedRemoteId
        });
        if (response !== "1") {
            const error = new Error(`Moscarossa non ha inviato il codice SMS: ${response || "risposta vuota"}`);
            error.statusCode = 422;
            throw error;
        }
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId}-02-code-requested`);
        return { ok: true, status: "code_sent", remoteId: resolvedRemoteId };
    } catch (error) {
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId || "unknown"}-error-send-code`);
        throw error;
    }
}

async function verifyPhoneCode(page, { phone, code, remoteId, resume = false, promotion = {} } = {}) {
    const normalizedPhone = `${phone || ""}`.replace(/\D/g, "");
    const normalizedCode = `${code || ""}`.replace(/\D/g, "");
    if (!/^\d{6,15}$/.test(normalizedPhone) || !/^\d{4,8}$/.test(normalizedCode)) {
        const error = new Error("Numero di telefono o codice SMS Moscarossa non valido.");
        error.statusCode = 400;
        throw error;
    }
    let resolvedRemoteId = "";
    try {
        resolvedRemoteId = await openPhoneVerificationAd(page, { phone: normalizedPhone, remoteId });
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId}-03-before-code-check`);
        const response = await postPhoneVerification(page, {
            telefono: normalizedPhone,
            codice: normalizedCode
        });
        if (response !== "1") {
            const error = new Error("Codice SMS Moscarossa errato o scaduto.");
            error.statusCode = 422;
            throw error;
        }

        await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId}-04-phone-verified`);
        if (!resume) return { ok: true, status: "verified", remoteId: resolvedRemoteId };

        const promotionData = buildPublishData({
            typeAnnuncio: promotion.plan || "Free",
            period: promotion.period || "",
            availableCredit: promotion.availableCredit
        });
        const publicationResult = await activateSelectedPromotion(page, resolvedRemoteId, promotionData);
        await captureScreenshot(
            page,
            `phone-verification-${resolvedRemoteId}-05-${promotionData.promotion}-published`
        );
        return { ...publicationResult, status: "published" };
    } catch (error) {
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId || "unknown"}-error-verify-or-resume`);
        throw error;
    }
}

async function publishAd(page, adData = {}) {
    const data = buildPublishData(adData);
    console.log("[moscarossa:publish] Publishing ad", {
        title: data.title,
        category: data.category,
        city: data.city,
        images: Math.min(resolveImagePaths(data.images, data.picsAudit).length, data.imageLimit),
        promotion: data.promotion,
        days: data.promotionDays
    });

    try {
        await page.goto(PUBLISH_URL, { waitUntil: "networkidle2", timeout: 60000 });
        if (/login-escort/i.test(page.url()) || await page.$("#form_login")) {
            throw new Error(`Moscarossa session expired; redirected to login. URL: ${page.url()}`);
        }
        await page.waitForSelector("#dati_annuncio", { visible: true, timeout: 30000 });
        await captureScreenshot(page, "01-open-publish-page");
        const existingAd = await fillFirstStep(page, data);
        await captureScreenshot(page, "02-first-step-filled");

        const remoteId = await continueToPromotion(page, existingAd);
        await captureScreenshot(page, "03-promotion-step");
        const promotionResult = await activateSelectedPromotion(page, remoteId, data);
        await captureScreenshot(page, `05-${data.promotion}-published`);

        const url = promotionResult.publicUrl || `${VIEW_URL}?id_accompa=${encodeURIComponent(remoteId)}`;
        console.log("[moscarossa:publish] Publication completed", {
            remoteId,
            url,
            promotion: data.promotion,
            days: data.promotionDays,
            creditsConsumed: promotionResult.creditsConsumed || 0
        });
        return {
            ok: true,
            payload: {
                idpriv: remoteId,
                id_accompa: remoteId,
                promotion: data.promotion,
                days: data.promotionDays
            },
            url,
            creditsConsumed: promotionResult.creditsConsumed || 0,
            freePublication: data.isFree,
            response: promotionResult.response
        };
    } catch (error) {
        const protocolUnavailable = /ProtocolError|Runtime\.callFunctionOn timed out|DOM\.setFileInputFiles timed out|Target closed|Session closed/i
            .test(`${error?.name || ""} ${error?.message || error || ""}`);
        if (protocolUnavailable) {
            console.warn(`[moscarossa:screenshot] Skipped error screenshot because the browser protocol is unavailable: ${error.message}`);
        } else {
            await captureScreenshot(page, `error-${error.message}`);
        }
        throw error;
    }
}

module.exports = {
    buildPublishData,
    captureScreenshot,
    clickPublishFree,
    publishAd,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    resolveImagePaths
};
