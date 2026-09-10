const fs = require("fs");
const path = require("path");

const PUBLISH_URL = "https://www.moscarossa.biz/private/inserimento.php";
const VIEW_URL = "https://www.moscarossa.biz/private/vedi_annuncio_ut.php";
const CREDIT_URL = "https://www.moscarossa.biz/private/crediti.php";
const PHONE_VERIFICATION_URL = "https://www.moscarossa.biz/private/ajax_verifica_telefono.php";
const SCREENSHOT_DIR = path.join("./screenshots", "moscarossa-publish");
const FREE_IMAGE_LIMIT = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FREE_PUBLISH_SELECTOR = [
    "#button_pubblica_gratis",
    "#button_pubblica_gratis_aggiorna",
    ".button_pubblica_gratis",
    "[onclick*='pubblica_free']"
].join(", ");
const PROMOTION_PLANS = Object.freeze({
    free: { name: "Free", id: "0", imageLimit: 5 },
    premium: { name: "Premium", id: "1", imageLimit: 10 },
    top: { name: "Top", id: "2", imageLimit: 10 },
    red: { name: "Red", id: "6", imageLimit: 15 },
    gold: { name: "Gold", id: "7", imageLimit: 20 }
});
const PROMOTION_DURATIONS = new Set([1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 25, 30]);

