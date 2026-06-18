const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const TwoCaptcha = require("@2captcha/captcha-solver");
const { buildPublishData, publishAd } = require("../adsManage/incontriamoci/publishAds");
// const { updateAd } = require("../adsManage/trovagnocca/updateAd");

const LOGIN_URL = "https://incontriamoci.xxx/user/login";
const HOME_URL = "https://incontriamoci.xxx/";
// const ACCOUNT_URL = "https://incontriamoci.xxx/user/profile/publisher";
const CREDIT_URL = "https://incontriamoci.xxx/user/profile/publisher";

const RECAPTCHA_SITEKEY = "6Le3ifIqAAAAAGvbIVmB4bP9-tALw0bVVjNbFOpG";
const COOKIE_FILE = path.join(__dirname, "incontriamoci-cookies.json");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "incontriamoci-login");
const API_KEY_FILE = path.join(__dirname, "settings", "2captchaApiKey.txt");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// const { RESIDENTIAL_PROXY, PROXY } = require("../const")

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

class IncontriamociBot {
  constructor(email, password, credit, platform) {
    this.email = email || "Raffaelesorrentino74@yahoo.it";
    this.password = password || "dR30101974";
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

    const executablePath = typeof puppeteer.executablePath === "function"
      ? await puppeteer.executablePath()
      : undefined;

    this.browser = await puppeteer.launch({
      headless: false,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1366,900",
        // `--proxy-server=http://${RESIDENTIAL_PROXY.host}:${RESIDENTIAL_PROXY.port}`
      ],
      defaultViewport: {
        width: 1366,
        height: 900
      }
    });
  }

  async newPage() {
    await this.launch();

    if (this.page && !this.page.isClosed()) {
      await this.page.close().catch(() => { });
      this.page = null;
    }

    this.page = await this.browser.newPage();
    // await this.page.authenticate({
    //   username: RESIDENTIAL_PROXY.username,
    //   password: RESIDENTIAL_PROXY.password
    // });
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(60000);
    await this.page.setUserAgent(USER_AGENT);
    return this.page;
  }

  async screenshot(name) {
    ensureDir(SCREENSHOT_DIR);
    if (!this.page || this.page.isClosed()) return;

    await this.page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      fullPage: true
    }).catch(() => { });
  }

  async waitForLoginFormReady(page) {
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 30000 }).catch(() => { });
    await page.waitForSelector("input[type='password'], input[name='password'], input[name='_password']", {
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
        inputs.find((input) => /^(email|_email|username|_username|login|user)$/i.test(input.name || input.id || "")) ||
        inputs.find((input) => input.type === "email") ||
        inputs.find((input) => /email|mail|username|login|user/i.test(`${input.name} ${input.id} ${input.placeholder}`));
      const passwordInput =
        inputs.find((input) => /^(password|_password|pass|pwd)$/i.test(input.name || input.id || "")) ||
        inputs.find((input) => input.type === "password") ||
        inputs.find((input) => /password|pass/i.test(`${input.name} ${input.id} ${input.placeholder}`));

      return {
        email: emailInput ? cssPath(emailInput) : "input[name='email'], input[name='_username'], input[type='email']",
        password: passwordInput ? cssPath(passwordInput) : "input[name='password'], input[name='_password'], input[type='password']"
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
    if (!solver) throw new Error("2Captcha API key not configured for Incontriamoci login.");

    console.log("[i] Solving Incontriamoci reCAPTCHA...");

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
    console.log("[i] Incontriamoci reCAPTCHA token injected.");
    await delay(1000);
    return true;
  }

  async submitLogin(page, passwordSelector) {
    const submitSelector = await page.evaluate((passSelector) => {
      const password = document.querySelector(passSelector);
      const form = password?.closest("form") || document.querySelector("form");
      const submit = form?.querySelector("button[type='submit'], input[type='submit'], button:not([type]), [type='submit']");

      if (!submit) return "";
      if (submit.id) return `#${CSS.escape(submit.id)}`;

      const name = submit.getAttribute("name");
      if (name) return `${submit.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;

      return "button[type='submit'], input[type='submit'], form button:not([type]), form [type='submit']";
    }, passwordSelector).catch(() => "");

    const submitButton = submitSelector ? await page.$(submitSelector) : null;

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
      const currentUrl = window.location.href;
      const body = (document.body.innerText || "").toLowerCase();
      const hasLogout = Array.from(document.querySelectorAll("a, button")).some((node) => {
        const text = (node.textContent || "").toLowerCase();
        const href = node.getAttribute("href") || "";
        return text.includes("logout") || text.includes("esci") || href.includes("logout") || href.includes("user/logout");
      });
      const hasAccount =
        currentUrl.includes("/user/profile") ||
        currentUrl.includes("/user/ads") ||
        body.includes("dashboard") ||
        body.includes("account") ||
        body.includes("profilo") ||
        body.includes("i miei annunci") ||
        body.includes("credito disponibile");
      const hasLoginForm = Boolean(document.querySelector("input[type='password'], input[name='password'], input[name='_password']"));

      return (hasLogout || hasAccount) && !hasLoginForm;
    }).catch(() => false);
  }

  async acceptTermsModal(page) {
    const selectors = [
      "#accetta-condizioni-modal #accetto",
      "#accetto",
      "button.accetta-condizioni.accetto",
      ".modal.incontriamoci-modal button.accetto"
    ];

    for (const selector of selectors) {
      const button = await page.$(selector).catch(() => null);
      if (!button) continue;

      try {
        await button.evaluate((node) => {
          node.scrollIntoView({ block: "center", inline: "nearest" });
        });

        await button.click();
        await delay(800);
        return true;
      } catch {
        // Try next selector if this one disappeared or is covered.
      }
    }

    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a"));
      const acceptButton = buttons.find((node) => {
        const text = (node.textContent || "").trim().toLowerCase();
        return text === "accetto";
      });

      if (!acceptButton) return false;
      acceptButton.click();
      return true;
    }).catch(() => false);

    if (clicked) {
      await delay(800);
    }

    return clicked;
  }

  async login() {
    ensureDir(SCREENSHOT_DIR);
    const page = await this.newPage();
    const creds = this.getCredential();

    console.log("[i] Opening Incontriamoci login page...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await this.acceptTermsModal(page);
    await this.screenshot("01-login-page");

    await this.waitForLoginFormReady(page);
    const selectors = await this.getLoginSelectors(page);

    console.log(`[i] Typing Incontriamoci credentials for ${creds.email}`);
    await this.typeHuman(page, selectors.email, creds.email);
    await this.typeHuman(page, selectors.password, creds.password);
    await this.screenshot("02-credentials-filled");

    await this.solveRecaptcha(page);
    await this.screenshot("03-captcha-ready");

    await this.submitLogin(page, selectors.password);
    await delay(1500);
    await this.screenshot("04-after-submit");

    if (!(await this.isLoggedIn(page))) {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    }

    const loggedIn = await this.isLoggedIn(page);
    const cookies = await page.cookies();

    if (!loggedIn || !cookies.length) {
      throw new Error(`Incontriamoci login validation failed. Current URL: ${page.url()}`);
    }

    this.cookies = cookies;
    console.log("[i] Incontriamoci login success. Cookies saved in memory.");
    return JSON.stringify(cookies);
  }

  async getCredit(cookiesJsonOrPath = null) {
    const page = this.page && !this.page.isClosed() ? this.page : await this.newPage();
    let cookies = this.cookies;

    if (typeof cookiesJsonOrPath === "string" && cookiesJsonOrPath.trim().startsWith("[")) {
      cookies = JSON.parse(cookiesJsonOrPath);
    } else if (typeof cookiesJsonOrPath === "string" && fs.existsSync(cookiesJsonOrPath)) {
      cookies = JSON.parse(fs.readFileSync(cookiesJsonOrPath, "utf-8"));
    } else if (Array.isArray(cookiesJsonOrPath)) {
      cookies = cookiesJsonOrPath;
    }

    if (cookies?.length) {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.setCookie(...cookies);
    }

    await page.goto(CREDIT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (page.url().includes("/auth/login") || page.url().includes("/user/login")) {
      throw new Error("Credit page redirected to login. Cookies are missing or expired.");
    }

    await page.waitForFunction(() => {
      const text = (document.body.innerText || "").toLowerCase();
      return text.includes("credito") || text.includes("crediti") || text.includes("saldo");
    }, { timeout: 8000 }).catch(() => null);

    const credit = await page.evaluate(() => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
      const parseCredit = (value) => {
        const text = clean(value);
        if (!text) return null;

        const labelFirst = text.match(/(?:credito(?:\s+disponibile)?|crediti|saldo)\D{0,80}(\d+(?:[.,]\d+)?)/i);
        if (labelFirst) return labelFirst[1].replace(",", ".");

        const numberFirst = text.match(/(\d+(?:[.,]\d+)?)\s*(?:crediti?|credito)\b/i);
        if (numberFirst) return numberFirst[1].replace(",", ".");

        return null;
      };

      const selectorCandidates = [
        "[class*='credit' i]",
        "[id*='credit' i]",
        "[class*='credito' i]",
        "[id*='credito' i]",
        "[class*='saldo' i]",
        "[id*='saldo' i]",
        "h1, h2, h3, h4, h5, h6",
        "p, span, strong, b, li, td, th, div"
      ];

      const nodes = Array.from(document.querySelectorAll(selectorCandidates.join(",")));
      for (const node of nodes) {
        const text = clean(node.textContent);
        if (!/(credito|crediti|saldo)/i.test(text)) continue;

        const directCredit = parseCredit(text);
        if (directCredit !== null) return directCredit;

        const nearbyText = [
          node.parentElement?.textContent,
          node.closest("tr")?.textContent,
          node.nextElementSibling?.textContent,
          node.previousElementSibling?.textContent
        ].map(clean).filter(Boolean).join(" ");

        const nearbyCredit = parseCredit(nearbyText);
        if (nearbyCredit !== null) return nearbyCredit;
      }

      return parseCredit(document.body.innerText);
    });

    if (!credit) {
      throw new Error("Credit not found on Incontriamoci credits page.");
    }

    this.credit = credit;
    console.log(`[i] Incontriamoci credit: ${credit}`);
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
      console.error("Incontriamoci Error in refresh2:", error.message);
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
    const note = reason ? ` (${reason})` : "";
    console.warn(`[!] Restarting Incontriamoci bot browser${note}`);
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

module.exports = IncontriamociBot;
