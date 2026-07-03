const fs = require("fs");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { PROXY } = require("../../const");

puppeteer.use(StealthPlugin());

const ADSPEED_STAGING_BASE_URL = "https://mega.3590edafb1833fedd78135b343b5f931b4273aec.xyz";
const ADSPEED_USER_PATH = "/api/adspeed_user/adspeed_user";
const ADSPEED_CREDITS_PATH = "/api/adspeed/credits";
const ADSPEED_AD_PATH = "/api/adspeed/ad";

const COOKIE_FILE = path.join(__dirname, "adspeed-cookies.json");
const API_KEY_FILE = path.join(__dirname, "adspeed-api-key.json");

const DEFAULT_PROXY = "81.180.80.13:12323:14aac7af0c72b:f8f3c0a82d";

const DEFAULT_API_USER = "infinityweb.srls@gmail.com";
const DEFAULT_BASIC_AUTH = {
    username: "raffaele",
    password: "1wBm19wgg\\23"
};

function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

function parseProxyLine(rawProxy) {
    const value = firstNonEmpty(rawProxy);
    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value)) {
        const parsed = new URL(value);

        return {
            protocol: parsed.protocol.replace(":", ""),
            host: parsed.hostname,
            port: Number(parsed.port),
            auth: parsed.username
                ? {
                    username: decodeURIComponent(parsed.username),
                    password: decodeURIComponent(parsed.password)
                }
                : undefined
        };
    }

    const parts = value.split(":");
    if (parts.length < 2) {
        throw new Error(`Invalid proxy format: ${value}`);
    }

    const [host, port, username, ...passwordParts] = parts;
    const password = passwordParts.join(":");

    return {
        protocol: "http",
        host,
        port: Number(port),
        auth: username
            ? {
                username,
                password
            }
            : undefined
    };
}

function toProxyUrl(proxy) {
    if (!proxy) {
        return "";
    }

    const protocol = proxy.protocol || "http";
    const auth = proxy.auth?.username
        ? `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password || "")}@`
        : "";

    return `${protocol}://${auth}${proxy.host}:${proxy.port}`;
}

function createProxyAgent(proxy) {
    const proxyUrl = toProxyUrl(proxy);
    return proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
}

function getBasicAuth(options = {}) {
    if (options.basicAuth === false) {
        return null;
    }

    if (options.basicAuth?.username) {
        return options.basicAuth;
    }

    const username = firstNonEmpty(process.env.ADSPEED_BASIC_AUTH_USER, DEFAULT_BASIC_AUTH.username);
    const password = firstNonEmpty(process.env.ADSPEED_BASIC_AUTH_PASS, DEFAULT_BASIC_AUTH.password);

    return username
        ? {
            username,
            password
        }
        : null;
}

function createBasicAuthHeader(basicAuth) {
    if (!basicAuth?.username) {
        return {};
    }

    const token = Buffer.from(`${basicAuth.username}:${basicAuth.password || ""}`).toString("base64");
    return {
        Authorization: `Basic ${token}`
    };
}

function cookieHeaderFromCookies(cookies) {
    if (!Array.isArray(cookies)) {
        return "";
    }

    return cookies
        .filter((cookie) => cookie?.name && typeof cookie.value === "string")
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
}

function readSavedCookieHeader(cookieFile = COOKIE_FILE) {
    if (!fs.existsSync(cookieFile)) {
        return "";
    }

    try {
        const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf-8"));
        return cookieHeaderFromCookies(cookies);
    } catch {
        return "";
    }
}

function saveCookies(cookies, cookieFile = COOKIE_FILE) {
    const normalizedCookies = Array.isArray(cookies) ? cookies : [];
    fs.writeFileSync(cookieFile, JSON.stringify(normalizedCookies, null, 2), "utf-8");
    return normalizedCookies.length;
}

