const fs = require("fs");
const path = require("path");

const POST_URL = "https://www.trovagnocca.com/dmc/account#/ads-post";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CATEGORY_VALUES = {
  DONNAUOMO: "1",
  DONNA_UOMO: "1",
  ESCORT: "1",
  UOMODONNA: "2",
  UOMO_DONNA: "2",
  UOMOUOMO: "3",
  UOMO_UOMO: "3",
  GAY: "3",
  DONNADONNA: "4",
  DONNA_DONNA: "4",
  LESBO: "4",
  TRANS: "8",
  MASSAGGI: "9",
  MASSAGGI_BENESSERE: "9",
  COPPIE: "5"
};

const CITY_VALUES = {
  agrigento: "1",
  alessandria: "2",
  ancona: "3",
  aosta: "4",
  arezzo: "5",
  ascoli: "6",
  asti: "7",
  avellino: "8",
  bari: "9",
  barletta: "10",
  belluno: "11",
  benevento: "12",
  bergamo: "13",
  biella: "14",
  bologna: "15",
  bolzano: "16",
  brescia: "17",
  brindisi: "18",
  cagliari: "19",
  caltanissetta: "20",
  campobasso: "21",
  "carbonia iglesias": "22",
  caserta: "23",
  catania: "24",
  catanzaro: "25",
  chieti: "26",
  como: "27",
  cosenza: "28",
  cremona: "29",
  crotone: "30",
  cuneo: "31",
  enna: "32",
  fermo: "33",
  ferrara: "34",
  firenze: "35",
  foggia: "36",
  forli: "37",
  "forlì": "37",
  frosinone: "38",
  genova: "39",
  gorizia: "183",
  grosseto: "40",
  imperia: "41",
  isernia: "42",
  "l'aquila": "50",
  "la spezia": "43",
  latina: "44",
  lecce: "45",
  lecco: "46",
  livorno: "47",
  lodi: "48",
  lucca: "49",
  macerata: "51",
  mantova: "52",
  "massa carrara": "53",
  matera: "54",
  "medio campidano": "55",
  messina: "56",
  milano: "57",
  modena: "58",
  monza: "59",
  napoli: "60",
  novara: "61",
  nuoro: "62",
  ogliastra: "63",
  "olbia tempio": "64",
  oristano: "65",
  padova: "66",
  palermo: "67",
  parma: "68",
  pavia: "69",
  perugia: "70",
  pescara: "71",
  piacenza: "72",
  pisa: "73",
  pistoia: "74",
  pordenone: "184",
  potenza: "75",
  prato: "76",
  ragusa: "78",
  ravenna: "79",
  "reggio calabria": "80",
  "reggio emilia": "77",
  "r. emilia": "77",
  rieti: "81",
  rimini: "82",
  roma: "83",
  rovigo: "84",
  salerno: "85",
  sassari: "86",
  savona: "87",
  siena: "88",
  siracusa: "89",
  sondrio: "90",
  taranto: "91",
  teramo: "92",
  terni: "93",
  torino: "94",
  trapani: "95",
  trento: "96",
  treviso: "97",
  trieste: "185",
  udine: "186",
  urbino: "98",
  varese: "99",
  venezia: "100",
  verbania: "101",
  vercelli: "102",
  verona: "103",
  "vibo valentia": "104",
  vicenza: "105",
  viterbo: "106"
};

const NATIONALITY_VALUES = {
  nationality_albanian: "53",
  nationality_american: "54",
  nationality_arabic: "55",
  nationality_argentinian: "56",
  nationality_australian: "57",
  nationality_austrian: "58",
  nationality_bangladeshi: "59",
  nationality_belgian: "60",
  nationality_bolivian: "61",
  nationality_bosnian: "62",
  nationality_brazilian: "63",
  nationality_bulgarian: "64",
  nationality_canadian: "65",
  nationality_czech: "66",
  nationality_chilean: "67",
  nationality_chinese: "68",
  nationality_colombian: "69",
  nationality_costa_rican: "70",
  nationality_croatian: "71",
  nationality_cuban: "72",
  nationality_danish: "73",
  nationality_dominican: "74",
  nationality_ecuadorian: "75",
  nationality_estonian: "76",
  nationality_filipino: "77",
  nationality_finnish: "78",
  nationality_french: "79",
  nationality_jamaican: "80",
  nationality_japanese: "81",
  nationality_greek: "82",
  nationality_guatemalan: "83",
  nationality_haitian: "84",
  nationality_honduran: "85",
  nationality_indian: "86",
  nationality_indonesian: "87",
  nationality_english: "88",
  nationality_irish: "89",
  nationality_italian: "90",
  nationality_kenyan: "91",
  nationality_latvian: "92",
  nationality_lithuanian: "93",
  nationality_maldivian: "94",
  nationality_malaysian: "95",
  nationality_moroccan: "96",
  nationality_mexican: "97",
  nationality_moldovan: "98",
  nationality_new_zealander: "99",
  nationality_nicaraguan: "100",
  nationality_nigerian: "101",
  nationality_norwegian: "102",
  nationality_dutch: "103",
  nationality_pakistani: "104",
  nationality_panamanian: "105",
  nationality_paraguayan: "106",
  nationality_peruvian: "107",
  nationality_polish: "108",
  nationality_portuguese: "109",
  nationality_romanian: "110",
  nationality_russian: "111",
  nationality_senegalese: "112",
  nationality_serbian: "113",
  nationality_singaporean: "114",
  nationality_spanish: "115",
  nationality_south_african: "116",
  nationality_swedish: "117",
  nationality_swiss: "118",
  nationality_thai: "119",
  nationality_german: "120",
  nationality_tunisian: "121",
  nationality_turkish: "122",
  nationality_ukrainian: "123",
  nationality_hungarian: "124",
  nationality_uruguayan: "125",
  nationality_venezuelan: "126",
  nationality_vietnamese: "127"
};