class MoscarossaWorkflowPendingError extends Error {
    constructor(message, {
        remoteId = "",
        reasonCode = "MOSCAROSSA_WAITING_ACTION",
        url = "",
        payed = false,
        creditsConsumed = 0
    } = {}) {
        super(message);
        this.name = "MoscarossaWorkflowPendingError";
        this.remoteId = `${remoteId || ""}`;
        this.scheduleState = "ALERT";
        this.reasonCode = reasonCode;
        this.url = url || (this.remoteId
            ? `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(this.remoteId)}`
            : "");
        this.payed = Boolean(payed);
        this.creditsConsumed = Number(creditsConsumed || 0);
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

async function readAvailableCredit(page) {
    return page.evaluate(async (creditUrl) => {
        const separator = creditUrl.includes("?") ? "&" : "?";
        const response = await fetch(`${creditUrl}${separator}_bky=${Date.now()}`, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        const html = await response.text();
        const documentCopy = new DOMParser().parseFromString(html, "text/html");
        const text = `${documentCopy.body?.innerText || documentCopy.body?.textContent || ""}`
            .replace(/\s+/g, " ")
            .trim();
        const match = text.match(/crediti\s+a\s+disposizione\s*:?\s*([0-9][0-9.,]*)/i);
        const credit = match ? Number(match[1].replace(/[^0-9]/g, "")) : null;
        return {
            ok: response.ok,
            status: response.status,
            url: response.url,
            login: /login-escort|id=["']form_login/i.test(`${response.url} ${html}`),
            credit: Number.isFinite(credit) ? credit : null
        };
    }, CREDIT_URL);
}

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
    const compactAddons = details.a && typeof details.a === "object" ? details.a : {};
    const epochDayToDate = (day) => {
        const numericDay = Number(day);
        return Number.isInteger(numericDay) && numericDay > 10000 && numericDay < 100000
            ? new Date(numericDay * 86400000).toISOString().slice(0, 10)
            : "";
    };
    const rawAddons = details.addons && typeof details.addons === "object"
        ? details.addons
        : {
            vetrina: { enabled: compactAddons.v?.[0], days: compactAddons.v?.[1] },
            diamond: {
                enabled: compactAddons.d?.[0],
                dates: Array.isArray(compactAddons.d?.[1])
                    ? compactAddons.d[1].map(epochDayToDate).filter(Boolean)
                    : []
            }
        };
    const diamondDates = Array.isArray(rawAddons.diamond?.dates)
        ? [...new Set(rawAddons.diamond.dates
            .map((date) => `${date || ""}`.trim())
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().slice(0, 30)
        : [];
    const diamondEnabled = isEnabled(rawAddons.diamond?.enabled) && diamondDates.length > 0;
    const vetrinaDays = Number.parseInt(rawAddons.vetrina?.days || requestedDays || 1, 10);
    const storedPlan = normalizePromotion(planName);
    const legacyPlan = normalizePromotion(details.plan);
    // New schedules store the selected Moscarossa plan in typeAnnuncio. Legacy
    // rows used Free there and stored the actual paid plan only in period.
    const plan = storedPlan.name !== "Free" ? storedPlan : legacyPlan;
    return {
        plan,
        days: PROMOTION_DURATIONS.has(requestedDays) ? requestedDays : 1,
        addons: {
            vetrina: {
                enabled: plan.name !== "Free" && !diamondEnabled && isEnabled(rawAddons.vetrina?.enabled),
                days: PROMOTION_DURATIONS.has(vetrinaDays) ? vetrinaDays : 1
            },
            diamond: { enabled: plan.name !== "Free" && diamondEnabled, dates: diamondDates }
        }
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
    if (isEnabled(adData.hasPremium) && promotion.plan.name === "Free") {
        throw new Error(
            "La schedulazione Moscarossa e marcata come pagata ma non contiene un piano " +
            "Premium, Top, Red o Gold valido. Pubblicazione Free annullata."
        );
    }

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
        addons: promotion.addons,
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

    await page.waitForFunction(() => {
        const transientText = /sto cercando|ricerca|caricamento|searching|loading|digita|inserisci almeno/i;
        const emptyText = /nessun risultato|nessun comune|no results/i;
        return Array.from(document.querySelectorAll(
            ".select2-container--open .select2-results__option"
        )).some((option) => {
            const text = `${option.textContent || ""}`.replace(/\s+/g, " ").trim();
            if (emptyText.test(text)) return true;
            return Boolean(text) &&
                !transientText.test(text) &&
                !option.classList.contains("loading-results") &&
                option.getAttribute("aria-disabled") !== "true";
        });
    }, { timeout: 30000 });

    const resultHandles = await page.$$(".select2-container--open .select2-results__option");
    const candidates = [];
    for (const handle of resultHandles) {
        const result = await page.evaluate((node) => ({
            text: `${node.textContent || ""}`.replace(/\s+/g, " ").trim(),
            loading: node.classList.contains("loading-results"),
            disabled: node.getAttribute("aria-disabled") === "true"
        }), handle);
        if (
            result.text &&
            !result.loading &&
            !result.disabled &&
            !/sto cercando|ricerca|caricamento|searching|loading|digita|inserisci almeno|nessun risultato|nessun comune|no results/i.test(result.text)
        ) {
            candidates.push({ handle, text: result.text });
        }
    }
    const target = normalizeKey(city);
    const targetWithoutProvince = normalizeKey(`${city}`.replace(/\s*\([a-z]{2}\)\s*$/i, ""));
    const matchesCity = (candidate) => {
        const key = normalizeKey(candidate.text);
        return key === target ||
            key === targetWithoutProvince ||
            key.startsWith(`${targetWithoutProvince} `) ||
            targetWithoutProvince.startsWith(`${key} `);
    };
    const match = candidates.find(matchesCity);

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

    // Moscarossa's FileUploader owns the image list sent by the wizard. A separate
    // native input can contain File objects but is ignored by the site's submit
    // handler, which produces a published ad with zero photos.
    const input = await page.waitForSelector("input.fileuploader_upload[name='files[]']", {
        timeout: 30000
    });
    await page.evaluate(() => {
        const pluginInput = document.querySelector("input.fileuploader_upload");
        if (!pluginInput) return;
        pluginInput.disabled = false;
        pluginInput.name = "files[]";
    });

    console.log(`[moscarossa:images] Sending ${imagePaths.length} image(s) through Moscarossa FileUploader.`);
    await input.uploadFile(...imagePaths);

    await page.waitForFunction((expected) => {
        const pluginInput = document.querySelector("input.fileuploader_upload[name='files[]']");
        const inputCount = pluginInput?.files?.length || 0;
        const itemCount = document.querySelectorAll(
            ".fileuploader-items-list .fileuploader-item, .fileuploader-items-list > li"
        ).length;
        return inputCount >= expected || itemCount >= expected;
    }, { timeout: 90000 }, imagePaths.length).catch(() => {});

    const uploaderState = await page.evaluate(() => ({
        inputFiles: Array.from(
            document.querySelector("input.fileuploader_upload[name='files[]']")?.files || []
        ).map((file) => ({ name: file.name, size: file.size })),
        renderedItems: document.querySelectorAll(
            ".fileuploader-items-list .fileuploader-item, .fileuploader-items-list > li"
        ).length,
        serializedList: `${document.querySelector("input[name='fileuploader-list-files']")?.value || ""}`.slice(0, 500)
    }));
    if (uploaderState.inputFiles.length < imagePaths.length && uploaderState.renderedItems < imagePaths.length) {
        throw new Error(
            `Moscarossa FileUploader non ha registrato tutte le immagini: ` +
            `${uploaderState.inputFiles.length} file nel campo, ${uploaderState.renderedItems} anteprime, ` +
            `${imagePaths.length} richieste.`
        );
    }

    console.log("[moscarossa:images] Moscarossa FileUploader ready", {
        requested: imagePaths.length,
        inputFiles: uploaderState.inputFiles.length,
        renderedItems: uploaderState.renderedItems
    });
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

async function openMoscarossaPromotionPage(page, remoteId, context = "promotion") {
    const resolvedRemoteId = `${remoteId || ""}`.trim();
    const promotionUrl = `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(resolvedRemoteId)}`;
    let response = null;

    try {
        response = await page.goto(promotionUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });
    } catch (error) {
        if (!/TimeoutError|Navigation timeout/i.test(`${error?.name || ""} ${error?.message || ""}`)) {
            throw error;
        }

        const partialPage = await page.evaluate((expectedRemoteId) => {
            const url = location.href;
            const currentId = new URL(url).searchParams.get("id_accompa") || "";
            return {
                url,
                currentId,
                hasBody: Boolean(document.body),
                hasPromotionContent: Boolean(document.querySelector(
                    "#button_pubblica_gratis, #button_pubblica_gratis_aggiorna, .button_pubblica_gratis, " +
                    "#form_promozione, #form_plus_vetrina, #form_promozione_diamond, .div_verifica_telefono"
                )),
                expectedRemoteId
            };
        }, resolvedRemoteId).catch(() => null);
        const usableTarget = partialPage?.hasBody &&
            /\/private\/promuovi\.php/i.test(partialPage.url) &&
            `${partialPage.currentId}` === resolvedRemoteId;
        if (!usableTarget) throw error;

        console.warn(`[moscarossa:promotion] ${context} navigation timed out after the target document loaded; continuing with page checks`, {
            remoteId: resolvedRemoteId,
            url: partialPage.url,
            promotionContent: partialPage.hasPromotionContent
        });
    }

    if (response && response.status() >= 400) {
        throw new Error(`Moscarossa ${context} page HTTP ${response.status()}.`);
    }
    if (/login-escort/i.test(page.url()) || await page.$("#form_login")) {
        const error = new Error(`Moscarossa session expired while opening the ${context} page.`);
        error.statusCode = 401;
        throw error;
    }

    return promotionUrl;
}

async function inspectMoscarossaEditorPage(page, expectedRemoteId) {
    return page.evaluate((remoteId) => {
        const url = location.href;
        const currentId = (() => {
            try { return new URL(url).searchParams.get("id_accompa") || ""; } catch { return ""; }
        })();
        const formId = `${document.querySelector(
            "#dati_annuncio input[name='id_accompa'], input[name='id_accompa']"
        )?.value || ""}`.trim();
        const resolvedId = currentId || formId;
        return {
            url,
            currentId: resolvedId,
            hasForm: Boolean(document.querySelector("#dati_annuncio")),
            hasImageInput: Boolean(document.querySelector("input.fileuploader_upload[name='files[]']")),
            hasLoginForm: Boolean(document.querySelector("#form_login")),
            matchesRemoteId: Boolean(resolvedId) && `${resolvedId}` === `${remoteId}`
        };
    }, `${expectedRemoteId || ""}`);
}

async function openMoscarossaEditorPage(page, remoteId, context = "existing ad editor") {
    const resolvedRemoteId = `${remoteId || ""}`.trim();
    const editUrl = `${PUBLISH_URL}?id_accompa=${encodeURIComponent(resolvedRemoteId)}#f`;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        let response = null;
        try {
            response = await page.goto(editUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000
            });
        } catch (error) {
            lastError = error;
            if (!/TimeoutError|Navigation timeout/i.test(`${error?.name || ""} ${error?.message || ""}`)) {
                throw error;
            }

            await page.evaluate(() => window.stop()).catch(() => {});
            await delay(500);
            const partial = await inspectMoscarossaEditorPage(page, resolvedRemoteId).catch(() => null);
            if (partial?.hasForm && partial.hasImageInput && partial.matchesRemoteId && !partial.hasLoginForm) {
                console.warn(`[moscarossa:images] ${context} navigation timed out after the editor became usable; continuing`, {
                    remoteId: resolvedRemoteId,
                    url: partial.url,
                    attempt
                });
                return { editUrl, recoveredFromTimeout: true, state: partial };
            }

            if (attempt < 2) {
                console.warn(`[moscarossa:images] ${context} navigation timed out before the editor was usable; retrying`, {
                    remoteId: resolvedRemoteId,
                    url: page.url(),
                    attempt
                });
                await page.goto("about:blank", { waitUntil: "load", timeout: 10000 }).catch(() => {});
                continue;
            }
            error.remoteId = resolvedRemoteId;
            error.url = editUrl;
            throw error;
        }

        if (response && response.status() >= 400) {
            const error = new Error(`Moscarossa ${context} HTTP ${response.status()}.`);
            error.remoteId = resolvedRemoteId;
            error.url = editUrl;
            throw error;
        }

        const state = await inspectMoscarossaEditorPage(page, resolvedRemoteId);
        if (state.hasLoginForm || /login-escort/i.test(state.url)) {
            const error = new Error(`Moscarossa session expired while opening the ${context}.`);
            error.statusCode = 401;
            error.remoteId = resolvedRemoteId;
            error.url = editUrl;
            throw error;
        }
        if (state.hasForm && state.hasImageInput && state.matchesRemoteId) {
            return { editUrl, recoveredFromTimeout: false, state };
        }

        lastError = new Error(
            `Moscarossa ${context} did not expose the advertisement form or image uploader. URL: ${state.url}`
        );
        if (attempt < 2) {
            await page.goto("about:blank", { waitUntil: "load", timeout: 10000 }).catch(() => {});
        }
    }

    lastError.remoteId = resolvedRemoteId;
    lastError.url = editUrl;
    throw lastError;
}

async function inspectPromotionState(page, expectedRemoteId = "") {
    return page.evaluate((remoteId, freeSelector) => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" &&
                style.opacity !== "0" && !node.classList.contains("d-none") &&
                node.getClientRects().length > 0;
        };
        const url = location.href;
        const body = clean(document.body?.innerText);
        const freeButtons = Array.from(document.querySelectorAll(freeSelector));
        const visibleSmsNodes = Array.from(document.querySelectorAll([
            ".div_verifica_telefono",
            ".avviso_verifica_telefono",
            "#div_richiesta_verifica_sms",
            ".pulsante_invia_codice",
            ".form_controllo_numero",
            "#codice"
        ].join(", "))).filter(visible);
        const smsText = /verifica(?:re|zione)? (?:del |il )?telefono(?: tramite)? sms|codice di verifica|codice ricevuto via sms|invia il codice/i.test(body);
        const freeLimit = /un solo annuncio (?:gratuito|free).{0,80}(?:10 giorni|per utente)|ogni utente puo inserire un solo annuncio ogni 10 giorni/i.test(
            body.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );
        const alreadyPublished = /annuncio pubblicato|ad published|online fino al|online until/i.test(body);
        const currentId = (() => {
            try { return new URL(url).searchParams.get("id_accompa") || ""; } catch { return ""; }
        })();
        const isPromotionUrl = /\/private\/promuovi\.php/i.test(url) &&
            (!remoteId || !currentId || `${currentId}` === `${remoteId}`);

        return {
            url,
            currentId,
            isPromotionUrl,
            freeButtonPresent: freeButtons.length > 0,
            freeButtonVisible: freeButtons.some(visible),
            paidFormPresent: Boolean(document.querySelector("#form_promozione, #select_promozione")),
            alreadyPublished,
            freeUpdateCallable: typeof window.pubblica_free === "function",
            smsRequired: visibleSmsNodes.length > 0 || smsText,
            freeLimit,
            bodyExcerpt: body.slice(0, 900)
        };
    }, `${expectedRemoteId || ""}`, FREE_PUBLISH_SELECTOR);
}

async function reactivateSuspendedAdvertisement(page, remoteId) {
    const resolvedRemoteId = `${remoteId || ""}`.trim();
    const suspension = await page.evaluate(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const normalize = (value) => clean(value)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" &&
                style.opacity !== "0" && node.getClientRects().length > 0;
        };
        const body = normalize(document.body?.innerText);
        const suspended = /(?:il tuo )?annuncio e sospeso|(?:your )?ad(?:vertisement)? is suspended/.test(body);
        if (!suspended) return { suspended: false, url: location.href };

        const candidates = Array.from(document.querySelectorAll(
            "a[href], button, input[type='button'], input[type='submit'], [role='button']"
        )).filter(visible);
        const control = candidates.find((node) => {
            const label = normalize(node.textContent || node.value || node.title || node.getAttribute("aria-label"));
            return /riattiva (?:il )?tuo annuncio|reactivate your ad/.test(label);
        });
        if (!control) return { suspended: true, controlFound: false, url: location.href };

        control.setAttribute("data-bky-moscarossa-reactivate", "1");
        return {
            suspended: true,
            controlFound: true,
            text: clean(control.textContent || control.value || control.title),
            href: control instanceof HTMLAnchorElement && /^https?:/i.test(control.href)
                ? control.href
                : "",
            url: location.href
        };
    });