function parseSetCookieHeaders(setCookieHeaders) {
    const headers = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : setCookieHeaders
            ? [setCookieHeaders]
            : [];

    return headers
        .map((header) => {
            const [nameValue] = String(header).split(";");
            const separatorIndex = nameValue.indexOf("=");

            if (separatorIndex <= 0) {
                return null;
            }

            return {
                name: nameValue.slice(0, separatorIndex).trim(),
                value: nameValue.slice(separatorIndex + 1).trim()
            };
        })
        .filter(Boolean);
}

function saveCookiesFromResponse(response, cookieFile = COOKIE_FILE) {
    const cookies = parseSetCookieHeaders(response?.headers?.["set-cookie"]);
    return saveCookies(cookies, cookieFile);
}

async function getBrowserCookies(page, url) {
    try {
        const client = await page.createCDPSession();
        const result = await client.send("Network.getAllCookies");
        return result.cookies || [];
    } catch {
        return page.cookies(url);
    }
}

function getCookieHeader(options = {}) {
    if (options.cookieHeader === false) {
        return "";
    }

    return firstNonEmpty(
        options.cookieHeader,
        process.env.ADSPEED_COOKIE,
        readSavedCookieHeader(options.cookieFile || COOKIE_FILE)
    );
}

function readSavedApiKey(resultFile = API_KEY_FILE) {
    if (!fs.existsSync(resultFile)) {
        return null;
    }

    try {
        const saved = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
        const apiUser = firstNonEmpty(saved.apiUser, saved["x-api-user"]);
        const apiKey = firstNonEmpty(saved.apiKey, saved["x-api-key"]);

        return apiKey
            ? {
                apiUser,
                apiKey,
                savedAt: saved.savedAt || null,
                raw: saved
            }
            : null;
    } catch {
        return null;
    }
}

function saveApiKeyResult(result, resultFile = API_KEY_FILE) {
    if (!result?.apiKey) {
        return;
    }

    const payload = {
        apiUser: result.apiUser || DEFAULT_API_USER,
        apiKey: result.apiKey,
        savedAt: new Date().toISOString()
    };

    fs.writeFileSync(resultFile, JSON.stringify(payload, null, 2), "utf-8");
}

function getDefaultProxy() {
    const envProxy = firstNonEmpty(process.env.ADSPEED_PROXY);
    if (envProxy) {
        return parseProxyLine(envProxy);
    }

    if (DEFAULT_PROXY) {
        return parseProxyLine(DEFAULT_PROXY);
    }

    const systemProxy = firstNonEmpty(process.env.HTTPS_PROXY, process.env.HTTP_PROXY);
    if (systemProxy) {
        return parseProxyLine(systemProxy);
    }

    if (PROXY?.host && PROXY?.port) {
        return {
            protocol: "http",
            host: PROXY.host,
            port: Number(PROXY.port),
            auth: PROXY.username
                ? {
                    username: PROXY.username,
                    password: PROXY.password || ""
                }
                : undefined
        };
    }

    return null;
}

function normalizeApiKeyResponse(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid AdSpeed API response: expected JSON object.");
    }

    if (payload.error) {
        throw new Error(`AdSpeed API error: ${payload.error}`);
    }

    const apiUser = firstNonEmpty(payload["x-api-user"], payload.api_user, payload.user);
    const apiKey = firstNonEmpty(payload["x-api-key"], payload.api_key, payload.key);

    if (!apiKey) {
        throw new Error("AdSpeed API response did not include x-api-key.");
    }

    return {
        apiUser,
        apiKey,
        raw: payload
    };
}

function normalizeCreditsResponse(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid AdSpeed credits response: expected JSON object.");
    }

    if (payload.error) {
        throw new Error(`AdSpeed API error: ${payload.error}`);
    }

    const credits = Number(payload.credits);
    const updated = Number(payload.updated);

    if (!Number.isFinite(credits)) {
        throw new Error("AdSpeed credits response did not include credits.");
    }

    return {
        credits,
        updated: Number.isFinite(updated) ? updated : null,
        raw: payload
    };
}