function cleanText(value) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function isEnabled(value) {
  if (value === true || value === 1) return true;
  const text = normalizeKey(value);
  return ["1", "true", "yes", "si", "sì", "on", "checked"].includes(text);
}

function normalizeCategory(value) {
  const key = normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (CATEGORY_VALUES[key.toUpperCase()]) return CATEGORY_VALUES[key.toUpperCase()];
  if (key.includes("trans")) return CATEGORY_VALUES.TRANS;
  if (key.includes("massaggi")) return CATEGORY_VALUES.MASSAGGI;
  if (key.includes("copp")) return CATEGORY_VALUES.COPPIE;
  if (key.includes("uomo_uomo") || key.includes("gay")) return CATEGORY_VALUES.UOMOUOMO;
  if (key.includes("uomo_donna")) return CATEGORY_VALUES.UOMODONNA;
  if (key.includes("donna_donna")) return CATEGORY_VALUES.DONNADONNA;
  return CATEGORY_VALUES.DONNAUOMO;
}

function normalizeNationality(value) {
  const key = normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) return "";
  if (NATIONALITY_VALUES[key]) return NATIONALITY_VALUES[key];
  if (NATIONALITY_VALUES[`nationality_${key}`]) return NATIONALITY_VALUES[`nationality_${key}`];

  const optionKey = Object.keys(NATIONALITY_VALUES).find((name) => name.replace(/^nationality_/, "") === key);
  return optionKey ? NATIONALITY_VALUES[optionKey] : value;
}

function parseTrovagnoccaNote(note) {
  try {
    const parsed = JSON.parse(note || "{}");
    return parsed.trovagnocca || {};
  } catch {
    return {};
  }
}

async function waitForDmcApp(page, postUrl = POST_URL) {
  await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#app", { timeout: 60000 });
  await closeEditNoticeModal(page);
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return (
      (/pubblica annuncio|post an ad/i.test(text)) &&
      (/seleziona categorie|select categories|category/i.test(text))
    );
  }, { timeout: 60000 });
}

async function closeEditNoticeModal(page) {
  const hasModal = await page.waitForFunction(() => {
    const popup = document.querySelector(".swal2-popup.swal2-show");
    if (!popup) return false;

    const text = (popup.textContent || "").replace(/\s+/g, " ").trim();
    return /modifica dell'annuncio|non lo fa risalire|ho capito/i.test(text);
  }, { timeout: 5000 }).then(() => true).catch(() => false);

  if (!hasModal) return false;

  await page.evaluate(() => {
    const popup = document.querySelector(".swal2-popup.swal2-show");
    const confirmButton = popup?.querySelector(".swal2-confirm");
    if (!confirmButton) return;
    confirmButton.scrollIntoView({ block: "center", inline: "center" });
    confirmButton.click();
  });

  await page.waitForFunction(() => !document.querySelector(".swal2-popup.swal2-show"), { timeout: 10000 }).catch(() => null);
  await delay(500);
  return true;
}

async function setWrappedSelect(page, wrapperName, wanted) {
  await page.waitForFunction(({ wrapperName, wanted }) => {
    const normalizedWanted = `${wanted || ""}`.trim().toLowerCase();
    const optionMatches = (select) => Array.from(select.options || []).some((item) => (
      `${item.value}` === `${wanted}` ||
      (item.textContent || "").trim().toLowerCase() === normalizedWanted
    ));

    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const wrapperSelect = wrapper?.querySelector("select");
    if (wrapperSelect) return optionMatches(wrapperSelect);

    return Array.from(document.querySelectorAll("select")).some(optionMatches);
  }, { timeout: 30000 }, { wrapperName, wanted });

  await page.evaluate(({ wrapperName, wanted }) => {
    const normalizedWanted = `${wanted || ""}`.trim().toLowerCase();
    const optionMatches = (select) => Array.from(select.options || []).some((item) => (
      `${item.value}` === `${wanted}` ||
      (item.textContent || "").trim().toLowerCase() === normalizedWanted
    ));

    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const select = wrapper?.querySelector("select") ||
      Array.from(document.querySelectorAll("select")).find(optionMatches);
    if (!select) {
      const diagnostics = Array.from(document.querySelectorAll("[name], select")).slice(0, 40).map((node) => ({
        tag: node.tagName.toLowerCase(),
        name: node.getAttribute("name") || "",
        text: `${node.textContent || ""}`.replace(/\s+/g, " ").trim().slice(0, 120),
        options: node.tagName.toLowerCase() === "select"
          ? Array.from(node.options || []).slice(0, 12).map((option) => `${option.value}:${(option.textContent || "").trim()}`)
          : []
      }));
      throw new Error(`Select wrapper not found: ${wrapperName}; diagnostics=${JSON.stringify(diagnostics)}`);
    }

    const option = Array.from(select.options).find((item) => (
      `${item.value}` === `${wanted}` ||
      (item.textContent || "").trim().toLowerCase() === normalizedWanted
    ));

    if (!option) {
      const options = Array.from(select.options || []).slice(0, 20).map((item) => `${item.value}:${(item.textContent || "").trim()}`);
      throw new Error(`Select option not found for ${wrapperName}: ${wanted}; options=${JSON.stringify(options)}`);
    }

    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (nativeValueSetter) {
      nativeValueSetter.call(select, option.value);
    } else {
      select.value = option.value;
    }
    option.selected = true;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));

    if (`${select.value}` !== `${option.value}`) {
      throw new Error(`Select ${wrapperName} did not keep value ${option.value}; current=${select.value}`);
    }
  }, { wrapperName, wanted });
}

