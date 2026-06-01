const axios = require("axios");

const PRICE_PATH = "/api/v1/custom/product/get-price";
const DEFAULT_BASE_URL = "https://www.trovagnocca.com";

function normalizeTimeSlots(timeSlots = []) {
  return [...new Set(
    (Array.isArray(timeSlots) ? timeSlots : [timeSlots])
      .map((slot) => parseInt(slot, 10))
      .filter(Number.isFinite)
  )];
}

function buildPriceQuery({ numberDays = 1, timeSlots = [], productId = 300 } = {}) {
  const slots = normalizeTimeSlots(timeSlots);
  if (!slots.length) throw new Error("At least one Trovagnocca time slot is required.");

  const params = new URLSearchParams();
  params.set("number_days", `${parseInt(numberDays, 10) || 1}`);
  slots.forEach((slot) => params.append("timeSlots[]", `${slot}`));
  params.set("productId", `${parseInt(productId, 10) || 300}`);
  return params.toString();
}

async function getPriceWithPage(page, options = {}) {
  if (!page || page.isClosed?.()) {
    throw new Error("A valid Trovagnocca browser page is required to calculate price.");
  }

  const query = buildPriceQuery(options);
  return page.evaluate(async ({ path, queryString }) => {
    const csrfToken =
      document.querySelector("meta[name='csrf-token']")?.content ||
      document.querySelector("meta[name='x-csrf-token']")?.content ||
      document.querySelector("input[name='_csrf']")?.value ||
      document.querySelector("input[name='csrfToken']")?.value ||
      "";

    const response = await fetch(`${path}?${queryString}`, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
      }
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data
      }));
    }

    return data;
  }, { path: PRICE_PATH, queryString: query });
}

async function getPriceWithAxios(options = {}) {
  const query = buildPriceQuery(options);
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const response = await axios.get(`${baseUrl}${PRICE_PATH}?${query}`, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.csrfToken ? { "x-csrf-token": options.csrfToken } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      referer: `${baseUrl}/dmc/account`
    },
    timeout: options.timeout || 15000
  });

  return response.data;
}

async function getPrice(options = {}) {
  if (options.page) return getPriceWithPage(options.page, options);
  return getPriceWithAxios(options);
}

module.exports = {
  PRICE_PATH,
  buildPriceQuery,
  getPrice,
  getPriceWithAxios,
  getPriceWithPage,
  normalizeTimeSlots
};