    if (!suspension.suspended) return { reactivated: false };
    if (!suspension.controlFound) {
        throw new Error(
            `Moscarossa annuncio ${resolvedRemoteId} sospeso, ma il pulsante Riattiva il tuo annuncio non è disponibile.`
        );
    }

    console.log("[moscarossa:promotion] Reactivating suspended remote ad", {
        remoteId: resolvedRemoteId,
        control: suspension.text,
        url: suspension.url
    });
    await captureScreenshot(page, `reactivate-${resolvedRemoteId}-01-suspended`);

    const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 })
        .catch(() => null);
    await page.click("[data-bky-moscarossa-reactivate='1']");
    await Promise.race([navigation, delay(10000)]);

    await openMoscarossaPromotionPage(page, resolvedRemoteId, "reactivated ad promotion");
    const after = await page.evaluate(() => {
        const body = `${document.body?.innerText || ""}`
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ").toLowerCase();
        return {
            suspended: /(?:il tuo )?annuncio e sospeso|(?:your )?ad(?:vertisement)? is suspended/.test(body),
            url: location.href,
            excerpt: body.slice(0, 500)
        };
    });
    if (after.suspended) {
        throw new Error(
            `Moscarossa non ha confermato la riattivazione dell'annuncio ${resolvedRemoteId}: ${after.excerpt}`
        );
    }

    await captureScreenshot(page, `reactivate-${resolvedRemoteId}-02-promotion-page`);
    console.log("[moscarossa:promotion] Suspended remote ad reactivated", {
        remoteId: resolvedRemoteId,
        url: after.url
    });
    return { reactivated: true, url: after.url };
}

