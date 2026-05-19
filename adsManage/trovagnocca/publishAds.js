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

function normalizeItalianPhone(value) {
  return firstNonEmpty(value)
    .replace(/[^\d+]/g, "")
    .replace(/^\+39/, "")
    .replace(/^0039/, "");
}

function validateInfoStepData(data) {
  const missing = [];
  if (!data.category) missing.push("category");
  if (!data.city) missing.push("city");
  if (!data.age) missing.push("age");
  if (!data.title || cleanText(data.title).length < 5) missing.push("title");
  if (!data.description || cleanText(data.description).length < 20) missing.push("description");
  if (!data.phone) missing.push("phone");
  if (missing.length) {
    throw new Error(`Missing required Trovagnocca publish fields: ${missing.join(", ")}`);
  }
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

function normalizeCity(value) {
  const raw = firstNonEmpty(value);
  const key = normalizeKey(raw);
  if (!key) return "";
  if (CITY_VALUES[key]) return CITY_VALUES[key];

  const match = Object.keys(CITY_VALUES)
    .sort((left, right) => right.length - left.length)
    .find((cityName) => {
      const escaped = cityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(key);
    });
  return match ? CITY_VALUES[match] : raw;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDmcApp(page) {
  await page.setViewport({ width: 1366, height: 900 }).catch(() => { });
  await page.goto(POST_URL, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#app", { timeout: 60000 });
  await acceptCookieBanner(page);

  const waitForControls = () => page.waitForFunction(() => {
    const hasNamedControl = (name, selector) => Array.from(document.querySelectorAll("[name]")).some((node) => (
      (node.getAttribute("name") || "").toLowerCase() === name &&
      (node.matches(selector) || node.querySelector(selector))
    ));
    return hasNamedControl("category", "select") && hasNamedControl("city", "select");
  }, { timeout: 30000 });

  try {
    await waitForControls();
    return;
  } catch {
    await page.evaluate(() => {
      const visible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const button = Array.from(document.querySelectorAll("button, .btn, a"))
        .find((node) => visible(node) && /carica annuncio|pubblica annuncio|post an ad/i.test(node.textContent || ""));
      if (button) button.click();
    }).catch(() => { });
  }

  try {
    await waitForControls();
  } catch (error) {
    const diagnostics = await collectPublishDiagnostics(page);
    const formDiagnostics = await collectFormControlDiagnostics(page);
    throw new Error(`Trovagnocca publish form did not load: ${JSON.stringify({ diagnostics, formDiagnostics })}`);
  }
}

async function acceptCookieBanner(page) {
  await page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const button = Array.from(document.querySelectorAll("button, .btn, a"))
      .find((node) => visible(node) && /^(accetto|accept|ok)$/i.test((node.textContent || "").replace(/\s+/g, " ").trim()));
    if (button) button.click();
  }).catch(() => { });
  await delay(300);
}

async function findFrameWithNamedControl(page, wrapperName, selector, timeout = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    for (const frame of page.frames()) {
      const hasControl = await frame.evaluate(({ wrapperName, selector }) => {
        const normalize = (value) => `${value || ""}`.trim().toLowerCase();
        return Array.from(document.querySelectorAll("[name]")).some((node) => (
          normalize(node.getAttribute("name")) === normalize(wrapperName) &&
          (node.matches(selector) || node.querySelector(selector))
        ));
      }, { wrapperName, selector }).catch(() => false);

      if (hasControl) return frame;
    }

    await delay(300);
  }

  throw new Error(`Timed out waiting for ${wrapperName} ${selector}`);
}

async function collectFormControlDiagnostics(page) {
  const frames = [];

  for (const frame of page.frames()) {
    const diagnostics = await frame.evaluate(() => ({
      url: window.location.href,
      names: Array.from(document.querySelectorAll("[name]"))
        .map((node) => ({
          name: node.getAttribute("name"),
          tag: node.tagName.toLowerCase(),
          hasSelect: Boolean(node.matches("select") || node.querySelector("select")),
          hasInput: Boolean(node.matches("input, textarea") || node.querySelector("input, textarea")),
          text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80)
        }))
        .slice(0, 40),
      selects: Array.from(document.querySelectorAll("select"))
        .map((node) => ({
          name: node.getAttribute("name") || node.closest("[name]")?.getAttribute("name") || "",
          options: Array.from(node.options || []).map((option) => `${option.value}:${option.textContent.trim()}`).slice(0, 8)
        }))
        .slice(0, 12),
      textareas: Array.from(document.querySelectorAll("textarea"))
        .map((node) => ({
          id: node.id,
          name: node.getAttribute("name") || node.closest("[name]")?.getAttribute("name") || "",
          placeholder: node.getAttribute("placeholder") || ""
        }))
        .slice(0, 12),
      bodyText: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 800)
    })).catch((error) => ({ url: frame.url(), error: error.message }));
    frames.push(diagnostics);
  }

  return { pageUrl: page.url(), frames };
}