async function setWrappedInput(page, wrapperName, value) {
  await page.waitForFunction((name) => {
    const wrapper = document.querySelector(`[name="${name}"]`);
    return Boolean(wrapper?.querySelector("input, textarea"));
  }, { timeout: 30000 }, wrapperName);

  await page.evaluate(({ wrapperName, value }) => {
    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const input = wrapper?.querySelector("input, textarea");
    if (!input) throw new Error(`Input wrapper not found: ${wrapperName}`);
    input.focus();
    input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { wrapperName, value });
}

async function setContactMethod(page, method = "phone") {
  const wantedValue = method === "email_phone" ? "2" : method === "email" ? "3" : "1";
  const wantedPattern = method === "email_phone"
    ? /email\s*e\s*telefono|email.*phone/i
    : method === "email"
      ? /solo\s*email|email\s*only/i
      : /solo\s*telefono|phone\s*only/i;

  const selected = await page.evaluate(({ patternSource, wantedValue }) => {
    const pattern = new RegExp(patternSource, "i");
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const contactField = document.querySelector('[name="contact_type"]');
    const valueInput = contactField?.querySelector(`input[type="radio"][value="${wantedValue}"]`) ||
      document.querySelector(`[name="contact_type"] input[type="radio"][value="${wantedValue}"]`) ||
      document.querySelector(`input[type="radio"][name="radius"][value="${wantedValue}"]`);

    if (valueInput && isVisible(valueInput.closest(".custom-control") || valueInput)) {
      valueInput.click();
      valueInput.dispatchEvent(new Event("input", { bubbles: true }));
      valueInput.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const searchRoot = contactField || document;
    const candidates = Array.from(searchRoot.querySelectorAll("label, button, .btn, .custom-control, .form-check, .contact, .card, div"));
    const target = candidates.find((node) => isVisible(node) && pattern.test(node.textContent || ""));
    if (!target) return false;

    const input =
      target.querySelector("input[type='radio'], input[type='checkbox']") ||
      (target.getAttribute("for") ? document.getElementById(target.getAttribute("for")) : null) ||
      target.closest("label")?.querySelector("input[type='radio'], input[type='checkbox']");

    const clickable = input || target.closest("label, button, .btn, .custom-control, .form-check, .contact, .card") || target;
    clickable.scrollIntoView({ block: "center", inline: "center" });
    clickable.click();
    if (input) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }, { patternSource: wantedPattern.source, wantedValue }).catch(() => false);

  if (!selected) {
    console.warn(`[trovagnocca:publish] Contact method '${method}' option not found. Continuing with current selection.`);
  }

  await delay(500);
  return selected;
}

async function waitForInfoStepExit(page) {
  return page.waitForFunction(() => {
    const text = document.body.innerText || "";
    const hasTagsControls = Boolean(document.querySelector(".tagsCard, button.tags_btn"));
    const hasPhotoInput = Boolean(document.querySelector('input[type="file"][name="items[]"], input[type="file"][name="inputFile"], input[type="file"][accept*="image"]'));
    const stillOnContacts = /i tuoi contatti|come vuoi essere contattato|solo telefono|email e telefono|solo email/i.test(text);
    return hasTagsControls || hasPhotoInput || !stillOnContacts;
  }, { timeout: 15000 }).then(() => true).catch(() => false);
}

async function setTextarea(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 30000 });
  await page.evaluate(({ selector, value }) => {
    const textarea = document.querySelector(selector);
    textarea.focus();
    textarea.value = value || "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, value });
}

async function setSwitch(page, wrapperName, checked) {
  await page.evaluate(({ wrapperName, checked }) => {
    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const input = wrapper?.querySelector("input[type='checkbox']");
    if (!input) return;
    if (input.checked !== Boolean(checked)) input.click();
  }, { wrapperName, checked });
}

async function setNationality(page, value) {
  const wanted = normalizeNationality(value);
  if (!wanted) return;

  await page.evaluate((wantedValue) => {
    const cards = Array.from(document.querySelectorAll(".tagsCard, .card"));
    const card = cards.find((node) => /nazionalita|nationality/i.test(node.textContent || ""));
    const select = card?.querySelector("select");
    if (!select) return;

    const normalizedWanted = `${wantedValue || ""}`.trim().toLowerCase();
    const option = Array.from(select.options).find((item) => (
      `${item.value}` === `${wantedValue}` ||
      (item.textContent || "").trim().toLowerCase() === normalizedWanted
    ));

    if (!option) return;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, wanted);
}

async function clickTagButtons(page, labels = []) {
  const wantedLabels = labels.map(normalizeKey).filter(Boolean);
  if (!wantedLabels.length) return;

  await page.evaluate((wanted) => {
    const normalize = (value) => `${value || ""}`
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const buttons = Array.from(document.querySelectorAll(".tagsCard button, button.tags_btn"));
    for (const button of buttons) {
      const text = normalize(button.textContent);
      if (!wanted.includes(text)) continue;
      if (!button.classList.contains("selected")) {
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
      }
    }
  }, wantedLabels);
}

async function clickNext(page) {
  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, .btn"));
    const button = candidates.find((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      const disabled = node.disabled || node.classList.contains("disabled") || node.classList.contains("deactivated");
      return !disabled && /avanti|prosegui|after you|next/i.test(text) && !/indietro|back|backwards|precedente/i.test(text);
    });
    if (!button) throw new Error("Next/Prosegui button not found");
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  });
  await delay(800);
}

async function collectPublishDiagnostics(page) {
  const url = page.url();
  return page.evaluate((currentUrl) => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const buttons = Array.from(document.querySelectorAll("button, .btn"))
      .map((node) => clean(node.textContent))
      .filter(Boolean)
      .slice(0, 20);
    const alerts = Array.from(document.querySelectorAll(".alert, .invalid-feedback, .error, .text-danger"))
      .map((node) => clean(node.textContent))
      .filter(Boolean)
      .slice(0, 20);

    return {
      url: currentUrl,
      title: document.title || "",
      buttons,
      alerts,
      bodyText: clean(document.body?.innerText).slice(0, 1200)
    };
  }, url).catch((error) => ({
    url,
    title: "",
    buttons: [],
    alerts: [error.message],
    bodyText: ""
  }));
}