async function waitForPromotionState(page, remoteId, timeout = 30000, requireFreeAction = false) {
    await page.waitForFunction((expectedRemoteId, freeSelector, waitForFreeAction) => {
        const visible = (node) => {
            if (!node) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" &&
                style.opacity !== "0" && !node.classList.contains("d-none") &&
                node.getClientRects().length > 0;
        };
        const body = `${document.body?.innerText || ""}`.replace(/\s+/g, " ");
        const normalizedBody = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const url = location.href;
        const currentId = (() => {
            try { return new URL(url).searchParams.get("id_accompa") || ""; } catch { return ""; }
        })();
        const correctPromotionUrl = /\/private\/promuovi\.php/i.test(url) &&
            (!expectedRemoteId || !currentId || `${currentId}` === `${expectedRemoteId}`);
        if (!correctPromotionUrl) return false;

        const freeReady = Array.from(document.querySelectorAll(freeSelector)).some(visible);
        const paidReady = Boolean(document.querySelector("#form_promozione, #select_promozione"));
        const smsReady = Array.from(document.querySelectorAll([
            ".div_verifica_telefono",
            ".avviso_verifica_telefono",
            "#div_richiesta_verifica_sms",
            ".pulsante_invia_codice",
            ".form_controllo_numero",
            "#codice"
        ].join(", "))).some(visible) ||
            /verifica(?:re|zione)? (?:del |il )?telefono(?: tramite)? sms|codice di verifica|codice ricevuto via sms|invia il codice/i.test(body);
        const limited = /un solo annuncio (?:gratuito|free).{0,80}(?:10 giorni|per utente)|ogni utente puo inserire un solo annuncio ogni 10 giorni/i.test(normalizedBody);
        const existingFreeReady = /annuncio pubblicato|ad published|online fino al|online until/i.test(body) &&
            typeof window.pubblica_free === "function";
        return freeReady || existingFreeReady || smsReady || limited || (!waitForFreeAction && paidReady);
    }, { timeout }, `${remoteId || ""}`, FREE_PUBLISH_SELECTOR, requireFreeAction).catch(() => {});

    return inspectPromotionState(page, remoteId);
}

async function readMoscarossaImageState(page, remoteId = "") {
    return page.evaluate((expectedRemoteId) => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const candidates = Array.from(document.querySelectorAll("span, p, div"))
            .map((node) => clean(node.textContent))
            .filter((text) => text.length > 0 && text.length <= 100);
        let count = null;
        let countText = "";
        for (const text of candidates) {
            const match = text.match(/(?:^|\s)(\d+)\s*(?:foto|photos?)\s*,?\s*(\d+)\s*videos?(?:\s|$)/i);
            if (!match) continue;
            count = Number.parseInt(match[1], 10);
            countText = text;
            break;
        }
        const publicUrl = Array.from(document.querySelectorAll("a[href]"))
            .map((link) => link.href)
            .find((href) => new RegExp(`/(?:girl|trans|boy|massage)-${expectedRemoteId}\\.php`, "i").test(href)) || "";
        return { count, countText, publicUrl, url: location.href };
    }, `${remoteId || ""}`);
}

async function waitForMoscarossaImages(page, remoteId, timeout = 45000) {
    await page.waitForFunction(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        return Array.from(document.querySelectorAll("span, p, div"))
            .map((node) => clean(node.textContent))
            .filter((text) => text.length > 0 && text.length <= 100)
            .some((text) => {
                const match = text.match(/(?:^|\s)(\d+)\s*(?:foto|photos?)\s*,?\s*(\d+)\s*videos?(?:\s|$)/i);
                return match && Number.parseInt(match[1], 10) > 0;
            });
    }, { timeout }).catch(() => {});
    return readMoscarossaImageState(page, remoteId);
}

