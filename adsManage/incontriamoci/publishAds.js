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
    MASSAGGI: "101",
    MASSAGGI_BENESSERE: "101",
    MASSAGGIBENESSERE: "101",
    UOMOUOMO: "98",
    UOMO_UOMO: "98",
    GAY: "98",
    TRANS: "104",
    COPPIE: "103",
    SCAMBISTI: "103"
};

const CATEGORY_LABELS = {
    DONNAUOMO: ["donna uomo", "donna cerca uomo", "escort"],
    UOMOUOMO: ["uomo uomo", "uomo cerca uomo", "gay"],
    TRANS: ["trans", "transessuale"],
    COPPIE: ["coppie", "coppia", "scambisti"]
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
    const sourceCategory = normalizeKey(firstNonEmpty(adData.categorie, adData.sono, adData.category));
    const isMassageCategory = sourceCategory.includes("massaggi") || sourceCategory.includes("massaggio");

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
            isEnabled(adData.serviceMassaggioErotico) || isMassageCategory ? "Massaggio erotico" : "",
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
    const contactName = firstNonEmpty(adData.name, adData.contactName, adData.nickname);

    return {
        title: firstNonEmpty(adData.title, adData.titolo),
        description: firstNonEmpty(adData.description, adData.testo),
        category: mapCategory(firstNonEmpty(adData.categorie, adData.sono, adData.category)),
        city: firstNonEmpty(adData.city, adData.annunci_city, adData.comune),
        area: firstNonEmpty(adData.area, adData.location, adData.zone, adData.zona),
        address: firstNonEmpty(adData.address, adData.indirizzo, adData.location, adData.city, adData.annunci_city),
        zip: firstNonEmpty(adData.zip, adData.cap),
        phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
        contactName: `${contactName || ""}`.trim().slice(0, 35),
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
        throw new Error(`Incontriamoci category selection failed: ${JSON.stringify(selected)}`);
    }

    console.log("[incontriamoci:publish] Category selected", selected);
    return selected;
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

async function openPublishPage(page, targetUrl = PUBLISH_URL, label = "publish") {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    const hasForm = await page.$(FORM_SELECTOR);
    if (hasForm) return targetUrl;

    throw new Error(`Incontriamoci ${label} form not found. Last URL: ${page.url()}`);
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
    if (input) {
        await input.uploadFile(...imagePaths);
    } else {
        const uploadButtonSelector = ".qq-upload-button, #image-uploader-upload-area";
        const uploadButton = await page.$(uploadButtonSelector);
        if (!uploadButton) {
            const diagnostics = await page.evaluate(() => ({
                url: window.location.href,
                fileInputs: Array.from(document.querySelectorAll("input[type='file']")).map((node) => ({
                    name: node.name,
                    accept: node.accept,
                    visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
                })),
                uploadButtons: document.querySelectorAll(".qq-upload-button, #image-uploader-upload-area").length,
                bodyText: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500)
            })).catch(() => ({}));
            throw new Error(`Incontriamoci image file input not found: ${JSON.stringify(diagnostics)}`);
        }

        const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 15000 }),
            uploadButton.click()
        ]);
        await fileChooser.accept(imagePaths);
    }

    await page.waitForFunction((expected) => {
        const successCount = document.querySelectorAll(".qq-upload-success, .qq-file-id, .qq-upload-list li").length;
        return successCount >= expected || expected === 0;
    }, { timeout: 60000 }, Math.min(imagePaths.length, 1)).catch(() => null);

    await delay(1500);
    return imagePaths.length;
}