async function waitForPhotoStep(page) {
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    const imageInput = document.querySelector('input[type="file"][name="items[]"], input[type="file"][name="inputFile"], input[type="file"][accept*="image"]');
    return Boolean(imageInput) && (
      /guidelines for posting photos|linee guida.*foto|photo|foto/i.test(text) ||
      /maximum of 6 photos|massimo.*6 foto/i.test(text)
    );
  }, { timeout: 30000 });
}

async function countUploadedPhotoPreviews(page) {
  return page.evaluate(() => {
    const selectors = [
      ".thumb-img",
      ".thumb-media img",
      ".preview img",
      ".image-preview img",
      ".file-preview img",
      ".dropArea img[src^='blob:']",
      ".dropArea img[src^='data:image']",
      "img[src^='blob:']",
      "img[src^='data:image']"
    ];

    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    return Array.from(document.querySelectorAll(selectors.join(","))).filter(isVisible).length;
  }).catch(() => 0);
}

async function clearUploadedImages(page) {
  const maxPasses = 8;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const removed = await page.evaluate(() => {
      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const previewSelectors = [
        ".thumb-img",
        ".thumb-media img",
        ".preview img",
        ".image-preview img",
        ".file-preview img",
        "img[src^='blob:']",
        "img[src^='data:image']"
      ];
      const actionPattern = /delete|remove|rimuovi|elimina|cancella|close|chiudi|×/i;
      const previews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);

      for (const preview of previews) {
        const scope = preview.closest(".thumb, .thumb-media, .preview, .image-preview, .file-preview, .col, .row, li, div") || preview.parentElement;
        const controls = Array.from((scope || document).querySelectorAll("button, .btn, i, a, span"))
          .filter(isVisible)
          .filter((node) => {
            const text = `${node.textContent || ""} ${node.getAttribute("title") || ""} ${node.getAttribute("aria-label") || ""} ${node.className || ""}`;
            return actionPattern.test(text) || /delete|trash|close|remove|times|cancel/i.test(text);
          });

        const control = controls[0];
        if (!control) continue;
        control.scrollIntoView({ block: "center", inline: "center" });
        control.click();
        return true;
      }

      return false;
    }).catch(() => false);

    if (!removed) break;

    await delay(500);
    await page.evaluate(() => {
      const confirmButton = document.querySelector(".swal2-popup.swal2-show .swal2-confirm");
      if (confirmButton) confirmButton.click();
    }).catch(() => null);
    await delay(700);
  }

  await page.evaluate(() => {
    for (const input of document.querySelectorAll('input[type="file"]')) {
      input.value = "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }).catch(() => null);
}

function resolveImagePaths(images = []) {
  const resolveExistingImage = (imagePath) => {
    // const normalizedPath = `${imagePath}`.replace(/\\/g, "/");
    const candidates = [];

    // if (/^\/web\/node\//i.test(normalizedPath)) {
    //   candidates.push(path.join("E:\\Web\\Node", normalizedPath.replace(/^\/web\/node\//i, "")));
    // }

    if (path.isAbsolute(imagePath)) {
      candidates.push(imagePath);
    } else {
      candidates.push(
        path.resolve(process.cwd(), imagePath),
        path.resolve(__dirname, imagePath),
        path.resolve(__dirname, "..", "..", imagePath)
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;

      const parsed = path.parse(candidate);
      const extensionCandidates = [".jpg", ".jpeg", ".png", ".webp"];
      for (const ext of extensionCandidates) {
        const alternate = path.join(parsed.dir, `${parsed.name}${ext}`);
        if (fs.existsSync(alternate)) return alternate;
      }
    }

    return candidates[0] || path.resolve(process.cwd(), imagePath);
  };

  const seen = new Set();
  const resolved = [];

  for (const image of images.filter(Boolean)) {
    const imagePath = resolveExistingImage(image);
    const key = imagePath.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(imagePath);
    if (resolved.length >= 6) break;
  }

  return resolved;
}

async function uploadImages(page, images = [], picsAudit = []) {
  await waitForPhotoStep(page);
  await clearUploadedImages(page);

  const auditPaths = picsAudit
    .map((item) => item?.path || item?.src || item?.origin)
    .filter(Boolean);
  const uploadSources = images.length ? images : auditPaths;
  const resolved = resolveImagePaths(uploadSources);
  const missing = resolved.filter((imagePath) => !fs.existsSync(imagePath));
  if (missing.length) {
    console.warn(`[trovagnocca:publish] Skipping missing photo files: ${missing.join(", ")}`);
  }

  const existing = resolved.filter((imagePath) => fs.existsSync(imagePath));
  console.log(existing.length, 'existing images length')
  if (!existing.length) {
    console.warn("[trovagnocca:publish] No existing photo files found. Continuing without uploading photos.");
    await delay(500);
    return 0;
  }

  const input = await page.$('input[type="file"][name="items[]"], input[type="file"][name="inputFile"], .dropArea input[type="file"], input[type="file"][accept*="image"], input[type="file"]');
  if (!input) throw new Error("Photo upload input not found");

  const thumbnailCountBefore = await countUploadedPhotoPreviews(page);

  await input.uploadFile(...existing);

  await page.waitForFunction((expectedCount, previousCount) => {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const hasSelectedFiles = fileInputs.some((node) => node.files && node.files.length >= expectedCount);
    const previews = Array.from(document.querySelectorAll(".thumb-img, .thumb-media img, .dropArea img, img[src^='blob:'], img[src^='data:image']"));
    return hasSelectedFiles || previews.length > previousCount || previews.length >= expectedCount;
  }, { timeout: 30000 }, existing.length, thumbnailCountBefore);

  await delay(1000);
  return existing.length;
}

function addTagWhen(tags, condition, label) {
  if (isEnabled(condition)) tags.push(label);
}

function buildTagSelections(adData = {}) {
  const tags = [];

  addTagWhen(tags, adData.serviceSNaturale, "Natural Breast");
  addTagWhen(tags, adData.serviceSRifatto, "Breast Reconstruction");

  addTagWhen(tags, adData.serviceCBiondi, "Blonde Hair");
  addTagWhen(tags, adData.serviceCMarroni, "Brown Hair");
  addTagWhen(tags, adData.serviceCNeri, "Black Hair");
  addTagWhen(tags, adData.serviceCRossi, "Red Hair");

  addTagWhen(tags, adData.serviceMagro, "Thin");
  addTagWhen(tags, adData.serviceFormoso, "Shapely");

  addTagWhen(tags, adData.serviceOrale, "Oral");
  addTagWhen(tags, adData.serviceAnale, "Anal");
  addTagWhen(tags, adData.serviceSadomaso, "Sadomasochism");
  addTagWhen(tags, adData.serviceEsperienzaFidanzata, "Girlfriend Experience");
  addTagWhen(tags, adData.serviceAttriciPorno, "Porn actresses");
  addTagWhen(tags, adData.serviceEiaculazioneSulCorpo, "Ejaculation on the body");
  addTagWhen(tags, adData.serviceMassaggioErotico, "Erotic massage");
  addTagWhen(tags, adData.serviceMassaggioTantrico, "Tantric massage");
  addTagWhen(tags, adData.serviceFetish, "Fetish");
  addTagWhen(tags, adData.serviceBacioAllaFrancese, "French kiss");
  addTagWhen(tags, adData.serviceGiocoDiRuolo, "Role-playing game");
  addTagWhen(tags, adData.serviceTrio, "Trio");
  addTagWhen(tags, adData.serviceSexting, "Sexting");
  addTagWhen(tags, adData.serviceVideoChiamata, "Video call");

  addTagWhen(tags, adData.serviceUomini, "Men");
  addTagWhen(tags, adData.serviceDonne, "Women");
  addTagWhen(tags, adData.serviceCoppie, "Couples");
  addTagWhen(tags, adData.serviceDisabili, "Disabled");

  addTagWhen(tags, adData.serviceACasa, "At home");
  addTagWhen(tags, adData.serviceEventiEFeste, "Events and parties");
  addTagWhen(tags, adData.serviceAlbergoMotel, "Hotel/Motel");
  addTagWhen(tags, adData.serviceClubs, "Clubs");
  addTagWhen(tags, adData.serviceVisitaADomicilio, "Home visit");

  return tags;
}

async function fillTagsStep(page, data) {
  const reachedTags = await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    const hasTagsControls = Boolean(document.querySelector(".tagsCard, button.tags_btn"));
    return hasTagsControls || /tags|tag|about you|su di me|nazionalita|nationality/i.test(text);
  }, { timeout: 20000 }).then(() => true).catch(() => false);

  if (!reachedTags) {
    console.warn("[trovagnocca:publish] Tags step not reached", JSON.stringify(await collectPublishDiagnostics(page)));
    return false;
  }

  await setNationality(page, data.nationality);
  await clickTagButtons(page, data.tags);
  return true;
}

async function waitForPromoStep(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("#ads-post-free");
    if (!button) return false;
    const style = window.getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }, { timeout: 30000 });
}

