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

async function waitForDmcApp(page) {
  await page.goto(POST_URL, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#app", { timeout: 60000 });
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return (
      (/pubblica annuncio|post an ad/i.test(text)) &&
      (/seleziona categorie|select categories|category/i.test(text))
    );
  }, { timeout: 60000 });
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
    if (wrapperSelect) return true;

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

    select.value = option ? option.value : wanted;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { wrapperName, wanted });
}

async function setWrappedInput(page, wrapperName, value) {
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

  return images
    .filter(Boolean)
    .slice(0, 6)
    .map(resolveExistingImage);
}

async function uploadImages(page, images = []) {
  await waitForPhotoStep(page);

  const existing = resolveImagePaths(images);
  if (!existing.length) {
    throw new Error("Trovagnocca requires at least one photo before publishing.");
  }

  const missing = existing.filter((imagePath) => !fs.existsSync(imagePath));
  if (missing.length) {
    throw new Error(`Trovagnocca photo file not found: ${missing[0]}`);
  }

  const input = await page.$('input[type="file"][name="items[]"], input[type="file"][name="inputFile"], .dropArea input[type="file"], input[type="file"][accept*="image"], input[type="file"]');
  if (!input) throw new Error("Photo upload input not found");

  const thumbnailCountBefore = await page.$$eval(".thumb-img, .thumb-media img, .dropArea img, img[src^='blob:'], img[src^='data:image']", (nodes) => nodes.length).catch(() => 0);

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
  }, { timeout: 12000 }).then(() => true).catch(() => false);

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
  const published = await page.waitForFunction(() => {
    const popup = document.querySelector(".swal2-popup.swal2-show");
    if (!popup) return false;

    const text = (popup.textContent || "").replace(/\s+/g, " ").trim();
    return /annuncio.*visibile online|annuncio.*pubblicato.*successo|pubblicato con successo|published successfully/i.test(text);
  }, { timeout: 45000 }).then(() => true).catch(() => false);

  const closedSuccess = published ? await clickSweetAlertConfirm(/chiudi|close/i, 5000) : false;
  return { continued, published, closedSuccess };
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
    images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : [])
  };
}