async function clearExistingImages(page) {
    await page.waitForSelector(".qq-uploader-selector, .qq-upload-list, input[name='ajax_images[]']", {
        timeout: 10000
    }).catch(() => null);

    const beforeCount = await page.evaluate(() => document.querySelectorAll("input[name='ajax_images[]']").length).catch(() => 0);
    let clicked = 0;
    let confirmed = 0;

    while (clicked < 25) {
        const currentCount = await page.evaluate(() => document.querySelectorAll("input[name='ajax_images[]']").length).catch(() => 0);
        if (!currentCount) break;

        const clickedDelete = await page.evaluate(() => {
            window.confirm = () => true;
            const imageInput = document.querySelector("input[name='ajax_images[]']");
            const wrapper = imageInput?.closest(".file-wrapper, .qq-upload-success, .col-sm-4, .qq-upload-list-selector") || null;
            const button = wrapper?.querySelector(
                ".qq-upload-delete-selector.qq-upload-delete, .qq-upload-delete, button[title*='Elimina'], .btn-danger"
            ) || document.querySelector(
                ".qq-upload-delete-selector.qq-upload-delete, .qq-upload-delete, button[title*='Elimina']"
            );

            if (!button) return false;

            button.scrollIntoView({ block: "center", inline: "center" });
            button.classList.remove("qq-hide");
            button.style.display = "";
            button.style.visibility = "visible";
            button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
            button.click();
            return true;
        }).catch(() => false);

        if (!clickedDelete) break;
        clicked++;
        await delay(600);

        const clickedConfirm = await page.evaluate(() => {
            const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
            const isVisible = (node) => {
                if (!node) return false;
                const style = window.getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            };

            const dialog = Array.from(document.querySelectorAll(
                ".modal.show, .modal.in, .bootbox.modal, .swal2-container, [role='dialog'][aria-modal='true']"
            )).find(isVisible);

            if (!dialog) return false;

            const buttons = Array.from(dialog.querySelectorAll("button, a.btn, input[type='button'], input[type='submit']"))
                .filter(isVisible);
            const confirmButton = buttons.find((node) => {
                const text = clean(node.textContent || node.value || node.title || node.getAttribute("aria-label"));
                const cls = clean(node.className);
                const href = clean(node.getAttribute("href"));
                if (/cookie|privacy|policy|termini|conditions/.test(`${text} ${href}`)) return false;
                if (/cancel|annulla|close|chiudi|no/.test(`${text} ${cls}`)) return false;
                return /elimina|cancella|rimuovi|conferma|si|yes/.test(text) || text === "ok";
            });

            if (!confirmButton) return false;
            confirmButton.click();
            return true;
        }).catch(() => false);

        if (clickedConfirm) confirmed++;

        const deleted = await page.waitForFunction((previousCount) => {
            return document.querySelectorAll("input[name='ajax_images[]']").length < previousCount;
        }, { timeout: 7000 }, currentCount).then(() => true).catch(() => false);

        if (!deleted) {
            break;
        }
    }

    const afterCount = await page.evaluate(() => document.querySelectorAll("input[name='ajax_images[]']").length).catch(() => 0);
    console.log("[incontriamoci:update] existing images cleanup:", {
        beforeCount,
        clicked,
        confirmed,
        afterCount
    });

    if (afterCount > 0) {
        throw new Error(`Incontriamoci could not delete existing images before update. Remaining images: ${afterCount}`);
    }

    return clicked;
}

async function fillFirstStep(page, data, options = {}) {
    await page.waitForSelector(FORM_SELECTOR, { visible: true, timeout: 30000 });

    await setInput(page, "#title, input[name='title']", data.title);
    await selectCategory(page, data.category);
    await setInput(page, "#description, textarea[name='description']", data.description);
    if (options.replaceImages) {
        await clearExistingImages(page);
    }
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

    const validation = await page.evaluate(() => {
        const form = document.querySelector("form#item-post");
        const category = document.querySelector("#catId, select[name='catId']");
        const invalidFields = Array.from(document.querySelectorAll(":invalid")).map((node) => node.name || node.id || node.tagName);
        const validationText = Array.from(document.querySelectorAll(".help-block, .invalid-feedback, .error, .has-error"))
            .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, 10);
        return {
            stillOnFirstStep: Boolean(form),
            category: category?.value || "",
            invalidFields,
            validationText,
            url: window.location.href
        };
    });

    if (validation.stillOnFirstStep) {
        throw new Error(`Incontriamoci first step validation failed: ${JSON.stringify(validation)}`);
    }
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

async function clickPublishFreeIfPresent(page) {
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
    }).catch(() => false);

    if (clicked) {
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
        await delay(2000);
    }

    return clicked;
}

function parsePremiumSettings(adData = {}) {
    const type = `${adData.typeAnnuncio || adData.promo?.visibility || "Free"}`.trim();
    let parsed = {};

    try {
        parsed = JSON.parse(adData.period || adData.promo?.schedule || "{}");
    } catch {
        parsed = {};
    }

    if (/^toplist$/i.test(type) || parsed.product === "toplist") {
        const fascia = `${parsed.fascia || "08-12"}`;
        const risalite = ["08-20", "20-08"].includes(fascia)
            ? "3"
            : `${parsed.risalite || "1"}`;
        return {
            type: "TopList",
            product: "toplist",
            giorni: `${parsed.giorni || "1"}`,
            fascia,
            risalite
        };
    }

    if (/^vetrina$/i.test(type) || parsed.product === "vetrina") {
        return {
            type: "Vetrina",
            product: "vetrina",
            giorni: `${parsed.giorni || "1"}`
        };
    }

    return { type: "Free", product: "free" };
}