async function findAndOpenPromotion(page, remoteId) {
    let state = await inspectPromotionState(page, remoteId).catch(() => null);
    if (state?.isPromotionUrl &&
        (state.freeButtonVisible || state.paidFormPresent || state.smsRequired || state.freeLimit)) {
        console.log("[moscarossa:promotion] Promotion page state", state);
        return state;
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
        await openMoscarossaPromotionPage(page, remoteId, "publication promotion");
    } else {
        console.log("[moscarossa:promotion] Opening promotion", promotionControl);
    }

    state = await waitForPromotionState(page, remoteId, 30000);
    console.log("[moscarossa:promotion] Promotion page state", state);
    return state;
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

    let promotionState;
    try {
        promotionState = await findAndOpenPromotion(page, remoteId);
    } catch (error) {
        error.remoteId = error.remoteId || remoteId;
        error.url = error.url ||
            `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(remoteId)}`;
        throw error;
    }
    if (!promotionState?.isPromotionUrl) {
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

async function syncImagesForExistingAd(page, remoteId, data) {
    const imagePaths = resolveImagePaths(data.images, data.picsAudit).slice(0, data.imageLimit);
    if (!imagePaths.length) return { count: 0, skipped: true };

    console.log("[moscarossa:images] Existing ad has no photos; synchronizing selected website images", {
        remoteId,
        images: imagePaths.length
    });
    const editorPage = await page.browserContext().newPage();
    editorPage.setDefaultTimeout(30000);
    editorPage.setDefaultNavigationTimeout(60000);
    const sourceUserAgent = await page.evaluate(() => navigator.userAgent).catch(() => "");
    if (sourceUserAgent) await editorPage.setUserAgent(sourceUserAgent);
    if (page.viewport()) await editorPage.setViewport(page.viewport());

    try {
        await openMoscarossaEditorPage(editorPage, remoteId, "existing ad image editor");
        await editorPage.waitForSelector("#dati_annuncio", { visible: true, timeout: 30000 });
        await uploadImages(editorPage, data.images, data.picsAudit, data.imageLimit);
        await setCheckbox(editorPage, "#regolamento", true);
        await captureScreenshot(editorPage, `republish-${remoteId}-images-ready`);

        const returnedRemoteId = await continueToPromotion(editorPage, { remoteId });
        if (`${returnedRemoteId}` !== `${remoteId}`) {
            throw new Error(
                `Moscarossa ha restituito l'annuncio ${returnedRemoteId} durante la modifica immagini di ${remoteId}.`
            );
        }
        const imageState = await waitForMoscarossaImages(editorPage, remoteId);
        if (!Number.isFinite(imageState.count) || imageState.count <= 0) {
            const error = new Error(
                `Moscarossa non ha salvato le immagini sull'annuncio ${remoteId}. ` +
                `Stato remoto: ${imageState.countText || "conteggio immagini non disponibile"}.`
            );
            error.remoteId = `${remoteId}`;
            error.url = imageState.publicUrl ||
                `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(remoteId)}`;
            throw error;
        }
        console.log("[moscarossa:images] Existing ad images synchronized", {
            remoteId,
            remoteImages: imageState.count,
            status: imageState.countText
        });
        return imageState;
    } finally {
        await editorPage.close().catch(() => {});
    }
}

async function clickPublishFree(page, remoteId, { allowExistingRefresh = false } = {}) {
    const state = await waitForPromotionState(page, remoteId, 15000, true);
    const refreshExistingFree = !state.freeButtonVisible && state.freeUpdateCallable &&
        (state.alreadyPublished || allowExistingRefresh);
    if (state.smsRequired) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa richiede la verifica SMS del telefono. Verifica il numero e riprendi lo stesso annuncio.",
            { remoteId, reasonCode: "MOSCAROSSA_WAITING_SMS" }
        );
    }
    if (state.freeLimit && !state.freeButtonVisible && !refreshExistingFree) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa Free non disponibile: il limite dell'annuncio gratuito non consente una nuova attivazione.",
            { remoteId, reasonCode: "MOSCAROSSA_FREE_LIMIT" }
        );
    }
    if (!state.freeButtonVisible && !refreshExistingFree) {
        throw new Error(
            `Moscarossa ha aperto la pagina promozione ma PUBBLICA GRATIS non è disponibile. ` +
            `URL: ${state.url}. Contenuto: ${state.bodyExcerpt}`
        );
    }

    const responsePromise = page.waitForResponse(
        (response) => /\/private\/promuovi_free\.php(?:\?|$)/i.test(response.url()),
        { timeout: 60000 }
    );
    if (refreshExistingFree) {
        console.log(
            state.alreadyPublished
                ? "[moscarossa:promotion] Refreshing already-published Free ad"
                : "[moscarossa:promotion] Requesting Free reactivation for existing remote ad",
            { remoteId }
        );
        await page.evaluate(() => window.pubblica_free(1));
    } else {
        const button = await page.waitForSelector(FREE_PUBLISH_SELECTOR, { visible: true, timeout: 10000 });
        await button.click();
    }
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
        const publicLink = Array.from(document.querySelectorAll("a[href]"))
            .map((link) => link.href)
            .find((href) => new RegExp(`/(?:girl|trans|boy|massage)-${expectedRemoteId}\\.php`, "i").test(href)) || "";
        return {
            content: `${document.querySelector("#div_dopo_free")?.innerText || ""}`.replace(/\s+/g, " ").trim(),
            phoneVerificationVisible: phoneLayers.some(visible),
            originalButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis")),
            updateFreeButtonPresent: Boolean(document.querySelector("#button_pubblica_gratis_aggiorna")),
            publicLink
        };
    }, remoteId);

    const combined = `${responseBody} ${result.content}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const normalizedCombined = combined.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const freeLimitResponse = /un solo annuncio (?:gratuito|free).{0,100}(?:10 giorni|per utente)|ogni utente puo inserire un solo annuncio ogni 10 giorni/i;
    const negative = /errore|non (?:puoi|possibile|consentito)|impossibile|verifica(?:re|zione).*telefon|codice sms|annuncio non visible|accesso negato/i;
    const positive = /pubblicat|annuncio (?:online|attiv|visibile)|complimenti|aggiorna annuncio gratis/i;

    if (result.phoneVerificationVisible || /verifica(?:re|zione)?.*telefon|codice sms/i.test(combined)) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa richiede la verifica SMS del telefono. Verifica il numero e riprendi lo stesso annuncio.",
            { remoteId, reasonCode: "MOSCAROSSA_WAITING_SMS" }
        );
    }
    if (response.status() < 200 || response.status() >= 300) {
        throw new Error(`Moscarossa pubblicazione gratuita HTTP ${response.status()}: ${combined.slice(0, 500)}`);
    }
    if (/prossimo aggiornamento|puoi aggiornare (?:di nuovo )?tra|attendi.{0,80}aggiorn|aggiornamento.{0,80}non (?:disponibile|consentito)/i.test(combined)) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa non consente ancora un nuovo aggiornamento dell'annuncio Free.",
            { remoteId, reasonCode: "MOSCAROSSA_FREE_REFRESH_WAIT" }
        );
    }
    if (freeLimitResponse.test(normalizedCombined)) {
        throw new MoscarossaWorkflowPendingError(
            "Moscarossa ha rifiutato la riattivazione Free dello stesso annuncio per il limite di 10 giorni.",
            { remoteId, reasonCode: "MOSCAROSSA_FREE_LIMIT" }
        );
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
        const priceControl = Array.from(document.querySelectorAll("[onclick*='preselect_promo']"))
            .find((node) => {
                const source = `${node.getAttribute("onclick") || ""}`;
                const match = source.match(/preselect_promo\(\s*(\d+)\s*,\s*(\d+)/i);
                return match && match[1] === `${targetPlanId}` && match[2] === `${targetDays}`;
            });
        if (!priceControl) return { ok: false, smsRequired, reason: "price-control-not-found" };
        priceControl.setAttribute("data-bky-paid-promotion", "1");
        return {
            ok: true,
            smsRequired,
            plan: `${option.textContent || ""}`.trim(),
            displayedPrice: `${priceControl.textContent || ""}`.replace(/\s+/g, " ").trim()
        };
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

    let creditBefore = null;
    const liveCredit = await readAvailableCredit(page).catch(() => null);
    if (liveCredit?.login) {
        const error = new Error("Moscarossa session expired before activating the paid promotion.");
        error.statusCode = 401;
        throw error;
    }
    if (Number.isFinite(liveCredit?.credit)) creditBefore = liveCredit.credit;
    else if (Number.isFinite(data.availableCredit)) creditBefore = data.availableCredit;

    const [quoteResponse] = await Promise.all([
        page.waitForResponse((response) =>
            /\/private\/ajax_promuovi\.php(?:\?|$)/i.test(response.url()) &&
            response.request().method() === "POST",
        { timeout: 30000 }),
        page.click("[data-bky-paid-promotion='1']")
    ]);
    if (!quoteResponse.ok()) {
        throw new Error(`Preventivo promozione Moscarossa HTTP ${quoteResponse.status()}.`);
    }
    const quotePayload = await quoteResponse.json().catch(() => null);
    const quotedPrice = Number.parseInt(quotePayload?.prezzo, 10);
    if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
        throw new Error(`Moscarossa non ha restituito un preventivo valido per ${data.promotion}, ${days} giorni.`);
    }

    try {
        await page.waitForFunction((targetPlanId, targetDays, targetPrice) => {
            const visible = (node) => {
                if (!node) return false;
                const style = getComputedStyle(node);
                return style.display !== "none" && style.visibility !== "hidden" &&
                    style.opacity !== "0" && node.getClientRects().length > 0;
            };
            const plan = document.querySelector("#select_promozione");
            const duration = document.querySelector("#select_giorni");
            const price = Number.parseInt(`${document.querySelector("#prezzo b")?.textContent || ""}`.replace(/[^0-9]/g, ""), 10);
            const submit = document.querySelector("#form_promozione button[type='submit'], #form_promozione input[type='submit']");
            return `${plan?.value || ""}` === `${targetPlanId}` &&
                `${duration?.value || ""}` === `${targetDays}` && price === targetPrice && visible(submit);
        }, { timeout: 30000 }, planId, days, quotedPrice);
    } catch {
        const state = await page.evaluate(() => ({
            plan: document.querySelector("#select_promozione")?.value || "",
            days: document.querySelector("#select_giorni")?.value || "",
            price: document.querySelector("#prezzo")?.textContent?.replace(/\s+/g, " ").trim() || ""
        }));
        throw new Error(
            `Selezione ${data.promotion} non completata da Moscarossa: ` +
            `piano=${state.plan || "?"}, giorni=${state.days || "?"}, prezzo=${state.price || "?"}.`
        );
    }

    const quote = await page.evaluate((targetPlanId, targetDays, targetPrice) => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const priceText = clean(document.querySelector("#prezzo b")?.textContent);
        const price = Number.parseInt(priceText.replace(/[^0-9]/g, ""), 10);
        const plan = document.querySelector("#select_promozione");
        const duration = document.querySelector("#select_giorni");
        const showcase = document.querySelector("#check_vetrina");
        const diamond = document.querySelector("#check_diamond");
        if (showcase) showcase.checked = false;
        if (diamond) diamond.checked = false;
        return {
            ready: `${plan?.value || ""}` === `${targetPlanId}` &&
                `${duration?.value || ""}` === `${targetDays}` && price === targetPrice,
            price: Number.isFinite(price) ? price : 0,
            priceText,
            url: location.href
        };
    }, planId, days, quotedPrice);

    if (!quote.ready || !quote.price) {
        throw new Error(`Moscarossa non ha restituito il prezzo per ${data.promotion}, ${days} giorni.`);
    }
    if (Number.isFinite(creditBefore) && creditBefore < quote.price) {
        throw new Error(
            `Crediti Moscarossa insufficienti: servono ${quote.price}, disponibili ${creditBefore}.`
        );
    }

    console.log("[moscarossa:promotion] Activating paid plan", {
        remoteId,
        plan: data.promotion,
        planId,
        days,
        price: quote.price,
        availableCredit: Number.isFinite(creditBefore) ? creditBefore : "unknown"
    });
    await captureScreenshot(page, `04-${data.promotion}-${days}-days-selected`);

    const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => null);
    const [response] = await Promise.all([
        page.waitForResponse((response) =>
            /\/private\/promuovi2\.php(?:\?|$)/i.test(response.url()) &&
            response.request().method() === "POST",
        { timeout: 90000 }),
        page.click("#form_promozione button[type='submit'], #form_promozione input[type='submit']")
    ]);
    await navigation;
    await delay(1000);

    const checkout = await page.evaluate(() => {
        const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
        const paymentButton = document.querySelector("#pulsante_pagamento");
        const creditRadio = document.querySelector("#input_crediti");
        const creditForm = document.querySelector("#form_1");
        const terms = document.querySelector("#termini");
        const body = clean(document.body?.innerText);
        const totalMatch = body.match(/Totale\s*:\s*€?\s*([0-9][0-9.,]*)/i);
        const total = totalMatch ? Number.parseInt(totalMatch[1].replace(/[^0-9]/g, ""), 10) : null;
        return {
            present: Boolean(paymentButton || /\bCHECKOUT\b/i.test(body)),
            hasPaymentButton: Boolean(paymentButton),
            hasCreditRadio: Boolean(creditRadio),
            creditSelected: Boolean(creditRadio?.checked),
            hasCreditForm: Boolean(creditForm),
            creditFormAction: creditForm?.getAttribute("action") || "",
            hasTerms: Boolean(terms),
            total: Number.isFinite(total) ? total : null
        };
    });

    let paymentResponse = null;
    if (checkout.present) {
        if (!checkout.hasPaymentButton || !checkout.hasCreditRadio || !checkout.hasCreditForm || !checkout.hasTerms ||
            !/promuovi_crediti\.php/i.test(checkout.creditFormAction)) {
            throw new Error(
                `Checkout crediti Moscarossa non riconosciuto per ${data.promotion}: ` +
                `button=${checkout.hasPaymentButton}, radio=${checkout.hasCreditRadio}, ` +
                `form=${checkout.creditFormAction || "?"}, termini=${checkout.hasTerms}.`
            );
        }
        if (Number.isFinite(checkout.total) && checkout.total !== quote.price) {
            throw new Error(
                `Totale checkout Moscarossa inatteso per ${data.promotion}: ` +
                `preventivo=${quote.price}, checkout=${checkout.total}.`
            );
        }

        const checkoutReady = await page.evaluate(() => {
            const creditRadio = document.querySelector("#input_crediti");
            const terms = document.querySelector("#termini");
            if (!creditRadio.checked) creditRadio.click();
            if (!terms.checked) terms.click();
            return {
                creditSelected: Boolean(creditRadio.checked),
                termsAccepted: Boolean(terms.checked)
            };
        });
        if (!checkoutReady.creditSelected || !checkoutReady.termsAccepted) {
            throw new Error("Moscarossa non ha accettato il metodo crediti o i termini del checkout.");
        }

        console.log("[moscarossa:promotion] Confirming checkout with account credits", {
            remoteId,
            plan: data.promotion,
            days,
            price: quote.price
        });
        await captureScreenshot(page, `05-${data.promotion}-${days}-credit-checkout-ready`);

        const checkoutNavigation = page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 90000
        }).catch(() => null);
        [paymentResponse] = await Promise.all([
            page.waitForResponse((checkoutResponse) =>
                /\/private\/promuovi_crediti\.php(?:\?|$)/i.test(checkoutResponse.url()) &&
                checkoutResponse.request().method() === "POST",
            { timeout: 90000 }).catch(() => null),
            page.click("#pulsante_pagamento")
        ]);
        await checkoutNavigation;
        await delay(1000);
    }

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
    if (paymentResponse && (paymentResponse.status() < 200 || paymentResponse.status() >= 400)) {
        throw new Error(`Moscarossa pagamento crediti HTTP ${paymentResponse.status()}: ${result.body.slice(0, 600)}`);
    }
    if (negative.test(result.body)) {
        throw new Error(`Moscarossa ha rifiutato la promozione: ${result.body.slice(0, 700)}`);
    }

    let creditAfter = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        if (attempt > 1) await delay(attempt * 1000);
        const creditState = await readAvailableCredit(page).catch(() => null);
        if (creditState?.login) {
            const error = new Error("Moscarossa session expired while verifying the paid promotion.");
            error.statusCode = 401;
            throw error;
        }
        if (Number.isFinite(creditState?.credit)) creditAfter = creditState.credit;
        if (Number.isFinite(creditBefore) && Number.isFinite(creditAfter) &&
            creditBefore - creditAfter >= quote.price) break;
    }

    const chargedCredits = Number.isFinite(creditBefore) && Number.isFinite(creditAfter)
        ? creditBefore - creditAfter
        : 0;
    if (!Number.isFinite(creditBefore) || !Number.isFinite(creditAfter) || chargedCredits < quote.price) {
        await captureScreenshot(page, `error-${data.promotion}-${days}-payment-not-confirmed`);
        throw new Error(
            `Moscarossa non ha confermato l'addebito per ${data.promotion}: ` +
            `attesi ${quote.price} crediti, prima=${Number.isFinite(creditBefore) ? creditBefore : "?"}, ` +
            `dopo=${Number.isFinite(creditAfter) ? creditAfter : "?"}. ${result.body.slice(0, 500)}`
        );
    }

    console.log("[moscarossa:promotion] Paid promotion confirmed", {
        remoteId,
        plan: data.promotion,
        days,
        expectedCharge: quote.price,
        actualCharge: chargedCredits,
        creditBefore,
        creditAfter
    });

    const publicUrl = result.publicUrl || `https://www.moscarossa.biz/girl-${remoteId}.php`;
    return {
        ok: true,
        remoteId,
        publicUrl,
        plan: data.promotion,
        days,
        creditsConsumed: quote.price,
        remainingCredit: creditAfter,
        response: result.body.slice(0, 700)
    };
}