function getGoldDuration(typeAnnuncio = "") {
  const value = `${typeAnnuncio || ""}`.toLowerCase();
  if (value.includes("1x7") || value.includes("7")) return "7";
  if (value.includes("1x3") || value.includes("3")) return "3";
  return "1";
}

function normalizeGoldGroup(value = "") {
  const text = normalizeKey(value);
  if (text.includes("all") || text.includes("intero")) return "ALLDAY";
  if (text.includes("matt")) return "MATTINA";
  if (text.includes("pomer")) return "POMERIGGIO";
  if (text.includes("sera")) return "SERA";
  if (text.includes("nott")) return "NOTTE";
  return "";
}

function goldGroupForHour(hour) {
  if (hour >= 6 && hour < 12) return "MATTINA";
  if (hour >= 12 && hour < 18) return "POMERIGGIO";
  if (hour >= 18 && hour < 24) return "SERA";
  return "NOTTE";
}

function expandRangeSlots(period = "") {
  const periodText = `${period || ""}`.trim();
  const match = periodText.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return [];

  const startHour = Number(match[1]) % 24;
  const endHour = Number(match[3]) % 24;
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return [];

  return [{
    group: goldGroupForHour(startHour),
    label: periodText.replace(/\s*-\s*/g, "-")
  }];
}

function parseGoldPeriods(period = "") {
  if (!period) return [];

  try {
    const parsed = JSON.parse(period);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => {
        if (typeof item === "string") return parseGoldPeriods(item);

        const group = normalizeGoldGroup(item?.group);
        const slots = Array.isArray(item?.slots) ? item.slots : [];
        if (group === "ALLDAY") return [{ group, label: "ALLDAY" }];
        return slots.map((slot) => ({
          group: group || goldGroupForHour(Number(`${slot}`.match(/\d{1,2}/)?.[0] || 0)),
          label: `${slot || ""}`.trim()
        })).filter((slot) => slot.label);
      });
    }
  } catch {
    // Legacy period values are handled below.
  }

  const group = normalizeGoldGroup(period);
  if (group === "ALLDAY") return [{ group, label: "ALLDAY" }];

  const rangeSlots = expandRangeSlots(period);
  if (rangeSlots.length) return rangeSlots;

  return [{ group: group || "", label: `${period}`.trim() }].filter((slot) => slot.label);
}

function groupGoldSlots(period = "") {
  const slots = parseGoldPeriods(period);
  const result = {};

  for (const slot of slots) {
    const group = normalizeGoldGroup(slot.group) || goldGroupForHour(Number(`${slot.label}`.match(/\d{1,2}/)?.[0] || 0));
    if (!result[group]) result[group] = [];
    result[group].push(slot.label);
  }

  return result;
}