async function solveStep1Recaptcha(page, options = {}) {
  // Bridge browser logs to Node terminal
  page.on('console', msg => {
    if (msg.text().includes('[Captcha]')) console.log(`[Browser] ${msg.text()}`);
  });

  await page.waitForSelector('iframe[title="reCAPTCHA"]', { timeout: 15000 });
  console.log('[trovagnocca] Solving reCAPTCHA on Stepper...');

  const siteKey = '6LeghE4gAAAAAPMCvQ_nOzXwunnt9wfu_SCc3Zu_';
  const token = await options.getCaptchaToken(page, siteKey);

  if (!token) throw new Error('Failed to get reCAPTCHA token');
  console.log('[trovagnocca] reCAPTCHA token obtained');

  const result = await page.evaluate((token) => {
    console.log("[Captcha] Starting Stepper-Aware Injection...");

    // 1. Set values in all possible reCAPTCHA textareas
    // Your HTML shows: id="g-recaptcha-response-1"
    const textareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
    textareas.forEach(t => {
      t.value = token;
      t.innerHTML = token;
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 2. Execute the reCAPTCHA callback (Crucial for enabling 'Prosegui')
    let callbackFound = false;
    if (typeof ___grecaptcha_cfg !== 'undefined') {
        try {
            const findAndExecute = (obj, depth = 0) => {
                if (depth > 10 || !obj || callbackFound) return;
                
                for (let key in obj) {
                    try {
                        // Check if this property is the callback
                        if (key === 'callback' && typeof obj[key] === 'function') {
                            console.log(`[Captcha] Found callback at depth ${depth}. Executing...`);
                            obj[key](token);
                            callbackFound = true;
                            return;
                        }
                        // If it's an object, search inside it
                        if (typeof obj[key] === 'object' && obj[key] !== null) {
                            findAndExecute(obj[key], depth + 1);
                        }
                    } catch (e) {}
                }
            };
            
            // Search all registered reCAPTCHA clients
            const clients = ___grecaptcha_cfg.clients;
            for (let id in clients) {
                findAndExecute(clients[id]);
            }
        } catch (e) {
            console.log("[Captcha] Error during deep search: " + e.message);
        }
    }

    if (!callbackFound) {
        console.log("[Captcha] CRITICAL: No callback found in ___grecaptcha_cfg. Trying manual Vue injection...");
        // Manual Fallback for Trovagnocca's Vue structure
        try {
            const app = document.querySelector('#app');
            if (app && app.__vue_app__) {
                const updateVue = (instance) => {
                    if (!instance || callbackFound) return;
                    if (instance.proxy && 'adsRecaptcha' in instance.proxy) {
                        instance.proxy.adsRecaptcha = token;
                        console.log("[Captcha] Manually set proxy.adsRecaptcha");
                        callbackFound = true;
                    }
                    if (instance.subTree) {
                         const children = Array.isArray(instance.subTree.children) ? instance.subTree.children : [instance.subTree.children];
                         children.forEach(c => c && updateVue(c.component));
                    }
                };
                updateVue(app.__vue_app__._instance);
            }
        } catch (e) {}
    }

    // 3. Stepper-aware next button click
    const findActiveButton = () => {
      const stepperButton = document
        .querySelector('#currentStep_0')
        ?.closest('.stepper-button.next, .stepper-button, .btn');

      const allElements = [
        stepperButton,
        ...Array.from(document.querySelectorAll('button, .btn.stepper-button.next, .btn.next, .stepper-button, .toggler_next'))
      ].filter(Boolean);

      console.log(allElements, 'allElements Action Buttons')
      const btn = allElements.find(el => {
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const disabled = el.disabled || el.classList.contains('disabled') || el.classList.contains('deactivated');
        return isVisible && !disabled && (text.includes('prosegui') || text.includes('avanti'));
      });

      if (btn) {
        btn.disabled = false;
        btn.classList.remove('disabled', 'deactivated');
        btn.scrollIntoView({ block: 'center', inline: 'center' });
        btn.click();
        console.log("[Captcha] Found and clicked the visible stepper next button");
        return true;
      }

      // Fallback: If no visible button, click the first one that exists at all
      const anyBtn = allElements.find(el => /prosegui|avanti/i.test(el.innerText || el.textContent || ''));
      if (anyBtn) {
        console.log("[Captcha] Force clicking first available stepper next button");
        anyBtn.click();
        return true;
      }

      return false;
    };

    const clickedResult = findActiveButton();
    return clickedResult;
  }, token);

  console.log('[trovagnocca] Injection finished. Button found:', result);

  // Wait for the accordion to transition or navigation to happen
  await new Promise(r => setTimeout(r, 4000));

  const finalUrl = page.url();
  console.log('[trovagnocca] Current URL after step:', finalUrl);

  return { token, clickedNext: result };
}

async function publishAd(page, adData = {}, options = {}) {
  const data = buildPublishData(adData);

  console.log("[trovagnocca:publish] Publishing ad", {
    title: data.title,
    city: data.city,
    category: data.category,
    images: data.images.length
  });

  await waitForDmcApp(page);

  await setWrappedSelect(page, "category", data.category);
  await delay(500);
  await setWrappedSelect(page, "city", data.city);
  if (data.address) await setWrappedInput(page, "address", data.address);
  if (data.zone) await setWrappedInput(page, "zone", data.zone);

  await setWrappedInput(page, "age", data.age);
  await setTextarea(page, "#txtAdsTitle", data.title);
  await setTextarea(page, "#txtAdsText", data.description);

  await setWrappedInput(page, "phone", data.phone);
  await setSwitch(page, "whatsapp", data.whatsapp);
  await setSwitch(page, "telegram", data.telegram);

  // SOLVE reCAPTCHA HERE - RIGHT BEFORE CLICKING NEXT
  const step1Captcha = await solveStep1Recaptcha(page, options);
  if (!step1Captcha.clickedNext) {
    await clickNext(page);
  }

  const tagsReached = await fillTagsStep(page, data);
  if (!tagsReached) {
    throw new Error(`Trovagnocca did not advance to tags step after info submit: ${JSON.stringify(await collectPublishDiagnostics(page))}`);
  }
  await clickNext(page);
  await uploadImages(page, data.images);
  await clickNext(page);
  await setSwitch(page, "ck_term", true);

  await clickPublish(page);
  const publishModal = await confirmFreePublishWarning(page);
  const publishResult = await waitForPublishResult(page);

  const url = page.url();
  const remoteId = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
    hrefs.push(window.location.href);
    const idMatch = hrefs.join(" ").match(/(?:annuncio|ads|post|id|manage|edit)[^\d]*(\d{4,})/i);
    return idMatch ? idMatch[1] : "";
  }).catch(() => "");

  if (publishResult.hasError || (!publishResult.hasSuccess && !publishModal.published && !remoteId)) {
    throw new Error(`Trovagnocca publish did not confirm success: ${JSON.stringify(publishResult.diagnostics)}`);
  }

  return {
    ok: true,
    url,
    payload: {
      idpriv: remoteId || null,
      data
    }
  };
}

module.exports = {
  POST_URL,
  buildPublishData,
  publishAd
};
