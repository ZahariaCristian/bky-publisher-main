const POST_URL = "https://www.trovagnocca.com/dmc/account#/ads-post";

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
  await page.evaluate(({ wrapperName, wanted }) => {
    const wrapper = document.querySelector(`[name="${wrapperName}"]`);
    const select = wrapper?.querySelector("select");
    if (!select) throw new Error(`Select wrapper not found: ${wrapperName}`);

    const normalizedWanted = `${wanted || ""}`.trim().toLowerCase();
    const option = Array.from(select.options).find((item) => (
      `${item.value}` === `${wanted}` ||
      (item.textContent || "").trim().toLowerCase() === normalizedWanted
    ));

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
  await page.waitForTimeout(800);
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
    const imageInput = document.querySelector('input[type="file"][name="inputFile"], input[type="file"][accept*="image"]');
    return Boolean(imageInput) && (
      /guidelines for posting photos|linee guida.*foto|photo|foto/i.test(text) ||
      /maximum of 6 photos|massimo.*6 foto/i.test(text)
    );
  }, { timeout: 30000 });
}

async function uploadImages(page, images = []) {
  await waitForPhotoStep(page);

  const existing = images.filter(Boolean).slice(0, 6);
  if (!existing.length) {
    throw new Error("Trovagnocca requires at least one photo before publishing.");
  }

  const input = await page.$('input[type="file"][name="inputFile"], input[type="file"][accept*="image"], input[type="file"]');
  if (!input) throw new Error("Photo upload input not found");

  const thumbnailCountBefore = await page.$$eval(".thumb-img, .thumb-media img", (nodes) => nodes.length).catch(() => 0);

  await input.uploadFile(...existing);

  await page.waitForFunction((previousCount) => {
    const images = Array.from(document.querySelectorAll(".thumb-img, .thumb-media img"));
    return images.length > previousCount || images.some((img) => {
      const src = img.getAttribute("src") || "";
      return src.startsWith("data:image") || src.startsWith("blob:");
    });
  }, { timeout: 30000 }, thumbnailCountBefore).catch(() => null);

  await page.waitForTimeout(1000);
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
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return /tags|tag|about you|su di me|nazionalita|nationality/i.test(text);
  }, { timeout: 30000 });

  await setNationality(page, data.nationality);
  await clickTagButtons(page, data.tags);
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

async function waitForPublishResult(page) {
  await Promise.race([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
    page.waitForFunction(() => {
      const text = document.body.innerText || "";
      return /annuncio.*pubblic|pubblicato|published|success|successo|complimenti|congrat/i.test(text) ||
        /errore|required|obbligatori|non valido|invalid|failed|fallito/i.test(text);
    }, { timeout: 45000 }).catch(() => null)
  ]);

  await page.waitForTimeout(1500);

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
  await setWrappedSelect(page, "city", data.city);
  if (data.address) await setWrappedInput(page, "address", data.address);
  if (data.zone) await setWrappedInput(page, "zone", data.zone);

  await setWrappedInput(page, "age", data.age);
  await setTextarea(page, "#txtAdsTitle", data.title);
  await setTextarea(page, "#txtAdsText", data.description);

  await setWrappedInput(page, "phone", data.phone);
  await setSwitch(page, "whatsapp", data.whatsapp);
  await setSwitch(page, "telegram", data.telegram);

  await clickNext(page);
  await fillTagsStep(page, data);
  await clickNext(page);
  await uploadImages(page, data.images);
  await clickNext(page);
  await setSwitch(page, "ck_term", true);

  if (typeof options.solveRecaptcha === "function") {
    await options.solveRecaptcha(page).catch((error) => {
      console.warn("[trovagnocca:publish] Recaptcha solve failed:", error.message);
    });
  }

  await clickPublish(page);
  const publishResult = await waitForPublishResult(page);

  const url = page.url();
  const remoteId = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
    hrefs.push(window.location.href);
    const idMatch = hrefs.join(" ").match(/(?:annuncio|ads|post|id|manage|edit)[^\d]*(\d{4,})/i);
    return idMatch ? idMatch[1] : "";
  }).catch(() => "");

  if (publishResult.hasError || (!publishResult.hasSuccess && !remoteId)) {
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