async function selectGoldDuration(page, duration) {
  await page.evaluate((durationValue) => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    const select = Array.from(document.querySelectorAll("select")).find((node) => {
      const sectionText = clean(node.closest(".section, div")?.textContent);
      const options = Array.from(node.options || []).map((option) => `${option.value}:${clean(option.textContent)}`);
      return /giorni|days/.test(sectionText) || options.some((option) => /1|3|7/.test(option));
    });

    if (!select) throw new Error("Gold Plan duration select not found");
    const option = Array.from(select.options || []).find((item) => `${item.value}` === `${durationValue}`);
    if (!option) throw new Error(`Gold Plan duration option not found: ${durationValue}`);

    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (nativeValueSetter) nativeValueSetter.call(select, option.value);
    else select.value = option.value;
    option.selected = true;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, duration);

  await delay(700);
}

async function selectGoldAllDay(page) {
  const selected = await page.evaluate(() => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const groups = Array.from(document.querySelectorAll(".group, .group-allday, div"));
    const group = groups.find((node) => /intero giorno/i.test(clean(node.textContent || "")));
    const button = group?.querySelector("button");
    if (!button) return false;
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    return true;
  });

  if (!selected) throw new Error("Gold Plan all-day selector not found");
  await delay(700);
}

async function selectGoldGroupSlots(page, groupedSlots) {
  for (const [groupName, slots] of Object.entries(groupedSlots)) {
    if (groupName === "ALLDAY") {
      await selectGoldAllDay(page);
      continue;
    }

    const opened = await page.evaluate((groupLabel) => {
      const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
      const wanted = clean(groupLabel);
      const groups = Array.from(document.querySelectorAll(".group"));
      const group = groups.find((node) => clean(node.querySelector(".group-title")?.textContent || node.textContent).includes(wanted));
      if (!group) return false;

      const toggle = group.querySelector('button[role="switch"], button.toggle, .toggle');
      if (toggle && toggle.getAttribute("aria-checked") !== "true") {
        toggle.scrollIntoView({ block: "center", inline: "center" });
        toggle.click();
      } else {
        group.scrollIntoView({ block: "center", inline: "center" });
      }
      return true;
    }, groupName);

    if (!opened) throw new Error(`Gold Plan group not found: ${groupName}`);
    await delay(700);

    for (const slotLabel of slots) {
      const clicked = await page.evaluate((label) => {
        const normalize = (value) => `${value || ""}`
          .replace(/\s*-\s*/g, "-")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        const wanted = normalize(label);
        const controls = Array.from(document.querySelectorAll("button, label, .btn, .slot, .time-slot, .custom-control"));
        const target = controls.find((node) => normalize(node.textContent).includes(wanted));
        if (!target) return false;

        const input = target.querySelector?.("input[type='checkbox'], input[type='radio']") ||
          (target.getAttribute?.("for") ? document.getElementById(target.getAttribute("for")) : null);
        const clickable = input || target;
        clickable.scrollIntoView({ block: "center", inline: "center" });
        clickable.click();
        return true;
      }, slotLabel);

      if (!clicked) {
        console.warn(`[trovagnocca:publish] Gold Plan slot not found: ${groupName} ${slotLabel}`);
      }
      await delay(250);
    }
  }
}

async function clickGoldPublish(page) {
  await page.evaluate(() => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const candidates = Array.from(document.querySelectorAll("button, .btn"));
    const button = candidates.find((node) => {
      const text = clean(node.textContent);
      const disabled = node.disabled || node.classList.contains("disabled");
      return !disabled && !node.matches("#ads-post-free") && /pubblica|acquista|conferma|procedi|paga/i.test(text);
    });

    if (!button) throw new Error("Gold Plan publish/purchase button not found");
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  });
  await delay(1000);
}

async function clickGoldPublishFlow(page, data) {
  await waitForPromoStep(page);
  await selectGoldDuration(page, getGoldDuration(data.typeAnnuncio));

  const groupedSlots = groupGoldSlots(data.period);
  if (!Object.keys(groupedSlots).length) {
    await selectGoldAllDay(page);
  } else {
    await selectGoldGroupSlots(page, groupedSlots);
  }

  await clickGoldPublish(page);
}

async function clickPublish(page) {
  await waitForPromoStep(page);

  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, .btn"));
    const button = document.querySelector("#ads-post-free") || candidates.find((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      const disabled = node.disabled || node.classList.contains("disabled");
      return !disabled && /publish for free|pubblica gratis|pubblica|conferma|salva|invia/i.test(text);
    });
    if (!button) throw new Error("Publish button not found");
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
  });
}

async function confirmFreePublishWarning(page) {
  const clickSweetAlertConfirm = async (labelPattern, timeout = 10000) => {
    const confirmVisible = await page.waitForFunction((labelSource) => {
      const confirmButton = document.querySelector(".swal2-popup.swal2-show .swal2-confirm");
      if (!confirmButton) return false;

      const text = (confirmButton.textContent || "").replace(/\s+/g, " ").trim();
      const style = window.getComputedStyle(confirmButton);
      const rect = confirmButton.getBoundingClientRect();
      const visible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;

      return visible && new RegExp(labelSource, "i").test(text);
    }, { timeout }, labelPattern.source).then(() => true).catch(() => false);

    if (!confirmVisible) return false;

    await page.evaluate(() => {
      const confirmButton = document.querySelector(".swal2-popup.swal2-show .swal2-confirm");
      if (!confirmButton) return;
      confirmButton.scrollIntoView({ block: "center", inline: "center" });
      confirmButton.click();
    });

    await delay(800);
    return true;
  };

  const continued = await clickSweetAlertConfirm(/continua|continue/i);
  const publishState = await page.waitForFunction(() => {
    const popup = document.querySelector(".swal2-popup.swal2-show");
    if (!popup) return "";

    const text = (popup.textContent || "").replace(/\s+/g, " ").trim();
    if (/annuncio.*visibile online|annuncio.*pubblicato.*successo|pubblicato con successo|published successfully/i.test(text)) {
      return "published";
    }
    if (/annuncio\s+non.*ancora\s+pubblicato|fase di approvazione|riceverai una mail di conferma/i.test(text)) {
      return "pendingApproval";
    }
    return "";
  }, { timeout: 45000 }).then((handle) => handle.jsonValue()).catch(() => "");

  const closedSuccess = publishState ? await clickSweetAlertConfirm(/chiudi|close/i, 5000) : false;
  return {
    continued,
    published: publishState === "published",
    pendingApproval: publishState === "pendingApproval",
    closedSuccess
  };
}