async function setWrappedSelect(page, wrapperName, wanted, aliases = []) {
  const frame = await findFrameWithNamedControl(page, wrapperName, "select");
  const result = await frame.evaluate(({ wrapperName, wanted, aliases }) => {
    const cssEscape = (value) => window.CSS?.escape ? CSS.escape(value) : `${value}`.replace(/"/g, '\\"');
    const normalize = (value) => `${value || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const wantedTextByValue = {
      "1": ["donna uomo", "donna", "escort"],
      "2": ["uomo donna"],
      "3": ["uomo uomo", "gay"],
      "4": ["donna donna", "lesbo"],
      "5": ["coppie"],
      "8": ["trans"],
      "9": ["massaggi", "massaggi benessere"]
    };
    const wantedRaw = `${wanted || ""}`.trim();
    const wantedTerms = [wantedRaw, ...(wantedTextByValue[wantedRaw] || [])]
      .map(normalize)
      .filter(Boolean);
    const fieldTerms = [wrapperName, ...aliases].map(normalize).filter(Boolean);
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const fieldText = (select) => {
      const label = select.id ? document.querySelector(`label[for="${cssEscape(select.id)}"]`) : null;
      const parent = select.closest("[name], .form-group, .section, .field, .row, div");
      return normalize([
        select.name,
        select.id,
        select.getAttribute("aria-label"),
        select.getAttribute("placeholder"),
        label?.textContent,
        parent?.getAttribute("name"),
        parent?.textContent
      ].filter(Boolean).join(" "));
    };
    const optionScore = (select) => Array.from(select.options || []).some((option) => {
      const value = normalize(option.value);
      const text = normalize(option.textContent);
      return wantedTerms.some((term) => term && (value === term || text === term || text.includes(term)));
    }) ? 10 : 0;
    const fieldScore = (select) => {
      const text = fieldText(select);
      const direct = fieldTerms.some((term) => text.includes(term)) ? 20 : 0;
      return direct + optionScore(select);
    };
    const namedNodes = Array.from(document.querySelectorAll("[name]"))
      .filter((node) => normalize(node.getAttribute("name")) === normalize(wrapperName));

    const direct = namedNodes.find((node) => visible(node) || visible(node.querySelector?.("select"))) ||
      namedNodes[0] ||
      document.querySelector(`[name="${cssEscape(wrapperName)}"]`);
    let select = direct?.matches?.("select") ? direct : direct?.querySelector?.("select");
    if (!select) {
      select = Array.from(document.querySelectorAll("select"))
        .map((item) => ({ item, score: fieldScore(item) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)[0]?.item;
    }
    if (!select) return { ok: false, reason: `Select not found: ${wrapperName}` };

    const option = Array.from(select.options || []).find((item) => {
      const value = normalize(item.value);
      const text = normalize(item.textContent);
      return `${item.value}` === wantedRaw ||
        wantedTerms.some((term) => term && (value === term || text === term || text.includes(term)));
    });
    if (!option && wantedRaw && !Array.from(select.options || []).some((item) => `${item.value}` === wantedRaw)) {
      return { ok: false, reason: `Option not found for ${wrapperName}: ${wantedRaw}` };
    }

    const nextValue = option ? option.value : wantedRaw;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(select), "value")?.set;
    select.focus();
    if (setter) setter.call(select, nextValue);
    else select.value = nextValue;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.blur();
    return { ok: true };
  }, { wrapperName, wanted, aliases });

  if (!result.ok) {
    console.warn(`[trovagnocca:publish] ${result.reason}`);
    console.warn("[trovagnocca:publish] Form controls:", JSON.stringify(await collectFormControlDiagnostics(page)));
  }
  return result.ok;
}

async function setWrappedInput(page, wrapperName, value, aliases = []) {
  const frame = await findFrameWithNamedControl(page, wrapperName, "input, textarea").catch(() => null);
  if (!frame) {
    console.warn(`[trovagnocca:publish] Input not found: ${wrapperName}`);
    console.warn("[trovagnocca:publish] Form controls:", JSON.stringify(await collectFormControlDiagnostics(page)));
    return false;
  }

  const result = await frame.evaluate(({ wrapperName, value, aliases }) => {
    const cssEscape = (item) => window.CSS?.escape ? CSS.escape(item) : `${item}`.replace(/"/g, '\\"');
    const normalize = (item) => `${item || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const fieldTerms = [wrapperName, ...aliases].map(normalize).filter(Boolean);
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const fieldText = (input) => {
      const label = input.id ? document.querySelector(`label[for="${cssEscape(input.id)}"]`) : null;
      const parent = input.closest("[name], .form-group, .section, .field, .row, div");
      return normalize([
        input.name,
        input.id,
        input.getAttribute("aria-label"),
        input.getAttribute("placeholder"),
        label?.textContent,
        parent?.getAttribute("name"),
        parent?.textContent
      ].filter(Boolean).join(" "));
    };

    const namedNodes = Array.from(document.querySelectorAll("[name]"))
      .filter((node) => normalize(node.getAttribute("name")) === normalize(wrapperName));
    const direct = namedNodes.find((node) => visible(node) || visible(node.querySelector?.("input, textarea"))) ||
      namedNodes[0] ||
      document.querySelector(`[name="${cssEscape(wrapperName)}"]`);
    let input = direct?.matches?.("input, textarea") ? direct : direct?.querySelector?.("input, textarea");
    if (!input) {
      input = Array.from(document.querySelectorAll("input, textarea"))
        .filter((item) => fieldTerms.some((term) => fieldText(item).includes(term)))[0];
    }
    if (!input) return { ok: false, reason: `Input not found: ${wrapperName}` };

    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    input.focus();
    if (setter) setter.call(input, value || "");
    else input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    return { ok: true };
  }, { wrapperName, value, aliases });

  if (!result.ok) {
    console.warn(`[trovagnocca:publish] ${result.reason}`);
    console.warn("[trovagnocca:publish] Form controls:", JSON.stringify(await collectFormControlDiagnostics(page)));
  }
  return result.ok;
}

async function setTextarea(page, selector, value, wrapperName = "") {
  const ok = wrapperName ? await setWrappedInput(page, wrapperName, value) : false;
  if (ok) return true;

  await page.waitForSelector(selector, { timeout: 30000 });
  return page.evaluate(({ selector, value }) => {
    const textarea = document.querySelector(selector);
    if (!textarea) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), "value")?.set;
    textarea.focus();
    if (setter) setter.call(textarea, value || "");
    else textarea.value = value || "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.blur();
    return true;
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

async function setWrappedRadio(page, wrapperName, wanted) {
  const result = await page.evaluate(({ wrapperName, wanted }) => {
    const normalize = (value) => `${value || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const wrappers = Array.from(document.querySelectorAll("[name]"))
      .filter((node) => normalize(node.getAttribute("name")) === normalize(wrapperName));
    const wrapper = wrappers.find((node) => visible(node) || visible(node.querySelector?.("input[type='radio']"))) || wrappers[0];
    if (!wrapper) return { ok: false, reason: `Radio wrapper not found: ${wrapperName}` };

    const wantedValue = `${wanted || ""}`;
    const radios = Array.from(wrapper.querySelectorAll("input[type='radio']"));
    const radio = radios.find((item) => `${item.value}` === wantedValue) || radios[0];
    if (!radio) return { ok: false, reason: `Radio not found: ${wrapperName}` };

    if (!radio.checked) radio.click();
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }, { wrapperName, wanted });

  if (!result.ok) {
    console.warn(`[trovagnocca:publish] ${result.reason}`);
  }
  return result.ok;
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

async function clickNext(page, stepIndex = null) {
  const expectedSpanId = Number.isInteger(stepIndex) ? `currentStep_${stepIndex}` : "";
  try {
    await page.waitForFunction((expectedId) => {
      const visible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const preferred = expectedId
        ? document.querySelector(`#${CSS.escape(expectedId)}`)?.closest(".stepper-button.next, .btn")
        : null;
      const candidates = [preferred, ...Array.from(document.querySelectorAll(".bottom .stepper-button.next, .stepper-button.next, [id^='currentStep_']"))].filter(Boolean);
      const button = candidates.find((node) => {
        const target = node.matches("[id^='currentStep_']") ? node.closest(".stepper-button.next, .btn") : node;
        const text = (target?.textContent || "").replace(/\s+/g, " ").trim();
        const disabled = target?.disabled || target?.classList.contains("disabled") || target?.classList.contains("deactivated");
        return target &&
          visible(target) &&
          !disabled &&
          !target.classList.contains("toggler_next") &&
          /avanti|after you|next/i.test(text) &&
          !/indietro|back|backwards|precedente/i.test(text);
      });
      const target = button?.matches?.("[id^='currentStep_']") ? button.closest(".stepper-button.next, .btn") : button;
      const state = target
        ? {
          found: true,
          enabled: !(target.disabled || target.classList.contains("disabled") || target.classList.contains("deactivated"))
        }
        : { found: false, enabled: false };
      return state.found && state.enabled;
    }, { timeout: 15000 }, expectedSpanId);
  } catch (error) {
    const diagnostics = await collectPublishDiagnostics(page);
    const formDiagnostics = await collectFormControlDiagnostics(page);
    throw new Error(`Next/Prosegui button stayed disabled: ${JSON.stringify({ diagnostics, formDiagnostics })}`);
  }

  await page.evaluate((expectedId) => {
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const preferred = expectedId
      ? document.querySelector(`#${CSS.escape(expectedId)}`)?.closest(".stepper-button.next, .btn")
      : null;
    const candidates = [preferred, ...Array.from(document.querySelectorAll(".bottom .stepper-button.next, .stepper-button.next, [id^='currentStep_']"))].filter(Boolean);
    const button = candidates.find((node) => {
      const target = node.matches("[id^='currentStep_']") ? node.closest(".stepper-button.next, .btn") : node;
      const text = (target?.textContent || "").replace(/\s+/g, " ").trim();
      const disabled = target?.disabled || target?.classList.contains("disabled") || target?.classList.contains("deactivated");
      return target &&
        visible(target) &&
        !disabled &&
        !target.classList.contains("toggler_next") &&
        /avanti|after you|next/i.test(text) &&
        !/indietro|back|backwards|precedente/i.test(text);
    });
    if (!button) throw new Error("Next/Prosegui button not found");
    const target = button.matches("[id^='currentStep_']") ? button.closest(".stepper-button.next, .btn") : button;
    target.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }, expectedSpanId);
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
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || "";
      const hasActiveTagsStep = Array.from(document.querySelectorAll(".step.activated, .step.active, .activated"))
        .some((node) => /tags|tag|label|su di me|about you/i.test(node.textContent || ""));
      const hasTagControls = Boolean(document.querySelector(".tagsCard, .tags_btn, [name='nationality'], select"));
      return hasActiveTagsStep || (/tags|tag|about you|su di me|nazionalita|nationality/i.test(text) && hasTagControls);
    }, { timeout: 30000 });
  } catch (error) {
    const diagnostics = await collectPublishDiagnostics(page);
    const formDiagnostics = await collectFormControlDiagnostics(page);
    throw new Error(`Tags step did not load after clicking Avanti: ${JSON.stringify({ diagnostics, formDiagnostics })}`);
  }

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
    city: normalizeCity(firstNonEmpty(adData.city, adData.annunci_city, adData.comune)),
    address: firstNonEmpty(adData.address, adData.indirizzo),
    zone: firstNonEmpty(adData.location, adData.zone, adData.zona),
    age: firstNonEmpty(adData.age, adData.years),
    title: firstNonEmpty(adData.title, adData.titolo),
    description: firstNonEmpty(adData.description, adData.testo),
    phone: normalizeItalianPhone(firstNonEmpty(adData.phone, adData.contattotelefonico)),
    whatsapp: isEnabled(adData.whatsapp) || isEnabled(adData.hasWhatapp),
    telegram: isEnabled(adData.telegram) || Boolean(contactNote.telegram || contactNote.telegramNumber || contactNote.telegramUrl),
    nationality: firstNonEmpty(adData.serviceNazionalita, adData.nationality, adData.nazionalita),
    tags: buildTagSelections(adData),
    images: Array.isArray(adData.images) ? adData.images : (Array.isArray(adData.pics) ? adData.pics : [])
  };
}

