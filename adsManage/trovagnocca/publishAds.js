const fs = require("fs");
const path = require("path");

const POST_URL = "https://www.trovagnocca.com/dmc/account#/ads-post";
const ACTIVE_ADS_URL = "https://www.trovagnocca.com/dmc/account#/ads/active";
const TROVAGNOCCA_PUBLISH_SCREENSHOT_DIR = path.join("./screenshots", "trovagnocca-publish");
const PHOTO_INPUT_SELECTOR = 'input[type="file"][name="items[]"], input[type="file"][name="inputFile"], .dropArea input[type="file"], input[type="file"][accept*="image"], input[type="file"]';
const PHOTO_PREVIEW_SELECTORS = [
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
const COVER_BUTTON_SELECTOR = "button.btn_cover, button";

function ensureTrovagnoccaScreenshotDir() {
  if (!fs.existsSync(TROVAGNOCCA_PUBLISH_SCREENSHOT_DIR)) {
    fs.mkdirSync(TROVAGNOCCA_PUBLISH_SCREENSHOT_DIR, { recursive: true });
  }
  return TROVAGNOCCA_PUBLISH_SCREENSHOT_DIR;
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

const screenshotDir = path.join('./screenshots', 'trovagnocca-publish');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureTrovagnoccaStepScreenshot(page, label) {
  try {
    const dir = ensureTrovagnoccaScreenshotDir();
    const safeLabel = `${label || "step"}`.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    const filePath = path.join(dir, `${safeLabel}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[trovagnocca:screenshot] ${label}: ${filePath}`);
    return filePath;
  } catch (error) {
    console.warn(`[trovagnocca:screenshot] Failed to capture ${label}: ${error.message}`);
    return "";
  }
}

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

async function setWrappedSelect(page, wrapperName, wanted, options = {}) {
  const force = Boolean(options.force);

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

  await page.evaluate(({ wrapperName, wanted, force }) => {
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

    if (force) {
      select.disabled = false;
      select.readOnly = false;
      select.removeAttribute("disabled");
      select.removeAttribute("readonly");
      select.removeAttribute("aria-disabled");

      let node = select;
      while (node && node !== document.body) {
        node.classList?.remove("disabled", "deactivated", "readonly");
        node.removeAttribute?.("disabled");
        node.removeAttribute?.("readonly");
        node.removeAttribute?.("aria-disabled");
        node = node.parentElement;
      }
    }

    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (nativeValueSetter) {
      nativeValueSetter.call(select, option.value);
    } else {
      select.value = option.value;
    }
    option.selected = true;
    ["input", "change", "blur"].forEach((eventName) => {
      select.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    if (`${select.value}` !== `${option.value}`) {
      throw new Error(`Select ${wrapperName} did not keep value ${option.value}; current=${select.value}`);
    }
  }, { wrapperName, wanted, force });
}

async function ensureWrappedSelectHasValue(page, wrapperName, fallbackValue) {
  await delay(1500);

  const selectState = await page.evaluate((wrapperName) => {
    const isPlaceholderText = (value) => /seleziona|select|scegli|choose/i.test(`${value || ""}`);
    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const wrapperSelect = wrapper?.querySelector("select");
    const matchingSelect = wrapperSelect || Array.from(document.querySelectorAll("select")).find((select) => {
      const ownerName = select.closest("[name]")?.getAttribute("name") || "";
      const text = `${ownerName} ${select.name || ""} ${select.id || ""}`.toLowerCase();
      return text.includes(`${wrapperName}`.toLowerCase());
    });

    if (!matchingSelect) {
      return {
        found: false,
        hasValue: false,
        value: "",
        text: ""
      };
    }

    const value = `${matchingSelect.value || ""}`.trim();
    const selectedText = `${matchingSelect.selectedOptions?.[0]?.textContent || ""}`.replace(/\s+/g, " ").trim();
    const hasValue = Boolean(value) && !isPlaceholderText(selectedText);

    return {
      found: true,
      hasValue,
      value,
      text: selectedText
    };
  }, wrapperName);

  if (selectState.hasValue) {
    console.log(`[trovagnocca:update] Keeping existing ${wrapperName}:`, selectState);
    return selectState;
  }

  console.log(`[trovagnocca:update] ${wrapperName} is empty, setting fallback: ${fallbackValue}`, selectState);
  await setWrappedSelect(page, wrapperName, fallbackValue, { force: true });

  return page.evaluate((wrapperName) => {
    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const select = wrapper?.querySelector("select") || Array.from(document.querySelectorAll("select")).find((item) => (
      `${item.closest("[name]")?.getAttribute("name") || ""}`.toLowerCase().includes(`${wrapperName}`.toLowerCase())
    ));
    return {
      found: Boolean(select),
      hasValue: Boolean(`${select?.value || ""}`.trim()),
      value: `${select?.value || ""}`.trim(),
      text: `${select?.selectedOptions?.[0]?.textContent || ""}`.replace(/\s+/g, " ").trim()
    };
  }, wrapperName);
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
    const normalize = (value) => `${value || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cards = Array.from(document.querySelectorAll(".tagsCard, .card"));
    const card = cards.find((node) => /nazionalita|nationality/i.test(normalize(node.textContent || "")));
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
      const isSelected = button.classList.contains("selected") ||
        button.classList.contains("active") ||
        button.classList.contains("btn-primary") ||
        button.getAttribute("aria-pressed") === "true";
      if (!isSelected) {
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

async function waitForUploadedPhotoCards(page, expectedCount) {
  await page.waitForFunction(({ previewSelectors, buttonSelector, expected }) => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const isCoverButton = (button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""} ${button.className || ""}`;
      return /anteprima|cover|copertina|btn_cover/i.test(text);
    };
    const visiblePreviews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);
    const cards = [];
    const seen = new Set();

    for (const button of Array.from(document.querySelectorAll(buttonSelector)).filter((node) => isVisible(node) && isCoverButton(node))) {
      let node = button.parentElement;
      while (node && node !== document.body) {
        const hasPreview = visiblePreviews.some((preview) => node.contains(preview));
        if (hasPreview) {
          if (!seen.has(node)) {
            seen.add(node);
            cards.push(node);
          }
          break;
        }
        node = node.parentElement;
      }
    }

    return cards.length >= expected;
  }, { timeout: 45000 }, {
    previewSelectors: PHOTO_PREVIEW_SELECTORS,
    buttonSelector: COVER_BUTTON_SELECTOR,
    expected: expectedCount
  });
}