async function clickPublishPremium(page, settings) {
    if (!settings || settings.type === "Free") {
        await clickPublishFree(page);
        return false;
    }

    await page.evaluate((payload) => {
        const productButton = document.querySelector(`.product-heading[data-product-type="${payload.product}"]`);
        if (!productButton) throw new Error(`Incontriamoci premium product not found: ${payload.product}`);
        productButton.click();
    }, settings);

    await delay(800);

    await page.evaluate((payload) => {
        const setSelect = (selector, value) => {
            const select = document.querySelector(selector);
            if (!select) throw new Error(`Incontriamoci premium select not found: ${selector}`);
            select.value = value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            select.dispatchEvent(new Event("input", { bubbles: true }));
        };

        if (payload.product === "toplist") {
            setSelect("#toplist-giorni, select[name='toplist[giorni]']", payload.giorni);
            setSelect("#toplist-fascia, select[name='toplist[fascia]']", payload.fascia);
            setSelect("#toplist-risalite, select[name='toplist[risalite]']", payload.risalite);
            return;
        }

        setSelect("#vetrina-giorni, select[name='vetrina[giorni]']", payload.giorni);
    }, settings);

    await page.waitForFunction(() => {
        const button = document.querySelector("#submitPremiumBtn, button[type='submit'], input[type='submit']");
        return Boolean(button && !button.disabled);
    }, { timeout: 20000 });

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate(() => {
            const button = document.querySelector("#submitPremiumBtn, button[type='submit'], input[type='submit']");
            if (!button) throw new Error("Incontriamoci premium submit button not found.");
            button.click();
        })
    ]);

    await delay(2000);
    return true;
}

async function clickPayWithCreditsIfPresent(page) {
    const selector = "#publish-with-credits #submitWithCredits, #frmPublishWithCredits button[type='submit'], #frmPublishWithCredits input[type='submit']";

    const found = await page.waitForSelector(selector, { visible: true, timeout: 20000 })
        .then(() => true)
        .catch(() => false);

    if (!found) {
        const result = await collectResult(page).catch(() => ({}));
        if (result?.success) return false;

        const diagnostics = await page.evaluate(() => ({
            url: window.location.href,
            hasCreditsWrapper: Boolean(document.querySelector("#publish-with-credits")),
            hasCreditsForm: Boolean(document.querySelector("#frmPublishWithCredits")),
            hasCreditsSubmit: Boolean(document.querySelector("#submitWithCredits")),
            bodyText: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 800)
        })).catch(() => ({}));

        throw new Error(`Incontriamoci credits payment button not found: ${JSON.stringify(diagnostics)}`);
    }

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        page.evaluate((buttonSelector) => {
            const button = document.querySelector(buttonSelector);
            if (!button) throw new Error("Incontriamoci credits submit button not found.");
            button.click();
        }, selector)
    ]);

    await delay(2000);
    return true;
}