function normalizePublishResponse(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid AdSpeed publish response: expected JSON object.");
    }

    if (payload.error) {
        throw new Error(`AdSpeed API error: ${payload.error}`);
    }

    return {
        warnings: payload.warnings || {},
        creditsTotal: payload.credits_total,
        creditsConsumed: payload.credits_consumed,
        megaId: payload.mega_id,
        url: payload.url,
        vetrina: payload.vetrina || null,
        op: payload.op,
        raw: payload
    };
}

function normalizeDeleteResponse(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid AdSpeed delete response: expected JSON object.");
    }

    if (payload.error) {
        throw new Error(`AdSpeed API error: ${payload.error}`);
    }

    return {
        warnings: payload.warnings || {},
        reimbursedCredits: payload.reimbused_credits,
        raw: payload
    };
}

function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }

    return [];
}

function normalizePhone(phone) {
    const value = firstNonEmpty(phone);
    if (!value) {
        return "";
    }

    const digits = value.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) {
        return digits;
    }

    return digits.startsWith("39") ? `+${digits}` : `+39${digits}`;
}

function normalizeAdType(type) {
    const value = firstNonEmpty(type).toLowerCase();
    const allowed = new Set(["escort", "trans", "gigolo", "gay", "coppia", "massaggi"]);

    if (!value) {
        return "";
    }

    if (allowed.has(value)) {
        return value;
    }

    if (value.includes("massaggi")) {
        return "massaggi";
    }

    if (value.includes("trans")) {
        return "trans";
    }

    if (value.includes("gigolo")) {
        return "gigolo";
    }

    if (value.includes("gay")) {
        return "gay";
    }

    if (value.includes("coppia")) {
        return "coppia";
    }

    return "escort";
}

function normalizeAdPayload(input) {
    const source = input?.ad && typeof input.ad === "object" ? input.ad : input;
    const geo = source?.geo || {};
    const description = asArray(source?.description || source?.descriptionText || source?.text);
    const ad = {
        name: firstNonEmpty(source?.name, source?.title),
        type: normalizeAdType(source?.type || source?.category),
        phone: normalizePhone(source?.phone),
        geo: {
            city: firstNonEmpty(geo.city, source?.city),
            province: firstNonEmpty(geo.province, geo.location, source?.province, source?.location),
            zone: firstNonEmpty(geo.zone, source?.zone),
            other_cities: asArray(geo.other_cities || source?.other_cities)
        },
        description,
        tags: source?.tags || source?.attributes || {},
        images: asArray(source?.images),
        status: Number.isFinite(Number(source?.status)) ? Number(source.status) : 1
    };

    if (!ad.geo.zone) {
        delete ad.geo.zone;
    }

    if (!ad.geo.other_cities.length) {
        delete ad.geo.other_cities;
    }

    if (!Object.keys(ad.tags).length) {
        delete ad.tags;
    }

    if (!ad.images.length) {
        delete ad.images;
    }

    const megaId = firstNonEmpty(source?.mega_id, source?.megaId, input?.mega_id, input?.megaId);
    if (megaId) {
        ad.mega_id = megaId;
    }

    return {
        ad,
        ...(input?.vetrina ? { vetrina: input.vetrina } : {})
    };
}

