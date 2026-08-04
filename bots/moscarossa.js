const fs = require("fs");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const TwoCaptcha = require("@2captcha/captcha-solver");
const { buildPublishData, publishAd } = require("../adsManage/moscarossa/publishAds");

const HOME_URL = "https://www.moscarossa.biz/";
const LOGIN_URL = "https://www.moscarossa.biz/login-escort";
const PRIVATE_NEW_AD_URL = "https://www.moscarossa.biz/private/inserimento.php";
const CREDIT_URL = "https://www.moscarossa.biz/private/crediti.php";
const LOCATION_SEARCH_URL = "https://www.moscarossa.biz/private/ajax_sel_comune.php";
const RECAPTCHA_SITEKEY = "6LeQvfcUAAAAABV9eiDsuqJOKT15Aba_cuBl7IFQ";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "moscarossa-login");
const API_KEY_FILE = path.join(__dirname, "settings", "2captchaApiKey.txt");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const getCaptchaApiKey = () => {
  if (process.env.TWOCAPTCHA_API_KEY) return process.env.TWOCAPTCHA_API_KEY.trim();
  if (fs.existsSync(API_KEY_FILE)) return fs.readFileSync(API_KEY_FILE, "utf8").trim();
  return "";
};

const CAPTCHA_API_KEY = getCaptchaApiKey();
const solver = CAPTCHA_API_KEY ? new TwoCaptcha.Solver(CAPTCHA_API_KEY) : null;

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeLocationResults = (payload) => {
  const source = Array.isArray(payload)
    ? payload
    : (payload?.results || payload?.items || payload?.data || []);
  const seen = new Set();

  return (Array.isArray(source) ? source : []).map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return { id: `${item}`.trim(), text: `${item}`.trim() };
    }

    return {
      id: `${item?.id ?? item?.value ?? item?.id_comune ?? item?.pk_i_id ?? ""}`.trim(),
      text: `${item?.text ?? item?.label ?? item?.name ?? item?.comune ?? item?.s_name ?? ""}`
        .replace(/\s+/g, " ")
        .trim()
    };
  }).filter((item) => {
    if (!item.id || !item.text || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 50);
};

const ensureDir = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

class MoscarossaBot {
  constructor(email, password, credit = 0, platform = "moscarossa") {
    this.email = `${email || ""}`.trim();
    this.password = `${password || ""}`;
    this.credit = Number(credit || 0);
    this.platform = platform;
    this.browser = null;
    this.page = null;
    this.cookies = null;
  }

  async launch() {
    if (this.browser) return;

    const executablePath = typeof puppeteer.executablePath === "function"
      ? await puppeteer.executablePath()
      : undefined;

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      protocolTimeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1366,900"
      ],
      defaultViewport: { width: 1366, height: 900 }
    });
  }

  async newPage() {
    await this.launch();
    if (this.page && !this.page.isClosed()) await this.page.close().catch(() => {});

    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(60000);
    await this.page.setUserAgent(USER_AGENT);
    return this.page;
  }

  async screenshot(name) {
    if (!this.page || this.page.isClosed()) return;
    ensureDir(SCREENSHOT_DIR);
    await this.page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      fullPage: true
    }).catch((error) => {
      console.warn(`[Moscarossa] Screenshot ${name} failed: ${error.message}`);
    });
  }

  async acceptAdultConsentIfPresent(page = this.page) {
    if (!page || page.isClosed()) return false;

    const accepted = await page.evaluate(() => {
      const container = document.querySelector("#popup-maggiorenne-container");
      if (!container) return false;

      const style = window.getComputedStyle(container);
      const visible = !container.classList.contains("hidden") &&
        !container.classList.contains("d-none") &&
        style.display !== "none" &&
        style.visibility !== "hidden";
      if (!visible) return false;

      const enter = container.querySelector("#popup-maggiorenne .buttons .bg-red, #popup-maggiorenne .button.bg-red");
      if (!enter) return false;
      enter.click();
      return true;
    }).catch(() => false);

    if (accepted) {
      console.log("[Moscarossa] Adult consent accepted.");
      await delay(750);
    }
    return accepted;
  }

  async typeValue(page, selector, value) {
    const input = await page.waitForSelector(selector, { visible: true, timeout: 30000 });
    if (!input) throw new Error(`Moscarossa login field not found: ${selector}`);

    await input.click({ clickCount: 3, delay: 40 });
    await page.keyboard.press("Backspace");
    await page.evaluate((fieldSelector) => {
      const field = document.querySelector(fieldSelector);
      if (!field) return;
      field.value = "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector);
    await input.type(value, { delay: 70 });

    await page.waitForFunction(
      (fieldSelector, expected) => document.querySelector(fieldSelector)?.value === expected,
      { timeout: 10000 },
      selector,
      value
    );
  }

  async solveRecaptcha(page) {
    const captcha = await page.evaluate((fallbackSitekey) => {
      const button = document.querySelector("#btn_login.g-recaptcha, .g-recaptcha[data-sitekey]");
      const response = document.querySelector("[name='g-recaptcha-response']");
      return {
        required: Boolean(button) && !`${response?.value || ""}`.trim(),
        sitekey: button?.getAttribute("data-sitekey") || fallbackSitekey,
        callback: button?.getAttribute("data-callback") || "onSubmit"
      };
    }, RECAPTCHA_SITEKEY);

    if (!captcha.required) return null;
    if (!solver) throw new Error("2Captcha API key not configured for Moscarossa login.");

    console.log("[Moscarossa] Solving invisible reCAPTCHA...");
    const solution = await solver.recaptcha({
      pageurl: page.url() || LOGIN_URL,
      googlekey: captcha.sitekey,
      userAgent: USER_AGENT,
      invisible: 1
    });
    const token = solution?.data || solution?.request || solution;

    if (!token || typeof token !== "string") {
      throw new Error("2Captcha did not return a valid Moscarossa reCAPTCHA token.");
    }

    await page.evaluate((captchaToken) => {
      let response = document.querySelector("textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']");
      if (!response) {
        response = document.createElement("textarea");
        response.name = "g-recaptcha-response";
        response.style.display = "none";
        document.querySelector("#form_login")?.appendChild(response);
      }
      response.value = captchaToken;
      response.textContent = captchaToken;
      response.setAttribute("value", captchaToken);
      response.dispatchEvent(new Event("input", { bubbles: true }));
      response.dispatchEvent(new Event("change", { bubbles: true }));
    }, token);

    console.log("[Moscarossa] reCAPTCHA token injected.");
    return { token, callback: captcha.callback };
  }

  async submitLogin(page, captchaResult) {
    const navigation = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);

    await page.evaluate(({ token, callbackName }) => {
      const form = document.querySelector("#form_login");
      if (!form) throw new Error("Moscarossa login form disappeared before submit.");

      const callback = `${callbackName || ""}`
        .split(".")
        .filter(Boolean)
        .reduce((target, key) => target && target[key], window);

      if (token && typeof callback === "function") {
        callback(token);
        return;
      }

      form.submit();
    }, {
      token: captchaResult?.token || "",
      callbackName: captchaResult?.callback || ""
    });

    await navigation;
    await delay(1250);
  }

  async isLoggedIn(page = this.page) {
    if (!page || page.isClosed()) return false;

    return page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      const hasLoginForm = Boolean(document.querySelector("#form_login, input#password[name='password']"));
      const hasLogout = Array.from(document.querySelectorAll("a, button")).some((node) => {
        const text = `${node.textContent || ""}`.toLowerCase();
        const href = `${node.getAttribute("href") || ""}`.toLowerCase();
        return /logout|esci/.test(text) || /logout|logoff/.test(href);
      });
      const isPrivatePage = url.includes("/private/");
      return !hasLoginForm && (hasLogout || isPrivatePage);
    }).catch(() => false);
  }

  async extractLoginErrors(page = this.page) {
    if (!page || page.isClosed()) return [];

    return page.evaluate(() => {
      const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
      const messages = Array.from(document.querySelectorAll(
        ".alert, .error, .errors, .form-error, .message-error, [role='alert']"
      )).map((node) => clean(node.textContent)).filter(Boolean);

      const relevantBodyLines = `${document.body?.innerText || ""}`
        .split("\n")
        .map(clean)
        .filter((line) => /errore|errat|non valid|captcha|accesso negato/i.test(line));

      return Array.from(new Set([...messages, ...relevantBodyLines])).slice(0, 8);
    }).catch(() => []);
  }

  async login() {
    if (!this.email || !this.password) throw new Error("Moscarossa credentials are missing.");

    const page = await this.newPage();
    console.log(`[Moscarossa] Opening login page for ${this.email}`);
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await this.acceptAdultConsentIfPresent(page);
    await page.waitForSelector("#form_login", { visible: true, timeout: 30000 });
    await this.screenshot("01-login-page");

    await this.typeValue(page, "#email", this.email);
    await this.typeValue(page, "#password", this.password);
    await this.screenshot("02-credentials-filled");

    const captchaResult = await this.solveRecaptcha(page);
    await this.screenshot("03-captcha-ready");
    await this.submitLogin(page, captchaResult);
    await this.acceptAdultConsentIfPresent(page);

    let errors = await this.extractLoginErrors(page);
    if (!(await this.isLoggedIn(page))) {
      await page.goto(PRIVATE_NEW_AD_URL, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
      await this.acceptAdultConsentIfPresent(page);
    }

    await this.screenshot("04-after-login");
    if (!(await this.isLoggedIn(page))) {
      errors = Array.from(new Set([...errors, ...(await this.extractLoginErrors(page))]));
      await this.screenshot("error-login-validation");
      throw new Error(
        `Moscarossa login validation failed. URL: ${page.url()}.` +
        (errors.length ? ` Errors: ${errors.join(" | ")}` : "")
      );
    }

    const cookies = await page.cookies();
    if (!cookies.length) throw new Error("Moscarossa login succeeded but returned no cookies.");

    this.cookies = cookies;
    console.log(`[Moscarossa] Login successful for ${this.email}`);
    return JSON.stringify(cookies);
  }

  async initWithCookies(cookiesJson) {
    let cookies;
    try {
      cookies = typeof cookiesJson === "string" ? JSON.parse(cookiesJson) : cookiesJson;
    } catch {
      return false;
    }
    if (!Array.isArray(cookies) || !cookies.length) return false;

    const page = await this.newPage();
    try {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.setCookie(...cookies);
      await page.goto(PRIVATE_NEW_AD_URL, { waitUntil: "networkidle2", timeout: 60000 });
      await this.acceptAdultConsentIfPresent(page);

      const ok = await this.isLoggedIn(page);
      if (ok) {
        this.cookies = await page.cookies();
      }
      return ok;
    } catch (error) {
      console.warn(`[Moscarossa] Session reuse failed: ${error.message}`);
      return false;
    }
  }

  parseCreditText(text) {
    const match = `${text || ""}`.match(/crediti\s+a\s+disposizione\s*:\s*([0-9][0-9.,]*)/i);
    if (!match) return null;

    const credit = Number(match[1].replace(/[^0-9]/g, ""));
    return Number.isFinite(credit) ? credit : null;
  }

  async getCredit() {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    await page.goto(CREDIT_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await this.acceptAdultConsentIfPresent(page);

    if (!(await this.isLoggedIn(page))) {
      await this.screenshot("error-credit-session");
      throw new Error(`Moscarossa credit page redirected to login. URL: ${page.url()}`);
    }

    const creditText = await page.evaluate(() => {
      const container = document.querySelector(".row.contenuto .col-xs-12, .row.contenuto, main, body");
      return `${container?.innerText || ""}`;
    });
    const credit = this.parseCreditText(creditText);

    if (!Number.isFinite(credit)) {
      await this.screenshot("error-credit-not-found");
      throw new Error("Moscarossa available credit amount was not found on the credit page.");
    }

    this.credit = credit;
    await this.screenshot("05-credit-page");
    console.log(`[Moscarossa] Available credit: ${credit}`);
    return credit;
  }

  async refresh2() {
    try {
      const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
      if (!(await this.isLoggedIn(page))) {
        await page.goto(PRIVATE_NEW_AD_URL, { waitUntil: "networkidle2", timeout: 60000 });
        await this.acceptAdultConsentIfPresent(page);
      }
      if (!(await this.isLoggedIn(page))) {
        return { error: "Moscarossa session is missing or expired." };
      }

      const credit = await this.getCredit();
      const cookies = await page.cookies();
      if (!cookies.length) return { error: "Moscarossa session returned no cookies." };

      this.cookies = cookies;
      return [credit, JSON.stringify(cookies), 0];
    } catch (error) {
      return { error: error.message };
    }
  }

  async searchLocations({ term, idAccompa = "0" } = {}) {
    const query = `${term || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
    if (query.length < 2) {
      const error = new Error("Moscarossa Comune search requires at least two characters.");
      error.statusCode = 400;
      throw error;
    }

    let cookies = Array.isArray(this.cookies) ? this.cookies : [];
    if (!cookies.length && this.page && !this.page.isClosed()) {
      cookies = await this.page.cookies();
      this.cookies = cookies;
    }
    if (!cookies.length) {
      const error = new Error("Moscarossa session expired before Comune search.");
      error.statusCode = 401;
      throw error;
    }

    const response = await axios.get(LOCATION_SEARCH_URL, {
      params: {
        id_accompa: /^\d+$/.test(`${idAccompa || ""}`) ? `${idAccompa}` : "0",
        term: query,
        _type: "query",
        q: query
      },
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
        referer: PRIVATE_NEW_AD_URL,
        "user-agent": USER_AGENT
      },
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true
    });

    const responseText = typeof response.data === "string" ? response.data : "";
    const redirectedToLogin = response.status >= 300 && response.status < 400 &&
      /login-escort/i.test(`${response.headers?.location || ""}`);
    if (redirectedToLogin || [401, 403].includes(response.status) || /id=["']form_login|login-escort/i.test(responseText)) {
      const error = new Error("Moscarossa session expired during Comune search.");
      error.statusCode = 401;
      throw error;
    }
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`Moscarossa Comune search failed with HTTP ${response.status}.`);
      error.statusCode = response.status || 502;
      throw error;
    }

    let payload = response.data;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        const error = new Error("Moscarossa Comune search returned invalid JSON.");
        error.statusCode = 502;
        throw error;
      }
    }

    const results = normalizeLocationResults(payload);
    console.log(`[Moscarossa] Comune search "${query}" returned ${results.length} result(s).`);
    return { results };
  }

  buildPublishData(ad) {
    return buildPublishData({
      ...ad,
      city: ad?.city || ad?.annunci_city || ad?.comune || "",
      images: ad?.pics || ad?.images || [],
      picsAudit: ad?.picsAudit || []
    });
  }

  async publish(ad) {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    const publishData = this.buildPublishData(ad);
    const result = await publishAd(page, { ...ad, ...publishData });
    this.cookies = await page.cookies().catch(() => this.cookies);
    return result;
  }

  unsupported(operation) {
    throw new Error(`Moscarossa ${operation} workflow is not implemented yet.`);
  }

  async update() { return this.unsupported("update"); }
  async delete() { return this.unsupported("delete"); }
  async suspend() { return this.unsupported("suspend"); }
  async republish() { return this.unsupported("republish"); }
  async resolveRemoteId(ad) { return ad?.remotePostID || ad?.dataValues?.remotePostID || null; }

  async restartBrowser(reason) {
    console.warn(`[Moscarossa] Restarting browser${reason ? ` (${reason})` : ""}`);
    await this.close();
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.page = null;
    this.cookies = null;
  }
}

module.exports = MoscarossaBot;