async function collectResult(page, settings = {}, expectedRemoteId = "") {
    const normalizedExpectedId = `${expectedRemoteId || ""}`.trim();
    if (normalizedExpectedId) {
        await page.waitForFunction((remoteId) => {
            const container = document.getElementById(`inc-${remoteId}`);
            return Boolean(container?.querySelector("a.inc-link[href]"));
        }, { timeout: 20000 }, normalizedExpectedId).catch(() => null);
    }

    const result = await page.evaluate((payload) => {
        const product = `${payload?.product || ""}`.toLowerCase();
        const expectedId = `${payload?.expectedRemoteId || ""}`.trim();
        const getHref = (selector) => document.querySelector(selector)?.href || "";
        const expectedContainer = expectedId ? document.getElementById(`inc-${expectedId}`) : null;
        const exactPublishedLink = expectedContainer?.querySelector("a.inc-link[href]")?.href || "";
        const firstPromotedLink = product
            ? getHref(`#items .inc-single.${product} a.inc-link[href], #items-list .inc-single.${product} a.inc-link[href]`)
            : "";
        const firstListingLink = getHref("#items .inc-single a.inc-link[href], #items-list .inc-single a.inc-link[href]");
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
        const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
        const fallbackPublishedLink =
            document.querySelector(".item-details .item-title a[href]")?.href ||
            document.querySelector(".item-details a[href*='_i']")?.href ||
            firstPromotedLink ||
            firstListingLink ||
            "";
        const fallbackPreviewLink = fallbackPublishedLink ||
            hrefs.find((href) => /\/\d+_i\d+(?:[/?#]|$)/i.test(href) && !/user|login|logout/i.test(href)) ||
            hrefs.find((href) => /\/\d{4,}\//.test(href) && !/user|login|logout/i.test(href)) ||
            "";
        const previewLink = expectedId ? exactPublishedLink : fallbackPreviewLink;
        const remoteIdMatch = previewLink.match(/\/(\d+_i\d+)(?:[/?#]|$)/i);
        const idMatch = remoteIdMatch ||
            [window.location.href, ...hrefs, bodyText].join(" ").match(/(?:item|annuncio|ad|manage|edit)[^\d]{0,30}(\d{4,})/i);

        return {
            url: previewLink || window.location.href,
            remoteId: idMatch ? idMatch[1] : "",
            expectedRemoteId: expectedId,
            exactMatch: Boolean(expectedId && exactPublishedLink),
            bodyText: bodyText.slice(0, 800),
            success: /pubblicato|pubblicata|success|approvazione|moderazione|grazie/i.test(bodyText)
        };
    }, { ...settings, expectedRemoteId: normalizedExpectedId });

    return result;
}

function extractRemoteIdFromPremiumUrl(url = "") {
    const match = `${url || ""}`.match(/\/item\/premium\/(\d+(?:\/[^/?#]+)?)(?:[/?#]|$)/i);
    return match ? decodeURIComponent(match[1]).replace(/\/+$/, "") : "";
}

function extractListingId(remoteId = "") {
    const match = `${remoteId || ""}`.trim().match(/^(\d+)(?:\/|$)/);
    return match ? match[1] : "";
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
    const premiumListingId = extractListingId(premiumRemoteId);
    if (premiumRemoteId) {
        console.log("[incontriamoci:publish] premium identifiers", {
            remoteId: premiumRemoteId,
            listingId: premiumListingId
        });
    }

    const premiumSettings = parsePremiumSettings(adData);
    if (premiumSettings.type !== "Free" && !premiumRemoteId) {
        throw new Error(`Incontriamoci premium remoteId was not found in URL: ${premiumLink}`);
    }
    const clickedPremium = await clickPublishPremium(page, premiumSettings);
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, clickedPremium ? "03-after-premium-publish.png" : "03-after-free-publish.png"),
        fullPage: true
    }).catch(() => null);

    const paidWithCredits = clickedPremium ? await clickPayWithCreditsIfPresent(page) : false;
    if (paidWithCredits) {
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, "04-after-credits-payment.png"),
            fullPage: true
        }).catch(() => null);
    }

    const result = await collectResult(page, premiumSettings, clickedPremium ? premiumListingId : "");
    const remoteId = premiumRemoteId || result.remoteId || adData.remotePostID || "";
    const ok = clickedPremium
        ? Boolean(premiumRemoteId && premiumListingId && result.exactMatch && result.url)
        : Boolean(remoteId || (result.success && result.url !== PUBLISH_URL));

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
        freePublication: premiumSettings.type === "Free",
        premiumPublication: premiumSettings.type !== "Free",
        creditsConsumed: paidWithCredits ? 1 : 0
    };
}

async function updateAd(page, adData = {}, options = {}) {
    const data = buildPublishData(adData);
    const targetUrl = options.postUrl || options.editUrl;
    const existingRemoteId = options.remoteId || adData.remotePostID || "";

    if (!targetUrl) {
        throw new Error("Incontriamoci update URL is missing.");
    }

    console.log("[incontriamoci:update] Updating ad", {
        remoteId: existingRemoteId,
        title: data.title,
        city: data.city,
        category: data.category,
        images: data.images.length || data.picsAudit.length
    });

    ensureScreenshotDir();
    await openPublishPage(page, targetUrl, "update");
    await fillFirstStep(page, data, { replaceImages: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "update-01-form-filled.png"), fullPage: true }).catch(() => null);

    await clickContinue(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "update-02-after-submit.png"), fullPage: true }).catch(() => null);

    const result = await collectResult(page);
    const ok = Boolean(
        result.success ||
        existingRemoteId ||
        /salvat|aggiornat|modificat|success|successo/i.test(result.bodyText || "")
    );

    if (!ok) {
        throw new Error(`Incontriamoci update did not confirm success: ${JSON.stringify(result)}`);
    }

    return {
        ok: true,
        url: result.url,
        payload: {
            idpriv: existingRemoteId,
            data
        },
        result
    };
}

module.exports = {
    HOME_URL,
    PUBLISH_URL,
    buildPublishData,
    publishAd,
    updateAd
};