function validatePublishPayload(payload) {
    const errors = [];
    const ad = payload?.ad;

    if (!ad || typeof ad !== "object") {
        errors.push("ad is required.");
    } else {
        if (!firstNonEmpty(ad.name) || ad.name.length < 3) {
            errors.push("ad.name is required and must be at least 3 characters.");
        }

        if (ad.name && ad.name.length > 120) {
            errors.push("ad.name must be 120 characters or less.");
        }

        if (!firstNonEmpty(ad.type)) {
            errors.push("ad.type is required.");
        }

        if (!firstNonEmpty(ad.phone)) {
            errors.push("ad.phone is required.");
        }

        if (!Array.isArray(ad.description) || ad.description.length === 0) {
            errors.push("ad.description must be a non-empty array.");
        }

        if (!Number.isInteger(ad.status) || ad.status < 0 || ad.status > 1) {
            errors.push("ad.status must be 0 or 1.");
        }

        if (!firstNonEmpty(ad.geo?.city)) {
            errors.push("ad.geo.city is required.");
        }

        if (!firstNonEmpty(ad.geo?.province)) {
            errors.push("ad.geo.province is required.");
        }
    }

    if (payload?.vetrina && !["1D", "3D", "1W", "4W"].includes(payload.vetrina.days)) {
        errors.push("vetrina.days must be one of 1D, 3D, 1W, 4W.");
    }

    if (errors.length) {
        throw new Error(`Invalid publish payload: ${errors.join(" ")}`);
    }

    return payload;
}

function isCloudflareChallenge(response) {
    const body = typeof response?.data === "string" ? response.data : "";

    return response?.status === 403 &&
        (body.includes("Just a moment") ||
            body.includes("challenges.cloudflare.com") ||
            body.includes("_cf_chl_opt"));
}

function createHttpError(prefix, response) {
    if (isCloudflareChallenge(response)) {
        const cookieFileExists = fs.existsSync(COOKIE_FILE);
        const savedCookieHeader = readSavedCookieHeader();
        const cookieHint = savedCookieHeader
            ? "Saved Cloudflare cookies were sent, but Cloudflare still challenged this endpoint."
            : cookieFileExists
                ? "The saved cookie file exists, but it does not contain a reusable Cloudflare cookie."
                : "No saved Cloudflare cookie was found. Run `node getApiKey.js` once first.";

        return new Error(`${prefix} failed (${response.status}): Cloudflare challenge page returned. ${cookieHint}`);
    }

    const responseBody = typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);
    const errorMessage = response.data?.error || responseBody || response.statusText || "Request failed";

    return new Error(`${prefix} failed (${response.status}): ${errorMessage}`);
}

async function getApiKeyWithBrowser(apiUser, options = {}) {
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, DEFAULT_API_USER);
    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const targetUrl = `${baseURL.replace(/\/$/, "")}${ADSPEED_USER_PATH}`;
    const launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled"
    ];

    if (proxy?.host && proxy?.port) {
        launchArgs.push(`--proxy-server=${proxy.protocol || "http"}://${proxy.host}:${proxy.port}`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: await puppeteer.executablePath(),
        args: launchArgs
    });

    try {
        const page = await browser.newPage();

        if (proxy?.auth?.username) {
            await page.authenticate(proxy.auth);
        }

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({
            Accept: "application/json",
            ...createBasicAuthHeader(basicAuth),
            "x-api-user": user
        });

        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: options.timeout || 60000
        });

        await page.waitForFunction(() => {
            const text = document.body?.innerText || "";
            return !text.includes("Just a moment") &&
                !text.includes("Enable JavaScript and cookies to continue") &&
                !window._cf_chl_opt;
        }, { timeout: options.challengeTimeout || 90000 }).catch(() => null);

        const text = await page.evaluate(() => document.body?.innerText?.trim() || "");
        let payload;

        try {
            payload = JSON.parse(text);
        } catch {
            throw new Error(`Browser fallback did not receive JSON response: ${text.slice(0, 300)}`);
        }

        const cookies = await getBrowserCookies(page, baseURL);
        const savedCookieCount = saveCookies(cookies, options.cookieFile || COOKIE_FILE);

        return {
            ...normalizeApiKeyResponse(payload),
            savedCookieCount
        };
    } finally {
        await browser.close();
    }
}