async function activateSelectedPromotion(page, remoteId, data, options = {}) {
    await reactivateSuspendedAdvertisement(page, remoteId);
    return data.isFree
        ? clickPublishFree(page, remoteId, options)
        : activatePaidPromotion(page, remoteId, data);
}

async function openPromotionPageForAddon(page, remoteId, addonName) {
    await openMoscarossaPromotionPage(page, remoteId, `${addonName} add-on`);
}

async function activateVetrinaAddon(page, remoteId, addon) {
    const days = Number.parseInt(addon.days, 10);
    if (!PROMOTION_DURATIONS.has(days)) throw new Error("Durata Vetrina Moscarossa non valida.");
    await openPromotionPageForAddon(page, remoteId, "Vetrina");
    const prepared = await page.evaluate((targetDays) => {
        const form = document.querySelector("#form_plus_vetrina");
        const select = document.querySelector("#select_giorni_vetrina_post");
        if (!form || !select) return { ok: false, reason: "form-not-found" };
        let option = Array.from(select.options).find((item) => `${item.value}` === `${targetDays}`);
        if (!option) {
            option = new Option(`${targetDays} giorni`, `${targetDays}`, true, true);
            select.appendChild(option);
        }
        select.value = `${targetDays}`;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true };
    }, days);
    if (!prepared.ok) throw new Error(`Modulo Vetrina Moscarossa non disponibile: ${prepared.reason}.`);

    await captureScreenshot(page, `06-vetrina-${days}-days-selected`);
    const navigation = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 }).catch(() => null);
    await page.evaluate(() => {
        const form = document.querySelector("#form_plus_vetrina");
        if (!form) throw new Error("Moscarossa Vetrina form disappeared before submit.");
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
    });
    const response = await navigation;
    await delay(750);
    const result = await page.evaluate(() => ({
        url: location.href,
        body: `${document.body?.innerText || ""}`.replace(/\s+/g, " ").trim().slice(0, 2500),
        stillOnForm: Boolean(document.querySelector("#form_plus_vetrina"))
    }));
    if (response && !response.ok()) throw new Error(`Moscarossa Vetrina HTTP ${response.status()}.`);
    if (/errore|crediti insufficienti|operazione non riuscita|non autorizzat/i.test(result.body)) {
        throw new Error(`Moscarossa ha rifiutato Vetrina: ${result.body.slice(0, 600)}`);
    }
    if (result.stillOnForm && !/vetrina.{0,80}(?:attiv|acquist|success)/i.test(result.body)) {
        throw new Error(`Moscarossa non ha confermato Vetrina: ${result.body.slice(0, 600)}`);
    }
    return { creditsConsumed: days * 8 };
}

