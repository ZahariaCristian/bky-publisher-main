const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const TwoCaptcha = require("@2captcha/captcha-solver");
const { publishAd } = require("../adsManage/trovagnocca/publishAds");
const { updateAd } = require("../adsManage/trovagnocca/updateAd");

const LOGIN_URL = "https://www.trovagnocca.com/auth/login";
const HOME_URL = "https://www.trovagnocca.com/";
const ACCOUNT_URL = "https://www.trovagnocca.com/dmc/account";
const CREDIT_URL = "https://www.trovagnocca.com/dmc/account#/credits";

const RECAPTCHA_SITEKEY = "6LeghE4gAAAAAPMCvQ_nOzXwunnt9wfu_SCc3Zu_";
const COOKIE_FILE = path.join(__dirname, "trovagnocca-cookies.json");
const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "trovagnocca-login");
const API_KEY_FILE = path.join(__dirname, "settings", "2captchaApiKey.txt");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const getCaptchaApiKey = () => {
  if (process.env.TWOCAPTCHA_API_KEY) return process.env.TWOCAPTCHA_API_KEY.trim();
  if (fs.existsSync(API_KEY_FILE)) return fs.readFileSync(API_KEY_FILE, "utf-8").trim();
  return "";
};

const CAPTCHA_API_KEY = getCaptchaApiKey();
const solver = CAPTCHA_API_KEY ? new TwoCaptcha.Solver(CAPTCHA_API_KEY) : null;

puppeteer.use(
  StealthPlugin(),
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: CAPTCHA_API_KEY
    },
    visualFeedback: true,
    throwOnError: false
  })
);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEnabled(value) {
  if (value === true || value === 1) return true;
  return ["1", "true", "yes", "si", "on", "checked"].includes(`${value || ""}`.trim().toLowerCase());
}

function extractRemoteAdId(remoteId) {
  const value = `${remoteId || ""}`;
  const manageMatch = value.match(/ads\/manage\/(\d+)/i);
  if (manageMatch) return manageMatch[1];

  const numericMatch = value.match(/\b(\d{4,})\b/);
  return numericMatch ? numericMatch[1] : "";
}

class TrovagnoccaBot {
  constructor(email, password, credit, platform) {
    this.email = email || process.env.TROVAGNOCCA_EMAIL || "";
    this.password = password || process.env.TROVAGNOCCA_PASSWORD || "";
    this.credit = credit || 0;
    this.platform = platform;
    this.browser = null;
    this.page = null;
    this.cookies = null;
  }

  getCredential() {
    return {
      email: `${this.email || ""}`,
      password: `${this.password || ""}`
    };
  }