async function waitForPublishResult(page) {
  await Promise.race([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
    page.waitForFunction(() => {
      const text = document.body.innerText || "";
      return /annuncio.*pubblic|pubblicato|published|success|successo|complimenti|congrat/i.test(text) ||
        /errore|required|obbligatori|non valido|invalid|failed|fallito/i.test(text);
    }, { timeout: 45000 }).catch(() => null)
  ]);

  await delay(1500);

  const diagnostics = await collectPublishDiagnostics(page);
  const text = `${diagnostics.bodyText} ${diagnostics.alerts.join(" ")}`;
  const hasError = /errore|required|obbligatori|non valido|invalid|failed|fallito|captcha/i.test(text);
  const hasSuccess = /annuncio.*pubblic|pubblicato|published|success|successo|complimenti|congrat/i.test(text);

  return {
    hasError,
    hasSuccess,
    diagnostics
  };
}

function buildPublishData(adData = {}) {
  const contactNote = parseTrovagnoccaNote(adData.note);
  const typeAnnuncio = firstNonEmpty(adData.typeAnnuncio, adData.promo?.visibility, "Free");
  return {
    category: normalizeCategory(adData.categorie || adData.sono || adData.category),
    city: CITY_VALUES[normalizeKey(firstNonEmpty(adData.city, adData.annunci_city, adData.comune))] || firstNonEmpty(adData.city, adData.annunci_city, adData.comune),
    address: firstNonEmpty(adData.address, adData.indirizzo),
    zone: firstNonEmpty(adData.location, adData.zone, adData.zona),
    age: firstNonEmpty(adData.age, adData.years),
    title: firstNonEmpty(adData.title, adData.titolo),
    description: firstNonEmpty(adData.description, adData.testo),
    phone: firstNonEmpty(adData.phone, adData.contattotelefonico),
    whatsapp: isEnabled(adData.whatsapp) || isEnabled(adData.hasWhatapp),
    telegram: isEnabled(adData.telegram) || Boolean(contactNote.telegram || contactNote.telegramNumber || contactNote.telegramUrl),
    nationality: firstNonEmpty(adData.serviceNazionalita, adData.nationality, adData.nazionalita),
    tags: buildTagSelections(adData),
    images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : []),
    picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
    typeAnnuncio,
    period: firstNonEmpty(adData.period, adData.promo?.schedule),
    promo: {
      active: isEnabled(adData.promo?.active) || typeAnnuncio !== "Free",
      visibility: typeAnnuncio,
      schedule: firstNonEmpty(adData.period, adData.promo?.schedule)
    }
  };
}

async function solveRecaptcha(page, options = {}) {
  // Bridge browser logs to Node terminal for debugging
  page.on('console', msg => {
    if (msg.text().includes('[Captcha]')) console.log(`[Browser] ${msg.text()}`);
  });

  await page.waitForSelector('iframe[title="reCAPTCHA"]', { timeout: 15000 });
  console.log('[trovagnocca] Solving reCAPTCHA on Stepper...');

  const siteKey = '6LeghE4gAAAAAPMCvQ_nOzXwunnt9wfu_SCc3Zu_';

  // 1. Get token from solver
  // Ensure your options.getCaptchaToken passes the current page URL and siteKey
  const token = await options.getCaptchaToken(page, siteKey);

  if (!token) throw new Error('Failed to get reCAPTCHA token');
  console.log('[trovagnocca] reCAPTCHA token obtained');

  const result = await page.evaluate((token) => {
    console.log("[Captcha] Starting Universal Stepper Injection...");

    const triggerEvents = (el) => {
      ['input', 'change', 'blur'].forEach(ev => {
        el.dispatchEvent(new Event(ev, { bubbles: true }));
      });
    };

    // 1. Fill all reCAPTCHA response fields found in the DOM
    const textareas = document.querySelectorAll('textarea[name="g-recaptcha-response"], .g-recaptcha-response');
    textareas.forEach(t => {
      t.value = token;
      t.innerHTML = token;
      triggerEvents(t);
    });

    // 2. Deep Search and Execute reCAPTCHA Callback
    let callbackExecuted = false;
    if (typeof ___grecaptcha_cfg !== 'undefined') {
      try {
        const clients = ___grecaptcha_cfg.clients;
        for (let id in clients) {
          const client = clients[id];
          const findAndRun = (obj) => {
            for (let k in obj) {
              if (obj[k] && typeof obj[k].callback === 'function') {
                obj[k].callback(token);
                callbackExecuted = true;
                console.log(`[Captcha] Executed callback at ${k}`);
              } else if (typeof obj[k] === 'object' && obj[k] !== null && k !== 'parent') {
                findAndRun(obj[k]);
              }
            }
          };
          findAndRun(client);
        }
      } catch (e) {
        console.log("[Captcha] Callback search error: " + e.message);
      }
    }

    // 3. Fallback: Force Vue instance variables
    if (!callbackExecuted) {
      try {
        const app = document.querySelector('#app');
        if (app && app.__vue_app__) {
          const walk = (comp) => {
            if (!comp) return;
            if (comp.proxy) {
              ['adsRecaptcha', 'recaptchaToken', 'token'].forEach(p => {
                if (p in comp.proxy) {
                  comp.proxy[p] = token;
                  console.log(`[Captcha] Manually set Vue property: ${p}`);
                  callbackExecuted = true;
                }
              });
            }
            if (comp.subTree && comp.subTree.component) walk(comp.subTree.component);
          };
          walk(app.__vue_app__._instance);
        }
      } catch (e) { }
    }

    // 4. Aggressive button click with visibility check
    return new Promise((resolve) => {
      // Small delay for Vue reactivity cycle
      setTimeout(() => {
        const candidates = Array.from(document.querySelectorAll('button, .btn, .toggler_next, div[role="button"]'));

        const nextBtn = candidates.find(el => {
          const text = (el.innerText || el.textContent || '').toLowerCase();
          const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          // Check for 'Prosegui' or 'Avanti' but ignore 'Indietro' (back)
          return isVisible &&
            (text.includes('prosegui') || text.includes('avanti')) &&
            !text.includes('indietro');
        });

        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled', 'deactivated');
          nextBtn.scrollIntoView({ block: 'center' });
          nextBtn.click();
          console.log("[Captcha] Next button clicked: " + nextBtn.innerText);
          resolve(true);
        } else {
          console.log("[Captcha] ERROR: No visible Next button found");
          resolve(false);
        }
      }, 800);
    });
  }, token);

  console.log('[trovagnocca] Injection finished. Button clicked:', result);

  // Buffer for transition
  await new Promise(r => setTimeout(r, 4500));

  const finalUrl = page.url();
  console.log('[trovagnocca] Current URL after step:', finalUrl);

  return { token, clickedNext: result };
}