async function activateDiamondAddon(page, remoteId, addon) {
    const dates = [...new Set((addon.dates || []).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(`${date}`)))].sort();
    if (!dates.length) throw new Error("Seleziona almeno un giorno Diamond Moscarossa.");
    await openPromotionPageForAddon(page, remoteId, "Diamond");
    const formattedDates = dates.map((date) => date.split("-").reverse().join("-")).join(", ");
    const prepared = await page.evaluate(async (targetRemoteId, targetDates, count) => {
        const form = document.querySelector("#form_promozione_diamond");
        const hidden = document.querySelector("#giorni_diamond_selezionati_singolo");
        if (!form || !hidden) return { ok: false, reason: "form-not-found" };
        hidden.value = targetDates;
        const quoteBody = new URLSearchParams({
            id_accompa: `${targetRemoteId}`,
            elenco_giorni_diamond: targetDates,
            giorni_diamond: `${count}`
        });
        const quoteResponse = await fetch("ajax_promuovi.php", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: quoteBody.toString()
        });
        const text = await quoteResponse.text();
        let quote = {};
        try { quote = JSON.parse(text); } catch { quote = {}; }
        return {
            ok: quoteResponse.ok,
            status: quoteResponse.status,
            price: Number.parseInt(quote.prezzo_diamond, 10) || 0,
            message: `${quote.messaggio_diamond || ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        };
    }, remoteId, formattedDates, dates.length);
    if (!prepared.ok) throw new Error(`Preventivo Diamond Moscarossa non disponibile (HTTP ${prepared.status || "?"}).`);
    if (prepared.message) throw new Error(`Moscarossa Diamond: ${prepared.message}`);
    const credits = prepared.price || dates.length * 50;

    await captureScreenshot(page, `06-diamond-${dates.length}-days-selected`);
    const navigation = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 }).catch(() => null);
    await page.evaluate(() => {
        const form = document.querySelector("#form_promozione_diamond");
        if (!form) throw new Error("Moscarossa Diamond form disappeared before submit.");
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
    });
    const response = await navigation;
    await delay(750);
    const result = await page.evaluate(() => ({
        body: `${document.body?.innerText || ""}`.replace(/\s+/g, " ").trim().slice(0, 2500),
        stillOnForm: Boolean(document.querySelector("#form_promozione_diamond"))
    }));
    if (response && !response.ok()) throw new Error(`Moscarossa Diamond HTTP ${response.status()}.`);
    if (/errore|crediti insufficienti|operazione non riuscita|non autorizzat/i.test(result.body)) {
        throw new Error(`Moscarossa ha rifiutato Diamond: ${result.body.slice(0, 600)}`);
    }
    if (result.stillOnForm && !/diamond.{0,80}(?:attiv|acquist|success)/i.test(result.body)) {
        throw new Error(`Moscarossa non ha confermato Diamond: ${result.body.slice(0, 600)}`);
    }
    return { creditsConsumed: credits };
}

async function activateSelectedAddons(page, remoteId, data, publicationResult) {
    const addons = data.addons || {};
    if (!addons.vetrina?.enabled && !addons.diamond?.enabled) return publicationResult;
    if (data.isFree) {
        throw new Error("Vetrina e Diamond Moscarossa richiedono una promozione a pagamento.");
    }
    const addonResult = addons.diamond?.enabled
        ? await activateDiamondAddon(page, remoteId, addons.diamond)
        : await activateVetrinaAddon(page, remoteId, addons.vetrina);
    return {
        ...publicationResult,
        creditsConsumed: Number(publicationResult.creditsConsumed || 0) + Number(addonResult.creditsConsumed || 0)
    };
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

    await openMoscarossaPromotionPage(page, resolvedRemoteId, "phone verification");
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

        await openMoscarossaPromotionPage(page, resolvedRemoteId, "verified phone refresh");
        await captureScreenshot(page, `phone-verification-${resolvedRemoteId}-04-phone-verified`);
        if (!resume) return { ok: true, status: "verified", remoteId: resolvedRemoteId };

        const promotionData = buildPublishData({
            typeAnnuncio: promotion.plan || "Free",
            period: promotion.period || "",
            availableCredit: promotion.availableCredit
        });
        console.log("[moscarossa:phone] SMS verified; resuming scheduled promotion", {
            remoteId: resolvedRemoteId,
            promotion: promotionData.promotion,
            days: promotionData.promotionDays
        });
        const basePublicationResult = await activateSelectedPromotion(
            page,
            resolvedRemoteId,
            promotionData,
            { allowExistingRefresh: true }
        );
        let publicationResult;
        try {
            publicationResult = await activateSelectedAddons(
                page,
                resolvedRemoteId,
                promotionData,
                basePublicationResult
            );
        } catch (addonError) {
            throw new MoscarossaWorkflowPendingError(
                `Annuncio Moscarossa pubblicato, ma extra non attivato: ${addonError.message}`,
                {
                    remoteId: resolvedRemoteId,
                    reasonCode: "MOSCAROSSA_ADDON_FAILED",
                    url: basePublicationResult.publicUrl,
                    payed: !promotionData.isFree,
                    creditsConsumed: basePublicationResult.creditsConsumed || 0
                }
            );
        }
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
        const selectedImageCount = Math.min(
            resolveImagePaths(data.images, data.picsAudit).length,
            data.imageLimit
        );
        if (selectedImageCount > 0) {
            let imageState = await readMoscarossaImageState(page, remoteId);
            if (imageState.count === 0 && existingAd.reusedExisting) {
                imageState = await syncImagesForExistingAd(page, remoteId, data);
            } else if (imageState.count === 0) {
                imageState = await waitForMoscarossaImages(page, remoteId);
            }
            if (imageState.count === 0) {
                const error = new Error(
                    `Moscarossa ha creato l'annuncio ${remoteId}, ma non ha salvato le ` +
                    `${selectedImageCount} immagini selezionate.`
                );
                error.remoteId = remoteId;
                error.url = imageState.publicUrl ||
                    `https://www.moscarossa.biz/private/promuovi.php?id_accompa=${encodeURIComponent(remoteId)}`;
                throw error;
            }
        }
        await captureScreenshot(page, "03-promotion-step");
        const basePromotionResult = await activateSelectedPromotion(page, remoteId, data);
        let promotionResult;
        try {
            promotionResult = await activateSelectedAddons(page, remoteId, data, basePromotionResult);
        } catch (addonError) {
            throw new MoscarossaWorkflowPendingError(
                `Annuncio Moscarossa pubblicato, ma extra non attivato: ${addonError.message}`,
                {
                    remoteId,
                    reasonCode: "MOSCAROSSA_ADDON_FAILED",
                    url: basePromotionResult.publicUrl,
                    payed: !data.isFree,
                    creditsConsumed: basePromotionResult.creditsConsumed || 0
                }
            );
        }
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
        const protocolUnavailable = /ProtocolError|Runtime\.callFunctionOn timed out|DOM\.setFileInputFiles timed out|Navigation timeout of \d+ ms exceeded|Target closed|Session closed/i
            .test(`${error?.name || ""} ${error?.message || error || ""}`);
        if (protocolUnavailable) {
            console.warn(`[moscarossa:screenshot] Skipped error screenshot because the browser protocol is unavailable: ${error.message}`);
        } else {
            await captureScreenshot(page, `error-${error.message}`);
        }
        throw error;
    }
}