async function applyToken(page, token) {
  await page.evaluate((t) => {
    // 1. Fill the hidden response field
    const responseField = document.getElementById('g-recaptcha-response') || document.querySelector('.g-recaptcha-response');
    if (responseField) {
      responseField.value = t;
    }

    // 2. Locate the "Success Callback"
    // Google stores its internal state in ___grecaptcha_cfg
    if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
      const clients = window.___grecaptcha_cfg.clients;
      for (const i in clients) {
        for (const p in clients[i]) {
          // We look for any property that has a 'callback' function
          if (clients[i][p] && typeof clients[i][p].callback === 'function') {
            clients[i][p].callback(t); // This tells the site the captcha is solved
          }
        }
      }
    }

    // 3. Force the UI button to wake up
    const nextBtn = document.querySelector('.stepper-button.next');
    if (nextBtn) {
      nextBtn.classList.remove('deactivated', 'disabled');
      nextBtn.disabled = false;
    }
  }, token);
}

async function solveRecaptchaForPublishStep(page, options, stepName) {
  if (typeof options.solveRecaptcha !== "function") return false;
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  try {
    console.log(`[trovagnocca:publish] Starting solve for ${stepName}...`);
    
    // 1. Get the raw response from your solver
    const token = await options.getCaptchaToken(page);
    await applyToken(page, token);
    
    console.log(`[trovagnocca:publish] Inject result:`, token);
    await delay(2000); 
    return true;

  } catch (error) {
    console.error(`[trovagnocca:publish] Bypass error: ${error.message}`);
    return false;
  }
}