async function requestJsonWithBrowser(targetPath, headers = {}, options = {}) {
    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const normalizedBaseURL = baseURL.replace(/\/$/, "");
    const targetUrl = `${normalizedBaseURL}${targetPath}`;
    const method = firstNonEmpty(options.method, "GET").toUpperCase();
    const launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled"
    ];

    if (proxy?.host && proxy?.port) {
        launchArgs.push(`--proxy-server=${proxy.protocol || "http"}://${proxy.host}:${proxy.port}`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: await puppeteer.executablePath(),
        args: launchArgs
    });

    try {
        const page = await browser.newPage();

        if (proxy?.auth?.username) {
            await page.authenticate(proxy.auth);
        }

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({
            Accept: "application/json",
            ...createBasicAuthHeader(basicAuth),
            ...headers
        });

        await page.goto(method === "GET" ? targetUrl : normalizedBaseURL, {
            waitUntil: "domcontentloaded",
            timeout: options.timeout || 60000
        });

        await page.waitForFunction(() => {
            const text = document.body?.innerText || "";
            return !text.includes("Just a moment") &&
                !text.includes("Enable JavaScript and cookies to continue") &&
                !window._cf_chl_opt;
        }, { timeout: options.challengeTimeout || 90000 }).catch(() => null);

        const text = method === "GET"
            ? await page.evaluate(() => document.body?.innerText?.trim() || "")
            : await page.evaluate(
                async ({ url, requestMethod, requestHeaders, requestBody }) => {
                    const response = await fetch(url, {
                        method: requestMethod,
                        credentials: "include",
                        headers: requestHeaders,
                        body: requestBody
                    });

                    return response.text();
                },
                {
                    url: targetUrl,
                    requestMethod: method,
                    requestHeaders: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        ...createBasicAuthHeader(basicAuth),
                        ...headers
                    },
                    requestBody: typeof options.body === "undefined"
                        ? undefined
                        : JSON.stringify(options.body)
                }
            );
        let payload;

        try {
            payload = JSON.parse(text);
        } catch {
            throw new Error(`Browser request did not receive JSON response: ${text.slice(0, 300)}`);
        }

        const cookies = await getBrowserCookies(page, baseURL);
        const savedCookieCount = saveCookies(cookies, options.cookieFile || COOKIE_FILE);

        return {
            payload,
            savedCookieCount
        };
    } finally {
        await browser.close();
    }
}

async function getApiKey(apiUser, options = {}) {
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, DEFAULT_API_USER);
    if (!user) {
        throw new Error("Missing API user email. Pass getApiKey(email) or set ADSPEED_API_USER.");
    }

    console.log(user, "getApiKey")
    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const proxyAgent = createProxyAgent(proxy);

    const response = await axios.get(ADSPEED_USER_PATH, {
        baseURL,
        timeout: options.timeout || 30000,
        proxy: false,
        httpAgent: proxyAgent || undefined,
        httpsAgent: proxyAgent || undefined,
        headers: {
            Accept: "application/json",
            ...createBasicAuthHeader(basicAuth),
            "x-api-user": user
        },
        params: options.xdebug ? { XDEBUG_SESSION_START: "PHPSTORM" } : undefined,
        validateStatus: () => true
    });

    if (isCloudflareChallenge(response) && options.browserFallback !== false) {
        const result = await getApiKeyWithBrowser(user, options);

        if (options.saveResult !== false) {
            saveApiKeyResult(result, options.resultFile || API_KEY_FILE);
        }
        console.log(result, "getApiKey")

        return result;
    }

    if (response.status < 200 || response.status >= 300) {
        throw createHttpError("AdSpeed API request", response);
    }

    const result = normalizeApiKeyResponse(response.data);

    if (options.saveResult !== false) {
        saveApiKeyResult(result, options.resultFile || API_KEY_FILE);
        saveCookiesFromResponse(response, options.cookieFile || COOKIE_FILE);
    }

    return result;
}

async function getCreditsWithBrowser(apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass getCreditsWithBrowser(apiKey), or set ADSPEED_API_KEY.");
    }

    const { payload, savedCookieCount } = await requestJsonWithBrowser(ADSPEED_CREDITS_PATH, {
        "x-api-user": user,
        "x-api-key": key
    }, options);

    return {
        ...normalizeCreditsResponse(payload),
        savedCookieCount
    };
}