async function republishAd(page, remoteId, adData = {}) {
    const resolvedRemoteId = `${remoteId || ""}`.trim();
    if (!/^\d{4,9}$/.test(resolvedRemoteId)) {
        throw new Error(`Moscarossa remotePostID non valido per la ripubblicazione: ${resolvedRemoteId || "vuoto"}.`);
    }

    const data = buildPublishData(adData);
    try {
        await openMoscarossaPromotionPage(page, resolvedRemoteId, "republish promotion");

        const selectedImageCount = Math.min(
            resolveImagePaths(data.images, data.picsAudit).length,
            data.imageLimit
        );
        const remoteImageState = await readMoscarossaImageState(page, resolvedRemoteId);
        if (selectedImageCount > 0 && remoteImageState.count === 0) {
            await syncImagesForExistingAd(page, resolvedRemoteId, data);
        } else if (Number.isFinite(remoteImageState.count) && remoteImageState.count > 0) {
            console.log("[moscarossa:images] Preserving existing Moscarossa gallery", {
                remoteId: resolvedRemoteId,
                remoteImages: remoteImageState.count,
                selectedWebsiteImages: selectedImageCount
            });
        }

        await captureScreenshot(page, `republish-${resolvedRemoteId}-01-promotion-page`);
        const basePromotionResult = await activateSelectedPromotion(page, resolvedRemoteId, data, {
            allowExistingRefresh: true
        });
        let promotionResult;
        try {
            promotionResult = await activateSelectedAddons(page, resolvedRemoteId, data, basePromotionResult);
        } catch (addonError) {
            throw new MoscarossaWorkflowPendingError(
                `Annuncio Moscarossa ripubblicato, ma extra non attivato: ${addonError.message}`,
                {
                    remoteId: resolvedRemoteId,
                    reasonCode: "MOSCAROSSA_ADDON_FAILED",
                    url: basePromotionResult.publicUrl,
                    payed: !data.isFree,
                    creditsConsumed: basePromotionResult.creditsConsumed || 0
                }
            );
        }
        await captureScreenshot(page, `republish-${resolvedRemoteId}-02-${data.promotion}-published`);

        return {
            ok: true,
            remoteId: resolvedRemoteId,
            state: "OK",
            url: promotionResult.publicUrl || `${VIEW_URL}?id_accompa=${encodeURIComponent(resolvedRemoteId)}`,
            creditsConsumed: promotionResult.creditsConsumed || 0,
            response: promotionResult.response
        };
    } catch (error) {
        const protocolUnavailable = /ProtocolError|Runtime\.callFunctionOn timed out|DOM\.setFileInputFiles timed out|Navigation timeout of \d+ ms exceeded|Page\.captureScreenshot timed out|Target closed|Session closed/i
            .test(`${error?.name || ""} ${error?.message || error || ""}`);
        if (protocolUnavailable) {
            console.warn(
                `[moscarossa:screenshot] Skipped republish error screenshot because the browser protocol is unavailable: ${error.message}`
            );
        } else {
            await captureScreenshot(page, `error-republish-${resolvedRemoteId}-${error.message}`);
        }
        throw error;
    }
}

module.exports = {
    buildPublishData,
    captureScreenshot,
    clickPublishFree,
    publishAd,
    republishAd,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    resolveImagePaths
};