async function publishAd(page, adData = {}, options = {}) {
  console.log(adData, "adData in PublishAd function")
  const publishedId = adData?.remotePostID;
  const data = buildPublishData(adData);

  console.log("[trovagnocca:publish] Publishing ad", {
    title: data.title,
    city: data.city,
    category: data.category,
    images: data.images
  });

  await waitForDmcApp(page, options.postUrl || POST_URL);

  await setWrappedSelect(page, "category", data.category);
  await delay(500);
  await setWrappedSelect(page, "city", data.city);
  if (data.address) await setWrappedInput(page, "address", data.address);
  if (data.zone) await setWrappedInput(page, "zone", data.zone);

  await setWrappedInput(page, "age", data.age);
  await setTextarea(page, "#txtAdsTitle", data.title);
  await setTextarea(page, "#txtAdsText", data.description);

  await setWrappedInput(page, "phone", data.phone);
  await setContactMethod(page, "phone");
  await setSwitch(page, "whatsapp", data.whatsapp);
  await setSwitch(page, "telegram", data.telegram);

  // SOLVE reCAPTCHA HERE - RIGHT BEFORE CLICKING NEXT
  const step1Captcha = await solveRecaptcha(page, options);
  if (!step1Captcha.clickedNext) {
    await clickNext(page);
  }

  // let responseAdId = null;
  // page.on("response", async (response) => {
  //   const url = response.url();
  //   const method = response.request().method();

  //   if (!url.includes("/api/v1/resource/ad")) return;

  //   const parsedUrl = new URL(url);

  //   console.log("[debug url]", {
  //     raw: JSON.stringify(url),
  //     origin: parsedUrl.origin,
  //     pathname: parsedUrl.pathname,
  //     method,
  //     status: response.status()
  //   });

  //   if (
  //     parsedUrl.pathname === "/api/v1/resource/ad" &&
  //     method === "POST"
  //   ) {
  //     let body = null;

  //     try {
  //       body = await response.json();
  //     } catch {
  //       try {
  //         body = JSON.parse(await response.text());
  //       } catch {
  //         body = null;
  //       }
  //     }

  //     responseAdId = body?.data?.id
  //   }
  // });

  // console.log(responseAdId, "remoteAdId");
  const leftInfoStep = await waitForInfoStepExit(page);
  if (!leftInfoStep) {
    throw new Error(`Trovagnocca did not leave contacts step after info submit: ${JSON.stringify(await collectPublishDiagnostics(page))}`);
  }

  const tagsReached = await fillTagsStep(page, data);
  if (!tagsReached) {
    throw new Error(`Trovagnocca did not advance to tags step after info submit: ${JSON.stringify(await collectPublishDiagnostics(page))}`);
  }
  await clickNext(page);
  await clearUploadedImages(page);
  const uploadImageslength = await uploadImages(page, data.images, data.picsAudit);
  console.log(uploadImageslength, 'uploaded images count')
  await clickNext(page);
  await setSwitch(page, "ck_term", true);

  if (data.promo.active) {
    await clickGoldPublishFlow(page, data);
  } else {
    await clickPublish(page);
  }
  const publishModal = await confirmFreePublishWarning(page);
  const publishResult = await waitForPublishResult(page);

  const url = page.url();
  let response = {
    ok: false,
    url,
    payload: {
      idpriv: publishedId,
      data
    }
  }

  if (publishedId) {//Status Edit
    response.ok = true;
  } else {// New publish
    const urlIdMatch = url.match(/\/ads\/manage\/(\d{4,})\b/i);
    const remoteId = urlIdMatch
      ? urlIdMatch[1]
      : await page.evaluate(() => {
        const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
        hrefs.push(window.location.href);
        const idMatch = hrefs.join(" ").match(/\/ads\/manage\/(\d{4,})\b/i) ||
          hrefs.join(" ").match(/(?:annuncio|ads|post|id|manage|edit)[^\d]*(\d{4,})/i);
        return idMatch ? idMatch[1] : "";
      }).catch(() => "");

    const publishLink = await page.evaluate(() => {
      const previewLabel = Array.from(document.querySelectorAll("p, span, div"))
        .find((node) => (node.textContent || "").trim().toLowerCase() === "anteprima");

      const container = previewLabel?.parentElement;
      const link = container?.querySelector("a[href]");

      return link?.href || "";
    });

    console.log(publishLink, remoteId, "publishLink");

    if (publishResult.hasError || (!publishResult.hasSuccess && !publishModal.published && !publishModal.pendingApproval && !remoteId)) {
      throw new Error(`Trovagnocca publish did not confirm success: ${JSON.stringify(publishResult.diagnostics)}`);
    }

    if (remoteId) {
      response.ok = true;
      response.url = publishLink
      response.payload = {
        idpriv: remoteId,
        data
      }
    }
  }

  return response;
}

module.exports = {
  POST_URL,
  buildPublishData,
  publishAd
};
