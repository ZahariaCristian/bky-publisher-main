const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const TwoCaptcha = require("@2captcha/captcha-solver");
const { buildPublishData, publishAd } = require("../adsManage/amasens/publishAds");

const LOGIN_URL = "https://amasens.com/user/login";
const HOME_URL = "https://amasens.com/";
const PUBLISHER_PROFILE_URL = "https://amasens.com/user/profile/publisher";
const RECAPTCHA_SITEKEY = "6Lc0s8sUAAAAAIUE7WmI6IeRnfrjD8igJE22nEFs";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "amasens-login");
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

class AmasensBot {
  constructor(email, password, credit = 0, platform = "amasens") {
    this.email = `${email || ""}`.trim();
    this.password = `${password || ""}`;
    this.credit = credit || 0;
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
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await this.page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      fullPage: true
    }).catch(() => {});
  }

  async acceptTermsIfPresent(page = this.page) {
    if (!page || page.isClosed()) return false;
    const selector = [
      "#accetta-condizioni-modal #accetto",
      "#accetta-condizioni-modal a.accetto",
      "a[href*='accetta-condizioni'][href*='accetto=1']"
    ].join(", ");
    const acceptButton = await page.waitForSelector(selector, { visible: true, timeout: 5000 })
      .catch(() => null);
    if (!acceptButton) return false;

    console.log("[Amasens] Accepting terms and conditions modal.");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
      page.evaluate((buttonSelector) => {
        const button = document.querySelector(buttonSelector);
        if (!button) throw new Error("Amasens terms acceptance button disappeared before click.");
        button.click();
      }, selector)
    ]);
    await delay(1000);

    if (!page.url().includes("/user/login")) {
      await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    }

    const modalStillVisible = await page.evaluate(() => {
      const modal = document.querySelector("#accetta-condizioni-modal");
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return style.display !== "none" && style.visibility !== "hidden";
    }).catch(() => false);
    if (modalStillVisible) {
      throw new Error("Amasens terms modal remained visible after clicking ACCETTO.");
    }
    return true;
  }

  async isLoggedIn(page = this.page) {
    if (!page || page.isClosed()) return false;
    return page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      const hasLoginForm = Boolean(document.querySelector("form[name='login'] input[name='password'], input#password"));
      const hasLogout = Array.from(document.querySelectorAll("a, button")).some((node) => {
        const text = `${node.textContent || ""}`.toLowerCase();
        const href = `${node.getAttribute("href") || ""}`.toLowerCase();
        return /logout|esci/.test(text) || /logout/.test(href);
      });
      return !url.includes("/user/login") && !hasLoginForm && hasLogout;
    }).catch(() => false);
  }

  async solveRecaptcha(page) {
    const needsCaptcha = await page.$(".anr_captcha_field, iframe[src*='recaptcha'], .g-recaptcha");
    if (!needsCaptcha) return false;
    if (!solver) throw new Error("2Captcha API key not configured for Amasens login.");

    const solution = await solver.recaptcha({
      pageurl: page.url() || LOGIN_URL,
      googlekey: RECAPTCHA_SITEKEY,
      userAgent: USER_AGENT
    });
    const token = solution?.data || solution?.request || solution;
    if (!token || typeof token !== "string") {
      throw new Error("2Captcha did not return a valid Amasens reCAPTCHA token.");
    }

    await page.evaluate((captchaToken) => {
      const response = document.querySelector("#g-recaptcha-response, [name='g-recaptcha-response']");
      if (!response) throw new Error("Amasens reCAPTCHA response field was not found.");
      response.value = captchaToken;
      response.textContent = captchaToken;
      response.dispatchEvent(new Event("input", { bubbles: true }));
      response.dispatchEvent(new Event("change", { bubbles: true }));
    }, token);
    return true;
  }

  async login() {
    if (!this.email || !this.password) throw new Error("Amasens credentials are missing.");
    const page = await this.newPage();
    console.log(`[Amasens] Opening login page for ${this.email}`);
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    const acceptedTerms = await this.acceptTermsIfPresent(page);
    if (acceptedTerms) await this.screenshot("00-after-terms-accepted");
    await page.waitForSelector("#email", { visible: true });
    await page.waitForSelector("#password", { visible: true });
    await this.screenshot("01-login-page");

    await page.type("#email", this.email, { delay: 50 });
    await page.type("#password", this.password, { delay: 50 });
    await page.$eval("#remember", (checkbox) => { checkbox.checked = true; });
    await this.solveRecaptcha(page);
    await this.screenshot("02-login-ready");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
      page.click("form[name='login'] button[type='submit']")
    ]);
    await delay(1500);
    await this.screenshot("03-after-login");

    if (!(await this.isLoggedIn(page))) {
      const errors = await page.evaluate(() => Array.from(document.querySelectorAll("#error_list li, .alert, .error"))
        .map((node) => `${node.textContent || ""}`.replace(/\s+/g, " ").trim())
        .filter(Boolean)).catch(() => []);
      throw new Error(`Amasens login validation failed. URL: ${page.url()}. Errors: ${errors.join(" | ")}`);
    }

    this.cookies = await page.cookies();
    if (!this.cookies.length) throw new Error("Amasens login returned no cookies.");
    console.log(`[Amasens] Login successful for ${this.email}`);
    return JSON.stringify(this.cookies);
  }

  async initWithCookies(cookiesJson) {
    try {
      const cookies = typeof cookiesJson === "string" ? JSON.parse(cookiesJson) : cookiesJson;
      if (!Array.isArray(cookies) || !cookies.length) return false;
      const page = await this.newPage();
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.setCookie(...cookies);
      await page.goto(HOME_URL, { waitUntil: "networkidle2", timeout: 60000 });
      const ok = await this.isLoggedIn(page);
      if (ok) {
        this.cookies = await page.cookies();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getCredit() {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    await page.goto(PUBLISHER_PROFILE_URL, { waitUntil: "networkidle2", timeout: 60000 });

    if (page.url().includes("/user/login") || !(await this.isLoggedIn(page))) {
      throw new Error("Amasens credit page redirected to login. Session is missing or expired.");
    }

    const credit = await page.evaluate(() => {
      const clean = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();
      const parseNumber = (value) => {
        const match = clean(value).match(/\d+(?:[.,]\d+)?/);
        if (!match) return null;
        const number = Number(match[0].replace(",", "."));
        return Number.isFinite(number) ? number : null;
      };

      const panels = Array.from(document.querySelectorAll(".panel"));
      const creditPanel = panels.find((panel) => /\bcrediti?\b/i.test(clean(panel.querySelector(".panel-heading")?.textContent)));
      if (creditPanel) {
        const strongValue = parseNumber(creditPanel.querySelector(".panel-body strong")?.textContent);
        if (strongValue !== null) return strongValue;

        const panelValue = clean(creditPanel.querySelector(".panel-body")?.textContent)
          .match(/totale\s+di\s+(\d+(?:[.,]\d+)?)\s+crediti?/i);
        if (panelValue) return Number(panelValue[1].replace(",", "."));
      }

      const bodyText = clean(document.body?.innerText);
      const fallback = bodyText.match(/(?:totale\s+di|saldo(?:\s+crediti)?|crediti?)\D{0,60}(\d+(?:[.,]\d+)?)/i);
      return fallback ? Number(fallback[1].replace(",", ".")) : null;
    });

    if (!Number.isFinite(credit)) {
      throw new Error("Amasens credit amount was not found on the publisher profile page.");
    }

    this.credit = credit;
    console.log(`[Amasens] Credit: ${credit}`);
    return credit;
  }

  async refresh2() {
    try {
      const credit = await this.getCredit();
      const page = this.page;
      this.cookies = await page.cookies();
      return [credit, JSON.stringify(this.cookies), 0];
    } catch (error) {
      return { error: error.message };
    }
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

    return publishAd(page, {
      ...ad,
      ...this.buildPublishData(ad)
    });
  }

  async restartBrowser(reason) {
    console.warn(`[Amasens] Restarting browser${reason ? ` (${reason})` : ""}`);
    await this.close();
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.page = null;
    this.cookies = null;
  }
}

module.exports = AmasensBot;