  async launch() {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: false,
      executablePath: puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1366,900",
      ],
      // defaultViewport: {
      //   width: 1366,
      //   height: 900
      // }
    });
  }

  async newPage() {
    await this.launch();
    
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(60000);
    await this.page.setUserAgent(USER_AGENT);
    return this.page;
  }



  async waitTillHTMLRendered(page, timeout = 30000) {
    const checkInterval = 1000;
    const maxChecks = Math.ceil(timeout / checkInterval);
    let lastHTMLSize = 0;
    let stableChecks = 0;

    for (let i = 0; i < maxChecks; i += 1) {
      const html = await page.content().catch(() => "");
      const currentHTMLSize = html.length;

      if (currentHTMLSize && currentHTMLSize === lastHTMLSize) {
        stableChecks += 1;
      } else {
        stableChecks = 0;
      }

      if (stableChecks >= 3) return;

      lastHTMLSize = currentHTMLSize;
      await delay(checkInterval);
    }
  }

  async screenshot(name) {
    ensureDir(SCREENSHOT_DIR);
    if (!this.page || this.page.isClosed()) return;

    await this.page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      fullPage: true
    }).catch(() => { });
  }

  async closePopups(page) {
    const buttonSelectors = [
      "#exampleModalCenter button",
      ".modal.show button.close",
      ".modal.show [data-dismiss='modal']",
      ".modal.show [data-bs-dismiss='modal']",
      "button.cookie-accept",
      "button#cookie-accept",
      ".cookie button",
      ".cc-allow",
      ".cc-dismiss"
    ];

    for (const selector of buttonSelectors) {
      const buttons = await page.$$(selector).catch(() => []);
      for (const button of buttons) {
        try {
          await button.click();
          await delay(300);
        } catch {
          // Optional popup controls can disappear while the page settles.
        }
      }
    }

    await page.evaluate(() => {
      const labels = ["accetto", "accept", "ok", "entra", "continua", "ho 18"];
      const buttons = Array.from(document.querySelectorAll("button, a"));
      for (const button of buttons) {
        const text = (button.textContent || "").trim().toLowerCase();
        if (labels.some((label) => text.includes(label))) {
          button.click();
        }
      }
    }).catch(() => { });
  }

  async waitForLoginFormReady(page) {
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 30000 }).catch(() => { });
    await this.waitTillHTMLRendered(page);

    await page.waitForSelector("input[type='password'], input[name='password']", {
      visible: true,
      timeout: 30000
    });
  }

  async getLoginSelectors(page) {
    return page.evaluate(() => {
      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const cssPath = (node) => {
        if (node.id) return `#${CSS.escape(node.id)}`;
        const name = node.getAttribute("name");
        if (name) return `${node.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
        const type = node.getAttribute("type");
        if (type) return `${node.tagName.toLowerCase()}[type="${CSS.escape(type)}"]`;
        return node.tagName.toLowerCase();
      };

      const inputs = Array.from(document.querySelectorAll("input")).filter(isVisible);
      const emailInput =
        inputs.find((input) => input.type === "email") ||
        inputs.find((input) => /email|mail|username|login|user/i.test(`${input.name} ${input.id} ${input.placeholder}`));
      const passwordInput =
        inputs.find((input) => input.type === "password") ||
        inputs.find((input) => /password|pass/i.test(`${input.name} ${input.id} ${input.placeholder}`));

      return {
        email: emailInput ? cssPath(emailInput) : "input[name='email'], input[type='email']",
        password: passwordInput ? cssPath(passwordInput) : "input[name='password'], input[type='password']"
      };
    });
  }

  async typeHuman(page, selector, value) {
    await page.waitForSelector(selector, { visible: true });
    const input = await page.$(selector);

    await input.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
    await input.click({ clickCount: 3, delay: 40 });
    await page.keyboard.press("Backspace");
    await page.evaluate((sel) => {
      const node = document.querySelector(sel);
      if (!node) return;
      node.value = "";
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector);

    await input.type(value, { delay: 60 + Math.floor(Math.random() * 60) });

    await page.waitForFunction(
      (sel, expected) => document.querySelector(sel)?.value === expected,
      { timeout: 10000 },
      selector,
      value
    );
  }

  async recaptchaNeedsSolving(page) {
    return page.evaluate(() => {
      const frame = document.querySelector("iframe[src*='recaptcha']");
      const widget = document.querySelector(".g-recaptcha, [data-sitekey]");
      const token = document.querySelector("[name='g-recaptcha-response']")?.value || "";
      return Boolean((frame || widget) && !token);
    });
  }

  async injectRecaptchaToken(page, token) {
    await page.evaluate((captchaToken) => {
      let response = document.querySelector("textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']");
      if (!response) {
        response = document.createElement("textarea");
        response.name = "g-recaptcha-response";
        response.style.display = "none";
        document.body.appendChild(response);
      }

      response.value = captchaToken;
      response.setAttribute("value", captchaToken);
      response.dispatchEvent(new Event("input", { bubbles: true }));
      response.dispatchEvent(new Event("change", { bubbles: true }));

      document.querySelectorAll(".g-recaptcha[data-callback], [data-callback]").forEach((node) => {
        const callbackName = node.getAttribute("data-callback");
        if (!callbackName) return;

        const callback = callbackName.split(".").reduce((obj, key) => obj && obj[key], window);
        if (typeof callback === "function") {
          callback(captchaToken);
        }
      });
    }, token);
  }

  async getCaptchaToken(page, siteKey = RECAPTCHA_SITEKEY) {
    try {
      console.log("[2captcha] Requesting solve for page url:", page.url());

      const solution = await solver.recaptcha({
        googlekey: siteKey,
        pageurl: page.url(),
        userAgent: USER_AGENT,
      });

      // Use solution (the variable defined above) to extract the token
      if (solution && solution.data) {
        return solution.data;
      }

      // Handle different library return formats
      const tokenStr = typeof solution === 'string' ? solution : (solution?.request || solution?.code);

      if (tokenStr && typeof tokenStr === 'string') {
        return tokenStr;
      }

      throw new Error("2Captcha returned an unexpected response format");
    } catch (err) {
      console.error("[2captcha] Error during solve:", err.message);
      return null;
    }
  }

  async solveRecaptcha(page) {
    if (!(await this.recaptchaNeedsSolving(page))) return false;
    if (!solver) throw new Error("2Captcha API key not configured for Trovagnocca login.");

    console.log("[i] Solving Trovagnocca reCAPTCHA...");

    const captchaInfo = await page.evaluate((fallbackSitekey) => {
      const node = document.querySelector(".g-recaptcha[data-sitekey], [data-sitekey]");
      return {
        sitekey: node?.getAttribute("data-sitekey") || fallbackSitekey,
        invisible: node?.getAttribute("data-size") === "invisible"
      };
    }, RECAPTCHA_SITEKEY);

    const solution = await solver.recaptcha({
      pageurl: page.url() || LOGIN_URL,
      googlekey: captchaInfo.sitekey,
      userAgent: USER_AGENT,
      invisible: captchaInfo.invisible ? 1 : 0
    });

    const token = solution?.data || solution?.request || solution;
    if (!token || typeof token !== "string") {
      throw new Error("2Captcha did not return a valid reCAPTCHA token.");
    }

    await this.injectRecaptchaToken(page, token);
    console.log("[i] Trovagnocca reCAPTCHA token injected.");
    await delay(1000);
    return true;
  }

  async submitLogin(page, passwordSelector) {
    const submitSelector = "button[type='submit'], input[type='submit'], form button:not([type]), form [type='submit']";
    const submitButton = await page.$(submitSelector);

    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
        submitButton.click()
      ]);
      return;
    }

    const passwordInput = await page.$(passwordSelector);
    if (passwordInput) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
        passwordInput.press("Enter")
      ]);
      return;
    }

    await page.evaluate(() => document.querySelector("form")?.submit());
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null);
  }

  async isLoggedIn(page) {
    return page.evaluate(() => {
      const body = (document.body.innerText || "").toLowerCase();
      const hasLogout = Array.from(document.querySelectorAll("a, button")).some((node) => {
        const text = (node.textContent || "").toLowerCase();
        const href = node.getAttribute("href") || "";
        return text.includes("logout") || text.includes("esci") || href.includes("logout");
      });
      const hasAccount = body.includes("dashboard") || body.includes("account") || body.includes("profilo") || body.includes("i miei annunci");
      const hasLoginForm = Boolean(document.querySelector("input[type='password'], input[name='password']"));

      return (hasLogout || hasAccount) && !hasLoginForm;
    }).catch(() => false);
  }

  async login() {
    ensureDir(SCREENSHOT_DIR);
    const page = await this.newPage();
    const creds = this.getCredential();

    console.log("[i] Opening Trovagnocca login page...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await this.closePopups(page);
    await this.screenshot("01-login-page");

    await this.waitForLoginFormReady(page);
    const selectors = await this.getLoginSelectors(page);

    await this.typeHuman(page, selectors.email, creds.email);
    await this.typeHuman(page, selectors.password, creds.password);
    await this.screenshot("02-credentials-filled");

    await this.solveRecaptcha(page);
    await this.screenshot("03-captcha-ready");

    await this.submitLogin(page, selectors.password);
    await delay(1500);
    await this.closePopups(page);
    await this.waitTillHTMLRendered(page);
    await this.screenshot("04-after-submit");

    if (!(await this.isLoggedIn(page))) {
      await page.goto(HOME_URL, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
      await this.waitTillHTMLRendered(page);
    }

    const loggedIn = await this.isLoggedIn(page);
    const cookies = await page.cookies();

    if (!loggedIn || !cookies.length) {
      throw new Error(`Trovagnocca login validation failed. Current URL: ${page.url()}`);
    }

    this.cookies = cookies;
    console.log("[i] Trovagnocca login success. Cookies saved in memory.");
    return JSON.stringify(cookies);
  }

  async initWithCookies(cookiesJsonOrPath = COOKIE_FILE) {
    if (!cookiesJsonOrPath) return false;

    let cookiesJson = cookiesJsonOrPath;
    if (typeof cookiesJsonOrPath === "string" && fs.existsSync(cookiesJsonOrPath)) {
      cookiesJson = fs.readFileSync(cookiesJsonOrPath, "utf-8");
    }

    let cookies;
    try {
      cookies = typeof cookiesJson === "string" ? JSON.parse(cookiesJson) : cookiesJson;
    } catch {
      console.error("Invalid Trovagnocca cookie JSON, cannot reuse session.");
      return false;
    }

    if (!Array.isArray(cookies) || !cookies.length) return false;

    const page = await this.newPage();

    try {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.setCookie(...cookies);
      await page.goto(HOME_URL, { waitUntil: "networkidle2", timeout: 60000 });

      const ok = await this.isLoggedIn(page);
      if (ok) this.cookies = cookies;
      return ok;
    } catch (error) {
      console.error("Trovagnocca session reuse failed:", error.message);
      return false;
    }
  }

  async getCredit(cookiesJsonOrPath = null) {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    let cookies = this.cookies;

    if (typeof cookiesJsonOrPath === "string" && cookiesJsonOrPath.trim().startsWith("[")) {
      cookies = JSON.parse(cookiesJsonOrPath);
    } else if (Array.isArray(cookiesJsonOrPath)) {
      cookies = cookiesJsonOrPath;
    }

    if (cookies?.length) {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.setCookie(...cookies);
    }

    await page.goto(CREDIT_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await this.waitTillHTMLRendered(page);

    if (page.url().includes("/auth/login")) {
      throw new Error("Credit page redirected to login. Cookies are missing or expired.");
    }

    await page.waitForFunction(() => {
      const text = document.body.innerText || "";
      return text.includes("Credito disponibile") || text.includes("Crediti");
    }, { timeout: 30000 });

    const credit = await page.evaluate(() => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

      const creditLabels = Array.from(document.querySelectorAll("h6"));
      for (const node of creditLabels) {
        const text = clean(node.textContent);
        if (!/Credito disponibile/i.test(text)) continue;

        const highlightedValue = clean(node.querySelector(".highlight, .bold")?.textContent);
        if (/^\d+$/.test(highlightedValue)) return highlightedValue;

        const match = text.match(/Credito disponibile:\s*(\d+)\b/i);
        if (match) return match[1];
      }

      const bodyMatch = clean(document.body.innerText).match(/Credito disponibile:\s*(\d+)\b/i);
      return bodyMatch ? bodyMatch[1] : null;
    });

    if (!credit) {
      throw new Error("Credit not found on Trovagnocca credits page.");
    }

    this.credit = credit;
    console.log(`[i] Trovagnocca credit: ${credit}`);
    return credit;
  }

  async refresh2() {
    try {
      const credit = await this.getCredit();
      const cookies = await this.page.cookies();

      if (!cookies || !cookies.length) {
        return { error: "Cookies not available" };
      }

      this.cookies = cookies;
      return [credit, JSON.stringify(cookies), 0];
    } catch (error) {
      console.error("Trovagnocca Error in refresh2:", error.message);
      return { error: error.message };
    }
  }

  buildPublishData(ad) {
    return {
      title: ad?.title || "",
      description: ad?.description || "",
      city: ad?.annunci_city || ad?.city || "",
      location: ad?.location || "",
      age: ad?.age || ad?.years || "",
      phone: ad?.phone || "",
      categorie: ad?.categorie || ad?.sono || "DONNAUOMO",
      sono: ad?.sono || ad?.categorie || "DONNAUOMO",
      serviceNazionalita: ad?.serviceNazionalita || ad?.nationality || "",
      serviceSNaturale: ad?.serviceSNaturale,
      serviceSRifatto: ad?.serviceSRifatto,
      serviceCBiondi: ad?.serviceCBiondi,
      serviceCMarroni: ad?.serviceCMarroni,
      serviceCNeri: ad?.serviceCNeri,
      serviceCRossi: ad?.serviceCRossi,
      serviceMagro: ad?.serviceMagro,
      serviceFormoso: ad?.serviceFormoso,
      serviceOrale: ad?.serviceOrale,
      serviceAnale: ad?.serviceAnale,
      serviceSadomaso: ad?.serviceSadomaso,
      serviceEsperienzaFidanzata: ad?.serviceEsperienzaFidanzata,
      serviceAttriciPorno: ad?.serviceAttriciPorno,
      serviceEiaculazioneSulCorpo: ad?.serviceEiaculazioneSulCorpo,
      serviceMassaggioErotico: ad?.serviceMassaggioErotico,
      serviceMassaggioTantrico: ad?.serviceMassaggioTantrico,
      serviceFetish: ad?.serviceFetish,
      serviceBacioAllaFrancese: ad?.serviceBacioAllaFrancese,
      serviceGiocoDiRuolo: ad?.serviceGiocoDiRuolo,
      serviceTrio: ad?.serviceTrio,
      serviceSexting: ad?.serviceSexting,
      serviceVideoChiamata: ad?.serviceVideoChiamata,
      serviceUomini: ad?.serviceUomini,
      serviceDonne: ad?.serviceDonne,
      serviceCoppie: ad?.serviceCoppie,
      serviceDisabili: ad?.serviceDisabili,
      serviceACasa: ad?.serviceACasa,
      serviceEventiEFeste: ad?.serviceEventiEFeste,
      serviceAlbergoMotel: ad?.serviceAlbergoMotel,
      serviceClubs: ad?.serviceClubs,
      serviceVisitaADomicilio: ad?.serviceVisitaADomicilio,
      hasWhatapp: isEnabled(ad?.hasWhatapp) || isEnabled(ad?.whatsapp),
      note: ad?.note || "",
      pics: ad?.pics || [],
      images: ad?.pics || [],
      picsAudit: ad?.picsAudit || [],
      typeAnnuncio: ad?.typeAnnuncio || ad?.promo?.visibility || "Free",
      period: ad?.period || ad?.promo?.schedule || "",
      promo: ad?.promo || {
        active: ad?.typeAnnuncio && ad.typeAnnuncio !== "Free",
        visibility: ad?.typeAnnuncio || "Free",
        schedule: ad?.period || ""
      }
    };
  }

  async publish(ad) {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    const publishData = this.buildPublishData(ad);

    return publishAd(page, publishData, {
      browser: this.browser,
      solveRecaptcha: this.solveRecaptcha.bind(this),
      getCaptchaToken: this.getCaptchaToken.bind(this)
    });
  }

  async resolveRemoteId(ad) {
    return extractRemoteAdId(ad?.remotePostID || ad?.urlBK || ad?.idpriv || ad?.remoteId);
  }

  async update(ad) {
    const remoteId = ad?.remotePostID || await this.resolveRemoteId(ad);
    if (!remoteId) {
      throw new Error(`Trovagnocca remotePostID missing for EDIT state on schedule ${ad?.id || ""}`);
    }

    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    const publishData = {
      ...this.buildPublishData(ad),
      remotePostID: remoteId
    };

    return updateAd(page, publishData, {
      remoteId,
      browser: this.browser,
      solveRecaptcha: this.solveRecaptcha.bind(this),
      getCaptchaToken: this.getCaptchaToken.bind(this)
    });
  }

  async requestAdResource(remoteId, method, payload = null) {
    const id = extractRemoteAdId(remoteId);
    if (!id) throw new Error(`Trovagnocca remote ad id missing or invalid: ${remoteId}`);

    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    const manageUrl = `${ACCOUNT_URL}#/ads/manage/${id}`;

    await page.goto(manageUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await this.waitTillHTMLRendered(page);

    if (page.url().includes("/auth/login")) {
      throw new Error("Trovagnocca ad action redirected to login. Cookies are missing or expired.");
    }

    const result = await page.evaluate(async ({ id, method, payload }) => {
      const readCookie = (name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : "";
      };

      const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ||
        document.querySelector('input[name="_token"]')?.value ||
        readCookie("XSRF-TOKEN");

      const headers = {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest"
      };

      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      if (payload !== null) headers["content-type"] = "application/json";

      const response = await fetch(`/api/v1/resource/ad/${id}`, {
        method,
        headers,
        credentials: "same-origin",
        body: payload === null ? null : JSON.stringify(payload)
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data
      };
    }, { id, method, payload });

    if (!result.ok) {
      throw new Error(`Trovagnocca ${method} ad ${id} failed: ${result.status} ${result.statusText} ${JSON.stringify(result.data)}`);
    }

    return {
      ok: true,
      id,
      url: manageUrl,
      action: method === "DELETE" ? "delete" : "suspend",
      status: result.status,
      data: result.data
    };
  }

  async suspend(remoteId) {
    return this.requestAdResource(remoteId, "PUT", { status: "paused" });
  }

  async delete(remoteId) {
    return this.requestAdResource(remoteId, "DELETE");
  }

  async restartBrowser(reason) {
    const note = reason ? ` (${reason})` : "";
    console.warn(`[!] Restarting Trovagnocca bot browser${note}`);
    await this.close();
  }

  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => { });
    }
    this.browser = null;
    this.page = null;
  }
}

module.exports = TrovagnoccaBot;