async function countUploadedPhotoCards(page) {
  return page.evaluate(({ previewSelectors, buttonSelector }) => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const isCoverButton = (button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""} ${button.className || ""}`;
      return /anteprima|cover|copertina|btn_cover/i.test(text);
    };
    const visiblePreviews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);
    const cards = [];
    const seen = new Set();

    for (const button of Array.from(document.querySelectorAll(buttonSelector)).filter((node) => isVisible(node) && isCoverButton(node))) {
      let node = button.parentElement;
      while (node && node !== document.body) {
        const hasPreview = visiblePreviews.some((preview) => node.contains(preview));
        if (hasPreview) {
          if (!seen.has(node)) {
            seen.add(node);
            cards.push(node);
          }
          break;
        }
        node = node.parentElement;
      }
    }

    return cards.length;
  }, {
    previewSelectors: PHOTO_PREVIEW_SELECTORS,
    buttonSelector: COVER_BUTTON_SELECTOR
  }).catch(() => 0);
}

async function waitForNewUploadedPhotoCard(page, expectedCount, previousPreviewCount, previousCardCount) {
  await page.waitForFunction(({ previewSelectors, buttonSelector, expected, previousPreviews, previousCards }) => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const isCoverButton = (button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""} ${button.className || ""}`;
      return /anteprima|cover|copertina|btn_cover/i.test(text);
    };
    const visiblePreviews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);
    const cards = [];
    const seen = new Set();

    for (const button of Array.from(document.querySelectorAll(buttonSelector)).filter((node) => isVisible(node) && isCoverButton(node))) {
      let node = button.parentElement;
      while (node && node !== document.body) {
        const hasPreview = visiblePreviews.some((preview) => node.contains(preview));
        if (hasPreview) {
          if (!seen.has(node)) {
            seen.add(node);
            cards.push(node);
          }
          break;
        }
        node = node.parentElement;
      }
    }

    return cards.length > previousCards ||
      cards.length >= expected ||
      visiblePreviews.length > previousPreviews ||
      visiblePreviews.length >= expected;
  }, { timeout: 30000 }, {
    previewSelectors: PHOTO_PREVIEW_SELECTORS,
    buttonSelector: COVER_BUTTON_SELECTOR,
    expected: expectedCount,
    previousPreviews: previousPreviewCount,
    previousCards: previousCardCount
  });

  const cardCount = await countUploadedPhotoCards(page);
  return Math.max(0, cardCount - 1);
}