async function getCredits(apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass getCredits(apiKey), or set ADSPEED_API_KEY.");
    }

    if (!user) {
        throw new Error("Missing API user email. Pass getCredits(apiKey, email) or set ADSPEED_API_USER.");
    }

    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const proxyAgent = createProxyAgent(proxy);
    const cookieHeader = getCookieHeader(options);

    const response = await axios.get(ADSPEED_CREDITS_PATH, {
        baseURL,
        timeout: options.timeout || 30000,
        proxy: false,
        httpAgent: proxyAgent || undefined,
        httpsAgent: proxyAgent || undefined,
        headers: {
            Accept: "application/json",
            ...createBasicAuthHeader(basicAuth),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            "x-api-user": user,
            "x-api-key": key
        },
        params: options.xdebug ? { XDEBUG_SESSION_START: "PHPSTORM" } : undefined,
        validateStatus: () => true
    });

    if (isCloudflareChallenge(response) && options.browserFallback !== false) {
        return getCreditsWithBrowser(key, user, options);
    }

    if (response.status < 200 || response.status >= 300) {
        throw createHttpError("AdSpeed credits request", response);
    }

    return normalizeCreditsResponse(response.data);
}

async function publishAd(adInput, apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass publishAd(payload, apiKey), or set ADSPEED_API_KEY.");
    }

    if (!user) {
        throw new Error("Missing API user email. Pass publishAd(payload, apiKey, email) or set ADSPEED_API_USER.");
    }

    const payload = validatePublishPayload(normalizeAdPayload(adInput));
    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const proxyAgent = createProxyAgent(proxy);
    const cookieHeader = getCookieHeader(options);

    const response = await axios.post(ADSPEED_AD_PATH, payload, {
        baseURL,
        timeout: options.timeout || 60000,
        proxy: false,
        httpAgent: proxyAgent || undefined,
        httpsAgent: proxyAgent || undefined,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...createBasicAuthHeader(basicAuth),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            "x-api-user": user,
            "x-api-key": key
        },
        params: options.xdebug ? { XDEBUG_SESSION_START: "PHPSTORM" } : undefined,
        validateStatus: () => true
    });

    if (isCloudflareChallenge(response) && options.browserFallback !== false) {
        return publishAdWithBrowser(payload, key, user, options);
    }

    if (response.status < 200 || response.status >= 300) {
        throw createHttpError("AdSpeed publish request", response);
    }

    return normalizePublishResponse(response.data);
}

async function publishAdWithBrowser(adInput, apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass publishAdWithBrowser(payload, apiKey), or set ADSPEED_API_KEY.");
    }

    const payload = validatePublishPayload(normalizeAdPayload(adInput));
    const { payload: responsePayload, savedCookieCount } = await requestJsonWithBrowser(ADSPEED_AD_PATH, {
        "x-api-user": user,
        "x-api-key": key
    }, {
        ...options,
        method: "POST",
        body: payload
    });

    return {
        ...normalizePublishResponse(responsePayload),
        savedCookieCount
    };
}

function withUpdateId(adInput, megaId) {
    const id = firstNonEmpty(megaId, adInput?.mega_id, adInput?.megaId, adInput?.ad?.mega_id, adInput?.ad?.megaId);
    if (!id) {
        throw new Error("Missing ad id. Pass updateAd(megaId, payload) or use CLI: node getApiKey.js update MEGA_ID ad.json");
    }

    const payload = adInput?.ad && typeof adInput.ad === "object"
        ? {
            ...adInput,
            mega_id: id,
            ad: {
                ...adInput.ad,
                mega_id: id
            }
        }
        : {
            ...adInput,
            mega_id: id
        };

    return payload;
}