async function publishAd(page, adData = {}, options = {}) {
  const data = buildPublishData(adData);
  validateInfoStepData(data);

  console.log("[trovagnocca:publish] Publishing ad", {
    title: data.title,
    city: data.city,
    category: data.category,
    images: data.images.length
  });

  await waitForDmcApp(page);

  const categorySet = await setWrappedSelect(page, "category", data.category, ["categorie", "categoria", "sono", "select categories"]);
  if (!categorySet) throw new Error(`Unable to set Trovagnocca category: ${data.category}`);
  const citySet = await setWrappedSelect(page, "city", data.city, ["citta", "città", "provincia", "comune"]);
  if (!citySet) throw new Error(`Unable to set Trovagnocca city: ${data.city}`);
  if (data.address) await setWrappedInput(page, "address", data.address, ["indirizzo"]);
  if (data.zone) await setWrappedInput(page, "zone", data.zone, ["zona", "posizione", "location"]);

  await setWrappedInput(page, "age", data.age, ["eta", "età"]);
  await setTextarea(page, "#txtAdsTitle", data.title, "title");
  await setTextarea(page, "#txtAdsText", data.description, "message");

  await setWrappedInput(page, "phone", data.phone, ["telefono", "contatto telefonico"]);
  await setWrappedRadio(page, "contact_type", data.phone ? "1" : "3");
  await setSwitch(page, "whatsapp", data.whatsapp);
  await setSwitch(page, "telegram", data.telegram);

  // STEP 1: SOLVE CAPTCHA
  const solveSuccess = await solveRecaptchaForPublishStep(page, options, "info step");
  if (!solveSuccess) throw new Error("reCAPTCHA bypass failed at info step");

  // CLICK NEXT
  const nextBtnSelector = '.stepper-button.next';
  await page.waitForSelector(nextBtnSelector);

  console.log("[trovagnocca:publish] Clicking Next and waiting for navigation/state change...");

  await Promise.all([
    // If it's a full page load:
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
    // If it's a Vue transition:
    page.click(nextBtnSelector)
  ]);

  // Now check where we are
  const currentUrl = page.url();
  console.log(`[debug] Current URL after click: ${currentUrl}`);

  // WAIT FOR TAGS STEP TO ACTIVATE
  console.log("[trovagnocca:publish] Waiting for Tags step transition...");

  // Adjust the check: If we are on a new URL or the Tags container appeared
  await page.waitForFunction(() => {
    const tagsVisible = document.querySelector('.tags-container, #tag-input') !== null;
    const stepActivated = Array.from(document.querySelectorAll('.step.activated'))
      .some(s => s.innerText.includes('Tags'));
    return tagsVisible || stepActivated;
  }, { timeout: 10000 });

  // await page.waitForFunction(() => {
  //   // Check if the Tags step column now has the 'activated' class
  //   const steps = document.querySelectorAll('.step');
  //   const tagsStep = Array.from(steps).find(s => s.innerText.includes('Tags'));
  //   return tagsStep && tagsStep.classList.contains('activated');
  // }, { timeout: 15000 });

  // console.log("[trovagnocca:publish] Moved to Tags step successfully.");

  // await clickNext(page, 0);
  await fillTagsStep(page, data);

  await clickNext(page, 1);
  await uploadImages(page, data.images);

  await clickNext(page, 2);
  // await page.waitForSelector('#ck_term, .promo-container', { visible: true, timeout: 10000 });
  await setSwitch(page, "ck_term", true);
  await solveRecaptchaForPublishStep(page, options, "promo step");

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