async function clearUploadedImages(page) {
  console.log("[clearUploadedImages] start");

  // Wait until at least one file/image input or preview element is visible
  try {
    await page.waitForSelector(
      'input[type="file"], .thumb-img, .thumb-media img, .preview img, .image-preview img, .file-preview img',
      { visible: true, timeout: 5000 } // wait up to 15 seconds
    );
  } catch (err) {
    console.log("[clearUploadedImages] no images or file inputs found yet");
  }

  // Click "Rimuovi tutto" if it exists
  const clickedRemoveAll = await page.evaluate(() => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const removeAllButton = Array.from(
      document.querySelectorAll("button, .btn, a")
    ).find((btn) => {
      if (!isVisible(btn)) return false;
      const text = (btn.textContent || "").trim().toLowerCase();
      return text.includes("rimuovi tutto") || text.includes("remove all");
    });

    if (!removeAllButton) return false;

    removeAllButton.scrollIntoView({ block: "center", inline: "center" });
    removeAllButton.click();
    return true;
  }).catch(() => false);

  console.log("[clearUploadedImages] clickedRemoveAll:", clickedRemoveAll);

  if (clickedRemoveAll) {
    // Wait for removal to finish
    await delay(1500);
  } else {
    for (let pass = 0; pass < 8; pass += 1) {
      const removedOne = await page.evaluate((previewSelectors) => {
        const isVisible = (node) => {
          if (!node) return false;
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const actionPattern = /delete|remove|rimuovi|elimina|cancella|close|chiudi|×/i;
        const previews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);

        for (const preview of previews) {
          let node = preview.parentElement;
          while (node && node !== document.body) {
            const controls = Array.from(node.querySelectorAll("button, .btn, i, a, span"))
              .filter(isVisible)
              .filter((control) => {
                const text = `${control.textContent || ""} ${control.getAttribute("title") || ""} ${control.getAttribute("aria-label") || ""} ${control.className || ""}`;
                return actionPattern.test(text);
              });

            const control = controls[0];
            if (control) {
              control.scrollIntoView({ block: "center", inline: "center" });
              control.click();
              return true;
            }

            node = node.parentElement;
          }
        }

        return false;
      }, PHOTO_PREVIEW_SELECTORS).catch(() => false);

      if (!removedOne) break;
      await delay(700);
      await page.evaluate(() => {
        const confirmButton = document.querySelector(".swal2-popup.swal2-show .swal2-confirm");
        if (confirmButton) confirmButton.click();
      }).catch(() => null);
      await delay(700);
    }
  }

  // Clear file inputs
  await page.evaluate(() => {
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      input.value = "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }).catch(() => null);

  console.log("[clearUploadedImages] finished");
}

function resolveImagePaths(images = []) {
  const resolveExistingImage = (imagePath) => {
    const normalizedPath = `${imagePath}`.replace(/\\/g, "/");
    const candidates = [];

    if (/^\/web\/node\//i.test(normalizedPath)) {
      candidates.push(path.join("E:\\Web\\Node", normalizedPath.replace(/^\/web\/node\//i, "")));
    }

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
  await delay(2000);
  const screenshotDir = ensureTrovagnoccaScreenshotDir();
  await page.screenshot({ path: `${screenshotDir}/clearUploadedImages.png`, fullPage: true });
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

  const anteprimaItem = picsAudit.find((item) => item?.isAnteprima === true);
  const normalizePath = (value) => path.resolve(`${value || ""}`).toLowerCase();
  const anteprimaPath = anteprimaItem ? normalizePath(anteprimaItem.path || anteprimaItem.src || anteprimaItem.origin) : "";
  const anteprimaIndex = anteprimaPath
    ? existing.findIndex((imagePath) => normalizePath(imagePath) === anteprimaPath)
    : -1;

  if (anteprimaItem && anteprimaIndex < 0) {
    console.warn(`[trovagnocca:publish] Anteprima image path not matched. No anteprima button will be clicked: ${anteprimaItem.path || anteprimaItem.src || anteprimaItem.origin}`);
  }

  for (let index = 0; index < existing.length; index += 1) {
    const input = await page.$(PHOTO_INPUT_SELECTOR);
    if (!input) throw new Error("Photo upload input not found");

    const thumbnailCountBefore = await countUploadedPhotoPreviews(page);
    const cardsBefore = await countUploadedPhotoCards(page);

    await input.uploadFile(existing[index]);

    const cardIndex = await waitForNewUploadedPhotoCard(page, index + 1, thumbnailCountBefore, cardsBefore);

    if (index === anteprimaIndex) {
      await clickAnteprimaImageButton(page, cardIndex);
    }

    await delay(400);
  }

  await waitForUploadedPhotoCards(page, existing.length);
  await page.screenshot({ path: `${screenshotDir}/clickAnteprimaImageButton.png`, fullPage: true });
  return existing.length;
}

async function clickAnteprimaImageButton(page, targetIndex = 0) {
  await waitForUploadedPhotoCards(page, targetIndex + 1);

  const clicked = await page.evaluate(({ index, previewSelectors, buttonSelector }) => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const isCoverButton = (button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""} ${button.className || ""}`;
      return /anteprima|cover|copertina|btn_cover/i.test(text);
    };
    const isSelected = (button, card) => {
      const label = `${button.textContent || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""}`;
      const classText = `${button.className || ""} ${card?.className || ""}`.replace(/\bbtn_cover\b/gi, "");
      return /selezionat|impostata|copertina/i.test(label) || /active|selected|primary|success|warning/i.test(classText);
    };
    const visiblePreviews = Array.from(document.querySelectorAll(previewSelectors.join(","))).filter(isVisible);
    const cards = [];
    const seen = new Set();

    for (const button of Array.from(document.querySelectorAll(buttonSelector)).filter((node) => isVisible(node) && isCoverButton(node))) {
      let node = button.parentElement;
      while (node && node !== document.body) {
        const hasPreview = visiblePreviews.some((preview) => node.contains(preview));
        if (hasPreview) {
          if (!seen.has(node)) {
            seen.add(node);
            cards.push({ card: node, button });
          }
          break;
        }
        node = node.parentElement;
      }
    }

    const target = cards[index] || cards[0];
    if (!target) return { ok: false, cardCount: cards.length };

    target.button.scrollIntoView({ block: "center", inline: "center" });
    target.button.click();
    return {
      ok: true,
      cardCount: cards.length,
      selected: isSelected(target.button, target.card),
      buttonText: `${target.button.textContent || ""}`.replace(/\s+/g, " ").trim(),
      buttonClass: `${target.button.className || ""}`,
      cardClass: `${target.card.className || ""}`
    };
  }, {
    index: targetIndex,
    previewSelectors: PHOTO_PREVIEW_SELECTORS,
    buttonSelector: COVER_BUTTON_SELECTOR
  });

  if (!clicked.ok) {
    console.warn("[trovagnocca:publish] Anteprima button not found after image upload.");
    return false;
  }

  await delay(700);
  console.log(`[trovagnocca:publish] Anteprima image button clicked at index ${targetIndex}`);

  return true;
}

function addTagWhen(tags, condition, label) {
  if (isEnabled(condition)) tags.push(label);
}

function addNoteTags(tags, noteTags = {}) {
  const groups = [
    "ethnicity",
    "breast",
    "hair",
    "body",
    "services",
    "serviceFor",
    "servicePlace"
  ];

  for (const group of groups) {
    const values = Array.isArray(noteTags[group]) ? noteTags[group] : [];
    for (const value of values) {
      const label = cleanText(value);
      if (label) tags.push(label);
    }
  }
}

function buildTagSelections(adData = {}) {
  const tags = [];
  const noteTags = parseTrovagnoccaNote(adData.note).tags || {};

  addNoteTags(tags, noteTags);

  addTagWhen(tags, adData.serviceAfricana, "Africana");
  addTagWhen(tags, adData.serviceAraba, "Araba");
  addTagWhen(tags, adData.serviceAsiatica, "Asiatica");
  addTagWhen(tags, adData.serviceCaucasica, "Caucasica");
  addTagWhen(tags, adData.serviceItaliana, "Europea");
  addTagWhen(tags, adData.serviceLatina, "Latina");

  addTagWhen(tags, adData.serviceSNaturale, "Seno Naturale");
  addTagWhen(tags, adData.serviceSRifatto, "Seno Rifatto");

  addTagWhen(tags, adData.serviceCBiondi, "Capelli Biondi");
  addTagWhen(tags, adData.serviceCMarroni, "Capelli Marroni");
  addTagWhen(tags, adData.serviceCNeri, "Capelli Neri");
  addTagWhen(tags, adData.serviceCRossi, "Capelli Rossi");

  addTagWhen(tags, adData.serviceMagro, "Magro");
  addTagWhen(tags, adData.serviceFormoso, "Formoso");

  addTagWhen(tags, adData.serviceOrale, "Orale");
  addTagWhen(tags, adData.serviceAnale, "Anale");
  addTagWhen(tags, adData.serviceSadomaso, "Sadomaso");
  addTagWhen(tags, adData.serviceEsperienzaFidanzata, "Esperienza fidanzata");
  addTagWhen(tags, adData.serviceAttriciPorno, "Attrici porno");
  addTagWhen(tags, adData.serviceEiaculazioneSulCorpo, "Eiaculazione sul corpo");
  addTagWhen(tags, adData.serviceMassaggioErotico, "Massaggio erotico");
  addTagWhen(tags, adData.serviceMassaggioTantrico, "Massaggio tantrico");
  addTagWhen(tags, adData.serviceFetish, "Fetish");
  addTagWhen(tags, adData.serviceBacioAllaFrancese, "Bacio alla francese");
  addTagWhen(tags, adData.serviceGiocoDiRuolo, "Gioco di ruolo");
  addTagWhen(tags, adData.serviceTrio, "Trio");
  addTagWhen(tags, adData.serviceSexting, "Sexting");
  addTagWhen(tags, adData.serviceVideoChiamata, "Video chiamata");

  addTagWhen(tags, adData.serviceUomini, "Uomini");
  addTagWhen(tags, adData.serviceDonne, "Donne");
  addTagWhen(tags, adData.serviceCoppie, "Coppie");
  addTagWhen(tags, adData.serviceDisabili, "Disabili");

  addTagWhen(tags, adData.serviceACasa, "A casa");
  addTagWhen(tags, adData.serviceEventiEFeste, "Eventi e feste");
  addTagWhen(tags, adData.serviceAlbergoMotel, "Albergo/Motel");
  addTagWhen(tags, adData.serviceClubs, "Clubs");
  addTagWhen(tags, adData.serviceVisitaADomicilio, "Visita a domicilio");

  return [...new Set(tags.map(cleanText).filter(Boolean))];
}

async function fillTagsStep(page, data) {
  const reachedTags = await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    const hasTagsControls = Boolean(document.querySelector(".tagsCard, button.tags_btn"));
    return hasTagsControls || /tags|tag|about you|su di me|su di te|nazionalita|nationality/i.test(text);
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

async function openGoldPromoCard(page) {
  await waitForPromoStep(page);
  await page.waitForFunction(() => {
    const text = document.body?.innerText || "";
    return Boolean(document.querySelector("#promo-collapse-300")) || /promo\s*(gold|oro)/i.test(text);
  }, { timeout: 20000 }).catch(() => null);

  const opened = await page.evaluate(() => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const existingGoldPanel = document.querySelector("#promo-collapse-300");
    if (existingGoldPanel && isVisible(existingGoldPanel) && existingGoldPanel.textContent.trim()) return true;

    const goldCollapse = document.querySelector("#promo-collapse-300");
    if (goldCollapse) {
      const promoItem = goldCollapse.closest(".promo-item");
      const clickable = promoItem?.querySelector(".promo-card-btn, .promo-card-custom, .card, button, a");
      if (clickable && isVisible(clickable)) {
        clickable.scrollIntoView({ block: "center", inline: "center" });
        clickable.click();
        return true;
      }
    }

    const candidates = Array.from(document.querySelectorAll(".promo-item, .promo-card-btn, .promo-card-custom, .card, button, a, div"));
    const card = candidates.find((node) => {
      const text = clean(node.textContent);
      return isVisible(node) && (
        /promo\s*(gold|oro)/i.test(text) ||
        (/plan your visibility|pianifica|visibility|visibilit/i.test(text) && /promo/i.test(text))
      );
    });

    if (!card) return false;

    const clickable = card.closest(".promo-item")?.querySelector(".promo-card-btn, .card, button, a") || card;
    clickable.scrollIntoView({ block: "center", inline: "center" });
    clickable.click();
    return true;
  });

  if (!opened) {
    const diagnostics = await collectPublishDiagnostics(page);
    throw new Error(`Promo Gold card not found: ${JSON.stringify(diagnostics)}`);
  }
  await delay(1000);
}

async function openTurboPromoCard(page) {
  await waitForPromoStep(page);
  await page.waitForFunction(() => {
    const text = document.body?.innerText || "";
    return Boolean(document.querySelector("#promo-collapse-301")) || /promo\s*turbo/i.test(text);
  }, { timeout: 20000 }).catch(() => null);

  const opened = await page.evaluate(() => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const existingTurboPanel = document.querySelector("#promo-collapse-301");
    if (existingTurboPanel && isVisible(existingTurboPanel) && existingTurboPanel.textContent.trim()) return true;

    const turboCollapse = document.querySelector("#promo-collapse-301");
    if (turboCollapse) {
      const promoItem = turboCollapse.closest(".promo-item");
      const clickable = promoItem?.querySelector(".promo-card-btn, .promo-card-custom, .card, button, a");
      if (clickable && isVisible(clickable)) {
        clickable.scrollIntoView({ block: "center", inline: "center" });
        clickable.click();
        return true;
      }
    }

    const candidates = Array.from(document.querySelectorAll(".promo-item, .promo-card-btn, .promo-card-custom, .card, button, a, div"));
    const card = candidates.find((node) => {
      const text = clean(node.textContent);
      return isVisible(node) && (
        /promo\s*turbo/i.test(text) ||
        (/subito disponibile|contattare immediatamente|turbo/i.test(text) && /promo|visibilit/i.test(text))
      );
    });

    if (!card) return false;

    const clickable = card.closest(".promo-item")?.querySelector(".promo-card-btn, .card, button, a") || card;
    clickable.scrollIntoView({ block: "center", inline: "center" });
    clickable.click();
    return true;
  });

  if (!opened) {
    const diagnostics = await collectPublishDiagnostics(page);
    throw new Error(`Promo Turbo card not found: ${JSON.stringify(diagnostics)}`);
  }
  await delay(1000);
}

function getGoldDuration(typeAnnuncio = "") {
  const value = `${typeAnnuncio || ""}`.toLowerCase();
  if (value.includes("1x7") || value.includes("7")) return "7";
  if (value.includes("1x3") || value.includes("3")) return "3";
  return "1";
}

function getTurboDuration(period = "") {
  try {
    const parsed = JSON.parse(period || "{}");
    if (parsed?.durationProductId) return `${parsed.durationProductId}`;
    if (parsed?.productId && `${parsed.productId}` !== "301") return `${parsed.productId}`;
  } catch {
    // Plain/legacy values are handled below.
  }

  const text = `${period || ""}`.toLowerCase();
  if (text.includes("308") || text.includes("2")) return "308";
  return "307";
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

async function selectTurboDuration(page, duration) {
  await page.evaluate((durationValue) => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    const turboPanel = document.querySelector("#promo-collapse-301");
    const scope = turboPanel || document;
    const select = scope.querySelector(".custom-select-turbo") ||
      Array.from(scope.querySelectorAll("select")).find((node) => {
        const sectionText = clean(node.closest(".section, div")?.textContent);
        const options = Array.from(node.options || []).map((option) => `${option.value}:${clean(option.textContent)}`);
        return /durata promozione|duration/i.test(sectionText) || options.some((option) => /307|308|ora|ore/.test(option));
      });

    if (!select) throw new Error("Turbo duration select not found");
    const option = Array.from(select.options || []).find((item) => `${item.value}` === `${durationValue}`);
    if (!option) throw new Error(`Turbo duration option not found: ${durationValue}`);

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

    const deselected = await page.evaluate(({ groupLabel, wantedLabels }) => {
      const normalize = (value) => `${value || ""}`
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const parseRange = (value) => {
        const match = `${value || ""}`.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (!match) return null;
        return {
          startHour: Number(match[1]),
          startMinute: Number(match[2]),
          endHour: Number(match[3]),
          endMinute: Number(match[4])
        };
      };
      const getRangeMatches = (value) => Array.from(`${value || ""}`.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g));
      const rangeKey = (range) => range
        ? `${range.startHour}:${range.startMinute}-${range.endHour}:${range.endMinute}`
        : "";
      const rangesMatch = (left, right) => {
        const a = parseRange(left);
        const b = parseRange(right);
        return a && b && rangeKey(a) === rangeKey(b);
      };
      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const wantedGroup = normalize(groupLabel);
      const groups = Array.from(document.querySelectorAll(".group"));
      const group = groups.find((node) => normalize(node.querySelector(".group-title")?.textContent || node.textContent).includes(wantedGroup));
      if (!group) return { ok: false, clicked: [], missingGroup: true };

      const wanted = wantedLabels.map((label) => normalize(label));
      const slotControls = Array.from(group.querySelectorAll("button, label, .btn, .slot, .time-slot, .custom-control"))
        .filter((node) => isVisible(node) && getRangeMatches(node.textContent || "").length === 1);
      const uniqueSlots = new Map();

      for (const node of slotControls) {
        const text = node.textContent || "";
        const parsed = parseRange(text);
        const key = rangeKey(parsed);
        if (key && !uniqueSlots.has(key)) uniqueSlots.set(key, { node, text });
      }

      const clicked = [];
      for (const { node, text } of uniqueSlots.values()) {
        const shouldKeepSelected = wanted.some((label) => normalize(text).includes(label) || rangesMatch(text, label));
        if (shouldKeepSelected) continue;

        const input = node.querySelector?.("input[type='checkbox'], input[type='radio']") ||
          (node.getAttribute?.("for") ? document.getElementById(node.getAttribute("for")) : null);
        const clickable = input || node;
        clickable.scrollIntoView({ block: "center", inline: "center" });
        clickable.click();
        clicked.push(text.replace(/\s+/g, " ").trim());
      }

      return { ok: true, clicked };
    }, { groupLabel: groupName, wantedLabels: slots });

    if (!deselected.ok) {
      console.warn(`[trovagnocca:publish] Gold Plan group slots not found: ${groupName}`);
    } else if (deselected.clicked.length) {
      console.log(`[trovagnocca:publish] Gold Plan deselected slots for ${groupName}:`, deselected.clicked);
    }

    await delay(500);

    for (const slotLabel of slots) {
      const found = await page.evaluate((label) => {
        const normalize = (value) => `${value || ""}`
          .replace(/\s*-\s*/g, "-")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        const parseRange = (value) => {
          const match = `${value || ""}`.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (!match) return null;
          return {
            startHour: Number(match[1]),
            startMinute: Number(match[2]),
            endHour: Number(match[3]),
            endMinute: Number(match[4])
          };
        };
        const rangesMatch = (left, right) => {
          const a = parseRange(left);
          const b = parseRange(right);
          if (!a || !b) return false;
          return a.startHour === b.startHour &&
            a.startMinute === b.startMinute &&
            a.endHour === b.endHour &&
            a.endMinute === b.endMinute;
        };
        const wanted = normalize(label);
        const controls = Array.from(document.querySelectorAll("button, label, .btn, .slot, .time-slot, .custom-control"));
        const target = controls.find((node) => {
          const text = node.textContent || "";
          return normalize(text).includes(wanted) || rangesMatch(text, label);
        });
        return Boolean(target);
      }, slotLabel);

      if (!found) {
        console.warn(`[trovagnocca:publish] Gold Plan slot not found: ${groupName} ${slotLabel}`);
      }
    }
  }
}

async function clickGoldPublish(page) {
  const clickActionButton = async (required = true) => {
    const clicked = await page.evaluate(() => {
      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
      const candidates = Array.from(document.querySelectorAll("button, .btn"));
      const button = candidates.find((node) => {
        const text = clean(node.textContent);
        const disabled = node.disabled || node.classList.contains("disabled");
        return isVisible(node) && !disabled && !node.matches("#ads-post-free") &&
          /continua|continue|pubblica|acquista|conferma|procedi|paga/i.test(text);
      });

      if (!button) return false;
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
    });

    if (!clicked && required) throw new Error("Gold Plan publish/purchase button not found");
    if (clicked) await delay(1200);
    return clicked;
  };

  await clickActionButton(true);
  await clickActionButton(false);
  await clickActionButton(false);
  await delay(1000);
}

async function clickGoldPublishFlow(page, data) {
  await waitForPromoStep(page);
  await openGoldPromoCard(page);
  await selectGoldDuration(page, getGoldDuration(data.typeAnnuncio));

  const groupedSlots = groupGoldSlots(data.period);
  if (!Object.keys(groupedSlots).length) {
    await selectGoldAllDay(page);
  } else {
    await selectGoldGroupSlots(page, groupedSlots);
  }

  await clickGoldPublish(page);
}

async function finalUpdateFlow(page) {
  console.log("[trovagnocca:update] Starting final update flow");

  await page.waitForFunction(() => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const candidates = Array.from(document.querySelectorAll(".stepper-button.next, .btn.stepper-button.next, button, .btn"));

    return candidates.some((node) => {
      const text = clean(node.textContent);
      const disabled = node.disabled || node.classList.contains("disabled") || node.classList.contains("deactivated");
      return isVisible(node) && !disabled &&
        /fine|salva|conferma|aggiorna|update/i.test(text) &&
        !/indietro|back|precedente/i.test(text);
    });
  }, { timeout: 30000 });

  const clicked = await page.evaluate(() => {
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const candidates = Array.from(document.querySelectorAll(".stepper-button.next, .btn.stepper-button.next, button, .btn"));
    const button = candidates.find((node) => {
      const text = clean(node.textContent);
      const disabled = node.disabled || node.classList.contains("disabled") || node.classList.contains("deactivated");
      return isVisible(node) && !disabled &&
        /fine|salva|conferma|aggiorna|update/i.test(text) &&
        !/indietro|back|precedente/i.test(text);
    });

    if (!button) return false;
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    return true;
  });

  if (!clicked) throw new Error("Trovagnocca final update button not found");

  await delay(1500);
  console.log("[trovagnocca:update] Final update button clicked");
}

async function clickTurboPublishFlow(page, data) {
  await waitForPromoStep(page);
  await openTurboPromoCard(page);
  await selectTurboDuration(page, getTurboDuration(data.period));
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

  const continued = await clickSweetAlertConfirm(/continua|continue|ok|chiudi|close/i);
  const reachedManagePage = await page.waitForFunction(() => (
    /\/ads\/manage\/\d{4,}\b/i.test(window.location.href)
  ), { timeout: 15000 }).then(() => true).catch(() => false);

  const publishState = reachedManagePage ? "published" : await page.waitForFunction(() => {
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

  const closedSuccess = publishState && !reachedManagePage
    ? await clickSweetAlertConfirm(/continua|continue|ok|chiudi|close/i, 5000)
    : false;
  const reachedManageAfterClose = reachedManagePage || await page.waitForFunction(() => (
    /\/ads\/manage\/\d{4,}\b/i.test(window.location.href)
  ), { timeout: 15000 }).then(() => true).catch(() => false);

  return {
    continued,
    published: publishState === "published",
    pendingApproval: publishState === "pendingApproval",
    closedSuccess,
    reachedManagePage: reachedManageAfterClose
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

  console.log(hasError, hasSuccess, diagnostics, 'publishResult');
  return {
    hasError,
    hasSuccess,
    diagnostics
  };
}

async function getFirstManageCardRemoteId(page) {
  await page.waitForFunction(() => {
    return Boolean(document.querySelector(".basic.color_card button.toggleBtn[aria-controls], .basic.color_card .collapse[id]"));
  }, { timeout: 20000 }).catch(() => null);

  return page.evaluate(() => {
    const firstCard = document.querySelector(".basic.color_card");
    if (!firstCard) return "";

    const candidates = [
      firstCard.querySelector("button.toggleBtn[aria-controls]")?.getAttribute("aria-controls"),
      firstCard.querySelector(".collapse[id]")?.id,
      firstCard.querySelector("[aria-controls]")?.getAttribute("aria-controls")
    ];

    const remoteId = candidates
      .map((value) => `${value || ""}`.trim())
      .find((value) => /^\d{4,}$/.test(value));

    return remoteId || "";
  }).catch(() => "");
}

async function scrapeClimbingCalendar(page) {
  await page.waitForSelector(".manage_promo_card, .promo_status", { timeout: 15000 }).catch(() => null);

  return page.evaluate(() => {
    const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
    const cards = Array.from(document.querySelectorAll(".manage_promo_card, .promo_status"));

    for (const card of cards) {
      const paragraphs = Array.from(card.querySelectorAll("p"))
        .map((node) => clean(node.textContent))
        .filter(Boolean);
      const calendarIndex = paragraphs.findIndex((text) => /Calendario delle risalite/i.test(text));
      if (calendarIndex < 0) continue;

      return paragraphs
        .slice(calendarIndex + 1)
        .filter((text) => /\d{1,2}\s+\S+\s+\d{4}\s+-\s+\d{1,2}:\d{2}/i.test(text));
    }

    return [];
  }).catch(() => []);
}

function buildPublishData(adData = {}) {
  const contactNote = parseTrovagnoccaNote(adData.note);
  const noteTags = contactNote.tags || {};
  const typeAnnuncio = firstNonEmpty(adData.typeAnnuncio, adData.promo?.visibility, "Free");
  const isFreePublication = `${typeAnnuncio || ""}`.trim().toLowerCase() === "free";
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
    nationality: firstNonEmpty(adData.serviceNazionalita, noteTags.nationality, adData.nationality, adData.nazionalita),
    tags: buildTagSelections(adData),
    images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : []),
    picsAudit: Array.isArray(adData.picsAudit) ? adData.picsAudit : [],
    typeAnnuncio,
    period: firstNonEmpty(adData.period, adData.promo?.schedule),
    promo: {
      active: !isFreePublication,
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
  const isUpdateMode = Boolean(options.postUrl && /\/ads-post\/\d+/i.test(options.postUrl));

  console.log("[trovagnocca:publish] Publishing ad", {
    mode: isUpdateMode ? "update" : "publish",
    title: data.title,
    city: data.city,
    category: data.category,
    images: data.images
  });

  await waitForDmcApp(page, options.postUrl || POST_URL);
  if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-after-open-edit-page");

  if (isUpdateMode) {
    await ensureWrappedSelectHasValue(page, "category", data.category);
    await delay(500);
    await ensureWrappedSelectHasValue(page, "city", data.city);
    await captureTrovagnoccaStepScreenshot(page, "update-after-category-city-check");
  } else {
    await setWrappedSelect(page, "category", data.category);
    await delay(500);
    await setWrappedSelect(page, "city", data.city);
  }
  if (data.address) await setWrappedInput(page, "address", data.address);
  if (data.zone) await setWrappedInput(page, "zone", data.zone);

  await setWrappedInput(page, "age", data.age);
  await setTextarea(page, "#txtAdsTitle", data.title);
  await setTextarea(page, "#txtAdsText", data.description);

  await setWrappedInput(page, "phone", data.phone);
  await setContactMethod(page, "phone");
  await setSwitch(page, "whatsapp", data.whatsapp);
  await setSwitch(page, "telegram", data.telegram);
  if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-before-info-step-submit");

  // SOLVE reCAPTCHA HERE - RIGHT BEFORE CLICKING NEXT
  const step1Captcha = await solveRecaptcha(page, options);
  if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-after-captcha-submit");
  if (!step1Captcha.clickedNext) {
    await clickNext(page);
    if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-after-click-next-fallback");
  }

  // console.log(responseAdId, "remoteAdId");
  const leftInfoStep = await waitForInfoStepExit(page);
  if (!leftInfoStep) {
    await captureTrovagnoccaStepScreenshot(page, "update-info-step-still-blocked");
    throw new Error(`Trovagnocca did not leave contacts step after info submit: ${JSON.stringify(await collectPublishDiagnostics(page))}`);
  }
  if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-left-info-step");

  const tagsReached = await fillTagsStep(page, data);
  if (!tagsReached) {
    if (isUpdateMode) await captureTrovagnoccaStepScreenshot(page, "update-tags-step-not-reached");
    throw new Error(`Trovagnocca did not advance to tags step after info submit: ${JSON.stringify(await collectPublishDiagnostics(page))}`);
  }
  await clickNext(page);
  // await clearUploadedImages(page);
  const uploadImageslength = await uploadImages(page, data.images, data.picsAudit);
  console.log(uploadImageslength, 'uploaded images count')
  await clickNext(page);
  await setSwitch(page, "ck_term", true);

  if (`${data.typeAnnuncio || ""}`.trim().toLowerCase() === "turbo") {
    await clickTurboPublishFlow(page, data);
  } else if (data.promo.active) {
    if (isUpdateMode) {
      await finalUpdateFlow(page);
    } else {
      await clickGoldPublishFlow(page, data);
    }
  } else {
    await clickPublish(page);
  }

  let publishModal = {
    published: false,
    pendingApproval: false
  };
  let publishResult = {
    hasError: false,
    hasSuccess: false,
    diagnostics: {}
  };

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  publishModal = await confirmFreePublishWarning(page);
  await page.screenshot({ path: `${screenshotDir}/publish1.png`, fullPage: true });
  publishResult = await waitForPublishResult(page);
  await page.screenshot({ path: `${screenshotDir}/publish2.png`, fullPage: true });

  const url = page.url();
  let response = {
    ok: false,
    url,
    payload: {
      idpriv: publishedId,
      data
    }
  }

  console.log(url, "after publish ads");
  if (publishedId) {//Status Edit
    response.ok = true;
  } else {// New publish
    // if (adData.typeAnnuncio == 'Turbo') {
    await page.goto(ACTIVE_ADS_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });
    // }

    await page.screenshot({ path: `${screenshotDir}/publish3.png`, fullPage: true });

    const goldManageRemoteId = data.promo.active ? await getFirstManageCardRemoteId(page) : "";
    const goldManageLink = goldManageRemoteId
      ? `https://www.trovagnocca.com/dmc/account#/ads/manage/${goldManageRemoteId}`
      : "";

    console.log(goldManageLink, goldManageRemoteId, 'Go to goldManageLink');

    if (data.promo.active && goldManageLink) {
      await page.goto(goldManageLink, {
        waitUntil: "networkidle2",
        timeout: 60000
      });
    }

    const climbingCalendar = data.promo.active ? await scrapeClimbingCalendar(page) : [];
    const climbingCalendarText = climbingCalendar.join(" - ");

    const currentUrl = page.url();
    const urlIdMatch = currentUrl.match(/\/ads\/manage\/(\d{4,})\b/i);
    const remoteId = urlIdMatch
      ? urlIdMatch[1]
      : goldManageRemoteId
        ? goldManageRemoteId
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

    if(!publishLink){
      publishLink = goldManageLink;
    }

    await page.screenshot({ path: `${screenshotDir}/publish4.png`, fullPage: true });

    console.log(publishLink, remoteId,  "publishLink");

    if (publishResult.hasError || (!publishResult.hasSuccess && !publishModal.published && !publishModal.pendingApproval && !remoteId)) {
      throw new Error(`Trovagnocca publish did not confirm success: ${JSON.stringify(publishResult.diagnostics)}`);
    }

    if (remoteId) {
      response.ok = true;
      response.url = publishLink || currentUrl;
      response.payload = {
        idpriv: remoteId,
        climbingCalendar,
        dateTimeTop: climbingCalendarText,
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