async function updateAd(megaId, adInput, apiKey, apiUser, options = {}) {
    return publishAd(withUpdateId(adInput, megaId), apiKey, apiUser, options);
}

function buildAdPath(megaId) {
    const id = firstNonEmpty(megaId);
    if (!id) {
        throw new Error("Missing ad id. Usage: node getApiKey.js delete MEGA_ID");
    }

    return `${ADSPEED_AD_PATH}/${encodeURIComponent(id)}`;
}

async function deleteAd(megaId, apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass deleteAd(megaId, apiKey), or set ADSPEED_API_KEY.");
    }

    if (!user) {
        throw new Error("Missing API user email. Pass deleteAd(megaId, apiKey, email) or set ADSPEED_API_USER.");
    }

    const baseURL = firstNonEmpty(options.baseURL, process.env.ADSPEED_BASE_URL, ADSPEED_STAGING_BASE_URL);
    const proxy = Object.prototype.hasOwnProperty.call(options, "proxy")
        ? options.proxy
        : getDefaultProxy();
    const basicAuth = getBasicAuth(options);
    const proxyAgent = createProxyAgent(proxy);
    const cookieHeader = getCookieHeader(options);
    const adPath = buildAdPath(megaId);

    const response = await axios.delete(adPath, {
        baseURL,
        timeout: options.timeout || 60000,
        proxy: false,
        httpAgent: proxyAgent || undefined,
        httpsAgent: proxyAgent || undefined,
        headers: {
            Accept: "application/json",
            ...createBasicAuthHeader(basicAuth),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            "x-api-user": user,
            "x-api-key": key
        },
        params: options.xdebug ? { XDEBUG_SESSION_START: "PHPSTORM" } : undefined,
        validateStatus: () => true
    });

    if (isCloudflareChallenge(response) && options.browserFallback !== false) {
        return deleteAdWithBrowser(megaId, key, user, options);
    }

    if (response.status < 200 || response.status >= 300) {
        throw createHttpError("AdSpeed delete request", response);
    }

    return normalizeDeleteResponse(response.data);
}

async function deleteAdWithBrowser(megaId, apiKey, apiUser, options = {}) {
    const savedApiKey = readSavedApiKey(options.resultFile || API_KEY_FILE);
    const key = firstNonEmpty(apiKey, process.env.ADSPEED_API_KEY, savedApiKey?.apiKey);
    const user = firstNonEmpty(apiUser, process.env.ADSPEED_API_USER, savedApiKey?.apiUser, DEFAULT_API_USER);

    if (!key) {
        throw new Error("Missing API key. Run `node getApiKey.js` first, pass deleteAdWithBrowser(megaId, apiKey), or set ADSPEED_API_KEY.");
    }

    const { payload: responsePayload, savedCookieCount } = await requestJsonWithBrowser(buildAdPath(megaId), {
        "x-api-user": user,
        "x-api-key": key
    }, {
        ...options,
        method: "DELETE"
    });

    return {
        ...normalizeDeleteResponse(responsePayload),
        savedCookieCount
    };
}

module.exports = {
    getApiKey,
    getApiKeyWithBrowser,
    getCredits,
    getCreditsWithBrowser,
    publishAd,
    publishAdWithBrowser,
    updateAd,
    deleteAd,
    deleteAdWithBrowser,
    buildAdPath,
    withUpdateId,
    requestJsonWithBrowser,
    normalizeAdPayload,
    validatePublishPayload,
    parseProxyLine,
    getBasicAuth,
    createBasicAuthHeader,
    getCookieHeader,
    readSavedCookieHeader,
    saveCookies,
    parseSetCookieHeaders,
    saveCookiesFromResponse,
    getBrowserCookies,
    readSavedApiKey,
    saveApiKeyResult,
    isCloudflareChallenge,
    createHttpError,
    toProxyUrl,
    createProxyAgent,
    getDefaultProxy,
    firstNonEmpty,
    asArray,
    normalizeAdType
};
